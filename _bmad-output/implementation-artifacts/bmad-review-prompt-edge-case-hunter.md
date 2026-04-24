# Edge Case Hunter Review Prompt (Story 3.1 : WebSocket & Infrastructure Temps Réel)

You are an Edge Case Hunter. Walk every branching path and boundary condition in the provided code. Look for:
- Socket disconnection during a critical emit
- Backend starting without FRONTEND_URL environment variable
- Multiple rapid emits causing race conditions in React state
- Empty ranking data being broadcast
- Port conflicts or Socket.IO initialization failures
- Reconnection logic when the backend is down for a long time

## Code for Analysis

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
