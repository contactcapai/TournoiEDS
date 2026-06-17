import type { Prisma } from '@prisma/client';
import { calculatePlayerStats } from './pointsCalculator';

// Accepte aussi bien un PrismaClient complet qu'un client de transaction (`tx` issu de `$transaction`).
export type PrismaLike = Prisma.TransactionClient;

export interface PlayerRoundSummary {
  dayNumber: number;
  roundNumber: number;
  placement: number;
  points: number;
}

export interface PlayerRanking {
  rank: number;
  playerId: number;
  discordPseudo: string;
  totalScore: number;
  top1Count: number;
  top4Count: number;
  lastGameResult: number;
  roundsPlayed: number;
  average: number;
  roundResults: PlayerRoundSummary[];
  isDropped: boolean;
}

export type DayType = 'qualification' | 'finale';

async function aggregateRankingsByDayType(
  prisma: PrismaLike,
  type: DayType
): Promise<PlayerRanking[]> {
  const allLobbyPlayers = await prisma.lobbyPlayer.findMany({
    where: {
      placement: { not: null },
      lobby: {
        round: {
          status: 'validated',
          day: { type },
        },
      },
    },
    include: {
      player: { select: { discordPseudo: true, status: true } },
      lobby: {
        include: {
          round: {
            select: {
              number: true,
              day: { select: { number: true } },
            },
          },
        },
      },
    },
  });

  const playerResultsMap = new Map<
    number,
    {
      discordPseudo: string;
      status: string;
      results: {
        placement: number;
        points: number;
        roundId: number;
        roundNumber: number;
        dayNumber: number;
      }[];
    }
  >();

  for (const lp of allLobbyPlayers) {
    if (lp.placement === null || lp.points === null) continue;
    const result = {
      placement: lp.placement,
      points: lp.points,
      roundId: lp.lobby.roundId,
      roundNumber: lp.lobby.round.number,
      dayNumber: lp.lobby.round.day.number,
    };
    const existing = playerResultsMap.get(lp.playerId);
    if (existing) {
      existing.results.push(result);
    } else {
      playerResultsMap.set(lp.playerId, {
        discordPseudo: lp.player.discordPseudo,
        status: lp.player.status,
        results: [result],
      });
    }
  }

  const rankings = Array.from(playerResultsMap.entries()).map(([playerId, data]) => {
    const stats = calculatePlayerStats(data.results);
    const roundResults = [...data.results]
      .sort((a, b) =>
        a.dayNumber !== b.dayNumber
          ? a.dayNumber - b.dayNumber
          : a.roundNumber - b.roundNumber
      )
      .map(({ dayNumber, roundNumber, placement, points }) => ({
        dayNumber,
        roundNumber,
        placement,
        points,
      }));
    return {
      playerId,
      discordPseudo: data.discordPseudo,
      isDropped: data.status === 'dropped',
      roundResults,
      ...stats,
    };
  });

  rankings.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.top1Count !== a.top1Count) return b.top1Count - a.top1Count;
    if (b.top4Count !== a.top4Count) return b.top4Count - a.top4Count;
    return a.lastGameResult - b.lastGameResult;
  });

  return rankings.map((r, index) => ({ rank: index + 1, ...r }));
}

export async function aggregateQualificationRankings(
  prisma: PrismaLike
): Promise<PlayerRanking[]> {
  return aggregateRankingsByDayType(prisma, 'qualification');
}

export async function aggregateFinaleRankings(
  prisma: PrismaLike
): Promise<PlayerRanking[]> {
  return aggregateRankingsByDayType(prisma, 'finale');
}
