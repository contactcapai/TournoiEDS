// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` et les cinq autres familles de
// requêtes (garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne doit jamais être
// atteint depuis un composant client.
import "server-only";
import { and, eq, gte, lte, min } from "drizzle-orm";
import { cache } from "react";

import { ajouterJours, debutDuJourParis, jourParis } from "@/lib/date-paris";
import { fusionnerCeQuiSeJoue } from "@/lib/tournoi/en-cours";
import { db } from "../client";
import { tournament, tournamentPhase } from "../schema";

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
  // Story 9.6 : la fiche d'édition écrit les deux, donc elle doit d'abord les LIRE — sans quoi
  // le formulaire s'ouvrirait vide sur une valeur existante et la première soumission
  // l'effacerait, en silence et sans erreur.
  endsAt: true,
  priceText: true,
  venueName: true,
  formatText: true,
  prizes: true,
  matchDurationMinutes: true,
  capacity: true,
  // Sans elle, le formulaire s'ouvrirait sur le défaut (1) et le premier enregistrement
  // écraserait un « 5 » déjà saisi — même défaut que celui décrit plus haut pour `endsAt`.
  teamSize: true,
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
 *   · `formatText`, `prizes`, `matchDurationMinutes`, `capacity`, `registrationMode`,
 *     `registrationUrl` — c'est le **détail du format** et le **comment s'inscrire**
 *     d'A23 ③ ②, donc le livrable de la **fiche** (`COLONNES_FICHE`, plus bas). La
 *     liste montre ce qu'il faut pour **choisir**, la fiche montre le reste.
 * ⚠️ Les ajouter ici avant leur consommateur serait la 3ᵉ prop « au cas où » que ce
 * projet refuse depuis `SectionHead`.
 *
 * 🔴 **`slug` A REJOINT CETTE LISTE À LA STORY 9.3, ET LE MOTIF DE SON ABSENCE EST MORT
 * AVEC ELLE.** Il disait : *« la 9.2 ne rend aucun lien (arbitrage A1) […] une colonne
 * remontée que personne ne rend ferait croire au type dérivé qu'une destination
 * existe »*. **A1 s'est inversé** : la fiche `/tournois/<slug>` existe, et chaque carte
 * est désormais un lien vers elle. Le raisonnement était juste — il n'a simplement plus
 * d'objet, et le laisser écrit ferait chercher une règle qui n'existe plus
 * (`pieges/cadrage-perime.md`).
 */
const COLONNES_PUBLIQUES = {
  id: true,
  name: true,
  game: true,
  slug: true,
  startsAt: true,
  /**
   * 🔴 `endsAt` ET `priceText` REJOIGNENT LA LISTE À LA STORY 9.6, ET CE N'EST PAS UN ÉLARGISSEMENT
   * DE CONFORT. La règle écrite ci-dessus tient — *« la liste montre ce qu'il faut pour CHOISIR,
   * la fiche montre le reste »* — et ces deux-là sont précisément **ce qu'il faut pour choisir** :
   * combien ça coûte et jusqu'à quelle heure, c'est-à-dire ce qui décide qu'on se déplace ou non.
   * C'est le motif littéral de la story (dettes R55 et R56).
   */
  endsAt: true,
  priceText: true,
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
 * hors périmètre de cette story. Dette **R49**, consignée avec sa condition de réouverture.
 */
export async function getPublicTournaments(
  aVenirMax: number,
  passesMax: number,
  enCoursMax: number,
) {
  // 🔴 UNE SEULE LECTURE D'HORLOGE POUR LES TROIS LISTES (patron `getUpcomingRendezVous`).
  // La dette R49 recense CINQ surfaces qui lisent l'heure deux fois pour deux listes
  // complémentaires ; l'ajout d'un troisième panier était l'occasion d'en créer une sixième.
  // ⚠️ Et l'horloge reste lue DANS LA COUCHE DONNÉES, jamais pendant le rendu : lire l'heure
  // dans un composant est une impureté que `react-hooks/purity` refuse.
  const maintenant = new Date();
  const [aVenir, passes, enCours] = await Promise.all([
    getUpcomingTournaments(aVenirMax, maintenant),
    getPastTournaments(passesMax, maintenant),
    getTournoisEnCoursPublies(maintenant, enCoursMax),
  ]);

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 LE DÉDOUBLONNAGE N'EST PAS UN CONFORT — SANS LUI, UN TOURNOI PARAÎT DEUX FOIS
  // ══════════════════════════════════════════════════════════════════════════════════════
  // Et il tombe dans l'un OU l'autre des deux paniers selon l'heure qu'il est : un tournoi
  // qui se joue ce matin a `starts_at` dans le passé, donc il est dans « passés » — pendant
  // qu'il se joue. Un tournoi qui commence ce soir est dans « à venir ». **Les deux cas
  // existent le même jour**, d'où un filtre sur les DEUX listes et pas seulement sur une.
  // ⚠️ C'est aussi ce qui répare une incohérence antérieure à cette story : jusqu'ici, un
  // tournoi en train de se jouer s'affichait sous le titre « Déjà joués ».
  const enCoursIds = new Set(enCours.map((tournoi) => tournoi.id));
  return {
    enCours,
    aVenir: aVenir.filter((tournoi) => !enCoursIds.has(tournoi.id)),
    passes: passes.filter((tournoi) => !enCoursIds.has(tournoi.id)),
  };
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

/* ═══════════════════════════════════════════════════════════════════════════════
   LA FICHE PUBLIQUE (Story 9.3, A20/A23)
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Colonnes de la **fiche** — le contenu complet d'**A23**, et rien de plus.
 *
 * 🔴 UNE LECTURE À PART, ET PAS `COLONNES_PUBLIQUES` ÉLARGIE. La liste et la fiche ne
 * montrent pas la même chose, et c'était déjà écrit sur `COLONNES_PUBLIQUES` : *« la liste
 * montre ce qu'il faut pour choisir, la fiche montre le reste »*. Élargir la liste ferait
 * remonter **six** colonnes à chaque carte de `/tournois` — jusqu'à cinquante par visite,
 * sur une page `force-dynamic` — pour un rendu qui n'en consomme aucune.
 *
 * ⚠️ `isPublished` n'est **pas** remonté : la lecture le **filtre** (voir plus bas). Le
 * remonter laisserait croire au rendu qu'il a une décision à prendre, alors que la ligne
 * qui arrive ici est publiée **par construction**.
 */
const COLONNES_FICHE = {
  id: true,
  name: true,
  game: true,
  slug: true,
  startsAt: true,
  // Story 9.6 — contenu d'A23 ①, ÉTENDU par cette story (tarif et horaire de fin), et la note
  // d'architecture §13 est corrigée à la source plutôt que contournée ici.
  endsAt: true,
  priceText: true,
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
} as const;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA FICHE D'UN TOURNOI **PUBLIÉ**, PAR SON ADRESSE LISIBLE — `undefined` SINON
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **LE FILTRE `is_published` EST LA FRONTIÈRE PUBLIQUE, ET IL NE SE RELÂCHE JAMAIS.**
 * C'est la règle écrite en tête de cette section (« ne JAMAIS relâcher ce filtre pour
 * réutiliser ») : sans lui, `/tournois/<slug>` servirait les **brouillons** à qui devine
 * une adresse. ⚠️ Et l'appelant rend alors **404, jamais 403** — patron de
 * `/medias/[filename]` (Story 6.4) : un 403 **confirme l'existence** de ce qu'il refuse,
 * donc il dit au curieux qu'un tournoi se prépare sous ce nom.
 *
 * 🔴 **LA CLÉ EST LE `slug`, PAS L'`uuid` (A3).** Il est **unique en base**
 * (`tournament_slug_unique`) et **gelé à la publication** (garde ⑬ de `gate:tournois`) :
 * une adresse partagée par MATELY, un flyer ou une description de stream **ne se casse
 * pas**. Servir la même fiche sous `/tournois/<uuid>` créerait une seconde adresse pour
 * le même contenu — deux vérités, et du contenu dupliqué pour les moteurs.
 * ⚠️ Aucune validation de forme n'est faite ici et **ce n'est pas un oubli** : contrairement
 * à `getTournamentById`, un `slug` malformé est une comparaison de `text` parfaitement
 * légale pour Postgres. Il ne rend donc aucune ligne — pas une erreur 500.
 *
 * 🔴 **`estPasse` EST CALCULÉ ICI, JAMAIS DANS LE RENDU** — patron `getEventById`, repris
 * tel quel : lire l'horloge pendant le rendu est l'impureté que `react-hooks/purity`
 * refuse. Et la frontière est **la même que partout ailleurs dans ce dépôt** (`<=`, donc
 * un tournoi pile à `now()` est passé) : il n'y a **qu'une seule définition de « à venir »
 * dans le dépôt**, et une fiche qui divergerait de sa propre carte serait indiagnosticable.
 *
 * ⚠️ **L'ÉVÉNEMENT EST REMONTÉ AVEC SON `isPublished`, ET C'EST UNE GARDE.** Mesuré le
 * 2026-08-14 : `getEventsPourRattachement` **ne filtre pas** sur la publication (à dessein
 * — on prépare la Game'in Reims des semaines à l'avance), et `actions/tournois.ts` ne
 * **couple pas** les deux publications. Un tournoi publié peut donc être rattaché à un
 * événement **brouillon**. Sans ce booléen, la fiche publierait le titre d'un brouillon
 * d'agenda — et **aucune porte visuelle ne le verrait** : une page qui affiche une ligne de
 * plus n'a pas l'air cassée. Le rendu **DÉCIDE**, il ne suppose pas (même raisonnement,
 * mot pour mot, que `RELATION_VISUEL` sur les photos dépubliées).
 *
 * 🔴 **`cache()` — MÉMOÏSATION PAR REQUÊTE, ET UN CONSOMMATEUR RÉEL L'EXIGE** (défaut trouvé en
 * revue). La page `/tournois/<slug>` appelle cette lecture **deux fois** pour une seule visite :
 * une fois dans `generateMetadata` (pour le `<title>` et les `og:*`), une fois dans le corps de
 * la page. Sans mémoïsation, c'est **deux requêtes SQL identiques**, relations comprises, à
 * chaque affichage d'une page `force-dynamic`.
 * ⚠️ Next ne déduplique **que** les appels à `fetch()` : une fonction Drizzle quelconque n'en
 * bénéficie pas, seul `cache()` de React le fait, et à l'intérieur d'un seul rendu de requête.
 * ⇒ Le patron existait **déjà** dans ce dépôt et pour la même raison : `lireReglages`
 * (`queries/settings.ts`) est enveloppée ainsi parce que le layout et la page l'appellent tous
 * les deux. Ce n'est donc pas une optimisation inventée ici, c'est une convention interne qui
 * manquait à cette lecture.
 * ⚠️ **CE N'EST PAS UN CACHE APPLICATIF** : la mémoïsation ne vit que le temps d'une requête, et
 * ne survit à aucune visite suivante. Le raisonnement complet est écrit sur `lireReglages`.
 */
export const getTournamentBySlug = cache(async function getTournamentBySlug(slug: string) {
  const ligne = await db.query.tournament.findFirst({
    columns: COLONNES_FICHE,
    where: (table, { and, eq }) => and(eq(table.isPublished, true), eq(table.slug, slug)),
    with: {
      ...RELATION_VISUEL,
      event: { columns: { id: true, title: true, startsAt: true, isPublished: true } },
    },
  });
  if (!ligne) return undefined;
  return { ...ligne, estPasse: ligne.startsAt <= new Date() };
});

/**
 * Ce qu'il faut pour rendre une fiche, dérivé de la requête.
 *
 * ⚠️ `…Data` et non `FicheTournoi` tout court : `components/tournois/FicheTournoi/` porte le
 * COMPOSANT de ce nom, et deux exports homonymes dans le même import se seraient renommés à
 * l'usage — c'est-à-dire deux noms pour la même chose, au premier fichier venu.
 */
export type FicheTournoiData = NonNullable<Awaited<ReturnType<typeof getTournamentBySlug>>>;

/**
 * La même fiche, **par identifiant et SANS filtre de publication** — pour l'aperçu du bénévole.
 *
 * 🔴 ELLE REND **EXACTEMENT LA MÊME FORME** QUE `getTournamentBySlug`, ET C'EST LE LIVRABLE.
 * L'aperçu doit montrer *« le tournoi tel qu'il apparaîtra sur le site »* : il rend donc le
 * composant public RÉEL, qui exige ce type. Une forme approchante obligerait l'aperçu à
 * fabriquer les champs manquants — c'est-à-dire à **affirmer** un rendu au lieu de le montrer,
 * dans l'écran dont le métier est précisément de dire la vérité sur le rendu public.
 *
 * ⚠️ **PAS DE FILTRE `is_published`, ET C'EST TOUT SON INTÉRÊT** : on prévisualise surtout des
 * brouillons. La contrepartie est que **cette lecture ne doit JAMAIS être appelée depuis une
 * surface publique** — l'appelant est un écran d'admin dont la garde est la première
 * instruction. C'est la même contrepartie, écrite au même endroit, que `getTournamentById`.
 * ⚠️ L'`id` doit être **validé** par l'appelant : un `uuid` malformé fait lever Postgres
 * (`invalid input syntax for type uuid`) → une 500 là où la réponse juste est un 404.
 *
 * ⚠️ **L'ÉVÉNEMENT RATTACHÉ GARDE SON FILTRE**, lui : le composant masque un événement non
 * publié, et l'aperçu doit montrer **ce que le public verra** — donc le masquer aussi. Le
 * bénévole qui ne voit pas apparaître son événement en apprend la raison au bon moment.
 */
export async function getTournamentApercuById(id: string) {
  const ligne = await db.query.tournament.findFirst({
    // ⚠️ `isPublished` EN PLUS des colonnes de la fiche, et **d'un seul côté** : la lecture
    // publique n'en a pas besoin (elle FILTRE dessus, donc la réponse est toujours `true` et
    // le rendu n'a aucune décision à prendre), l'aperçu si — il doit dire au bénévole si ce
    // qu'il regarde est déjà en ligne. Une colonne de plus rend l'objet assignable au type de
    // la fiche sans le modifier : le composant ne la voit pas, l'écran d'admin oui.
    columns: { ...COLONNES_FICHE, isPublished: true },
    where: (table, { eq }) => eq(table.id, id),
    with: {
      ...RELATION_VISUEL,
      event: { columns: { id: true, title: true, startsAt: true, isPublished: true } },
    },
  });
  if (!ligne) return undefined;
  return { ...ligne, estPasse: ligne.startsAt <= new Date() };
}

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
 * Ce tournoi porte-t-il au moins un engagé ? Décide si `team_size` est encore modifiable —
 * le raisonnement complet est sur la garde d'`enregistrerTournoi`, qui est celle qui compte.
 *
 * ⚠️ Une EXISTENCE, pas un compte : « peut-on encore changer ? » se répond pareil à 1 et à 64.
 */
/**
 * Le strict nécessaire au chrome de l'espace tournoi (Story 10.9) : de quoi titrer et dire
 * si c'est un brouillon. `cache()` parce que le layout et la fiche la lisent dans le MÊME
 * rendu — patron de `getTournamentBySlug`, et pour la même raison.
 */
export const getTournoiPourEspace = cache(async function getTournoiPourEspace(id: string) {
  return db.query.tournament.findFirst({
    columns: { id: true, name: true, isPublished: true, slug: true },
    where: (table, { eq }) => eq(table.id, id),
  });
});

export async function tournoiADesEngages(tournoiId: string) {
  const ligne = await db.query.tournamentEntry.findFirst({
    columns: { id: true },
    where: (table, { eq }) => eq(table.tournamentId, tournoiId),
  });
  return ligne !== undefined;
}

/**
 * Les événements d'agenda proposables au rattachement — **facultatif depuis la Story 9.5**.
 *
 * ⚠️ Cette en-tête disait *« A4 : le lien est **obligatoire** »*. La décision 1 du §8 a été
 * renversée le 2026-08-14 : un tournoi sans événement **est** le rendez-vous. Cette lecture ne
 * change pas — elle alimente toujours le même `<select>` —, mais une liste **vide** n'est plus
 * un état bloquant : c'est le cas nominal d'une base neuve.
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

/* ═══════════════════════════════════════════════════════════════════════════════
   LECTURES POUR L'AGENDA (Story 9.5) — LE TOURNOI VU COMME UN RENDEZ-VOUS

   🔴 ELLES VIVENT ICI, PAS DANS `queries/rendez-vous.ts`, ET C'EST LA MÊME RÈGLE
   QUE POUR LES LECTURES D'ADMIN : `architecture.md` pose une famille de requêtes
   PAR DOMAINE, pas par surface. Ce qui interroge la table `tournament` est ici ;
   `rendez-vous.ts` ne fait que **composer** les deux domaines, sans jamais écrire
   un `db.query.tournament` de son côté — sinon il existerait deux définitions de
   « un tournoi publié à venir », et elles divergeraient au premier ajustement.
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Les colonnes qu'un tournoi doit porter pour se rendre **comme un rendez-vous d'agenda**.
 *
 * ⚠️ **`slug` EST REMONTÉ ICI ALORS QUE `COLONNES_PUBLIQUES` NE LE REMONTE PAS**, et l'écart
 * est voulu : la 9.2 l'excluait parce qu'aucune carte n'était cliquable *(« une colonne
 * remontée que personne ne rend ferait croire au type dérivé qu'une destination existe »)*.
 * Ici il **a** un consommateur — le CTA « J'y serai », qui doit désigner **ce** tournoi (A4).
 * Tant que la fiche n'existe pas (Story 9.3), il sert d'**identité**, pas encore d'URL.
 */
const COLONNES_RENDEZ_VOUS = {
  id: true,
  slug: true,
  name: true,
  game: true,
  startsAt: true,
  // Story 9.6 : un tournoi SANS événement **est** le rendez-vous — c'est lui que l'accueil et
  // `/agenda` rendent, et il doit donc porter les mêmes faits qu'un événement y porterait.
  // Les omettre ici ferait qu'un tournoi payant serait muet sur les deux surfaces où le visiteur
  // décide de venir, alors que sa fiche l'annoncerait : deux réponses à la même question.
  endsAt: true,
  priceText: true,
  venueName: true,
  registrationState: true,
} as const;

/**
 * Les `limite` prochains tournois **PUBLIÉS et SANS ÉVÉNEMENT** — ceux qui **sont** le
 * rendez-vous, et qui paraissent donc eux-mêmes à l'agenda (Story 9.5, méthode M2).
 *
 * 🔴 `isNull(eventId)` EST LA MOITIÉ QUI ÉVITE LE DOUBLON, ET C'EST TOUT L'ENJEU DE L'AC3.
 * Un tournoi **rattaché** ne doit **jamais** sortir ici : c'est son **événement** que l'agenda
 * montre, et lui seul. Sans ce filtre, la Game'in Reims apparaîtrait **onze fois** — une pour
 * l'événement, dix pour ses animations. Le filtre n'est donc pas une optimisation de volume,
 * c'est la règle métier elle-même.
 *
 * ⚠️ L'instant arrive **en paramètre** : cette lecture est une moitié de liste fusionnée, et
 * l'autre moitié (`getUpcomingEvents`) doit voir **exactement la même frontière**. Même motif
 * que `getPublicTournaments`, écrit à la 9.2 après un défaut trouvé en revue (dette R49).
 * ⚠️ `gt` et non `gte`, comme partout : **une seule définition de « à venir » dans le dépôt**.
 */
export async function getUpcomingTournamentsSansEvenement(limite: number, maintenant: Date) {
  return db.query.tournament.findMany({
    columns: COLONNES_RENDEZ_VOUS,
    where: (table, { and, eq, gt, isNull }) =>
      and(eq(table.isPublished, true), isNull(table.eventId), gt(table.startsAt, maintenant)),
    orderBy: (table, { asc }) => [asc(table.startsAt), asc(table.name), asc(table.id)],
    limit: limite,
  });
}

/** Un tournoi rendu comme rendez-vous d'agenda, dérivé de la requête. */
export type TournoiDuRendezVous = Awaited<
  ReturnType<typeof getUpcomingTournamentsSansEvenement>
>[number];

/**
 * Les tournois **PUBLIÉS** portés par chacun de ces événements, groupés par événement.
 *
 * 🔴 POURQUOI CETTE LECTURE EXISTE, ET POURQUOI ELLE N'EST PAS UNE RELATION `with:`.
 * Le CTA « J'y serai » se **dérive du nombre** de tournois que porte le rendez-vous (A4) :
 * un seul ⇒ il désigne ce tournoi · plusieurs (cas GIR) ⇒ il renvoie à `/tournois` · aucun ⇒
 * il disparaît. Il faut donc, pour chaque événement rendu, savoir **combien** — et lesquels.
 * ⇒ Passer par `with: { tournaments: … }` sur `getUpcomingEvents` aurait alourdi un type
 * (`AgendaEvent`) consommé par **quatre** surfaces qui n'en ont que faire, dont les deux
 * sélecteurs d'occasion de la galerie. Une lecture séparée laisse `AgendaEvent` intact.
 *
 * 🔴 **UNE SEULE REQUÊTE POUR LES N ÉVÉNEMENTS, PAS UNE PAR CARTE** — patron
 * `getPhotosForEvents` (dette R25) : une lecture par événement serait un N+1 sur des pages
 * `force-dynamic`, donc payé à **chaque** visite.
 *
 * ⚠️ **FILTRÉE SUR `is_published`** : un événement publié peut porter un tournoi en brouillon.
 * Le compter ferait apparaître un CTA vers une page qui n'existe pas encore publiquement.
 * ⚠️ **Aucune borne de date ici** : la borne est celle des événements qu'on lui passe. Un
 * tournoi d'un événement à venir est à venir par construction.
 */
export async function getTournoisParEvenement(eventIds: readonly string[]) {
  // Garde de FORME, pas d'optimisation : `inArray(col, [])` génère `IN ()`, invalide en SQL.
  // Le cas se produit dès qu'aucun événement n'est à venir — un état parfaitement légitime,
  // que le hub rend déjà (« Pas de jeudi calé pour l'instant »). Patron `getPhotosForEvents`.
  if (eventIds.length === 0) return new Map<string, TournoiDuRendezVous[]>();

  const lignes = await db.query.tournament.findMany({
    columns: { ...COLONNES_RENDEZ_VOUS, eventId: true },
    where: (table, { and, eq, inArray }) =>
      and(eq(table.isPublished, true), inArray(table.eventId, [...eventIds])),
    orderBy: (table, { asc }) => [asc(table.startsAt), asc(table.name), asc(table.id)],
  });

  const parEvenement = new Map<string, TournoiDuRendezVous[]>();
  for (const { eventId, ...tournoi } of lignes) {
    // `eventId` est typé `string | null` — Drizzle ne sait pas que le `WHERE` l'a exclu. On
    // traite la branche plutôt que d'affirmer avec un `!` non vérifié (patron `photos.ts`).
    if (eventId === null) continue;
    const deja = parEvenement.get(eventId);
    if (deja) deja.push(tournoi);
    else parEvenement.set(eventId, [tournoi]);
  }
  return parEvenement;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CE QUI SE JOUE MAINTENANT — LECTURE NÉE DE LA STORY 13.3
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Les tournois qui **se jouent** aujourd'hui ou dans les `joursDeFenetre` jours suivants.
 *
 * 🔴 ELLE EXISTE PARCE QU'AUCUNE DES DEUX AUTRES NE RÉPOND À CETTE QUESTION, et la raison
 * est mesurable : `getUpcomingTournamentsForAdmin` filtre sur `starts_at > maintenant`, donc
 * un tournoi **qui a commencé ce matin en est absent** — c'est-à-dire précisément celui pour
 * lequel on ouvre le back-office. « À venir » et « en cours » ne sont pas le même ensemble.
 *
 * 🔴 DEUX SOURCES POUR UN MÊME FAIT, ET IL FAUT LES DEUX. Un tournoi porte une date de
 * début (`starts_at`, toujours saisie) **et** un déroulé dont chaque phase peut porter sa
 * propre journée (`played_on`, depuis la 10.10 — un TFT en rondes suisses s'étale sur
 * plusieurs week-ends). Ne lire que `starts_at` manquerait la 2ᵉ journée d'un tournoi
 * commencé la semaine dernière ; ne lire que les phases manquerait un tournoi dont le
 * déroulé n'est pas encore composé. On lit les deux et on fusionne.
 *
 * ⚠️ **PUBLIÉS ET NON PUBLIÉS**, comme toute la famille des lectures d'admin : un tournoi
 * se prépare en brouillon et se joue quand même. Relâcher ce filtre dans l'autre sens
 * (lectures publiques) serait la fuite décrite en tête de `queries/events.ts`.
 *
 * ⚠️ **LA BORNE S'APPLIQUE APRÈS LA FUSION, ET CHAQUE SOURCE EST LUE À LA BORNE PLEINE** —
 * même arithmétique que `getUpcomingRendezVous` : lire `limite / 2` de chaque côté rendrait
 * un préfixe faux dès que la répartition n'est pas moitié-moitié.
 */
export async function getTournoisQuiSeJouent(
  maintenant: Date,
  joursDeFenetre: number,
  limite: number,
) {
  // 🔴 UNE SEULE LECTURE D'HORLOGE, PASSÉE PAR L'APPELANT (patron R49) — et le découpage en
  // jours se fait ICI, en JS, avec l'horloge de Paris. On ne demande jamais à Postgres de
  // convertir un `timestamptz` en jour : `::date` s'évalue dans le fuseau de la SESSION,
  // donc juste en local (`Etc/UTC`) et potentiellement faux sur le VPS, sans erreur ni test
  // rouge (`00 référence/pieges/date-tz.md`, § B).
  const premierJour = jourParis(maintenant);
  const dernierJour = ajouterJours(premierJour, joursDeFenetre);
  const debut = debutDuJourParis(premierJour);
  const finExclue = debutDuJourParis(ajouterJours(dernierJour, 1));

  const [parJournee, parDateDeDebut] = await Promise.all([
    // ⚠️ `played_on` est une colonne `date` (mode chaîne) : la comparer à deux chaînes ISO
    // ne fait intervenir AUCUN fuseau. C'est le seul endroit de cette fonction où la
    // comparaison est sûre par nature — d'où les instants convertis pour l'autre moitié.
    db
      .select({
        id: tournament.id,
        nom: tournament.name,
        // La PREMIÈRE journée de la fenêtre, pas n'importe laquelle : un tournoi qui joue
        // samedi ET dimanche s'annonce pour samedi.
        journee: min(tournamentPhase.playedOn),
      })
      .from(tournamentPhase)
      .innerJoin(tournament, eq(tournament.id, tournamentPhase.tournamentId))
      .where(
        and(
          gte(tournamentPhase.playedOn, premierJour),
          lte(tournamentPhase.playedOn, dernierJour),
        ),
      )
      .groupBy(tournament.id, tournament.name)
      .limit(limite),

    db.query.tournament.findMany({
      columns: { id: true, name: true, startsAt: true },
      where: (table, { and: et, gte: apres, lt: avant }) =>
        et(apres(table.startsAt, debut), avant(table.startsAt, finExclue)),
      orderBy: (table, { asc }) => [asc(table.startsAt), asc(table.name), asc(table.id)],
      limit: limite,
    }),
  ]);

  // 🔴 LA FUSION ET SA PRÉSÉANCE VIVENT DANS `lib/tournoi/en-cours.ts`, PAS ICI — la lecture
  // publique de `/tournois` pose la même question, et deux copies trancheraient un jour à
  // l'envers l'une de l'autre : la liste et la fiche diraient alors deux choses différentes
  // du même tournoi, le même jour. Une règle, deux appelants, un test (leçon `estParTables`).
  // ⚠️ `min()` est typé nullable — le `GROUP BY` ne rend pourtant que des groupes non vides.
  // On traite la branche plutôt que d'affirmer avec un `!` non vérifié (patron `photos.ts`).
  return fusionnerCeQuiSeJoue(
    parJournee.flatMap((ligne) =>
      ligne.journee === null ? [] : [{ id: ligne.id, nom: ligne.nom, journee: ligne.journee }],
    ),
    parDateDeDebut.map((ligne) => ({
      id: ligne.id,
      nom: ligne.name,
      jour: jourParis(ligne.startsAt),
    })),
  ).slice(0, limite);
}

/** Un tournoi qui se joue dans la fenêtre, tel que le tableau de bord l'annonce. */
export type TournoiQuiSeJoue = Awaited<ReturnType<typeof getTournoisQuiSeJouent>>[number];

/**
 * Les tournois **PUBLIÉS** qui se jouent **aujourd'hui** — pour la liste publique (Story 14.1).
 *
 * 🔴 JUMELLE DE `getTournoisQuiSeJouent`, ET LA DIFFÉRENCE TIENT EN DEUX LIGNES — c'est la
 * frontière décrite en tête de `queries/events.ts` : celle-ci filtre `is_published`, l'autre
 * non. ⚠️ **NE JAMAIS relâcher ce filtre « pour réutiliser »** : un tournoi en brouillon qui
 * apparaîtrait sur `/tournois` est une fuite qu'**aucune porte visuelle ne verrait** — une
 * liste qui affiche une carte de plus n'a pas l'air cassée.
 *
 * ⚠️ **AUJOURD'HUI SEULEMENT**, là où la jumelle du back-office regarde deux jours de plus.
 * « En ce moment » sur un site public doit vouloir dire *en ce moment* : annoncer le samedi
 * dès le jeudi viderait la section de son sens en une semaine.
 *
 * 🔴 **TROIS REQUÊTES, ET LA TROISIÈME EST CE QUI REND LA SECTION IDENTIQUE AUX DEUX AUTRES** :
 * elle relit les tournois retenus avec `COLONNES_PUBLIQUES` et leur visuel, donc la carte rendue
 * est **exactement** celle de « à venir » et de « passés ». Fabriquer ici une forme approchante
 * aurait donné une troisième définition de « une carte de tournoi ».
 */
export async function getTournoisEnCoursPublies(maintenant: Date, limite: number) {
  const aujourdHui = jourParis(maintenant);
  const debut = debutDuJourParis(aujourdHui);
  const finExclue = debutDuJourParis(ajouterJours(aujourdHui, 1));

  const [parJournee, parDateDeDebut] = await Promise.all([
    db
      .select({ id: tournament.id, nom: tournament.name })
      .from(tournamentPhase)
      .innerJoin(tournament, eq(tournament.id, tournamentPhase.tournamentId))
      .where(
        and(
          eq(tournament.isPublished, true),
          eq(tournamentPhase.playedOn, aujourdHui),
        ),
      )
      .groupBy(tournament.id, tournament.name)
      .limit(limite),

    db.query.tournament.findMany({
      columns: { id: true, name: true, startsAt: true },
      where: (table, { and: et, eq: egal, gte: apres, lt: avant }) =>
        et(
          egal(table.isPublished, true),
          apres(table.startsAt, debut),
          avant(table.startsAt, finExclue),
        ),
      orderBy: (table, { asc }) => [asc(table.startsAt), asc(table.name), asc(table.id)],
      limit: limite,
    }),
  ]);

  const retenus = fusionnerCeQuiSeJoue(
    parJournee.map((ligne) => ({ id: ligne.id, nom: ligne.nom, journee: aujourdHui })),
    parDateDeDebut.map((ligne) => ({
      id: ligne.id,
      nom: ligne.name,
      jour: jourParis(ligne.startsAt),
    })),
  ).slice(0, limite);

  // Garde de FORME, pas d'optimisation : `inArray(col, [])` génère `IN ()`, invalide en SQL.
  // Le cas est le plus fréquent de tous — aucun tournoi ne se joue la plupart des jours.
  if (retenus.length === 0) return [];

  const cartes = await db.query.tournament.findMany({
    columns: COLONNES_PUBLIQUES,
    where: (table, { and: et, eq: egal, inArray: parmi }) =>
      et(
        egal(table.isPublished, true),
        parmi(
          table.id,
          retenus.map((t) => t.id),
        ),
      ),
    with: RELATION_VISUEL,
  });

  // On rend dans l'ordre de la fusion, pas dans celui que Postgres a servi : c'est la règle
  // partagée qui décide de l'ordre, et elle est totale.
  const parId = new Map(cartes.map((carte) => [carte.id, carte]));
  return retenus.flatMap((t) => {
    const carte = parId.get(t.id);
    return carte ? [carte] : [];
  });
}
