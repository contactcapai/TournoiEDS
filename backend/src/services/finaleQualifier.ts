import type { PlayerRanking } from './rankingsAggregator';

const DEFAULT_FINALE_SIZE = 8;

/**
 * Selectionne les finalistes depuis un classement cumule des qualifications.
 *
 * CONTRAT : `rankings` doit etre deja trie selon les tiebreakers officiels
 * (totalScore desc -> top1Count desc -> top4Count desc -> lastGameResult asc),
 * ce qui est le cas si produit par `aggregateQualificationRankings()`.
 * La fonction NE re-trie PAS : elle se contente de retourner les N premiers.
 *
 * @param rankings classement cumule deja trie
 * @param maxFinalists nombre max de finalistes (defaut: 8)
 * @returns les `maxFinalists` premiers joueurs, ou tous si moins de `maxFinalists` dans l'entree
 */
export function selectFinalists(
  rankings: PlayerRanking[],
  maxFinalists: number = DEFAULT_FINALE_SIZE,
): PlayerRanking[] {
  if (rankings.length === 0) return [];
  return rankings.slice(0, maxFinalists);
}
