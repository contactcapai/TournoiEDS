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
      if (!socket.connected) return;
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
