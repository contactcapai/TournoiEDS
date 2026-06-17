import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTournament } from '../hooks/useTournament';
import { fetchRankings } from '../services/api';
import RankingTable from '../components/ranking/RankingTable';
import QualificationsHero from '../components/ranking/QualificationsHero';
import AnimatedSideDecor from '../components/ranking/AnimatedSideDecor';
import type { PlayerRanking } from '../types';

export default function Overlay() {
  const { state } = useTournament();
  const { isConnected, phase, currentDayNumber } = state;
  const [searchParams] = useSearchParams();
  const isTransparent = searchParams.get('transparent') === '1';

  const [qualRankings, setQualRankings] = useState<PlayerRanking[]>([]);
  const [prevContextRankings, setPrevContextRankings] = useState<PlayerRanking[]>(
    state.rankings
  );

  useEffect(() => {
    let cancelled = false;
    fetchRankings().then((res) => {
      if (cancelled) return;
      if ('data' in res && res.data.length > 0) setQualRankings(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (prevContextRankings !== state.rankings) {
    setPrevContextRankings(state.rankings);
    const isQualContext =
      (state.currentDayType === 'qualification' ||
        (state.phase === 'idle' && !state.winner)) &&
      state.rankings.length > 0;
    if (isQualContext) {
      setQualRankings(state.rankings);
    }
  }

  const showEmptyState = phase === 'idle' && qualRankings.length === 0;
  const mainBg = isTransparent ? 'bg-transparent' : 'bg-eds-dark';

  return (
    <main className={`relative min-h-svh ${mainBg} overflow-hidden`}>
      <AnimatedSideDecor />
      <div className="relative mx-auto max-w-6xl px-4 pb-12">
        <QualificationsHero
          currentDayNumber={currentDayNumber}
          isConnected={isConnected}
        />
        {showEmptyState ? (
          <p className="py-16 text-center font-body text-eds-gray">
            En attente des résultats…
          </p>
        ) : (
          <RankingTable rankings={qualRankings} isConnected={isConnected} />
        )}
      </div>
    </main>
  );
}
