/**
 * Utilitaires de texte partagés du rendu public.
 *
 * Extrait de `EventHub` par la Story 3.3 : la carte du prochain rendez-vous, la ligne
 * d'événement et la page `/agenda` en ont toutes besoin — trois consommateurs, donc une
 * seule définition (règle du projet : on extrait au 2ᵉ, pas « au cas où »).
 */

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CARACTÈRES SANS LARGEUR — **UNE SEULE DÉFINITION DANS TOUT LE PROJET** (Story 6.11)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 ÉCHAPPEMENTS EXPLICITES, JAMAIS LES CARACTÈRES EUX-MÊMES : ils sont INVISIBLES dans un
 * éditeur, donc une classe écrite en littéral serait impossible à relire ou à modifier sans
 * risque — et un `git diff` ne montrerait rien.
 * U+00AD trait d'union conditionnel · U+200B→U+200F espaces de largeur nulle et marques de
 * direction · U+2060→U+2064 jointures invisibles · U+FEFF BOM (déjà retiré par `.trim()`,
 * listé pour que la classe soit complète).
 *
 * 🔴 POURQUOI ELLE VIT **ICI** ET NON DANS `schemas/texte.ts`, OÙ ELLE EST NÉE. Ce module
 * n'a **aucun import** ; `schemas/texte.ts` importe zod. La règle est consommée des DEUX
 * côtés — par la validation à l'écriture (Zod) **et** par le filet du rendu (`cleanText`) —
 * donc elle doit vivre dans celui des deux qui ne coûte rien à l'autre. Dans l'autre sens,
 * zod entrerait dans le chemin de rendu de **13 composants serveur**. `schemas/texte.ts` la
 * RÉEXPORTE pour ses six consommateurs : une seule définition, deux portes d'entrée.
 */
const SANS_LARGEUR = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;

/** Vrai si la chaîne ne contient AUCUN caractère visible (après retrait des sans-largeur). */
export const visiblementVide = (value: string) =>
  value.replace(SANS_LARGEUR, "").length === 0;

/**
 * Un texte blanc n'est pas un texte.
 *
 * Le CHECK `event_has_venue` (Story 3.1) protège la BASE, pas le rendu : une ligne écrite
 * avant le durcissement Zod, ou par du SQL direct, peut porter un `venueName` d'espaces.
 * Côté affichage il doit se comporter comme absent — exactement comme le schéma Zod
 * ramène `''` à `null` côté écriture.
 *
 * 🔴 ET « BLANC » INCLUT LES CARACTÈRES SANS LARGEUR — CORRIGÉ À LA STORY 6.11, TROUVÉ EN
 * REVUE PAR **DEUX** AGENTS INDÉPENDAMMENT.
 *
 * Cette fonction ne faisait qu'un `.trim()`, qui ne couvre **que** `Zs` et les contrôles :
 * un texte fait uniquement de U+200B en ressortait **inchangé**, donc rendu comme un
 * fragment visuellement ET vocalement vide, au lieu de basculer sur le repli de l'appelant
 * (« (prénom manquant) », « (expéditeur manquant) »…).
 *
 * ⚠️ CE N'ÉTAIT PAS UNE DETTE MUETTE : `WorkshopCatalog.tsx` (Story 6.9, page publique
 * `/animations`) **affirmait en commentaire** que *« `cleanText` ramène `''`, `'   '` et les
 * chaînes de caractères invisibles à `null` »*. Un document d'autorité prescrivait un
 * invariant que le code n'avait pas — `00 référence/pieges/cadrage-perime.md`. La parade du
 * projet est de corriger **la source**, pas de repayer le garde-fou : c'est fait ici, et les
 * **13 consommateurs** se comportent désormais comme leurs propres commentaires le
 * promettent depuis la Story 6.3.
 *
 * ⚠️ La base, elle, laisse toujours passer ces valeurs (`btrim` ne retire pas U+200B, limite
 * déclarée dans `schema.ts`) : ce filet reste donc le dernier rempart du rendu, exactement
 * comme son en-tête le dit.
 */
export function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) return null;
  // On retire les invisibles AVANT de re-trimmer : sinon un MÉLANGE d'espaces et de
  // caractères sans largeur (« ␣U+200B␣U+200C␣ ») survit, visiblement vide à l'écran.
  return trimmed.replace(SANS_LARGEUR, "").trim().length === 0 ? null : trimmed;
}

/**
 * Tronque à `max` caractères, **sur une frontière de mot**, et suffixe d'une ellipse.
 *
 * 🔴 POURQUOI UNE BORNE DE LONGUEUR, ET PAS SEULEMENT UNE GARDE DE DÉBORDEMENT :
 * les vignettes du carrousel « déjà passé » (Story 3.3) doivent avoir **la même
 * hauteur**, sinon le bloc grandit et rapetisse à chaque changement de vignette. Or
 * une pile de boîtes prend la hauteur de la plus haute : sans borne, **un seul**
 * compte-rendu bavard imposerait sa hauteur aux quatre, et laisserait trois vignettes
 * aux trois quarts vides.
 *
 * ⚠️ CE N'EST PAS LA BONNE COUCHE, et c'est assumé pour l'instant : la vraie parade
 * est une longueur maximale **à la saisie**, dans le formulaire du back-office
 * (Story 6.3), pour que personne n'écrive un texte qui ne sera jamais lu en entier.
 * Ici on protège le rendu ; là-bas on protégera le contenu. Dette consignée.
 *
 * La coupure remonte au dernier espace **tant qu'elle ne mange pas plus de 40 % du
 * texte** : au-delà, c'est qu'il n'y a pas d'espace exploitable (un mot très long, une
 * URL collée) et on coupe net plutôt que de rendre presque rien.
 */
export function truncate(value: string | null | undefined, max: number): string | null {
  const clean = cleanText(value);
  if (!clean) return null;

  /**
   * 🔴 DÉCOUPE PAR POINTS DE CODE, PAS PAR UNITÉS UTF-16 — CORRIGÉ LE 2026-08-03.
   *
   * `slice()` compte en unités UTF-16 : couper au milieu d'une paire de substitution
   * produit un demi-caractère orphelin, rendu comme un glyphe cassé. Mesuré :
   *   `truncate("AAAAAAAAAA🎮BBB…", 11)` → `"AAAAAAAAAA\ud83c…"`
   *
   * ⚠️ Le défaut est ANTÉRIEUR à la Story 6.3 — mais c'est elle qui le rend atteignable :
   * elle est la première surface où un bénévole tape librement un titre et un compte-rendu,
   * emoji compris. Trouvé en revue (Edge Case Hunter), et retenu pour cette raison exacte.
   * ⚠️ Le repli sur la frontière de mot travaille ensuite sur la chaîne DÉJÀ recoupée : il
   * ne peut donc pas réintroduire une coupure au milieu d'un caractère.
   */
  const points = Array.from(clean);
  if (points.length <= max) return clean;

  const coupe = points.slice(0, max).join("");
  const dernierEspace = coupe.lastIndexOf(" ");
  const base = dernierEspace > max * 0.6 ? coupe.slice(0, dernierEspace) : coupe;
  // On retire la ponctuation de fin avant l'ellipse : « …, … » ou « ..… » sont des
  // artefacts de troncature, pas de la typographie.
  return `${base.replace(/[\s.,;:!?…]+$/u, "")}…`;
}
