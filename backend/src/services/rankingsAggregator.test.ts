import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateQualificationRankings,
  aggregateFinaleRankings,
  type PrismaLike,
} from './rankingsAggregator';

interface FakeLobbyPlayer {
  playerId: number;
  placement: number | null;
  points: number | null;
  player: { discordPseudo: string; status: string };
  lobby: { roundId: number; round: { number: number; day: { number: number } } };
  // Champ technique pour le mock (non lu par le service réel) — sert à filtrer par type de Day
  __dayType: 'qualification' | 'finale';
}

function makePrismaMock(lobbyPlayers: FakeLobbyPlayer[]): PrismaLike {
  return {
    lobbyPlayer: {
      findMany: async (args?: { where?: { lobby?: { round?: { day?: { type?: string } } } } }) => {
        const requestedType = args?.where?.lobby?.round?.day?.type;
        if (!requestedType) return lobbyPlayers;
        return lobbyPlayers.filter((lp) => lp.__dayType === requestedType);
      },
    },
  } as unknown as PrismaLike;
}

function makeLobbyPlayer(overrides: {
  playerId: number;
  placement: number | null;
  points: number | null;
  discordPseudo: string;
  roundId: number;
  roundNumber?: number;
  dayNumber?: number;
  status?: string;
  dayType?: 'qualification' | 'finale';
}): FakeLobbyPlayer {
  return {
    playerId: overrides.playerId,
    placement: overrides.placement,
    points: overrides.points,
    player: {
      discordPseudo: overrides.discordPseudo,
      status: overrides.status ?? 'active',
    },
    lobby: {
      roundId: overrides.roundId,
      round: {
        number: overrides.roundNumber ?? overrides.roundId,
        day: { number: overrides.dayNumber ?? 1 },
      },
    },
    __dayType: overrides.dayType ?? 'qualification',
  };
}

describe('aggregateQualificationRankings', () => {
  it('aucun resultat → classement vide', async () => {
    const prisma = makePrismaMock([]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.deepEqual(rankings, []);
  });

  it('1 joueur, 1 round → rank 1 avec stats correctes', async () => {
    const prisma = makePrismaMock([
      makeLobbyPlayer({ playerId: 42, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 1 }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.equal(rankings.length, 1);
    assert.equal(rankings[0].rank, 1);
    assert.equal(rankings[0].playerId, 42);
    assert.equal(rankings[0].discordPseudo, 'Alice');
    assert.equal(rankings[0].totalScore, 8);
    assert.equal(rankings[0].top1Count, 1);
    assert.equal(rankings[0].top4Count, 1);
    assert.equal(rankings[0].roundsPlayed, 1);
    assert.equal(rankings[0].isDropped, false);
    assert.deepEqual(rankings[0].roundResults, [
      { dayNumber: 1, roundNumber: 1, placement: 1, points: 8 },
    ]);
  });

  it('tri par totalScore desc', async () => {
    const prisma = makePrismaMock([
      makeLobbyPlayer({ playerId: 1, placement: 5, points: 4, discordPseudo: 'Bob', roundId: 1 }),
      makeLobbyPlayer({ playerId: 2, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 1 }),
      makeLobbyPlayer({ playerId: 3, placement: 3, points: 6, discordPseudo: 'Charlie', roundId: 1 }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.equal(rankings.length, 3);
    assert.equal(rankings[0].discordPseudo, 'Alice');
    assert.equal(rankings[0].rank, 1);
    assert.equal(rankings[1].discordPseudo, 'Charlie');
    assert.equal(rankings[1].rank, 2);
    assert.equal(rankings[2].discordPseudo, 'Bob');
    assert.equal(rankings[2].rank, 3);
  });

  it('tiebreaker top1Count sur egalite de score', async () => {
    const prisma = makePrismaMock([
      makeLobbyPlayer({ playerId: 1, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 1 }),
      makeLobbyPlayer({ playerId: 1, placement: 8, points: 1, discordPseudo: 'Alice', roundId: 2 }),
      makeLobbyPlayer({ playerId: 2, placement: 4, points: 5, discordPseudo: 'Bob', roundId: 1 }),
      makeLobbyPlayer({ playerId: 2, placement: 5, points: 4, discordPseudo: 'Bob', roundId: 2 }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.equal(rankings[0].discordPseudo, 'Alice');
    assert.equal(rankings[1].discordPseudo, 'Bob');
  });

  it('tiebreaker top4Count sur egalite score + top1', async () => {
    const prisma2 = makePrismaMock([
      makeLobbyPlayer({ playerId: 1, placement: 2, points: 7, discordPseudo: 'Alice', roundId: 1 }),
      makeLobbyPlayer({ playerId: 1, placement: 4, points: 5, discordPseudo: 'Alice', roundId: 2 }),
      makeLobbyPlayer({ playerId: 2, placement: 3, points: 6, discordPseudo: 'Bob', roundId: 1 }),
      makeLobbyPlayer({ playerId: 2, placement: 5, points: 4, discordPseudo: 'Bob', roundId: 2 }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma2);
    assert.equal(rankings[0].discordPseudo, 'Alice');
    assert.equal(rankings[0].top4Count, 2);
    assert.equal(rankings[1].discordPseudo, 'Bob');
    assert.equal(rankings[1].top4Count, 1);
  });

  it('ignore les LobbyPlayer avec placement null', async () => {
    const prisma = makePrismaMock([
      makeLobbyPlayer({ playerId: 1, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 1 }),
      makeLobbyPlayer({ playerId: 2, placement: null, points: null, discordPseudo: 'Bob', roundId: 1 }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.equal(rankings.length, 1);
    assert.equal(rankings[0].discordPseudo, 'Alice');
  });

  it('multi-journees : agrege tous les rounds valides', async () => {
    const prisma = makePrismaMock([
      makeLobbyPlayer({ playerId: 1, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 1, roundNumber: 1 }),
      makeLobbyPlayer({ playerId: 1, placement: 2, points: 7, discordPseudo: 'Alice', roundId: 3, roundNumber: 3 }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.equal(rankings.length, 1);
    assert.equal(rankings[0].totalScore, 15);
    assert.equal(rankings[0].roundsPlayed, 2);
    assert.equal(rankings[0].lastGameResult, 2);
  });

  it('isDropped=true quand le status du joueur est "dropped"', async () => {
    const prisma = makePrismaMock([
      makeLobbyPlayer({
        playerId: 1,
        placement: 3,
        points: 6,
        discordPseudo: 'Alice',
        roundId: 1,
        status: 'dropped',
      }),
      makeLobbyPlayer({
        playerId: 2,
        placement: 1,
        points: 8,
        discordPseudo: 'Bob',
        roundId: 1,
        status: 'active',
      }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    const alice = rankings.find((r) => r.discordPseudo === 'Alice');
    const bob = rankings.find((r) => r.discordPseudo === 'Bob');
    assert.ok(alice);
    assert.ok(bob);
    assert.equal(alice!.isDropped, true);
    assert.equal(bob!.isDropped, false);
  });

  it('roundResults tries par roundNumber asc', async () => {
    const prisma = makePrismaMock([
      makeLobbyPlayer({ playerId: 1, placement: 4, points: 5, discordPseudo: 'Alice', roundId: 30, roundNumber: 3 }),
      makeLobbyPlayer({ playerId: 1, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 10, roundNumber: 1 }),
      makeLobbyPlayer({ playerId: 1, placement: 2, points: 7, discordPseudo: 'Alice', roundId: 20, roundNumber: 2 }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.equal(rankings.length, 1);
    assert.deepEqual(rankings[0].roundResults, [
      { dayNumber: 1, roundNumber: 1, placement: 1, points: 8 },
      { dayNumber: 1, roundNumber: 2, placement: 2, points: 7 },
      { dayNumber: 1, roundNumber: 3, placement: 4, points: 5 },
    ]);
  });

  it('multi-journees : J1 et J2 gardent des roundNumber distincts via dayNumber', async () => {
    const prisma = makePrismaMock([
      // Journée 1 : rounds 1 et 2
      makeLobbyPlayer({ playerId: 1, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 10, roundNumber: 1, dayNumber: 1 }),
      makeLobbyPlayer({ playerId: 1, placement: 4, points: 5, discordPseudo: 'Alice', roundId: 11, roundNumber: 2, dayNumber: 1 }),
      // Journée 2 : round 1 (numero recommence)
      makeLobbyPlayer({ playerId: 1, placement: 2, points: 7, discordPseudo: 'Alice', roundId: 20, roundNumber: 1, dayNumber: 2 }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.equal(rankings.length, 1);
    assert.equal(rankings[0].totalScore, 20); // 8 + 5 + 7
    assert.equal(rankings[0].roundsPlayed, 3);
    // Les 3 rounds apparaissent tous, sans fusion entre J1R1 et J2R1
    assert.deepEqual(rankings[0].roundResults, [
      { dayNumber: 1, roundNumber: 1, placement: 1, points: 8 },
      { dayNumber: 1, roundNumber: 2, placement: 4, points: 5 },
      { dayNumber: 2, roundNumber: 1, placement: 2, points: 7 },
    ]);
  });

  it('isolation : aggregateQualificationRankings ignore les LobbyPlayer de journees finale', async () => {
    const prisma = makePrismaMock([
      // 2 résultats qualif
      makeLobbyPlayer({ playerId: 1, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 1, dayType: 'qualification' }),
      makeLobbyPlayer({ playerId: 2, placement: 4, points: 5, discordPseudo: 'Bob', roundId: 1, dayType: 'qualification' }),
      // 1 résultat finale (doit être ignoré)
      makeLobbyPlayer({ playerId: 3, placement: 1, points: 8, discordPseudo: 'Carol', roundId: 99, dayType: 'finale' }),
    ]);
    const rankings = await aggregateQualificationRankings(prisma);
    assert.equal(rankings.length, 2);
    assert.ok(rankings.find((r) => r.discordPseudo === 'Alice'));
    assert.ok(rankings.find((r) => r.discordPseudo === 'Bob'));
    assert.equal(rankings.find((r) => r.discordPseudo === 'Carol'), undefined);
  });
});

describe('aggregateFinaleRankings', () => {
  it('isolation : aggregateFinaleRankings ignore les LobbyPlayer de journees qualification', async () => {
    const prisma = makePrismaMock([
      // 2 résultats qualif (doivent être ignorés)
      makeLobbyPlayer({ playerId: 1, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 1, dayType: 'qualification' }),
      makeLobbyPlayer({ playerId: 2, placement: 4, points: 5, discordPseudo: 'Bob', roundId: 1, dayType: 'qualification' }),
      // 2 résultats finale
      makeLobbyPlayer({ playerId: 3, placement: 1, points: 8, discordPseudo: 'Carol', roundId: 99, dayType: 'finale' }),
      makeLobbyPlayer({ playerId: 4, placement: 2, points: 7, discordPseudo: 'Dave', roundId: 99, dayType: 'finale' }),
    ]);
    const rankings = await aggregateFinaleRankings(prisma);
    assert.equal(rankings.length, 2);
    assert.equal(rankings[0].discordPseudo, 'Carol');
    assert.equal(rankings[0].totalScore, 8);
    assert.equal(rankings[1].discordPseudo, 'Dave');
    assert.equal(rankings[1].totalScore, 7);
  });

  it('finale vide → classement vide', async () => {
    const prisma = makePrismaMock([
      makeLobbyPlayer({ playerId: 1, placement: 1, points: 8, discordPseudo: 'Alice', roundId: 1, dayType: 'qualification' }),
    ]);
    const rankings = await aggregateFinaleRankings(prisma);
    assert.deepEqual(rankings, []);
  });
});
