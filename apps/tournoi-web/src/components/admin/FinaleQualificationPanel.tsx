import type { PlayerRanking } from '../../types';

interface FinaleQualificationPanelProps {
  qualificationRankings: PlayerRanking[] | null;
  onStart: () => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

const FINALE_SIZE = 8;

export default function FinaleQualificationPanel({
  qualificationRankings,
  onStart,
  isLoading,
  disabled = false,
}: FinaleQualificationPanelProps) {
  if (!qualificationRankings || qualificationRankings.length === 0) {
    return null;
  }

  const finalists = qualificationRankings.slice(0, FINALE_SIZE);
  const hasIncompleteRoster = finalists.length < FINALE_SIZE;
  const eighth = qualificationRankings[FINALE_SIZE - 1];
  const ninth = qualificationRankings[FINALE_SIZE];
  const tiebreakerAtEighth =
    !!eighth && !!ninth && eighth.totalScore === ninth.totalScore;

  return (
    <div className="mt-8 rounded-lg border border-eds-gold/40 bg-eds-gold/5 p-6">
      <h3 className="mb-2 font-heading text-2xl text-eds-gold">
        Phase finale — {finalists.length} qualifi{finalists.length > 1 ? 'és' : 'é'}
      </h3>
      <p className="mb-4 font-body text-sm text-eds-gray">
        Les 3 journées de qualification sont terminées. Voici les joueurs qui accèdent au
        lobby unique de la finale, classés selon les tiebreakers officiels
        (score total → top 1 → top 4 → dernier placement).
      </p>

      {hasIncompleteRoster && (
        <div className="mb-4 rounded border border-yellow-400/40 bg-yellow-400/10 p-3 font-body text-sm text-yellow-200">
          Moins de {FINALE_SIZE} joueurs qualifiés — la finale peut tout de même être
          démarrée avec le nombre actuel.
        </div>
      )}

      <div className="mb-6 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 font-heading text-sm text-eds-gold">#</th>
              <th className="px-3 py-2 font-heading text-sm text-eds-gold">Pseudo</th>
              <th className="px-3 py-2 font-heading text-sm text-eds-gold">Score</th>
              <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 1</th>
              <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 4</th>
              <th className="px-3 py-2 font-heading text-sm text-eds-gold">
                Dernier round
              </th>
            </tr>
          </thead>
          <tbody>
            {finalists.map((r) => {
              const isTiebreakerRow = r.rank === FINALE_SIZE && tiebreakerAtEighth;
              return (
                <tr key={r.playerId} className="border-b border-white/5">
                  <td className="px-3 py-2 font-heading text-eds-cyan">
                    {r.rank}
                    {isTiebreakerRow && (
                      <span
                        title="Qualification à l'arraché — même score que le 9e, départagé par tiebreakers"
                        className="ml-2 rounded border border-eds-gold/60 px-1.5 py-0.5 text-xs text-eds-gold"
                      >
                        tiebreaker
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-body text-eds-light">
                    {r.discordPseudo}
                  </td>
                  <td className="px-3 py-2 font-body font-bold text-eds-light">
                    {r.totalScore}
                  </td>
                  <td className="px-3 py-2 font-body text-eds-light">{r.top1Count}</td>
                  <td className="px-3 py-2 font-body text-eds-light">{r.top4Count}</td>
                  <td className="px-3 py-2 font-body text-eds-light">
                    {r.lastGameResult}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-center">
        <button
          onClick={onStart}
          disabled={isLoading || disabled}
          className="rounded-lg bg-eds-gold px-8 py-4 font-heading text-lg text-eds-dark transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? 'Démarrage…' : 'Démarrer la finale'}
        </button>
      </div>
    </div>
  );
}
