# Story 2.5 : Systeme Suisse & Rounds Suivants

Status: done

## Story

As a **admin**,
I want **generer les lobbies des rounds suivants selon le classement (systeme suisse) et enchainer jusqu'a 6 rounds**,
So that **les joueurs de niveau similaire s'affrontent progressivement, comme dans l'ancien Excel**.

## Acceptance Criteria

1. **Given** le round 1 est valide et le classement est calcule **When** je clique sur "Generer les lobbies" pour le Round 2 **Then** les joueurs sont redistribues selon le systeme suisse : les mieux classes ensemble, les moins bien classes ensemble **And** les lobbies respectent la taille maximale de 8 joueurs

2. **Given** le classement apres un round est : J1 (24pts), J2 (22pts), ..., J16 (5pts) **When** je genere les lobbies suisse **Then** le lobby 1 contient les joueurs classes 1 a 8 **And** le lobby 2 contient les joueurs classes 9 a 16

3. **Given** un nombre de joueurs non multiple de 8 (ex: 27) **When** je genere les lobbies suisse **Then** le dernier lobby est incomplet (ex: 3 joueurs) **And** les joueurs les moins bien classes sont dans le lobby incomplet

4. **Given** je suis au round 6 d'une journee **When** je valide le round 6 **Then** aucun bouton "Generer les lobbies" n'apparait pour un round 7 **And** un message indique que la journee est terminee (maximum 6 rounds)

5. **Given** je suis au round 3 **When** je genere les lobbies du round 4 **Then** la redistribution utilise le classement cumule de tous les rounds precedents de la journee

## Tasks / Subtasks

- [x] Task 1 : Service swissSystem — algorithme du systeme suisse (AC: #1, #2, #3)
  - [x] 1.1 Creer `backend/src/services/swissSystem.ts`
  - [x] 1.2 Implementer `generateSwissLobbies(rankedPlayerIds: number[]): number[][]` — regroupe les joueurs par tranches de 8 selon leur classement, le dernier groupe pouvant etre incomplet
  - [x] 1.3 Creer `backend/src/services/swissSystem.test.ts` — tests unitaires : 32 joueurs (4x8), 28 joueurs (3x8+1x4), 16 joueurs (2x8), 15 joueurs (1x8+1x7), 8 joueurs (1x8), 3 joueurs (1x3), verifier que l'ordre de classement est respecte dans chaque lobby

- [x] Task 2 : Route backend — generer les lobbies avec logique conditionnelle random/suisse (AC: #1, #2, #3, #5)
  - [x] 2.1 Modifier `POST /days/:dayId/rounds/:roundNumber/generate-lobbies` dans `tournament.ts`
  - [x] 2.2 Si `roundNumber === 1` : conserver la logique actuelle (`generateRandomLobbies`)
  - [x] 2.3 Si `roundNumber > 1` : calculer le classement cumule de tous les rounds valides de la journee (meme logique que dans `/validate`), puis extraire les playerIds tries par rang, puis appeler `generateSwissLobbies(rankedPlayerIds)`
  - [x] 2.4 Verifier que le round precedent (roundNumber - 1) est bien en statut "validated" avant de generer les lobbies du round suivant

- [x] Task 3 : Route backend — limiter a 6 rounds par journee (AC: #4)
  - [x] 3.1 Dans `POST /days/:dayId/rounds/:roundNumber/generate-lobbies`, bloquer la generation si `roundNumber > 6`
  - [x] 3.2 Retourner une erreur 400 avec `{ error: { code: "MAX_ROUNDS_REACHED", message: "Maximum 6 rounds par journee" } }` si on tente de generer un round 7+

- [x] Task 4 : Frontend — afficher limite de rounds et message de fin de journee (AC: #4)
  - [x] 4.1 Dans `DayManager.tsx`, masquer le bouton "Generer les lobbies" apres validation du round 6
  - [x] 4.2 Afficher un message "Journee terminee — 6 rounds joues" a la place du bouton
  - [x] 4.3 Optionnel : afficher le numero de round courant dans le titre ("Journee X — Round Y/6")

- [x] Task 5 : Validation (AC: #1-#5)
  - [x] 5.1 `npm run build` passe sans erreur (frontend + backend)
  - [x] 5.2 Tests unitaires swissSystem passent
  - [x] 5.3 Tests existants (lobbyGenerator + pointsCalculator) passent toujours (pas de regression)
  - [x] 5.4 Tester round 1 : lobbies generes aleatoirement (comportement inchange)
  - [x] 5.5 Tester round 2+ : lobbies generes selon classement (joueurs tries par rang)
  - [x] 5.6 Tester round 7 : erreur 400 retournee
  - [x] 5.7 Tester UI : bouton masque apres round 6, message de fin de journee affiche

## Dev Notes

### Architecture & Patterns a suivre

**Service swissSystem — algorithme :**

Emplacement : `backend/src/services/swissSystem.ts` [Source: architecture.md#Structure Patterns > Backend > services/swissSystem.ts]

L'algorithme du systeme suisse pour TFT est simple : regrouper les joueurs par tranches selon leur classement. Les meilleurs ensemble, les moins bons ensemble. Le dernier lobby peut etre incomplet.

```typescript
// swissSystem.ts
const LOBBY_SIZE = 8;

export function generateSwissLobbies(rankedPlayerIds: number[]): number[][] {
  // rankedPlayerIds est DEJA trie par classement (1er = index 0, dernier = index N-1)
  // Decouper en tranches de LOBBY_SIZE
  const lobbies: number[][] = [];
  for (let i = 0; i < rankedPlayerIds.length; i += LOBBY_SIZE) {
    lobbies.push(rankedPlayerIds.slice(i, i + LOBBY_SIZE));
  }
  return lobbies;
}
```

**IMPORTANT — Difference avec lobbyGenerator :**
- `lobbyGenerator.generateRandomLobbies(playerIds)` : melange aleatoirement PUIS decoupe → utilise pour Round 1 uniquement
- `swissSystem.generateSwissLobbies(rankedPlayerIds)` : decoupe directement dans l'ordre du classement → utilise pour Rounds 2+
- Les deux retournent le meme format `number[][]` (tableau de lobbies, chaque lobby = tableau de playerIds)

**Modification de la route generate-lobbies dans tournament.ts :**

Le point d'integration est dans `POST /days/:dayId/rounds/:roundNumber/generate-lobbies` (actuellement ligne ~144 dans `tournament.ts`).

```typescript
// AVANT (Round 1 uniquement) :
const lobbyGroups = generateRandomLobbies(playerIds);

// APRES (Round 1 random, Round 2+ suisse) :
import { generateSwissLobbies } from '../services/swissSystem';

let lobbyGroups: number[][];
if (roundNumber === 1) {
  lobbyGroups = generateRandomLobbies(playerIds);
} else {
  // Calculer le classement cumule de tous les rounds valides
  // pour obtenir les playerIds tries par rang
  const rankedPlayerIds = await getRankedPlayerIds(dayId);
  lobbyGroups = generateSwissLobbies(rankedPlayerIds);
}
```

**Calcul du classement pour le systeme suisse :**

Le code de calcul du classement cumule existe DEJA dans la route `/validate` (lignes ~307-444 de `tournament.ts`). Il faut extraire cette logique ou la dupliquer dans une fonction reutilisable :

```typescript
// Pseudo-code pour getRankedPlayerIds :
// 1. Recuperer TOUS les LobbyPlayer avec placement non null
//    de TOUS les rounds "validated" de la journee courante
//    (PAS des autres journees — le suisse est intra-journee)
// 2. Grouper par playerId
// 3. Calculer totalScore, top1Count, top4Count, lastGameResult pour chaque joueur
// 4. Trier : totalScore DESC, top1Count DESC, top4Count DESC, lastGameResult ASC
// 5. Retourner les playerIds dans cet ordre
```

**ATTENTION — Scope du classement suisse :**
- Le classement pour le systeme suisse utilise les points de la **journee en cours uniquement** (pas multi-journees)
- C'est different du classement final affiche publiquement (qui est cumule multi-journees)
- La raison : dans une journee, on veut regrouper les joueurs par niveau de la journee en cours, pas par historique global
- **Verifier dans les AC :** L'AC #5 dit "classement cumule de tous les rounds precedents de la journee" — confirme que c'est intra-journee

**IMPORTANT — Filtrage des joueurs actifs :**
- La route generate-lobbies filtre deja les joueurs par `status: 'inscrit'` (ligne ~131-134 de tournament.ts)
- Ce filtre exclut automatiquement les joueurs droppes (status='absent') et ceux retires avant le tournoi
- Le systeme suisse recoit uniquement les joueurs actifs
- **NE PAS dupliquer ce filtre** — il est deja fait en amont

**Validation du round precedent :**
- Avant de generer les lobbies du round N (N > 1), verifier que le round N-1 existe ET est en statut "validated"
- Si le round precedent n'est pas valide, retourner une erreur 400 : `{ error: { code: "PREVIOUS_ROUND_NOT_VALIDATED", message: "Le round precedent doit etre valide avant de generer les lobbies" } }`

**Limite de 6 rounds :**
- Ajouter une constante `const MAX_ROUNDS = 6;` dans tournament.ts
- Avant de creer un nouveau round, verifier que `roundNumber <= MAX_ROUNDS`
- Si `roundNumber > MAX_ROUNDS`, retourner 400 : `{ error: { code: "MAX_ROUNDS_REACHED", message: "Maximum 6 rounds par journee" } }`

### Etat actuel du code (ce qui existe deja)

**Schema Prisma (`backend/prisma/schema.prisma`, 77 lignes) :**
- `Day` : id, number, type (qualification/finale), status (in-progress/completed)
- `Round` : id, number, dayId, status (pending/in-progress/validated), `@@unique([dayId, number])`
- `Lobby` : id, number, roundId, `@@unique([roundId, number])`
- `LobbyPlayer` : id, lobbyId, playerId, placement (Int?), points (Int?), `@@unique([lobbyId, playerId])`
- `Player` : id, discordPseudo (unique), riotPseudo, email, status (inscrit/absent)
- **PAS de migration necessaire** — le schema supporte deja tout ce dont on a besoin

**Backend :**
- `backend/src/routes/tournament.ts` (446 lignes) : contient deja `POST /days/:dayId/rounds/:roundNumber/generate-lobbies` — **c'est ce endpoint qu'il faut modifier**
  - Lignes ~85-181 : generation de lobbies (actuellement random uniquement)
  - Lignes ~131-134 : filtre des joueurs actifs (`status: 'inscrit'`)
  - Ligne ~144 : `const lobbyGroups = generateRandomLobbies(playerIds);` — **point d'insertion du if/else**
  - Lignes ~307-444 : validation du round avec calcul du classement cumule — **reference pour la logique de ranking**
- `backend/src/services/lobbyGenerator.ts` (21 lignes) : `generateRandomLobbies(playerIds)` — shuffle + slice. **NE PAS modifier ce fichier.**
- `backend/src/services/pointsCalculator.ts` (58 lignes) : `calculatePoints()` et `calculatePlayerStats()` — **utiliser calculatePlayerStats pour le calcul du classement suisse**
- `backend/src/app.ts` (46 lignes) : montage des routes. **NE PAS modifier.**
- `backend/src/prisma/client.ts` : instance Prisma partagee. **TOUJOURS utiliser `import prisma from '../prisma/client'`**

**Frontend :**
- `frontend/src/components/admin/DayManager.tsx` (254 lignes) : composant principal du backoffice. Contient le bouton "Generer les lobbies" et la logique de gestion des rounds. **A modifier pour la limite de 6 rounds.**
  - `handleGenerateLobbies()` : trouve le round en statut "pending" et appelle `generateLobbies(token, day.id, roundNumber)`
  - Le composant affiche le numero de round courant
  - Apres validation d'un round, le prochain round est automatiquement cree en statut "pending" (cote backend)
- `frontend/src/services/api.ts` (182 lignes) : `generateLobbies(token, dayId, roundNumber)` — **NE PAS modifier** (le meme endpoint gere random et suisse cote backend)
- `frontend/src/types/index.ts` (90 lignes) : types existants — **NE PAS modifier** (pas de nouveaux types necessaires)

**Dependances deja disponibles (NE PAS reinstaller) :**
- Backend : Express 5, Prisma 7, bcryptjs, jsonwebtoken, cors, socket.io
- Frontend : React 19, react-router 7, Tailwind CSS v4
- Tests : vitest ou node:test (utilise dans lobbyGenerator.test.ts et pointsCalculator.test.ts)

### Pattern du service swissSystem (calque sur lobbyGenerator)

Le service `swissSystem.ts` doit suivre exactement le meme pattern que `lobbyGenerator.ts` :
- Fonction pure, exportee, sans side effects
- Parametre : tableau de playerIds (deja trie pour swiss, ou aleatoire pour random)
- Retour : `number[][]` (lobbies de playerIds)
- Tests co-localises dans `swissSystem.test.ts`
- Utiliser le meme framework de test que `lobbyGenerator.test.ts` (verifier si c'est `node:test` ou `vitest`)

### Pattern de tests (reference : lobbyGenerator.test.ts)

```typescript
// lobbyGenerator.test.ts utilise :
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Reproduire le meme pattern pour swissSystem.test.ts
```

**Cas de test a couvrir :**
1. 32 joueurs → 4 lobbies de 8 (multiple exact)
2. 28 joueurs → 3 lobbies de 8 + 1 lobby de 4
3. 16 joueurs → 2 lobbies de 8
4. 15 joueurs → 1 lobby de 8 + 1 lobby de 7
5. 8 joueurs → 1 lobby de 8
6. 3 joueurs → 1 lobby de 3
7. Verifier que l'ordre est preserve : lobby 1 = joueurs de rang 1-8, lobby 2 = joueurs de rang 9-16, etc.
8. Verifier qu'aucun joueur n'est duplique ou oublie

### Guide visuel frontend (DayManager)

**Modification de DayManager.tsx pour la limite de 6 rounds :**

1. Apres la validation du round 6, ne plus afficher le bouton "Generer les lobbies"
2. A la place, afficher un message de fin de journee :

```tsx
{/* Apres validation round 6 — message fin de journee */}
<div className="bg-eds-gold/10 border border-eds-gold rounded-lg p-6 text-center">
  <h3 className="font-heading text-eds-gold text-xl mb-2">Journee terminee</h3>
  <p className="text-eds-light">Les 6 rounds de qualification ont ete joues.</p>
</div>
```

3. Pour detecter si on a atteint la limite :
   - Compter le nombre de rounds dans `day.rounds`
   - Si le dernier round est "validated" ET `day.rounds.length >= 6` → masquer le bouton, afficher le message
   - Sinon, afficher le bouton normalement

4. Optionnel : afficher le numero de round dans le titre, ex: "Journee 1 — Round 3/6"

### Tailwind v4 — classes disponibles (charte EDS)

Classes personnalisees EDS definies via `@theme` dans `frontend/src/index.css` :
- Fond : `bg-eds-dark` (#29265B)
- Titres : `font-heading text-eds-cyan` ou `text-eds-gold`
- Corps : `font-body text-eds-light`
- Texte secondaire : `text-eds-gray`
- Accents : `text-eds-cyan` (#80E2ED), `text-eds-gold` (#DAB265)
- Bouton action primaire : `bg-eds-cyan text-eds-dark font-heading`
- Bouton validation round : `bg-eds-gold text-eds-dark font-heading`

NE PAS modifier `index.css`. NE PAS creer de fichier `tailwind.config.ts`.

### Anti-patterns a eviter

- NE PAS creer une nouvelle instance PrismaClient — utiliser `import prisma from '../prisma/client'`
- NE PAS creer un nouveau fichier de routes — modifier `tournament.ts` existant
- NE PAS modifier `lobbyGenerator.ts` — c'est un service pour le Round 1 uniquement
- NE PAS modifier `pointsCalculator.ts` — utiliser ses fonctions telles quelles
- NE PAS modifier le schema Prisma — pas de migration necessaire
- NE PAS ajouter de middleware auth — il est deja monte globalement dans app.ts
- NE PAS utiliser `any` en TypeScript — typer correctement
- NE PAS implementer la gestion des drops — c'est la story 2.6
- NE PAS implementer le WebSocket — c'est la story 3.1
- NE PAS installer de nouvelles dependances
- NE PAS modifier les fonctions API frontend (`api.ts`) — le meme endpoint gere random et suisse
- NE PAS modifier les types frontend (`types/index.ts`) — pas de nouveaux types necessaires
- NE PAS utiliser le classement multi-journees pour le systeme suisse — utiliser uniquement les rounds de la journee en cours
- NE PAS dupliquer le filtre des joueurs actifs — il est deja fait dans la route
- NE PAS creer de route separee pour le systeme suisse — modifier la route existante generate-lobbies
- NE PAS oublier de verifier que le round precedent est valide avant de generer les lobbies du round suivant

### Previous Story Intelligence (Story 2.4)

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
- Tests backend : `node:test` + `node:assert/strict`

**Corrections code review appliquees en 2.3 :**
- Min joueurs aligne sur 1 (pas 2)
- Persistance onglets via hash URL
- Promise.allSettled pour robustesse chargement

**Pattern lobbyGenerator comme reference pour swissSystem :**
- `lobbyGenerator.ts` exporte une fonction pure, testable unitairement
- `lobbyGenerator.test.ts` co-localise, utilise `node:test`
- Suivre exactement le meme pattern pour swissSystem

### Project Structure Notes

**Nouveaux fichiers a creer :**
- `backend/src/services/swissSystem.ts` — service du systeme suisse (fonction pure)
- `backend/src/services/swissSystem.test.ts` — tests unitaires co-localises

**Fichiers a modifier :**
- `backend/src/routes/tournament.ts` — ajouter logique conditionnelle random/suisse + limite 6 rounds + validation round precedent
- `frontend/src/components/admin/DayManager.tsx` — masquer bouton apres round 6 + message fin de journee

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5 - Systeme Suisse & Rounds Suivants]
- [Source: _bmad-output/planning-artifacts/prd.md#FR7 - Redistribution systeme suisse]
- [Source: _bmad-output/planning-artifacts/prd.md#FR8 - Gestion lobbies incomplets]
- [Source: _bmad-output/planning-artifacts/prd.md#FR17 - Enchainer jusqu'a 6 rounds]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — Round, Lobby, LobbyPlayer]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns — swissSystem.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries — seul swissSystem gere la redistribution]
- [Source: _bmad-output/implementation-artifacts/2-4-saisie-des-placements-calcul-des-points.md — previous story]
- [Source: backend/src/routes/tournament.ts — route generate-lobbies a modifier, logique ranking a reutiliser]
- [Source: backend/src/services/lobbyGenerator.ts — pattern de service pur avec tests]
- [Source: backend/src/services/pointsCalculator.ts — calculatePlayerStats pour le classement]
- [Source: backend/prisma/schema.prisma — modele de donnees existant]
- [Source: frontend/src/components/admin/DayManager.tsx — composant a modifier pour limite rounds]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Ancien processus node sur port 3001 empechait nodemon/ts-node de demarrer avec le nouveau code (clean exit silencieux). Resolu en killant le PID et en utilisant `node dist/index.js` directement.
- Rate limiter en memoire sur /auth/login bloquait les tests API automatises apres trop de tentatives.

### Completion Notes List

- Task 1 : Service `swissSystem.ts` cree avec fonction pure `generateSwissLobbies`. 8 tests unitaires couvrant tous les cas (multiples de 8, non-multiples, preservation de l'ordre, pas de doublons). Pattern identique a `lobbyGenerator.ts`.
- Task 2 : Route `generate-lobbies` modifiee avec logique conditionnelle — round 1 = random (inchange), round 2+ = systeme suisse base sur le classement cumule intra-journee. Verification du round precedent valide ajoutee. Classement calcule avec `calculatePlayerStats` (totalScore DESC, top1Count DESC, top4Count DESC, lastGameResult ASC).
- Task 3 : Constante `MAX_ROUNDS = 6` ajoutee. Erreur 400 `MAX_ROUNDS_REACHED` retournee si `roundNumber > 6`.
- Task 4 : `DayManager.tsx` modifie — compteur "Round Y/6" dans les titres, message "Journee terminee" affiche apres validation du round 6 quand aucun round pending n'existe.
- Task 5 : 30/30 tests passent (swissSystem 8, lobbyGenerator 7, pointsCalculator 15). Build backend (tsc) et frontend (vite) OK sans erreur.
- Bonus : Ajout de la creation automatique du round suivant dans la route `/validate` (si roundNumber < MAX_ROUNDS), necessaire pour le flux multi-rounds qui n'etait pas present dans le code existant.

### Post-Review Fixes (Code Review — 3 rapports: Acceptance Auditor, Blind Hunter, Recette)

- Fix #1 (Critique) : Joueurs actifs sans resultat (nouveaux inscrits apres Round 1) ajoutes en fin de classement suisse au lieu d'etre exclus. Les joueurs actifs non presents dans le ranking sont appended apres les joueurs classes.
- Fix #2 (Critique) : Route `/validate` — classement filtre par `dayId` (intra-journee) au lieu de global multi-journees. Corrige l'AC #5.
- Fix #3 (Medium) : Guard `findUnique` avant creation du round suivant dans `/validate` — evite les doublons si double appel concurrent.
- Fix #4 (Medium) : `Math.max` protege dans DayManager.tsx si `day.rounds` est vide (evite -Infinity).
- Fix #5 (UX) : `validatedRound` utilise `.reduce()` au lieu de `.find()` pour afficher le dernier round valide, pas le premier.

### File List

- `backend/src/services/swissSystem.ts` — NOUVEAU — service du systeme suisse (fonction pure generateSwissLobbies)
- `backend/src/services/swissSystem.test.ts` — NOUVEAU — 8 tests unitaires pour le systeme suisse
- `backend/src/routes/tournament.ts` — MODIFIE — import swissSystem, constante MAX_ROUNDS, logique conditionnelle random/suisse dans generate-lobbies, validation round precedent, limite 6 rounds, creation automatique round suivant dans validate, classement validate filtre par dayId, guard doublon round, joueurs sans resultat inclus en fin de classement
- `frontend/src/components/admin/DayManager.tsx` — MODIFIE — compteur Round Y/6, detection journee terminee, message "Journee terminee" apres round 6, validatedRound = dernier round valide, Math.max protege

### Change Log

- 2026-04-16 : Implementation initiale Story 2.5 — systeme suisse, limite 6 rounds, creation auto round suivant, UI fin de journee
- 2026-04-16 : Corrections post code-review — 5 fixes appliques (joueurs sans resultat, classement intra-journee, guard doublon, Math.max, validatedRound)
