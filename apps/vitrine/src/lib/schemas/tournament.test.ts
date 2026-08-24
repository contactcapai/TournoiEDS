import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tournamentInputSchema, TAILLE_EQUIPE_MAX } from "./tournament";

/**
 * L'effectif d'équipe d'un tournoi (`team_size`), rendu saisissable le 2026-08-24.
 *
 * 🔴 CE QUI PEUT ÊTRE FAUX EN SILENCE EST LE CAS VIDE : la colonne est `notNull default 1`,
 * donc un champ effacé doit retomber sur l'individuel. Si `entierOptionnel(...) ?? 1` perdait
 * son `?? 1`, un tournoi d'équipes de 5 redeviendrait individuel au premier enregistrement —
 * sans erreur, et le défaut ne se verrait qu'au pointage. ⚠️ Vérifié : ce test SAIT échouer.
 */

/** Un tournoi valide au minimum — seul `teamSize` varie d'un cas à l'autre. */
const tournoi = (champs: Record<string, unknown>) => ({
  name: "Coupe des Sacres",
  game: "Teamfight Tactics",
  slug: "coupe-des-sacres",
  startsAt: new Date("2026-09-10T18:00:00Z"),
  // ⚠️ OBLIGATOIRE ICI, et ce n'est pas du remplissage : sans événement rattaché, le tournoi
  // EST le rendez-vous, donc il doit dire où il se tient (règle de la 9.5, `superRefine`).
  // Le premier jet de ce fichier l'omettait et les deux cas nominaux échouaient.
  venueName: "En ligne",
  registrationMode: "interne" as const,
  ...champs,
});

describe("teamSize — l'individuel est le DÉFAUT, jamais une absence", () => {
  it("vaut 1 quand rien n'est fourni", () => {
    const analyse = tournamentInputSchema.safeParse(tournoi({}));
    assert.equal(analyse.success, true, analyse.error?.issues[0]?.message);
    assert.equal(analyse.data?.teamSize, 1);
  });

  it("accepte un effectif d'équipe réel", () => {
    const analyse = tournamentInputSchema.safeParse(tournoi({ teamSize: 5 }));
    assert.equal(analyse.success, true, analyse.error?.issues[0]?.message);
    assert.equal(analyse.data?.teamSize, 5);
  });

  it("refuse 0 — et la borne basse est celle de la base", () => {
    const analyse = tournamentInputSchema.safeParse(tournoi({ teamSize: 0 }));
    assert.equal(analyse.success, false);
    assert.match(analyse.error?.issues[0]?.message ?? "", /au moins 1/);
  });

  it("refuse au-delà du plafond, et le NOMME", () => {
    const analyse = tournamentInputSchema.safeParse(
      tournoi({ teamSize: TAILLE_EQUIPE_MAX + 1 }),
    );
    assert.equal(analyse.success, false);
    assert.match(
      analyse.error?.issues[0]?.message ?? "",
      new RegExp(String(TAILLE_EQUIPE_MAX)),
      "le message doit dire le maximum, pas seulement le refuser",
    );
  });

  it("refuse une saisie ILLISIBLE plutôt que de la ramener à 1", () => {
    // `entierOptionnel` rend `NaN` sur « 5 joueurs » : une faute de frappe doit se SIGNALER,
    // pas retomber en silence sur l'individuel — même doctrine que `matchDurationMinutes`.
    const analyse = tournamentInputSchema.safeParse(tournoi({ teamSize: Number.NaN }));
    assert.equal(analyse.success, false);
    assert.match(analyse.error?.issues[0]?.message ?? "", /en chiffres/);
  });
});
