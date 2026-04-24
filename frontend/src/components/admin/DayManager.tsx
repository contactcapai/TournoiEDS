import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTournament } from '../../hooks/useTournament';
import { startDay, getCurrentDay, generateLobbies, regenerateLobbies, getAdminPlayers, updatePlayer, validateRound, fetchRankings, nextRound, completeDay, startFinale, getFinaleProgression } from '../../services/api';
import type { Day, Player, PlayerRanking } from '../../types';
import LobbyGrid from '../lobby/LobbyGrid';
import PlacementInput from './PlacementInput';
import FinaleQualificationPanel from './FinaleQualificationPanel';

export default function DayManager() {
  const { token } = useAuth();
  const { state: tournamentState } = useTournament();
  const winner = tournamentState.winner;
  const [day, setDay] = useState<Day | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [dropLoadingId, setDropLoadingId] = useState<number | null>(null);
  const [selectedDropId, setSelectedDropId] = useState<string>('');
  const [error, setError] = useState('');
  const [rankings, setRankings] = useState<PlayerRanking[] | null>(null);
  const [multiDayRankings, setMultiDayRankings] = useState<PlayerRanking[] | null>(null);
  const [completedQualDaysCount, setCompletedQualDaysCount] = useState<number>(0);
  const [hasFinale, setHasFinale] = useState<boolean>(false);
  const [startingFinale, setStartingFinale] = useState<boolean>(false);

  const activePlayers = allPlayers.filter((p) => p.status === 'inscrit');
  const droppedPlayers = allPlayers.filter((p) => p.status === 'dropped');
  const playerCount = activePlayers.length;

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  // Ecoute des changements de phase (via WebSocket) pour rafraichir sans reload manuel
  useEffect(() => {
    if (!token) return;
    // Skip au montage initial (le loadData ci-dessus s'en charge deja)
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentState.phase, tournamentState.currentDayId]);

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');

    const [dayResult, playersResult, progressionResult] = await Promise.allSettled([
      getCurrentDay(token!),
      getAdminPlayers(token!),
      getFinaleProgression(token!),
    ]);

    if (dayResult.status === 'fulfilled' && 'data' in dayResult.value && !('error' in dayResult.value)) {
      setDay(dayResult.value.data);
    } else {
      setError('Erreur lors du chargement de la journee');
    }

    if (playersResult.status === 'fulfilled' && 'data' in playersResult.value && !('error' in playersResult.value)) {
      setAllPlayers(playersResult.value.data);
    }

    if (
      progressionResult.status === 'fulfilled' &&
      'data' in progressionResult.value &&
      !('error' in progressionResult.value)
    ) {
      setCompletedQualDaysCount(progressionResult.value.data.completedQualDaysCount);
      setHasFinale(progressionResult.value.data.hasFinale);
    }

    // Charger le classement cumule multi-journees
    try {
      const rankingsResult = await fetchRankings();
      if ('data' in rankingsResult && rankingsResult.data.length > 0) {
        setMultiDayRankings(rankingsResult.data);
      } else {
        setMultiDayRankings(null);
      }
    } catch {
      setMultiDayRankings(null);
    }

    setLoading(false);
  }

  async function handleDrop() {
    if (!token) return;
    if (dropLoadingId !== null) return;
    const playerId = Number(selectedDropId);
    if (!playerId) return;
    const player = activePlayers.find((p) => p.id === playerId);
    if (!player) return;

    const confirmed = window.confirm(
      `Confirmer le drop de ${player.discordPseudo} ? Il sera retire des rounds suivants mais conservera ses points.`
    );
    if (!confirmed) return;

    setDropLoadingId(player.id);
    setError('');
    try {
      const result = await updatePlayer(token, player.id, { status: 'dropped' });
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      setSelectedDropId('');
      await loadData();
    } catch {
      setError('Erreur lors du drop du joueur');
    } finally {
      setDropLoadingId(null);
    }
  }

  async function handleReinscribeInDay(player: Player) {
    if (!token) return;
    if (dropLoadingId !== null) return;
    const confirmed = window.confirm(
      `Reinscrire ${player.discordPseudo} ? Il sera reintegre dans les rounds suivants.`
    );
    if (!confirmed) return;

    setDropLoadingId(player.id);
    setError('');
    try {
      const result = await updatePlayer(token, player.id, { status: 'inscrit' });
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      await loadData();
    } catch {
      setError('Erreur lors de la reinscription du joueur');
    } finally {
      setDropLoadingId(null);
    }
  }

  async function handleStartDay() {
    if (!token) return;
    setActionLoading(true);
    setError('');
    try {
      const result = await startDay(token);
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      await loadData();
    } catch {
      setError('Erreur lors du demarrage de la journee');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartFinale() {
    if (!token) return;
    setStartingFinale(true);
    setError('');
    try {
      const result = await startFinale(token);
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      await loadData();
    } catch {
      setError('Erreur lors du demarrage de la finale');
    } finally {
      setStartingFinale(false);
    }
  }

  async function handleGenerateLobbies() {
    if (!token || !day) return;
    const currentRound = day.rounds.find((r) => r.status === 'pending');
    if (!currentRound) return;

    setActionLoading(true);
    setError('');
    try {
      const result = await generateLobbies(token, day.id, currentRound.number);
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      await loadData();
    } catch {
      setError('Erreur lors de la generation des lobbies');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegenerateLobbies() {
    if (!token || !day) return;
    const currentActiveRound = day.rounds.find((r) => r.status === 'in-progress');
    if (!currentActiveRound) return;

    setActionLoading(true);
    setError('');
    try {
      const result = await regenerateLobbies(token, day.id, currentActiveRound.number);
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      await loadData();
    } catch {
      setError('Erreur lors de la regeneration des lobbies');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleValidateRound() {
    if (!token || !day) return;
    const activeRound = day.rounds.find((r) => r.status === 'in-progress');
    if (!activeRound) return;

    setActionLoading(true);
    setError('');
    try {
      const result = await validateRound(token, day.id, activeRound.number);
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      setRankings(result.data.rankings);
      await loadData(false);
    } catch {
      setError('Erreur lors de la validation du round');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleNextRound() {
    if (!token || !day) return;
    setActionLoading(true);
    setError('');
    try {
      const result = await nextRound(token, day.id);
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      setRankings(null);
      await loadData();
    } catch {
      setError('Erreur lors de la creation du round suivant');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteDay() {
    if (!token || !day) return;
    const confirmed = window.confirm(
      'Terminer la journee ? Vous pourrez demarrer une nouvelle journee ensuite.'
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    try {
      const result = await completeDay(token, day.id);
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      setRankings(null);
      await loadData();
    } catch {
      setError('Erreur lors de la terminaison de la journee');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-8">
        <p className="font-body text-eds-gray">Chargement du tournoi...</p>
      </div>
    );
  }

  const pendingRound = day?.rounds.find((r) => r.status === 'pending');
  const activeRound = day?.rounds.find((r) => r.status === 'in-progress');
  const validatedRounds = day?.rounds.filter((r) => r.status === 'validated') ?? [];
  const validatedRound = validatedRounds.length > 0
    ? validatedRounds.reduce((latest, r) => r.number > latest.number ? r : latest)
    : undefined;
  const canStartNextRound = !!day && day.status === 'in-progress';

  // Vérifier si tous les lobbies du round actif ont leurs placements saisis (ignorer les dropped)
  const allPlacementsFilled = activeRound
    ? activeRound.lobbies.every((lobby) =>
        lobby.players.every((lp) => lp.player.status === 'dropped' || lp.placement !== null)
      )
    : false;

  // Bouton "Regenerer les lobbies" : actif uniquement si aucun placement n'a encore ete saisi
  const hasAnyPlacement = activeRound
    ? activeRound.lobbies.some((lobby) =>
        lobby.players.some((lp) => lp.player.status !== 'dropped' && lp.placement !== null)
      )
    : false;

  const finaleRankings =
    day?.type === 'finale' || winner ? tournamentState.rankings : null;

  return (
    <div className="mt-8">
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/20 p-3 font-body text-red-300">
          {error}
        </div>
      )}

      {winner && (
        <div className="mb-4 rounded-lg border border-eds-gold bg-eds-gold/20 px-4 py-3 font-heading text-2xl text-eds-gold">
          🏆 Vainqueur : {winner.discordPseudo} ({winner.totalScore} pts)
        </div>
      )}

      {day?.type === 'finale' && (
        <div className="mb-4 rounded-lg border border-eds-gold bg-eds-gold/10 px-4 py-3 font-heading text-xl text-eds-gold">
          Phase finale — Lobby unique fixe
        </div>
      )}

      {day?.type === 'finale' && multiDayRankings && multiDayRankings.length > 0 && (
        <div className="mb-6 overflow-x-auto rounded-lg border border-white/10 p-4">
          <h3 className="mb-3 font-heading text-xl text-eds-gold">
            Classement cumule qualifications (fige)
          </h3>
          <p className="mb-3 font-body text-sm text-eds-gray">
            Le classement des qualifications est conserve pour reference pendant la finale.
          </p>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">#</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Joueur</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Score total</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 1</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 4</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Moy.</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Rounds</th>
              </tr>
            </thead>
            <tbody>
              {multiDayRankings.map((r) => (
                <tr key={r.playerId} className="border-b border-white/5">
                  <td className="px-3 py-2 font-heading text-eds-cyan">{r.rank}</td>
                  <td className="px-3 py-2 font-body text-eds-light">{r.discordPseudo}</td>
                  <td className="px-3 py-2 font-body text-eds-light font-bold">{r.totalScore}</td>
                  <td className="px-3 py-2 font-body text-eds-light">{r.top1Count}</td>
                  <td className="px-3 py-2 font-body text-eds-light">{r.top4Count}</td>
                  <td className="px-3 py-2 font-body text-eds-light">{r.average}</td>
                  <td className="px-3 py-2 font-body text-eds-light">{r.roundsPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {day?.type === 'finale' && finaleRankings && finaleRankings.length > 0 && (
        <div className="mb-6 overflow-x-auto rounded-lg border border-eds-gold/30 p-4">
          <h3 className="mb-3 font-heading text-xl text-eds-gold">
            Progression vers la victoire
          </h3>
          <p className="mb-3 font-body text-sm text-eds-gray">
            Règle : atteindre ≥ 20 pts dans un round, puis finir Top 1 dans un round suivant.
          </p>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">#</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Joueur</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Progression</th>
                <th className="px-3 py-2 font-heading text-sm text-eds-gold">Éligibilité</th>
              </tr>
            </thead>
            <tbody>
              {finaleRankings.map((r) => {
                const pct = Math.min(100, (r.totalScore / 20) * 100);
                const isEligible = r.totalScore >= 20;
                return (
                  <tr key={r.playerId} className="border-b border-white/5">
                    <td className="px-3 py-2 font-heading text-eds-cyan">{r.rank}</td>
                    <td className="px-3 py-2 font-body text-eds-light">
                      {r.discordPseudo}
                      {isEligible && (
                        <span
                          className="ml-2 rounded border border-eds-gold bg-eds-gold/20 px-2 py-0.5 font-heading text-xs text-eds-gold motion-safe:animate-pulse"
                          title="Seuil ≥ 20 pts atteint. Un Top 1 au prochain round déclenche la victoire."
                        >
                          ⚡ Éligible
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-eds-gray/20">
                          <div
                            className="h-full bg-eds-gold/80"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={
                            pct >= 100
                              ? 'font-heading text-eds-gold'
                              : 'font-body text-sm text-eds-gold'
                          }
                        >
                          {r.totalScore}/20
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-body text-sm text-eds-light">
                      {isEligible ? (
                        <span className="text-eds-gold">Peut gagner au prochain Top 1</span>
                      ) : (
                        <span className="text-eds-gray">
                          Besoin {Math.max(0, 20 - r.totalScore)} pt
                          {20 - r.totalScore > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!day && completedQualDaysCount === 3 && !hasFinale && (
        <>
          {multiDayRankings && multiDayRankings.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 font-heading text-xl text-eds-gold">
                Classement cumule — qualifications terminees
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">#</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Joueur</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Score total</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 1</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 4</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Moy.</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Rounds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiDayRankings.map((r) => (
                      <tr key={r.playerId} className="border-b border-white/5">
                        <td className="px-3 py-2 font-heading text-eds-cyan">{r.rank}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.discordPseudo}</td>
                        <td className="px-3 py-2 font-body text-eds-light font-bold">{r.totalScore}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.top1Count}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.top4Count}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.average}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.roundsPlayed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <FinaleQualificationPanel
            qualificationRankings={multiDayRankings}
            onStart={handleStartFinale}
            isLoading={startingFinale}
          />
        </>
      )}

      {!day && !(completedQualDaysCount === 3 && !hasFinale) && !winner && (
        <div className="text-center">
          <p className="mb-6 font-body text-lg text-eds-gray">
            Aucune journee en cours
          </p>
          {!hasFinale && (
            <button
              onClick={handleStartDay}
              disabled={actionLoading}
              className="rounded-lg bg-eds-cyan px-8 py-4 font-heading text-lg text-eds-dark transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading ? 'Demarrage...' : 'Demarrer la journee de qualification'}
            </button>
          )}
        </div>
      )}

      {!day && winner && (
        <div className="text-center">
          <p className="font-body text-lg text-eds-gray">
            La finale est terminee. Aucune autre journee ne peut etre demarree.
          </p>
        </div>
      )}

      {day && pendingRound && !activeRound && (
        <div>
          <div className="text-center">
            <h2 className="mb-4 font-heading text-2xl text-eds-cyan">
              Journee {day.number} — Round {pendingRound.number}            </h2>
            <p className="mb-6 font-body text-eds-gray">
              {playerCount} joueur{playerCount > 1 ? 's' : ''} actif{playerCount > 1 ? 's' : ''}
              {droppedPlayers.length > 0 && (
                <span className="ml-2 text-red-400">
                  ({droppedPlayers.length} drop{droppedPlayers.length > 1 ? 's' : ''})
                </span>
              )}
            </p>
            <button
              onClick={handleGenerateLobbies}
              disabled={actionLoading || playerCount < 1}
              className="rounded-lg bg-eds-cyan px-8 py-4 font-heading text-lg text-eds-dark transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading ? 'Generation...' : 'Generer les lobbies'}
            </button>
            {playerCount < 1 && (
              <p className="mt-2 font-body text-sm text-red-300">
                Il faut au moins 1 joueur actif
              </p>
            )}
          </div>

          {/* Drop / Reinscription */}
          <div className="mt-8 rounded-lg border border-white/10 p-4">
            <h3 className="mb-3 font-heading text-lg text-eds-cyan">
              Gestion des joueurs ({playerCount} actif{playerCount > 1 ? 's' : ''})
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={selectedDropId}
                onChange={(e) => setSelectedDropId(e.target.value)}
                className="flex-1 rounded border border-eds-gray/30 bg-eds-dark px-3 py-2 font-body text-eds-light"
              >
                <option value="">-- Selectionner un joueur a drop --</option>
                {activePlayers.map((p) => (
                  <option key={p.id} value={p.id}>{p.discordPseudo}</option>
                ))}
              </select>
              <button
                onClick={handleDrop}
                disabled={!selectedDropId || dropLoadingId !== null}
                className="rounded bg-red-600 px-4 py-2 font-heading text-sm text-white transition-opacity hover:bg-red-700 disabled:opacity-50"
              >
                {dropLoadingId !== null ? 'Drop...' : 'Marquer drop'}
              </button>
            </div>

            {droppedPlayers.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 font-heading text-sm text-eds-gray">
                  Joueurs droppes ({droppedPlayers.length})
                </h4>
                <div className="space-y-1">
                  {droppedPlayers.map((player) => (
                    <div key={player.id} className="flex items-center justify-between rounded border border-eds-gray/10 px-3 py-2">
                      <span className="font-body text-eds-gray line-through opacity-50">{player.discordPseudo}</span>
                      <button
                        onClick={() => handleReinscribeInDay(player)}
                        disabled={dropLoadingId === player.id}
                        className="rounded border border-green-400/40 px-3 py-1 font-heading text-xs text-green-400 transition-colors hover:border-green-400 hover:bg-green-400/10 disabled:opacity-50"
                      >
                        {dropLoadingId === player.id ? '...' : 'Reinscrire'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {day && activeRound && (
        <div>
          <h2 className="mb-4 font-heading text-2xl text-eds-cyan">
            Journee {day.number} — Round {activeRound.number} — Saisie des placements
          </h2>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-body text-eds-gray">
              {activeRound.lobbies.length} lobby{activeRound.lobbies.length > 1 ? 's' : ''} — {playerCount} joueur{playerCount > 1 ? 's' : ''}
              {droppedPlayers.length > 0 && (
                <span className="ml-2 text-red-400">
                  ({droppedPlayers.length} drop{droppedPlayers.length > 1 ? 's' : ''})
                </span>
              )}
            </p>
            {day?.type !== 'finale' && (
              <button
                onClick={handleRegenerateLobbies}
                disabled={actionLoading || hasAnyPlacement}
                title={hasAnyPlacement ? 'Videz tous les classements pour regenerer les lobbies' : 'Regenerer les lobbies en tenant compte des drops'}
                className="rounded-lg border border-eds-cyan/40 bg-eds-cyan/10 px-4 py-2 font-heading text-sm text-eds-cyan transition-colors hover:bg-eds-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionLoading ? 'Chargement...' : 'Regenerer les lobbies'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeRound.lobbies.map((lobby) => (
              <PlacementInput
                key={lobby.id}
                lobby={lobby}
                dayId={day.id}
                roundNumber={activeRound.number}
                onSaved={() => loadData(false)}
              />
            ))}
          </div>

          <div className="mt-8 text-center">
            {allPlacementsFilled ? (
              <button
                onClick={handleValidateRound}
                disabled={actionLoading}
                className="rounded-lg bg-eds-gold px-8 py-4 font-heading text-lg text-eds-dark transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {actionLoading ? 'Validation...' : 'Valider le round'}
              </button>
            ) : (
              <p className="font-body text-eds-gray">
                Saisissez et enregistrez tous les placements pour valider le round
              </p>
            )}
          </div>

          {/* Drop / Reinscription — sous les lobbies */}
          <div className="mt-8 rounded-lg border border-white/10 p-4">
            <h3 className="mb-3 font-heading text-lg text-eds-cyan">
              Gestion des joueurs ({playerCount} actif{playerCount > 1 ? 's' : ''})
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={selectedDropId}
                onChange={(e) => setSelectedDropId(e.target.value)}
                className="flex-1 rounded border border-eds-gray/30 bg-eds-dark px-3 py-2 font-body text-eds-light"
              >
                <option value="">-- Selectionner un joueur a drop --</option>
                {activePlayers.map((p) => (
                  <option key={p.id} value={p.id}>{p.discordPseudo}</option>
                ))}
              </select>
              <button
                onClick={handleDrop}
                disabled={!selectedDropId || dropLoadingId !== null}
                className="rounded bg-red-600 px-4 py-2 font-heading text-sm text-white transition-opacity hover:bg-red-700 disabled:opacity-50"
              >
                {dropLoadingId !== null ? 'Drop...' : 'Marquer drop'}
              </button>
            </div>

            {droppedPlayers.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 font-heading text-sm text-eds-gray">
                  Joueurs droppes ({droppedPlayers.length})
                </h4>
                <div className="space-y-1">
                  {droppedPlayers.map((player) => (
                    <div key={player.id} className="flex items-center justify-between rounded border border-eds-gray/10 px-3 py-2">
                      <span className="font-body text-eds-gray line-through opacity-50">{player.discordPseudo}</span>
                      <button
                        onClick={() => handleReinscribeInDay(player)}
                        disabled={dropLoadingId === player.id}
                        className="rounded border border-green-400/40 px-3 py-1 font-heading text-xs text-green-400 transition-colors hover:border-green-400 hover:bg-green-400/10 disabled:opacity-50"
                      >
                        {dropLoadingId === player.id ? '...' : 'Reinscrire'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {day && validatedRound && !activeRound && !pendingRound && (
        <div>
          <h2 className="mb-4 font-heading text-2xl text-eds-cyan">
            Journee {day.number} — Round {validatedRound.number} — Valide
          </h2>
          <div className="mb-4 rounded-lg bg-green-500/20 p-3 font-body text-green-300">
            Round valide
          </div>

          {/* Boutons : round suivant / terminer la journee — masques si vainqueur detecte */}
          {winner ? (
            <div className="mb-6 flex flex-col items-center justify-center gap-3">
              <p className="font-heading text-lg text-eds-gold">Finale terminee.</p>
              <button
                disabled
                className="rounded-lg bg-eds-gray/30 px-8 py-4 font-heading text-lg text-eds-gray"
              >
                Aucune action disponible
              </button>
            </div>
          ) : (
            <div className="mb-6 flex items-center justify-center gap-4">
              {canStartNextRound && (
                <button
                  onClick={handleNextRound}
                  disabled={actionLoading}
                  className="rounded-lg bg-eds-cyan px-8 py-4 font-heading text-lg text-eds-dark transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading
                    ? 'Chargement...'
                    : day?.type === 'finale'
                      ? 'Lancer le round suivant de finale'
                      : 'Lancer le round suivant'}
                </button>
              )}
              {day?.type !== 'finale' && (
                <button
                  onClick={handleCompleteDay}
                  disabled={actionLoading}
                  className="rounded-lg border border-eds-gold bg-eds-gold/10 px-8 py-4 font-heading text-lg text-eds-gold transition-opacity hover:bg-eds-gold/20 disabled:opacity-50"
                >
                  {actionLoading ? 'Chargement...' : 'Terminer la journee'}
                </button>
              )}
            </div>
          )}

          {rankings && rankings.length > 0 && (
            <div className="mb-6 overflow-x-auto">
              <h3 className="mb-3 font-heading text-xl text-eds-cyan">
                Classement intra-journee
              </h3>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 font-heading text-sm text-eds-gold">#</th>
                    <th className="px-3 py-2 font-heading text-sm text-eds-gold">Joueur</th>
                    <th className="px-3 py-2 font-heading text-sm text-eds-gold">Score</th>
                    <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 1</th>
                    <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 4</th>
                    <th className="px-3 py-2 font-heading text-sm text-eds-gold">Moy.</th>
                    <th className="px-3 py-2 font-heading text-sm text-eds-gold">Rounds</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r) => (
                    <tr key={r.playerId} className="border-b border-white/5">
                      <td className="px-3 py-2 font-heading text-eds-cyan">{r.rank}</td>
                      <td className="px-3 py-2 font-body text-eds-light">{r.discordPseudo}</td>
                      <td className="px-3 py-2 font-body text-eds-light">{r.totalScore}</td>
                      <td className="px-3 py-2 font-body text-eds-light">{r.top1Count}</td>
                      <td className="px-3 py-2 font-body text-eds-light">{r.top4Count}</td>
                      <td className="px-3 py-2 font-body text-eds-light">{r.average}</td>
                      <td className="px-3 py-2 font-body text-eds-light">{r.roundsPlayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {multiDayRankings && multiDayRankings.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 font-heading text-xl text-eds-gold">
                Classement cumule — toutes journees
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">#</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Joueur</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Score total</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 1</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 4</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Moy.</th>
                      <th className="px-3 py-2 font-heading text-sm text-eds-gold">Rounds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiDayRankings.map((r) => (
                      <tr key={r.playerId} className="border-b border-white/5">
                        <td className="px-3 py-2 font-heading text-eds-cyan">{r.rank}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.discordPseudo}</td>
                        <td className="px-3 py-2 font-body text-eds-light font-bold">{r.totalScore}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.top1Count}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.top4Count}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.average}</td>
                        <td className="px-3 py-2 font-body text-eds-light">{r.roundsPlayed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <LobbyGrid lobbies={validatedRound.lobbies} />
        </div>
      )}
    </div>
  );
}
