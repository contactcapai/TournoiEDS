# Story 2.1 : Authentification Admin

Status: done

## Story

As a **admin (Brice)**,
I want **me connecter au backoffice via un login simple (identifiant/mot de passe)**,
So that **le backoffice est protege et accessible uniquement par moi**.

## Acceptance Criteria

1. **Given** je suis sur la page `/admin/login` **When** je saisis un identifiant et mot de passe valides et je valide **Then** un token JWT est genere avec une expiration de 24h **And** je suis redirige vers le backoffice `/admin`

2. **Given** je suis sur la page `/admin/login` **When** je saisis des identifiants incorrects **Then** un message d'erreur s'affiche ("Identifiants incorrects") **And** je reste sur la page de login

3. **Given** je ne suis pas authentifie **When** je tente d'acceder a une route `/admin/*` **Then** je suis redirige vers `/admin/login`

4. **Given** je suis authentifie **When** je fais une requete vers `/api/admin/*` **Then** le header `Authorization: Bearer <token>` est verifie par le middleware **And** la requete est traitee normalement

5. **Given** mon token JWT a expire (>24h) **When** je fais une requete vers `/api/admin/*` **Then** je recois une erreur 401 **And** je suis redirige vers la page de login

6. **Given** le mot de passe admin est stocke en base **When** je verifie le stockage **Then** le mot de passe est hashe avec bcrypt (jamais en clair)

## Tasks / Subtasks

- [x] Task 1 : Ajouter le modele Admin au schema Prisma et creer le seed (AC: #6)
  - [x] 1.1 Ajouter le modele `Admin` dans `backend/prisma/schema.prisma` : id, username (unique), passwordHash, createdAt
  - [x] 1.2 Creer le fichier `backend/prisma/seed.ts` qui insere un admin par defaut (username + mot de passe hashe via bcrypt)
  - [x] 1.3 Lancer `npx prisma migrate dev` pour generer la migration
  - [x] 1.4 Lancer le seed pour inserer l'admin

- [x] Task 2 : Creer la route d'authentification backend (AC: #1, #2)
  - [x] 2.1 Creer `backend/src/routes/auth.ts` avec endpoint `POST /api/auth/login`
  - [x] 2.2 Valider les champs requis (username, password)
  - [x] 2.3 Verifier le username en base puis comparer le mot de passe avec bcrypt
  - [x] 2.4 Si valide : generer un token JWT (expiration 24h) et retourner `{ data: { token } }`
  - [x] 2.5 Si invalide : retourner 401 `{ error: { code: "INVALID_CREDENTIALS", message: "Identifiants incorrects" } }`
  - [x] 2.6 Enregistrer la route dans `backend/src/app.ts`

- [x] Task 3 : Creer le middleware d'authentification backend (AC: #4, #5)
  - [x] 3.1 Creer `backend/src/middleware/auth.ts` avec le middleware `requireAuth`
  - [x] 3.2 Extraire le token du header `Authorization: Bearer <token>`
  - [x] 3.3 Verifier et decoder le JWT — si invalide ou expire, retourner 401
  - [x] 3.4 Monter le middleware sur le prefix `/api/admin` dans `backend/src/app.ts`
  - [x] 3.5 Creer un endpoint placeholder `GET /api/admin/health` pour tester que le middleware fonctionne

- [x] Task 4 : Creer le AuthContext et le hook useAuth frontend (AC: #1, #3, #5)
  - [x] 4.1 Creer `frontend/src/contexts/AuthContext.tsx` : state token + isAuthenticated + login() + logout()
  - [x] 4.2 Stocker le token dans localStorage (cle `auth_token`)
  - [x] 4.3 Creer `frontend/src/hooks/useAuth.ts` pour acceder au contexte
  - [x] 4.4 Wrapper l'App dans le AuthProvider dans `frontend/src/App.tsx`

- [x] Task 5 : Creer la page AdminLogin frontend (AC: #1, #2)
  - [x] 5.1 Creer `frontend/src/pages/AdminLogin.tsx` : formulaire avec 2 champs (identifiant, mot de passe) + bouton connexion
  - [x] 5.2 Appeler `POST /api/auth/login` via le service API
  - [x] 5.3 Si succes : stocker le token via AuthContext et rediriger vers `/admin`
  - [x] 5.4 Si erreur : afficher le message d'erreur ("Identifiants incorrects")
  - [x] 5.5 Appliquer le style charte EDS (fond `bg-eds-dark`, titre `font-heading text-eds-cyan`, bouton accent)

- [x] Task 6 : Creer la page Admin placeholder et le composant ProtectedRoute (AC: #3)
  - [x] 6.1 Creer `frontend/src/components/admin/ProtectedRoute.tsx` : verifie isAuthenticated, redirige vers `/admin/login` si non connecte
  - [x] 6.2 Creer `frontend/src/pages/Admin.tsx` : page placeholder "Backoffice Admin" (sera enrichie dans les stories suivantes)
  - [x] 6.3 Ajouter la fonction `loginAdmin` dans `frontend/src/services/api.ts`
  - [x] 6.4 Ajouter les types `LoginInput` et `LoginResponse` dans `frontend/src/types/index.ts`

- [x] Task 7 : Enregistrer les routes dans App.tsx (AC: #1, #3)
  - [x] 7.1 Ajouter la route `/admin/login` → `<AdminLogin />` (sans Layout)
  - [x] 7.2 Ajouter la route `/admin` → `<ProtectedRoute><Admin /></ProtectedRoute>` (sans Layout — le backoffice aura son propre layout plus tard)

- [x] Task 8 : Validation (AC: #1-#6)
  - [x] 8.1 `npm run build` passe sans erreur (frontend + backend)
  - [x] 8.2 Tester login valide : token JWT recu, redirection vers `/admin`
  - [x] 8.3 Tester login invalide : message d'erreur affiche
  - [x] 8.4 Tester acces `/admin` sans auth : redirection vers `/admin/login`
  - [x] 8.5 Tester requete `GET /api/admin/health` avec token valide : 200
  - [x] 8.6 Tester requete `GET /api/admin/health` sans token : 401
  - [x] 8.7 Verifier que le mot de passe en base est hashe (jamais en clair)

## Dev Notes

### Architecture & Patterns a suivre

**Backend — Routes d'authentification :**
- Endpoint public : `POST /api/auth/login` — PAS sous `/api/admin/` car l'admin doit pouvoir se connecter sans etre deja authentifie
- Routes admin protegees : prefixe `/api/admin/*` — toutes ces routes passent par le middleware JWT
- Format de reponse : `{ data: { token } }` en succes, `{ error: { code, message } }` en erreur
- [Source: architecture.md#API & Communication Patterns]

**Backend — JWT :**
- Librairie : `jsonwebtoken` (deja installe dans package.json)
- Secret : variable d'environnement `JWT_SECRET` dans `.env`
- Payload : `{ adminId: number, username: string }`
- Expiration : `24h` (couvre une journee de tournoi)
- [Source: architecture.md#Authentication & Security]

**Backend — bcrypt :**
- Librairie : `bcryptjs` (deja installe dans package.json, avec les types `@types/bcryptjs`)
- Salt rounds : 10 (defaut bcryptjs)
- Le seed doit hasher le mot de passe avant insertion

**Frontend — AuthContext :**
- Pattern : React Context avec Provider, conforme a l'architecture (`contexts/AuthContext.tsx`)
- Stocker le token dans localStorage pour persistance entre refreshs
- Exposer : `token`, `isAuthenticated`, `login(token)`, `logout()`
- Au chargement : lire le token depuis localStorage et verifier s'il est encore valide (cote client, verification basique de l'expiration)
- [Source: architecture.md#Frontend Architecture]

**Frontend — Routing :**
- Import depuis `'react-router'` (PAS `'react-router-dom'`) — convention du projet confirmee dans stories precedentes
- React Router v7
- Les routes admin n'utilisent PAS le `<Layout>` public — le backoffice aura un layout different
- [Source: App.tsx lignes 30-33 — commentaires routes futures]

### Etat actuel du code (ce qui existe deja)

**Backend :**
- `backend/src/app.ts` : Express 5 avec CORS et JSON middleware. Route `/api` pour players.
- `backend/src/routes/players.ts` : route POST /api/players pour inscription. Utilise Prisma avec adapter PG.
- `backend/package.json` : `bcryptjs`, `jsonwebtoken`, `socket.io` deja installes. Types `@types/bcryptjs` et `@types/jsonwebtoken` presents.
- `backend/prisma/schema.prisma` : modele `Player` uniquement. Generator `prisma-client` avec output `../src/generated/prisma`.
- **PAS de fichier seed.ts existant**
- **PAS de middleware auth existant**
- **PAS de route auth existante**

**Frontend :**
- `frontend/src/App.tsx` : React Router v7, routes `/` et `/mentions-legales`. Commentaires indiquant les routes futures : `/admin/login` et `/admin`.
- `frontend/src/services/api.ts` : service API avec fetch natif. `API_URL` via `VITE_API_URL` ou fallback `http://localhost:3001`.
- `frontend/src/types/index.ts` : types `RegisterPlayerInput`, `RegisterPlayerResponse`, `ApiError`.
- **PAS de AuthContext existant**
- **PAS de hook useAuth existant**
- **PAS de page AdminLogin existante**

**Dependances deja disponibles (NE PAS reinstaller) :**
- Backend : `bcryptjs@3.0.3`, `jsonwebtoken@9.0.3`, `@types/bcryptjs`, `@types/jsonwebtoken`
- Frontend : `react-router@7.14.1`

### Pattern Prisma specifique au projet

Le projet utilise Prisma 7 avec l'adapter PostgreSQL (`@prisma/adapter-pg`). L'instance PrismaClient se cree ainsi :
```typescript
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```
**Reutiliser ce meme pattern** dans les nouveaux fichiers de routes. Idealement, extraire l'instance Prisma dans un fichier partage (`backend/src/prisma/client.ts`) pour eviter de creer plusieurs connexions.

### Modele Admin (schema Prisma)

```prisma
model Admin {
  id           Int      @id @default(autoincrement())
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
```
- Le champ est `passwordHash` (pas `password`) pour signaler que c'est TOUJOURS un hash
- Username unique pour empecher les doublons
- Pas de champ email — l'admin est un compte technique, pas un utilisateur inscrit

### Seed Admin

Le fichier `backend/prisma/seed.ts` doit :
1. Hasher un mot de passe par defaut avec bcrypt (salt rounds = 10)
2. Inserer ou mettre a jour (upsert) l'admin dans la table Admin
3. Le mot de passe par defaut doit etre configurable via variable d'environnement `ADMIN_DEFAULT_PASSWORD` (ou un defaut en dev)
4. Configurer le seed dans `package.json` : `"prisma": { "seed": "npx ts-node prisma/seed.ts" }`

### Configuration .env necessaire

Ajouter dans `backend/.env` (et `.env.example`) :
```
JWT_SECRET=une-cle-secrete-longue-et-aleatoire
ADMIN_DEFAULT_PASSWORD=motdepasse-dev
```
**CRITICAL :** Le `JWT_SECRET` en production doit etre une chaine aleatoire longue (>= 32 caracteres). Ne JAMAIS committer un vrai secret.

### Frontend — Fonction API loginAdmin

Ajouter dans `frontend/src/services/api.ts` :
```typescript
export async function loginAdmin(
  data: LoginInput
): Promise<{ data: LoginResponse } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    return { error: result.error as ApiError };
  }
  return { data: result.data as LoginResponse };
}
```
Suit exactement le meme pattern que `registerPlayer` existant.

### Frontend — Types a ajouter

Ajouter dans `frontend/src/types/index.ts` :
```typescript
export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}
```

### Frontend — ProtectedRoute

Pattern simple de route protegee :
```typescript
// frontend/src/components/admin/ProtectedRoute.tsx
import { Navigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
```

### Tailwind v4 — classes disponibles (charte EDS)

Classes personnalisees EDS definies via `@theme` dans `frontend/src/index.css` :
- Fond : `bg-eds-dark` (#29265B)
- Titres : `font-heading text-eds-cyan` ou `text-eds-gold`
- Corps : `font-body text-eds-light`
- Texte secondaire : `text-eds-gray`
- Accents : `text-eds-cyan` (#80E2ED), `text-eds-gold` (#DAB265)

NE PAS modifier `index.css`. NE PAS creer de fichier `tailwind.config.ts`.

### Page AdminLogin — guide visuel

La page de login admin est SANS le Layout public (pas de header/nav/footer du site public). Style minimaliste :
- Fond `bg-eds-dark` plein ecran
- Formulaire centre verticalement et horizontalement
- Titre "Backoffice Admin" en `font-heading text-eds-cyan`
- 2 champs : identifiant + mot de passe, style coherent avec l'InscriptionForm
- Bouton connexion avec accent `bg-eds-cyan text-eds-dark`
- Message d'erreur en rouge si identifiants incorrects
- Desktop-only (pas besoin de responsive mobile pour le backoffice — UX-DR13)

### UX Design Requirements

- **UX-DR1** : Dark mode par defaut — fond `bg-eds-dark`
- **UX-DR13** : Backoffice desktop-only — pas de responsive mobile necessaire
- **UX-DR12** : Charte EDS — typographies Bebas Neue (titres) + Roboto (corps)

### Anti-patterns a eviter

- NE PAS stocker le mot de passe admin en clair — TOUJOURS hasher avec bcrypt
- NE PAS utiliser un JWT_SECRET code en dur dans le code source — utiliser une variable d'environnement
- NE PAS creer de route d'inscription admin — l'admin est cree uniquement par le seed
- NE PAS utiliser `any` en TypeScript — typer correctement les payloads JWT
- NE PAS importer depuis `'react-router-dom'` — utiliser `'react-router'` (convention du projet)
- NE PAS installer de nouvelles dependances — bcryptjs, jsonwebtoken et leurs types sont deja dans package.json
- NE PAS mettre la page admin dans le `<Layout>` public — le backoffice a un layout separe
- NE PAS creer plusieurs instances PrismaClient — extraire dans un fichier partage ou reutiliser le pattern existant
- NE PAS utiliser des cookies pour stocker le JWT — utiliser localStorage + header Authorization

### Previous Story Intelligence (Epic 1)

**Decisions techniques confirmees par les stories 1.1 a 1.4 :**
- Tailwind v4 avec `@tailwindcss/vite` — classes EDS via `@theme` dans `index.css`
- React Router v7 : import depuis `'react-router'` (pas `'react-router-dom'`)
- Express 5 (pas Express 4) — le middleware fonctionne avec les memes patterns
- Prisma 7 avec adapter PG — generator output dans `src/generated/prisma`
- Pattern service API : fetch natif avec `API_URL` configurable via env var
- Format reponse : `{ data: {...} }` succes, `{ error: { code, message } }` erreur

**Lecons des stories precedentes :**
- Fallback API URL doit pointer vers port 3001 (`http://localhost:3001`)
- Responsive H1 : utiliser `text-2xl sm:text-3xl` + `break-words` pour eviter les debordements
- Gestion d'erreurs : state dedie pour les erreurs globales plutot que d'assigner au premier champ

**Fichiers existants crees par stories precedentes :**
- `frontend/src/pages/Home.tsx` — page d'accueil avec hero + inscription + reglement
- `frontend/src/pages/MentionsLegales.tsx` — mentions legales RGPD
- `frontend/src/components/common/Layout.tsx` — layout public (header, nav, footer)
- `frontend/src/components/inscription/InscriptionForm.tsx` — formulaire d'inscription
- `frontend/src/services/api.ts` — service API (fetch natif)
- `frontend/src/types/index.ts` — types TypeScript (RegisterPlayerInput, RegisterPlayerResponse, ApiError)
- `frontend/src/App.tsx` — routes React Router v7
- `frontend/src/index.css` — config Tailwind v4 avec @theme EDS
- `backend/src/app.ts` — Express 5, CORS, JSON, route players
- `backend/src/routes/players.ts` — POST /api/players
- `backend/prisma/schema.prisma` — modele Player

### Project Structure Notes

**Nouveaux fichiers a creer :**
- `backend/prisma/seed.ts` — dans `backend/prisma/` conformement a la structure architecture
- `backend/src/routes/auth.ts` — dans `backend/src/routes/` [Source: architecture.md#Structure Patterns > Backend]
- `backend/src/middleware/auth.ts` — dans `backend/src/middleware/` [Source: architecture.md#Structure Patterns > Backend]
- `frontend/src/contexts/AuthContext.tsx` — dans `frontend/src/contexts/` [Source: architecture.md#Structure Patterns > Frontend]
- `frontend/src/hooks/useAuth.ts` — dans `frontend/src/hooks/` [Source: architecture.md#Structure Patterns > Frontend]
- `frontend/src/pages/AdminLogin.tsx` — dans `frontend/src/pages/` (PascalCase)
- `frontend/src/pages/Admin.tsx` — dans `frontend/src/pages/` (PascalCase)
- `frontend/src/components/admin/ProtectedRoute.tsx` — dans `frontend/src/components/admin/`

**Fichiers a modifier :**
- `backend/prisma/schema.prisma` — ajouter modele Admin
- `backend/src/app.ts` — ajouter routes auth + middleware admin
- `backend/package.json` — ajouter config seed Prisma
- `frontend/src/App.tsx` — ajouter routes /admin/login et /admin, wrapper AuthProvider
- `frontend/src/services/api.ts` — ajouter fonction loginAdmin
- `frontend/src/types/index.ts` — ajouter types LoginInput et LoginResponse

**Optionnel mais recommande :**
- `backend/src/prisma/client.ts` — instance Prisma partagee (evite la duplication dans chaque fichier de route)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1 - Authentification Admin]
- [Source: _bmad-output/planning-artifacts/prd.md#FR36 - Login admin]
- [Source: _bmad-output/planning-artifacts/prd.md#FR37 - Backoffice protege par auth]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR5 - Auth identifiant/mot de passe]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR6 - Mots de passe hashes]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/implementation-artifacts/1-4-mentions-legales-rgpd.md#Previous Story Intelligence]
- [Source: backend/package.json — bcryptjs et jsonwebtoken deja installes]
- [Source: frontend/src/App.tsx#Routes futures commentees — /admin/login et /admin]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Migration Prisma : drift detecte sur la base, necessitant un `prisma migrate reset` avant la migration `add-admin-model`
- Prisma 7 utilise `prisma.config.ts` pour la config seed (pas `package.json`)
- Client Prisma regenere manuellement apres migration (`npx prisma generate`)

### Completion Notes List
- ✅ Task 1 : Modele Admin ajoute au schema Prisma, migration appliquee, seed cree et execute. Instance Prisma partagee extraite dans `backend/src/prisma/client.ts`
- ✅ Task 2 : Route `POST /api/auth/login` creee avec validation, bcrypt compare, generation JWT 24h. Format reponse conforme aux patterns existants
- ✅ Task 3 : Middleware `requireAuth` cree, monte sur `/api/admin/*`. Endpoint `GET /api/admin/health` ajoute pour verification
- ✅ Task 4 : AuthContext avec token localStorage, verification expiration cote client, hook useAuth
- ✅ Task 5 : Page AdminLogin avec formulaire EDS, gestion erreurs, redirection apres login
- ✅ Task 6 : ProtectedRoute avec redirection, page Admin placeholder avec bouton deconnexion, fonction API loginAdmin, types LoginInput/LoginResponse
- ✅ Task 7 : Routes `/admin/login` et `/admin` ajoutees dans App.tsx, AuthProvider wrappe l'app
- ✅ Task 8 : Build OK (frontend + backend), tests API passes (login valide/invalide, middleware auth, hash bcrypt)

### Change Log
- 2026-04-16 : Implementation complete de la story 2.1 Authentification Admin
- 2026-04-16 : Corrections code review — 5 findings resolus (timing attack, case-insensitive login, rate limiting, JWT_SECRET startup check, API timeout)

### File List

**Nouveaux fichiers :**
- backend/prisma/schema.prisma (modifie — ajout modele Admin)
- backend/prisma/seed.ts (nouveau)
- backend/prisma/migrations/20260416095831_add_admin_model/migration.sql (nouveau)
- backend/prisma.config.ts (modifie — ajout config seed)
- backend/src/prisma/client.ts (nouveau — instance Prisma partagee)
- backend/src/routes/auth.ts (nouveau)
- backend/src/middleware/auth.ts (nouveau)
- backend/src/app.ts (modifie — routes auth + middleware admin + health admin)
- backend/package.json (modifie — config seed Prisma)
- backend/.env (modifie — ajout JWT_SECRET, ADMIN_DEFAULT_PASSWORD)
- backend/.env.example (modifie — ajout JWT_SECRET, ADMIN_DEFAULT_PASSWORD)
- frontend/src/contexts/AuthContext.tsx (nouveau)
- frontend/src/hooks/useAuth.ts (nouveau)
- frontend/src/pages/AdminLogin.tsx (nouveau)
- frontend/src/pages/Admin.tsx (nouveau)
- frontend/src/components/admin/ProtectedRoute.tsx (nouveau)
- frontend/src/services/api.ts (modifie — ajout loginAdmin)
- frontend/src/types/index.ts (modifie — ajout LoginInput, LoginResponse)
- frontend/src/App.tsx (modifie — routes admin, AuthProvider)

### Review Findings

- [x] [Review][Patch] Vulnérabilité aux attaques temporelles (Timing Attack) [backend/src/routes/auth.ts:31]
- [x] [Review][Patch] Sensibilité à la casse sur l'identifiant (Admin vs admin) [backend/src/routes/auth.ts:28]
- [x] [Review][Patch] Absence de Rate Limiting sur la route de login [backend/src/routes/auth.ts:8]
- [x] [Review][Patch] Vérification répétée de JWT_SECRET dans le middleware [backend/src/middleware/auth.ts:30]
- [x] [Review][Patch] Absence de timeout sur l'appel API frontend [frontend/src/pages/AdminLogin.tsx:20]
