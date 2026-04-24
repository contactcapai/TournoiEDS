---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-04-15'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief.md
  - docs/UX-DESIGN.md
  - docs/CONTEXTE-PROJET.md
workflowType: 'architecture'
project_name: 'Tournoi TFT EDS'
user_name: 'Brice'
date: '2026-04-15'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
38 exigences fonctionnelles réparties en 7 domaines :
- **Inscription joueurs** (FR1-FR5) — CRUD simple avec formulaire 3 champs, pas de comptes utilisateurs
- **Gestion des lobbies** (FR6-FR9) — Répartition aléatoire (R1) puis système suisse (rounds suivants), gestion lobbies incomplets
- **Saisie et calcul des résultats** (FR10-FR15) — Saisie placements, calcul automatique points + tiebreakers + moyennes
- **Gestion du tournoi jour J** (FR16-FR20) — Workflow journée de qualification (démarrer, enchaîner rounds, gérer drops), classement cumulé sur 3 journées
- **Finale** (FR21-FR24) — Lobby unique de 8 qualifiés, rounds illimités, détection automatique condition de victoire (top 1 + ≥20 pts)
- **Affichage public temps réel** (FR25-FR31) — 3 pages publiques avec mise à jour instantanée via WebSocket, responsive mobile
- **Overlay stream + Admin** (FR32-FR38) — Page /overlay OBS sans chrome UI, backoffice protégé par login simple

**Non-Functional Requirements:**
- **Performance** : chargement <2s, mise à jour WebSocket <2s, latence saisie <200ms
- **Capacité** : ~30 connexions WebSocket simultanées en lecture, 1 admin en écriture
- **Sécurité** : auth admin (password hashé), HTTPS via Traefik, emails non exposés, RGPD mentions légales
- **Fiabilité** : disponibilité continue pendant journée tournoi (4-6h), persistance immédiate PostgreSQL, backup manuel avant chaque journée

**Scale & Complexity:**

- Primary domain: Web full-stack (MPA + WebSocket)
- Complexity level: Faible
- Estimated architectural components: ~6 (API REST, WebSocket server, base de données, frontend public, overlay, backoffice admin)

### Technical Constraints & Dependencies

- **Hébergement dual imposé** : frontend statique sur Hostinger, backend + PostgreSQL sur VPS Docker/Traefik → impose une séparation nette frontend/backend via API
- **Sous-domaine** de esportdessacres.fr
- **Un seul admin en écriture** → pas de gestion de conflits ou de concurrence en écriture
- **Deadline fixe** : 17 mai 2026 (tournoi), dry-run 10 mai 2026
- **Dev solo** (Brice) → architecture simple, pas de sur-ingénierie
- **Charte graphique EDS** : dark mode (#29265B), accents cyan (#80E2ED) et or (#DAB265), typos Bebas Neue + Roboto

### Cross-Cutting Concerns Identified

- **Temps réel (WebSocket)** : touche toutes les pages publiques + overlay. Événement déclencheur = validation d'un round par l'admin.
- **Séparation frontend/backend** : hébergement dual impose API comme contrat d'interface unique entre les deux couches.
- **Authentification admin** : protège le backoffice, doit être simple (login/password, pas d'OAuth).
- **Charte graphique EDS** : appliquée sur toutes les pages publiques et overlay, cohérence visuelle esport.
- **Responsive** : pages publiques mobile-friendly, backoffice desktop-only, overlay format 16:9 fixe.

## Starter Template Evaluation

### Primary Technology Domain

Architecture séparée Frontend/Backend imposée par l'hébergement dual (Hostinger statique + VPS Docker).

### Starter Options Considered

**Frontend :**
- Vite 8 officiel `react-ts` ✅ — minimal, maintenu, standard de l'industrie
- Create React App — déprécié, non recommandé
- Next.js — SSR inutile (pas de SEO), sur-dimensionné pour du statique sur Hostinger

**Backend :**
- Express + ws + Prisma ✅ — écosystème mature, simple, adapté à l'échelle du projet
- Fastify — plus performant mais inutile pour ~30 connexions, courbe d'apprentissage supplémentaire
- NestJS — sur-architecturé pour un projet de cette taille

### Selected Starters

**Frontend : Vite 8 + React + TypeScript (template officiel)**

**Rationale :** Template officiel Vite, minimal et maintenu. Build statique compatible Hostinger. React choisi pour compatibilité Stitch (design system visuel).

**Initialization Command:**

```bash
npm create vite@latest tournoi-tft-frontend -- --template react-ts
```

**Backend : Express + Prisma + WebSocket (setup manuel)**

**Rationale :** Express est le framework Node.js le plus éprouvé. Prisma 7 offre un excellent DX avec TypeScript et PostgreSQL. Le package `ws` est le standard WebSocket Node.js. L'échelle du projet (~30 connexions) ne justifie pas un framework plus complexe.

**Initialization Command:**

```bash
mkdir tournoi-tft-backend && cd tournoi-tft-backend
npm init -y
npm install express prisma @prisma/client ws cors dotenv
npm install -D typescript @types/express @types/ws @types/cors ts-node nodemon
npx prisma init
```

**Architectural Decisions Provided:**

**Language & Runtime:**
- TypeScript (strict mode) côté frontend ET backend
- Node.js runtime pour le backend
- React 19 pour le frontend

**Styling Solution:**
- Tailwind CSS (à ajouter au frontend) — utilitaire, rapide, compatible charte EDS custom
- Design system EDS via Stitch (composants React visuels)

**Build Tooling:**
- Vite 8 (frontend) — HMR, build statique optimisé
- ts-node + nodemon (backend dev) — rechargement automatique
- Docker (backend prod) — container isolé sur VPS

**ORM & Database:**
- Prisma 7 avec PostgreSQL 17
- Connexion au PG partagé (`postgresql-zvmf`) via réseau Docker externe `postgresql-zvmf_default`

**Real-time:**
- Package `ws` pour WebSocket natif côté backend
- Client WebSocket natif du navigateur côté frontend

**Code Organization:**
- Monorepo avec deux packages : `frontend/` et `backend/`
- Frontend : structure Vite standard (src/components, src/pages, src/hooks)
- Backend : structure Express classique (src/routes, src/services, src/prisma)

**Note:** L'initialisation du projet avec ces commandes constitue la première story d'implémentation.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Bloquent l'implémentation) :**
- Modèle de données Prisma (entités et relations)
- Authentification admin (JWT)
- Protocole WebSocket (Socket.IO)
- Configuration Docker + Traefik

**Important Decisions (Façonnent l'architecture) :**
- Design API REST (routes, erreurs)
- State management frontend (React Context)
- Routing frontend (React Router v7)

**Deferred Decisions (Post-MVP) :**
- Caching (inutile à cette échelle)
- CI/CD automatisé (déploiement manuel pour le MVP)
- Monitoring automatisé (surveillance manuelle le jour J)

### Data Architecture

**Modèle de données (Prisma 7 + PostgreSQL 17) :**

Entités principales :
- `Player` — pseudo Discord, pseudo Riot, email, statut (inscrit/drop/absent)
- `Tournament` — édition du tournoi (une par set TFT)
- `Day` — journée de qualification ou finale, liée à un Tournament
- `Round` — un round dans une journée, numéro séquentiel
- `Lobby` — groupe de joueurs dans un round (max 8)
- `Result` — placement d'un joueur dans un lobby (1-8), points calculés

**Migration :** Prisma Migrate (`npx prisma migrate deploy` en production)

**Caching :** Aucun — ~30 utilisateurs, PostgreSQL gère directement les lectures

**Rationale :** Le modèle reflète exactement la structure du tournoi (édition → journées → rounds → lobbies → résultats). Prisma assure la cohérence des types entre le schéma et le code TypeScript.

### Authentication & Security

**Méthode : JWT (JSON Web Token)**
- Login admin via endpoint `/api/auth/login` (identifiant + mot de passe)
- Token JWT avec expiration 24h (couvre une journée de tournoi complète)
- Mot de passe hashé avec `bcrypt`
- Token envoyé dans le header `Authorization: Bearer <token>`
- Middleware Express vérifie le JWT sur toutes les routes admin `/api/admin/*`

**CORS :** Configuré pour accepter uniquement le domaine frontend (`tournoi.esportdessacres.fr`)

**HTTPS :** Géré automatiquement par Traefik (certificat Let's Encrypt)

**Rationale :** JWT stateless, simple pour un seul admin. Pas de store de sessions côté serveur. Expiration longue adaptée au cas d'usage (une journée de tournoi).

### API & Communication Patterns

**API REST :**

Routes publiques (sans auth) :
- `GET /api/tournament/current` — tournoi en cours
- `POST /api/players` — inscription joueur
- `GET /api/rankings` — classement temps réel
- `GET /api/finals` — état de la finale

Routes admin (JWT requis) :
- `GET /api/admin/players` — liste complète des joueurs
- `POST /api/admin/players` — ajout manuel
- `DELETE /api/admin/players/:id` — retrait joueur
- `PATCH /api/admin/players/:id/drop` — marquer drop
- `POST /api/admin/rounds/generate-lobbies` — générer les lobbies
- `POST /api/admin/rounds/:id/results` — saisie des placements
- `POST /api/admin/rounds/:id/validate` — valider le round

**Gestion d'erreurs :** Format JSON standardisé `{ error: string, code: string, details?: any }`

**WebSocket (Socket.IO) :**
- Événement serveur → clients : `ranking_updated` (après validation d'un round)
- Événement serveur → clients : `tournament_state_changed` (changement de phase)
- Reconnexion automatique côté client (feature native Socket.IO)
- Namespace unique `/tournament`

**Rationale :** Socket.IO apporte la reconnexion automatique (crucial pour les joueurs sur mobile) et le broadcast simplifié. REST pour le CRUD classique, WebSocket uniquement pour les événements temps réel.

### Frontend Architecture

**State Management : React Context**
- `TournamentContext` — état du tournoi, classement, phase en cours
- Alimenté par les données REST au chargement + mises à jour WebSocket en continu
- Pas de lib externe nécessaire pour cette complexité

**Routing : React Router v7**
- `/` — Page présentation + inscription
- `/qualifications` — Tableau classement temps réel
- `/finale` — Tableau finale
- `/overlay` — Vue OBS (sans navigation, sans chrome UI)
- `/admin` — Backoffice (protégé par login)
- `/admin/login` — Page de connexion

**Component Architecture :**
- Pages : composants de page par route
- Components : composants réutilisables (RankingTable, LobbyCard, PlayerRow...)
- Hooks : `useWebSocket`, `useTournament`, `useAuth`

**Rationale :** React Context suffit pour un état simple (classement reçu par WebSocket). React Router v7 est le standard React pour le routing SPA.

### Infrastructure & Deployment

**Backend Docker :**
- Nouveau `docker-compose.yml` dans `/docker/tournoi-tft/` sur le VPS
- Container Node.js (image `node:22-alpine`)
- Réseau externe `postgresql-zvmf_default` pour accéder au PG partagé
- Labels Traefik pour routing HTTPS automatique
- Sous-domaine : `api-tournoi.esportdessacres.fr`

**Frontend Hostinger :**
- Build Vite → `dist/` uploadé sur Hostinger
- Sous-domaine : `tournoi.esportdessacres.fr`
- Fichiers statiques uniquement (HTML/CSS/JS)

**CI/CD :** Déploiement manuel — build local + upload (dev solo, deadline courte)

**Monitoring :** Surveillance manuelle le jour J — pas de monitoring automatisé (conformément au PRD)

**Backup :** Backup manuel de la base PostgreSQL avant chaque journée de tournoi

**Rationale :** Architecture Docker standard, cohérente avec les autres projets sur le VPS. Traefik gère SSL automatiquement. Le déploiement manuel est adapté au contexte (dev solo, MVP).

### Decision Impact Analysis

**Séquence d'implémentation :**
1. Init projet (monorepo frontend + backend)
2. Schéma Prisma + migration sur PG
3. API REST backend (CRUD joueurs, rounds, résultats)
4. Auth admin (JWT + middleware)
5. WebSocket Socket.IO (broadcast ranking_updated)
6. Frontend pages publiques (présentation, classement, finale)
7. Frontend overlay OBS
8. Frontend backoffice admin
9. Docker + Traefik config
10. Déploiement + dry-run

**Dépendances croisées :**
- Le frontend dépend de l'API REST et du WebSocket backend
- Le WebSocket dépend de la logique de validation des rounds
- L'overlay et les pages publiques partagent le même flux WebSocket
- Le backoffice admin dépend de l'auth JWT

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Points de conflit potentiels identifiés :** 15 zones où des agents IA pourraient faire des choix divergents

### Naming Patterns

**Database Naming (Prisma) :**
- Tables : PascalCase singulier → `Player`, `Tournament`, `Round`, `Lobby`, `Result`
- Colonnes : camelCase → `discordPseudo`, `riotPseudo`, `createdAt`
- Relations : camelCase → `player`, `lobbies`, `results`
- Convention Prisma par défaut respectée

**API Naming :**
- Endpoints : kebab-case, pluriel → `/api/players`, `/api/admin/rounds`
- Paramètres de route : `:id` → `/api/admin/players/:id`
- Query params : camelCase → `?dayId=1`
- JSON fields : camelCase → `{ discordPseudo, totalScore, roundNumber }`

**Code Naming (TypeScript/React) :**
- Composants : PascalCase → `RankingTable`, `LobbyCard`, `PlayerRow`
- Fichiers composants : PascalCase → `RankingTable.tsx`
- Hooks : camelCase avec `use` → `useWebSocket.ts`, `useTournament.ts`
- Fonctions/variables : camelCase → `getPlayers()`, `totalScore`
- Types/Interfaces : PascalCase → `Player`, `CreatePlayerInput`
- Fichiers utilitaires : camelCase → `swissSystem.ts`, `pointsCalculator.ts`

### Structure Patterns

**Project Organization :**
- Tests : co-localisés avec les fichiers source → `swissSystem.ts` + `swissSystem.test.ts`
- Composants React : organisés par feature

**Frontend :**

```
src/
  pages/          → Home, Qualifications, Finale, Overlay, Admin
  components/
    ranking/      → RankingTable, PlayerRow
    lobby/        → LobbyCard, LobbyGrid
    common/       → Button, Input, Modal
  hooks/          → useWebSocket, useTournament, useAuth
  contexts/       → TournamentContext, AuthContext
  services/       → api.ts (appels REST), socket.ts (WebSocket)
  types/          → index.ts (types partagés)
```

**Backend :**

```
src/
  routes/         → players.ts, rounds.ts, auth.ts, admin.ts
  services/       → swissSystem.ts, pointsCalculator.ts, lobbyGenerator.ts
  middleware/     → auth.ts, errorHandler.ts
  prisma/         → schema.prisma, seed.ts
  websocket/      → server.ts, events.ts
  types/          → index.ts
  utils/          → validators.ts
```

### Format Patterns

**API Response — succès :**

```json
{ "data": { ... } }
```

**API Response — erreur :**

```json
{ "error": { "code": "PLAYER_NOT_FOUND", "message": "Joueur introuvable" } }
```

**Codes HTTP :**
- `200` — succès GET/PATCH
- `201` — succès POST (création)
- `400` — erreur de validation
- `401` — non authentifié
- `404` — ressource introuvable
- `500` — erreur serveur

**Dates :** ISO 8601 en JSON → `"2026-05-17T14:00:00Z"`

### Communication Patterns

**Événements Socket.IO (snake_case) :**
- `ranking_updated` — classement mis à jour après validation d'un round
- `tournament_state_changed` — changement de phase (qualif → finale, etc.)
- `round_validated` — un round vient d'être validé

**Payload standardisé :**

```json
{
  "event": "ranking_updated",
  "timestamp": "2026-05-17T14:32:00Z",
  "data": { ... }
}
```

**État React (Context) :** Mises à jour immutables uniquement. Le WebSocket met à jour le context via un dispatch.

### Process Patterns

**Error Handling :**
- Backend : middleware centralisé `errorHandler.ts` qui catch toutes les erreurs et retourne le format standard
- Frontend : composant `ErrorBoundary` global + gestion d'erreurs par page
- WebSocket : reconnexion automatique (Socket.IO natif), notification visuelle si déconnecté

**Loading States :**
- Convention : `isLoading`, `isSubmitting`, `isConnected`
- Chargement initial : skeleton ou spinner centré
- Actions admin : bouton désactivé pendant le traitement

### Enforcement Guidelines

**Tout agent IA DOIT :**
1. Suivre les conventions de nommage ci-dessus sans exception
2. Placer les tests à côté du fichier source
3. Utiliser le format de réponse API standardisé
4. Ne jamais exposer les emails joueurs dans les endpoints publics
5. Utiliser le payload WebSocket standardisé

**Anti-Patterns à éviter :**
- Mélanger snake_case et camelCase dans le JSON
- Créer des fichiers `utils/helpers.ts` fourre-tout
- Retourner des réponses API sans le wrapper `{ data }` ou `{ error }`
- Stocker de l'état dans des variables globales côté backend
- Utiliser `any` en TypeScript

## Project Structure & Boundaries

### Complete Project Directory Structure

```
tournoi-tft/
├── README.md
├── .gitignore
├── .env.example
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── index.html
│   ├── .env.example
│   ├── public/
│   │   ├── favicon.ico
│   │   └── assets/
│   │       ├── logo-eds.svg
│   │       └── fonts/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── Qualifications.tsx
│       │   ├── Finale.tsx
│       │   ├── Overlay.tsx
│       │   ├── AdminLogin.tsx
│       │   └── Admin.tsx
│       ├── components/
│       │   ├── ranking/
│       │   │   ├── RankingTable.tsx
│       │   │   ├── RankingTable.test.tsx
│       │   │   ├── PlayerRow.tsx
│       │   │   └── TiebreakerBadge.tsx
│       │   ├── lobby/
│       │   │   ├── LobbyCard.tsx
│       │   │   └── LobbyGrid.tsx
│       │   ├── inscription/
│       │   │   ├── InscriptionForm.tsx
│       │   │   └── InscriptionForm.test.tsx
│       │   ├── finale/
│       │   │   ├── VictoryProgress.tsx
│       │   │   └── FinaleTable.tsx
│       │   ├── admin/
│       │   │   ├── PlacementInput.tsx
│       │   │   ├── RoundManager.tsx
│       │   │   ├── PlayerManager.tsx
│       │   │   └── DayManager.tsx
│       │   └── common/
│       │       ├── Button.tsx
│       │       ├── Modal.tsx
│       │       ├── Spinner.tsx
│       │       └── ConnectionStatus.tsx
│       ├── hooks/
│       │   ├── useWebSocket.ts
│       │   ├── useWebSocket.test.ts
│       │   ├── useTournament.ts
│       │   └── useAuth.ts
│       ├── contexts/
│       │   ├── TournamentContext.tsx
│       │   └── AuthContext.tsx
│       ├── services/
│       │   ├── api.ts
│       │   └── socket.ts
│       └── types/
│           └── index.ts
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nodemon.json
│   ├── .env.example
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── index.ts
│       ├── app.ts
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── players.ts
│       │   ├── rankings.ts
│       │   ├── tournament.ts
│       │   └── admin.ts
│       ├── services/
│       │   ├── swissSystem.ts
│       │   ├── swissSystem.test.ts
│       │   ├── pointsCalculator.ts
│       │   ├── pointsCalculator.test.ts
│       │   ├── lobbyGenerator.ts
│       │   └── lobbyGenerator.test.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   └── errorHandler.ts
│       ├── websocket/
│       │   ├── server.ts
│       │   └── events.ts
│       ├── types/
│       │   └── index.ts
│       └── utils/
│           └── validators.ts
│
└── docker/
    └── docker-compose.yml
```

### Architectural Boundaries

**API Boundary :**
- Toute communication frontend → backend passe par `/api/*` (REST) ou Socket.IO (WebSocket)
- Le frontend ne connaît jamais la structure de la base de données directement
- Les types sont dupliqués (`types/index.ts` dans chaque package) — source de vérité = le backend

**Auth Boundary :**
- Routes `/api/admin/*` protégées par middleware JWT
- Routes `/api/players`, `/api/rankings`, `/api/finals`, `/api/tournament/*` publiques
- WebSocket en lecture seule, pas d'auth requise pour les clients

**Data Boundary :**
- Seul Prisma accède à PostgreSQL — jamais de raw SQL
- Le service `pointsCalculator` est le seul à calculer les scores
- Le service `swissSystem` est le seul à gérer la redistribution

### Requirements to Structure Mapping

| Domaine fonctionnel | Frontend | Backend |
|---------------------|----------|---------|
| **Inscription joueurs** (FR1-FR5) | `pages/Home.tsx`, `components/inscription/` | `routes/players.ts` |
| **Gestion des lobbies** (FR6-FR9) | `components/admin/RoundManager.tsx`, `components/lobby/` | `services/lobbyGenerator.ts`, `services/swissSystem.ts` |
| **Saisie et résultats** (FR10-FR15) | `components/admin/PlacementInput.tsx` | `services/pointsCalculator.ts`, `routes/admin.ts` |
| **Gestion tournoi jour J** (FR16-FR20) | `components/admin/DayManager.tsx`, `PlayerManager.tsx` | `routes/admin.ts` |
| **Finale** (FR21-FR24) | `pages/Finale.tsx`, `components/finale/` | `services/pointsCalculator.ts` |
| **Affichage public temps réel** (FR25-FR31) | `pages/Qualifications.tsx`, `pages/Finale.tsx`, `hooks/useWebSocket.ts` | `websocket/events.ts` |
| **Overlay stream** (FR32-FR35) | `pages/Overlay.tsx` | `websocket/events.ts` |
| **Auth + sécurité** (FR36-FR38) | `pages/AdminLogin.tsx`, `hooks/useAuth.ts`, `contexts/AuthContext.tsx` | `routes/auth.ts`, `middleware/auth.ts` |

### Data Flow

```
[Admin Backoffice] → POST /api/admin/rounds/:id/validate
        ↓
[Express Route] → [pointsCalculator] → [Prisma] → PostgreSQL
        ↓
[Socket.IO broadcast] → ranking_updated
        ↓
[Pages publiques + Overlay] ← mise à jour React Context
```

### Deployment Structure

**Frontend (Hostinger) :**
- `npm run build` → `frontend/dist/`
- Upload `dist/` sur Hostinger via FTP/FileManager
- Sous-domaine : `tournoi.esportdessacres.fr`

**Backend (VPS Docker) :**
- `docker-compose.yml` dans `/docker/tournoi-tft/`
- Build image depuis `backend/Dockerfile`
- Réseau externe `postgresql-zvmf_default`
- Labels Traefik → `api-tournoi.esportdessacres.fr`

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility :**
- React 19 + Vite 8 + TypeScript → compatibles, template officiel
- Express + Prisma 7 + Socket.IO + TypeScript → stack éprouvée, pas de conflit
- PostgreSQL 17 (existant) + Prisma 7 → supporté nativement
- Frontend statique Hostinger + backend Docker/Traefik → séparation nette via API, cohérent

**Pattern Consistency :**
- camelCase partout en TypeScript/JSON, PascalCase pour composants/modèles Prisma → cohérent
- Tests co-localisés compatible avec les deux packages
- Format de réponse API standardisé utilisable sur toutes les routes

**Structure Alignment :**
- La structure monorepo frontend/backend reflète la contrainte d'hébergement dual
- Chaque boundary (auth, data, API) a son emplacement clair dans l'arborescence

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (FR1-FR38) :** Toutes couvertes

| FR | Couverture architecturale |
|----|--------------------------|
| FR1-FR5 (Inscription) | `routes/players.ts` + `InscriptionForm.tsx` |
| FR6-FR9 (Lobbies) | `services/lobbyGenerator.ts` + `services/swissSystem.ts` |
| FR10-FR15 (Résultats) | `services/pointsCalculator.ts` + `PlacementInput.tsx` |
| FR16-FR20 (Tournoi jour J) | `routes/admin.ts` + `DayManager.tsx` + `PlayerManager.tsx` |
| FR21-FR24 (Finale) | `services/pointsCalculator.ts` + `Finale.tsx` + `VictoryProgress.tsx` |
| FR25-FR31 (Temps réel public) | `websocket/events.ts` + `useWebSocket.ts` + pages publiques |
| FR32-FR35 (Overlay) | `Overlay.tsx` + Socket.IO client |
| FR36-FR38 (Auth + RGPD) | `middleware/auth.ts` + `routes/auth.ts` + page mentions légales |

**Non-Functional Requirements Coverage :**
- **Performance** (<2s chargement, <2s WebSocket) → Vite build optimisé, Socket.IO natif, ~30 connexions trivial
- **Sécurité** (auth, hash, HTTPS) → JWT + bcrypt + Traefik SSL
- **Fiabilité** (persistance immédiate) → Prisma écrit directement en PostgreSQL, pas de cache volatile

### Implementation Readiness Validation ✅

**Decision Completeness :** Toutes les technos ont des versions vérifiées (Vite 8, Prisma 7, PostgreSQL 17)

**Structure Completeness :** Arborescence spécifique avec tous les fichiers nommés

**Pattern Completeness :** Naming, structure, format API, WebSocket, erreurs, loading states

### Gap Analysis Results

**Gaps critiques :** Aucun

**Gaps importants :**
1. Schéma Prisma détaillé — le modèle de données est défini conceptuellement (entités + relations) mais le `schema.prisma` exact sera à écrire à l'implémentation
2. Configuration Tailwind charte EDS — les couleurs et typographies sont documentées dans le UX Design mais pas encore traduites en config Tailwind

**Gaps nice-to-have :**
- Pas de stratégie de tests E2E formalisée (acceptable pour le MVP, dev solo)
- Pas de CI/CD (déploiement manuel, cohérent avec le contexte)

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Contexte projet analysé en profondeur
- [x] Échelle et complexité évaluées (faible)
- [x] Contraintes techniques identifiées (hébergement dual, PG partagé, deadline)
- [x] Préoccupations transversales mappées (WebSocket, auth, charte EDS)

**✅ Architectural Decisions**
- [x] Décisions critiques documentées avec versions
- [x] Stack technique complètement spécifiée
- [x] Patterns d'intégration définis (REST + Socket.IO)
- [x] Performance adressée

**✅ Implementation Patterns**
- [x] Conventions de nommage établies
- [x] Patterns de structure définis
- [x] Patterns de communication spécifiés
- [x] Patterns de process documentés

**✅ Project Structure**
- [x] Arborescence complète définie
- [x] Boundaries de composants établies
- [x] Points d'intégration mappés
- [x] Mapping exigences → structure complet

### Architecture Readiness Assessment

**Statut global : PRÊT POUR L'IMPLÉMENTATION**

**Niveau de confiance : Élevé**

**Forces clés :**
- Architecture simple et adaptée à l'échelle (pas de sur-ingénierie)
- Stack éprouvée et bien documentée
- Contrainte d'un seul admin en écriture élimine toute la complexité de concurrence
- Infrastructure existante réutilisée (PG, Traefik, Docker)

**Améliorations futures (post-MVP) :**
- CI/CD automatisé
- Tests E2E
- Multi-tournois / historique
- Monitoring automatisé

### Implementation Handoff

**AI Agent Guidelines :**
- Suivre toutes les décisions architecturales exactement comme documentées
- Utiliser les patterns d'implémentation de manière cohérente sur tous les composants
- Respecter la structure projet et les boundaries
- Se référer à ce document pour toute question architecturale

**Première priorité d'implémentation :**
1. Init monorepo + packages frontend/backend
2. Schéma Prisma + migration
3. API REST backend core
