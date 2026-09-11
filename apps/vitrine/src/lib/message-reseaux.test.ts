import assert from "node:assert/strict";
import { test } from "node:test";

import { X_MAX, composerMessages, type EvenementAAnnoncer } from "./message-reseaux";

/** Un vrai jeudi de l'agenda, relevé sur esportdessacres.fr le 2026-09-08. */
const JEUDI: EvenementAAnnoncer = {
  titre: "Party Game - Guitar Hero",
  debut: new Date("2026-09-24T18:00:00+02:00"),
  lieu: "Le Dropkick Bar Reims",
  adresse: "Reims Courlancy, Reims",
  jeux: "Guitar Hero",
  lien: "https://esportdessacres.fr/agenda",
};

test("🔴 l'heure publiée est celle de PARIS, jamais l'UTC du payload", () => {
  // Le premier brouillon annonçait « 16h00 » pour une soirée à 18h00 : `getUTCHours()` sur un
  // instant porteur de `+02:00`. C'est le défaut que ce module existe pour empêcher.
  for (const message of Object.values(composerMessages(JEUDI))) {
    assert.match(message, /18h00/);
    assert.doesNotMatch(message, /16h00/);
  }
});

test("🔴 X tient dans 280 caractères, même sur un titre démesuré", () => {
  const long = { ...JEUDI, titre: "T".repeat(400) };
  assert.ok(composerMessages(long).x.length <= X_MAX, "le repli de dernier recours a cédé");
  // ⚠️ Et le lien survit à la coupe : une annonce tronquée SANS lien ne mène nulle part.
  assert.match(composerMessages(long).x, /https:\/\/esportdessacres\.fr\/agenda$/);
});

test("X abandonne l'adresse AVANT les jeux, et le titre en dernier", () => {
  const ev = { ...JEUDI, adresse: "A".repeat(200) };
  const x = composerMessages(ev).x;
  assert.ok(x.length <= X_MAX);
  assert.doesNotMatch(x, /AAAA/);
  assert.match(x, /Guitar Hero/);
  assert.match(x, /Le Dropkick Bar Reims/);
});

test("🔴 Instagram ne porte AUCUNE URL — elle n'y serait pas cliquable", () => {
  const { instagram } = composerMessages(JEUDI);
  assert.doesNotMatch(instagram, /https?:\/\//);
  assert.match(instagram, /en bio/);
});

test("le markdown de Discord ne fuit PAS sur Facebook ni Instagram", () => {
  const m = composerMessages(JEUDI);
  assert.match(m.discord, /^## Party Game/);
  for (const clair of [m.facebook, m.instagram, m.x]) {
    assert.doesNotMatch(clair, /\*\*|^## /m);
  }
});

test("un champ absent ne laisse pas de trou ni de séparateur orphelin", () => {
  const nu = { ...JEUDI, lieu: null, adresse: null, jeux: null };
  const m = composerMessages(nu);
  for (const message of Object.values(m)) {
    assert.doesNotMatch(message, /\n\n\n/, "ligne blanche en double");
    assert.doesNotMatch(message, /·\s*$|📍\s*$|🎮\s*$/m, "séparateur sans valeur");
  }
  assert.doesNotMatch(m.facebook, /📍/);
});

test("une adresse absente ne perd pas le lieu", () => {
  const m = composerMessages({ ...JEUDI, adresse: null });
  assert.match(m.facebook, /📍 Le Dropkick Bar Reims\n/);
});

test("🔴 la RESPIRATION existe : une ligne blanche sépare les faits de la suite", () => {
  // Le défaut réel : `lignes()` filtrait les chaînes vides avec les champs absents, donc les
  // quatre textes partaient en un seul bloc compact. Les tests d'à côté vérifiaient qu'il n'y
  // a pas de TROU — jamais qu'il y a bien un PARAGRAPHE.
  for (const [reseau, texte] of Object.entries(composerMessages(JEUDI))) {
    assert.match(texte, /\n\n/, `${reseau} est rendu en bloc compact`);
  }
});

test("🔴 LinkedIn garde le lien, Instagram ne l'a jamais — et c'est l'inverse l'un de l'autre", () => {
  // Les deux règles sont des faits de plateforme, pas des goûts : LinkedIn rend une URL
  // cliquable, Instagram non (d'où « en bio »). Les intervertir ne casserait rien et ne
  // rougirait nulle part — on publierait simplement une adresse que personne ne peut suivre,
  // et on priverait l'autre réseau de la sienne.
  const m = composerMessages(JEUDI);
  assert.match(m.linkedin, /https?:\/\//);
  assert.doesNotMatch(m.instagram, /https?:\/\//);
});

test("LinkedIn nomme l'association plutôt que de tutoyer un joueur", () => {
  // Son audience est professionnelle (partenaires, collectivités). La copie fixe des autres
  // réseaux — « Venez comme vous êtes, matériel ou pas » — y sonnerait faux.
  const m = composerMessages(JEUDI);
  assert.match(m.linkedin, /Esport des Sacres/);
  assert.doesNotMatch(m.linkedin, /Venez comme vous êtes/);
});
