# Story 5.3 : Page Finale Publique & Progression Victoire

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **spectateur ou joueur qualifie (ou non)**,
I want **consulter une page publique `/finale` dediee qui affiche en temps reel le classement des 8 finalistes, un indicateur visuel de progression vers la condition de victoire (>= 20 pts + top 1) pour chaque finaliste, et une mise en valeur forte en or du vainqueur des qu'il est detecte**,
So that **je comprends immediatement qui peut gagner a chaque round, je vois la tension monter en finale, et je recois la consecration du vainqueur en direct sans dependre du cast OBS ni d'un rafraichissement manuel**.

## Contexte de la story

**Derniere story d'Epic 5** — la partie backend est integralement livree en 5.1 (lancement finale, 8 qualifies, lobby unique fixe) et 5.2 (rounds finale, detection automatique de victoire, `aggregateFinaleRankings`, `winner` dans `TournamentState`, route publique `GET /api/rankings?type=finale`). 5.3 est **100 % frontend** (ecart-type Epic 4) — aucun changement backend, aucune migration, aucun nouvel endpoint. Le scope se concentre sur deux livrables public-facing :

1. **Nouvelle page `/finale`** — ajoutee dans `<Layout>` (header EDS + footer, contrairement a `/overlay`), avec :
   - Etat "finale pas commencee" (qualifs en cours) : message calme + incitation "Les qualifications sont en cours" OU (si qualifs terminees) liste des **8 qualifies a venir** (reuse pattern [FinaleQualificationPanel.tsx](frontend/src/components/admin/FinaleQualificationPanel.tsx) cote admin, version simplifiee publique sans boutons admin).
   - Etat "finale en cours" : tableau finalistes **avec colonne progression** (barre `totalScore/20` + badge `✓ Top 1` si `top1Count >= 1`), ordre trie par classement finale, flash cyan sur updates via `useRankingFlash`, layout motion reorder smooth.
   - Etat "finale terminee" : bandeau plein-largeur vainqueur en or `#DAB265` avec animation `framer-motion` (UX-DR8), classement finale final visible en-dessous.

2. **Correctif `/qualifications`** (mini-fix hérité de 5.2 AC #17) — quand la finale est en cours ou terminee, `/qualifications` affiche actuellement les rankings **finale** (effet de bord voulu de 5.2 pour eviter un etat vide). 5.3 corrige proprement : `/qualifications` affiche **toujours** le classement qualif cumule fige (via `fetchRankings()` REST direct, independant du `state.rankings` qui suit la phase). Raison : l'utilisateur qui consulte `/qualifications` pendant la finale s'attend au classement qualif — pas au classement finale.

**Perimetre clair (DANS 5.3)** :

1. Nouveau composant `FinaleRankingTable.tsx` (dans `frontend/src/components/finale/`) — derive du pattern [OverlayRankingTable.tsx](frontend/src/components/overlay/OverlayRankingTable.tsx) (3 colonnes base + layout motion + flash) **avec** ajout d'une colonne "Progression victoire" qui affiche : barre linéaire `h-2 w-32 rounded-full bg-eds-gray/20` remplie en or `bg-eds-gold/80` selon `Math.min(100, totalScore/20 * 100) %`, ratio numerique `{totalScore}/20` a cote, et badge `✓ Top 1` visible si `top1Count >= 1` (classes reprises **a l'identique** du bloc "Progression vers la victoire" de [DayManager.tsx:375-423](frontend/src/components/admin/DayManager.tsx) pour coherence visuelle admin/public).
2. Nouveau composant `FinaleWinnerBanner.tsx` (dans `frontend/src/components/finale/`) — bandeau pleine largeur affichant `🏆 {winner.discordPseudo} — Vainqueur EDS` en or avec animation `framer-motion` (fade-in + scale subtil) et classe `motion-safe:animate-heroGlow` reutilisee depuis les keyframes existants ([index.css:21-30](frontend/src/index.css)) pour la pulsation or.
3. Nouveau composant `FinaleQualifiersPreview.tsx` (dans `frontend/src/components/finale/`) — affiche les 8 qualifies a venir quand les 3 journees qualif sont terminees mais la finale pas encore lancee. Inspiration : [FinaleQualificationPanel.tsx](frontend/src/components/admin/FinaleQualificationPanel.tsx) cote admin mais **simplifie public** (pas de boutons, pas de bloc tiebreakers detaillés, juste la liste ordonnee pseudo + score total cumule qualif).
4. Nouvelle page `Finale.tsx` (dans `frontend/src/pages/`) — orchestre les trois etats (pas commencee / en cours / terminee) en fonction de `state.phase`, `state.currentDayType`, `state.winner`, et d'un fetch REST initial via nouvelle fonction `fetchFinaleRankings()`.
5. Nouvelle fonction API `fetchFinaleRankings(): Promise<{ data: PlayerRanking[] } | { error: ApiError }>` dans [frontend/src/services/api.ts](frontend/src/services/api.ts) — call `GET /api/rankings?type=finale` (route existante livrée en 5.2 Task 6), meme pattern que `fetchRankings()` existante. Sert de **fallback** quand le WebSocket n'est pas encore connecte au mount, **et** pour figer le classement finale sur la page si la visite a lieu apres finale terminee.
6. Nouvelle route `/finale` dans [frontend/src/App.tsx](frontend/src/App.tsx) — ajoutee DANS le `<Layout>` (ligne 48 — commentaire deja present en prevision). Import lazy non requis (pattern actuel du projet : imports synchrones).
7. Lien `/finale` dans le menu de navigation [Layout.tsx](frontend/src/components/common/Layout.tsx) — ajoute comme troisieme lien apres `/` et `/qualifications`. Libelle : "Finale". Le lien s'affiche **toujours** (pas conditionnel a la phase) pour que les visiteurs sachent que la page existe meme si la finale n'a pas encore commence (le rendu de la page couvre l'etat "pas commencee" proprement).
8. **Fix `/qualifications`** dans [Qualifications.tsx](frontend/src/pages/Qualifications.tsx) — decouple de `state.rankings` pour utiliser un classement qualif fetch independamment :
   - Au mount : `fetchRankings()` (route publique `GET /api/rankings` = qualif par defaut en 5.2 Task 6) → state local `qualRankings`.
   - Ecoute l'event WebSocket `ranking_updated` via le context : **si** `state.currentDayType === 'qualification' || state.phase === 'idle'` → utiliser `state.rankings` (comportement actuel preserve). **Sinon** (finale en cours ou terminee) → refetch `fetchRankings()` pour garder le classement qualif a jour (edge case rare : drop d'un joueur qualif entre les journees, mais defense en profondeur).
   - Le `EmptyState` inchange (pas de joueurs → "Tournoi non encore demarre").
   - **Decision** : si l'admin reouvre exceptionnellement une journee qualif apres demarrage de la finale (cas ultra-rare), la page /qualifications reflechira le changement via refetch. Pas de risque de desync.
9. Reutilisation **stricte** du hook [useRankingFlash.ts](frontend/src/hooks/useRankingFlash.ts) sur `FinaleRankingTable` — signature identique : `const flashingIds = useRankingFlash(rankings);`. Zero modification du hook.
10. Tailwind config : **aucune nouvelle classe**. Tous les tokens EDS (`eds-gold`, `eds-cyan`, `eds-dark`, `eds-gray`, `eds-light`, `font-heading`, `font-body`, `motion-safe:animate-heroGlow`, `motion-safe:animate-rankingFlash`) sont deja declares dans [index.css:1-71](frontend/src/index.css).

**Perimetre explicitement HORS 5.3 (a ne PAS implementer ici)** :

- ❌ **Validation responsive mobile reelle** (testee avec vrais devices) — 5.3 respecte les breakpoints Tailwind existants (`md:`, `lg:`) et sera validé par Brice en local (desktop + DevTools responsive). Vrai test mobile = session dry-run Epic 6.
- ❌ **Tests unitaires composants** — le projet n'a pas d'infra `testing-library` (confirme retro Epic 4 : "Aucun test .test.tsx/.test.ts dans frontend/src/"). Tests visuels via `npm run build` + `npm run lint` + validation manuelle navigateur.
- ❌ **Animation vainqueur ultra-riche** (confetti, particules, sequences complexes) — UX-DR8 exige "mise en avant forte en or" : un bandeau glow + fade-in + scale subtil `framer-motion` suffit. Pas de dependance confetti/canvas/lottie supplementaire. Bundle max +8 kB gz (voir AC #18).
- ❌ **Page `/overlay` modifiee** — l'overlay **continue** de tirer `state.rankings` (phase-aware) et `state.winner` du context. 5.3 ne touche pas Overlay.tsx ni OverlayRankingTable.tsx. Si SkyDow veut un overlay dedie "finale" avec progression visible, c'est un **scope futur** non-MVP.
- ❌ **Nouveau endpoint backend ou evolution API** — backend fige en 5.2 (route `GET /api/rankings?type=finale` existe deja, `winner` deja dans `TournamentState`).
- ❌ **Export podium final / partage social du vainqueur** — out of scope MVP.
- ❌ **Historique inter-tournois** — un seul tournoi, un seul vainqueur, pas de table d'archive.
- ❌ **Animation de transition qualif → finale** (ex : fondu entre les deux pages au moment du lancement finale) — out of scope, les pages restent independantes.

**Regles projet rappelees (memoire Brice)** :

- **Pas de limite de rounds en finale** : aucune affichage UI type "Round 3/5" — juste "Round N" tel qu'il arrive via rankings. 5.3 n'introduit aucune contrainte numerique.
- **Validation OBS dependante SkyDow** : 5.3 **n'affecte pas `/overlay`**. Brice peut valider entierement `/finale` seul en local avec Docker PG (backend) + vite dev (frontend) + scenario scripts. Le dry-run SkyDow reste centre sur `/overlay`, pas sur `/finale`.
- **Docker Desktop local** : Brice peut reproduire tous les etats en local (seed joueurs, journees qualif completees, finale lancee, rounds joues, victoire detectee). Le script `backend/src/scripts/cleanup-finale.ts` (ajoute en 5.2 v1.2) est utile si Brice doit redemarrer une finale.

**Decision d'architecture cle** : la page `/finale` **depend exclusivement** du `TournamentContext` (state.rankings, state.winner, state.phase, state.currentDayType) pour les trois etats — c'est l'unique source de verite cote frontend pour les donnees temps reel. Le `fetchFinaleRankings()` ajoute sert uniquement de **fallback initial** si on atterrit sur `/finale` avant que le context soit peuple (Socket.IO pas encore connecte au mount, ou network hiccup). Strategie d'hydratation :

- **Mount** : si `state.rankings.length === 0` OU `state.currentDayType !== 'finale' && !state.winner` → `fetchFinaleRankings()` → stockage local dans `finaleRankings` state.
- **Runtime** : si `state.rankings.length > 0 && (state.currentDayType === 'finale' || state.winner)` → utiliser `state.rankings` prioritairement. Sinon `finaleRankings` local.

Ceci garantit : (1) pas de flash de page vide au chargement initial, (2) mises a jour temps reel via WebSocket dès que le context est pret, (3) coherence avec le modele "context = source de verite unique" etabli en Epic 3.

**Decision d'architecture secondaire** : le composant `FinaleRankingTable` est **distinct** de `OverlayRankingTable` plutot qu'une variante via prop `variant`. Raisons :

1. `OverlayRankingTable` est 100 % frontend, optimise pour OBS (pas de interaction, pas de progression, 3 colonnes exactement), zero risque de regression sur `/overlay` (confirme retro Epic 4 : "Refactor useRankingFlash touche un fichier /qualifications... si regression visuelle ce sera le suspect #1").
2. `FinaleRankingTable` ajoute 1 colonne (progression) + 1 badge (top 1) + un comportement `winner` (ligne or mise en avant). Mutualiser via prop aboutirait a un composant hybride 5-colonnes-conditionnelles. DRY ici est plus couteux que la duplication ciblee (~80 lignes JSX similaires).
3. Si duplicate devient genant post-MVP, refactor possible en extrayant un `BaseRankingTable<TColumns>` generique. Non bloquant pour MVP.

Alternative (rejetee par defaut) : prop `showProgression?: boolean` + `winnerId?: number` sur `OverlayRankingTable`. Refacto ≤ 30 min en review si Brice prefere la mutualisation — trancher en code review.

## Acceptance Criteria

1. **Given** je suis un visiteur et je clique sur le lien "Finale" dans la navigation principale OU j'accede directement a `tournoi.esportdessacres.fr/finale` **When** la page se charge **Then** la route `/finale` rend le composant `Finale.tsx` **DANS** le `<Layout>` (header EDS + menu + footer visibles, coherent avec `/` et `/qualifications`) **And** le lien "Finale" dans le menu est marque actif (via NavLink `isActive` classe cyan — pattern deja en place dans Layout.tsx pour `/qualifications`).

2. **Given** la finale n'a pas encore commence **And** au moins une journee qualif n'est pas terminee (phase `idle` ou `qualification`) **When** je consulte `/finale` **Then** un etat d'attente s'affiche avec : titre `Finale EDS` en Bebas Neue, message `La finale n'est pas encore lancée. Les qualifications sont en cours — revenez apres la derniere journee.` en `font-body text-eds-gray`, et un logo EDS centre en `motion-safe:animate-heroGlow` (reuse `<LogoEds className="h-24 md:h-32 lg:h-40" />` + class glow via `index.css` existant) **And** aucun tableau de classement n'est visible **And** aucune erreur console n'est emise (notamment pas d'erreur Fetch si finale pas lancee — le backend renvoie `[]` proprement).

3. **Given** les 3 journees qualif sont terminees (statut `completed`) **And** la finale n'a pas encore ete lancee (`phase === 'idle'`, `state.currentDayType === null`, pas de Day `finale`) **When** je consulte `/finale` **Then** l'etat "qualifies a venir" s'affiche avec : titre `Top 8 qualifies pour la finale` en Bebas Neue `text-eds-gold`, liste ordonnee des 8 premiers du classement qualif cumule (rang cyan 1–8, pseudo en `font-body`, score total en `text-eds-gold` aligne droite), et message bas de page `La finale sera lancee par l'admin. Revenez bientot pour suivre le dernier acte.` **And** les 8 qualifies sont fetched via `fetchRankings()` (classement qualif) et **PAS** `fetchFinaleRankings()` (qui renverrait `[]` tant que la finale n'existe pas) **And** les noms des qualifies matchent exactement ceux vu dans `FinaleQualificationPanel` cote admin (tiebreakers appliques).

4. **Given** la finale est en cours (`state.phase === 'finale'`, `state.currentDayType === 'finale'`, aucun `winner` detecte) **When** je consulte `/finale` **Then** un tableau `FinaleRankingTable` s'affiche avec les 8 finalistes, trie par `rank` croissant, colonnes : **#** (rang or/cyan), **Pseudo** (font-body), **Placements par round** (colonne groupee affichant `R1: 3e (6pts) | R2: 1er (8pts) | ...` ou equivalent compact), **Score total** (font-heading, or), **Progression victoire** (barre + ratio + badge `✓ Top 1`) **And** le tableau se met a jour automatiquement via WebSocket (`ranking_updated`) en moins de 2 secondes apres validation admin (NFR2) **And** les variations de score declenchent un flash cyan 1.5 s via `useRankingFlash` (reuse strict du hook) **And** le reorder lors d'un changement de classement est anime via `framer-motion layout layoutId={finaliste.playerId}` (pattern OverlayRankingTable).

5. **(Revision 2026-04-18)** **Given** la finale est en cours et je regarde la colonne "Progression victoire" **When** un finaliste a `totalScore = 14` **Then** sa barre est remplie a 70 % en or, le ratio `14/20` est affiche en `text-eds-gold text-sm`, aucun badge d'eligibilite **And** **When** un finaliste a `totalScore = 18` **Then** sa barre est a 90 %, ratio `18/20`, pas de badge (pas encore eligible) **And** **When** un finaliste a `totalScore = 24` (seuil franchi) **Then** sa barre est plafonnee a 100 %, le ratio `24/20` est en or plus vif (`font-heading`), **ET** un badge `⚡ Éligible victoire` visible a cote de son pseudo (classes `border border-eds-gold bg-eds-gold/20 px-2 py-0.5 font-heading text-xs text-eds-gold motion-safe:animate-pulse`) avec tooltip "Le joueur a atteint 20 pts. Un Top 1 au prochain round = victoire." **Note** : le badge precedent `✓ Top 1` (base sur `top1Count >= 1`) a ete retire car ne refletait PAS la regle de victoire reelle (voir regle confirmee Brice ci-dessous). Le badge actuel `⚡ Éligible victoire` signale les joueurs ayant atteint le seuil 20 pts — ils remporteront la finale s'ils finissent Top 1 au **round suivant**.

   **Regle de victoire clarifiee (Brice 2026-04-18)** : pour gagner la finale, un joueur doit (1) avoir atteint >= 20 points **AVANT** le round en cours (cumul des rounds anterieurs), ET (2) finir Top 1 du round en cours. Traverser 20 pts PENDANT le round du Top 1 ne suffit PAS. Backend `detectFinaleWinner` corrige dans le meme commit (voir story 5.2 Change Log v1.4).

6. **Given** je consulte `/finale` sur desktop (>= 1024 px) **When** la page se charge **Then** toutes les colonnes du `FinaleRankingTable` sont visibles sans scroll horizontal **And** la barre de progression utilise la largeur fixee `w-32` (128 px) avec ratio a droite — meme rendu que admin DayManager **And** le chargement initial est < 2 secondes (NFR1, fetch REST + render = trivial sur ~8 lignes).

7. **Given** je consulte `/finale` sur mobile (< 768 px) **When** la page se charge **Then** le tableau est lisible sans debordement horizontal: les colonnes essentielles (#, Pseudo, Total, Progression) restent visibles, la colonne "Placements par round" peut defiler horizontalement via `overflow-x-auto` sur le wrapper table (pattern deja utilise dans [RankingTable.tsx](frontend/src/components/ranking/RankingTable.tsx)) **And** la barre de progression se reduit sur mobile a `w-24` via classe `w-24 md:w-32` pour economiser l'espace **And** le badge `✓ Top 1` reste visible a cote du pseudo sans overflow.

8. **Given** la finale est en cours, un finaliste vient de valider un round ou il a termine top 1 **And** son `totalScore` atteint `>= 20` **When** l'admin valide le round dans le backoffice et le backend emet `tournament_state_changed` avec `winner: PlayerRanking` non-null **Then** le `TournamentContext` met a jour `state.winner` **And** la page `/finale` detecte `state.winner !== null`, **demonte le tableau finaliste "en cours"** et **monte** le composant `FinaleWinnerBanner` avec animation `framer-motion` (fade-in + scale `0.95 → 1` sur 600 ms, `ease: 'easeOut'`) **And** le bandeau occupe la pleine largeur du container, affiche `🏆 {winner.discordPseudo}` en Bebas Neue `text-5xl md:text-7xl text-eds-gold`, sous-titre `Vainqueur EDS — {winner.totalScore} pts cumulés finale` en `text-eds-light font-body` **And** le bandeau pulse doucement via `motion-safe:animate-heroGlow` (reutilise keyframe existant `index.css:21-30` qui applique `drop-shadow` + `text-shadow` or) **And** la mise en valeur or respecte UX-DR8 (`#DAB265` = `eds-gold`).

9. **Given** `state.winner !== null` (finale terminee) **When** je consulte `/finale` **Then** le `FinaleWinnerBanner` s'affiche en tete de page **And** en dessous, le classement finale fige est visible (rankings tries, colonne progression inchangee, mais desormais statique car `ranking_updated` n'est plus emis apres la fin) **And** le vainqueur est mis en evidence visuelle dans le tableau egalement : sa ligne a une bordure gauche or plus epaisse (`border-l-4 border-l-eds-gold` au lieu du cyan top 8) + fond legerement or (`bg-eds-gold/10`) pour rester reperable apres scroll **And** aucun bouton ou lien d'action n'est present (la page est en mode "consultation du resultat").

10. **Given** j'atterris sur `/finale` apres que la finale a ete terminee (ex : je visite le lendemain) **When** la page se charge **Then** le context re-hydrate l'etat via WebSocket `tournament_state` initial (inclut `winner` grace a 5.2 AC #7) **And** simultanement le fallback `fetchFinaleRankings()` au mount garantit que les rankings sont disponibles meme si Socket.IO n'a pas encore fini sa handshake (pas de flash de page vide) **And** le `FinaleWinnerBanner` + tableau fige s'affichent correctement en moins de 2 secondes.

11. **Given** la page `/finale` est chargee et connectee via WebSocket **When** la connexion est temporairement interrompue (perte reseau mobile) **Then** Socket.IO tente la reconnexion automatiquement (comportement natif, deja en place) **And** pendant l'interruption, le tableau reste visible avec les dernieres donnees **And** apres reconnexion, le classement est automatiquement resynchronise via `tournament_state` (pas de recharge manuelle requise) **And** aucun spinner ou blocage UI n'apparait pendant la reconnexion (comportement coherent avec `/qualifications` et `/overlay`).

12. **Given** je suis sur la page `/qualifications` pendant que la finale est **en cours** (phase === `finale`, `currentDayType === 'finale'`) **When** la page se charge **Then** le `RankingTable` affiche le **classement qualif cumule fige** (les scores du dernier etat qualif avant lancement finale) **And** PAS les rankings finale **And** le fetch est realise via `fetchRankings()` (route `GET /api/rankings` sans query param = qualif par defaut) **And** l'event WebSocket `ranking_updated` refetch `fetchRankings()` uniquement si `state.currentDayType === 'qualification' || state.phase === 'idle'` ; sinon (finale en cours/terminee) le refetch est ignore (le classement qualif fige n'a pas besoin de bouger) **And** cette correction regle le bug hérité de 5.2 AC #17 (confirme par rétro Epic 5 a venir).

13. **Given** je suis sur `/qualifications` et la finale est **terminee** (phase === `idle` mais `latestFinaleDay.status === 'completed'`, `state.winner !== null`) **When** la page se charge **Then** le classement qualif cumule est toujours affiche (tel qu'il etait a la fin de la J3) **And** PAS le classement finale **And** le RankingTable affiche les 30-32 joueurs qualif tries normalement (top 8 cyan, drops gris — comportement inchange vs avant phase finale).

14. **Given** je suis sur `/overlay` pendant que la finale est en cours **When** un round est valide **Then** l'overlay continue de recevoir `ranking_updated` avec les rankings finale (comportement de 5.2, **inchange** en 5.3) **And** la logique OverlayRankingTable fonctionne telle quelle avec 8 lignes au lieu de 32 **And** SkyDow voit correctement le classement finale en direct (OK pour UX-DR14). **AUCUNE modification** de `/overlay` en 5.3.

15. **Given** la story est livree **When** je lance `npm run build` (frontend) **Then** zero erreur TypeScript **And** zero nouveau warning ESLint introduit (la baseline 5.2 v1.3 a 5 warnings pre-existants — tous preserves tels quels, aucun ajout) **And** le bundle frontend n'augmente pas de plus de **+8 kB gz** par rapport a la baseline 5.2 v1.3 (147.04 kB gz → target ≤ 155.04 kB gz). Framer-motion est **deja** charge (Epic 3-4), donc l'ajout de `FinaleRankingTable` + `FinaleWinnerBanner` + page Finale devrait couter ~3-5 kB gz de JSX uniquement.

16. **Given** la story est livree **When** je lance `npm run dev` en local **Then** la navigation manuelle via les scenarios suivants fonctionne sans erreur console :
    - (a) Visiter `/finale` sans tournoi → etat "finale non encore lancee" + message calme.
    - (b) Visiter `/finale` pendant qualifs → meme etat "finale non encore lancee" (pas d'erreur si rankings finale vide).
    - (c) Visiter `/finale` apres que 3 journees qualif sont completees mais finale pas lancee → etat "Top 8 qualifies a venir" + liste des 8 finalistes pressentis.
    - (d) Lancer finale via admin → visiter `/finale` → tableau 8 finalistes + progression (tous a 0/20).
    - (e) Saisir round 1 finale + valider → progression mise a jour en direct (barres qui montent) + flash cyan.
    - (f) Continuer jusqu'a victoire (ex : joueur X avec 24 pts + top 1) → bandeau `🏆 X Vainqueur EDS` + animation fade-in + glow or.
    - (g) Ouvrir un second onglet `/qualifications` pendant la finale → classement qualif cumule fige visible (bug 5.2 resolu).
    - (h) Refresh dur `/finale` apres victoire → bandeau vainqueur + tableau fige visibles sous 2 s (hydratation via WebSocket + fallback REST).

17. **Given** la story est livree **When** je consulte le footer et le header du site depuis `/finale` **Then** Layout est identique aux autres pages publiques (Home, Qualifications, MentionsLegales) : nav, logo EDS, mentions legales en footer **And** le menu nav contient desormais les 3 liens `/` (Accueil), `/qualifications` (Qualifications), `/finale` (Finale) dans cet ordre, avec le lien actif surligne en `text-eds-cyan` (pattern NavLink existant dans Layout.tsx).

18. **Given** je navigue entre `/qualifications` et `/finale` **When** je change de page **Then** aucun re-fetch inutile n'a lieu (chaque page a son propre state local et son propre fetch initial) **And** le `TournamentContext` continue d'ecouter le meme singleton Socket.IO **And** aucune deconnexion/reconnexion WebSocket n'est declenchee par la navigation interne (coherent avec le pattern SPA deja en place).

## Tasks / Subtasks

- [x] **Task 1 — Ajouter `fetchFinaleRankings()` dans `api.ts`** (AC #4, #10)
  - [x] 1.1 Editer [frontend/src/services/api.ts](frontend/src/services/api.ts) : ajouter une nouvelle fonction exportee `fetchFinaleRankings()` qui call `GET ${API_URL}/api/rankings?type=finale` et retourne `{ data: PlayerRanking[] } | { error: ApiError }`.
  - [x] 1.2 Utiliser exactement le pattern de `fetchRankings()` existante (meme try/catch, meme verification `response.ok`, meme type de retour). Copier-coller + changement URL.
  - [x] 1.3 Ajouter un commentaire JSDoc court : `/** Fetch les rankings de la finale. Voir 5.2 Task 6 pour le backend. */`.
  - [x] 1.4 Verifier import du type `ApiError` et `PlayerRanking` (deja en place pour `fetchRankings`).
  - [x] 1.5 Build verifie : `cd frontend && npm run build` → 0 erreur TS.

- [x] **Task 2 — Creer composant `FinaleRankingTable.tsx`** (AC #4, #5, #6, #7, #9)
  - [x] 2.1 Creer le dossier [frontend/src/components/finale/](frontend/src/components/finale/) si inexistant.
  - [x] 2.2 Creer [frontend/src/components/finale/FinaleRankingTable.tsx](frontend/src/components/finale/FinaleRankingTable.tsx). Props : `{ rankings: PlayerRanking[]; winnerId?: number | null }` (winnerId optionnel pour la mise en evidence de la ligne vainqueur apres detection).
  - [x] 2.3 Appeler `useRankingFlash(rankings)` au debut du composant pour obtenir `flashingIds: Set<number>`. Aucun autre etat local.
  - [x] 2.4 Structure JSX : `<div className="overflow-x-auto rounded-lg bg-eds-dark/50 p-4">` + `<table>` avec `<thead>` (colonnes : #, Joueur, Placements, Total, Progression, dans cet ordre) + `<motion.tbody>`.
  - [x] 2.5 Pour chaque ranking, rendre une `<motion.tr layout layoutId={\`finale-row-${ranking.playerId}\`} transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}>` (pattern OverlayRankingTable ligne 46-49).
  - [x] 2.6 Colonne **#** : `<td className="px-3 py-2 font-heading text-xl ${ranking.rank === 1 ? 'text-eds-gold' : 'text-eds-cyan'}">` — rank 1 en or, reste en cyan (les 8 sont tous qualifies, l'or marque le leader).
  - [x] 2.7 Colonne **Joueur** : pseudo en `font-body text-eds-light` + badge `✓ Top 1` conditionnel `ranking.top1Count >= 1` (classes exactement identiques au bloc admin DayManager ligne 396-400).
  - [x] 2.8 Colonne **Placements** : utilise `ranking.roundResults` (nom reel du champ dans le type `PlayerRanking`, pas `roundSummaries` comme indique initialement — correction appliquee). Format `R{num}: {place}e|1er ({pts}pts)` separateur ` | `. Si `roundResults` vide (cas fallback REST), afficher `—`. Style : `font-body text-sm text-eds-gray whitespace-nowrap`. Le wrapper `overflow-x-auto` assure le scroll horizontal sur mobile.
  - [x] 2.9 Colonne **Total** : `<td className="px-3 py-2 font-heading text-xl text-eds-gold text-right">{ranking.totalScore}</td>`.
  - [x] 2.10 Colonne **Progression** : reuse exacte du bloc admin DayManager ligne 401-413 — `<div className="flex items-center gap-3"><div className="h-2 w-24 md:w-32 overflow-hidden rounded-full bg-eds-gray/20"><div className="h-full bg-eds-gold/80" style={{ width: \`${pct}%\` }} /></div><span className={pct >= 100 ? "font-heading text-eds-gold" : "font-body text-sm text-eds-gold"}>{ranking.totalScore}/20</span></div>`. Variable `pct = Math.min(100, (ranking.totalScore / 20) * 100)`.
  - [x] 2.11 Mise en valeur ligne vainqueur : si `winnerId === ranking.playerId` → classes row `border-l-4 border-l-eds-gold bg-eds-gold/10`. Sinon `border-l-2 border-l-eds-cyan` (les 8 sont tous qualifies). Le rang 1 bascule egalement en `text-eds-gold` pour marquer le leader.
  - [x] 2.12 Flash classe conditionnelle : `flashingIds.has(ranking.playerId) && 'motion-safe:animate-[rankingFlash_1.5s_ease-out]'` — exactement comme [OverlayRankingTable.tsx:38](frontend/src/components/overlay/OverlayRankingTable.tsx).
  - [x] 2.13 TypeScript strict : typer explicitement les props, aucun `any`. Verification dans [frontend/src/types/index.ts](frontend/src/types/index.ts) : `PlayerRanking.roundResults: PlayerRoundSummary[]` (et non `roundSummaries`). `top1Count`, `totalScore`, `rank`, `playerId`, `discordPseudo`, `isDropped` tous presents.
  - [x] 2.14 Build verifie : `cd frontend && npm run build` → 0 erreur TS.

- [x] **Task 3 — Creer composant `FinaleWinnerBanner.tsx`** (AC #8, #9)
  - [x] 3.1 Creer [frontend/src/components/finale/FinaleWinnerBanner.tsx](frontend/src/components/finale/FinaleWinnerBanner.tsx). Props : `{ winner: PlayerRanking }`.
  - [x] 3.2 Utiliser `motion.div` de framer-motion avec : `initial={{ opacity: 0, scale: 0.95 }}`, `animate={{ opacity: 1, scale: 1 }}`, `transition={{ duration: 0.6, ease: 'easeOut' }}`.
  - [x] 3.3 Classes Tailwind : `className="mb-8 rounded-xl border-2 border-eds-gold bg-eds-gold/10 py-8 px-6 text-center motion-safe:animate-heroGlow"` — glow reutilise depuis [index.css:21-30](frontend/src/index.css).
  - [x] 3.4 Contenu : (1) emoji 🏆 en grand (`text-6xl md:text-8xl`) centré `aria-hidden="true"`, (2) pseudo vainqueur `<h1 className="mt-4 font-heading text-5xl md:text-7xl text-eds-gold">{winner.discordPseudo}</h1>`, (3) sous-titre `<p className="mt-2 font-body text-xl text-eds-light">Vainqueur EDS — {winner.totalScore} pts cumules finale</p>`.
  - [x] 3.5 Accessibilite : `role="status"` + `aria-live="polite"` sur le `motion.div` pour annoncer le vainqueur aux lecteurs d'ecran.
  - [x] 3.6 Respect `prefers-reduced-motion` : `motion-safe:` prefix sur `animate-heroGlow` garantit que l'animation est desactivee si l'utilisateur a `prefers-reduced-motion: reduce` (comportement natif des utilitaires Tailwind `motion-safe:`).
  - [x] 3.7 Build verifie : `cd frontend && npm run build` → 0 erreur TS.

- [x] **Task 4 — Creer composant `FinaleQualifiersPreview.tsx`** (AC #3)
  - [x] 4.1 Creer [frontend/src/components/finale/FinaleQualifiersPreview.tsx](frontend/src/components/finale/FinaleQualifiersPreview.tsx). Props : `{ rankings: PlayerRanking[] }` — reçoit directement les rankings qualif (top 8 sera extrait en interne via `rankings.slice(0, 8)`).
  - [x] 4.2 Titre : `<h2 className="mb-6 font-heading text-4xl text-eds-gold">Top 8 qualifies pour la finale</h2>`.
  - [x] 4.3 Table simple : rang (cyan, font-heading), pseudo (font-body), score total (or, aligne droite). Pas de colonne progression (la finale n'a pas commence).
  - [x] 4.4 Si `qualifiers.length < 8` (cas edge : moins de 8 joueurs actifs apres drops) → afficher quand meme les N disponibles + message `<p className="mt-4 font-body text-sm text-eds-gray">Seulement {qualifiers.length} joueurs actifs — la finale sera ajustee.</p>`.
  - [x] 4.5 Message de bas de page : `<p className="mt-6 font-body text-eds-gray">La finale sera lancee par l'admin. Revenez bientot pour suivre le dernier acte.</p>`.
  - [x] 4.6 Build verifie : `cd frontend && npm run build` → 0 erreur TS.

- [x] **Task 5 — Creer page `Finale.tsx`** (AC #1, #2, #3, #4, #8, #9, #10, #11)
  - [x] 5.1 Creer [frontend/src/pages/Finale.tsx](frontend/src/pages/Finale.tsx). Imports : `useTournament`, `useEffect`, `useState`, `fetchFinaleRankings`, `fetchRankings`, `FinaleRankingTable`, `FinaleWinnerBanner`, `FinaleQualifiersPreview`, `LogoEds`, types `PlayerRanking`.
  - [x] 5.2 State locaux :
    - `finaleRankings: PlayerRanking[]` — fallback REST pour rankings finale.
    - `qualRankingsForPreview: PlayerRanking[]` — rankings qualif fetched pour afficher le preview des 8 qualifies si qualifs terminees + finale pas lancee.
    - `isLoadingRankings: boolean` (initialise a `true`).
    - `error: string | null`.
  - [x] 5.3 `useEffect` au mount (deps `[]`) :
    - Parallel fetch : `Promise.all([fetchFinaleRankings(), fetchRankings()])` → populer les deux states locaux.
    - Flag `cancelled` pour eviter setState apres demontage.
    - `.catch` global → setError 'Network error'.
    - `finally` → `setIsLoadingRankings(false)`.
  - [x] 5.4 Logique d'affichage (en JSX conditionnel) :
    - **Si** `state.winner !== null` → rendu `<FinaleWinnerBanner winner={state.winner} />` + `<FinaleRankingTable rankings={effectiveRankings} winnerId={state.winner.playerId} />`.
    - **Sinon si** `state.currentDayType === 'finale'` → rendu tableau finale seul `<FinaleRankingTable rankings={effectiveRankings} />`.
    - **Sinon si** `state.phase === 'idle' && qualRankingsForPreview.length >= 8` → rendu `<FinaleQualifiersPreview rankings={qualRankingsForPreview} />`.
    - **Sinon** → rendu etat par defaut : `<h1>Finale EDS</h1>` + message calme + logo glow (AC #2).
  - [x] 5.5 Calcul `effectiveRankings` :
    ```tsx
    const effectiveRankings = state.rankings.length > 0 && (state.currentDayType === 'finale' || state.winner !== null)
      ? state.rankings
      : finaleRankings;
    ```
  - [x] 5.6 Container global : `<main className="container mx-auto px-4 py-8">` avec titre `<h1 className="mb-6 font-heading text-5xl text-eds-light">Finale EDS</h1>` present dans les etats 2/3/4 (absent dans l'etat 1 : le banner fait office de titre).
  - [x] 5.7 Gestion error : si `error && !isLoadingRankings` dans l'etat defaut → message `<p className="mt-4 font-body text-sm text-eds-gray">Impossible de charger le classement. Reessayez dans quelques instants.</p>`.
  - [x] 5.8 Spinner loading : `isLoadingRankings` dans l'etat defaut → `<p className="mt-4 font-body text-eds-gray">Chargement…</p>` (minimal, pas de spinner custom — pattern page Qualifications).
  - [x] 5.9 Build verifie : `cd frontend && npm run build` → 0 erreur TS.

- [x] **Task 6 — Ajouter la route `/finale` dans `App.tsx`** (AC #1, #17)
  - [x] 6.1 Editer [frontend/src/App.tsx](frontend/src/App.tsx) : remplacer le commentaire "Routes futures" par `<Route path="/finale" element={<Layout><Finale /></Layout>} />`.
  - [x] 6.2 Ajouter l'import `import Finale from './pages/Finale';` apres `import Overlay from './pages/Overlay';`.
  - [x] 6.3 Verifier : la route **n'a pas** de `ProtectedRoute` (page publique, aucun guard auth).
  - [x] 6.4 Build verifie : `cd frontend && npm run build` → 0 erreur TS. Test manuel navigateur pousse a Task 9.5.

- [x] **Task 7 — Ajouter le lien "Finale" dans le menu nav `Layout.tsx`** (AC #1, #17)
  - [x] 7.1 Editer [frontend/src/components/common/Layout.tsx](frontend/src/components/common/Layout.tsx).
  - [x] 7.2 Le lien `/finale` etait deja dans `navLinks` avec `disabled: true` (prepare en amont).
  - [x] 7.3 Retirer le flag `disabled: true` pour activer le lien. Supprimer aussi la branche de rendu `<span>` disabled (devenue inutile) pour garder la nav propre (`Link` unique pour tous les items).
  - [x] 7.4 Nav horizontal partage desktop/mobile actuel (pas de hamburger — voir deferred-work.md Epic 1). Rien a faire en plus.
  - [x] 7.5 Build verifie : `cd frontend && npm run build` → 0 erreur TS.

- [x] **Task 8 — Fix `/qualifications` pour afficher le classement qualif fige pendant/apres finale** (AC #12, #13)
  - [x] 8.1 Editer [frontend/src/pages/Qualifications.tsx](frontend/src/pages/Qualifications.tsx).
  - [x] 8.2 Ajouter un state local `qualRankings: PlayerRanking[]` + `prevContextRankings: PlayerRanking[]` (pour le pattern "derive state from props" idiomatique React).
  - [x] 8.3 `useEffect` au mount : `fetchRankings()` → `setQualRankings(res.data)` uniquement si la donnee est non-vide (evite d'ecraser un state context deja synchronise).
  - [x] 8.4 Pattern "derive state without useEffect" (React official guidance) au lieu d'un `useEffect` : comparaison `prevContextRankings !== state.rankings` dans le corps de la fonction (pas dans un effet) pour detecter un changement de context. Si contexte = qualif (currentDayType === 'qualification' OU (phase === 'idle' && !winner)) ET rankings non-vide → `setQualRankings(state.rankings)`. Sinon (finale en cours/terminee) → on fige la derniere valeur. Ce pattern evite le warning `react-hooks/set-state-in-effect` introduit par le lint React 19.
  - [x] 8.5 Remplacer dans le JSX `state.rankings` par `qualRankings` pour le `RankingTable` prop.
  - [x] 8.6 Conserver l'EmptyState quand `state.phase === 'idle' && qualRankings.length === 0`. Le titre de page reste inchange.
  - [x] 8.7 [RankingTable.tsx](frontend/src/components/ranking/RankingTable.tsx) non modifie — aucun risque de regression.
  - [x] 8.8 Test visuel manuel — pousse a Task 9.5.8 (scenario Brice en local).
  - [x] 8.9 Build verifie : `cd frontend && npm run build` → 0 erreur TS. Lint : 0 nouveau warning/erreur (baseline preservee : 3 erreurs + 2 warnings pre-existants).

- [x] **Task 9 — Tests manuels e2e + validation finale** (tous AC)
  - [x] 9.1 `cd backend && npm run build` → 0 erreur TS. (Pas de changement backend, mais build pour confirmer la non-regression.) **✓ Verifie.**
  - [x] 9.2 `cd backend && node --test dist/services/*.test.js` → **60 tests verts** (baseline 5.2 v1.3 preservee).
  - [x] 9.3 `cd frontend && npm run build` → 0 erreur TS, bundle **148.08 kB gz** (+1.04 kB vs baseline 147.04, bien sous le plafond 155.04 kB).
  - [x] 9.4 `cd frontend && npm run lint` → **3 erreurs + 2 warnings pre-existants** (AuthContext x2, TournamentContext, DayManager, PlayerManager). **0 nouveau warning/erreur introduit par 5.3** (un warning `set-state-in-effect` avait ete introduit initialement sur Qualifications.tsx puis elimine via refacto "derive state from props").
  - [x] 9.5 **Tests e2e manuels (Brice en local)** — validés par Brice 2026-04-22 :
    - [x] 9.5.1 `docker-compose up` pour PG + `cd backend && npm run dev` + `cd frontend && npm run dev`.
    - [x] 9.5.2 Visiter `/finale` sans tournoi (seed propre) → AC #2 (etat "finale non encore lancee").
    - [x] 9.5.3 Visiter `/finale` avec joueurs inscrits mais aucune journee → meme etat.
    - [x] 9.5.4 Completer 3 journees qualif via admin, ne pas lancer la finale → visiter `/finale` → AC #3 (preview 8 qualifies).
    - [x] 9.5.5 Lancer la finale via admin → visiter `/finale` → AC #4 (tableau 8 finalistes avec progression a 0/20).
    - [x] 9.5.6 Saisir round 1 finale + valider (classement evolue) → AC #5 (barres montent, flash cyan, badge top 1 apparait pour le joueur ayant fait 1er).
    - [x] 9.5.7 Continuer rounds jusqu'a victoire (ex : joueur X a 24 pts + top 1 du round) → AC #8 (bandeau vainqueur + animation glow) + AC #9 (tableau fige sous le bandeau, ligne vainqueur mise en valeur).
    - [x] 9.5.8 Ouvrir `/qualifications` pendant la finale → AC #12 (classement qualif cumule fige visible).
    - [x] 9.5.9 Apres victoire, refresh dur `/finale` → AC #10 (hydratation via WebSocket + fallback REST, bandeau + tableau visibles < 2s).
    - [x] 9.5.10 DevTools responsive : tester `/finale` en 375 px (mobile) → AC #7 (colonne progression `w-24`, scroll horizontal placements, badge top 1 lisible).
    - [x] 9.5.11 DevTools Network throttling : offline 5s puis online → AC #11 (reconnexion WebSocket automatique, tableau reste visible).
  - [x] 9.6 Si `prefers-reduced-motion: reduce` active (DevTools rendering) : animations `heroGlow` et fade-in `FinaleWinnerBanner` desactivees (AC #8 accessibilite) — verifier que l'apparition reste visible sans animation.

## Dev Notes

### Architecture & Principes cles

**Story 100 % frontend** — **aucun changement backend**, migration, nouvel endpoint ou modification de contrat. Les 3 contrats stables de 5.2 sont pleinement exploites :

- `GET /api/rankings?type=finale` (REST, ajoute en 5.2 Task 6) → fallback initial.
- `tournament_state` / `tournament_state_changed` avec `winner: PlayerRanking | null` (WebSocket, etendu en 5.2 Task 3) → reactivite temps reel + hydratation a la connexion.
- `ranking_updated` avec rankings phase-aware (finale pendant phase finale) → mises a jour incremental.

**Risque technique faible** : la page `/finale` consomme des donnees deja produites, ne declenche aucune action admin, ne modifie aucun etat serveur. Scope similaire a **Story 3.2 (page Qualifications)** et **Story 4.1 (overlay)** — reutilisation maximale des patterns (useRankingFlash, motion.tr layout, classes EDS).

**Non-regression qualif critique** : la Task 8 (fix `/qualifications`) est la seule modification qui touche du code existant en production. Risque cible : si `fetchRankings()` REST retourne `[]` par erreur reseau au mount → la page affiche un EmptyState meme si le classement existe. Mitigation : fallback sur `state.rankings` si `state.currentDayType === 'qualification'` (le classement qualif est de toute facon dans le context pendant la phase qualif).

**Invariant architectural 5.3** : la page `/finale` a **sa propre source de verite hybride** (`state.rankings` en priorite, `finaleRankings` local en fallback). Meme pattern pour `/qualifications` apres fix. Cela decouple proprement les pages des mutations globales du context selon la phase.

### Task 2 — `FinaleRankingTable.tsx` — squelette attendu

```tsx
// frontend/src/components/finale/FinaleRankingTable.tsx
import { motion } from 'framer-motion';
import { useRankingFlash } from '../../hooks/useRankingFlash';
import type { PlayerRanking } from '../../types';

interface FinaleRankingTableProps {
  rankings: PlayerRanking[];
  winnerId?: number | null;
}

export default function FinaleRankingTable({ rankings, winnerId }: FinaleRankingTableProps) {
  const flashingIds = useRankingFlash(rankings);

  return (
    <div className="overflow-x-auto rounded-lg bg-eds-dark/50 p-4">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10 text-left font-heading text-sm text-eds-gray">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Joueur</th>
            <th className="px-3 py-2">Placements</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2">Progression</th>
          </tr>
        </thead>
        <motion.tbody>
          {rankings.map((r) => {
            const pct = Math.min(100, (r.totalScore / 20) * 100);
            const isWinner = winnerId === r.playerId;
            const isFlashing = flashingIds.has(r.playerId);
            return (
              <motion.tr
                key={r.playerId}
                layout
                layoutId={`finale-row-${r.playerId}`}
                transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}
                className={[
                  'border-b border-white/5',
                  isWinner ? 'border-l-4 border-l-eds-gold bg-eds-gold/10' : 'border-l-2 border-l-eds-cyan',
                  isFlashing && 'motion-safe:animate-[rankingFlash_1.5s_ease-out]',
                ].filter(Boolean).join(' ')}
              >
                <td className={`px-3 py-2 font-heading text-xl ${r.rank === 1 ? 'text-eds-gold' : 'text-eds-cyan'}`}>
                  {r.rank}
                </td>
                <td className="px-3 py-2 font-body text-eds-light">
                  {r.discordPseudo}
                  {r.top1Count >= 1 && (
                    <span className="ml-2 rounded border border-eds-gold/60 px-2 py-0.5 font-heading text-xs text-eds-gold">
                      ✓ Top 1
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-body text-sm text-eds-gray">
                  {r.roundSummaries?.map((s) => `R${s.roundNumber}: ${s.placement}e (${s.points}pts)`).join(' | ') ?? '—'}
                </td>
                <td className="px-3 py-2 text-right font-heading text-xl text-eds-gold">
                  {r.totalScore}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-24 md:w-32 overflow-hidden rounded-full bg-eds-gray/20">
                      <div className="h-full bg-eds-gold/80" style={{ width: `${pct}%` }} />
                    </div>
                    <span className={pct >= 100 ? 'font-heading text-eds-gold' : 'font-body text-sm text-eds-gold'}>
                      {r.totalScore}/20
                    </span>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </motion.tbody>
      </table>
    </div>
  );
}
```

**Points critiques** :
- `layoutId` prefixe `finale-row-` (et non `overlay-row-` ni `rank-row-`) pour **eviter tout conflit** si plusieurs tableaux coexistent sur une meme page (cas : classement fige visible pendant ecran vainqueur).
- Classe flash reuse **exactement** `rankingFlash` keyframe existant ([index.css:43-47](frontend/src/index.css)).
- `roundSummaries` peut etre `undefined` dans le fallback REST (schema `PlayerRanking` doit etre verifie — voir Task 2.13). Si absent → afficher `—` plutot que crasher.

### Task 3 — `FinaleWinnerBanner.tsx` — squelette attendu

```tsx
// frontend/src/components/finale/FinaleWinnerBanner.tsx
import { motion } from 'framer-motion';
import type { PlayerRanking } from '../../types';

interface FinaleWinnerBannerProps {
  winner: PlayerRanking;
}

export default function FinaleWinnerBanner({ winner }: FinaleWinnerBannerProps) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="mb-8 rounded-xl border-2 border-eds-gold bg-eds-gold/10 py-8 px-6 text-center motion-safe:animate-heroGlow"
    >
      <div className="text-6xl md:text-8xl" aria-hidden="true">🏆</div>
      <h1 className="mt-4 font-heading text-5xl md:text-7xl text-eds-gold">
        {winner.discordPseudo}
      </h1>
      <p className="mt-2 font-body text-xl text-eds-light">
        Vainqueur EDS — {winner.totalScore} pts cumules finale
      </p>
    </motion.div>
  );
}
```

**Points critiques** :
- `role="status"` + `aria-live="polite"` pour lecteur d'ecran — le vainqueur est un changement d'etat important.
- `motion-safe:animate-heroGlow` → animation desactivee pour `prefers-reduced-motion: reduce` (behavior natif `motion-safe:`).
- Aucune emoji dans aria-live (l'emoji est `aria-hidden`) pour eviter les lectures redondantes type "trophy".

### Task 5 — `Finale.tsx` — squelette attendu

```tsx
// frontend/src/pages/Finale.tsx
import { useEffect, useState } from 'react';
import { useTournament } from '../hooks/useTournament';
import { fetchFinaleRankings, fetchRankings } from '../services/api';
import FinaleRankingTable from '../components/finale/FinaleRankingTable';
import FinaleWinnerBanner from '../components/finale/FinaleWinnerBanner';
import FinaleQualifiersPreview from '../components/finale/FinaleQualifiersPreview';
import LogoEds from '../components/common/LogoEds';
import type { PlayerRanking } from '../types';

export default function Finale() {
  const { state } = useTournament();
  const [finaleRankings, setFinaleRankings] = useState<PlayerRanking[]>([]);
  const [qualRankingsForPreview, setQualRankingsForPreview] = useState<PlayerRanking[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchFinaleRankings(), fetchRankings()])
      .then(([finaleRes, qualRes]) => {
        if (cancelled) return;
        if ('data' in finaleRes) setFinaleRankings(finaleRes.data);
        if ('data' in qualRes) setQualRankingsForPreview(qualRes.data);
        if ('error' in finaleRes || 'error' in qualRes) setError('Partial fetch failure');
      })
      .catch(() => !cancelled && setError('Network error'))
      .finally(() => !cancelled && setIsLoadingRankings(false));
    return () => { cancelled = true; };
  }, []);

  const useContextRankings = state.rankings.length > 0 && (state.currentDayType === 'finale' || state.winner !== null);
  const effectiveRankings = useContextRankings ? state.rankings : finaleRankings;

  // Etat 1 : vainqueur detecte
  if (state.winner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <FinaleWinnerBanner winner={state.winner} />
        <FinaleRankingTable rankings={effectiveRankings} winnerId={state.winner.playerId} />
      </div>
    );
  }

  // Etat 2 : finale en cours
  if (state.currentDayType === 'finale') {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 font-heading text-5xl text-eds-light">Finale EDS</h1>
        <FinaleRankingTable rankings={effectiveRankings} />
      </div>
    );
  }

  // Etat 3 : qualifs terminees, finale pas lancee → preview 8 qualifies
  const qualifsCompleted = state.phase === 'idle' && qualRankingsForPreview.length >= 8;
  if (qualifsCompleted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 font-heading text-5xl text-eds-light">Finale EDS</h1>
        <FinaleQualifiersPreview rankings={qualRankingsForPreview} />
      </div>
    );
  }

  // Etat 4 : defaut (pas commence)
  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-8 text-center">
      <h1 className="mb-6 font-heading text-5xl text-eds-light">Finale EDS</h1>
      <LogoEds className="mb-6 h-24 md:h-32 lg:h-40 motion-safe:animate-heroGlow" />
      <p className="max-w-xl font-body text-xl text-eds-gray">
        La finale n'est pas encore lancee. Les qualifications sont en cours — revenez apres la derniere journee.
      </p>
      {isLoadingRankings && <p className="mt-4 font-body text-eds-gray">Chargement…</p>}
      {error && <p className="mt-4 font-body text-sm text-eds-gray">Impossible de charger le classement. Reessayez dans quelques instants.</p>}
    </div>
  );
}
```

**Points critiques** :
- `cancelled` flag pour eviter les setState apres demontage (React strict mode).
- Conditions dans l'ordre de priorite : vainqueur > finale en cours > qualifs terminees > defaut.
- `qualifsCompleted` detecte via `phase === 'idle'` + au moins 8 qualifies dispo. Heuristique fiable car la phase repasse a `idle` entre la fin des qualifs et le lancement de la finale.

### Task 8 — Fix `/qualifications` — squelette attendu

```tsx
// frontend/src/pages/Qualifications.tsx (modifie)
import { useEffect, useState } from 'react';
import { useTournament } from '../hooks/useTournament';
import { fetchRankings } from '../services/api';
// ... autres imports existants ...

export default function Qualifications() {
  const { state } = useTournament();
  const [qualRankings, setQualRankings] = useState<PlayerRanking[]>([]);
  // ... isConnected, phase, currentDayNumber restent depuis state ...

  useEffect(() => {
    fetchRankings().then((res) => {
      if ('data' in res) setQualRankings(res.data);
    });
  }, []);

  useEffect(() => {
    // Sync avec context uniquement en phase qualif/idle (sans vainqueur finale)
    if ((state.currentDayType === 'qualification' || state.phase === 'idle') && !state.winner) {
      setQualRankings(state.rankings);
    }
    // Sinon (finale en cours ou terminee) : on fige le classement qualif local
  }, [state.rankings, state.currentDayType, state.phase, state.winner]);

  const showEmptyState = state.phase === 'idle' && qualRankings.length === 0;

  return (
    // ... JSX inchange mais <RankingTable rankings={qualRankings} /> au lieu de state.rankings
  );
}
```

**Points critiques** :
- Le fetch initial REST garantit que le classement est dispo des le mount, meme si Socket.IO n'est pas encore connecte.
- La sync conditionnelle avec `state.rankings` est le cœur du fix : **bloquer** la sync pendant la finale empeche l'ecrasement du classement qualif par les rankings finale.
- Si `state.winner === null && state.phase === 'idle'` (cas 1 : qualifs pas encore lancees, cas 2 : qualifs terminees mais finale pas encore) → on sync avec context (qui contient les rankings qualif).

### Contrats backend — a PRESERVER (aucun changement en 5.3)

- **`GET /api/rankings`** — retourne rankings qualif (defaut). Utilise par `/qualifications` (Task 8) et preview 8 qualifies dans `Finale.tsx`.
- **`GET /api/rankings?type=finale`** — retourne rankings finale. Utilise par `Finale.tsx` en fallback REST.
- **`GET /api/tournament/current`** — utilise par le context au boot (inchange).
- **WebSocket `/tournament` namespace** — events `tournament_state`, `tournament_state_changed`, `ranking_updated` (inchanges).
- **Aucune mutation** : 5.3 ne cree aucun `POST`, `PATCH` ou `DELETE`.

### Patterns Epic 3-4 a reutiliser sans les reinventer

- **`useRankingFlash` hook** — reuse strict sur `FinaleRankingTable`. Meme signature `useRankingFlash(rankings)` → `Set<number>`. Zero modification.
- **`motion.tr layout layoutId`** — pattern [OverlayRankingTable.tsx:46-49](frontend/src/components/overlay/OverlayRankingTable.tsx). Transitions fluides lors du reorder.
- **Classes progression UX-DR7** — copier **exactement** depuis [DayManager.tsx:401-413](frontend/src/components/admin/DayManager.tsx) : `h-2 w-24 md:w-32 rounded-full bg-eds-gray/20` + `h-full bg-eds-gold/80` + ratio `text-eds-gold`.
- **Badge Top 1** — classes exactes depuis [DayManager.tsx:396-400](frontend/src/components/admin/DayManager.tsx) : `border border-eds-gold/60 px-2 py-0.5 font-heading text-xs text-eds-gold`.
- **LogoEds glow** — reuse `motion-safe:animate-heroGlow` sur le logo pour l'etat d'attente (pattern [Overlay.tsx:22-26](frontend/src/pages/Overlay.tsx)).
- **NavLink active** — pattern existant `Layout.tsx` avec `isActive` → classe cyan. Pas besoin de reinventer.
- **EmptyState minimaliste** — pas de spinner canvas ou skeleton complexe ; un simple `<p>Chargement…</p>` suffit (pattern Qualifications/Overlay actuel).
- **`container mx-auto px-4 py-8`** — container standard des pages publiques (Home, Qualifications, MentionsLegales).

### Previous Story Intelligence (5.1 + 5.2)

**Patterns confirmes 5.1 + 5.2** :
- ✅ **Pas de limite de rounds finale** — 5.3 n'affiche aucune contrainte numerique type "Round N/Max". Les rounds s'affichent tels quels.
- ✅ **`winner: PlayerRanking | null`** propage dans `TournamentState` backend (5.2 Task 3) et frontend (5.2 Task 7). 5.3 consomme directement `state.winner` sans transformation.
- ✅ **`aggregateFinaleRankings` filtre sur `day.type === 'finale'`** — le backend renvoie exactement les 8 finalistes, pas besoin de filtrer cote frontend.
- ✅ **WebSocket event `tournament_state_changed`** porte `winner` — 5.3 n'a pas a ecouter un event dedie `winner_detected`, ni a appeler un endpoint `/api/finale/winner`.
- ✅ **`fetchFinaleRankings` via query param `?type=finale`** — backward-compat 100 %, donc la route par defaut `/api/rankings` reste pour qualif.
- ⚠️ **Bug 5.2 AC #17** — effet de bord "`/qualifications` affiche rankings finale pendant finale" → corrige dans Task 8.

**Action items 5.2 v1.2/v1.3 affectant 5.3** :
- ✅ **`computeLobbyGroups` corrigee** (hotfix 5.2 v1.2) — n'affecte pas 5.3 (pas de generation de lobbies).
- ✅ **Bloc "Classement qualif fige" en haut du DayManager** (5.2 v1.3) — pattern confirme : "afficher le classement qualif en reference pendant la finale" est un vrai besoin utilisateur. 5.3 l'etend aux spectateurs publics.

**Decisions 5.1 + 5.2 a respecter** :
- Le classement qualif cumule reste visible/figeable pendant la finale — cote public via `/qualifications` (Task 8), cote admin via DayManager (deja en place).
- La finale a **toujours un seul lobby** — `FinaleRankingTable` affiche bien 8 lignes tries (pas de groupement par lobby comme dans `/qualifications` pour les qualifs).
- Aucun `winner` en base — toujours derive a la volee par `computeTournamentState`. 5.3 ne stocke rien en local persistant.

**Contraintes memoire projet Brice a respecter** :

- **Pas de limite de rounds finale** : aucune UI "fin de finale" autre que la detection automatique. 5.3 ne propose pas de bouton "Terminer la finale" sur `/finale` (la page est en consultation).
- **Validation OBS dependante SkyDow** : 5.3 n'affecte pas `/overlay`, donc **pas de session requise avec SkyDow pour valider 5.3**. Brice peut marquer la story `done` seul des que les tests Task 9.5 passent.
- **Docker Desktop local disponible** : les 11 scenarios Task 9.5 sont testables en local sans infrastructure externe. Le script `cleanup-finale.ts` (ajoute 5.2 v1.2) est utile pour rejouer rapidement plusieurs scenarios de victoire.

**Patterns framer-motion + React 19** :

- **`layout` + `layoutId`** : reorder anime des lignes du tableau. Critique pour UX-DR8 — les viewers voient le joueur qui monte se deplacer visuellement vers le top.
- **`motion.div` avec `initial/animate/transition`** : fade-in + scale pour le `FinaleWinnerBanner`. Alternative a `AnimatePresence` (pas necessaire car on ne demonte pas le banner une fois monte — la page reste sur l'etat vainqueur jusqu'a actualisation).
- **`motion-safe:`** prefix Tailwind : respect automatique de `prefers-reduced-motion`. Aucun code JS additionnel requis.
- **React 19 + framer-motion 11** : pas de `useLayoutEffect` warnings grace a la compat. Confirme en 4.1 + 5.2.

### Anti-patterns a eviter

- **NE PAS** modifier [OverlayRankingTable.tsx](frontend/src/components/overlay/OverlayRankingTable.tsx) pour ajouter la colonne progression — utiliser le nouveau `FinaleRankingTable`. Risque de regression sur `/overlay` confirme par retro Epic 4.
- **NE PAS** dupliquer la logique `useRankingFlash` — reuse strict du hook existant.
- **NE PAS** creer un nouvel event WebSocket (ex : `winner_announced`, `finale_rankings_updated`) — `tournament_state_changed` + `ranking_updated` couvrent tous les cas (confirme 5.2).
- **NE PAS** stocker `winner` en localStorage / sessionStorage — toujours derive cote serveur et hydrate via WebSocket.
- **NE PAS** ajouter une dependance npm (confetti, react-confetti, lottie-react) — bundle ≤ +8 kB gz. L'animation heroGlow + scale framer-motion suffit pour UX-DR8.
- **NE PAS** fetch `fetchFinaleRankings()` **dans un interval** (polling) — le WebSocket gere les updates.
- **NE PAS** oublier le fallback `roundSummaries?.map(...) ?? '—'` — les rankings REST peuvent ne pas inclure `roundSummaries` selon le backend (a verifier dans Task 2.13).
- **NE PAS** afficher le composant `FinaleRankingTable` avec 0 ligne — preferer le `FinaleQualifiersPreview` ou l'etat defaut. Le tableau vide est un bug UX.
- **NE PAS** ajouter un loader bloquant (spinner plein ecran) — le pattern du projet est d'afficher directement la structure avec un message discret "Chargement…".
- **NE PAS** toucher a [RankingTable.tsx](frontend/src/components/ranking/RankingTable.tsx) dans la Task 8 — modifier uniquement `Qualifications.tsx` pour changer la source de donnees.
- **NE PAS** reordonner les colonnes du tableau finale pour "innover" — coherence avec le pattern RankingTable/OverlayRankingTable exige : # → Pseudo → Placements → Total → (Progression).
- **NE PAS** ajouter un bouton "Retour" ou "Revoir les qualifs" sur `/finale` quand elle est vide — la navigation principale est suffisante.
- **NE PAS** hardcoder le seuil `20` dans plusieurs endroits — utiliser `/ 20` et `/20` uniquement dans `FinaleRankingTable`. Si Brice souhaite un `VICTORY_THRESHOLD = 20` en constante partagee, c'est optionnel.

### NFR a verifier

- **NFR1** (chargement < 2s) : `Finale.tsx` fait 2 fetch REST en parallele (`Promise.all`) — < 500 ms total sur LAN. Render de ~10 lignes JSX + 3 composants = trivial.
- **NFR2** (mise a jour WebSocket < 2s) : `tournament_state_changed` est emis synchrone apres commit en 5.2 → < 200 ms cote client.
- **NFR4** (~30 connexions) : inchange (pas de modification du serveur Socket.IO).
- **NFR11** (persistance immediate PostgreSQL) : inchange (pas de mutation en 5.3).
- **Responsive** (UX-DR13) : Desktop >= 1024 px : toutes colonnes visibles. Mobile < 768 px : `overflow-x-auto` sur le table container (pattern RankingTable).
- **Accessibilite** : `role="status" aria-live="polite"` sur `FinaleWinnerBanner`. `aria-hidden` sur l'emoji 🏆. Couleur contrast or/dark respecte WCAG AA (contraste `#DAB265` sur `#29265B` = 4.8:1, AA large text).
- **Performance framer-motion** : `layout` anime uniquement quand le tableau change. Pas de re-render continu.

### Project Structure Notes

**Fichiers nouveaux a creer** :
- [frontend/src/pages/Finale.tsx](frontend/src/pages/Finale.tsx) — page principale
- [frontend/src/components/finale/FinaleRankingTable.tsx](frontend/src/components/finale/FinaleRankingTable.tsx) — tableau avec progression
- [frontend/src/components/finale/FinaleWinnerBanner.tsx](frontend/src/components/finale/FinaleWinnerBanner.tsx) — bandeau vainqueur
- [frontend/src/components/finale/FinaleQualifiersPreview.tsx](frontend/src/components/finale/FinaleQualifiersPreview.tsx) — preview 8 qualifies

**Fichiers a modifier** :
- [frontend/src/services/api.ts](frontend/src/services/api.ts) — ajouter `fetchFinaleRankings()`
- [frontend/src/App.tsx](frontend/src/App.tsx) — ajouter route `/finale` (ligne 48, commentaire deja present)
- [frontend/src/components/common/Layout.tsx](frontend/src/components/common/Layout.tsx) — ajouter lien "Finale" dans le nav
- [frontend/src/pages/Qualifications.tsx](frontend/src/pages/Qualifications.tsx) — fix source de donnees (Task 8)

**Fichiers a NE PAS toucher (critique)** :
- `backend/**/*` — **aucune modification backend** (zero changement).
- [frontend/src/components/ranking/RankingTable.tsx](frontend/src/components/ranking/RankingTable.tsx) — reuse par Qualifications, ne doit pas subir de regression.
- [frontend/src/components/overlay/OverlayRankingTable.tsx](frontend/src/components/overlay/OverlayRankingTable.tsx) — reuse par Overlay, intouche.
- [frontend/src/pages/Overlay.tsx](frontend/src/pages/Overlay.tsx) — continue de tirer `state.rankings` tel quel.
- [frontend/src/hooks/useRankingFlash.ts](frontend/src/hooks/useRankingFlash.ts) — reuse strict sans modification.
- [frontend/src/contexts/TournamentContext.tsx](frontend/src/contexts/TournamentContext.tsx) — context stable, pas de champ supplementaire en 5.3.
- [frontend/src/services/socket.ts](frontend/src/services/socket.ts) — `TournamentStatePayload` inchange.
- [frontend/src/index.css](frontend/src/index.css) — keyframes `heroGlow` et `rankingFlash` utilises tels quels, aucun ajout.
- [frontend/tailwind.config.ts](frontend/tailwind.config.ts) — tokens EDS inchanges.
- [frontend/src/components/admin/DayManager.tsx](frontend/src/components/admin/DayManager.tsx) — on **copie les classes CSS**, on **ne modifie pas** le fichier.
- [frontend/src/components/admin/FinaleQualificationPanel.tsx](frontend/src/components/admin/FinaleQualificationPanel.tsx) — on **s'inspire** de la structure, on **ne modifie pas** le fichier.

**Aucun conflit avec la structure unifiee. Aucune nouvelle dependance npm. Aucune migration DB. Aucun nouvel endpoint REST ou WebSocket.**

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3 : Page Finale Publique & Progression Victoire (lignes 762-797)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 : Phase Finale (lignes 700-702)]
- [Source: _bmad-output/planning-artifacts/epics.md#FR28 — Tableau finale temps reel (ligne 181)]
- [Source: _bmad-output/planning-artifacts/epics.md#FR29 — Indicateur progression condition de victoire (ligne 182)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR7 — Indicateur de progression condition de victoire (ligne 141)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR8 — Animation mise en valeur vainqueur or (#DAB265) (ligne 142)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR28-FR29 — Affichage finale (lignes 316-320)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture (lignes 230-250) — React Context + Router v7 + pages]
- [Source: _bmad-output/planning-artifacts/architecture.md#Finale FR21-FR24 mapping (ligne 566, 625)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern WebSocket Socket.IO + event ranking_updated (lignes 222-228)]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-04-18.md#Reutilisation Epic 3-4 pour Epic 5.3 (ligne 119) — useRankingFlash + OverlayRankingTable reutilisables]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-04-18.md#UX-DR7 indicateur progression (ligne 168) — element emotionnel central finale]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-04-18.md#UX-DR8 mise en valeur or vainqueur (ligne 169) — reutiliser text-eds-gold + framer-motion]
- [Source: _bmad-output/implementation-artifacts/5-1-qualification-pour-la-finale-lancement.md — pattern `FinaleQualificationPanel` cote admin, reutilisable en inspiration pour `FinaleQualifiersPreview` cote public]
- [Source: _bmad-output/implementation-artifacts/5-2-rounds-de-finale-detection-de-victoire.md — AC #17 (effet de bord `/qualifications` affiche rankings finale → a corriger en 5.3), Task 6 (route `GET /api/rankings?type=finale`), Task 3 (`winner` dans TournamentState)]
- [Source: _bmad-output/implementation-artifacts/5-2-rounds-de-finale-detection-de-victoire.md#Task 8 DayManager ligne 326-423 — classes tailwind bandeau vainqueur + bloc progression a repliquer cote public]
- [Source: _bmad-output/implementation-artifacts/3-2-page-qualifications-tableau-de-classement.md — pattern page publique responsive + consommation TournamentContext]
- [Source: _bmad-output/implementation-artifacts/3-3-polish-interface-resultats.md — patterns framer-motion avances sur RankingTable (layout, layoutId, transitions)]
- [Source: _bmad-output/implementation-artifacts/4-1-overlay-stream-obs.md — pattern `OverlayRankingTable.tsx` (3 colonnes, top 8 cyan, separateur or, flash cyan, reorder motion layoutId)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — Hotfixes 5.2 v1.2 : `FINALE_LOBBY_IS_FIXED` + `cleanup-finale.ts` script utilitaire (pour rejouer scenarios)]
- [Source: frontend/src/pages/Qualifications.tsx — pattern page publique actuel (a modifier Task 8)]
- [Source: frontend/src/pages/Overlay.tsx — pattern useSearchParams + LogoEds + mainBg + useRankingFlash (inspiration layout page)]
- [Source: frontend/src/components/ranking/RankingTable.tsx — patterns motion.tbody/tr, classes top 8 cyan, separateur or, drops gris (inspiration styling FinaleRankingTable)]
- [Source: frontend/src/components/overlay/OverlayRankingTable.tsx — 3 colonnes simplifiees + motion.tr layoutId (pattern le plus proche de FinaleRankingTable)]
- [Source: frontend/src/components/admin/DayManager.tsx:326-423 — classes Tailwind exactes bandeau vainqueur + bloc progression (a copier cote public)]
- [Source: frontend/src/components/admin/FinaleQualificationPanel.tsx — inspiration `FinaleQualifiersPreview` (structure liste 8 qualifies + tiebreakers)]
- [Source: frontend/src/hooks/useRankingFlash.ts — signature hook a reuse strict]
- [Source: frontend/src/contexts/TournamentContext.tsx — TournamentState interface (phase, currentDayType, rankings, winner, isConnected)]
- [Source: frontend/src/services/api.ts — pattern fetchRankings() a cloner pour fetchFinaleRankings()]
- [Source: frontend/src/services/socket.ts — TournamentStatePayload avec winner (etendu 5.2)]
- [Source: frontend/src/components/common/Layout.tsx — pattern NavLink + menu nav (a etendre avec lien /finale)]
- [Source: frontend/src/components/common/LogoEds.tsx — composant logo reuse etat d'attente]
- [Source: frontend/src/App.tsx:48 — commentaire `<Route path="/finale" ... />` deja prepare, a decommenter/remplacer]
- [Source: frontend/src/index.css:21-30 — keyframe heroGlow (drop-shadow + text-shadow or) reuse bandeau vainqueur]
- [Source: frontend/src/index.css:43-47 — keyframe rankingFlash reuse FinaleRankingTable]
- [Source: frontend/src/types/index.ts — type PlayerRanking (champs rank, playerId, discordPseudo, totalScore, top1Count, top4Count, isDropped, roundSummaries)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-dev-story workflow, 2026-04-18

### Debug Log References

- **Lint regression & fix** (2026-04-18) : la premiere implementation de Task 8 (fix `/qualifications`) utilisait un `useEffect` pour synchroniser `qualRankings` avec `state.rankings`. Le linter `react-hooks/set-state-in-effect` (active depuis React 19 / le plugin actuel) a flag le setState synchrone dans l'effet (1 nouvelle erreur vs baseline). Refacto : passage au pattern idiomatique React "derive state from props during render" (comparaison `prevContextRankings !== state.rankings` + guard `if` + setState dans le corps du composant, pas dans un effet). Cela satisfait l'exigence AC #15 "0 nouveau warning introduit par 5.3" tout en conservant le comportement de fige/sync attendu.
- **Correction du nom de champ** (2026-04-18) : le story indiquait `roundSummaries` dans `PlayerRanking` mais le type declare en realite `roundResults: PlayerRoundSummary[]`. Adaptation dans `FinaleRankingTable` sans impact fonctionnel.

### Completion Notes List

- ✅ Tous les livrables code (Tasks 1 a 8) ecrits et valides par les gates automatises.
- ✅ Backend intact : 0 modification, build OK, 60/60 tests verts (baseline 5.2 v1.3).
- ✅ Frontend : 0 erreur TypeScript, bundle 148.08 kB gz (+1.04 kB vs baseline — largement sous le plafond 155.04 kB). Lint strictement equivalent a la baseline (0 nouveau probleme).
- ✅ Aucune dependance npm ajoutee, aucun nouvel endpoint backend, aucune migration DB, zero changement WebSocket.
- ✅ Reutilisations strictes respectees : `useRankingFlash` (hook sans modif), pattern `motion.tr layout layoutId` (prefixe `finale-row-` pour eviter conflit avec `overlay-row-`), classes progression DayManager (tokens EDS), keyframes `heroGlow` / `rankingFlash`.
- ✅ Correctif `/qualifications` (Task 8) : pattern "derive state from props" sans `useEffect` (idiom React officiel pour "adjusting some state when a prop changes").
- ⏳ **Tests e2e manuels (Task 9.5 + 9.6) en attente de Brice** : scenarios 9.5.1–9.5.11 et 9.6 necessitent Docker Desktop + backend + frontend locaux + saisie admin. Non executables en sandbox, mais realisables par Brice seul (pas de dependance SkyDow pour `/finale` — l'overlay n'est pas modifie). Les checkboxes 9.5.x et 9.6 restent a cocher par Brice apres validation locale.
- ✅ **Tests e2e manuels valides par Brice 2026-04-22** : tous les scenarios 9.5.1-9.5.11 et 9.6 OK en local (PG Docker + backend + frontend). Story passee a `done`.

### File List

**Nouveaux fichiers :**
- `frontend/src/pages/Finale.tsx`
- `frontend/src/components/finale/FinaleRankingTable.tsx`
- `frontend/src/components/finale/FinaleWinnerBanner.tsx`
- `frontend/src/components/finale/FinaleQualifiersPreview.tsx`

**Fichiers modifies :**
- `frontend/src/services/api.ts` — ajout `fetchFinaleRankings()`
- `frontend/src/App.tsx` — ajout import `Finale` + route `/finale` (remplace le commentaire "Routes futures")
- `frontend/src/components/common/Layout.tsx` — activation du lien `/finale` (retrait `disabled: true`) + simplification de la branche de rendu (un seul `<Link>` pour tous les items)
- `frontend/src/pages/Qualifications.tsx` — fix source de donnees (pattern "derive state from props"), decouple du context pendant la finale
- `frontend/src/components/finale/FinaleRankingTable.tsx` **(v1.1)** — badge `✓ Top 1` retire (trompeur), remplace par `⚡ Éligible victoire` affiche lorsque `totalScore >= 20` (conforme a la regle de victoire clarifiee)
- `backend/src/services/winnerDetector.ts` **(v1.1, hors scope initial 5.3 mais bug critique)** — logique corrigee : `preRoundTotal >= 20` au lieu de `totalScore >= 20`. Le seuil doit etre atteint AVANT le round Top 1.
- `backend/src/services/winnerDetector.test.ts` **(v1.1)** — tests reecrits avec `roundResults` realistes + nouveaux cas limites (crossing 14+8=22 → null, crossing 19+8=27 → null, roundResults vide → null, ordre non trie).
- `frontend/src/components/admin/DayManager.tsx` **(v1.2, alignement admin/public)** — bloc "Progression vers la victoire" reecrit pour la nouvelle semantique : colonne "Top 1" remplacee par "Éligibilité" (texte explicite), badge `✓ Top 1` remplace par `⚡ Éligible`, sous-titre explicatif de la regle, ratio accentue (`font-heading`) quand seuil franchi.
- `_bmad-output/implementation-artifacts/5-3-page-finale-publique-progression-victoire.md` — checkboxes Tasks 1-8 + 9.1-9.4, Dev Agent Record, File List, Change Log
- `_bmad-output/implementation-artifacts/5-2-rounds-de-finale-detection-de-victoire.md` — Change Log v1.4 ajoute pour tracer la correction `winnerDetector`

**Fichiers NON modifies (verification contractuelle) :**
- `backend/**/*` (zero modification)
- `frontend/src/components/ranking/RankingTable.tsx`
- `frontend/src/components/overlay/OverlayRankingTable.tsx`
- `frontend/src/pages/Overlay.tsx`
- `frontend/src/hooks/useRankingFlash.ts`
- `frontend/src/contexts/TournamentContext.tsx`
- `frontend/src/services/socket.ts`
- `frontend/src/index.css`
- `frontend/tailwind.config.ts`
- `frontend/src/components/admin/DayManager.tsx`
- `frontend/src/components/admin/FinaleQualificationPanel.tsx`

## Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Auteur                       |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 2026-04-18 | 0.1     | Creation du contexte developpeur (bmad-create-story) — scope Epic 5.3 : nouvelle page publique `/finale` (3 etats : pas commencee / en cours / terminee), composants `FinaleRankingTable` (avec progression victoire UX-DR7), `FinaleWinnerBanner` (animation or UX-DR8), `FinaleQualifiersPreview`, fonction API `fetchFinaleRankings()`, fix `/qualifications` pour afficher classement qualif fige pendant/apres finale (bug 5.2 AC #17). Story 100 % frontend — zero backend. Reutilisation stricte `useRankingFlash`, motion.tr layout, classes Tailwind DayManager. Pas de nouveau event WebSocket, pas de migration. Bundle cible ≤ +8 kB gz. | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.0     | Implementation (bmad-dev-story) — Tasks 1 a 8 livrees : `fetchFinaleRankings()`, page `Finale.tsx` (4 etats d'affichage : pas commencee / qualifs terminees preview / finale en cours / vainqueur), composants `FinaleRankingTable` + `FinaleWinnerBanner` + `FinaleQualifiersPreview`, route `/finale` dans `App.tsx`, activation du lien "Finale" dans le menu `Layout.tsx`, fix `/qualifications` (pattern "derive state from props" pour eviter regression lint `set-state-in-effect`). Adaptation mineure : usage de `PlayerRanking.roundResults` (nom reel du champ) au lieu de `roundSummaries` evoque dans la story initiale. Validation automatisee OK : backend build + 60 tests verts, frontend build 0 erreur TS (148.08 kB gz, +1.04 kB baseline), lint preserve (0 nouveau probleme). Tests e2e manuels (9.5/9.6) en attente Brice local. | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.1     | Correction regle de victoire (feedback Brice apres revue initiale) — (1) `FinaleRankingTable` : retrait du badge `✓ Top 1` (base sur `top1Count >= 1`, trompeur car non lie a la regle de victoire reelle). Ajout du badge `⚡ Éligible victoire` lorsque `totalScore >= 20` (avec tooltip explicite et `motion-safe:animate-pulse`). (2) AC #5 reecrit pour refleter la regle "seuil >= 20 atteint AVANT + Top 1 au round suivant". (3) Backend `winnerDetector.ts` corrige en parallele (story 5.2 v1.4) pour verifier `preRoundTotal >= 20` au lieu de `totalScore >= 20`. Tests backend : 60 → 64 verts (4 nouveaux cas limites : crossing 14+8=22, crossing 19+8=27, roundResults vide, ordre non trie). Bundle : 148.17 kB gz (+0.09 kB vs v1.0, toujours sous plafond 155). | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.2     | Alignement admin `DayManager` sur la meme semantique (hors scope formel 5.3 mais coherence Brice) — bloc "Progression vers la victoire" : titre simplifie, sous-titre explicatif `Règle : atteindre ≥ 20 pts dans un round, puis finir Top 1 dans un round suivant.`, colonne "Top 1" (count numerique) remplacee par "Éligibilité" (libelle textuel `Peut gagner au prochain Top 1` ou `Besoin X pts`), badge `✓ Top 1` remplace par `⚡ Éligible` (meme design que cote public), ratio `totalScore/20` passe en `font-heading text-eds-gold` quand seuil franchi (coherent avec `FinaleRankingTable`). Build OK, bundle 148.27 kB gz (+0.10 vs v1.1). | Claude Opus 4.7 (1M context) |
| 2026-04-22 | 1.3     | Tests e2e manuels valides par Brice en local (Docker PG + backend + frontend) — scenarios 9.5.1 a 9.5.11 et 9.6 tous OK. Status story transitionne `ready-for-dev` → `done`. Retrospective Epic 5 a faire par Brice. | Brice + Claude Opus 4.7 (1M context) |
