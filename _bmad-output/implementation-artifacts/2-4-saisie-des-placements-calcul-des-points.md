# Story 2.4 : Saisie des Placements & Calcul des Points

Status: done

## Story

As a **admin**,
I want **saisir les placements de chaque joueur et valider le round pour que les points soient calcules automatiquement**,
So that **le classement est mis a jour en moins de 5 minutes apres la fin d'un round**.

## Acceptance Criteria

1. **Given** les lobbies d'un round sont generes **When** je saisis les placements pour un lobby **Then** je peux attribuer un placement (1 a 8) a chaque joueur du lobby **And** la saisie est rapide via dropdown ou clic rapide (UX-DR9) **And** la latence de saisie est inferieure a 200ms

2. **Given** je saisis les placements d'un lobby **When** j'attribue le meme placement a deux joueurs **Then** un message d'erreur m'empeche de valider (chaque placement est unique dans un lobby)

3. **Given** un lobby de 7 joueurs (incomplet) **When** je saisis les placements **Then** seuls les placements 1 a 7 sont disponibles

4. **Given** tous les placements de tous les lobbies sont saisis **When** je clique sur "Valider le round" (gros bouton — UX-DR11) **Then** les points sont calcules automatiquement selon le bareme (1er = 8 pts, 8e = 1 pt) **And** le score cumule de chaque joueur est mis a jour **And** les tiebreakers sont calcules (nombre de top 1, nombre de top 4, resultat derniere game) **And** la moyenne de points par round est calculee pour chaque joueur **And** le round est marque comme valide

5. **Given** je tente de valider un round **When** des placements manquent dans un ou plusieurs lobbies **Then** la validation est bloquee avec un message indiquant les lobbies incomplets

## Tasks / Subtasks

- [x] Task 1 : Service pointsCalculator — calcul des points et tiebreakers (AC: #4)
  - [x] 1.1 Creer `backend/src/services/pointsCalculator.ts`
  - [x] 1.2 Implementer `calculatePoints(placement: number, lobbySize: number): number` — bareme inverse (1er = lobbySize pts, dernier = 1 pt)
  - [x] 1.3 Implementer `calculatePlayerStats(results: PlayerRoundResult[]): PlayerStats` — score total, top1Count, top4Count, lastGameResult, moyenne
  - [x] 1.4 Creer `backend/src/services/pointsCalculator.test.ts` — tests unitaires : bareme 8 joueurs, bareme 7 joueurs, stats avec 1 round, stats avec multiples rounds, tiebreakers

- [x] Task 2 : Route backend — saisie des placements par lobby (AC: #1, #2, #3)
  - [x] 2.1 Ajouter `POST /days/:dayId/rounds/:roundNumber/lobbies/:lobbyId/placements` dans `tournament.ts`
  - [x] 2.2 Valider que le round est en statut "in-progress"
  - [x] 2.3 Valider que le lobby appartient au round
  - [x] 2.4 Valider unicite des placements (pas de doublons)
  - [x] 2.5 Valider que les placements vont de 1 a lobbySize (pas de placement > nombre de joueurs)
  - [x] 2.6 Mettre a jour les champs `placement` et `points` dans LobbyPlayer

- [x] Task 3 : Route backend — validation du round avec calcul des scores (AC: #4, #5)
  - [x] 3.1 Ajouter `POST /days/:dayId/rounds/:roundNumber/validate` dans `tournament.ts`
  - [x] 3.2 Valider que tous les lobbies du round ont tous les placements saisis
  - [x] 3.3 Bloquer la validation si des placements manquent (retourner la liste des lobbies incomplets)
  - [x] 3.4 Passer le round en statut "validated"
  - [x] 3.5 Calculer le score cumule, tiebreakers et moyenne pour chaque joueur et retourner le classement

- [x] Task 4 : Types et fonctions API frontend (AC: #1, #4, #5)
  - [x] 4.1 Ajouter les types `PlacementInput`, `RoundValidationResult`, `PlayerRanking` dans `types/index.ts`
  - [x] 4.2 Ajouter `submitPlacements(token, dayId, roundNumber, lobbyId, placements)` dans `api.ts`
  - [x] 4.3 Ajouter `validateRound(token, dayId, roundNumber)` dans `api.ts`

- [x] Task 5 : Composant PlacementInput — saisie rapide des placements (AC: #1, #2, #3)
  - [x] 5.1 Creer `frontend/src/components/admin/PlacementInput.tsx`
  - [x] 5.2 Afficher la liste des joueurs du lobby avec un dropdown de placement (1 a N) pour chaque joueur
  - [x] 5.3 Marquer en rouge les doublons de placement en temps reel
  - [x] 5.4 Bouton "Enregistrer" par lobby, desactive si doublons ou placements incomplets
  - [x] 5.5 Afficher confirmation visuelle apres sauvegarde reussie

- [x] Task 6 : Integration dans DayManager — etat "saisie des placements" (AC: #1, #4, #5)
  - [x] 6.1 Ajouter un 4e etat dans DayManager : round "in-progress" avec lobbies generes → afficher PlacementInput par lobby
  - [x] 6.2 Afficher le bouton "Valider le round" (gros bouton UX-DR11) uniquement quand tous les lobbies ont leurs placements saisis
  - [x] 6.3 Si placements incomplets a la validation, afficher un message d'erreur listant les lobbies manquants
  - [x] 6.4 Apres validation reussie, recharger les donnees et afficher le classement du round

- [x] Task 7 : Validation (AC: #1-#5)
  - [x] 7.1 `npm run build` passe sans erreur (frontend + backend)
  - [x] 7.2 Tests unitaires pointsCalculator passent
  - [x] 7.3 Tester saisie placements : POST retourne les placements enregistres
  - [x] 7.4 Tester doublon placement : POST retourne erreur 400
  - [x] 7.5 Tester validation round complet : tous les points calcules correctement
  - [x] 7.6 Tester validation round incomplet : erreur avec liste des lobbies manquants
  - [x] 7.7 Tester UI : dropdowns rapides, doublons mis en evidence, bouton valider visible

## Dev Notes

### Architecture & Patterns a suivre

**Service pointsCalculator :**

Emplacement : `backend/src/services/pointsCalculator.ts` [Source: architecture.md#Structure Patterns > Backend]

Le bareme est inversement proportionnel au placement : 1er d'un lobby de N joueurs = N points, dernier = 1 point.

```typescript
// Bareme : placement 1 → lobbySize pts, placement 2 → lobbySize-1 pts, ..., placement N → 1 pt
export function calculatePoints(placement: number, lobbySize: number): number {
  return lobbySize - placement + 1;
}

// Exemples pour un lobby de 8 joueurs :
// 1er = 8 pts, 2e = 7 pts, 3e = 6 pts, 4e = 5 pts, 5e = 4 pts, 6e = 3 pts, 7e = 2 pts, 8e = 1 pt
// Pour un lobby de 7 joueurs :
// 1er = 7 pts, 2e = 6 pts, ..., 7e = 1 pt

// Types pour le calcul des stats
interface PlayerRoundResult {
  placement: number;
  points: number;
  roundId: number;
}

interface PlayerStats {
  totalScore: number;
  top1Count: number;     // nombre de fois placement == 1
  top4Count: number;     // nombre de fois placement <= 4
  lastGameResult: number; // placement du dernier round joue
  roundsPlayed: number;
  average: number;        // totalScore / roundsPlayed (arrondi 2 decimales)
}
```

**IMPORTANT — Tiebreakers (FR13) :**
Les tiebreakers servent a departager les joueurs a egalite de score total. L'ordre de priorite est :
1. Score total (descendant)
2. Nombre de top 1 (descendant)
3. Nombre de top 4 (descendant)
4. Resultat derniere game (ascendant — meilleur placement = plus petit nombre)

**Routes backend — endpoints a creer dans `tournament.ts` :**

```
POST /days/:dayId/rounds/:roundNumber/lobbies/:lobbyId/placements
  Body: { placements: [{ lobbyPlayerId: number, placement: number }] }
  Validations:
    - La journee existe et est "in-progress"
    - Le round existe, appartient a la journee, et est en statut "in-progress"
    - Le lobby existe et appartient au round
    - Chaque lobbyPlayerId existe dans ce lobby
    - Les placements sont uniques (pas de doublons)
    - Les placements vont de 1 a lobbySize
    - Tous les joueurs du lobby sont couverts
  Logique:
    - Mettre a jour LobbyPlayer.placement et LobbyPlayer.points (via calculatePoints) pour chaque joueur
    - Transaction Prisma pour atomicite
  Response 200: { data: { lobby (avec placements mis a jour) } }

POST /days/:dayId/rounds/:roundNumber/validate
  Validations:
    - La journee existe et est "in-progress"
    - Le round existe, appartient a la journee, et est en statut "in-progress"
    - TOUS les LobbyPlayer de TOUS les lobbies du round ont un placement non null
    - Si placements manquants : retourner 400 avec la liste des lobbies incomplets
  Logique:
    - Passer le round en statut "validated"
    - Calculer le classement complet (score cumule de TOUS les rounds valides de TOUTES les journees)
    - Retourner le classement
  Response 200: { data: { round, rankings: PlayerRanking[] } }

  Erreur si placements manquants :
  { error: { code: "INCOMPLETE_PLACEMENTS", message: "...", details: { incompleteLobbyIds: number[] } } }
```

**Calcul du classement a la validation :**

A la validation d'un round, il faut calculer le classement cumule de TOUS les rounds valides (pas seulement le round courant). Cela couvre le classement multi-journees (FR20) des le depart.

```typescript
// Pseudo-code pour le calcul du classement
// 1. Recuperer tous les LobbyPlayer avec placement non null de tous les rounds validated
// 2. Grouper par playerId
// 3. Pour chaque joueur : totalScore, top1Count, top4Count, lastGameResult, roundsPlayed, average
// 4. Trier par score total desc, top1Count desc, top4Count desc, lastGameResult asc
```

**Format de reponse classement :**

```typescript
interface PlayerRanking {
  rank: number;
  playerId: number;
  discordPseudo: string;
  totalScore: number;
  top1Count: number;
  top4Count: number;
  lastGameResult: number;
  roundsPlayed: number;
  average: number;         // arrondi 2 decimales
}
```

### Etat actuel du code (ce qui existe deja)

**Schema Prisma (`backend/prisma/schema.prisma`) :**
- `LobbyPlayer` a deja les champs `placement Int?` et `points Int?` — ils ont ete crees en prevision de cette story dans la story 2.3. **PAS de migration necessaire.**

**Backend :**
- `backend/src/routes/tournament.ts` (182 lignes) : routes POST /days, GET /days/current, POST /days/:dayId/rounds/:roundNumber/generate-lobbies. **Ajouter les 2 nouvelles routes dans ce meme fichier.**
- `backend/src/app.ts` (46 lignes) : Express 5, routes montees, middleware `requireAuth` sur `/api/admin` (ligne 23). Le router tournoi est deja monte (ligne 25). **PAS besoin de modifier app.ts.**
- `backend/src/prisma/client.ts` : instance Prisma partagee. **TOUJOURS utiliser `import prisma from '../prisma/client'`.**
- `backend/src/services/lobbyGenerator.ts` : service existant pour la generation des lobbies.
- `backend/src/services/` : dossier qui contient deja `lobbyGenerator.ts` — creer `pointsCalculator.ts` ici.

**Frontend :**
- `frontend/src/components/admin/DayManager.tsx` (151 lignes) : 3 etats visuels (pas de journee / round pending / round in-progress avec lobbies). **Le 3e etat affiche `<LobbyGrid />` — il faut enrichir cet etat pour y integrer la saisie des placements et le bouton "Valider le round".**
- `frontend/src/components/lobby/LobbyCard.tsx` (25 lignes) : affiche un lobby avec la liste des joueurs (pseudo Discord). **Ce composant affiche les joueurs sans leur placement — PlacementInput sera un composant SEPARE qui remplace ou enrichit LobbyCard dans le contexte de saisie.**
- `frontend/src/components/lobby/LobbyGrid.tsx` : grille responsive des lobbies.
- `frontend/src/services/api.ts` (139 lignes) : fonctions API existantes. Pattern : fetch natif, `Bearer ${token}`, retour `{ data } | { error }`.
- `frontend/src/types/index.ts` (68 lignes) : types existants (Day, Round, Lobby, LobbyPlayerWithPlayer).

**Dependances deja disponibles (NE PAS reinstaller) :**
- Backend : Express 5, Prisma 7, bcryptjs, jsonwebtoken, cors, socket.io
- Frontend : React 19, react-router 7, Tailwind CSS v4

### Guide visuel du composant PlacementInput

**PlacementInput :**
- Emplacement : `frontend/src/components/admin/PlacementInput.tsx`
- Affiche un lobby avec la liste de ses joueurs, chacun accompagne d'un dropdown de placement
- Props : `lobby: Lobby`, `onSaved: () => void`
- Aspect : carte similaire a LobbyCard (fond `bg-white/5 rounded-lg p-4`)
- Titre : "Lobby N" en `font-heading text-eds-cyan`
- Chaque ligne joueur : pseudo Discord + dropdown placement (1 a N ou N = nombre de joueurs du lobby)
- **Dropdown de saisie rapide (UX-DR9)** : element `<select>` natif, compact, avec une option vide par defaut "—"
- **Detection doublons en temps reel** : si deux joueurs ont le meme placement, les deux dropdowns passent en bordure rouge (`border-red-500`) avec un message sous le bouton
- **Bouton "Enregistrer"** par lobby : `bg-eds-cyan text-eds-dark font-heading px-6 py-2 rounded-lg`, desactive (`disabled:opacity-50`) si :
  - Des placements sont manquants
  - Des doublons existent
  - Un enregistrement est en cours
- **Etat apres sauvegarde reussie** : une coche verte ou un badge "Placements enregistres" pour confirmer visuellement
- **Performance** : utiliser `useState` local pour les placements du formulaire — PAS de state management global

**Integration dans DayManager (4e etat) :**
- Quand un round est "in-progress" et a des lobbies, afficher :
  - Titre "Journee X — Round Y — Saisie des placements"
  - Une grille de PlacementInput (un par lobby), meme grille que LobbyGrid
  - Sous la grille, le bouton "Valider le round" (gros bouton `bg-eds-gold text-eds-dark font-heading text-lg px-8 py-4 rounded-lg` — UX-DR11), visible UNIQUEMENT quand tous les lobbies ont leurs placements saisis
  - Si le round est "validated", afficher un message de confirmation avec un resume (nombre de joueurs, points max/min)

### Tailwind v4 — classes disponibles (charte EDS)

Classes personnalisees EDS definies via `@theme` dans `frontend/src/index.css` :
- Fond : `bg-eds-dark` (#29265B)
- Titres : `font-heading text-eds-cyan` ou `text-eds-gold`
- Corps : `font-body text-eds-light`
- Texte secondaire : `text-eds-gray`
- Accents : `text-eds-cyan` (#80E2ED), `text-eds-gold` (#DAB265)
- Bouton action primaire : `bg-eds-cyan text-eds-dark font-heading`
- Bouton validation round : `bg-eds-gold text-eds-dark font-heading` (or pour differencier de l'action lobbies)

NE PAS modifier `index.css`. NE PAS creer de fichier `tailwind.config.ts`.

### Anti-patterns a eviter

- NE PAS creer une nouvelle instance PrismaClient — utiliser `import prisma from '../prisma/client'`
- NE PAS creer un nouveau fichier de routes — ajouter les endpoints dans `tournament.ts` existant
- NE PAS ajouter de middleware auth dans le router — il est deja monte globalement dans app.ts
- NE PAS utiliser `any` en TypeScript — typer correctement
- NE PAS importer depuis `'react-router-dom'` — utiliser `'react-router'`
- NE PAS implementer le systeme suisse — c'est la story 2.5
- NE PAS implementer la gestion des drops — c'est la story 2.6
- NE PAS implementer le WebSocket — c'est la story 3.1
- NE PAS installer de nouvelles dependances
- NE PAS creer de state management global (Context) pour le tournoi — useState local suffit
- NE PAS creer de migration Prisma — les champs `placement` et `points` existent deja dans LobbyPlayer
- NE PAS modifier le schema Prisma
- NE PAS exposer les emails joueurs dans les reponses publiques — le classement retourne uniquement discordPseudo
- NE PAS calculer les stats uniquement sur le round courant — toujours calculer le cumule de tous les rounds valides
- NE PAS retourner les resultats dans un ordre aleatoire — toujours trier par score total desc + tiebreakers

### Previous Story Intelligence (Story 2.3)

**Decisions techniques confirmees :**
- Import `'react-router'` (pas `'react-router-dom'`)
- Express 5 — `app.use()` pour monter les routes
- Instance Prisma partagee dans `backend/src/prisma/client.ts`
- Token JWT dans localStorage cle `auth_token`, passe en parametre aux fonctions API
- Style backoffice : bg-eds-dark, font-heading text-eds-cyan, gros boutons en bg-eds-cyan text-eds-dark
- Error handler global dans app.ts (lignes 32-44) attrape les erreurs non gerees
- Pattern routes tournament.ts : validation params avec `Number()` + `Number.isInteger()` + `> 0`
- Pattern transaction Prisma : `prisma.$transaction(async (tx) => { ... })` pour operations atomiques
- Pattern reponse API : `res.status(201).json({ data: ... })` en succes, `res.status(4xx).json({ error: { code, message } })` en erreur

**Corrections code review appliquees en 2.3 :**
- Min joueurs aligne sur 1 (pas 2)
- Persistance onglets via hash URL
- Promise.allSettled pour robustesse chargement

**Pattern lobbyGenerator comme reference pour pointsCalculator :**
- `lobbyGenerator.ts` exporte une fonction pure, testable unitairement
- `lobbyGenerator.test.ts` co-localise, utilise vitest
- Suivre exactement le meme pattern pour pointsCalculator

### Project Structure Notes

**Nouveaux fichiers a creer :**
- `backend/src/services/pointsCalculator.ts` — service de calcul des points et tiebreakers
- `backend/src/services/pointsCalculator.test.ts` — tests unitaires co-localises
- `frontend/src/components/admin/PlacementInput.tsx` — composant de saisie rapide des placements

**Fichiers a modifier :**
- `backend/src/routes/tournament.ts` — ajouter 2 endpoints (saisie placements + validation round)
- `frontend/src/components/admin/DayManager.tsx` — ajouter le 4e etat visuel (saisie placements + bouton valider)
- `frontend/src/services/api.ts` — ajouter fonctions submitPlacements et validateRound
- `frontend/src/types/index.ts` — ajouter types PlacementInput, PlayerRanking

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4 - Saisie des Placements & Calcul des Points]
- [Source: _bmad-output/planning-artifacts/prd.md#FR10 - Saisie placements]
- [Source: _bmad-output/planning-artifacts/prd.md#FR11 - Calcul automatique points]
- [Source: _bmad-output/planning-artifacts/prd.md#FR12 - Score cumule]
- [Source: _bmad-output/planning-artifacts/prd.md#FR13 - Calcul tiebreakers]
- [Source: _bmad-output/planning-artifacts/prd.md#FR14 - Validation round]
- [Source: _bmad-output/planning-artifacts/prd.md#FR15 - Calcul moyenne]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — LobbyPlayer.placement/points]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns — POST rounds/:id/results, POST rounds/:id/validate]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns — pointsCalculator.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries — seul pointsCalculator calcule les scores]
- [Source: _bmad-output/implementation-artifacts/2-3-demarrer-une-journee-generer-les-lobbies-round-1.md — previous story]
- [Source: backend/prisma/schema.prisma — LobbyPlayer.placement Int?, LobbyPlayer.points Int?]
- [Source: backend/src/routes/tournament.ts — router existant, pattern validation params]
- [Source: backend/src/services/lobbyGenerator.ts — pattern service pur avec tests]
- [Source: backend/src/app.ts — montage middleware requireAuth ligne 23, tournamentRouter ligne 25]
- [Source: frontend/src/components/admin/DayManager.tsx — 3 etats visuels, a enrichir]
- [Source: frontend/src/components/lobby/LobbyCard.tsx — reference visuelle carte lobby]
- [Source: frontend/src/index.css — theme EDS disponible]
- [Source: docs/UX-DESIGN.md — UX-DR9 saisie rapide, UX-DR11 gros boutons]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

Aucun probleme rencontre.

### Completion Notes List

- Task 1 : Service `pointsCalculator.ts` cree avec `calculatePoints()` (bareme inverse) et `calculatePlayerStats()` (score total, top1/top4, lastGameResult, moyenne). 15 tests unitaires passent.
- Task 2 : Route `POST /days/:dayId/rounds/:roundNumber/lobbies/:lobbyId/placements` ajoutee dans `tournament.ts`. Validations completes : params, existence jour/round/lobby, appartenance joueurs, unicite placements, range 1-N. Transaction Prisma pour atomicite.
- Task 3 : Route `POST /days/:dayId/rounds/:roundNumber/validate` ajoutee. Verifie placements complets, passe le round en "validated", calcule le classement cumule multi-journees avec tiebreakers (score desc, top1 desc, top4 desc, lastGame asc).
- Task 4 : Types `PlacementInput`, `PlayerRanking`, `RoundValidationResult` ajoutes. Fonctions `submitPlacements()` et `validateRound()` ajoutees dans `api.ts`.
- Task 5 : Composant `PlacementInput.tsx` cree. Dropdown natif par joueur, detection doublons en temps reel (bordure rouge), bouton "Enregistrer" desactive si incomplet/doublons, confirmation visuelle apres sauvegarde.
- Task 6 : `DayManager.tsx` enrichi avec le 4e etat visuel (saisie placements + bouton "Valider le round" en or). Le bouton n'apparait que quand tous les placements sont saisis. Apres validation, affichage du message de confirmation.
- Task 7 : `npm run build` passe sans erreur (frontend + backend). 22 tests unitaires passent (lobbyGenerator + pointsCalculator).

### Change Log

- 2026-04-16 : Implementation complete de la story 2.4 — saisie placements, calcul points, validation round, classement cumule avec tiebreakers

### File List

**Nouveaux fichiers :**
- `backend/src/services/pointsCalculator.ts`
- `backend/src/services/pointsCalculator.test.ts`
- `frontend/src/components/admin/PlacementInput.tsx`

**Fichiers modifies :**
- `backend/src/routes/tournament.ts`
- `frontend/src/types/index.ts`
- `frontend/src/services/api.ts`
- `frontend/src/components/admin/DayManager.tsx`
