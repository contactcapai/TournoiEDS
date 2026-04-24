import { Fragment } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PlayerRanking } from '../../types';
import { useRankingFlash } from '../../hooks/useRankingFlash';

interface OverlayRankingTableProps {
  rankings: PlayerRanking[];
}

export default function OverlayRankingTable({ rankings }: OverlayRankingTableProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const flashingIds = useRankingFlash(rankings);

  if (rankings.length === 0) return null;

  return (
    <table className="w-full border-separate border-spacing-0 font-body text-eds-light">
      <thead>
        <tr className="text-left font-heading text-2xl md:text-3xl text-eds-cyan">
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-left w-20">#</th>
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-left">Joueur</th>
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {rankings.map((ranking, index) => {
          const isTop8 = ranking.rank <= 8;
          const isFlashing = flashingIds.has(ranking.playerId);
          const showTop8Separator = ranking.rank === 8 && index < rankings.length - 1;

          const rowBg = isTop8
            ? 'bg-eds-cyan/5'
            : index % 2 === 0
              ? 'bg-white/5'
              : '';
          const droppedClasses = ranking.isDropped ? 'opacity-40 text-eds-gray' : '';
          const flashClass = isFlashing
            ? 'motion-safe:animate-[rankingFlash_1.5s_ease-out]'
            : '';
          const rankBorder = isTop8
            ? 'border-l-4 border-l-eds-cyan'
            : 'border-l-4 border-l-transparent';

          return (
            <Fragment key={ranking.playerId}>
              <motion.tr
                layout={!reduceMotion}
                layoutId={`overlay-row-${ranking.playerId}`}
                transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}
                className={`${rowBg} ${droppedClasses}`}
              >
                <td
                  className={`${flashClass} ${rankBorder} py-2 md:py-3 px-4 text-2xl md:text-3xl font-heading ${
                    isTop8 ? 'text-eds-cyan' : 'text-eds-light'
                  }`}
                >
                  {ranking.rank}
                </td>
                <td
                  className={`${flashClass} py-2 md:py-3 px-4 text-xl md:text-2xl truncate max-w-[320px] ${
                    ranking.isDropped ? 'line-through' : ''
                  }`}
                  title={ranking.discordPseudo}
                >
                  {ranking.discordPseudo}
                </td>
                <td
                  className={`${flashClass} py-2 md:py-3 px-4 text-right text-2xl md:text-3xl font-bold text-eds-gold`}
                >
                  {ranking.totalScore}
                </td>
              </motion.tr>
              {showTop8Separator && (
                <tr aria-hidden="true">
                  <td colSpan={3} className="h-[3px] bg-eds-gold/60 p-0" />
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
