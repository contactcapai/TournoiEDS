// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` (Garde-fou n°1 de la Story
// 1.7) : ce module lit la base, il ne doit jamais être atteint depuis un composant client.
import "server-only";
import { db } from "../client";

/**
 * Lectures de l'agenda (Story 3.2).
 *
 * Emplacement conforme à `architecture.md` (l.508) : les requêtes vivent sous
 * `server/db/queries/`, une famille par domaine. Les composants ne requêtent JAMAIS
 * eux-mêmes — la page appelle, puis distribue en props (AC1). C'est ce qui garantit que
 * le badge du hero et la carte du hub désignent la MÊME date : il n'y a qu'une lecture.
 */

/**
 * Les `limit` prochains événements publiés, du plus proche au plus lointain.
 *
 * 🔴 LA COMPARAISON EST BRUTE, ET C'EST VOLONTAIRE (garde-fou C de la story).
 * `schema.ts` prescrit `timezone('Europe/Paris', …)` pour toute TRONCATURE ou extraction
 * de date — pas pour une comparaison d'instants. `starts_at > now()` compare deux points
 * du temps : le fuseau n'entre pas dans l'opération, et l'envelopper laisserait croire
 * qu'une règle s'applique ici alors qu'elle ne concerne que l'AFFICHAGE (lequel passe,
 * lui, par `src/lib/date-paris.ts`). C'est exactement l'opérateur que `seed.ts` (l.307)
 * utilise déjà pour compter les « à venir » : une seule définition de « à venir » dans
 * le dépôt.
 *
 * Strict (`gt` et non `gte`) : un jeudi commencé n'est plus « à venir », même si la
 * soirée continue. Choix arbitré de la story, aligné sur le seed.
 *
 * `is_published` d'abord, `starts_at` ensuite : c'est l'ordre de l'index
 * `event_published_starts_at_idx` posé par la Story 3.1 pour cette requête précise.
 */
/**
 * ⚠️ **L'INSTANT ARRIVE EN PARAMÈTRE DEPUIS LA STORY 9.5, ET IL EST OBLIGATOIRE.**
 * Cette fonction lisait `new Date()` elle-même. Elle est désormais **une des deux moitiés**
 * d'une liste fusionnée (événements + tournois sans événement, `queries/rendez-vous.ts`) : si
 * chaque moitié lisait sa propre horloge, une ligne pile à la frontière pourrait tomber dans
 * les deux — c'est la fenêtre **R49**, et le but est de **ne pas en créer une sixième**.
 * ⇒ Le paramètre n'a **pas de défaut**, volontairement : un appelant qui l'oublie ne peut pas
 * retomber en silence sur une seconde lecture d'horloge, le typecheck l'arrête.
 */
export async function getUpcomingEvents(limit: number, maintenant: Date) {
  return db.query.event.findMany({
    where: (table, { and, eq, gt }) =>
      and(eq(table.isPublished, true), gt(table.startsAt, maintenant)),
    orderBy: (table, { asc }) => asc(table.startsAt),
    // Relation déclarée par la Story 3.1 : le bar arrive avec l'événement, pas en N+1.
    // `bar` est nullable (temps fort hors bar) — le rendu doit traiter les deux branches.
    with: { bar: true },
    limit,
  });
}

/**
 * Les `limit` derniers événements publiés DÉJÀ PASSÉS, du plus récent au plus ancien
 * (Story 3.3, FR5).
 *
 * Jumelle exacte de `getUpcomingEvents` : même table, même relation, même index
 * (`event_published_starts_at_idx`), comparaison brute à `now()` pour les mêmes
 * raisons — la borne inverse et l'ordre inverse, rien d'autre.
 *
 * `lte` et non `lt` : la borne est le complément STRICT de `gt` employé par
 * `getUpcomingEvents`. Un événement pile à `now()` doit appartenir à exactement une
 * des deux listes ; avec `lt` des deux côtés il disparaîtrait des deux, avec `gte` il
 * apparaîtrait dans les deux. Le cas est d'une probabilité infime et c'est justement
 * pour ça qu'il ne serait jamais diagnostiqué.
 *
 * Borne courte assumée : un agenda n'est pas une archive. La mémoire longue viendra
 * avec la galerie (Epic 4), qui a ses propres écrans.
 */
export async function getPastEvents(limit: number) {
  return db.query.event.findMany({
    where: (table, { and, eq, lte }) =>
      and(eq(table.isPublished, true), lte(table.startsAt, new Date())),
    orderBy: (table, { desc }) => desc(table.startsAt),
    with: { bar: true },
    limit,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   LECTURES DU BACK-OFFICE (Story 6.3)

   🔴 ELLES VIVENT ICI, DANS LA MÊME FAMILLE QUE LES LECTURES PUBLIQUES, ET C'EST
   VOLONTAIRE. `architecture.md` l.508 pose une famille de requêtes PAR DOMAINE, pas
   par public. Un `queries/admin-events.ts` parallèle serait une seconde définition de
   « un événement » : au premier changement de schéma, les deux divergeraient.

   ⚠️ LA DIFFÉRENCE EST UNE SEULE LIGNE, ET C'EST TOUTE LA FRONTIÈRE : les lectures
   publiques filtrent sur `is_published`, celles-ci **ne filtrent pas**. Ne JAMAIS
   relâcher le filtre des deux fonctions ci-dessus « pour réutiliser » — ce serait une
   fuite de données non publiées sur `/` et `/agenda`, et aucune porte visuelle ne la
   verrait (une page qui affiche un événement de plus n'a pas l'air cassée).
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Événements À VENIR pour le back-office — publiés **et non publiés**.
 *
 * Bornes EXPLICITES, comme les lectures publiques : une page dont le temps de rendu
 * dépend du volume saisi est un défaut qui n'apparaîtrait qu'une fois la base remplie par
 * les bénévoles, c'est-à-dire en production.
 */
export async function getUpcomingEventsForAdmin(limit: number) {
  return db.query.event.findMany({
    where: (table, { gt }) => gt(table.startsAt, new Date()),
    orderBy: (table, { asc }) => asc(table.startsAt),
    with: { bar: true },
    limit,
  });
}

/** Événements PASSÉS pour le back-office — publiés **et non publiés**, du plus récent. */
export async function getPastEventsForAdmin(limit: number) {
  return db.query.event.findMany({
    where: (table, { lte }) => lte(table.startsAt, new Date()),
    orderBy: (table, { desc }) => desc(table.startsAt),
    with: { bar: true },
    limit,
  });
}

/**
 * Un événement par son identifiant, publié ou non.
 *
 * ⚠️ L'appelant doit avoir **validé l'identifiant** avant : un `id` malformé remis à une
 * colonne `uuid` fait lever Postgres (`invalid input syntax for type uuid`) → erreur 500
 * là où la réponse juste est un 404. La validation vit dans la page, au bord.
 */
export async function getEventById(id: string) {
  const ligne = await db.query.event.findFirst({
    where: (table, { eq }) => eq(table.id, id),
    with: { bar: true },
  });
  if (!ligne) return undefined;

  /**
   * 🔴 « PASSÉ » EST CALCULÉ ICI, PAS DANS LE RENDU, ET CE N'EST PAS UN DÉTAIL DE STYLE.
   * Lire l'horloge pendant le rendu d'un composant est une impureté (`react-hooks/purity`
   * la refuse) : deux rendus du même arbre pourraient répondre différemment. La couche
   * données est déjà l'endroit où le projet lit l'heure — `getUpcomingEvents` et
   * `getPastEvents` le font toutes les deux — et c'est ce qui garantit qu'« à venir » et
   * « passé » ont ici EXACTEMENT le même sens qu'elles : `lte` d'un côté, `gt` de l'autre,
   * donc un événement pile à `now()` appartient à « passé », comme côté public.
   */
  return { ...ligne, estPasse: ligne.startsAt <= new Date() };
}

/** Tous les bars du roulement, par ordre alphabétique — la liste tient sur un écran. */
export async function getBars() {
  return db.query.bar.findMany({
    orderBy: (table, { asc }) => asc(table.name),
  });
}

/** Un bar par son identifiant. Même avertissement que `getEventById` sur l'`id`. */
export async function getBarById(id: string) {
  return db.query.bar.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
}

/**
 * Événements qui EMPÊCHENT la suppression d'un bar (Story 6.3, AC3).
 *
 * 🔴 CE COMPTE EXISTE POUR TRADUIRE UN ÉCHEC, PAS POUR L'ÉVITER. `event.barId` est
 * `ON DELETE SET NULL` — jamais `CASCADE`, pour que perdre un partenariat n'efface pas
 * l'historique des jeudis. Mais le passage à `NULL` ré-évalue `event_has_venue` : un
 * événement rattaché à ce bar et **sans lieu libre** viole alors la contrainte, et
 * Postgres refuse la suppression. C'est le bon signal — mais son message brut
 * (`violates check constraint "event_has_venue"`) est illisible pour un bénévole.
 *
 * On compte donc AVANT de tenter, pour pouvoir dire **combien** et **quoi faire**.
 * ⚠️ Ce compte ne remplace pas la contrainte : entre le compte et la suppression, rien ne
 * garantit que la base n'a pas changé. L'échec reste attrapé et traduit côté action.
 */
export async function countEventsBlockingBarDeletion(barId: string) {
  const lignes = await db.query.event.findMany({
    columns: { id: true },
    where: (table, { and, eq, isNull, or, sql }) =>
      and(
        eq(table.barId, barId),
        or(isNull(table.venueName), sql`length(btrim(${table.venueName})) = 0`),
      ),
  });
  return lignes.length;
}

/**
 * Type d'une ligne d'agenda, DÉRIVÉ de la requête et non réécrit à la main : ajouter
 * une relation ou une colonne au schéma met ce type à jour tout seul. Une interface
 * recopiée aurait divergé au premier changement.
 *
 * ⚠️ Nommé `AgendaEvent` et non `UpcomingEvent` (Story 3.3) : la page `/agenda` rend
 * aussi les événements PASSÉS, avec exactement la même forme. Un type nommé d'après
 * un seul de ses usages aurait poussé à en déclarer un second, identique.
 */
export type AgendaEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number];
