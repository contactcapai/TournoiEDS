import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { structureDePhase } from "./generation";
import {
  podiumDepuis,
  qualifiesDesPoules,
  rangsParParcours,
  rangsParPoule,
  rangsParVictoires,
  troisiemesExAequo,
} from "./parcours";
import { calculerPropagation, issueDeRencontre } from "./progression";

/**
 * Le rang déduit du parcours (Story 10.8, correctif né du tournoi réel de Brice).
 *
 * 🔴 CE QUI EST FAUX EN SILENCE ICI : un classement de tableau qui range les gens dans le mauvais
 * ordre est **plausible**. Personne ne recompte à la main qui est allé le plus loin dans une
 * double élimination — on lit l'écran et on le croit. D'où des tests qui partent de la VRAIE
 * structure et jouent des tournois entiers.
 *
 * ⚠️ Aucune structure n'est écrite à la main : tout vient de `structureDePhase`. Un gabarit
 * inventé ici pourrait diverger du générateur et le test passerait quand même.
 */

type Phase = ReturnType<typeof phaseGeneree>;

function phaseGeneree(
  kind: Parameters<typeof structureDePhase>[0],
  participants: readonly string[],
  reglages: Parameters<typeof structureDePhase>[2] = {},
) {
  return structureDePhase(kind, participants.length, reglages).map((rencontre) => ({
    matchId: `m${rencontre.position}`,
    position: rencontre.position,
    pool: rencontre.pool,
    places: rencontre.places.map((place) => ({
      slotId: `m${rencontre.position}s${place.position}`,
      position: place.position,
      entryId:
        place.source.de === "tete_de_serie" && place.source.rang !== null
          ? participants[place.source.rang - 1]
          : null,
      score: null as number | null,
      rank: null as number | null,
      source: place.source as { de: string; rencontre?: number },
    })),
  }));
}

/** Un tour du cycle réel : calculer la propagation, puis l'écrire. */
function propager(phase: Phase) {
  const { deplacements } = calculerPropagation(phase);
  for (const d of deplacements) {
    for (const rencontre of phase) {
      for (const place of rencontre.places) {
        if (place.slotId !== d.slotId) continue;
        place.entryId = d.entryId;
        place.score = null;
        place.rank = null;
      }
    }
  }
  return phase;
}

/** Ce que `rangsParParcours` attend : la structure plus l'issue dépouillée. */
const pourRang = (phase: Phase) =>
  phase.map((r) => ({ ...r, issue: issueDeRencontre(r.places) }));

/**
 * Joue la phase entière : la place 1 gagne toujours, sauf indication contraire.
 *
 * ⚠️ La propagation est rejouée à CHAQUE rencontre dépouillée — c'est le cycle réel, et c'est ce
 * qui remplit les tours suivants. Tout saisir d'un coup ne marcherait pas : les places aval ne
 * sont pourvues qu'après le dépouillement de leur amont.
 */
function jouerTout(phase: Phase, gagneADroite: readonly number[] = []) {
  for (let tour = 0; tour < 12; tour += 1) {
    let saisieFaite = false;
    for (const rencontre of phase) {
      const occupees = rencontre.places.filter((p) => p.entryId !== null);
      const dejaSaisie = rencontre.places.some((p) => p.score !== null);
      if (occupees.length !== 2 || dejaSaisie) continue;
      const droite = gagneADroite.includes(rencontre.position);
      rencontre.places[0].score = droite ? 1 : 2;
      rencontre.places[1].score = droite ? 2 : 1;
      saisieFaite = true;
    }
    propager(phase);
    if (!saisieFaite) break;
  }
  return phase;
}

const noms = (ids: readonly string[]) => new Map(ids.map((id) => [id, id.toUpperCase()]));

const HUIT = ["a", "b", "c", "d", "e", "f", "g", "h"];
const QUATRE = ["a", "b", "c", "d"];

describe("rangsParParcours — élimination SIMPLE", () => {
  it("un tableau de 8 entièrement joué donne 1, 2, 3-3, 5-5-5-5", () => {
    const phase = jouerTout(propager(phaseGeneree("bracket", HUIT)));
    const lignes = rangsParParcours(pourRang(phase), noms(HUIT));

    assert.equal(lignes.length, 8, "les 8 joueurs sont classés");
    assert.deepEqual(
      lignes.map((l) => l.rang),
      [1, 2, 3, 3, 5, 5, 5, 5],
      "🔴 rangs DENSES : les deux demi-finalistes sont 3ᵉ, les quatre sortis au 1ᵉʳ tour sont 5ᵉ",
    );
    assert.equal(lignes[0].exAequo, 1, "le vainqueur n'est pas ex æquo");
    assert.equal(lignes[0].profondeur, null, "il n'a jamais été éliminé");
    assert.equal(lignes[2].exAequo, 2);
    assert.equal(lignes[4].exAequo, 4);
  });

  it("le vainqueur est bien celui qui a gagné la finale", () => {
    const phase = jouerTout(propager(phaseGeneree("bracket", HUIT)));
    const rencontres = pourRang(phase);
    // La finale est la rencontre la plus profonde : celle dont aucune autre n'attend le vainqueur.
    const attendues = new Set(
      rencontres.flatMap((r) =>
        r.places.map((p) => (p.source.de === "vainqueur" ? p.source.rencontre : undefined)),
      ),
    );
    const finale = rencontres.find((r) => !attendues.has(r.position));
    assert.ok(finale, "il doit y avoir une finale");

    const lignes = rangsParParcours(rencontres, noms(HUIT));
    assert.equal(lignes[0].id, finale.issue.vainqueur);
  });

  it("un tableau à effectif non-puissance-de-deux se classe aussi (exemptions)", () => {
    const CINQ = ["a", "b", "c", "d", "e"];
    const phase = jouerTout(propager(phaseGeneree("bracket", CINQ)));
    const lignes = rangsParParcours(pourRang(phase), noms(CINQ));
    assert.equal(lignes.length, 5, "les 5 joueurs sont classés, pas 8");
    assert.equal(lignes[0].rang, 1);
    // 🔴 Une exemption n'élimine personne : personne ne doit être classé pour l'avoir « perdue ».
    assert.equal(new Set(lignes.map((l) => l.id)).size, 5);
  });

  it("une phase À MOITIÉ jouée ne désigne pas de vainqueur unique", () => {
    const phase = propager(phaseGeneree("bracket", HUIT));
    // On ne joue que le premier tour.
    for (const rencontre of phase.filter((r) => r.position <= 4)) {
      rencontre.places[0].score = 2;
      rencontre.places[1].score = 1;
    }
    propager(phase);

    const lignes = rangsParParcours(pourRang(phase), noms(HUIT));
    const premiers = lignes.filter((l) => l.rang === 1);
    assert.equal(premiers.length, 4, "les 4 rescapés sont encore à égalité au sommet");
    assert.ok(premiers.every((l) => l.profondeur === null));
  });
});

describe("rangsParParcours — DOUBLE élimination", () => {
  it("🔴 le cas RÉEL de Brice : 4 joueurs, double élimination, tout joué", () => {
    // Reproduit exactement ce qu'il a fait le 2026-08-15 : 4 présents, doubleElimination,
    // 6 rencontres, 12 places saisies au score. Le classement était VIDE avant ce module.
    const phase = jouerTout(propager(phaseGeneree("bracket", QUATRE, { doubleElimination: true })));
    assert.equal(phase.length, 6, "6 rencontres, comme en base");

    const lignes = rangsParParcours(pourRang(phase), noms(QUATRE));
    assert.equal(lignes.length, 4, "les 4 joueurs sont classés");
    assert.deepEqual(
      lignes.map((l) => l.rang),
      [1, 2, 3, 4],
      "🔴 aucun ex æquo en double élimination à 4 : le tableau départage tout le monde",
    );
    assert.equal(lignes[0].profondeur, null, "le vainqueur de la grande finale n'est pas éliminé");
  });

  it("une défaite chez les VAINQUEURS n'élimine pas — elle fait descendre", () => {
    const phase = propager(phaseGeneree("bracket", QUATRE, { doubleElimination: true }));
    const premiere = phase[0];
    const perdantPremierTour = premiere.places[1].entryId as string;

    premiere.places[0].score = 2;
    premiere.places[1].score = 1;
    propager(phase);

    const lignes = rangsParParcours(pourRang(phase), noms(QUATRE));
    const ligne = lignes.find((l) => l.id === perdantPremierTour);
    assert.ok(ligne);
    assert.equal(
      ligne.profondeur,
      null,
      "🔴 il a perdu, mais il descend chez les perdants : il n'est PAS éliminé",
    );
  });

  it("le rang final est cohérent avec l'ordre des éliminations", () => {
    const phase = jouerTout(propager(phaseGeneree("bracket", HUIT, { doubleElimination: true })));
    const lignes = rangsParParcours(pourRang(phase), noms(HUIT));

    assert.equal(lignes.length, 8);
    assert.equal(lignes[0].rang, 1);
    // Les rangs sont croissants et commencent à 1 — un classement dense bien formé.
    let precedent = 0;
    for (const ligne of lignes) {
      assert.ok(ligne.rang >= precedent, "les rangs ne reculent jamais");
      precedent = ligne.rang;
    }
    assert.equal(new Set(lignes.map((l) => l.id)).size, 8, "personne n'est classé deux fois");
  });
});

describe("rangsParVictoires — POULE : personne n'est éliminé", () => {
  it("une poule à 4 classe par victoires", () => {
    const phase = propager(phaseGeneree("poule", QUATRE));
    // `a` gagne tout, `b` gagne tout sauf contre `a`, etc. — on fait gagner la place gauche.
    for (const rencontre of phase) {
      rencontre.places[0].score = 3;
      rencontre.places[1].score = 0;
    }

    const lignes = rangsParVictoires(pourRang(phase), noms(QUATRE));
    assert.equal(lignes.length, 4, "les 4 joueurs sont classés");
    assert.equal(lignes[0].rang, 1);
    assert.ok(
      lignes.every((l) => l.profondeur !== null),
      "`profondeur` porte le nombre de victoires, jamais null dans une poule",
    );
  });

  it("🔴 la logique d'ÉLIMINATION ne s'applique pas à une poule", () => {
    /**
     * Chacun rencontre chacun : appliquer « perdre élimine » marque presque tout le monde
     * « sorti », ce qui n'a aucun sens dans une poule.
     *
     * ⚠️ CE TEST A D'ABORD COMPARÉ LES DEUX **ORDRES** RENDUS, et il échouait : avec « la gauche
     * gagne toujours », les deux dérivations tombent sur le même ordre par coïncidence. C'était
     * le test qui avait tort — ce qui distingue les deux fonctions est leur NATURE, pas le
     * résultat sur un cas particulier. On mesure donc la nature.
     */
    const phase = propager(phaseGeneree("poule", QUATRE));
    for (const rencontre of phase) {
      rencontre.places[0].score = 3;
      rencontre.places[1].score = 0;
    }

    const parParcours = rangsParParcours(pourRang(phase), noms(QUATRE));
    const elimines = parParcours.filter((l) => l.profondeur !== null).length;
    assert.ok(
      elimines >= 3,
      `la dérivation de tableau déclare ${elimines} éliminés sur 4 dans une poule — absurde`,
    );

    const parVictoires = rangsParVictoires(pourRang(phase), noms(QUATRE));
    assert.equal(
      parVictoires.filter((l) => l.profondeur === null).length,
      0,
      "la dérivation de poule n'élimine personne : `profondeur` y compte des victoires",
    );
  });

  it("la différence de score départage à égalité de victoires", () => {
    const phase = propager(phaseGeneree("poule", ["a", "b"]));
    phase[0].places[0].score = 10;
    phase[0].places[1].score = 0;
    const lignes = rangsParVictoires(pourRang(phase), noms(["a", "b"]));
    assert.equal(lignes[0].exAequo, 1, "une différence de score sépare deux joueurs");
    assert.equal(lignes[1].exAequo, 1);
  });
});

describe("rangsParVictoires — 🔴 une égalité se départage par la CONFRONTATION DIRECTE", () => {
  /** Une rencontre de poule jouée, avec son issue — score de `a` puis de `b`. */
  const m = (position: number, a: string, sa: number, b: string, sb: number) => {
    const places = [
      { position: 1, entryId: a, score: sa, rank: null, source: null },
      { position: 2, entryId: b, score: sb, rank: null, source: null },
    ];
    return { position, pool: null, places, issue: issueDeRencontre(places) };
  };
  // Zeta bat Alpha 13-11 ; Alpha et Zeta finissent à 2 victoires et même différence (+10).
  const POULE = [
    m(1, "zeta", 13, "alpha", 11), m(2, "alpha", 13, "c", 5), m(3, "zeta", 13, "c", 1),
    m(4, "alpha", 13, "d", 9), m(5, "d", 13, "zeta", 9), m(6, "c", 13, "d", 11),
  ];
  // a bat b, b bat c, c bat a, chacun bat d : trois à 2 victoires, même différence.
  const CYCLE = [
    m(1, "a", 2, "b", 1), m(2, "b", 2, "c", 1), m(3, "c", 2, "a", 1),
    m(4, "a", 2, "d", 1), m(5, "b", 2, "d", 1), m(6, "c", 2, "d", 1),
  ];
  const TOUS = new Set(["a", "b", "c", "d"]);
  const NOMS = noms(["zeta", "alpha", "c", "d"]);

  it("à deux ex æquo, le vainqueur de leur rencontre passe devant — pas l'ordre alphabétique", () => {
    const lignes = rangsParVictoires(POULE, NOMS);
    assert.deepEqual(lignes.slice(0, 2).map((l) => [l.id, l.rang, l.exAequo]), [
      ["zeta", 1, 1],
      ["alpha", 2, 1],
    ]);
  });

  it("🔴 un trio qui se bat en cycle reste EX ÆQUO, et la génération du tableau est refusée", () => {
    const lignes = rangsParVictoires(CYCLE, noms([...TOUS]));
    assert.deepEqual(lignes.slice(0, 3).map((l) => [l.rang, l.exAequo]), [[1, 3], [1, 3], [1, 3]]);

    const refus = qualifiesDesPoules(new Map([[1, lignes]]), 2, TOUS);
    assert.deepEqual(refus, { ok: false, egalites: [{ poule: 1, places: 2, candidats: ["a", "b", "c"] }] });

    const tranche = qualifiesDesPoules(new Map([[1, lignes]]), 2, TOUS, new Set(["c", "a"]));
    assert.deepEqual(tranche, { ok: true, ids: ["a", "c"] }, "le choix humain lève l'égalité");
  });

  it("une égalité ENTIÈREMENT qualifiée ou éliminée ne bloque rien", () => {
    const lignes = new Map([[1, rangsParVictoires(CYCLE, noms([...TOUS]))]]);
    assert.equal(qualifiesDesPoules(lignes, 3, TOUS).ok, true, "les trois ex æquo entrent");
    assert.equal(qualifiesDesPoules(lignes, 1, new Set(["d"])).ok, true, "seul d est présent");
  });
});

describe("POULES SÉPARÉES — 2 poules de 4, puis les 2 premiers en tableau (GIR 2026)", () => {
  /** Comme l'application : l'issue vient de la PROPAGATION, qui dépouille les exemptions. */
  const commeEnBase = (phase: Phase) => {
    const { issues } = calculerPropagation(phase);
    return phase.map((r) => ({ ...r, issue: issues.get(r.matchId) ?? issueDeRencontre(r.places) }));
  };

  /** La meilleure tête de série (a < b < …) gagne toujours : aucune égalité dans une poule. */
  const jouerPoules = (phase: Phase) => {
    for (const r of phase) {
      const [g, d] = r.places;
      if (g.entryId !== null && d.entryId !== null) {
        g.score = g.entryId < d.entryId ? 2 : 0;
        d.score = g.entryId < d.entryId ? 0 : 2;
      }
    }
    return propager(phase);
  };

  it("chaque poule ne joue qu'entre ses membres, et en serpentin", () => {
    const phase = propager(phaseGeneree("poule", HUIT, { poules: 2 }));
    assert.equal(phase.length, 12, "deux poules de 4 = 2 × 6 rencontres, pas 28");
    const membres = (poule: number) =>
      new Set(phase.filter((r) => r.pool === poule).flatMap((r) => r.places.map((p) => p.entryId)));
    assert.deepEqual([...membres(1)].sort(), ["a", "d", "e", "h"]);
    assert.deepEqual([...membres(2)].sort(), ["b", "c", "f", "g"]);
  });

  it("🔴 une exemption n'est pas une victoire (poule impaire)", () => {
    const NEUF = [...HUIT, "i"];
    const phase = jouerPoules(propager(phaseGeneree("poule", NEUF, { poules: 2 })));
    const poules = rangsParPoule(commeEnBase(phase), noms(NEUF));
    const victoiresA = (poules.get(1) ?? []).reduce((n, l) => n + (l.profondeur ?? 0), 0);
    assert.equal(victoiresA, 10, "5 joueurs = 10 vraies rencontres, donc 10 victoires, pas 15");
  });

  it("les qualifiés se croisent : A1 contre B2, B1 contre A2", () => {
    const phase = jouerPoules(propager(phaseGeneree("poule", HUIT, { poules: 2 })));
    const poules = rangsParPoule(pourRang(phase), noms(HUIT));
    const resultat = qualifiesDesPoules(poules, 2, new Set(HUIT));
    assert.ok(resultat.ok);
    const qualifies = resultat.ids;
    const [a1, b1, a2, b2] = qualifies;
    assert.equal(qualifies.length, 4);
    assert.equal(poules.get(1)?.[0].id, a1);
    assert.equal(poules.get(2)?.[1].id, b2);

    const tableau = phaseGeneree("bracket", qualifies);
    const affiches = tableau
      .filter((r) => r.places.every((p) => p.entryId !== null))
      .map((r) => r.places.map((p) => p.entryId).sort().join("-"));
    assert.deepEqual(affiches.sort(), [[a1, b2].sort().join("-"), [a2, b1].sort().join("-")].sort());
  });

  it("un qualifié absent cède sa place au suivant de SA poule", () => {
    const phase = jouerPoules(propager(phaseGeneree("poule", HUIT, { poules: 2 })));
    const poules = rangsParPoule(pourRang(phase), noms(HUIT));
    const a1 = poules.get(1)?.[0].id ?? "";
    const a3 = poules.get(1)?.[2].id ?? "";
    const resultat = qualifiesDesPoules(poules, 2, new Set(HUIT.filter((id) => id !== a1)));
    assert.ok(resultat.ok);
    const qualifies = resultat.ids;
    assert.ok(!qualifies.includes(a1));
    assert.ok(qualifies.includes(a3), "le 3e de la poule A remplace le 1er absent");
  });
});

describe("podiumDepuis — un ex æquo ne monte sur le podium qu'à deux, au 3ᵉ rang", () => {
  it("une double élimination à 4 pré-remplit les trois places", () => {
    const phase = jouerTout(propager(phaseGeneree("bracket", QUATRE, { doubleElimination: true })));
    const nomParEngage = noms(QUATRE);
    const podium = podiumDepuis(rangsParParcours(pourRang(phase), nomParEngage), nomParEngage);

    assert.ok(podium.premier, "le 1ᵉʳ est désigné");
    assert.ok(podium.deuxieme, "le 2ᵉ est désigné");
    assert.ok(podium.troisieme, "le 3ᵉ est désigné");
    assert.equal(new Set([podium.premier, podium.deuxieme, podium.troisieme]).size, 3);
  });

  it("🔴 une élimination simple à 8 écrit les DEUX demi-finalistes, 3ᵉ ex æquo", () => {
    const phase = jouerTout(propager(phaseGeneree("bracket", HUIT)));
    const nomParEngage = noms(HUIT);
    const lignes = rangsParParcours(pourRang(phase), nomParEngage);
    const podium = podiumDepuis(lignes, nomParEngage);
    const [x, y] = lignes.filter((l) => l.rang === 3).map((l) => nomParEngage.get(l.id) ?? "");

    assert.ok(podium.premier);
    assert.ok(podium.deuxieme);
    assert.equal(podium.troisieme, troisiemesExAequo(x, y), "les deux noms, jamais un seul");
  });

  it("au-delà de deux ex æquo au 3ᵉ rang, la place reste VIDE", () => {
    const lignes = ["a", "b", "c", "d", "e"].map((id, i) => ({
      id, rang: i < 2 ? i + 1 : 3, profondeur: null, exAequo: i < 2 ? 1 : 3,
    }));
    assert.equal(podiumDepuis(lignes, noms(["a", "b", "c", "d", "e"])).troisieme, null);
  });

  it("une phase inachevée ne pré-remplit rien", () => {
    const phase = propager(phaseGeneree("bracket", HUIT));
    const nomParEngage = noms(HUIT);
    const podium = podiumDepuis(rangsParParcours(pourRang(phase), nomParEngage), nomParEngage);
    assert.equal(podium.premier, null, "8 joueurs sont encore à égalité au sommet");
  });
});
