// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts`, `queries/events.ts` et
// `queries/partners.ts` (Garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne
// doit jamais être atteint depuis un composant client. ⚠️ `Lightbox` EST un composant
// client — elle reçoit ses photos en props depuis la page, elle n'importe rien d'ici.
import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "../client";

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
