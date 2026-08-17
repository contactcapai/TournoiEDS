import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { structureDePhase } from "./generation";
import { calculerPropagation } from "./progression";

/**
 * La propagation, éprouvée sur la VRAIE structure rendue par `generation.ts` (Story 10.8).
 *
 * 🔴 CE FICHIER EXISTE POUR **UN** SCÉNARIO : la CORRECTION. Une propagation incrémentale passe
 * tous les tests du cas nominal — le vainqueur monte — et devient fausse à la première saisie
 * rectifiée, quand l'aval est déjà rempli avec l'ancien vainqueur. Or un tournoi d'association
 * passe son temps à corriger des saisies faites dans le bruit d'une salle.
 *
 * ⚠️ Il n'utilise AUCUNE structure fabriquée à la main : tout part de `structureDePhase`. Un
 * gabarit écrit ici pourrait diverger du générateur réel, et le test passerait quand même — ce
 * serait l'instrument qui mentirait, pas le produit (leçon n°1 de la rétro Epic 6).
 */

type Phase = ReturnType<typeof phaseGeneree>;

/** L'état « juste généré » d'une phase : places de départ pourvues, le reste en attente. */
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

/** Écrit les déplacements, exactement comme le fait la transaction de `propager()`. */
function appliquer(phase: Phase, deplacements: readonly { slotId: string; entryId: string | null }[]) {
  for (const deplacement of deplacements) {
    for (const rencontre of phase) {
      for (const place of rencontre.places) {
        if (place.slotId !== deplacement.slotId) continue;
        place.entryId = deplacement.entryId;
        place.score = null;
        place.rank = null;
      }
    }
  }
  return phase;
}

/** Un tour complet du cycle réel : on calcule, puis on écrit. */
const propagerEtEcrire = (phase: Phase) => appliquer(phase, calculerPropagation(phase).deplacements);

function poserScores(phase: Phase, position: number, scores: readonly (number | null)[]) {
  const rencontre = phase.find((r) => r.position === position);
  assert.ok(rencontre, `la rencontre ${position} doit exister`);
  rencontre.places.forEach((place, i) => {
    place.score = scores[i] ?? null;
  });
  return phase;
}

/** La place, où qu'elle soit, qui attend le vainqueur ou le perdant de cette rencontre. */
const placeQuiAttend = (phase: Phase, position: number, de: "vainqueur" | "perdant") =>
  phase.flatMap((r) => r.places).find((p) => p.source.de === de && p.source.rencontre === position);

const HUIT = ["a", "b", "c", "d", "e", "f", "g", "h"];
const CINQ = ["a", "b", "c", "d", "e"];

describe("propagation — les exemptions se résolvent à la génération, sans un clic", () => {
  it("un tableau de 8 pour 5 présents fait monter 3 joueurs d'office", () => {
    const phase = phaseGeneree("bracket", CINQ);
    const { deplacements } = calculerPropagation(phase);

    // 8 - 5 = 3 exemptions. Demander à un bénévole de valider trois rencontres qui n'ont pas eu
    // lieu serait lui faire confirmer une arithmétique.
    assert.equal(deplacements.filter((d) => d.entryId !== null).length, 3);

    propagerEtEcrire(phase);
    const pourvuesEnAval = phase
      .filter((r) => r.position > 4)
      .flatMap((r) => r.places.filter((p) => p.entryId !== null));
    assert.equal(pourvuesEnAval.length, 3);
  });

  it("🔴 la propagation est IDEMPOTENTE : la rejouer n'écrit rien", () => {
    // C'est ce qui autorise à la rejouer en entier à chaque écriture au lieu de tenir des
    // incréments. Si elle ne l'était pas, chaque saisie déplacerait des joueurs sans raison.
    const phase = propagerEtEcrire(phaseGeneree("bracket", CINQ));
    assert.deepEqual(calculerPropagation(phase).deplacements, []);
  });
});

describe("propagation — un résultat fait monter le vainqueur, et lui seul", () => {
  it("le vainqueur occupe la place qui l'attend, le perdant non", () => {
    const phase = propagerEtEcrire(phaseGeneree("bracket", HUIT));
    const premiere = phase[0];
    const [gauche, droite] = premiere.places.map((p) => p.entryId);

    propagerEtEcrire(poserScores(phase, premiere.position, [2, 1]));

    const place = placeQuiAttend(phase, premiere.position, "vainqueur");
    assert.ok(place, "une place doit attendre le vainqueur");
    assert.equal(place.entryId, gauche);
    assert.notEqual(place.entryId, droite);
  });

  it("une ÉGALITÉ ne fait monter personne", () => {
    const phase = propagerEtEcrire(phaseGeneree("bracket", HUIT));
    const premiere = phase[0];
    propagerEtEcrire(poserScores(phase, premiere.position, [2, 2]));
    assert.equal(placeQuiAttend(phase, premiere.position, "vainqueur")?.entryId, null);
  });
});

describe("propagation — 🔴 une CORRECTION en amont reprend tout l'aval", () => {
  it("changer le vainqueur remplace l'occupant aval ET efface son résultat", () => {
    const phase = propagerEtEcrire(phaseGeneree("bracket", HUIT));
    const premiere = phase[0];
    const [gauche, droite] = premiere.places.map((p) => p.entryId);

    // ① gauche gagne, il monte, et un résultat est DÉJÀ saisi au tour suivant.
    propagerEtEcrire(poserScores(phase, premiere.position, [2, 1]));
    const aval = placeQuiAttend(phase, premiere.position, "vainqueur");
    assert.ok(aval);
    assert.equal(aval.entryId, gauche);
    aval.score = 3;

    // ② On corrige : c'était droite qui avait gagné.
    propagerEtEcrire(poserScores(phase, premiere.position, [1, 2]));

    const apres = placeQuiAttend(phase, premiere.position, "vainqueur");
    assert.ok(apres);
    assert.equal(
      apres.entryId,
      droite,
      "🔴 l'aval suit la correction — sinon ce sont les mauvais qui jouent le tour suivant",
    );
    assert.equal(
      apres.score,
      null,
      "🔴 et son score est effacé : il appartenait à quelqu'un qui n'a jamais joué cette rencontre",
    );
  });

  it("annuler un résultat REMET la place aval en attente", () => {
    const phase = propagerEtEcrire(phaseGeneree("bracket", HUIT));
    const premiere = phase[0];

    propagerEtEcrire(poserScores(phase, premiere.position, [2, 1]));
    assert.notEqual(placeQuiAttend(phase, premiere.position, "vainqueur")?.entryId, null);

    propagerEtEcrire(poserScores(phase, premiere.position, [null, null]));
    assert.equal(
      placeQuiAttend(phase, premiere.position, "vainqueur")?.entryId,
      null,
      "la place redevient en attente, elle ne garde pas l'ancien vainqueur",
    );
  });

  it("🔴 la correction traverse DEUX tours, et INVALIDE ce qui en dépendait", () => {
    const phase = propagerEtEcrire(phaseGeneree("bracket", HUIT));
    const [r1, r2] = [phase[0], phase[1]];
    const gagnantR1 = r1.places[0].entryId;
    const autreR1 = r1.places[1].entryId;

    propagerEtEcrire(poserScores(phase, r1.position, [2, 1]));
    propagerEtEcrire(poserScores(phase, r2.position, [2, 1]));

    const demi = phase.find((r) => r.places.some((p) => p.source.rencontre === r1.position));
    assert.ok(demi);
    propagerEtEcrire(poserScores(phase, demi.position, [2, 1]));

    const finale = phase.find((r) => r.places.some((p) => p.source.rencontre === demi.position));
    assert.ok(finale, "une finale doit recevoir le vainqueur de la demie");
    assert.equal(
      finale.places.find((p) => p.source.rencontre === demi.position)?.entryId,
      gagnantR1,
      "il est allé jusqu'en finale",
    );

    // On corrige le TOUT PREMIER résultat du tableau.
    propagerEtEcrire(poserScores(phase, r1.position, [1, 2]));

    // ① La demi-finale change de participant…
    const placeDemi = placeQuiAttend(phase, r1.position, "vainqueur");
    assert.equal(placeDemi?.entryId, autreR1, "la demie suit la correction");

    // ② …donc le score de cette demie est effacé — il avait été saisi contre quelqu'un d'autre…
    assert.equal(placeDemi?.score, null, "le score de la demie ne survit pas au changement");

    /**
     * ③ …DONC LA FINALE REPASSE EN ATTENTE, et c'est le comportement JUSTE.
     *
     * ⚠️ CETTE ASSERTION A D'ABORD ÉTÉ ÉCRITE À L'ENVERS — elle attendait que la finale change
     * simplement d'occupant. C'était le TEST qui avait tort : la demi-finale doit être **rejouée**
     * (elle n'oppose plus les mêmes joueurs), donc rien ne peut désigner un finaliste avant. Faire
     * « suivre » la finale aurait propagé un vainqueur déduit d'une rencontre qui n'a pas eu lieu.
     */
    const placeFinale = phase
      .find((r) => r.position === finale.position)
      ?.places.find((p) => p.source.rencontre === demi.position);
    assert.equal(
      placeFinale?.entryId,
      null,
      "🔴 la finale attend que la demie soit rejouée — elle ne devine pas un finaliste",
    );
  });
});

describe("propagation — double élimination : le perdant DESCEND", () => {
  it("le perdant du tableau des vainqueurs occupe une place du tableau des perdants", () => {
    const phase = propagerEtEcrire(phaseGeneree("bracket", HUIT, { doubleElimination: true }));
    const premiere = phase[0];
    const [gauche, droite] = premiere.places.map((p) => p.entryId);

    propagerEtEcrire(poserScores(phase, premiere.position, [2, 1]));

    const place = placeQuiAttend(phase, premiere.position, "perdant");
    assert.ok(place, "une place doit attendre le perdant de cette rencontre");
    assert.equal(place.entryId, droite, "c'est le PERDANT qui descend");
    assert.notEqual(place.entryId, gauche);
  });

  it("🔴 une exemption ne fait descendre PERSONNE chez les perdants", () => {
    // 5 joueurs : le tableau de 8 produit 3 exemptions. Aucune ne doit envoyer de fantôme dans
    // le tableau des perdants — personne n'a perdu une rencontre qui n'a pas eu lieu.
    const phase = propagerEtEcrire(phaseGeneree("bracket", CINQ, { doubleElimination: true }));

    const exemptions = phase.filter(
      (r) => r.places.length === 2 && r.places.filter((p) => p.entryId !== null).length === 1,
    );
    assert.ok(exemptions.length > 0, "il doit y avoir des exemptions");

    for (const exemption of exemptions) {
      const place = placeQuiAttend(phase, exemption.position, "perdant");
      if (place) assert.equal(place.entryId, null, "aucun perdant ne descend d'une exemption");
    }
  });

  it("un même engagé n'occupe jamais deux places de la MÊME rencontre", () => {
    // La base l'interdit (`tournament_match_slot_engage_unique`) : si la propagation le
    // produisait, l'écriture échouerait en `23505` au milieu d'un tournoi.
    const phase = propagerEtEcrire(phaseGeneree("bracket", HUIT, { doubleElimination: true }));
    for (let tour = 0; tour < 4; tour += 1) {
      for (const rencontre of phase) {
        const occupees = rencontre.places.filter((p) => p.entryId !== null);
        if (occupees.length === 2 && rencontre.places.length === 2) {
          poserScores(phase, rencontre.position, [2, 1]);
        }
      }
      propagerEtEcrire(phase);

      for (const rencontre of phase) {
        const ids = rencontre.places.map((p) => p.entryId).filter((id) => id !== null);
        assert.equal(
          new Set(ids).size,
          ids.length,
          `rencontre ${rencontre.position} : le même engagé y figure deux fois`,
        );
      }
    }
  });
});

describe("propagation — un lobby ne propage rien", () => {
  it("toutes les places d'une phase de lobbies sont des têtes de série", () => {
    const joueurs = Array.from({ length: 17 }, (_, i) => `j${i + 1}`);
    const phase = phaseGeneree("lobbies", joueurs);
    assert.deepEqual(calculerPropagation(phase).deplacements, []);
  });
});
