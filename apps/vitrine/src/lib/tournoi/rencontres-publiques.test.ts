import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  regrouperRencontresPubliques,
  type LigneDeRencontre,
} from "./rencontres-publiques";

const ligne = (o: Partial<LigneDeRencontre> = {}): LigneDeRencontre => ({
  phaseId: "p1",
  phasePosition: 1,
  phaseName: "Manche 1",
  phaseKind: "lobbies",
  phaseState: "en_cours",
  phasePlayedOn: "2026-09-06",
  matchId: "m1",
  matchPosition: 1,
  round: null,
  bracket: "principal",
  slotPosition: 1,
  nom: "Alice",
  etatEngage: "present",
  score: null,
  rank: null,
  ...o,
});

describe("qui on nomme sur une rencontre publique (Story 14.3)", () => {
  it("un PRÉSENT est nommé, même sur une table pas encore jouée", () => {
    // C'est tout l'objet de l'extension d'arbitrage : « qui joue contre qui » n'a de sens
    // qu'AVANT le résultat.
    const [phase] = regrouperRencontresPubliques([ligne()]);
    assert.equal(phase.groupes[0].rencontres[0].places[0].nom, "Alice");
    assert.equal(phase.groupes[0].rencontres[0].depouillee, false);
  });

  it("🔴 un DROP n'est PAS nommé tant que sa table n'a aucun résultat", () => {
    // Sa chaise lui reste jusqu'à la régénération (10.13). L'écrire sous « qui joue »
    // affirmerait qu'il joue — et c'est faux.
    const [phase] = regrouperRencontresPubliques([ligne({ etatEngage: "abandonne" })]);
    assert.equal(phase.groupes[0].rencontres[0].places[0].nom, null);
  });

  it("🔴 mais il EST nommé dès que la rencontre est dépouillée — il a joué", () => {
    const [phase] = regrouperRencontresPubliques([
      ligne({ slotPosition: 1, etatEngage: "abandonne", rank: 3 }),
      ligne({ slotPosition: 2, nom: "Bob", rank: 1 }),
    ]);
    assert.deepEqual(
      phase.groupes[0].rencontres[0].places.map((p) => p.nom),
      ["Alice", "Bob"],
    );
  });

  it("⚠️ « dépouillée » se décide sur TOUTE la rencontre, pas place par place", () => {
    // Le drop n'a pas de rang à lui : c'est le score de son adversaire qui rend la rencontre
    // jouée. Décider place par place l'aurait laissé anonyme sur une partie terminée.
    const [phase] = regrouperRencontresPubliques([
      ligne({ slotPosition: 1, etatEngage: "abandonne" }),
      ligne({ slotPosition: 2, nom: "Bob", score: 2 }),
    ]);
    assert.equal(phase.groupes[0].rencontres[0].depouillee, true);
    assert.equal(phase.groupes[0].rencontres[0].places[0].nom, "Alice");
  });

  it("un `inscrit` ou un `absent` n'est jamais nommé sur une table à venir", () => {
    for (const etat of ["inscrit", "absent"] as const) {
      const [phase] = regrouperRencontresPubliques([ligne({ etatEngage: etat })]);
      assert.equal(phase.groupes[0].rencontres[0].places[0].nom, null, etat);
    }
  });

  it("une place VIDE ne fabrique pas de nom", () => {
    const [phase] = regrouperRencontresPubliques([ligne({ nom: null, etatEngage: null })]);
    assert.equal(phase.groupes[0].rencontres[0].places[0].nom, null);
  });
});

describe("le regroupement — phases, tours, rencontres", () => {
  it("groupe par tableau PUIS par tour, sans mélanger deux phases", () => {
    const phases = regrouperRencontresPubliques([
      ligne({ phaseId: "p1", matchId: "a", round: 1 }),
      ligne({ phaseId: "p1", matchId: "b", round: 2 }),
      ligne({ phaseId: "p2", phasePosition: 2, phaseName: "Finale", matchId: "c", round: 1 }),
    ]);
    assert.equal(phases.length, 2);
    assert.deepEqual(phases[0].groupes.map((g) => g.round), [1, 2]);
    assert.equal(phases[1].groupes.length, 1);
  });

  it("deux tableaux du même tour restent deux groupes", () => {
    const [phase] = regrouperRencontresPubliques([
      ligne({ matchId: "a", round: 1, bracket: "vainqueurs" }),
      ligne({ matchId: "b", round: 1, bracket: "perdants" }),
    ]);
    assert.deepEqual(
      phase.groupes.map((g) => g.bracket),
      ["vainqueurs", "perdants"],
    );
  });

  it("`round` nul retombe sur 1 — une phase de tables n'a pas de tour", () => {
    const [phase] = regrouperRencontresPubliques([ligne({ round: null })]);
    assert.equal(phase.groupes[0].round, 1);
  });

  it("une rencontre SANS place ne casse pas le regroupement", () => {
    const [phase] = regrouperRencontresPubliques([ligne({ slotPosition: null, nom: null, etatEngage: null })]);
    assert.equal(phase.groupes[0].rencontres[0].places.length, 0);
  });
});
