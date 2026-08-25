// Schéma Drizzle de la vitrine.
//
// 🔴 UNE TABLE PAR STORY, JAMAIS D'ANTICIPATION (règle posée en Story 1.7 et maintenue).
// Une table sans consommateur est une migration qu'il faudra défaire. À venir, avec sa
// story : `site_setting` (Story 6.13).
// ⚠️ `workshop` (6.9) et `member` (6.10) naissent AVEC leur écran de saisie. Conséquence
// visible plus bas : leurs `CHECK` de non-blanc ET de plafond sont dans leur migration
// INITIALE (`0010`, `0011`), là où `event`/`bar` (`0006`), `photo.alt` (`0008`) et `partner`
// (`0009`) ont chacune payé une migration de RATTRAPAGE.
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
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ROLES_ADMIN } from "../../lib/roles";

// ⚠️ `TARIF_MAX` EST ALIASÉ ICI AUSSI (Story 9.6) : `tournament.ts` en exporte un, propre à SON
// domaine, et les importer nus serait une collision que TypeScript refuserait. La parade est
// celle des trois blocs ci-dessous — **aliaser, jamais fusionner** —, et le bloc d'import de
// `tournament.ts` l'annonçait mot pour mot avant que le cas n'arrive.
import {
  BAR_ADRESSE_MAX,
  BAR_NOM_MAX,
  BAR_QUARTIER_MAX,
  BAR_VILLE_MAX,
  DESCRIPTION_MAX,
  EVENT_TYPES,
  JEUX_MAX,
  LIEU_ADRESSE_MAX,
  LIEU_NOM_MAX,
  RECAP_MAX,
  TARIF_MAX as EVENT_TARIF_MAX,
  TITRE_MAX,
} from "../../lib/schemas/event";
// ⚠️ ALIAS OBLIGATOIRES : `event.ts` exporte DÉJÀ un `DESCRIPTION_MAX` (celui d'un événement),
// importé quelques lignes plus haut. Deux domaines, deux bornes, un seul fichier qui les voit :
// les importer nus ferait une collision de nom que TypeScript refuserait — et les fusionner en
// une constante « commune » serait pire, puisqu'ajuster la borne d'un événement changerait
// alors celle d'un partenaire. Chaque domaine garde SA borne ; c'est ici, et ici seulement,
// qu'elles se croisent.
import {
  DESCRIPTION_MAX as PARTNER_DESCRIPTION_MAX,
  LINK_MAX as PARTNER_LINK_MAX,
  LOGO_MAX as PARTNER_LOGO_MAX,
  NAME_MAX as PARTNER_NAME_MAX,
  PARTNER_CATEGORIES,
} from "../../lib/schemas/partner";
import { LOGO_EXTENSION, PREFIXE_LOGO } from "../../lib/logos";
import { PORTRAIT_EXTENSION, PREFIXE_PORTRAIT } from "../../lib/portraits";
// ⚠️ ALIAS OBLIGATOIRES, MÊME MOTIF QUE POUR `partner` ET `workshop` : `member.ts` exporte
// des bornes dont les noms nus (`PRENOM_MAX`, `ROLE_MAX`, `PORTRAIT_MAX`) sont propres à SON
// domaine. Les fusionner avec celles d'un autre domaine serait pire qu'une collision :
// ajuster la borne d'un rôle changerait alors celle d'un titre d'événement.
import {
  PORTRAIT_MAX as MEMBER_PORTRAIT_MAX,
  PRENOM_MAX as MEMBER_PRENOM_MAX,
  ROLE_MAX as MEMBER_ROLE_MAX,
} from "../../lib/schemas/member";
// Même sens de dépendance que les deux listes d'enum ci-dessus : la liste des extensions
// autorisées vit dans le module Zod (bundlé côté client en Epic 6), et le schéma Drizzle
// la consomme pour construire son `CHECK`. L'inverse ferait entrer Drizzle dans le
// navigateur. Une seule liste pour Zod, la base et la table de `Content-Type`.
import { EXTENSIONS } from "../../lib/schemas/photo";
import { EMAIL_MAX, MOTIF_EMAIL_SQL, URL_MAX } from "../../lib/schemas/site-setting";
import { SOLICITATION_TYPES } from "../../lib/schemas/solicitation";
// 🔴 CE BLOC DISAIT « AUCUN ALIAS ICI, ET C'EST UNE MESURE » JUSQU'AU 2026-08-14 — LE JOUR
// ANNONCÉ EST ARRIVÉ (Story 9.6). Il ajoutait : *« Le jour où une collision apparaîtra, la parade
// est celle des trois blocs ci-dessus — aliaser, jamais fusionner deux bornes de domaines
// différents. »* `TARIF_MAX` existe désormais des DEUX côtés (un tarif d'événement et un tarif de
// tournoi sont deux objets éditoriaux distincts, saisis dans deux écrans différents), et les deux
// sont donc **aliasés** — `EVENT_TARIF_MAX` et `TOURNAMENT_TARIF_MAX`. Les fusionner ferait
// qu'ajuster le tarif d'un jeudi changerait celui d'un tournoi.
// ✅ Le constat d'origine reste vrai pour TOUTES LES AUTRES bornes du domaine « tournoi », et il
// avait été mesuré : `NOM_MAX` cohabite avec `TITRE_MAX`/`BAR_NOM_MAX`/`PRENOM_MAX`, `JEU_MAX`
// avec `JEUX_MAX`, `LIEU_MAX` avec `LIEU_NOM_MAX` — un seul alias sur douze imports.
// ⚠️ `URL_MAX` n'est PAS réimportée : `tournament.ts` consomme et ré-exporte celle de
// `site-setting.ts` (une URL saisie par un bénévole est le même objet des deux côtés), et elle
// est déjà importée quelques lignes plus haut. Deux imports du même symbole seraient une
// collision inutile ; deux bornes distinctes seraient bien pire.
import {
  DUREE_MATCH_MAX,
  FORMAT_MAX,
  IDENTIFIANT_MAX,
  JEU_MAX,
  LIEU_MAX,
  LOTS_MAX,
  MOTIF_IDENTIFIANT_SQL,
  NOM_MAX,
  PLACES_MAX,
  PODIUM_MAX,
  REGISTRATION_MODES,
  REGISTRATION_STATES,
  TARIF_MAX as TOURNAMENT_TARIF_MAX,
} from "../../lib/schemas/tournament";
import {
  ENTRY_STATES,
  MATCH_BRACKETS,
  MATCH_STATES,
  PHASE_KINDS,
  PHASE_STATES,
} from "../../lib/tournoi/structure";
// ⚠️ ALIAS OBLIGATOIRES, MÊME MOTIF QUE POUR `partner` CI-DESSUS : `event.ts` exporte déjà un
// `TITRE_MAX` (celui d'un événement, 80 lui aussi — mais par COÏNCIDENCE d'alignement sur son
// propre rendu, pas parce que ce serait la même règle). Les importer nus ferait une collision
// que TypeScript refuserait ; les fusionner serait pire, puisqu'ajuster la troncature de
// `/agenda` changerait alors la borne d'un atelier. Chaque domaine garde SA borne.
import {
  PUBLIC_MAX as WORKSHOP_PUBLIC_MAX,
  RESUME_MAX as WORKSHOP_RESUME_MAX,
  TITRE_MAX as WORKSHOP_TITRE_MAX,
  WORKSHOP_FAMILIES,
} from "../../lib/schemas/workshop";

/**
 * Nature d'un événement. Valeurs en anglais ; les libellés publics (« Hebdo », « Temps
 * fort ») sont du RENDU et vivent dans la 3.2.
 *
 * ⚠️ CETTE PHRASE DISAIT « identifiants techniques en anglais, COMME LES TABLES » jusqu'au
 * 2026-08-04, et elle énonçait une règle que le projet ne suit pas. **Mesuré au cadrage de la
 * Story 6.9** : sur les quatre enums du fichier, **trois sont en français** —
 * `partner_category` (`partenaire`, `soutien`, `participation`), `solicitation_type`
 * (`animation`, `partenariat`, `autre`) et `workshop_family` (`atelier`, `sensibilisation`,
 * `evenement`). `event_type` est le seul en anglais. La convention réelle est donc : **la
 * langue du DOMAINE**, l'anglais restant pour ce qui n'a pas de nom métier français évident.
 * Corrigé à la source plutôt que contourné en silence — une story qui aurait suivi la règle
 * telle qu'elle était écrite aurait fabriqué la seule incohérence du fichier
 * (`00 référence/pieges/avertissement-commentaire.md`).
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
export const bar = pgTable(
  "bar",
  {
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
  },
  (table) => [
    /**
     * 🔴 GARDES AU NIVEAU DES DONNÉES — POSÉES PAR LA STORY 6.3, EN MÊME TEMPS QUE
     * L'ÉCRAN QUI ÉCRIT CETTE TABLE.
     *
     * Cette table n'en portait AUCUNE jusqu'au 2026-08-03, alors que `partner`, `photo`
     * et `solicitation` en portent trois à quatre chacune. Ce n'était pas un oubli de
     * doctrine mais une conséquence de la règle de tête de fichier : `bar` n'avait pas
     * encore de surface de saisie. Elle en a une maintenant.
     *
     * `notNull` ne suffit pas : `'' IS NOT NULL` est **vrai** en SQL, donc un
     * `UPDATE bar SET name = ''` produirait un bar sans nom — rendu en toutes lettres sur
     * la carte du hub et sur `/agenda`. Zod ne protège rien ici : il n'est appelé ni par
     * un `UPDATE` direct, ni par une restauration de sauvegarde, ni par une migration.
     *
     * ⚠️ LES BORNES VIENNENT DE `lib/schemas/event.ts`, PAS DE LITTÉRAUX RECOPIÉS — la
     * base et Zod expriment ici la MÊME règle en deux langages, et les faire diverger
     * remonterait au bénévole une erreur brute du driver là où Zod avait un message.
     * 🔴 `sql.raw()` EST OBLIGATOIRE POUR CES NOMBRES : dans un gabarit `sql``, une valeur
     * interpolée devient un PARAMÈTRE LIÉ, et la contrainte sortirait dans le `.sql` sous
     * la forme `length(...) <= $1` — un DDL versionné **invalide**, puisque personne n'est
     * là pour lier `$1`. Défaut mesuré à la génération en Story 4.3 ; ni le typecheck ni
     * le build ne le voient, le seul témoin est le SQL généré.
     */
    check(
      "bar_name_valide",
      sql`length(btrim(${table.name})) > 0 and length(${table.name}) <= ${sql.raw(String(BAR_NOM_MAX))}`,
    ),
    check(
      "bar_address_valide",
      sql`length(btrim(${table.address})) > 0 and length(${table.address}) <= ${sql.raw(String(BAR_ADRESSE_MAX))}`,
    ),
    check(
      "bar_district_valide",
      sql`length(btrim(${table.district})) > 0 and length(${table.district}) <= ${sql.raw(String(BAR_QUARTIER_MAX))}`,
    ),
    check(
      "bar_city_valide",
      sql`length(btrim(${table.city})) > 0 and length(${table.city}) <= ${sql.raw(String(BAR_VILLE_MAX))}`,
    ),
  ],
);

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
     * 🔴 L'HEURE DE FIN **ANNONCÉE** — FACULTATIVE, ET C'EST LE LIVRABLE (Story 9.6, dette R56).
     *
     * *« Jusqu'à quelle heure on vous attend. »* Un jeudi en bar n'en a pas (« on reste tant
     * qu'on veut ») ; un temps fort en a une. L'exiger forcerait le bénévole à **inventer** une
     * heure — c'est-à-dire le défaut qu'on corrige, retourné.
     *
     * ⚠️ **UNE SEULE COLONNE `timestamptz`, jamais une durée en minutes.** Une durée obligerait
     * chaque lecture à refaire une arithmétique de calendrier, et se tromperait aux changements
     * d'heure de fin mars et fin octobre — précisément ce que `parisWallClock` existe pour
     * absorber. Et une fin après minuit doit pouvoir tomber **le lendemain** : c'est le cas
     * nominal d'une soirée, pas un cas limite.
     * ⚠️ Construire la valeur avec `parisWallClockFromInput`, **jamais** avec `new Date('…')`.
     */
    endsAt: timestamp({ withTimezone: true }),
    /**
     * Le **tarif annoncé**, en toutes lettres (Story 9.6, dette R55).
     *
     * 🔴 UN TEXTE ET NON UN MONTANT — même arbitrage que `tournament.formatText` : « 5 € sur
     * place, 3 € en prévente » n'est pas un décimal. Le raisonnement complet, la borne et le
     * point sur **FR16** vivent dans `lib/schemas/event.ts` (`TARIF_MAX`).
     * ⚠️ **`NULL` NE VEUT PAS DIRE « GRATUIT »**, et c'est la règle la plus facile à casser au
     * rendu : absent ⇒ la ligne **disparaît**. Déduire une gratuité d'une absence serait
     * affirmer un fait qu'on n'a pas — la famille de la dette R48.
     */
    priceText: text(),
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
    /**
     * Quand cet événement a été **annoncé sur les réseaux** (Story 6.7, FR23). `NULL` = jamais.
     *
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 CETTE COLONNE EST LE **SEUL FILET** D'UN MAILLON DONT L'EFFET EST HORS DU SITE
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * `00 référence/pieges/integration-tierce.md`, règle ③ : *« tant que le verify d'entrée est
     * dû, la surface de LECTURE n'est pas un confort : c'est le seul filet du système. »* Un
     * clic sur « Annoncer sur les réseaux » produit son effet **ailleurs** — dans n8n, puis, un
     * jour, sur des comptes sociaux. Sans trace, un bénévole n'a **aucun moyen** de savoir si
     * son geste a porté, et le seul recours serait de recliquer : c'est-à-dire de risquer une
     * **deuxième annonce publique** que ce back-office ne sait pas dépublier.
     *
     * 🔴 **ELLE N'EST PAS UN VERROU.** Une seconde annonce reste possible, et c'est voulu :
     * republier après une correction est un besoin légitime. Ce qu'on refuse, c'est qu'un
     * doublon soit **invisible** — même arbitrage que la fermeture de **R31** sur les
     * sollicitations (« acceptée AVEC FILET », pas corrigée). L'écran rappelle donc la date de
     * la précédente annonce **dans la confirmation**, au moment où la décision se prend.
     *
     * ⚠️ Horodatée **uniquement sur succès**. Un échec de transport ne l'écrit pas : une trace
     * posée sur un envoi qui n'est pas parti est pire que pas de trace du tout — elle
     * empêcherait précisément le geste qu'il faut refaire.
     *
     * ⚠️ **AUCUNE colonne de texte d'annonce, de brouillon, ni de statut par réseau.** La
     * composition du message vit dans n8n, qui est l'outil dont c'est le métier et le seul
     * endroit où elle s'ajuste sans redéploiement. Ce que le site envoie, ce sont des **faits**
     * (voir `lib/schemas/publication.ts`). L'absence est une garde, tenue par `gate:reseaux` ⑧.
     *
     * ⚠️ Pas de `CHECK` : il n'y a aucune règle à tenir qu'un `timestamptz` ne tienne déjà.
     * Interdire une date future serait une garde nominale — l'horloge du conteneur et celle de
     * Postgres peuvent différer de quelques secondes, et le refus se produirait au pire moment.
     */
    socialPostedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * 🔴 CORRIGÉE LE 2026-08-03 (Story 6.3) — ELLE NE TENAIT PAS, ET C'EST MESURÉ.
     *
     * Version d'origine (Story 3.1) :
     *   `bar_id is not null or length(btrim(venue_name)) > 0`
     *
     * Avec `bar_id` ET `venue_name` tous deux `NULL` — c'est-à-dire le cas EXACT que cette
     * contrainte existe pour interdire — elle s'évaluait à :
     *   `FALSE  OR  NULL`  →  **NULL**
     * et **un `CHECK` qui vaut `NULL` PASSE** (logique ternaire SQL : il n'échoue que sur
     * `FALSE`). Mesuré le 2026-08-03 par la porte `gate:agenda` :
     *   `INSERT INTO event (title, starts_at) VALUES ('…', now())`  →  **accepté**.
     *
     * ⚠️ Ce que ça voulait dire concrètement : depuis la Story 3.1, la garde décrite
     * ci-dessous comme empêchant « le rendu public d'afficher un événement dont on ne sait
     * pas dire où il est » ne l'empêchait PAS. Zod l'attrapait (`.refine()`), donc aucune
     * saisie ne pouvait produire ce cas — mais Zod est justement ce que la doctrine de ce
     * fichier dit de NE PAS considérer comme le garde-fou : un `UPDATE` direct, une
     * restauration de sauvegarde ou une migration de données passaient au travers.
     * `coalesce(…, 0)` referme le trou : `FALSE OR FALSE` → `FALSE` → refus.
     *
     * 🔴 LEÇON TRANSPOSABLE À TOUTE CONTRAINTE FUTURE : dès qu'un `CHECK` combine DEUX
     * colonnes NULLABLES, il faut le rendre explicitement null-safe. Les autres contraintes
     * du fichier n'ont pas ce défaut, et pour deux raisons distinctes — soit leur colonne
     * est `notNull` (`title`, `alt`, `name`…), soit elles portent une branche `is null`
     * explicite (`partner_logo_not_blank`, `photo_caption_valide`). Vérifié une par une.
     *
     * Le rendu, lui, traite déjà les deux branches sans rien supposer (`cleanText`, ligne
     * masquée quand aucun lieu n'est nommable) : c'est ce qui a fait que ce défaut n'a
     * jamais rien cassé à l'écran, et donc que rien ne l'a signalé pendant trois epics.
     */
    check(
      "event_has_venue",
      sql`${table.barId} is not null or coalesce(length(btrim(${table.venueName})), 0) > 0`,
    ),
    /**
     * 🔴 GARDES DE TEXTE — POSÉES PAR LA STORY 6.3, avec l'écran qui écrit cette table.
     *
     * Jusqu'au 2026-08-03 `event` ne portait QUE `event_has_venue` : le lieu était le seul
     * champ dont l'absence était impensable, parce qu'il était le seul dont l'absence
     * cassait le rendu. Les autres n'avaient pas de saisie humaine — ils l'ont maintenant.
     *
     * Même partage que partout ailleurs dans ce fichier : **la base est le garde-fou qu'on
     * ne peut pas contourner** (`UPDATE` direct, restauration, migration de données),
     * **Zod est celui qui parle au bénévole** (`lib/schemas/event.ts`, d'où viennent ces
     * bornes — jamais recopiées ici, voir le bloc de `bar` pour le pourquoi du `sql.raw()`).
     *
     * ⚠️ `event_venue_name_valide` NE FAIT PAS DOUBLON avec `event_has_venue` : celle-ci
     * autorise un `venue_name` **absent** quand un `bar_id` est présent, mais rien
     * n'empêchait alors d'y mettre `'   '`. Les deux contraintes ferment des portes
     * différentes.
     * ⚠️ `btrim` ne retire que les blancs ASCII : le caractère de largeur nulle est traité
     * côté Zod, au point de saisie, avec un message humain. Partage assumé, identique à
     * celui de `partner`.
     *
     * 🔴 CETTE PHRASE ÉTAIT FAUSSE JUSQU'AU 2026-08-03, ET C'EST LA REVUE QUI L'A DIT.
     * `partner.ts` et `photo.ts` consommaient bien `visiblementVide`, mais **`event.ts` ne
     * l'a jamais fait** : un `venue_name` composé uniquement de caractères invisibles
     * passait le `.refine()` de Zod **et** ce `CHECK` (`btrim` ne les retire pas), donc un
     * événement sans bar et sans lieu lisible était créable et publiable. Le commentaire
     * décrivait une garde qui n'existait pas — exactement ce que
     * `pieges/avertissement-commentaire.md` recense. `event.ts` porte désormais la garde,
     * et la phrase ci-dessus est vraie.
     */
    check(
      "event_title_valide",
      sql`length(btrim(${table.title})) > 0 and length(${table.title}) <= ${sql.raw(String(TITRE_MAX))}`,
    ),
    check(
      "event_games_valide",
      sql`${table.games} is null or (length(btrim(${table.games})) > 0 and length(${table.games}) <= ${sql.raw(String(JEUX_MAX))})`,
    ),
    check(
      "event_description_valide",
      sql`${table.description} is null or (length(btrim(${table.description})) > 0 and length(${table.description}) <= ${sql.raw(String(DESCRIPTION_MAX))})`,
    ),
    check(
      "event_recap_valide",
      sql`${table.recap} is null or (length(btrim(${table.recap})) > 0 and length(${table.recap}) <= ${sql.raw(String(RECAP_MAX))})`,
    ),
    check(
      "event_venue_name_valide",
      sql`${table.venueName} is null or (length(btrim(${table.venueName})) > 0 and length(${table.venueName}) <= ${sql.raw(String(LIEU_NOM_MAX))})`,
    ),
    check(
      "event_venue_address_valide",
      sql`${table.venueAddress} is null or (length(btrim(${table.venueAddress})) > 0 and length(${table.venueAddress}) <= ${sql.raw(String(LIEU_ADRESSE_MAX))})`,
    ),
    check(
      "event_price_text_valide",
      sql`${table.priceText} is null or (length(btrim(${table.priceText})) > 0 and length(${table.priceText}) <= ${sql.raw(String(EVENT_TARIF_MAX))})`,
    ),
    /**
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 LA FIN EST APRÈS LE DÉBUT — ET LA NULL-SAFETY N'EST **PAS** CELLE D'`event_has_venue`
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * Le réflexe, sur ce fichier, est d'ajouter un `coalesce` : trois contraintes le portent, et
     * `event_has_venue` a survécu **trois epics et sept portes vertes** faute de l'avoir. **Ici
     * il serait inutile, et le croire nécessaire ferait écrire une garde qui ne garde rien.**
     *
     * Le membre à surveiller est celui qui peut valoir `NULL` :
     *   · `ends_at is null` rend **toujours** un booléen — jamais `NULL` ;
     *   · `ends_at > starts_at` ne vaut `NULL` que si l'un des deux est `NULL`. Or **`starts_at`
     *     est `notNull`** : le seul cas est donc `ends_at IS NULL`, que la branche de gauche a
     *     **déjà** court-circuité.
     * ⇒ La contrainte est **null-safe par construction**, exactement comme
     * `tournament_podium_sans_trou_2`. C'est la seule famille de ce fichier qui n'a pas à se
     * poser la question, et le dire évite qu'on la « complète » par mimétisme.
     * ⚠️ **Ce raisonnement TOMBE si `starts_at` cessait d'être `notNull`.** Il ne le sera pas —
     * un rendez-vous sans date n'existe pas — mais la dépendance est écrite plutôt que supposée.
     *
     * ⚠️ **L'ÉGALITÉ EST REFUSÉE** (`>` et non `>=`) : un rendez-vous qui finit à la minute où il
     * commence n'est pas un rendez-vous, c'est une saisie ratée — le plus souvent la date de
     * début recopiée telle quelle dans le second champ.
     *
     * 🔴 ET ÇA NE SE MESURE **PAS** PAR UNE ÉCRITURE — leçon `gate:ateliers` ⑧ : la contre-épreuve
     * « écrire une ligne à `NULL` » reste **VERTE** sur une contrainte cassée, parce que le défaut
     * la rend aveugle par construction. Le seul témoin est une garde qui **LIT le texte de la
     * contrainte** (`pg_get_constraintdef`), et `gate:agenda` en porte une.
     */
    check("event_fin_apres_debut", sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`),
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
 * ⚠️ `logo` PORTE UN CHEMIN, ET **DEUX FORMES COEXISTENT DEPUIS LA STORY 6.5** :
 *   · `/partenaires/<slug>.webp` — les 4 logos semés par la 4.1, servis en statique depuis
 *     `apps/vitrine/public/`, **versionnés dans git**, donc NON supprimables par le
 *     back-office ;
 *   · `/medias/logos/<uuid>.webp` — les logos téléversés, sur le volume Docker.
 * La distinction est écrite **une seule fois**, dans `src/lib/logos.ts` : trois appelants en
 * dépendent, dont deux qui DÉTRUISENT un fichier.
 *
 * 🔴 ET LE FORMAT EST DÉSORMAIS CONTRAINT. Ce commentaire disait « ne pas contraindre le
 * format ici : ce serait à rouvrir au moment où la Story 6.5 écrira dans cette colonne ».
 * **Nous y sommes**, et c'était le moment prévu : cette valeur cesse d'être un chemin relu
 * par un humain dans un seed pour devenir celle à partir de laquelle un **chemin disque** est
 * construit. Voir `partner_logo_valide` plus bas et `LOGO_MOTIF` dans `lib/schemas/partner.ts`.
 * ⚠️ **Ce qui a changé est bien la VALEUR écrite, pas la colonne** : la migration `0009`
 * n'ajoute aucune colonne, seulement des contraintes. Ne jamais y stocker de chemin absolu.
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
     * Site du partenaire.
     * ⚠️ CORRIGÉ LE 2026-08-04 (Story 6.5) : ce commentaire disait « `null` pour les 11
     * entrées d'aujourd'hui ». MESURÉ en base : **les 11 portent un lien**, semé par le
     * commit `64aad1a` de la Story 4.2 — des placeholders `exemple-*.fr`, un domaine qui ne
     * résout pas, précisément pour qu'ils ne soient pas pris pour de vraies URL. Ils sont à
     * remplacer par l'équipe via le back-office (Story 6.5).
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
    /**
     * 🔴 LES BORNES SONT AJOUTÉES PAR LA STORY 6.5 (migration `0009`), ET LES TROIS
     * CONTRAINTES SONT RENOMMÉES `*_valide` — même geste que la `0006` sur `event`/`bar` et
     * la `0008` sur `photo.alt`. Mesuré au cadrage : cette table ne portait AUCUNE borne de
     * longueur, ni ici ni dans Zod (`name.max(120)` était la seule).
     *
     * ⚠️ LE RENOMMAGE N'EST PAS COSMÉTIQUE : `CHAMP_PAR_CONTRAINTE` (dans
     * `server/actions/partenaires.ts`) traduit un nom de contrainte en nom de champ lisible.
     * Garder `*_not_blank` alors que la contrainte s'appelle désormais `*_valide` ferait
     * retomber le bénévole sur un message générique qui ne nomme aucun champ — c'est
     * exactement le défaut trouvé en revue de la 6.3, où huit contraintes sur dix y tombaient.
     *
     * ⚠️ Les bornes viennent de `lib/schemas/partner.ts`, jamais d'un littéral recopié : la
     * base et Zod expriment la MÊME règle.
     *
     * ⚠️ `btrim` ne retire que les blancs ASCII : ces contraintes attrapent `''` et `'   '`,
     * pas un caractère de largeur nulle. C'est voulu et c'est le bon partage — le cas subtil
     * est traité par `visiblementVide()` côté Zod, au point de saisie, avec un message humain ;
     * la base tient le plancher qu'on ne peut pas contourner.
     */
    check(
      "partner_name_valide",
      sql`length(btrim(${table.name})) > 0 and length(${table.name}) <= ${sql.raw(String(PARTNER_NAME_MAX))}`,
    ),
    check(
      "partner_description_valide",
      sql`${table.description} is null or (length(btrim(${table.description})) > 0 and length(${table.description}) <= ${sql.raw(String(PARTNER_DESCRIPTION_MAX))})`,
    ),
    check(
      "partner_link_valide",
      sql`${table.link} is null or (length(btrim(${table.link})) > 0 and length(${table.link}) <= ${sql.raw(String(PARTNER_LINK_MAX))})`,
    ),
    /**
     * 🔴 LA SEULE CONTRAINTE DE CETTE TABLE DONT L'ENJEU N'EST PAS UN RENDU CASSÉ.
     *
     * ⚠️ Le commentaire de `logo` ci-dessus annonçait, depuis la Story 4.1, qu'on ne
     * contraindrait pas la forme « avant que la Story 6.5 n'écrive dans cette colonne ».
     * **Nous y sommes** : cette valeur cesse d'être un chemin relu par un humain dans un seed
     * pour devenir celle à partir de laquelle un **chemin disque** est construit.
     *
     * Liste blanche, jamais liste noire — doctrine `photo_filename_safe` (4.3), reprise mot
     * pour mot, avec deux préfixes autorisés et **une seule extension** (`.webp` : la
     * normalisation de cette story ré-encode tout, et les 4 fichiers semés le sont déjà).
     *
     * 🔴 `sql.raw()` ET NON UNE INTERPOLATION NUE — défaut mesuré à la génération en 4.3.
     * Dans un gabarit `sql``, une valeur interpolée devient un PARAMÈTRE LIÉ : la contrainte
     * sortirait dans le `.sql` sous la forme `CHECK (… ~ $1)`, une migration **invalide** —
     * un DDL versionné n'a personne pour lier `$1`. Ni le typecheck ni le build ne le
     * verraient ; le seul témoin est le SQL généré, qu'il faut donc LIRE.
     *
     * 🔴 `\\.` ET NON `\.` — piège d'échappement à deux étages, et il est SILENCIEUX. Dans un
     * littéral de gabarit JS, `\.` est un échappement non reconnu et s'évalue en `.` : la
     * chaîne remise à Postgres porterait un point « n'importe quel caractère », et
     * `/partenaires/axwebp` passerait. D'où l'exigence d'ÉPROUVER ce `CHECK` par des écritures
     * qui doivent ÉCHOUER.
     */
    check(
      "partner_logo_valide",
      sql`${table.logo} is null or (length(${table.logo}) <= ${sql.raw(String(PARTNER_LOGO_MAX))} and ${table.logo} ~ ${sql.raw(`'^(${PREFIXE_LOGO}|/partenaires/)[a-z0-9][a-z0-9._-]*\\.${LOGO_EXTENSION}$'`)} and ${table.logo} !~ '\\.\\.')`,
    ),
    /**
     * 🔴 UNICITÉ DU LOGO — ELLE PROTÈGE LA **SUPPRESSION**, PAS L'AFFICHAGE.
     *
     * Sans elle, deux partenaires peuvent référencer le même fichier du volume. Supprimer le
     * premier détruirait alors le logo du second, qui afficherait un cadre vide sur la home
     * sans que rien ne relie l'effet à sa cause. Le back-office de cette story ne peut pas
     * produire ce cas (chaque téléversement génère son propre UUID) — mais une restauration
     * partielle ou un `UPDATE` direct, si.
     *
     * ⚠️ Postgres autorise **plusieurs `NULL`** dans un index unique : les 7 entrées sans logo
     * d'aujourd'hui ne se gênent pas, et une 8ᵉ ne les gênera pas non plus. C'est ce qui rend
     * cette contrainte posable sur une colonne nullable sans rien casser.
     */
    uniqueIndex("partner_logo_unique").on(table.logo),
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
    /**
     * 🔴 NON VIDE **ET BORNÉE** — LE PLAFOND EST AJOUTÉ PAR LA STORY 6.4 (migration `0008`).
     *
     * `alt` est `notNull`, mais `'' IS NOT NULL` est VRAI en SQL : sans la moitié « non
     * vide », un `UPDATE photo SET alt = ''` produirait une image sans texte alternatif,
     * c'est-à-dire exactement ce que la colonne existe pour empêcher (même défaut que
     * celui trouvé sur `partner.logo` à la revue de la 4.1).
     *
     * 🔴 LA MOITIÉ MANQUANTE ÉTAIT LE PLAFOND, ET L'ASYMÉTRIE ÉTAIT MESURABLE : `caption`
     * est bornée des DEUX côtés depuis la 4.3 (`.max(60)` en Zod **et**
     * `photo_caption_valide`), tandis qu'`alt` l'était à 300 dans Zod et **nulle part en
     * base**. C'est très exactement ce que la Story 6.3 a corrigé sur `event` et `bar`
     * (migration `0006`, neuf contraintes de la forme
     * `length(btrim(x)) > 0 and length(x) <= N`), et pour le motif écrit trois fois dans
     * ce fichier : *la base est le garde-fou qu'on ne peut pas contourner ; Zod est celui
     * qui parle au bénévole*. Un `UPDATE` direct, une restauration ou un script de
     * migration ne passent par AUCUN schéma Zod — et la 6.4 est précisément la story qui
     * fait entrer de la donnée de bénévole dans cette colonne.
     *
     * ⚠️ MÊME FORME QUE LES NEUF DE LA `0006`, pas une dixième inventée ici. Le nom change
     * (`photo_alt_not_blank` → `photo_alt_valide`) parce que la contrainte ne dit plus la
     * même chose ; le traducteur d'erreurs de `server/actions/galerie.ts` porte donc le
     * NOUVEAU nom, sinon le bénévole retombe sur un message qui ne nomme aucun champ
     * (défaut trouvé en revue de la 6.3, où huit contraintes sur dix y tombaient).
     *
     * ⚠️ LIMITE DÉCLARÉE ET ASSUMÉE : `btrim` ne retire pas U+200B (leçon de la 6.3), donc
     * un `alt` fait de caractères invisibles franchit ce `CHECK`. Zod le refuse
     * (`visiblementVide`), et **les neuf contraintes de la `0006` ont exactement la même
     * limite**. À rouvrir pour TOUTES les tables ensemble, jamais pour une seule — une
     * dixième forme de contrainte ici ferait diverger la doctrine sans fermer le trou.
     */
    check(
      "photo_alt_valide",
      sql`length(btrim(${table.alt})) > 0 and length(${table.alt}) <= 300`,
    ),
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

/**
 * Famille d'intervention (Story 6.9).
 *
 * 🔴 LES TROIS VALEURS NE S'INVENTENT PAS ICI — ELLES SONT DÉJÀ À L'ÉCRAN DEPUIS LA 2.7.
 * `app/(public)/animations/page.tsx` rend trois `<h3>` (« Ateliers et tournois conviviaux »,
 * « Sensibilisation aux écrans », « Animations sur vos événements ») et porte l'instruction :
 * *« elles deviennent la TAXONOMIE DURABLE (futur enum `workshop_family` de la Story 6.9).
 * Ne pas les renommer à la légère. »*
 *
 * Les valeurs viennent de `src/lib/schemas/workshop.ts` — **une seule liste**, même sens de
 * dépendance que les trois autres enums et pour la même raison (le module Zod est bundlé côté
 * client par le formulaire d'admin ; l'inverse y ferait entrer tout Drizzle).
 *
 * ⚠️ L'ORDRE DE LA LISTE EST L'ORDRE DE L'ENUM, DONC CELUI DU `ORDER BY family`, DONC CELUI
 * DES TROIS FAMILLES SUR LA PAGE PUBLIQUE. Un `ORDER BY` sur une colonne d'enum trie par
 * ordre de DÉCLARATION, pas alphabétiquement (leçon `partner_category`).
 */
export const workshopFamily = pgEnum("workshop_family", WORKSHOP_FAMILIES);

/**
 * Atelier du catalogue d'animations (FR34, alimente FR10 — Story 6.9).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 PREMIÈRE TABLE DU PROJET À NAÎTRE **AVEC** SON ÉCRAN DE SAISIE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `event`/`bar`, `photo` et `partner` sont toutes nées lors d'une story de MODÈLE, puis ont
 * reçu leur back-office un epic plus tard — et toutes les trois ont alors payé une migration
 * de **rattrapage** pour des bornes de longueur absentes (`0006`, `0008`, `0009`). Le motif
 * était chaque fois le même, et il est écrit dans le bloc de `bar` : *« ce n'était pas un
 * oubli de doctrine mais une conséquence de la règle de tête de fichier : elle n'avait pas
 * encore de surface de saisie »*. Ici, la surface de saisie arrive dans la même story.
 * ⇒ **Les `CHECK` de non-blanc ET de plafond sont dans la `0010`.** Aucun rattrapage à prévoir.
 *
 * 🔴 CE QUE CETTE TABLE N'A PAS EST SON LIVRABLE — NE PAS LA « COMPLÉTER ».
 * Aucune colonne `tarif`, `duree`, `effectif` ni `nombre_de_postes`. **FR10** fait de cette
 * page une offre d'**utilité sociale** et non une prestation ; **FR16** interdit tout chiffre
 * de communauté sur le site. L'AC de la story l'exige comme **garde-fou de schéma et non
 * comme consigne** : un champ « tarif » ferait basculer la page par sa seule présence dans le
 * formulaire, avant même qu'on le remplisse. Et la page publique le dit déjà en ligne depuis
 * la 2.7 : *« Le format exact — durée, nombre de postes, jeux, âge du public — se définit avec
 * vous. »* Ajouter ces colonnes contredirait un texte publié.
 *
 * ⚠️ Aucune relation non plus : un atelier n'est rattaché à rien. Il n'a donc **aucune clé
 * étrangère entrante**, ce qui est précisément ce qui rend sa suppression dure sans danger
 * (contrairement à `event`, dont la suppression a demandé un raisonnement sur les photos).
 */
export const workshop = pgTable(
  "workshop",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** L'intitulé. Rendu en gras dans la liste de sa famille sur `/animations`. */
    title: text().notNull(),
    /**
     * Une LIGNE de contexte, pas un paragraphe. Absente → la ligne est rendue sans elle,
     * jamais avec un tiret orphelin (NFR8, doctrine UX-DR10).
     */
    summary: text(),
    /** Le public visé (« Collégiens et lycéens »). Facultatif, même doctrine que `summary`. */
    audience: text(),
    /**
     * Obligatoire : le catalogue public est **groupé par famille**. Un atelier sans famille
     * n'aurait nulle part où se rendre — c'est une garde de rendu, pas une préférence.
     */
    family: workshopFamily().notNull(),
    /** Classement manuel **à l'intérieur d'une famille** (voir l'index et les actions). */
    sortOrder: integer().notNull().default(0),
    /** Défaut `false` : rien n'est public par accident (patron `event`, `partner`, `photo`). */
    isPublished: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * 🔴 GARDES AU NIVEAU DES DONNÉES — MÊME DOCTRINE QUE PARTOUT DANS CE FICHIER : **la base
     * est le garde-fou qu'on ne peut pas contourner** (`UPDATE` direct, restauration de
     * sauvegarde, migration de données), **Zod est celui qui parle au bénévole**
     * (`lib/schemas/workshop.ts`, d'où viennent ces bornes — jamais recopiées ici).
     *
     * `notNull` ne suffit pas : `'' IS NOT NULL` est **vrai** en SQL, donc un
     * `UPDATE workshop SET title = ''` produirait un atelier sans intitulé, rendu en toutes
     * lettres — c'est-à-dire une puce vide — sur une page publique.
     *
     * 🔴 TOUTES NULL-SAFE, ET C'EST LA LEÇON LA PLUS CHÈRE DE L'EPIC 6. `event_has_venue`
     * (Story 3.1) s'évaluait à `FALSE OR NULL` = **`NULL`** dans le cas exact qu'elle
     * interdisait, et **un `CHECK` qui vaut `NULL` PASSE** (logique ternaire SQL : il n'échoue
     * que sur `FALSE`). Trois epics et sept portes vertes ne l'ont pas vu. Ici, les deux
     * colonnes nullables portent donc une branche `is null` **explicite**, et `title` est
     * `notNull` : aucune des trois contraintes ne peut s'évaluer à `NULL`.
     *
     * 🔴 `sql.raw()` EST OBLIGATOIRE POUR CES NOMBRES : dans un gabarit `sql``, une valeur
     * interpolée devient un PARAMÈTRE LIÉ, et la contrainte sortirait dans le `.sql` sous la
     * forme `length(...) <= $1` — un DDL versionné **invalide**, puisque personne n'est là
     * pour lier `$1`. Défaut mesuré à la génération en Story 4.3 ; ni le typecheck ni le
     * build ne le voient. **Le seul témoin est le SQL généré, qu'il faut donc LIRE.**
     *
     * ⚠️ LIMITE DÉCLARÉE ET ASSUMÉE : `btrim` ne retire que les blancs ASCII, pas U+200B
     * (leçon 6.3). Un `title` fait de caractères invisibles franchit ce `CHECK` ; Zod le
     * refuse (`visiblementVide`). **Les neuf contraintes de la `0006`, celles de la `0008` et
     * de la `0009` ont exactement la même limite** — à rouvrir pour TOUTES les tables
     * ensemble, jamais pour une seule. Une dixième forme de contrainte inventée ici ferait
     * diverger la doctrine sans fermer le trou.
     */
    check(
      "workshop_title_valide",
      sql`length(btrim(${table.title})) > 0 and length(${table.title}) <= ${sql.raw(String(WORKSHOP_TITRE_MAX))}`,
    ),
    check(
      "workshop_summary_valide",
      sql`${table.summary} is null or (length(btrim(${table.summary})) > 0 and length(${table.summary}) <= ${sql.raw(String(WORKSHOP_RESUME_MAX))})`,
    ),
    check(
      "workshop_audience_valide",
      sql`${table.audience} is null or (length(btrim(${table.audience})) > 0 and length(${table.audience}) <= ${sql.raw(String(WORKSHOP_PUBLIC_MAX))})`,
    ),
    // Colonnes DANS L'ORDRE OÙ LA REQUÊTE S'EN SERT : le catalogue filtre sur `is_published`,
    // puis ordonne par `family`, puis par `sort_order` (`queries/workshops.ts`). Patron exact
    // de `partner_published_category_order_idx`, et un seul index sert les deux requêtes
    // (publique et back-office), qui partagent leur ordre.
    index("workshop_published_family_order_idx").on(
      table.isPublished,
      table.family,
      table.sortOrder,
    ),
  ],
);

/**
 * Membre de l'équipe présenté sur `/l-asso` (FR35, alimente FR9 — Story 6.10).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA SEULE TABLE DE CE FICHIER QUI CONTIENT DE LA **DONNÉE PERSONNELLE** PUBLIÉE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `solicitation` en contient aussi, mais elle n'est **jamais rendue publiquement**. Ici, un
 * prénom et un rôle partent sur le web. Deux conséquences qui se lisent dans le schéma :
 *
 *   ① **MINIMISATION (RGPD, NFR5)** — ni nom de famille, ni e-mail, ni téléphone, ni date
 *      d'entrée au bureau. On ne stocke que ce que la page rend. Une colonne qui n'est
 *      rendue nulle part n'a aucune raison d'exister.
 *   ② **DROIT À L'EFFACEMENT** — la suppression est **DURE**, et elle emporte le fichier
 *      portrait. Aucune clé étrangère entrante sur cette table ⇒ rien ne s'y oppose,
 *      contrairement à `event`, dont la suppression a demandé un raisonnement sur les photos.
 *
 * 🔴 CE QUE CETTE TABLE N'A PAS EST SON LIVRABLE — NE PAS LA « COMPLÉTER ».
 * Aucune colonne d'effectif, de compteur, de total ni d'ancienneté. **FR16** interdit tout
 * chiffre de communauté sur le site, et **la page publique le dit déjà en ligne** depuis la
 * Story 2.6 : *« Pas de compteur de membres ni de statistiques d'audience sur ce site. »*
 * Une colonne de ce type contredirait un texte publié, sur la page même qui le porte. C'est
 * un **garde-fou de SCHÉMA**, pas une consigne dans une documentation que personne ne rouvre.
 *
 * ⚠️ Pas de catégorie `bureau` / `bénévole` : l'équipe est une **liste unique ordonnée**.
 * Séparer les gens en deux classes sur une page dont le propos est qu'ils font la même chose
 * serait un contresens éditorial. Le `role` dit déjà ce qu'il faut.
 */
export const member = pgTable(
  "member",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Le prénom. Rendu comme titre de la carte sur `/l-asso`. */
    firstName: text().notNull(),
    /**
     * Le rôle (« Présidente », « Bénévole animation »). **Obligatoire** : un prénom nu publié
     * sur le web serait une donnée personnelle publiée sans raison — c'est le rôle qui
     * justifie la publication.
     */
    role: text().notNull(),
    /**
     * Chemin du portrait sur le volume, ou `null`. **Facultatif, et son absence est le cas
     * NOMINAL** : une équipe mixte est le cas le plus probable.
     *
     * ⚠️ Une seule forme de valeur, contrairement à `partner.logo` qui en porte deux — aucun
     * portrait n'a jamais été semé dans `public/`, et il n'y en aura pas. Voir `lib/portraits.ts`.
     */
    portrait: text(),
    /** Classement manuel de l'équipe (voir l'index et les actions). */
    sortOrder: integer().notNull().default(0),
    /** Défaut `false` : rien n'est public par accident (patron `event`, `partner`, `photo`). */
    isPublished: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * 🔴 GARDES AU NIVEAU DES DONNÉES — **la base est le garde-fou qu'on ne peut pas
     * contourner** (`UPDATE` direct, restauration de sauvegarde, migration de données),
     * **Zod est celui qui parle au bénévole** (`lib/schemas/member.ts`, d'où viennent ces
     * bornes — jamais recopiées ici).
     *
     * `notNull` ne suffit pas : `'' IS NOT NULL` est **vrai** en SQL, donc un
     * `UPDATE member SET first_name = ''` produirait une carte sans prénom sur une page
     * publique.
     *
     * 🔴 `sql.raw()` EST OBLIGATOIRE POUR CES NOMBRES ET CE MOTIF : dans un gabarit `sql``,
     * une valeur interpolée devient un PARAMÈTRE LIÉ, et la contrainte sortirait dans le
     * `.sql` sous la forme `length(...) <= $1` — un DDL versionné **invalide**, puisque
     * personne n'est là pour lier `$1`. Ni le typecheck ni le build ne le voient. **Le seul
     * témoin est le SQL généré, qu'il faut donc LIRE.**
     *
     * ⚠️ LIMITE DÉCLARÉE ET ASSUMÉE : `btrim` ne retire que les blancs ASCII, pas U+200B
     * (leçon 6.3). Zod le refuse (`visiblementVide`). **Les contraintes des `0006`, `0008`,
     * `0009` et `0010` ont exactement la même limite** — à rouvrir pour TOUTES les tables
     * ensemble, jamais pour une seule.
     */
    check(
      "member_prenom_valide",
      sql`length(btrim(${table.firstName})) > 0 and length(${table.firstName}) <= ${sql.raw(String(MEMBER_PRENOM_MAX))}`,
    ),
    check(
      "member_role_valide",
      sql`length(btrim(${table.role})) > 0 and length(${table.role}) <= ${sql.raw(String(MEMBER_ROLE_MAX))}`,
    ),
    /**
     * 🔴 LA SEULE CONTRAINTE NULLABLE DE CETTE TABLE — DONC LA SEULE QUI PUISSE S'ÉVALUER À
     * `NULL`, DONC **LA SEULE QUI PORTE UNE BRANCHE `is null` EXPLICITE**.
     *
     * C'est la leçon la plus chère de l'Epic 6, et elle a coûté trois epics : `event_has_venue`
     * (Story 3.1) s'écrivait `bar_id is not null or length(btrim(venue_name)) > 0` et valait
     * `FALSE OR NULL` = **`NULL`** quand les deux colonnes étaient nulles — c'est-à-dire dans
     * le cas EXACT qu'elle existait pour interdire. Et **un `CHECK` qui vaut `NULL` PASSE**
     * (logique ternaire SQL : il n'échoue que sur `FALSE`). Sept portes vertes ne l'ont pas vu,
     * parce qu'une contre-épreuve par ÉCRITURE est aveugle à ce défaut **par construction**.
     * ⇒ `gate:membres` vérifie la parité en **LISANT le texte de la contrainte**
     * (`pg_get_constraintdef`), pas seulement en écrivant.
     *
     * Liste blanche, jamais liste noire — doctrine `photo_filename_safe` (4.3) et
     * `partner_logo_valide` (6.5), reprises mot pour mot : **un seul** préfixe autorisé (aucun
     * équivalent de `/partenaires/` ici) et **une seule** extension.
     *
     * 🔴 `\\.` ET NON `\.` — piège d'échappement à deux étages, et il est SILENCIEUX. Dans un
     * littéral de gabarit JS, `\.` est un échappement non reconnu et s'évalue en `.` : la
     * chaîne remise à Postgres porterait un point « n'importe quel caractère », et
     * `/medias/portraits/axwebp` passerait — **c'est le piège du point, mesuré en 6.5**. D'où
     * l'exigence d'ÉPROUVER ce `CHECK` par des écritures qui doivent ÉCHOUER.
     */
    check(
      "member_portrait_valide",
      sql`${table.portrait} is null or (length(${table.portrait}) <= ${sql.raw(String(MEMBER_PORTRAIT_MAX))} and ${table.portrait} ~ ${sql.raw(`'^${PREFIXE_PORTRAIT}[a-z0-9][a-z0-9._-]*\\.${PORTRAIT_EXTENSION}$'`)} and ${table.portrait} !~ '\\.\\.')`,
    ),
    /**
     * 🔴 UNICITÉ DU PORTRAIT — ELLE PROTÈGE LA **SUPPRESSION**, PAS L'AFFICHAGE.
     *
     * Sans elle, deux membres peuvent référencer le même fichier. Supprimer le premier
     * détruirait alors le portrait du second, qui afficherait une silhouette sans que rien ne
     * relie l'effet à sa cause. Le back-office ne peut pas produire ce cas (chaque
     * téléversement génère son propre UUID) — mais une restauration partielle ou un `UPDATE`
     * direct, si. Patron `partner_logo_unique` (6.5).
     *
     * ⚠️ Postgres autorise **plusieurs `NULL`** dans un index unique : les membres sans
     * portrait ne se gênent pas entre eux. C'est ce qui rend cette contrainte posable sur une
     * colonne nullable sans rien casser.
     */
    uniqueIndex("member_portrait_unique").on(table.portrait),
    // Colonnes DANS L'ORDRE OÙ LA REQUÊTE S'EN SERT : le rendu public filtre sur
    // `is_published` puis ordonne par `sort_order` (`queries/members.ts`). Un seul index sert
    // les deux requêtes (publique et back-office), qui partagent leur ordre. Patron
    // `workshop_published_family_order_idx`.
    index("member_published_order_idx").on(table.isPublished, table.sortOrder),
  ],
);

// ════════════════════════════════════════════════════════════════════════════════
// RÉGLAGES DU SITE — table à LIGNE UNIQUE (Story 6.13, FR38)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Les destinations externes et l'e-mail de contact du site, **saisissables au back-office**.
 *
 * Jusqu'à cette story, ces six valeurs étaient des constantes de `src/lib/links.ts`, qui s'y
 * déclarait « SOURCE UNIQUE des cibles externes ». Elles vivent désormais **ici**, et
 * `lib/links.ts` ne garde que ce qui ne se saisit pas : `TOURNOI_URL` — ⚠️ **qui n'est plus une
 * destination du tout depuis la Story 9.4, mais la route interne `/tournois`** ; cette ligne
 * disait « domaine réel et stable », motif devenu faux — et les utilitaires de classement
 * (`classerDestination`, `isExternalUrl`, `NEW_TAB_SR`).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 UNE SEULE LIGNE, ET C'EST LA CONTRAINTE QUI LE GARANTIT — ÉCART DÉCLARÉ À AR-DB2
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * AR-DB2 impose « PK uuid » et les dix autres tables la respectent. Ici la clé est un
 * `integer` **contraint à 1**, et l'écart *est* le livrable : c'est `site_setting_ligne_unique`
 * qui rend la ligne unique. Avec un `uuid`, « une seule ligne » ne serait tenu par **rien** —
 * un `INSERT` de plus passerait sans bruit, et le lecteur en choisirait une au hasard, donc
 * le header des 5 pages pourrait changer d'une requête à l'autre.
 *
 * ⚠️ **Pas de `created_at`**, contrairement aux dix autres tables. La ligne naît **avec la
 * migration `0012`** : sa date de création est celle du fichier de migration, et une colonne
 * qui la répéterait ne dirait rien à personne. `updated_at`, lui, est utile — il dit quand
 * l'équipe a touché aux réglages pour la dernière fois.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUE CETTE TABLE N'A PAS EST SON LIVRABLE — NE PAS LA « COMPLÉTER »
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Aucune colonne de titre de site, de description, d'adresse postale, de téléphone, d'horaires
 * ni de texte éditorial. Aucun magasin clé/valeur libre. Le raisonnement complet vit dans
 * `lib/schemas/site-setting.ts` (arbitrage de Brice du 2026-07-29, NFR8, Q6, FR16) ; ici il
 * suffit de savoir que **l'absence est intentionnelle** et que la garde ⑧ de `gate:reglages`
 * la tient.
 */
export const siteSetting = pgTable(
  "site_setting",
  {
    /**
     * Toujours `1`. Ce n'est pas un identifiant : c'est le **verrou de singleton**, et le
     * `CHECK` ci-dessous est ce qui lui donne son sens.
     */
    id: integer().primaryKey().default(1),
    /**
     * Les cinq destinations externes. **`null` = non renseignée, et c'est le cas NOMINAL au
     * merge** (dette R29) : le rendu ne produit alors **aucun lien** — ni `href`, ni focus, ni
     * annonce « nouvel onglet » — doctrine de la Story 5.5, qui a soldé R2.
     */
    discordUrl: text(),
    instagramUrl: text(),
    xUrl: text(),
    linkedinUrl: text(),
    helloassoUrl: text(),
    /**
     * L'e-mail public de contact. **Obligatoire** : le footer en fait son unique `mailto:` et
     * `SolicitationDialog` s'en sert de repli quand le formulaire échoue (Story 5.1).
     *
     * ⚠️ **CE N'EST PAS L'IDENTITÉ SMTP.** Le compte qui *envoie* est la constante
     * `COMPTE_SMTP` de `server/mail/client.ts`, parce que `GMAIL_APP_PASSWORD` y est lié.
     * Cette colonne pilote l'adresse **publiée** et le **destinataire** des notifications.
     */
    contactEmail: text().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * 🔴 GARDES AU NIVEAU DES DONNÉES — **la base est le garde-fou qu'on ne peut pas
     * contourner** (`UPDATE` direct, restauration de sauvegarde, migration de données),
     * **Zod est celui qui parle au bénévole** (`lib/schemas/site-setting.ts`, d'où viennent
     * ces bornes — jamais recopiées ici).
     *
     * 🔴 `sql.raw()` EST OBLIGATOIRE POUR CES NOMBRES ET CES MOTIFS : dans un gabarit `sql``,
     * une valeur interpolée devient un PARAMÈTRE LIÉ, et la contrainte sortirait dans le
     * `.sql` sous la forme `length(...) <= $1` — un DDL versionné **invalide**, puisque
     * personne n'est là pour lier `$1`. Ni le typecheck ni le build ne le voient. **Le seul
     * témoin est le SQL généré, qu'il faut donc LIRE.**
     */
    check("site_setting_ligne_unique", sql`${table.id} = 1`),
    /**
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 CINQ COLONNES NULLABLES ⇒ CINQ BRANCHES `is null` EXPLICITES
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * C'est la leçon la plus chère de l'Epic 6, et cette story offre **cinq** occasions de la
     * refaire d'un coup. `event_has_venue` (Story 3.1) s'écrivait
     * `bar_id is not null or length(btrim(venue_name)) > 0` et valait `FALSE OR NULL` =
     * **`NULL`** quand les deux colonnes étaient nulles — c'est-à-dire dans le cas EXACT
     * qu'elle existait pour interdire. Et **un `CHECK` qui vaut `NULL` PASSE** (logique
     * ternaire SQL : il n'échoue que sur `FALSE`). Il a survécu **trois epics** et **sept
     * portes vertes**, parce qu'une contre-épreuve par ÉCRITURE y est aveugle **par
     * construction**. ⇒ la garde ① de `gate:reglages` **LIT le texte des contraintes**
     * (`pg_get_constraintdef`), elle ne se contente pas d'écrire.
     *
     * Le motif `^https?://` est **littéralement celui d'`isExternalUrl()`** (`lib/links.ts`) :
     * une valeur que la base accepte doit être une valeur que le rendu classe **sortante**,
     * sinon le lien serait rendu en interne, sans onglet ni annonce.
     */
    check(
      "site_setting_discord_url_valide",
      sql`${table.discordUrl} is null or (length(${table.discordUrl}) <= ${sql.raw(String(URL_MAX))} and ${table.discordUrl} ~ '^https?://')`,
    ),
    check(
      "site_setting_instagram_url_valide",
      sql`${table.instagramUrl} is null or (length(${table.instagramUrl}) <= ${sql.raw(String(URL_MAX))} and ${table.instagramUrl} ~ '^https?://')`,
    ),
    check(
      "site_setting_x_url_valide",
      sql`${table.xUrl} is null or (length(${table.xUrl}) <= ${sql.raw(String(URL_MAX))} and ${table.xUrl} ~ '^https?://')`,
    ),
    check(
      "site_setting_linkedin_url_valide",
      sql`${table.linkedinUrl} is null or (length(${table.linkedinUrl}) <= ${sql.raw(String(URL_MAX))} and ${table.linkedinUrl} ~ '^https?://')`,
    ),
    check(
      "site_setting_helloasso_url_valide",
      sql`${table.helloassoUrl} is null or (length(${table.helloassoUrl}) <= ${sql.raw(String(URL_MAX))} and ${table.helloassoUrl} ~ '^https?://')`,
    ),
    /**
     * 🔴 LA SEULE CONTRAINTE **NON** NULLABLE, DONC LA SEULE SANS BRANCHE `is null` — et son
     * absence est aussi délibérée que la présence des cinq autres.
     *
     * `notNull` ne suffit pas : `'' IS NOT NULL` est **vrai** en SQL, donc un
     * `UPDATE site_setting SET contact_email = ''` retirerait en silence le seul moyen de
     * joindre l'association affiché sur le site.
     *
     * ⚠️ **DEUX LANGAGES, UNE SEULE RÈGLE — ET L'ÉCART EST DÉCLARÉ.** Zod teste
     * `MOTIF_EMAIL` (classes JS `\s`), Postgres teste la même chose en classes POSIX
     * (`[[:space:]]`, qui n'existe pas en JS). Ce ne sont pas deux copies d'un motif : ce sont
     * deux écritures de la même règle, et la garde ① de la porte les confronte **aux mêmes
     * valeurs** pour que la parité soit mesurée et non affirmée.
     *
     * 🔴 DOUBLE ANTISLASH AVANT LE POINT, ET NON UN SEUL — piège d'échappement à deux étages,
     * et il est SILENCIEUX. Dans un littéral de gabarit JS, un antislash-point est un
     * échappement non reconnu et s'évalue en point nu : la chaîne remise à Postgres porterait
     * un « n'importe quel caractère », et `a@bXfr` passerait. C'est le **piège du point**,
     * mesuré en 6.5 puis en 6.10. D'où l'exigence d'ÉPROUVER ce `CHECK` par des écritures qui
     * doivent ÉCHOUER.
     *
     * ⚠️ LIMITE DÉCLARÉE ET ASSUMÉE : `btrim` ne retire que les blancs ASCII, pas U+200B
     * (leçon 6.3). Zod le refuse (`visiblementVide`). **Les contraintes des `0006`, `0008`,
     * `0009`, `0010` et `0011` ont exactement la même limite** — à rouvrir pour TOUTES les
     * tables ensemble, jamais pour une seule.
     */
    check(
      "site_setting_contact_email_valide",
      sql`length(btrim(${table.contactEmail})) > 0 and length(${table.contactEmail}) <= ${sql.raw(String(EMAIL_MAX))} and ${table.contactEmail} ~ ${sql.raw(MOTIF_EMAIL_SQL)}`,
    ),
  ],
);

// ════════════════════════════════════════════════════════════════════════════════
// TOURNOIS — LA RACINE QUI N'EXISTAIT NULLE PART (Story 9.1, A21)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Comment on s'inscrit à un tournoi (A23 ②).
 *
 * Les valeurs viennent de `src/lib/schemas/tournament.ts` — **une seule liste**, même sens de
 * dépendance que les quatre autres enums et pour la même raison (le module Zod est bundlé côté
 * client par le formulaire d'admin ; l'inverse y ferait entrer tout Drizzle).
 *
 * ⚠️ L'ORDRE DE LA LISTE EST L'ORDRE DE L'ENUM POSTGRES, donc celui d'un éventuel
 * `ORDER BY registration_mode` (leçon `partner_category` : un `ORDER BY` sur une colonne
 * d'enum trie par ordre de **DÉCLARATION**, pas alphabétiquement).
 */
export const tournamentRegistrationMode = pgEnum(
  "tournament_registration_mode",
  REGISTRATION_MODES,
);

/**
 * L'état des inscriptions (A23 ②).
 *
 * 🔴 CE N'EST **PAS** « À VENIR / PASSÉ », ET LES CONFONDRE EST LE PIÈGE QUE LA NOTE
 * D'ARCHITECTURE DÉSAMORCE D'EMBLÉE (§6 ①) : *« les mélanger produirait un tournoi "à venir"
 * dont les inscriptions sont closes, ou l'inverse »*. Cette colonne dit **uniquement** si l'on
 * peut s'inscrire maintenant. « À venir » et « passé » se **dérivent de `starts_at`**
 * (Story 9.2), exactement comme `queries/events.ts` le fait déjà par `gt`/`lte` — patron
 * **mesuré** le 2026-08-13, à reprendre et non à réinventer.
 * ⚠️ **Il n'y a donc aucune colonne `is_past`, et il ne faut pas en ajouter.** Un drapeau tenu
 * à la main dérive : ce projet l'a payé en 6.13 sur un sous-total recalculé à la main.
 */
export const tournamentRegistrationState = pgEnum(
  "tournament_registration_state",
  REGISTRATION_STATES,
);

/**
 * Un tournoi (Story 9.1 — A21, A23).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA RACINE MANQUANTE DU MODÈLE — ELLE N'EXISTAIT **NULLE PART**, ET C'EST MESURÉ
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Relevé le 2026-08-13 dans `apps/tournoi-api/prisma/schema.prisma` : les modèles sont
 * `Player`, `Day`, `Round`, `Lobby`, `LobbyPlayer`, `Admin` — **aucun `Tournament`**.
 * L'application tournoi gère **un seul tournoi, implicite**. Côté vitrine, rien non plus.
 * ⇒ *« Une page qui liste les tournois à venir et passés »* n'est donc pas une fonctionnalité
 * à ajouter : c'est **la racine manquante**, et c'est pour cela que sa création est un epic.
 * ⚠️ Cette table ne **migre rien** : arbitrage **A17**, on repart de zéro. La base
 * `tournoi_tft` (27 joueurs, 4 journées, 8 lobbies, 64 participations) reste **intacte** et
 * cesse simplement d'être alimentée — sa suppression est un geste séparé, postérieur à la
 * Story 7.10 (les sauvegardes), routé en Story 10.7.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUE CETTE TABLE N'A PAS EST SON LIVRABLE — PÉRIMÈTRE **A5**, NE PAS LA « COMPLÉTER »
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Aucune colonne de **phase**, de **match**, de **participant**, d'**inscrit** ni de
 * **score**. Ce n'est pas un modèle inachevé : c'est la racine **minimale** (A21), que les
 * Epics 10 et 11 **étendront** au lieu de la remplacer. Mélanger la racine et les phases
 * referait le mécanisme **R2** — une grosse story qui bloque ou évapore ses volets.
 * ⚠️ L'absence est gardée par `gate:tournois`, qui lit le **schéma réel de la base** : un
 * commentaire ne tient pas une règle six mois (leçon de la garde ⑩ de `gate:ateliers`).
 *
 * ⚠️ **AUCUNE COLONNE NULLABLE N'EST AJOUTÉE SANS NÉCESSITÉ**, et chacune l'est pour une raison
 * ÉCRITE, avec une branche `is null` **explicite** dans sa contrainte quand elle en a une.
 *
 * 🔴 **`event_id` EST DEVENU NULLABLE À LA STORY 9.5, ET CE PARAGRAPHE DISAIT L'INVERSE.**
 * Il affirmait : *« la décision 1 du §8 le rend **obligatoire** ⇒ **aucune occasion de refaire
 * `event_has_venue`** »*. La décision 1 a été **RENVERSÉE le 2026-08-14**, non par un
 * raisonnement mais par un **usage réel** : Brice a saisi le premier tournoi du projet et a dû
 * créer **deux objets pour un seul rendez-vous**. Elle était **juste sur son motif** (éviter une
 * colonne nullable) et **fausse sur son coût** — elle transformait le cas le plus fréquent,
 * *un tournoi EST le rendez-vous*, en double saisie.
 * ⇒ **L'occasion de refaire `event_has_venue` est donc bel et bien rouverte**, et elle est
 * refermée **explicitement** par `tournament_a_un_lieu` (voir son bloc, plus bas) : *pas
 * d'événement ⇒ un lieu*, écrite **null-safe**, et prouvée par une garde qui **LIT son texte**.
 *
 * ⚠️ **UN COMPTE ÉCRIT ICI À LA MAIN A DÉJÀ ÉTÉ FAUX DEUX FOIS** — il disait « huit », il y en
 * avait **neuf** à l'écriture, puis **dix** dès que `photo_id` a été ajouté (A2), et **onze**
 * depuis que `event_id` est nullable (9.5). Sur un projet dont la doctrine est *« compter par
 * exécution, jamais de mémoire »*, un nombre recopié dans un commentaire est exactement ce qui
 * se désaligne — c'était la 5ᵉ occurrence, après `_sections.ts`, `CHAMPS_URL`, la couverture
 * d'autotest de `gate:reseaux` et la liste `INTERDITS` de `gate:tournois`.
 * ⇒ **AUCUN COMPTE N'EST PLUS ÉCRIT ICI.** Celui qui fait foi est celui de la porte, qui le
 * relit dans `information_schema.columns` — et le maintenir à deux endroits, c'est le perdre.
 */
export const tournament = pgTable(
  "tournament",
  {
    id: uuid().primaryKey().defaultRandom(),
    /**
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 LE RATTACHEMENT À L'AGENDA — **FACULTATIF DEPUIS LA STORY 9.5**, ET `RESTRICT` RESTE
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * `null` ⇒ **le tournoi EST le rendez-vous**, et l'agenda l'affiche à ce titre (méthode M2).
     * Renseigné ⇒ le tournoi est **une animation** d'un événement plus large qui peut en porter
     * plusieurs : c'est le cas de la Game'in Reims, **contenant à deux niveaux** — deux jours,
     * dix animations à des heures différentes (confirmé par Brice le 2026-08-14).
     * ⚠️ Le rattachement n'est donc **pas supprimé**, il devient **facultatif** : la décision
     * d'origine décrivait **bien la GIR** et **mal le tournoi seul**.
     *
     * 🔴 `ON DELETE RESTRICT` EST **CONSERVÉ**, ET CE N'EST PLUS LE MÊME RAISONNEMENT QU'EN 9.1.
     * Ce bloc disait : *« la colonne est `notNull`, `SET NULL` est donc **impossible**, il ne
     * reste que deux options »*. **Ce motif a disparu avec le `NOT NULL`** — les trois
     * comportements sont désormais possibles, et il faut donc **choisir** au lieu de subir :
     *   · `CASCADE` **détruirait les tournois** d'un événement supprimé — la suppression d'un
     *     événement est une opération **banale** du back-office depuis la 6.3, et un tournoi
     *     porte son podium, son URL d'inscription et son adresse publique partagée. Une perte
     *     muette, déclenchée par un geste de routine. **Refusé, comme en 9.1.**
     *   · `SET NULL` **est devenu possible**, et il est **refusé quand même** — c'est le
     *     changement le plus tentant de cette story, et le piège. Un tournoi rattaché **sans
     *     lieu propre** (cas nominal : c'est l'événement qui portait le lieu) verrait son
     *     `event_id` passer à `null` et **violerait aussitôt `tournament_a_un_lieu`**. Postgres
     *     refuserait alors la suppression avec un message de **contrainte CHECK** — illisible,
     *     et pointant sur la mauvaise cause. On échangerait un refus **clair** contre un refus
     *     **obscur**, pour le même résultat.
     *   · `RESTRICT` fait **refuser** la suppression par Postgres, et c'est **le bon signal** —
     *     exactement le raisonnement déjà écrit sur `event.barId`.
     * ⚠️ **Ne pas « harmoniser » cette clé sur `event.barId` / `photo.eventId`** au motif que la
     * colonne est maintenant nullable comme les leurs : leur orphelin garde un sens sans
     * contrainte à respecter (un jeudi sans bar reste un jeudi), le nôtre doit **encore prouver
     * qu'il a un lieu**.
     *
     * ⚠️ CONSÉQUENCE **HORS DE CETTE TABLE**, ET ELLE EST PAYÉE : `actions/agenda.ts`
     * traduisait tout `23503` par « Le bar choisi n'existe plus », parce que le bar était sa
     * seule clé étrangère. Ce n'est plus vrai. Sans correction, un bénévole qui supprime un
     * événement portant un tournoi lirait un message parlant d'un **bar** — faux, et
     * impossible à corriger. Le message y distingue désormais les deux cas, et depuis la 9.5
     * il propose aussi de **détacher**, geste qui n'existait pas.
     */
    eventId: uuid().references(() => event.id, { onDelete: "restrict" }),
    /** Le nom du tournoi, rendu en titre de la fiche (A23 ①). */
    name: text().notNull(),
    /**
     * Le ou les jeux, en texte libre — **volontairement pas un enum**. Le dossier GIR 2026 en
     * compte déjà **dix** (CS2, Valorant, LoL, Rocket League, 2XKO, TFT, Speedrunners,
     * Boomerang Fu, VR, Clone Hero) : un enum imposerait une migration à chaque nouveau jeu,
     * c'est-à-dire à chaque tournoi. Même arbitrage que `event.games`.
     */
    game: text().notNull(),
    /**
     * 🔴 L'IDENTIFIANT LISIBLE DE L'URL — **UNIQUE**, ET AUCUN ÉQUIVALENT N'EXISTAIT DANS LE
     * PROJET (mesuré le 2026-08-13 : le mot « slug » n'y désignait que des noms de fichiers de
     * logos statiques). C'est vers `/tournois/<slug>` que pointeront MATELY, les réseaux, les
     * flyers et les descriptions de stream (A20 : *« les URLs sont stables dès le premier
     * jour »*) — d'où l'unicité **en base** et non seulement dans le formulaire.
     * ⚠️ Sa **fixation à la publication** (A3) n'est PAS ici : elle compare la valeur nouvelle
     * à la précédente, ce qu'un `CHECK` de ligne ne voit pas. Elle se tient à la frontière
     * d'écriture (`actions/tournois.ts`) et `gate:tournois` la prouve dans les deux sens.
     */
    slug: text().notNull().unique(),
    /**
     * 🔴 LE TOURNOI PORTE SA **PROPRE** DATE (A1), et ce n'est pas une redondance avec
     * `event.startsAt` : la Game'in Reims est **UN** événement portant **DIX** animations à des
     * heures différentes, sur deux jours. Sans date propre, on ne pourrait ni les ordonner, ni
     * dériver « à venir / passés » à l'échelle du tournoi.
     * ⚠️ `timestamptz`, et UNE SEULE colonne — jamais date + heure séparées, qui rouvriraient
     * le piège de fuseau à chaque lecture. Construire la valeur avec `parisWallClockFromInput`,
     * jamais avec `new Date('…')`.
     *
     * 🔴 **CE BLOC DISAIT « Aucune date de FIN : aucun critère ne la demande, et elle se DÉDUIRA
     * des phases (Story 10.1) » — CORRIGÉ LE 2026-08-14 (Story 9.6).** La phrase était juste sur
     * son objet et **fausse sur son périmètre** : elle confondait la fin **DÉRIVÉE** (celle que
     * les phases produiront) et la fin **ANNONCÉE** (`ends_at` : jusqu'à quelle heure on vous
     * attend), qui est une donnée **éditoriale** et a désormais un critère explicite.
     * ⚠️ Partage **identique** à celui de `format_text` (A23 ③) : l'annonce est éditoriale, **les
     * phases feront foi** dès qu'elles existeront, et la fiche devra alors **DÉRIVER** ce qu'elle
     * affiche plutôt que lire deux sources.
     * ⚠️ Le motif d'origine — *« une colonne sans consommateur est une migration qu'il faudra
     * défaire »* — reste valide ; il ne s'applique simplement plus : `ends_at` a **quatre**
     * consommateurs de rendu dès la story qui la crée.
     */
    startsAt: timestamp({ withTimezone: true }).notNull(),
    /**
     * L'heure de fin **annoncée** (Story 9.6, dette R56). Facultative — voir le bloc de
     * `starts_at` juste au-dessus pour la distinction « annoncée » / « dérivée », et le bloc
     * jumeau d'`event.endsAt` pour le « pourquoi un `timestamptz` et pas une durée ».
     * ⚠️ Une fin après minuit tombe **le lendemain**, et c'est le cas nominal d'un tournoi du
     * soir — pas un cas limite. Le rendu le **dit** (`formatPlageHoraire`).
     */
    endsAt: timestamp({ withTimezone: true }),
    /**
     * Le **tarif annoncé**, en toutes lettres (Story 9.6, dette R55).
     *
     * 🔴 UN TEXTE ET NON UN MONTANT — même arbitrage que `formatText` plus bas. Le raisonnement
     * complet, la borne et le point sur **FR16** vivent dans `lib/schemas/tournament.ts`
     * (`TARIF_MAX`).
     * ⚠️ **`NULL` NE VEUT PAS DIRE « GRATUIT »** : absent ⇒ la ligne **disparaît** au rendu.
     * Déduire une gratuité d'une absence serait affirmer un fait qu'on n'a pas (famille R48).
     * ⚠️ Ce n'est **PAS** le montant qu'un jour MATELY encaissera : cette colonne dit ce qu'on
     * **annonce**, comme `format_text` dit ce qu'on **promet**.
     */
    priceText: text(),
    /**
     * Le lieu du tournoi. Absent → la ligne est masquée à l'affichage, jamais rendue vide
     * (NFR8, UX-DR10).
     *
     * 🔴 **DEPUIS LA 9.5, IL EST LE PIVOT DE `tournament_a_un_lieu` — NE PAS LE SUPPRIMER.**
     * Il ne se lit plus « la salle, **en plus** du lieu de l'événement » (formulation d'origine,
     * vraie quand tout tournoi avait un événement) : quand `event_id` est `null`, il est le
     * **seul** endroit où le lieu existe. Le rendre obligatoire serait faux dans l'autre sens —
     * un tournoi rattaché n'a pas à répéter l'adresse de son événement. D'où une contrainte
     * **conditionnelle**, et non un `notNull`.
     */
    venueName: text(),
    /**
     * 🔴 LE FORMAT ANNONCÉ EST **ÉDITORIAL** — ET LES PHASES FERONT FOI (A23 ③).
     * Le raisonnement complet vit dans `lib/schemas/tournament.ts` ; ici il suffit de savoir
     * que le jour où les phases existeront (Story 10.1), il y aura **deux descriptions du même
     * format**, que **les phases l'emportent**, et que la fiche devra alors **DÉRIVER** ce
     * qu'elle affiche au lieu de lire deux sources.
     */
    formatText: text(),
    /** Les lots (A23 ③). Une ligne, pas un règlement. */
    prizes: text(),
    /**
     * Durée estimée d'un match, **en minutes** (A23 ③).
     * Un entier et non du texte : c'est la seule des données d'A23 ③ que la Story 11.1 devra
     * **envoyer à MATELY**, et que l'assistance au choix de format consommera (§7 ③, qui a
     * besoin du « temps disponible »). Une chaîne obligerait chacun à re-parser du français.
     */
    matchDurationMinutes: integer(),
    /**
     * Le nombre de places annoncé (A23 ①).
     *
     * 🔴 CE N'EST **PAS** UN CHIFFRE DE COMMUNAUTÉ — DISTINCTION À NE PAS « HARMONISER ».
     * **FR16** interdit les chiffres de communauté (membres, audience), et c'est pourquoi
     * `workshop` et `member` n'ont **aucune** colonne d'effectif — `gate:ateliers` ⑩ interdit
     * même qu'on leur en ajoute une. Une **capacité de tournoi** est autre chose : une
     * contrainte d'organisation que le visiteur doit connaître pour décider de s'inscrire,
     * explicitement demandée par **A23 ①**, et que la Story 11.1 doit transmettre à MATELY.
     */
    capacity: integer(),
    /**
     * Comment on s'inscrit. **`notNull`**, et c'est ce qui rend le `CHECK` ci-dessous
     * structurellement null-safe (voir son bloc).
     */
    /**
     * Effectif d'un engagé — 1 en individuel, 2 en duo, etc. (Story 10.1).
     *
     * C'est la valeur contre laquelle `effectifConforme` juge une inscription. Elle vit sur le
     * tournoi et non sur la phase : « 4 équipes de 2 » décrit le tournoi entier.
     * ⚠️ `default(1)` et non nullable : l'individuel n'est pas l'absence d'équipe, c'est une
     * équipe d'un membre — un seul chemin de code.
     */
    teamSize: integer().notNull().default(1),
    registrationMode: tournamentRegistrationMode().notNull(),
    /** L'adresse d'inscription. **Obligatoire en mode `mately`** — voir le `CHECK`. */
    registrationUrl: text(),
    /**
     * Défaut `fermees` : **rien n'est ouvert par accident**, exactement comme `is_published`
     * naît à `false` partout dans ce fichier. Annoncer des inscriptions ouvertes qui ne le
     * sont pas est le seul des trois états qui fasse perdre quelqu'un.
     */
    registrationState: tournamentRegistrationState().notNull().default("fermees"),
    /**
     * 🔴 LE PODIUM — **UNE** DONNÉE, ÉCRITE TANTÔT À LA MAIN, TANTÔT PAR LE MOTEUR (A23 ①).
     *
     * Le moteur n'existe pas encore : le podium se **saisit** dans la 8ᵉ section. Le jour où
     * il arrivera, **il écrira le même fait, au même endroit**. Règle « un seul propriétaire
     * par fait » (§5) ⇒ **jamais deux colonnes**, jamais un « podium annoncé » à côté d'un
     * « podium calculé ». Deux podiums finiraient par diverger, et c'est le résultat d'une
     * compétition.
     * ⚠️ Trois colonnes de **RANG** ne sont pas deux colonnes du même fait : elles décrivent
     * trois places distinctes d'un seul podium. C'est la décision 4 du §8 appliquée — colonnes
     * typées pour ce qui est **commun à tous les formats**, et un podium l'est.
     */
    podiumFirst: text(),
    podiumSecond: text(),
    podiumThird: text(),
    /**
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 LE VISUEL RÉUTILISE UNE PHOTO DE LA **GALERIE** — ARBITRAGE A2, ET IL ÉVITE UNE ROUTE
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * Mesuré le 2026-08-13 : `src/app/medias/` porte **trois** familles de routes
     * (`[filename]`, `logos/`, `portraits/`). ⚠️ **Leçon de la Story 6.5, payée** : *les routes
     * de médias ne connaissent que leur propre table* — un fichier posé sur le volume sans
     * ligne correspondante rend **404 en silence**. Une **4ᵉ famille** « visuels de tournoi »
     * coûterait donc une route, son schéma, sa garde, et rouvrirait ce piège pour rien.
     * ⇒ On pointe une ligne de `photo`, que la galerie sait déjà **téléverser, décrire
     * (`alt` obligatoire, NFR3) et publier**.
     *
     * ⚠️ **ÉCART ASSUMÉ, ET IL EST DIT À L'ÉCRAN** : la route `/medias/[filename]` ne sert que
     * les photos **publiées**. Un visuel choisi parmi des brouillons ne s'afficherait donc pas
     * — ce n'est pas un bug, c'est la garde de la 6.4, et le formulaire ne propose que des
     * photos publiées.
     *
     * 🔴 `ON DELETE SET NULL`, jamais `CASCADE` : supprimer une photo de la galerie ne doit pas
     * effacer un tournoi, son podium et son adresse publique. Le tournoi perd son visuel et se
     * rend sans — même raisonnement que `photo.eventId`, et c'est pour cela que la colonne est
     * **nullable par conception**, pas seulement par conséquence.
     * ⚠️ Le visuel est **FACULTATIF** (question ouverte n°2 de la story, tranchée « non
     * obligatoire ») : un tournoi sans photo est le cas **nominal** au démarrage de la saisie,
     * et la fiche doit s'afficher correctement sans lui.
     */
    photoId: uuid().references(() => photo.id, { onDelete: "set null" }),
    /** Défaut `false` : rien n'est public par accident (patron `event`, `partner`, `photo`). */
    isPublished: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 LA CONTRAINTE DU MODE D'INSCRIPTION — ÉCRITE NULL-SAFE **DEUX FOIS**
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * Un tournoi en mode `mately` **doit** porter une URL : sans elle, la fiche annoncerait des
     * inscriptions ouvertes avec **aucun moyen de s'inscrire**.
     *
     * 🔴 LA FORME NAÏVE EST EXACTEMENT LE DÉFAUT `event_has_venue` :
     *     `registration_mode <> 'mately' or registration_url is not null`
     * vaut `NULL OR FALSE` = **`NULL`** dès que `registration_mode` est `NULL` — et **un
     * `CHECK` qui vaut `NULL` PASSE** (logique ternaire SQL : il n'échoue que sur `FALSE`).
     * `event_has_venue` a survécu **trois epics et sept portes vertes** sur ce mécanisme.
     *
     * **Deux verrous, et ils sont indépendants :**
     *   ① `registration_mode` est **`notNull`** — la doctrine de ce fichier accepte ce motif
     *      seul (« soit leur colonne est `notNull`, soit elles portent une branche `is null`
     *      explicite ») ;
     *   ② la branche `is null` est écrite **quand même**. Elle est aujourd'hui inatteignable,
     *      et c'est le but : le jour où quelqu'un relâcherait le `NOT NULL` de la colonne, la
     *      contrainte ne se dégraderait pas en silence.
     * ⚠️ `registration_url is not null` ne peut **jamais** valoir `NULL` (`IS NOT NULL` rend
     * toujours un booléen) : la colonne nullable de cette règle n'est donc pas la source du
     * danger, et c'est contre-intuitif — d'où ce paragraphe.
     *
     * 🔴 ET LA NULL-SAFETY NE SE MESURE **PAS** PAR UNE ÉCRITURE — leçon `gate:ateliers` ⑧,
     * prouvée rouge : avec la branche retirée, la contre-épreuve « colonne à `NULL` » reste
     * **VERTE**, parce que le défaut la rend aveugle **par construction**. Le seul témoin est
     * une garde qui **LIT le texte de la contrainte** (`pg_get_constraintdef`), et
     * `gate:tournois` en porte une, plus une qui vérifie que la colonne est bien `NOT NULL`.
     */
    check(
      "tournament_mately_a_son_url",
      sql`${table.registrationMode} is null or ${table.registrationMode} <> 'mately' or ${table.registrationUrl} is not null`,
    ),
    /**
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 PAS D'ÉVÉNEMENT ⇒ UN LIEU — **C'EST `event_has_venue`, ET ON LE SAIT D'AVANCE**
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * Rendre `event_id` nullable (Story 9.5) rouvre le trou que la décision 1 du §8 cherchait
     * précisément à éviter : le lieu d'un tournoi rattaché vient de **son événement**, donc
     * sans événement **et** sans `venue_name`, un tournoi s'afficherait à l'agenda sans qu'on
     * sache **où** il se tient. Le motif d'origine était réel — il est refermé ici, à la main.
     *
     * 🔴 LA FORME NAÏVE EST **EXACTEMENT** LE DÉFAUT HISTORIQUE :
     *     `event_id is not null or length(btrim(venue_name)) > 0`
     * Dans le cas **exact** qu'elle interdit (`event_id` `NULL`, `venue_name` `NULL`), elle vaut
     * `FALSE OR NULL` = **`NULL`** — et **un `CHECK` qui vaut `NULL` PASSE** (logique ternaire
     * SQL : il n'échoue que sur `FALSE`). C'est le mécanisme par lequel `event_has_venue` est
     * resté faux **trois epics et sept portes vertes**.
     *
     * ⚠️ **ET LE MEMBRE DANGEREUX N'EST PAS CELUI QU'ON CROIT** — même contre-intuition que
     * `tournament_mately_a_son_url` ci-dessus, d'où ce paragraphe :
     *   · `event_id is not null` ne vaut **jamais** `NULL` (`IS NOT NULL` rend toujours un
     *     booléen). Ce n'est **pas** lui qu'il faut protéger, alors que c'est la colonne qu'on
     *     vient de rendre nullable ;
     *   · c'est `length(btrim(venue_name)) > 0` qui vaut `NULL` quand la colonne est `NULL`.
     * ⇒ `coalesce(…, 0)` **à l'intérieur**, sur la longueur, et non un `venue_name is not null`
     * ajouté devant : les deux se valent logiquement, mais celui-ci **dit** où était le danger.
     *
     * 🔴 ET ÇA NE SE MESURE **PAS** PAR UNE ÉCRITURE — leçon `gate:ateliers` ⑧, prouvée rouge :
     * avec le `coalesce` retiré, la contre-épreuve « les deux colonnes à `NULL` » reste **VERTE**,
     * parce que le défaut rend la garde aveugle **par construction**. Le seul témoin est une
     * garde qui **LIT le texte de la contrainte** (`pg_get_constraintdef`), et `gate:tournois`
     * en porte une (garde ⑯).
     *
     * ⚠️ **`btrim` ne retire que les blancs ASCII, pas U+200B** — même limite déclarée que les
     * autres gardes de texte de cette table, à rouvrir pour TOUTES ensemble (dette **R41**,
     * Story 7.8). Zod refuse le cas visiblement vide (`visiblementVide`), et
     * `tournament_venue_name_valide` interdit déjà la chaîne blanche : cette contrainte-ci ne
     * répète donc pas la validation du contenu, elle ne décide que de la **présence**.
     */
    check(
      "tournament_a_un_lieu",
      sql`${table.eventId} is not null or coalesce(length(btrim(${table.venueName})), 0) > 0`,
    ),
    /**
     * 🔴 GARDES DE TEXTE — MÊME DOCTRINE QUE PARTOUT DANS CE FICHIER : **la base est le
     * garde-fou qu'on ne peut pas contourner** (`UPDATE` direct, restauration de sauvegarde,
     * migration de données), **Zod est celui qui parle au bénévole**
     * (`lib/schemas/tournament.ts`, d'où viennent ces bornes — jamais recopiées ici).
     *
     * `notNull` ne suffit pas : `'' IS NOT NULL` est **vrai** en SQL, donc un
     * `UPDATE tournament SET name = ''` produirait un tournoi sans nom, annoncé en toutes
     * lettres sur une page publique.
     *
     * 🔴 TOUTES NULL-SAFE : les colonnes nullables portent une branche `is null` **explicite**,
     * les `notNull` n'en ont pas besoin. Vérifié une par une, et **mesuré** par la porte.
     *
     * 🔴 `sql.raw()` EST OBLIGATOIRE POUR CES NOMBRES : dans un gabarit `sql``, une valeur
     * interpolée devient un PARAMÈTRE LIÉ, et la contrainte sortirait dans le `.sql` sous la
     * forme `length(...) <= $1` — un DDL versionné **invalide**, puisque personne n'est là pour
     * lier `$1`. Défaut mesuré à la génération en Story 4.3 ; ni le typecheck ni le build ne le
     * voient. **Le seul témoin est le SQL généré, qu'il faut donc LIRE.**
     *
     * ⚠️ LIMITE DÉCLARÉE ET ASSUMÉE : `btrim` ne retire que les blancs ASCII, pas U+200B
     * (leçon 6.3). Zod le refuse (`visiblementVide`). **Les contraintes des `0006`, `0008`,
     * `0009`, `0010`, `0011` et `0012` ont exactement la même limite** — à rouvrir pour TOUTES
     * les tables ensemble (dette **R41**, Story 7.8), jamais pour une seule.
     */
    check(
      "tournament_name_valide",
      sql`length(btrim(${table.name})) > 0 and length(${table.name}) <= ${sql.raw(String(NOM_MAX))}`,
    ),
    check(
      "tournament_game_valide",
      sql`length(btrim(${table.game})) > 0 and length(${table.game}) <= ${sql.raw(String(JEU_MAX))}`,
    ),
    /**
     * 🔴 LE MOTIF EST CELUI DE `MOTIF_IDENTIFIANT`, ÉCRIT EN ERE POSIX — deux expressions de
     * la même règle, jamais deux copies (patron `MOTIF_EMAIL` / `MOTIF_EMAIL_SQL`). La porte
     * les confronte **aux mêmes valeurs**, pour que la parité soit **mesurée** et non affirmée.
     * ✅ Aucun point dans ce motif ⇒ le piège d'échappement à deux étages (`\.` qui s'évalue en
     * point nu dans un gabarit JS, mesuré en 6.5 puis 6.10) **ne s'applique pas ici**. Ne pas
     * ajouter de point sans relire ce paragraphe.
     */
    check(
      "tournament_slug_valide",
      sql`${table.slug} ~ ${sql.raw(MOTIF_IDENTIFIANT_SQL)} and length(${table.slug}) <= ${sql.raw(String(IDENTIFIANT_MAX))}`,
    ),
    check(
      "tournament_venue_name_valide",
      sql`${table.venueName} is null or (length(btrim(${table.venueName})) > 0 and length(${table.venueName}) <= ${sql.raw(String(LIEU_MAX))})`,
    ),
    check(
      "tournament_format_text_valide",
      sql`${table.formatText} is null or (length(btrim(${table.formatText})) > 0 and length(${table.formatText}) <= ${sql.raw(String(FORMAT_MAX))})`,
    ),
    check(
      "tournament_prizes_valide",
      sql`${table.prizes} is null or (length(btrim(${table.prizes})) > 0 and length(${table.prizes}) <= ${sql.raw(String(LOTS_MAX))})`,
    ),
    check(
      "tournament_price_text_valide",
      sql`${table.priceText} is null or (length(btrim(${table.priceText})) > 0 and length(${table.priceText}) <= ${sql.raw(String(TOURNAMENT_TARIF_MAX))})`,
    ),
    /**
     * 🔴 LA FIN EST APRÈS LE DÉBUT — **PAS DE `coalesce` ICI, ET C'EST MESURÉ** (Story 9.6).
     *
     * Le raisonnement complet vit sur `event_fin_apres_debut`, à l'identique : le seul membre qui
     * pourrait valoir `NULL` est `ends_at > starts_at`, et il ne le peut **que** si `ends_at` est
     * `NULL` — cas déjà court-circuité par la branche de gauche, puisque `starts_at` est
     * `notNull`. La contrainte est **null-safe par construction**, comme
     * `tournament_podium_sans_trou_2`, et « la compléter » par mimétisme avec
     * `tournament_a_un_lieu` ajouterait une garde qui ne garde rien.
     * ⚠️ `>` et non `>=` : l'égalité est une saisie ratée, pas un tournoi.
     * ⚠️ Et la null-safety ne se mesure **pas** par une écriture — `gate:tournois` porte la garde
     * qui **LIT** le texte de la contrainte.
     */
    check(
      "tournament_fin_apres_debut",
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
    /**
     * Bornes NUMÉRIQUES, mêmes des deux côtés que Zod. Le plafond n'est pas de la préciosité :
     * sans lui, une valeur hors plage `int4` remonterait au bénévole sous la forme brute du
     * driver (« value out of range for type integer »), dans un écran dont tout le reste soigne
     * ses messages.
     */
    check(
      "tournament_match_duration_valide",
      sql`${table.matchDurationMinutes} is null or (${table.matchDurationMinutes} >= 1 and ${table.matchDurationMinutes} <= ${sql.raw(String(DUREE_MATCH_MAX))})`,
    ),
    check(
      "tournament_capacity_valide",
      sql`${table.capacity} is null or (${table.capacity} >= 1 and ${table.capacity} <= ${sql.raw(String(PLACES_MAX))})`,
    ),
    check(
      "tournament_registration_url_valide",
      sql`${table.registrationUrl} is null or (length(${table.registrationUrl}) <= ${sql.raw(String(URL_MAX))} and ${table.registrationUrl} ~ '^https?://')`,
    ),
    check(
      "tournament_podium_first_valide",
      sql`${table.podiumFirst} is null or (length(btrim(${table.podiumFirst})) > 0 and length(${table.podiumFirst}) <= ${sql.raw(String(PODIUM_MAX))})`,
    ),
    check(
      "tournament_podium_second_valide",
      sql`${table.podiumSecond} is null or (length(btrim(${table.podiumSecond})) > 0 and length(${table.podiumSecond}) <= ${sql.raw(String(PODIUM_MAX))})`,
    ),
    check(
      "tournament_podium_third_valide",
      sql`${table.podiumThird} is null or (length(btrim(${table.podiumThird})) > 0 and length(${table.podiumThird}) <= ${sql.raw(String(PODIUM_MAX))})`,
    ),
    /**
     * 🔴 UN PODIUM NE SAUTE PAS DE PLACE — et ces deux-là sont null-safe **par construction**,
     * pas par une branche ajoutée : `x is null` et `y is not null` rendent **toujours** un
     * booléen, jamais `NULL`. C'est la seule famille de contraintes de ce fichier qui n'a pas
     * eu à se poser la question, et le dire évite qu'on « complète » ces deux lignes par
     * mimétisme avec les douze précédentes.
     *
     * ⚠️ **AUCUN `CHECK` « podium seulement si le tournoi est passé » N'EST TENTÉ**, et ce
     * choix est ÉCRIT plutôt que découvert (AC4). La date qui déterminerait « passé » vit bien
     * sur cette ligne (`starts_at`), mais la comparer à `now()` dans un `CHECK` est **refusé
     * par Postgres** : une contrainte doit être IMMUABLE. Une ligne valide aujourd'hui
     * deviendrait invalide demain, et **toute restauration de sauvegarde échouerait** — le
     * jour précis où l'on en a le plus besoin. La règle est donc tenue **à l'affichage** (la
     * fiche ne montre le podium que d'un tournoi passé) et par une **garde de porte**.
     */
    check(
      "tournament_podium_sans_trou_2",
      sql`${table.podiumSecond} is null or ${table.podiumFirst} is not null`,
    ),
    check(
      "tournament_podium_sans_trou_3",
      sql`${table.podiumThird} is null or ${table.podiumSecond} is not null`,
    ),
    /**
     * 🔴 UNE MÊME ÉQUIPE N'OCCUPE PAS DEUX PLACES — AJOUTÉ APRÈS REVUE (migration `0015`).
     *
     * 🔬 Mesuré : `podium_first = podium_second = 'Team Alpha'` était **accepté**, par Zod comme
     * par la base. Les trois contraintes de longueur ne regardent qu'une colonne, et les deux
     * « sans trou » ne regardent que la **présence**. Un podium n'est pas une liste : c'est un
     * **classement**, et deux places identiques n'en est pas un.
     *
     * ⚠️ **UNE SECONDE MIGRATION DANS LA MÊME STORY, ET C'EST ÉCRIT PLUTÔT QUE MAQUILLÉ.** Le
     * témoin déclaré au cadrage était « migrations 14 → 15 » ; il devient **14 → 16**. Régénérer
     * la `0014` aurait donné un compte « conforme » — au prix d'une chirurgie DDL sur une base
     * déjà migrée, pour cacher qu'une revue a trouvé quelque chose. Le projet préfère un témoin
     * exact et expliqué à un témoin flatteur.
     *
     * 🔴 NULL-SAFE PAR CONSTRUCTION, ET LES DEUX BRANCHES SONT NÉCESSAIRES : `x <> y` vaut
     * **`NULL`** dès que l'une des deux colonnes est nulle — donc **PASSE**, exactement comme
     * `event_has_venue`. Les branches `is null` ne sont donc pas défensives ici, elles sont ce
     * qui rend la contrainte évaluable. ⚠️ Ne pas les « simplifier » en s'appuyant sur
     * `tournament_podium_sans_trou_*` : deux `CHECK` d'une même table sont **indépendants**, et
     * rien ne garantit qu'ils soient tous les deux en vigueur au même moment (une migration
     * peut en supprimer un).
     */
    check(
      "tournament_podium_2_distinct",
      sql`${table.podiumSecond} is null or ${table.podiumFirst} is null or ${table.podiumSecond} <> ${table.podiumFirst}`,
    ),
    check(
      "tournament_podium_3_distinct",
      sql`${table.podiumThird} is null or (${table.podiumFirst} is null or ${table.podiumThird} <> ${table.podiumFirst}) and (${table.podiumSecond} is null or ${table.podiumThird} <> ${table.podiumSecond})`,
    ),
    /**
     * Colonnes DANS L'ORDRE OÙ LA REQUÊTE S'EN SERVIRA : la liste publique (Story 9.2) filtre
     * sur `is_published` puis ordonne par `starts_at` — patron exact de
     * `event_published_starts_at_idx`, et un seul index sert les deux sens de la dérivation
     * « à venir » (`gt`) et « passés » (`lte`).
     */
    check("tournament_team_size_positive", sql`${table.teamSize} >= 1`),
    index("tournament_published_starts_at_idx").on(table.isPublished, table.startsAt),
    /** Sert la fiche `/tournois/<slug>` (Story 9.3) : lecture par identifiant lisible. */
    index("tournament_event_starts_at_idx").on(table.eventId, table.startsAt),
  ],
);

// ════════════════════════════════════════════════════════════════════════════════
// STRUCTURE D'UN TOURNOI — phases, engagés, rencontres (Story 10.1)
// ════════════════════════════════════════════════════════════════════════════════
//
// 🔴 UNE RENCONTRE OPPOSE DES ENGAGÉS, JAMAIS DES PERSONNES. Un engagé porte 1..N membres :
// l'individuel est une équipe d'un membre. C'est ce qui donne UN SEUL chemin de code — deux
// chemins (« joueur » / « équipe ») divergeraient en silence, et l'ajouter après coup
// obligerait à toucher toutes les tables et tout le moteur.
//
// ⚠️ Le podium reste sur `tournament` et n'est PAS redoublé ici. Un seul propriétaire par
// fait : il est écrit tantôt à la main, tantôt par le moteur, jamais dans deux colonnes.

export const tournamentPhaseKind = pgEnum("tournament_phase_kind", PHASE_KINDS);
export const tournamentPhaseState = pgEnum("tournament_phase_state", PHASE_STATES);
export const tournamentEntryState = pgEnum("tournament_entry_state", ENTRY_STATES);
export const tournamentMatchState = pgEnum("tournament_match_state", MATCH_STATES);
/** Le tableau auquel une rencontre appartient (Story 10.8) — voir `MATCH_BRACKETS`. */
export const tournamentMatchBracket = pgEnum("tournament_match_bracket", MATCH_BRACKETS);

/**
 * Une phase d'un tournoi. La structure saisie est un PLAN : elle se réécrit tant qu'aucune
 * rencontre n'a de résultat (`phaseLibrementModifiable`, `lib/tournoi/structure.ts`).
 */
export const tournamentPhase = pgTable(
  "tournament_phase",
  {
    id: uuid().primaryKey().defaultRandom(),
    // CASCADE et non RESTRICT, contrairement à `tournament.eventId` : une phase n'a aucune
    // existence hors de son tournoi, là où un événement d'agenda en a une.
    tournamentId: uuid()
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    name: text().notNull(),
    kind: tournamentPhaseKind().notNull(),
    /**
     * Le JOUR où cette phase se joue. `null` = non daté, et c'est le cas nominal d'un tournoi
     * qui tient sur une journée : on ne force personne à saisir une date sans objet.
     *
     * 🔴 UN `date` ET NON UN `timestamp` — LE SEUL DU SCHÉMA, ET C'EST UNE PARADE. La question
     * posée est « quel week-end ? », pas « à quelle seconde ». Un `timestamptz` rouvrirait
     * tout le piège d'heure murale que `lib/date-paris.ts` documente, pour une information qui
     * n'a pas d'heure. En `mode: "string"`, « 2026-09-06 » traverse la base et le rendu SANS
     * jamais devenir un instant : aucun fuseau ne peut le décaler d'un jour.
     *
     * ⚠️ Ce n'est PAS une redite de `tournament.starts_at` : celui-là dit quand le tournoi
     * commence, celle-ci quand CETTE manche se joue. Un TFT en rondes suisses sur quatre
     * week-ends a une seule date de début et quatre journées.
     */
    playedOn: date({ mode: "string" }),
    state: tournamentPhaseState().notNull().default("planifiee"),
    /**
     * Réglages PROPRES au format (taille des lobbies, nombre de tours…), validés à
     * l'écriture. Décision 4 du 2026-08-13 : colonnes typées pour ce qui est COMMUN à tous
     * les formats, document validé pour ce qui ne l'est pas.
     */
    settings: jsonb().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("tournament_phase_position_positive", sql`${table.position} >= 1`),
    check("tournament_phase_name_non_blanc", sql`length(btrim(${table.name})) > 0`),
    uniqueIndex("tournament_phase_ordre_unique").on(table.tournamentId, table.position),
  ],
);

/**
 * Un ENGAGÉ — une inscription, pas une personne. `displayName` est le nom de l'équipe, ou
 * celui du joueur en individuel.
 */
export const tournamentEntry = pgTable(
  "tournament_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    tournamentId: uuid()
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    displayName: text().notNull(),
    state: tournamentEntryState().notNull().default("inscrit"),
    /**
     * Identifiant chez MATELY. C'est la clé d'IDEMPOTENCE de la re-synchronisation
     * (Story 11.2) : sans elle, rejouer une ingestion créerait des doublons.
     */
    externalId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("tournament_entry_display_name_non_blanc", sql`length(btrim(${table.displayName})) > 0`),
    // Index PARTIEL : deux engagés saisis à la main portent tous deux `external_id` à NULL,
    // et un index unique ordinaire les compterait comme un doublon.
    uniqueIndex("tournament_entry_external_unique")
      .on(table.tournamentId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index("tournament_entry_tournoi_idx").on(table.tournamentId, table.state),
  ],
);

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LA PRÉSENCE D'UN ENGAGÉ **À UNE JOURNÉE** (2026-08-24)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 ELLE EXISTE PARCE QUE `tournament_entry.state` EST GLOBAL AU TOURNOI. Sur un TFT étalé
 * sur quatre week-ends, « présent au 2ᵉ, absent au 3ᵉ, revenu au 4ᵉ » n'était pas exprimable :
 * pointer le 3ᵉ ÉCRASAIT le 2ᵉ, et l'historique du week-end précédent disparaissait.
 *
 * ⚠️ **ELLE NE REMPLACE PAS `entry.state`, ELLE LE PRÉCISE** — et l'ordre compte, une seule
 * règle, écrite dans `lib/tournoi/presence.ts` : un **abandon** est global et l'emporte
 * toujours (qui a arrêté ne revient pas) ; sinon, la ligne de CETTE journée décide ; sinon,
 * l'état global sert de repli. Sans ce repli, un tournoi d'un jour — qui n'a aucune date de
 * phase — n'aurait plus personne de présent : c'est-à-dire que **tous les tournois existants
 * cesseraient de se générer**.
 *
 * ⚠️ La clé est la **DATE**, pas la phase : on pointe une fois par journée, pas à chaque
 * manche. Trois manches le même samedi partagent le même pointage.
 */
export const tournamentEntryAttendance = pgTable(
  "tournament_entry_attendance",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid()
      .notNull()
      .references(() => tournamentEntry.id, { onDelete: "cascade" }),
    /** Le jour pointé — la valeur de `tournament_phase.played_on`, une chaîne « AAAA-MM-JJ ». */
    playedOn: date({ mode: "string" }).notNull(),
    state: tournamentEntryState().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * ⚠️ SEULEMENT `present` OU `absent`. `inscrit` ne veut rien dire pour une journée (on
     * s'inscrit au tournoi, pas au samedi), et `abandonne` est GLOBAL : le noter par journée
     * laisserait écrire « abandonné le 12, présent le 19 », ce qui n'a pas de sens et
     * fabriquerait deux vérités. L'enum est partagé pour ne pas en créer un second ; c'est ce
     * `CHECK` qui le borne.
     */
    check(
      "tournament_entry_attendance_etat_du_jour",
      sql`${table.state} in ('present', 'absent')`,
    ),
    /** Un seul pointage par engagé et par journée — repointer MET À JOUR, jamais n'ajoute. */
    uniqueIndex("tournament_entry_attendance_unique").on(table.entryId, table.playedOn),
  ],
);

/**
 * Un membre d'un engagé. `userId` est facultatif et le restera : un seul membre de l'équipe
 * peut avoir un compte, les autres ne sont que des noms — une inscription n'est pas un compte.
 */
export const tournamentEntryMember = pgTable(
  "tournament_entry_member",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid()
      .notNull()
      .references(() => tournamentEntry.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    displayName: text().notNull(),
    // SET NULL : supprimer un compte ne doit pas effacer le nom de qui a joué.
    userId: uuid().references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    check("tournament_entry_member_position_positive", sql`${table.position} >= 1`),
    check(
      "tournament_entry_member_display_name_non_blanc",
      sql`length(btrim(${table.displayName})) > 0`,
    ),
    uniqueIndex("tournament_entry_member_ordre_unique").on(table.entryId, table.position),
  ],
);

/** Une rencontre d'une phase. `round` distingue les tours d'un bracket ou les journées. */
export const tournamentMatch = pgTable(
  "tournament_match",
  {
    id: uuid().primaryKey().defaultRandom(),
    phaseId: uuid()
      .notNull()
      .references(() => tournamentPhase.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    round: integer(),
    /**
     * 🔴 AJOUTÉE PAR LA STORY 10.8, ET C'EST UN TROU DU MODÈLE DE LA 10.1 QU'ELLE COMBLE.
     * `eliminationDouble()` rend trois structures parallèles ; sans cette colonne, « tour 2 des
     * perdants » et « tour 2 des vainqueurs » étaient indiscernables, donc la double élimination
     * était **ingérable en base** — un générateur écrit et testé en 10.2 que rien ne pouvait
     * restituer. Le dire plutôt que l'absorber en silence était la consigne de la 10.5.
     * ⚠️ `notNull()` avec un défaut, jamais nullable : voir `MATCH_BRACKETS`.
     */
    bracket: tournamentMatchBracket().notNull().default("principal"),
    state: tournamentMatchState().notNull().default("a_jouer"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("tournament_match_position_positive", sql`${table.position} >= 1`),
    // NULL-SAFE : `round >= 1` seul vaudrait NULL — donc PASSERAIT — sur la colonne nulle,
    // qui est le cas nominal d'une phase sans tours. Même défaut qu'`event_has_venue`.
    check("tournament_match_round_positive", sql`${table.round} is null or ${table.round} >= 1`),
    uniqueIndex("tournament_match_ordre_unique").on(table.phaseId, table.position),
  ],
);

/**
 * Une PLACE dans une rencontre.
 *
 * 🔴 `entryId` EST NULLABLE, ET C'EST LE LIVRABLE : une place vide, une exemption (*bye*), un
 * groupe plus petit qu'un autre. Le moteur actuel, avec ses lobbies de 8 pleins, ne le
 * prévoit pas — c'est une capacité à écrire, pas un cas limite à espérer.
 */
export const tournamentMatchSlot = pgTable(
  "tournament_match_slot",
  {
    id: uuid().primaryKey().defaultRandom(),
    matchId: uuid()
      .notNull()
      .references(() => tournamentMatch.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    // RESTRICT et non SET NULL : un engagé qui a joué ne se supprime pas, sinon sa place
    // deviendrait silencieusement une exemption et réécrirait l'histoire. Le pointage marque
    // `absent`, il ne supprime jamais.
    entryId: uuid().references(() => tournamentEntry.id, { onDelete: "restrict" }),
    score: integer(),
    rank: integer(),
    /**
     * 🔴 D'OÙ VIENT L'OCCUPANT DE CETTE PLACE (Story 10.8). C'est le `Source` que
     * `lib/tournoi/bracket.ts` rend déjà — tête de série, vainqueur d'une rencontre, ou perdant
     * d'une rencontre — **stocké tel quel**, à ceci près que les coordonnées de bracket.ts
     * (bracket + tour + rang dans le tour) sont traduites **une seule fois, à la génération**,
     * en la `position` de la rencontre visée, qui est unique dans la phase.
     *
     * 🔴 C'EST CE QUI DONNE **UNE** DÉFINITION DE LA PROGRESSION. Re-dériver « le vainqueur du
     * tour r rang p monte au tour r+1 rang ceil(p/2) » dans le code de saisie en ferait une
     * SECONDE définition de la structure, à côté de celle de `bracket.ts` — et elles
     * divergeraient au premier format ajouté, en silence. Ici la structure est décidée à un
     * seul endroit, et la base en garde l'image résolue.
     *
     * ⚠️ Nullable : une place peut exister sans provenance (une exemption au 1ᵉʳ tour, une
     * place saisie à la main). `null` ne veut donc PAS dire « vide ».
     */
    source: jsonb(),
  },
  (table) => [
    check("tournament_match_slot_position_positive", sql`${table.position} >= 1`),
    check("tournament_match_slot_score_positif", sql`${table.score} is null or ${table.score} >= 0`),
    check("tournament_match_slot_rank_positif", sql`${table.rank} is null or ${table.rank} >= 1`),
    uniqueIndex("tournament_match_slot_ordre_unique").on(table.matchId, table.position),
    // Un même engagé ne peut pas occuper deux places de la MÊME rencontre. Partiel : les
    // places vides sont plusieurs à porter `entry_id` à NULL, et c'est légitime.
    uniqueIndex("tournament_match_slot_engage_unique")
      .on(table.matchId, table.entryId)
      .where(sql`${table.entryId} is not null`),
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
// ✅ QUATRE TABLES DEPUIS LA STORY 8.1 (PR ②). Ce bloc disait « TROIS, PAS CINQ » et posait
// la limite mot pour mot : *« ajouter un provider e-mail plus tard exigera
// `verificationToken` ET sa migration »*. C'est ce jour-là — le lien magique arrive, la
// table est plus bas, sa migration est la 0025. La limite a été payée exactement comme elle
// avait été écrite, ce qui est le seul intérêt d'écrire une limite.
// ⚠️ `authenticator` (WebAuthn / passkeys) reste absente, et le reste : aucun consommateur.
//
// ⚠️ Aucun `CHECK` de non-blanc ici, contrairement à `partner`/`photo`/`solicitation`.
// Ce n'est pas un oubli : ces tables ne sont JAMAIS écrites par une saisie humaine ni
// rendues au public — elles sont écrites par l'adaptateur à partir de la réponse du
// fournisseur. Le garde-fou de cette surface n'est plus l'allowlist (la 8.1 l'a réduite à un
// noyau de secours) mais `user_role` : entrer ne donne rien, seul un rôle ouvre une porte.

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

/**
 * Jetons à usage unique du LIEN MAGIQUE (Story 8.1, PR ②).
 *
 * 🔴 CETTE TABLE N'EST JAMAIS LUE NI ÉCRITE PAR NOTRE CODE — c'est l'adaptateur Auth.js qui
 * s'en sert seul (`createVerificationToken` / `useVerificationToken`). Elle existe ici pour
 * UNE raison : les tables sont passées EXPLICITEMENT à `DrizzleAdapter` (voir
 * `auth/adapter.ts`), et une table manquante ferait que l'adaptateur en bâtirait une à lui,
 * absente de nos migrations. L'échec n'apparaîtrait qu'au premier envoi de lien magique.
 *
 * ⚠️ `token` EST DÉJÀ HACHÉ par Auth.js quand il arrive ici (HMAC de `AUTH_SECRET`) : la
 * valeur en base ne permet pas de fabriquer un lien. Ne pas « sécuriser » davantage cette
 * colonne, et surtout ne jamais la journaliser.
 *
 * ⚠️ Clé primaire COMPOSITE `(identifier, token)` : c'est le contrat de l'adaptateur, pas un
 * choix. Une même adresse peut donc avoir plusieurs demandes en cours — trois clics sur
 * « m'envoyer un lien » ne doivent pas s'invalider mutuellement.
 */
export const verificationToken = pgTable(
  "verification_token",
  {
    /** L'adresse e-mail à qui le lien a été envoyé. */
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

// ════════════════════════════════════════════════════════════════════════════════
// RÔLES — la table qui ouvre les portes (Story 8.1, arbitrage A2)
// ════════════════════════════════════════════════════════════════════════════════
//
// 🔴 LE RÔLE NE VIENT JAMAIS DU FOURNISSEUR. Jusqu'à la 8.1, entrer dans le back-office et
// être administrateur étaient le MÊME fait : `AUTH_ADMIN_DISCORD_IDS` décidait des deux, et
// `signIn` refusait tout le reste avant la moindre écriture. La story ouvre la connexion à
// d'autres comptes (Google, lien magique) ; à partir de là une ligne `user` ne prouve plus
// rien. C'est CETTE table, et elle seule, qui ouvre une porte.
//
// ⚠️ Une ligne par (compte, rôle) plutôt qu'une colonne `role` sur `user` : les deux rôles se
// CUMULENT (le compte de Brice porte les deux), et une colonne unique obligerait à inventer
// une valeur « les deux » — donc trois valeurs pour deux faits, qui divergeraient au
// troisième rôle.

/** Les valeurs vivent dans `lib/roles.ts` : elles sont lues aussi par le proxy et par un formulaire client. */
export const userRoleName = pgEnum("user_role_name", ROLES_ADMIN);

export const userRole = pgTable(
  "user_role",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: userRoleName().notNull(),
    /** Qui a donné ce rôle, et quand — A16 : un geste qui change des droits se trace. */
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid().references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    // 🔴 PK composite : un même compte ne peut pas porter deux fois le même rôle. Sans elle,
    // révoquer supprimerait UNE ligne et laisserait le droit ouvert par la seconde.
    primaryKey({ columns: [table.userId, table.role] }),
    // Sert la lecture faite À CHAQUE REQUÊTE d'administration (`server/auth/guard.ts`).
    index("user_role_user_id_idx").on(table.userId),
  ],
);

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
  // 🔴 `event → tournaments` : **UN événement peut en porter N** (A4). C'est le cas exact de
  // la Game'in Reims — un `event` de type `special`, dix animations. Le sens inverse
  // (`tournament → event`) est déclaré juste en dessous : c'est celui dont la fiche a besoin
  // pour nommer le lieu et l'occasion sans seconde requête.
  tournaments: many(tournament),
}));

export const tournamentRelations = relations(tournament, ({ one }) => ({
  event: one(event, { fields: [tournament.eventId], references: [event.id] }),
  // Le visuel vient de la GALERIE (A2) — pas d'une 4ᵉ famille de médias. Voir le bloc de
  // `tournament.photoId` pour ce que cet arbitrage évite.
  photo: one(photo, { fields: [tournament.photoId], references: [photo.id] }),
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
/**
 * 🔴 RÉ-EXPORT, PAS UNE SECONDE DÉFINITION (Story 6.5).
 *
 * Il valait `(typeof partnerCategory.enumValues)[number]` — provablement identique, puisque
 * l'enum est construit depuis `PARTNER_CATEGORIES`. Mais deux définitions du même type sont
 * deux endroits où quelqu'un peut en modifier une seule, et la 6.5 a besoin de ce type dans un
 * **formulaire client** : l'importer depuis ici y ferait entrer Drizzle. Le type naît donc là
 * où naissent les valeurs (`lib/schemas/partner.ts`) ; ce ré-export garde intacts les
 * importateurs existants (`/partenaires/page.tsx`).
 */
export type { PartnerCategory } from "../../lib/schemas/partner";
export type Photo = typeof photo.$inferSelect;
export type NewPhoto = typeof photo.$inferInsert;
export type Solicitation = typeof solicitation.$inferSelect;
export type NewSolicitation = typeof solicitation.$inferInsert;
export type SolicitationType = (typeof solicitationType.enumValues)[number];
export type Workshop = typeof workshop.$inferSelect;
export type NewWorkshop = typeof workshop.$inferInsert;
/**
 * 🔴 RÉ-EXPORT, PAS UNE SECONDE DÉFINITION — même montage que `PartnerCategory` (6.5), et
 * pour la même raison : le formulaire d'admin est un composant CLIENT, et un type venu d'ici
 * y ferait entrer Drizzle. Le type naît là où naissent les valeurs.
 */
export type { WorkshopFamily } from "../../lib/schemas/workshop";
export type Member = typeof member.$inferSelect;
export type NewMember = typeof member.$inferInsert;
export type SiteSetting = typeof siteSetting.$inferSelect;
export type NewSiteSetting = typeof siteSetting.$inferInsert;
export type Tournament = typeof tournament.$inferSelect;
export type NewTournament = typeof tournament.$inferInsert;
/**
 * 🔴 RÉ-EXPORTS, PAS DE SECONDES DÉFINITIONS — même montage que `PartnerCategory` (6.5) et
 * `WorkshopFamily` (6.9), et pour la même raison : le formulaire d'admin est un composant
 * CLIENT, et un type venu d'ici y ferait entrer Drizzle. Le type naît là où naissent les
 * valeurs (`lib/schemas/tournament.ts`).
 */
export type {
  TournamentRegistrationMode,
  TournamentRegistrationState,
} from "../../lib/schemas/tournament";
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Account = typeof account.$inferSelect;
export type Session = typeof session.$inferSelect;
export type VerificationToken = typeof verificationToken.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;
export type NewUserRole = typeof userRole.$inferInsert;
/** Ré-export : le type naît là où naissent les valeurs (`lib/roles.ts`), jamais deux fois. */
export type { RoleAdmin } from "../../lib/roles";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LE PROFIL D'UN JOUEUR (Story 12.1) — CE QUE `user` NE PEUT PAS PORTER
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 UNE TABLE À PART, ET `user` N'EST PAS TOUCHÉE. `user` appartient à **Auth.js** : son
 * contrat est celui de l'adaptateur, et le fournisseur y **réécrit `name` et `image` à chaque
 * connexion**. Y ranger le pseudo choisi sur le site le ferait écraser par le pseudo Discord
 * au prochain login — sans erreur, sans test rouge. La Story 8.1 a déjà payé cette famille :
 * *un type facultatif ne dit pas ce que la bibliothèque VÉRIFIE.*
 *
 * 🔴 PAR **PLATEFORME**, JAMAIS PAR JEU. `tournament.game` est du texte libre **volontairement**
 * (dix jeux au dossier GIR 2026, un enum imposerait une migration par tournoi) ; les plateformes,
 * elles, forment un ensemble **fermé et petit** — Riot couvre LoL, Valorant, TFT et 2XKO ; Steam
 * couvre CS2 et Rocket League. Trois colonnes typées valent mieux ici qu'une table de couples.
 *
 * ⚠️ **CE NE SONT PAS DES DONNÉES PRIVÉES D'ORGANISATION** : le pseudo Riot est celui qu'on voit
 * **en jeu et sur le stream**, donc celui qui paraîtra **dans les résultats** (Brice, 2026-08-25).
 * Il alimentera `tournament_entry.display_name` à l'inscription (Story 12.3) ; les bénévoles s'en
 * servent pour **inviter en lobby**. Aucune surface publique ne les rend en 12.1.
 *
 * ⚠️ **AUCUNE UNICITÉ SUR LE PSEUDO**, et c'est délibéré : deux personnes peuvent vouloir le même
 * nom, `tournament_entry.display_name` l'autorise déjà, et l'interdire ici créerait une friction
 * à l'inscription pour un problème que le site n'a pas.
 * ⚠️ **TOUT EST NULLABLE SAUF LA CLÉ** : un compte neuf n'a rien rempli, et l'écran doit pouvoir
 * le dire plutôt que refuser d'exister.
 */
export const userProfile = pgTable(
  "user_profile",
  {
    /**
     * ⚠️ CLÉ PRIMAIRE **ET** ÉTRANGÈRE : un compte a au plus un profil, et la base le tient —
     * pas le code. `cascade` parce qu'un profil n'a aucune existence hors de son compte, et que
     * la suppression de compte (RGPD) doit l'emporter sans qu'on y pense.
     */
    userId: uuid()
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Le nom que la personne veut porter **sur notre site**. */
    pseudo: text(),
    /**
     * 🔴 LE PSEUDO DISCORD **DÉCLARÉ**, ET CE N'EST PAS LE COMPTE DISCORD **LIÉ**.
     *
     * `account` porte le lien d'authentification, et son `providerAccountId` est l'identifiant
     * **numérique** — jamais le pseudo, qui se change en un clic (garde posée en 8.1). Ici, on
     * stocke le nom sous lequel on **joint** la personne sur le Discord de l'association.
     * ⚠️ Les deux sont indépendants : quelqu'un qui se connecte par **lien magique** n'a aucun
     * compte Discord lié et a pourtant un Discord. Les fusionner priverait ce cas — le nôtre,
     * pour l'équipe (Brice et Romani n'ont pas de compte Google sur leurs adresses).
     * ⚠️ Et il ne se **pré-remplit pas** depuis `user.name` : cette colonne porte le nom du
     * DERNIER fournisseur utilisé, sans dire lequel. Deviner y mettrait un nom Google.
     */
    discordPseudo: text(),
    /** Riot ID, tag compris (`Pseudo#EUW`) — c'est le tag qui rend l'invitation possible. */
    riotId: text(),
    steamId: text(),
    epicId: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * ⚠️ `is null or` SUR CHAQUE `CHECK` — SANS LUI LA CONTRAINTE SERAIT INERTE, et c'est un
     * défaut déjà payé sur ce projet (Story 6.3) : en SQL, `length(btrim(NULL)) > 0` vaut `NULL`,
     * et un `CHECK` qui vaut `NULL` **PASSE**. La garde ne s'appliquerait donc qu'aux lignes
     * remplies, ce qui est précisément le cas où elle sert.
     * ⚠️ `btrim` NE RETIRE PAS U+200B (dette R41) : `cleanText` reste le dernier filet au rendu.
     */
    check(
      "user_profile_pseudo_non_blanc",
      sql`${table.pseudo} is null or length(btrim(${table.pseudo})) > 0`,
    ),
    check(
      "user_profile_discord_non_blanc",
      sql`${table.discordPseudo} is null or length(btrim(${table.discordPseudo})) > 0`,
    ),
    check(
      "user_profile_riot_non_blanc",
      sql`${table.riotId} is null or length(btrim(${table.riotId})) > 0`,
    ),
    check(
      "user_profile_steam_non_blanc",
      sql`${table.steamId} is null or length(btrim(${table.steamId})) > 0`,
    ),
    check(
      "user_profile_epic_non_blanc",
      sql`${table.epicId} is null or length(btrim(${table.epicId})) > 0`,
    ),
  ],
);
