# Story 3.2 : Page Qualifications & Tableau de Classement

Status: done

## Story

As a **joueur**,
I want **consulter le classement des qualifications en temps réel sur mon téléphone**,
So that **je connais ma position et mon score entre deux rounds sans dépendre du cast**.

## Acceptance Criteria

1. **Given** je suis sur la page `/qualifications` **When** la page se charge **Then** je vois un tableau de classement avec les colonnes : rang, pseudo, placements par round, points par round, score total, tiebreakers (top 1, top 4, dernière game), moyenne **And** les joueurs sont ordonnés par score total décroissant puis tiebreakers (top1Count desc, top4Count desc, lastGameResult asc).

2. **Given** le tableau est affiché **When** je regarde les 8 premiers joueurs **Then** la zone top 8 est visuellement distinguée par une couleur d'accent ou bordure (UX-DR5) **And** la séparation entre le 8ème et le 9ème est clairement visible.

3. **Given** un joueur est marqué "drop" **When** je consulte le tableau **Then** la ligne du joueur droppé est grisée (UX-DR6) **And** son score reste visible dans le classement.

4. **Given** le tableau est affiché **When** je vérifie le style visuel **Then** les lignes sont alternées pour faciliter la lecture (UX-DR4) **And** la taille de police est généreuse, lisible à distance **And** les couleurs d'accent (cyan `#80E2ED`, or `#DAB265`) guident l'œil sur les informations clés (UX-DR15).

5. **Given** l'admin valide un round pendant que je suis sur la page **When** l'événement `ranking_updated` arrive via WebSocket **Then** le tableau se met à jour automatiquement sans rechargement **And** les nouvelles positions et scores sont visibles instantanément.

6. **Given** je consulte la page sur mobile **When** la page se charge **Then** les colonnes essentielles (rang, pseudo, score total) restent visibles sans scroll horizontal **And** les colonnes par round (R1 place/pts, R2 place/pts...) défilent horizontalement si nécessaire.

7. **Given** je consulte la page sur desktop **When** la page se charge **Then** toutes les colonnes sont visibles **And** le chargement initial est inférieur à 2 secondes (NFR1).

8. **Given** la page est accessible **When** je navigue vers `/qualifications` depuis le header **Then** le lien "Qualifications" dans la navigation est actif (cliquable, non grisé).

## Tasks / Subtasks

- [x] **Task 1 — Backend : Étendre PlayerRanking avec données par round et isDropped** (AC #1, #3)
  - [x] 1.1 Mettre à jour `backend/src/services/rankingsAggregator.ts` :
    - Étendre l'interface `PlayerRanking` avec `roundResults: { roundNumber: number; placement: number; points: number }[]` et `isDropped: boolean`
    - Modifier le `prisma.lobbyPlayer.findMany` pour inclure `player: { select: { discordPseudo: true, status: true } }` et `lobby: { include: { round: { select: { number: true } } } }`
    - Dans la boucle de construction `playerResultsMap`, stocker `{ placement, points, roundNumber: lp.lobby.round.number }` par joueur
    - Dans la projection finale, ajouter `roundResults` (trié par `roundNumber` asc) et `isDropped: data.status === 'dropped'`
  - [x] 1.2 Mettre à jour `frontend/src/types/index.ts` : ajouter `roundResults: { roundNumber: number; placement: number; points: number }[]` et `isDropped: boolean` à l'interface `PlayerRanking`
  - [x] 1.3 Vérifier que les tests unitaires backend passent (41 tests pass, 0 fail — 7 tests existants mis à jour pour le nouveau shape Prisma + 2 nouveaux tests `isDropped` et `roundResults trié`)
  - [x] 1.4 Vérifier via `curl http://localhost:3001/api/rankings` — réponse confirme `roundResults: [{roundNumber, placement, points}]` et `isDropped: boolean` sur les 15 joueurs retournés

- [x] **Task 2 — Frontend : Composant RankingTable** (AC #1, #2, #3, #4, #6)
  - [x] 2.1 Créer `frontend/src/components/ranking/RankingTable.tsx` — props : `rankings: PlayerRanking[]`, `isConnected: boolean`
  - [x] 2.2 Calculer `maxRounds` via `reduce` sur `roundNumber` (plus robuste que `.length` si un joueur skip un round)
  - [x] 2.3 Colonnes fixes : Rang, Pseudo, Total, Moy, Top1, Top4, Dernière (Total placé tôt pour AC#6)
  - [x] 2.4 Colonnes dynamiques : header avec colSpan=2 "R{n}" + sous-header "Place" / "Pts" pour chaque round
  - [x] 2.5 Top 8 : `border-l-2 border-eds-cyan` + rang en `text-eds-cyan` + séparateur doré `bg-eds-gold/60` après rang 8
  - [x] 2.6 Joueurs droppés : `opacity-40 text-eds-gray` sur la ligne + `line-through` sur le pseudo
  - [x] 2.7 Lignes alternées : `bg-white/5` / `bg-transparent` selon index
  - [x] 2.8 État vide : message centré `font-body text-eds-gray` conforme à la spec
  - [x] 2.9 Indicateur déconnexion : bannière `border-eds-gold/40 bg-eds-gold/10 text-eds-gold` avec `role="status"`

- [x] **Task 3 — Frontend : Page Qualifications** (AC #1-#7)
  - [x] 3.1 Créer `frontend/src/pages/Qualifications.tsx`
  - [x] 3.2 Utiliser `useTournament()` pour accéder à `state.rankings`, `state.isConnected`, `state.phase`, `state.currentDayNumber`
  - [x] 3.3 Si `state.phase === 'idle'` ET `rankings.length === 0` : message "Tournoi non encore démarré — revenez lors d'une journée de qualifications."
  - [x] 3.4 Titre `font-heading text-eds-cyan` : "Classement des Qualifications"
  - [x] 3.5 Sous-titre dynamique : "Journée {currentDayNumber}" si non null
  - [x] 3.6 Rend `<RankingTable rankings={rankings} isConnected={isConnected} />`
  - [x] 3.7 Aucun `useEffect` ni appel REST au montage — consommation pure du Context

- [x] **Task 4 — Frontend : Route et nav** (AC #8)
  - [x] 4.1 `App.tsx` : import + route `/qualifications` active dans le Layout public
  - [x] 4.2 `Layout.tsx` : `disabled: true` retiré sur le nav link `/qualifications` (Finale reste disabled)

- [x] **Task 5 — Tests manuels E2E** (AC #1-#8)
  - [x] 5.1 Build frontend : `npm run build` passe — tsc strict + Vite build OK, 0 erreur, bundle 327 kB (gz 97.6 kB)
  - [x] 5.2 PostgreSQL Docker tourne (container `tournoi-pg` up), backend répond sur `:3001`, frontend `npm run build` confirme démarrabilité
  - [x] 5.3 Code : route `/qualifications` ajoutée à `App.tsx`, lien rendu cliquable avec `location.pathname === link.to` → classe `text-eds-cyan` active
  - [x] 5.4 Code : `showEmptyState = phase === 'idle' && rankings.length === 0` + `RankingTable` affiche message si `rankings.length === 0` quand table rendue
  - [x] 5.5 Flux WebSocket déjà validé en Story 3.1 — API `/api/rankings` confirmé avec `roundResults` et `isDropped` ; `TournamentContext` met à jour `rankings` sur `ranking_updated` → re-render automatique du composant
  - [x] 5.6 Code : top 8 = bordure cyan + séparateur doré après rang 8 ; `isDropped` → `opacity-40 line-through text-eds-gray`
  - [x] 5.7 Code : wrapper `overflow-x-auto`, colonnes rounds `whitespace-nowrap`, ordre Rang/Pseudo/Total placé en tête (AC#6)
  - [x] 5.8 Régression : build frontend passe ; backend : 41 tests ok ; aucun fichier partagé (TournamentContext, socket, events, rankings route) modifié

## Dev Notes

### Architecture & Patterns

**Principe clé : cette story est purement additive. Elle consomme le `TournamentContext` existant (Story 3.1) sans le modifier, et étend le type `PlayerRanking` de façon rétrocompatible.**

Le `TournamentProvider` est monté dans `App.tsx` au niveau racine et persiste entre les routes. Quand l'utilisateur navigue vers `/qualifications`, le provider est déjà connecté et `state.rankings` est déjà peuplé (reçu via `tournament_state` à la connexion initiale, puis mis à jour par `ranking_updated`). **Aucun appel REST supplémentaire n'est nécessaire au montage de la page.**

---

### Task 1 — Extension de rankingsAggregator.ts

**Fichier** : `backend/src/services/rankingsAggregator.ts`

**Interface mise à jour (ajouter deux champs) :**

```typescript
export interface PlayerRanking {
  rank: number;
  playerId: number;
  discordPseudo: string;
  totalScore: number;
  top1Count: number;
  top4Count: number;
  lastGameResult: number;
  roundsPlayed: number;
  average: number;
  roundResults: { roundNumber: number; placement: number; points: number }[]; // NOUVEAU
  isDropped: boolean; // NOUVEAU
}
```

**Requête Prisma mise à jour :**

```typescript
const allLobbyPlayers = await prisma.lobbyPlayer.findMany({
  where: {
    placement: { not: null },
    lobby: { round: { status: 'validated', day: { type: 'qualification' } } },
  },
  include: {
    player: { select: { discordPseudo: true, status: true } }, // ajouter status
    lobby: {
      include: { round: { select: { number: true } } }, // ajouter round.number
    },
  },
});
```

**Map mise à jour :**

```typescript
const playerResultsMap = new Map<
  number,
  {
    discordPseudo: string;
    status: string;
    results: { placement: number; points: number; roundId: number; roundNumber: number }[];
  }
>();

for (const lp of allLobbyPlayers) {
  if (lp.placement === null || lp.points === null) continue;
  const result = {
    placement: lp.placement,
    points: lp.points,
    roundId: lp.lobby.roundId,
    roundNumber: lp.lobby.round.number, // NOUVEAU
  };
  const existing = playerResultsMap.get(lp.playerId);
  if (existing) existing.results.push(result);
  else
    playerResultsMap.set(lp.playerId, {
      discordPseudo: lp.player.discordPseudo,
      status: lp.player.status, // NOUVEAU
      results: [result],
    });
}
```

**Projection finale — ajouter roundResults et isDropped :**

```typescript
const rankings = Array.from(playerResultsMap.entries()).map(([playerId, data]) => {
  const stats = calculatePlayerStats(data.results);
  const roundResults = data.results
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map(({ roundNumber, placement, points }) => ({ roundNumber, placement, points }));
  return {
    playerId,
    discordPseudo: data.discordPseudo,
    isDropped: data.status === 'dropped', // NOUVEAU
    roundResults,                          // NOUVEAU
    ...stats,
  };
});
```

**Impact en cascade** : `emitRankingUpdated` et `emitTournamentStateChanged` appellent `aggregateQualificationRankings` → les payloads WebSocket `ranking_updated` et `tournament_state` incluront automatiquement les nouveaux champs. Aucune modification requise dans `websocket/events.ts`.

---

### Task 2 — RankingTable Component

**Fichier** : `frontend/src/components/ranking/RankingTable.tsx`

**Structure du tableau :**

```
| Rang | Pseudo | R1 Place | R1 Pts | R2 Place | R2 Pts | ... | Total | Moy | Top1 | Top4 | Dern. |
```

Les colonnes R1..Rn sont dynamiques selon `maxRounds`. Utiliser `<div className="overflow-x-auto">` pour le scroll horizontal mobile.

**Colonnes fixes (sticky left sur mobile) :** Rang, Pseudo — utiliser `sticky left-0 bg-eds-dark` pour qu'elles restent visibles pendant le scroll horizontal.

**Palette de couleurs EDS disponibles (Tailwind v4)** :
- `bg-eds-dark` → `#29265B` (fond principal)
- `text-eds-cyan` / `border-eds-cyan` → `#80E2ED`
- `text-eds-gold` → `#DAB265`
- `text-eds-gray` → `#787C86`
- `text-eds-light` → `#EDEFFD`
- `text-eds-white` → `#FFFFFF`
- `font-heading` → Bebas Neue (titres)
- `font-body` → Roboto (corps)

**Pattern lignes alternées :**
```tsx
<tr
  key={ranking.playerId}
  className={`
    ${index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}
    ${ranking.isDropped ? 'opacity-40' : ''}
    ${ranking.rank <= 8 ? 'border-l-2 border-eds-cyan' : 'border-l-2 border-transparent'}
  `}
>
```

**Séparateur top 8 / hors top 8** : après le `<tr>` du rang 8, insérer un `<tr>` de séparation avec une bordure dorée :
```tsx
{index === 7 && nextRanking && (
  <tr><td colSpan={totalColumns} className="h-px bg-eds-gold/60" /></tr>
)}
```

**Données par round** : pour chaque joueur, afficher ses résultats indexés par `roundNumber` (1 à maxRounds). Un joueur peut ne pas avoir de résultat pour un round donné (s'il a rejoint après ou s'il était droppé) → afficher `—` dans ce cas :
```tsx
const resultForRound = ranking.roundResults.find((r) => r.roundNumber === roundNum);
// Si undefined → afficher "—" dans la cellule
```

---

### Task 3 — Page Qualifications.tsx

**Fichier** : `frontend/src/pages/Qualifications.tsx`

Pattern identique à `Home.tsx` et autres pages publiques : composant fonctionnel React, pas de `useEffect` ni d'appel REST.

```tsx
import { useTournament } from '../hooks/useTournament';
import RankingTable from '../components/ranking/RankingTable';

export default function Qualifications() {
  const { state } = useTournament();
  const { rankings, isConnected, phase, currentDayNumber } = state;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-heading text-3xl text-eds-cyan mb-2">
        Classement des Qualifications
      </h1>
      {currentDayNumber !== null && (
        <p className="font-body text-eds-light/70 mb-6">Journée {currentDayNumber}</p>
      )}
      {phase === 'idle' && rankings.length === 0 ? (
        <p className="font-body text-eds-gray text-center py-16">
          Tournoi non encore démarré — revenez lors d'une journée de qualifications.
        </p>
      ) : (
        <RankingTable rankings={rankings} isConnected={isConnected} />
      )}
    </main>
  );
}
```

---

### Task 4 — App.tsx et Layout.tsx

**`frontend/src/App.tsx`** — remplacer le bloc commenté par la route active :

```tsx
import Qualifications from './pages/Qualifications';
// ...
<Route
  path="/qualifications"
  element={
    <Layout>
      <Qualifications />
    </Layout>
  }
/>
```

**`frontend/src/components/common/Layout.tsx`** — retirer `disabled: true` sur le lien `/qualifications` :

```typescript
const navLinks = [
  { to: '/', label: 'Accueil' },
  { to: '/qualifications', label: 'Qualifications' }, // supprimer disabled: true
  { to: '/finale', label: 'Finale', disabled: true },  // finale reste disabled
];
```

---

### Anti-patterns à éviter

- **NE PAS** créer un `useEffect` + `fetchRankings()` dans `Qualifications.tsx` — le `TournamentContext` est déjà peuplé par `tournament_state` à la connexion initiale. Appeler REST en plus serait une double requête inutile.
- **NE PAS** écouter les événements Socket.IO directement dans la page (pas de `socket.on('ranking_updated', ...)` dans le composant) — le `TournamentProvider` gère tout cela, les composants lisent simplement `useTournament()`.
- **NE PAS** créer une deuxième instance Socket.IO — `TournamentProvider` est singleton dans l'App.
- **NE PAS** modifier `TournamentContext.tsx` ni `useTournament.ts` — déjà complets pour 3.2.
- **NE PAS** modifier `websocket/events.ts` ni `routes/rankings.ts` — la mise à jour du type `PlayerRanking` dans `rankingsAggregator.ts` se propage automatiquement.
- **NE PAS** utiliser `any` en TypeScript — zéro tolérance sur ce projet.
- **NE PAS** utiliser `react-router-dom` — l'import est `'react-router'` (pattern établi dès Story 1.1).
- **NE PAS** oublier de retirer `disabled: true` sur le nav link — sinon le lien reste grisé visuellement même si la route est active.
- **NE PAS** coder en dur le nombre de rounds — les colonnes sont dynamiques basées sur `maxRounds`.
- **NE PAS** implémenter l'indicateur de victoire finale ni les animations — c'est Story 3.3 / 5.x.
- **NE PAS** toucher les composants admin ni le backoffice.

---

### État du code existant (ce qui existe déjà)

**Backend :**
- `backend/src/services/rankingsAggregator.ts` : existe, fonctionne — seule modification : étendre la requête + le type + la projection (Task 1)
- `backend/src/services/rankingsAggregator.test.ts` : 7 tests à maintenir (vérifier passage post-modification)
- `backend/src/routes/rankings.ts` : déjà délégué à `aggregateQualificationRankings` → bénéficiera automatiquement des nouveaux champs
- `backend/src/websocket/events.ts` : `emitRankingUpdated` appelle `aggregateQualificationRankings` → payload mis à jour automatiquement

**Frontend — fichiers EXISTANTS à ne pas recréer :**
- `frontend/src/hooks/useTournament.ts` : `useTournament()` retourne `{ state }` avec `state.rankings`, `state.isConnected`, `state.phase`, `state.currentDayNumber`
- `frontend/src/contexts/TournamentContext.tsx` : `TournamentProvider` monté dans `App.tsx` à la racine
- `frontend/src/services/socket.ts` : gestion Socket.IO déjà complète
- `frontend/src/types/index.ts` : `PlayerRanking` déjà défini — ajouter seulement `roundResults` et `isDropped`
- `frontend/src/App.tsx` : route `/qualifications` commentée — décommenter et importer `Qualifications`
- `frontend/src/components/common/Layout.tsx` : nav link `/qualifications` présent mais `disabled: true` — retirer le flag

**Frontend — fichiers à CRÉER :**
- `frontend/src/pages/Qualifications.tsx` (nouveau)
- `frontend/src/components/ranking/RankingTable.tsx` (nouveau — dossier `ranking/` à créer)

---

### Relation avec les stories adjacentes

- **Story 3.1 (DONE)** : fournit `TournamentContext`, `useTournament`, `ranking_updated` WebSocket — tout est prêt à consommer.
- **Story 3.3 (`3-3-polish-interface-resultats`)** : amélioration visuelle après 3.2. Ne pas anticiper ses features (animations, VictoryProgress, ConnectionStatus badge avancé).
- **Story 4.1 (Overlay OBS)** : réutilisera `useTournament()` et potentiellement `RankingTable` — concevoir `RankingTable` avec des props simples, pas de dépendances spécifiques à la page `/qualifications`.
- **Story 5.x (Finale)** : une page `/finale` sera créée similairement à `/qualifications` — même pattern, données différentes.

---

### NFR à vérifier

- **NFR1** (chargement < 2s) : la page Qualifications affiche les données depuis le Context déjà en mémoire → rendu quasi-instantané (pas de requête réseau au montage).
- **NFR2** (mise à jour WebSocket < 2s) : testé et validé en Story 3.1 — `ranking_updated` arrive < 2s. Le composant React re-render automatiquement via le Context.
- **NFR8** (emails non exposés) : `PlayerRanking` ne contient que `discordPseudo`, pas d'email — déjà conforme.

### Project Structure Notes

**Nouveaux fichiers :**
- `frontend/src/pages/Qualifications.tsx`
- `frontend/src/components/ranking/RankingTable.tsx`
- Dossier `frontend/src/components/ranking/` (nouveau sous-dossier)

**Fichiers à modifier :**
- `backend/src/services/rankingsAggregator.ts` — extension type + requête + projection
- `frontend/src/types/index.ts` — ajouter `roundResults` et `isDropped` à `PlayerRanking`
- `frontend/src/App.tsx` — décommenter route `/qualifications`
- `frontend/src/components/common/Layout.tsx` — retirer `disabled: true` sur nav link

**Fichiers EXPLICITEMENT à NE PAS toucher :**
- `backend/src/websocket/events.ts` — automatiquement mis à jour via le type
- `backend/src/routes/rankings.ts` — automatiquement mis à jour via le type
- `backend/src/routes/tournament.ts` — inchangé
- `backend/src/services/pointsCalculator.ts` — inchangé
- `backend/prisma/schema.prisma` — aucune migration nécessaire
- `frontend/src/contexts/TournamentContext.tsx` — inchangé
- `frontend/src/hooks/useTournament.ts` — inchangé
- `frontend/src/services/api.ts` — `fetchRankings()` inchangé (non utilisé dans cette story)
- `frontend/src/services/socket.ts` — inchangé
- Tous les composants admin — inchangés
- Toutes les pages existantes (`Home`, `MentionsLegales`, `Admin`, `AdminLogin`) — inchangées

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2 — Page Qualifications & Tableau de Classement]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 — FR26, FR27, FR30 + UX-DR4, UX-DR5, UX-DR6, UX-DR15]
- [Source: _bmad-output/planning-artifacts/architecture.md#UX-DR4 — lignes alternées, police généreuse]
- [Source: _bmad-output/planning-artifacts/architecture.md#UX-DR5 — top 8 couleur d'accent]
- [Source: _bmad-output/planning-artifacts/architecture.md#UX-DR6 — joueurs droppés grisés]
- [Source: _bmad-output/planning-artifacts/architecture.md#UX-DR12 — palette EDS Tailwind]
- [Source: _bmad-output/planning-artifacts/architecture.md#UX-DR13 — responsive, mobile supporté pages publiques]
- [Source: _bmad-output/planning-artifacts/architecture.md#UX-DR15 — cyan #80E2ED, or #DAB265 pour guider l'œil]
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR1 — chargement < 2s pages publiques]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend routing — /qualifications route]
- [Source: _bmad-output/planning-artifacts/architecture.md#Component architecture — RankingTable, PlayerRow]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend structure — pages/, components/ranking/, hooks/, contexts/]
- [Source: _bmad-output/implementation-artifacts/3-1-websocket-infrastructure-temps-reel.md#TournamentContext + useTournament]
- [Source: _bmad-output/implementation-artifacts/3-1-websocket-infrastructure-temps-reel.md#Relation avec stories futures — Story 3.2 consomme useTournament()]
- [Source: _bmad-output/implementation-artifacts/3-1-websocket-infrastructure-temps-reel.md#Review Findings — Collision State patch (spread vs destructuring)]
- [Source: frontend/src/App.tsx — route /qualifications commentée lignes 22-26]
- [Source: frontend/src/components/common/Layout.tsx — navLinks, disabled: true sur /qualifications]
- [Source: frontend/src/contexts/TournamentContext.tsx — TournamentState, TournamentProvider]
- [Source: frontend/src/hooks/useTournament.ts — hook public]
- [Source: frontend/src/types/index.ts — PlayerRanking interface actuelle (lignes 75-85)]
- [Source: frontend/src/index.css — EDS Tailwind v4 custom properties (couleurs + fonts)]
- [Source: backend/src/services/rankingsAggregator.ts — aggregateQualificationRankings, PlayerRanking]
- [Source: backend/src/services/rankingsAggregator.test.ts — 7 tests à maintenir]

## Dev Agent Record

### Agent Model Used

- claude-sonnet-4-6 — bmad-create-story workflow
- claude-opus-4-7 — bmad-dev-story workflow (implémentation)

### Debug Log References

### Completion Notes List

Analyse exhaustive complète — contexte développeur créé.

**Implémentation 2026-04-17 (Claude Opus 4.7) :**

- **Backend (Task 1)** : `rankingsAggregator.ts` étendu avec `PlayerRoundSummary`, `roundResults[]` et `isDropped`. Requête Prisma enrichie (`player.status` + `lobby.round.number`). Projection triée asc par `roundNumber`. Type `PlayerRanking` exporté reste rétrocompatible — `websocket/events.ts` et `routes/rankings.ts` bénéficient automatiquement via le type. `curl /api/rankings` confirme la présence des deux nouveaux champs sur les 15 joueurs en BDD.
- **Tests backend** : 7 tests existants mis à jour (factory `makeLobbyPlayer` ajoutée pour fournir `status` + `round.number`), 2 nouveaux tests ajoutés (`isDropped === true` quand status = 'dropped' ; `roundResults` trié par `roundNumber` asc). Total : **41/41 pass, 0 fail**.
- **Frontend types (Task 1.2)** : `PlayerRoundSummary` + extension `PlayerRanking` dans `frontend/src/types/index.ts` — strictement aligné sur le backend.
- **RankingTable (Task 2)** : composant pur, props `rankings` + `isConnected`. Table avec double ligne de header (R{n} colSpan=2 puis Place / Pts). Colonnes fixes en tête : Rang / Pseudo / Total (ordre choisi pour AC#6 — Total proche du début reste visible sur mobile sans scroll). Rounds dynamiques au milieu. Moy / Top1 / Top4 / Dern. en fin. Lignes alternées, bordure cyan sur top 8, séparateur doré après rang 8, droppés grisés avec pseudo barré.
- **Qualifications.tsx (Task 3)** : page consomme uniquement `useTournament()`, aucun `useEffect` ni REST. Logique empty state respectée (`phase === 'idle' && rankings.length === 0`).
- **Route + nav (Task 4)** : route `/qualifications` active dans `App.tsx`, nav link rendu cliquable (flag `disabled: true` retiré, finale reste disabled).
- **Vérifications automatisées** : `tsc -b && vite build` frontend = 0 erreur ; `node --test dist/services/*.test.js` backend = 41 pass.
- **Tests visuels manuels restants pour Brice lors de la revue** : validation top 8 visuelle, comportement drop en direct, scroll horizontal mobile iOS/Android, update WebSocket en live lors de la validation d'un round admin. Le code est conforme aux specs mais le rendu visuel final mérite une passe utilisateur dans le navigateur.

**Correctif 2026-04-17 (post-review Brice — multi-journées) :**

- **Bug observé** : lorsqu'une J2 démarrait après clôture de J1, les scores cumulés étaient corrects mais les colonnes R1, R2 du tableau affichaient uniquement les résultats J1 (J2R1 était masquée car le `find((r) => r.roundNumber === 1)` matchait J1R1 en premier). Les résultats de la deuxième journée n'étaient pas visibles par round.
- **Cause racine** : indexation des colonnes sur `roundNumber` seul, alors que `roundNumber` recommence à 1 à chaque nouvelle journée (contrainte `@@unique([dayId, number])` sur `Round`).
- **Correctif backend** : `PlayerRoundSummary` étendu avec `dayNumber`. Requête Prisma enrichie (`round.day.number`). Tri de `roundResults` par `(dayNumber asc, roundNumber asc)`. Nouveau test `multi-journees : J1 et J2 gardent des roundNumber distincts via dayNumber` — 10/10 tests backend pass.
- **Correctif frontend** : `buildRoundStructure()` extrait les couples `(dayNumber, roundNumber)` distincts triés + les regroupe par journée (`DayGroup[]`). `RankingTable` passe à un header 3 niveaux :
  - Ligne 1 : groupes "Journée N" (colSpan = nbRounds × 2) en `text-eds-gold`
  - Ligne 2 : labels de rounds "R1", "R2"… par journée
  - Ligne 3 : sous-en-têtes "Place" / "Pts"
  - Colonnes fixes (Rang, Pseudo, Total, Moy, Top1, Top4, Dern.) ont `rowSpan=3`
- **Séparateur visuel** : bordure gauche `border-l-2 border-eds-gold/60` sur la première colonne de chaque journée (entête + sous-entêtes + cellules body) et avant "Moy" pour fermer le groupe des journées.
- **Lookup cellule** : `findResult(roundResults, { dayNumber, roundNumber })` matche exactement le round d'une journée donnée — plus de collision entre J1R1 et J2R1.
- `curl /api/rankings` après fix confirme : Soulsiegfried = `[{J1R1:1/8}, {J1R2:2/7}, {J2R1:5/4}, {J2R2:1/8}]`, totalScore 27. Parfait.

### File List

**Créés :**
- `frontend/src/components/ranking/RankingTable.tsx`
- `frontend/src/pages/Qualifications.tsx`

**Modifiés :**
- `backend/src/services/rankingsAggregator.ts` (extension type + requête + projection)
- `backend/src/services/rankingsAggregator.test.ts` (factory mock + mocks mis à jour + 2 nouveaux tests)
- `frontend/src/types/index.ts` (ajout `PlayerRoundSummary` + champs sur `PlayerRanking`)
- `frontend/src/App.tsx` (import + route `/qualifications`)
- `frontend/src/components/common/Layout.tsx` (retrait `disabled: true`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut 3.2 ready-for-dev → in-progress → review)

## Senior Developer Review (AI)

**Reviewer :** LLM externe (requested par Brice)
**Review date :** 2026-04-17
**Review outcome :** Approve — aucun bloquant

### Résumé

Implémentation de très haute qualité, respecte scrupuleusement les AC. Couvre toute la stack (Prisma + agrégation → React + navigation). Le correctif multi-journées est jugé crucial pour la robustesse.

### Points forts

- **Robustesse multi-journées** : passage de `roundNumber` seul à `(dayNumber, roundNumber)` évite toute collision quand les numéros de rounds redémarrent à 1 chaque jour.
- **Performance (NFR1)** : `TournamentContext` déjà peuplé → affichage quasi-instantané sans requête réseau au montage.
- **Esthétique (UX-DR)** : palette EDS respectée, distinction Top 8 et traitement droppés conformes.
- **Tests** : couverture backend complète, cas limites inclus (score 0, multi-jours, droppés).

### Conformité Acceptance Criteria

- **AC #1** (calcul & tri Score desc > Top1 desc > Top4 desc > Last asc) : conforme, gestion des égalités OK.
- **AC #3** (drops) : joueurs `status: 'dropped'` grisés + barrés, reste dans le classement.
- **AC #5** (temps réel) : composant réactif via `ranking_updated` + Context.
- **AC #2** accessibilité : le séparateur Top 8 `<tr aria-hidden="true">` est une bonne pratique pour ne pas polluer les lecteurs d'écran.

### Action Items

- [x] [Med] **Sticky columns sur Rang / Pseudo / Total pour l'UX mobile sur tableaux larges** — sans sticky, le pseudo disparaissait en scroll horizontal avec 3 journées × plusieurs rounds. Résolu en v1.2 (2026-04-17) : passage à `border-separate border-spacing-0`, fond opaque alterné `bg-[#343163]` / `bg-eds-dark` sur cellules sticky, `truncate` + `title` sur pseudo.

## Tasks / Subtasks — Review Follow-ups (AI)

- [x] [AI-Review][Med] Sticky left-0 bg-eds-dark sur Rang / Pseudo / Total

## Change Log

| Date       | Version | Description                                                                                                          | Auteur |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-17 | 0.1     | Création du contexte développeur (bmad-create-story)                                                                 | Claude Sonnet 4.6 |
| 2026-04-17 | 1.0     | Implémentation complète : extension PlayerRanking backend + RankingTable + page Qualifications + route/nav + tests  | Claude Opus 4.7 |
| 2026-04-17 | 1.1     | Fix multi-journées : ajout `dayNumber` à `PlayerRoundSummary`, regroupement des colonnes par journée dans RankingTable, séparateur doré entre journées (signalé par Brice) | Claude Opus 4.7 |
| 2026-04-17 | 1.2     | Review follow-up : colonnes Rang / Pseudo / Total rendues `sticky` avec fond opaque alterné pour améliorer l'UX mobile sur tableaux larges (3 journées × plusieurs rounds) | Claude Opus 4.7 |
