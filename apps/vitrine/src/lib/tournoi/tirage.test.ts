import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ecartsDeTirage, tirageAJour } from "./tirage";

// La règle est muette par nature : quand elle se trompe, l'écran n'affiche PAS un avertissement
// qu'il aurait dû, ou en affiche un qui n'a pas lieu d'être. Rien ne casse. D'où ces tests.

const PLACE = (entryId: string | null, nom: string | null = null) => ({ entryId, nom });

describe("ce qui a changé depuis le tirage", () => {
  const tirage = [PLACE("a", "Kayn"), PLACE("b", "GorkiTFT"), PLACE("c", "Riri")];

  it("nomme celui qui est parti après le tirage", () => {
    const ecarts = ecartsDeTirage(tirage, [
      { id: "a", nom: "Kayn" },
      { id: "c", nom: "Riri" },
    ]);
    assert.deepEqual(ecarts.partis, [{ id: "b", nom: "GorkiTFT" }]);
    assert.deepEqual(ecarts.arrives, []);
    assert.equal(tirageAJour(ecarts), false);
  });

  it("nomme aussi celui qui est arrivé après — le cas symétrique, tout aussi muet", () => {
    const ecarts = ecartsDeTirage(tirage, [
      { id: "a", nom: "Kayn" },
      { id: "b", nom: "GorkiTFT" },
      { id: "c", nom: "Riri" },
      { id: "d", nom: "MamzelleK" },
    ]);
    assert.deepEqual(ecarts.partis, []);
    assert.deepEqual(ecarts.arrives, [{ id: "d", nom: "MamzelleK" }]);
  });

  it("se tait quand le tirage correspond", () => {
    const ecarts = ecartsDeTirage(tirage, [
      { id: "a", nom: "Kayn" },
      { id: "b", nom: "GorkiTFT" },
      { id: "c", nom: "Riri" },
    ]);
    assert.equal(tirageAJour(ecarts), true);
  });
});

describe("les deux gardes", () => {
  it("🔴 une phase NON GÉNÉRÉE ne signale rien", () => {
    // Sans cette garde, tous les présents seraient déclarés « arrivés après le tirage » —
    // une fausse alerte massive, servie au moment précis où l'on s'apprête à générer.
    const ecarts = ecartsDeTirage([], [{ id: "a", nom: "Kayn" }, { id: "b", nom: "Riri" }]);
    assert.deepEqual(ecarts, { partis: [], arrives: [] });
    assert.equal(tirageAJour(ecarts), true);
  });

  it("🔴 les places VIDES d'un bracket ne comptent pour personne", () => {
    // En élimination, les tours suivants attendent la propagation : `entryId` y est `null`.
    // Les compter ferait un écart imaginaire à chaque tirage de bracket.
    const ecarts = ecartsDeTirage(
      [PLACE("a", "Kayn"), PLACE(null), PLACE(null), PLACE("b", "Riri")],
      [{ id: "a", nom: "Kayn" }, { id: "b", nom: "Riri" }],
    );
    assert.equal(tirageAJour(ecarts), true);
  });

  it("⚠️ compare des IDENTIFIANTS, pas des noms — deux homonymes restent distincts", () => {
    // `display_name` est un texte libre : rien n'interdit deux « Kayn ». Comparer par nom
    // ferait disparaître un départ réel.
    const ecarts = ecartsDeTirage(
      [PLACE("a", "Kayn"), PLACE("b", "Kayn")],
      [{ id: "a", nom: "Kayn" }],
    );
    assert.deepEqual(ecarts.partis, [{ id: "b", nom: "Kayn" }]);
  });
});
