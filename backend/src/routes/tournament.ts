import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { generateRandomLobbies } from '../services/lobbyGenerator';
import { generateSwissLobbies } from '../services/swissSystem';
import { calculatePoints, calculatePlayerStats } from '../services/pointsCalculator';
import {
  aggregateFinaleRankings,
  aggregateQualificationRankings,
  type PlayerRanking,
} from '../services/rankingsAggregator';
import { detectFinaleWinner, DEFAULT_VICTORY_THRESHOLD } from '../services/winnerDetector';
import { getIO } from '../websocket/io';
import { scheduleRankingUpdated, emitTournamentStateChanged } from '../websocket/events';

const router = Router();

const MAX_QUALIFICATION_DAYS = 3;

async function computeLobbyGroups(dayId: number, roundNumber: number): Promise<number[][] | { error: { code: string; message: string } }> {
  const activePlayers = await prisma.player.findMany({
    where: { status: 'inscrit' },
    select: { id: true },
  });

  if (activePlayers.length < 1) {
    return { error: { code: 'NOT_ENOUGH_PLAYERS', message: 'Il faut au moins 1 joueur actif pour generer les lobbies' } };
  }

  const playerIds = activePlayers.map((p) => p.id);

  // Aléatoire pur uniquement pour J1R1. Tous les autres rounds (J1R2+, J2R1+, J3R1+)
  // utilisent le système suisse basé sur le classement cumulé multi-journées.
  const day = await prisma.day.findUnique({ where: { id: dayId }, select: { number: true } });
  if (!day) {
    return { error: { code: 'DAY_NOT_FOUND', message: 'La journee n\'existe pas' } };
  }

  if (day.number === 1 && roundNumber === 1) {
    return generateRandomLobbies(playerIds);
  }

  // Tri Swiss sur le classement cumulé qualif (toutes journées validées confondues).
  const cumulativeRankings = await aggregateQualificationRankings(prisma);
  const activePlayerIdsSet = new Set(playerIds);
  const rankedPlayerIds = cumulativeRankings
    .map((r) => r.playerId)
    .filter((pid) => activePlayerIdsSet.has(pid));

  // Joueurs actifs sans aucun résultat (cas marginal : nouvel inscrit ?) ajoutés en queue.
  const rankedSet = new Set(rankedPlayerIds);
  for (const pid of playerIds) {
    if (!rankedSet.has(pid)) rankedPlayerIds.push(pid);
  }

  return generateSwissLobbies(rankedPlayerIds);
}

// POST /days — creer une nouvelle journee de qualification
router.post('/days', async (_req: Request, res: Response) => {
  try {
    const inProgressDay = await prisma.day.findFirst({
      where: { status: 'in-progress' },
    });

    if (inProgressDay) {
      res.status(409).json({
        error: { code: 'DAY_ALREADY_IN_PROGRESS', message: 'Une journee est deja en cours. Terminez-la avant d\'en demarrer une nouvelle.' },
      });
      return;
    }

    const qualDayCount = await prisma.day.count({
      where: { type: 'qualification' },
    });

    if (qualDayCount >= MAX_QUALIFICATION_DAYS) {
      res.status(400).json({
        error: { code: 'MAX_DAYS_REACHED', message: 'Le maximum de 3 journees de qualification est atteint' },
      });
      return;
    }

    const day = await prisma.day.create({
      data: {
        number: qualDayCount + 1,
        type: 'qualification',
        rounds: {
          create: { number: 1 },
        },
      },
      include: { rounds: true },
    });

    res.status(201).json({ data: day });
    emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));
  } catch (error) {
    console.error('Erreur lors de la creation de la journee:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// GET /days/current — retourner la journee en cours
router.get('/days/current', async (_req: Request, res: Response) => {
  try {
    const day = await prisma.day.findFirst({
      where: { status: 'in-progress' },
      include: {
        rounds: {
          include: {
            lobbies: {
              include: {
                players: {
                  include: { player: true },
                },
              },
            },
          },
        },
      },
    });

    res.json({ data: day });
  } catch (error) {
    console.error('Erreur lors de la recuperation de la journee:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// POST /days/:dayId/rounds/:roundNumber/generate-lobbies — generer les lobbies
router.post('/days/:dayId/rounds/:roundNumber/generate-lobbies', async (req: Request, res: Response) => {
  try {
    const dayId = Number(req.params.dayId);
    const roundNumber = Number(req.params.roundNumber);

    if (!Number.isInteger(dayId) || dayId <= 0 || !Number.isInteger(roundNumber) || roundNumber <= 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Parametres invalides' },
      });
      return;
    }

    const day = await prisma.day.findUnique({ where: { id: dayId } });
    if (!day || day.status !== 'in-progress') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'La journee n\'existe pas ou n\'est pas en cours' },
      });
      return;
    }

    // Garde finale : le lobby unique est créé par POST /finale/start (5.1) ou
    // par POST /next-round (5.2). Aucune génération via cet endpoint.
    if (day.type === 'finale') {
      res.status(400).json({
        error: {
          code: 'FINALE_LOBBY_IS_FIXED',
          message: 'En finale, le lobby unique est cree automatiquement (start finale / next-round). Pas de generation manuelle.',
        },
      });
      return;
    }

    // Verifier que le round precedent est valide (pour round > 1)
    if (roundNumber > 1) {
      const previousRound = await prisma.round.findUnique({
        where: { dayId_number: { dayId, number: roundNumber - 1 } },
      });
      if (!previousRound || previousRound.status !== 'validated') {
        res.status(400).json({
          error: { code: 'PREVIOUS_ROUND_NOT_VALIDATED', message: 'Le round precedent doit etre valide avant de generer les lobbies' },
        });
        return;
      }
    }

    const round = await prisma.round.findUnique({
      where: { dayId_number: { dayId, number: roundNumber } },
      include: { lobbies: true },
    });

    if (!round) {
      res.status(404).json({
        error: { code: 'ROUND_NOT_FOUND', message: 'Round non trouve' },
      });
      return;
    }

    if (round.status !== 'pending') {
      res.status(409).json({
        error: { code: 'LOBBIES_ALREADY_GENERATED', message: 'Les lobbies ont deja ete generes pour ce round' },
      });
      return;
    }

    if (round.lobbies.length > 0) {
      res.status(409).json({
        error: { code: 'LOBBIES_ALREADY_GENERATED', message: 'Les lobbies ont deja ete generes pour ce round' },
      });
      return;
    }

    const lobbyGroupsResult = await computeLobbyGroups(dayId, roundNumber);
    if ('error' in lobbyGroupsResult) {
      res.status(400).json({ error: lobbyGroupsResult.error });
      return;
    }
    const lobbyGroups = lobbyGroupsResult;

    const updatedRound = await prisma.$transaction(async (tx) => {
      for (let i = 0; i < lobbyGroups.length; i++) {
        await tx.lobby.create({
          data: {
            number: i + 1,
            roundId: round.id,
            players: {
              create: lobbyGroups[i].map((playerId) => ({ playerId })),
            },
          },
        });
      }

      return tx.round.update({
        where: { id: round.id },
        data: { status: 'in-progress' },
        include: {
          lobbies: {
            include: {
              players: {
                include: { player: true },
              },
            },
          },
        },
      });
    });

    res.status(201).json({ data: updatedRound });
  } catch (error) {
    console.error('Erreur lors de la generation des lobbies:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// POST /days/:dayId/rounds/:roundNumber/regenerate-lobbies — regenerer les lobbies (reprise en compte des drops)
router.post('/days/:dayId/rounds/:roundNumber/regenerate-lobbies', async (req: Request, res: Response) => {
  try {
    const dayId = Number(req.params.dayId);
    const roundNumber = Number(req.params.roundNumber);

    if (!Number.isInteger(dayId) || dayId <= 0 || !Number.isInteger(roundNumber) || roundNumber <= 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Parametres invalides' } });
      return;
    }

    const day = await prisma.day.findUnique({ where: { id: dayId } });
    if (!day || day.status !== 'in-progress') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'La journee n\'existe pas ou n\'est pas en cours' } });
      return;
    }

    // Garde finale : le lobby unique est fixe (8 finalistes), pas de régénération possible.
    if (day.type === 'finale') {
      res.status(400).json({
        error: {
          code: 'FINALE_LOBBY_IS_FIXED',
          message: 'En finale, le lobby unique des 8 finalistes est fixe et ne peut pas etre regenere.',
        },
      });
      return;
    }

    const round = await prisma.round.findUnique({
      where: { dayId_number: { dayId, number: roundNumber } },
      include: { lobbies: { include: { players: true } } },
    });

    if (!round) {
      res.status(404).json({ error: { code: 'ROUND_NOT_FOUND', message: 'Round non trouve' } });
      return;
    }

    if (round.status !== 'in-progress') {
      res.status(409).json({ error: { code: 'ROUND_NOT_IN_PROGRESS', message: 'Le round doit etre en cours pour etre regenere' } });
      return;
    }

    const hasAnyPlacement = round.lobbies.some((lobby) => lobby.players.some((lp) => lp.placement !== null));
    if (hasAnyPlacement) {
      res.status(409).json({ error: { code: 'PLACEMENTS_EXIST', message: 'Impossible de regenerer : des placements ont deja ete saisis' } });
      return;
    }

    const lobbyGroupsResult = await computeLobbyGroups(dayId, roundNumber);
    if ('error' in lobbyGroupsResult) {
      res.status(400).json({ error: lobbyGroupsResult.error });
      return;
    }
    const lobbyGroups = lobbyGroupsResult;

    const lobbyIds = round.lobbies.map((l) => l.id);

    const updatedRound = await prisma.$transaction(async (tx) => {
      await tx.lobbyPlayer.deleteMany({ where: { lobbyId: { in: lobbyIds } } });
      await tx.lobby.deleteMany({ where: { id: { in: lobbyIds } } });

      for (let i = 0; i < lobbyGroups.length; i++) {
        await tx.lobby.create({
          data: {
            number: i + 1,
            roundId: round.id,
            players: { create: lobbyGroups[i].map((playerId) => ({ playerId })) },
          },
        });
      }

      return tx.round.findUnique({
        where: { id: round.id },
        include: { lobbies: { include: { players: { include: { player: true } } } } },
      });
    });

    res.status(200).json({ data: updatedRound });
  } catch (error) {
    console.error('Erreur lors de la regeneration des lobbies:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' } });
  }
});

// POST /days/:dayId/rounds/:roundNumber/lobbies/:lobbyId/placements — saisir les placements d'un lobby
router.post('/days/:dayId/rounds/:roundNumber/lobbies/:lobbyId/placements', async (req: Request, res: Response) => {
  try {
    const dayId = Number(req.params.dayId);
    const roundNumber = Number(req.params.roundNumber);
    const lobbyId = Number(req.params.lobbyId);

    if (
      !Number.isInteger(dayId) || dayId <= 0 ||
      !Number.isInteger(roundNumber) || roundNumber <= 0 ||
      !Number.isInteger(lobbyId) || lobbyId <= 0
    ) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Parametres invalides' },
      });
      return;
    }

    const { placements } = req.body as {
      placements: { lobbyPlayerId: number; placement: number }[];
    };

    if (!Array.isArray(placements) || placements.length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Le champ placements est requis et doit etre un tableau non vide' },
      });
      return;
    }

    const day = await prisma.day.findUnique({ where: { id: dayId } });
    if (!day || day.status !== 'in-progress') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'La journee n\'existe pas ou n\'est pas en cours' },
      });
      return;
    }

    const round = await prisma.round.findUnique({
      where: { dayId_number: { dayId, number: roundNumber } },
    });
    if (!round || round.status !== 'in-progress') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Le round n\'existe pas ou n\'est pas en cours' },
      });
      return;
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { players: { include: { player: true } } },
    });
    if (!lobby || lobby.roundId !== round.id) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Le lobby n\'existe pas ou n\'appartient pas a ce round' },
      });
      return;
    }

    const activeLobbyPlayers = lobby.players.filter((lp) => lp.player.status !== 'dropped');
    const lobbyPlayerIds = new Set(activeLobbyPlayers.map((lp) => lp.id));
    const lobbySize = activeLobbyPlayers.length;

    // Valider que tous les joueurs du lobby sont couverts
    if (placements.length !== lobbySize) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: `Le nombre de placements (${placements.length}) ne correspond pas au nombre de joueurs du lobby (${lobbySize})` },
      });
      return;
    }

    // Valider que chaque lobbyPlayerId appartient au lobby
    for (const p of placements) {
      if (!lobbyPlayerIds.has(p.lobbyPlayerId)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Le joueur ${p.lobbyPlayerId} n'appartient pas a ce lobby` },
        });
        return;
      }
    }

    // Valider unicité des placements
    const placementValues = placements.map((p) => p.placement);
    const uniquePlacements = new Set(placementValues);
    if (uniquePlacements.size !== placements.length) {
      res.status(400).json({
        error: { code: 'DUPLICATE_PLACEMENT', message: 'Chaque placement doit etre unique dans un lobby' },
      });
      return;
    }

    // Valider que les placements vont de 1 à lobbySize
    for (const p of placements) {
      if (!Number.isInteger(p.placement) || p.placement < 1 || p.placement > lobbySize) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Le placement doit etre entre 1 et ${lobbySize}` },
        });
        return;
      }
    }

    // Mettre à jour les placements et points dans une transaction
    const updatedLobby = await prisma.$transaction(async (tx) => {
      for (const p of placements) {
        const points = calculatePoints(p.placement, lobbySize);
        await tx.lobbyPlayer.update({
          where: { id: p.lobbyPlayerId },
          data: { placement: p.placement, points },
        });
      }

      return tx.lobby.findUnique({
        where: { id: lobbyId },
        include: { players: { include: { player: true } } },
      });
    });

    res.status(200).json({ data: updatedLobby });
  } catch (error) {
    console.error('Erreur lors de la saisie des placements:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// POST /days/:dayId/rounds/:roundNumber/validate — valider le round et calculer les scores
router.post('/days/:dayId/rounds/:roundNumber/validate', async (req: Request, res: Response) => {
  try {
    const dayId = Number(req.params.dayId);
    const roundNumber = Number(req.params.roundNumber);

    if (!Number.isInteger(dayId) || dayId <= 0 || !Number.isInteger(roundNumber) || roundNumber <= 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Parametres invalides' },
      });
      return;
    }

    const day = await prisma.day.findUnique({ where: { id: dayId } });
    if (!day || day.status !== 'in-progress') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'La journee n\'existe pas ou n\'est pas en cours' },
      });
      return;
    }

    const round = await prisma.round.findUnique({
      where: { dayId_number: { dayId, number: roundNumber } },
      include: {
        lobbies: {
          include: {
            players: {
              include: { player: true },
            },
          },
        },
      },
    });

    if (!round || round.status !== 'in-progress') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Le round n\'existe pas ou n\'est pas en cours' },
      });
      return;
    }

    // Vérifier que tous les lobbies ont tous les placements saisis (joueurs droppes exclus)
    const incompleteLobbyIds: number[] = [];
    for (const lobby of round.lobbies) {
      const hasIncomplete = lobby.players.some(
        (lp) => lp.placement === null && lp.player.status !== 'dropped'
      );
      if (hasIncomplete) {
        incompleteLobbyIds.push(lobby.id);
      }
    }

    if (incompleteLobbyIds.length > 0) {
      res.status(400).json({
        error: {
          code: 'INCOMPLETE_PLACEMENTS',
          message: 'Des placements manquent dans certains lobbies',
          details: { incompleteLobbyIds },
        },
      });
      return;
    }

    // Branche finale : transaction atomique round.validated + détection victoire + day.completed
    if (day.type === 'finale') {
      let winnerDetected: PlayerRanking | null = null;
      const result = await prisma.$transaction(async (tx) => {
        const ur = await tx.round.update({
          where: { id: round.id },
          data: { status: 'validated' },
          include: {
            lobbies: {
              include: { players: { include: { player: true } } },
            },
          },
        });

        const finaleRankings = await aggregateFinaleRankings(tx);
        const top1 = ur.lobbies[0]?.players.find((lp) => lp.placement === 1);
        let winner: PlayerRanking | null = null;
        if (top1) {
          const candidate = detectFinaleWinner(
            finaleRankings,
            top1.playerId,
            DEFAULT_VICTORY_THRESHOLD
          );
          if (candidate) {
            await tx.day.update({ where: { id: dayId }, data: { status: 'completed' } });
            winner = candidate;
          }
        }
        return { updatedRound: ur, finaleRankings, winner };
      });

      winnerDetected = result.winner;

      // Émission post-commit
      if (winnerDetected) {
        // event critique : await pour garantir diffusion immédiate du winner
        await emitTournamentStateChanged(getIO());
      } else {
        scheduleRankingUpdated(getIO());
      }

      res.status(200).json({
        data: { round: result.updatedRound, rankings: result.finaleRankings },
      });
      return;
    }

    // Branche qualif (comportement inchangé)
    const updatedRound = await prisma.round.update({
      where: { id: round.id },
      data: { status: 'validated' },
      include: {
        lobbies: {
          include: {
            players: { include: { player: true } },
          },
        },
      },
    });

    // Calculer le classement cumule de tous les rounds valides de cette journee
    const allValidatedLobbyPlayers = await prisma.lobbyPlayer.findMany({
      where: {
        placement: { not: null },
        lobby: {
          round: { status: 'validated', dayId },
        },
      },
      include: {
        player: true,
        lobby: {
          include: { round: true },
        },
      },
    });

    // Grouper par playerId
    const playerResultsMap = new Map<number, {
      discordPseudo: string;
      results: { placement: number; points: number; roundId: number }[];
    }>();

    for (const lp of allValidatedLobbyPlayers) {
      if (lp.placement === null || lp.points === null) continue;
      const existing = playerResultsMap.get(lp.playerId);
      const result = { placement: lp.placement, points: lp.points, roundId: lp.lobby.roundId };
      if (existing) {
        existing.results.push(result);
      } else {
        playerResultsMap.set(lp.playerId, {
          discordPseudo: lp.player.discordPseudo,
          results: [result],
        });
      }
    }

    // Calculer les stats et trier
    const rankings = Array.from(playerResultsMap.entries()).map(([playerId, data]) => {
      const stats = calculatePlayerStats(data.results);
      return {
        playerId,
        discordPseudo: data.discordPseudo,
        ...stats,
      };
    });

    // Tri : score total desc, top1Count desc, top4Count desc, lastGameResult asc
    rankings.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.top1Count !== a.top1Count) return b.top1Count - a.top1Count;
      if (b.top4Count !== a.top4Count) return b.top4Count - a.top4Count;
      return a.lastGameResult - b.lastGameResult;
    });

    // Ajouter le rang
    const rankedResults = rankings.map((r, index) => ({
      rank: index + 1,
      ...r,
    }));

    scheduleRankingUpdated(getIO());

    res.status(200).json({ data: { round: updatedRound, rankings: rankedResults } });
  } catch (error) {
    console.error('Erreur lors de la validation du round:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// POST /days/:dayId/next-round — creer le round suivant
router.post('/days/:dayId/next-round', async (req: Request, res: Response) => {
  try {
    const dayId = Number(req.params.dayId);
    if (!Number.isInteger(dayId) || dayId <= 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Parametres invalides' },
      });
      return;
    }

    const day = await prisma.day.findUnique({
      where: { id: dayId },
      include: { rounds: true },
    });

    if (!day) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'La journee n\'existe pas' },
      });
      return;
    }

    // Garde finale : si finale déjà terminée, refuser
    if (day.type === 'finale' && day.status === 'completed') {
      res.status(400).json({
        error: { code: 'FINALE_ALREADY_COMPLETED', message: 'La finale est deja terminee' },
      });
      return;
    }

    if (day.status !== 'in-progress') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'La journee n\'est pas en cours' },
      });
      return;
    }

    const validatedCount = day.rounds.filter((r) => r.status === 'validated').length;
    const hasPendingOrActive = day.rounds.some((r) => r.status === 'pending' || r.status === 'in-progress');
    if (hasPendingOrActive) {
      res.status(409).json({
        error: { code: 'ROUND_ALREADY_EXISTS', message: 'Un round est deja en cours ou en attente' },
      });
      return;
    }

    const nextNumber = validatedCount + 1;

    // Branche finale : créer le round directement in-progress avec un nouveau lobby
    // contenant les mêmes 8 finalistes (récupérés depuis le round précédent).
    if (day.type === 'finale') {
      const previousRound = await prisma.round.findFirst({
        where: { dayId, status: 'validated' },
        orderBy: { number: 'desc' },
        include: {
          lobbies: {
            include: { players: { select: { playerId: true } } },
          },
        },
      });

      if (!previousRound || !previousRound.lobbies[0]) {
        res.status(400).json({
          error: {
            code: 'NO_PREVIOUS_FINALE_ROUND',
            message: 'Aucun round finale precedent trouve',
          },
        });
        return;
      }

      const finalistIds = previousRound.lobbies[0].players.map((lp) => lp.playerId);

      await prisma.$transaction(async (tx) => {
        await tx.round.create({
          data: {
            number: nextNumber,
            dayId,
            status: 'in-progress',
            lobbies: {
              create: {
                number: 1,
                players: {
                  create: finalistIds.map((playerId) => ({
                    playerId,
                    placement: null,
                    points: null,
                  })),
                },
              },
            },
          },
        });
      });

      const updatedDay = await prisma.day.findUnique({
        where: { id: dayId },
        include: {
          rounds: {
            include: {
              lobbies: {
                include: { players: { include: { player: true } } },
              },
            },
          },
        },
      });

      res.status(201).json({ data: updatedDay });
      return;
    }

    // Branche qualif : comportement inchangé (round créé en pending, lobby à générer ensuite)
    await prisma.round.create({
      data: { number: nextNumber, dayId },
    });

    const updatedDay = await prisma.day.findUnique({
      where: { id: dayId },
      include: {
        rounds: {
          include: {
            lobbies: {
              include: { players: { include: { player: true } } },
            },
          },
        },
      },
    });

    res.status(201).json({ data: updatedDay });
  } catch (error) {
    console.error('Erreur lors de la creation du round suivant:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// POST /days/:dayId/complete — terminer la journee
router.post('/days/:dayId/complete', async (req: Request, res: Response) => {
  try {
    const dayId = Number(req.params.dayId);
    if (!Number.isInteger(dayId) || dayId <= 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Parametres invalides' },
      });
      return;
    }

    const day = await prisma.day.findUnique({
      where: { id: dayId },
      include: { rounds: true },
    });

    if (!day || day.status !== 'in-progress') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'La journee n\'existe pas ou n\'est pas en cours' },
      });
      return;
    }

    const hasActiveRound = day.rounds.some((r) => r.status === 'in-progress');
    if (hasActiveRound) {
      res.status(400).json({
        error: { code: 'ROUND_IN_PROGRESS', message: 'Un round est encore en cours, validez-le avant de terminer la journee' },
      });
      return;
    }

    await prisma.day.update({
      where: { id: dayId },
      data: { status: 'completed' },
    });

    res.status(200).json({ data: { message: 'Journee terminee' } });
    emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));
  } catch (error) {
    console.error('Erreur lors de la completion de la journee:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

export default router;
