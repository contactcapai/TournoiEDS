import { Fragment } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PlayerRanking, PlayerRoundSummary } from '../../types';
import { useRankingFlash } from '../../hooks/useRankingFlash';

interface RankingTableProps {
  rankings: PlayerRanking[];
  isConnected: boolean;
}

interface RoundKey {
  dayNumber: number;
  roundNumber: number;
}

interface DayGroup {
  dayNumber: number;
  rounds: RoundKey[];
}

const STICKY_RANK = 'sticky left-0 z-10 w-11 min-w-[44px]';
const STICKY_PSEUDO = 'sticky left-11 z-10 w-32 min-w-[128px]';
const STICKY_TOTAL = 'sticky left-[172px] z-10 w-14 min-w-[56px]';

const containerVariants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

function buildRoundStructure(rankings: PlayerRanking[]): {
  orderedRounds: RoundKey[];
  dayGroups: DayGroup[];
} {
  const seen = new Map<string, RoundKey>();
  for (const r of rankings) {
    for (const rr of r.roundResults) {
      const key = `${rr.dayNumber}-${rr.roundNumber}`;
      if (!seen.has(key)) {
        seen.set(key, { dayNumber: rr.dayNumber, roundNumber: rr.roundNumber });
      }
    }
  }
  const orderedRounds = Array.from(seen.values()).sort((a, b) =>
    a.dayNumber !== b.dayNumber
      ? a.dayNumber - b.dayNumber
      : a.roundNumber - b.roundNumber
  );

  const dayGroups: DayGroup[] = [];
  for (const rk of orderedRounds) {
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.dayNumber === rk.dayNumber) {
      last.rounds.push(rk);
    } else {
      dayGroups.push({ dayNumber: rk.dayNumber, rounds: [rk] });
    }
  }

  return { orderedRounds, dayGroups };
}

function findResult(
  results: PlayerRoundSummary[],
  rk: RoundKey
): PlayerRoundSummary | undefined {
  return results.find(
    (r) => r.dayNumber === rk.dayNumber && r.roundNumber === rk.roundNumber
  );
}

export default function RankingTable({ rankings, isConnected }: RankingTableProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const { orderedRounds, dayGroups } = buildRoundStructure(rankings);
  const totalColumns = 3 + orderedRounds.length * 2 + 4;
  const hasRounds = orderedRounds.length > 0;

  const flashingIds = useRankingFlash(rankings);

  const tbodyAnimationProps = reduceMotion
    ? {}
    : {
        variants: containerVariants,
        initial: 'hidden' as const,
        animate: 'show' as const,
      };
  const rowVariants = reduceMotion ? undefined : itemVariants;

  return (
    <div>
      {!isConnected && (
        <div
          role="status"
          className="mb-3 rounded border border-eds-gold/40 bg-eds-gold/10 px-3 py-2 font-body text-sm text-eds-gold"
        >
          Connexion perdue — reconnexion en cours...
        </div>
      )}

      {rankings.length === 0 ? (
        <p className="py-16 text-center font-body text-eds-gray">
          Aucun résultat disponible — les scores apparaîtront après la validation du premier round.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-eds-gray/20">
          <table className="w-full border-separate border-spacing-0 font-body text-eds-light">
            <thead>
              {/* Ligne 1 : groupes par journée + colonnes fixes (rowSpan=3) */}
              <tr className="text-left font-heading text-eds-cyan">
                <th
                  rowSpan={hasRounds ? 3 : 1}
                  className={`${STICKY_RANK} border-b border-eds-gray/40 bg-eds-dark px-3 py-3 align-bottom text-sm`}
                >
                  Rang
                </th>
                <th
                  rowSpan={hasRounds ? 3 : 1}
                  className={`${STICKY_PSEUDO} border-b border-eds-gray/40 bg-eds-dark px-3 py-3 align-bottom text-sm`}
                >
                  Pseudo
                </th>
                <th
                  rowSpan={hasRounds ? 3 : 1}
                  className={`${STICKY_TOTAL} border-b border-eds-gray/40 bg-eds-dark px-3 py-3 text-right align-bottom text-sm`}
                >
                  Total
                </th>
                {dayGroups.map((group) => (
                  <th
                    key={`day-${group.dayNumber}`}
                    colSpan={group.rounds.length * 2}
                    className="whitespace-nowrap border-b border-eds-gray/40 border-l-2 border-l-eds-gold/60 bg-eds-dark px-3 py-2 text-center text-sm text-eds-gold"
                  >
                    Journée {group.dayNumber}
                  </th>
                ))}
                <th
                  rowSpan={hasRounds ? 3 : 1}
                  className="whitespace-nowrap border-b border-eds-gray/40 border-l-2 border-l-eds-gold/60 bg-eds-dark px-3 py-3 text-right align-bottom text-sm"
                >
                  Moy
                </th>
                <th
                  rowSpan={hasRounds ? 3 : 1}
                  className="border-b border-eds-gray/40 bg-eds-dark px-3 py-3 text-right align-bottom text-sm"
                >
                  Top 1
                </th>
                <th
                  rowSpan={hasRounds ? 3 : 1}
                  className="border-b border-eds-gray/40 bg-eds-dark px-3 py-3 text-right align-bottom text-sm"
                >
                  Top 4
                </th>
                <th
                  rowSpan={hasRounds ? 3 : 1}
                  className="border-b border-eds-gray/40 bg-eds-dark px-3 py-3 text-right align-bottom text-sm"
                >
                  Dern.
                </th>
              </tr>
              {/* Ligne 2 : numéros de rounds par journée */}
              {hasRounds && (
                <tr className="text-center font-heading text-eds-cyan">
                  {dayGroups.map((group) =>
                    group.rounds.map((rk, idx) => (
                      <th
                        key={`r-head-${rk.dayNumber}-${rk.roundNumber}`}
                        colSpan={2}
                        className={`whitespace-nowrap border-b border-eds-gray/30 bg-eds-dark px-3 py-2 text-sm ${
                          idx === 0
                            ? 'border-l-2 border-l-eds-gold/60'
                            : 'border-l border-l-eds-gray/20'
                        }`}
                      >
                        R{rk.roundNumber}
                      </th>
                    ))
                  )}
                </tr>
              )}
              {/* Ligne 3 : sous-en-têtes Place / Pts */}
              {hasRounds && (
                <tr className="text-xs text-eds-gray">
                  {dayGroups.map((group) =>
                    group.rounds.map((rk, idx) => (
                      <Fragment key={`sub-${rk.dayNumber}-${rk.roundNumber}`}>
                        <th
                          className={`whitespace-nowrap border-b border-eds-gray/30 bg-eds-dark px-3 py-1 text-center ${
                            idx === 0
                              ? 'border-l-2 border-l-eds-gold/60'
                              : 'border-l border-l-eds-gray/20'
                          }`}
                        >
                          Place
                        </th>
                        <th className="whitespace-nowrap border-b border-eds-gray/30 bg-eds-dark px-3 py-1 text-center">
                          Pts
                        </th>
                      </Fragment>
                    ))
                  )}
                </tr>
              )}
            </thead>
            <motion.tbody {...tbodyAnimationProps}>
              {rankings.map((ranking, index) => {
                const isTop8 = ranking.rank <= 8;
                const showTop8Separator = ranking.rank === 8 && index < rankings.length - 1;
                const isEven = index % 2 === 0;
                const stickyBg = isEven ? 'bg-[#343163]' : 'bg-eds-dark';
                const normalBg = isEven ? 'bg-white/5' : '';
                const isFlashing = flashingIds.has(ranking.playerId);
                const droppedClasses = ranking.isDropped
                  ? isFlashing
                    ? 'opacity-60 text-eds-gray'
                    : 'opacity-40 text-eds-gray'
                  : '';
                const rankBorder = isTop8
                  ? 'border-l-2 border-l-eds-cyan'
                  : 'border-l-2 border-l-transparent';
                const rowHover = isTop8
                  ? '[@media(hover:hover)]:hover:bg-white/10'
                  : '[@media(hover:hover)]:hover:bg-white/10 [@media(hover:hover)]:hover:border-l-eds-cyan/50';
                const flashClass = isFlashing
                  ? 'motion-safe:animate-[rankingFlash_1.5s_ease-out]'
                  : '';

                return (
                  <Fragment key={ranking.playerId}>
                    <motion.tr
                      layout={!reduceMotion}
                      layoutId={`rank-row-${ranking.playerId}`}
                      variants={rowVariants}
                      transition={{ layout: { duration: 0.35, ease: 'easeInOut' } }}
                      data-flashing={isFlashing ? 'true' : 'false'}
                      className={`${droppedClasses} ${rowHover} transition-colors duration-150`}
                    >
                      <td
                        className={`${STICKY_RANK} ${stickyBg} ${rankBorder} ${flashClass} px-3 py-2 text-sm font-medium`}
                      >
                        <span className={isTop8 ? 'text-eds-cyan' : 'text-eds-light'}>
                          {ranking.rank}
                        </span>
                      </td>
                      <td
                        className={`${STICKY_PSEUDO} ${stickyBg} ${flashClass} truncate px-3 py-2 text-sm ${
                          ranking.isDropped ? 'line-through' : ''
                        }`}
                        title={ranking.discordPseudo}
                      >
                        {ranking.discordPseudo}
                      </td>
                      <td
                        className={`${STICKY_TOTAL} ${stickyBg} ${flashClass} px-3 py-2 text-right text-sm font-bold text-eds-gold`}
                      >
                        {ranking.totalScore}
                      </td>
                      {dayGroups.map((group) =>
                        group.rounds.map((rk, idx) => {
                          const result = findResult(ranking.roundResults, rk);
                          const placeBorder =
                            idx === 0
                              ? 'border-l-2 border-l-eds-gold/60'
                              : 'border-l border-l-eds-gray/20';
                          return (
                            <Fragment
                              key={`c-${ranking.playerId}-${rk.dayNumber}-${rk.roundNumber}`}
                            >
                              <td
                                className={`${normalBg} ${flashClass} whitespace-nowrap px-3 py-2 text-center text-sm ${placeBorder}`}
                              >
                                {result ? result.placement : '—'}
                              </td>
                              <td
                                className={`${normalBg} ${flashClass} whitespace-nowrap px-3 py-2 text-center text-sm`}
                              >
                                {result ? result.points : '—'}
                              </td>
                            </Fragment>
                          );
                        })
                      )}
                      <td
                        className={`${normalBg} ${flashClass} whitespace-nowrap border-l-2 border-l-eds-gold/60 px-3 py-2 text-right text-sm`}
                      >
                        {ranking.average.toFixed(2)}
                      </td>
                      <td className={`${normalBg} ${flashClass} px-3 py-2 text-right text-sm`}>
                        {ranking.top1Count}
                      </td>
                      <td className={`${normalBg} ${flashClass} px-3 py-2 text-right text-sm`}>
                        {ranking.top4Count}
                      </td>
                      <td className={`${normalBg} ${flashClass} px-3 py-2 text-right text-sm`}>
                        {ranking.lastGameResult || '—'}
                      </td>
                    </motion.tr>
                    {showTop8Separator && (
                      <tr aria-hidden="true">
                        <td colSpan={totalColumns} className="h-[2px] bg-eds-gold/60 p-0" />
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  );
}
