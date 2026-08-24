import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { derouleType, derouleTypeSaisi, phaseSaisie, type DerouleTypeSaisi } from "./phase";

/**
 * La saisie d'une phase, et surtout SON JOUR (`played_on`, ajouté le 2026-08-24 pour les
 * tournois étalés sur plusieurs week-ends).
 *
 * 🔴 CE QUI PEUT ÊTRE FAUX EN SILENCE EST LA DATE. Le premier jet validait par
 * `Date.parse()` — mesuré : il ACCEPTE « 2026-02-31 » (JavaScript normalise au 3 mars) et
 * « 2026-02-29 » (2026 n'est pas bissextile). La règle laissait donc passer exactement les
 * fautes de frappe qu'elle visait, et Postgres les aurait refusées ensuite par une erreur
 * brute de driver. Ces cas sont ici pour qu'on ne réécrive jamais la version faible.
 *
 * ⚠️ La date reste une CHAÎNE de bout en bout : aucun `Date` n'est construit hors de la
 * validation, donc aucun fuseau ne peut décaler la journée d'un cran.
 */

/** Une phase valide au minimum — seul le jour varie d'un cas à l'autre. */
const phase = (champs: Record<string, unknown>) => ({
  name: "Journée 1 — manche 1",
  kind: "suisse" as const,
  ...champs,
});

describe("phaseSaisie — le jour d'une phase", () => {
  it("accepte un jour réel et le rend TEL QUEL", () => {
    const analyse = phaseSaisie.safeParse(phase({ playedOn: "2026-09-06" }));
    assert.equal(analyse.success, true, analyse.error?.issues[0]?.message);
    assert.equal(
      analyse.data?.playedOn,
      "2026-09-06",
      "la chaîne doit traverser sans devenir un instant",
    );
  });

  it("vaut null quand rien n'est fourni — un tournoi d'un jour n'a rien à saisir", () => {
    const analyse = phaseSaisie.safeParse(phase({}));
    assert.equal(analyse.success, true, analyse.error?.issues[0]?.message);
    assert.equal(analyse.data?.playedOn, null);
  });

  it("refuse le 31 février, que Date.parse() acceptait", () => {
    const analyse = phaseSaisie.safeParse(phase({ playedOn: "2026-02-31" }));
    assert.equal(analyse.success, false, "2026-02-31 n'existe pas");
    assert.match(analyse.error?.issues[0]?.message ?? "", /n'existe pas/);
  });

  it("refuse le 29 février d'une année NON bissextile", () => {
    const analyse = phaseSaisie.safeParse(phase({ playedOn: "2026-02-29" }));
    assert.equal(analyse.success, false, "2026 n'est pas bissextile");
  });

  it("accepte le 29 février d'une année bissextile — la garde ne doit pas être trop zélée", () => {
    const analyse = phaseSaisie.safeParse(phase({ playedOn: "2024-02-29" }));
    assert.equal(analyse.success, true, analyse.error?.issues[0]?.message);
  });

  it("refuse un mois qui n'existe pas", () => {
    const analyse = phaseSaisie.safeParse(phase({ playedOn: "2026-13-01" }));
    assert.equal(analyse.success, false);
  });

  it("refuse une forme qui n'est pas un jour ISO", () => {
    const analyse = phaseSaisie.safeParse(phase({ playedOn: "06/09/2026" }));
    assert.equal(analyse.success, false);
  });
});

describe("phaseSaisie — le format", () => {
  it("accepte « suisse », le format des TFT sur plusieurs week-ends", () => {
    const analyse = phaseSaisie.safeParse(phase({}));
    assert.equal(analyse.success, true);
    assert.equal(analyse.data?.kind, "suisse");
  });

  it("refuse un format inconnu, et le dit en français", () => {
    const analyse = phaseSaisie.safeParse(phase({ kind: "double-elimination" }));
    assert.equal(analyse.success, false);
    assert.match(analyse.error?.issues[0]?.message ?? "", /Choisissez le format/);
  });
});

/**
 * L'assistant de déroulé type (2026-08-24).
 *
 * 🔴 DEUX CHOSES PEUVENT ÊTRE FAUSSES EN SILENCE ICI, et aucune ne se voit à l'écran :
 * ① la PREMIÈRE manche doit être des `lobbies` et jamais du `suisse` — une manche suisse se
 * compose d'après le classement, or au tout premier tour il n'y en a pas ; le tournoi
 * partirait de l'ordre de saisie en croyant partir du niveau, et rien ne le signalerait ;
 * ② les dates avancent de sept jours SANS jamais devenir un instant — un décalage d'un cran
 * mettrait toutes les journées la veille, ce qu'on ne verrait qu'au premier week-end.
 */
describe("derouleType — ce que l'assistant poserait", () => {
  const saisie = (champs: Partial<DerouleTypeSaisi>): DerouleTypeSaisi => ({
    journees: 4,
    manchesParJournee: 2,
    premierJour: "2026-09-05",
    finale: false,
    ...champs,
  });

  it("pose journées × manches, dans l'ordre", () => {
    const phases = derouleType(saisie({}));
    assert.equal(phases.length, 8);
    assert.equal(phases[0].name, "Journée 1 — manche 1");
    assert.equal(phases[7].name, "Journée 4 — manche 2");
  });

  it("🔴 la PREMIÈRE manche est des lobbies, TOUTES les autres du suisse", () => {
    const phases = derouleType(saisie({}));
    assert.equal(phases[0].kind, "lobbies", "au premier tour, aucun classement n'existe");
    assert.deepEqual(
      [...new Set(phases.slice(1).map((p) => p.kind))],
      ["suisse"],
      "toutes les manches suivantes se composent d'après le classement",
    );
  });

  it("🔴 les journées avancent de SEPT jours, et restent des chaînes", () => {
    const phases = derouleType(saisie({}));
    assert.equal(phases[0].playedOn, "2026-09-05");
    assert.equal(phases[1].playedOn, "2026-09-05", "les deux manches d'une journée sont le MÊME jour");
    assert.equal(phases[2].playedOn, "2026-09-12");
    assert.equal(phases[6].playedOn, "2026-09-26");
  });

  it("franchit un changement de mois, et un passage à l'heure d'hiver", () => {
    // Le dernier dimanche d'octobre 2026 tombe le 25 : la journée 4 l'enjambe. Un calcul en
    // heure LOCALE rendrait ici le 24 ou une heure décalée — celui-ci reste un quantième.
    const phases = derouleType(saisie({ journees: 4, manchesParJournee: 1, premierJour: "2026-10-10" }));
    assert.deepEqual(
      phases.map((p) => p.playedOn),
      ["2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"],
    );
  });

  it("ne nomme pas les manches quand il n'y en a qu'une par journée", () => {
    const phases = derouleType(saisie({ manchesParJournee: 1 }));
    assert.equal(phases[0].name, "Journée 1");
  });

  it("ajoute la finale au dernier jour, quand elle est demandée", () => {
    const phases = derouleType(saisie({ finale: true }));
    const derniere = phases[phases.length - 1];
    assert.equal(derniere.kind, "finale");
    assert.equal(derniere.playedOn, "2026-09-26", "la finale se joue le jour de la dernière journée");
  });

  it("sans premier jour, aucune phase n'est datée — et rien n'invente une date", () => {
    const phases = derouleType(saisie({ premierJour: null, finale: true }));
    assert.deepEqual([...new Set(phases.map((p) => p.playedOn))], [null]);
  });
});

describe("derouleTypeSaisi — les bornes", () => {
  it("refuse un volume qui ferait un déroulé illisible, et dit combien", () => {
    const analyse = derouleTypeSaisi.safeParse({ journees: 12, manchesParJournee: 6 });
    assert.equal(analyse.success, false);
    assert.match(analyse.error?.issues[0]?.message ?? "", /72 phases/);
  });

  it("accepte le cas réel : 4 week-ends de 2 manches, plus la finale", () => {
    const analyse = derouleTypeSaisi.safeParse({
      journees: 4,
      manchesParJournee: 2,
      premierJour: "2026-09-05",
      finale: true,
    });
    assert.equal(analyse.success, true, analyse.error?.issues[0]?.message);
  });
});
