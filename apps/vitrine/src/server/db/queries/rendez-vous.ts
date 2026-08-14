// `server-only` en TOUTE PREMIÈRE LIGNE, comme les six autres familles de requêtes
// (garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne doit jamais être atteint
// depuis un composant client.
import "server-only";
import { type AgendaEvent, getUpcomingEvents } from "./events";
import {
  type TournoiDuRendezVous,
  getTournoisParEvenement,
  getUpcomingTournamentsSansEvenement,
} from "./tournaments";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * L'AGENDA VU PAR UN VISITEUR — DEUX SOURCES, UNE SEULE LISTE (Story 9.5, méthode M2)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE MODULE **COMPOSE**, IL N'INTERROGE PAS. Aucun `db.query` ici : les lectures vivent
 * dans la famille de leur domaine (`events.ts`, `tournaments.ts`), conformément à
 * `architecture.md` — une famille par domaine, pas par surface. Écrire ici un
 * `db.query.tournament` fabriquerait une **seconde définition** de « un tournoi publié à
 * venir », qui divergerait de la première au premier ajustement.
 *
 * **Pourquoi ce module existe.** Depuis la 9.5, `tournament.event_id` est **facultatif** :
 * un tournoi sans événement **EST** le rendez-vous. L'agenda et l'accueil doivent donc
 * montrer *les événements publiés* **et** *les tournois publiés sans événement*, dans un
 * **seul** ordre chronologique — pas deux listes accolées, ce qui ferait lire « il y a les
 * vrais rendez-vous, et puis les tournois ».
 *
 * ⚠️ **UN TOURNOI RATTACHÉ N'APPARAÎT JAMAIS EN DOUBLE.** L'agenda montre son **événement**,
 * jamais ses tournois : c'est le cas de la Game'in Reims, **contenant à deux niveaux** — un
 * événement sur deux jours qui porte dix animations. Le filtre `isNull(eventId)` de
 * `getUpcomingTournamentsSansEvenement` est ce qui le garantit, et c'est une règle métier,
 * pas une optimisation.
 */

/**
 * Un rendez-vous de l'agenda — **union discriminée**, jamais un événement fabriqué.
 *
 * 🔴 ON N'ADAPTE **PAS** UN TOURNOI EN `AgendaEvent`, ET C'EST LE CŒUR DE LA STORY (A9).
 * La conversion aurait été tentante : les composants existants prennent déjà un `AgendaEvent`.
 * Mais elle obligerait à **inventer** ce qu'un tournoi n'a pas — un `type` (`thursday` ?
 * `special` ?), une `description`, un `recap`, un `bar`. Or affirmer un fait qu'on n'a pas est
 * **exactement** le défaut que cette story solde (dette **R48**, quatre affirmations fausses
 * mesurées sur staging le 2026-08-14). On refait le défaut en le déplaçant d'un cran.
 * ⇒ Les composants **branchent** sur `nature`, et ne rendent d'un rendez-vous que ce que sa
 * nature garantit.
 *
 * ⚠️ `startsAt` et `cle` sont **remontés au niveau de l'union** parce que c'est ce dont le
 * tri et les clés React ont besoin, et que les deux branches les portent sous des noms
 * différents (`event.startsAt` / `tournoi.startsAt`). Les lire depuis l'union évite un
 * `nature === "…" ? … : …` à chaque comparaison.
 */
export type RendezVous =
  | {
      nature: "evenement";
      cle: string;
      startsAt: Date;
      libelle: string;
      evenement: AgendaEvent;
      /**
       * Les tournois **publiés** que porte cet événement. Vide = aucun.
       * C'est de sa **longueur** que se dérive la destination du CTA (A4), et c'est aussi
       * ce qui remplace un enum `type = "tournoi"` : un événement qui porte au moins un
       * tournoi **EST** un événement de tournoi, c'est **dérivable** (arbitrage A2 de la
       * story — deux sources pour un même fait divergent, et un enum toucherait en plus le
       * contrat envoyé à n8n).
       */
      tournois: readonly TournoiDuRendezVous[];
    }
  | {
      nature: "tournoi";
      cle: string;
      startsAt: Date;
      libelle: string;
      tournoi: TournoiDuRendezVous;
    };

/**
 * L'ordre de la liste fusionnée — **TOTAL**, et il faut qu'il le soit.
 *
 * 🔴 LES DEUX PAGES SONT `force-dynamic` : la requête est rejouée **à chaque visite**. Un
 * ordre partiel (deux rendez-vous à la même minute) ferait se réordonner la liste d'une
 * visite à l'autre, sur un scintillement que personne ne saurait reproduire. Et le cas n'est
 * pas théorique : la Game'in Reims porte plusieurs rendez-vous **en parallèle**, et
 * `starts_at` se saisit à la **minute** (`datetime-local`), donc les égalités sont fréquentes.
 *
 * ⚠️ LE TRI SE FAIT **EN MÉMOIRE, ET C'EST INÉVITABLE** : les deux moitiés viennent de deux
 * tables. Il ne reste ici qu'une **fusion** de deux listes courtes et déjà bornées **en base**.
 *
 * 🔴 MAIS CE PARAGRAPHE AFFIRMAIT AUSSI QUE « CHACUNE SORT DÉJÀ TRIÉE » — ET C'ÉTAIT FAUX,
 * TROUVÉ EN REVUE. `getUpcomingEvents` ne triait que sur `starts_at` : à égalité de minute,
 * **lequel des deux événements tombait dans le `LIMIT` n'était pas déterminé**. Trier ici n'y
 * pouvait rien — la ligne écartée l'est **en base**, avant que cette fonction ne la voie.
 * ⇒ Le tie-break a été posé **dans les deux lectures sources**, pas ici. Ce qui suit ne
 * garantit l'ordre total de la fusion **que parce que** chaque moitié est elle-même totale.
 * ⚠️ `localeCompare` avec un **locale explicite** et non `<`/`>` : sur des titres accentués,
 * la comparaison de codepoints classerait « Été » après « Zoo ».
 * ⚠️ Dernier terme `cle` (un UUID) : c'est lui qui rend l'ordre **total** — deux rendez-vous
 * de même date **et** de même libellé restent départagés, et de façon stable.
 */
function comparerRendezVous(a: RendezVous, b: RendezVous) {
  const parDate = a.startsAt.getTime() - b.startsAt.getTime();
  if (parDate !== 0) return parDate;
  const parLibelle = a.libelle.localeCompare(b.libelle, "fr");
  if (parLibelle !== 0) return parLibelle;
  return a.cle.localeCompare(b.cle, "fr");
}

/**
 * Les `limite` prochains rendez-vous publiés — événements **et** tournois sans événement.
 *
 * 🔴 **UNE SEULE LECTURE D'HORLOGE POUR LES DEUX SOURCES.** L'instant est lu **ici** et
 * **passé** aux deux lectures. Si chacune lisait la sienne, deux instants `T1 < T2`
 * pourraient encadrer un `starts_at` : la ligne satisferait les deux bornes et sortirait
 * deux fois. C'est la fenêtre **R49**, acceptée sur cinq surfaces antérieures — le but ici
 * est de **ne pas en créer une sixième**. Patron livré par `getPublicTournaments` (9.2).
 * ⚠️ Et l'horloge reste lue **dans la couche données**, jamais pendant le rendu : lire
 * l'heure dans un composant est une impureté que `react-hooks/purity` refuse, et deux rendus
 * du même arbre pourraient répondre différemment.
 *
 * 🔴 **LA BORNE S'APPLIQUE APRÈS LA FUSION, ET CHAQUE SOURCE EST LUE À LA BORNE PLEINE.**
 * C'est le piège arithmétique de cette fonction : lire `limite / 2` de chaque côté rendrait
 * un préfixe **faux** dès que les rendez-vous ne sont pas répartis moitié-moitié — dix
 * tournois d'affilée masqueraient les événements suivants, ou l'inverse. En lisant `limite`
 * des deux côtés puis en tronquant à `limite`, les `limite` premiers de la fusion sont
 * **exactement** les `limite` plus proches, quelle que soit la répartition.
 *
 * ⚠️ **LA TROISIÈME LECTURE EST SÉQUENTIELLE, ET ELLE NE PEUT PAS NE PAS L'ÊTRE** : elle
 * dépend des événements **retenus** après troncature. C'est le même aller-retour que
 * `getPhotosForEvents` sur `/agenda`, et il porte sur au plus `limite` identifiants.
 */
export async function getUpcomingRendezVous(limite: number) {
  const maintenant = new Date();
  const [evenements, tournois] = await Promise.all([
    getUpcomingEvents(limite, maintenant),
    getUpcomingTournamentsSansEvenement(limite, maintenant),
  ]);

  const fusion: RendezVous[] = [
    ...evenements.map(
      (evenement): RendezVous => ({
        nature: "evenement",
        cle: evenement.id,
        startsAt: evenement.startsAt,
        libelle: evenement.title,
        evenement,
        // Renseigné juste après, une fois la troncature faite : inutile de lire les tournois
        // d'un événement que la borne va écarter.
        tournois: [],
      }),
    ),
    ...tournois.map(
      (tournoi): RendezVous => ({
        nature: "tournoi",
        cle: tournoi.id,
        startsAt: tournoi.startsAt,
        libelle: tournoi.name,
        tournoi,
      }),
    ),
  ];
  fusion.sort(comparerRendezVous);
  const retenus = fusion.slice(0, limite);

  const parEvenement = await getTournoisParEvenement(
    retenus.filter((r) => r.nature === "evenement").map((r) => r.cle),
  );
  return retenus.map((rendezVous) =>
    rendezVous.nature === "evenement"
      ? { ...rendezVous, tournois: parEvenement.get(rendezVous.cle) ?? [] }
      : rendezVous,
  );
}
