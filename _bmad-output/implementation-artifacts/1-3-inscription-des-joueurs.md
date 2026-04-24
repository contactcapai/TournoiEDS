# Story 1.3 : Inscription des Joueurs

Status: review

## Story

As a **joueur**,
I want **m'inscrire au tournoi via un formulaire simple de 3 champs**,
So that **je peux participer au tournoi en moins de 30 secondes, sans creer de compte**.

## Acceptance Criteria

1. **Given** je suis sur la page d'accueil **When** je remplis le formulaire avec mon pseudo Discord, mon pseudo Riot et mon email, puis je valide **Then** mon inscription est enregistree en base de donnees **And** je vois une confirmation a l'ecran que mon inscription est prise en compte

2. **Given** je remplis le formulaire **When** je laisse un champ obligatoire vide ou je saisis un email invalide **Then** un message d'erreur clair s'affiche a cote du champ concerne **And** l'inscription n'est pas envoyee

3. **Given** je suis deja inscrit avec le meme pseudo Discord **When** je tente de m'inscrire a nouveau **Then** un message m'informe que ce pseudo est deja inscrit **And** aucun doublon n'est cree en base

4. **Given** le formulaire est affiche **When** je le consulte **Then** le CTA d'inscription est clairement visible et mis en valeur (couleur d'accent) **And** les 3 champs sont labels clairement : pseudo Discord, pseudo Riot, email

5. **Given** le backend recoit une requete POST /api/players **When** les donnees sont valides **Then** un joueur est cree avec le statut "inscrit" **And** la reponse suit le format standard `{ data: { id, discordPseudo, riotPseudo } }` (email non expose)

## Tasks / Subtasks

- [x] Task 1 : Creer l'endpoint backend POST /api/players (AC: #1, #2, #3, #5)
  - [x] 1.1 Creer `backend/src/routes/players.ts` avec la route `POST /api/players`
  - [x] 1.2 Valider les champs requis (discordPseudo, riotPseudo, email) — retourner 400 si manquants
  - [x] 1.3 Valider le format email avec une regex simple
  - [x] 1.4 Gerer le doublon sur `discordPseudo` (unique en base) — catcher l'erreur Prisma `P2002` et retourner une erreur 409 avec message "Ce pseudo Discord est deja inscrit"
  - [x] 1.5 Creer le joueur en base via Prisma avec `status: "inscrit"` (default)
  - [x] 1.6 Retourner `{ data: { id, discordPseudo, riotPseudo } }` — NE PAS exposer l'email dans la reponse
  - [x] 1.7 Enregistrer la route dans `backend/src/app.ts`

- [x] Task 2 : Creer le service API frontend (AC: #1)
  - [x] 2.1 Creer `frontend/src/services/api.ts` — instance fetch avec base URL configurable via `import.meta.env.VITE_API_URL` (fallback `http://localhost:3001`)
  - [x] 2.2 Ajouter la fonction `registerPlayer(data: RegisterPlayerInput): Promise<RegisterPlayerResponse>` qui POST vers `/api/players`

- [x] Task 3 : Creer les types TypeScript partages (AC: #5)
  - [x] 3.1 Creer `frontend/src/types/index.ts` avec les types : `RegisterPlayerInput` (discordPseudo, riotPseudo, email), `RegisterPlayerResponse` (id, discordPseudo, riotPseudo), `ApiError` (code, message)

- [x] Task 4 : Creer le composant InscriptionForm (AC: #1, #2, #3, #4)
  - [x] 4.1 Creer `frontend/src/components/inscription/InscriptionForm.tsx`
  - [x] 4.2 3 champs de texte : pseudo Discord, pseudo Riot, email — labels clairs et explicites
  - [x] 4.3 Validation frontend : champs non vides + format email basique
  - [x] 4.4 Afficher les erreurs de validation inline sous chaque champ concerne
  - [x] 4.5 Gerer l'erreur backend 409 (doublon pseudo Discord) — afficher le message sous le champ pseudo Discord
  - [x] 4.6 Bouton CTA "S'inscrire" en couleur d'accent (eds-cyan ou eds-gold), bien visible (UX-DR3, UX-DR15)
  - [x] 4.7 Etat de chargement : bouton desactive + texte "Inscription en cours..." pendant la requete
  - [x] 4.8 Etat de succes : masquer le formulaire et afficher un message de confirmation clair (AC: #1)

- [x] Task 5 : Integrer le formulaire dans la page Home (AC: #1, #4)
  - [x] 5.1 Ajouter une section inscription dans `frontend/src/pages/Home.tsx`, positionnee apres la hero section et avant le reglement
  - [x] 5.2 Titre de section : "Inscription" en `font-heading` avec accent `eds-cyan`
  - [x] 5.3 Le formulaire est centre et bien visible, style coherent avec le reste de la page (charte EDS)

- [x] Task 6 : Ajouter la variable d'environnement API URL (AC: #1)
  - [x] 6.1 Creer `frontend/.env.development` avec `VITE_API_URL=http://localhost:3001`
  - [x] 6.2 Ajouter `VITE_API_URL` dans `frontend/.env.example`

- [x] Task 7 : Validation et tests (AC: #1, #2, #3, #4, #5)
  - [x] 7.1 Verifier que `npm run build` passe sans erreur (frontend + backend)
  - [ ] 7.2 Tester manuellement : inscription reussie, validation champs vides, email invalide, doublon pseudo Discord
  - [ ] 7.3 Verifier le responsive mobile (formulaire lisible, CTA accessible sans scroll horizontal)
  - [x] 7.4 Verifier que l'email n'apparait PAS dans la reponse API publique

## Dev Notes

### Architecture & Patterns a suivre

- **Route backend** : `POST /api/players` — route publique (sans auth), conformement a l'architecture (`API & Communication Patterns > Routes publiques`)
- **Format reponse API** : `{ data: { ... } }` pour le succes, `{ error: { code, message } }` pour les erreurs — [Source: architecture.md#Format Patterns]
- **Codes HTTP** : 201 (creation reussie), 400 (validation), 409 (doublon), 500 (erreur serveur) — [Source: architecture.md#Format Patterns]
- **Prisma** : utiliser le client genere dans `backend/src/generated/prisma` (Prisma 7)
- **Champ unique** : `discordPseudo` a une contrainte `@unique` dans le schema Prisma — l'erreur Prisma `P2002` est levee en cas de doublon
- **Email non expose** : la reponse publique NE DOIT PAS contenir l'email du joueur (FR27, NFR8)
- **Le formulaire est SUR la page d'accueil** (`Home.tsx`), PAS sur une page separee — conformement a l'AC: "Given je suis sur la page d'accueil"

### Schema Prisma existant (NE PAS modifier)

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

Les champs correspondent exactement aux besoins du formulaire. Aucune migration necessaire.

### Configuration Express existante

Le fichier `backend/src/app.ts` contient deja :
- CORS configure (`cors()`)
- JSON parsing (`express.json()`)
- Route health check (`GET /api/health`)

Ajouter la route players dans ce fichier : `app.use('/api', playersRouter);`

### Backend — structure de la route players

```typescript
// backend/src/routes/players.ts
import { Router } from 'express';
import { PrismaClient } from '../generated/prisma';

const router = Router();
const prisma = new PrismaClient();

router.post('/players', async (req, res) => {
  // 1. Validation des champs requis
  // 2. Validation format email
  // 3. Creation en base via Prisma
  // 4. Catch erreur P2002 (doublon discordPseudo) → 409
  // 5. Retourner { data: { id, discordPseudo, riotPseudo } }
});

export default router;
```

### Frontend — service API

```typescript
// frontend/src/services/api.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function registerPlayer(data: RegisterPlayerInput): Promise<...> {
  const response = await fetch(`${API_URL}/api/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  // ...
}
```

Utiliser `fetch` natif — NE PAS installer axios ou autre lib HTTP.

### Tailwind v4 — rappel critique

Les classes personnalisees EDS sont definies via `@theme` dans `frontend/src/index.css` :
- `bg-eds-dark`, `text-eds-cyan`, `text-eds-gold`, `bg-eds-light`, `text-eds-gray`, `text-eds-white`
- `font-heading` (Bebas Neue), `font-body` (Roboto)

NE PAS modifier `index.css`. NE PAS creer de fichier `tailwind.config.ts`.

### UX Design Requirements (obligatoires)

- **UX-DR3** : Formulaire d'inscription — 3 champs (pseudo Discord, pseudo Riot, email) avec CTA clair et visible
- **UX-DR1** : Dark mode par defaut — fond `bg-eds-dark`
- **UX-DR13** : Responsive — le formulaire doit etre utilisable sur mobile
- **UX-DR15** : Couleurs d'accent (cyan, or) pour guider l'oeil — CTA en couleur d'accent

### Anti-patterns a eviter

- NE PAS installer de librairie de formulaires (react-hook-form, formik) — `useState` suffit pour 3 champs
- NE PAS installer axios — utiliser `fetch` natif
- NE PAS installer de librairie UI (shadcn, MUI, Chakra)
- NE PAS creer une page separee `/inscription` — le formulaire est sur la page d'accueil
- NE PAS exposer l'email dans la reponse API publique
- NE PAS modifier le schema Prisma — il est deja correct
- NE PAS modifier `index.css` (config Tailwind v4)
- NE PAS utiliser `any` en TypeScript
- NE PAS instancier `PrismaClient` dans chaque fichier de route — mais pour cette premiere route, une instance locale est acceptable (un service Prisma partage sera mis en place dans les stories suivantes si necessaire)

### Previous Story Intelligence (Story 1.2)

**Etat actuel du frontend :**
- `Home.tsx` contient la hero section + la section reglement avec accordeon — le formulaire d'inscription s'insere ENTRE ces deux sections
- `App.tsx` utilise React Router v7 avec `BrowserRouter` — routes wrappees dans `Layout`
- `Layout.tsx` contient le header (nav) et footer communs
- Tailwind v4 avec `@tailwindcss/vite` — classes EDS disponibles
- Express 5 cote backend, Prisma 7

**Decisions techniques Story 1.2 :**
- Accordeon fait avec `useState` (pas de lib) — meme approche pour le formulaire
- Pas de CSS supplementaire, tout en Tailwind classes

**Fichiers modifies par cette story :**
- `frontend/src/pages/Home.tsx` — ajout section inscription avec le composant InscriptionForm
- `backend/src/app.ts` — ajout import et montage de la route players

**Fichiers crees par cette story :**
- `backend/src/routes/players.ts` — route POST /api/players
- `frontend/src/components/inscription/InscriptionForm.tsx` — composant formulaire
- `frontend/src/services/api.ts` — service d'appel API
- `frontend/src/types/index.ts` — types TypeScript
- `frontend/.env.development` — variable VITE_API_URL

### Project Structure Notes

- La route `POST /api/players` est la premiere route CRUD du projet — elle etablit le pattern pour toutes les routes suivantes
- Le service `api.ts` est le premier service frontend — il etablit le pattern d'appel API pour tout le projet
- Le dossier `components/inscription/` suit la convention d'organisation par feature [Source: architecture.md#Structure Patterns]
- Les types dans `frontend/src/types/index.ts` suivent la convention du projet [Source: architecture.md#Structure Patterns > Frontend]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/prd.md#FR1 - Inscription via formulaire]
- [Source: _bmad-output/planning-artifacts/prd.md#FR2 - Confirmation inscription]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR8 - Emails non exposes]
- [Source: _bmad-output/implementation-artifacts/1-2-page-de-presentation-du-tournoi.md#Completion Notes]
- [Source: backend/prisma/schema.prisma#Player]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Prisma 7 necessite `@prisma/adapter-pg` pour instancier PrismaClient — dependance ajoutee
- Import Prisma 7 : `../generated/prisma/client` (pas `../generated/prisma` qui n'a pas d'index)

### Completion Notes List

- Route POST /api/players creee avec validation complete (champs requis, format email, doublon P2002)
- Format reponse API conforme : `{ data: { id, discordPseudo, riotPseudo } }` — email NON expose
- Codes HTTP : 201 (succes), 400 (validation), 409 (doublon), 500 (erreur serveur)
- Service API frontend avec fetch natif, base URL configurable via VITE_API_URL
- Types TypeScript : RegisterPlayerInput, RegisterPlayerResponse, ApiError
- Composant InscriptionForm avec validation frontend inline, gestion erreur 409, etat de chargement et etat de succes
- Integration dans Home.tsx entre hero section et reglement
- CTA "S'inscrire" en bg-eds-cyan, conforme UX-DR3/UX-DR15
- Builds frontend et backend passent sans erreur
- Tests manuels (7.2) et verification responsive (7.3) restent a faire par l'utilisateur
- Correctifs post-review : fallback API URL corrige (3001), gestion erreurs globales avec bandeau dedie au lieu d'assigner au champ discordPseudo

### Change Log

- 2026-04-16 : Implementation complete de la story 1.3 — endpoint backend, service API, types, composant formulaire, integration Home
- 2026-04-16 : Correctifs post-review — 2 findings patch resolus (fallback URL, erreur globale UI)

### File List

- backend/src/routes/players.ts (cree)
- backend/src/app.ts (modifie — ajout import et montage route players)
- frontend/src/types/index.ts (cree)
- frontend/src/services/api.ts (cree)
- frontend/src/components/inscription/InscriptionForm.tsx (cree)
- frontend/src/pages/Home.tsx (modifie — ajout section inscription)
- frontend/.env.development (cree)
- frontend/.env.example (cree)

### Review Findings

- [x] [Review][Patch] Fallback API URL [frontend/src/services/api.ts:3] — corrige, fallback mis a 3001
- [x] [Review][Patch] Gestion des erreurs globales assignée au champ Discord [frontend/src/components/inscription/InscriptionForm.tsx:58] — corrige, ajout state globalError + bandeau d'erreur dedie

