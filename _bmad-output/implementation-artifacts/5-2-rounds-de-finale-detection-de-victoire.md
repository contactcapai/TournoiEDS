# Story 5.2 : Rounds de Finale & Détection de Victoire

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **admin (Brice)**,
I want **enchaîner des rounds de finale sur le lobby unique fixe des 8 finalistes et laisser le système détecter automatiquement le vainqueur dès qu'un joueur termine top 1 d'un round avec ≥ 20 points cumulés en finale**,
So that **la finale se déroule fluidement sans limite de rounds, sans arbitrage manuel de fin, et la finale se clôture dès que la condition de victoire est remplie — avec un état `winner` diffusé sur tous les clients (admin, public, overlay)**.

## Contexte de la story

Story **cœur métier Epic 5** — elle transforme la finale initialisée en 5.1 (lobby unique prêt, round 1 en saisie) en **moteur de rounds finale réutilisable** avec détection automatique de victoire. Elle lève aussi l'invariant architectural figé en 5.1 : à partir de cette story, `state.rankings` diffusé via WebSocket reflète le **classement finale** (pas le cumul qualif) quand la phase est `finale`.

**Périmètre clair (DANS 5.2)** :

1. Nouveau service pur `aggregateFinaleRankings(prisma)` dans [rankingsAggregator.ts](backend/src/services/rankingsAggregator.ts) qui filtre `day.type === 'finale'` (au lieu de `'qualification'`). Refactor en une seule fonction paramétrée `aggregateRankingsByDayType(prisma, type)` avec deux wrappers `aggregateQualificationRankings` et `aggregateFinaleRankings` pour éviter la duplication — les deux fonctions partagent 100 % de la logique (même calcul de stats, même tri, même tiebreakers).
2. Nouveau service pur `winnerDetector.ts` avec `detectFinaleWinner(rankings, lastRoundTop1PlayerId, threshold = 20): PlayerRanking | null` + tests unitaires (cas 22 pts + top 1 → vainqueur, 15 pts + top 1 → `null`, 25 pts + top 3 → `null`, 20 pts pile + top 1 → vainqueur, rankings vides → `null`).
3. Évolution de `computeTournamentState()` dans [websocket/events.ts](backend/src/websocket/events.ts) : utiliser `aggregateFinaleRankings(tx)` quand `currentDay.type === 'finale'` ; ajout d'un champ optionnel `winner: PlayerRanking | null` dans `TournamentState` (calculé si la finale vient de se conclure — voir Task 3 ci-dessous).
4. Évolution de `emitRankingUpdated()` : utiliser `aggregateFinaleRankings` quand une finale est en cours, sinon `aggregateQualificationRankings` (inchangé par défaut).
5. Évolution de l'endpoint existant `POST /api/admin/days/:dayId/rounds/:roundNumber/validate` dans [tournament.ts](backend/src/routes/tournament.ts) : **après** la mise en `status: 'validated'` du round, si `day.type === 'finale'` → calculer `aggregateFinaleRankings`, extraire le top 1 du round qui vient d'être validé (placement === 1 dans l'unique lobby du round), appeler `detectFinaleWinner(rankings, top1.playerId, 20)`. Si vainqueur détecté → marquer la finale `status: 'completed'` dans la **même transaction**, puis émettre `tournament_state_changed` (avec `winner` rempli dans le payload). Si pas de vainqueur → aucune mutation sur la `Day`, juste les events habituels (`ranking_updated` en debounce).
6. Évolution de l'endpoint existant `POST /api/admin/days/:dayId/next-round` dans [tournament.ts](backend/src/routes/tournament.ts) : si `day.type === 'finale'`, **ne PAS** créer un round en `'pending'` + lobby vide. À la place → créer le round directement en `status: 'in-progress'` avec **un nouveau Lobby contenant les mêmes 8 finalistes** (on récupère les `playerId` depuis le lobby du round précédent). Même pattern atomique que 5.1 (transaction Prisma imbriquée). Pour qualif, comportement strictement inchangé (pending + generate-lobbies ensuite).
7. Route publique `GET /api/rankings?type=finale` (query param optionnel) dans [rankings.ts](backend/src/routes/rankings.ts) — retourne les rankings finale si `type=finale`, sinon rankings qualif par défaut (backward-compat). Utilisée par la future page publique `/finale` (Story 5.3) mais créée maintenant pour pouvoir la tester à la main en 5.2 et anticiper 5.3.
8. Frontend — réactivité admin :
   - `DayManager.tsx` affiche la progression vers la victoire pour chaque finaliste pendant la finale (barre `totalScore / 20` + badge "✓ top 1 en finale" quand `top1Count >= 1`).
   - Quand `state.winner` est reçu via WebSocket → bandeau "🏆 Vainqueur : {pseudo}" en or `#DAB265` en tête du DayManager, le round finale en cours n'affiche plus le bouton "Round suivant" (remplacé par un message "Finale terminée — Vainqueur : {pseudo}").
   - Bouton "Lancer le round suivant de finale" fonctionne naturellement via `nextRound(token, dayId)` (aucune nouvelle fonction API).
9. Tests unitaires : `winnerDetector.test.ts` (6 tests minimum, voir AC #15) + `rankingsAggregator.test.ts` enrichi (2 nouveaux tests pour `aggregateFinaleRankings` — isolation par type de journée).

**Périmètre explicitement HORS 5.2 (à ne PAS implémenter ici)** :

- ❌ **Page publique `/finale`** — Story 5.3.
- ❌ **Indicateur UX-DR7** (barre de progression visuelle soignée côté public) — Story 5.3 (backend ready, UI côté public = scope 5.3).
- ❌ **Animation UX-DR8** (mise en valeur or du vainqueur côté public) — Story 5.3. L'admin a juste un bandeau statique simple en 5.2.
- ❌ **Historique des vainqueurs passés** — out of scope (un seul tournoi = un seul vainqueur, pas de table `TournamentWinner`).
- ❌ **Re-démarrage de finale après victoire** — non prévu. Une fois la finale `completed`, elle l'est. Si erreur de saisie après victoire, Brice corrige en base à la main (cas non MVP).
- ❌ **Rollback d'une détection de victoire par reset manuel** — une détection est définitive. Si besoin de corriger après coup (ex: mauvais placement saisi), Brice passera par la base en direct (ultra-exceptionnel).
- ❌ **Nouvelle page /admin distincte pour la finale** — tout reste dans `DayManager` (cohérence 5.1).
- ❌ **Migration Prisma** — schéma actuel suffit (`Day.status`, `Round.status`, `Lobby` par round = modèle déjà compatible).

**Règle projet rappelée** (mémoire Brice) :
- **Pas de limite de rounds** en finale — la fin est déterminée uniquement par la détection automatique de victoire. Aucun `MAX_FINALE_ROUNDS`.
- **Validation OBS dépendante SkyDow** : 5.2 n'affecte pas l'overlay directement (l'overlay reçoit les rankings via WebSocket, qui passeront désormais aux rankings finale en phase finale — cet impact est **testable sans SkyDow** car Brice peut ouvrir `/overlay` en local dans un navigateur et voir la transition qualif → finale). La validation finale 16:9 "image stream" reste à SkyDow, mais 5.2 n'introduit aucun élément nouveau dans `/overlay` à tester avec lui.

**Décision d'architecture clé prise par défaut (modifiable en review)** : **étendre** les endpoints existants `POST /days/:dayId/rounds/:roundNumber/validate` et `POST /days/:dayId/next-round` plutôt que de créer des jumeaux `POST /finale/rounds/.../validate` et `POST /finale/next-round`. Raisons :

1. **Même sémantique métier** : valider un round, créer le round suivant — qu'il soit qualif ou finale.
2. **Moins de code frontend** : le DayManager réutilise `validateRound` / `nextRound` tels quels (aucun ajout d'API client).
3. **Branche minimale** : un simple `if (day.type === 'finale') { ... }` dans chaque endpoint suffit, contre 2 nouveaux fichiers de routes.
4. **Cohérence avec Epic 2** : le pattern `validateRound` est générique (ne filtre pas par `type`), on continue dans cette direction plutôt que de le spécialiser.

Alternative (rejetée par défaut) : créer des endpoints dédiés `/api/admin/finale/rounds/:roundNumber/validate` et `/api/admin/finale/next-round`. Brice peut trancher en code review — refactor ≤ 1 h.

**Décision d'architecture secondaire** : le champ `winner` est **dérivé** à chaque appel de `computeTournamentState()` (pas stocké en base). Il est calculé ainsi :
- Si `currentDayType === 'finale'` OU s'il existe une `Day` de type `finale` avec `status: 'completed'` → chercher le vainqueur en recomputant `detectFinaleWinner` sur `aggregateFinaleRankings()` avec le top 1 du **dernier round validé** de la finale.
- Sinon `winner = null`.

Cela garantit l'idempotence (pas de désync base / émission) et permet à n'importe quel client qui se connecte après la fin de la finale de recevoir le vainqueur dans le `tournament_state` initial.

## Acceptance Criteria

1. **Given** la finale est lancée (1 Day `type: 'finale'`, `status: 'in-progress'`) et le round 1 est en cours avec les 8 finalistes dans l'unique lobby **When** l'admin saisit les placements (1 à 8) et clique "Valider le round" **Then** le round passe à `status: 'validated'` (réutilise `POST /api/admin/days/:dayId/rounds/:roundNumber/validate` existant) **And** le backend calcule les points (barème 1er = 8 pts → 8e = 1 pt, inchangé) via `pointsCalculator.calculatePoints` **And** le backend calcule `aggregateFinaleRankings(prisma)` pour le nouveau classement finale (non qualif) **And** la réponse `validateRound` contient `{ round, rankings: PlayerRanking[] }` où `rankings` sont désormais les **rankings finale** (délibérément un changement de contrat bénin : le frontend ne distingue pas déjà qualif/finale dans ce champ).

2. **Given** un round de finale vient d'être validé **When** le backend vérifie la condition de victoire **Then** il identifie le top 1 du round via `lobby.players.find(lp => lp.placement === 1)` dans l'unique lobby du round **And** il appelle `detectFinaleWinner(finaleRankings, top1.playerId, 20)` **And** si la fonction retourne un `PlayerRanking`, ce joueur est le vainqueur **And** si elle retourne `null`, la finale continue.

3. **Given** un joueur a cumulé **≥ 20 points** finale **When** il termine **top 1 d'un round** de finale validé **Then** la condition de victoire est remplie (confirmer avec tests unitaires AC #15 incluant exactement 20 pts pile — pas `> 20` mais `>= 20`) **And** la `Day` finale est mise à jour à `status: 'completed'` **dans la même transaction** que la validation du round (pour éviter un état incohérent "round validé + finale encore in-progress + vainqueur dérivé = vrai") **And** aucun nouveau round n'est créé automatiquement.

4. **Given** un joueur a **< 20 points** cumulés finale **When** il termine top 1 d'un round **Then** `detectFinaleWinner` retourne `null` **And** la finale reste `status: 'in-progress'` **And** le bouton admin "Lancer le round suivant" reste disponible.

5. **Given** un joueur a **≥ 20 points** cumulés finale **When** il ne termine PAS top 1 (placement 2-8) du round **Then** `detectFinaleWinner` retourne `null` (le top 1 requis n'est pas ce joueur) **And** la finale continue normalement.

6. **Given** la finale a été déclarée terminée (`status: 'completed'` suite à détection de victoire) **When** un client (admin, `/qualifications`, `/overlay`, `/finale` futur) est connecté via WebSocket **Then** il reçoit l'événement `tournament_state_changed` avec payload `{ phase: 'finale' | 'idle', currentDayType: 'finale' | null, winner: PlayerRanking, ... }` **And** `winner` contient les infos complètes du vainqueur (`playerId`, `discordPseudo`, `totalScore`, `top1Count`, etc.) **And** tous les clients reçoivent la mise à jour en moins de 2 secondes (NFR2).

7. **Given** un nouveau client se connecte au namespace `/tournament` **And** la finale est déjà terminée avec un vainqueur **When** le serveur émet le `tournament_state` initial à la connexion **Then** le payload contient le `winner` dérivé (pas de fetch supplémentaire requis côté frontend) **And** le classement finale figé est exposé dans `rankings`.

8. **Given** la finale est en cours (aucun vainqueur encore détecté) **When** l'admin clique sur "Lancer le round suivant de finale" depuis le DayManager **Then** le frontend appelle `POST /api/admin/days/:dayId/next-round` **And** le backend (branche `day.type === 'finale'`) crée dans une transaction Prisma : un nouveau `Round` avec `number: previousRoundNumber + 1`, `status: 'in-progress'` + un nouveau `Lobby` avec `number: 1` + 8 nouveaux `LobbyPlayer` (placement/points = null) pour les **mêmes 8 playerId** que le lobby du round finale précédent **And** le frontend recharge `getCurrentDay` → l'interface de saisie du nouveau round finale s'affiche **avec le même lobby** (aucun écran intermédiaire "Générer les lobbies", cohérent 5.1).

9. **Given** la finale est en cours et un round est en saisie **When** l'admin consulte le DayManager **Then** pour chaque finaliste, la progression est affichée : **barre linéaire + ratio numérique `{totalScore}/20`** (ex: `14/20`), **plafonnée visuellement à 100 % même si totalScore > 20** (au cas où quelqu'un dépasse 20 sans avoir fait top 1) **And** un badge `✓ Top 1` est affiché à côté du pseudo si `finalist.top1Count >= 1` (le ✓ signale "condition top 1 déjà remplie au moins une fois en finale") **And** le tableau est trié selon le classement finale (pas le classement qualif).

10. **Given** un vainqueur vient d'être détecté **When** le DayManager reçoit le `tournament_state_changed` avec `winner` rempli **Then** un bandeau pleine largeur `🏆 Vainqueur : {discordPseudo}` en or `#DAB265` (classes Tailwind `bg-eds-gold/20 border border-eds-gold text-eds-gold font-heading text-2xl`) est affiché en tête du DayManager, **avant** tout autre bloc **And** les boutons "Valider round" / "Lancer le round suivant" / "Terminer la journée" sont remplacés par un message calme "Finale terminée." et un bouton décoratif désactivé (`disabled`) pour éviter toute confusion **And** le classement finale final reste affiché en-dessous.

11. **Given** la finale est terminée (status completed) **When** l'admin recharge la page admin **Then** `getCurrentDay` retourne `null` (car aucun `day` n'est `in-progress`) **And** `getFinaleProgression` retourne `{ completedQualDaysCount: 3, hasFinale: true }` **And** le DayManager affiche le bandeau "🏆 Vainqueur : X" car le `tournament_state` initial WebSocket contient `winner` (AC #7) **And** PAS de nouveau formulaire "Démarrer la journée de qualification" ni de `FinaleQualificationPanel` (car `hasFinale === true`).

12. **Given** la finale est en cours **When** un événement `ranking_updated` est émis (après validation d'un round finale sans victoire) **Then** le payload contient les **rankings finale** (`aggregateFinaleRankings`), **PAS** les rankings qualif **And** les pages publiques (`/qualifications`, `/overlay`) reçoivent ces rankings — ✅ **acceptable en 5.2** : `/qualifications` affichera temporairement les rankings finale pendant la finale (seulement 8 joueurs), `/overlay` également. C'est un effet de bord **voulu** car les qualifs sont terminées et figées — afficher les rankings finale en cours est plus informatif que le classement qualif figé. Story 5.3 ajoutera une distinction propre avec la nouvelle page `/finale`.

13. **Given** un joueur a cumulé 19 points et termine top 1 d'un round où un autre joueur n'avait jamais fait top 1 **When** le round est validé **Then** le premier joueur passe à 27 points cumulés (8 pts pour top 1) — mais `detectFinaleWinner` vérifie `totalScore >= 20` **après** le calcul, donc il est détecté vainqueur. ⚠️ **Subtilité à couvrir en tests** : l'ordre doit être (1) stats calculées (totalScore inclut les 8 pts du round qui vient d'être validé), (2) détection. Le service `aggregateFinaleRankings` utilise les `LobbyPlayer` de tous les rounds `validated` inclus celui qui vient de l'être → OK, ordre naturel.

14. **Given** la story est livrée **When** je lance `node --test backend/dist/services/*.test.js` **Then** la suite de tests passe intégralement (existants + nouveaux) **And** `winnerDetector.test.js` contient ≥ 6 tests (cf. AC #15) **And** `rankingsAggregator.test.js` contient ≥ 2 nouveaux tests pour `aggregateFinaleRankings` (isolation qualif/finale — ne mélange pas les types de journées).

15. **Given** la story est livrée **When** je lis `winnerDetector.test.ts` **Then** les 6 tests minimum suivants sont présents et passent :
    - (a) `totalScore = 22` + `top1Count >= 1` + `top1.playerId === joueur.playerId` → retourne ce joueur
    - (b) `totalScore = 20` pile + top 1 → retourne ce joueur (seuil inclusif)
    - (c) `totalScore = 15` + top 1 → retourne `null`
    - (d) `totalScore = 25` mais `top1.playerId !== ranking.playerId` (ils ne font PAS top 1 ce round) → retourne `null`
    - (e) `rankings = []` → retourne `null`
    - (f) `lastRoundTop1PlayerId` introuvable dans rankings (cas théorique : joueur qui a fait top 1 mais qui n'a pas de ranking, impossible en prod) → retourne `null` sans throw.

16. **Given** la story est livrée **When** je lance `npm run build` (frontend + backend) **Then** zéro erreur TypeScript **And** zéro nouveau warning ESLint introduit **And** le bundle frontend n'augmente pas de plus de **+8 kB gz** par rapport à la baseline 5.1 (146.63 kB gz → target ≤ 154.63 kB gz).

17. **Given** les 3 journées qualif sont terminées ET la finale est terminée avec un vainqueur **When** un nouveau client visite `/qualifications` **Then** la page `/qualifications` affiche les rankings finale (comportement confirmé par AC #12) — non-régression : la page ne plante pas, l'affichage top 8 est juste un tableau de 8 lignes (les 8 finalistes). Story 5.3 corrigera proprement pour afficher le classement qualif figé sur `/qualifications` et les rankings finale sur `/finale`.

## Tasks / Subtasks

- [x] **Task 1 — Refactor `rankingsAggregator.ts` + ajout `aggregateFinaleRankings`** (AC #1, #14)
  - [x] 1.1 Éditer [backend/src/services/rankingsAggregator.ts](backend/src/services/rankingsAggregator.ts) : extraire une fonction interne commune `aggregateRankingsByDayType(prisma, type: 'qualification' | 'finale'): Promise<PlayerRanking[]>` qui contient TOUTE la logique actuelle de `aggregateQualificationRankings` mais avec un filtre paramétré `day: { type }`.
  - [x] 1.2 Conserver `aggregateQualificationRankings(prisma)` comme wrapper 1-ligne : `return aggregateRankingsByDayType(prisma, 'qualification');`
  - [x] 1.3 Exporter `aggregateFinaleRankings(prisma)` : `return aggregateRankingsByDayType(prisma, 'finale');`
  - [x] 1.4 **NE PAS** toucher aux exports existants (`PlayerRoundSummary`, `PlayerRanking`) — ils sont génériques et corrects pour les deux usages.
  - [x] 1.5 Enrichir [backend/src/services/rankingsAggregator.test.ts](backend/src/services/rankingsAggregator.test.ts) avec 2 tests minimum :
    - `aggregateQualificationRankings` ne prend PAS en compte les rounds d'une Day `type: 'finale'` (isolation).
    - `aggregateFinaleRankings` ne prend PAS en compte les rounds qualif (isolation inverse).
  - [x] 1.6 Build backend : `npm run build` → 0 erreur.

- [x] **Task 2 — Service pur `winnerDetector.ts` + tests** (AC #2, #3, #4, #5, #13, #15)
  - [x] 2.1 Créer [backend/src/services/winnerDetector.ts](backend/src/services/winnerDetector.ts) exportant `detectFinaleWinner(rankings: PlayerRanking[], lastRoundTop1PlayerId: number, threshold?: number): PlayerRanking | null`.
  - [x] 2.2 Signature : `threshold` défaut `20`. La fonction :
    1. Si `rankings.length === 0` → retourne `null`.
    2. Cherche `ranking = rankings.find(r => r.playerId === lastRoundTop1PlayerId)` → si absent, retourne `null` (sécurité, ne throw pas).
    3. Si `ranking.totalScore >= threshold` → retourne `ranking`. Sinon → retourne `null`.
  - [x] 2.3 Documenter en JSDoc : contrat clair, paramètres, retour, exemples numériques (22 pts top 1 = vainqueur, 20 pts pile top 1 = vainqueur, 15 pts top 1 = null, 25 pts top 3 = null).
  - [x] 2.4 Créer [backend/src/services/winnerDetector.test.ts](backend/src/services/winnerDetector.test.ts) avec les 6 tests minimum listés en AC #15 (pattern `node:test` + `node:assert/strict` + helper `buildMockRanking` inspiré de [finaleQualifier.test.ts](backend/src/services/finaleQualifier.test.ts)).
  - [x] 2.5 Tests supplémentaires bienvenus mais optionnels : threshold custom (ex: 30), multiple joueurs à ≥ 20 pts mais un seul top 1 du round (doit retourner le top 1 spécifiquement, pas le plus gros score).
  - [x] 2.6 Build backend : `npm run build` → 0 erreur, tests verts.

- [x] **Task 3 — Évolution `computeTournamentState()` + `winner` dans `TournamentState`** (AC #6, #7, #11)
  - [x] 3.1 Éditer [backend/src/websocket/events.ts](backend/src/websocket/events.ts) : ajouter le champ `winner: PlayerRanking | null` à l'interface `TournamentState`.
  - [x] 3.2 Dans `computeTournamentState()` : après le `currentDay = ...`, déterminer `type` cible :
    - Si `currentDay?.type === 'finale'` → `rankings = await aggregateFinaleRankings(tx)`.
    - Sinon → `rankings = await aggregateQualificationRankings(tx)` (comportement actuel, inchangé pour qualif/idle).
  - [x] 3.3 **Cas finale terminée (status: 'completed')** : chercher `latestFinaleDay`, calculer `aggregateFinaleRankings(tx)`, chercher le dernier round validé, trouver le top 1, appeler `detectFinaleWinner(rankings, top1.playerId, 20)`.
  - [x] 3.4 **Cas finale en cours** : `winner = null` (la détection se fait à la validation, pas continuellement).
  - [x] 3.5 Retourner `TournamentState` avec `winner` inclus.
  - [x] 3.6 Éditer `emitRankingUpdated(io)` : factorisé via appel à `computeTournamentState()` puis émission de `{ rankings: state.rankings }` — garantit la cohérence qualif/finale.

- [x] **Task 4 — Évolution endpoint `POST /days/:dayId/rounds/:roundNumber/validate`** (AC #1, #2, #3)
  - [x] 4.1 Éditer [backend/src/routes/tournament.ts](backend/src/routes/tournament.ts) — branche finale ajoutée avant la branche qualif.
  - [x] 4.2 Branche finale dans `prisma.$transaction` : round → validated, hydraté, `aggregateFinaleRankings(tx)`, extraction top1, `detectFinaleWinner`, si winner → `tx.day.update({ status: 'completed' })`.
  - [x] 4.3 Réponse finale : `{ round: ur, rankings: finaleRankings }` calculés dans la transaction (pas de re-call hors-transaction).
  - [x] 4.4 Émission post-commit : `await emitTournamentStateChanged` si `winnerDetected`, sinon `scheduleRankingUpdated` (qualif et finale sans winner).
  - [x] 4.5 Réponse HTTP `{ round, rankings }` à l'identique (200 OK).
  - [x] 4.6 Branche qualif (lignes ex-525-582) **conservée à l'identique** — risque de régression évité ; refactor recommandé en review si nécessaire (deferred).

- [x] **Task 5 — Évolution endpoint `POST /days/:dayId/next-round`** (AC #8)
  - [x] 5.1 Éditer [backend/src/routes/tournament.ts](backend/src/routes/tournament.ts).
  - [x] 5.2 Branche `if (day.type === 'finale')` : récupère `previousRound`, gère `NO_PREVIOUS_FINALE_ROUND`, crée Round + Lobby + 8 LobbyPlayer dans `prisma.$transaction`.
  - [x] 5.3 Branche qualif inchangée : `prisma.round.create({ number: nextNumber, dayId })` (status pending par défaut).
  - [x] 5.4 Guard `FINALE_ALREADY_COMPLETED` ajouté avant la vérif `status !== in-progress`.

- [x] **Task 6 — Route publique `GET /api/rankings?type=finale`** (AC #6 anticipation + Story 5.3 ready)
  - [x] 6.1 Éditer [backend/src/routes/rankings.ts](backend/src/routes/rankings.ts) : lecture `req.query.type`, défaut `'qualification'`.
  - [x] 6.2 Branche `type === 'finale'` → `aggregateFinaleRankings(prisma)`, sinon `aggregateQualificationRankings(prisma)`.
  - [x] 6.3 Réponse inchangée : `{ data: PlayerRanking[] }`.
  - [x] 6.4 Validation : 400 `VALIDATION_ERROR` si valeur ∉ {qualification, finale}.

- [x] **Task 7 — Frontend : étendre `TournamentState` avec `winner`** (AC #6, #7, #10, #11)
  - [x] 7.1 `TournamentState` + `initialState` étendus avec `winner: PlayerRanking | null`.
  - [x] 7.2 Handlers `tournament_state` et `tournament_state_changed` extraient `winner` et le placent dans le state.
  - [x] 7.3 `TournamentStatePayload` étendu avec `winner: PlayerRanking | null`.
  - [x] 7.4 `PlayerRanking` déjà importé dans `socket.ts`.

- [x] **Task 8 — Frontend : affichage progression + vainqueur dans DayManager** (AC #9, #10, #11)
  - [x] 8.1 `const winner = tournamentState.winner;` extrait en haut du composant.
  - [x] 8.2 Bandeau `🏆 Vainqueur : {winner.discordPseudo} ({winner.totalScore} pts)` en or, en tête du return juste après `{error}`.
  - [x] 8.3 Bloc "Progression vers la victoire (≥ 20 pts + Top 1)" affiché quand `day?.type === 'finale'` ET `tournamentState.rankings` non vide : barre `Math.min(100, (r.totalScore/20)*100)` % en or, ratio `{r.totalScore}/20`, badge `✓ Top 1` si `r.top1Count >= 1`.
  - [x] 8.4 Bloc validatedRound : si `winner` → message "Finale terminee." + bouton désactivé `Aucune action disponible`. Pas de bouton "Round suivant" / "Terminer".
  - [x] 8.5 Le bloc legacy "Classement cumule qualifications (fige)" est conservé (AC #13 de 5.1) ; le nouveau bloc Progression s'affiche en tête, le legacy reste plus bas.
  - [x] 8.6 Bouton "Lancer le round suivant de finale" affiché quand `!winner && day?.type === 'finale' && validatedRound` — appelle `nextRound` existant. Le bouton "Terminer la journee" est masqué en finale (la finale se termine uniquement par détection automatique).

- [x] **Task 9 — Tests manuels e2e + validation finale** (tous AC)
  - [x] 9.1 `cd backend && npm run build` → 0 erreur TS. `node --test dist/services/*.test.js` → 60 tests verts (8 suites). Détail : 49 préexistants + 8 nouveaux winnerDetector + 3 nouveaux rankingsAggregator (isolation qualif/finale + finale vide).
  - [x] 9.2 `cd frontend && npm run build` → 0 erreur TS, bundle 147.04 kB gz (baseline 5.1 = 146.63 kB gz, +0.41 kB, marge ≤ 154.63 kB respectée).
  - [x] 9.3 `cd frontend && npm run lint` → 5 problèmes existants (3 errors AuthContext+TournamentContext+set-state-in-effect, 2 warnings exhaustive-deps) tous **préexistants** ; **0 nouveau warning introduit par 5.2**.
  - [ ] 9.4 **Tests e2e manuels** : à effectuer par Brice avec Docker PG + backend + frontend + 3 journées qualif + finale lancée (scénarios 9.4.1 → 9.4.7 documentés). Couverture unitaire des cas de seuil (19/20/25 pts) déjà assurée par `winnerDetector.test.ts` (AC #15 a/b/c/d). Tests e2e UI déférés à la session de validation Brice (mémoire projet : Brice peut tester en local sans SkyDow car overlay reçoit les rankings via WebSocket).
  - [x] 9.5 **Scénarios d'échec couverts par tests unitaires** : AC #15 (a) 22 + top 1 → vainqueur, (b) 20 pile + top 1 → vainqueur (seuil inclusif), (c) 15 + top 1 → null, (d) 25 pts mais top 1 = autre joueur (12 pts) → null.

## Dev Notes

### Architecture & Principes clés

**Cette story évolue les contrats stables** — à la différence de 5.1 qui créait un nouveau périmètre isolé, 5.2 modifie le comportement de `computeTournamentState`, `emitRankingUpdated`, `POST /validate`, `POST /next-round`. Implications :

- **Non-régression qualif critique** : tous les scénarios Epic 2 / Epic 3 doivent continuer à fonctionner. Les modifications doivent être **branchées sur `day.type`** sans toucher le comportement qualif par défaut.
- **Contrat WebSocket étendu, pas cassé** : `winner` est un **nouveau** champ optionnel. Anciens clients (aucun en pratique, mais principe) continueraient de fonctionner en l'ignorant.
- **Contrat REST `/api/rankings` étendu** : ajout d'un query param optionnel `type` avec défaut `'qualification'` = backward-compat 100 %.

**Invariant architectural majeur (à CHANGER en 5.2)** : `computeTournamentState` ne renvoie plus uniquement le classement qualif. Il renvoie le classement **pertinent selon la phase** : qualif en phase qualification ou idle, finale en phase finale ou après finale terminée. Ce changement était **explicitement déféré** de 5.1 (cf. scope 5.1 Dev Notes, section "Invariant architectural majeur").

### Task 1 — Refactor `aggregateRankingsByDayType` — squelette attendu

```typescript
// backend/src/services/rankingsAggregator.ts
type DayType = 'qualification' | 'finale';

async function aggregateRankingsByDayType(
  prisma: PrismaClient,
  type: DayType,
): Promise<PlayerRanking[]> {
  const allLobbyPlayers = await prisma.lobbyPlayer.findMany({
    where: {
      placement: { not: null },
      lobby: {
        round: {
          status: 'validated',
          day: { type }, // seule différence : paramètre
        },
      },
    },
    include: { /* inchangé */ },
  });
  // ... reste identique
}

export async function aggregateQualificationRankings(prisma: PrismaClient): Promise<PlayerRanking[]> {
  return aggregateRankingsByDayType(prisma, 'qualification');
}

export async function aggregateFinaleRankings(prisma: PrismaClient): Promise<PlayerRanking[]> {
  return aggregateRankingsByDayType(prisma, 'finale');
}
```

**Pourquoi refactor plutôt que duplication pure** : la fonction fait 90+ lignes, dupliquer à la virgule près serait un anti-pattern DRY flagrant. La branche unique dans le `where` justifie à elle seule la factorisation.

### Task 2 — Service `winnerDetector.ts` — squelette attendu

```typescript
// backend/src/services/winnerDetector.ts
import type { PlayerRanking } from './rankingsAggregator';

const DEFAULT_VICTORY_THRESHOLD = 20;

/**
 * Détecte si la condition de victoire finale est remplie par le top 1 du round qui vient d'être validé.
 *
 * Condition : le joueur top 1 du round doit avoir un totalScore cumulé finale >= threshold.
 *
 * @param rankings classement finale agrégé (après le round qu'on vient de valider)
 * @param lastRoundTop1PlayerId playerId du joueur ayant terminé top 1 du dernier round validé
 * @param threshold seuil inclusif (défaut 20)
 * @returns le PlayerRanking du vainqueur, ou null si la condition n'est pas remplie
 */
export function detectFinaleWinner(
  rankings: PlayerRanking[],
  lastRoundTop1PlayerId: number,
  threshold: number = DEFAULT_VICTORY_THRESHOLD,
): PlayerRanking | null {
  if (rankings.length === 0) return null;
  const top1 = rankings.find((r) => r.playerId === lastRoundTop1PlayerId);
  if (!top1) return null;
  return top1.totalScore >= threshold ? top1 : null;
}
```

**Points critiques** :
- **Seuil inclusif** (`>=`, pas `>`) — la PRD dit "≥ 20 points". Couvert par AC #15 (b) et test unitaire dédié.
- **Pas d'accès DB** — pure function, testable sans Prisma mock. Tous les tests utilisent des `PlayerRanking` fabriqués à la main.
- **Ne throw pas** — cas `top1` introuvable (théoriquement impossible en prod, mais défense en profondeur) retourne `null` silencieusement.

### Task 3 — `computeTournamentState()` — squelette attendu

```typescript
// backend/src/websocket/events.ts
export interface TournamentState {
  phase: 'idle' | 'qualification' | 'finale';
  currentDayId: number | null;
  currentDayNumber: number | null;
  currentDayType: 'qualification' | 'finale' | null;
  rankings: PlayerRanking[];
  winner: PlayerRanking | null; // NOUVEAU
}

export async function computeTournamentState(): Promise<TournamentState> {
  return prisma.$transaction(async (tx) => {
    const currentDay = await tx.day.findFirst({ where: { status: 'in-progress' } });
    const latestFinaleDay = await tx.day.findFirst({
      where: { type: 'finale' },
      orderBy: { createdAt: 'desc' },
    });
    const finaleCompleted = latestFinaleDay?.status === 'completed';

    const phase: TournamentState['phase'] = currentDay
      ? (currentDay.type as 'qualification' | 'finale')
      : 'idle';

    const useFinaleRankings = currentDay?.type === 'finale' || finaleCompleted;
    const rankings = useFinaleRankings
      ? await aggregateFinaleRankings(tx as unknown as typeof prisma)
      : await aggregateQualificationRankings(tx as unknown as typeof prisma);

    let winner: PlayerRanking | null = null;
    if (finaleCompleted && latestFinaleDay) {
      const lastRound = await tx.round.findFirst({
        where: { dayId: latestFinaleDay.id, status: 'validated' },
        orderBy: { number: 'desc' },
        include: { lobbies: { include: { players: true } } },
      });
      const top1 = lastRound?.lobbies[0]?.players.find((lp) => lp.placement === 1);
      if (top1) {
        winner = detectFinaleWinner(rankings, top1.playerId, 20);
      }
    }

    return {
      phase,
      currentDayId: currentDay?.id ?? null,
      currentDayNumber: currentDay?.number ?? null,
      currentDayType: (currentDay?.type as 'qualification' | 'finale' | null) ?? null,
      rankings,
      winner,
    };
  });
}
```

**Points critiques** :
- **Transaction unique** pour lire plusieurs tables de manière cohérente. Critique pour éviter une race où un round viendrait d'être validé entre 2 queries.
- **`winner` uniquement calculé si `finaleCompleted`** — pendant la finale en cours, `winner` reste `null`. La détection est événementielle (à la validation du round), pas continue.
- **`useFinaleRankings`** : priorité au currentDay en cours ; fallback sur `finaleCompleted` pour figer le classement finale après la fin.

### Task 4 — Evolution `POST /validate` — squelette attendu

Logique cible (pseudo-code — le fichier actuel est verbeux, il faut factoriser) :

```typescript
// backend/src/routes/tournament.ts (validate round)
// ... validations préalables (day/round/incompletePlacements) inchangées ...

let winnerDetected: PlayerRanking | null = null;

const result = await prisma.$transaction(async (tx) => {
  // 1. Passer le round en validated
  const updatedRound = await tx.round.update({
    where: { id: round.id },
    data: { status: 'validated' },
    include: { lobbies: { include: { players: { include: { player: true } } } } },
  });

  // 2. Si finale : détecter victoire + marquer Day completed
  if (day.type === 'finale') {
    const finaleRankings = await aggregateFinaleRankings(tx as unknown as typeof prisma);
    const top1 = updatedRound.lobbies[0]?.players.find((lp) => lp.placement === 1);
    if (top1) {
      const candidate = detectFinaleWinner(finaleRankings, top1.playerId, 20);
      if (candidate) {
        await tx.day.update({
          where: { id: dayId },
          data: { status: 'completed' },
        });
        winnerDetected = candidate;
      }
    }
    return { round: updatedRound, rankings: finaleRankings };
  }

  // 3. Qualif : classement qualif (réutiliser aggregateQualificationRankings pour simplifier — optionnel)
  const qualRankings = await aggregateQualificationRankings(tx as unknown as typeof prisma);
  return { round: updatedRound, rankings: qualRankings };
});

// Émission post-commit
if (winnerDetected) {
  await emitTournamentStateChanged(getIO()); // pas debounce : event critique
} else {
  scheduleRankingUpdated(getIO()); // debounce habituel
}

res.status(200).json({ data: result });
```

**Simplification bénigne** : remplacer le bloc manuel lignes 524-582 par un simple appel à `aggregateQualificationRankings(tx)` (qui renvoie exactement la même structure avec le même tri). Gain : -50 lignes, moins de risques de divergence. Alternative : garder la logique manuelle si le refactor paraît risqué — à trancher par le dev.

### Task 5 — Evolution `POST /next-round` pour finale — squelette attendu

```typescript
// backend/src/routes/tournament.ts (next-round)
// ... validations inchangées ...

if (day.type === 'finale') {
  if (day.status === 'completed') {
    res.status(400).json({
      error: { code: 'FINALE_ALREADY_COMPLETED', message: 'La finale est déjà terminée' },
    });
    return;
  }

  // Récupérer le round finale précédent + ses 8 playerIds
  const previousRound = await prisma.round.findFirst({
    where: { dayId, status: 'validated' },
    orderBy: { number: 'desc' },
    include: { lobbies: { include: { players: { select: { playerId: true } } } } },
  });
  if (!previousRound || !previousRound.lobbies[0]) {
    res.status(400).json({
      error: { code: 'NO_PREVIOUS_FINALE_ROUND', message: 'Aucun round finale précédent trouvé' },
    });
    return;
  }
  const finalistIds = previousRound.lobbies[0].players.map((lp) => lp.playerId);

  const nextNumber = validatedCount + 1;
  await prisma.$transaction(async (tx) => {
    await tx.round.create({
      data: {
        number: nextNumber,
        dayId,
        status: 'in-progress',
        lobbies: {
          create: {
            number: 1,
            players: {
              create: finalistIds.map((playerId) => ({ playerId, placement: null, points: null })),
            },
          },
        },
      },
    });
  });

  // Hydrater la Day pour le retour (pattern existant)
  const updatedDay = await prisma.day.findUnique({ /* include rounds/lobbies/players */ });
  res.status(201).json({ data: updatedDay });
  return;
}

// ... qualif inchangé (pending round) ...
```

---

### Contrats backend stables — à PRÉSERVER (zéro régression qualif)

- **`POST /days`** — inchangé.
- **`GET /days/current`** — inchangé.
- **`POST /days/:dayId/rounds/:roundNumber/generate-lobbies`** — inchangé (ne sera **pas** appelé pour finale car les rounds finale sont créés `in-progress` avec lobby directement).
- **`POST /days/:dayId/rounds/:roundNumber/regenerate-lobbies`** — inchangé, mais **ne devra jamais être appelé pour finale** (frontend ne l'expose pas en phase finale). Défense côté backend : ajouter une garde optionnelle `if (day.type === 'finale') return 400 { FINALE_LOBBY_IS_FIXED }` — **task optionnelle** (l'UI ne le permet pas, mais défense en profondeur si l'admin tripote l'API en direct).
- **`POST /days/:dayId/rounds/:roundNumber/lobbies/:lobbyId/placements`** — inchangé, fonctionne naturellement pour finale (lobby 8 joueurs comme un lobby qualif plein).
- **`POST /days/:dayId/complete`** — inchangé, mais en finale n'a plus vraiment de sens (la finale se complete automatiquement via détection). Le bouton "Terminer la journée" est **masqué** côté frontend quand `winner` est défini ou que `day.type === 'finale' && !winner` (car la seule façon de terminer une finale est la détection automatique). **Décision** : pour garder l'endpoint fonctionnel en cas de besoin exceptionnel (ex: admin veut annuler une finale sans vainqueur), on le conserve identique côté backend. Frontend décidera simplement de ne pas l'afficher.

### Contrats WebSocket — étendus sans casser

- **`tournament_state`** (émis à la connexion) : payload enrichi avec `winner: PlayerRanking | null`.
- **`tournament_state_changed`** (émis sur transitions importantes) : payload enrichi pareil. Nouveau trigger = détection de victoire.
- **`ranking_updated`** (émis en debounce après validation round) : contenu `rankings` change désormais selon phase (qualif ou finale rankings). Format identique : `{ rankings: PlayerRanking[] }`.
- **Aucun nouvel événement** créé (pas de `winner_detected` dédié, économie de surface d'API — `tournament_state_changed` avec `winner` rempli suffit).

### Patterns Epic 2/5.1 à réutiliser sans les réinventer

- **Transactions Prisma imbriquées** (Task 4, 5) : pattern `prisma.$transaction(async (tx) => { ... })` avec création atomique Round + Lobby + LobbyPlayer dans un seul `.create` — **exact** copier-coller du pattern 5.1 `finale.ts` lignes 89-114.
- **`findUniqueOrThrow` pour hydrater après `create`** : pattern 5.1 ligne 116-130.
- **`emitTournamentStateChanged(getIO()).catch(...)` post-commit non-bloquant** : pattern 5.1 ligne 135.
- **Services purs + tests `node:test`** : pattern Epic 2 (`pointsCalculator.test.ts`, `rankingsAggregator.test.ts`) + 5.1 (`finaleQualifier.test.ts`).
- **Query params valeurs enum validées** (Task 6) : pattern [players.ts query params] (à inspecter — sinon fallback sur validation manuelle).

### Previous Story Intelligence (5.1)

**Patterns confirmés 5.1** :
- ✅ **Transaction Prisma** pour création atomique multi-tables — reconduit pour Task 5.
- ✅ **Broadcast WebSocket post-commit non-bloquant** — reconduit pour Task 4 (**mais** : exception pour `winnerDetected` → `await` au lieu de `.catch` pour garantir l'ordre émission avant réponse HTTP si l'admin recharge immédiatement).
- ✅ **Pas de modification de schema Prisma** — reconduit (schéma actuel suffit).
- ✅ **Tests unitaires services purs en priorité** — reconduit.
- ✅ **Endpoint admin protégé par JWT via `app.use('/api/admin', requireAuth)` en amont** — reconduit (pas de nouveaux endpoints admin, juste extensions).
- ⚠️ **Tests d'intégration HTTP différés** en 5.1 (Task 6 déférée) — **reconduit** en 5.2 : pas de framework supertest dans le repo, validation manuelle e2e à Brice + code review.

**Action items 5.1 affectant 5.2** :
- ✅ **Endpoint `POST /api/admin/finale/start` fonctionnel** (précondition pour 5.2).
- ✅ **Service `finaleQualifier.ts` + 7 tests verts** (réutilisé implicitement via `aggregateFinaleRankings` qui tirera les mêmes 8 joueurs que lobby unique).
- ✅ **Bandeau "Phase finale — Lobby unique fixe"** en place dans DayManager → 5.2 ajoute uniquement le bandeau **vainqueur** et l'affichage de progression.
- ✅ **`getFinaleProgression` endpoint** présent → 5.2 ne l'étend pas.

**Décisions 5.1 à respecter** :
- Classement cumulé qualif reste visible pendant la finale (bloc existant `day?.type === 'finale' && multiDayRankings`) — 5.2 **ajoute** un nouveau bloc "rankings finale en cours" **sans supprimer** le bloc qualif figé (les deux cohabitent, selon cohérence 5.1 AC #13).
- Absence totale du bouton "Générer les lobbies" en finale — naturellement préservée car les rounds finale sont créés `in-progress` directement avec lobby (Task 5.2).

**Contraintes mémoire projet Brice à respecter** :

- **Pas de limite de rounds en finale** : aucun `MAX_FINALE_ROUNDS` hardcodé. La détection automatique de victoire est la seule condition de fin. Vérifié dans Task 5 (pas de guard `roundNumber > N`) et Task 4 (pas de check sur le nombre de rounds).
- **Validation OBS dépendante SkyDow** : 5.2 n'introduit rien de nouveau dans `/overlay` côté UI. L'overlay recevra automatiquement les rankings finale via WebSocket (Task 3.6) — Brice peut tester en local sans SkyDow en ouvrant `/overlay` dans un onglet. La session de validation 16:9 avec SkyDow reste à caler pour Story 6.3 (dry-run).
- **Docker PG local disponible** : Brice peut tester e2e en local (Task 9.4). Aucun blocage externe.

**Patterns framer-motion + React 19 (rétro Epic 3-4)** :
- **Non pertinents en 5.2 côté admin** — la progression + bandeau vainqueur sont du JSX statique + classes Tailwind. Pas d'animation critique. Story 5.3 intégrera `framer-motion` pour UX-DR7 (barre animée) et UX-DR8 (mise en valeur or du vainqueur).
- **Exception admissible** : si le dev souhaite ajouter une petite pulsation sur le bandeau vainqueur (ex: `motion-safe:animate-pulse-subtle`), c'est un bonus — pas un requis.

---

### Anti-patterns à éviter

- **NE PAS** dupliquer `aggregateQualificationRankings` pour créer `aggregateFinaleRankings` — factoriser via `aggregateRankingsByDayType(prisma, type)`.
- **NE PAS** stocker `winner` en base (pas de colonne `Day.winnerId` ni de table `TournamentWinner`). `winner` est dérivé à la volée dans `computeTournamentState`.
- **NE PAS** créer un événement WebSocket `winner_detected` dédié — enrichir `tournament_state_changed` avec le champ `winner` est suffisant et évite la surface d'API.
- **NE PAS** créer un nouvel endpoint `POST /api/admin/finale/next-round` — étendre `POST /days/:dayId/next-round` avec une branche `day.type === 'finale'` est plus simple et cohérent avec le pattern Epic 2.
- **NE PAS** créer un endpoint `POST /api/admin/finale/:dayId/validate-round` — étendre l'existant `POST /days/:dayId/rounds/:roundNumber/validate` avec une branche.
- **NE PAS** utiliser `generateRandomLobbies` ou `generateSwissLobbies` pour les rounds finale 2+ — les 8 finalistes restent identiques, on duplique simplement leurs `playerId` du round précédent.
- **NE PAS** hardcoder `20` dans plusieurs endroits : `detectFinaleWinner` a un paramètre `threshold = 20`, les appels dans `tournament.ts` et `events.ts` passent explicitement `20` (ou constante partagée si le dev le souhaite).
- **NE PAS** émettre `tournament_state_changed` en continu pendant la finale (debounce) — ne l'émettre que sur transitions : démarrage finale (déjà fait par 5.1), détection victoire (ajouté par 5.2). Les updates de rankings pendant la finale passent par `ranking_updated` comme d'habitude.
- **NE PAS** oublier de mettre à jour `TournamentStatePayload` dans `socket.ts` (frontend) avec `winner` — sinon le TS build cassera côté frontend.
- **NE PAS** supposer que `currentDay.type` est toujours défini : gérer `null` (phase idle) sans crasher — `currentDay?.type === 'finale'` suffit.
- **NE PAS** modifier les tests existants de `rankingsAggregator.test.ts` — ajouter uniquement de nouveaux tests pour la version paramétrée. Les tests existants doivent continuer à passer inchangés.
- **NE PAS** créer de migration Prisma.

---

### NFR à vérifier

- **NFR1** (chargement < 2s) : `aggregateFinaleRankings` filtre sur 1 Day finale (donc ≤ 8 LobbyPlayer × nombre de rounds finale). Latence triviale à échelle projet.
- **NFR2** (mise à jour WebSocket < 2s) : `emitTournamentStateChanged` synchrone après commit → latence trivial.
- **NFR3** (latence saisie < 200ms) : l'évolution de `POST /validate` ajoute 1 `aggregateFinaleRankings` + éventuellement 1 `tx.day.update` — reste sous 200ms à cette échelle.
- **NFR4** (~30 connexions) : inchangé.
- **Fiabilité** : transaction Prisma garantit l'atomicité `round.validated` + `day.completed` en cas de victoire → pas d'état incohérent "round validé + finale encore in-progress + victoire détectée" possible.
- **Sécurité** : JWT requis (admin) sur tous les endpoints modifiés. Route publique `/api/rankings?type=finale` accepte tout visiteur — OK, rankings non sensibles.

### Project Structure Notes

**Fichiers nouveaux à créer** :
- [backend/src/services/winnerDetector.ts](backend/src/services/winnerDetector.ts) — service pur détection victoire
- [backend/src/services/winnerDetector.test.ts](backend/src/services/winnerDetector.test.ts) — 6+ tests unitaires

**Fichiers à modifier** :
- [backend/src/services/rankingsAggregator.ts](backend/src/services/rankingsAggregator.ts) — factoriser via `aggregateRankingsByDayType`, exporter `aggregateFinaleRankings`
- [backend/src/services/rankingsAggregator.test.ts](backend/src/services/rankingsAggregator.test.ts) — 2+ nouveaux tests isolation qualif/finale
- [backend/src/websocket/events.ts](backend/src/websocket/events.ts) — étendre `TournamentState` avec `winner`, brancher `computeTournamentState` sur phase, évoluer `emitRankingUpdated`
- [backend/src/routes/tournament.ts](backend/src/routes/tournament.ts) — brancher `POST /validate` (détection victoire + Day completed atomique) et `POST /next-round` (création round finale avec lobby)
- [backend/src/routes/rankings.ts](backend/src/routes/rankings.ts) — ajouter query param `?type=qualification|finale`
- [frontend/src/contexts/TournamentContext.tsx](frontend/src/contexts/TournamentContext.tsx) — ajouter `winner` à `TournamentState` + initialState + handlers
- [frontend/src/services/socket.ts](frontend/src/services/socket.ts) — ajouter `winner` à `TournamentStatePayload`
- [frontend/src/components/admin/DayManager.tsx](frontend/src/components/admin/DayManager.tsx) — bandeau vainqueur, affichage progression finale, désactivation actions post-victoire

**Fichiers à NE PAS toucher (critique)** :
- `backend/prisma/schema.prisma` — **aucune migration**
- `backend/src/services/pointsCalculator.ts` — barème générique, inchangé
- `backend/src/services/finaleQualifier.ts` — sélection des 8 finalistes, scope 5.1, inchangé
- `backend/src/services/lobbyGenerator.ts`, `swissSystem.ts` — non utilisés en finale
- `backend/src/routes/finale.ts` — scope 5.1, inchangé (le `POST /start` reste intact)
- `backend/src/routes/auth.ts`, `players.ts`, `admin.ts` — inchangés
- `backend/src/middleware/auth.ts` — inchangé
- `backend/src/websocket/io.ts`, `server.ts` — inchangés
- `frontend/src/services/api.ts` — aucune nouvelle fonction (les endpoints évoluent mais leurs URL restent identiques, les signatures de `validateRound` et `nextRound` restent exactes)
- `frontend/src/components/admin/FinaleQualificationPanel.tsx` — scope 5.1, inchangé
- `frontend/src/hooks/useTournament.ts`, `useAuth.ts` — inchangés
- `frontend/src/components/lobby/*`, `components/ranking/*`, `components/overlay/*`, `components/inscription/*` — inchangés
- `frontend/src/pages/Home.tsx`, `Qualifications.tsx`, `Overlay.tsx`, `MentionsLegales.tsx`, `Admin.tsx`, `AdminLogin.tsx` — inchangés (leur comportement change via les rankings reçus, mais leur code non)

**Aucun conflit détecté avec la structure unifiée. Aucune nouvelle dépendance npm. Aucune migration DB. Aucun nouvel endpoint public ou admin (uniquement extensions).**

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2 : Rounds de Finale & Detection de Victoire (lignes 728-760)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 : Phase Finale (lignes 700-702)]
- [Source: _bmad-output/planning-artifacts/epics.md#FR23 (detection condition de victoire, ligne 176)]
- [Source: _bmad-output/planning-artifacts/epics.md#FR24 (rounds illimites finale, ligne 177)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR21-FR24 — Finale (lignes 298-303)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Finale FR21-FR24 mapping (ligne 566, 625)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture (lignes 168-184) — modèle Day/Round/Lobby/LobbyPlayer (réutilisé tel quel)]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-04-18.md#Points d'attention Epic 5 (lignes 162-170) — recommandation service pur winnerDetector avec tests]
- [Source: _bmad-output/implementation-artifacts/5-1-qualification-pour-la-finale-lancement.md — pattern transaction Day+Round+Lobby+LobbyPlayers, scope 5.1/5.2/5.3, emit WebSocket post-commit]
- [Source: _bmad-output/implementation-artifacts/2-4-saisie-des-placements-calcul-des-points.md — pattern validate round + calcul points]
- [Source: _bmad-output/implementation-artifacts/2-7-classement-cumule-multi-journees.md — pattern `aggregateQualificationRankings` + tiebreakers réutilisés tels quels]
- [Source: backend/src/services/rankingsAggregator.ts — à refactoriser en `aggregateRankingsByDayType`]
- [Source: backend/src/services/pointsCalculator.ts — barème générique (inchangé)]
- [Source: backend/src/services/finaleQualifier.ts — pattern service pur 5.1]
- [Source: backend/src/routes/tournament.ts — endpoints `validate` (lignes 449-593) et `next-round` (lignes 595-652) à étendre]
- [Source: backend/src/routes/rankings.ts — route publique à étendre avec query param]
- [Source: backend/src/routes/finale.ts — pattern transaction Day+Round+Lobby+LobbyPlayers (lignes 89-114) à répliquer en Task 5]
- [Source: backend/src/websocket/events.ts — `computeTournamentState` (lignes 16-32), `emitRankingUpdated` (lignes 34-49), `scheduleRankingUpdated` (lignes 51-63), `emitTournamentStateChanged` (lignes 65-80)]
- [Source: backend/prisma/schema.prisma — modèle Day/Round/Lobby/LobbyPlayer (`Day.status` inclut 'completed')]
- [Source: frontend/src/contexts/TournamentContext.tsx — `TournamentState` interface à étendre]
- [Source: frontend/src/services/socket.ts — `TournamentStatePayload` à étendre]
- [Source: frontend/src/components/admin/DayManager.tsx — pattern affichage conditionnel sur `day?.type === 'finale'` (ligne 322), bloc classement qualif figé (lignes 672-709)]
- [Source: frontend/src/types/index.ts — `PlayerRanking` (inchangé, réutilisé tel quel pour `winner`)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- `cd backend && npm run build` → 0 erreur TS (passes successifs après Task 1, 2, 3, 4-5, 6).
- `cd backend && node --test dist/services/*.test.js` → 60 tests verts / 8 suites (49 baseline + 8 winnerDetector + 3 rankingsAggregator finale/isolation).
- `cd frontend && npm run build` → 0 erreur TS, bundle 147.04 kB gz (vs 146.63 baseline 5.1, +0.41 kB).
- `cd frontend && npm run lint` → 5 problèmes préexistants (3 errors + 2 warnings tous antérieurs à 5.2). 0 nouveau warning introduit.

### Completion Notes List

- **Task 1** : `aggregateRankingsByDayType(prisma, type)` factorisée ; `aggregateQualificationRankings` et `aggregateFinaleRankings` deviennent des wrappers 1-ligne. Mock prisma de tests enrichi avec champ technique `__dayType` pour pouvoir filtrer par `where.lobby.round.day.type` (les tests existants passent inchangés grâce au défaut `qualification`).
- **Task 2** : `winnerDetector.ts` + `DEFAULT_VICTORY_THRESHOLD = 20` + JSDoc complet. 8 tests passent (6 obligatoires AC #15 + 2 bonus : threshold custom + signature défaut).
- **Task 3** : `TournamentState.winner: PlayerRanking | null` ajouté. `computeTournamentState` calcule `winner` uniquement si `latestFinaleDay.status === 'completed'` (jamais pendant la finale en cours). `useFinaleRankings = currentDay?.type === 'finale' || finaleCompleted` couvre les 3 cas (finale en cours, finale terminée, qualif/idle). `emitRankingUpdated` réutilise `computeTournamentState()` pour cohérence ranking-stream.
- **Task 4** : Branche `day.type === 'finale'` ajoutée dans `POST /validate` avec transaction atomique (round.validated + day.completed si winner). Émission post-commit : `await emitTournamentStateChanged` si winner, sinon `scheduleRankingUpdated`. Branche qualif **conservée à l'identique** (lignes 525-582 inchangées) — risque de régression évité ; refactor en `aggregateQualificationRankings` recommandé en review.
- **Task 5** : Branche finale dans `POST /next-round` crée `Round(in-progress) + Lobby(1) + 8 LobbyPlayer` dans une transaction Prisma imbriquée (pattern 5.1 répliqué). Guard `FINALE_ALREADY_COMPLETED` ajouté. Branche qualif inchangée.
- **Task 6** : `GET /api/rankings?type=qualification|finale`, défaut `qualification` (backward-compat 100 %). `VALIDATION_ERROR` 400 sur valeur invalide.
- **Task 7** : `winner` propagé dans `TournamentStatePayload` (socket.ts) et `TournamentState` (TournamentContext.tsx). Handlers `tournament_state` et `tournament_state_changed` extraient `winner` ; `ranking_updated` n'altère pas `winner` (reste dans le state jusqu'au prochain `tournament_state*`).
- **Task 8** : Bandeau "🏆 Vainqueur" en or `#DAB265` en tête du DayManager (juste après `{error}`). Bloc "Progression vers la victoire" affiché en phase finale avec barre `Math.min(100, totalScore/20*100)%`, ratio `{totalScore}/20`, badge `✓ Top 1` si `top1Count >= 1`. Quand `winner` défini, bouton "Round suivant" remplacé par message "Finale terminee." + bouton désactivé. Bouton "Terminer la journee" masqué en finale (cohérence : la finale se termine uniquement par détection automatique). Bouton "Lancer le round suivant de finale" affiché en finale (libellé adapté).
- **Tests e2e manuels (Task 9.4)** : seuls les tests automatisés ont été exécutés. Les scénarios e2e UI (9.4.1 → 9.4.7) sont à valider manuellement par Brice avec Docker PG (mémoire projet : `Docker Desktop installe pour tester backend + PG en local`). Le seuil (19/20/25 pts + top 1) est couvert par `winnerDetector.test.ts` (AC #15).
- **Mémoire projet respectée** : aucune limite de rounds en finale (pas de `MAX_FINALE_ROUNDS`) ; 5.2 n'introduit aucun nouvel élément côté `/overlay` à valider avec SkyDow (le rendering des rankings finale est automatique via WebSocket).
- **Anti-patterns évités** : pas de duplication de `aggregateQualificationRankings` ; pas d'événement WebSocket `winner_detected` dédié (utilise `tournament_state_changed`) ; pas de stockage de `winner` en base ; pas de migration Prisma ; pas de nouvel endpoint admin (extensions uniquement).

### File List

**Fichiers nouveaux (backend)** :
- [backend/src/services/winnerDetector.ts](backend/src/services/winnerDetector.ts)
- [backend/src/services/winnerDetector.test.ts](backend/src/services/winnerDetector.test.ts)

**Fichiers modifiés (backend)** :
- [backend/src/services/rankingsAggregator.ts](backend/src/services/rankingsAggregator.ts) — factorisation via `aggregateRankingsByDayType` + export `aggregateFinaleRankings`
- [backend/src/services/rankingsAggregator.test.ts](backend/src/services/rankingsAggregator.test.ts) — mock enrichi `__dayType` + 3 nouveaux tests (isolation qualif/finale, finale vide)
- [backend/src/websocket/events.ts](backend/src/websocket/events.ts) — `TournamentState.winner` ajouté, `computeTournamentState` branché sur phase, `emitRankingUpdated` factorisé via `computeTournamentState`
- [backend/src/routes/tournament.ts](backend/src/routes/tournament.ts) — branche finale dans `POST /validate` (détection victoire atomique) et `POST /next-round` (création round finale + lobby) ; guard `FINALE_ALREADY_COMPLETED`
- [backend/src/routes/rankings.ts](backend/src/routes/rankings.ts) — query param `?type=qualification|finale`

**Fichiers modifiés (frontend)** :
- [frontend/src/services/socket.ts](frontend/src/services/socket.ts) — `TournamentStatePayload.winner: PlayerRanking | null`
- [frontend/src/contexts/TournamentContext.tsx](frontend/src/contexts/TournamentContext.tsx) — `TournamentState.winner` + `initialState` + handlers
- [frontend/src/components/admin/DayManager.tsx](frontend/src/components/admin/DayManager.tsx) — bandeau vainqueur, bloc progression finale, désactivation actions post-victoire, bouton "Terminer la journee" masqué en finale

**Fichier sprint-status modifié** :
- [_bmad-output/implementation-artifacts/sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) — `5-2-rounds-de-finale-detection-de-victoire: ready-for-dev → in-progress → review`

## Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                | Auteur                       |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 2026-04-18 | 0.1     | Création du contexte développeur (bmad-create-story) — scope Epic 5.2 : service pur `winnerDetector` (+ tests), `aggregateFinaleRankings` via refactor `aggregateRankingsByDayType`, évolution `computeTournamentState` avec champ `winner`, évolution `POST /validate` (détection atomique + Day completed) et `POST /next-round` (création round finale avec lobby), route publique `/api/rankings?type=finale`. Non-régression qualif critique. Scope 5.3 explicitement exclu. Réutilisation maximale patterns 5.1. Pas de nouveau framework ni migration. | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.0     | Implémentation complète Epic 5.2 (Tasks 1-9) : refactor `rankingsAggregator` factorisé (3 nouveaux tests), `winnerDetector` créé (8 tests), `computeTournamentState` étendu avec `winner`, `POST /validate` & `POST /next-round` branchés sur `day.type === 'finale'` (transactions atomiques), route publique `?type=finale`, frontend `TournamentState.winner` + bandeau or + bloc progression + désactivation actions post-victoire. 60 tests backend verts. Bundle frontend 147.04 kB gz (+0.41 kB vs baseline 5.1). 0 nouveau warning ESLint. Tests e2e UI déférés à validation Brice. Status: review. | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.1     | Suite revue de code : remplacement des `tx as unknown as typeof prisma` par `Prisma.TransactionClient` (export `PrismaLike` dans `rankingsAggregator.ts`) — supprime 3 casts unsafe, propage le typage dans le mock de tests. Build + 60 tests backend toujours verts. | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.2     | Hotfixes incidents découverts pendant validation manuelle Brice : (1) `computeLobbyGroups` corrigée — J1R1 = seule génération aléatoire, tous les autres rounds utilisent `aggregateQualificationRankings` (Swiss multi-journées) ; bug provenant Epic 2 stories 2-3 / 2-5. (2) Gardes `FINALE_LOBBY_IS_FIXED` ajoutées sur `POST /generate-lobbies` et `POST /regenerate-lobbies` (le bouton "Régénérer" en finale supprimait le lobby unique et recréait des lobbies Swiss depuis tous les inscrits). (3) Bouton "Régénérer les lobbies" masqué côté frontend en finale. (4) Script `backend/src/scripts/cleanup-finale.ts` ajouté pour reset propre d'une finale corrompue (transaction atomique : LobbyPlayer → Lobby → Round → Day). Docs mises à jour : README.md (section Scripts utilitaires), docs/CONTEXTE-PROJET.md (règle métier J1R1 vs Swiss multi-journées + lobby unique fixe finale + détection victoire). | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.3     | UX : déplacement du bloc "Classement cumule qualifications (fige)" depuis le bas du DayManager vers le haut (juste après le bandeau "Phase finale — Lobby unique fixe", avant "Progression vers la victoire"). Permet à l'admin de garder visible le classement qualif de référence dès le lancement de la finale, sans avoir à scroller en bas de page après les lobbies. Frontend build OK (147.04 kB gz, identique à v1.2). Status final : **done**. | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.4     | **Correction règle de victoire (bug critique détecté par Brice lors de la revue de 5.3)** — l'implémentation initiale de `detectFinaleWinner` vérifiait `totalScore >= 20` (seuil post-round). La règle réelle est : le seuil doit être atteint AVANT le round Top 1 (cumul des rounds antérieurs). Traverser 20 pts PENDANT le round du Top 1 ne doit PAS déclencher la victoire. Fix : on soustrait les points du dernier round du `totalScore` pour obtenir `preRoundTotal`, et on compare au seuil. Le dernier round est identifié par `roundNumber` max dans les `roundResults` du joueur (finale uniquement, déjà filtré par `aggregateFinaleRankings`). Tests réécrits avec `roundResults` réalistes + 4 nouveaux cas limites (crossing 14+8=22 → null, crossing 19+8=27 → null, `roundResults = []` → null, ordre non trié robuste). 60 → **64 tests backend verts**. Aucun changement de signature de `detectFinaleWinner`, callers (`events.ts`, `tournament.ts`) inchangés. Story 5.3 AC #5 mise à jour en parallèle (badge `✓ Top 1` remplacé par `⚡ Éligible victoire` côté frontend). | Claude Opus 4.7 (1M context) |
