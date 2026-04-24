# Story 2.7 : Classement Cumulé Multi-Journées

Status: Done

## Story

As a **admin (Brice)**,
I want **que le classement soit cumulé sur les 3 journées de qualification**,
So that **la qualification pour la finale reflète la performance globale des joueurs sur toute la phase de qualifications**.

## Acceptance Criteria

1. **Given** la journée 1 est terminée avec des scores **When** je démarre la journée 2 **Then** le classement affiché dans le backoffice montre les scores cumulés (J1 + J2) **And** les tiebreakers sont recalculés sur l'ensemble des rounds joués toutes journées confondues

2. **Given** un joueur a joué la journée 1 (score: 30) et la journée 2 (score: 25) **When** je consulte le classement après la journée 2 **Then** son score total affiche 55 **And** sa moyenne est calculée sur le total de rounds joués sur les 2 journées

3. **Given** un joueur a droppé lors de la journée 1 après 3 rounds **When** il participe normalement à la journée 2 (6 rounds) **Then** son score cumulé inclut les 3 rounds de J1 + les 6 rounds de J2 **And** sa moyenne est calculée sur 9 rounds

4. **Given** les 3 journées de qualification sont terminées **When** je consulte le classement final **Then** les joueurs sont ordonnés par score total cumulé **And** en cas d'égalité, les tiebreakers départitionnent (top 1 > top 4 > dernière game)

## Tasks / Subtasks

- [x] Task 1 : Backend — Créer `backend/src/routes/rankings.ts` (AC: #1, #2, #3, #4)
  - [x] 1.1 Créer le fichier `backend/src/routes/rankings.ts`
  - [x] 1.2 Implémenter `GET /` : requêter TOUS les LobbyPlayer avec placement non null de TOUS les rounds validés de TOUTES les journées de qualification (`type: 'qualification'`)
  - [x] 1.3 Grouper les résultats par `playerId` et appliquer `calculatePlayerStats()` (importé de `../services/pointsCalculator`)
  - [x] 1.4 Trier : `totalScore` desc → `top1Count` desc → `top4Count` desc → `lastGameResult` asc
  - [x] 1.5 Ajouter `rank` (index + 1) et `discordPseudo` dans la réponse
  - [x] 1.6 Retourner `res.json({ data: rankedResults })` avec le tableau vide si aucun résultat

- [x] Task 2 : Backend — Monter le router dans `backend/src/app.ts` (AC: #1)
  - [x] 2.1 Importer `rankingsRouter` depuis `'./routes/rankings'`
  - [x] 2.2 Ajouter `app.use('/api/rankings', rankingsRouter)` dans la section "Routes publiques" (AVANT le middleware auth)

- [x] Task 3 : Frontend — Ajouter `fetchRankings()` dans `frontend/src/services/api.ts` (AC: #1, #2)
  - [x] 3.1 Ajouter la fonction `fetchRankings()` : `GET ${API_URL}/api/rankings` — pas de token (route publique)
  - [x] 3.2 Retourner `{ data: PlayerRanking[] }` ou `{ error: ApiError }`

- [x] Task 4 : Frontend — Mettre à jour `DayManager.tsx` pour afficher le classement multi-journées (AC: #1, #2, #3, #4)
  - [x] 4.1 Ajouter un état `multiDayRankings: PlayerRanking[] | null` (initialement `null`)
  - [x] 4.2 Dans `loadData()` : appeler `fetchRankings()` (pas de token, route publique) et setter `multiDayRankings` si succès et résultats non vides
  - [x] 4.3 Dans `handleValidateRound()` : après succès, appeler `fetchRankings()` et mettre à jour `multiDayRankings`
  - [x] 4.4 Afficher le tableau "Classement cumulé — toutes journées" sous le tableau intra-journée existant, quand `multiDayRankings` est non null et non vide
  - [x] 4.5 Label distinctif : titre en `text-eds-gold` "Classement cumulé multi-journées" pour différencier du classement intra-journée `text-eds-cyan`

- [x] Task 5 : Validation (AC: #1-#4)
  - [x] 5.1 `npm run build` passe sans erreur (frontend + backend)
  - [x] 5.2 Tests existants passent (30/30) — zero régression
  - [x] 5.3 Tester : valider un round J1 → `GET /api/rankings` retourne les bons scores J1
  - [x] 5.4 Tester : démarrer J2, valider un round J2 → `GET /api/rankings` retourne scores J1 + J2 cumulés
  - [x] 5.5 Tester : joueur droppé J1 (3 rounds) + J2 (6 rounds) → `roundsPlayed = 9`, `totalScore = somme des 9 rounds`
  - [x] 5.6 Tester : `GET /api/rankings` retourne tableau vide `[]` si aucun round validé — pas d'erreur 500

## Dev Notes

### Architecture & Patterns à suivre

**Principe clé : un seul endpoint public `GET /api/rankings` agrège tous les résultats.**

La route `/validate` dans `tournament.ts` garde son comportement actuel (classement intra-journée uniquement, filtré par `dayId`). Story 2.7 ajoute un SECOND classement global via un nouvel endpoint public, consommé également par Epic 3 (page publique) et Epic 4 (overlay).

---

### Task 1 — Implémentation de `backend/src/routes/rankings.ts`

Nouveau fichier à créer. Suit exactement le pattern de calcul de classement de `tournament.ts` mais sans filtre `dayId`.

```typescript
import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { calculatePlayerStats } from '../services/pointsCalculator';

const router = Router();

// GET / — classement cumulé toutes journées de qualification
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Tous les LobbyPlayer avec placement des rounds validés de journées de qualification
    const allLobbyPlayers = await prisma.lobbyPlayer.findMany({
      where: {
        placement: { not: null },
        lobby: {
          round: {
            status: 'validated',
            day: { type: 'qualification' },
          },
        },
      },
      include: {
        player: { select: { discordPseudo: true } },
        lobby: {
          include: { round: true },
        },
      },
    });

    // Grouper par playerId
    const playerResultsMap = new Map<
      number,
      { discordPseudo: string; results: { placement: number; points: number; roundId: number }[] }
    >();

    for (const lp of allLobbyPlayers) {
      if (lp.placement === null || lp.points === null) continue;
      const result = { placement: lp.placement, points: lp.points, roundId: lp.lobby.roundId };
      const existing = playerResultsMap.get(lp.playerId);
      if (existing) {
        existing.results.push(result);
      } else {
        playerResultsMap.set(lp.playerId, {
          discordPseudo: lp.player.discordPseudo,
          results: [result],
        });
      }
    }

    // Calculer stats et trier
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

    const rankedResults = rankings.map((r, index) => ({
      rank: index + 1,
      ...r,
    }));

    res.json({ data: rankedResults });
  } catch (error) {
    console.error('Erreur lors du calcul du classement:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

export default router;
```

**Points critiques :**
- Filtre `day: { type: 'qualification' }` — exclut les futures journées de finale (type différent)
- Ne PAS filtrer par `dayId` — c'est volontaire, on veut TOUTES les journées
- `placement: { not: null }` — seulement les résultats validés avec placement saisi
- Si aucun résultat, retourne `{ data: [] }` (pas d'erreur)

---

### Task 2 — Montage dans `backend/src/app.ts`

**Emplacement exact** : Ligne 20 (après `app.use("/api", playersRouter)`, AVANT les routes admin protégées) :

```typescript
// Ajouter en imports (ligne ~7) :
import rankingsRouter from './routes/rankings';

// Ajouter dans la section "Routes publiques" (après playersRouter) :
app.use('/api/rankings', rankingsRouter);
```

**État actuel de app.ts (18 routes mountées) :**
- Ligne 19 : `app.use("/api", authRouter);`
- Ligne 20 : `app.use("/api", playersRouter);`
- **→ Ajouter ligne 21 : `app.use('/api/rankings', rankingsRouter);`**
- Ligne 23-25 : middleware auth + adminRouter + tournamentRouter (APRÈS)

---

### Task 3 — Ajouter `fetchRankings()` dans `frontend/src/services/api.ts`

Ajouter à la fin du fichier (après `validateRound`) :

```typescript
export async function fetchRankings(): Promise<{ data: PlayerRanking[] } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/rankings`);
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as PlayerRanking[] };
}
```

**Important :**
- Pas de `token` — route PUBLIQUE
- Import `PlayerRanking` depuis `'../types'` — le type EXISTE déjà (ligne 75 de `types/index.ts`), NE PAS recréer
- Ajouter `fetchRankings` à la ligne d'import de `api.ts` dans `DayManager.tsx`

---

### Task 4 — Mise à jour de `DayManager.tsx`

**Fichier** : `frontend/src/components/admin/DayManager.tsx` (actuellement ~268 lignes)

**Modifications nécessaires :**

**4.1 — Import : ajouter `fetchRankings` à la ligne 6** (ligne existante d'imports de api.ts) :
```typescript
import { startDay, getCurrentDay, generateLobbies, getAdminPlayers, updatePlayer, validateRound, fetchRankings } from '../../services/api';
```

**4.2 — État : ajouter à la suite des états existants (après `setRankings`)** :
```typescript
const [multiDayRankings, setMultiDayRankings] = useState<PlayerRanking[] | null>(null);
```

**4.3 — Dans `loadData()` : ajouter l'appel rankings** (après les `Promise.allSettled` existants) :
```typescript
// Charger le classement cumulé multi-journées
const rankingsResult = await fetchRankings();
if ('data' in rankingsResult && rankingsResult.data.length > 0) {
  setMultiDayRankings(rankingsResult.data);
} else {
  setMultiDayRankings(null);
}
```

**4.4 — Dans `handleValidateRound()` : mettre à jour après validation** (après `setRankings(result.data.rankings)`) :
```typescript
const globalRankings = await fetchRankings();
if ('data' in globalRankings && globalRankings.data.length > 0) {
  setMultiDayRankings(globalRankings.data);
}
```

**4.5 — Affichage du classement multi-journées** : Ajouter UN SEUL bloc JSX réutilisable. Ce bloc doit être visible dans la section "round validé" (après le tableau intra-journée `rankings`). Exemple de placement (dans la section `validatedRound && !activeRound && !pendingRound`) :

```tsx
{multiDayRankings && multiDayRankings.length > 0 && (
  <div className="mt-8">
    <h3 className="mb-3 font-heading text-xl text-eds-gold">
      Classement cumulé — toutes journées
    </h3>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-3 py-2 font-heading text-sm text-eds-gold">#</th>
            <th className="px-3 py-2 font-heading text-sm text-eds-gold">Joueur</th>
            <th className="px-3 py-2 font-heading text-sm text-eds-gold">Score total</th>
            <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 1</th>
            <th className="px-3 py-2 font-heading text-sm text-eds-gold">Top 4</th>
            <th className="px-3 py-2 font-heading text-sm text-eds-gold">Moy.</th>
            <th className="px-3 py-2 font-heading text-sm text-eds-gold">Rounds</th>
          </tr>
        </thead>
        <tbody>
          {multiDayRankings.map((r) => (
            <tr key={r.playerId} className="border-b border-white/5">
              <td className="px-3 py-2 font-heading text-eds-cyan">{r.rank}</td>
              <td className="px-3 py-2 font-body text-eds-light">{r.discordPseudo}</td>
              <td className="px-3 py-2 font-body text-eds-light font-bold">{r.totalScore}</td>
              <td className="px-3 py-2 font-body text-eds-light">{r.top1Count}</td>
              <td className="px-3 py-2 font-body text-eds-light">{r.top4Count}</td>
              <td className="px-3 py-2 font-body text-eds-light">{r.average}</td>
              <td className="px-3 py-2 font-body text-eds-light">{r.roundsPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
```

**Différenciation visuelle :**
- Classement intra-journée (existant) : titre en `text-eds-cyan` implicite
- Classement multi-journées (nouveau) : titre en `text-eds-gold`, label "Classement cumulé — toutes journées"

---

### État actuel du code (ce qui existe déjà)

**Backend (`app.ts`, 46 lignes) :**
- Routes publiques montées à `/api` : `authRouter`, `playersRouter`
- Routes admin protégées : `requireAuth` middleware + `adminRouter` + `tournamentRouter` sur `/api/admin`
- **Pas de `rankingsRouter`** → à ajouter en public avant la section admin

**Backend (`tournament.ts`, 542 lignes) :**
- Route `/validate` retourne `{ round, rankings }` où `rankings` = classement INTRA-JOURNÉE filtré par `dayId`
- Ce comportement est INTENTIONNEL et NE DOIT PAS ÊTRE MODIFIÉ — il sert à afficher le classement du jour courant après chaque validation
- Route `generate-lobbies` (round 2+) calcule aussi un classement intra-journée pour le système suisse — NE PAS MODIFIER

**Backend (`pointsCalculator.ts`, 59 lignes) :**
- `calculatePlayerStats(results)` — calcule `totalScore`, `top1Count`, `top4Count`, `lastGameResult`, `roundsPlayed`, `average`
- `average = Math.round((totalScore / roundsPlayed) * 100) / 100` — correct pour multi-journées (roundsPlayed = total rounds joués, toutes journées confondues)
- **PAS DE MODIFICATION REQUISE**

**Backend (`admin.ts`, ~180 lignes) :**
- CRUD joueurs — **PAS DE MODIFICATION REQUISE**

**Frontend (`types/index.ts`, 91 lignes) :**
- `PlayerRanking` (lignes 75-85) — couvre exactement les champs du classement multi-journées
- `RoundValidationResult` (lignes 87-90) — contient `rankings: PlayerRanking[]` pour intra-journée
- **PAS DE MODIFICATION REQUISE**

**Frontend (`api.ts`, 183 lignes) :**
- `validateRound()` (ligne 164) — appel existant, NE PAS MODIFIER
- À AJOUTER : `fetchRankings()` à la fin du fichier

**Frontend (`DayManager.tsx`, ~268 lignes) :**
- État `rankings: PlayerRanking[] | null` existe déjà pour le classement intra-journée
- Tableau intra-journée affiché en section `validatedRound && !activeRound && !pendingRound`
- À MODIFIER : ajout de `multiDayRankings`, appel `fetchRankings()`, affichage second tableau

---

### Dépendances déjà disponibles (NE PAS réinstaller)

- Backend : Express 5, Prisma 7, bcryptjs, jsonwebtoken, cors, socket.io
- Frontend : React 19, react-router 7, Tailwind CSS v4
- Tests : node:test + node:assert/strict

---

### Tailwind v4 — classes disponibles (charte EDS)

Classes personnalisées EDS définies via `@theme` dans `frontend/src/index.css` :
- Fond : `bg-eds-dark` (#29265B)
- Titres : `font-heading text-eds-cyan` ou `text-eds-gold`
- Corps : `font-body text-eds-light`
- Texte secondaire : `text-eds-gray`
- Accents : `text-eds-cyan` (#80E2ED), `text-eds-gold` (#DAB265)

NE PAS modifier `index.css`. NE PAS créer de fichier `tailwind.config.ts`.

---

### Anti-patterns à éviter

- NE PAS modifier `tournament.ts` — la route `/validate` retourne intentionnellement le classement intra-journée pour le système suisse et l'affichage admin du round courant. Story 2.7 AJOUTE un endpoint séparé, ne remplace pas le classement intra-journée
- NE PAS filtrer par `dayId` dans `rankings.ts` — on veut TOUTES les journées
- NE PAS filtrer les joueurs droppés : leurs résultats restent en base et doivent apparaître dans le classement cumulé (leurs `LobbyPlayer` avec placement ne sont pas supprimés au drop)
- NE PAS ajouter de filtre sur `status: 'inscrit'` dans rankings.ts — un joueur droppé a des résultats valides qui comptent dans le classement
- NE PAS créer une nouvelle instance PrismaClient — utiliser `import prisma from '../prisma/client'`
- NE PAS modifier `pointsCalculator.ts` — `calculatePlayerStats` est déjà correct pour multi-journées
- NE PAS modifier `types/index.ts` — `PlayerRanking` couvre déjà les champs nécessaires
- NE PAS protéger `GET /api/rankings` par JWT — c'est une route publique (consommée aussi par Epic 3 et Epic 4)
- NE PAS implémenter le WebSocket `ranking_updated` — c'est la story 3.1
- NE PAS implémenter la page publique `/qualifications` — c'est la story 3.2
- NE PAS utiliser `any` en TypeScript
- NE PAS installer de nouvelles dépendances

---

### Relation avec les stories futures

- **Story 3.1 (WebSocket)** : La route `GET /api/rankings` sera appelée après `ranking_updated` event pour refetch le classement côté public. Aucune modification de `rankings.ts` nécessaire pour 3.1.
- **Story 3.2 (Page publique)** : La page `/qualifications` consommera `GET /api/rankings` via `fetchRankings()` (déjà créée en story 2.7). NE PAS dupliquer la fonction.
- **Epic 5 (Finale)** : Le filtre `day: { type: 'qualification' }` dans `rankings.ts` exclut automatiquement les rounds de finale — correct par design.

---

### Previous Story Intelligence (Story 2.6)

**Décisions techniques confirmées :**
- Import `'react-router'` (pas `'react-router-dom'`)
- Express 5 — `app.use()` pour monter les routes
- Instance Prisma partagée dans `backend/src/prisma/client.ts`
- Token JWT dans localStorage clé `auth_token`, passé en paramètre aux fonctions API
- Style backoffice : bg-eds-dark, font-heading text-eds-cyan/gold, gros boutons en bg-eds-cyan text-eds-dark
- Error handler global dans app.ts (lignes 32-44) attrape les erreurs non gérées
- Pattern routes : validation params avec `Number()` + `Number.isInteger()` + `> 0`
- Pattern réponse API : `res.status(200).json({ data: ... })` en succès, `res.status(4xx).json({ error: { code, message } })` en erreur
- Tests backend : `node:test` + `node:assert/strict`
- `Math.max` protège si tableau vide (évite -Infinity)

**Corrections post-review story 2.6 importantes pour 2.7 :**
- Restriction transition : seuls les joueurs `'inscrit'` peuvent être droppés — les `LobbyPlayer` existants ne sont PAS supprimés au drop → leurs résultats restent en base → le classement cumulé les inclut correctement
- Guard double-clic dans DayManager : `if (dropLoadingId !== null) return;` — pattern à réutiliser pour `multiDayRankings` si nécessaire
- `setActionId(null)` dans `finally` — pattern à suivre pour les états de loading

**Fichiers modifiés en story 2.6 (état au moment de 2.7) :**
- `backend/src/routes/admin.ts` — ALLOWED_STATUSES inclut `'dropped'`, restriction drop aux inscrits, gestion P2025
- `backend/src/routes/tournament.ts` — exclusion joueurs droppés du check placements manquants lors validation
- `frontend/src/components/admin/DayManager.tsx` — bouton drop, affichage droppés, réinscription, guard double-clic
- `frontend/src/components/admin/PlayerManager.tsx` — support `'dropped'`, bouton drop, badge, réinscription

---

### Project Structure Notes

**Nouveau fichier à créer :**
- `backend/src/routes/rankings.ts`

**Fichiers à modifier :**
- `backend/src/app.ts` — importer et monter `rankingsRouter`
- `frontend/src/services/api.ts` — ajouter `fetchRankings()`
- `frontend/src/components/admin/DayManager.tsx` — état `multiDayRankings`, appels `fetchRankings()`, tableau multi-journées

**Aucun autre fichier à créer ou modifier.**

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7 - Classement Cumulé Multi-Journées]
- [Source: _bmad-output/planning-artifacts/epics.md#FR20 - Classement cumulé sur 3 journées]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Patterns — GET /api/rankings]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns — rankings.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — LobbyPlayer, Day, Round]
- [Source: backend/src/app.ts — montage des routes (lignes 18-25)]
- [Source: backend/src/routes/tournament.ts — pattern classement intra-journée (référence)]
- [Source: backend/src/services/pointsCalculator.ts — calculatePlayerStats (réutilisation directe)]
- [Source: frontend/src/services/api.ts — pattern fetchXxx() existants]
- [Source: frontend/src/components/admin/DayManager.tsx — état rankings existant]
- [Source: frontend/src/types/index.ts — PlayerRanking type (lignes 75-85)]
- [Source: _bmad-output/implementation-artifacts/2-6-gestion-des-drops.md — previous story intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Build backend : `tsc` — succes sans erreur
- Build frontend : `tsc -b && vite build` — succes (37 modules, 256ms)
- Tests backend : `node --test dist/services/*.test.js` — 30/30 pass, 0 fail

### Completion Notes List

- Task 1 : Cree `backend/src/routes/rankings.ts` — endpoint public `GET /api/rankings` qui agrege tous les LobbyPlayer des rounds valides de journees de qualification, groupe par joueur, calcule les stats via `calculatePlayerStats()`, trie par totalScore > top1Count > top4Count > lastGameResult, retourne `{ data: rankedResults }` ou `{ data: [] }` si vide
- Task 2 : Monte `rankingsRouter` dans `app.ts` en route publique (avant le middleware auth)
- Task 3 : Ajoute `fetchRankings()` dans `api.ts` — appel GET public sans token, retourne `PlayerRanking[]`
- Task 4 : Mis a jour `DayManager.tsx` — etat `multiDayRankings`, chargement dans `loadData()` et apres `handleValidateRound()`, tableau "Classement cumule — toutes journees" en `text-eds-gold` sous le classement intra-journee
- Task 5 : Build frontend + backend OK, 30/30 tests passent sans regression

### Change Log

- 2026-04-16 : Implementation story 2.7 — endpoint classement cumule multi-journees + affichage backoffice
- 2026-04-17 : Story passee en Done apres test end-to-end en local (3 journees de qualification jouees, classement cumule verifie)

### File List

- `backend/src/routes/rankings.ts` (nouveau)
- `backend/src/app.ts` (modifie — import + montage rankingsRouter)
- `frontend/src/services/api.ts` (modifie — ajout fetchRankings + import PlayerRanking)
- `frontend/src/components/admin/DayManager.tsx` (modifie — import fetchRankings, etat multiDayRankings, appels, tableau)

### Review Findings

Validation fonctionnelle par Brice le 2026-04-17 : 3 journees de qualification jouees en local (15 joueurs, plusieurs rounds par journee, drops testes). Le classement cumule multi-journees s'affiche correctement dans le backoffice en `text-eds-gold` sous le classement intra-journee. Pas de regression detectee.

**Correctifs adjacents realises pendant les tests (hors scope initial de 2.7) :**
- Fix drops : le classement de `generate-lobbies` round 2+ filtre desormais les joueurs droppes. Voir story 2.6.
- Nouveau bouton admin "Regenerer les lobbies" (endpoint `POST /regenerate-lobbies`) actif tant qu'aucun placement n'a ete saisi.
- Suppression de la limite `MAX_ROUNDS = 3` : le nombre de rounds par journee est desormais illimite, la journee se termine via bouton explicite. Voir `memory/project_rounds_per_day.md`.
