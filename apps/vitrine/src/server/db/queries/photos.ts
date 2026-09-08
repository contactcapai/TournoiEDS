// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts`, `queries/events.ts` et
// `queries/partners.ts` (Garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne
// doit jamais être atteint depuis un composant client. ⚠️ `Lightbox` EST un composant
// client — elle reçoit ses photos en props depuis la page, elle n'importe rien d'ici.
import "server-only";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";

import { jourParis } from "@/lib/date-paris";
import { cleanText } from "@/lib/text";
import { db } from "../client";
import { photo, siteSetting } from "../schema";

/**
 * Lectures de la galerie (Story 4.3).
 *
 * Emplacement conforme à `architecture.md` (l.515) : une famille de requêtes par domaine
 * sous `server/db/queries/`. Les composants ne requêtent JAMAIS eux-mêmes — la page
 * appelle puis distribue en props (patron AC1 de la 3.2).
 */

/**
 * Les photos publiées de la galerie « la vie de l'asso », dans l'ordre d'affichage.
 *
 * 🔴 NE JOINT PAS `event`, ET C'EST UNE DÉCISION, PAS UN OUBLI. `photo.eventId` est
 * nullable **par conception** : une photo sans occasion précise est un cas nominal, et la
 * home montre « la vie de l'asso », pas un agenda. Joindre remonterait une colonne que
 * le rendu ne consomme pas et ferait croire au type dérivé qu'elle est disponible.
 * C'est `/agenda` qui joint, dans l'AUTRE sens (`getPhotosForEvents` ci-dessous).
 *
 * 🔴 L'ORDRE EST TOTAL, ET C'EST LA MÊME LEÇON QUE `partners.ts` : `sort_order` puis
 * `id`. Sans le second terme, deux photos de même `sort_order` — le cas nominal dès que
 * le back-office (6.4) laissera le défaut `0` — sortiraient dans un ordre que Postgres ne
 * garantit pas. La home étant `force-dynamic`, la galerie se réordonnerait d'une visite à
 * l'autre, et l'inclinaison en alternance (`nth-child`) changerait avec elle : un
 * scintillement qu'on ne saurait pas reproduire.
 *
 * `is_published` puis `sort_order` : c'est l'ordre de l'index `photo_published_order_idx`.
 *
 * `columns` explicites : le rendu consomme `filename` (l'URL de service), `alt` et
 * `caption`. `eventId`, `sortOrder`, `isPublished`, `createdAt` et `updatedAt` sont
 * délibérément ABSENTS — les remonter ferait croire au type dérivé qu'ils sont là.
 */
export async function getPublishedPhotos(limit?: number) {
  return db.query.photo.findMany({
    // ⚠️ `focalX`/`focalY` AJOUTÉS PAR LE CORRECTIF DU 2026-09-01 : les vignettes du
    // scrapbook recadrent en 4/3 (`PhotoFrame`, `object-fit: cover`), donc elles COUPENT.
    // Elles ignoraient le point focal alors que c'est sur CET écran qu'on le pose — une
    // incohérence que seul l'œil pouvait voir : le hero cadrait juste, la galerie non.
    columns: { id: true, filename: true, alt: true, caption: true, focalX: true, focalY: true },
    // 🔴 DEUX CONDITIONS DEPUIS LA 15.1, ET LA SECONDE EST UNE CORRECTION, PAS UN FILTRE DE
    // CONFORT. `is_published` répond à « peut-on la servir ? » ; `dans_la_galerie` répond à
    // « a-t-elle sa place dans le scrapbook ? ». Tant que cette table ne portait que des
    // souvenirs, la première suffisait. Depuis qu'on y importe des visuels d'événement et des
    // images de post, une affiche publiée — elle DOIT l'être pour s'afficher sur sa carte —
    // entrerait ici et **pousserait une photo de soirée hors des huit**, sans erreur, sans
    // test rouge, et sans que personne ne fasse le lien entre les deux écrans.
    // ⚠️ Le raisonnement complet vit sur la colonne (`schema.ts`), pas ici : c'est là qu'on le
    // cherchera le jour où quelqu'un voudra « simplifier » cette clause.
    where: (table, { and, eq }) =>
      and(eq(table.isPublished, true), eq(table.dansLaGalerie, true)),
    orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.id)],
    ...(limit === undefined ? {} : { limit }),
  });
}

/**
 * Une photo de la galerie, DÉRIVÉE de la requête et non réécrite à la main : ajouter une
 * colonne à `columns` met ce type à jour tout seul (patron `PartnerTile`, `AgendaEvent`).
 */
export type GalleryPhoto = Awaited<ReturnType<typeof getPublishedPhotos>>[number];

/**
 * La PREMIÈRE photo publiée de chacun des événements demandés (dette **R25**).
 *
 * 🔴 UNE SEULE REQUÊTE POUR N ÉVÉNEMENTS, PAS UNE PAR VIGNETTE. `/agenda` rend jusqu'à 4
 * événements passés : une lecture par événement serait un N+1 sur une page
 * `force-dynamic`, donc payé à CHAQUE visite. `inArray` + regroupement en mémoire coûte
 * une aller-retour, quel que soit le nombre de vignettes.
 *
 * ⚠️ Le regroupement est fait en JS mais **l'ORDRE vient de SQL** : la requête trie par
 * `sortOrder` puis `id`, donc la première ligne rencontrée pour un `eventId` donné est
 * bien « la première photo de cet événement ». Trier côté rendu diviserait la définition
 * de l'ordre en deux endroits (choix déjà arbitré en 4.1, n°5).
 *
 * `event_id` puis `sort_order` : c'est l'ordre de l'index `photo_event_order_idx`.
 *
 * @returns une `Map` de `eventId` → photo. Un événement **sans photo publiée n'a pas
 *   d'entrée** : l'appelant retombe alors sur le placeholder de `PhotoFrame`. ⚠️ C'est le
 *   cas MAJORITAIRE aujourd'hui, donc l'état que le gate visuel verra le plus souvent.
 */
export async function getPhotosForEvents(eventIds: string[]) {
  // Garde de forme, pas d'optimisation : `inArray(col, [])` génère `IN ()`, invalide en
  // SQL. Le cas se produit dès que la base n'a aucun événement passé publié — un état
  // légitime que la Story 3.3 rend déjà (« pas encore de retour à montrer »).
  if (eventIds.length === 0) return new Map<string, GalleryPhoto>();

  const lignes = await db.query.photo.findMany({
    // Même correctif que `getPublishedPhotos` : la vignette d'un événement passé recadre
    // elle aussi en 4/3.
    columns: {
      id: true,
      filename: true,
      alt: true,
      caption: true,
      eventId: true,
      focalX: true,
      focalY: true,
    },
    where: (table, { and, eq }) =>
      and(eq(table.isPublished, true), inArray(table.eventId, eventIds)),
    orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.id)],
  });

  const parEvenement = new Map<string, GalleryPhoto>();
  for (const { eventId, ...photo } of lignes) {
    // `eventId` est typé `string | null` — Drizzle ne sait pas que le `WHERE` l'a exclu.
    // On traite la branche plutôt que d'affirmer avec un `!` non vérifié.
    if (eventId === null) continue;
    if (!parEvenement.has(eventId)) parEvenement.set(eventId, photo);
  }
  return parEvenement;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// LECTURES D'ADMINISTRATION (Story 6.4) — BROUILLONS INCLUS
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CES TROIS LECTURES REMONTENT DES LIGNES NON PUBLIÉES. Elles ne doivent être appelées
// que depuis une surface gardée (`lireCompte()` en première instruction de la page,
// `exigerRoleAction("admin_site")` en première ligne de l'action). Le nommage `...ForAdmin` reprend celui
// de `queries/events.ts`, posé par la 6.3, pour que la relecture d'un appel le rappelle.

/**
 * Toutes les photos, publiées ET brouillons, dans l'ordre d'affichage.
 *
 * ⚠️ MÊME ORDRE TOTAL QUE LA HOME (`sort_order` puis `id`) — et ce n'est pas une
 * coquetterie : l'écran d'administration EXISTE pour décider de cet ordre. S'il en montrait
 * un autre, réordonner serait un geste à l'aveugle.
 *
 * `columns` explicites, comme partout : le rendu d'admin consomme davantage de colonnes que
 * le rendu public (l'état de publication et l'ordre sont précisément ce qu'on vient régler).
 *
 * @param limit borne EXPLICITE — jamais de lecture non bornée : une page dont le temps de
 *   rendu dépend du volume téléversé est un défaut qui n'apparaîtrait qu'en production.
 */
export async function getPhotosForAdmin(limit: number) {
  return db.query.photo.findMany({
    columns: {
      id: true,
      filename: true,
      alt: true,
      caption: true,
      eventId: true,
      sortOrder: true,
      isPublished: true,
      // ⚠️ Le point focal remonte AUSSI ici, et c'est l'aperçu du bénévole qui l'exige : il
      // montre ce qu'un VISITEUR voit. Sans lui, il rendrait un cadrage que le site
      // n'applique pas — un aperçu qui ment sur le cadrage est pire qu'une absence
      // d'aperçu, puisqu'on le regarde précisément pour juger du rendu.
      focalX: true,
      focalY: true,
      // 🔴 L'ÉCRAN SE COUPE EN DEUX SUR CETTE COLONNE (15.1) : la galerie de l'accueil d'un
      // côté, les visuels de l'autre. Sans elle, les deux sections seraient rendues depuis
      // une liste qui ne sait pas les distinguer — donc une seule liste, celle d'avant.
      dansLaGalerie: true,
    },
    with: {
      // Le titre de l'événement rattaché : l'écran doit dire À QUOI la photo est rattachée,
      // pas afficher un UUID. Une seule requête — la relation est déjà déclarée (`schema.ts`).
      event: { columns: { id: true, title: true, startsAt: true } },
    },
    orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.id)],
    limit,
  });
}

/** Une photo telle que la voit le back-office. DÉRIVÉE de la requête, jamais réécrite. */
export type AdminPhoto = Awaited<ReturnType<typeof getPhotosForAdmin>>[number];

/** Une photo par son identifiant, brouillon compris (écran d'édition). */
export async function getPhotoByIdForAdmin(id: string) {
  return db.query.photo.findFirst({
    columns: {
      id: true,
      filename: true,
      alt: true,
      caption: true,
      eventId: true,
      sortOrder: true,
      isPublished: true,
      // ⚠️ Ajoutés par la 7.3 : `PointFocal` les affiche et les repose. Sans eux, l'écran
      // rendrait toujours le centre puis écraserait le point choisi au premier
      // enregistrement — et le typecheck a refusé de passer tant qu'ils manquaient, ce
      // qui est exactement le rôle qu'on lui demande.
      focalX: true,
      focalY: true,
      // ⚠️ MÊME RAISON, 15.1 : la case « dans la galerie de l'accueil » s'ouvrirait sur son
      // défaut et le premier enregistrement écraserait un choix déjà fait — le défaut décrit
      // juste au-dessus pour le point focal, et celui que `endsAt` a payé en 9.6.
      dansLaGalerie: true,
    },
    where: (table, { eq }) => eq(table.id, id),
  });
}

/**
 * Le plus grand `sort_order` existant, ou `null` si la table est vide.
 *
 * 🔴 SANS ÇA, `sortOrder` RESTERAIT À SON DÉFAUT `0` POUR TOUTES LES PHOTOS, ET LE
 * DÉPARTAGE SE FERAIT SUR UN **UUID ALÉATOIRE** (second terme de l'ordre total). « Organiser
 * la galerie » (FR21) n'aurait alors aucune prise sur les 8 photos que montre la home — la
 * borne la plus visible du site. La création calcule donc `max + 1`, explicitement.
 *
 * ⚠️ Ce n'est PAS une réservation atomique : deux téléversements simultanés peuvent lire le
 * même maximum et obtenir le même rang. C'est sans conséquence — l'ordre reste TOTAL grâce
 * au second terme, et l'écran de réordonnancement renumérote tout le monde. Un compteur en
 * base pour un back-office à un utilisateur serait un coût sans gain.
 */
export async function getMaxSortOrder(): Promise<number | null> {
  const [ligne] = await db.select({ maximum: max(photo.sortOrder) }).from(photo);
  return ligne?.maximum ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   LA GALERIE A-T-ELLE SUIVI LE DERNIER ÉVÉNEMENT ? — LECTURE NÉE DE LA STORY 13.3
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Le dernier événement **passé** et le nombre de photos qui lui sont rattachées.
 * `null` quand l'association n'a encore rien organisé — un état nominal, pas une panne.
 *
 * 🔴 CE QUE CETTE LECTURE PERMET DE DIRE, ET RIEN D'AUTRE : « il y a eu un événement, et
 * la galerie n'en porte aucune photo ». C'est le seul indicateur de galerie que la base
 * porte réellement. Un « la galerie mériterait d'être enrichie » ne s'appuierait sur rien —
 * exactement la porte sans pièce que la 13.3 s'interdit.
 *
 * ⚠️ **PUBLIÉ OU NON**, comme `getPastEventsForAdmin` : le back-office voit tout ce qui est
 * saisi. Filtrer ici sur `is_published` créerait une **seconde définition** de « le dernier
 * événement passé », qui répondrait un jour autre chose que la liste de l'agenda.
 *
 * ⚠️ Compte les photos **publiées ou non** : une photo téléversée mais pas encore publiée
 * prouve que quelqu'un s'en est occupé. Signaler malgré tout serait faux.
 */
export async function getGalerieDuDernierEvenement(maintenant: Date) {
  const dernier = await db.query.event.findFirst({
    columns: { id: true, title: true, startsAt: true },
    where: (table, { lte: avantOuEgal }) => avantOuEgal(table.startsAt, maintenant),
    // Ordre TOTAL : deux événements peuvent partager la minute (la Game'in Reims en porte
    // plusieurs en parallèle, et `starts_at` se saisit à la minute). Sans le second terme,
    // « le dernier » changerait d'une visite à l'autre sur une page `force-dynamic`.
    orderBy: (table, { desc }) => [desc(table.startsAt), desc(table.id)],
  });
  if (!dernier) return null;

  // ⚠️ SECONDE REQUÊTE, ET ELLE NE PEUT PAS NE PAS L'ÊTRE : elle dépend de l'événement
  // retenu. Même aller-retour que `getPhotosForEvents`, sur UN identifiant.
  // `count()` et non une liste de lignes : le tableau de bord affiche un nombre, charger
  // 60 photos pour les compter en mémoire ferait payer le rendu au volume saisi.
  const [compte] = await db
    .select({ total: count() })
    .from(photo)
    .where(eq(photo.eventId, dernier.id));

  return {
    id: dernier.id,
    titre: dernier.title,
    // Le jour MURAL À REIMS, jamais le jour UTC : un événement du jeudi soir 19h00 reste
    // jeudi, et un événement de nuit ne se lit pas la veille (`pieges/date-tz.md`, § A).
    jour: jourParis(dernier.startsAt),
    photos: compte?.total ?? 0,
  };
}

/** Ce que le tableau de bord sait de la galerie. `null` = aucun événement passé. */
export type GalerieDuDernierEvenement = Awaited<
  ReturnType<typeof getGalerieDuDernierEvenement>
>;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LA PHOTO DU HERO, CHOISIE DANS LA GALERIE (Story 7.3)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Rend `null` quand aucune photo n'est choisie — l'appelant retombe alors sur la photo
 * versionnée de `public/`, c'est-à-dire exactement ce que le hero rendait avant cette
 * story. Aucune régression possible au déploiement.
 *
 * 🔴 ELLE EXIGE `isPublished`, ET C'EST UNE GARDE, PAS UNE PRÉCAUTION. La route
 * `/medias/[filename]` ne sert QUE les médias publiés — mesuré le 2026-09-01 : une photo
 * téléversée mais non publiée y rend **404**. Sans ce filtre, un bénévole qui choisit un
 * brouillon casserait l'image de la page d'accueil, et rien ne le lui dirait : son écran
 * de réglages afficherait un choix enregistré, la home un cadre vide.
 * ⇒ Choisir un brouillon revient donc à ne rien choisir : on retombe sur le repli, qui
 * s'affiche. Une image qui manque doit se voir sur l'écran QUI LA CHOISIT, pas sur celui
 * qui la rend.
 *
 * ⚠️ `focalX`/`focalY` VOYAGENT AVEC LA PHOTO, jamais séparément : ce sont ses
 * coordonnées à elle, et les lire d'un autre appel les désynchroniserait au premier
 * changement de photo.
 */
export type PhotoDuSite = {
  filename: string;
  alt: string;
  focalX: number;
  focalY: number;
};

/**
 * ⚠️ UNE SEULE FONCTION POUR LES TROIS EMPLACEMENTS, PARAMÉTRÉE PAR LA COLONNE. La passe 1
 * n'en servait qu'un et l'avait écrite en dur ; à trois, la recopier aurait donné trois
 * jointures à garder d'accord — et c'est toujours la troisième qu'on oublie de corriger.
 * ⚠️ La colonne arrive en ARGUMENT TYPÉ (une des trois références de `siteSetting`), pas
 * en chaîne : un nom de colonne fautif ne compile pas.
 */
async function lirePhotoDuSite(
  colonne:
    | typeof siteSetting.heroPhotoId
    | typeof siteSetting.quotePhotoId
    | typeof siteSetting.ogPhotoId,
): Promise<PhotoDuSite | null> {
  const lignes = await db
    .select({
      filename: photo.filename,
      alt: photo.alt,
      focalX: photo.focalX,
      focalY: photo.focalY,
    })
    .from(siteSetting)
    .innerJoin(photo, eq(photo.id, colonne))
    .where(and(eq(siteSetting.id, 1), eq(photo.isPublished, true)))
    .limit(1);

  return lignes[0] ?? null;
}

export const getPhotoDuHero = () => lirePhotoDuSite(siteSetting.heroPhotoId);
export const getPhotoDeLaBande = () => lirePhotoDuSite(siteSetting.quotePhotoId);
export const getPhotoDePartage = () => lirePhotoDuSite(siteSetting.ogPhotoId);

/**
 * Les photos qu'on peut proposer comme photo d'accueil (Story 7.3).
 *
 * 🔴 PUBLIÉES SEULEMENT, ET C'EST LA MÊME GARDE QUE `getPhotoDuHero` : la route
 * `/medias/[filename]` ne sert QUE les médias publiés — un brouillon y rend 404. Proposer
 * un brouillon reviendrait à laisser choisir une photo qui ne s'affichera pas.
 * ⚠️ Ordonnées comme la galerie (`sortOrder`, puis la plus récente) : deux ordres
 * différents pour la même liste feraient chercher.
 */
export async function getPhotosPubliablesPourReglages() {
  return db
    .select({ id: photo.id, alt: photo.alt })
    .from(photo)
    .where(eq(photo.isPublished, true))
    .orderBy(photo.sortOrder, desc(photo.createdAt));
}

// ══════════════════════════════════════════════════════════════════════════════════════
// LA MÉDIATHÈQUE (Story 15.1) — CHOISIR UNE IMAGE, ET SAVOIR À QUOI ELLE SERT
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * Les images proposables dans le bloc « choisir ou importer » — événement, tournoi, post.
 *
 * 🔴 ELLE REMPLACE `getPhotosPourVisuel`, QUI VIVAIT DANS `queries/tournaments.ts`. Sa place
 * y était déjà discutable — elle interroge `photo`, pas `tournament` — mais tant qu'elle
 * n'avait qu'un appelant, la déplacer aurait été du rangement. Elle en a **trois** depuis
 * cette story : `architecture.md` pose une famille de requêtes **par domaine**, et c'est la
 * règle d'extraction du projet (« au 2ᵉ consommateur »).
 *
 * 🔴 **PUBLIÉES SEULEMENT**, et le motif est mesuré, pas esthétique : `/medias/[filename]` ne
 * sert **que** les images publiées (garde 6.4, 404 sur un brouillon). Proposer un brouillon
 * laisserait choisir un visuel qui ne s'afficherait **jamais**, sans que rien ne le dise.
 *
 * ⚠️ **AUCUN FILTRE SUR `dans_la_galerie`, ET C'EST VOLONTAIRE.** Cette colonne dit où une
 * image **paraît** (le scrapbook de l'accueil), jamais ce à quoi elle **sert**. Une photo de
 * soirée fait un très bon visuel d'événement, et une affiche reste choisissable pour un autre
 * post. Filtrer ici couperait la médiathèque en deux bibliothèques étanches — l'inverse exact
 * de ce que cette story livre.
 *
 * ⚠️ `focalX`/`focalY` REMONTENT : la grille de vignettes recadre (`object-fit: cover`), donc
 * elle COUPE. Sans eux elle montrerait un cadrage que le site n'applique pas — et c'est
 * précisément sur une vignette qu'on choisit une image (défaut corrigé le 2026-09-01 sur le
 * scrapbook, même famille).
 */
export async function getImagesPourChoix(limite: number) {
  return db.query.photo.findMany({
    columns: { id: true, filename: true, alt: true, focalX: true, focalY: true },
    where: (table, { eq }) => eq(table.isPublished, true),
    // La plus récente d'abord : on choisit presque toujours ce qu'on vient d'importer.
    // ⚠️ Ordre TOTAL (`alt` puis `id` en départage) — deux images créées dans la même
    // milliseconde par une boucle d'import sortiraient sinon dans un ordre non garanti, et
    // la grille se réordonnerait d'un rendu à l'autre sur un écran `force-dynamic`.
    orderBy: (table, { asc, desc }) => [desc(table.createdAt), asc(table.alt), asc(table.id)],
    limit: limite,
  });
}

/** Une image proposable dans le bloc de choix. DÉRIVÉE de la requête, jamais réécrite. */
export type ImageChoisissable = Awaited<ReturnType<typeof getImagesPourChoix>>[number];

/**
 * À quoi sert chaque image — « Visuel du tournoi X », « Photo d'accueil », …
 *
 * 🔴 CE N'EST PAS UN CONFORT D'AFFICHAGE, C'EST CE QUI REND LA SUPPRESSION SÛRE. Depuis que
 * cette table porte des visuels et des images de post, l'écran liste des images dont **rien à
 * l'œil ne dit qu'elles sont utilisées** : `alt` décrit ce qu'on voit, pas où ça sert. Or
 * supprimer est irréversible (la ligne **et** le fichier partent), et les `ON DELETE SET NULL`
 * font que la perte est **silencieuse** — l'événement garde sa page, il perd juste son image.
 * ⇒ L'écran doit pouvoir dire « celle-ci sert ici » **avant** le clic, pas après.
 *
 * ⚠️ **TROIS LECTURES, ET AUCUNE N'EST UN N+1** : on lit les lignes qui portent un `photo_id`
 * (elles sont rares par nature — une par tournoi, une par événement, trois pour le site), pas
 * une requête par image affichée.
 *
 * ⚠️ **`site_setting` COMPTE POUR TROIS EMPLOIS DISTINCTS** sur une seule ligne : le hero, la
 * bande de citation et l'image de partage. Les fondre en « utilisée sur l'accueil » ferait
 * disparaître l'information au moment où elle sert — retirer la photo de partage et celle du
 * hero n'a pas du tout le même effet.
 *
 * @returns une `Map` de `photoId` → libellés. **Une image sans emploi n'a pas d'entrée** :
 *   l'appelant n'affiche alors rien, plutôt qu'un « aucun emploi » qui se lirait comme une
 *   invitation à supprimer.
 */
export async function getEmploisDesImages(): Promise<Map<string, string[]>> {
  const [tournois, evenements, reglages] = await Promise.all([
    db.query.tournament.findMany({
      columns: { name: true, photoId: true },
      where: (table, { isNotNull }) => isNotNull(table.photoId),
    }),
    db.query.event.findMany({
      columns: { title: true, photoId: true },
      where: (table, { isNotNull }) => isNotNull(table.photoId),
    }),
    db.query.siteSetting.findFirst({
      columns: { heroPhotoId: true, quotePhotoId: true, ogPhotoId: true },
      where: (table, { eq }) => eq(table.id, 1),
    }),
  ]);

  const emplois = new Map<string, string[]>();
  const ajouter = (photoId: string | null, libelle: string) => {
    if (photoId === null) return;
    const deja = emplois.get(photoId);
    if (deja) deja.push(libelle);
    else emplois.set(photoId, [libelle]);
  };

  // ⚠️ `cleanText` sur les deux textes libres : `btrim` ne retire pas U+200B (dette R41), et
  // un titre fait uniquement d'invisible rendrait « Visuel du tournoi » suivi de RIEN —
  // l'étiquette orpheline que tout ce dépôt s'applique à ne jamais produire.
  for (const t of tournois) ajouter(t.photoId, `Visuel du tournoi « ${cleanText(t.name) ?? "sans nom"} »`);
  for (const e of evenements) ajouter(e.photoId, `Visuel de « ${cleanText(e.title) ?? "sans titre"} »`);

  ajouter(reglages?.heroPhotoId ?? null, "Photo d'accueil");
  ajouter(reglages?.quotePhotoId ?? null, "Bande de citation");
  ajouter(reglages?.ogPhotoId ?? null, "Image de partage");

  return emplois;
}

/**
 * Les colonnes d'une image **servant de visuel** — définies UNE fois, lues par deux familles.
 *
 * 🔴 ELLE EXISTE PARCE QUE DEUX DOMAINES LA CONSOMMENT DEPUIS LA 15.1 : `queries/tournaments.ts`
 * (le visuel d'un tournoi) et `queries/events.ts` (celui d'un événement). Recopier la liste
 * dans les deux aurait produit **deux définitions du même objet**, et ce dépôt sait ce que ça
 * coûte : elles auraient divergé au premier ajustement — exactement comme le point focal, qui
 * a été ajouté au scrapbook le 2026-09-01 et **oublié** sur le visuel de tournoi jusqu'ici.
 *
 * 🔴 `isPublished` EN FAIT PARTIE, ET CE N'EST PAS DÉCORATIF. `/medias/[filename]` répond
 * **404** pour une image non publiée (garde 6.4) et rien n'empêche de dépublier une image déjà
 * choisie comme visuel — `photo_id` reste alors intact, la dépublication n'étant pas une
 * suppression. Sans ce booléen, le rendu produirait un `<img>` vers une URL morte, c'est-à-dire
 * un cadre vide. **Le rendu DÉCIDE, il ne suppose pas.**
 */
export const COLONNES_VISUEL = {
  filename: true,
  alt: true,
  isPublished: true,
  focalX: true,
  focalY: true,
} as const;
