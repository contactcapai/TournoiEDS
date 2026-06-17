import { useEffect, useState } from 'react';
import { useTournament } from '../hooks/useTournament';
import { fetchFinaleRankings, fetchRankings } from '../services/api';
import FinaleRankingTable from '../components/finale/FinaleRankingTable';
import FinaleWinnerBanner from '../components/finale/FinaleWinnerBanner';
import FinaleQualifiersPreview from '../components/finale/FinaleQualifiersPreview';
import LogoEds from '../components/common/LogoEds';
import type { PlayerRanking } from '../types';

export default function Finale() {
  const { state } = useTournament();
  const [finaleRankings, setFinaleRankings] = useState<PlayerRanking[]>([]);
  const [qualRankingsForPreview, setQualRankingsForPreview] = useState<PlayerRanking[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchFinaleRankings(), fetchRankings()])
      .then(([finaleRes, qualRes]) => {
        if (cancelled) return;
        if ('data' in finaleRes) setFinaleRankings(finaleRes.data);
        if ('data' in qualRes) setQualRankingsForPreview(qualRes.data);
        if ('error' in finaleRes || 'error' in qualRes) setError('Partial fetch failure');
      })
      .catch(() => {
        if (!cancelled) setError('Network error');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRankings(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const useContextRankings =
    state.rankings.length > 0 && (state.currentDayType === 'finale' || state.winner !== null);
  const effectiveRankings = useContextRankings ? state.rankings : finaleRankings;

  // Etat 1 : vainqueur detecte
  if (state.winner) {
    return (
      <main className="container mx-auto px-4 py-8">
        <FinaleWinnerBanner winner={state.winner} />
        <FinaleRankingTable rankings={effectiveRankings} winnerId={state.winner.playerId} />
      </main>
    );
  }

  // Etat 2 : finale en cours
  if (state.currentDayType === 'finale') {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-6 font-heading text-5xl text-eds-light">Finale EDS</h1>
        <FinaleRankingTable rankings={effectiveRankings} />
      </main>
    );
  }

  // Etat 3 : qualifs terminees, finale pas lancee → preview 8 qualifies
  const qualifsCompleted = state.phase === 'idle' && qualRankingsForPreview.length >= 8;
  if (qualifsCompleted) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-6 font-heading text-5xl text-eds-light">Finale EDS</h1>
        <FinaleQualifiersPreview rankings={qualRankingsForPreview} />
      </main>
    );
  }

  // Etat 4 : defaut (pas commence)
  return (
    <main className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-8 text-center">
      <h1 className="mb-6 font-heading text-5xl text-eds-light">Finale EDS</h1>
      <LogoEds className="mb-6 h-24 md:h-32 lg:h-40 motion-safe:animate-heroGlow" />
      <p className="max-w-xl font-body text-xl text-eds-gray">
        La finale n'est pas encore lancee. Les qualifications sont en cours — revenez apres la
        derniere journee.
      </p>
      {isLoadingRankings && (
        <p className="mt-4 font-body text-eds-gray">Chargement…</p>
      )}
      {error && !isLoadingRankings && (
        <p className="mt-4 font-body text-sm text-eds-gray">
          Impossible de charger le classement. Reessayez dans quelques instants.
        </p>
      )}
    </main>
  );
}
