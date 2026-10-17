import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { phrasesDuDeroule } from "./deroule-public";

describe("une phrase par phase", () => {
  it("les qualifiés ne se disent qu'une fois le tableau tiré depuis les poules", () => {
    const avant = phrasesDuDeroule([
      { kind: "poule", settings: { poules: 2 } },
      { kind: "bracket", settings: {} },
    ]);
    assert.ok(!avant[0]?.includes("premiers"));
    const apres = phrasesDuDeroule([
      { kind: "poule", settings: { poules: 2 } },
      { kind: "bracket", settings: { depuis: "poules", qualifiesParPoule: 2, doubleElimination: false } },
    ]);
    assert.match(apres[0] ?? "", /^2 poules .* les 2 premiers de chaque poule passent au tableau/);
    assert.equal(apres[1], "Tableau à élimination directe : le perdant sort.");
  });

  it("une phrase répétée ne se répète pas, et la finale porte le seuil réglé", () => {
    const phrases = phrasesDuDeroule([
      { kind: "suisse", settings: {} },
      { kind: "suisse", settings: {} },
      { kind: "finale", settings: { seuilDeVictoire: 16 } },
    ]);
    assert.equal(phrases[1], null);
    assert.match(phrases[2] ?? "", /atteindre 16 points, puis faire un top 1/);
  });
});
