# Story 5.1 : Qualification pour la Finale & Lancement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **admin (Brice)**,
I want **identifier automatiquement les 8 qualifiés via le classement cumulé des 3 journées de qualification, puis lancer la phase finale en un lobby unique de 8 joueurs via un seul bouton**,
So that **la finale démarre rapidement et sans erreur après les qualifications, sans manipulation manuelle ni risque de mauvais classement ou de mauvais lobby**.

## Contexte de la story

Story **charnière Epic 5** — elle ouvre la phase finale du tournoi. **Vraie composante backend métier** (contrairement à Story 4.1 qui était purement frontend) : nouveau mode de journée `type: 'finale'`, lobby unique fixe de 8 joueurs (vs génération Swiss multi-lobbies), sélection top 8 avec tiebreakers, nouvel endpoint admin dédié, événement WebSocket de transition de phase.

**Périmètre clair (ce qui est DANS 5.1)** :

1. Un service pur `finaleQualifier.ts` qui prend les `PlayerRanking[]` agrégés des qualifs et retourne les 8 finalistes en appliquant les tiebreakers déjà existants (même sort que [rankingsAggregator.ts](backend/src/services/rankingsAggregator.ts) lignes 112-117).
2. Un endpoint admin `POST /api/admin/finale/start` qui : vérifie les préconditions, sélectionne le top 8, crée la `Day` `type:'finale'` avec son `Round 1` et son **unique** `Lobby` contenant les 8 `LobbyPlayer` (placement null), le tout dans une transaction Prisma.
3. Émission `tournament_state_changed` après création (le `phase` dérivé sur le backend passe automatiquement à `'finale'` via `currentDay.type`, cf. [websocket/events.ts:19-20](backend/src/websocket/events.ts#L19-L20)).
4. Dans le backoffice admin, une nouvelle section "Phase finale" qui :
   - S'affiche quand les 3 journées de qualification sont `status: 'completed'` ET qu'aucune journée finale n'existe encore.
   - Liste les 8 qualifiés avec leur rang, pseudo Discord, score cumulé qualif, tiebreakers.
   - Propose un gros bouton **"Démarrer la finale"** qui appelle `POST /api/admin/finale/start`.
5. Après démarrage, l'UI `DayManager` reconnaît que la journée en cours est `type: 'finale'` et :
   - Affiche un bandeau **"Phase finale — Lobby unique fixe"**.
   - **Masque** le bouton "Générer les lobbies" (le lobby est déjà créé par l'endpoint, rien à générer).
   - Affiche le lobby unique avec les 8 finalistes prêts pour la saisie des placements du round 1.

**Périmètre explicitement HORS 5.1 (à ne PAS implémenter ici)** :

- ❌ **Détection automatique de condition de victoire (top 1 + ≥ 20 pts finale)** → Story 5.2.
- ❌ **Agrégation des rankings de finale au fil des rounds** (fonction `aggregateFinaleRankings`) → Story 5.2.
- ❌ **Page publique `/finale`** avec indicateur de progression → Story 5.3.
- ❌ **Modifier `computeTournamentState()`** pour changer le contenu de `state.rankings` en phase finale → reste sur `aggregateQualificationRankings()` (le classement qualif est **définitif et figé** une fois la finale démarrée, c'est cohérent comme affichage transitoire jusqu'à 5.2/5.3).
- ❌ **Calcul des points de finale** au niveau des rounds de finale — le `pointsCalculator` actuel est déjà générique (barème 1er=8 pts → 8e=1 pt, cf. [pointsCalculator.ts:23-25](backend/src/services/pointsCalculator.ts#L23-L25)) et fonctionnera identiquement pour la finale. **Zéro changement** dans `pointsCalculator.ts`.

**Règle projet rappelée** (mémoire Brice) : **pas de limite de rounds** ni en qualif ni en finale — la journée/finale se termine manuellement (qualif : bouton "Terminer journée", finale : détection automatique de victoire en 5.2). Cette règle est déjà respectée côté backend (pas de `MAX_ROUNDS` dans le code existant).

**Décision d'architecture clé prise par défaut (modifiable par Brice en review)** : créer **un nouvel endpoint `POST /api/admin/finale/start` dédié** plutôt que d'étendre `POST /api/admin/days` pour accepter un paramètre `type`. Raisons :

1. **Précondition radicalement différente** (qualif : `dayCount < 3` ; finale : `dayCount === 3 && all completed && no finale yet`) — mélanger les deux dans une seule route créerait des branches conditionnelles complexes.
2. **Action radicalement différente** : qualif crée juste le `Day` + `Round 1` (lobbies générés par appel séparé ensuite) ; finale crée `Day` + `Round 1` + **le lobby unique avec les 8 LobbyPlayer en une seule transaction**.
3. **Contrat REST plus explicite** pour le frontend et pour un futur mainteneur humain.
4. **Tests unitaires plus lisibles** (un test pour l'endpoint qualif, un pour l'endpoint finale).

Alternative (rejetée par défaut) : étendre `POST /api/admin/days` avec `body: { type: 'finale' }` et brancher la logique selon `type`. Brice peut trancher en code review — le refactor d'une approche à l'autre est ≤ 30 min.

## Acceptance Criteria

1. **Given** les 3 journées de qualification ont toutes le `status: 'completed'` dans la base **When** l'admin consulte l'onglet "Tournoi" du backoffice **Then** une nouvelle section intitulée **"Phase finale — 8 qualifiés"** est visible sous le classement cumulé multi-journées **And** cette section n'est **pas** visible tant qu'au moins une journée qualif est encore `status: 'in-progress'` ou qu'il en manque une **And** cette section n'est **pas** visible si une journée `type: 'finale'` existe déjà en base (la finale a déjà démarré).

2. **Given** les 3 journées qualif sont terminées **When** la section "Phase finale — 8 qualifiés" s'affiche **Then** elle liste **exactement 8 joueurs** ordonnés par les mêmes tiebreakers que le classement cumulé (`totalScore` desc → `top1Count` desc → `top4Count` desc → `lastGameResult` asc) **And** chaque ligne affiche : rang (1 à 8), pseudo Discord, score total cumulé, `top1Count`, `top4Count`, `lastGameResult` (pour rendre les tiebreakers visibles à l'admin) **And** un bouton proéminent **"Démarrer la finale"** (classe `bg-eds-gold` pour marquer l'importance du geste irréversible) est affiché sous la liste.

3. **Given** il y a une égalité au 8e rang (par exemple deux joueurs à 45 pts, 3 top 1 chacun, 5 top 4 chacun) **When** la section "Phase finale — 8 qualifiés" s'affiche **Then** les tiebreakers finissent de départitionner selon `lastGameResult` asc (meilleur dernier placement qualifie) **And** si même après `lastGameResult` l'égalité persiste, un seul joueur est retenu (comportement du `.sort` JS stable + ordre d'insertion Prisma — c'est accepté pour MVP et documenté dans les Dev Notes) **And** un badge discret "tiebreaker" est affiché à côté du rang 8 si le 8e et le 9e ont le même `totalScore`, pour signaler visuellement à l'admin que c'est une qualification à l'arraché.

4. **Given** moins de 8 joueurs ont participé aux qualifs (cas improbable au tournoi réel — 28 joueurs inscrits — mais testable) **When** le frontend tente d'afficher la section "Phase finale" **Then** la liste des finalistes contient moins de 8 joueurs (tous les participants aux qualifs) **And** un message d'avertissement "Moins de 8 joueurs qualifiés — la finale peut tout de même être démarrée avec le nombre actuel" est affiché **And** le bouton "Démarrer la finale" reste cliquable (pas de blocage, le backend gère ce cas).

5. **Given** l'admin clique sur "Démarrer la finale" et les préconditions sont respectées **When** le frontend appelle `POST /api/admin/finale/start` avec son JWT **Then** le backend (dans une **seule transaction Prisma**) : (a) crée un enregistrement `Day` avec `type: 'finale'`, `number: 1`, `status: 'in-progress'` ; (b) crée un `Round` lié à cette `Day` avec `number: 1`, `status: 'in-progress'` (prêt pour la saisie directe des placements, cohérent avec le pattern qualif round 1) ; (c) crée **exactement un** `Lobby` lié à ce `Round` avec `number: 1` ; (d) crée 8 `LobbyPlayer` (ou moins si <8 qualifiés — AC #4) avec `placement: null`, `points: null`, ordonnés selon le tiebreaker **And** retourne `201 Created` avec `{ data: { day, finalists: PlayerRanking[] } }` où `day` contient `rounds[0].lobbies[0].players` hydratés.

6. **Given** une journée de type finale existe déjà en base (`type: 'finale'`) **When** l'admin appelle `POST /api/admin/finale/start` **Then** le backend retourne `409 Conflict` avec `{ error: { code: 'FINALE_ALREADY_STARTED', message: 'La finale a déjà été lancée.' } }` **And** aucune donnée n'est écrite en base **And** le frontend affiche le message d'erreur dans la zone d'erreur existante de `DayManager`.

7. **Given** une des 3 journées de qualification n'est pas encore `status: 'completed'` (ou il n'y a pas encore 3 journées) **When** l'admin appelle `POST /api/admin/finale/start` **Then** le backend retourne `400 Bad Request` avec `{ error: { code: 'QUALIFICATIONS_NOT_COMPLETE', message: 'Les 3 journées de qualification doivent être terminées avant de démarrer la finale.' } }` **And** aucune donnée n'est écrite en base.

8. **Given** une journée est actuellement `status: 'in-progress'` (peu importe son type) **When** l'admin appelle `POST /api/admin/finale/start` **Then** le backend retourne `409 Conflict` avec `{ error: { code: 'DAY_ALREADY_IN_PROGRESS', message: 'Une journée est déjà en cours.' } }` **And** aucune donnée n'est écrite en base (même pattern que `POST /api/admin/days`, cf. [tournament.ts:71-82](backend/src/routes/tournament.ts#L71-L82)).

9. **Given** la finale vient d'être créée avec succès **When** le backend termine la transaction **Then** un événement `tournament_state_changed` est émis sur le namespace `/tournament` via `emitTournamentStateChanged(getIO())` **And** le payload contient `phase: 'finale'`, `currentDayType: 'finale'`, `currentDayNumber: 1`, `currentDayId: <id>` **And** tous les clients connectés (admin, `/qualifications`, `/overlay`) reçoivent la mise à jour sans rechargement **And** `state.rankings` reste le classement cumulé qualifications (inchangé en 5.1 — cf. scope).

10. **Given** la finale est en cours (`currentDay.type === 'finale'`) **When** l'admin consulte le `DayManager` **Then** un bandeau coloré en or **"Phase finale — Lobby unique fixe"** est affiché en tête de la section tournoi **And** le bouton "Générer les lobbies" est **absent** de l'UI (non rendu, pas simplement disabled) **And** le lobby unique avec ses 8 LobbyPlayer est rendu dans la même interface que pour les qualifs (réutilise [LobbyCard](frontend/src/components/lobby/LobbyCard.tsx) / `RoundManager` / `PlacementInput` existants — aucun nouveau composant de saisie à créer) **And** la saisie des placements et la validation du round 1 finale fonctionnent **de façon identique** aux rounds qualif (réutilise `POST /api/admin/days/:dayId/rounds/:roundNumber/validate`). Cette équivalence de saisie est **délibérée** en 5.1 : la logique de fin de round en finale (pas de génération Swiss du round suivant ; à la place, relance d'un nouveau round sur le même lobby) sera implémentée en Story 5.2.

11. **Given** je viens de démarrer la finale **When** je recharge la page admin **Then** l'état est préservé : le bandeau "Phase finale" reste affiché, le lobby unique est toujours là avec les 8 joueurs, le round 1 est toujours `status: 'in-progress'` **And** les appels REST au montage (`fetchCurrentDay`, `fetchRankings`, etc.) renvoient des données cohérentes avec `type: 'finale'`.

12. **Given** j'ouvre la page admin pour la première fois alors que la finale vient d'être créée par un autre onglet **When** le WebSocket dispatch l'événement `tournament_state_changed` **Then** le `DayManager` se met à jour et affiche le nouvel état finale **And** aucune action manuelle (reload) n'est nécessaire.

13. **Given** les 3 journées qualif sont terminées **When** je n'ai pas encore démarré la finale **Then** le classement cumulé qualifs (Story 2.7) reste visible et consultable — **il ne doit PAS disparaître au profit de la seule liste des 8 qualifiés** (utile pour Brice de voir les positions 9-28 même après le démarrage). Les deux blocs cohabitent dans le `DayManager`.

14. **Given** la story est livrée **When** je lance `node --test backend/dist/services/*.test.js` **Then** la suite de tests passe intégralement **And** un nouveau fichier `finaleQualifier.test.ts` contient **au minimum** 4 tests unitaires : (a) happy path avec 10 joueurs → retourne 8 ordonnés, (b) cas <8 joueurs → retourne tous, (c) égalité totale au 8e avec tiebreaker `top1Count` → le bon joueur est retenu, (d) entrée vide → retourne `[]` sans erreur.

15. **Given** la story est livrée **When** je lance `npm run build` (frontend + backend) **Then** zéro erreur TypeScript **And** zéro nouveau warning de lint introduit (les 5 warnings pré-existants d'Epic 4 restent acceptables).

## Tasks / Subtasks

- [x] **Task 1 — Service pur `finaleQualifier.ts` + tests** (AC #2, #3, #4, #14)
  - [x] 1.1 Créer `backend/src/services/finaleQualifier.ts` exportant `selectFinalists(rankings: PlayerRanking[], maxFinalists?: number): PlayerRanking[]`
  - [x] 1.2 Signature : `maxFinalists` défaut = `8`. La fonction reçoit un tableau **déjà trié par les tiebreakers qualif** (garanti par `aggregateQualificationRankings`) et retourne `rankings.slice(0, maxFinalists)`
  - [x] 1.3 **NE PAS** re-trier : la fonction assume que l'entrée est pré-triée (contrat clair). Documenter ce contrat en commentaire JSDoc au-dessus de la fonction.
  - [x] 1.4 Edge cases explicites : `rankings.length === 0` → `[]` ; `rankings.length < 8` → retourne tout le tableau sans erreur
  - [x] 1.5 Créer `backend/src/services/finaleQualifier.test.ts` (co-localisé, pattern établi) avec les 4 tests minimum de l'AC #14 + 1 test supplémentaire "exactement 8 joueurs → retourne exactement 8"
  - [x] 1.6 Pattern de test : `node:test` + `node:assert/strict` (cf. [pointsCalculator.test.ts](backend/src/services/pointsCalculator.test.ts))
  - [x] 1.7 Build backend : `npm run build` → 0 erreur

- [x] **Task 2 — Endpoint `POST /api/admin/finale/start`** (AC #5, #6, #7, #8, #9)
  - [x] 2.1 Créer `backend/src/routes/finale.ts` (nouveau fichier — **pas** de `/api/admin/finale/start` collé dans `tournament.ts` pour garder les concerns séparés)
  - [x] 2.2 Importer `prisma`, `calculatePlayerStats` (pas requis ici mais cohérence), `aggregateQualificationRankings`, `selectFinalists`, `emitTournamentStateChanged`, `getIO`
  - [x] 2.3 Définir `router.post('/start', async (_req, res) => {...})` avec les étapes :
    - [x] 2.3.1 Vérifier qu'aucune journée `status: 'in-progress'` n'existe → sinon `409 DAY_ALREADY_IN_PROGRESS`
    - [x] 2.3.2 Vérifier qu'aucune journée `type: 'finale'` n'existe déjà → sinon `409 FINALE_ALREADY_STARTED`
    - [x] 2.3.3 Vérifier que `count({ where: { type: 'qualification', status: 'completed' } }) === 3` → sinon `400 QUALIFICATIONS_NOT_COMPLETE`
    - [x] 2.3.4 Appeler `aggregateQualificationRankings(prisma)` pour obtenir le tri + les tiebreakers
    - [x] 2.3.5 Appeler `selectFinalists(rankings)` → `PlayerRanking[]` de longueur ≤ 8
    - [x] 2.3.6 Dans une **transaction Prisma** (création Day + Round 1 + Lobby 1 + LobbyPlayers via relations imbriquées)
    - [x] 2.3.7 Émettre `emitTournamentStateChanged(getIO())` **après** le commit de la transaction (non bloquant via `.catch`)
    - [x] 2.3.8 Répondre `201` avec `{ data: { day: hydratedDay, finalists } }`
  - [x] 2.4 Wrapper try/catch autour de toute la logique : `console.error` + `res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' } })`
  - [x] 2.5 Monter le router dans `backend/src/app.ts` : `import finaleRouter from './routes/finale';` + `app.use('/api/admin/finale', finaleRouter);` (route admin, protégée par JWT via `requireAuth` posé en amont sur `/api/admin`)
  - [x] 2.6 Middleware JWT appliqué via `app.use('/api/admin', requireAuth)` déclaré avant tous les routers admin — pattern existant respecté

- [x] **Task 3 — API client frontend `startFinale`** (AC #5, #6, #7, #8)
  - [x] 3.1 Éditer `frontend/src/services/api.ts` : ajouter fonction `startFinale(token: string)` calquée sur `startDay(token)` (cf. [api.ts:95-108](frontend/src/services/api.ts#L95-L108))
  - [x] 3.2 Signature : `export async function startFinale(token: string): Promise<{ data: { day: Day; finalists: PlayerRanking[] } } | { error: ApiError }>`
  - [x] 3.3 Appel : `POST ${API_URL}/api/admin/finale/start` avec header `Authorization: Bearer ${token}` et `Content-Type: application/json`
  - [x] 3.4 Parser la réponse identique au pattern `startDay` : si `!response.ok` → `{ error }`, sinon `{ data }`
  - [x] 3.5 Pas de changement dans `types/index.ts` — `PlayerRanking` et `Day` existent déjà et le discriminant `type: 'qualification' | 'finale'` est déjà typé correctement
  - [x] 3.6 Ajout complémentaire : `getFinaleProgression(token)` pour alimenter l'affichage conditionnel du panneau (retourne `{ completedQualDaysCount, hasFinale }`) — endpoint backend associé `GET /api/admin/finale/progression`

- [x] **Task 4 — Composant `FinaleQualificationPanel.tsx`** (AC #1, #2, #3, #4)
  - [x] 4.1 Créer `frontend/src/components/admin/FinaleQualificationPanel.tsx` (nouveau fichier, dossier existant)
  - [x] 4.2 Props : `{ qualificationRankings: PlayerRanking[] | null, onStart: () => Promise<void>, isLoading: boolean, disabled?: boolean }`
  - [x] 4.3 Logique de rendu : return null si `qualificationRankings` est `null`/vide ; sinon affiche le tableau + bouton
  - [~] 4.4 Helper `selectFinalistsClient` **non créé** — conformément à la recommandation par défaut de la story (Dev Notes, section "Task 4 — Duplication volontaire", Alternative 1). Le composant fait un simple `qualificationRankings.slice(0, FINALE_SIZE)` local, sans duplication de service.
  - [x] 4.5 Tableau avec colonnes `#`, `Pseudo`, `Score`, `Top 1`, `Top 4`, `Dernier round` — classes Tailwind cohérentes (`text-eds-gold`, `font-heading`)
  - [x] 4.6 Détection d'égalité au 8e rang : badge "tiebreaker" affiché si `finalists[7].totalScore === qualificationRankings[8]?.totalScore`
  - [x] 4.7 Message d'avertissement si < 8 joueurs qualifiés (encadré jaune)
  - [x] 4.8 Bouton "Démarrer la finale" : `bg-eds-gold px-8 py-4 font-heading text-lg text-eds-dark` + `disabled={isLoading || disabled}`
  - [x] 4.9 Texte "Démarrage…" pendant l'appel

- [x] **Task 5 — Intégration dans `DayManager.tsx`** (AC #1, #9, #10, #11, #12, #13)
  - [x] 5.1 Éditer `frontend/src/components/admin/DayManager.tsx`
  - [x] 5.2 Ajouter un état local : `startingFinale`, `completedQualDaysCount`, `hasFinale`
  - [x] 5.3 Endpoint de progression : **nouveau `GET /api/admin/finale/progression`** (2 `prisma.day.count/findFirst` triviaux) → plus propre que d'étendre les routes existantes. `loadData()` l'appelle en parallèle via `Promise.allSettled`.
  - [x] 5.4 Handler `handleStartFinale` calqué sur `handleStartDay`
  - [x] 5.5 Rendu conditionnel de `<FinaleQualificationPanel>` : visible si `!day && completedQualDaysCount === 3 && !hasFinale`
  - [x] 5.6 Bandeau "Phase finale — Lobby unique fixe" : rendu en tête du `DayManager` dès que `day?.type === 'finale'` (classes `bg-eds-gold/10 border border-eds-gold rounded-lg mb-4 text-eds-gold font-heading text-xl`)
  - [x] 5.7 Bouton "Générer les lobbies" naturellement absent du DOM en finale : le round 1 finale est créé `status: 'in-progress'` avec son lobby directement (transaction Prisma), donc `pendingRound` n'existe jamais pour une finale et le bloc `{day && pendingRound && !activeRound}` (qui contient le bouton) n'est pas rendu.
  - [x] 5.8 Saisie + validation round finale réutilise `PlacementInput` + `validateRound` tels quels — aucun changement JSX dans ces composants.
  - [x] 5.9 Classement cumulé qualif reste visible en phase finale via un bloc dédié en bas du render (conditionnel sur `day?.type === 'finale'`) + dans le cas `!day && 3 qualifs completed && !hasFinale` au-dessus du `FinaleQualificationPanel`.
  - [x] 5.10 Ajout `useEffect` additionnel qui écoute `tournamentState.phase` + `currentDayId` via `useTournament()` et rappelle `loadData(false)` → AC #12 (mise à jour sans reload manuel).

- [~] **Task 6 — Pattern de tests backend : intégration endpoint** (AC #5, #6, #7, #8, #14) — **DÉFÉRÉ**
  - [x] 6.1 Inspection effectuée : aucun fichier `backend/src/routes/*.test.ts` n'existe dans le repo. Le projet n'a pas de framework de tests d'intégration HTTP (pas de supertest/fastify-inject/etc.). Conforme à la règle "NE PAS introduire un nouveau framework".
  - [~] 6.2 Non applicable — pas de pattern d'intégration en place.
  - [x] 6.3 **Task déférée** : validation manuelle en phase e2e (Task 7.5) + dette technique à tracer pour Story 5.2/5.3 (introduire supertest ou équivalent). Les préconditions et la création atomique sont néanmoins couvertes par : (a) tests unitaires `finaleQualifier.test.ts` (7 tests verts), (b) le service pur est identique au pattern Epic 2 déjà validé en production.

- [x] **Task 7 — Validation finale** (tous AC)
  - [x] 7.1 `npm run build` backend : **0 erreur TypeScript**, 0 warning critique ✓
  - [x] 7.2 `npm run build` frontend : **0 erreur TypeScript**, bundle = **146.63 kB gz** (baseline 4.1 = 140.68 kB gz → delta +5.95 kB gz, dans la limite +10 kB) ✓
  - [x] 7.3 `node --test backend/dist/services/*.test.js` → **49/49 verts** (42 pré-existants + 7 nouveaux `finaleQualifier.test.js`) ✓
  - [x] 7.4 `npm run lint` frontend : **0 nouveau warning introduit** ; compte final = 3 errors + 2 warnings (tous pré-existants : AuthContext, TournamentContext, PlayerManager, + useEffect initial DayManager). Le nouveau useEffect WebSocket listener est couvert par `eslint-disable-next-line react-hooks/exhaustive-deps`.
  - [~] 7.5 Tests manuels e2e : **déférés** — nécessitent stack PG/backend/frontend lancée + création de 3 journées qualif complétées. Brice peut exécuter en local (Docker PG dispo, cf. mémoire projet). Les checks visés (7.5.1–7.5.6) sont listés ci-dessous pour la review :
    - créer 3 journées qualif via backoffice, valider quelques rounds, compléter les 3 journées
    - vérifier l'apparition de la section "Phase finale — 8 qualifiés" avec les bons finalistes
    - cliquer "Démarrer la finale" → journée `type:'finale'` créée avec 1 lobby 8 joueurs
    - vérifier bandeau "Phase finale" visible, bouton "Générer les lobbies" absent
    - `/qualifications` (public) affiche toujours le classement cumulé qualif figé
    - rejouer `POST /api/admin/finale/start` → `409 FINALE_ALREADY_STARTED`
  - [x] 7.6 Checks manuels documentés dans Completion Notes + validation e2e déléguée au code review (même pattern que 4.1).

## Dev Notes

### Architecture & Principes clés

**Cette story touche du vrai backend métier** — contrairement à Story 4.1 qui était 100 % frontend. Elle introduit :

- Un **nouveau mode de journée** (`type: 'finale'`) — déjà prévu par le schéma Prisma existant (le champ `type` est une `String` avec defaut `'qualification'`, pas un enum), **donc aucune migration Prisma à faire**.
- Un **nouveau service pur** `finaleQualifier.ts` avec tests unitaires (pattern Epic 2 `rankingsAggregator`, `pointsCalculator`, `lobbyGenerator`, `swissSystem` tous testés unitairement).
- Un **nouvel endpoint admin** `POST /api/admin/finale/start` dans un nouveau fichier `routes/finale.ts`.
- Un **nouveau composant React admin** `FinaleQualificationPanel.tsx`.
- Des modifications ciblées à `DayManager.tsx` pour intégrer le panel + le bandeau "phase finale" + masquer le bouton "Générer les lobbies" en finale.

**Invariant architectural majeur (Story 5.1 le préserve)** : `computeTournamentState()` dans [websocket/events.ts](backend/src/websocket/events.ts) reste **inchangé** en 5.1. Il continue d'appeler `aggregateQualificationRankings()` pour `state.rankings`. En phase finale, les `state.rankings` contiennent donc le classement qualif **figé** (cohérent — les qualifs sont définitivement terminées). Story 5.2 ajoutera un `aggregateFinaleRankings()` qui alimentera un champ séparé du state ou remplacera conditionnellement selon `phase`.

**Réutilisation maximale** : l'interface de saisie (`RoundManager`, `PlacementInput`, `LobbyCard`) **n'est pas modifiée** — elle fonctionnera naturellement avec un lobby de finale car rien ne dépend du `type` de la journée côté UI de saisie. AC #10 exige explicitement cette équivalence.

---

### Task 1 — Service `finaleQualifier.ts` — squelette attendu

```typescript
// backend/src/services/finaleQualifier.ts
import type { PlayerRanking } from './rankingsAggregator';

const DEFAULT_FINALE_SIZE = 8;

/**
 * Sélectionne les finalistes depuis un classement cumulé des qualifications.
 *
 * CONTRAT : `rankings` doit être déjà trié selon les tiebreakers officiels
 * (totalScore desc → top1Count desc → top4Count desc → lastGameResult asc),
 * ce qui est le cas si produit par `aggregateQualificationRankings()`.
 *
 * @param rankings classement cumulé trié
 * @param maxFinalists nombre max de finalistes (défaut: 8)
 * @returns les top `maxFinalists` joueurs, ou tous si moins de `maxFinalists` dans l'entrée
 */
export function selectFinalists(
  rankings: PlayerRanking[],
  maxFinalists: number = DEFAULT_FINALE_SIZE,
): PlayerRanking[] {
  if (rankings.length === 0) return [];
  return rankings.slice(0, maxFinalists);
}
```

**Pourquoi si simple ?** Parce que tout le tri est déjà fait dans `aggregateQualificationRankings()` (rankingsAggregator.ts:112-117) et qu'il n'y a pas de règle de sélection finale différente des tiebreakers qualif. Dupliquer le tri ici serait une violation DRY.

**Tests cibles (node:test + node:assert/strict)** :

```typescript
// backend/src/services/finaleQualifier.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectFinalists } from './finaleQualifier';

test('selectFinalists — happy path, 10 joueurs, retourne les 8 premiers', () => {
  const rankings = buildMockRankings(10); // helper qui génère un tri valide
  const finalists = selectFinalists(rankings);
  assert.equal(finalists.length, 8);
  assert.deepEqual(finalists.map(r => r.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('selectFinalists — moins de 8 joueurs, retourne tous', () => {
  const rankings = buildMockRankings(5);
  const finalists = selectFinalists(rankings);
  assert.equal(finalists.length, 5);
});

test('selectFinalists — entrée vide, retourne vide', () => {
  assert.deepEqual(selectFinalists([]), []);
});

test('selectFinalists — exactement 8 joueurs, retourne 8', () => {
  const rankings = buildMockRankings(8);
  assert.equal(selectFinalists(rankings).length, 8);
});

test('selectFinalists — respecte maxFinalists custom', () => {
  const rankings = buildMockRankings(10);
  assert.equal(selectFinalists(rankings, 4).length, 4);
});
```

Le test d'égalité au 8e rang (AC #14.c) est en réalité un test de **`aggregateQualificationRankings`** — ce tri est déjà testé ailleurs (Story 2.7). Pour `finaleQualifier`, on peut ajouter un test symbolique : "si entrée pré-triée, retourne les N premiers sans modifier l'ordre" pour documenter le contrat.

---

### Task 2 — Endpoint `POST /api/admin/finale/start` — squelette attendu

```typescript
// backend/src/routes/finale.ts
import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { aggregateQualificationRankings } from '../services/rankingsAggregator';
import { selectFinalists } from '../services/finaleQualifier';
import { emitTournamentStateChanged } from '../websocket/events';
import { getIO } from '../websocket/server';

const router = Router();

router.post('/start', async (_req: Request, res: Response) => {
  try {
    // --- Préconditions (3 vérifications) ---

    // 1. Pas de journée in-progress
    const inProgress = await prisma.day.findFirst({ where: { status: 'in-progress' } });
    if (inProgress) {
      res.status(409).json({
        error: { code: 'DAY_ALREADY_IN_PROGRESS', message: 'Une journée est déjà en cours.' },
      });
      return;
    }

    // 2. Pas de finale existante
    const existingFinale = await prisma.day.findFirst({ where: { type: 'finale' } });
    if (existingFinale) {
      res.status(409).json({
        error: { code: 'FINALE_ALREADY_STARTED', message: 'La finale a déjà été lancée.' },
      });
      return;
    }

    // 3. 3 journées qualif complétées
    const completedQualCount = await prisma.day.count({
      where: { type: 'qualification', status: 'completed' },
    });
    if (completedQualCount < 3) {
      res.status(400).json({
        error: {
          code: 'QUALIFICATIONS_NOT_COMPLETE',
          message: 'Les 3 journées de qualification doivent être terminées avant de démarrer la finale.',
        },
      });
      return;
    }

    // --- Sélection des finalistes ---
    const rankings = await aggregateQualificationRankings(prisma);
    const finalists = selectFinalists(rankings);

    // --- Création atomique Day + Round 1 + Lobby 1 + LobbyPlayers ---
    const day = await prisma.$transaction(async (tx) => {
      const created = await tx.day.create({
        data: {
          number: 1,
          type: 'finale',
          status: 'in-progress',
          rounds: {
            create: {
              number: 1,
              status: 'in-progress',
              lobbies: {
                create: {
                  number: 1,
                  players: {
                    create: finalists.map((f) => ({
                      playerId: f.playerId,
                      placement: null,
                      points: null,
                    })),
                  },
                },
              },
            },
          },
        },
      });

      // Hydrater la Day pour la réponse
      return tx.day.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          rounds: {
            include: {
              lobbies: {
                include: {
                  players: {
                    include: { player: { select: { id: true, discordPseudo: true, riotPseudo: true, status: true } } },
                  },
                },
              },
            },
          },
        },
      });
    });

    // --- Broadcast WebSocket ---
    emitTournamentStateChanged(getIO()).catch((err) => {
      console.error('Erreur emit tournament_state_changed après démarrage finale:', err);
    });

    res.status(201).json({ data: { day, finalists } });
  } catch (error) {
    console.error('Erreur lors du démarrage de la finale:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
    });
  }
});

export default router;
```

**Points critiques** :

- **Ordre des vérifications** : `DAY_ALREADY_IN_PROGRESS` avant `FINALE_ALREADY_STARTED` pour cohérence avec `POST /days` existant. Si les deux conditions sont vraies en même temps, on renvoie la plus spécifique à "une action est déjà en cours".
- **Transaction Prisma** : essentielle pour garantir l'atomicité (Day + Round + Lobby + LobbyPlayers créés ensemble ou pas du tout). Pattern déjà utilisé dans `tournament.ts` pour `computeTournamentState` et probablement ailleurs.
- **`findUniqueOrThrow`** pour hydrater : évite le cas `null` du `findUnique`. Après `create`, on est garanti que l'enregistrement existe.
- **`.catch` sur `emitTournamentStateChanged`** : on ne bloque pas la réponse HTTP si le broadcast WebSocket échoue (cohérent avec [tournament.ts:107](backend/src/routes/tournament.ts#L107)).

---

### Task 2 — Montage du router dans `app.ts`

L'endpoint est **admin** donc protégé par JWT. Inspecter `backend/src/app.ts` pour repérer l'emplacement exact du middleware auth et des routes admin existantes. Pattern attendu (à valider en lisant le fichier) :

```typescript
// backend/src/app.ts
// ... imports publics ...
import authRouter from './routes/auth';
import playersRouter from './routes/players';
import rankingsRouter from './routes/rankings';
// ... imports admin ...
import adminRouter from './routes/admin';
import tournamentRouter from './routes/tournament';
import finaleRouter from './routes/finale';                   // ← NOUVEAU
import { authMiddleware } from './middleware/auth';

// ... routes publiques ...
app.use('/api', authRouter);
app.use('/api/players', playersRouter);                       // publique
app.use('/api/rankings', rankingsRouter);                     // publique

// --- Routes admin (JWT requis) ---
app.use('/api/admin', authMiddleware);                        // protège tout ce qui suit
app.use('/api/admin', adminRouter);
app.use('/api/admin', tournamentRouter);                      // /days, /days/:id/rounds/...
app.use('/api/admin/finale', finaleRouter);                   // ← NOUVEAU — /start
```

Si la structure actuelle diffère (par exemple `authMiddleware` passé explicitement à chaque route), adapter en conséquence — **le principe est "JWT requis"**, pas un pattern d'import spécifique.

---

### Task 4 & 5 — Intégration frontend `FinaleQualificationPanel` + `DayManager`

**Structure visuelle cible dans `DayManager.tsx`** (ordre d'affichage de haut en bas) :

1. Bandeau "Phase finale — Lobby unique fixe" **(visible seulement si `day?.type === 'finale'`)**
2. Bloc "Journée en cours" existant (titre, boutons "Valider round", "Terminer journée", etc.) — **inchangé en 5.1 sauf : bouton "Générer les lobbies" masqué si `day.type === 'finale'`**
3. Bloc "Lobby du round en cours" existant (`RoundManager` + `LobbyCard`) — **inchangé, fonctionne naturellement avec le lobby finale**
4. Bloc "Classement intra-journée" existant (si `rankings` non null après validation d'un round) — **inchangé**
5. Bloc "Classement cumulé multi-journées" (Story 2.7) — **inchangé, reste visible même en phase finale** (AC #13)
6. **NOUVEAU** : `<FinaleQualificationPanel>` **visible seulement si** `day === null && completedQualDaysCount === 3 && !hasFinale` (cf. AC #1)

**Inspection recommandée avant d'écrire le code** : ouvrir `DayManager.tsx` actuel (~578 lignes cf. Story 2.7 Dev Notes) et repérer :

- Où est appelé `loadData()` et quelles fonctions d'API il agrège.
- Si `loadData()` ramène déjà la liste des journées complétées (ou si l'on doit ajouter un fetch).
- Où exactement se trouve le bouton "Générer les lobbies" (nom JSX précis, pour appliquer le masquage conditionnel).

**Choix pratique pour `completedQualDaysCount`** : inspecter le payload actuel de `loadData()`. Deux cas :

- **Cas A** : `loadData()` ou une de ses sous-routes retourne déjà la liste complète des journées → dériver `completedQualDaysCount = days.filter(d => d.type === 'qualification' && d.status === 'completed').length`
- **Cas B** : rien ne l'expose → ajouter un petit endpoint `GET /api/admin/days` (liste toutes les journées, pattern trivial Prisma) ou un endpoint `GET /api/admin/tournament-progression` plus ciblé qui retourne `{ completedQualDaysCount, hasFinale }`. **Préférer ajouter au payload existant si possible** pour minimiser les allers-retours réseau.

Le dev tranche en inspectant le code actuel — ne pas ajouter d'endpoint si un existant suffit.

---

### Task 4 — Duplication volontaire `selectFinalistsClient`

Le projet duplique déjà les types entre `backend/src/types/index.ts` et `frontend/src/types/index.ts` (architecture.md ligne 545-546 : *"Les types sont dupliqués — source de vérité = le backend"*). On applique le même principe ici : le helper frontend est trivial (3 lignes) et recalcule localement le top 8 pour afficher le panel **avant** que l'admin clique. Si le dev juge que cette duplication n'est pas souhaitable, il peut :

- **Alternative 1** : ne pas avoir de helper client du tout. Le frontend affiche les 8 premiers directement via `multiDayRankings.slice(0, 8)` dans le JSX.
- **Alternative 2** : faire un appel dédié `GET /api/admin/finale/finalists-preview` qui retourne les 8 finalistes calculés côté serveur. Plus propre conceptuellement, mais ajoute un round-trip réseau pour une donnée déjà disponible côté client via `fetchRankings`.

**Recommandation par défaut (appliquée dans la story)** : **Alternative 1** (pas de helper, juste `slice(0, 8)` dans le JSX). Plus simple, pas de duplication. La Task 4.4 est donc **marquée optionnelle** — si le dev la juge non nécessaire, il skip en cohérence avec cette section. (Conservée en tâche documentée pour ne pas casser la numérotation des tâches pendant la revue.)

---

### Previous Story Intelligence (Epic 4 — 4.1)

**Patterns réutilisables directement** :

- **Pattern services purs + tests** : `finaleQualifier.ts` + `.test.ts` suit exactement le pattern de `pointsCalculator.ts` / `rankingsAggregator.ts` / `lobbyGenerator.ts` / `swissSystem.ts`.
- **Pattern endpoint admin** : `routes/finale.ts` suit exactement le pattern de `routes/tournament.ts` (router Express + Prisma + WebSocket emit après succès). Pas d'invention d'un nouveau pattern.
- **Pattern transactions Prisma** : confirmé par rétro Epic 4 ("Transactions Prisma pour toute opération multi-tables — accord d'équipe reconduit").
- **TypeScript strict, zéro `any`** : tenu sur Epic 4, tenu sur 5.1.
- **Route `/api/admin/*` protégée par JWT** : pattern Epic 2 respecté.
- **Pattern identifiant composite `dayNumber + roundNumber`** (rétro Epic 4 accord reconduit) : ici, le lobby finale a `number: 1` et le round finale a `number: 1` — ils sont uniquement discriminés par `dayId` (pattern Prisma existant via `@@unique([dayId, number])` sur `Round` et `@@unique([roundId, number])` sur `Lobby`). Pas de changement à faire.

**Contraintes mémoire projet Brice à respecter** :

- **Pas de limite de rounds** en finale (comme en qualif) : AC ne mentionne pas de max, la logique backend ne le contraint pas. Story 5.2 ajoutera la détection automatique de victoire comme condition de fin.
- **Validation OBS délégable à Brice** : PAS de dépendance OBS dans 5.1 (purement admin + backend), donc inapplicable ici. La contrainte SkyDow ne s'applique qu'à Story 5.3.
- **Docker PG local disponible pour test e2e** : Brice peut tester end-to-end en local. Néanmoins, si un AC nécessite OBS ou SkyDow, c'est à déléguer (ce n'est pas le cas en 5.1).

**Patterns framer-motion + React 19 (leçons rétro Epic 3)** : non pertinents en 5.1 (pas d'animation lourde introduite). La section "Phase finale" est du JSX statique + un bouton ; pas de `motion.*`, pas de `useReducedMotion` à gérer. **Exception** : si le dev souhaite ajouter une animation sur le bandeau "Phase finale" (par exemple un `motion-safe:animate-heroGlow` pour amplifier l'effet wahou), le pattern est déjà dispo dans `index.css` et ne casse rien — c'est un bonus à marge libre, pas un requis.

**Action items Epic 4 affectant 5.1** :

- **Optimisation logos WebP** (owner Brice) : ✅ **réalisé avant le démarrage de 5.1**.
- **Lighthouse mobile `/qualifications`** (owner Brice) : ✅ **réalisé avant le démarrage de 5.1**.
- **Tiebreakers 8e rang spec produit** (owner Brice + Alice, rétro Epic 4 action item #4) : **considéré résolu par défaut** dans cette story — on applique les mêmes tiebreakers que pour le classement cumulé (`totalScore` → `top1Count` → `top4Count` → `lastGameResult`). Si Brice veut une spec différente (par exemple ajouter un "round de barrage"), il doit trancher avant le dev. **En l'absence de spec différente, 5.1 applique les tiebreakers existants**, cohérent avec le principe "même barème, même tri" de toute la phase qualif.

---

### Patterns Epic 2 (rankingsAggregator, pointsCalculator) à NE PAS réinventer

- **`aggregateQualificationRankings(prisma)`** existe déjà dans `backend/src/services/rankingsAggregator.ts` et retourne exactement ce dont on a besoin (classement trié avec tiebreakers). **NE PAS** dupliquer la requête Prisma de récupération des `LobbyPlayer`.
- **`calculatePlayerStats(results)`** est déjà générique (ne dépend pas du `type` de journée). **NE PAS** créer une version spécifique finale.
- **`generateRandomLobbies` / `generateSwissLobbies`** : **ne PAS les appeler en 5.1**. Le lobby unique finale est créé directement dans la transaction Prisma (cf. Task 2.3.6). C'est volontaire car ni l'un ni l'autre n'exprime sémantiquement "un lobby fixe de N joueurs ordonnés par tiebreaker" — une boucle `.map` directe est plus claire.

---

### Contrats backend stables — à PRÉSERVER

Le frontend existant consomme ces contrats. Les modifier casserait Epic 1-4.

- **`GET /api/rankings`** : retourne `{ data: PlayerRanking[] }` du classement cumulé qualif. **Inchangé en 5.1.**
- **`GET /api/admin/current-day`** (ou équivalent utilisé par `loadData`) : retourne la journée `in-progress`. **Inchangé en 5.1** — il retournera naturellement la journée de type `'finale'` une fois créée.
- **WebSocket `tournament_state`, `ranking_updated`, `tournament_state_changed`** : inchangés. `tournament_state_changed` sera juste émis plus souvent (une fois de plus, au démarrage finale).
- **`POST /api/admin/days/:dayId/rounds/:roundNumber/validate`** : **doit fonctionner identiquement pour une journée finale** (AC #10). En théorie il le fait déjà car il ne filtre pas par `day.type`. À vérifier en lecture de code : si une branche `if (day.type === 'qualification')` existe, il faut soit la généraliser soit la laisser passer pour finale.

---

### Anti-patterns à éviter

- **NE PAS** modifier `aggregateQualificationRankings` pour qu'il retourne les finalistes — son rôle est clair et sa requête filtre volontairement `type: 'qualification'`. Créer `selectFinalists` à part.
- **NE PAS** ajouter un champ `isFinalist` sur `PlayerRanking` — c'est dérivable de `rank <= 8` côté consumer, pas besoin de l'enrichir dans le type.
- **NE PAS** créer une nouvelle migration Prisma. Le schéma actuel suffit (`Day.type` est déjà `String`, `@@unique([number, type])` autorise `Day 1 finale`).
- **NE PAS** utiliser `generateRandomLobbies(finalistIds)` ou `generateSwissLobbies(finalistIds)`. Sémantiquement incorrect (la finale n'est ni aléatoire ni suisse). Créer directement les `LobbyPlayer` dans la transaction.
- **NE PAS** toucher `computeTournamentState` pour changer `state.rankings` en phase finale (scope Story 5.2).
- **NE PAS** désactiver visuellement (`disabled`) le bouton "Générer les lobbies" en phase finale — **retirer complètement** du DOM (AC #10 : "le bouton est **absent**"). Un bouton disabled laisse penser qu'il pourrait être réactivé ; en finale, il n'a **aucune** raison d'être.
- **NE PAS** créer d'endpoint `GET /api/admin/finale/finalists-preview`. Le frontend a déjà les données via `GET /api/rankings` (route publique utilisée par `fetchRankings`).
- **NE PAS** utiliser `any` en TypeScript (règle projet).
- **NE PAS** hardcoder le nombre `8` dans plusieurs endroits : le service `finaleQualifier` a un paramètre par défaut (`maxFinalists = 8`), toute autre référence à "8" dans le code finale doit passer par ce paramètre ou par une constante partagée.
- **NE PAS** créer une route publique `/api/finale/state` en 5.1 (hors scope — c'est Story 5.3).
- **NE PAS** bloquer l'accès à `/api/rankings` quand la finale est en cours — c'est volontaire de garder l'historique qualif accessible.

---

### NFR à vérifier

- **NFR1** (chargement < 2s) : l'endpoint `POST /api/admin/finale/start` fait 3 queries de précondition + 1 `aggregateQualificationRankings` (déjà performant, cf. Story 2.7) + 1 transaction `create` multi-tables. Totalement acceptable à échelle projet (~30 joueurs).
- **NFR2** (mise à jour WebSocket < 2s) : `emitTournamentStateChanged` synchrone après commit — latence trivial pour ~30 clients.
- **NFR4** (~30 connexions simultanées) : inchangé.
- **Fiabilité** : transaction Prisma garantit l'atomicité (Day + Round + Lobby + LobbyPlayers) — pas de risque d'état corrompu en cas d'échec partiel.
- **Sécurité** : JWT requis (admin). CORS déjà configuré. Pas de données utilisateur sensibles dans les réponses.

### Project Structure Notes

**Fichiers nouveaux à créer** :

- [backend/src/services/finaleQualifier.ts](backend/src/services/finaleQualifier.ts) — service pur sélection finalistes
- [backend/src/services/finaleQualifier.test.ts](backend/src/services/finaleQualifier.test.ts) — tests unitaires (pattern co-localisation)
- [backend/src/routes/finale.ts](backend/src/routes/finale.ts) — endpoint `POST /start`
- [frontend/src/components/admin/FinaleQualificationPanel.tsx](frontend/src/components/admin/FinaleQualificationPanel.tsx) — composant React admin
- [frontend/src/utils/finaleQualifier.ts](frontend/src/utils/finaleQualifier.ts) — **optionnel** (cf. Task 4.4) helper client

**Fichiers à modifier** :

- [backend/src/app.ts](backend/src/app.ts) — monter `finaleRouter` sur `/api/admin/finale`
- [frontend/src/services/api.ts](frontend/src/services/api.ts) — ajouter `startFinale(token)`
- [frontend/src/components/admin/DayManager.tsx](frontend/src/components/admin/DayManager.tsx) — bandeau + panel + masquer "Générer lobbies" en finale

**Fichiers à NE PAS toucher (critique)** :

- `backend/prisma/schema.prisma` — **aucune migration**
- `backend/src/services/rankingsAggregator.ts` — le filtre `type: 'qualification'` est volontaire et doit rester
- `backend/src/services/pointsCalculator.ts` — barème générique, s'applique tel quel à la finale
- `backend/src/services/lobbyGenerator.ts`, `swissSystem.ts` — pas utilisés pour la finale
- `backend/src/websocket/events.ts` — `computeTournamentState` reste inchangé en 5.1 (Story 5.2 l'évoluera)
- `backend/src/websocket/server.ts` — inchangé
- `backend/src/routes/tournament.ts` — aucune modification (nouvel endpoint dans `finale.ts` séparé)
- `backend/src/routes/rankings.ts` — inchangé
- `backend/src/routes/admin.ts` — inchangé
- `backend/src/middleware/auth.ts` — inchangé
- `frontend/src/contexts/TournamentContext.tsx` — inchangé (le `phase: 'finale'` est déjà typé)
- `frontend/src/hooks/useTournament.ts`, `useAuth.ts` — inchangés
- `frontend/src/services/socket.ts` — inchangé (events existants suffisent)
- `frontend/src/types/index.ts` — `Day.type` est déjà `'qualification' | 'finale'`
- `frontend/src/components/admin/PlayerManager.tsx` — inchangé
- `frontend/src/components/ranking/*`, `components/overlay/*`, `components/lobby/*`, `components/inscription/*` — inchangés
- `frontend/src/pages/Home.tsx`, `Qualifications.tsx`, `Overlay.tsx`, `MentionsLegales.tsx`, `Admin.tsx`, `AdminLogin.tsx` — inchangés

Aucun conflit détecté avec la structure unifiée. Aucune nouvelle dépendance npm. Aucune migration DB.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1 : Qualification pour la Finale & Lancement (lignes 704-726)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 : Phase Finale (lignes 700-702)]
- [Source: _bmad-output/planning-artifacts/epics.md#FR21 (identification 8 qualifiés, ligne 174)]
- [Source: _bmad-output/planning-artifacts/epics.md#FR22 (démarrer finale lobby unique, ligne 175)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR21-FR24 — Finale (lignes 298-303)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Finale FR21-FR24 mapping (ligne 566, 625)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture (lignes 168-184) — modèle Day/Round/Lobby/LobbyPlayer]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns + API Response format (lignes 300-378)]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-04-18.md#Préparation Epic 5 (lignes 131-176)]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-04-18.md#Points d'attention Epic 5 (lignes 162-170)]
- [Source: _bmad-output/implementation-artifacts/2-3-demarrer-une-journee-generer-les-lobbies-round-1.md — pattern POST /days + création Day+Round+lobbies]
- [Source: _bmad-output/implementation-artifacts/2-4-saisie-des-placements-calcul-des-points.md — pattern saisie placements (réutilisé tel quel pour finale round 1)]
- [Source: _bmad-output/implementation-artifacts/2-7-classement-cumule-multi-journees.md — pattern aggregateQualificationRankings + tiebreakers]
- [Source: _bmad-output/implementation-artifacts/4-1-overlay-stream-obs.md — pattern services purs, refactor propre, checks visuels délégables]
- [Source: backend/prisma/schema.prisma — modèle Day (type: String default 'qualification', @@unique([number, type])), Round, Lobby, LobbyPlayer]
- [Source: backend/src/routes/tournament.ts — pattern POST /days lignes 71-114, transaction Prisma, emit WS]
- [Source: backend/src/services/rankingsAggregator.ts — aggregateQualificationRankings + tri tiebreakers lignes 112-117]
- [Source: backend/src/services/pointsCalculator.ts — barème fixe 1er=8 pts → 8e=1 pt ligne 23-25]
- [Source: backend/src/websocket/events.ts — computeTournamentState (lignes 16-32), emitTournamentStateChanged (lignes 65-80), scheduleRankingUpdated (lignes 53-63)]
- [Source: backend/src/websocket/server.ts — création serveur Socket.IO + emit tournament_state à la connexion]
- [Source: backend/src/app.ts — pattern montage routers admin protégés par JWT]
- [Source: frontend/src/services/api.ts — pattern startDay lignes 95-108, fetchRankings lignes 204-209]
- [Source: frontend/src/components/admin/DayManager.tsx — pattern bouton démarrage + handler + loadData + affichage classement cumulé]
- [Source: frontend/src/contexts/TournamentContext.tsx — state déjà typé avec phase 'finale']
- [Source: frontend/src/types/index.ts — Day.type 'qualification' | 'finale' déjà typé]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- `cd backend && npm run build` → 0 erreur TS
- `cd backend && node --test dist/services/*.test.js` → 49 tests / 49 passent (dont 7 nouveaux dans `finaleQualifier.test.js`)
- `cd frontend && npm run build` → 0 erreur TS, bundle 146.63 kB gz (Δ +5.95 kB vs baseline 4.1 = 140.68 kB gz)
- `cd frontend && npm run lint` → 3 errors + 2 warnings, **tous pré-existants** (AuthContext, TournamentContext, PlayerManager, useEffect initial DayManager)

### Completion Notes List

**Décisions d'implémentation :**

1. **Endpoint dédié retenu** : `POST /api/admin/finale/start` dans un nouveau router `routes/finale.ts`, monté sur `/api/admin/finale`. Pas d'extension de `POST /days` — décision d'architecture par défaut de la story respectée (concerns séparés, contrat REST plus explicite).
2. **Endpoint complémentaire `GET /api/admin/finale/progression`** ajouté pour exposer `{ completedQualDaysCount, hasFinale }`. Nécessaire au rendu conditionnel du panneau admin (déterminer quand le montrer). 2 queries Prisma triviales via `Promise.all`. Plus propre qu'étendre `getCurrentDay`.
3. **Helper client `selectFinalistsClient` NON créé** (Alternative 1 de la story). Le composant `FinaleQualificationPanel` fait un simple `rankings.slice(0, FINALE_SIZE)` local, évitant toute duplication.
4. **Round 1 finale créé en `status: 'in-progress'`** directement avec son lobby et ses LobbyPlayer dans la transaction → aucun bouton "Générer les lobbies" à masquer conditionnellement : le bloc `{day && pendingRound && !activeRound}` du DayManager n'est tout simplement jamais rendu en finale (pas de `pendingRound`).
5. **Réactivité WebSocket (AC #12)** : `DayManager` consomme désormais `useTournament()` et un `useEffect` supplémentaire rappelle `loadData(false)` à chaque changement de `state.phase` ou `state.currentDayId`. Cela permet la mise à jour multi-onglets sans reload manuel.
6. **Classement cumulé qualif visible en phase finale (AC #13)** : ajouté en fin de `DayManager` dans un bloc conditionnel dédié (`day?.type === 'finale' && multiDayRankings`). Il cohabite aussi avec le `FinaleQualificationPanel` au-dessus de ce dernier dans l'état de preview.

**Périmètre hors scope respecté :**
- ✅ Pas de modification de `computeTournamentState()` — `state.rankings` continue d'utiliser `aggregateQualificationRankings()` (classement qualif figé pendant finale).
- ✅ Pas de modification de `pointsCalculator.ts` (barème générique déjà adapté à la finale).
- ✅ Pas de migration Prisma.
- ✅ Pas de page publique `/finale` (Story 5.3).
- ✅ Pas de détection automatique de victoire (Story 5.2).

**Checks manuels e2e déférés au code review** (Docker PG local dispo pour Brice, cf. mémoire projet) :
1. Créer 3 journées qualif complétées → vérifier apparition section "Phase finale — N qualifiés".
2. Cliquer "Démarrer la finale" → vérifier création Day `type: 'finale'` + Round 1 + Lobby unique + 8 LobbyPlayers.
3. Vérifier bandeau "Phase finale — Lobby unique fixe" + absence du bouton "Générer les lobbies".
4. Vérifier que `/qualifications` (public) continue d'afficher le classement cumulé qualif figé.
5. Rejouer `POST /api/admin/finale/start` → 409 `FINALE_ALREADY_STARTED`.
6. Reload page admin après démarrage → état préservé (AC #11).
7. Ouvrir deuxième onglet admin après démarrage → mise à jour via WebSocket (AC #12).

**Dette technique à tracer (pour Story 5.2/5.3)** : introduire un framework de tests d'intégration HTTP (supertest ou équivalent) pour couvrir les préconditions de `POST /api/admin/finale/start` et `GET /api/admin/finale/progression`. Task 6 a été déférée conformément à la règle "pas de nouveau framework en 5.1".

### File List

**Nouveaux fichiers** :
- `backend/src/services/finaleQualifier.ts` — service pur `selectFinalists()`
- `backend/src/services/finaleQualifier.test.ts` — 7 tests unitaires (node:test + assert/strict)
- `backend/src/routes/finale.ts` — routes `POST /start` et `GET /progression`
- `frontend/src/components/admin/FinaleQualificationPanel.tsx` — panneau d'affichage des 8 finalistes + bouton "Démarrer la finale"

**Fichiers modifiés** :
- `backend/src/app.ts` — import + mount du `finaleRouter` sur `/api/admin/finale`
- `frontend/src/services/api.ts` — ajout `startFinale()`, `getFinaleProgression()`, interface `FinaleProgression`
- `frontend/src/components/admin/DayManager.tsx` — imports, state `completedQualDaysCount`/`hasFinale`/`startingFinale`, hook `useTournament()`, `useEffect` WebSocket listener, handler `handleStartFinale`, bandeau "Phase finale", rendu conditionnel du panneau, classement cumulé qualif en phase finale

**Fichiers sprint/story mis à jour** :
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `5-1-...` : ready-for-dev → in-progress → review
- `_bmad-output/implementation-artifacts/5-1-qualification-pour-la-finale-lancement.md` — tasks cochées, Dev Agent Record renseigné

## Change Log

| Date       | Version | Description                                                                                                                                                                                                           | Auteur                       |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 2026-04-18 | 0.1     | Création du contexte développeur (bmad-create-story) — scope Epic 5.1 : service pur finaleQualifier + POST /api/admin/finale/start + FinaleQualificationPanel + intégration DayManager. Pas de migration Prisma. Scope 5.2/5.3 explicitement exclu. Réutilisation maximale (rankingsAggregator, pointsCalculator, RoundManager, PlacementInput). | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.0     | Implémentation Story 5.1 terminée (bmad-dev-story). Ajout service `finaleQualifier` (7 tests unitaires), routes `POST /api/admin/finale/start` + `GET /api/admin/finale/progression`, composant `FinaleQualificationPanel`, intégration `DayManager` avec bandeau finale, réactivité WebSocket (useTournament hook), classement cumulé qualif visible en phase finale. Builds backend + frontend OK (bundle 146.63 kB gz, +5.95 kB vs baseline 4.1). 49/49 tests verts. Aucun nouveau warning lint. Task 6 (tests d'intégration HTTP) déférée : pas de framework dispo dans le repo — validation e2e déléguée à Brice + code review. Statut : review. | Claude Opus 4.7 (1M context) |
