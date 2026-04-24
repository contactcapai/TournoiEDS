# Story 2.3 : Demarrer une Journee & Generer les Lobbies (Round 1)

Status: done

## Story

As a **admin**,
I want **demarrer une journee de qualification et generer les lobbies du Round 1 aleatoirement**,
So that **les joueurs sont repartis en lobbies et peuvent commencer a jouer**.

## Acceptance Criteria

1. **Given** je suis sur le backoffice avec des joueurs inscrits **When** je clique sur "Demarrer la journee" **Then** une nouvelle journee de qualification est creee (Day) **And** le premier round est initialise

2. **Given** une journee est demarree avec 28 joueurs actifs **When** je clique sur "Generer les lobbies" **Then** les joueurs sont repartis aleatoirement en lobbies de 8 maximum **And** le systeme cree 3 lobbies de 8 et 1 lobby de 4

3. **Given** 32 joueurs actifs (multiple de 8) **When** je genere les lobbies **Then** 4 lobbies de 8 joueurs sont crees sans lobby incomplet

4. **Given** 15 joueurs actifs **When** je genere les lobbies **Then** le systeme cree 1 lobby de 8 et 1 lobby de 7 **And** aucun lobby n'a moins de joueurs que necessaire

5. **Given** les lobbies sont generes **When** je consulte le round **Then** je vois la composition de chaque lobby (numeros de lobby + liste des joueurs) **And** la vue d'ensemble affiche tous les lobbies d'un coup (UX-DR10) **And** le bouton "Generer les lobbies" est un gros bouton bien visible (UX-DR11)

## Tasks / Subtasks

- [x] Task 1 : Migration Prisma — ajouter les modeles Day, Round, Lobby et LobbyPlayer (AC: #1, #2)
  - [x] 1.1 Ajouter le modele `Day` dans `schema.prisma` (id, number, type, status, createdAt)
  - [x] 1.2 Ajouter le modele `Round` dans `schema.prisma` (id, number, dayId, status, createdAt)
  - [x] 1.3 Ajouter le modele `Lobby` dans `schema.prisma` (id, number, roundId)
  - [x] 1.4 Ajouter le modele `LobbyPlayer` dans `schema.prisma` (id, lobbyId, playerId) — table de jointure lobby-joueur
  - [x] 1.5 Ajouter les relations Player ↔ LobbyPlayer, Lobby ↔ LobbyPlayer, Round ↔ Lobby, Day ↔ Round
  - [x] 1.6 Executer `npx prisma migrate dev --name add-tournament-models`
  - [x] 1.7 Verifier que le client Prisma est regenere et les types disponibles

- [x] Task 2 : Service lobbyGenerator — generation aleatoire des lobbies (AC: #2, #3, #4)
  - [x] 2.1 Creer `backend/src/services/lobbyGenerator.ts`
  - [x] 2.2 Implementer `generateRandomLobbies(playerIds: number[]): number[][]` — shuffle aleatoire puis repartition en groupes de 8 max
  - [x] 2.3 Gerer le cas de lobby incomplet : le dernier lobby recoit le reste des joueurs (ex: 28 joueurs → 8+8+8+4)
  - [x] 2.4 Creer `backend/src/services/lobbyGenerator.test.ts` avec tests unitaires : 32 joueurs (4×8), 28 joueurs (3×8+4), 15 joueurs (8+7), 8 joueurs (1×8), 1 joueur (1×1)

- [x] Task 3 : Routes admin backend — demarrage journee et generation lobbies (AC: #1, #2, #5)
  - [x] 3.1 Creer `backend/src/routes/tournament.ts` avec le router admin tournoi
  - [x] 3.2 `POST /days` — creer une nouvelle journee de qualification (valider qu'aucune journee n'est deja "in-progress", max 3 journees de qualification)
  - [x] 3.3 `GET /days/current` — retourner la journee en cours avec ses rounds et lobbies
  - [x] 3.4 `POST /days/:dayId/rounds/:roundNumber/generate-lobbies` — generer les lobbies aleatoirement pour le Round 1
  - [x] 3.5 Enregistrer le router tournoi dans `app.ts` sous `/api/admin`

- [x] Task 4 : Types et fonctions API frontend (AC: #1, #2, #5)
  - [x] 4.1 Ajouter les types `Day`, `Round`, `Lobby`, `LobbyPlayer` dans `frontend/src/types/index.ts`
  - [x] 4.2 Ajouter les fonctions API : `startDay()`, `getCurrentDay()`, `generateLobbies()`

- [x] Task 5 : Composant DayManager — interface de gestion de journee (AC: #1, #5)
  - [x] 5.1 Creer `frontend/src/components/admin/DayManager.tsx`
  - [x] 5.2 Etat "pas de journee active" : afficher le bouton "Demarrer la journee" (gros bouton UX-DR11)
  - [x] 5.3 Etat "journee active sans lobbies" : afficher le nombre de joueurs actifs et le bouton "Generer les lobbies" (gros bouton UX-DR11)
  - [x] 5.4 Etat "lobbies generes" : afficher la vue d'ensemble de tous les lobbies (UX-DR10)

- [x] Task 6 : Composants LobbyCard et LobbyGrid — affichage des lobbies (AC: #5)
  - [x] 6.1 Creer `frontend/src/components/lobby/LobbyCard.tsx` — carte affichant un lobby avec son numero et la liste des joueurs
  - [x] 6.2 Creer `frontend/src/components/lobby/LobbyGrid.tsx` — grille affichant tous les lobbies d'un round

- [x] Task 7 : Integration dans la page Admin (AC: #1, #5)
  - [x] 7.1 Ajouter DayManager dans `Admin.tsx` en dessous de PlayerManager
  - [x] 7.2 Creer une navigation par onglets ou sections dans le backoffice (Joueurs / Tournoi)

- [x] Task 8 : Validation (AC: #1-#5)
  - [x] 8.1 `npm run build` passe sans erreur (frontend + backend)
  - [x] 8.2 Tester demarrer une journee : POST /api/admin/days retourne la journee creee
  - [x] 8.3 Tester generer les lobbies avec N joueurs : lobbies corrects (8 max par lobby)
  - [x] 8.4 Tester l'UI : boutons visibles, lobbies affiches, vue d'ensemble complete
  - [x] 8.5 Tester qu'on ne peut pas demarrer une 2e journee si une est deja en cours

## Dev Notes

### Architecture & Patterns a suivre

**Schema Prisma — Nouveaux modeles :**

Le schema actuel (`backend/prisma/schema.prisma`) contient uniquement `Player` et `Admin`. Il faut ajouter les entites du moteur de tournoi. Voici le schema a ajouter :

```prisma
model Day {
  id        Int      @id @default(autoincrement())
  number    Int
  type      String   @default("qualification")  // "qualification" ou "finale"
  status    String   @default("in-progress")     // "in-progress" ou "completed"
  createdAt DateTime @default(now())
  rounds    Round[]

  @@unique([number, type])
}

model Round {
  id        Int      @id @default(autoincrement())
  number    Int
  dayId     Int
  status    String   @default("pending")  // "pending", "in-progress", "validated"
  createdAt DateTime @default(now())
  day       Day      @relation(fields: [dayId], references: [id])
  lobbies   Lobby[]

  @@unique([dayId, number])
}

model Lobby {
  id      Int           @id @default(autoincrement())
  number  Int
  roundId Int
  round   Round         @relation(fields: [roundId], references: [id])
  players LobbyPlayer[]

  @@unique([roundId, number])
}

model LobbyPlayer {
  id        Int    @id @default(autoincrement())
  lobbyId   Int
  playerId  Int
  placement Int?   // null tant que non saisi, 1-8 apres saisie (story 2.4)
  points    Int?   // null tant que non calcule (story 2.4)
  lobby     Lobby  @relation(fields: [lobbyId], references: [id])
  player    Player @relation(fields: [playerId], references: [id])

  @@unique([lobbyId, playerId])
}
```

**IMPORTANT :** Ajouter aussi la relation inverse dans le modele `Player` existant :
```prisma
model Player {
  // ... champs existants
  lobbyPlayers LobbyPlayer[]
}
```

Les champs `placement` et `points` dans `LobbyPlayer` sont `null` a ce stade — ils seront remplis par la story 2.4 (saisie des placements). Les inclure maintenant evite une migration supplementaire.

**Rationale choix de conception :**
- `LobbyPlayer` comme table de jointure plutot que `playerId[]` sur Lobby : permet d'y stocker le placement et les points par joueur par lobby, ce qui est le coeur du systeme de scoring.
- `Day.number` + `Day.type` unique : empeche de creer deux journees avec le meme numero.
- `Round.dayId` + `Round.number` unique : empeche de creer deux rounds avec le meme numero dans une journee.
- `Lobby.roundId` + `Lobby.number` unique : empeche de creer deux lobbies avec le meme numero dans un round.

**Service lobbyGenerator :**
- Emplacement : `backend/src/services/lobbyGenerator.ts` [Source: architecture.md#Structure Patterns > Backend]
- Algorithme Round 1 : Fisher-Yates shuffle sur le tableau de player IDs, puis decoupe en groupes de 8.
- Le dernier groupe contient le reste (ex: 28 joueurs → groupes de [8, 8, 8, 4]).
- Retourne un `number[][]` (tableau de tableaux d'IDs joueurs).
- NE PAS implementer le systeme suisse ici — c'est la story 2.5.

```typescript
// Signature attendue
export function generateRandomLobbies(playerIds: number[]): number[][] {
  // 1. Copier et shuffle (Fisher-Yates)
  // 2. Decouper en groupes de 8
  // 3. Retourner les groupes
}
```

**Routes admin tournoi :**
- Creer un NOUVEAU fichier `backend/src/routes/tournament.ts` — NE PAS ajouter les routes tournoi dans `admin.ts` qui est dedie a la gestion des joueurs.
- Le router est monte sous `/api/admin` dans `app.ts`, donc les chemins sont relatifs : `/days`, `/days/current`, `/days/:dayId/rounds/:roundNumber/generate-lobbies`.
- Le middleware `requireAuth` est deja monte globalement sur `/api/admin` dans `app.ts` (ligne 22) — PAS besoin de l'ajouter dans le router.
- Format de reponse : `{ data: {...} }` en succes, `{ error: { code, message } }` en erreur.
- Utiliser l'instance Prisma partagee : `import prisma from '../prisma/client'`.

**Endpoints a creer :**

```
POST /days
  Body: (rien — le numero est auto-incremente)
  Validations:
    - Aucune journee en statut "in-progress" (sinon 409 DAY_ALREADY_IN_PROGRESS)
    - Maximum 3 journees de qualification (sinon 400 MAX_DAYS_REACHED)
  Logique:
    - Compter les journees de type "qualification" existantes
    - Creer la journee avec number = count + 1, type = "qualification"
    - Creer automatiquement le Round 1 (number: 1, status: "pending")
  Response 201: { data: { day (avec rounds inclus) } }

GET /days/current
  Retourne la journee en statut "in-progress" avec ses rounds et lobbies
  Response 200: { data: { day } } ou { data: null } si aucune journee active
  Include Prisma: { rounds: { include: { lobbies: { include: { players: { include: { player: true } } } } } } }

POST /days/:dayId/rounds/:roundNumber/generate-lobbies
  Validations:
    - La journee existe et est "in-progress"
    - Le round existe, appartient a la journee, et est en statut "pending"
    - Le round n'a pas deja des lobbies (sinon 409 LOBBIES_ALREADY_GENERATED)
    - Il y a au moins 2 joueurs actifs (statut "inscrit")
  Logique:
    - Recuperer tous les joueurs avec status "inscrit"
    - Appeler lobbyGenerator.generateRandomLobbies(playerIds)
    - Creer les lobbies + LobbyPlayer en base (transaction Prisma)
    - Passer le round en statut "in-progress"
  Response 201: { data: { round (avec lobbies et joueurs) } }
```

**Montage dans app.ts :**
```typescript
import tournamentRouter from "./routes/tournament";
// ...
app.use("/api/admin", tournamentRouter);  // ajouter APRES les lignes existantes
```

### Etat actuel du code (ce qui existe deja)

**Backend :**
- `backend/src/app.ts` : Express 5, CORS, JSON, routes auth/players/admin. Middleware `requireAuth` monte sur `/api/admin` (ligne 22). Error handler global (lignes 30-42).
- `backend/src/routes/admin.ts` (179 lignes) : GET/POST/PATCH `/players` pour gestion des joueurs. Utilise `import prisma from '../prisma/client'`.
- `backend/src/prisma/client.ts` : instance Prisma partagee (adapter PG). **TOUJOURS utiliser `import prisma from '../prisma/client'`**.
- `backend/src/middleware/auth.ts` : middleware JWT, decore `req.admin`.
- `backend/src/validation/player.ts` : validation des champs joueur.
- `backend/prisma/schema.prisma` : modeles `Player` (id, discordPseudo unique, riotPseudo, email, status default "inscrit", createdAt) et `Admin`.
- `backend/src/services/` : dossier vide (`.gitkeep`) — premier service a creer ici.
- `backend/src/websocket/` : dossier vide (`.gitkeep`) — PAS besoin de WebSocket dans cette story.

**Frontend :**
- `frontend/src/pages/Admin.tsx` (28 lignes) : titre "Backoffice Admin", bouton deconnexion, `<PlayerManager />`.
- `frontend/src/components/admin/PlayerManager.tsx` (367 lignes) : tableau joueurs, ajout, edition inline, filtre actifs/absents.
- `frontend/src/components/admin/ProtectedRoute.tsx` : garde d'authentification.
- `frontend/src/services/api.ts` (94 lignes) : `registerPlayer()`, `loginAdmin()`, `getAdminPlayers()`, `addAdminPlayer()`, `updatePlayer()`. Pattern : fetch natif, `Bearer ${token}`, retour `{ data } | { error }`.
- `frontend/src/types/index.ts` (35 lignes) : `RegisterPlayerInput`, `Player`, `LoginInput`, `LoginResponse`, `ApiError`.
- `frontend/src/hooks/useAuth.ts` : hook pour AuthContext (expose `token`).
- `frontend/src/contexts/AuthContext.tsx` : expose `token`, `isAuthenticated`, `login()`, `logout()`.

**Dependances deja disponibles (NE PAS reinstaller) :**
- Backend : Express 5, Prisma 7, bcryptjs, jsonwebtoken, cors, socket.io
- Frontend : React 19, react-router 7, Tailwind CSS v4

### Types a ajouter cote frontend

```typescript
export interface Day {
  id: number;
  number: number;
  type: 'qualification' | 'finale';
  status: 'in-progress' | 'completed';
  createdAt: string;
  rounds: Round[];
}

export interface Round {
  id: number;
  number: number;
  dayId: number;
  status: 'pending' | 'in-progress' | 'validated';
  createdAt: string;
  lobbies: Lobby[];
}

export interface Lobby {
  id: number;
  number: number;
  roundId: number;
  players: LobbyPlayerWithPlayer[];
}

export interface LobbyPlayerWithPlayer {
  id: number;
  lobbyId: number;
  playerId: number;
  placement: number | null;
  points: number | null;
  player: Player;
}
```

### Fonctions API admin a ajouter

```typescript
export async function startDay(
  token: string
): Promise<{ data: Day } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/days`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Day };
}

export async function getCurrentDay(
  token: string
): Promise<{ data: Day | null } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/days/current`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Day | null };
}

export async function generateLobbies(
  token: string,
  dayId: number,
  roundNumber: number
): Promise<{ data: Round } | { error: ApiError }> {
  const response = await fetch(
    `${API_URL}/api/admin/days/${dayId}/rounds/${roundNumber}/generate-lobbies`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Round };
}
```

### Guide visuel des composants

**DayManager :**
- Emplacement : `frontend/src/components/admin/DayManager.tsx`
- 3 etats visuels :
  1. **Pas de journee active** : message "Aucune journee en cours" + bouton "Demarrer la journee de qualification" (`bg-eds-cyan text-eds-dark font-heading text-lg px-8 py-4 rounded-lg` — gros bouton UX-DR11)
  2. **Journee active, round en attente** : titre "Journee X — Round Y", nombre de joueurs actifs, bouton "Generer les lobbies" (meme style gros bouton)
  3. **Lobbies generes** : titre "Journee X — Round Y", `<LobbyGrid />` avec tous les lobbies

**LobbyCard :**
- Emplacement : `frontend/src/components/lobby/LobbyCard.tsx`
- Affiche : "Lobby N" en titre, liste des joueurs (pseudo Discord), nombre de joueurs
- Style : carte avec `bg-white/5 rounded-lg p-4`, titre en `text-eds-cyan font-heading`, joueurs en `text-eds-light font-body`

**LobbyGrid :**
- Emplacement : `frontend/src/components/lobby/LobbyGrid.tsx`
- Grille responsive : `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`
- Affiche toutes les LobbyCard d'un round cote a cote (UX-DR10 — vue d'ensemble)

**Navigation backoffice :**
- Ajouter des onglets ou sections dans Admin.tsx : "Joueurs" (PlayerManager) et "Tournoi" (DayManager)
- Onglets : `border-b border-eds-gray/20`, onglet actif en `text-eds-cyan border-eds-cyan`, inactif en `text-eds-gray`
- OU sections empilees avec titres de section

### Tailwind v4 — classes disponibles (charte EDS)

Classes personnalisees EDS definies via `@theme` dans `frontend/src/index.css` :
- Fond : `bg-eds-dark` (#29265B)
- Titres : `font-heading text-eds-cyan` ou `text-eds-gold`
- Corps : `font-body text-eds-light`
- Texte secondaire : `text-eds-gray`
- Accents : `text-eds-cyan` (#80E2ED), `text-eds-gold` (#DAB265)

NE PAS modifier `index.css`. NE PAS creer de fichier `tailwind.config.ts`.

### Anti-patterns a eviter

- NE PAS creer une nouvelle instance PrismaClient — utiliser `import prisma from '../prisma/client'`
- NE PAS ajouter les routes tournoi dans `admin.ts` — creer un fichier `tournament.ts` dedie
- NE PAS ajouter de middleware auth dans le router tournoi — il est deja monte globalement dans app.ts
- NE PAS utiliser `any` en TypeScript — typer correctement
- NE PAS importer depuis `'react-router-dom'` — utiliser `'react-router'`
- NE PAS implementer le systeme suisse — c'est la story 2.5
- NE PAS implementer la saisie des placements — c'est la story 2.4
- NE PAS implementer le WebSocket — c'est la story 3.1
- NE PAS implementer la gestion des drops — c'est la story 2.6
- NE PAS installer de nouvelles dependances
- NE PAS creer de state management global (Context) pour le tournoi — useState local dans DayManager suffit pour l'instant
- NE PAS permettre de demarrer plus de 3 journees de qualification
- NE PAS permettre de generer des lobbies si une journee n'est pas "in-progress"

### Previous Story Intelligence (Story 2.2)

**Decisions techniques confirmees :**
- Import `'react-router'` (pas `'react-router-dom'`)
- Express 5 — `app.use()` pour monter les routes
- Instance Prisma partagee dans `backend/src/prisma/client.ts`
- Token JWT dans localStorage cle `auth_token`, passe en parametre aux fonctions API
- Style backoffice : bg-eds-dark, font-heading text-eds-cyan, gros boutons en bg-eds-cyan text-eds-dark
- Validation partagee extraite dans `backend/src/validation/player.ts`
- Error handler global dans app.ts (lignes 30-42) attrape les erreurs non gerees
- Pattern PATCH admin.ts : validation ID avec `Number()` + `Number.isInteger()` + `> 0`

**Corrections code review appliquees en 2.2 :**
- Extraction validation partagee (`validation/player.ts`)
- Error handler global dans app.ts pour eviter l'exposition de stack traces
- Try/catch dans les handlers frontend
- Loading state individuel pour les actions (retrait joueur)
- PATCH etendu pour modifier infos joueur (pas seulement statut)

**Fichiers crees/modifies en 2.2 :**
- `backend/src/routes/admin.ts` (nouveau — 179 lignes)
- `backend/src/validation/player.ts` (nouveau — validation partagee)
- `backend/src/routes/players.ts` (modifie — utilise validation partagee)
- `backend/src/app.ts` (modifie — import adminRouter + error handler global)
- `frontend/src/types/index.ts` (modifie — ajout type Player)
- `frontend/src/services/api.ts` (modifie — ajout fonctions admin)
- `frontend/src/components/admin/PlayerManager.tsx` (nouveau — 367 lignes)
- `frontend/src/pages/Admin.tsx` (modifie — integration PlayerManager)

### Project Structure Notes

**Nouveaux fichiers a creer :**
- `backend/prisma/migrations/[timestamp]_add_tournament_models/migration.sql` — migration auto-generee par Prisma
- `backend/src/services/lobbyGenerator.ts` — service de generation des lobbies [Source: architecture.md#Structure Patterns > Backend]
- `backend/src/services/lobbyGenerator.test.ts` — tests unitaires co-localises [Source: architecture.md#Process Patterns]
- `backend/src/routes/tournament.ts` — routes admin tournoi [Source: architecture.md#Structure Patterns > Backend]
- `frontend/src/components/admin/DayManager.tsx` — interface gestion de journee [Source: architecture.md#Structure Patterns > Frontend]
- `frontend/src/components/lobby/LobbyCard.tsx` — carte de lobby [Source: architecture.md#Structure Patterns > Frontend]
- `frontend/src/components/lobby/LobbyGrid.tsx` — grille de lobbies [Source: architecture.md#Structure Patterns > Frontend]

**Fichiers a modifier :**
- `backend/prisma/schema.prisma` — ajouter modeles Day, Round, Lobby, LobbyPlayer + relation inverse Player
- `backend/src/app.ts` — ajouter import et montage du router tournoi
- `frontend/src/pages/Admin.tsx` — ajouter DayManager et navigation onglets/sections
- `frontend/src/services/api.ts` — ajouter les fonctions startDay, getCurrentDay, generateLobbies
- `frontend/src/types/index.ts` — ajouter les types Day, Round, Lobby, LobbyPlayerWithPlayer

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3 - Demarrer une Journee & Generer les Lobbies]
- [Source: _bmad-output/planning-artifacts/prd.md#FR6 - Repartition aleatoire lobbies Round 1]
- [Source: _bmad-output/planning-artifacts/prd.md#FR8 - Gestion lobbies incomplets]
- [Source: _bmad-output/planning-artifacts/prd.md#FR9 - Visualisation composition lobbies]
- [Source: _bmad-output/planning-artifacts/prd.md#FR16 - Demarrer journee qualification]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — modele de donnees]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns — routes admin]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns — arborescence backend/frontend]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries]
- [Source: _bmad-output/implementation-artifacts/2-2-gestion-des-joueurs-inscrits.md — previous story]
- [Source: backend/src/app.ts — montage middleware requireAuth ligne 22]
- [Source: backend/src/prisma/client.ts — instance Prisma partagee]
- [Source: backend/src/routes/admin.ts — pattern routes admin existant]
- [Source: frontend/src/services/api.ts — pattern fonctions API]
- [Source: frontend/src/types/index.ts — types existants]
- [Source: docs/UX-DESIGN.md — UX-DR10 vue d'ensemble, UX-DR11 gros boutons]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fix variable inutilisee `displayRound` dans DayManager.tsx (erreur TS6133 au build)

### Completion Notes List

- Task 1 : Migration Prisma executee avec succes — modeles Day, Round, Lobby, LobbyPlayer ajoutes avec toutes les relations et contraintes d'unicite
- Task 2 : Service lobbyGenerator implemente avec Fisher-Yates shuffle, 7 tests unitaires passent (32, 28, 15, 8, 1 joueurs + shuffle randomness + no duplicates)
- Task 3 : Router tournament.ts cree avec POST /days, GET /days/current, POST /days/:dayId/rounds/:roundNumber/generate-lobbies. Validations: journee deja en cours (409), max 3 jours (400), round pending (409), min 1 joueur (400). Transaction Prisma pour creation lobbies.
- Task 4 : Types Day, Round, Lobby, LobbyPlayerWithPlayer ajoutes. Fonctions API startDay, getCurrentDay, generateLobbies ajoutees.
- Task 5 : DayManager avec 3 etats visuels (pas de journee / journee sans lobbies / lobbies generes), gros boutons EDS, loading states, gestion erreurs.
- Task 6 : LobbyCard (carte avec pseudo Discord) et LobbyGrid (grille responsive 1-4 colonnes) crees.
- Task 7 : Navigation par onglets (Joueurs / Tournoi) integree dans Admin.tsx.
- Task 8 : Backend build OK, frontend build OK (apres fix variable inutilisee), 7/7 tests unitaires passent.

### Change Log

- 2026-04-16 : Implementation complete story 2.3 — modeles de donnees tournoi, service de generation de lobbies, routes admin tournoi, composants frontend DayManager/LobbyCard/LobbyGrid, navigation onglets backoffice
- 2026-04-16 : Code review — 3 patches appliques : min joueurs aligne sur 1, persistance onglets via hash URL, Promise.allSettled pour robustesse chargement
- 2026-04-16 : Tests manuels OK — story validee et passee en done

### File List

**Nouveaux fichiers :**
- `backend/prisma/migrations/20260416105911_add_tournament_models/migration.sql`
- `backend/src/services/lobbyGenerator.ts`
- `backend/src/services/lobbyGenerator.test.ts`
- `backend/src/routes/tournament.ts`
- `frontend/src/components/admin/DayManager.tsx`
- `frontend/src/components/lobby/LobbyCard.tsx`
- `frontend/src/components/lobby/LobbyGrid.tsx`

**Fichiers modifies :**
- `backend/prisma/schema.prisma` — ajout modeles Day, Round, Lobby, LobbyPlayer + relation inverse Player.lobbyPlayers
- `backend/src/app.ts` — import et montage tournamentRouter
- `frontend/src/types/index.ts` — ajout types Day, Round, Lobby, LobbyPlayerWithPlayer
- `frontend/src/services/api.ts` — ajout fonctions startDay, getCurrentDay, generateLobbies
- `frontend/src/pages/Admin.tsx` — navigation onglets + DayManager

### Review Findings

#### 🕵️ Layer Findings
- **Blind Hunter** : 6 findings (Logic, UX, Structure)
- **Edge Case Hunter** : 5 findings (Robustness, Boundaries)
- **Acceptance Auditor** : 1 finding (AC Violation)
- **Total Triaged** : 3 patches, 7 dismissed as noise/minor.

#### 📋 Action Items
- [x] [Review][Patch] Contradiction nb joueurs min (bloque à < 2 alors que 1 est supporté) [backend/src/routes/tournament.ts:135]
- [x] [Review][Patch] Non-persistance des onglets (navigation backoffice via URL) [frontend/src/pages/Admin.tsx]
- [x] [Review][Patch] Robustesse chargement données (Promise.all vs individual error handling) [frontend/src/components/admin/DayManager.tsx:24]
