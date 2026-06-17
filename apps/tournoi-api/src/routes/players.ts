import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { validatePlayerInput } from '../validation/player';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

router.post('/players', async (req, res) => {
  try {
    const errors = validatePlayerInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: errors.join(', ') } });
      return;
    }

    const { discordPseudo, riotPseudo, email } = req.body;

    // Création du joueur en base
    const player = await prisma.player.create({
      data: {
        discordPseudo: discordPseudo.trim(),
        riotPseudo: riotPseudo.trim(),
        email: email.trim(),
      },
    });

    // Retourner sans exposer l'email
    res.status(201).json({
      data: {
        id: player.id,
        discordPseudo: player.discordPseudo,
        riotPseudo: player.riotPseudo,
      },
    });
  } catch (error: unknown) {
    // Gestion du doublon sur discordPseudo (Prisma P2002)
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      res.status(409).json({
        error: { code: 'DUPLICATE_DISCORD_PSEUDO', message: 'Ce pseudo Discord est déjà inscrit' },
      });
      return;
    }

    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

export default router;
