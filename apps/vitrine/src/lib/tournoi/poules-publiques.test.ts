import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { poulesPubliques } from "./poules-publiques";
import type { RencontreDePoule } from "./parcours";

const match = (a: string, sa: number | null, b: string, sb: number | null): RencontreDePoule => ({
  position: 1,
  pool: 1,
  places: [
    { entryId: a, score: sa, source: null },
    { entryId: b, score: sb, source: null },
  ],
  issue: {
    complete: sa !== null && sb !== null,
    vainqueur: sa !== null && sb !== null ? (sa > sb ? a : b) : null,
    perdant: sa !== null && sb !== null ? (sa > sb ? b : a) : null,
    exemption: false,
  },
});

const engages = new Map([
  ["a", { nom: "Alpha", etat: "present" as const }],
  ["b", { nom: "Bravo", etat: "present" as const }],
  ["c", { nom: "Charlie", etat: "abandonne" as const }],
]);

describe("le classement public d'une poule", () => {
  it("🔴 « qualifié » attend la fin de la poule, même si le tableau désigne déjà l'engagé", () => {
    const enCours = poulesPubliques([match("a", 3, "b", 1), match("a", null, "c", null)], engages, new Set(["a"]));
    assert.equal(enCours[0].lignes[0].qualifie, false);
    // Un drop sans aucun résultat n'est pas nommé.
    assert.equal(enCours[0].lignes.find((l) => l.id === "c")?.nom, null);

    const finie = poulesPubliques([match("a", 3, "b", 1)], engages, new Set(["a"]));
    assert.deepEqual(
      finie[0].lignes.map((l) => [l.nom, l.victoires, l.difference, l.qualifie]),
      [["Alpha", 1, 2, true], ["Bravo", 0, -2, false]],
    );
  });
});
