import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { aggregateQualificationRankings } from '../services/rankingsAggregator';
import { selectFinalists } from '../services/finaleQualifier';
import { emitTournamentStateChanged } from '../websocket/events';
import { getIO } from '../websocket/io';

const router = Router();

const REQUIRED_QUALIFICATION_DAYS = 3;

// GET /progression — progression qualifs + presence finale (alimente l'affichage admin)
router.get('/progression', async (_req: Request, res: Response) => {
  try {
    const [completedQualDaysCount, finale] = await Promise.all([
      prisma.day.count({
        where: { type: 'qualification', status: 'completed' },
      }),
      prisma.day.findFirst({ where: { type: 'finale' } }),
    ]);
    res.json({
      data: {
        completedQualDaysCount,
        hasFinale: finale !== null,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la recuperation de la progression finale:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Une erreur interne est survenue',
      },
    });
  }
});

// POST /start — lancer la phase finale (lobby unique des top 8 qualifs)
router.post('/start', async (_req: Request, res: Response) => {
  try {
    // 1. Aucune journee in-progress
    const inProgress = await prisma.day.findFirst({
      where: { status: 'in-progress' },
    });
    if (inProgress) {
      res.status(409).json({
        error: {
          code: 'DAY_ALREADY_IN_PROGRESS',
          message: 'Une journee est deja en cours.',
        },
      });
      return;
    }

    // 2. Aucune journee finale existante
    const existingFinale = await prisma.day.findFirst({
      where: { type: 'finale' },
    });
    if (existingFinale) {
      res.status(409).json({
        error: {
          code: 'FINALE_ALREADY_STARTED',
          message: 'La finale a deja ete lancee.',
        },
      });
      return;
    }

    // 3. Les 3 journees de qualification doivent etre completed
    const completedQualCount = await prisma.day.count({
      where: { type: 'qualification', status: 'completed' },
    });
    if (completedQualCount < REQUIRED_QUALIFICATION_DAYS) {
      res.status(400).json({
        error: {
          code: 'QUALIFICATIONS_NOT_COMPLETE',
          message:
            'Les 3 journees de qualification doivent etre terminees avant de demarrer la finale.',
        },
      });
      return;
    }

    // Calcul du classement cumule qualifs + selection des finalistes
    const rankings = await aggregateQualificationRankings(prisma);
    const finalists = selectFinalists(rankings);

    // Creation atomique Day + Round 1 + Lobby 1 + LobbyPlayers
    const day = await prisma.$transaction(async (tx) => {
      const created = await tx.day.create({
        data: {
          number: 1,
          type: 'finale',
          status: 'in-progress',
          rounds: {
            create: {
              number: 1,
              status: 'in-progress',
              lobbies: {
                create: {
                  number: 1,
                  players: {
                    create: finalists.map((f) => ({
                      playerId: f.playerId,
                      placement: null,
                      points: null,
                    })),
                  },
                },
              },
            },
          },
        },
      });

      return tx.day.findUniqueOrThrow({
        where: { id: created.id },
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
    });

    // Broadcast WebSocket post-commit (non bloquant)
    emitTournamentStateChanged(getIO()).catch((err) =>
      console.error('Emit tournament_state_changed apres finale start:', err),
    );

    res.status(201).json({ data: { day, finalists } });
  } catch (error) {
    console.error('Erreur lors du demarrage de la finale:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Une erreur interne est survenue',
      },
    });
  }
});

export default router;
