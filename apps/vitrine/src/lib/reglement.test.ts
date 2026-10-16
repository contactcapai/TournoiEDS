import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blocsDuReglement, remplir, trousDu, valeursDuTournoi } from "./reglement";

// Un trou oublié s'afficherait tel quel au public (« {{places}} joueurs ») : c'est l'erreur
// muette de ce module, et la seule raison de ces tests.
describe("règlement — les trous", () => {
  it("liste chaque trou une fois, dans l'ordre, espaces tolérés", () => {
    assert.deepEqual(trousDu("{{a}} puis {{ b }} puis {{a}}"), ["a", "b"]);
  });

  it("ne remplit qu'avec une valeur non vide, et laisse le reste à demander", () => {
    const texte = remplir("{{jeu}} — {{places}} — {{inconnu}}", { jeu: "TFT", places: "  " });
    assert.equal(texte, "TFT — {{places}} — {{inconnu}}");
    assert.deepEqual(trousDu(texte), ["places", "inconnu"]);
  });

  it("un tournoi sans capacité ni adresse ne remplit ni places ni liens", () => {
    const v = valeursDuTournoi(
      { name: "TFT", game: "TFT", slug: "", startsAt: "2026-11-14T14:00", venueName: "En ligne", priceText: "", capacity: "", prizes: "" },
      "https://esportdessacres.fr",
    );
    assert.equal(v.places, "");
    assert.equal(v["adresse du règlement"], "");
    assert.ok(v.date.includes("14 novembre"), v.date);
  });

  it("dérive l'adresse du règlement de celle de la fiche", () => {
    const v = valeursDuTournoi(
      { name: "", game: "", slug: "tft-gir", startsAt: "", venueName: "", priceText: "", capacity: "32", prizes: "" },
      "https://esportdessacres.fr",
    );
    assert.equal(v["adresse du règlement"], "https://esportdessacres.fr/tournois/tft-gir/reglement");
    assert.equal(v.date, "");
  });
});

describe("règlement — les blocs", () => {
  it("articles, sous-articles, listes et paragraphes sur plusieurs lignes", () => {
    const blocs = blocsDuReglement("# Art. 1\nUn texte\nqui continue.\n\n## 1.1\n- a\n- b\nAprès.");
    assert.deepEqual(blocs, [
      { type: "titre", texte: "Art. 1" },
      { type: "paragraphe", texte: "Un texte qui continue." },
      { type: "sousTitre", texte: "1.1" },
      { type: "liste", items: ["a", "b"] },
      { type: "paragraphe", texte: "Après." },
    ]);
  });
});
