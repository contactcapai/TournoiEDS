// Schéma Drizzle de la vitrine.
//
// 🔴 UNE TABLE PAR STORY, JAMAIS D'ANTICIPATION (règle posée en Story 1.7 et maintenue).
// Une table sans consommateur est une migration qu'il faudra défaire. À venir, chacune
// avec sa story : `partner` (4.1), `achievement` (4.3), `photo` (4.4), `member` (4.8),
// `workshop` (4.9), `solicitation` (5.1).
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
import { boolean, check, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Nature d'un événement. Identifiants techniques en anglais, comme les tables ; les
 * libellés publics (« Hebdo », « Temps fort ») sont du RENDU et vivent dans la 3.2.
 */
export const eventType = pgEnum("event_type", ["thursday", "special"]);

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
    check("event_has_venue", sql`${table.barId} is not null or ${table.venueName} is not null`),
    // Sert la requête « prochaine date à venir » de la 3.2 et les listes de la 3.3 :
    // toutes filtrent sur `is_published` puis ordonnent par `starts_at`.
    index("event_published_starts_at_idx").on(table.isPublished, table.startsAt),
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
