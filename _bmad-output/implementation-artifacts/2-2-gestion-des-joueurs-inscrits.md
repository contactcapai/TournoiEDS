# Story 2.2 : Gestion des Joueurs Inscrits

Status: done

## Story

As a **admin**,
I want **consulter, ajouter et retirer des joueurs inscrits depuis le backoffice**,
So that **je peux preparer la liste des participants avant le jour J**.

## Acceptance Criteria

1. **Given** je suis authentifie sur le backoffice **When** j'accede a la section joueurs **Then** je vois la liste complete des joueurs inscrits avec pseudo Discord, pseudo Riot, email et statut

2. **Given** je suis sur la liste des joueurs **When** je clique sur "Ajouter un joueur" et remplis les 3 champs (pseudo Discord, pseudo Riot, email) **Then** le joueur est cree en base avec le statut "inscrit" **And** il apparait immediatement dans la liste

3. **Given** je suis sur la liste des joueurs **When** je clique sur "Retirer" a cote d'un joueur avant le debut du tournoi **Then** le joueur est marque comme "absent" **And** il n'apparait plus dans la liste des joueurs actifs

4. **Given** j'ajoute un joueur avec un pseudo Discord deja existant **When** je valide **Then** un message d'erreur m'informe du doublon **And** aucun joueur n'est cree

## Tasks / Subtasks

- [x] Task 1 : Creer les routes admin backend pour la gestion des joueurs (AC: #1, #2, #3, #4)
  - [x] 1.1 Creer `backend/src/routes/admin.ts` avec les endpoints admin joueurs
  - [x] 1.2 `GET /admin/players` — retourne la liste complete des joueurs (y compris email et statut)
  - [x] 1.3 `POST /admin/players` — ajout manuel d'un joueur (memes validations que POST /api/players)
  - [x] 1.4 `PATCH /admin/players/:id` — marquer un joueur comme "absent" (changer le statut)
  - [x] 1.5 Enregistrer le router admin dans `backend/src/app.ts` sous le prefixe `/api/admin`

- [x] Task 2 : Ajouter les types et fonctions API cote frontend (AC: #1, #2, #3, #4)
  - [x] 2.1 Ajouter le type `Player` complet et `CreatePlayerInput` dans `frontend/src/types/index.ts`
  - [x] 2.2 Creer les fonctions API authentifiees dans `frontend/src/services/api.ts` : `getAdminPlayers()`, `addAdminPlayer()`, `removePlayer()`
  - [x] 2.3 Creer un helper `authHeaders()` pour injecter le token JWT dans les appels admin

- [x] Task 3 : Creer le composant PlayerManager dans le backoffice (AC: #1, #2, #3, #4)
  - [x] 3.1 Creer `frontend/src/components/admin/PlayerManager.tsx` avec le tableau des joueurs
  - [x] 3.2 Afficher les colonnes : pseudo Discord, pseudo Riot, email, statut, actions
  - [x] 3.3 Ajouter un bouton "Ajouter un joueur" ouvrant un formulaire (modal ou inline)
  - [x] 3.4 Ajouter un bouton "Retirer" par ligne avec confirmation avant action
  - [x] 3.5 Gestion des erreurs : doublon pseudo Discord, erreurs reseau
  - [x] 3.6 Filtrer la liste pour n'afficher que les joueurs actifs (statut "inscrit") par defaut, avec option de voir les absents

- [x] Task 4 : Integrer PlayerManager dans la page Admin (AC: #1)
  - [x] 4.1 Remplacer le placeholder dans `frontend/src/pages/Admin.tsx` par le composant PlayerManager
  - [x] 4.2 Conserver le header avec titre "Backoffice Admin" et le bouton deconnexion

- [x] Task 5 : Validation (AC: #1-#4)
  - [x] 5.1 `npm run build` passe sans erreur (frontend + backend)
  - [x] 5.2 Tester `GET /api/admin/players` avec token valide : retourne la liste
  - [x] 5.3 Tester `GET /api/admin/players` sans token : 401
  - [x] 5.4 Tester `POST /api/admin/players` avec donnees valides : joueur cree, statut "inscrit"
  - [x] 5.5 Tester `POST /api/admin/players` avec pseudo Discord duplique : erreur 409
  - [x] 5.6 Tester `PATCH /api/admin/players/:id` : statut change a "absent"
  - [x] 5.7 Tester UI : liste affichee, ajout fonctionne, retrait fonctionne avec confirmation

## Dev Notes

### Architecture & Patterns a suivre

**Backend — Routes admin joueurs :**
- Fichier : `backend/src/routes/admin.ts` [Source: architecture.md#Structure Patterns > Backend]
- Ces routes sont montees SOUS le prefixe `/api/admin` dans `app.ts`, donc le router utilise des chemins relatifs : `/players`, `/players/:id`
- Le middleware `requireAuth` est deja monte globalement sur `/api/admin` dans `app.ts` (ligne 21) — PAS besoin de l'ajouter dans le router
- Format de reponse : `{ data: {...} }` en succes, `{ error: { code, message } }` en erreur
- Utiliser l'instance Prisma partagee : `import prisma from '../prisma/client'`
- [Source: architecture.md#API & Communication Patterns]

**Endpoints a creer :**
```
GET  /admin/players          → liste complete (avec email car c'est l'admin)
POST /admin/players          → ajout manuel (memes validations que l'inscription publique)
PATCH /admin/players/:id     → update statut joueur (ex: "absent")
```

**Important — Le GET admin expose l'email :** Contrairement a l'endpoint public `POST /api/players` qui masque l'email dans la reponse, `GET /api/admin/players` DOIT retourner l'email car l'admin en a besoin pour gerer les joueurs. [Source: architecture.md#Architectural Boundaries — "Ne jamais exposer les emails joueurs dans les endpoints publics" ne s'applique PAS aux routes admin]

**Backend — Validation ajout joueur :**
- Reutiliser la meme logique de validation que `backend/src/routes/players.ts` : email regex, champs requis, trim
- Gerer le doublon Prisma P2002 de la meme facon (erreur 409 DUPLICATE_DISCORD_PSEUDO)
- NE PAS dupliquer le code de validation — extraire dans une fonction utilitaire si necessaire, OU copier le pattern minimal (la validation est courte, pas besoin d'une abstraction)

**Backend — PATCH statut joueur :**
- Valider que le nouveau statut est un des statuts autorises : "inscrit", "absent"
- Valider que le joueur existe (sinon 404)
- NE PAS permettre de changer le statut en "drop" depuis cette route — le drop sera gere par une story dediee (2.6) dans un contexte de journee active

**Frontend — Appels API authentifies :**
Le `AuthContext` expose `token` — utiliser ce token dans les headers des appels admin :
```typescript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
}
```
Le token est accessible via `useAuth()` dans les composants, mais les fonctions `api.ts` sont stateless. **Solution :** passer le token en parametre aux fonctions admin OU lire depuis localStorage directement. Pattern recommande : passer le token en parametre (plus explicite, plus testable).

**Frontend — PlayerManager :**
- Emplacement : `frontend/src/components/admin/PlayerManager.tsx`
- Pattern composant : un seul composant qui gere la liste + ajout + retrait
- Gestion de l'etat : `useState` pour la liste de joueurs, `useEffect` pour le chargement initial
- Pas besoin de React Context dedié — l'etat local suffit pour cette page
- Style : utiliser les classes Tailwind EDS (bg-eds-dark, text-eds-light, etc.)
- Le backoffice est desktop-only (UX-DR13) — pas besoin de responsive mobile

### Etat actuel du code (ce qui existe deja)

**Backend :**
- `backend/src/app.ts` : Express 5, CORS, JSON, routes auth et players. Middleware `requireAuth` monte sur `/api/admin`. Health check admin existant.
- `backend/src/routes/players.ts` : POST `/players` inscription publique. **Note :** ce fichier cree sa propre instance Prisma au lieu d'utiliser le client partage — c'est un pattern legacy, ne pas le reproduire.
- `backend/src/prisma/client.ts` : instance Prisma partagee (adapter PG). **TOUJOURS utiliser `import prisma from '../prisma/client'`**.
- `backend/src/middleware/auth.ts` : middleware JWT, decore `req.admin` avec `{ adminId, username }`.
- `backend/src/routes/auth.ts` : POST `/auth/login` avec rate limiting.
- `backend/prisma/schema.prisma` : modeles `Player` (id, discordPseudo unique, riotPseudo, email, status default "inscrit", createdAt) et `Admin`.

**Frontend :**
- `frontend/src/pages/Admin.tsx` : page placeholder avec titre "Backoffice Admin" et bouton deconnexion. C'EST CE FICHIER A MODIFIER.
- `frontend/src/services/api.ts` : fonctions `registerPlayer()` et `loginAdmin()`. Pattern : fetch natif, retour `{ data } | { error }`. loginAdmin utilise AbortController avec timeout 10s.
- `frontend/src/types/index.ts` : types `RegisterPlayerInput`, `RegisterPlayerResponse`, `ApiError`, `LoginInput`, `LoginResponse`.
- `frontend/src/contexts/AuthContext.tsx` : expose `token`, `isAuthenticated`, `login()`, `logout()`. Token stocke dans localStorage cle `auth_token`.
- `frontend/src/hooks/useAuth.ts` : hook pour acceder au contexte.
- `frontend/src/components/admin/ProtectedRoute.tsx` : seul composant admin existant.

**Dependances deja disponibles (NE PAS reinstaller) :**
- Backend : Express 5, Prisma 7, bcryptjs, jsonwebtoken, cors, socket.io
- Frontend : React 19, react-router 7, Tailwind CSS v4

### Montage de la route admin dans app.ts

Le middleware `requireAuth` est monte ainsi dans `app.ts` :
```typescript
app.use("/api/admin", requireAuth);
```
Pour ajouter le router admin, l'enregistrer APRES le middleware :
```typescript
app.use("/api/admin", requireAuth);
app.use("/api/admin", adminRouter);  // <-- ajouter cette ligne
```
Le router admin n'a PAS besoin de re-verifier l'auth — le middleware global s'en charge deja.

### Types a ajouter cote frontend

```typescript
export interface Player {
  id: number;
  discordPseudo: string;
  riotPseudo: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface CreatePlayerInput {
  discordPseudo: string;
  riotPseudo: string;
  email: string;
}
```
- `Player` inclut l'email (visible uniquement pour l'admin)
- `CreatePlayerInput` est identique a `RegisterPlayerInput` — reutiliser `RegisterPlayerInput` si on veut eviter la duplication, ou creer un alias

### Fonctions API admin a ajouter

```typescript
export async function getAdminPlayers(
  token: string
): Promise<{ data: Player[] } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/players`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Player[] };
}

export async function addAdminPlayer(
  token: string,
  data: RegisterPlayerInput
): Promise<{ data: Player } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Player };
}

export async function removePlayer(
  token: string,
  playerId: number
): Promise<{ data: Player } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/players/${playerId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'absent' }),
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Player };
}
```

### Guide visuel du PlayerManager

- Fond : `bg-eds-dark` (herite de la page Admin)
- Titre section : "Joueurs inscrits" en `font-heading text-eds-cyan`
- Tableau : lignes alternees avec `odd:bg-white/5` ou pattern similaire
- Colonnes : pseudo Discord, pseudo Riot, email, statut, actions
- Badge statut : "inscrit" en vert/cyan, "absent" en gris
- Bouton "Ajouter un joueur" : style `bg-eds-cyan text-eds-dark` (gros bouton UX-DR11)
- Bouton "Retirer" : style discret avec confirmation (fenetre `confirm()` ou modal simple)
- Etat vide : message "Aucun joueur inscrit pour le moment"
- Gestion erreur : afficher les messages d'erreur sous le formulaire d'ajout
- Desktop-only : pas de responsive mobile (UX-DR13 — backoffice desktop uniquement)

### Tailwind v4 — classes disponibles (charte EDS)

Classes personnalisees EDS definies via `@theme` dans `frontend/src/index.css` :
- Fond : `bg-eds-dark` (#29265B)
- Titres : `font-heading text-eds-cyan` ou `text-eds-gold`
- Corps : `font-body text-eds-light`
- Texte secondaire : `text-eds-gray`
- Accents : `text-eds-cyan` (#80E2ED), `text-eds-gold` (#DAB265)

NE PAS modifier `index.css`. NE PAS creer de fichier `tailwind.config.ts`.

### Anti-patterns a eviter

- NE PAS creer une nouvelle instance PrismaClient dans admin.ts — utiliser `import prisma from '../prisma/client'`
- NE PAS exposer l'email dans les endpoints PUBLICS — uniquement dans les routes admin
- NE PAS utiliser `any` en TypeScript — typer correctement les requetes et reponses
- NE PAS importer depuis `'react-router-dom'` — utiliser `'react-router'`
- NE PAS ajouter de middleware auth dans le router admin — il est deja monte globalement dans app.ts
- NE PAS permettre le changement de statut vers "drop" dans cette story — le drop est gere par la story 2.6 dans un contexte de journee active
- NE PAS creer de state management global (Context) pour les joueurs — useState local suffit
- NE PAS installer de nouvelles dependances

### Previous Story Intelligence (Story 2.1)

**Decisions techniques confirmees :**
- Import `'react-router'` (pas `'react-router-dom'`)
- Express 5 — `app.use()` pour monter les middlewares et routes
- Instance Prisma partagee dans `backend/src/prisma/client.ts`
- Token JWT dans localStorage cle `auth_token`
- Style backoffice : bg-eds-dark, font-heading text-eds-cyan, bouton deconnexion en border-eds-gray/40
- Admin.tsx est un placeholder a enrichir

**Corrections code review appliquees en 2.1 :**
- Timing attack fix sur bcrypt compare (toujours comparer meme si user non trouve)
- Rate limiting sur login (5 tentatives / 15 min)
- JWT_SECRET verifie au demarrage du serveur
- Timeout sur appels API frontend (AbortController 10s)
- Case-insensitive login (lowercased username)

**Fichiers crees/modifies en 2.1 :**
- `backend/src/prisma/client.ts` (nouveau — instance partagee)
- `backend/src/routes/auth.ts` (nouveau)
- `backend/src/middleware/auth.ts` (nouveau)
- `backend/src/app.ts` (modifie — routes auth + middleware admin)
- `frontend/src/contexts/AuthContext.tsx` (nouveau)
- `frontend/src/hooks/useAuth.ts` (nouveau)
- `frontend/src/pages/Admin.tsx` (nouveau — placeholder)
- `frontend/src/components/admin/ProtectedRoute.tsx` (nouveau)

### Project Structure Notes

**Nouveaux fichiers a creer :**
- `backend/src/routes/admin.ts` — dans `backend/src/routes/` [Source: architecture.md#Structure Patterns > Backend]
- `frontend/src/components/admin/PlayerManager.tsx` — dans `frontend/src/components/admin/` [Source: architecture.md#Structure Patterns > Frontend]

**Fichiers a modifier :**
- `backend/src/app.ts` — ajouter import et montage du router admin
- `frontend/src/pages/Admin.tsx` — remplacer le placeholder par PlayerManager
- `frontend/src/services/api.ts` — ajouter les fonctions admin (getAdminPlayers, addAdminPlayer, removePlayer)
- `frontend/src/types/index.ts` — ajouter les types Player, CreatePlayerInput

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2 - Gestion des Joueurs Inscrits]
- [Source: _bmad-output/planning-artifacts/prd.md#FR3 - Liste des joueurs inscrits]
- [Source: _bmad-output/planning-artifacts/prd.md#FR4 - Ajout manuel joueur]
- [Source: _bmad-output/planning-artifacts/prd.md#FR5 - Retrait joueur absent]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR8 - Emails non exposes publiquement]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries]
- [Source: _bmad-output/implementation-artifacts/2-1-authentification-admin.md]
- [Source: backend/src/app.ts — montage middleware requireAuth ligne 21]
- [Source: backend/src/prisma/client.ts — instance Prisma partagee]
- [Source: backend/src/routes/players.ts — pattern validation et gestion doublon P2002]
- [Source: frontend/src/services/api.ts — pattern fonctions API]
- [Source: frontend/src/types/index.ts — types existants]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Fix TS2345 : Express 5 type `req.params.id` as `string | string[]` — resolved with Array.isArray guard

### Completion Notes List
- Task 1 : Cree `backend/src/routes/admin.ts` avec 3 endpoints (GET, POST, PATCH /players). Utilise l'instance Prisma partagee. Validation identique a l'endpoint public. Statuts autorises limites a "inscrit" et "absent" (pas de "drop").
- Task 2 : Ajoute le type `Player` dans `frontend/src/types/index.ts`. Reutilise `RegisterPlayerInput` pour l'ajout. 3 fonctions API admin dans `api.ts` avec token en parametre.
- Task 3 : Cree `PlayerManager.tsx` — tableau avec colonnes (Discord, Riot, email, statut, actions), formulaire d'ajout inline, bouton retirer avec confirm(), filtre actifs/absents, gestion erreurs (doublon, reseau), design EDS.
- Task 4 : Remplace le placeholder dans `Admin.tsx` par `<PlayerManager />`, conserve le header et bouton deconnexion.
- Task 5 : Build backend et frontend passent sans erreur. Tests manuels valides par l'utilisateur.
- Code review : Extraction validation partagee (`validation/player.ts`), limites longueur pseudos, simplification parsing ID, error handler global app.ts, try/catch frontend, loading state individuel retrait.
- Post-review : PATCH etendu pour modifier infos joueur (discordPseudo, riotPseudo, email). Ajout bouton "Reinscrire" (absent → inscrit) et edition inline des infos joueur dans PlayerManager. Fonction `removePlayer` remplacee par `updatePlayer` generique.
- Post-done 2026-04-18 : Ajout zone dangereuse en bas du PlayerManager avec 3 boutons reset (finale, qualifications, joueurs). 3 nouveaux endpoints DELETE /api/admin/reset/{finale,qualifications,players} avec suppression en cascade atomique et emission `tournament_state_changed`. Le bouton "Reinitialiser la finale" rend le script CLI `cleanup-finale.ts` optionnel (disponible via UI admin). Chaque bouton declenche une confirmation explicite (window.confirm) avec le scope decrit.

### Change Log
- 2026-04-16 : Implementation complete story 2.2 — gestion des joueurs inscrits (backend routes + frontend PlayerManager)
- 2026-04-16 : Code review — extraction validation, error handler global, try/catch frontend, loading states
- 2026-04-16 : Post-review — PATCH etendu (edition infos joueur), reinscription joueur absent, edition inline UI
- 2026-04-18 : Post-done — Ajout zone dangereuse (3 boutons reset : finale, qualifications, joueurs) + 3 endpoints DELETE /api/admin/reset/* avec cascade atomique et emission tournament_state_changed

### File List
- `backend/src/routes/admin.ts` (nouveau — puis modifie 2026-04-18 : 3 endpoints DELETE reset/*)
- `backend/src/validation/player.ts` (nouveau — validation partagee)
- `backend/src/routes/players.ts` (modifie — utilise validation partagee)
- `backend/src/app.ts` (modifie — import adminRouter + error handler global)
- `frontend/src/types/index.ts` (modifie — ajout type Player)
- `frontend/src/services/api.ts` (modifie — ajout getAdminPlayers, addAdminPlayer, updatePlayer, puis resetFinale/Qualifications/Players 2026-04-18)
- `frontend/src/components/admin/PlayerManager.tsx` (nouveau — puis modifie 2026-04-18 : zone dangereuse + boutons reset)
- `frontend/src/pages/Admin.tsx` (modifie — integration PlayerManager)

### Review Findings

- [x] [Review][Patch] Duplication de la logique de validation backend. [backend/src/routes/admin.ts:26-47]
- [x] [Review][Patch] Absence de limite de longueur sur les pseudos. [backend/src/routes/admin.ts]
- [x] [Review][Patch] Manque d'état de chargement individuel pour le retrait. [frontend/src/components/admin/PlayerManager.tsx:55]
- [x] [Review][Patch] Logique de parsing d'ID inutilement complexe. [backend/src/routes/admin.ts:83]
- [x] [Review][Patch] Statuts autorisés codés en dur dans la route. [backend/src/routes/admin.ts:7]
- [x] [Review][Patch] Regex d'email basique. [backend/src/routes/admin.ts:6]
- [x] [Review][Patch] Risque d'exposition de stack trace si requireAuth échoue. [backend/src/app.ts:22]
- [x] [Review][Defer] Récupération de tous les joueurs sans pagination. [backend/src/routes/admin.ts:12] — deferred, pre-existing
