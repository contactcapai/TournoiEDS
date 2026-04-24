import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAdminPlayers,
  addAdminPlayer,
  updatePlayer,
  resetFinale,
  resetQualifications,
  resetPlayers,
} from '../../services/api';
import type { Player, RegisterPlayerInput } from '../../types';

interface EditingState {
  discordPseudo: string;
  riotPseudo: string;
  email: string;
}

export default function PlayerManager() {
  const { token } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbsent, setShowAbsent] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<RegisterPlayerInput>({
    discordPseudo: '',
    riotPseudo: '',
    email: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<EditingState>({ discordPseudo: '', riotPseudo: '', email: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<'finale' | 'qualifications' | 'players' | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminPlayers(token);
      if ('error' in result) {
        setError(result.error.message);
      } else {
        setPlayers(result.data);
      }
    } catch (err) {
      console.error('Erreur chargement joueurs:', err);
      setError('Impossible de charger la liste des joueurs');
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const result = await addAdminPlayer(token, formData);
      if ('error' in result) {
        setFormError(result.error.message);
      } else {
        setPlayers((prev) => [result.data, ...prev]);
        setFormData({ discordPseudo: '', riotPseudo: '', email: '' });
        setShowForm(false);
      }
    } catch (err) {
      console.error('Erreur ajout joueur:', err);
      setFormError('Impossible de contacter le serveur');
    }
    setSubmitting(false);
  }

  async function handleStatusChange(player: Player, newStatus: 'inscrit' | 'absent' | 'dropped') {
    if (!token) return;
    const label = newStatus === 'dropped' ? 'Marquer drop' : newStatus === 'absent' ? 'Retirer' : 'Reinscrire';
    const confirmMsg = newStatus === 'dropped'
      ? `Confirmer le drop de ${player.discordPseudo} ? Il sera retire des rounds suivants mais conservera ses points.`
      : `${label} ${player.discordPseudo} ?`;
    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return;

    setActionId(player.id);
    setError(null);
    try {
      const result = await updatePlayer(token, player.id, { status: newStatus });
      if ('error' in result) {
        setError(result.error.message);
      } else {
        setPlayers((prev) =>
          prev.map((p) => (p.id === player.id ? result.data : p))
        );
      }
    } catch (err) {
      console.error('Erreur changement statut:', err);
      setError('Impossible de modifier le statut du joueur');
    } finally {
      setActionId(null);
    }
  }

  function startEdit(player: Player) {
    setEditingId(player.id);
    setEditData({
      discordPseudo: player.discordPseudo,
      riotPseudo: player.riotPseudo,
      email: player.email,
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(player: Player) {
    if (!token) return;

    // Detecter les champs modifies
    const changes: Partial<EditingState> = {};
    if (editData.discordPseudo.trim() !== player.discordPseudo) {
      changes.discordPseudo = editData.discordPseudo.trim();
    }
    if (editData.riotPseudo.trim() !== player.riotPseudo) {
      changes.riotPseudo = editData.riotPseudo.trim();
    }
    if (editData.email.trim() !== player.email) {
      changes.email = editData.email.trim();
    }

    if (Object.keys(changes).length === 0) {
      cancelEdit();
      return;
    }

    setActionId(player.id);
    setEditError(null);
    try {
      const result = await updatePlayer(token, player.id, changes);
      if ('error' in result) {
        setEditError(result.error.message);
      } else {
        setPlayers((prev) =>
          prev.map((p) => (p.id === player.id ? result.data : p))
        );
        setEditingId(null);
      }
    } catch (err) {
      console.error('Erreur modification joueur:', err);
      setEditError('Impossible de modifier le joueur');
    } finally {
      setActionId(null);
    }
  }

  async function handleReset(kind: 'finale' | 'qualifications' | 'players') {
    if (!token) return;
    const messages: Record<typeof kind, string> = {
      finale: 'Reinitialiser la finale ? Les rounds, lobbies et placements de la finale seront supprimes. Les qualifs et les joueurs restent intacts.',
      qualifications: 'Reinitialiser les qualifications ? Toutes les journees (qualifs ET finale) seront supprimees. Les joueurs restent inscrits.',
      players: 'Reinitialiser les joueurs ? TOUS les joueurs et tout l\'historique du tournoi seront supprimes. Action irreversible.',
    };
    if (!window.confirm(messages[kind])) return;

    setResetting(kind);
    setResetError(null);
    setResetMessage(null);
    try {
      const fn = kind === 'finale' ? resetFinale : kind === 'qualifications' ? resetQualifications : resetPlayers;
      const result = await fn(token);
      if ('error' in result) {
        setResetError(result.error.message);
      } else {
        setResetMessage(result.data.message);
        if (kind === 'players') {
          setPlayers([]);
        }
        await loadPlayers();
      }
    } catch (err) {
      console.error('Erreur reset:', err);
      setResetError('Impossible de contacter le serveur');
    } finally {
      setResetting(null);
    }
  }

  const displayedPlayers = showAbsent
    ? players
    : players.filter((p) => p.status === 'inscrit' || p.status === 'dropped');

  const inputClass =
    'rounded border border-eds-gray/40 bg-eds-dark px-2 py-1 font-body text-sm text-eds-light focus:border-eds-cyan focus:outline-none';

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl text-eds-cyan">Joueurs inscrits</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setFormError(null);
          }}
          className="rounded bg-eds-cyan px-6 py-2 font-body font-semibold text-eds-dark transition-colors hover:bg-eds-cyan/80"
        >
          {showForm ? 'Annuler' : 'Ajouter un joueur'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mt-4 rounded border border-eds-gray/30 bg-white/5 p-4">
          <div className="grid grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Pseudo Discord"
              value={formData.discordPseudo}
              onChange={(e) => setFormData({ ...formData, discordPseudo: e.target.value })}
              className="rounded border border-eds-gray/40 bg-eds-dark px-3 py-2 font-body text-eds-light placeholder:text-eds-gray/60 focus:border-eds-cyan focus:outline-none"
              required
            />
            <input
              type="text"
              placeholder="Pseudo Riot"
              value={formData.riotPseudo}
              onChange={(e) => setFormData({ ...formData, riotPseudo: e.target.value })}
              className="rounded border border-eds-gray/40 bg-eds-dark px-3 py-2 font-body text-eds-light placeholder:text-eds-gray/60 focus:border-eds-cyan focus:outline-none"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="rounded border border-eds-gray/40 bg-eds-dark px-3 py-2 font-body text-eds-light placeholder:text-eds-gray/60 focus:border-eds-cyan focus:outline-none"
              required
            />
          </div>
          {formError && (
            <p className="mt-2 font-body text-sm text-red-400">{formError}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-3 rounded bg-eds-cyan px-6 py-2 font-body font-semibold text-eds-dark transition-colors hover:bg-eds-cyan/80 disabled:opacity-50"
          >
            {submitting ? 'Ajout en cours...' : 'Valider'}
          </button>
        </form>
      )}

      <div className="mt-4 flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 font-body text-sm text-eds-gray">
          <input
            type="checkbox"
            checked={showAbsent}
            onChange={(e) => setShowAbsent(e.target.checked)}
            className="accent-eds-cyan"
          />
          Afficher les joueurs absents / retires
        </label>
      </div>

      {error && (
        <p className="mt-4 font-body text-sm text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="mt-6 font-body text-eds-light/60">Chargement...</p>
      ) : displayedPlayers.length === 0 ? (
        <p className="mt-6 font-body text-eds-light/60">
          Aucun joueur inscrit pour le moment
        </p>
      ) : (
        <>
          {editError && (
            <p className="mt-2 font-body text-sm text-red-400">{editError}</p>
          )}
          <table className="mt-4 w-full text-left font-body text-eds-light">
            <thead>
              <tr className="border-b border-eds-gray/30 text-sm text-eds-gray">
                <th className="pb-2 pr-4">Pseudo Discord</th>
                <th className="pb-2 pr-4">Pseudo Riot</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Statut</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedPlayers.map((player) => (
                <tr key={player.id} className="border-b border-eds-gray/10 odd:bg-white/5">
                  {editingId === player.id ? (
                    <>
                      <td className="py-2 pr-4">
                        <input
                          type="text"
                          value={editData.discordPseudo}
                          onChange={(e) => setEditData({ ...editData, discordPseudo: e.target.value })}
                          className={inputClass}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="text"
                          value={editData.riotPseudo}
                          onChange={(e) => setEditData({ ...editData, riotPseudo: e.target.value })}
                          className={inputClass}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          className={inputClass}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            player.status === 'inscrit'
                              ? 'rounded bg-eds-cyan/20 px-2 py-0.5 text-xs text-eds-cyan'
                              : player.status === 'dropped'
                                ? 'rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400'
                                : 'rounded bg-eds-gray/20 px-2 py-0.5 text-xs text-eds-gray'
                          }
                        >
                          {player.status === 'dropped' ? 'Dropped' : player.status}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(player)}
                            disabled={actionId === player.id}
                            className="rounded bg-eds-cyan/20 px-3 py-1 text-xs text-eds-cyan transition-colors hover:bg-eds-cyan/30 disabled:opacity-50"
                          >
                            {actionId === player.id ? '...' : 'Enregistrer'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded border border-eds-gray/40 px-3 py-1 text-xs text-eds-gray transition-colors hover:border-eds-light"
                          >
                            Annuler
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4">{player.discordPseudo}</td>
                      <td className="py-2 pr-4">{player.riotPseudo}</td>
                      <td className="py-2 pr-4">{player.email}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            player.status === 'inscrit'
                              ? 'rounded bg-eds-cyan/20 px-2 py-0.5 text-xs text-eds-cyan'
                              : player.status === 'dropped'
                                ? 'rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400'
                                : 'rounded bg-eds-gray/20 px-2 py-0.5 text-xs text-eds-gray'
                          }
                        >
                          {player.status === 'dropped' ? 'Dropped' : player.status}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(player)}
                            className="rounded border border-eds-cyan/40 px-3 py-1 text-xs text-eds-cyan transition-colors hover:border-eds-cyan hover:bg-eds-cyan/10"
                          >
                            Modifier
                          </button>
                          {player.status === 'inscrit' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(player, 'absent')}
                                disabled={actionId === player.id}
                                className="rounded border border-red-400/40 px-3 py-1 text-xs text-red-400 transition-colors hover:border-red-400 hover:bg-red-400/10 disabled:opacity-50"
                              >
                                {actionId === player.id ? 'Retrait...' : 'Retirer'}
                              </button>
                              <button
                                onClick={() => handleStatusChange(player, 'dropped')}
                                disabled={actionId === player.id}
                                className="rounded bg-red-600 px-3 py-1 text-xs text-white transition-opacity hover:bg-red-700 disabled:opacity-50"
                              >
                                {actionId === player.id ? 'Drop...' : 'Marquer drop'}
                              </button>
                            </>
                          )}
                          {(player.status === 'absent' || player.status === 'dropped') && (
                            <button
                              onClick={() => handleStatusChange(player, 'inscrit')}
                              disabled={actionId === player.id}
                              className="rounded border border-green-400/40 px-3 py-1 text-xs text-green-400 transition-colors hover:border-green-400 hover:bg-green-400/10 disabled:opacity-50"
                            >
                              {actionId === player.id ? '...' : 'Reinscrire'}
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-12 rounded border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="font-heading text-lg text-red-400">Zone dangereuse</h3>
        <p className="mt-1 font-body text-sm text-eds-gray">
          Ces actions sont irreversibles. Utilisez-les uniquement pour reinitialiser le tournoi.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => handleReset('finale')}
            disabled={resetting !== null}
            className="rounded border border-red-400/40 px-4 py-2 font-body text-sm text-red-400 transition-colors hover:border-red-400 hover:bg-red-400/10 disabled:opacity-50"
          >
            {resetting === 'finale' ? 'Reinitialisation...' : 'Reinitialiser la finale'}
          </button>
          <button
            onClick={() => handleReset('qualifications')}
            disabled={resetting !== null}
            className="rounded border border-red-400/40 px-4 py-2 font-body text-sm text-red-400 transition-colors hover:border-red-400 hover:bg-red-400/10 disabled:opacity-50"
          >
            {resetting === 'qualifications' ? 'Reinitialisation...' : 'Reinitialiser les qualifications'}
          </button>
          <button
            onClick={() => handleReset('players')}
            disabled={resetting !== null}
            className="rounded bg-red-600 px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:bg-red-700 disabled:opacity-50"
          >
            {resetting === 'players' ? 'Reinitialisation...' : 'Reinitialiser les joueurs'}
          </button>
        </div>
        {resetMessage && (
          <p className="mt-3 font-body text-sm text-green-400">{resetMessage}</p>
        )}
        {resetError && (
          <p className="mt-3 font-body text-sm text-red-400">{resetError}</p>
        )}
      </div>
    </div>
  );
}
