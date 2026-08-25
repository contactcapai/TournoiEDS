import assert from "node:assert/strict";
import { test } from "node:test";

import { delaiLisible } from "./delai";

const MINUTE = 60_000;

test("une durée courte se dit en minutes", () => {
  assert.equal(delaiLisible(15 * MINUTE), "15 minutes");
  assert.equal(delaiLisible(89 * MINUTE), "89 minutes");
});

test("le singulier s'accorde — « 1 heure », jamais « 1 heures »", () => {
  assert.equal(delaiLisible(110 * MINUTE), "1 heure");
  assert.equal(delaiLisible(MINUTE), "1 minute");
});

test("🔴 24 heures ne se disent PAS en minutes — le défaut du 2026-08-25", () => {
  // Le courriel réel annonçait « 1440 minutes ». C'est le cas qui a motivé ce module.
  assert.equal(delaiLisible(24 * 60 * MINUTE), "24 heures");
});

test("les heures sont TRONQUÉES, jamais arrondies vers le haut", () => {
  // 🔴 Annoncer « 2 heures » quand il en reste 1 h 50 ferait revenir trop tard, sur un lien
  // déjà mort. On se trompe donc toujours du côté sûr.
  assert.equal(delaiLisible(110 * MINUTE), "1 heure");
});

test("une durée nulle ou négative ne rend jamais « 0 minutes »", () => {
  // Un lien déjà expiré au moment de l'envoi ne devrait pas exister ; si ça arrivait, le
  // message doit rester une phrase, pas un « expire dans 0 minutes » absurde.
  assert.equal(delaiLisible(0), "1 minute");
  assert.equal(delaiLisible(-5 * MINUTE), "1 minute");
});
