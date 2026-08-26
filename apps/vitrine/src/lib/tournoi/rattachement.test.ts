import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { clesDeRecherche, formeComparable, inscriptionsSuggerees } from "./rattachement";

describe("forme comparable d'un pseudo (Story 12.1)", () => {
  it("🔴 retire le TAG Riot — sans ça, un tournoi TFT ne rapprocherait jamais rien", () => {
    // Le bénévole saisit ce qu'il voit EN JEU : « ClaraByte ». Le joueur déclare son Riot ID
    // complet : « ClaraByte#EUW ». Comparer les chaînes entières ne rapprocherait rien.
    assert.equal(formeComparable("ClaraByte#EUW"), "clarabyte");
    assert.equal(formeComparable("ClaraByte"), "clarabyte");
  });

  it("ignore la casse et les bords", () => {
    assert.equal(formeComparable("  VexMarne  "), "vexmarne");
  });

  it("⚠️ CONSERVE les accents : « Rémi » et « Remi » peuvent être deux personnes", () => {
    assert.notEqual(formeComparable("Rémi"), formeComparable("Remi"));
  });
});

describe("clés de recherche — ce qui ne doit JAMAIS servir de clé", () => {
  it("🔴 écarte les vides : un profil neuf ne doit rapprocher personne", () => {
    // Sans ce filtre, la clé `""` rapprocherait tout engagé dont le nom se réduit à un blanc,
    // et un compte tout juste créé se verrait proposer des inscriptions au hasard.
    assert.deepEqual(clesDeRecherche([null, "", "   ", "#EUW"]), []);
  });

  it("dédoublonne : même pseudo de site et pseudo Riot ⇒ une seule clé", () => {
    assert.deepEqual(clesDeRecherche(["ClaraByte", "clarabyte#EUW", null]), ["clarabyte"]);
  });
});

describe("suggestions — on propose, on ne rattache pas", () => {
  const plateau = [
    { id: "1", displayName: "ClaraByte" },
    { id: "2", displayName: "VexMarne" },
    { id: "3", displayName: "Clara" },
  ];

  it("rapproche sur l'égalité de la forme comparable", () => {
    const trouvees = inscriptionsSuggerees(plateau, clesDeRecherche(["clarabyte#EUW"]));
    assert.deepEqual(trouvees.map((i) => i.id), ["1"]);
  });

  it("🔴 ÉGALITÉ et jamais « contient » — sinon un pseudo court ratisse le plateau", () => {
    // « Clara » ne doit PAS proposer « ClaraByte » : une suggestion manquante se répare en
    // parlant à un bénévole, une suggestion fausse donne l'historique de quelqu'un d'autre.
    const trouvees = inscriptionsSuggerees(plateau, clesDeRecherche(["Clara"]));
    assert.deepEqual(trouvees.map((i) => i.id), ["3"]);
  });

  it("aucune clé ⇒ aucune suggestion, jamais tout le plateau", () => {
    assert.deepEqual(inscriptionsSuggerees(plateau, []), []);
  });
});
