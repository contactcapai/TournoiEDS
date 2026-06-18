import { useEffect, useState, type ReactNode } from 'react';
import {
  createSocket,
  type TournamentStateEvent,
  type RankingUpdatedEvent,
  type TournamentStateChangedEvent,
} from '../services/socket';
import { TournamentContext, type TournamentState } from './tournament-context';

const initialState: TournamentState = {
  phase: 'idle',
  currentDayId: null,
  currentDayNumber: null,
  currentDayType: null,
  rankings: [],
  winner: null,
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
      const { phase, currentDayId, currentDayNumber, currentDayType, rankings, winner } =
        payload.data;
      setState((prev) => ({
        ...prev,
        phase,
        currentDayId,
        currentDayNumber,
        currentDayType,
        rankings,
        winner,
        isConnected: true,
      }));
    });

    socket.on('ranking_updated', (payload: RankingUpdatedEvent) => {
      setState((prev) => ({ ...prev, rankings: payload.data.rankings }));
    });

    socket.on('tournament_state_changed', (payload: TournamentStateChangedEvent) => {
      const { phase, currentDayId, currentDayNumber, currentDayType, rankings, winner } =
        payload.data;
      setState((prev) => ({
        ...prev,
        phase,
        currentDayId,
        currentDayNumber,
        currentDayType,
        rankings,
        winner,
      }));
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
