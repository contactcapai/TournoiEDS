// Schéma Drizzle de la vitrine.
//
// 🔴 UNE TABLE PAR STORY, JAMAIS D'ANTICIPATION (règle posée en Story 1.7 et maintenue).
// Une table sans consommateur est une migration qu'il faudra défaire. À venir, chacune
// avec sa story : `member` / `workshop` (Epic 6).
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
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { EVENT_TYPES } from "../../lib/schemas/event";
import { PARTNER_CATEGORIES } from "../../lib/schemas/partner";
// Même sens de dépendance que les deux listes d'enum ci-dessus : la liste des extensions
// autorisées vit dans le module Zod (bundlé côté client en Epic 6), et le schéma Drizzle
// la consomme pour construire son `CHECK`. L'inverse ferait entrer Drizzle dans le
// navigateur. Une seule liste pour Zod, la base et la table de `Content-Type`.
import { EXTENSIONS } from "../../lib/schemas/photo";
import { SOLICITATION_TYPES } from "../../lib/schemas/solicitation";

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

/**
 * Photo de la galerie « la vie de l'asso » (FR15, FR21, Story 4.3).
 *
 * 🔴 `filename` PORTE UN NOM DE FICHIER NU, ET C'EST LA VALEUR LA PLUS DANGEREUSE DU
 * PROJET. Elle est résolue contre le volume Docker des médias par la route de service
 * `/medias/[filename]` : une valeur mal formée serait une **traversée de répertoire**,
 * c'est-à-dire la lecture d'un fichier arbitraire du conteneur — au premier rang duquel
 * `.env.prod`, qui porte la chaîne de connexion Postgres. Ce risque n'existait pas avec
 * un stockage tiers : la révision d'architecture du 2026-07-29 (sortie de Supabase
 * Storage) le crée, et c'est cette story qui le traite.
 *
 * ⚠️ JAMAIS DE CHEMIN, JAMAIS DE DOSSIER, JAMAIS D'ABSOLU — un nom nu et rien d'autre.
 * C'est la même consigne que le commentaire de `partner.logo` (« ne jamais y stocker de
 * chemin système absolu »), mais ici elle est APPLIQUÉE PAR LA BASE et non seulement
 * écrite : `logo` reste volontairement permissif (il désigne aujourd'hui un chemin sous
 * `public/`), `filename` ne peut pas se le permettre.
 *
 * ⚠️ Aucune colonne de DIMENSIONS, délibérément — même raison que `partner.logo` : le
 * cadre impose `aspect-ratio: 4/3` + `object-fit: cover`, le rendu n'a donc jamais besoin
 * de connaître la taille du fichier. La Story 6.4 fera téléverser des fichiers de tailles
 * quelconques par des bénévoles ; un montage qui aurait eu besoin de ces dimensions se
 * casserait à ce moment-là.
 *
 * ⚠️ Aucun enum non plus. La galerie est un flux unique — ne pas inventer une « catégorie
 * de photo » par symétrie avec `partner` (règle de tête de fichier : jamais d'anticipation).
 */
export const photo = pgTable(
  "photo",
  {
    id: uuid().primaryKey().defaultRandom(),
    /**
     * 🔴 `unique()` — UN NOM DE FICHIER DÉSIGNE UNE SEULE PHOTO. Trouvé en revue
     * (Edge Case Hunter) et reproduit : sans cette contrainte, deux lignes d'`id`
     * différents pouvaient porter le même `filename`, et rien ne s'y opposait.
     *
     * Trois conséquences, toutes atteignables dès la Story 6.4 (téléversement par des
     * bénévoles, qui re-téléverseront le même fichier sans le savoir) :
     *   ① la route de service fait un `findFirst` — elle en choisirait une
     *      ARBITRAIREMENT, donc le `is_published` appliqué serait celui d'une ligne
     *      qu'on ne choisit pas. Dépublier « la » photo pourrait ne rien changer,
     *      l'autre ligne continuant de l'autoriser ;
     *   ② la galerie afficherait deux fois la même image ;
     *   ③ supprimer une des deux lignes suggérerait de supprimer le fichier — et
     *      casserait l'autre.
     * Le nom de fichier est l'identifiant du média sur le volume : la base doit le dire.
     */
    filename: text().notNull().unique(),
    /**
     * 🔴 `notNull`, ET C'EST UNE EXTENSION ASSUMÉE DE L'AC D'`epics.md` (qui listait
     * « fichier, légende, event_id, ordre, is_published »). `EXPERIENCE.md` l.194 et
     * **NFR3** posent l'alt-text comme obligatoire et non négociable, et l'AC2 de la
     * story le réexige. Sans colonne dédiée, le back-office de la 6.4 n'aurait aucun
     * endroit où l'exiger et la garde retomberait sur chaque appelant du rendu.
     * ⚠️ La LÉGENDE N'EST PAS UN ALT : « Le stand, plein à craquer » commente, il ne
     * décrit pas. Les confondre livrerait une galerie inutilisable au lecteur d'écran
     * tout en affichant 100/100 — Lighthouse voit un `alt` non vide, pas un `alt` juste.
     */
    alt: text().notNull(),
    /** Légende manuscrite (Caveat, `--ink` sur cream). Facultative. Bornée — voir R24. */
    caption: text(),
    /**
     * 🔴 `ON DELETE SET NULL` et non `CASCADE`, et le raisonnement est PLUS FORT que
     * pour `event.barId` : supprimer un événement ne doit pas effacer les PHOTOS de cet
     * événement. Une photo orpheline reste une photo de la vie de l'asso — elle sort du
     * compte-rendu de `/agenda` et **reste dans la galerie de la home**. Un `CASCADE`
     * détruirait un média que personne ne peut recréer, sur une opération que le
     * back-office (6.3) rendra banale.
     * ⚠️ Nullable AUSSI par conception, pas seulement par conséquence : une photo « de la
     * vie de l'asso » sans occasion précise est un cas nominal. La galerie de la home ne
     * joint donc PAS `event` ; seule `/agenda` joint, dans l'autre sens.
     */
    eventId: uuid().references(() => event.id, { onDelete: "set null" }),
    /** Classement manuel dans la galerie (FR21). Colonne posée avant son écran (6.4). */
    sortOrder: integer().notNull().default(0),
    /** Défaut `false` : rien n'est public par accident (patron `event`, `partner`). */
    isPublished: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * 🔴 LISTE BLANCHE, JAMAIS LISTE NOIRE — et c'est la contrainte la plus importante
     * de ce fichier. Doctrine `event_has_venue` (3.1) puis `partner_*_not_blank` (4.1,
     * après un finding de revue) : la base est le garde-fou qu'on ne peut PAS
     * contourner. Un `UPDATE` direct, une restauration de sauvegarde ou une migration de
     * données ne passent par AUCUN schéma Zod — et ici l'enjeu n'est pas un rendu cassé
     * mais la lecture d'un fichier arbitraire du conteneur.
     *
     * Trois règles, et chacune ferme une porte différente :
     *   ① `^[a-z0-9]` — premier caractère alphanumérique : interdit `.cache`, `-flag`, `..` ;
     *   ② `[a-z0-9._-]*` — corps sans `/`, sans `\`, sans `%`, sans `:` ;
     *   ③ extension dans la liste close de `EXTENSIONS`, en minuscules (`~` est
     *      sensible à la casse en Postgres, donc `.PNG` est refusé).
     *
     * 🔴 `.svg` EST ABSENT, ET CE N'EST PAS UN CHOIX DE FORMAT : un SVG servi `inline`
     * depuis notre propre origine exécute son `<script>` dans le contexte du site —
     * XSS stocké, livré par le formulaire de la 6.4 à un bénévole qui téléverserait un
     * fichier reçu par mail. Next lui-même refuse d'optimiser les SVG sans le drapeau
     * `dangerouslyAllowSVG` ; le nom du drapeau dit tout.
     *
     * 🔴 `\\.` ET NON `\.` — PIÈGE D'ÉCHAPPEMENT À DEUX ÉTAGES, ET IL EST SILENCIEUX.
     * Dans un littéral de gabarit JS, `\.` est un échappement NON RECONNU et s'évalue en
     * `.` : la chaîne remise à Postgres contiendrait donc un point « n'importe quel
     * caractère » au lieu d'un point littéral, et `axjpg` passerait la contrainte. Rien
     * ne le signalerait — ni le typecheck, ni le build, ni un test qui n'essaierait que
     * des noms valides. C'est pourquoi la story exige d'ÉPROUVER ce `CHECK` par des
     * écritures qui doivent ÉCHOUER, dont `axjpg` précisément.
     *
     * ⚠️ Le `!~ '\\.\\.'` est REDONDANT avec ① (un nom ne peut pas commencer par un
     * point) mais il reste : la sécurité de cette valeur ne doit pas dépendre d'un
     * raisonnement à deux détentes que quelqu'un devra retenir dans six mois.
     *
     * 🔴 `sql.raw()` ET NON UNE INTERPOLATION NUE — DÉFAUT MESURÉ À LA GÉNÉRATION.
     * Dans un gabarit `sql\`\``, une valeur interpolée devient un PARAMÈTRE LIÉ. Écrite
     * `sql\`… ~ ${motif}\``, la contrainte est sortie dans le `.sql` sous la forme
     * `CHECK ("photo"."filename" ~ $1 …)` — une migration **invalide**, puisqu'un DDL
     * versionné n'a personne pour lier `$1`. Ni le typecheck ni le build ne l'auraient
     * vu : le seul témoin est le SQL généré, qu'il faut donc LIRE (`pieges/faux-succes.md`).
     * `sql.raw()` inline le texte — les apostrophes SQL sont donc à écrire ici.
     */
    check(
      "photo_filename_safe",
      sql`${table.filename} ~ ${sql.raw(`'^[a-z0-9][a-z0-9._-]*\\.(${EXTENSIONS.join("|")})$'`)} and ${table.filename} !~ '\\.\\.'`,
    ),
    // `alt` est `notNull`, mais `'' IS NOT NULL` est VRAI en SQL : sans ce CHECK, un
    // `UPDATE photo SET alt = ''` produirait une image sans texte alternatif, c'est-à-dire
    // exactement ce que la colonne existe pour empêcher. Même défaut que celui trouvé sur
    // `partner.logo` à la revue de la 4.1.
    check("photo_alt_not_blank", sql`length(btrim(${table.alt})) > 0`),
    /**
     * 🔴 NON VIDE **ET BORNÉE**, ET LA BORNE EST UNE DETTE DÉJÀ PAYÉE (R24).
     *
     * Trouvé en revue (Edge Case Hunter) : la borne de 60 caractères ne vivait que dans
     * `photoInputSchema`, donc uniquement au point de SAISIE. Or un `UPDATE` direct, une
     * restauration de sauvegarde ou un script de migration ne passent par AUCUN schéma
     * Zod — et R24 a été payée sur exactement ce scénario : 299 caractères sans espace
     * en légende ont fait déborder `/agenda` de 32,89px à 320px de viewport,
     * **rogné en silence** par `overflow-x: clip`.
     *
     * `overflow-wrap: anywhere` (posé sur `.cap` par cette story) empêche le
     * DÉBORDEMENT, mais pas une légende de 300 caractères illisible dans un tirage.
     * Les deux gardes ne protègent pas la même chose, et aucune ne remplace celle-ci.
     *
     * ⚠️ Même valeur que Zod (60), délibérément : la base et le schéma expriment ici la
     * MÊME règle en deux langages — c'est le montage de `filename`. Les faire diverger
     * ferait remonter au bénévole une erreur brute du driver là où Zod avait un message.
     */
    check(
      "photo_caption_valide",
      sql`${table.caption} is null or (length(btrim(${table.caption})) > 0 and length(${table.caption}) <= 60)`,
    ),
    // Colonnes DANS L'ORDRE OÙ LA REQUÊTE S'EN SERT : la galerie filtre sur
    // `is_published` puis ordonne par `sort_order` (`queries/photos.ts`).
    index("photo_published_order_idx").on(table.isPublished, table.sortOrder),
    // Sert la lecture PAR ÉVÉNEMENT des vignettes de `/agenda` (R25) : le filtre porte
    // sur `event_id`, et l'ordre sur `sort_order`. Index distinct du précédent — celui-ci
    // ne peut pas servir une recherche par `event_id`, dont il n'a pas la colonne de tête.
    index("photo_event_order_idx").on(table.eventId, table.sortOrder),
  ],
);

/**
 * Nature d'une sollicitation (FR32, Story 5.1).
 *
 * Les valeurs viennent de `src/lib/schemas/solicitation.ts` — même sens de dépendance que
 * `eventType`/`partnerCategory` (le module Zod, bundlé côté client, ne doit jamais importer
 * Drizzle).
 */
export const solicitationType = pgEnum("solicitation_type", SOLICITATION_TYPES);

/**
 * Demande envoyée par un partenaire / une collectivité / une structure sociale via le
 * formulaire de `/partenaires` (FR32, FR36, Story 5.1).
 *
 * 🔴 PREMIÈRE TABLE ÉCRITE PAR UNE REQUÊTE PUBLIQUE NON AUTHENTIFIÉE, ET PREMIÈRE DONNÉE
 * PERSONNELLE DU PROJET (RGPD, NFR5). Les deux CHECK non-blancs (`name`, `email`, `message`)
 * suivent la doctrine `event_has_venue`/`partner_*_not_blank` : la base est le garde-fou qu'on
 * ne peut pas contourner par un `UPDATE`/restauration/migration direct, Zod celui qui donne un
 * message utilisable au visiteur (`lib/schemas/solicitation.ts`).
 *
 * 🔴 `CHECK (consent_given = true)` EST LA GARDE RGPD LA PLUS IMPORTANTE DE CE FICHIER : sans
 * elle, une ligne sans consentement pourrait exister par un chemin qui contourne Zod
 * (restauration de sauvegarde, script de migration, `UPDATE` direct) — exactement le scénario
 * qui a fait passer `UPDATE partner SET logo=''` en revue de la Story 4.1, mais ici sur une
 * donnée personnelle plutôt qu'éditoriale. ⚠️ Conséquence : `default(false)` est de fait
 * INATTEIGNABLE (tout `INSERT` sans `true` explicite échoue au `CHECK`) — voulu, pas un bug.
 */
export const solicitation = pgTable(
  "solicitation",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** « Nom ou structure » (UX-DR14) — un seul champ, pas deux : la source le décrit ainsi. */
    name: text().notNull(),
    /** Email du demandeur, pour pouvoir lui répondre. Jamais notifié automatiquement (Q7). */
    email: text().notNull(),
    requestType: solicitationType().notNull(),
    message: text().notNull(),
    /** `true` requis pour exister en base — voir le `CHECK` ci-dessous. */
    consentGiven: boolean().notNull().default(false),
    /**
     * 🔴 Colonne posée AVANT son écran (Story 6.11, qui marquera « traité »), même précédent
     * que `partner.sortOrder` (posé en 4.1, saisi en 6.5) : évite une 2ᵉ migration sur une
     * table déjà peuplée de données personnelles.
     */
    isProcessed: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // 🔴 Bornées EN PLUS du non-blanc, trouvé en revue (Blind Hunter + Edge Case Hunter) :
    // `message` portait déjà les deux gardes (non-blanc ET borné), mais `name`/`email`
    // n'avaient que la 1ʳᵉ — la même doctrine que les commentaires ci-dessus invoquent
    // (« la base est le garde-fou qu'on ne peut pas contourner ») s'appliquait donc à
    // moitié. Mêmes valeurs que les bornes Zod (120 / 254 — RFC 5321 §4.5.3.1.3).
    check(
      "solicitation_name_valide",
      sql`length(btrim(${table.name})) > 0 and length(${table.name}) <= 120`,
    ),
    check(
      "solicitation_email_valide",
      sql`length(btrim(${table.email})) > 0 and position('@' in ${table.email}) > 0 and length(${table.email}) <= 254`,
    ),
    check(
      "solicitation_message_valide",
      sql`length(btrim(${table.message})) > 0 and length(${table.message}) <= 5000`,
    ),
    check("solicitation_consent_given", sql`${table.consentGiven} = true`),
    // Sert la future liste antéchronologique de la Story 6.11 : colonnes dans l'ordre où la
    // requête s'en servira (filtre puis tri), patron `partner_published_category_order_idx`.
    index("solicitation_processed_created_at_idx").on(table.isProcessed, table.createdAt),
  ],
);

// ════════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION BACK-OFFICE — Auth.js v5 + adaptateur Drizzle (Story 6.1)
// ════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CES TROIS TABLES SONT ÉCRITES ICI ET PAS LAISSÉES À L'ADAPTATEUR — DÉFAUT MESURÉ.
// `@auth/drizzle-adapter` sait construire des tables par défaut (`defineTables`, dans
// `lib/pg.js`). Les utiliser serait un piège silencieux à deux détentes :
//   ① ses colonnes portent des noms EXPLICITES en camelCase (`text("emailVerified")`,
//      `text("userId")`, `text("sessionToken")`) — un nom explicite bat toujours le
//      `casing: "snake_case"` posé en Story 1.7, donc la base mélangerait deux
//      conventions ;
//   ② surtout : `drizzle-kit generate` NE LIT QUE CE FICHIER. Des tables nées à
//      l'intérieur de l'adaptateur n'auraient AUCUNE migration, et l'échec
//      n'apparaîtrait qu'au PREMIER LOGIN (`relation "user" does not exist`) —
//      invisible pour le typecheck, le build et la CI.
// Elles sont donc déclarées ici et passées EXPLICITEMENT :
//   `DrizzleAdapter(db, { usersTable: user, accountsTable: account, sessionsTable: session })`
//
// 🔴 LES CLÉS TS NE SONT PAS LIBRES — ELLES SONT LE CONTRAT D'AUTH.JS, PAS NOTRE STYLE.
// Mesuré dans `lib/pg.js` : `linkAccount` fait `insert(accountsTable).values(data)` où
// `data` est l'objet `AdapterAccount` d'Auth.js, dont les clés suivent la spec OAuth —
// donc `refresh_token`, `access_token`, `expires_at`, `token_type`, `id_token`,
// `session_state` en SNAKE, et `userId` / `providerAccountId` / `sessionToken` en CAMEL.
// ⚠️ « Harmoniser » `refresh_token` en `refreshToken` par souci de cohérence casserait
// l'écriture À L'EXÉCUTION et NON À LA COMPILATION : l'insertion se fait dans du JS déjà
// compilé, à l'intérieur du paquet, hors de portée de notre typecheck.
// Le `casing: "snake_case"` fait le reste : côté BASE, toutes les colonnes sont bien en
// snake_case (`user_id`, `provider_account_id`, `session_token`) — la convention du
// projet est tenue là où elle se voit.
//
// ⚠️ TROIS TABLES, PAS CINQ. `verificationToken` (providers e-mail / magic link) et
// `authenticator` (WebAuthn / passkeys) sont OPTIONNELLES dans le type
// `DefaultPostgresSchema` et n'ont AUCUN consommateur ici — règle de tête de fichier.
// Limite déclarée : ajouter un provider e-mail plus tard exigera `verificationToken`
// ET sa migration.
//
// ⚠️ Aucun `CHECK` de non-blanc ici, contrairement à `partner`/`photo`/`solicitation`.
// Ce n'est pas un oubli : ces tables ne sont JAMAIS écrites par une saisie humaine ni
// rendues au public — elles sont écrites par l'adaptateur à partir de la réponse de
// Discord. Le garde-fou de cette surface est l'ALLOWLIST (`server/auth/config.ts`), qui
// refuse AVANT toute écriture.

/**
 * Compte administrateur. Une seule ligne en pratique (rôle admin unique, FR27), mais la
 * table reste générique : c'est le contrat d'Auth.js, et l'unicité est portée par
 * l'allowlist, pas par le schéma.
 *
 * ⚠️ `email` est NULLABLE : le scope `email` de Discord peut être refusé par
 * l'utilisateur, et un compte Discord sans e-mail vérifié n'en renvoie pas. Le rendre
 * `notNull` ferait échouer la création d'utilisateur au premier login — après le
 * consentement, donc au pire endroit.
 */
export const user = pgTable("user", {
  id: uuid().primaryKey().defaultRandom(),
  name: text(),
  email: text().unique(),
  emailVerified: timestamp({ withTimezone: true }),
  image: text(),
});

/**
 * Lien entre un `user` local et un compte du fournisseur OAuth (ici Discord, et lui seul).
 *
 * 🔴 `providerAccountId` PORTE L'IDENTIFIANT NUMÉRIQUE DISCORD — c'est la valeur sur
 * laquelle l'allowlist se prononce. Jamais le pseudo (il se change en un clic), jamais
 * l'e-mail (il se change aussi).
 *
 * Clé primaire COMPOSITE `(provider, providerAccountId)` : c'est le contrat d'Auth.js —
 * un même compte Discord ne peut pas être lié deux fois.
 */
export const account = pgTable(
  "account",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    // ⚠️ Clés en snake_case IMPOSÉES par la spec OAuth — voir le bloc ci-dessus.
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (table) => [
    // Forme TABLEAU, comme le reste du fichier. L'adaptateur utilise en interne
    // l'ancienne forme objet (`() => ({ compositePk: ... })`), dépréciée en Drizzle 0.45
    // — ne pas la recopier depuis sa source.
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

/**
 * Session en base (et non JWT), conformément à `architecture.md` : « les tables de session
 * vivent dans la base `vitrine` via l'adaptateur Drizzle — une seule source de vérité,
 * sauvegardée par `backup-vitrine.sh` ».
 *
 * Conséquence voulue : une déconnexion SUPPRIME la ligne, donc la session est réellement
 * révoquée côté serveur. Un JWT, lui, resterait valable jusqu'à son expiration.
 *
 * ⚠️ `sessionToken` est un `text` et NON un `uuid` : c'est un jeton opaque généré par
 * Auth.js, dont le format ne nous appartient pas. Le type de l'adaptateur l'interdit
 * d'ailleurs explicitement en `PgUUID`.
 */
export const session = pgTable("session", {
  sessionToken: text().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expires: timestamp({ withTimezone: true }).notNull(),
});

// Relations déclarées ici pour que les stories de lecture puissent écrire
// `db.query.event.findMany({ with: { bar: true } })` sans retoucher ce fichier.
export const barRelations = relations(bar, ({ many }) => ({
  events: many(event),
}));

export const eventRelations = relations(event, ({ one, many }) => ({
  bar: one(bar, { fields: [event.barId], references: [bar.id] }),
  // Sens `event → photos` : c'est celui dont `/agenda` a besoin (une vignette par
  // événement passé, R25). Le sens inverse sert la galerie si elle veut un jour nommer
  // l'occasion ; il ne coûte rien à déclarer et évite de rouvrir ce fichier.
  photos: many(photo),
}));

export const photoRelations = relations(photo, ({ one }) => ({
  event: one(event, { fields: [photo.eventId], references: [event.id] }),
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
export type Photo = typeof photo.$inferSelect;
export type NewPhoto = typeof photo.$inferInsert;
export type Solicitation = typeof solicitation.$inferSelect;
export type NewSolicitation = typeof solicitation.$inferInsert;
export type SolicitationType = (typeof solicitationType.enumValues)[number];
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Account = typeof account.$inferSelect;
export type Session = typeof session.$inferSelect;
