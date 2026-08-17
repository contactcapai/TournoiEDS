import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { structureDePhase } from "./generation";
import { podiumDepuis, rangsParParcours, rangsParVictoires } from "./parcours";
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

describe("podiumDepuis — un ex æquo NE monte PAS sur le podium", () => {
  it("une double élimination à 4 pré-remplit les trois places", () => {
    const phase = jouerTout(propager(phaseGeneree("bracket", QUATRE, { doubleElimination: true })));
    const nomParEngage = noms(QUATRE);
    const podium = podiumDepuis(rangsParParcours(pourRang(phase), nomParEngage), nomParEngage);

    assert.ok(podium.premier, "le 1ᵉʳ est désigné");
    assert.ok(podium.deuxieme, "le 2ᵉ est désigné");
    assert.ok(podium.troisieme, "le 3ᵉ est désigné");
    assert.equal(new Set([podium.premier, podium.deuxieme, podium.troisieme]).size, 3);
  });

  it("🔴 une élimination simple à 8 laisse la 3ᵉ place VIDE — ils sont deux", () => {
    const phase = jouerTout(propager(phaseGeneree("bracket", HUIT)));
    const nomParEngage = noms(HUIT);
    const podium = podiumDepuis(rangsParParcours(pourRang(phase), nomParEngage), nomParEngage);

    assert.ok(podium.premier);
    assert.ok(podium.deuxieme);
    assert.equal(
      podium.troisieme,
      null,
      "🔴 deux demi-finalistes sont 3ᵉ : en écrire un seul serait une invention",
    );
  });

  it("une phase inachevée ne pré-remplit rien", () => {
    const phase = propager(phaseGeneree("bracket", HUIT));
    const nomParEngage = noms(HUIT);
    const podium = podiumDepuis(rangsParParcours(pourRang(phase), nomParEngage), nomParEngage);
    assert.equal(podium.premier, null, "8 joueurs sont encore à égalité au sommet");
  });
});
