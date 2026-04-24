/**
 * Calcul des points et tiebreakers pour le tournoi TFT.
 * Barème : 1er d'un lobby de N joueurs = N points, dernier = 1 point.
 */

export interface PlayerRoundResult {
  placement: number;
  points: number;
  roundId: number;
}

export interface PlayerStats {
  totalScore: number;
  top1Count: number;
  top4Count: number;
  lastGameResult: number;
  roundsPlayed: number;
  average: number;
}

const MAX_LOBBY_SIZE = 8;

export function calculatePoints(placement: number, _lobbySize: number): number {
  return MAX_LOBBY_SIZE - placement + 1;
}

export function calculatePlayerStats(results: PlayerRoundResult[]): PlayerStats {
  if (results.length === 0) {
    return {
      totalScore: 0,
      top1Count: 0,
      top4Count: 0,
      lastGameResult: 0,
      roundsPlayed: 0,
      average: 0,
    };
  }

  const totalScore = results.reduce((sum, r) => sum + r.points, 0);
  const top1Count = results.filter((r) => r.placement === 1).length;
  const top4Count = results.filter((r) => r.placement <= 4).length;
  const roundsPlayed = results.length;

  // Dernier round joué = celui avec le roundId le plus élevé
  const lastResult = results.reduce((latest, r) =>
    r.roundId > latest.roundId ? r : latest
  );
  const lastGameResult = lastResult.placement;

  const average = Math.round((totalScore / roundsPlayed) * 100) / 100;

  return {
    totalScore,
    top1Count,
    top4Count,
    lastGameResult,
    roundsPlayed,
    average,
  };
}
