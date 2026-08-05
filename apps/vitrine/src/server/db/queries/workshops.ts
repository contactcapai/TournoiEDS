// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` et les trois autres familles de
// requêtes (garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne doit jamais être
// atteint depuis un composant client. ⚠️ `WorkshopCatalog` est un Server Component, mais
// c'est la PAGE qui requête et distribue en props — aucun composant n'importe d'ici.
import "server-only";
import { db } from "../client";

/**
 * Lectures des ateliers (Story 6.9, FR34 → FR10).
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
 * `ORDER BY family, sort_order, title, id`, et chacun des quatre termes a sa raison :
 *
 *   · `family` **d'abord** — le catalogue est GROUPÉ par famille sur `/animations`. L'ordre
 *     des familles est celui de l'enum Postgres, donc celui du tableau `WORKSHOP_FAMILIES`
 *     (`lib/schemas/workshop.ts`). ⚠️ Un `ORDER BY` sur une colonne d'enum trie par ordre de
 *     **DÉCLARATION**, pas alphabétiquement : réordonner ce tableau réordonnerait la page.
 *   · `sort_order` ensuite — le classement manuel du back-office (FR34). Il ne s'applique
 *     donc **qu'à l'intérieur d'une famille**, puisque `family` tranche avant lui. C'est ce
 *     qui rend `reordonnerAteliers` propre à une famille, et non global à la table.
 *   · `title` ensuite, et ce n'est pas décoratif : sans lui, deux ateliers de même famille et
 *     même `sort_order` — **le cas nominal** dès que le back-office laisse le défaut `0` —
 *     sortiraient dans un ordre que Postgres **ne garantit pas**.
 *   · `id` en dernier, pour que l'ordre soit TOTAL : deux ateliers de même famille, même
 *     `sort_order` ET même `title` (un doublon de saisie, que rien n'interdit) laisseraient
 *     encore l'ordre indéterminé. Un tri départage tout ou n'est pas déterministe ; il n'y a
 *     pas de « suffisamment déterministe ».
 *
 * 🔴 ET L'ENJEU EST PLUS FORT ICI QUE PARTOUT AILLEURS : `/animations` devient `force-dynamic`
 * avec cette story, donc la requête est **rejouée à chaque visite**. Un ordre non total ferait
 * se réordonner le catalogue d'une visite à l'autre — un scintillement qu'on ne saurait pas
 * reproduire. Le raisonnement est celui de `queries/partners.ts`, payé une fois pour toutes.
 *
 * `is_published` puis `family` puis `sort_order` : c'est exactement l'ordre de l'index
 * `workshop_published_family_order_idx` posé par la `0010` pour cette requête.
 *
 * `columns` EXPLICITES : le catalogue public ne rend que l'intitulé, la description et le
 * public visé, plus la famille qui le groupe. `sortOrder`, `isPublished`, `createdAt` et
 * `updatedAt` sont délibérément ABSENTS — les remonter ferait croire au type dérivé qu'ils
 * sont disponibles, et chargerait la page de données que personne ne consomme.
 */
export async function getPublishedWorkshops() {
  return db.query.workshop.findMany({
    columns: { id: true, title: true, summary: true, audience: true, family: true },
    where: (table, { eq }) => eq(table.isPublished, true),
    orderBy: (table, { asc }) => [
      asc(table.family),
      asc(table.sortOrder),
      asc(table.title),
      asc(table.id),
    ],
  });
}

/**
 * Une entrée du catalogue public, **DÉRIVÉE de la requête** et non réécrite à la main :
 * ajouter une colonne à `columns` met ce type à jour tout seul (patron `PartnerTile`).
 *
 * ⚠️ `summary` et `audience` restent `string | null` **à dessein** : leur absence n'est pas un
 * cas résiduel à affiner, c'est une **branche de rendu** que le composant doit traiter. Le type
 * l'y oblige.
 */
export type WorkshopEntry = Awaited<ReturnType<typeof getPublishedWorkshops>>[number];

/**
 * TOUS les ateliers, **brouillons compris** — pour le back-office et sa prévisualisation.
 *
 * 🔴 UNE SECONDE REQUÊTE, ET NON `getPublishedWorkshops()` RÉUTILISÉE : son filtre
 * `is_published` est **exactement ce que cet écran ne veut pas**. Un back-office qui ne
 * montrerait que le publié rendrait invisible ce qu'on vient d'y créer — or un atelier naît
 * en brouillon. Même arbitrage que `getPartnersForAdmin` (6.5) et `getEventsForAdmin` (6.3).
 *
 * ⚠️ MÊME ORDRE que la requête publique, et c'est ce qui rend la prévisualisation honnête :
 * l'aperçu doit montrer les entrées dans l'ordre où le visiteur les verra, sinon il ne
 * prévisualise pas grand-chose.
 *
 * @param limite borne EXPLICITE, jamais de lecture non bornée. Une page dont le temps de rendu
 *   dépend du nombre d'entrées est un défaut qui n'apparaîtrait qu'une fois la base remplie —
 *   c'est-à-dire en production, chez quelqu'un d'autre. **« Généreux » n'est pas « non borné ».**
 */
export async function getWorkshopsForAdmin(limite: number) {
  return db.query.workshop.findMany({
    columns: {
      id: true,
      title: true,
      summary: true,
      audience: true,
      family: true,
      isPublished: true,
    },
    orderBy: (table, { asc }) => [
      asc(table.family),
      asc(table.sortOrder),
      asc(table.title),
      asc(table.id),
    ],
    limit: limite,
  });
}

/** Une ligne de la liste du back-office, dérivée de la requête (même règle que ci-dessus). */
export type AdminWorkshop = Awaited<ReturnType<typeof getWorkshopsForAdmin>>[number];

/**
 * Un atelier par son identifiant, pour la fiche d'édition. `undefined` s'il n'existe plus.
 *
 * ⚠️ Ne filtre PAS sur `is_published` : on édite aussi — et surtout — des brouillons.
 */
export async function getWorkshopById(id: string) {
  return db.query.workshop.findFirst({
    columns: { id: true, title: true, summary: true, audience: true, family: true },
    where: (table, { eq }) => eq(table.id, id),
  });
}
