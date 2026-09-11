import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CLES_CABLEES,
  RESEAUX_CABLES,
  ciblesEffectives,
  ciblesRetenues,
  libelleDuReseau,
  phraseIgnores,
  conseilTraceManquante,
  listerReseaux,
  precisionAnnonce,
  traceAnnonce,
} from "./reseaux";

const CABLES = ["Instagram", "Discord"];

test("🔴 DISCORD, FACEBOOK et INSTAGRAM sont raccordés — X ne l'est pas encore", () => {
  // 🔴 CE TEST A DÉJÀ FAIT SON TRAVAIL UNE FOIS. Il affirmait « AUCUN réseau n'est raccordé »
  // et son commentaire annonçait : « il tombera le jour où la 7.6 câble un compte, c'est
  // exactement là qu'il faut relire les phrases de l'écran ». Il est tombé le 2026-09-10
  // (Discord), puis le 2026-09-11 (Facebook et Instagram) — et les phrases ont été relues
  // les deux fois. Il reste armé pour X et LinkedIn.
  //
  // ⚠️ IL RESTE UN FIL-PIÈGE, et c'est sa raison d'être : `cable` est une copie à la main d'un
  // fait qui vit dans n8n. Le jour où quelqu'un met `cable: true` sans avoir VU un post
  // paraître, ce test tombe et pose la question — parce qu'un « raccordé » faux fait dire à
  // l'écran « Annoncé sur X » à propos de rien.
  assert.deepEqual([...RESEAUX_CABLES], ["Discord", "Facebook", "Instagram"]);
  assert.deepEqual([...CLES_CABLEES], ["discord", "facebook", "instagram"]);
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

// ══════════════════════════════════════════════════════════════════════════════════════
// LES DESTINATIONS D'UNE ANNONCE (2026-09-10) — l'écran ne peut pas les garantir
// ══════════════════════════════════════════════════════════════════════════════════════
//
// `ciblesRetenues` est testée parce qu'elle se trompe SANS RIEN CASSER : filtrer la demande
// au lieu des raccordés ferait écrire « Annoncé sur Instagram » à propos de rien, et rendre
// une liste vide en silence ferait partir un paquet qui ne publie nulle part. Aucune des deux
// ne lève, et aucune ne se voit sur l'écran de celui qui clique.

// ══════════════════════════════════════════════════════════════════════════════════════
// LES DESTINATIONS D'UNE ANNONCE (2026-09-10) — l'écran ne peut pas les garantir
// ══════════════════════════════════════════════════════════════════════════════════════
//
// `ciblesRetenues` est testée parce qu'elle se trompe SANS RIEN CASSER : filtrer la demande
// au lieu des raccordés ferait écrire « Annoncé sur Instagram » à propos de rien, et rendre
// une liste vide en silence ferait partir un paquet qui ne publie nulle part. Aucune des deux
// ne lève, et aucune ne se voit sur l'écran de celui qui clique.

test("les destinations ne gardent que les réseaux RACCORDÉS, jamais ce qui est demandé", () => {
  // X n'a aucun nœud dans n8n : le demander ne doit RIEN produire.
  // ⚠️ Cette assertion portait sur Instagram jusqu'au 2026-09-11 — elle a changé de réseau,
  // pas de sens : il en faut un NON raccordé pour que le test prouve quelque chose.
  assert.deepEqual(ciblesRetenues(["x"]), []);
  assert.deepEqual(ciblesRetenues(["discord", "x"]), ["discord"]);
});

test("une demande vide ou inconnue ne retombe PAS sur « tous les réseaux »", () => {
  // Le repli silencieux serait le pire des deux : on publierait sans l'avoir demandé.
  assert.deepEqual(ciblesRetenues([]), []);
  assert.deepEqual(ciblesRetenues(["reseau-qui-nexiste-pas"]), []);
});

test("l'ordre vient de la liste de référence, pas de l'ordre des clics", () => {
  // Deux annonces identiques doivent produire le MÊME paquet.
  assert.deepEqual(ciblesRetenues(["discord", "x"]), ciblesRetenues(["x", "discord"]));
});

test("les libellés affichés dérivent des mêmes lignes que les clés envoyées", () => {
  // Deux listes tenues à la main divergeraient au premier réseau ajouté : l'écran nommerait
  // un réseau que le paquet ne vise pas, ou l'inverse.
  assert.deepEqual(CLES_CABLEES.map(libelleDuReseau), [...RESEAUX_CABLES]);
});

// ══════════════════════════════════════════════════════════════════════════════════════
// INSTAGRAM EXIGE UNE IMAGE (arbitrage B, 2026-09-11) — et le saut doit se DIRE
// ══════════════════════════════════════════════════════════════════════════════════════

test("sans image, Instagram sort de la liste et les autres restent", () => {
  const r = ciblesEffectives(["discord", "facebook", "instagram"], false);
  assert.deepEqual(r.retenues, ["discord", "facebook"]);
  // 🔴 LE SAUT DOIT ÊTRE RENDU, PAS SEULEMENT SUBI : sans `ignorees`, l'écran ne pourrait pas
  // le dire, et un réseau coché ne recevrait rien en silence — le faux succès de la PR #118.
  assert.deepEqual(r.ignorees, ["instagram"]);
});

test("avec une image, rien n'est sauté", () => {
  const r = ciblesEffectives(["discord", "facebook", "instagram"], true);
  assert.deepEqual(r.retenues, ["discord", "facebook", "instagram"]);
  assert.deepEqual(r.ignorees, []);
});

test("Instagram SEUL et sans image ne laisse aucune cible — c'est un refus", () => {
  // L'appelant DOIT traiter ce cas : un paquet sans cible partirait, répondrait 200, et ne
  // publierait nulle part.
  const r = ciblesEffectives(["instagram"], false);
  assert.deepEqual(r.retenues, []);
  assert.deepEqual(r.ignorees, ["instagram"]);
});

test("la phrase du saut nomme le réseau, et se tait quand il n'y a rien à dire", () => {
  assert.equal(phraseIgnores([]), null);
  assert.match(phraseIgnores(["instagram"]) ?? "", /^Instagram exige une image/);
});
