import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import {
  aggregateQualificationRankings,
  aggregateFinaleRankings,
} from '../services/rankingsAggregator';

const router = Router();

// GET /?type=qualification|finale — classement cumule (qualif par défaut, finale via query param)
router.get('/', async (req: Request, res: Response) => {
  try {
    const typeParam = typeof req.query.type === 'string' ? req.query.type : undefined;
    const type = typeParam ?? 'qualification';

    if (type !== 'qualification' && type !== 'finale') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Le parametre type doit valoir qualification ou finale',
        },
      });
      return;
    }

    const rankings =
      type === 'finale'
        ? await aggregateFinaleRankings(prisma)
        : await aggregateQualificationRankings(prisma);

    res.json({ data: rankings });
  } catch (error) {
    console.error('Erreur lors du calcul du classement:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

export default router;
