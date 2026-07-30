// Schéma Drizzle de la vitrine.
//
// 🔴 UNE TABLE PAR STORY, JAMAIS D'ANTICIPATION (règle posée en Story 1.7 et maintenue).
// Une table sans consommateur est une migration qu'il faudra défaire. À venir, chacune
// avec sa story : `photo` (4.3), `solicitation` (5.1), `member` / `workshop` (Epic 6).
// ⚠️ La table `achievement` annoncée ici jusqu'à la Story 4.1 N'EXISTERA PAS : la
// restructuration du 2026-07-30 l'a fondue dans `partner` (catégorie `participation`).
//
// 🔴 HORLOGE DE RÉFÉRENCE : Europe/Paris, et elle doit être EXPLICITE PARTOUT.
// Le conteneur Next de production tourne en UTC. Piège `00 référence/pieges/date-tz.md`.
// Prescriptions pour les stories qui liront ces tables (3.2 hub home, 3.3 page Agenda) :
//   - côté JS  : passer par `src/lib/date-paris.ts`. Jamais `getDay()`, `getHours()`, ni
//                `toISOString().slice(0, 10)` — ils répondent dans le fuseau du process.
//   - côté SQL : `date_trunc` / `extract` / `::date` sur un `timestamptz` s'évaluent dans
//                le fuseau de la SESSION Postgres. Ils glissent en production sans rien
//                casser en local. Envelopper : `timezone('Europe/Paris', starts_at)`.
//   - une comparaison brute à `now()` (« à venir » / « passé »), elle, est SÛRE : deux
//                instants se comparent sans fuseau. C'est la troncature qui est piégeuse.
//
// Convention : clés TS en camelCase → colonnes en snake_case via `casing: 'snake_case'`,
// posé À LA FOIS dans `client.ts` et `drizzle.config.ts` (Garde-fou n°7 de la 1.7). Les
// noms de colonnes ne sont donc pas répétés ici : c'est la conversion qui fait foi.
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { EVENT_TYPES } from "../../lib/schemas/event";
import { PARTNER_CATEGORIES } from "../../lib/schemas/partner";

/**
 * Nature d'un événement. Identifiants techniques en anglais, comme les tables ; les
 * libellés publics (« Hebdo », « Temps fort ») sont du RENDU et vivent dans la 3.2.
 *
 * Les valeurs viennent de `src/lib/schemas/event.ts` : **une seule liste**, pas deux
 * reliées par un commentaire. Le sens de l'import est celui-là parce que le module Zod
 * est bundlé côté client en Epic 6 — l'inverse y ferait entrer tout Drizzle.
 */
export const eventType = pgEnum("event_type", EVENT_TYPES);

/**
 * Bar rémois accueillant le roulement des jeudis (FR2 : quatre bars, un jeudi par mois
 * chacun).
 *
 * Pas de `is_published` ici : un bar n'est pas publié, c'est l'ÉVÉNEMENT qui l'est. Et
 * pas de champ « nom provisoire » non plus : un bar dont l'accord n'est pas encore signé
 * se seede avec `name = 'Bar partenaire #2'` (UX-DR11) — c'est de la donnée, pas un état.
 */
export const bar = pgTable("bar", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  address: text().notNull(),
  /** Quartier rémois, affiché à côté du nom sur la carte du hub (UX-DR10). */
  district: text().notNull(),
  city: text().notNull().default("Reims"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Jeudi récurrent ou temps fort.
 *
 * Le lieu tient en DEUX branches : soit un bar du roulement (`barId`), soit un lieu libre
 * (`venueName`/`venueAddress`) pour un temps fort qui ne se tient pas dans un bar — Game
 * in Reims, un meetup. La contrainte `event_has_venue` interdit qu'il n'y en ait aucun :
 * le rendu public ne doit jamais pouvoir afficher un événement dont on ne sait pas dire
 * où il est (NFR8, garde-fou AU NIVEAU DES DONNÉES et pas seulement du formulaire).
 *
 * ⚠️ Elle teste la LONGUEUR du lieu libre, pas seulement sa présence : `'' IS NOT NULL`
 * est vrai en SQL, si bien qu'un `venue_name` vide aurait satisfait une contrainte
 * naïve. Zod ramène déjà `''` à `null`, mais une écriture qui le contournerait (SQL
 * direct, migration de données, script futur) aurait produit un événement au lieu
 * visuellement vide sans que rien ne le bloque. C'était le cas — corrigé à la revue.
 */
export const event = pgTable(
  "event",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: eventType().notNull().default("thursday"),
    title: text().notNull(),
    /**
     * `ON DELETE SET NULL` et non `CASCADE` : perdre un partenariat avec un bar ne doit
     * pas effacer l'historique des jeudis qui y ont eu lieu. Si l'événement n'avait pas
     * de `venueName`, Postgres refusera la suppression du bar (la contrainte
     * `event_has_venue` serait violée) — c'est le bon signal, plutôt qu'une perte muette.
     */
    barId: uuid().references(() => bar.id, { onDelete: "set null" }),
    venueName: text(),
    venueAddress: text(),
    /**
     * 🔴 `timestamptz`, et UNE SEULE colonne. Deux colonnes (date + heure) rouvriraient
     * le piège de fuseau à chaque lecture, et un `timestamp` nu perdrait l'instant.
     * Construire la valeur avec `parisWallClock()`, jamais avec `new Date('…')`.
     */
    startsAt: timestamp({ withTimezone: true }).notNull(),
    /**
     * Jeux annoncés, en texte libre (« Smash, TFT, Mario Kart »). Volontairement pas un
     * `text[]` : rien ne requête là-dessus, et un tableau imposerait un composant de
     * saisie de liste au back-office (Epic 6) pour aucun bénéfice. Absent → la ligne est
     * masquée à l'affichage plutôt que rendue vide (UX-DR10).
     */
    games: text(),
    description: text(),
    /** Compte-rendu, renseigné APRÈS l'événement (FR5). Nul tant qu'il n'a pas eu lieu. */
    recap: text(),
    /** Défaut `false` : rien n'est public par accident. */
    isPublished: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "event_has_venue",
      sql`${table.barId} is not null or length(btrim(${table.venueName})) > 0`,
    ),
    // Sert la requête « prochaine date à venir » de la 3.2 et les listes de la 3.3 :
    // toutes filtrent sur `is_published` puis ordonnent par `starts_at`.
    index("event_published_starts_at_idx").on(table.isPublished, table.startsAt),
  ],
);

/**
 * Nature du lien entre l'asso et un tiers (Story 4.1).
 *
 * Les valeurs viennent de `src/lib/schemas/partner.ts` — **une seule liste**, même sens de
 * dépendance que `eventType` et pour la même raison (le module Zod est bundlé côté client
 * en Epic 6). Les libellés PUBLICS (« Nos sponsors », « Ils nous soutiennent »…) sont du
 * RENDU et vivent sur `/partenaires` (Story 4.2) : le bandeau de la home n'en affiche
 * aucun, il mélange délibérément toutes les catégories (arbitrage Brice du 2026-07-30).
 */
export const partnerCategory = pgEnum("partner_category", PARTNER_CATEGORIES);

/**
 * Sponsor, partenaire, soutien ou participation (FR13, FR14).
 *
 * 🔴 `logo` EST NULLABLE, ET C'EST LE PIVOT DE TOUT L'EPIC 4.
 * Un partenaire sans logo existe pleinement en base : il est **documenté** sur
 * `/partenaires` (Story 4.2, avec son nom et sa description) et **absent** du bandeau de
 * la home, qui est un bandeau de LOGOS. Arbitrage de Brice du 2026-07-30 : « mieux vaut
 * qu'il ne s'affiche pas en home que d'avoir un placeholder de logo ». Le filtre
 * `logo IS NOT NULL` de `queries/partners.ts` est donc un FILET, pas un mode dégradé
 * nominal — et c'est ce qui a permis de livrer le bandeau sans attendre les 7 fichiers
 * manquants.
 *
 * ⚠️ `logo` PORTE UN CHEMIN, ET C'EST PROVISOIRE PAR CONSTRUCTION (garde-fou E de la 4.1).
 * Aujourd'hui : `/partenaires/<slug>.webp`, servi depuis `apps/vitrine/public/`. Demain
 * (Story 6.5), l'upload écrira dans le volume Docker des médias posé par la Story 4.3.
 * **Ce qui changera alors est la VALEUR écrite, pas la colonne** — aucune migration à
 * prévoir de ce fait. Ne pas contraindre le format ici : ce serait à rouvrir à ce
 * moment-là. Ne jamais y stocker de chemin système absolu.
 *
 * ⚠️ Aucune colonne de DIMENSIONS, et c'est délibéré : le rendu impose la hauteur par la
 * TUILE (`object-fit: contain`), il n'a donc jamais besoin de connaître la taille du
 * fichier à l'avance. La Story 6.5 fera téléverser des fichiers de tailles quelconques
 * par des bénévoles — un montage qui aurait eu besoin de ces dimensions se serait cassé
 * à ce moment-là (garde-fou H de la 4.1).
 */
export const partner = pgTable(
  "partner",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    logo: text(),
    /** Une ligne de contexte (« Présents depuis 2023 »). Rendue sur /partenaires (4.2). */
    description: text(),
    /**
     * Site du partenaire. `null` pour les 11 entrées d'aujourd'hui : aucune source du
     * projet ne porte d'URL, et en inventer une serait pire que de ne pas en avoir.
     * ⚠️ Le schéma Zod exige une URL `http(s)` ABSOLUE — une valeur relative casserait
     * `isExternalUrl()` et ferait annoncer « nouvel onglet » à tort.
     */
    link: text(),
    category: partnerCategory().notNull(),
    /**
     * Classement manuel à l'intérieur d'une catégorie (FR22 : « l'équipe peut classer les
     * logos »). La colonne existe AVANT son écran de saisie (Story 6.5), et c'est un choix
     * assumé : l'ajouter plus tard imposerait une seconde migration sur une table déjà
     * peuplée, pour une colonne dont le contrat est déjà connu.
     */
    sortOrder: integer().notNull().default(0),
    /** Défaut `false` : rien n'est public par accident (patron `event`). */
    isPublished: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * 🔴 GARDES AU NIVEAU DES DONNÉES — MÊME DOCTRINE QUE `event_has_venue` (Story 3.1),
     * et c'est la revue qui a relevé qu'elle n'avait pas été appliquée ici.
     *
     * Le principe est écrit noir sur blanc dans `lib/schemas/event.ts` : « la base est le
     * garde-fou qu'on ne peut pas contourner ; le schéma Zod est celui qui donne un
     * message utilisable à un bénévole ». Le commentaire de `logo` ci-dessus DÉCRIVAIT
     * déjà le défaut à empêcher (« jamais la chaîne vide, qui rendrait un `<img src="">` »)
     * — mais rien ne l'empêchait au niveau de la table.
     *
     * 🔬 Le défaut est concret et il ne passe par aucun formulaire :
     *   `UPDATE partner SET logo = '' WHERE …`
     * est accepté par Postgres ; `'' IS NOT NULL` est VRAI en SQL, donc la ligne remonte
     * dans `getPartnersWithLogo()` et le bandeau de la home rend un `<img src="">` —
     * c'est-à-dire une requête vers la page courante à la place d'un logo. Zod ne protège
     * rien ici : il n'est pas appelé par un `UPDATE` direct, par une restauration de
     * sauvegarde, ni par une migration de données.
     *
     * ⚠️ `btrim` ne retire que les blancs ASCII : ces contraintes attrapent `''` et
     * `'   '`, pas un caractère de largeur nulle. C'est voulu et c'est le bon partage —
     * le cas subtil est traité par `visiblementVide()` côté Zod, au point de saisie, avec
     * un message humain ; la base tient le plancher qu'on ne peut pas contourner.
     */
    check("partner_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "partner_logo_not_blank",
      sql`${table.logo} is null or length(btrim(${table.logo})) > 0`,
    ),
    check(
      "partner_link_not_blank",
      sql`${table.link} is null or length(btrim(${table.link})) > 0`,
    ),
    // Colonnes DANS L'ORDRE OÙ LA REQUÊTE S'EN SERT : elle filtre sur `is_published`,
    // puis ordonne par `category`, puis par `sort_order` (`queries/partners.ts`).
    // ⚠️ `logo IS NOT NULL`, second terme du filtre, n'est PAS dans l'index : un index
    // partiel `WHERE logo IS NOT NULL` serait plus étroit mais ne servirait QUE la
    // requête de la home — celle de /partenaires (4.2) lit toutes les entrées, avec le
    // même tri. Un seul index sert les deux.
    index("partner_published_category_order_idx").on(
      table.isPublished,
      table.category,
      table.sortOrder,
    ),
  ],
);

// Relations déclarées ici pour que les stories de lecture puissent écrire
// `db.query.event.findMany({ with: { bar: true } })` sans retoucher ce fichier.
export const barRelations = relations(bar, ({ many }) => ({
  events: many(event),
}));

export const eventRelations = relations(event, ({ one }) => ({
  bar: one(bar, { fields: [event.barId], references: [bar.id] }),
}));

/** Types inférés du schéma — à consommer par les requêtes et le rendu. */
export type Bar = typeof bar.$inferSelect;
export type NewBar = typeof bar.$inferInsert;
export type Event = typeof event.$inferSelect;
export type NewEvent = typeof event.$inferInsert;
export type EventType = (typeof eventType.enumValues)[number];
export type Partner = typeof partner.$inferSelect;
export type NewPartner = typeof partner.$inferInsert;
export type PartnerCategory = (typeof partnerCategory.enumValues)[number];
