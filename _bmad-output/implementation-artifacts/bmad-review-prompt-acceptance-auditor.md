# Acceptance Auditor Review Prompt (Story 3.1 : WebSocket & Infrastructure Temps Réel)

You are an Acceptance Auditor. Review the following code changes against the Acceptance Criteria (AC).

## Acceptance Criteria

1.  **AC1**: Connection to `/tournament` namespace, receive `tournament_state` immediately with rankings and phase.
2.  **AC2**: Broadcast `ranking_updated` after admin validates a round (payload format: `{ event, timestamp, data: { rankings: PlayerRanking[] } }`).
3.  **AC3**: Broadcast `tournament_state_changed` on phase change (day creation or completion).
4.  **AC4**: Auto-reconnection support and re-receiving `tournament_state`.
5.  **AC5**: Frontend `TournamentContext` updates on event receipt.
6.  **AC6**: Scalability (basic check).
7.  **AC7**: Zero regression on existing pages (mounting provider at App level).

## Code for Review

### backend/src/websocket/server.ts (AC1)
```typescript
  const tournamentNs = io.of('/tournament');
  tournamentNs.on('connection', async (socket) => {
    const state = await computeTournamentState();
    socket.emit('tournament_state', { ... });
  });
```

### backend/src/routes/tournament.ts (AC2, AC3)
```typescript
// POST /days
await prisma.day.create(...);
emitTournamentStateChanged(getIO());

// POST /validate
await prisma.round.update(...);
await emitRankingUpdated(getIO());

// POST /complete
await prisma.day.update(...);
emitTournamentStateChanged(getIO());
```

### frontend/src/contexts/TournamentContext.tsx (AC4, AC5)
```tsx
  useEffect(() => {
    const socket = createSocket();
    socket.on('tournament_state', ...);
    socket.on('ranking_updated', ...);
    socket.on('tournament_state_changed', ...);
    return () => socket.disconnect();
  }, []);
```

### frontend/src/App.tsx (AC7)
```tsx
    <AuthProvider>
      <TournamentProvider>
        <BrowserRouter>
          {/* existing routes untouched */}
        </BrowserRouter>
      </TournamentProvider>
    </AuthProvider>
```
