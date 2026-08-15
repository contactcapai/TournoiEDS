import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { effectifConforme, phaseLibrementModifiable } from "./structure";

// Ces deux règles ne sont PAS exprimables par un CHECK — elles portent sur un NOMBRE DE
// LIGNES d'une autre table. Elles se tiennent à la frontière d'écriture, donc rien d'autre
// que ces tests ne les garde.
describe("effectifConforme — un engagé porte exactement l'effectif annoncé", () => {
  it("accepte l'effectif exact, individuel comme équipe", () => {
    assert.equal(effectifConforme(1, 1), true, "l'individuel est une équipe d'un membre");
    assert.equal(effectifConforme(2, 2), true);
    assert.equal(effectifConforme(5, 5), true);
  });

  it("refuse une équipe INCOMPLÈTE — elle n'entre pas, ce n'est pas un état à modéliser", () => {
    assert.equal(effectifConforme(1, 2), false);
    assert.equal(effectifConforme(0, 1), false);
  });

  it("refuse aussi le TROP-PLEIN, pas seulement le manque", () => {
    // Le sens intuitif serait « au moins teamSize » ; ce serait faux, et silencieux :
    // une équipe de 3 dans un tournoi en duo joue avec un joueur de plus que les autres.
    assert.equal(effectifConforme(3, 2), false);
  });

  it("refuse un compte non entier", () => {
    assert.equal(effectifConforme(1.5, 1.5), false);
  });
});

describe("phaseLibrementModifiable — le témoin est le RÉSULTAT, jamais l'état déclaré", () => {
  it("laisse réécrire tant qu'aucune rencontre n'a de résultat", () => {
    assert.equal(phaseLibrementModifiable([]), true, "une phase vide se réécrit");
    assert.equal(
      phaseLibrementModifiable([{ aUnResultat: false }, { aUnResultat: false }]),
      true,
      "le pointage doit pouvoir refaire la structure avant le coup d'envoi",
    );
  });

  it("fige dès la PREMIÈRE rencontre jouée, même si les autres sont vierges", () => {
    assert.equal(
      phaseLibrementModifiable([{ aUnResultat: false }, { aUnResultat: true }]),
      false,
    );
  });
});
