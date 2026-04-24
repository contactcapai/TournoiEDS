import type { Lobby } from '../../types';
import LobbyCard from './LobbyCard';

interface LobbyGridProps {
  lobbies: Lobby[];
}

export default function LobbyGrid({ lobbies }: LobbyGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lobbies.map((lobby) => (
        <LobbyCard key={lobby.id} lobby={lobby} />
      ))}
    </div>
  );
}
