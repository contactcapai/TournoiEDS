// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts`, `queries/events.ts` et
// `queries/partners.ts` (Garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne
// doit jamais être atteint depuis un composant client. ⚠️ `Lightbox` EST un composant
// client — elle reçoit ses photos en props depuis la page, elle n'importe rien d'ici.
import "server-only";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";

import { jourParis } from "@/lib/date-paris";
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
    columns: { id: true, filename: true, alt: true, caption: true },
    where: (table, { eq }) => eq(table.isPublished, true),
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
    columns: { id: true, filename: true, alt: true, caption: true, eventId: true },
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
export async function getPhotoDuHero(): Promise<{
  filename: string;
  alt: string;
  focalX: number;
  focalY: number;
} | null> {
  const lignes = await db
    .select({
      filename: photo.filename,
      alt: photo.alt,
      focalX: photo.focalX,
      focalY: photo.focalY,
    })
    .from(siteSetting)
    .innerJoin(photo, eq(photo.id, siteSetting.heroPhotoId))
    .where(and(eq(siteSetting.id, 1), eq(photo.isPublished, true)))
    .limit(1);

  return lignes[0] ?? null;
}

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
