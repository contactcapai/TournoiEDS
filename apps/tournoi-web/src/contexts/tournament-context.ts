import { createContext } from 'react';
import type { PlayerRanking } from '../types';

export interface TournamentState {
  phase: 'idle' | 'qualification' | 'finale';
  currentDayId: number | null;
  currentDayNumber: number | null;
  currentDayType: 'qualification' | 'finale' | null;
  rankings: PlayerRanking[];
  winner: PlayerRanking | null;
  isConnected: boolean;
}

export interface TournamentContextValue {
  state: TournamentState;
}

// Contexte + types isoles du Provider (fichier sans composant) pour satisfaire
// react-refresh/only-export-components (Fast Refresh).
export const TournamentContext = createContext<TournamentContextValue | null>(null);
