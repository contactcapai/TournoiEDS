import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { submitPlacements } from '../../services/api';
import type { Lobby } from '../../types';

interface PlacementInputProps {
  lobby: Lobby;
  dayId: number;
  roundNumber: number;
  onSaved: () => void;
}

export default function PlacementInput({ lobby, dayId, roundNumber, onSaved }: PlacementInputProps) {
  const { token } = useAuth();
  const activePlayers = lobby.players.filter((lp) => lp.player.status !== 'dropped');
  const lobbySize = activePlayers.length;

  const [placements, setPlacements] = useState<Record<number, number | null>>(() => {
    const initial: Record<number, number | null> = {};
    for (const lp of activePlayers) {
      initial[lp.id] = lp.placement;
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Détecter les doublons (uniquement sur les joueurs actifs pour gérer le drop pendant la saisie)
  const placementValues = activePlayers
    .map((lp) => placements[lp.id])
    .filter((v): v is number => v !== null && v !== undefined);
  const duplicates = new Set<number>();
  const seen = new Set<number>();
  for (const v of placementValues) {
    if (seen.has(v)) {
      duplicates.add(v);
    }
    seen.add(v);
  }

  const allFilled = placementValues.length === lobbySize;
  const hasDuplicates = duplicates.size > 0;
  const canSave = allFilled && !hasDuplicates && !saving;

  function handleChange(lobbyPlayerId: number, value: string) {
    setSaved(false);
    setError('');
    if (value === '') {
      setPlacements((prev) => ({ ...prev, [lobbyPlayerId]: null }));
    } else {
      setPlacements((prev) => ({ ...prev, [lobbyPlayerId]: Number(value) }));
    }
  }

  async function handleSave() {
    if (!token || !canSave) return;
    setSaving(true);
    setError('');
    try {
      const placementArray = activePlayers.map((lp) => ({
        lobbyPlayerId: lp.id,
        placement: placements[lp.id]!,
      }));
      const result = await submitPlacements(token, dayId, roundNumber, lobby.id, placementArray);
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      setSaved(true);
      onSaved();
    } catch {
      setError('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-eds-cyan">Lobby {lobby.number}</h3>
        <span className="font-body text-sm text-eds-gray">
          {lobbySize} joueur{lobbySize > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {activePlayers.map((lp) => {
          const value = placements[lp.id];
          const isDuplicate = value !== null && value !== undefined && duplicates.has(value);
          return (
            <div key={lp.id} className="flex items-center justify-between gap-3">
              <span className="font-body text-eds-light">{lp.player.discordPseudo}</span>
              <select
                value={value ?? ''}
                onChange={(e) => handleChange(lp.id, e.target.value)}
                className={`rounded border bg-eds-dark px-2 py-1 font-body text-eds-light ${
                  isDuplicate ? 'border-red-500' : 'border-white/20'
                }`}
              >
                <option value="">—</option>
                {Array.from({ length: lobbySize }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {hasDuplicates && (
        <p className="mt-2 font-body text-sm text-red-400">
          Placements en doublon detectes
        </p>
      )}

      {error && (
        <p className="mt-2 font-body text-sm text-red-400">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-lg bg-eds-cyan px-6 py-2 font-heading text-eds-dark transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {saved && (
          <span className="font-body text-sm text-green-400">
            ✓ Placements enregistres
          </span>
        )}
      </div>
    </div>
  );
}
