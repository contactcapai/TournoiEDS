import LogoEds from '../common/LogoEds';
import ConnectionStatus from './ConnectionStatus';

interface QualificationsHeroProps {
  currentDayNumber: number | null;
  isConnected: boolean;
}

export default function QualificationsHero({
  currentDayNumber,
  isConnected,
}: QualificationsHeroProps) {
  return (
    <header className="relative flex flex-col items-center gap-4 py-10 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at center top, rgba(128,226,237,0.12) 0%, transparent 60%)',
        }}
      />
      <LogoEds className="h-20 w-auto md:h-24 lg:h-28 motion-safe:animate-[heroGlow_4s_ease-in-out_infinite_alternate]" />
      <h1 className="font-heading text-4xl text-eds-white motion-safe:animate-[heroGlow_4s_ease-in-out_infinite_alternate] md:text-5xl lg:text-6xl">
        Classement des Qualifications
      </h1>
      <div className="flex flex-wrap items-center justify-center gap-3 font-body text-eds-light/80">
        {currentDayNumber !== null && <span>Journée {currentDayNumber}</span>}
        <ConnectionStatus isConnected={isConnected} />
      </div>
    </header>
  );
}
