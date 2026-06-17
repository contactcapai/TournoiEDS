import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { validatePlayerInput } from '../validation/player';
import { getIO } from '../websocket/io';
import { emitTournamentStateChanged } from '../websocket/events';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_STATUSES = ['inscrit', 'absent', 'dropped'] as const;
const MAX_FIELD_LENGTH = 100;

// GET /players — liste complete des joueurs (avec email pour l'admin)
router.get('/players', async (_req: Request, res: Response) => {
  try {
    const players = await prisma.player.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: players });
  } catch (error) {
    console.error('Erreur lors de la recuperation des joueurs:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// POST /players — ajout manuel d'un joueur
router.post('/players', async (req: Request, res: Response) => {
  try {
    const errors = validatePlayerInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: errors.join(', ') } });
      return;
    }

    const { discordPseudo, riotPseudo, email } = req.body;

    const player = await prisma.player.create({
      data: {
        discordPseudo: discordPseudo.trim(),
        riotPseudo: riotPseudo.trim(),
        email: email.trim(),
      },
    });

    res.status(201).json({ data: player });
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      res.status(409).json({
        error: { code: 'DUPLICATE_DISCORD_PSEUDO', message: 'Ce pseudo Discord est deja inscrit' },
      });
      return;
    }

    console.error("Erreur lors de l'ajout du joueur:", error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// PATCH /players/:id — modifier un joueur (statut et/ou infos)
router.patch('/players/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'ID joueur invalide' },
      });
      return;
    }

    const player = await prisma.player.findUnique({ where: { id } });
    if (!player) {
      res.status(404).json({
        error: { code: 'PLAYER_NOT_FOUND', message: 'Joueur non trouve' },
      });
      return;
    }

    const { status, discordPseudo, riotPseudo, email } = req.body;
    const data: { status?: string; discordPseudo?: string; riotPseudo?: string; email?: string } = {};

    // Validation du statut si fourni
    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Statut invalide. Valeurs autorisees : ${ALLOWED_STATUSES.join(', ')}`,
          },
        });
        return;
      }
      if (status === 'dropped' && player.status !== 'inscrit') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Seuls les joueurs inscrits peuvent etre droppes',
          },
        });
        return;
      }
      data.status = status;
    }

    // Validation des champs texte si fournis
    if (discordPseudo !== undefined) {
      if (typeof discordPseudo !== 'string' || !discordPseudo.trim()) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Le pseudo Discord ne peut pas etre vide' },
        });
        return;
      }
      if (discordPseudo.trim().length > MAX_FIELD_LENGTH) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Le pseudo Discord ne doit pas depasser ${MAX_FIELD_LENGTH} caracteres` },
        });
        return;
      }
      data.discordPseudo = discordPseudo.trim();
    }

    if (riotPseudo !== undefined) {
      if (typeof riotPseudo !== 'string' || !riotPseudo.trim()) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Le pseudo Riot ne peut pas etre vide' },
        });
        return;
      }
      if (riotPseudo.trim().length > MAX_FIELD_LENGTH) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Le pseudo Riot ne doit pas depasser ${MAX_FIELD_LENGTH} caracteres` },
        });
        return;
      }
      data.riotPseudo = riotPseudo.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim() || !EMAIL_REGEX.test(email)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: "Le format de l'email est invalide" },
        });
        return;
      }
      data.email = email.trim();
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Aucun champ a modifier' },
      });
      return;
    }

    const updated = await prisma.player.update({
      where: { id },
      data,
    });

    res.json({ data: updated });
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error
    ) {
      const code = (error as { code: string }).code;
      if (code === 'P2002') {
        res.status(409).json({
          error: { code: 'DUPLICATE_DISCORD_PSEUDO', message: 'Ce pseudo Discord est deja utilise par un autre joueur' },
        });
        return;
      }
      if (code === 'P2025') {
        res.status(404).json({
          error: { code: 'PLAYER_NOT_FOUND', message: 'Joueur non trouve' },
        });
        return;
      }
    }

    console.error('Erreur lors de la mise a jour du joueur:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// DELETE /reset/finale — supprime la journee finale (rounds, lobbies, placements)
router.delete('/reset/finale', async (_req: Request, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      const finaleDays = await tx.day.findMany({
        where: { type: 'finale' },
        include: { rounds: { include: { lobbies: true } } },
      });
      if (finaleDays.length === 0) return;

      const roundIds = finaleDays.flatMap((d) => d.rounds.map((r) => r.id));
      const lobbyIds = finaleDays.flatMap((d) => d.rounds.flatMap((r) => r.lobbies.map((l) => l.id)));

      if (lobbyIds.length > 0) {
        await tx.lobbyPlayer.deleteMany({ where: { lobbyId: { in: lobbyIds } } });
        await tx.lobby.deleteMany({ where: { id: { in: lobbyIds } } });
      }
      if (roundIds.length > 0) {
        await tx.round.deleteMany({ where: { id: { in: roundIds } } });
      }
      await tx.day.deleteMany({ where: { id: { in: finaleDays.map((d) => d.id) } } });
    });

    res.json({ data: { message: 'Finale reinitialisee' } });
    emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));
  } catch (error) {
    console.error('Erreur lors du reset de la finale:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// DELETE /reset/qualifications — supprime toutes les journees (qualifs + finale dependante)
router.delete('/reset/qualifications', async (_req: Request, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      const days = await tx.day.findMany({
        include: { rounds: { include: { lobbies: true } } },
      });
      if (days.length === 0) return;

      const roundIds = days.flatMap((d) => d.rounds.map((r) => r.id));
      const lobbyIds = days.flatMap((d) => d.rounds.flatMap((r) => r.lobbies.map((l) => l.id)));

      if (lobbyIds.length > 0) {
        await tx.lobbyPlayer.deleteMany({ where: { lobbyId: { in: lobbyIds } } });
        await tx.lobby.deleteMany({ where: { id: { in: lobbyIds } } });
      }
      if (roundIds.length > 0) {
        await tx.round.deleteMany({ where: { id: { in: roundIds } } });
      }
      await tx.day.deleteMany({ where: { id: { in: days.map((d) => d.id) } } });
    });

    res.json({ data: { message: 'Qualifications reinitialisees' } });
    emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));
  } catch (error) {
    console.error('Erreur lors du reset des qualifications:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

// DELETE /reset/players — supprime tous les joueurs + historique complet du tournoi
router.delete('/reset/players', async (_req: Request, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.lobbyPlayer.deleteMany({});
      await tx.lobby.deleteMany({});
      await tx.round.deleteMany({});
      await tx.day.deleteMany({});
      await tx.player.deleteMany({});
    });

    res.json({ data: { message: 'Joueurs reinitialises' } });
    emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));
  } catch (error) {
    console.error('Erreur lors du reset des joueurs:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

export default router;
