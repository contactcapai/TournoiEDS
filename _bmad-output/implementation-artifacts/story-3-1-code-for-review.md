# Code pour revue de la Story 3.1 : WebSocket & Infrastructure Temps Réel

## Backend

### backend/src/index.ts
```typescript
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { createWebSocketServer } from "./websocket/server";
import { setIO } from "./websocket/io";

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);
const io = createWebSocketServer(httpServer);
setIO(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (HTTP + Socket.IO)`);
});
```

### backend/src/websocket/io.ts
```typescript
import type { Server } from 'socket.io';

let ioInstance: Server | null = null;

export function setIO(io: Server): void {
  ioInstance = io;
}

export function getIO(): Server | null {
  return ioInstance;
}
```

### backend/src/websocket/server.ts
```typescript
import type { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { computeTournamentState } from './events';

export function createWebSocketServer(httpServer: HTTPServer): Server {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const io = new Server(httpServer, {
    cors: {
      origin: [frontendUrl],
      methods: ['GET', 'POST'],
    },
  });

  const tournamentNs = io.of('/tournament');

  tournamentNs.on('connection', async (socket) => {
    try {
      const state = await computeTournamentState();
      socket.emit('tournament_state', {
        event: 'tournament_state',
        timestamp: new Date().toISOString(),
        data: state,
      });
    } catch (error) {
      console.error("Erreur lors du calcul de l'etat initial:", error);
    }
  });

  return io;
}
```

### backend/src/websocket/events.ts
```typescript
import type { Server } from 'socket.io';
import prisma from '../prisma/client';
import {
  aggregateQualificationRankings,
  type PlayerRanking,
} from '../services/rankingsAggregator';

export interface TournamentState {
  phase: 'idle' | 'qualification' | 'finale';
  currentDayId: number | null;
  currentDayNumber: number | null;
  currentDayType: 'qualification' | 'finale' | null;
  rankings: PlayerRanking[];
}

export async function computeTournamentState(): Promise<TournamentState> {
  const currentDay = await prisma.day.findFirst({ where: { status: 'in-progress' } });
  const rankings = await aggregateQualificationRankings(prisma);

  return {
    phase: currentDay ? (currentDay.type as 'qualification' | 'finale') : 'idle',
    currentDayId: currentDay?.id ?? null,
    currentDayNumber: currentDay?.number ?? null,
    currentDayType: (currentDay?.type as 'qualification' | 'finale' | null) ?? null,
    rankings,
  };
}

export async function emitRankingUpdated(io: Server | null): Promise<void> {
  if (!io) return;
  try {
    const rankings = await aggregateQualificationRankings(prisma);
    io.of('/tournament').emit('ranking_updated', {
      event: 'ranking_updated',
      timestamp: new Date().toISOString(),
      data: { rankings },
    });
  } catch (error) {
    console.error("Erreur lors de l'emission ranking_updated:", error);
  }
}

export async function emitTournamentStateChanged(io: Server | null): Promise<void> {
  if (!io) return;
  try {
    const state = await computeTournamentState();
    io.of('/tournament').emit('tournament_state_changed', {
      event: 'tournament_state_changed',
      timestamp: new Date().toISOString(),
      data: state,
    });
  } catch (error) {
    console.error("Erreur lors de l'emission tournament_state_changed:", error);
  }
}
```

### backend/src/services/rankingsAggregator.ts
```typescript
import type { PrismaClient } from '../generated/prisma/client';
import { calculatePlayerStats } from './pointsCalculator';

export interface PlayerRanking {
  rank: number;
  playerId: number;
  discordPseudo: string;
  totalScore: number;
  top1Count: number;
  top4Count: number;
  lastGameResult: number;
  roundsPlayed: number;
  average: number;
}

export async function aggregateQualificationRankings(
  prisma: PrismaClient
): Promise<PlayerRanking[]> {
  const allLobbyPlayers = await prisma.lobbyPlayer.findMany({
    where: {
      placement: { not: null },
      lobby: {
        round: {
          status: 'validated',
          day: { type: 'qualification' },
        },
      },
    },
    include: {
      player: { select: { discordPseudo: true } },
      lobby: true,
    },
  });

  const playerResultsMap = new Map<
    number,
    { discordPseudo: string; results: { placement: number; points: number; roundId: number }[] }
  >();

  for (const lp of allLobbyPlayers) {
    if (lp.placement === null || lp.points === null) continue;
    const result = { placement: lp.placement, points: lp.points, roundId: lp.lobby.roundId };
    const existing = playerResultsMap.get(lp.playerId);
    if (existing) {
      existing.results.push(result);
    } else {
      playerResultsMap.set(lp.playerId, {
        discordPseudo: lp.player.discordPseudo,
        results: [result],
      });
    }
  }

  const rankings = Array.from(playerResultsMap.entries()).map(([playerId, data]) => {
    const stats = calculatePlayerStats(data.results);
    return { playerId, discordPseudo: data.discordPseudo, ...stats };
  });

  rankings.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.top1Count !== a.top1Count) return b.top1Count - a.top1Count;
    if (b.top4Count !== a.top4Count) return b.top4Count - a.top4Count;
    return a.lastGameResult - b.lastGameResult;
  });

  rankings.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.top1Count !== a.top1Count) return b.top1Count - a.top1Count;
    if (b.top4Count !== a.top4Count) return b.top4Count - a.top4Count;
    return a.lastGameResult - b.lastGameResult;
  });

  return rankings.map((r, index) => ({ rank: index + 1, ...r }));
}
```

### backend/src/routes/rankings.ts
```typescript
import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { aggregateQualificationRankings } from '../services/rankingsAggregator';

const router = Router();

// GET / — classement cumule toutes journees de qualification
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rankings = await aggregateQualificationRankings(prisma);
    res.json({ data: rankings });
  } catch (error) {
    console.error('Erreur lors du calcul du classement:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

export default router;
```

### backend/src/routes/tournament.ts (extrait des modifications)
```typescript
// Imports ajoutés
import { getIO } from '../websocket/io';
import { emitRankingUpdated, emitTournamentStateChanged } from '../websocket/events';

// POST /days — emit après création
    const day = await prisma.day.create({ ... });
    res.status(201).json({ data: day });
    emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));

// POST /days/:dayId/rounds/:roundNumber/validate — emit après validation
    const updatedRound = await prisma.round.update({ ... });
    // ... calcul rankings local ...
    await emitRankingUpdated(getIO());
    res.status(200).json({ data: { round: updatedRound, rankings: rankedResults } });

// POST /days/:dayId/complete — emit après complétion
    await prisma.day.update({ ... });
    res.status(200).json({ data: { message: 'Journee terminee' } });
    emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));
```

## Frontend

### frontend/src/services/socket.ts
```typescript
import { io as createIOClient, type Socket } from 'socket.io-client';
import type { PlayerRanking } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface TournamentStatePayload {
  phase: 'idle' | 'qualification' | 'finale';
  currentDayId: number | null;
  currentDayNumber: number | null;
  currentDayType: 'qualification' | 'finale' | null;
  rankings: PlayerRanking[];
}

export interface SocketEvent<T> {
  event: string;
  timestamp: string;
  data: T;
}

export type TournamentStateEvent = SocketEvent<TournamentStatePayload>;
export type RankingUpdatedEvent = SocketEvent<{ rankings: PlayerRanking[] }>;
export type TournamentStateChangedEvent = SocketEvent<TournamentStatePayload>;

export function createSocket(): Socket {
  return createIOClient(`${SOCKET_URL}/tournament`, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
```

### frontend/src/contexts/TournamentContext.tsx
```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { PlayerRanking } from '../types';
import {
  createSocket,
  type TournamentStateEvent,
  type RankingUpdatedEvent,
  type TournamentStateChangedEvent,
} from '../services/socket';

export interface TournamentState {
  phase: 'idle' | 'qualification' | 'finale';
  currentDayId: number | null;
  currentDayNumber: number | null;
  currentDayType: 'qualification' | 'finale' | null;
  rankings: PlayerRanking[];
  isConnected: boolean;
}

interface TournamentContextValue {
  state: TournamentState;
}

export const TournamentContext = createContext<TournamentContextValue | null>(null);

const initialState: TournamentState = {
  phase: 'idle',
  currentDayId: null,
  currentDayNumber: null,
  currentDayType: null,
  rankings: [],
  isConnected: false,
};

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TournamentState>(initialState);

  useEffect(() => {
    const socket = createSocket();

    socket.on('connect', () => {
      setState((prev) => ({ ...prev, isConnected: true }));
    });

    socket.on('disconnect', () => {
      setState((prev) => ({ ...prev, isConnected: false }));
    });

    socket.on('tournament_state', (payload: TournamentStateEvent) => {
      setState((prev) => ({ ...prev, ...payload.data, isConnected: true }));
    });

    socket.on('ranking_updated', (payload: RankingUpdatedEvent) => {
      setState((prev) => ({ ...prev, rankings: payload.data.rankings }));
    });

    socket.on('tournament_state_changed', (payload: TournamentStateChangedEvent) => {
      setState((prev) => ({ ...prev, ...payload.data }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <TournamentContext.Provider value={{ state }}>
      {children}
    </TournamentContext.Provider>
  );
}
```

### frontend/src/hooks/useTournament.ts
```typescript
import { useContext } from 'react';
import { TournamentContext } from '../contexts/TournamentContext';

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}
```

### frontend/src/App.tsx (extrait)
```tsx
import { TournamentProvider } from './contexts/TournamentContext';

function App() {
  return (
    <AuthProvider>
      <TournamentProvider>
        <BrowserRouter>
          {/* ... Routes ... */}
        </BrowserRouter>
      </TournamentProvider>
    </AuthProvider>
  );
}
```
