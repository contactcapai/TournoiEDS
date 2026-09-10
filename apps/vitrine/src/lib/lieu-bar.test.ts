import assert from "node:assert/strict";
import { test } from "node:test";

import { joindreParTiret, repereCourtDuBar, situationDuBar } from "./lieu-bar";

const BAR = { name: "Le Bar", district: "Boulingrin", city: "Reims" };

test("les deux renseignés se disent « Quartier, Ville »", () => {
  assert.equal(situationDuBar(BAR), "Boulingrin, Reims");
});

test("🔴 un morceau absent emporte SA ponctuation — jamais « Boulingrin, »", () => {
  assert.equal(situationDuBar({ ...BAR, city: null }), "Boulingrin");
  assert.equal(situationDuBar({ ...BAR, district: null }), "Reims");
});

test("aucun des deux ⇒ null, pour que la ligne DISPARAISSE au lieu de rester vide", () => {
  assert.equal(situationDuBar({ ...BAR, district: null, city: null }), null);
});

test("une chaîne blanche vaut une absence — la base tolère NULL, pas le vide", () => {
  // Une ligne écrite avant la règle, ou par du SQL direct, peut porter un espace.
  assert.equal(situationDuBar({ district: "   ", city: "Reims" }), "Reims");
  assert.equal(situationDuBar({ district: "\u200b", city: "  " }), null);
});

test("🔴 le tiret vit avec sa suite : sans situation, il ne reste QUE la tête", () => {
  assert.equal(joindreParTiret("Le Bar", situationDuBar(BAR)), "Le Bar — Boulingrin, Reims");
  assert.equal(joindreParTiret("Le Bar", null), "Le Bar");
});

test("le repère court préfère le quartier, se replie sur la ville, puis sur le nom", () => {
  assert.equal(repereCourtDuBar(BAR), "Boulingrin");
  assert.equal(repereCourtDuBar({ ...BAR, district: null }), "Reims");
  assert.equal(repereCourtDuBar({ ...BAR, district: null, city: null }), "Le Bar");
});
