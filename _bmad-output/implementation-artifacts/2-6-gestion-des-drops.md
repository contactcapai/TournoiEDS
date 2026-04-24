# Story 2.6 : Gestion des Drops

Status: done

## Story

As a **admin (Brice)**,
I want **marquer un joueur comme "drop" en cours de journee de qualification**,
So that **le joueur est retire des rounds suivants sans perdre ses points acquis, et les lobbies sont recalcules correctement**.

## Acceptance Criteria

1. **Given** un joueur est actif dans la journee en cours **When** je clique sur "Marquer drop" a cote de son nom (gros bouton — UX-DR11) **Then** le joueur est marque avec le statut "dropped" **And** une confirmation est demandee avant validation

2. **Given** un joueur est marque "dropped" **When** les lobbies du round suivant sont generes **Then** le joueur droppe n'est pas inclus dans les lobbies **And** le nombre total de joueurs actifs est diminue d'un

3. **Given** un joueur est marque "dropped" **When** je consulte le classement **Then** ses points acquis avant le drop sont conserves dans le classement **And** sa moyenne est calculee sur les rounds effectivement joues

4. **Given** un joueur droppe etait dans un lobby de 8 **When** les lobbies suivants sont generes **Then** la redistribution tient compte du nombre reduit de joueurs **And** un lobby peut passer a 7 joueurs ou moins

## Tasks / Subtasks

- [x] Task 1 : Backend — Ajouter le statut "dropped" dans admin.ts (AC: #1)
  - [x] 1.1 Ajouter `'dropped'` dans `ALLOWED_STATUSES` (ligne 8 de `admin.ts`)
  - [x] 1.2 Verifier que le PATCH `/api/admin/players/:id` accepte `{ status: 'dropped' }` sans autre modification

- [x] Task 2 : Backend — Verifier le filtrage des joueurs droppes dans tournament.ts (AC: #2, #4)
  - [x] 2.1 Confirmer que la requete `prisma.player.findMany({ where: { status: 'inscrit' } })` (ligne ~153 de `tournament.ts`) exclut deja les joueurs `'dropped'` automatiquement
  - [x] 2.2 Confirmer que le systeme suisse (round 2+) filtre aussi par `status: 'inscrit'` avant de calculer le classement et generer les lobbies
  - [x] 2.3 Si un filtre manque → l'ajouter. Si le filtre est deja correct → pas de modification

- [x] Task 3 : Backend — Verifier la conservation des points et le calcul de la moyenne (AC: #3)
  - [x] 3.1 Confirmer que `calculatePlayerStats` calcule `average = totalScore / roundsPlayed` (pas totalRounds) — c'est deja le cas dans `pointsCalculator.ts` ligne 48
  - [x] 3.2 Confirmer que la route `/validate` et le classement conservent les resultats des joueurs droppes (les LobbyPlayer existants ne sont pas supprimes au drop)
  - [x] 3.3 Si un probleme est detecte → corriger. Sinon → pas de modification

- [x] Task 4 : Frontend — Ajouter le bouton "Marquer drop" dans DayManager.tsx (AC: #1)
  - [x] 4.1 Ajouter un composant/section "Joueurs actifs" dans DayManager affichant la liste des joueurs avec statut `'inscrit'` pendant une journee active
  - [x] 4.2 Ajouter un bouton "Marquer drop" a cote de chaque joueur actif (style gros bouton UX-DR11)
  - [x] 4.3 Implementer `window.confirm()` pour demander confirmation avant le drop
  - [x] 4.4 Appeler `updatePlayer(token, playerId, { status: 'dropped' })` via `api.ts` (fonction existante)
  - [x] 4.5 Rafraichir la liste des joueurs et le compteur apres le drop

- [x] Task 5 : Frontend — Afficher visuellement les joueurs droppes (AC: #3)
  - [x] 5.1 Dans la liste des joueurs de DayManager, afficher les joueurs droppes en grise/barre (UX-DR6 — preparer pour la page publique aussi)
  - [x] 5.2 Le bouton "Marquer drop" ne doit PAS apparaitre pour un joueur deja droppe
  - [x] 5.3 Optionnel : afficher le nombre de joueurs droppes a cote du compteur de joueurs actifs

- [x] Task 6 : Frontend — Mettre a jour PlayerManager.tsx pour supporter le statut "dropped" (AC: #1)
  - [x] 6.1 Mettre a jour `handleStatusChange` pour accepter `'dropped'` en plus de `'inscrit'` et `'absent'`
  - [x] 6.2 Ajouter un bouton "Marquer drop" distinct du bouton "Retirer" dans la liste des joueurs
  - [x] 6.3 Afficher l'etat "Dropped" visuellement (badge ou texte) pour les joueurs avec `status === 'dropped'`
  - [x] 6.4 Permettre la reinscription d'un joueur droppe (bouton "Reinscrire" → `status: 'inscrit'`)

- [x] Task 7 : Validation (AC: #1-#4)
  - [x] 7.1 `npm run build` passe sans erreur (frontend + backend)
  - [x] 7.2 Tests existants passent (lobbyGenerator, swissSystem, pointsCalculator) — pas de regression
  - [x] 7.3 Tester : marquer un joueur drop → statut change en base
  - [x] 7.4 Tester : generer lobbies apres drop → joueur exclu
  - [x] 7.5 Tester : classement apres drop → points conserves, moyenne sur rounds joues uniquement
  - [x] 7.6 Tester : UI confirmation dialog avant drop
  - [x] 7.7 Tester : joueur droppe visible en grise dans l'interface

## Dev Notes

### Architecture & Patterns a suivre

**Principe cle : le drop est un changement de statut, pas une suppression.**

Le joueur droppe conserve toutes ses donnees (Player, LobbyPlayer, Results). Son statut passe de `'inscrit'` a `'dropped'`. Les filtres existants sur `status: 'inscrit'` l'excluent automatiquement des rounds suivants.

**Modification backend minimale — admin.ts :**

Emplacement : `backend/src/routes/admin.ts` ligne 8 [Source: backend/src/routes/admin.ts]

```typescript
// AVANT :
const ALLOWED_STATUSES = ['inscrit', 'absent'] as const;

// APRES :
const ALLOWED_STATUSES = ['inscrit', 'absent', 'dropped'] as const;
```

C'est la SEULE modification backend strictement necessaire. Le reste du backend fonctionne deja correctement grace au filtre `status: 'inscrit'`.

**Verification des filtres existants dans tournament.ts :**

Le filtre des joueurs actifs est a la ligne ~153 de `tournament.ts` :
```typescript
const activePlayers = await prisma.player.findMany({
  where: { status: 'inscrit' },
  select: { id: true },
});
```
Ce filtre exclut DEJA tout joueur dont le statut n'est pas `'inscrit'` — y compris `'dropped'`. Pas de modification requise.

Le systeme suisse (round 2+, ligne ~171-222) recalcule le classement et genere les lobbies a partir des joueurs actifs filtres par `status: 'inscrit'`. Les joueurs droppes sont automatiquement exclus.

**Conservation des points (pas de modification requise) :**

`calculatePlayerStats` dans `pointsCalculator.ts` (ligne 48) calcule :
```typescript
const average = Math.round((totalScore / roundsPlayed) * 100) / 100;
```
`roundsPlayed = results.length` — seuls les rounds effectivement joues sont comptes. Un joueur qui drop apres 3 rounds a une moyenne sur 3 rounds, pas sur le total de rounds de la journee.

Les resultats (LobbyPlayer) ne sont PAS supprimes au drop — ils restent en base et sont utilises pour le classement.

**Frontend — Bouton drop dans DayManager.tsx :**

Le composant DayManager affiche la gestion d'une journee active. Le bouton "Marquer drop" doit etre visible :
- Pendant une journee en cours (day existe et n'est pas terminee)
- Pour chaque joueur actif (`status === 'inscrit'`)
- Style : gros bouton rouge/orange bien visible (UX-DR11), type warning

```tsx
{/* Section joueurs actifs avec option drop */}
<div className="mb-6">
  <h3 className="font-heading text-eds-cyan text-lg mb-3">
    Joueurs actifs ({activePlayerCount})
  </h3>
  {activePlayers.map((player) => (
    <div key={player.id} className="flex items-center justify-between py-2 border-b border-eds-gray/20">
      <span className="font-body text-eds-light">{player.discordPseudo}</span>
      <button
        onClick={() => handleDrop(player)}
        className="bg-red-600 hover:bg-red-700 text-white font-heading px-4 py-2 rounded text-sm"
      >
        Marquer drop
      </button>
    </div>
  ))}
</div>
```

**Logique du drop dans DayManager :**

```typescript
async function handleDrop(player: Player) {
  const confirmed = window.confirm(
    `Confirmer le drop de ${player.discordPseudo} ? Il sera retire des rounds suivants mais conservera ses points.`
  );
  if (!confirmed) return;
  
  const result = await updatePlayer(token, player.id, { status: 'dropped' });
  if ('error' in result) {
    // Afficher erreur
    return;
  }
  // Rafraichir la liste des joueurs
  // Mettre a jour le compteur de joueurs actifs
}
```

**IMPORTANT — Ou afficher la liste des joueurs et le bouton drop :**
- DayManager est le composant le plus pertinent car c'est la qu'on gere la journee en cours
- Il faut charger la liste des joueurs actifs (GET /api/admin/players filtres par status) dans DayManager
- Utiliser `fetchPlayers(token)` existant dans `api.ts` (ligne ~56) — retourne tous les joueurs
- Filtrer cote frontend : `players.filter(p => p.status === 'inscrit')` pour les actifs, `players.filter(p => p.status === 'dropped')` pour les droppes

**Frontend — Mise a jour PlayerManager.tsx :**

PlayerManager (367 lignes) gere la liste CRUD des joueurs avant/apres le tournoi. Il faut aussi supporter le statut `'dropped'` :

1. Ligne 75-99 : `handleStatusChange` — ajouter `'dropped'` au type union :
```typescript
// AVANT :
async function handleStatusChange(player: Player, newStatus: 'inscrit' | 'absent')

// APRES :
async function handleStatusChange(player: Player, newStatus: 'inscrit' | 'absent' | 'dropped')
```

2. Lignes 337-353 : Section d'affichage des boutons d'action — ajouter un bouton "Marquer drop" pour les joueurs inscrits, et afficher un badge "Dropped" pour les joueurs droppes :
```tsx
{player.status === 'inscrit' && (
  <>
    <button onClick={() => handleStatusChange(player, 'absent')}>Retirer</button>
    <button onClick={() => handleStatusChange(player, 'dropped')}>Marquer drop</button>
  </>
)}
{player.status === 'dropped' && (
  <>
    <span className="text-red-400 font-body text-sm">Dropped</span>
    <button onClick={() => handleStatusChange(player, 'inscrit')}>Reinscrire</button>
  </>
)}
{player.status === 'absent' && (
  <button onClick={() => handleStatusChange(player, 'inscrit')}>Reinscrire</button>
)}
```

### Etat actuel du code (ce qui existe deja)

**Schema Prisma (`backend/prisma/schema.prisma`) :**
- `Player.status` est un `String @default("inscrit")` — accepte n'importe quelle valeur string
- Pas de migration necessaire — `'dropped'` est une nouvelle valeur string, pas un changement de schema
- Les LobbyPlayer existants ne sont PAS supprimes au changement de statut → points conserves

**Backend (`admin.ts`, 180 lignes) :**
- PATCH `/api/admin/players/:id` — route existante pour changer le statut
- Ligne 8 : `ALLOWED_STATUSES = ['inscrit', 'absent']` — **A MODIFIER pour ajouter 'dropped'**
- Le reste de la route fonctionne deja (validation, update Prisma, reponse JSON)

**Backend (`tournament.ts`, 542 lignes) :**
- Ligne ~153 : filtre `status: 'inscrit'` dans generate-lobbies → exclut deja les droppes
- Ligne ~171-222 : systeme suisse filtre aussi les joueurs actifs → OK
- Ligne ~389-472 : route /validate calcule le classement cumule → inclut les resultats des droppes (correct, leurs points sont conserves)
- **PAS DE MODIFICATION REQUISE** dans tournament.ts

**Backend (`pointsCalculator.ts`, 59 lignes) :**
- `calculatePlayerStats` : `average = totalScore / roundsPlayed` → correct pour les drops
- **PAS DE MODIFICATION REQUISE**

**Frontend (`api.ts`, 183 lignes) :**
- `updatePlayer(token, playerId, data)` — ligne 77-93 — accepte `{ status: string }` → fonctionne deja pour `'dropped'`
- `fetchPlayers(token)` — ligne ~56 — retourne tous les joueurs → filtre frontend necessaire
- **PAS DE MODIFICATION REQUISE** dans api.ts

**Frontend (`types/index.ts`, 91 lignes) :**
- `Player.status: string` — type generique, accepte deja `'dropped'`
- **PAS DE MODIFICATION REQUISE** (pas besoin de changer le type string en union, ca casserait la retrocompatibilite)

**Frontend (`DayManager.tsx`, 268 lignes) :**
- Affiche la gestion d'une journee (rounds, lobbies, validation)
- Affiche un compteur "X joueurs actifs" mais ne charge PAS la liste des joueurs individuels actuellement
- **A MODIFIER** : ajouter le chargement de la liste des joueurs + bouton drop

**Frontend (`PlayerManager.tsx`, 367 lignes) :**
- CRUD complet des joueurs avec toggle inscrit/absent
- **A MODIFIER** : ajouter support statut 'dropped'

**Dependances deja disponibles (NE PAS reinstaller) :**
- Backend : Express 5, Prisma 7, bcryptjs, jsonwebtoken, cors, socket.io
- Frontend : React 19, react-router 7, Tailwind CSS v4
- Tests : node:test + node:assert/strict

### Tailwind v4 — classes disponibles (charte EDS)

Classes personnalisees EDS definies via `@theme` dans `frontend/src/index.css` :
- Fond : `bg-eds-dark` (#29265B)
- Titres : `font-heading text-eds-cyan` ou `text-eds-gold`
- Corps : `font-body text-eds-light`
- Texte secondaire : `text-eds-gray`
- Accents : `text-eds-cyan` (#80E2ED), `text-eds-gold` (#DAB265)
- Bouton action primaire : `bg-eds-cyan text-eds-dark font-heading`
- Bouton validation round : `bg-eds-gold text-eds-dark font-heading`
- Bouton danger/drop : `bg-red-600 hover:bg-red-700 text-white font-heading`

NE PAS modifier `index.css`. NE PAS creer de fichier `tailwind.config.ts`.

### Anti-patterns a eviter

- NE PAS supprimer les LobbyPlayer d'un joueur droppe — ses resultats doivent rester en base pour le classement
- NE PAS creer une nouvelle route backend pour le drop — utiliser le PATCH existant avec `{ status: 'dropped' }`
- NE PAS modifier `tournament.ts` — les filtres `status: 'inscrit'` excluent deja les droppes
- NE PAS modifier `pointsCalculator.ts` — le calcul de moyenne est deja correct
- NE PAS modifier le schema Prisma — le champ `status: String` accepte deja n'importe quelle valeur
- NE PAS creer de nouvelle instance PrismaClient — utiliser `import prisma from '../prisma/client'`
- NE PAS modifier `api.ts` — `updatePlayer` gere deja le changement de statut
- NE PAS modifier `types/index.ts` — `status: string` accepte deja 'dropped'
- NE PAS utiliser `any` en TypeScript
- NE PAS installer de nouvelles dependances
- NE PAS implementer le WebSocket — c'est la story 3.1
- NE PAS implementer l'affichage public des drops (grise/barre dans le tableau public) — c'est la story 3.2 (UX-DR6)
- NE PAS implementer le classement multi-journees — c'est la story 2.7

### Previous Story Intelligence (Story 2.5)

**Decisions techniques confirmees :**
- Import `'react-router'` (pas `'react-router-dom'`)
- Express 5 — `app.use()` pour monter les routes
- Instance Prisma partagee dans `backend/src/prisma/client.ts`
- Token JWT dans localStorage cle `auth_token`, passe en parametre aux fonctions API
- Style backoffice : bg-eds-dark, font-heading text-eds-cyan, gros boutons en bg-eds-cyan text-eds-dark
- Error handler global dans app.ts (lignes 32-44) attrape les erreurs non gerees
- Pattern routes : validation params avec `Number()` + `Number.isInteger()` + `> 0`
- Pattern transaction Prisma : `prisma.$transaction(async (tx) => { ... })` pour operations atomiques
- Pattern reponse API : `res.status(200).json({ data: ... })` en succes, `res.status(4xx).json({ error: { code, message } })` en erreur
- Tests backend : `node:test` + `node:assert/strict`
- `Math.max` protege si tableau vide (evite -Infinity)
- `validatedRound` utilise `.reduce()` pour trouver le dernier round valide

**Corrections code review 2.5 :**
- Joueurs actifs sans resultat (nouveaux inscrits apres Round 1) ajoutes en fin de classement suisse
- Route `/validate` — classement filtre par `dayId` (intra-journee) au lieu de global multi-journees
- Guard `findUnique` avant creation du round suivant dans `/validate` — evite doublons si double appel

**Impact sur story 2.6 :**
- Le filtre `status: 'inscrit'` dans generate-lobbies exclut automatiquement les joueurs droppes → pas de modification requise dans tournament.ts
- Les joueurs sans resultat sont ajoutes en fin de classement suisse → un joueur droppe n'apparaitra plus dans cette liste car il est filtre en amont
- La creation auto du round suivant dans /validate continue de fonctionner correctement avec des joueurs droppes

### Project Structure Notes

**Fichiers a modifier :**
- `backend/src/routes/admin.ts` — ajouter `'dropped'` dans ALLOWED_STATUSES (1 ligne)
- `frontend/src/components/admin/DayManager.tsx` — ajouter section joueurs actifs avec bouton drop
- `frontend/src/components/admin/PlayerManager.tsx` — supporter le statut 'dropped' dans l'UI

**Aucun nouveau fichier a creer.**

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6 - Gestion des Drops]
- [Source: _bmad-output/planning-artifacts/epics.md#FR18 - Marquer drop]
- [Source: _bmad-output/planning-artifacts/epics.md#FR19 - Drop : retrait lobbies + conservation points]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Patterns — PATCH /api/admin/players/:id/drop]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — Player status]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns — PlayerManager.tsx]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR6 — Indicateur visuel des drops]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR11 — Gros boutons d'actions cles backoffice]
- [Source: _bmad-output/implementation-artifacts/2-5-systeme-suisse-rounds-suivants.md — previous story]
- [Source: backend/src/routes/admin.ts — ALLOWED_STATUSES a modifier]
- [Source: backend/src/routes/tournament.ts — filtres joueurs actifs (verification seulement)]
- [Source: backend/src/services/pointsCalculator.ts — calcul moyenne (verification seulement)]
- [Source: frontend/src/components/admin/DayManager.tsx — composant a modifier pour bouton drop]
- [Source: frontend/src/components/admin/PlayerManager.tsx — composant a modifier pour statut dropped]
- [Source: frontend/src/services/api.ts — updatePlayer existant]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

Aucun probleme rencontre.

### Completion Notes List

- Task 1 : Ajout de `'dropped'` dans `ALLOWED_STATUSES` de `admin.ts` — seule modification backend necessaire, le PATCH existant accepte desormais `{ status: 'dropped' }`
- Task 2 : Verification confirmee — `tournament.ts` ligne 153 filtre par `status: 'inscrit'`, les joueurs droppes sont automatiquement exclus des lobbies generes. Systeme suisse (round 2+) egalement correct. Aucune modification requise.
- Task 3 : Verification confirmee — `calculatePlayerStats` utilise `roundsPlayed = results.length` pour la moyenne, les LobbyPlayer ne sont pas supprimes au drop. Aucune modification requise.
- Task 4 : Ajout dans DayManager d'une section "Joueurs actifs" avec bouton "Marquer drop" (rouge, style UX-DR11) visible pendant une journee active (round pending ou actif). Dialog de confirmation via `window.confirm()`. Appel `updatePlayer` existant. Mise a jour reactive de la liste apres drop.
- Task 5 : Joueurs droppes affiches en grise/barre avec `line-through` et `opacity-50`. Bouton drop non visible pour les joueurs deja droppes. Compteur de drops affiche a cote du compteur de joueurs actifs.
- Task 6 : `handleStatusChange` dans PlayerManager accepte maintenant `'dropped'`. Bouton "Marquer drop" distinct du bouton "Retirer" pour les joueurs inscrits. Badge "Dropped" rouge pour les joueurs droppes. Bouton "Reinscrire" disponible pour les joueurs droppes et absents. Filtre mis a jour pour afficher les joueurs droppes par defaut.
- Task 7 : Build frontend (tsc + vite) et backend (tsc) passent sans erreur. 30 tests existants passent (lobbyGenerator, pointsCalculator, swissSystem) — zero regression.

### Change Log

- 2026-04-16 : Implementation story 2.6 — gestion des drops. Modification de 3 fichiers (admin.ts, DayManager.tsx, PlayerManager.tsx). Build OK, tests OK, zero regression.
- 2026-04-16 : Corrections post-review — decisions et patches appliques. Modification de 4 fichiers (admin.ts, tournament.ts, DayManager.tsx, PlayerManager.tsx). Build OK, 30/30 tests OK.

### File List

- backend/src/routes/admin.ts (modifie — ajout 'dropped' dans ALLOWED_STATUSES, restriction drop aux inscrits, typage data, gestion P2025)
- backend/src/routes/tournament.ts (modifie — exclusion joueurs droppes du check de validation mid-round)
- frontend/src/components/admin/DayManager.tsx (modifie — bouton drop, affichage droppes, reinscription, guard double-clic, loadData apres drop)
- frontend/src/components/admin/PlayerManager.tsx (modifie — support 'dropped', bouton drop, badge, reinscription, setActionId dans finally)

### Review Findings

1. **decision-needed** findings:
   - [x] [Review][Decision] Règles de transition d'état — Restriction ajoutee dans admin.ts : seuls les joueurs 'inscrit' peuvent etre droppes (HTTP 400 sinon)
   - [x] [Review][Decision] Un-drop dans DayManager — Bouton "Reinscrire" ajoute dans les deux sections de joueurs droppes de DayManager
   - [x] [Review][Decision] Visibilité des absents — Decision : NON, les absents ne participent pas a la journee et n'ont pas besoin d'etre visibles dans DayManager
   - [x] [Review][Decision] Désynchronisation d'état — Decision : NON, hook global = over-engineering hors scope 2.6. loadData() appele apres chaque drop/reinscription assure la coherence
   - [x] [Review][Decision] Actualisation du classement — loadData() appele apres drop rafraichit le player count. Les rankings ne sont jamais visibles en meme temps que les boutons drop (sections mutuellement exclusives dans le JSX)
   - [x] [Review][Decision] Validation round et drop mid-round — Fix applique dans tournament.ts : les joueurs droppes sont exclus du check de placements manquants lors de la validation

2. **patch** findings:
   - [x] [Review][Patch] Concurrence : Double-clic — Guard `if (dropLoadingId !== null) return;` ajoute au debut de handleDrop et handleReinscribeInDay
   - [x] [Review][Patch] Import inutilisé : validatePlayerInput — Faux positif : utilise ligne 30 dans POST /players. Aucune modification.
   - [x] [Review][Patch] Centralisation des messages de confirmation — Decision : non applique, pas de nouveau fichier pour une refactorisation de style mineur
   - [x] [Review][Patch] Typage Prisma : Record<string, string> — Remplace par `{ status?: string; discordPseudo?: string; riotPseudo?: string; email?: string }`
   - [x] [Review][Patch] Nettoyage : setActionId(null) dans finally — Applique dans handleStatusChange et saveEdit de PlayerManager
   - [x] [Review][Patch] UX : Réinitialisation de l'erreur — setError(null) deja present avant les actions dans les deux managers. Aucune modification supplementaire.
   - [x] [Review][Patch] Robustesse : Gestion P2025 — Ajout du cas P2025 dans le catch du PATCH /players/:id (HTTP 404)

3. **defer** findings:
   - [x] [Review][Defer] Audit Trail: timestamp et identité de l'admin lors du drop [admin.ts] — deferred, hors scope Story 2.6
