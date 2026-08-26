import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { plateformeDuJeu, pseudoSuggere } from "./plateforme";

describe("la plateforme d'un jeu écrit en TEXTE LIBRE (Story 12.3)", () => {
  it("reconnaît les jeux Riot du dossier GIR", () => {
    assert.equal(plateformeDuJeu("TFT"), "riot");
    assert.equal(plateformeDuJeu("Teamfight Tactics"), "riot");
    assert.equal(plateformeDuJeu("Valorant"), "riot");
    assert.equal(plateformeDuJeu("League of Legends"), "riot");
    assert.equal(plateformeDuJeu("2XKO"), "riot");
  });

  it("reconnaît Steam et Epic", () => {
    assert.equal(plateformeDuJeu("CS2"), "steam");
    assert.equal(plateformeDuJeu("Counter-Strike 2"), "steam");
    assert.equal(plateformeDuJeu("Clone Hero"), "steam");
    assert.equal(plateformeDuJeu("Rocket League"), "epic");
  });

  it("ignore la casse, les accents et la ponctuation", () => {
    // Le champ est saisi à la main par un bénévole : « TFT — édition d'été » est une valeur
    // parfaitement plausible, et elle doit rendre la même chose que « TFT ».
    assert.equal(plateformeDuJeu("tft"), "riot");
    assert.equal(plateformeDuJeu("TFT — édition d'été"), "riot");
    assert.equal(plateformeDuJeu("Valorant : la revanche !"), "riot");
  });

  it("🔴 compare des MOTS, pas des sous-chaînes — « lol » n'est pas dans « Lollipop »", () => {
    // C'est la garde du module. Sans elle, le champ serait pré-rempli avec un Riot ID sur un
    // tournoi qui n'a rien à voir avec Riot — un pseudo faux est pire qu'un champ vide, parce
    // qu'il a l'air rempli.
    assert.equal(plateformeDuJeu("Lollipop Chainsaw"), null);
    assert.equal(plateformeDuJeu("Cuphead"), null);
  });

  it("rend `null` sur un jeu inconnu — c'est une RÉPONSE, pas un échec", () => {
    assert.equal(plateformeDuJeu("Just Dance"), null);
    assert.equal(plateformeDuJeu(""), null);
  });

  it("⚠️ un tournoi à DEUX jeux est départagé par l'ordre du catalogue, sans planter", () => {
    // Arbitraire et assumé : le champ pré-rempli reste modifiable.
    assert.equal(plateformeDuJeu("CS2 / Valorant"), "riot");
  });
});

describe("le pseudo pré-rempli — une suggestion, jamais une décision", () => {
  const profilComplet = {
    pseudo: "Clara",
    riotId: "ClaraByte#EUW",
    steamId: "clara_steam",
    epicId: "ClaraEpic",
  };

  it("propose l'identifiant de la PLATEFORME DU JEU — c'est lui qui sert à inviter en lobby", () => {
    assert.equal(pseudoSuggere("TFT", profilComplet), "ClaraByte#EUW");
    assert.equal(pseudoSuggere("CS2", profilComplet), "clara_steam");
    assert.equal(pseudoSuggere("Rocket League", profilComplet), "ClaraEpic");
  });

  it("retombe sur le pseudo de site quand le jeu est inconnu", () => {
    assert.equal(pseudoSuggere("Just Dance", profilComplet), "Clara");
  });

  it("🔴 retombe AUSSI sur le pseudo de site quand la plateforme est reconnue mais non déclarée", () => {
    // Le cas le plus fréquent au démarrage : quelqu'un remplit son pseudo de site et rien
    // d'autre. Sans ce repli, le champ serait vide sur un tournoi TFT — c'est-à-dire une page
    // blanche là où l'on a justement quelque chose à proposer.
    const sansRiot = { ...profilComplet, riotId: null };
    assert.equal(pseudoSuggere("TFT", sansRiot), "Clara");
  });

  it("rend `null` sans profil, ou sur un profil entièrement vide", () => {
    assert.equal(pseudoSuggere("TFT", null), null);
    assert.equal(
      pseudoSuggere("TFT", { pseudo: null, riotId: null, steamId: null, epicId: null }),
      null,
    );
  });
});
