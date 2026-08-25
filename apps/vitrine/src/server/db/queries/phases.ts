import "server-only";

import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";

import { db } from "../client";
import { tournament, tournamentMatch, tournamentMatchSlot, tournamentPhase } from "../schema";

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

/**
 * Les journées d'un tournoi — les jours DISTINCTS de ses phases, dans l'ordre (2026-08-24).
 *
 * 🔴 UNE JOURNÉE N'EST PAS UN OBJET, C'EST UNE DATE PARTAGÉE. Trois manches du même samedi ne
 * font qu'une journée : on pointe une fois, pas trois. Dériver la liste plutôt que créer une
 * table « journée » évite d'avoir deux endroits qui savent quand se joue une phase.
 *
 * ⚠️ Rend un tableau VIDE pour un tournoi dont aucune phase n'est datée — le cas d'un tournoi
 * qui tient sur une journée. L'écran retombe alors sur l'état global, comme avant.
 */
export async function getJourneesDuTournoi(tournoiId: string): Promise<string[]> {
  const lignes = await db
    .selectDistinct({ jour: tournamentPhase.playedOn })
    .from(tournamentPhase)
    .where(and(eq(tournamentPhase.tournamentId, tournoiId), isNotNull(tournamentPhase.playedOn)))
    .orderBy(asc(tournamentPhase.playedOn));

  return lignes.map((ligne) => ligne.jour).filter((jour): jour is string => jour !== null);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   LE DÉROULÉ, CÔTÉ PUBLIC — LECTURE NÉE DE LA STORY 14.1
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Les phases d'un tournoi **PUBLIÉ**, telles que le visiteur peut les voir.
 *
 * 🔴 ELLE FILTRE `is_published` **ELLE-MÊME**, SUR UNE JOINTURE, ET CE N'EST PAS UNE
 * REDONDANCE. `getPhasesForTournament` ci-dessus ne filtre rien : elle est appelée derrière
 * `exigerRolePage`, où c'est correct. Si la lecture publique se contentait de l'identifiant
 * que lui passe la page, elle rendrait le déroulé d'un tournoi en brouillon à qui devinerait
 * son `id` — et **aucune porte visuelle ne le verrait**, une page qui affiche une section de
 * plus n'ayant pas l'air cassée. La garde est donc **dans la requête**, pas chez l'appelant.
 *
 * ⚠️ **ELLE NE REMONTE NI `rencontres` NI `avecResultat`**, que sa jumelle calcule : ce sont
 * des grandeurs d'administration (« cette phase est-elle encore librement modifiable ? »). Les
 * remonter ici ferait croire au type dérivé qu'elles sont publiables, et quelqu'un finirait
 * par les afficher.
 *
 * ⚠️ L'ordre est celui du déroulé — `position`, jamais la date : deux phases du même jour ont
 * un ordre voulu par celui qui a composé le tournoi.
 */
export async function getDeroulePublic(tournoiId: string) {
  return db
    .select({
      id: tournamentPhase.id,
      position: tournamentPhase.position,
      name: tournamentPhase.name,
      kind: tournamentPhase.kind,
      state: tournamentPhase.state,
      /** Le jour de cette manche — `null` sur un tournoi qui tient sur une journée. */
      playedOn: tournamentPhase.playedOn,
    })
    .from(tournamentPhase)
    .innerJoin(tournament, eq(tournament.id, tournamentPhase.tournamentId))
    .where(and(eq(tournamentPhase.tournamentId, tournoiId), eq(tournament.isPublished, true)))
    .orderBy(asc(tournamentPhase.position));
}

/** Une phase telle que le public la voit. Dérivée de la requête, jamais réécrite. */
export type PhasePublique = Awaited<ReturnType<typeof getDeroulePublic>>[number];
