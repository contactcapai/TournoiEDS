import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectFinalists } from './finaleQualifier';
import type { PlayerRanking } from './rankingsAggregator';

function mockRanking(rank: number, playerId: number, totalScore: number): PlayerRanking {
  return {
    rank,
    playerId,
    discordPseudo: `player${playerId}`,
    totalScore,
    top1Count: 0,
    top4Count: 0,
    lastGameResult: 0,
    roundsPlayed: 0,
    average: 0,
    roundResults: [],
    isDropped: false,
  };
}

function buildMockRankings(count: number): PlayerRanking[] {
  return Array.from({ length: count }, (_, i) =>
    mockRanking(i + 1, i + 1, 100 - i),
  );
}

describe('selectFinalists', () => {
  it('happy path — 10 joueurs, retourne les 8 premiers ordonnes', () => {
    const rankings = buildMockRankings(10);
    const finalists = selectFinalists(rankings);
    assert.equal(finalists.length, 8);
    assert.deepEqual(
      finalists.map((r) => r.rank),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
  });

  it('moins de 8 joueurs — retourne tous les joueurs sans erreur', () => {
    const rankings = buildMockRankings(5);
    const finalists = selectFinalists(rankings);
    assert.equal(finalists.length, 5);
    assert.deepEqual(
      finalists.map((r) => r.rank),
      [1, 2, 3, 4, 5],
    );
  });

  it('entree vide — retourne un tableau vide', () => {
    assert.deepEqual(selectFinalists([]), []);
  });

  it('exactement 8 joueurs — retourne exactement 8', () => {
    const rankings = buildMockRankings(8);
    const finalists = selectFinalists(rankings);
    assert.equal(finalists.length, 8);
  });

  it('respecte le parametre maxFinalists custom', () => {
    const rankings = buildMockRankings(10);
    assert.equal(selectFinalists(rankings, 4).length, 4);
  });

  it('preserve l\'ordre de l\'entree pre-triee (ne re-trie pas)', () => {
    // Entree deliberement pre-triee par l'appelant : le service ne doit pas reordonner.
    // Ici on force un ordre arbitraire pour verifier que selectFinalists respecte l'ordre.
    const rankings: PlayerRanking[] = [
      mockRanking(1, 42, 50),
      mockRanking(2, 17, 49),
      mockRanking(3, 99, 48),
    ];
    const finalists = selectFinalists(rankings, 2);
    assert.deepEqual(
      finalists.map((r) => r.playerId),
      [42, 17],
    );
  });

  it('tiebreaker au 8e rang deja resolu en amont — retourne le 8e pre-trie', () => {
    // Simulation : 9 joueurs dont le 8e et 9e ont meme totalScore mais departitionnes
    // par top1Count (deja applique dans l'ordre d'entree).
    const rankings: PlayerRanking[] = [
      ...buildMockRankings(7),
      { ...mockRanking(8, 88, 45), top1Count: 3, top4Count: 5, lastGameResult: 2 },
      { ...mockRanking(9, 99, 45), top1Count: 2, top4Count: 5, lastGameResult: 3 },
    ];
    const finalists = selectFinalists(rankings);
    assert.equal(finalists.length, 8);
    assert.equal(finalists[7].playerId, 88);
  });
});
