## Deferred from: code review 1-2-page-de-presentation-du-tournoi (2026-04-15)

- Mobile Nav Menu potentiellement à l'étroit sur très petits écrans, envisager un menu hamburger plus tard [frontend/src/components/common/Layout.tsx:20]

## Deferred from: code review of 1-4-mentions-legales-rgpd (2026-04-16)

- Sécurité: adresse email en clair sans protection anti-spam [frontend/src/pages/MentionsLegales.tsx:L19]

## Deferred from: code review of 2-2-gestion-des-joueurs-inscrits (2026-04-16)

- Récupération de tous les joueurs sans pagination (backend/src/routes/admin.ts:12). Acceptable pour 32 joueurs (PRD), mais à optimiser si l'échelle augmente.

## Deferred from: code review of story-3-1-websocket-infrastructure-temps-reel (2026-04-17)

- Scalabilité: Architecture multi-process (Redis Adapter) non implémentée. Acceptable pour la charge attendue (~30 clients) mais nécessaire pour une montée en charge multi-instances.

## Hotfix during 5-2 review (2026-04-18) — appliqué

- **Fixed**: `computeLobbyGroups` (backend/src/routes/tournament.ts:18-58) générait des lobbies aléatoires à **chaque round 1 de chaque journée** au lieu de J1R1 uniquement, et le tri Swiss filtrait sur la journée en cours (`dayId`) au lieu du cumul multi-journées. Régle métier corrigée : **J1R1 = aléatoire** (`generateRandomLobbies`) ; **tous les autres rounds (J1R2+, J2R1+, J3R1+) = Swiss sur classement cumulé qualif** via `aggregateQualificationRankings(prisma)`. Bug provenant des stories 2-3 / 2-5 (Epic 2). 60 tests backend toujours verts.
- **Fixed (suite)** : `POST /generate-lobbies` et `POST /regenerate-lobbies` (tournament.ts) ne refusaient pas la phase finale → le clic "Regenerer les lobbies" en finale supprimait le lobby unique des 8 finalistes et recréait des lobbies Swiss depuis tous les ~32 inscrits. Garde `FINALE_LOBBY_IS_FIXED` (400) ajoutée sur les deux endpoints. Frontend : bouton "Regenerer les lobbies" masqué en finale via `day?.type !== 'finale'` dans DayManager.tsx. Bug latent reconnu en Story 5.2 (Anti-patterns / défense en profondeur déclarée optionnelle) ; promu obligatoire suite incident Brice 2026-04-18.
- **Tool added** : `backend/src/scripts/cleanup-finale.ts` — script de reset d'une finale corrompue. Supprime la `Day type='finale'` actuelle + cascade manuelle (LobbyPlayer → Lobby → Round → Day) en transaction atomique. Usage : `cd backend && npm run build && node dist/scripts/cleanup-finale.js`. Documenté dans `README.md` (section Scripts utilitaires).

## Enhancement 2026-04-18 — Zone dangereuse admin UI

- Ajout en bas de la page Joueurs (PlayerManager) d'une zone dangereuse avec 3 boutons : **Réinitialiser la finale** (équivalent UI du script `cleanup-finale`), **Réinitialiser les qualifications** (supprime toutes les Days qualifs+finale), **Réinitialiser les joueurs** (reset complet). 3 endpoints `DELETE /api/admin/reset/{finale,qualifications,players}` protégés JWT, cascade atomique (LobbyPlayer → Lobby → Round → Day → Player selon scope), émission `tournament_state_changed` post-commit. Le script CLI `cleanup-finale` reste disponible en fallback. Documenté dans story 2-2 (section Post-done) et README.md.

## Deferred from: code review of 6-1-deploiement-backend-docker-traefik (2026-04-24)

- **Test de restauration backup PG en local Docker Desktop** (review item #1, severity Med) — la procédure de restore est documentée dans `README.md` Runbook mais n'a pas été exécutée end-to-end. Acceptable au moment de clôturer 6.1 (DB ne contient que l'admin seedé, peu d'enjeu). À exécuter pendant la **Story 6.3 (dry-run)** avec un dump réel contenant joueurs + scores, pour valider à 100% la chaîne backup→restore avant le tournoi live.

## Adressed during Story 6.3 dry-run prep (2026-04-25)

- ✅ **Validation OBS overlay par SkyDow** (deferred Epic 4, silencieux depuis Story 4.1 / 4 epics) — **CLOS 2026-04-25** : session test live Brice + SkyDow apres deploy Story 6.3 v1.2 (ajout `/overlay/finale`) + v1.3 (alignement `/overlay` qualif sur `/qualifications`). Mini-scenario complet (qualif → finale → vainqueur → restart backend). Les 9 checks AC #10 (a-i) sont passes : pas de chrome, format 16:9, polices lisibles, charte EDS, top 8 distingue, drops barres/grises, animation or vainqueur (UX-DR8), update <2s (NFR2), reconnexion auto Socket.IO apres restart backend (story 4.1 AC #5 + 3.1 AC #4). Sign-off ecrit formel + 2+ captures restent a joindre au rapport final dry-run, mais la **lacune technique est resolue**. Trace : Story 6.3 Change Log v1.2 + v1.3 + v1.4 + v1.5, commits `21ea12b` + `0792bea`.

- ⏳ **Test de restauration backup PG en local Docker Desktop** (review 6.1 item #1) — toujours en cours, sera clos par AC #9 / Task 9 Story 6.3 pendant le dry-run reel avec un dump non-vide.

- ⏳ **Lighthouse mobile `/finale`** (deferred Epic 5 retro) — toujours en cours, sera clos par AC #2 / Task 2 Story 6.3 (audit a faire pre-dry-run, cible Performance >= 75).
