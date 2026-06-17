import type { PlayerRanking } from './rankingsAggregator';

export const DEFAULT_VICTORY_THRESHOLD = 20;

/**
 * Détecte la condition de victoire en finale.
 *
 * Règle (validée Brice 2026-04-18) :
 *  1. Le joueur doit avoir atteint le seuil (>= 20 pts par défaut) AVANT le round courant
 *     (c'est-à-dire en cumul des rounds précédents uniquement).
 *  2. ET il doit être Top 1 du round courant (dernier round validé).
 *
 * Autrement dit : le seuil doit être franchi dans un round ANTÉRIEUR, puis le Top 1 d'un
 * round suivant déclenche la victoire. Traverser 20 pts pendant le round où l'on fait Top 1
 * ne suffit pas.
 *
 * Algo : on retire les points du dernier round du top 1 (round le plus haut dans
 * `roundResults`) pour obtenir son score pré-round, puis on compare au seuil.
 *
 * Exemples :
 *  - 22 pts pré-round + top 1 (score final ~30) → vainqueur
 *  - 20 pts pile pré-round + top 1 (score final ~28) → vainqueur (seuil inclusif)
 *  - 14 pts pré-round + top 1 (score final 22) → null (seuil franchi pendant ce round)
 *  - 15 pts pré-round + top 1 → null
 *  - 25 pts mais pas top 1 du round → null
 */
export function detectFinaleWinner(
  rankings: PlayerRanking[],
  lastRoundTop1PlayerId: number,
  threshold: number = DEFAULT_VICTORY_THRESHOLD
): PlayerRanking | null {
  if (rankings.length === 0) return null;
  const top1 = rankings.find((r) => r.playerId === lastRoundTop1PlayerId);
  if (!top1) return null;

  // On isole les points du dernier round (roundNumber max dans l'historique finale).
  const lastRoundEntry = top1.roundResults.reduce<(typeof top1.roundResults)[number] | null>(
    (acc, entry) => (!acc || entry.roundNumber > acc.roundNumber ? entry : acc),
    null
  );
  if (!lastRoundEntry) return null;

  const preRoundTotal = top1.totalScore - lastRoundEntry.points;
  return preRoundTotal >= threshold ? top1 : null;
}
