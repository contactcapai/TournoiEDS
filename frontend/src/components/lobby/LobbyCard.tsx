import type { Lobby } from '../../types';

interface LobbyCardProps {
  lobby: Lobby;
}

export default function LobbyCard({ lobby }: LobbyCardProps) {
  return (
    <div className="rounded-lg bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-eds-cyan">Lobby {lobby.number}</h3>
        <span className="font-body text-sm text-eds-gray">
          {lobby.players.length} joueur{lobby.players.length > 1 ? 's' : ''}
        </span>
      </div>
      <ul className="space-y-1">
        {lobby.players.map((lp) => (
          <li key={lp.id} className="font-body text-eds-light">
            {lp.player.discordPseudo}
          </li>
        ))}
      </ul>
    </div>
  );
}
