/**
 * Ce que TOUT LE MONDE doit savoir d'un portrait de membre (Story 6.10).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE MODULE EST LE JUMEAU DE `lib/logos.ts`, MAIS IL EST PLUS SIMPLE — ET C'EST UN FAIT
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `partner.logo` porte **deux formes de valeur** (`/partenaires/…` versionné dans git, et
 * `/medias/logos/…` sur le volume), parce que la Story 4.1 avait semé quatre fichiers avant
 * que le back-office n'existe. **`member.portrait` n'en porte qu'UNE** : la table naît avec
 * son écran, aucun portrait n'a jamais été semé, et il n'y en aura jamais dans `public/`.
 *
 * ⇒ **Ne pas recopier ici la logique à deux formes de `logos.ts`.** `estPortraitDuVolume`
 * serait une tautologie : *toute* valeur non nulle de `member.portrait` est sur le volume,
 * garanti par le `CHECK member_portrait_valide` **et** par `estCheminPortraitValide` dans
 * `schemas/member.ts`. Une fonction qui répond toujours « oui » donnerait l'illusion d'un
 * choix là où il n'y en a pas, et ferait croire au prochain lecteur qu'un cas `public/`
 * existe.
 *
 * ⚠️ Module `lib/` et non `server/` : il est importé par `schemas/member.ts`, lui-même bundlé
 * côté client par le formulaire d'admin. Un `import "server-only"` ici casserait cet écran.
 * Ce fichier ne contient que des constantes et des fonctions pures — il n'a rien à protéger.
 */

/**
 * 🔴 LA BOÎTE CANONIQUE — LES **DEUX** DIMENSIONS SONT BORNÉES, ET C'EST LA LEÇON LA PLUS
 * CHÈRE DE LA STORY 6.5, REPRISE ICI TELLE QUELLE.
 *
 * Mesuré avec `sharp@0.34.5` sur les logos :
 *
 *     source 4000 × 96   →  resize({ height: 96, fit: "inside" })  →  4000 × 96  ⚠️ INCHANGÉ
 *
 * `resize({ height })` **NE BORNE PAS LA LARGEUR**. Une bannière traverse donc intacte une
 * contrainte qui ne porte que sur la hauteur : elle garde son poids, et le cadre la rendrait
 * en filet. ⚠️ Et **aucune porte de ce projet ne le verrait** : ce n'est ni un débordement
 * (`overflow-x: clip` rogne en silence), ni un défaut de contraste, ni un audit Lighthouse.
 *
 * **CARRÉ, 320 × 320.** Un portrait de carte n'est pas une photo pleine largeur : le cadre est
 * rendu en vignette (~160 px d'affichage), donc 320 couvre le 2× sans rien de plus. Carré et
 * non 4/3 parce que le cadre l'est : `fit: "inside"` conserve TOUJOURS le ratio d'origine, la
 * boîte n'est qu'un plafond — une photo 3/4 ressort 240 × 320, et c'est le CSS
 * (`object-fit: cover`) qui la recadre à l'affichage. **Jamais de déformation.**
 *
 * ⚠️ `withoutEnlargement: true` côté normaliseur : une source trop petite est **AVERTIE et
 * jamais agrandie** (doctrine R23, patron 6.5). Agrandir fabriquerait du flou en prétendant
 * corriger.
 */
export const PORTRAIT_COTE = 320;

/**
 * Préfixe des portraits. **Toutes** les valeurs de `member.portrait` le portent.
 *
 * ⚠️ Le slash final fait partie du préfixe : sans lui, un futur `/medias/portraitheque/x.webp`
 * passerait le test. Même raisonnement que le `base + path.sep` de `server/medias`, et que
 * `PREFIXE_LOGO`.
 *
 * ⚠️ **CE N'EST PAS UN DOSSIER.** Le volume est **PLAT** : `ouvrirMedia()` fait
 * `path.basename()` et refuse tout nom portant une composante de chemin. `/medias/portraits/`
 * est une distinction de **ROUTAGE** — elle dit quelle route sert le fichier, donc quelle
 * table est interrogée pour l'autoriser — pas un répertoire sur le disque.
 */
export const PREFIXE_PORTRAIT = "/medias/portraits/";

/**
 * Le même, servi par la route **gardée** du back-office.
 *
 * 🔴 IL NE S'UTILISE JAMAIS SEUL : il voyage avec `unoptimized`, via le booléen `sourceAdmin`
 * de `sourcePortrait()`. Le raisonnement complet est sur cette fonction — c'est la leçon ③ de
 * la Story 6.4, payée par un gate visuel où **aucune vignette ne s'affichait**.
 */
const PREFIXE_PORTRAIT_ADMIN = "/admin/medias/portraits/";

/** Extension unique des portraits. Voir `estCheminPortraitValide` dans `schemas/member.ts`. */
export const PORTRAIT_EXTENSION = "webp";

/**
 * Le nom de fichier NU d'un portrait, ou `null` si le membre n'en a pas.
 *
 * ⚠️ Contrairement à `nomFichierLogo`, il n'y a **aucun cas où une valeur non nulle rend
 * `null`** : toute valeur stockée est sur le volume (voir l'en-tête). Le `null` de sortie
 * signifie donc exactement « pas de portrait », et rien d'autre.
 */
export function nomFichierPortrait(portrait: string | null): string | null {
  if (portrait === null || !portrait.startsWith(PREFIXE_PORTRAIT)) return null;
  const nom = portrait.slice(PREFIXE_PORTRAIT.length);
  return nom.length > 0 ? nom : null;
}

/** La valeur à stocker en base pour un fichier fraîchement écrit sur le volume. */
export function cheminPortrait(nomFichier: string): string {
  return PREFIXE_PORTRAIT + nomFichier;
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
 * `images.localPatterns`. ⇒ tout rendu en `sourceAdmin` DOIT être `unoptimized`.
 */
export function sourcePortrait(portrait: string, sourceAdmin = false): string {
  if (!sourceAdmin || !portrait.startsWith(PREFIXE_PORTRAIT)) return portrait;
  return PREFIXE_PORTRAIT_ADMIN + portrait.slice(PREFIXE_PORTRAIT.length);
}
