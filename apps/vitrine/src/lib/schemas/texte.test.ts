import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { texteNettoye, texteOptionnel, urlHttpOptionnelle } from "./texte";

// Dette R41 — Story 7.8. Un invisible COLLÉ à une valeur visible n'est pas « visiblement
// vide » : il traversait Zod et tous les CHECK, et se stockait tel quel. `btrim` de Postgres
// ne retire que les blancs ASCII, donc Zod est le seul des deux à pouvoir fermer ce cas.
describe("texteNettoye — le point d'entrée de tout texte saisi", () => {
  it("retire un invisible collé, sur le champ obligatoire", () => {
    assert.equal(texteNettoye.parse("Le Cheval Blanc\u200B"), "Le Cheval Blanc");
    assert.equal(texteNettoye.parse("\uFEFFTournoi TFT"), "Tournoi TFT");
  });

  it("laisse SURVIVRE un emoji à ZWJ", () => {
    assert.equal(texteNettoye.parse("Soirée 👨\u200D👩\u200D👧"), "Soirée 👨\u200D👩\u200D👧");
  });
});

describe("les deux fabriques optionnelles héritent de la règle", () => {
  const description = texteOptionnel(120, "La description");
  const lien = urlHttpOptionnelle(300, "L'adresse");

  it("nettoie une valeur renseignée", () => {
    assert.equal(description.parse("Jeudi LAN\u200B"), "Jeudi LAN");
    assert.equal(lien.parse("https://exemple.fr\u00AD"), "https://exemple.fr");
  });

  it("traite toujours une valeur visiblement vide comme absente", () => {
    assert.equal(description.parse("\u200B\u200B"), null);
    assert.equal(description.parse("   "), null);
  });

  it("refuse encore une URL qui ne commence pas par http(s)://", () => {
    // Le nettoyage ne doit pas ouvrir une brèche : une adresse partielle passerait en lien
    // INTERNE et enverrait le visiteur sur une route inexistante, sans que rien ne l'annonce.
    assert.equal(lien.safeParse("exemple.fr").success, false);
    assert.equal(lien.safeParse("https:/exemple.fr").success, false);
  });
});
