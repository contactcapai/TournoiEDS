import { motion, useReducedMotion } from 'framer-motion';
import { useRankingFlash } from '../../hooks/useRankingFlash';
import type { PlayerRanking } from '../../types';

interface FinaleRankingTableProps {
  rankings: PlayerRanking[];
  winnerId?: number | null;
}

function formatPlacement(placement: number): string {
  return placement === 1 ? '1er' : `${placement}e`;
}

export default function FinaleRankingTable({ rankings, winnerId }: FinaleRankingTableProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const flashingIds = useRankingFlash(rankings);

  if (rankings.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg bg-eds-dark/50 p-4">
      <table className="w-full border-separate border-spacing-0 text-left font-body text-eds-light">
        <thead>
          <tr className="border-b border-white/10 font-heading text-sm text-eds-gold">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Joueur</th>
            <th className="px-3 py-2">Placements</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2">Progression</th>
          </tr>
        </thead>
        <motion.tbody>
          {rankings.map((r) => {
            const pct = Math.min(100, (r.totalScore / 20) * 100);
            const isWinner = winnerId === r.playerId;
            const isEligible = r.totalScore >= 20;
            const isFlashing = flashingIds.has(r.playerId);
            const borderClass = isWinner
              ? 'border-l-4 border-l-eds-gold bg-eds-gold/10'
              : 'border-l-2 border-l-eds-cyan';
            const flashClass = isFlashing
              ? 'motion-safe:animate-[rankingFlash_1.5s_ease-out]'
              : '';
            const rankColor = r.rank === 1 || isWinner ? 'text-eds-gold' : 'text-eds-cyan';
            const ratioClass = pct >= 100
              ? 'font-heading text-eds-gold'
              : 'font-body text-sm text-eds-gold';
            const roundsLabel = r.roundResults && r.roundResults.length > 0
              ? r.roundResults
                  .map((s) => `R${s.roundNumber}: ${formatPlacement(s.placement)} (${s.points}pts)`)
                  .join(' | ')
              : '—';

            return (
              <motion.tr
                key={r.playerId}
                layout={!reduceMotion}
                layoutId={`finale-row-${r.playerId}`}
                transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}
                className={`${borderClass} ${flashClass}`}
              >
                <td className={`px-3 py-2 font-heading text-xl ${rankColor}`}>{r.rank}</td>
                <td className="px-3 py-2 font-body text-eds-light">
                  {r.discordPseudo}
                  {isEligible && !isWinner && (
                    <span
                      className="ml-2 rounded border border-eds-gold bg-eds-gold/20 px-2 py-0.5 font-heading text-xs text-eds-gold motion-safe:animate-pulse"
                      title="Le joueur a atteint 20 pts. Un Top 1 au prochain round = victoire."
                    >
                      ⚡ Éligible victoire
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-body text-sm text-eds-gray whitespace-nowrap">
                  {roundsLabel}
                </td>
                <td className="px-3 py-2 text-right font-heading text-xl text-eds-gold">
                  {r.totalScore}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-24 md:w-32 overflow-hidden rounded-full bg-eds-gray/20">
                      <div className="h-full bg-eds-gold/80" style={{ width: `${pct}%` }} />
                    </div>
                    <span className={ratioClass}>{r.totalScore}/20</span>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </motion.tbody>
      </table>
    </div>
  );
}
