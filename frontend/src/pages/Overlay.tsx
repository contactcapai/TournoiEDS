import { useSearchParams } from 'react-router';
import { useTournament } from '../hooks/useTournament';
import OverlayRankingTable from '../components/overlay/OverlayRankingTable';
import LogoEds from '../components/common/LogoEds';

export default function Overlay() {
  const { state } = useTournament();
  const { rankings, phase, currentDayNumber } = state;
  const [searchParams] = useSearchParams();
  const isTransparent = searchParams.get('transparent') === '1';

  const showEmpty = phase === 'idle' && rankings.length === 0;

  const mainBg = isTransparent ? 'bg-transparent' : 'bg-eds-dark';

  return (
    <main
      className={`relative min-h-svh ${mainBg} overflow-hidden p-6 md:p-10 lg:p-12`}
    >
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-5xl flex-col md:min-h-[calc(100svh-5rem)] lg:min-h-[calc(100svh-6rem)]">
        {showEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <LogoEds className="h-24 w-auto md:h-32 lg:h-40 motion-safe:animate-heroGlow" />
            <p className="font-heading text-3xl text-eds-gray md:text-4xl">
              En attente des résultats…
            </p>
          </div>
        ) : (
          <>
            <header className="mb-4 text-center md:mb-6">
              <h1 className="font-heading text-4xl text-eds-cyan md:text-5xl lg:text-6xl motion-safe:animate-heroGlow">
                Tournoi TFT — EDS
              </h1>
              {currentDayNumber !== null && (
                <p className="font-body text-eds-gray mt-2 text-lg md:text-xl">
                  Journée {currentDayNumber} — Qualifications
                </p>
              )}
            </header>
            <OverlayRankingTable rankings={rankings} />
          </>
        )}
      </div>
    </main>
  );
}
