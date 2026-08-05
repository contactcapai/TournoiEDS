// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` et les quatre autres familles de
// requêtes (garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne doit jamais être
// atteint depuis un composant client. ⚠️ `TeamGrid` est un Server Component, mais c'est la
// PAGE qui requête et distribue en props — aucun composant n'importe d'ici.
import "server-only";
import { db } from "../client";

/**
 * Lectures des membres de l'équipe (Story 6.10, FR35 → FR9).
 *
 * Emplacement conforme à `architecture.md` (l.515) : une famille de requêtes par domaine sous
 * `server/db/queries/`. Les composants ne requêtent JAMAIS eux-mêmes — la page appelle puis
 * distribue en props (patron AC1 de la 3.2).
 */

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 L'ORDRE EST EN SQL, ET IL EST **TOTAL** — CE N'EST PAS UNE PRÉCAUTION DE STYLE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `ORDER BY sort_order, first_name, id`, et chacun des trois termes a sa raison :
 *
 *   · `sort_order` d'abord — le classement manuel du back-office (FR35). L'équipe est une
 *     **liste unique**, sans famille ni catégorie : ce tri est donc GLOBAL à la table, à la
 *     différence de celui des ateliers, que `family` tranchait avant lui.
 *   · `first_name` ensuite, et ce n'est pas décoratif : sans lui, deux membres de même
 *     `sort_order` — **le cas nominal** dès que le back-office laisse le défaut `0` —
 *     sortiraient dans un ordre que Postgres **ne garantit pas**.
 *   · `id` en dernier, pour que l'ordre soit TOTAL : deux membres de même `sort_order` ET même
 *     prénom (deux Marie dans un bureau, que rien n'interdit et qui est banal) laisseraient
 *     encore l'ordre indéterminé. Un tri départage tout ou n'est pas déterministe ; il n'y a
 *     pas de « suffisamment déterministe ».
 *
 * 🔴 ET L'ENJEU EST RÉEL : `/l-asso` devient `force-dynamic` avec cette story, donc la requête
 * est **rejouée à chaque visite**. Un ordre non total ferait se réordonner l'équipe d'une
 * visite à l'autre — un scintillement qu'on ne saurait pas reproduire. Raisonnement payé une
 * fois pour toutes par `queries/partners.ts`, repris par `queries/workshops.ts`.
 *
 * `is_published` puis `sort_order` : c'est exactement l'ordre de l'index
 * `member_published_order_idx` posé par la `0011` pour cette requête.
 *
 * `columns` EXPLICITES : la carte publique ne rend que le prénom, le rôle et le portrait.
 * `sortOrder`, `isPublished`, `createdAt` et `updatedAt` sont délibérément ABSENTS — les
 * remonter ferait croire au type dérivé qu'ils sont disponibles, et chargerait la page de
 * données que personne ne consomme.
 */
export async function getPublishedMembers() {
  return db.query.member.findMany({
    columns: { id: true, firstName: true, role: true, portrait: true },
    where: (table, { eq }) => eq(table.isPublished, true),
    orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.firstName), asc(table.id)],
  });
}

/**
 * Un membre du rendu public, **DÉRIVÉ de la requête** et non réécrit à la main : ajouter une
 * colonne à `columns` met ce type à jour tout seul (patron `WorkshopEntry`, `PartnerTile`).
 *
 * ⚠️ `portrait` reste `string | null` **à dessein** : son absence n'est pas un cas résiduel à
 * affiner, c'est une **branche de rendu** que le composant doit traiter — il pose alors une
 * silhouette dans le même cadre. Le type l'y oblige.
 */
export type MemberEntry = Awaited<ReturnType<typeof getPublishedMembers>>[number];

/**
 * TOUS les membres, **brouillons compris** — pour le back-office et sa prévisualisation.
 *
 * 🔴 UNE SECONDE REQUÊTE, ET NON `getPublishedMembers()` RÉUTILISÉE : son filtre
 * `is_published` est **exactement ce que cet écran ne veut pas**. Un back-office qui ne
 * montrerait que le publié rendrait invisible ce qu'on vient d'y créer — or un membre naît en
 * brouillon. Même arbitrage que `getWorkshopsForAdmin` (6.9), `getPartnersForAdmin` (6.5) et
 * `getEventsForAdmin` (6.3).
 *
 * ⚠️ MÊME ORDRE que la requête publique, et c'est ce qui rend la prévisualisation honnête :
 * l'aperçu doit montrer les entrées dans l'ordre où le visiteur les verra, sinon il ne
 * prévisualise pas grand-chose.
 *
 * @param limite borne EXPLICITE, jamais de lecture non bornée. Une page dont le temps de rendu
 *   dépend du nombre d'entrées est un défaut qui n'apparaîtrait qu'une fois la base remplie —
 *   c'est-à-dire en production, chez quelqu'un d'autre. **« Généreux » n'est pas « non borné ».**
 */
export async function getMembersForAdmin(limite: number) {
  return db.query.member.findMany({
    columns: {
      id: true,
      firstName: true,
      role: true,
      portrait: true,
      sortOrder: true,
      isPublished: true,
    },
    orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.firstName), asc(table.id)],
    limit: limite,
  });
}

/**
 * 🔴 LA BORNE DE L'ÉCRAN, PARTAGÉE — DÉFAUT TROUVÉ EN REVUE (Edge Case Hunter).
 *
 * Elle vivait en local dans `app/admin/(protege)/membres/page.tsx`, tandis que
 * `reordonnerMembres` relisait la table **sans borne**. Au-delà de 200 membres, les deux
 * longueurs n'auraient jamais coïncidé et le réordonnancement aurait échoué
 * **systématiquement**, avec un message accusant une modification concurrente qui n'a pas eu
 * lieu. Cas absurde pour une association ; incohérence réelle quand même — et deux bornes qui
 * doivent être égales ne se recopient pas, elles se partagent.
 *
 * ⚠️ « Généreux » n'est pas « non borné » : une page dont le temps de rendu dépend du nombre
 * d'entrées est un défaut qui n'apparaîtrait qu'une fois la base remplie, c'est-à-dire en
 * production, chez quelqu'un d'autre.
 */
export const MEMBRES_MAX = 200;

/** Une ligne de la liste du back-office, dérivée de la requête (même règle que ci-dessus). */
export type AdminMember = Awaited<ReturnType<typeof getMembersForAdmin>>[number];

/**
 * Un membre par son identifiant, pour la fiche d'édition. `undefined` s'il n'existe plus.
 *
 * ⚠️ Ne filtre PAS sur `is_published` : on édite aussi — et surtout — des brouillons.
 */
export async function getMemberById(id: string) {
  return db.query.member.findFirst({
    columns: {
      id: true,
      firstName: true,
      role: true,
      portrait: true,
      sortOrder: true,
      isPublished: true,
    },
    where: (table, { eq }) => eq(table.id, id),
  });
}
