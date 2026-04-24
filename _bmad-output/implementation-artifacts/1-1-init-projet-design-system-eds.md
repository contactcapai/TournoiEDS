# Story 1.1 : Init Projet & Design System EDS

Status: done

## Story

As a **developpeur**,
I want **initialiser le monorepo avec le frontend (Vite 8 + React 19 + TypeScript + Tailwind), le backend (Express + Prisma 7 + TypeScript), le schema Prisma initial et la configuration Tailwind charte EDS**,
So that **le socle technique est pret et le design system EDS est configurable des la premiere page**.

## Acceptance Criteria

1. **Given** le projet n'existe pas encore **When** j'execute les commandes d'initialisation **Then** le monorepo contient deux packages `frontend/` et `backend/` avec leurs dependances installees **And** le frontend demarre avec `npm run dev` sans erreur **And** le backend demarre avec `npm run dev` sans erreur

2. **Given** le frontend est initialise **When** je consulte la configuration Tailwind **Then** les couleurs EDS sont configurees (#29265B, #80E2ED, #787C86, #EDEFFD, #DAB265, #FFFFFF) **And** les typographies Bebas Neue et Roboto sont chargees via Google Fonts **And** le dark mode utilise `#29265B` comme fond par defaut

3. **Given** le backend est initialise **When** je consulte le schema Prisma **Then** le modele `Player` existe avec les champs : id, discordPseudo, riotPseudo, email, status, createdAt **And** la connexion a PostgreSQL est configuree via variable d'environnement

4. **Given** les deux packages sont initialises **When** je verifie la structure du projet **Then** le frontend suit la structure : `src/pages/`, `src/components/`, `src/hooks/`, `src/contexts/`, `src/services/`, `src/types/` **And** le backend suit la structure : `src/routes/`, `src/services/`, `src/middleware/`, `src/websocket/`, `src/types/` **And** TypeScript est en mode strict des deux cotes

## Tasks / Subtasks

- [x] Task 1 : Initialiser la structure monorepo (AC: #1, #4)
  - [x] 1.1 Creer le dossier racine avec `README.md`, `.gitignore`, `.env.example`
  - [x] 1.2 Initialiser le frontend avec `npm create vite@latest` template `react-ts`
  - [x] 1.3 Creer les dossiers frontend : `src/pages/`, `src/components/`, `src/hooks/`, `src/contexts/`, `src/services/`, `src/types/`
  - [x] 1.4 Initialiser le backend manuellement : `package.json`, `tsconfig.json`
  - [x] 1.5 Installer les dependances backend : express, @prisma/client, socket.io, cors, dotenv, bcryptjs, jsonwebtoken
  - [x] 1.6 Installer les devDependencies backend : typescript, @types/express, @types/cors, @types/bcryptjs, @types/jsonwebtoken, ts-node, nodemon, prisma
  - [x] 1.7 Creer les dossiers backend : `src/routes/`, `src/services/`, `src/middleware/`, `src/websocket/`, `src/types/`, `src/utils/`
  - [x] 1.8 Configurer TypeScript strict mode dans les deux packages (`"strict": true`)
  - [x] 1.9 Configurer les scripts npm (`dev`, `build`) dans les deux packages
  - [x] 1.10 Creer le fichier `backend/nodemon.json` pour le rechargement automatique
  - [x] 1.11 Creer le point d'entree backend minimal (`src/index.ts` + `src/app.ts`) pour que `npm run dev` demarre sans erreur

- [x] Task 2 : Configurer Tailwind CSS avec la charte EDS (AC: #2)
  - [x] 2.1 Installer Tailwind CSS + PostCSS + Autoprefixer dans le frontend
  - [x] 2.2 Configurer `tailwind.config.ts` avec la palette EDS :
    - `eds-dark`: `#29265B` (fond principal)
    - `eds-cyan`: `#80E2ED` (accent interactif)
    - `eds-gray`: `#787C86` (texte secondaire)
    - `eds-light`: `#EDEFFD` (fond clair)
    - `eds-gold`: `#DAB265` (accent or, mise en avant)
    - `eds-white`: `#FFFFFF`
  - [x] 2.3 Configurer les typographies dans Tailwind : `font-heading` (Bebas Neue), `font-body` (Roboto)
  - [x] 2.4 Ajouter le chargement Google Fonts (Bebas Neue + Roboto) dans `index.html`
  - [x] 2.5 Configurer `src/index.css` avec les directives Tailwind et le dark mode par defaut (`body` avec `bg-eds-dark text-white`)
  - [x] 2.6 Mettre a jour `src/App.tsx` avec un composant minimal utilisant la charte EDS pour verifier le rendu

- [x] Task 3 : Configurer Prisma et le schema initial (AC: #3)
  - [x] 3.1 Initialiser Prisma dans le backend (`npx prisma init`)
  - [x] 3.2 Configurer `schema.prisma` avec le provider `postgresql` et la datasource via `DATABASE_URL`
  - [x] 3.3 Creer le modele `Player` avec les champs : `id` (Int, autoincrement), `discordPseudo` (String, unique), `riotPseudo` (String), `email` (String), `status` (String, default "inscrit"), `createdAt` (DateTime, default now)
  - [x] 3.4 Creer les fichiers `.env.example` avec `DATABASE_URL=postgresql://user:password@localhost:5432/tournoi_tft`
  - [x] 3.5 Verifier que `npx prisma validate` passe sans erreur

- [x] Task 4 : Creer les fichiers de configuration Docker (preparation) (AC: #1)
  - [x] 4.1 Creer `backend/Dockerfile` (node:22-alpine, multi-stage build)
  - [x] 4.2 Creer `docker/docker-compose.yml` avec le service backend, reseau externe `postgresql-zvmf_default`, labels Traefik pour `api-tournoi.esportdessacres.fr`

- [x] Task 5 : Validation finale — les deux packages demarrent (AC: #1)
  - [x] 5.1 Verifier que `cd frontend && npm run dev` demarre sans erreur
  - [x] 5.2 Verifier que `cd backend && npm run dev` demarre sans erreur
  - [x] 5.3 Verifier que la page frontend affiche le composant avec la charte EDS
  - [x] 5.4 Verifier que le backend repond sur un endpoint de sante (`GET /api/health`)

## Dev Notes

### Architecture & Stack technique

- **Monorepo** : deux packages `frontend/` et `backend/` a la racine du projet (pas de workspace npm, dossiers independants)
- **Frontend** : Vite 8 + React 19 + TypeScript strict + Tailwind CSS
- **Backend** : Express + Prisma 7 + Socket.IO + TypeScript strict
- **Base de donnees** : PostgreSQL 17 existant (conteneur Docker `postgresql-zvmf`)
- **Runtime** : Node.js 22 (LTS)

### Decisions architecturales critiques

- **Socket.IO** (pas `ws` natif) : choisi pour la reconnexion automatique native, critique pour les joueurs sur mobile. Le document d'architecture mentionne `ws` dans le starter mais les patterns de communication specifient Socket.IO — **utiliser Socket.IO**.
- **Namespace WebSocket** : `/tournament`
- **Format reponse API** : `{ data: {...} }` pour les succes, `{ error: { code, message } }` pour les erreurs
- **Tests co-localises** : chaque fichier source a son `.test.ts` a cote (ex: `swissSystem.ts` + `swissSystem.test.ts`)

### Conventions de nommage (OBLIGATOIRES)

- **Prisma** : PascalCase singulier pour les tables (`Player`), camelCase pour les colonnes (`discordPseudo`)
- **API** : kebab-case pluriel pour les endpoints (`/api/players`), camelCase pour les champs JSON
- **Composants React** : PascalCase (`RankingTable.tsx`)
- **Hooks** : camelCase avec `use` (`useWebSocket.ts`)
- **Services/utils** : camelCase (`pointsCalculator.ts`)
- **Evenements Socket.IO** : snake_case (`ranking_updated`)

### Configuration Tailwind EDS — specifications exactes

```
Couleurs :
  eds-dark:   #29265B  → fond principal (dark mode)
  eds-cyan:   #80E2ED  → accent interactif, elements cliquables
  eds-gray:   #787C86  → texte secondaire, bordures
  eds-light:  #EDEFFD  → fond clair, cartes
  eds-gold:   #DAB265  → accent or, mise en avant (1ere place, titres)
  eds-white:  #FFFFFF  → texte sur fond sombre

Typographies :
  font-heading: 'Bebas Neue', sans-serif  → titres, h1-h3
  font-body:    'Roboto', sans-serif      → corps de texte
```

### Schema Prisma — modele Player initial

```prisma
model Player {
  id            Int      @id @default(autoincrement())
  discordPseudo String   @unique
  riotPseudo    String
  email         String
  status        String   @default("inscrit")
  createdAt     DateTime @default(now())
}
```

Note : Ce modele sera etendu dans les stories suivantes (Epic 2) avec les relations Tournament, Day, Round, Lobby, Result. Pour cette story, seul le modele Player est requis.

### Structure de fichiers attendue

```
frontend/
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  index.html              → inclut Google Fonts (Bebas Neue + Roboto)
  src/
    main.tsx
    App.tsx               → composant minimal avec charte EDS
    index.css             → directives Tailwind + dark mode par defaut
    pages/                → vide (sera peuple Story 1.2+)
    components/           → vide
    hooks/                → vide
    contexts/             → vide
    services/             → vide
    types/                → vide

backend/
  package.json
  tsconfig.json
  nodemon.json
  .env.example
  Dockerfile
  prisma/
    schema.prisma         → modele Player
  src/
    index.ts              → point d'entree (demarre Express + ecoute port)
    app.ts                → configuration Express (cors, json, routes)
    routes/               → vide (sera peuple Story 1.3+)
    services/             → vide
    middleware/            → vide
    websocket/            → vide
    types/                → vide
    utils/                → vide

docker/
  docker-compose.yml      → service backend + reseau postgresql-zvmf_default + labels Traefik
```

### Dependances exactes a installer

**Frontend :**
- `react`, `react-dom` (inclus par Vite template)
- `tailwindcss`, `postcss`, `autoprefixer` (devDependencies)
- Note : Tailwind CSS v4 (stable depuis 2025) utilise une configuration CSS-first via `@theme` dans le CSS au lieu de `tailwind.config.ts`. Si Vite 8 installe Tailwind v4 par defaut, utiliser la syntaxe CSS-first. Si v3, utiliser `tailwind.config.ts`. Le dev agent doit verifier la version installee et adapter.

**Backend :**
- Dependencies : `express`, `@prisma/client`, `socket.io`, `cors`, `dotenv`, `bcryptjs`, `jsonwebtoken`
- DevDependencies : `typescript`, `@types/express`, `@types/cors`, `@types/bcryptjs`, `@types/jsonwebtoken`, `ts-node`, `nodemon`, `prisma`

### Anti-patterns a eviter

- NE PAS utiliser `any` en TypeScript
- NE PAS creer de fichier `utils/helpers.ts` fourre-tout
- NE PAS utiliser `ws` natif — utiliser `socket.io`
- NE PAS mettre les tests dans un dossier `__tests__/` separe — les co-localiser avec les sources
- NE PAS utiliser `create-react-app` — utiliser Vite
- NE PAS configurer de CI/CD (deploiement manuel pour le MVP)

### Infrastructure — pour info (utilise dans Task 4)

- **VPS Docker** : le backend sera deploye dans un container Docker avec Traefik
- **Reseau Docker externe** : `postgresql-zvmf_default` pour acceder au PostgreSQL partage
- **Sous-domaines** : `api-tournoi.esportdessacres.fr` (backend), `tournoi.esportdessacres.fr` (frontend)
- **Image Docker** : `node:22-alpine`

### Project Structure Notes

- Ce projet est un greenfield — aucun code existant
- Le monorepo est simple (deux dossiers) sans workspace npm ni lerna
- La source de verite pour les types est le backend — le frontend duplique les types necessaires dans `src/types/`
- Les `.env` ne doivent JAMAIS etre commites — uniquement `.env.example`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- [Source: docs/UX-DESIGN.md#Charte graphique Esport des Sacres]
- [Source: _bmad-output/planning-artifacts/prd.md#Additional Requirements]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

Aucun probleme rencontre.

### Completion Notes List

- Monorepo initialise avec frontend (Vite 8 + React 19 + TypeScript strict) et backend (Express 5 + Prisma 7 + TypeScript strict)
- Tailwind CSS v4 installe avec configuration CSS-first (`@theme` dans index.css) — adaptation automatique car Vite 8 installe Tailwind v4
- Palette EDS complete : eds-dark, eds-cyan, eds-gray, eds-light, eds-gold, eds-white
- Typographies Bebas Neue (heading) et Roboto (body) chargees via Google Fonts
- Schema Prisma valide avec modele Player (id, discordPseudo unique, riotPseudo, email, status, createdAt)
- Backend demarre sur port 3001, endpoint `/api/health` repond `{ data: { status: "ok" } }`
- Frontend build OK (Vite 8), page affiche composant minimal avec charte EDS
- Dockerfile multi-stage (node:22-alpine) et docker-compose.yml avec reseau postgresql-zvmf_default et labels Traefik
- Note : Tailwind v4 utilise `@tailwindcss/vite` au lieu de PostCSS + Autoprefixer, et `@theme` au lieu de `tailwind.config.ts`
- Note : Express 5 installe (derniere version stable), bcryptjs v3 installe
- Note : Prisma 7 genere le client dans `src/generated/prisma` et utilise `prisma.config.ts`

### File List

- `.gitignore` (nouveau)
- `.env.example` (nouveau)
- `README.md` (nouveau)
- `frontend/package.json` (nouveau — genere par Vite)
- `frontend/package-lock.json` (nouveau)
- `frontend/tsconfig.json` (nouveau — genere par Vite)
- `frontend/tsconfig.app.json` (modifie — ajout strict: true)
- `frontend/tsconfig.node.json` (nouveau — genere par Vite)
- `frontend/vite.config.ts` (modifie — ajout plugin Tailwind)
- `frontend/index.html` (modifie — Google Fonts, lang fr, titre)
- `frontend/eslint.config.js` (nouveau — genere par Vite)
- `frontend/src/main.tsx` (nouveau — genere par Vite)
- `frontend/src/App.tsx` (modifie — composant minimal charte EDS)
- `frontend/src/index.css` (modifie — directives Tailwind v4 + theme EDS)
- `frontend/src/pages/.gitkeep` (nouveau)
- `frontend/src/components/.gitkeep` (nouveau)
- `frontend/src/hooks/.gitkeep` (nouveau)
- `frontend/src/contexts/.gitkeep` (nouveau)
- `frontend/src/services/.gitkeep` (nouveau)
- `frontend/src/types/.gitkeep` (nouveau)
- `backend/package.json` (nouveau)
- `backend/package-lock.json` (nouveau)
- `backend/tsconfig.json` (nouveau)
- `backend/nodemon.json` (nouveau)
- `backend/.env.example` (nouveau)
- `backend/.env` (nouveau — genere par Prisma, NON commite)
- `backend/.gitignore` (nouveau — genere par Prisma)
- `backend/Dockerfile` (nouveau)
- `backend/prisma.config.ts` (nouveau — genere par Prisma 7)
- `backend/prisma/schema.prisma` (modifie — modele Player ajoute)
- `backend/src/index.ts` (nouveau)
- `backend/src/app.ts` (nouveau)
- `backend/src/routes/.gitkeep` (nouveau)
- `backend/src/services/.gitkeep` (nouveau)
- `backend/src/middleware/.gitkeep` (nouveau)
- `backend/src/websocket/.gitkeep` (nouveau)
- `backend/src/types/.gitkeep` (nouveau)
- `backend/src/utils/.gitkeep` (nouveau)
- `docker/docker-compose.yml` (nouveau)

### Change Log

- 2026-04-15 : Implementation complete de la story 1.1 — Init projet et design system EDS
