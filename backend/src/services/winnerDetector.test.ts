import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectFinaleWinner } from './winnerDetector';
import type { PlayerRanking, PlayerRoundSummary } from './rankingsAggregator';

function buildMockRanking(overrides: Partial<PlayerRanking> & { playerId: number }): PlayerRanking {
  return {
    rank: overrides.rank ?? 1,
    playerId: overrides.playerId,
    discordPseudo: overrides.discordPseudo ?? `Player#${overrides.playerId}`,
    totalScore: overrides.totalScore ?? 0,
    top1Count: overrides.top1Count ?? 0,
    top4Count: overrides.top4Count ?? 0,
    lastGameResult: overrides.lastGameResult ?? 8,
    roundsPlayed: overrides.roundsPlayed ?? 0,
    average: overrides.average ?? 0,
    roundResults: overrides.roundResults ?? [],
    isDropped: overrides.isDropped ?? false,
  };
}

/**
 * Petit helper : construit un roundResults où le préRoundTotal (somme des rounds
 * antérieurs au dernier) vaut `preRoundTotal`, et le dernier round rapporte `lastRoundPoints`.
 */
function roundsWithPreTotal(preRoundTotal: number, lastRoundPoints: number): PlayerRoundSummary[] {
  return [
    { dayNumber: 1, roundNumber: 1, placement: 3, points: preRoundTotal },
    { dayNumber: 1, roundNumber: 2, placement: 1, points: lastRoundPoints },
  ];
}

describe('detectFinaleWinner', () => {
  it('(a) préRoundTotal = 22 + top 1 du round (score final 30) → retourne ce joueur', () => {
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 30,
        top1Count: 2,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(22, 8),
      }),
      buildMockRanking({ playerId: 2, totalScore: 14, discordPseudo: 'Bob' }),
    ];
    const winner = detectFinaleWinner(rankings, 1, 20);
    assert.ok(winner);
    assert.equal(winner!.playerId, 1);
    assert.equal(winner!.discordPseudo, 'Alice');
    assert.equal(winner!.totalScore, 30);
  });

  it('(b) préRoundTotal = 20 pile + top 1 → retourne ce joueur (seuil inclusif)', () => {
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 28,
        top1Count: 1,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(20, 8),
      }),
    ];
    const winner = detectFinaleWinner(rankings, 1, 20);
    assert.ok(winner);
    assert.equal(winner!.playerId, 1);
    assert.equal(winner!.totalScore, 28);
  });

  it('(c) préRoundTotal = 15 + top 1 → retourne null', () => {
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 23,
        top1Count: 1,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(15, 8),
      }),
    ];
    const winner = detectFinaleWinner(rankings, 1, 20);
    assert.equal(winner, null);
  });

  it('(c-bis) crossing : préRoundTotal = 14 + top 1 (score final = 22, atteint 20 PENDANT ce round) → null', () => {
    // Cas limite clé : le seuil est franchi au moment même du Top 1 — ne doit PAS gagner.
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 22,
        top1Count: 1,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(14, 8),
      }),
    ];
    const winner = detectFinaleWinner(rankings, 1, 20);
    assert.equal(winner, null);
  });

  it('(c-ter) crossing exact : préRoundTotal = 19 + top 1 (+8 = 27) → null (19 < 20)', () => {
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 27,
        top1Count: 1,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(19, 8),
      }),
    ];
    const winner = detectFinaleWinner(rankings, 1, 20);
    assert.equal(winner, null);
  });

  it('(d) top 1 du round = autre joueur avec préRoundTotal < 20 → retourne null', () => {
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 25,
        top1Count: 1,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(17, 8),
      }),
      buildMockRanking({
        playerId: 2,
        totalScore: 12,
        top1Count: 1,
        discordPseudo: 'Bob',
        roundResults: roundsWithPreTotal(4, 8),
      }),
    ];
    // Bob est top 1 du round mais préRoundTotal (4) < 20
    const winner = detectFinaleWinner(rankings, 2, 20);
    assert.equal(winner, null);
  });

  it('(e) rankings = [] → retourne null', () => {
    const winner = detectFinaleWinner([], 42, 20);
    assert.equal(winner, null);
  });

  it('(f) lastRoundTop1PlayerId introuvable → retourne null sans throw', () => {
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 30,
        top1Count: 1,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(22, 8),
      }),
    ];
    const winner = detectFinaleWinner(rankings, 999, 20);
    assert.equal(winner, null);
  });

  it('(g) top 1 sans aucun roundResults → retourne null (defensif)', () => {
    const rankings = [
      buildMockRanking({ playerId: 1, totalScore: 30, discordPseudo: 'Alice', roundResults: [] }),
    ];
    const winner = detectFinaleWinner(rankings, 1, 20);
    assert.equal(winner, null);
  });

  it('(h) identifie correctement le dernier round via roundNumber max (ordre non trié)', () => {
    // roundResults non trié : points 8 (round 3), 6 (round 1), 10 (round 2)
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 24,
        discordPseudo: 'Alice',
        roundResults: [
          { dayNumber: 1, roundNumber: 3, placement: 1, points: 8 },
          { dayNumber: 1, roundNumber: 1, placement: 4, points: 6 },
          { dayNumber: 1, roundNumber: 2, placement: 2, points: 10 },
        ],
      }),
    ];
    // Dernier round = R3 (+8 pts). PréRoundTotal = 24 - 8 = 16 → < 20 → null
    const winner = detectFinaleWinner(rankings, 1, 20);
    assert.equal(winner, null);
  });

  it('threshold custom (30) : préRoundTotal = 22 + top 1 → null', () => {
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 30,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(22, 8),
      }),
    ];
    const winner = detectFinaleWinner(rankings, 1, 30);
    assert.equal(winner, null);
  });

  it('seuil par défaut (20) si threshold non passé', () => {
    const rankings = [
      buildMockRanking({
        playerId: 1,
        totalScore: 29,
        discordPseudo: 'Alice',
        roundResults: roundsWithPreTotal(21, 8),
      }),
    ];
    const winner = detectFinaleWinner(rankings, 1);
    assert.ok(winner);
    assert.equal(winner!.playerId, 1);
  });
});
