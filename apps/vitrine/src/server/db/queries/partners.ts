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
 *   - `name` ensuite, et ce n'est pas décoratif : sans lui, deux entrées de même
 *     catégorie et même `sort_order` (cas nominal après un back-office qui laisse le
 *     défaut `0`) sortiraient dans un ordre que Postgres ne garantit PAS. Le bandeau
 *     changerait d'ordre entre deux requêtes, sur une page dynamique — un scintillement
 *     qu'on ne saurait pas reproduire ;
 *   - `id` en dernier, pour que l'ordre soit TOTAL. Relevé à la revue : le raisonnement
 *     qui a fait ajouter `name` vaut un cran plus loin — deux entrées de même catégorie,
 *     même `sort_order` ET même `name` (un doublon de saisie, que rien n'interdit)
 *     laissaient l'ordre indéterminé. Un tri qui départage tout est déterministe ou ne
 *     l'est pas ; il n'y a pas de « suffisamment déterministe ».
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
    orderBy: (table, { asc }) => [
      asc(table.category),
      asc(table.sortOrder),
      asc(table.name),
      asc(table.id),
    ],
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

/**
 * TOUS les partenaires publiés, dans l'ordre des murs de `/partenaires` (Story 4.2).
 *
 * 🔴 LA DIFFÉRENCE AVEC `getPartnersWithLogo()` TIENT EN UN SEUL TERME, ET C'EST TOUT
 * L'ÉCART ENTRE LES DEUX SURFACES : **pas de filtre `logo IS NOT NULL` ici**.
 * La home est un teaser de LOGOS — une entrée sans fichier y est omise. `/partenaires`
 * DOCUMENTE — une entrée sans logo y est affichée, avec son nom dans la tuile
 * (arbitrage de Brice du 2026-07-31, patron `.logo-tile` de la maquette, qui rend
 * précisément le nom en texte). Ajouter ce filtre ici viderait la page des 7 entrées
 * sur 11 qui n'ont pas encore de fichier.
 *
 * 🔴 MÊME ORDRE TOTAL QUE LA REQUÊTE DE LA HOME, et pour une raison de plus ici : la
 * page est `force-dynamic`, donc la requête est rejouée à CHAQUE visite. Sans les deux
 * derniers termes (`name`, `id`), deux entrées de même catégorie et même `sort_order` —
 * le cas nominal dès que le back-office (6.5) laissera le défaut `0` — sortiraient dans
 * un ordre que Postgres ne garantit pas, et les murs se réordonneraient d'une visite à
 * l'autre. Le raisonnement complet est au-dessus, sur `getPartnersWithLogo()`.
 *
 * `is_published` puis `category` puis `sort_order` : c'est l'ordre de l'index
 * `partner_published_category_order_idx`, posé par la Story 4.1 en annonçant déjà qu'il
 * servirait AUSSI cette requête (`schema.ts`, commentaire de l'index). Aucun index à
 * ajouter.
 *
 * `columns` explicites : `description`, `link` et `category` s'ajoutent à ce que lit la
 * home — la page les rend, elle. ⚠️ Sont délibérément ABSENTS `sortOrder`, `isPublished`,
 * `createdAt` et `updatedAt` : le rendu ne les consomme pas, et les remonter ferait
 * croire au type dérivé qu'ils sont disponibles.
 */
export async function getPublishedPartners() {
  return db.query.partner.findMany({
    columns: {
      id: true,
      name: true,
      logo: true,
      description: true,
      link: true,
      category: true,
    },
    where: (table, { eq }) => eq(table.isPublished, true),
    orderBy: (table, { asc }) => [
      asc(table.category),
      asc(table.sortOrder),
      asc(table.name),
      asc(table.id),
    ],
  });
}

/**
 * Une entrée de mur, DÉRIVÉE de la requête (même règle que `PartnerTile`).
 *
 * ⚠️ Contrairement à `PartnerTile`, `logo` reste ici `string | null` À DESSEIN : sur
 * `/partenaires`, l'absence de logo n'est pas un cas résiduel à affiner, c'est une
 * BRANCHE DE RENDU à part entière (la tuile bascule sur le nom). Le type doit forcer
 * le composant à la traiter — 7 des 11 entrées d'aujourd'hui passent par là.
 */
export type PartnerEntry = Awaited<ReturnType<typeof getPublishedPartners>>[number];
