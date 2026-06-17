import { io as createIOClient, type Socket } from 'socket.io-client';
import type { PlayerRanking } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface TournamentStatePayload {
  phase: 'idle' | 'qualification' | 'finale';
  currentDayId: number | null;
  currentDayNumber: number | null;
  currentDayType: 'qualification' | 'finale' | null;
  rankings: PlayerRanking[];
  winner: PlayerRanking | null;
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
