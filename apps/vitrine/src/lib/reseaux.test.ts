import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RESEAUX_CABLES,
  conseilTraceManquante,
  listerReseaux,
  precisionAnnonce,
  traceAnnonce,
} from "./reseaux";

const CABLES = ["Instagram", "Discord"];

test("🔴 aujourd'hui AUCUN réseau n'est raccordé — le workflow n8n n'a pas de nœud social", () => {
  // Ce test tombera le jour où la Story 7.6 câble un compte : c'est exactement là qu'il faut
  // relire les phrases de l'écran, pas six mois plus tard.
  assert.deepEqual([...RESEAUX_CABLES], []);
});

test("l'énumération met « et » devant le dernier", () => {
  assert.equal(listerReseaux([]), "");
  assert.equal(listerReseaux(["Discord"]), "Discord");
  assert.equal(listerReseaux(CABLES), "Instagram et Discord");
  assert.equal(listerReseaux(["Instagram", "X", "Discord"]), "Instagram, X et Discord");
});

test("🔴 sans réseau raccordé, la confirmation DIT que rien ne paraîtra", () => {
  const precision = precisionAnnonce(null, []);
  assert.match(precision, /ne paraîtra nulle part/);
  assert.match(precision, /à la main/);
});

test("🔴 sans réseau raccordé, « déjà annoncé » ne menace PAS d'une seconde publication", () => {
  // Le piège : le rappel légitime quand les comptes sont câblés devient faux quand ils ne le
  // sont pas — il annoncerait un effet public qui n'existe pas.
  const precision = precisionAnnonce("8 septembre 2026 à 14h32", []);
  assert.doesNotMatch(precision, /SECONDE annonce/);
  assert.match(precision, /Déjà transmis le 8 septembre 2026 à 14h32/);
  assert.match(precision, /ni cet envoi ni le précédent/);
});

test("avec des réseaux raccordés, la confirmation les NOMME", () => {
  assert.equal(
    precisionAnnonce(null, CABLES),
    "L'annonce part vers Instagram et Discord. Elle ne peut pas être annulée depuis ici.",
  );
  assert.match(precisionAnnonce("le 8 septembre", CABLES), /SECONDE annonce sur Instagram et Discord/);
});

test("🔴 la trace ne dit « annoncé » que si un réseau est raccordé", () => {
  // C'est la phrase qui RESTE à l'écran. « Annoncé sur les réseaux le 8 septembre » pendant
  // qu'aucun compte n'est câblé est le faux témoin que cette passe corrige.
  const sansReseau = traceAnnonce("8 septembre à 14h32", []);
  assert.doesNotMatch(sansReseau, /Annoncé/);
  assert.match(sansReseau, /Transmis à l'outil de publication/);
  assert.match(sansReseau, /n'a paru nulle part/);

  assert.equal(
    traceAnnonce("8 septembre à 14h32", CABLES),
    "Annoncé sur Instagram et Discord le 8 septembre à 14h32",
  );
});

test("🔴 le rattrapage n'envoie PAS vérifier des réseaux qui ne reçoivent rien", () => {
  // Il s'affichait juste après « l'annonce n'a paru nulle part » : deux phrases qui se
  // contredisaient sur la même ligne.
  assert.doesNotMatch(conseilTraceManquante([]), /vérifi/);
  assert.match(conseilTraceManquante(CABLES), /vérifié Instagram et Discord/);
});
