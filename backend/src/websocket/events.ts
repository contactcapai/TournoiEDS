import type { Server } from 'socket.io';
import prisma from '../prisma/client';
import {
  aggregateQualificationRankings,
  aggregateFinaleRankings,
  type PlayerRanking,
} from '../services/rankingsAggregator';
import { detectFinaleWinner, DEFAULT_VICTORY_THRESHOLD } from '../services/winnerDetector';

export interface TournamentState {
  phase: 'idle' | 'qualification' | 'finale';
  currentDayId: number | null;
  currentDayNumber: number | null;
  currentDayType: 'qualification' | 'finale' | null;
  rankings: PlayerRanking[];
  winner: PlayerRanking | null;
}

export async function computeTournamentState(): Promise<TournamentState> {
  return prisma.$transaction(async (tx) => {
    const currentDay = await tx.day.findFirst({ where: { status: 'in-progress' } });
    const latestFinaleDay = await tx.day.findFirst({
      where: { type: 'finale' },
      orderBy: { createdAt: 'desc' },
    });
    const finaleCompleted = latestFinaleDay?.status === 'completed';

    const phase: TournamentState['phase'] = currentDay
      ? (currentDay.type as 'qualification' | 'finale')
      : 'idle';

    const useFinaleRankings = currentDay?.type === 'finale' || finaleCompleted;
    const rankings = useFinaleRankings
      ? await aggregateFinaleRankings(tx)
      : await aggregateQualificationRankings(tx);

    let winner: PlayerRanking | null = null;
    if (finaleCompleted && latestFinaleDay) {
      const lastRound = await tx.round.findFirst({
        where: { dayId: latestFinaleDay.id, status: 'validated' },
        orderBy: { number: 'desc' },
        include: { lobbies: { include: { players: true } } },
      });
      const top1 = lastRound?.lobbies[0]?.players.find((lp) => lp.placement === 1);
      if (top1) {
        winner = detectFinaleWinner(rankings, top1.playerId, DEFAULT_VICTORY_THRESHOLD);
      }
    }

    return {
      phase,
      currentDayId: currentDay?.id ?? null,
      currentDayNumber: currentDay?.number ?? null,
      currentDayType: (currentDay?.type as 'qualification' | 'finale' | null) ?? null,
      rankings,
      winner,
    };
  });
}

export async function emitRankingUpdated(io: Server | null): Promise<void> {
  if (!io) {
    console.warn('emitRankingUpdated: IO not initialized, skipping emit');
    return;
  }
  try {
    // Réutilise computeTournamentState pour décider qualif vs finale rankings —
    // garantit la cohérence avec le state émis ailleurs.
    const state = await computeTournamentState();
    io.of('/tournament').emit('ranking_updated', {
      event: 'ranking_updated',
      timestamp: new Date().toISOString(),
      data: { rankings: state.rankings },
    });
  } catch (error) {
    console.error("Erreur lors de l'emission ranking_updated:", error);
  }
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleRankingUpdated(io: Server | null): void {
  if (!io) {
    console.warn('scheduleRankingUpdated: IO not initialized, skipping');
    return;
  }
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    void emitRankingUpdated(io);
  }, 100);
}

export async function emitTournamentStateChanged(io: Server | null): Promise<void> {
  if (!io) {
    console.warn('emitTournamentStateChanged: IO not initialized, skipping emit');
    return;
  }
  try {
    const state = await computeTournamentState();
    io.of('/tournament').emit('tournament_state_changed', {
      event: 'tournament_state_changed',
      timestamp: new Date().toISOString(),
      data: state,
    });
  } catch (error) {
    console.error("Erreur lors de l'emission tournament_state_changed:", error);
  }
}
