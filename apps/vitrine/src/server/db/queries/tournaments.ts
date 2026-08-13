// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` et les cinq autres familles de
// requêtes (garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne doit jamais être
// atteint depuis un composant client.
import "server-only";
import { db } from "../client";

/**
 * Lectures des tournois (Story 9.1, A21).
 *
 * Emplacement conforme à `architecture.md` (l.515) : une famille de requêtes par domaine sous
 * `server/db/queries/`. Les composants ne requêtent JAMAIS eux-mêmes — la page appelle puis
 * distribue en props (patron AC1 de la 3.2).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 « À VENIR » ET « PASSÉS » SE **DÉRIVENT DES DATES** — PATRON MESURÉ, PAS INVENTÉ
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Relevé le 2026-08-13 dans `queries/events.ts` : la dérivation existe **déjà** et s'écrit
 * `gt(table.startsAt, new Date())` / `lte(table.startsAt, new Date())`. On la **reprend**
 * telle quelle, à trois conséquences près qui sont toutes voulues :
 *
 *   · un tournoi pile à `now()` appartient à **« passés »** — `lte` d'un côté, `gt` de
 *     l'autre, exactement comme l'agenda. Deux frontières qui divergeraient d'un `>=` feraient
 *     apparaître ou disparaître un tournoi pendant une seconde, à un moment que personne ne
 *     saurait reproduire ;
 *   · **aucune colonne `is_past`** n'existe et il ne faut pas en ajouter (note d'architecture
 *     §6 ①) : un drapeau tenu à la main dérive, ce projet l'a payé en 6.13 ;
 *   · ⚠️ **ne pas confondre avec `registration_state`** : la dérivation par dates sert
 *     l'affichage, l'état des inscriptions est un fait distinct. Les mélanger produirait un
 *     tournoi « à venir » dont les inscriptions sont closes, ou l'inverse — deux situations
 *     parfaitement légitimes.
 *
 * 🔴 L'HORLOGE EST LUE **ICI**, PAS DANS LE RENDU. Lire l'heure pendant le rendu d'un
 * composant est une impureté (`react-hooks/purity` la refuse) : deux rendus du même arbre
 * pourraient répondre différemment. La couche données est déjà l'endroit où ce projet lit
 * l'heure — raisonnement écrit dans `getEventById`, repris tel quel.
 */

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 L'ORDRE EST EN SQL, ET IL EST **TOTAL** — CE N'EST PAS UNE PRÉCAUTION DE STYLE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `starts_at`, puis `name`, puis `id`, et chacun des trois termes a sa raison :
 *
 *   · `starts_at` — l'ordre chronologique, seul ordre qui ait un sens pour un tournoi ;
 *   · `name` ensuite, et ce n'est pas décoratif : **la Game'in Reims porte DIX animations sur
 *     deux jours**, et rien n'interdit que deux d'entre elles commencent à la même minute (le
 *     dossier GIR 2026 en décrit plusieurs en parallèle). Sans ce terme, deux tournois de même
 *     `starts_at` sortiraient dans un ordre que Postgres **ne garantit pas** ;
 *   · `id` en dernier, pour que l'ordre soit **TOTAL** : deux tournois de même date ET de même
 *     nom (un doublon de saisie, que rien n'interdit) laisseraient encore l'ordre indéterminé.
 *     Un tri départage tout ou n'est pas déterministe ; il n'y a pas de « suffisamment
 *     déterministe ».
 *
 * 🔴 ET L'ENJEU DEVIENT RÉEL À LA STORY 9.2 : `/tournois` sera `force-dynamic` comme les cinq
 * autres pages, donc la requête sera rejouée **à chaque visite**. Un ordre non total ferait
 * se réordonner la liste d'une visite à l'autre — un scintillement qu'on ne saurait pas
 * reproduire. Le raisonnement est celui de `queries/workshops.ts`, payé une fois pour toutes.
 * ⚠️ `gate:tournois` le **mesure** en rejouant la requête sur des lignes strictement à égalité.
 */
/**
 * Colonnes remontées au back-office. **EXPLICITES**, jamais `columns` omis : les remonter
 * toutes ferait croire au type dérivé que tout est disponible partout, et chargerait chaque
 * écran de données que personne ne consomme.
 *
 * ⚠️ Ici la liste est **complète à dessein** — la fiche d'édition écrit les douze champs, et
 * la liste affiche l'essentiel. Deux requêtes aux colonnes différentes coûteraient deux types
 * à tenir pour un gain nul sur une table dont chaque ligne fait quelques centaines d'octets.
 */
const COLONNES_ADMIN = {
  id: true,
  eventId: true,
  photoId: true,
  name: true,
  game: true,
  slug: true,
  startsAt: true,
  venueName: true,
  formatText: true,
  prizes: true,
  matchDurationMinutes: true,
  capacity: true,
  registrationMode: true,
  registrationUrl: true,
  registrationState: true,
  podiumFirst: true,
  podiumSecond: true,
  podiumThird: true,
  isPublished: true,
} as const;

/**
 * Tournois **à venir**, publiés **et non publiés** — pour le back-office.
 *
 * @param limite borne EXPLICITE, jamais de lecture non bornée. Une page dont le temps de rendu
 *   dépend du nombre d'entrées est un défaut qui n'apparaîtrait qu'une fois la base remplie —
 *   c'est-à-dire en production, chez quelqu'un d'autre. **« Généreux » n'est pas « non borné ».**
 */
export async function getUpcomingTournamentsForAdmin(limite: number) {
  return db.query.tournament.findMany({
    columns: COLONNES_ADMIN,
    where: (table, { gt }) => gt(table.startsAt, new Date()),
    orderBy: (table, { asc }) => [asc(table.startsAt), asc(table.name), asc(table.id)],
    with: { event: { columns: { id: true, title: true, startsAt: true } } },
    limit: limite,
  });
}

/**
 * Tournois **passés**, publiés et non publiés — **du plus récent au plus ancien**.
 *
 * ⚠️ L'ordre est inversé sur le PREMIER terme seulement (`desc(startsAt)`), les deux suivants
 * restant ascendants : ils ne servent qu'à **départager**, et les inverser aussi ne rendrait
 * pas l'ordre « plus décroissant » — seulement différent, sans raison.
 */
export async function getPastTournamentsForAdmin(limite: number) {
  return db.query.tournament.findMany({
    columns: COLONNES_ADMIN,
    where: (table, { lte }) => lte(table.startsAt, new Date()),
    orderBy: (table, { asc, desc }) => [desc(table.startsAt), asc(table.name), asc(table.id)],
    with: { event: { columns: { id: true, title: true, startsAt: true } } },
    limit: limite,
  });
}

/**
 * Une ligne de la liste du back-office, **dérivée de la requête** et non réécrite à la main :
 * ajouter une colonne à `COLONNES_ADMIN` met ce type à jour tout seul (patron `AdminWorkshop`).
 */
export type AdminTournament = Awaited<
  ReturnType<typeof getUpcomingTournamentsForAdmin>
>[number];

/**
 * Un tournoi par son identifiant, pour la fiche d'édition. `undefined` s'il n'existe plus.
 *
 * ⚠️ L'appelant doit avoir **validé l'identifiant** avant : un `id` malformé remis à une
 * colonne `uuid` fait lever Postgres (`invalid input syntax for type uuid`) → une erreur 500
 * là où la réponse juste est un 404. La validation vit dans la page, au bord.
 * ⚠️ Ne filtre PAS sur `is_published` : on édite aussi — et surtout — des brouillons.
 */
export async function getTournamentById(id: string) {
  return db.query.tournament.findFirst({
    columns: COLONNES_ADMIN,
    where: (table, { eq }) => eq(table.id, id),
    with: { event: { columns: { id: true, title: true, startsAt: true } } },
  });
}

/**
 * Vrai si cet identifiant lisible est **déjà pris** par un AUTRE tournoi.
 *
 * 🔴 CE N'EST PAS LE GARDE-FOU — C'EST LE MESSAGE. L'unicité est tenue par la contrainte
 * `tournament_slug_unique` en base, qui est la seule chose qu'un `UPDATE` direct ou une
 * restauration ne peut pas contourner. Cette lecture existe pour que le bénévole lise
 * « cette adresse est déjà utilisée par X » **avant** de perdre sa saisie, au lieu de recevoir
 * un `23505` traduit en une phrase générique.
 * ⚠️ Elle est donc **intrinsèquement sujette à une course** : deux créations simultanées
 * peuvent la passer toutes les deux. C'est sans gravité **précisément parce que** la base
 * tranche derrière — et l'action traduit alors le `23505` en une phrase utilisable.
 *
 * @param idExclu l'identifiant du tournoi en cours d'édition, pour qu'il ne se signale pas
 *   lui-même comme doublon. `null` à la création.
 */
export async function slugDejaPris(slug: string, idExclu: string | null) {
  const ligne = await db.query.tournament.findFirst({
    columns: { id: true, name: true },
    where: (table, { eq }) => eq(table.slug, slug),
  });
  if (!ligne) return null;
  if (idExclu !== null && ligne.id === idExclu) return null;
  return ligne;
}

/**
 * Les événements d'agenda proposables au rattachement (A4 : le lien est **obligatoire**).
 *
 * 🔴 LA LISTE N'EST PAS FILTRÉE SUR `is_published`, ET C'EST DÉLIBÉRÉ. Un bénévole prépare la
 * Game'in Reims **des semaines à l'avance**, événement d'agenda en brouillon compris : ne
 * proposer que le publié rendrait impossible de préparer un tournoi avant d'annoncer son
 * événement — c'est-à-dire l'ordre de travail réel.
 * ⚠️ Elle n'est pas non plus filtrée sur « à venir » : on saisit aussi le **podium** d'un
 * tournoi passé (A23 ①), donc on doit pouvoir en créer un rétrospectivement.
 * L'écran, lui, **dit** l'état de publication de chaque événement — sans quoi on rattacherait
 * un tournoi à un brouillon sans le savoir.
 */
export async function getEventsPourRattachement(limite: number) {
  return db.query.event.findMany({
    columns: { id: true, title: true, startsAt: true, isPublished: true },
    orderBy: (table, { asc, desc }) => [desc(table.startsAt), asc(table.title), asc(table.id)],
    limit: limite,
  });
}

/** Une option de rattachement, dérivée de la requête. */
export type EvenementRattachable = Awaited<
  ReturnType<typeof getEventsPourRattachement>
>[number];

/**
 * Les photos proposables comme **visuel** de tournoi (arbitrage **A2**).
 *
 * 🔴 **FILTRÉE SUR `is_published`, ET C'EST L'INVERSE DE LA LISTE DES ÉVÉNEMENTS.** Le
 * rattachement à un événement accepte un brouillon (on prépare la Game'in Reims des semaines à
 * l'avance) ; le visuel, non — et le motif est **mesuré**, pas esthétique : la route
 * `/medias/[filename]` ne sert **que** les photos publiées (garde de la Story 6.4). Proposer un
 * brouillon reviendrait à laisser choisir un visuel qui ne s'afficherait **jamais**, sans que
 * rien ne le dise. C'est l'« écart assumé » d'A2, refermé au point de saisie plutôt que subi.
 *
 * ⚠️ `alt` est le libellé montré au bénévole, et c'est le bon choix : il est **obligatoire**
 * depuis la 4.3 (NFR3) et il **décrit** l'image, là où `caption` la **commente** et peut être
 * absent. Confondre les deux livrerait une liste d'options vides.
 */
export async function getPhotosPourVisuel(limite: number) {
  return db.query.photo.findMany({
    columns: { id: true, filename: true, alt: true },
    where: (table, { eq }) => eq(table.isPublished, true),
    orderBy: (table, { asc, desc }) => [desc(table.createdAt), asc(table.alt), asc(table.id)],
    limit: limite,
  });
}

/** Une photo proposable en visuel, dérivée de la requête. */
export type PhotoVisuel = Awaited<ReturnType<typeof getPhotosPourVisuel>>[number];
