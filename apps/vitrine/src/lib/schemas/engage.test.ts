import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { engageSaisie, messageEffectif, NOM_MEMBRE_MAX } from "./engage";

/**
 * La saisie d'un engagé (Story 10.5).
 *
 * 🔴 CE QUI SE TESTE ICI EST CE QUI PEUT ÊTRE FAUX **EN SILENCE** : le compte des membres. Ni
 * l'œil ni le typecheck ne voient qu'une équipe de 3 est entrée à 2 — la ligne existe, l'écran
 * l'affiche, et le tableau se génère de travers des semaines plus tard.
 *
 * ⚠️ LE CARACTÈRE INVISIBLE S'ÉCRIT EN ÉCHAPPEMENT, JAMAIS EN LITTÉRAL — et la garde d'ESLint
 * ne suffit PAS à le tenir : `no-irregular-whitespace` a `skipStrings` à vrai par défaut, donc
 * il attrape un U+200B dans un COMMENTAIRE (mesuré au lint de cette story) et laisse passer
 * exactement celui qui compte, dans une chaîne de test. D'où la constante nommée ci-dessous :
 * elle rend visible dans le diff ce qui ne l'est pas dans l'éditeur.
 */

/** U+200B — espace de largeur nulle, celui que `.trim()` ne retire pas. */
const INVISIBLE = "\u200B";

/** Ce qu'un formulaire poste réellement : des chaînes, y compris pour les cases vides. */
const saisie = (displayName: string, membres: string[]) => ({ displayName, membres });

describe("engageSaisie — l'effectif est EXACT, dans les deux sens", () => {
  it("accepte une équipe à l'effectif exact", () => {
    const analyse = engageSaisie(3).safeParse(saisie("Les Sacres", ["Alice", "Bob", "Chloé"]));
    assert.equal(analyse.success, true);
    assert.deepEqual(analyse.data?.membres, ["Alice", "Bob", "Chloé"]);
  });

  it("refuse une équipe INCOMPLÈTE, et dit combien il en manque", () => {
    const analyse = engageSaisie(3).safeParse(saisie("Les Sacres", ["Alice", "Bob"]));
    assert.equal(analyse.success, false);

    const message = analyse.error?.issues[0]?.message ?? "";
    assert.match(message, /manque 1 joueur/, "le message doit dire COMBIEN il en manque");
    assert.doesNotMatch(message, /de trop/, "il ne doit pas parler de trop-plein");
  });

  it("refuse une équipe TROP NOMBREUSE, et dit combien il y en a de trop", () => {
    const analyse = engageSaisie(2).safeParse(saisie("Les Sacres", ["Alice", "Bob", "Chloé"]));
    assert.equal(analyse.success, false);

    const message = analyse.error?.issues[0]?.message ?? "";
    assert.match(message, /1 joueur de trop/, "le message doit dire COMBIEN il y en a de trop");
    assert.doesNotMatch(message, /manque/, "il ne doit pas parler de manque");
  });

  it("place l'erreur d'effectif sur le champ « membres »", () => {
    const analyse = engageSaisie(2).safeParse(saisie("Les Sacres", ["Alice"]));
    assert.equal(analyse.success, false);
    // `erreursParChamp` (server/actions/_commun.ts) ne lit que `path[0]` : sans lui, le
    // formulaire ne saurait pas où poser le focus.
    assert.equal(analyse.error?.issues[0]?.path[0], "membres");
  });
});

describe("engageSaisie — l'individuel est une équipe d'un membre", () => {
  it("accepte un seul nom quand teamSize vaut 1", () => {
    const analyse = engageSaisie(1).safeParse(saisie("Zerator", ["Zerator"]));
    assert.equal(analyse.success, true);
  });

  it("refuse un second nom, sans jamais employer le mot « équipe »", () => {
    const analyse = engageSaisie(1).safeParse(saisie("Zerator", ["Zerator", "Kameto"]));
    assert.equal(analyse.success, false);

    const message = analyse.error?.issues[0]?.message ?? "";
    // 🔴 C'est l'AC 2 : en individuel le formulaire ne parle JAMAIS d'équipe. Un bénévole de
    // TFT qui lirait « une équipe compte exactement 1 joueur » chercherait un champ absent.
    assert.doesNotMatch(message, /équipe/i);
  });

  it("refuse un engagé sans aucun membre", () => {
    const analyse = engageSaisie(1).safeParse(saisie("Zerator", []));
    assert.equal(analyse.success, false);
  });
});

describe("engageSaisie — les cases vides sont écartées AVANT qu'on ne compte", () => {
  it("traite une case blanche comme non remplie, et le dit par l'effectif", () => {
    const analyse = engageSaisie(3).safeParse(saisie("Les Sacres", ["Alice", "Bob", "   "]));
    assert.equal(analyse.success, false);
    // 🔴 Le message attendu est celui de l'EFFECTIF, pas « donnez un nom à ce joueur » : c'est
    // lui qui dit combien il en manque, et c'est lui qui appelle `effectifConforme()`.
    assert.match(analyse.error?.issues[0]?.message ?? "", /manque 1 joueur/);
  });

  it("traite une case faite d'un caractère INVISIBLE comme non remplie", () => {
    // U+200B survit à `.trim()` avec `length === 1` : sans `visiblementVide`, cette case
    // compterait comme un joueur et l'équipe entrerait à 3 avec un membre fantôme.
    const analyse = engageSaisie(3).safeParse(saisie("Les Sacres", ["Alice", "Bob", INVISIBLE]));
    assert.equal(analyse.success, false);
    assert.match(analyse.error?.issues[0]?.message ?? "", /manque 1 joueur/);
  });

  it("retire un invisible COLLÉ à un nom visible, et l'accepte", () => {
    const analyse = engageSaisie(1).safeParse(saisie("Zerator", [`Zerator${INVISIBLE}`]));
    assert.equal(analyse.success, true);
    assert.deepEqual(analyse.data?.membres, ["Zerator"], "la valeur stockée est nettoyée");
  });
});

describe("engageSaisie — le nom de l'engagé", () => {
  it("refuse un nom vide", () => {
    assert.equal(engageSaisie(1).safeParse(saisie("", ["Zerator"])).success, false);
  });

  it("refuse un nom fait uniquement de caractères invisibles", () => {
    assert.equal(engageSaisie(1).safeParse(saisie(INVISIBLE, ["Zerator"])).success, false);
  });

  it("refuse un nom de membre trop long", () => {
    const trop = "z".repeat(NOM_MEMBRE_MAX + 1);
    assert.equal(engageSaisie(1).safeParse(saisie("Zerator", [trop])).success, false);
  });
});

describe("messageEffectif — laquelle des deux erreurs, et combien", () => {
  it("accorde le pluriel", () => {
    assert.match(messageEffectif(1, 3), /manque 2 joueurs/);
    assert.match(messageEffectif(2, 3), /manque 1 joueur :/);
    assert.match(messageEffectif(5, 3), /2 joueurs de trop/);
    assert.match(messageEffectif(4, 3), /1 joueur de trop/);
  });

  it("nomme toujours l'effectif attendu ET l'effectif saisi", () => {
    const message = messageEffectif(2, 4);
    assert.match(message, /exactement 4 joueurs/);
    assert.match(message, /saisi 2/);
  });

  it("en individuel, demande simplement le nom du joueur quand rien n'est saisi", () => {
    assert.equal(messageEffectif(0, 1), "Indiquez le nom du joueur.");
  });
});
