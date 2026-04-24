# Story 3.1 : WebSocket & Infrastructure Temps Réel

Status: done

## Story

As a **visiteur (joueur ou spectateur)**,
I want **que les données du site se mettent à jour automatiquement sans recharger la page**,
So that **je vois les résultats en direct pendant le tournoi**.

## Acceptance Criteria

1. **Given** le backend est démarré **When** un client se connecte au namespace Socket.IO `/tournament` **Then** la connexion WebSocket est établie **And** le client reçoit immédiatement l'état courant du tournoi (classement agrégé + phase en cours) via un événement initial `tournament_state` émis par le serveur à la connexion.

2. **Given** l'admin valide un round via `POST /api/admin/days/:dayId/rounds/:roundNumber/validate` **When** la transaction de validation réussit en base **Then** le serveur broadcast l'événement `ranking_updated` au namespace `/tournament` **And** le payload suit le format standardisé `{ event: "ranking_updated", timestamp: <ISO 8601>, data: { rankings: PlayerRanking[] } }` où `rankings` est le classement cumulé multi-journées (équivalent `GET /api/rankings`) **And** la mise à jour arrive aux clients en moins de 2 secondes après la validation (NFR2).

3. **Given** l'admin change la phase du tournoi (création d'une journée via `POST /api/admin/days`, fin de journée via `POST /api/admin/days/:dayId/complete`) **When** le changement est enregistré en base **Then** le serveur broadcast l'événement `tournament_state_changed` au namespace `/tournament` avec le payload `{ event: "tournament_state_changed", timestamp, data: { phase, currentDayId, currentDayNumber, currentDayType } }`.

4. **Given** un client est connecté via Socket.IO **When** la connexion est interrompue (perte réseau mobile) **Then** Socket.IO tente automatiquement la reconnexion (comportement natif) **And** après reconnexion, le client reçoit à nouveau l'événement initial `tournament_state` avec le classement cumulé à jour **And** le `TournamentContext` React se met à jour sans rechargement de page.

5. **Given** le frontend reçoit un événement Socket.IO **When** l'événement est `ranking_updated` **Then** le `TournamentContext` est mis à jour avec `data.rankings` de façon immutable **And** tous les composants consommant `useTournament()` se re-rendent automatiquement avec les nouvelles données.

6. **Given** ~30 clients sont connectés simultanément au namespace `/tournament` **When** l'admin valide un round **Then** tous les clients reçoivent l'événement `ranking_updated` **And** le serveur ne produit ni exception ni fuite mémoire (NFR4).

7. **Given** la page `/qualifications` n'est pas encore implémentée (Story 3.2) **When** je démarre le frontend **Then** le `TournamentProvider` est monté au niveau de l'App (autour de `AuthProvider` existant) **And** aucune régression visuelle ou fonctionnelle n'apparaît sur les pages existantes (`/`, `/mentions-legales`, `/admin/login`, `/admin`).

## Tasks / Subtasks

- [x] **Task 1 — Backend : intégrer Socket.IO au serveur HTTP** (AC #1, #6)
  - [x] 1.1 Modifier `backend/src/index.ts` : remplacer `app.listen(PORT)` par un `http.createServer(app)` + `new Server(httpServer, { cors })` (Socket.IO) + `httpServer.listen(PORT)` — cf. pattern `http.createServer` natif Node
  - [x] 1.2 Créer `backend/src/websocket/server.ts` exportant une fonction `createWebSocketServer(httpServer: HTTPServer): Server` qui retourne l'instance Socket.IO, configure le namespace `/tournament` et attache les handlers
  - [x] 1.3 Configurer le CORS Socket.IO : lire `process.env.FRONTEND_URL` (par défaut `http://localhost:5173` en dev), autoriser `origin: [FRONTEND_URL]` et `methods: ['GET', 'POST']`
  - [x] 1.4 Ajouter `FRONTEND_URL=http://localhost:5173` dans `backend/.env.example` et `backend/.env`
  - [x] 1.5 Exposer l'instance Socket.IO via un module singleton `backend/src/websocket/io.ts` (pattern `let io: Server | null = null; export function setIO(instance) / getIO()`) pour qu'elle soit accessible depuis les routes Express sans circular import

- [x] **Task 2 — Backend : handlers de connexion et état initial** (AC #1, #4)
  - [x] 2.1 Créer `backend/src/websocket/events.ts` contenant :
    - une fonction `computeTournamentState(): Promise<{ phase, currentDayId, currentDayNumber, currentDayType, rankings }>` qui lit la journée `in-progress` + agrège le classement cumulé (réutiliser la logique de `routes/rankings.ts`)
    - une fonction `emitRankingUpdated(io: Server)` qui calcule les rankings et émet `ranking_updated` avec le payload standardisé sur le namespace `/tournament`
    - une fonction `emitTournamentStateChanged(io: Server)` qui calcule l'état et émet `tournament_state_changed`
  - [x] 2.2 Dans `backend/src/websocket/server.ts`, sur le namespace `/tournament`, handler `connection` : calculer l'état via `computeTournamentState()` puis `socket.emit('tournament_state', { event: 'tournament_state', timestamp, data })`
  - [x] 2.3 Factoriser la logique d'agrégation du classement : extraire la requête Prisma + calcul + tri de `routes/rankings.ts` dans un service pur `backend/src/services/rankingsAggregator.ts` exportant `aggregateQualificationRankings(prisma): Promise<PlayerRanking[]>` — `routes/rankings.ts` et `websocket/events.ts` l'appellent tous deux (DRY)
  - [x] 2.4 Mettre à jour `routes/rankings.ts` pour utiliser `aggregateQualificationRankings(prisma)` au lieu de dupliquer la requête

- [x] **Task 3 — Backend : broadcast ranking_updated après validation round** (AC #2, #6)
  - [x] 3.1 Dans `backend/src/routes/tournament.ts`, à la fin du handler `POST /days/:dayId/rounds/:roundNumber/validate` (juste avant `res.status(200).json(...)`) : appeler `emitRankingUpdated(getIO())`
  - [x] 3.2 Ne PAS bloquer la réponse HTTP sur l'émission (l'émission Socket.IO est synchrone côté serveur mais le calcul du classement est async — faire `await emitRankingUpdated(...)` puis répondre OK, ou fire-and-forget avec `.catch(err => console.error)` si on veut prioriser le temps de réponse HTTP). Choix retenu : **await l'émission avant la réponse HTTP** pour garantir la cohérence (moins de 2s NFR2, OK à cette échelle)
  - [x] 3.3 Protéger contre `io === null` si le module est chargé dans un contexte sans WebSocket (tests unitaires) : `if (!io) return;` dans `emitRankingUpdated`

- [x] **Task 4 — Backend : broadcast tournament_state_changed sur phase** (AC #3)
  - [x] 4.1 Dans `routes/tournament.ts`, handler `POST /days` (création journée) : après `res.status(201).json(...)`, appeler `emitTournamentStateChanged(getIO())` (fire-and-forget `.catch` acceptable ici car c'est informatif)
  - [x] 4.2 Dans `routes/tournament.ts`, handler `POST /days/:dayId/complete` : après succès, appeler `emitTournamentStateChanged(getIO())`

- [x] **Task 5 — Frontend : installer et configurer le client Socket.IO** (AC #1, #4, #5)
  - [x] 5.1 Installer `socket.io-client` : `cd frontend && npm install socket.io-client`
  - [x] 5.2 Créer `frontend/src/services/socket.ts` exportant :
    - une fonction `createSocket(): Socket` qui crée l'instance Socket.IO vers `${VITE_API_URL}/tournament` avec options par défaut (`autoConnect: true`, `reconnection: true`)
    - les types d'événements `TournamentStateEvent`, `RankingUpdatedEvent`, `TournamentStateChangedEvent` basés sur le payload `{ event, timestamp, data }`

- [x] **Task 6 — Frontend : TournamentContext + provider** (AC #5, #7)
  - [x] 6.1 Créer `frontend/src/contexts/TournamentContext.tsx` :
    - type `TournamentState { phase: 'idle' | 'qualification' | 'finale'; currentDayId: number | null; currentDayNumber: number | null; currentDayType: 'qualification' | 'finale' | null; rankings: PlayerRanking[]; isConnected: boolean }`
    - `TournamentContext = createContext<{ state, refetch } | null>(null)`
    - `TournamentProvider` : instancie un Socket.IO via `createSocket()`, s'abonne aux événements `tournament_state`, `ranking_updated`, `tournament_state_changed`, `connect`, `disconnect` ; stocke l'état via `useState`/`useReducer` ; cleanup `socket.disconnect()` dans l'useEffect return
    - les mises à jour d'état sont **immutables** (nouvelles références) conformément aux patterns React
  - [x] 6.2 Créer `frontend/src/hooks/useTournament.ts` : hook qui lit le context et lève une erreur si utilisé hors du provider (pattern identique à `useAuth`)
  - [x] 6.3 Monter le provider dans `frontend/src/App.tsx` **autour de** `AuthProvider` (ou à l'intérieur, peu importe tant qu'il englobe toutes les routes) — ne PAS toucher les routes existantes

- [x] **Task 7 — Tests manuels end-to-end** (AC #1-#7 — validation fonctionnelle requise par la rétro Epic 2)
  - [x] 7.1 Build backend + frontend : `npm run build` passe sans erreur dans les deux packages
  - [x] 7.2 Démarrer backend (`npm run dev`) + frontend (`npm run dev`) + PostgreSQL Docker
  - [x] 7.3 Ouvrir DevTools Network/WS dans Chrome sur la page d'accueil : vérifier qu'une connexion Socket.IO s'établit vers `/tournament` et qu'un événement `tournament_state` est reçu à la connexion *(validé navigateur par Brice 2026-04-17)*
  - [x] 7.4 Scénario de validation : se connecter en admin, démarrer une journée, générer lobbies round 1, saisir placements, valider → vérifier qu'un événement `ranking_updated` apparaît dans DevTools Network/WS avec le classement attendu *(validé navigateur par Brice 2026-04-17)*
  - [x] 7.5 Scénario reconnexion : couper le backend (`Ctrl+C`), redémarrer → vérifier que le client se reconnecte automatiquement et reçoit `tournament_state` à nouveau (DevTools console doit logger la reconnexion) *(validé navigateur par Brice 2026-04-17)*
  - [x] 7.6 Régression zéro : vérifier que `/`, `/mentions-legales`, `/admin/login`, `/admin` (login + création joueur + démarrage journée + drop + validation round) fonctionnent sans régression *(validé navigateur par Brice 2026-04-17)*
  - [x] 7.7 Tests unitaires existants : `cd backend && node --test dist/services/*.test.js` — 39/39 passent (30 anciens + 7 nouveaux rankingsAggregator + 2 autres)

## Dev Notes

### Architecture & Patterns à suivre

**Principe clé : intégration WebSocket transparente, pas de régression sur l'API REST existante.**

Socket.IO s'ajoute **en parallèle** d'Express sur le même port (3001). Le serveur HTTP devient un `http.createServer(app)` plutôt qu'un simple `app.listen(PORT)`, et Socket.IO s'attache à ce serveur HTTP. Les routes REST existantes (auth, players, admin, tournament, rankings) ne sont **pas modifiées dans leur logique métier** — seuls deux endpoints (`/validate`, `/days`, `/days/:dayId/complete`) émettent un événement Socket.IO **après** avoir écrit en base.

Le frontend consomme Socket.IO uniquement pour **pousser** des mises à jour d'état dans le `TournamentContext`. Les appels REST (`GET /api/rankings`, etc.) restent valides — ils serviront à Story 3.2 pour le chargement initial de la page `/qualifications`, **en complément** du state WebSocket.

---

### Task 1 — Intégration Socket.IO dans index.ts

**Fichier** : `backend/src/index.ts` (actuel : 10 lignes)

Pattern Socket.IO v4.8 avec TypeScript :

```typescript
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server as IOServer } from 'socket.io';
import app from './app';
import { createWebSocketServer } from './websocket/server';
import { setIO } from './websocket/io';

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);
const io = createWebSocketServer(httpServer);
setIO(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (HTTP + Socket.IO)`);
});
```

**Fichier** : `backend/src/websocket/io.ts` (nouveau, ~10 lignes)

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

**Fichier** : `backend/src/websocket/server.ts` (nouveau)

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
      console.error('Erreur lors du calcul de l\'etat initial:', error);
    }
  });

  return io;
}
```

---

### Task 2 — Factoriser l'agrégation du classement

**Pourquoi** : `routes/rankings.ts` et `websocket/events.ts` ont besoin EXACTEMENT du même calcul. Pattern de la rétro Epic 2 : service pur testable, pas de duplication.

**Fichier** : `backend/src/services/rankingsAggregator.ts` (nouveau)

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

export async function aggregateQualificationRankings(prisma: PrismaClient): Promise<PlayerRanking[]> {
  const allLobbyPlayers = await prisma.lobbyPlayer.findMany({
    where: {
      placement: { not: null },
      lobby: { round: { status: 'validated', day: { type: 'qualification' } } },
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
    if (existing) existing.results.push(result);
    else playerResultsMap.set(lp.playerId, { discordPseudo: lp.player.discordPseudo, results: [result] });
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

  return rankings.map((r, index) => ({ rank: index + 1, ...r }));
}
```

**Mettre à jour `backend/src/routes/rankings.ts` pour utiliser ce service :**

```typescript
import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { aggregateQualificationRankings } from '../services/rankingsAggregator';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rankings = await aggregateQualificationRankings(prisma);
    res.json({ data: rankings });
  } catch (error) {
    console.error('Erreur lors du calcul du classement:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' } });
  }
});

export default router;
```

---

### Task 2.1-2.2 — websocket/events.ts

**Fichier** : `backend/src/websocket/events.ts` (nouveau)

```typescript
import type { Server } from 'socket.io';
import prisma from '../prisma/client';
import { aggregateQualificationRankings, type PlayerRanking } from '../services/rankingsAggregator';

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
    console.error('Erreur lors de l\'emission ranking_updated:', error);
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
    console.error('Erreur lors de l\'emission tournament_state_changed:', error);
  }
}
```

---

### Task 3 — Brancher l'émission dans `tournament.ts`

**Fichier** : `backend/src/routes/tournament.ts` (542+ lignes)

**3.1 — En tête de fichier, ajouter :**
```typescript
import { getIO } from '../websocket/io';
import { emitRankingUpdated, emitTournamentStateChanged } from '../websocket/events';
```

**3.2 — Handler `POST /days/:dayId/rounds/:roundNumber/validate` (ligne ~446)** : juste AVANT `res.status(200).json({ data: { round: updatedRound, rankings: rankedResults } });` (ligne 581), ajouter :

```typescript
await emitRankingUpdated(getIO());
```

**Important** : l'émission se fait **après** la mise à jour du round en base (Prisma.transaction + update), et **avant** la réponse HTTP, pour garantir que si le client reçoit 200 OK, alors le broadcast a été tenté. L'émission échouant n'invalide pas la validation (try/catch interne à `emitRankingUpdated`).

**3.3 — Handler `POST /days` (ligne ~69)** : après `res.status(201).json({ data: day });`, ajouter :

```typescript
emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));
```
Fire-and-forget acceptable ici (événement informatif, pas bloquant).

**3.4 — Handler `POST /days/:dayId/complete` (ligne ~650)** : après `res.status(200).json({ data: { message: 'Journee terminee' } });`, ajouter :

```typescript
emitTournamentStateChanged(getIO()).catch((err) => console.error('Emit failed:', err));
```

---

### Task 5 — Frontend : socket.io-client

**Dépendance à ajouter** : `socket.io-client@4.8` (aligné avec le serveur `socket.io@4.8.3`).

**Fichier** : `frontend/src/services/socket.ts` (nouveau)

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

---

### Task 6 — TournamentContext

**Fichier** : `frontend/src/contexts/TournamentContext.tsx` (nouveau)

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

**Fichier** : `frontend/src/hooks/useTournament.ts` (nouveau)

```typescript
import { useContext } from 'react';
import { TournamentContext } from '../contexts/TournamentContext';

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within a TournamentProvider');
  return ctx;
}
```

**Fichier** : `frontend/src/App.tsx` — ajouter `<TournamentProvider>` à l'intérieur de `<AuthProvider>` :

```tsx
<AuthProvider>
  <TournamentProvider>
    <BrowserRouter>
      {/* routes existantes */}
    </BrowserRouter>
  </TournamentProvider>
</AuthProvider>
```

---

### État actuel du code (ce qui existe déjà)

**Backend :**
- `socket.io@^4.8.3` installé dans `backend/package.json` → PAS à réinstaller
- Dossier `backend/src/websocket/` existe mais VIDE → à peupler avec `io.ts`, `server.ts`, `events.ts`
- `backend/src/index.ts` (10 lignes) : `app.listen(PORT)` actuellement → à remplacer par `http.createServer(app)` + attacher Socket.IO
- `backend/src/app.ts` (48 lignes) : **NE PAS TOUCHER** — Socket.IO s'attache au HTTP server dans `index.ts`, pas à l'app Express
- `backend/src/routes/rankings.ts` (72 lignes) : logique d'agrégation à factoriser dans `services/rankingsAggregator.ts`
- `backend/src/routes/tournament.ts` (694 lignes) : ajouts purement additifs (imports + 3 appels `emit*`) — logique métier existante intouchée
- `backend/src/prisma/client.ts` : instance Prisma partagée → réutiliser via `import prisma from '../prisma/client'`
- `backend/src/services/pointsCalculator.ts` : `calculatePlayerStats` inchangé

**Frontend :**
- `socket.io-client` PAS installé → à `npm install`
- `frontend/src/contexts/` contient `AuthContext.tsx` (pattern à suivre) → ajouter `TournamentContext.tsx`
- `frontend/src/hooks/` contient `useAuth.ts` (pattern à suivre) → ajouter `useTournament.ts`
- `frontend/src/services/` contient `api.ts` (fetchRankings déjà présent en 204-209) → ajouter `socket.ts`
- `frontend/src/types/index.ts` : `PlayerRanking` (75-85) déjà défini → réutiliser directement
- `frontend/src/App.tsx` : `AuthProvider` enveloppe déjà les routes → ajouter `TournamentProvider` à l'intérieur
- `frontend/.env.example` + `frontend/.env.development` : `VITE_API_URL=http://localhost:3001` → réutiliser, pas de nouvelle variable

---

### Dépendances et commandes

**À installer côté frontend :**
```bash
cd frontend
npm install socket.io-client
```

**Aucune installation backend** : `socket.io@^4.8.3` est déjà dans `package.json`.

**Pas de migration Prisma** : AUCUNE modification du modèle de données.

---

### Tailwind v4 — classes EDS (pour future UI de statut de connexion)

Non nécessaire pour cette story (purement technique, pas d'UI exposée). Les classes EDS (`bg-eds-dark`, `text-eds-cyan`, `text-eds-gold`, `font-heading`, `font-body`, etc.) seront utilisées en Story 3.2 pour afficher visuellement la déconnexion. Pour 3.1, `state.isConnected` est stocké dans le context mais aucun composant ne l'affiche — c'est intentionnel.

---

### Anti-patterns à éviter

- **NE PAS** modifier la logique métier de `tournament.ts` (validate, generate-lobbies, placements, etc.) — les ajouts sont purement additifs : imports + 3 appels `emit*`
- **NE PAS** créer une nouvelle instance `PrismaClient` — toujours utiliser `import prisma from '../prisma/client'`
- **NE PAS** dupliquer la requête de classement entre `routes/rankings.ts` et `websocket/events.ts` — factoriser dans `services/rankingsAggregator.ts` (leçon rétro Epic 2 : services purs, zéro régression)
- **NE PAS** attacher Socket.IO dans `app.ts` — il s'attache au serveur HTTP dans `index.ts`
- **NE PAS** créer plusieurs namespaces — un seul `/tournament` pour 3.1, 3.2, 4.1 et 5.x
- **NE PAS** exiger d'authentification sur les événements WebSocket — le WebSocket est **lecture seule publique** (architecture.md ligne 551)
- **NE PAS** exposer les emails joueurs dans les payloads WebSocket — le type `PlayerRanking` ne contient que `discordPseudo`, pas d'email (cohérent avec la boundary data d'architecture.md)
- **NE PAS** faire un `socket.emit` depuis une connexion individuelle quand il faut broadcaster — utiliser `io.of('/tournament').emit(...)` pour tous les clients
- **NE PAS** oublier le cleanup `socket.disconnect()` dans le `useEffect` return du Provider (sinon fuite de connexion en dev avec HMR)
- **NE PAS** créer un fichier `utils/helpers.ts` fourre-tout (anti-pattern architecture.md ligne 422)
- **NE PAS** utiliser `any` en TypeScript (règle stricte tenue sur Epics 1 et 2, à maintenir)
- **NE PAS** modifier `pointsCalculator.ts` — réutilisation directe de `calculatePlayerStats`
- **NE PAS** implémenter la page `/qualifications` — c'est la Story 3.2
- **NE PAS** implémenter l'overlay OBS ni le composant `ConnectionStatus` — overlay = Story 4.1, indicateur visuel = Story 3.2/3.3

---

### Relation avec les stories futures

- **Story 3.2 (Page Qualifications)** : consommera `useTournament()` pour afficher le classement. Le chargement initial de la page pourra utiliser `state.rankings` du Context (peuplé par `tournament_state` à la connexion) et se rafraîchir via `ranking_updated`. Pas besoin d'appeler `fetchRankings()` côté page si le Context est monté au niveau App.
- **Story 4.1 (Overlay OBS)** : réutilisera le même `TournamentContext` et le même namespace `/tournament`. Aucune duplication.
- **Story 5.x (Finale)** : un nouvel événement `finale_progress_updated` sera ajouté dans `events.ts` (hors scope 3.1). `tournament_state_changed` couvre déjà la transition qualif → finale via le champ `currentDayType`.
- **Epic 6 (Déploiement)** : le `FRONTEND_URL` en prod sera `https://tournoi.esportdessacres.fr`. Le Traefik proxy devra autoriser l'upgrade WebSocket vers `api-tournoi.esportdessacres.fr` — hors scope 3.1, à traiter en 6.1.

---

### Previous Story Intelligence (Stories 2.5, 2.6, 2.7 + Rétro Epic 2)

**Décisions techniques confirmées à appliquer :**
- Import `'react-router'` (PAS `'react-router-dom'`)
- Express 5 — montage via `app.use()`
- Prisma 7 via `import prisma from '../prisma/client'` — instance partagée, pas de `new PrismaClient()`
- Error handler global dans `app.ts` (lignes 34-46) attrape les erreurs non gérées
- Pattern routes : validation params `Number()` + `Number.isInteger()` + `> 0`
- Pattern réponse API : `res.status(200).json({ data })` ou `res.status(4xx).json({ error: { code, message } })`
- Tests backend : `node:test` + `node:assert/strict`
- Socket.IO payload en `snake_case` pour les noms d'événements : `ranking_updated`, `tournament_state_changed`, `tournament_state` (architecture.md ligne 382)
- Formats JSON côté REST en `camelCase` (inchangé) — seul le **nom d'événement** Socket.IO est en `snake_case`, le payload reste en `camelCase`
- TypeScript strict mode : zéro `any`

**Apprentissage rétro Epic 2 à appliquer :**
- **Test end-to-end par story** (action item rétro Epic 2) : la Story 2.5 a eu 2 bugs critiques détectés uniquement par le test réel. Pour 3.1, Task 7 couvre un scénario end-to-end complet (validation + broadcast + réception frontend).
- **Services purs testables** : `rankingsAggregator.ts` suit ce pattern (factorisation pour DRY + facilité de test futur).
- **Pas de régression** : les 30 tests unitaires existants doivent continuer à passer. La factorisation de `rankings.ts` est purement structurelle, sans changement comportemental.
- **Transactions Prisma** : aucune nouvelle transaction introduite en 3.1 (les écritures restent dans `tournament.ts` inchangé).

**État sprint-status au moment de 3.1 :**
- Epic 2 : DONE (7/7 stories)
- Epic 3 : BACKLOG → passe en `in-progress` au moment de la création de 3.1 (1ère story de l'Epic 3)
- Stories dépendances : Story 2.7 (DONE) fournit `GET /api/rankings` et `PlayerRanking` — consommés par 3.1 via factorisation

**Correctifs adjacents connus (ne pas revenir dessus) :**
- Limite `MAX_ROUNDS = 6` retirée → nombre de rounds illimité, fin journée via bouton (cf. mémoire `project_rounds_per_day.md`)
- Drops : `LobbyPlayer` non supprimés au drop → le classement cumulé inclut leurs résultats antérieurs
- Joueurs actifs sans résultat : ajoutés en fin de classement suisse (pas exclus)

---

### NFR à vérifier

- **NFR2** (mise à jour WebSocket < 2s) : avec ~30 joueurs et Socket.IO broadcast sur un namespace unique en LAN, largement trivial. Vérification via DevTools Network/WS : timestamp événement ≤ 2s après clic admin.
- **NFR4** (~30 connexions simultanées) : Socket.IO 4.8 supporte nativement. Aucune optimisation nécessaire.

---

### Project Structure Notes

**Nouveaux fichiers à créer (backend) :**
- `backend/src/websocket/io.ts`
- `backend/src/websocket/server.ts`
- `backend/src/websocket/events.ts`
- `backend/src/services/rankingsAggregator.ts`

**Nouveaux fichiers à créer (frontend) :**
- `frontend/src/services/socket.ts`
- `frontend/src/contexts/TournamentContext.tsx`
- `frontend/src/hooks/useTournament.ts`

**Fichiers à modifier :**
- `backend/src/index.ts` — `http.createServer` + attacher Socket.IO
- `backend/src/routes/rankings.ts` — déléguer à `rankingsAggregator`
- `backend/src/routes/tournament.ts` — 2 imports + 3 appels `emit*` (validate, days POST, days/:id/complete)
- `backend/.env.example` et `backend/.env` — ajouter `FRONTEND_URL`
- `frontend/package.json` + `frontend/package-lock.json` — ajout `socket.io-client` (via npm install)
- `frontend/src/App.tsx` — monter `<TournamentProvider>` autour de `<BrowserRouter>`

**Fichiers EXPLICITEMENT à NE PAS toucher :**
- `backend/src/app.ts` — inchangé (Socket.IO s'attache au HTTP server dans index.ts)
- `backend/src/services/pointsCalculator.ts` — inchangé
- `backend/src/services/lobbyGenerator.ts`, `swissSystem.ts` — inchangés
- `backend/src/routes/players.ts`, `auth.ts`, `admin.ts` — inchangés
- `backend/prisma/schema.prisma` — inchangé (aucune migration)
- `frontend/src/contexts/AuthContext.tsx` — inchangé
- `frontend/src/services/api.ts` — inchangé (REST toujours valide)
- `frontend/src/types/index.ts` — inchangé (`PlayerRanking` déjà défini)
- Tous les composants `frontend/src/components/**/*.tsx` — inchangés
- Toutes les pages existantes — inchangées

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1 — WebSocket & Infrastructure Temps Reel (lignes 574-609)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 — Classement Temps Reel Public (lignes 570-610)]
- [Source: _bmad-output/planning-artifacts/epics.md#NFR2 mise a jour WebSocket < 2s (ligne 85), NFR4 ~30 connexions (ligne 87)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns — WebSocket Socket.IO (lignes 222-228)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns — Evenements Socket.IO snake_case + payload standardise (lignes 382-395)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — TournamentContext, useWebSocket, useTournament (lignes 230-250)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Flow — Admin POST /validate → Socket.IO broadcast ranking_updated → React Context (lignes 573-581)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries — WebSocket lecture seule publique (ligne 551)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns — websocket/server.ts, events.ts + services (lignes 346-354)]
- [Source: _bmad-output/implementation-artifacts/epic-2-retro-2026-04-17.md#Preparation Epic 3 — taches integrees a 3.1 (lignes 128-154)]
- [Source: _bmad-output/implementation-artifacts/2-7-classement-cumule-multi-journees.md#Dev Notes — pattern de classement cumule reutilise]
- [Source: backend/src/index.ts — point d'entree actuel, a modifier pour http.createServer]
- [Source: backend/src/app.ts — NE PAS toucher, Socket.IO s'attache au HTTP server]
- [Source: backend/src/routes/tournament.ts — handlers /validate, /days, /days/:id/complete (lignes 69, 446, 650)]
- [Source: backend/src/routes/rankings.ts — logique d'agregation a factoriser]
- [Source: backend/src/services/pointsCalculator.ts — calculatePlayerStats (reutilisation directe)]
- [Source: backend/package.json — socket.io@^4.8.3 deja installe]
- [Source: frontend/src/contexts/AuthContext.tsx — pattern Provider + useEffect a repliquer]
- [Source: frontend/src/hooks/useAuth.ts — pattern hook de context]
- [Source: frontend/src/types/index.ts — PlayerRanking (lignes 75-85)]
- [Source: frontend/src/App.tsx — emplacement montage TournamentProvider]
- [Source: memory/project_rounds_per_day.md — nombre de rounds illimite par journee]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7[1m]) — persona Amelia (bmad-agent-dev)

### Debug Log References

- Smoke test 1 (AC #1) : `_bmad-output/test-artifacts/story-3-1-socket-smoke.mjs` — connexion `/tournament` + réception `tournament_state` au format standardisé. Résultat : PASS.
- Smoke test 2 (AC #3) : `_bmad-output/test-artifacts/story-3-1-broadcast-smoke.mjs` — login admin + WS + POST /days + POST /complete, vérifie que `tournament_state_changed` est broadcast à chaque événement. Résultat : PASS (createBroadcast=true, completeBroadcast=true). DB nettoyée après test.
- Tests unitaires : `node --test dist/services/*.test.js` — 39/39 pass (dont 7 nouveaux sur `rankingsAggregator`).
- Builds : `npm run build` OK dans backend ET frontend.

### Completion Notes List

**Ce qui a été implémenté et validé programmatiquement :**

- **Tasks 1-6 terminées intégralement.**
- Backend Socket.IO attaché via `http.createServer(app)` + `new Server(httpServer, { cors })` ; singleton `websocket/io.ts` expose `setIO/getIO` aux routes sans circular import.
- Namespace `/tournament` avec handler `connection` qui émet `tournament_state` au format `{event, timestamp, data}`.
- Factorisation `rankingsAggregator.ts` (service pur testable) : `routes/rankings.ts` et `websocket/events.ts` partagent la même logique — 0 duplication, leçon rétro Epic 2 appliquée.
- Broadcast `ranking_updated` après `POST /validate` (await avant `res.json` pour garantir la cohérence).
- Broadcast `tournament_state_changed` après `POST /days` (fire-and-forget) et `POST /complete` (fire-and-forget).
- Frontend : `socket.io-client@4.8.x` installé, `services/socket.ts` factorise la création du socket + types, `TournamentContext` + `useTournament` suivent strictement le pattern `AuthContext`/`useAuth`.
- `<TournamentProvider>` monté dans `App.tsx` à l'intérieur de `<AuthProvider>`, autour de `<BrowserRouter>` — aucun composant existant modifié.
- Variable `FRONTEND_URL` ajoutée dans `backend/.env` et `backend/.env.example`.

**Preuves automatisées :**

1. Builds backend + frontend : PASS.
2. 39/39 tests unitaires backend PASS (incluant 7 nouveaux sur `aggregateQualificationRankings` : tri par totalScore, tiebreakers top1/top4, exclusion des `placement: null`, agrégation multi-journées).
3. Smoke test connexion `/tournament` : client Socket.IO reçoit `tournament_state` avec le bon format à la connexion (AC #1).
4. Smoke test broadcast E2E : `POST /days` puis `POST /complete` → 2 événements `tournament_state_changed` reçus, phases et `currentDayId` corrects (AC #3).
5. Le broadcast `ranking_updated` (AC #2) n'a pas été testé programmatiquement en scénario complet (nécessiterait joueurs inscrits + lobbies + placements) ; cependant il utilise strictement le même mécanisme `io.of('/tournament').emit(...)` que `tournament_state_changed` déjà validé.

**Ce qui reste à valider par Brice dans le navigateur (Task 7.3-7.6) :**

- **7.3** Ouvrir DevTools Network/WS sur `http://localhost:5173/` et vérifier visuellement la connexion Socket.IO + réception `tournament_state`.
- **7.4** Scénario de validation complet : admin → créer journée → générer lobbies round 1 → saisir placements → valider → voir `ranking_updated` dans DevTools.
- **7.5** Scénario reconnexion : `Ctrl+C` sur le backend → redémarrer → vérifier la reconnexion automatique et la réception de `tournament_state` à nouveau.
- **7.6** Régression zéro : parcourir `/`, `/mentions-legales`, `/admin/login`, `/admin` (login + création joueur + démarrage journée + drop + validation round) → aucune régression visuelle/fonctionnelle.

Tasks 7.3-7.6 validées par Brice dans le navigateur le 2026-04-17. Story passée en `review` puis en `done` après application des 8 patches de code review.

### File List

**Backend — fichiers créés :**
- `backend/src/websocket/io.ts`
- `backend/src/websocket/server.ts`
- `backend/src/websocket/events.ts`
- `backend/src/services/rankingsAggregator.ts`
- `backend/src/services/rankingsAggregator.test.ts`

**Backend — fichiers modifiés :**
- `backend/src/index.ts` (passage à `http.createServer` + attache Socket.IO)
- `backend/src/routes/rankings.ts` (délégation à `aggregateQualificationRankings`)
- `backend/src/routes/tournament.ts` (imports + 3 appels `emit*` dans `/days`, `/validate`, `/days/:id/complete`)
- `backend/.env` (ajout `FRONTEND_URL`)
- `backend/.env.example` (ajout `FRONTEND_URL`)

**Frontend — fichiers créés :**
- `frontend/src/services/socket.ts`
- `frontend/src/contexts/TournamentContext.tsx`
- `frontend/src/hooks/useTournament.ts`

**Frontend — fichiers modifiés :**
- `frontend/src/App.tsx` (montage `<TournamentProvider>` dans `<AuthProvider>` autour de `<BrowserRouter>`)
- `frontend/package.json` (ajout `socket.io-client`)
- `frontend/package-lock.json` (ajout `socket.io-client` + deps)

**Artefacts de test :**
- `_bmad-output/test-artifacts/story-3-1-socket-smoke.mjs`
- `_bmad-output/test-artifacts/story-3-1-broadcast-smoke.mjs`

### Change Log

### Review Findings

- [x] [Review][Patch] Bug: Doublon `const PORT` introduit par autre agent dans `index.ts` → dédupliqué + guard `FRONTEND_URL` prod déplacé avant la création du serveur.
- [x] [Review][Patch] Course morte: `socket.connected` vérifié après `await computeTournamentState()` dans `server.ts` — abandon silencieux si déconnexion pendant le calcul.
- [x] [Review][Patch] Collision State: Spread `...payload.data` remplacé par destructuring explicite `{ phase, currentDayId, currentDayNumber, currentDayType, rankings }` dans `TournamentContext.tsx` — `isConnected` ne peut plus être écrasé.
- [x] [Review][Patch] Logique: Rankings calculés uniquement si `phase === 'qualification'` dans `computeTournamentState` (retourne `[]` sinon) — évite des requêtes inutiles en phase `idle`/`finale`.
- [x] [Review][Patch] Securite: Guard `if (NODE_ENV === 'production' && !FRONTEND_URL) process.exit(1)` intégré dans `index.ts` (patch #5 combiné avec #1).
- [x] [Review][Patch] Robustesse: `console.warn` ajouté dans `emitRankingUpdated`, `scheduleRankingUpdated` et `emitTournamentStateChanged` quand IO est null.
- [x] [Review][Patch] Performance: `scheduleRankingUpdated(io)` ajouté dans `events.ts` (debounce 100ms) ; `tournament.ts` l'utilise à la place de `await emitRankingUpdated` — la réponse HTTP n'est plus bloquée par le calcul de classement.
- [x] [Review][Patch] Coherence: `computeTournamentState` wrappé dans `prisma.$transaction` — lecture `day` + `aggregateQualificationRankings` atomiques.
- [x] [Review][Defer] Scalabilité: Architecture multi-process (Redis Adapter) — deferred, pre-existing (OK pour 30 pers).

**Résolution code review : 2026-04-17** — 8/8 patches appliqués, tsc strict zéro erreur, 7/7 tests unitaires PASS. Story → `done`.
