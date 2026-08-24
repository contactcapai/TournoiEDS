import "server-only";

import { asc, eq, isNotNull, or, sql } from "drizzle-orm";

import { db } from "../client";
import { tournamentMatch, tournamentMatchSlot, tournamentPhase } from "../schema";

/**
 * Les phases d'un tournoi, dans l'ordre, avec ce qu'il faut pour savoir si chacune est encore
 * librement modifiable (Story 10.4).
 *
 * 🔴 LE TÉMOIN EST LE RÉSULTAT, PAS L'ÉTAT DÉCLARÉ. Une phase qu'on remettrait à `planifiee`
 * ne redevient pas vierge : c'est l'existence d'un score, d'un rang ou d'une rencontre déjà
 * jouée qui la fige (`phaseLibrementModifiable`, `lib/tournoi/structure.ts`).
 */
export async function getPhasesForTournament(tournoiId: string) {
  const lignes = await db
    .select({
      id: tournamentPhase.id,
      position: tournamentPhase.position,
      name: tournamentPhase.name,
      kind: tournamentPhase.kind,
      state: tournamentPhase.state,
      /** Le jour de cette manche — `null` sur un tournoi qui tient sur une journée. */
      playedOn: tournamentPhase.playedOn,
      rencontres: sql<number>`count(distinct ${tournamentMatch.id})`.mapWith(Number),
      avecResultat: sql<number>`count(distinct ${tournamentMatch.id}) filter (where ${or(
        isNotNull(tournamentMatchSlot.score),
        isNotNull(tournamentMatchSlot.rank),
        sql`${tournamentMatch.state} <> 'a_jouer'`,
      )})`.mapWith(Number),
    })
    .from(tournamentPhase)
    .leftJoin(tournamentMatch, eq(tournamentMatch.phaseId, tournamentPhase.id))
    .leftJoin(tournamentMatchSlot, eq(tournamentMatchSlot.matchId, tournamentMatch.id))
    .where(eq(tournamentPhase.tournamentId, tournoiId))
    .groupBy(tournamentPhase.id)
    .orderBy(asc(tournamentPhase.position));

  return lignes.map((l) => ({ ...l, librementModifiable: l.avecResultat === 0 }));
}

export type PhaseListee = Awaited<ReturnType<typeof getPhasesForTournament>>[number];
