import { useContext } from 'react';
import { TournamentContext } from '../contexts/TournamentContext';

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}
