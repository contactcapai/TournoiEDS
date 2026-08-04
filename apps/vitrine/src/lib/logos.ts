/**
 * Ce que TOUT LE MONDE doit savoir d'un logo de partenaire (Story 6.5).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CE MODULE EXISTE : `partner.logo` PORTE **DEUX FORMES DE VALEUR**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * | Forme                          | Où vit le fichier                       | Combien |
 * |--------------------------------|-----------------------------------------|---------|
 * | `/partenaires/<slug>.webp`     | `public/`, **versionné dans git**        | 4       |
 * | `/medias/logos/<uuid>.webp`    | volume Docker `MEDIA_DIR`, **sauvegardé**| n       |
 *
 * Les quatre premières ont été semées par la Story 4.1 et **ne sont pas migrées** : leurs
 * fichiers sont déjà à la hauteur canonique et déjà sauvegardés par le dépôt. Les migrer
 * aurait changé la donnée semée, donc le témoin de toutes les portes existantes, pour un
 * gain nul.
 *
 * 🔴 ET C'EST POURQUOI LA DISTINCTION EST ÉCRITE **ICI, UNE SEULE FOIS**. Trois appelants en
 * dépendent, et deux d'entre eux **détruisent** un fichier :
 *   ① les Server Actions — un `unlink()` déclenché sur `/partenaires/…` viserait un fichier
 *      hors du volume. `supprimerMedia` le refuse déjà par comparaison de préfixe, donc rien
 *      ne serait détruit — mais **on croirait l'avoir supprimé**, ce qui est pire qu'un échec
 *      bruyant ;
 *   ② les routes de service, qui ne cherchent en base que les valeurs du volume ;
 *   ③ le rendu, qui doit réécrire le préfixe pour l'aperçu du back-office.
 * Trois copies de `startsWith("/medias/logos/")` divergeraient en silence.
 *
 * ⚠️ Module `lib/` et non `server/` : `PartnerMarquee` est un composant **client**
 * (`"use client"`), il importe `sourceLogo`. Un `import "server-only"` ici casserait la home.
 * Ce fichier ne contient que des constantes et des fonctions pures — il n'a rien à protéger.
 */

/**
 * 🔴 LA BOÎTE CANONIQUE — LES **DEUX** DIMENSIONS SONT BORNÉES, ET LA SECONDE EST LA MOINS
 * ÉVIDENTE DES DEUX.
 *
 * **96 px de haut** : MESURÉ sur les quatre logos réels du projet, qui font tous exactement
 * cette hauteur (331 × 96, 213 × 96, 199 × 96, 141 × 96). Ce n'est donc pas une valeur
 * choisie, c'est la valeur constatée — et l'AC d'`epics.md` la nomme. La tuile en rend ~56
 * (76 px de haut moins 2 × 10 px d'`inset`), donc ~1,7× : de quoi tenir sur un écran dense.
 *
 * 🔴 **380 px de large**, et sans elle la normalisation ne normalise RIEN. Mesuré avec
 * `sharp@0.34.5` :
 *
 *     source 4000 × 96   →  resize({ height: 96, fit: "inside" })  →  4000 × 96  ⚠️ INCHANGÉ
 *
 * Une bannière traverse donc intacte une contrainte qui ne porte que sur la hauteur : elle
 * garde son poids, et la tuile — `object-fit: contain`, boîte utile 190 × 56 — la rendrait en
 * **filet de 4,5 px de haut**. ⚠️ Et **aucune porte de ce projet ne le verrait** : ce n'est ni
 * un débordement (`overflow-x: clip` rogne en silence), ni un défaut de contraste, ni un audit
 * Lighthouse. Seul un œil, une fois en production.
 *
 * 380 = 2 × la largeur utile maximale de la tuile (`max-width: 210px` − 2 × 10 px d'`inset`).
 * ⚠️ **Les quatre logos réels passent tous dessous** (331 au plus large) : leur re-normalisation
 * est donc un **no-op**, ce qui en fait un témoin gratuit — une normalisation qui les
 * modifierait aurait un défaut de bornes.
 */
export const LOGO_HAUTEUR = 96;
export const LOGO_LARGEUR_MAX = 380;

/**
 * Préfixe des logos **téléversés**, donc des seuls fichiers qui vivent sur le volume.
 *
 * ⚠️ Le slash final fait partie du préfixe : sans lui, un futur `/medias/logotheque/x.webp`
 * passerait le test. Même raisonnement que le `base + path.sep` de `server/medias`.
 */
export const PREFIXE_LOGO = "/medias/logos/";

/**
 * Le même, servi par la route **gardée** du back-office.
 *
 * 🔴 IL NE S'UTILISE JAMAIS SEUL : il voyage avec `unoptimized`, via le booléen `sourceAdmin`
 * de `sourceLogo()`. Le raisonnement complet est sur cette fonction — c'est la leçon ③ de la
 * Story 6.4, payée par un gate visuel où **aucune vignette ne s'affichait**.
 */
const PREFIXE_LOGO_ADMIN = "/admin/medias/logos/";

/** Extension unique des logos. Voir `logoSchema` dans `schemas/partner.ts`. */
export const LOGO_EXTENSION = "webp";

/**
 * Cette valeur désigne-t-elle un fichier **du volume**, donc supprimable par le back-office ?
 *
 * 🔴 C'EST LA QUESTION QUI PROTÈGE `public/`. Répondre « oui » à tort ferait tenter la
 * destruction d'un fichier versionné ; répondre « non » à tort laisserait un octet orphelin
 * sur le volume à chaque changement de logo.
 */
export function estLogoDuVolume(logo: string | null): logo is string {
  return logo !== null && logo.startsWith(PREFIXE_LOGO);
}

/**
 * Le nom de fichier NU d'un logo du volume, ou `null`.
 *
 * ⚠️ `null` pour une valeur `/partenaires/…` : ce n'est pas un échec, c'est la réponse juste —
 * ce fichier n'est pas sur le volume, donc `server/medias` n'a rien à en faire.
 */
export function nomFichierLogo(logo: string | null): string | null {
  return estLogoDuVolume(logo) ? logo.slice(PREFIXE_LOGO.length) : null;
}

/** La valeur à stocker en base pour un fichier fraîchement écrit sur le volume. */
export function cheminLogo(nomFichier: string): string {
  return PREFIXE_LOGO + nomFichier;
}

/**
 * D'où le RENDU tire l'image — et cette fonction porte **deux faits indissociables**.
 *
 * 🔴 UN SEUL BOOLÉEN, JAMAIS UN PRÉFIXE LIBRE : leçon ③ de la Story 6.4. Une prop
 * `prefixeMedia?: string` laissait poser le préfixe **sans** `unoptimized`, c'est-à-dire
 * refabriquer le défaut qu'elle existait pour corriger. Ici les deux sortent de `sourceAdmin`,
 * et l'appelant ne peut pas les dissocier.
 *
 * 🔴 CE QUE `sourceAdmin` EMPORTE VRAIMENT : l'optimiseur `/_next/image` fait sa requête
 * **depuis le serveur, sans cookie de session**. Il reçoit le `307 → /admin/login` de la garde,
 * pas une image, et rend `400 The requested resource isn't a valid image`. **Aucune ressource
 * protégée par une session ne peut passer par lui, par construction** — quelle que soit
 * `images.localPatterns`.
 *
 * ⚠️ **Une valeur `/partenaires/…` n'est PAS réécrite**, et c'est correct : ces fichiers sont
 * servis en statique depuis `public/`, sans garde, donc identiquement des deux côtés.
 */
export function sourceLogo(logo: string, sourceAdmin = false): string {
  if (!sourceAdmin || !estLogoDuVolume(logo)) return logo;
  return PREFIXE_LOGO_ADMIN + logo.slice(PREFIXE_LOGO.length);
}
