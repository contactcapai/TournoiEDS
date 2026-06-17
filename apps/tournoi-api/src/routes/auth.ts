import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';

const router = Router();

// Hash factice pour timing-safe comparison quand l'utilisateur n'existe pas
const DUMMY_HASH = bcrypt.hashSync('dummy-password-never-matches', 10);

// Rate limiting en memoire pour la route login
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

router.post('/auth/login', async (req, res) => {
  try {
    const clientIp = req.ip || 'unknown';
    if (isRateLimited(clientIp)) {
      res.status(429).json({
        error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
      });
      return;
    }

    const { username, password } = req.body;

    // Validation des champs requis
    if (!username || typeof username !== 'string' || !username.trim()) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Le champ identifiant est requis' },
      });
      return;
    }
    if (!password || typeof password !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Le champ mot de passe est requis' },
      });
      return;
    }

    // Recherche de l'admin en base (case-insensitive)
    const admin = await prisma.admin.findFirst({
      where: { username: { equals: username.trim(), mode: 'insensitive' } },
    });

    // Timing-safe : toujours executer bcrypt.compare, meme si l'utilisateur n'existe pas
    const hashToCompare = admin ? admin.passwordHash : DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!admin || !isValid) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants incorrects' },
      });
      return;
    }

    // Generation du token JWT (expiration 24h)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined');
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
      });
      return;
    }

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ data: { token } });
  } catch (error) {
    console.error('Erreur lors du login:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

export default router;
