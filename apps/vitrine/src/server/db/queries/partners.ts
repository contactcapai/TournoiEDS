// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` et `queries/events.ts`
// (Garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne doit jamais être atteint
// depuis un composant client. ⚠️ `PartnerMarquee` EST un composant client — il reçoit ses
// tuiles en props depuis la page, il n'importe rien d'ici.
import "server-only";
import { isNotNull } from "drizzle-orm";
import { db } from "../client";

/**
 * Lectures des partenaires (Story 4.1).
 *
 * Emplacement conforme à `architecture.md` (l.515) : une famille de requêtes par domaine
 * sous `server/db/queries/`. Les composants ne requêtent JAMAIS eux-mêmes — la page appelle
 * puis distribue en props (patron AC1 de la 3.2).
 */

/**
 * Les partenaires publiés QUI ONT UN LOGO, dans l'ordre du bandeau de la home.
 *
 * 🔴 LE FILTRE `logo IS NOT NULL` EST UN FILET, PAS UN MODE DÉGRADÉ NOMINAL.
 * Arbitrage de Brice du 2026-07-30 : « il y a tous les logos sans problème ; le filtre est
 * juste au cas où il en manquerait un — mieux vaut qu'il ne s'affiche pas en home que
 * d'avoir un placeholder de logo ». Conséquence directe : le bandeau se remplit tout seul à
 * mesure que les fichiers arrivent (aujourd'hui 4 des 11 entrées), et il n'affiche JAMAIS
 * un nom en repli — c'est un bandeau de LOGOS. La version nommée, avec description et lien,
 * est la page `/partenaires` (Story 4.2), qui lira TOUTES les entrées.
 *
 * 🔴 LE TRI EST EN SQL, PAS EN JS. `ORDER BY category, sort_order, name` :
 *   - `category` d'abord — sponsors en tête, participations en queue. L'ordre est celui de
 *     l'enum Postgres, donc celui du tableau `PARTNER_CATEGORIES` (`lib/schemas/partner.ts`).
 *     ⚠️ Un `ORDER BY` sur une colonne d'enum trie par ORDRE DE DÉCLARATION, pas
 *     alphabétiquement : réordonner ce tableau réordonnerait le bandeau.
 *   - `sort_order` ensuite — le classement manuel que la Story 6.5 exposera (FR22) ;
 *   - `name` en dernier, et ce n'est pas décoratif : sans lui, deux entrées de même
 *     catégorie et même `sort_order` (cas nominal après un back-office qui laisse le
 *     défaut `0`) sortiraient dans un ordre que Postgres ne garantit PAS. Le bandeau
 *     changerait d'ordre entre deux requêtes, sur une page dynamique — un scintillement
 *     qu'on ne saurait pas reproduire.
 *
 * `is_published` puis `category` puis `sort_order` : c'est exactement l'ordre de l'index
 * `partner_published_category_order_idx` posé par la Story 4.1 pour cette requête.
 *
 * `columns` explicites : le bandeau n'a besoin que du nom (pour l'`alt`) et du logo.
 * `description` et `link` sont délibérément absents — les remonter chargerait la home de
 * données que seule `/partenaires` consomme, et le type dérivé ci-dessous laisserait croire
 * qu'elles y sont disponibles.
 */
export async function getPartnersWithLogo() {
  return db.query.partner.findMany({
    columns: { id: true, name: true, logo: true },
    where: (table, { and, eq }) => and(eq(table.isPublished, true), isNotNull(table.logo)),
    orderBy: (table, { asc }) => [asc(table.category), asc(table.sortOrder), asc(table.name)],
  });
}

/**
 * Une tuile du bandeau, DÉRIVÉE de la requête et non réécrite à la main : ajouter une
 * colonne à `columns` met ce type à jour tout seul.
 *
 * ⚠️ `logo` y est typé `string | null` — Drizzle ne sait pas que le `WHERE` l'a déjà exclu.
 * Le rendu doit donc soit affiner (`logo: string`), soit traiter la branche nulle. Le
 * composant choisit la première voie, à un seul endroit (`ProofBand`), plutôt que de
 * répéter un `!` non vérifié dans le markup.
 */
export type PartnerTile = Awaited<ReturnType<typeof getPartnersWithLogo>>[number];
