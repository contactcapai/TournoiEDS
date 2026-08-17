import "server-only";

import { and, asc, eq, isNotNull, or } from "drizzle-orm";

import {
  classer,
  pointsDePlacement,
  statistiques,
  type EngageClassable,
  type ResultatDeManche,
} from "../../../lib/tournoi/classement";
import type { SourceResolue } from "../../../lib/tournoi/generation";
import { calculerPropagation, issueDeRencontre } from "../../../lib/tournoi/progression";
import { db } from "../client";
import {
  tournament,
  tournamentEntry,
  tournamentMatch,
  tournamentMatchSlot,
  tournamentPhase,
} from "../schema";

/**
 * Ce que l'écran du jour J lit : les rencontres d'une phase, et le classement du tournoi
 * (Story 10.8).
 *
 * 🔴 RIEN N'EST STOCKÉ EN DOUBLE. Les points, les statistiques et le rang **ne sont pas des
 * colonnes** : ils se recalculent à chaque lecture depuis `classement.ts`. Une colonne
 * `points` deviendrait fausse au premier résultat corrigé qu'on aurait oublié de lui signaler —
 * c'est la leçon du sous-total dérivé de la 6.13, et ici l'enjeu est un classement affiché
 * devant des joueurs.
 */

/** La phase à jouer, avec ce que l'écran doit dire du tournoi qui la porte. */
export async function getPhasePourJeu(phaseId: string) {
  const [ligne] = await db
    .select({
      id: tournamentPhase.id,
      tournoiId: tournamentPhase.tournamentId,
      tournoiNom: tournament.name,
      position: tournamentPhase.position,
      name: tournamentPhase.name,
      kind: tournamentPhase.kind,
      state: tournamentPhase.state,
      settings: tournamentPhase.settings,
    })
    .from(tournamentPhase)
    .innerJoin(tournament, eq(tournament.id, tournamentPhase.tournamentId))
    .where(eq(tournamentPhase.id, phaseId))
    .limit(1);

  return ligne;
}

/**
 * Les rencontres d'une phase, places comprises, avec le nom de chaque occupant.
 *
 * ⚠️ L'ordre est `(round, position)` et non `position` seule : `position` est unique dans la
 * phase mais ne dit rien du déroulé — en double élimination, la position 9 peut être un tour 1
 * du tableau des perdants alors que la position 7 est un tour 3 des vainqueurs.
 */
export async function getRencontresDePhase(phaseId: string) {
  const lignes = await db
    .select({
      matchId: tournamentMatch.id,
      position: tournamentMatch.position,
      round: tournamentMatch.round,
      bracket: tournamentMatch.bracket,
      state: tournamentMatch.state,
      slotId: tournamentMatchSlot.id,
      slotPosition: tournamentMatchSlot.position,
      entryId: tournamentMatchSlot.entryId,
      score: tournamentMatchSlot.score,
      rank: tournamentMatchSlot.rank,
      source: tournamentMatchSlot.source,
      nom: tournamentEntry.displayName,
      etatEngage: tournamentEntry.state,
    })
    .from(tournamentMatch)
    .leftJoin(tournamentMatchSlot, eq(tournamentMatchSlot.matchId, tournamentMatch.id))
    .leftJoin(tournamentEntry, eq(tournamentEntry.id, tournamentMatchSlot.entryId))
    .where(eq(tournamentMatch.phaseId, phaseId))
    .orderBy(
      asc(tournamentMatch.bracket),
      asc(tournamentMatch.round),
      asc(tournamentMatch.position),
      asc(tournamentMatchSlot.position),
    );

  const parRencontre = new Map<
    string,
    {
      matchId: string;
      position: number;
      round: number | null;
      bracket: (typeof lignes)[number]["bracket"];
      state: (typeof lignes)[number]["state"];
      places: {
        slotId: string;
        position: number;
        entryId: string | null;
        nom: string | null;
        score: number | null;
        rank: number | null;
        source: SourceResolue | null;
      }[];
    }
  >();

  for (const ligne of lignes) {
    let rencontre = parRencontre.get(ligne.matchId);
    if (!rencontre) {
      rencontre = {
        matchId: ligne.matchId,
        position: ligne.position,
        round: ligne.round,
        bracket: ligne.bracket,
        state: ligne.state,
        places: [],
      };
      parRencontre.set(ligne.matchId, rencontre);
    }
    // Le `leftJoin` rend une ligne même sans place : une rencontre sans place est un défaut de
    // génération, mais l'écran doit pouvoir l'afficher plutôt que de planter dessus.
    // ⚠️ On teste `slotPosition` **en plus** de `slotId`, et ce n'est pas de la redondance : le
    // `leftJoin` rend les DEUX à `null` ensemble, mais le typage ne le sait pas — et un `as
    // number` masquerait un jour une place réellement sans rang.
    if (ligne.slotId !== null && ligne.slotPosition !== null) {
      rencontre.places.push({
        slotId: ligne.slotId,
        position: ligne.slotPosition,
        entryId: ligne.entryId,
        nom: ligne.nom,
        score: ligne.score,
        rank: ligne.rank,
        source: (ligne.source as SourceResolue | null) ?? null,
      });
    }
  }

  /**
   * 🔴 L'ISSUE VIENT DE `calculerPropagation`, PAS D'UN APPEL DIRECT À `issueDeRencontre`.
   *
   * Et ce n'est pas une commodité : savoir si une place vide est une **exemption** ou une place
   * qui **attend** est TRANSITIF — il faut avoir dépouillé l'amont. `calculerPropagation` est le
   * seul endroit qui le dérive. Appeler `issueDeRencontre` place par place ici afficherait
   * « exemption » là où la propagation dit « attend » : l'écran et la base ne raconteraient pas
   * la même histoire, et c'est l'écran qu'on croirait.
   *
   * ⚠️ On n'écrit RIEN ici — on ne lit que les `issues`. Les déplacements sont appliqués par
   * l'action, dans une transaction.
   */
  const rencontres = [...parRencontre.values()];
  const { issues } = calculerPropagation(
    rencontres.map((rencontre) => ({
      matchId: rencontre.matchId,
      position: rencontre.position,
      places: rencontre.places.map((place) => ({
        slotId: place.slotId,
        position: place.position,
        entryId: place.entryId,
        score: place.score,
        rank: place.rank,
        source: place.source,
      })),
    })),
  );

  return rencontres.map((rencontre) => ({
    ...rencontre,
    /** Recalculée à chaque lecture, jamais stockée — une seule définition du dépouillement. */
    issue: issues.get(rencontre.matchId) ?? issueDeRencontre(rencontre.places),
  }));
}

export type RencontreJouable = Awaited<ReturnType<typeof getRencontresDePhase>>[number];

/**
 * Le classement du tournoi, recalculé depuis **toutes** les manches classées.
 *
 * 🔴 LA TAILLE DE CHAQUE TABLE EST CELLE DE **CETTE** TABLE, comptée au passage. C'est ce qui
 * rend les points justes quand les lobbies font 6, 6 et 5 — et c'est aussi ce que
 * `ResultatDeManche.tailleDuLobby` sert à porter jusqu'à `statistiques()` (défaut trouvé par
 * cette story : un seuil unique de moitié haute était faux dès que les tailles différaient).
 *
 * ⚠️ **UNE PLACE VIDE NE COMPTE PAS DANS LA TAILLE.** Un lobby de 8 généré où 6 personnes se
 * sont assises est un lobby de **6** : compter 8 donnerait 3 points au dernier au lieu de 1, et
 * gonflerait tout le tableau. C'est le même défaut que le « 8 codé en dur » de la 10.3.
 */
export async function getClassementDuTournoi(tournoiId: string) {
  const lignes = await db
    .select({
      phasePosition: tournamentPhase.position,
      matchId: tournamentMatch.id,
      matchPosition: tournamentMatch.position,
      entryId: tournamentMatchSlot.entryId,
      rank: tournamentMatchSlot.rank,
      nom: tournamentEntry.displayName,
      etatEngage: tournamentEntry.state,
    })
    .from(tournamentMatchSlot)
    .innerJoin(tournamentMatch, eq(tournamentMatch.id, tournamentMatchSlot.matchId))
    .innerJoin(tournamentPhase, eq(tournamentPhase.id, tournamentMatch.phaseId))
    .innerJoin(tournamentEntry, eq(tournamentEntry.id, tournamentMatchSlot.entryId))
    .where(eq(tournamentPhase.tournamentId, tournoiId))
    .orderBy(asc(tournamentPhase.position), asc(tournamentMatch.position));

  // Taille RÉELLE de chaque table : le nombre de places occupées, pas la taille générée.
  const tailleParMatch = new Map<string, number>();
  for (const ligne of lignes) {
    tailleParMatch.set(ligne.matchId, (tailleParMatch.get(ligne.matchId) ?? 0) + 1);
  }

  // `ordre` situe la manche dans le temps — il départage `dernierPlacement` (4ᵉ critère de
  // `classer`). Il se dérive de (rang de la phase, position de la rencontre), jamais d'une
  // horloge : deux rencontres créées dans la même transaction porteraient le même `createdAt`.
  const ordreParMatch = new Map<string, number>();
  for (const ligne of lignes) {
    if (!ordreParMatch.has(ligne.matchId)) ordreParMatch.set(ligne.matchId, ordreParMatch.size + 1);
  }

  const parEngage = new Map<
    string,
    { nom: string; abandonne: boolean; manches: ResultatDeManche[] }
  >();

  for (const ligne of lignes) {
    const entryId = ligne.entryId as string;
    let engage = parEngage.get(entryId);
    if (!engage) {
      engage = {
        nom: ligne.nom,
        abandonne: ligne.etatEngage === "abandonne",
        manches: [],
      };
      parEngage.set(entryId, engage);
    }

    // Une place sans rang n'est pas une manche jouée — elle est en attente de saisie.
    if (ligne.rank === null) continue;

    const taille = tailleParMatch.get(ligne.matchId) ?? 0;
    engage.manches.push({
      placement: ligne.rank,
      points: pointsDePlacement(ligne.rank, taille),
      ordre: ordreParMatch.get(ligne.matchId) ?? 0,
      tailleDuLobby: taille,
    });
  }

  const classables: EngageClassable[] = [...parEngage.entries()].map(([id, engage]) => ({
    id,
    nom: engage.nom,
    abandonne: engage.abandonne,
    // Le repli n'a plus de consommateur ici — chaque manche porte sa taille —, mais le
    // paramètre reste obligatoire : on lui passe la taille de la dernière table connue.
    stats: statistiques(engage.manches, engage.manches.at(-1)?.tailleDuLobby ?? 1),
  }));

  return classer(classables);
}

/**
 * Les engagés PRÉSENTS d'un tournoi, dans l'ordre de saisie.
 *
 * 🔴 `present` ET RIEN D'AUTRE — c'est tout le sens du pointage de la 10.5. Générer depuis les
 * `inscrit` fabriquerait un tableau avec des places que personne n'occupe, et les exemptions
 * iraient aux mauvais joueurs.
 * ⚠️ `abandonne` EST EXCLU AUSSI : il a joué, ses points restent au classement, mais il n'entre
 * pas dans une manche suivante (`lobbiesSuisses` applique déjà la même règle).
 */
export async function getPresentsDuTournoi(tournoiId: string) {
  return db
    .select({ id: tournamentEntry.id, nom: tournamentEntry.displayName })
    .from(tournamentEntry)
    .where(and(eq(tournamentEntry.tournamentId, tournoiId), eq(tournamentEntry.state, "present")))
    .orderBy(asc(tournamentEntry.createdAt), asc(tournamentEntry.id));
}

/**
 * Vrai dès qu'une place de la phase porte un rang **ou** un score.
 *
 * 🔴 LE TÉMOIN EST LE RÉSULTAT, JAMAIS L'ÉTAT DÉCLARÉ de la phase ou de la rencontre — même
 * doctrine que `phaseLibrementModifiable` (10.1) et que `getPhasesForTournament` (10.4) : l'état
 * est saisi, le résultat est un fait. Se fier à `state` laisserait effacer des scores en
 * remettant une rencontre à « à jouer ».
 *
 * ⚠️ `or(isNotNull(rank), isNotNull(score))` et non un test sur l'un des deux : un bracket se
 * dépouille au score, un lobby au rang. N'en regarder qu'un rendrait la garde inerte sur la
 * moitié des formats — et c'est exactement le genre de garde à moitié posée qui ne se voit pas.
 */
export async function phaseADesResultats(phaseId: string) {
  const [ligne] = await db
    .select({ id: tournamentMatchSlot.id })
    .from(tournamentMatchSlot)
    .innerJoin(tournamentMatch, eq(tournamentMatch.id, tournamentMatchSlot.matchId))
    .where(
      and(
        eq(tournamentMatch.phaseId, phaseId),
        or(isNotNull(tournamentMatchSlot.rank), isNotNull(tournamentMatchSlot.score)),
      ),
    )
    .limit(1);

  return ligne !== undefined;
}
