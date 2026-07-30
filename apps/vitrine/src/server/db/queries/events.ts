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
export async function getUpcomingEvents(limit: number) {
  return db.query.event.findMany({
    where: (table, { and, eq, gt }) =>
      and(eq(table.isPublished, true), gt(table.startsAt, new Date())),
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
