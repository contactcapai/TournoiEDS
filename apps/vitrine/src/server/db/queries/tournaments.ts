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

/* ═══════════════════════════════════════════════════════════════════════════════
   LECTURES PUBLIQUES (Story 9.2)

   🔴 ELLES VIVENT ICI, DANS LA MÊME FAMILLE QUE CELLES DU BACK-OFFICE, ET C'EST LE
   PATRON DÉJÀ ÉCRIT DANS `queries/events.ts` : `architecture.md` l.508 pose une
   famille de requêtes **par domaine**, pas par public. Un `queries/public-tournaments.ts`
   parallèle serait une **seconde définition** de « un tournoi » — au premier changement
   de schéma, les deux divergeraient.

   ⚠️ LA DIFFÉRENCE TIENT EN UNE LIGNE, ET C'EST TOUTE LA FRONTIÈRE : les deux lectures
   ci-dessous filtrent sur `is_published`, celles du back-office **ne filtrent pas**.
   Ne JAMAIS relâcher ce filtre « pour réutiliser » — ce serait une fuite de brouillons
   sur une page publique, et **aucune porte visuelle ne la verrait** (une page qui
   affiche un tournoi de plus n'a pas l'air cassée). C'est la garde ⑭ de `gate:tournois`,
   RETOURNÉE par cette story, qui la mesure — avec un témoin **brouillon** dont
   l'attendu est l'absence, et un témoin **publié** dont l'attendu est la présence.
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Colonnes remontées à la **liste publique** — EXPLICITES, et **strictement** celles que
 * la carte rend (AC4 de la Story 9.2).
 *
 * 🔴 CE QUI N'EST PAS ICI EST UN PÉRIMÈTRE, PAS UN OUBLI — arbitrage **A6** :
 *   · `slug` — la 9.2 ne rend **aucun lien** (arbitrage **A1** : la fiche
 *     `/tournois/<slug>` n'existe pas avant la 9.3, et `CLAUDE.md` §5 interdit
 *     autant la page *stub* que le `href="#"`). Une colonne remontée que personne ne
 *     rend ferait croire au type dérivé qu'une destination existe ;
 *   · `formatText`, `prizes`, `matchDurationMinutes`, `capacity`, `registrationMode`,
 *     `registrationUrl` — c'est le **détail du format** et le **comment s'inscrire**
 *     d'A23 ③ ②, donc le livrable de la **fiche** (Story 9.3). La liste montre ce
 *     qu'il faut pour **choisir**, la fiche montrera le reste.
 * ⚠️ Les ajouter ici avant leur consommateur serait la 3ᵉ prop « au cas où » que ce
 * projet refuse depuis `SectionHead`.
 */
const COLONNES_PUBLIQUES = {
  id: true,
  name: true,
  game: true,
  startsAt: true,
  venueName: true,
  registrationState: true,
  podiumFirst: true,
  podiumSecond: true,
  podiumThird: true,
} as const;

/**
 * Le **visuel** du tournoi, remonté avec lui (arbitrage **A2** : une photo de la galerie,
 * pas une 4ᵉ famille de médias).
 *
 * 🔴 `isPublished` EST REMONTÉ, ET CE N'EST PAS DÉCORATIF — C'EST LA SEULE CHOSE QUI
 * EMPÊCHE UNE IMAGE MORTE. La route `/medias/[filename]` ne sert **que** les photos
 * publiées (garde de la Story 6.4, qui répond **404 et jamais 403** pour ne pas
 * confirmer l'existence d'un brouillon). Le formulaire d'admin ne propose, lui, que des
 * photos publiées (`getPhotosPourVisuel`) — mais **rien n'empêche de dépublier ensuite
 * une photo déjà choisie**, et `photo_id` reste alors intact (la dépublication n'est pas
 * une suppression, donc `ON DELETE SET NULL` ne joue pas).
 * ⇒ Sans ce booléen, la carte rendrait un `<img>` vers une URL qui répond **404**, avec
 * un cadre vide à la place du visuel. Le rendu **DÉCIDE** donc, il ne suppose pas.
 * ⚠️ `gate:images` le verrait (elle exige 200 + octets d'image sur toute URL référencée
 * par une page) — mais seulement **après** qu'un bénévole ait dépublié la photo. Le
 * traiter à la lecture, c'est ne jamais servir l'URL morte.
 */
const RELATION_VISUEL = {
  photo: { columns: { filename: true, alt: true, isPublished: true } },
} as const;

/**
 * Les `limite` prochains tournois **PUBLIÉS**, du plus proche au plus lointain.
 *
 * 🔴 LA DÉRIVATION EST REPRISE DE `queries/events.ts`, PAS RÉINVENTÉE — `gt` ici, `lte`
 * dans la jumelle : un tournoi **pile à `now()`** appartient donc à « passés », et à
 * exactement **une** des deux listes. Avec `lt` des deux côtés il disparaîtrait des deux,
 * avec `gte` il apparaîtrait dans les deux. Le cas est d'une probabilité infime, et c'est
 * justement pour ça qu'il ne serait jamais diagnostiqué. Même frontière que l'agenda,
 * même frontière que les deux lectures d'admin juste au-dessus : **une seule définition
 * de « à venir » dans le dépôt** (note d'architecture §6 ①).
 *
 * 🔴 ET L'ORDRE EST **TOTAL** — le raisonnement complet est en tête de fichier, mais
 * l'enjeu devient réel ICI : `/tournois` est `force-dynamic`, donc cette requête est
 * rejouée **à chaque visite**. Un ordre partiel ferait se réordonner la liste d'une
 * visite à l'autre, sur un scintillement que personne ne saurait reproduire.
 *
 * ⚠️ L'horloge est lue **dans cette couche** et jamais pendant le rendu : lire l'heure
 * dans un composant est une impureté que `react-hooks/purity` refuse, et deux rendus du
 * même arbre pourraient répondre différemment.
 *
 * @param limite borne EXPLICITE, jamais de lecture non bornée — une page dont le temps de
 *   rendu dépend du volume saisi est un défaut qui n'apparaîtrait qu'en production, chez
 *   quelqu'un d'autre. **« Généreux » n'est pas « non borné ».**
 */
async function getUpcomingTournaments(limite: number, maintenant: Date) {
  return db.query.tournament.findMany({
    columns: COLONNES_PUBLIQUES,
    where: (table, { and, eq, gt }) =>
      and(eq(table.isPublished, true), gt(table.startsAt, maintenant)),
    orderBy: (table, { asc }) => [asc(table.startsAt), asc(table.name), asc(table.id)],
    with: RELATION_VISUEL,
    limit: limite,
  });
}

/**
 * Les `limite` derniers tournois **PUBLIÉS** déjà passés, du plus récent au plus ancien.
 *
 * Jumelle exacte de `getUpcomingTournaments` : même table, même relation, même index
 * (`tournament_published_starts_at_idx`), même comparaison brute à `now()`. La borne
 * s'inverse et le **premier** terme de l'ordre aussi — les deux suivants restent
 * ascendants, ils ne servent qu'à **départager** et les inverser ne rendrait pas l'ordre
 * « plus décroissant », seulement différent, sans raison.
 *
 * ⚠️ **LES TOURNOIS PASSÉS RESTENT LISTÉS, ET NE DISPARAISSENT JAMAIS TOUT SEULS**
 * (arbitrage **A3**) : c'est l'**historique de l'association**, et c'est ce que le
 * back-office promet déjà au bénévole (« un tournoi descend ici tout seul une fois sa
 * date franchie »). La bascule « à venir » → « passés » **n'est pas un geste** : elle se
 * dérive de la date, ici, à chaque requête.
 */
async function getPastTournaments(limite: number, maintenant: Date) {
  return db.query.tournament.findMany({
    columns: COLONNES_PUBLIQUES,
    where: (table, { and, eq, lte }) =>
      and(eq(table.isPublished, true), lte(table.startsAt, maintenant)),
    orderBy: (table, { asc, desc }) => [desc(table.startsAt), asc(table.name), asc(table.id)],
    with: RELATION_VISUEL,
    limit: limite,
  });
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LES DEUX LISTES DE `/tournois`, ET **UNE SEULE LECTURE D'HORLOGE POUR LES DEUX**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * C'est le point d'entrée public unique : les deux fonctions ci-dessus ne sont pas exportées,
 * et l'instant leur est **passé**, jamais relu.
 *
 * 🔬 POURQUOI — DÉFAUT TROUVÉ EN REVUE (angle données), ET IL EST RÉEL BIEN QU'INFIME.
 * La version précédente appelait `new Date()` **dans chacune** des deux fonctions, lancées en
 * `Promise.all`. Si les deux appels tombent de part et d'autre d'une frontière de milliseconde,
 * on obtient deux instants `T1 < T2`, et un tournoi dont `starts_at` vaut exactement un point
 * de `]T1, T2]` satisfait **les deux** conditions (`> T1` **et** `<= T2`) : il sort dans les
 * DEUX listes, donc s'affiche deux fois — sur une visite, et jamais sur la suivante.
 * ⚠️ Le symptôme est **irreproductible par construction**, ce qui est précisément ce qui rend
 * ce genre de défaut coûteux : il ne se diagnostique pas, il s'explique.
 * ⇒ Avec un instant unique, la frontière est la MÊME des deux côtés (`gt` / `lte`) : un tournoi
 * appartient à **exactement une** des deux listes, quelle que soit sa date. La propriété
 * devient structurelle au lieu d'être probable.
 *
 * ⚠️ **ET L'HORLOGE RESTE LUE DANS LA COUCHE DONNÉES**, pas dans le rendu : c'est ici, et non
 * dans `page.tsx`, que `new Date()` est appelé. Faire lire l'heure à la page aurait fermé la
 * fenêtre en rouvrant l'impureté que `react-hooks/purity` refuse.
 *
 * 🔴 **LA MÊME FENÊTRE EXISTE SUR QUATRE SURFACES ANTÉRIEURES** — mesuré le 2026-08-14 par
 * relevé des appelants : `/agenda` (`getUpcomingEvents` + `getPastEvents`), `/admin/agenda`,
 * `/admin/galerie/nouveau` et `/admin/galerie/[id]` (les paires `…ForAdmin`), plus
 * `/admin/tournois`. Elles ne sont **pas** corrigées ici : ce sont cinq surfaces mergées,
 * hors périmètre de cette story. Dette **R48**, consignée avec sa condition de réouverture.
 */
export async function getPublicTournaments(aVenirMax: number, passesMax: number) {
  const maintenant = new Date();
  const [aVenir, passes] = await Promise.all([
    getUpcomingTournaments(aVenirMax, maintenant),
    getPastTournaments(passesMax, maintenant),
  ]);
  return { aVenir, passes };
}

/**
 * Une carte de la liste publique, **dérivée de la requête** et non réécrite à la main :
 * ajouter une colonne à `COLONNES_PUBLIQUES` met ce type à jour tout seul.
 *
 * ⚠️ Nommé d'après son PUBLIC et non d'après l'une de ses deux listes : `/tournois` rend
 * les à venir **et** les passés avec exactement la même forme. Un type nommé
 * `UpcomingTournament` aurait poussé à en déclarer un second, identique — c'est la leçon
 * de `AgendaEvent`, écrite dans `queries/events.ts`.
 */
export type PublicTournament = Awaited<ReturnType<typeof getUpcomingTournaments>>[number];

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
