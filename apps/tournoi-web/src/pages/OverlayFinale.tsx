import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { useTournament } from '../hooks/useTournament';
import { useRankingFlash } from '../hooks/useRankingFlash';
import { fetchFinaleRankings, fetchRankings } from '../services/api';
import LogoEds from '../components/common/LogoEds';
import type { PlayerRanking } from '../types';

function OverlayFinaleRankingTable({
  rankings,
  winnerId,
}: {
  rankings: PlayerRanking[];
  winnerId?: number | null;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const flashingIds = useRankingFlash(rankings);

  if (rankings.length === 0) return null;

  return (
    <table className="w-full border-separate border-spacing-0 font-body text-eds-light">
      <thead>
        <tr className="text-left font-heading text-2xl md:text-3xl text-eds-cyan">
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-left w-20">#</th>
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-left">Joueur</th>
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-right w-28">Total</th>
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-left w-72">Progression</th>
        </tr>
      </thead>
      <tbody>
        {rankings.map((r) => {
          const pct = Math.min(100, (r.totalScore / 20) * 100);
          const isWinner = winnerId === r.playerId;
          const isEligible = r.totalScore >= 20;
          const isFlashing = flashingIds.has(r.playerId);
          const rowBg = isWinner
            ? 'bg-eds-gold/15 border-l-4 border-l-eds-gold'
            : 'bg-white/5 border-l-4 border-l-eds-cyan';
          const flashClass = isFlashing
            ? 'motion-safe:animate-[rankingFlash_1.5s_ease-out]'
            : '';
          const rankColor = isWinner ? 'text-eds-gold' : 'text-eds-cyan';
          const totalColor = isWinner ? 'text-eds-gold' : 'text-eds-gold';
          const ratioClass = pct >= 100
            ? 'font-heading text-eds-gold text-xl md:text-2xl'
            : 'font-body text-eds-gold text-base md:text-lg';

          return (
            <motion.tr
              key={r.playerId}
              layout={!reduceMotion}
              layoutId={`overlay-finale-row-${r.playerId}`}
              transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}
              className={`${rowBg}`}
            >
              <td
                className={`${flashClass} py-2 md:py-3 px-4 text-2xl md:text-3xl font-heading ${rankColor}`}
              >
                {r.rank}
              </td>
              <td
                className={`${flashClass} py-2 md:py-3 px-4 text-xl md:text-2xl truncate max-w-[320px]`}
                title={r.discordPseudo}
              >
                {r.discordPseudo}
                {isEligible && !isWinner && (
                  <span
                    className="ml-2 rounded border border-eds-gold bg-eds-gold/20 px-2 py-0.5 font-heading text-xs md:text-sm text-eds-gold motion-safe:animate-pulse"
                    title="Le joueur a atteint 20 pts. Un Top 1 au prochain round = victoire."
                  >
                    ⚡ Eligible
                  </span>
                )}
              </td>
              <td
                className={`${flashClass} py-2 md:py-3 px-4 text-right text-2xl md:text-3xl font-bold ${totalColor}`}
              >
                {r.totalScore}
              </td>
              <td className="py-2 md:py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-32 md:w-44 overflow-hidden rounded-full bg-eds-gray/20">
                    <div className="h-full bg-eds-gold/80" style={{ width: `${pct}%` }} />
                  </div>
                  <span className={ratioClass}>{r.totalScore}/20</span>
                </div>
              </td>
            </motion.tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OverlayQualifiersPreview({ rankings }: { rankings: PlayerRanking[] }) {
  const qualifiers = rankings.slice(0, 8);
  if (qualifiers.length === 0) return null;
  return (
    <table className="w-full border-separate border-spacing-0 font-body text-eds-light">
      <thead>
        <tr className="text-left font-heading text-2xl md:text-3xl text-eds-gold">
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-left w-20">#</th>
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-left">Joueur</th>
          <th className="border-b-2 border-eds-gold/60 py-3 px-4 text-right w-32">Score</th>
        </tr>
      </thead>
      <tbody>
        {qualifiers.map((r) => (
          <tr key={r.playerId} className="bg-white/5 border-l-4 border-l-eds-cyan">
            <td className="py-2 md:py-3 px-4 text-2xl md:text-3xl font-heading text-eds-cyan">
              {r.rank}
            </td>
            <td
              className="py-2 md:py-3 px-4 text-xl md:text-2xl truncate max-w-[320px]"
              title={r.discordPseudo}
            >
              {r.discordPseudo}
            </td>
            <td className="py-2 md:py-3 px-4 text-right text-2xl md:text-3xl font-bold text-eds-gold">
              {r.totalScore}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function OverlayFinale() {
  const { state } = useTournament();
  const [searchParams] = useSearchParams();
  const isTransparent = searchParams.get('transparent') === '1';

  const [finaleRankings, setFinaleRankings] = useState<PlayerRanking[]>([]);
  const [qualRankingsForPreview, setQualRankingsForPreview] = useState<PlayerRanking[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchFinaleRankings(), fetchRankings()])
      .then(([finaleRes, qualRes]) => {
        if (cancelled) return;
        if ('data' in finaleRes) setFinaleRankings(finaleRes.data);
        if ('data' in qualRes) setQualRankingsForPreview(qualRes.data);
      })
      .catch(() => {
        // Silencieux : overlay reste sur l'etat WebSocket
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const useContextRankings =
    state.rankings.length > 0 && (state.currentDayType === 'finale' || state.winner !== null);
  const effectiveRankings = useContextRankings ? state.rankings : finaleRankings;

  const mainBg = isTransparent ? 'bg-transparent' : 'bg-eds-dark';
  const containerClasses = `mx-auto flex min-h-[calc(100svh-3rem)] max-w-5xl flex-col md:min-h-[calc(100svh-5rem)] lg:min-h-[calc(100svh-6rem)]`;

  // Etat 1 : vainqueur detecte (UX-DR8 — animation or)
  if (state.winner) {
    return (
      <main
        className={`relative min-h-svh ${mainBg} overflow-hidden p-6 md:p-10 lg:p-12`}
      >
        <div className={containerClasses}>
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mb-6 rounded-xl border-2 border-eds-gold bg-eds-gold/10 py-6 px-6 text-center motion-safe:animate-heroGlow"
          >
            <div className="text-7xl md:text-8xl" aria-hidden="true">
              🏆
            </div>
            <h1 className="mt-3 font-heading text-5xl md:text-7xl text-eds-gold">
              {state.winner.discordPseudo}
            </h1>
            <p className="mt-2 font-body text-xl md:text-2xl text-eds-light">
              Vainqueur EDS — {state.winner.totalScore} pts cumules finale
            </p>
          </motion.div>
          <OverlayFinaleRankingTable
            rankings={effectiveRankings}
            winnerId={state.winner.playerId}
          />
        </div>
      </main>
    );
  }

  // Etat 2 : finale en cours (UX-DR7 — progression victoire)
  if (state.currentDayType === 'finale') {
    return (
      <main
        className={`relative min-h-svh ${mainBg} overflow-hidden p-6 md:p-10 lg:p-12`}
      >
        <div className={containerClasses}>
          <header className="mb-4 text-center md:mb-6">
            <h1 className="font-heading text-4xl text-eds-gold md:text-5xl lg:text-6xl motion-safe:animate-heroGlow">
              Finale EDS
            </h1>
            <p className="font-body text-eds-gray mt-2 text-lg md:text-xl">
              Top 1 + 20 pts cumules = victoire
            </p>
          </header>
          <OverlayFinaleRankingTable rankings={effectiveRankings} />
        </div>
      </main>
    );
  }

  // Etat 3 : qualifs terminees, finale pas lancee → preview top 8
  const qualifsCompleted =
    state.phase === 'idle' && qualRankingsForPreview.length >= 8;
  if (qualifsCompleted) {
    return (
      <main
        className={`relative min-h-svh ${mainBg} overflow-hidden p-6 md:p-10 lg:p-12`}
      >
        <div className={containerClasses}>
          <header className="mb-4 text-center md:mb-6">
            <h1 className="font-heading text-4xl text-eds-gold md:text-5xl lg:text-6xl motion-safe:animate-heroGlow">
              Top 8 qualifies
            </h1>
            <p className="font-body text-eds-gray mt-2 text-lg md:text-xl">
              En attente du lancement de la finale
            </p>
          </header>
          <OverlayQualifiersPreview rankings={qualRankingsForPreview} />
        </div>
      </main>
    );
  }

  // Etat 4 : defaut (finale pas commencee, qualifs en cours ou vide)
  return (
    <main
      className={`relative min-h-svh ${mainBg} overflow-hidden p-6 md:p-10 lg:p-12`}
    >
      <div className={`${containerClasses} items-center justify-center`}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <LogoEds className="h-24 w-auto md:h-32 lg:h-40 motion-safe:animate-heroGlow" />
          <p className="font-heading text-3xl text-eds-gold md:text-4xl">
            Finale EDS
          </p>
          <p className="font-body text-xl text-eds-gray md:text-2xl">
            En attente du lancement…
          </p>
        </div>
      </div>
    </main>
  );
}
