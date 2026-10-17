import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A_SAVOIR, blocsDuReglement, remplir, TROUS_AUTOMATIQUES, trousDu, valeursDuTournoi } from "./reglement";

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

  const base = {
    name: "TFT", game: "Teamfight Tactics", slug: "tft-oct", startsAt: new Date("2026-10-17T12:00:00Z"),
    endsAt: null, venueName: "En ligne", priceText: null, capacity: null, prizes: null,
    teamSize: 1, matchDurationMinutes: null, formatText: "Poules puis finale.", phases: [],
  };

  it("la liste affichée au bénévole est exactement celle que le site remplit", () => {
    assert.deepEqual(Object.keys(valeursDuTournoi(base, "https://eds.fr")), [...TROUS_AUTOMATIQUES]);
  });

  it("une donnée absente ne remplit rien, et sans phase le déroulé vient du texte annoncé", () => {
    const v = valeursDuTournoi(base, "https://eds.fr");
    assert.equal(v.places, "");
    assert.equal(v.tarif, "");
    assert.equal(v["déroulé"], "Poules puis finale.");
    assert.equal(v["jour de la finale"], "");
    assert.equal(v["adresse du règlement"], "https://eds.fr/tournois/tft-oct/reglement");
  });

  it("le déroulé du TFT d'octobre donne ses jours, ses 4 manches et le seuil par défaut", () => {
    const phases = [
      { name: "Manche 1", kind: "lobbies" as const, playedOn: "2026-10-17", settings: {} },
      ...[2, 3, 4].map((n) => ({ name: `Manche ${n}`, kind: "suisse" as const, playedOn: "2026-10-17", settings: {} })),
      { name: "Finale", kind: "finale" as const, playedOn: "2026-10-18", settings: {} },
    ];
    const v = valeursDuTournoi({ ...base, phases }, "https://eds.fr");
    assert.equal(v["nombre de manches de qualification"], "4");
    assert.equal(v["seuil du matchpoint"], "20");
    assert.match(v["jour des qualifications"], /samedi 17 octobre/i);
    assert.match(v["jour de la finale"], /dimanche 18 octobre/i);
    assert.match(v["déroulé"], /^- .*17 octobre — Manche 1 \(lobbies\)$/im);
  });

  it("un déroulé en poules ne compte pas de « manches de qualification »", () => {
    const phases = [
      { name: "Poule A", kind: "poule" as const, playedOn: null, settings: {} },
      { name: "Finale", kind: "bracket" as const, playedOn: null, settings: {} },
    ];
    const v = valeursDuTournoi({ ...base, teamSize: 2, phases }, "https://eds.fr");
    assert.equal(v["nombre de manches de qualification"], "");
    assert.equal(v["format d'équipe"], "équipes de 2 joueurs (2v2)");
    assert.equal(valeursDuTournoi({ ...base, teamSize: 2, capacity: 8 }, "").places, "8 équipes de 2 joueurs");
    assert.equal(v["déroulé"], "- Poule A (poule)\n- Finale (tableau)");
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

describe("« à savoir » — chaque preuve vit dans le modèle « sur place »", () => {
  it("une phrase du modèle reformulée éteindrait la ligne en silence", () => {
    const modele = readFileSync(new URL("../../drizzle/0036_modele_reglement_sur_place.sql", import.meta.url), "utf8");
    for (const { preuve } of A_SAVOIR) assert.ok(modele.includes(preuve), preuve);
  });
});
