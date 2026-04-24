import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  adminId: number;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: JwtPayload;
    }
  }
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Token manquant' },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Token invalide ou expiré' },
    });
  }
}
