import { useEffect, useState } from 'react';
import { useTournament } from '../hooks/useTournament';
import { fetchRankings } from '../services/api';
import RankingTable from '../components/ranking/RankingTable';
import QualificationsHero from '../components/ranking/QualificationsHero';
import AnimatedSideDecor from '../components/ranking/AnimatedSideDecor';
import PartnersMarquee from '../components/common/PartnersMarquee';
import type { PlayerRanking } from '../types';

export default function Qualifications() {
  const { state } = useTournament();
  const { isConnected, phase, currentDayNumber } = state;
  const [qualRankings, setQualRankings] = useState<PlayerRanking[]>([]);
  const [prevContextRankings, setPrevContextRankings] = useState<PlayerRanking[]>(
    state.rankings
  );

  // Fetch initial REST (couvre le mount sans attendre le WebSocket).
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

  // Pattern idiomatique React "derive state from props" sans useEffect :
  // synchroniser qualRankings avec state.rankings uniquement pendant la phase
  // qualif/idle sans vainqueur. Pendant la finale, on fige la derniere valeur.
  // (Evite le bug 5.2 AC #17 : /qualifications montrant les rankings finale.)
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

  return (
    <main className="relative">
      <AnimatedSideDecor />
      <div className="relative mx-auto max-w-6xl px-4 pb-12">
        <QualificationsHero
          currentDayNumber={currentDayNumber}
          isConnected={isConnected}
        />

        {showEmptyState ? (
          <p className="py-16 text-center font-body text-eds-gray">
            Tournoi non encore démarré — revenez lors d'une journée de qualifications.
          </p>
        ) : (
          <>
            <RankingTable rankings={qualRankings} isConnected={isConnected} />
            <div className="mt-8 flex justify-center">
              <PartnersMarquee />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
