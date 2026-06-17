import type { PlayerRanking } from '../../types';

interface FinaleQualifiersPreviewProps {
  rankings: PlayerRanking[];
}

export default function FinaleQualifiersPreview({ rankings }: FinaleQualifiersPreviewProps) {
  const qualifiers = rankings.slice(0, 8);
  const hasFullRoster = qualifiers.length === 8;

  return (
    <div className="rounded-lg bg-eds-dark/50 p-6">
      <h2 className="mb-6 font-heading text-4xl text-eds-gold">
        Top 8 qualifies pour la finale
      </h2>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/10 font-heading text-sm text-eds-gold">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Joueur</th>
            <th className="px-3 py-2 text-right">Score total</th>
          </tr>
        </thead>
        <tbody>
          {qualifiers.map((r) => (
            <tr key={r.playerId} className="border-b border-white/5">
              <td className="px-3 py-2 font-heading text-eds-cyan">{r.rank}</td>
              <td className="px-3 py-2 font-body text-eds-light">{r.discordPseudo}</td>
              <td className="px-3 py-2 text-right font-heading text-eds-gold">
                {r.totalScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!hasFullRoster && (
        <p className="mt-4 font-body text-sm text-eds-gray">
          Seulement {qualifiers.length} joueurs actifs — la finale sera ajustee.
        </p>
      )}
      <p className="mt-6 font-body text-eds-gray">
        La finale sera lancee par l'admin. Revenez bientot pour suivre le dernier acte.
      </p>
    </div>
  );
}
