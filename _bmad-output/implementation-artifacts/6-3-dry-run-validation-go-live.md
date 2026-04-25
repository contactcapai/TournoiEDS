# Story 6.3 : Dry-Run & Validation Go-Live

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **admin (Brice) et caster (SkyDow)**,
I want **derouler un dry-run complet du tournoi en production sur la stack 4-services deployee (Stories 6.1 + 6.2), inscrire-jouer-saisir-classer-finaliser-overlay-stream de bout en bout, valider le backup/restore avec donnees reelles, puis remettre la production a zero pour le 17 mai**,
so that **le site est confirme go-live, le runbook du jour J est ecrit a partir d'une execution vecue (pas theorique), les bugs latents non couverts par les tests unitaires sont detectes au moins 1 semaine avant le tournoi, et SkyDow a valide visuellement l'overlay OBS dans les conditions reelles du stream EDS**.

## Contexte de la story

**Troisieme et derniere story d'Epic 6** — pivot de nouveau : 6.1 etait infra ops (VPS + Docker + Traefik), 6.2 etait packaging (container nginx), **6.3 est validation operationnelle**. **Aucune ligne de code applicatif n'est ecrite ici** (le code est fige depuis Epic 5, frontend et backend deployes en prod). Le livrable de cette story est un **dry-run execute, un rapport de dry-run, un runbook jour J, un test de restoration backup, et un sign-off Go/No-Go pour le 2026-05-17**.

**Etat actuel de l'infra (au 2026-04-25, fin de Story 6.2)** :

- Stack 4-services Docker tournant 24/7 sur VPS Hostinger `76.13.58.249` (Ubuntu 24.04.4 LTS, Docker 29.4.1, Compose v5.1.3, Traefik v3, PostgreSQL 17-alpine, Node 22-alpine, nginx 1.27-alpine).
- Backend `https://api-tournoi.esportdessacres.fr` operationnel (cert LE prod R13, valide jusqu'au 2026-07-24, healthcheck `/api/health` healthy).
- Frontend `https://tournoi.esportdessacres.fr` operationnel (cert LE prod R13, valide jusqu'au 2026-07-24, container `tournoi-tft-frontend` healthy, fallback SPA OK sur `/`, `/qualifications`, `/finale`, `/mentions-legales`, `/admin/login`, `/admin`, `/overlay`).
- Smoke test 8/8 OK le 2026-04-25 (5 backend + 3 frontend, cf. [docker/smoke-test.sh](docker/smoke-test.sh)).
- DB `tournoi_tft` PG 17 contenant uniquement le seed admin (`username: admin`, password = `ADMIN_DEFAULT_PASSWORD` du `backend/.env.prod`). **Aucun joueur, aucune Day, aucun Round, aucun score** — DB vierge applicative.
- Reset endpoints disponibles : `DELETE /api/admin/reset/{finale,qualifications,players}` (JWT protected, transactions atomiques cascade `LobbyPlayer → Lobby → Round → Day → Player`, emission `tournament_state_changed` post-commit). **Cles** pour cycler entre dry-run et reset prod le J-7.

**Echeances calendaires fermes** :

| Date | Jalon | Source |
|---|---|---|
| **2026-05-10** | Date butoir dry-run (laisse min. 1 semaine de marge avant J) | epics.md AC #6 Story 6.3 + retro Epic 5 |
| **2026-05-17** | Tournoi live EDS (jour J) | retro Epic 5 + product-brief |
| **2026-04-25** | Aujourd'hui — debut de la story 6.3 | sprint-status.yaml |

**Marge utile** : ~15 jours pour planifier + executer + corriger. **Budget realiste** : prep 2-3 jours, dry-run 1 session de 4-6h avec SkyDow, fix eventuels 2-3 jours, runbook + sign-off 1 jour. **Slack** : ~7 jours en cas de bug majeur.

**Decisions structurantes pour cette story** :

1. **Scope dry-run reduit mais representatif** — pas besoin de simuler 32 joueurs reels (impossible coordonner tant de monde sur un dry-run). Cible : **12-16 joueurs** (Brice + 1-2 amis de confiance facultatifs + dummies cree via admin "Ajouter un joueur"), **2 journees de qualification** (3 rounds chacune via systeme suisse + fin manuelle, cf. memoire `pas de limite de rounds`), **1 finale** (3-5 rounds jusqu'a victoire). Cela couvre tous les chemins critiques : J1R1 random + J1R2+/J2R1+ Swiss multi-journees (bug retro Epic 5), drops, cumul classement, transition qualif→finale, detection victoire (regle `preRoundTotal >= 20` retro Epic 5 v1.4), reset entre runs.

2. **Validation OBS dependante de SkyDow — bloquante ici** — la memoire projet trace que `/overlay` n'a jamais ete valide en conditions reelles dans OBS depuis Epic 4 (deferred). C'est **maintenant** le moment, group avec dry-run (decision retro Epic 4 + Epic 5). Sans SkyDow OK, AC #5 reste KO et la story ne peut pas etre `done`. Premiere action : caler une session SkyDow ferme avant 2026-05-10.

3. **Backup/restore avec donnees reelles** — Story 6.1 review #1 (severity Med) trace que la procedure de restore est documentee dans `README.md` Runbook mais **n'a pas ete executee end-to-end avec un dump non-vide**. Le dry-run cree precisement les donnees necessaires (joueurs + scores + rounds + finale). AC #9 fait du test restore en local Docker Desktop **un livrable obligatoire** (pas un nice-to-have).

4. **Reset prod entre dry-run et J-7** — apres dry-run reussi, la DB prod contient ~16 joueurs dummy + ~2 journees de scores fictifs. **Inacceptable** au demarrage du 2026-05-17. AC #11 force un reset total via `DELETE /api/admin/reset/players` (cascade complete, garde admin et schema), suivi d'un `pg_dump` post-reset pour confirmer l'etat propre. **Defense in Depth** : reset depuis l'UI ET verification par requete SQL directe + smoke test.

5. **Runbook jour J ecrit a partir du vecu** — pas un doc theorique. Chaque etape du dry-run est chronometree, chaque erreur consignee, chaque commande executee notee. Le runbook final = la sequence reelle du dry-run, avec les annotations "ce qui a marche", "ce qui m'a surpris", "ce qu'il faut surveiller". Stocke dans `_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md` (fichier dedie reference par cette story + README.md).

6. **Lighthouse mobile `/finale`** — deferred Epic 5 retro (priorite Moyenne, owner Brice, deadline avant dry-run). Cible : Performance mobile >= 75 (alignement avec audit Epic 3 sur `/qualifications`). C'est un pre-requis dry-run, pas un livrable du dry-run lui-meme — AC #2.

7. **Pas de modification de code applicatif** — frontend et backend sont figes depuis Epic 5 (revue 6.1 + 6.2 APPROVED). Si le dry-run revele un bug bloquant (probabilite faible mais non nulle, cf. Epic 5 retro 3 bugs latents), la procedure est : (a) creer une story de hotfix ad-hoc 6.3.1, (b) revue rapide, (c) deploiement, (d) re-derouler les ACs impactes. **Pas** de "fix sauvage en cours de dry-run" — ca casserait la tracabilite.

**Perimetre clair (DANS 6.3)** :

1. **Pre-flight (J-1 dry-run)** — verifier health stack 4-services (smoke test 8/8 OK), executer audit Lighthouse mobile sur `/finale` (cible >=75 Performance), preparer une session SkyDow caleer ferme dans la fenetre <=2026-05-10, briefer SkyDow sur les commandes (`/overlay`, structure du tournoi simule), preparer la liste des dummies a inscrire (12-16 pseudos credibles).

2. **Backup baseline AVANT dry-run** — dump `tournoi-pre-dryrun-YYYYMMDD.sql.gz` via [docker/backup-pg.sh](docker/backup-pg.sh) sur le VPS, pour pouvoir revenir a l'etat "DB vierge + admin seede" si le dry-run derape sans reset propre. Ce dump doit etre **non vide** (verifier `ls -lh`) et stocke dans `/root/backups/`.

3. **Reset DB pre-dry-run** — via UI admin (`/admin` → page Joueurs → zone dangereuse → "Reinitialiser les joueurs") OU via SQL direct si UI accessible apres bug, pour garantir un point de depart vierge identique au jour J.

4. **Inscription joueurs end-to-end** — ouvrir `https://tournoi.esportdessacres.fr/` dans un mobile reel, soumettre le formulaire d'inscription pour 1-2 vrais participants (Brice + 1 ami), puis pour 14-15 dummies via `/admin` → page Joueurs → "Ajouter un joueur" (jusqu'a 16 total). Chaque inscription publique declenche `tournament_state_changed` ; verifier que l'overlay dans OBS chez SkyDow le reflete (compteur joueurs, etc.).

5. **Journee 1 qualif (3 rounds)** :
   - Demarrer la journee, generer Round 1 (lobbies aleatoires `generateRandomLobbies`, attendu : 16 joueurs = 2 lobbies de 8).
   - Saisie placements (admin clique chaque lobby, dropdown 1-8, latence < 200ms NFR3, chronometre AC #6).
   - Validation Round 1 → broadcast `ranking_updated`, verifier mise a jour `<2s` cote mobile + cote overlay SkyDow OBS (NFR2).
   - Round 2 (Swiss sur classement cumul qualif via `aggregateQualificationRankings`, bug retro Epic 5 v1.2 doit rester corrige), saisie + validation.
   - Round 3 idem.
   - Drop d'un joueur entre R2 et R3 via UI admin (vraie page `/admin` page Joueurs ou via DayManager) → verifier qu'il disparait des lobbies suivants mais conserve ses points et apparait barre dans le classement (UX-DR6).
   - Bouton "Terminer la journee" → Day passe `completed`.

6. **Journee 2 qualif (3 rounds)** — repeter sequence identique, **verifier le cumul multi-journees** : classement affiche les scores J1 + J2, tiebreakers calcules sur l'ensemble (FR12, FR13, FR15, FR20). 1-2 drops aleatoires en cours de J2 pour exercer le path drops + cumul.

7. **Finale (3-5 rounds)** — depuis backoffice, "Demarrer la finale" → top 8 cumul J1+J2 identifie, lobby unique cree (FR21, FR22, story 5.1). Rounds enchaines jusqu'a victoire (regle `preRoundTotal >= 20 + top 1 du round`, retro Epic 5 v1.4). Verifier que le declencheur est correctement applique (au moins 1 candidat va `>= 20` apres round mais sans top 1 = pas de victoire ; au moins 1 cas top 1 avec preRoundTotal `>= 20` = victoire detectee). Page `/finale` publique affiche progression victoire pour les 8 (UX-DR7) + animation/or sur le vainqueur (UX-DR8).

8. **Validation OBS overlay (SkyDow)** — pendant tout le dry-run, SkyDow garde `https://tournoi.esportdessacres.fr/overlay` ouvert dans OBS comme source navigateur 16:9. Verifier visuellement : (a) aucun chrome UI (pas de barre nav, pas de scrollbar, pas de footer — UX-DR14), (b) polices grandes Bebas Neue + Roboto lisibles a distance, (c) charte EDS respectee (fond `#29265B`, accents cyan/or), (d) mise a jour instantanee `<2s` apres chaque validation admin (NFR2), (e) top 8 visuellement distingue (UX-DR5), (f) drops barres/grises (UX-DR6), (g) animation vainqueur en or `#DAB265` (UX-DR8), (h) reconnexion auto si Brice coupe momentanement le backend (`docker compose restart backend` controle, cf. AC #7) → overlay reprend l'etat sans intervention.

9. **Performance temps reel multi-clients** — pendant le dry-run, garder ouverts simultanement : (1) admin desktop Brice, (2) page `/qualifications` mobile Brice, (3) page `/qualifications` mobile (eventuel ami), (4) overlay OBS SkyDow, (5) page `/finale` desktop SkyDow ou Brice. Total : 4-5 connexions WebSocket actives. NFR4 cible 30 simultanees, mais 4-5 = preuve fonctionnelle suffisante au dry-run. Mesurer DOMContentLoaded mobile <2s sur fibre/4G (NFR1) via DevTools.

10. **Backup PG end-to-end avec donnees reelles + restore en local Docker Desktop** — apres la finale du dry-run (DB peuplee de joueurs + 2 journees + finale + vainqueur), executer `sudo /opt/tournoi-tft/docker/backup-pg.sh` sur le VPS → dump `tournoi-postdryrun-YYYYMMDD-HHMMSS.sql.gz`. Telecharger le dump localement (`scp deploy@76.13.58.249:/root/backups/tournoi-postdryrun-*.sql.gz .`). Sur Docker Desktop local, demarrer une stack PG eph (ex: `docker run --rm -d --name pg-restore-test -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:17-alpine`), creer une base `tournoi_tft`, restaurer le dump via `gunzip -c | docker exec -i ... psql`, **verifier explicitement** : (a) table `Player` contient ~16 joueurs, (b) table `Day` contient 3 entries (J1 qualif, J2 qualif, finale), (c) table `Round` contient ~6 rounds qualif + ~3-5 finale, (d) table `Lobby`/`LobbyPlayer` contiennent les placements, (e) admin hash bcrypt intact dans `Admin`, (f) `SELECT * FROM "Player" WHERE status='dropped'` retourne les joueurs droppes du dry-run. **Cleanup** : `docker stop pg-restore-test`. **Cible AC #9** : restore reussi, toutes les tables critiques validees, procedure documentee. C'est le livrable explicitement deferred de la review 6.1 (cf. `deferred-work.md`).

11. **Reset DB prod APRES dry-run** — la DB prod ne doit **pas** demarrer le 17 mai avec les dummies du dry-run. Sequence (J-7 = autour 2026-05-10) : (a) `sudo /opt/tournoi-tft/docker/backup-pg.sh` final pour archive (rename `tournoi-postdryrun-final-YYYYMMDD.sql.gz`), (b) login `/admin/login` en HTTPS prod, (c) page Joueurs → zone dangereuse → "Reinitialiser les joueurs" → confirmation, (d) verification SQL : `docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c 'SELECT COUNT(*) FROM "Player"; SELECT COUNT(*) FROM "Day"; SELECT COUNT(*) FROM "Round";'` → `0 / 0 / 0`, (e) `SELECT username FROM "Admin"` → admin toujours present (le reset ne touche pas le seed admin), (f) re-smoke test `bash docker/smoke-test.sh` 8/8 OK pour confirmer que rien n'est casse, (g) ouvrir `https://tournoi.esportdessacres.fr/qualifications` → "En attente de la 1ere journee" attendu (etat idle).

12. **Rapport de dry-run** — fichier dedie `_bmad-output/implementation-artifacts/6-3-dry-run-report-YYYYMMDD.md` documentant : date/heure, participants (Brice + SkyDow + ami eventuel), scope joue, observations (bugs, latences, surprises), chronometres reels par etape, sign-off SkyDow OBS, sign-off Brice, photos/captures jointes (au moins : capture overlay OBS pendant un round, capture page mobile `/qualifications`, capture admin saisie placements, capture page `/finale` au moment de la victoire). Liste exhaustive des **issues bloquantes** identifiees (potentiellement 0 si tout passe), **issues moyennes** deferees post-MVP, **annotations runbook**.

13. **Runbook jour J** — fichier dedie `_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md`, ecrit a partir du vecu du dry-run (pas du theorique). Contient : (a) checklist J-1 (smoke test, backup baseline, brief equipe, verifier OBS SkyDow), (b) checklist J-J 1h avant (login admin, chrome desktop + mobile prets), (c) sequence pas-a-pas (chaque clic, chaque commande), (d) gestion incidents typiques (que faire si overlay decroche, que faire si Brice perd le wifi, que faire si un drop a ete oublie, que faire si la finale "explose" — cf. `cleanup-finale.ts` script CLI fallback ou DELETE /api/admin/reset/finale via UI), (e) post-tournoi (annoncer vainqueur, screenshot final, backup post-event, message Discord), (f) contacts SkyDow / hosting / dev en cas de panne. Le runbook **remplace** ou **complete** la section `## Runbook` du `README.md` (decision : compléter, en pointant vers le doc dedie, plus detaille).

14. **Sign-off Go/No-Go** — derniere section du dry-run report. Brice (Project Lead) ET SkyDow (caster) cochent explicitement chacun des criteres : (a) scenario complet sans data loss [Brice], (b) overlay OBS pro-grade [SkyDow], (c) WebSocket <2s sur tous les clients [Brice], (d) backup+restore valide [Brice], (e) reset prod execute et verifie [Brice], (f) runbook ecrit et lu [Brice], (g) Lighthouse mobile `/finale` >=75 [Brice], (h) si bug bloquant trouve : story hotfix livree avant 2026-05-15 [Brice]. **Tous les criteres = "Go"** → status story `done` ; **un seul "No-Go"** → story reste `in-progress`, plan d'action documenté, dry-run partiellement re-execute si possible avant 2026-05-10.

**Perimetre explicitement HORS 6.3 (a ne PAS faire ici)** :

- ❌ **Modifier le code applicatif frontend ou backend** — code fige depuis Epic 5. Si bug bloquant identifie : creer story `6-3-1-hotfix-<nom>` distincte (workflow normal create-story → dev-story → code-review).
- ❌ **Modifier la stack Docker / infra** (sauf hotfix infra critique style 6.1 v1.x) — `docker/docker-compose.yml` reste fige depuis 6.2.
- ❌ **Migration Prisma** — schema fige. Si besoin pendant dry-run = bug grave, ouvre une story dediee.
- ❌ **CI/CD ou monitoring automatise** — confirme HORS scope MVP (retro Epic 5 + 6.1 + 6.2).
- ❌ **Stress test 30+ connexions WebSocket simultanees** — NFR4 cible 30, mais le dry-run avec 4-5 connexions reelles est suffisant pour valider le path. Stress test 30 = nice-to-have post-MVP, non bloquant Go-Live.
- ❌ **Securisation supplementaire (HSTS, CSP, rate limiting cote API)** — accepte comme dette dans review 6.1/6.2. Pas adresse en 6.3 sauf si dry-run revele un risque concret.
- ❌ **Optimisation bundle ou pages** — bundles fige Epic 5 (148.27 kB gz `/finale`). Audit Lighthouse `/finale` = mesure, pas refactor.
- ❌ **Recreation du seed admin** — admin existant en prod depuis Story 6.1 final. Reset des joueurs ne touche pas l'admin.
- ❌ **Test scaling Socket.IO multi-process (Redis adapter)** — deferred Epic 3, reconduit deferred. Non bloquant.

**Regles projet rappelees (memoire Brice)** :

- **Pas de limite de rounds par journee** — fin manuelle via "Terminer la journee" (FR17). Le dry-run respecte : 3 rounds chacune J1/J2 sont une **convention de scope dry-run**, pas une regle metier. Pour le 17 mai, Brice peut faire 4-6 rounds par journee si l'enchainement le permet — la stack supporte sans limite.
- **Validation OBS dependante de SkyDow** — bloquante ici (groupage avec dry-run, decision retro Epic 4 reconduite Epic 5). Sans session SkyDow effective, AC #5 reste KO.
- **VPS Hostinger 76.13.58.249** — backend + frontend deja deployes, dry-run = utilisation, pas de re-prep.
- **Checklist review stories infra** (memoire `feedback_infra_review_checklist`) : (1) backup sans test restore = invalide → AC #9 oblige le test E2E, (2) URLs sans trailing slash → deja verifie en 6.1 review item #2, (3) rotation/cleanup dossier persistant prod → `find /root/backups -mtime +14 -delete` documente Runbook 6.1, **a executer manuellement** apres dry-run pour eviter accumulation 14j+ entre dry-run et 17 mai.
- **Defense in Depth pour invariants infra** (pattern reconduit Epic 5/6.1/6.2) : (a) backup AVANT dry-run + apres + final, (b) reset via UI + verification SQL, (c) sign-off double Brice + SkyDow, (d) chronos mesures (pas "ca marche bien"), (e) runbook ecrit a partir du vecu (pas theorique).
- **Change Log granulaire v1.x** — pattern reconduit. Chaque hotfix ou ajustement post-creation = entree v1.x dans ce fichier.

**Decision d'architecture cle** : **Story 6.3 = validation operationnelle, pas dev**. Aucun code n'est ecrit hors documents (rapport + runbook + entrees Change Log). Le `dev-story` workflow lui-meme est inhabituel — il execute des actions humaines (clic admin, regarde OBS chez SkyDow) plutot que des tools (Edit, Bash, Write). C'est explicitement assume : Brice et SkyDow sont les "developpeurs" de cette story, l'agent LLM (Amelia) est la pour scripter les commandes (smoke test, backup, restore, reset SQL), preparer les checklists, rediger le rapport et le runbook **a partir des observations reportees par Brice/SkyDow**, et tracer les chronos / sign-offs. Pattern : "agent comme ops co-pilote".

**Decision d'architecture secondaire** : **Reset prod via UI admin** plutot que SQL direct ou `cleanup-finale` script. Raison : (a) la zone dangereuse + endpoints `DELETE /api/admin/reset/*` sont eux-memes du code testable - les utiliser au reset prod = test grandeur nature de ces endpoints (qui sont susceptibles d'etre utilises pendant le tournoi reel si reset accidentel necessaire), (b) emission `tournament_state_changed` post-commit garantit que l'overlay et les pages publiques se mettent a jour automatiquement (pas de cache stale apres reset SQL brut), (c) verification SQL post-reset = defense en profondeur. Si UI inaccessible (cas impossible si stack healthy) : fallback `cleanup-finale` script CLI deja documente.

**Decision d'architecture tertiaire** : **Restore test en local Docker Desktop** plutot qu'en prod. Raison : (a) restorer en prod ecraserait la DB live - dangereux meme apres un backup baseline, (b) Docker Desktop sur Windows = environnement Brice contrôlé, replicable, (c) suffisant pour valider la chaine `pg_dump → gunzip → psql` end-to-end. Pas de `pg_restore` (utilise `psql`, format SQL plain pas custom — compatible avec le `pg_dump` du script).

## Acceptance Criteria

1. **Given** les Stories 6.1 et 6.2 sont `done` (stack 4-services prod operationnelle, smoke test 8/8 OK le 2026-04-25) **When** je realise le pre-flight J-1 du dry-run **Then** un re-run de [docker/smoke-test.sh](docker/smoke-test.sh) `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` retourne `8/8 SUCCES` (5 backend + 3 frontend) sans modification de code **And** `dig +short api-tournoi.esportdessacres.fr` et `dig +short tournoi.esportdessacres.fr` retournent toujours `76.13.58.249` (DNS stable) **And** `openssl s_client ...` confirme issuer `Let's Encrypt R13` (pas STAGING) sur les 2 domaines avec `notAfter` >= 2026-05-24 (cert valide pendant tout le mois de mai) **And** `docker compose ps` sur le VPS montre les 4 services (`traefik`, `postgres`, `backend`, `frontend`) tous `Up X (healthy)`.

2. **Given** la stack est saine **When** je realise l'audit Lighthouse mobile sur la page `/finale` (deferred-work Epic 5) **Then** un audit Chrome DevTools Lighthouse mode mobile (Slow 4G + 4x CPU throttle) sur `https://tournoi.esportdessacres.fr/finale` retourne un score Performance **>= 75** (alignement avec audit Epic 3 sur `/qualifications`) **And** le score est documente (capture screenshot ou JSON Lighthouse) dans le rapport de dry-run **And** si le score est `< 75`, un follow-up est cree dans `deferred-work.md` mais cela **n'est pas bloquant** Go-Live (la page `/finale` est secondaire vs `/qualifications` Epic 3 qui doit etre deja >=75).

3. **Given** le pre-flight est OK **When** je prepare la session dry-run **Then** une session est calee ferme avec SkyDow (date + heure + duree estimee 4-6h) avec confirmation ecrite (Discord screenshot ou similaire) **And** la date est **<= 2026-05-10** (laissant min. 1 semaine de marge avant 2026-05-17, AC #6 epics) **And** SkyDow a recu un brief operationnel avant la session : URL `/overlay` pour OBS source navigateur 16:9, scope du tournoi simule (16 joueurs, 2 journees + finale), comment signaler un decrochage overlay a Brice **And** la liste des 12-16 dummies a inscrire est preparee dans un fichier ou doc partage (pseudos credibles, idealement reutilises depuis un brouillon `dummy-players.txt` dans `_bmad-output/implementation-artifacts/`) — pour eviter d'inventer 16 noms en live.

4. **Given** la session dry-run debute **When** je realise le backup baseline pre-dry-run + le reset DB pre-dry-run **Then** depuis le VPS, `sudo /opt/tournoi-tft/docker/backup-pg.sh` produit un fichier `/root/backups/tournoi-pre-dryrun-YYYYMMDD-HHMMSS.sql.gz` non vide (verifie `ls -lh`) **And** un `gunzip -t` sur ce fichier reussit (gzip valide) **And** depuis l'UI admin `/admin` page Joueurs zone dangereuse, le bouton "Reinitialiser les joueurs" est clique → confirmation → succes (toast ou message confirmant) **And** une verification SQL via `docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c 'SELECT COUNT(*) FROM "Player"; SELECT COUNT(*) FROM "Day";'` retourne `0 / 0` (DB applicative vierge) **And** `SELECT username FROM "Admin"` retourne la ligne `admin` (le seed admin n'est PAS efface par `DELETE /api/admin/reset/players`) **And** `https://tournoi.esportdessacres.fr/qualifications` ouvert sur mobile montre un etat idle/vide propre (pas d'ancien classement cache).

5. **Given** la DB est vierge applicative **When** je realise les inscriptions dry-run **Then** Brice ouvre `https://tournoi.esportdessacres.fr/` sur mobile reel (4G ou wifi) et soumet le formulaire d'inscription publique pour son propre compte → verification `POST /api/players` retourne `200/201`, page de confirmation s'affiche, et un `tournament_state_changed` est broadcaste (compteur joueurs incrementé sur l'overlay SkyDow chez OBS) **And** depuis `/admin` → page Joueurs → "Ajouter un joueur" Brice cree 14-15 dummies supplementaires (jusqu'a 16 total joueurs `inscrit`) — chaque ajout declenche egalement un broadcast WebSocket et une refresh sans reload **And** la liste admin affiche les 16 joueurs avec pseudo Discord/Riot/email/statut.

6. **Given** 16 joueurs sont inscrits **When** je deroule la Journee 1 qualif (3 rounds) **Then** depuis `/admin`, "Demarrer la journee" cree une `Day` qualif, "Generer les lobbies" R1 produit 2 lobbies de 8 (random via `generateRandomLobbies`, FR6) **And** la saisie des placements dans chaque lobby (dropdowns 1-8) repond avec une latence percue **< 200ms** (NFR3, mesure subjective : pas de lag visible entre clic et update UI) **And** "Valider le round" R1 declenche `ranking_updated`, le tableau `/qualifications` mobile + l'overlay OBS SkyDow se mettent a jour en **< 2s** (NFR2, chronometre par Brice ou par DevTools Network) **And** "Generer les lobbies" R2 produit des lobbies Swiss (les 8 mieux classes ensemble, les 8 moins bien classes ensemble — bug retro Epic 5 v1.2 doit rester corrige : verification que J1R2 utilise bien `aggregateQualificationRankings` cumul, pas un re-random) **And** R2 saisie+validation OK, R3 idem **And** entre R2 et R3, Brice marque 1 joueur "drop" via UI (page Joueurs ou DayManager) → confirmation → joueur disparait des lobbies R3 mais conserve ses points et apparait grise/barre dans `/qualifications` (UX-DR6) **And** "Terminer la journee" passe la Day a `completed`, plus de bouton "Generer lobbies" pour cette Day (FR17, story 2.5).

7. **Given** la Journee 1 est terminee **When** je deroule la Journee 2 qualif (3 rounds) **Then** "Demarrer la journee" cree une 2eme `Day` qualif, "Generer les lobbies" R1 J2 utilise le **classement cumul J1** (pas un re-random — bug retro Epic 5 v1.2 verifie sur J2R1) → 2 lobbies Swiss de 7-8 joueurs (rappel : 1 droppe en J1 = 15 actifs, donc 1 lobby de 8 + 1 lobby de 7) **And** R1/R2/R3 saisie+validation OK, latences identiques J1 (<200ms saisie, <2s WebSocket) **And** entre R1 et R2 J2, Brice marque un 2eme joueur "drop" (different de J1) → verifie cumul drops (2 droppes total apres J2R2) **And** apres validation R3 J2, le classement `/qualifications` affiche les scores **cumules J1+J2** (FR12, FR20) avec tiebreakers calcules sur l'ensemble des rounds joues (FR13) **And** "Terminer la journee" → Day J2 `completed`, et **les top 8 du classement cumule** sont visuellement distingues (UX-DR5, story 5.1) **And** un controle visuel rapide est fait par Brice dans le backoffice : la liste des 8 qualifies attendus correspond bien au top 8 cumul (verifie cote spec : tri par score total desc puis tiebreakers).

8. **Given** les 2 journees qualif sont terminees **When** je deroule la finale **Then** depuis `/admin`, "Demarrer la finale" cree une `Day type='finale'` avec un lobby unique de 8 joueurs (les top 8 cumul J1+J2, FR21, FR22, story 5.1) — verifier l'atomicite (Day + Round + Lobby + 8 LobbyPlayer cree en transaction Prisma) **And** la page `/finale` publique s'affiche avec les 8 finalistes, indicateur progression victoire visible pour chacun (UX-DR7 : barre de progression vers 20 pts cumules + badge eligibilite quand >=20) **And** le bouton "Regenerer les lobbies" est **masque** en finale (garde retro Epic 5 v1.2 — invariant FINALE_LOBBY_IS_FIXED) **And** Round 1 finale : saisie placements pour les 8 finalistes, "Valider le round" → broadcast `ranking_updated`, page `/finale` + overlay OBS se mettent a jour <2s **And** rounds enchainés (3-5 max realiste pour dry-run) jusqu'a ce qu'un joueur cumule >=20 pts AVANT le dernier round ET termine top 1 du dernier round (regle `preRoundTotal >= 20`, retro Epic 5 v1.4 — `winnerDetector`) **And** au moment de la victoire, le backoffice indique clairement le vainqueur (FR23), la page `/finale` publique affiche l'animation/mise en valeur en or `#DAB265` (UX-DR8), l'overlay OBS reflete egalement le vainqueur **And** la finale passe `completed`, plus de bouton "Round suivant".

9. **Given** la finale est terminee avec un vainqueur **When** je realise le backup post-dry-run + le restore E2E test (livrable explicitement deferred review 6.1) **Then** depuis le VPS, `sudo /opt/tournoi-tft/docker/backup-pg.sh` produit `/root/backups/tournoi-postdryrun-YYYYMMDD-HHMMSS.sql.gz` non vide (taille >= 50 KB raisonnable pour 16 joueurs + ~10 rounds + finale) **And** `scp deploy@76.13.58.249:/root/backups/tournoi-postdryrun-*.sql.gz .` telecharge le fichier sur la machine dev Brice **And** un container PG ephemere local est demarre : `docker run --rm -d --name pg-restore-test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=tournoi_tft -p 55432:5432 postgres:17-alpine`, **attendre healthy** (~10s) **And** la restauration est executee : `gunzip -c tournoi-postdryrun-*.sql.gz | docker exec -i pg-restore-test psql -U test -d tournoi_tft` (ou via `\i` interactif) — exit 0 sans erreur SQL **And** des verifications ciblees passent : (a) `SELECT COUNT(*) FROM "Player"` >= 14 (16 inscrits - eventuellement 0-2 droppes restent comptabilises avec status `dropped`), (b) `SELECT COUNT(*) FROM "Day"` = 3 (J1 qualif + J2 qualif + finale), (c) `SELECT COUNT(*) FROM "Round"` >= 8 (3 J1 + 3 J2 + 2-5 finale), (d) `SELECT COUNT(*) FROM "Lobby"` correspondant, (e) `SELECT username FROM "Admin"` retourne `admin`, (f) `SELECT COUNT(*) FROM "Player" WHERE status='dropped'` >= 2 (drops du dry-run preserves), (g) `SELECT * FROM "Day" WHERE type='finale'` retourne 1 ligne avec scores du vainqueur lisibles via JOIN Lobby/LobbyPlayer **And** cleanup local : `docker stop pg-restore-test` (le container est `--rm`, supprime auto) **And** la procedure exacte (commandes copiables) est ajoutee a `_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md` section "Restoration backup en urgence" — c'est le livrable qui ferme le deferred-work item de la review 6.1.

10. **Given** la session dry-run est terminee avec succes **When** SkyDow valide visuellement l'overlay OBS dans les conditions reelles du stream EDS (deferred-work Epic 4) **Then** SkyDow confirme par message ecrit (Discord screenshot ou rapport joint) que **toutes** les checks visuels passent : (a) overlay sans chrome UI / sans scrollbar / sans element navigation (UX-DR14), (b) format 16:9 propre dans OBS source navigateur (pas de bordures noires inattendues, pas de zoom incorrect), (c) polices Bebas Neue (titres) + Roboto (corps) lisibles a distance (taille adaptee au stream — SkyDow juge subjectivement OK ou pas), (d) charte EDS (fond `#29265B`, accents cyan `#80E2ED`, or `#DAB265`) respectee, (e) top 8 visuellement distingue (UX-DR5), (f) joueurs droppes barres ou grises (UX-DR6), (g) animation/mise en valeur du vainqueur en or quand condition victoire detectee (UX-DR8), (h) mise a jour instantanee `<2s` apres chaque validation admin Brice (NFR2 — verifie subjectivement ou via chrono SkyDow), (i) reconnexion automatique OK : si Brice fait un `docker compose restart backend` controle (1 fois pendant le dry-run pour exercer le path), Socket.IO reconnecte sans intervention SkyDow et l'overlay reprend l'etat actuel (preuve story 4.1 AC #5 + story 3.1 AC #4) **And** au moins 2 captures d'ecran de l'overlay OBS sont jointes au rapport de dry-run (1 pendant les qualifs, 1 pendant la finale ou au moment du vainqueur) **And** SkyDow signe explicitement "Go-Live OK overlay" dans le rapport (champ "Sign-off SkyDow" — c'est ce qui ferme le deferred-work Epic 4 valide depuis 4 epics).

11. **Given** le dry-run est valide cote technique et OBS **When** je realise le reset prod definitif (J-7 environ, ~2026-05-10) **Then** depuis le VPS, `sudo /opt/tournoi-tft/docker/backup-pg.sh` produit un dump archive `/root/backups/tournoi-postdryrun-final-YYYYMMDD.sql.gz` (rename ou simplement preserver dans le dossier — utile en cas de besoin de re-tester un cas du dry-run plus tard) **And** depuis l'UI admin `/admin` page Joueurs zone dangereuse, "Reinitialiser les joueurs" est clique → confirmation → succes **And** verifications SQL post-reset : `SELECT COUNT(*) FROM "Player"` = 0, `SELECT COUNT(*) FROM "Day"` = 0, `SELECT COUNT(*) FROM "Round"` = 0, `SELECT COUNT(*) FROM "Lobby"` = 0, `SELECT COUNT(*) FROM "LobbyPlayer"` = 0, `SELECT username FROM "Admin"` retourne `admin` (admin preserve) **And** un re-smoke test `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` retourne `8/8 SUCCES` (rien de casse par le reset) **And** `https://tournoi.esportdessacres.fr/qualifications` mobile montre un etat idle propre (pas d'ancien classement cache) **And** `https://tournoi.esportdessacres.fr/finale` montre "Finale pas encore commencee" (state idle, story 5.3 AC #6) **And** un cleanup des backups anciens est execute : `sudo find /root/backups -name "tournoi-pre-dryrun-*" -mtime +14 -delete` (memoire `feedback_infra_review_checklist` item #3 — eviter accumulation entre dry-run et 17 mai).

12. **Given** le dry-run + reset sont termines **When** je redige le rapport de dry-run **Then** un fichier `_bmad-output/implementation-artifacts/6-3-dry-run-report-YYYYMMDD.md` est cree contenant : (a) **Metadata** : date, heure debut/fin, duree totale, participants (Brice + SkyDow + ami eventuel), (b) **Scope joue** : 16 joueurs (X reels + Y dummies), 2 journees qualif x 3 rounds + finale Z rounds, (c) **Chronologie** : table avec `etape | heure | duree | observations` (au moins 8-12 lignes : reset, inscriptions, J1R1, J1R2, J1R3, fin J1, J2R1...J2R3, fin J2, finale R1...Rn, vainqueur, backup, reset), (d) **Mesures de performance** : DOMContentLoaded mobile measure, latence saisie subjective, latence WebSocket subjective ou DevTools, (e) **Issues identifiees** : table avec `severite (Crit/Med/Low) | description | impact J | action prise/deferree`, idealement 0 Crit, (f) **Captures jointes** : au moins 4 (admin saisie placements, overlay OBS pendant qualif, page mobile `/qualifications`, page `/finale` au moment vainqueur), (g) **Verifications backup/restore** : recap commandes + resultat (lien vers la section runbook), (h) **Sign-off** : section finale avec 2 cases a cocher signees `[x] Brice 2026-MM-DD` et `[x] SkyDow 2026-MM-DD`, et la conclusion `Go-Live: YES / NO + commentaire` **And** ce rapport est commite et reference depuis cette story (section File List).

13. **Given** le rapport est ecrit **When** je redige le runbook jour J **Then** un fichier `_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md` est cree contenant : (a) **Checklist J-1** : smoke test 8/8, backup baseline, brief equipe, verifier OBS SkyDow operationnel, valider DNS toujours stable, valider cert TLS valide pendant tout le mois de mai, (b) **Checklist J-J 1h avant** : login admin, Chrome desktop + mobile prets, OBS de SkyDow lance, page `/overlay` chargee, mode plein ecran teste, (c) **Sequence operationnelle** pas-a-pas (chaque clic admin numerote, chaque commande shell copiable — extraite du vecu du dry-run), (d) **Procedures d'urgence** : (i) overlay decroche → F5 + Brice broadcast manuel via dummy round si besoin, (ii) Brice perd reseau → bascule 4G mobile, le backend tourne tjrs sur le VPS, (iii) finale "explose" (placement saisi a tort) → script CLI `cleanup-finale.ts` fallback ou DELETE /api/admin/reset/finale via UI, (iv) backend down → `ssh deploy@76.13.58.249 && docker compose restart backend`, (v) cert expire (improbable, valable jusqu'a juillet) → bascule LE staging d'urgence (procedure README 6.1), (vi) DB corrompue → restore dernier backup (procedure section dediee), (e) **Restoration backup en urgence** : commandes exactes copiables (issue de la verification AC #9), (f) **Post-tournoi** : annoncer vainqueur, screenshot final, `sudo /opt/tournoi-tft/docker/backup-pg.sh` final + archive nominative, message Discord communaute EDS, (g) **Contacts d'urgence** : SkyDow (Discord), Hostinger support, Brice mobile (renseigne par Brice) **And** ce runbook est lu en entier par Brice (et idealement par SkyDow) avant le 17 mai, et reference depuis `README.md` Runbook (lien vers le fichier dedie).

14. **Given** le rapport et le runbook sont ecrits **When** je realise le sign-off Go/No-Go final **Then** la section "Sign-off Go/No-Go" du rapport de dry-run contient **8 criteres explicitement coches** : (1) `[x] Scenario complet sans data loss [Brice]`, (2) `[x] Overlay OBS pro-grade [SkyDow]`, (3) `[x] WebSocket <2s sur tous les clients [Brice]`, (4) `[x] Backup + restore valide en local Docker Desktop [Brice]`, (5) `[x] Reset prod execute et verifie SQL [Brice]`, (6) `[x] Runbook ecrit et lu [Brice]`, (7) `[x] Lighthouse mobile /finale >=75 [Brice]`, (8) `[x] Aucun bug bloquant ouvert OU story hotfix livree avant 2026-05-15 [Brice]` **And** la conclusion finale `**GO-LIVE: YES**` est indiquee **And** si **un seul** critere reste No-Go : la story 6.3 reste `in-progress`, un plan d'action documente est ajoute (date + responsable + livrable attendu), et eventuellement une story `6-3-1-hotfix-<nom>` est creee — la story 6.3 ne peut etre `done` que sur sign-off complet **And** le statut sprint-status `6-3-dry-run-validation-go-live` passe `in-progress → review` puis `review → done` apres revue (workflow standard BMad — meme si pas de code, le rapport et runbook peuvent etre revues par un LLM tiers en `code-review` adapte).

## Tasks / Subtasks

- [ ] **Task 1 — Pre-flight J-1 (AC: #1)**
  - [ ] **(BRICE)** Re-run smoke test : `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` → 8/8 OK
  - [ ] **(BRICE)** Verifier DNS : `dig +short api-tournoi.esportdessacres.fr` et `dig +short tournoi.esportdessacres.fr` → `76.13.58.249` (depuis machine dev + via `nslookup ... 8.8.8.8`)
  - [ ] **(BRICE)** Verifier cert TLS : `openssl s_client -connect api-tournoi.esportdessacres.fr:443 -servername api-tournoi.esportdessacres.fr </dev/null 2>&1 | openssl x509 -noout -issuer -dates` → issuer `Let's Encrypt R13`, `notAfter` >= 2026-05-24 (idem domaine frontend)
  - [ ] **(BRICE)** Verifier stack : `ssh deploy@76.13.58.249 'cd /opt/tournoi-tft/docker && docker compose ps'` → 4 services `Up X (healthy)`
  - [ ] Documenter resultats dans le rapport de dry-run section "Pre-flight"

- [ ] **Task 2 — Audit Lighthouse mobile /finale (AC: #2, deferred-work Epic 5)**
  - [ ] **(BRICE)** Chrome DevTools → Lighthouse → mode mobile (Slow 4G + 4x CPU throttle) sur `https://tournoi.esportdessacres.fr/finale`
  - [ ] Note score Performance ; cible >= 75 (alignement Epic 3 `/qualifications`)
  - [ ] Capture screenshot ou export JSON Lighthouse, joindre au rapport de dry-run
  - [ ] Si score < 75 : ajouter une entree dans `_bmad-output/implementation-artifacts/deferred-work.md` (non bloquant Go-Live)

- [ ] **Task 3 — Coordination SkyDow + preparation dummies (AC: #3)**
  - [ ] **(BRICE)** Caler une session avec SkyDow : date <= 2026-05-10, duree estimee 4-6h, confirmation ecrite (Discord screenshot)
  - [ ] **(BRICE)** Briefer SkyDow : URL `/overlay`, OBS source navigateur 16:9, scope (16 joueurs, 2 journees + finale), comment signaler un decrochage
  - [ ] Creer `_bmad-output/implementation-artifacts/6-3-dummy-players.txt` avec 16 pseudos credibles (Discord + Riot + email factices), prets a copier/coller dans le formulaire admin

- [ ] **Task 4 — Backup baseline + reset DB pre-dry-run (AC: #4)**
  - [ ] **(BRICE)** SSH VPS : `sudo /opt/tournoi-tft/docker/backup-pg.sh` → fichier `/root/backups/tournoi-pre-dryrun-YYYYMMDD-HHMMSS.sql.gz`
  - [ ] **(BRICE)** Verifier : `ls -lh /root/backups/tournoi-pre-dryrun-*.sql.gz` (taille > 0), `gunzip -t` (gzip valide)
  - [ ] **(BRICE)** Login `https://tournoi.esportdessacres.fr/admin/login` → `/admin` page Joueurs → zone dangereuse → "Reinitialiser les joueurs" → confirmation
  - [ ] **(BRICE)** Verifier SQL : `ssh deploy@76.13.58.249 'cd /opt/tournoi-tft/docker && set -a && . ./.env && set +a && docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM \"Player\"; SELECT COUNT(*) FROM \"Day\"; SELECT username FROM \"Admin\";"'` → `0 / 0 / admin`
  - [ ] **(BRICE)** Ouvrir `https://tournoi.esportdessacres.fr/qualifications` mobile → etat idle vide

- [ ] **Task 5 — Inscriptions joueurs (AC: #5)**
  - [ ] **(BRICE)** Inscription publique mobile : Brice ouvre `https://tournoi.esportdessacres.fr/` sur mobile reel et soumet le formulaire avec son propre pseudo Discord/Riot/email
  - [ ] Verifier cote DevTools mobile (ou via SkyDow OBS) : `tournament_state_changed` declenche, compteur joueurs incremente
  - [ ] **(BRICE)** Depuis `/admin` page Joueurs → "Ajouter un joueur" : creer 14-15 dummies (cf. Task 3 `dummy-players.txt`) jusqu'a 16 total
  - [ ] Verifier liste admin affiche les 16 joueurs

- [ ] **Task 6 — Journee 1 qualif 3 rounds + 1 drop (AC: #6)**
  - [ ] **(BRICE)** "Demarrer la journee" → Day J1 cree
  - [ ] **(BRICE)** R1 : "Generer les lobbies" → 2 lobbies de 8 (random) ; saisir placements (mesurer latence subjective <200ms) ; "Valider le round" → broadcast `ranking_updated` ; verifier mobile + overlay OBS update <2s
  - [ ] **(BRICE)** R2 : "Generer les lobbies" → 2 lobbies Swiss (top 8 ensemble, bottom 8 ensemble) ; saisir + valider
  - [ ] **(BRICE)** Marquer 1 joueur "drop" entre R2 et R3 ; verifier disparition lobbies R3 + grise dans `/qualifications`
  - [ ] **(BRICE)** R3 : 2 lobbies Swiss (1 droppe → 15 actifs → 1 lobby de 8 + 1 lobby de 7) ; saisir + valider
  - [ ] **(BRICE)** "Terminer la journee" → Day J1 `completed`
  - [ ] Chronometrer chaque etape, noter dans le rapport

- [ ] **Task 7 — Journee 2 qualif 3 rounds + 1 drop + cumul (AC: #7)**
  - [ ] **(BRICE)** "Demarrer la journee" → Day J2 cree
  - [ ] **(BRICE)** R1 J2 : "Generer les lobbies" → Swiss sur **classement cumul J1** (verif bug retro Epic 5 v1.2 reste corrige) ; saisir + valider
  - [ ] **(BRICE)** Marquer 1 nouveau joueur "drop" (different de J1) entre R1 et R2 J2
  - [ ] **(BRICE)** R2/R3 J2 : Swiss + saisir + valider (drops cumules excluds des lobbies)
  - [ ] **(BRICE)** Verifier cote `/qualifications` : scores cumules J1+J2, tiebreakers calcules sur l'ensemble, top 8 mis en valeur (UX-DR5)
  - [ ] **(BRICE)** "Terminer la journee" → Day J2 `completed`

- [ ] **Task 8 — Finale + detection victoire (AC: #8)**
  - [ ] **(BRICE)** Verifier visuellement la liste des 8 qualifies attendus dans le backoffice (top 8 cumul J1+J2)
  - [ ] **(BRICE)** "Demarrer la finale" → Day finale + 1 lobby de 8 cree (atomique)
  - [ ] Verifier `/finale` publique : 8 finalistes affiches avec progression victoire (UX-DR7)
  - [ ] Verifier que le bouton "Regenerer les lobbies" est masque en finale (garde retro Epic 5)
  - [ ] **(BRICE)** Round 1 finale : saisir placements 8 finalistes ; "Valider" → broadcast ; verifier `/finale` + overlay OBS update <2s
  - [ ] **(BRICE)** Rounds 2-3-4-5 enchaines jusqu'a victoire (regle `preRoundTotal >= 20 + top 1 du round`, retro Epic 5 v1.4)
  - [ ] Verifier que la victoire est detectee correctement : un round ou un joueur monte a 20 pendant le round mais ne fait pas top 1 = pas de victoire ; round suivant top 1 avec >=20 cumule = victoire
  - [ ] Verifier UX-DR8 : animation/or `#DAB265` sur le vainqueur dans `/finale` + overlay OBS

- [ ] **Task 9 — Backup post-dry-run + restore E2E local (AC: #9, deferred review 6.1)**
  - [ ] **(BRICE)** SSH VPS : `sudo /opt/tournoi-tft/docker/backup-pg.sh` → `/root/backups/tournoi-postdryrun-YYYYMMDD-HHMMSS.sql.gz`
  - [ ] **(BRICE)** Telecharger : `scp deploy@76.13.58.249:/root/backups/tournoi-postdryrun-*.sql.gz .` (dans dossier de travail Brice)
  - [ ] **(BRICE)** Demarrer container PG ephemere local : `docker run --rm -d --name pg-restore-test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=tournoi_tft -p 55432:5432 postgres:17-alpine` ; attendre healthy (~10s)
  - [ ] **(BRICE)** Restaurer : `gunzip -c tournoi-postdryrun-*.sql.gz | docker exec -i pg-restore-test psql -U test -d tournoi_tft` → exit 0
  - [ ] **(BRICE)** Verifier les 7 checks SQL (cf. AC #9) : Player>=14, Day=3, Round>=8, Lobby coherent, Admin OK, Player WHERE status='dropped'>=2, Day WHERE type='finale' = 1 + JOIN scores vainqueur
  - [ ] Cleanup : `docker stop pg-restore-test` (auto-supprime via `--rm`)
  - [ ] Documenter procedure exacte (commandes copiables) dans le runbook jour J section "Restoration backup en urgence"

- [x] **Task 10 — Validation OBS finale par SkyDow (AC: #10, deferred Epic 4)** — **VALIDE 2026-04-25** session test live Brice + SkyDow apres deploy v1.2/v1.3 (2 overlays). 9 checks (a-i) passes par SkyDow.
  - [x] **(SKYDOW)** Confirmer par message ecrit (Discord screenshot) que les 9 checks visuels (a-i) passent — **OK 2026-04-25**, confirme via session live partagee : (a) pas de chrome/scrollbar OK, (b) format 16:9 propre OK, (c) polices lisibles OK, (d) charte EDS OK, (e) top 8 distingue OK, (f) drops barres/grises OK, (g) animation or vainqueur (UX-DR8) OK, (h) update <2s apres validation admin (NFR2) OK, (i) reconnexion auto apres `docker compose restart backend` (story 4.1 AC #5 + 3.1 AC #4) OK
  - [ ] **(SKYDOW + BRICE)** Capturer au moins 2 screenshots overlay OBS (1 pendant qualifs, 1 pendant la finale ou au moment du vainqueur) — **A faire pendant le dry-run reel** (rapport final)
  - [x] **(BRICE)** Pendant le dry-run, exercer 1 fois `docker compose restart backend` controle pour valider la reconnexion auto Socket.IO cote overlay (story 4.1 AC #5) — **OK 2026-04-25**, validation (i) ci-dessus
  - [ ] **(SKYDOW)** Signer "Go-Live OK overlay" dans le rapport de dry-run — **A formaliser ecrit avec rapport final** (sign-off informel "parfait" 2026-04-25 acquis)

- [ ] **Task 11 — Reset prod definitif J-7 (AC: #11)**
  - [ ] **(BRICE)** SSH VPS : `sudo /opt/tournoi-tft/docker/backup-pg.sh` → renommer manuellement `tournoi-postdryrun-final-YYYYMMDD.sql.gz` (ou le laisser horodate, il sera identifiable)
  - [ ] **(BRICE)** Login `/admin/login` → page Joueurs zone dangereuse → "Reinitialiser les joueurs" → confirmation
  - [ ] **(BRICE)** Verifier SQL : 5 COUNT(*) = 0 (Player, Day, Round, Lobby, LobbyPlayer) + Admin = `admin`
  - [ ] **(BRICE)** Re-smoke test : `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` → 8/8 OK
  - [ ] **(BRICE)** Verifier `/qualifications` mobile = idle vide ; `/finale` = "Finale pas encore commencee"
  - [ ] **(BRICE)** Cleanup backups anciens : `sudo find /root/backups -name "tournoi-pre-dryrun-*" -mtime +14 -delete` (memoire `feedback_infra_review_checklist` item #3)

- [ ] **Task 12 — Rapport de dry-run (AC: #12)**
  - [ ] Creer `_bmad-output/implementation-artifacts/6-3-dry-run-report-YYYYMMDD.md` avec les 8 sections (Metadata, Scope, Chronologie, Performance, Issues, Captures, Backup/restore, Sign-off)
  - [ ] **(BRICE)** Joindre les 4+ captures (admin saisie, overlay qualif, mobile `/qualifications`, `/finale` vainqueur)
  - [ ] **(BRICE + SKYDOW)** Cocher les sign-offs explicites
  - [ ] Conclure `Go-Live: YES / NO + commentaire`

- [ ] **Task 13 — Runbook jour J (AC: #13)**
  - [ ] Creer `_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md` avec les 7 sections (Checklist J-1, Checklist J-J 1h, Sequence operationnelle, Procedures d'urgence, Restoration backup, Post-tournoi, Contacts)
  - [ ] **(BRICE)** Lire en entier le runbook avant 2026-05-17, idealement avec SkyDow
  - [ ] Referencer le runbook depuis `README.md` Runbook (lien vers le fichier dedie)

- [ ] **Task 14 — Sign-off Go/No-Go + finalisation story (AC: #14)**
  - [ ] **(BRICE + SKYDOW)** Cocher les 8 criteres dans le rapport
  - [ ] Si tout `[x]` → conclusion `GO-LIVE: YES`, status story `in-progress` → `review` → `done` (apres revue)
  - [ ] Si un `[ ]` → conclusion `GO-LIVE: NO`, plan d'action documente, eventuellement story hotfix `6-3-1-*` creee
  - [ ] Mettre a jour `_bmad-output/implementation-artifacts/sprint-status.yaml` : `6-3-dry-run-validation-go-live: ready-for-dev → in-progress → review → done`
  - [ ] Entree Change Log v1.x finale dans cette story

## Dev Notes

### Stack technique en place (NE PAS modifier)

| Composant | Version | Etat | Localisation |
|---|---|---|---|
| OS VPS | Ubuntu 24.04.4 LTS | Operationnel depuis 2026-04-24 | `76.13.58.249` |
| Docker | Engine 29.4.1 + Compose v5.1.3 | Operationnel | VPS |
| Traefik | `v3` (floating) | Cert LE prod R13 actif | container `tournoi-tft-traefik` |
| PostgreSQL | `17-alpine` | DB `tournoi_tft` peuplee uniquement avec admin seed | container `tournoi-tft-postgres`, volume `tournoi-pg-data` |
| Backend Node | `22-alpine` | `https://api-tournoi.esportdessacres.fr` healthy | container `tournoi-tft-backend` |
| Frontend nginx | `1.27-alpine` | `https://tournoi.esportdessacres.fr` healthy | container `tournoi-tft-frontend` |
| Smoke test | 8/8 OK 2026-04-25 | a re-run pre-dry-run | [docker/smoke-test.sh](docker/smoke-test.sh) |
| Backup script | manuel | a executer 3 fois min (pre, post, final) | [docker/backup-pg.sh](docker/backup-pg.sh) |
| Reset endpoints | `DELETE /api/admin/reset/{finale,qualifications,players}` | implemente Story 2.x v1.x post-Epic 5 | [backend/src/routes/admin.ts:198-282](backend/src/routes/admin.ts) |
| Cleanup CLI fallback | `node dist/scripts/cleanup-finale.js` | implemente Story 5.2 v1.2 | [backend/src/scripts/cleanup-finale.ts](backend/src/scripts/cleanup-finale.ts) |

### Defense in Depth pour le dry-run (pattern Epic 6)

| Invariant | Garde | Defaut refuse |
|---|---|---|
| Backup baseline existe AVANT dry-run | **AC #4** : backup non vide + `gunzip -t` valide | Demarrer dry-run sans filet de retour |
| Restore valide en local | **AC #9** : 7 checks SQL post-restore | Backup non testable |
| Reset prod execute apres dry-run | **AC #11** : reset UI + verif SQL + smoke test | Live demarre avec dummies dry-run |
| OBS valide par SkyDow | **AC #10** : sign-off ecrit + screenshots | Hypothese non verifiee 4 epics |
| Performance mobile mesuree | **AC #2** : Lighthouse documente | "Ca semble fluide" subjectif |
| WebSocket multi-clients | **AC #6/#7/#8** : 4-5 connexions simultanees | Test mono-client trompeur |
| Bug bloquant traite avant J | **AC #14** : sign-off bloque sur hotfix livre | Live avec dette critique connue |
| Runbook ecrit a partir du vecu | **AC #13** : sequence reelle, pas theorique | Runbook fictif |
| Cleanup backups anciens | **AC #11** : `find -mtime +14 -delete` | Disque sature pendant le live |
| Cumul multi-journees correct | **AC #7** : verif visuelle bug retro Epic 5 v1.2 | Regression silencieuse |
| Garde finale lobby fixe | **AC #8** : verif bouton "Regenerer" masque | Regression invariant retro Epic 5 v1.2 |
| Detection victoire pre-round | **AC #8** : verif regle `preRoundTotal >= 20` | Regression retro Epic 5 v1.4 |

### Pieges typiques (anticiper pendant le dry-run)

1. **OBS "ne reflete pas"** — premier reflexe : F5 sur la page overlay (Ctrl+R) chez SkyDow. Si le probleme persiste : (a) verifier `/admin` qu'un round a bien ete valide (parfois on saisit sans valider), (b) verifier console DevTools de la page overlay (open via `Right-click > Inspect` dans OBS si supporte, sinon copier l'URL `/overlay` dans Chrome direct), (c) verifier `docker compose logs -f backend` pour voir si `ranking_updated` a bien ete emis. Cause typique : Brice a saisi mais oublie de valider, le broadcast n'est pas declenche tant que "Valider le round" n'est pas clique.

2. **Cumul multi-journees regresse** — le bug retro Epic 5 v1.2 (`computeLobbyGroups` random a chaque R1 de chaque journee au lieu de J1R1 uniquement) a ete fixe et est couvert par les tests. **Verification visuelle** au dry-run : J2R1 doit produire 2 lobbies Swiss (top 8 cumul ensemble), **pas** 2 lobbies aleatoires. Si J2R1 a l'air aleatoire, c'est une regression critique → story hotfix immediate.

3. **Garde FINALE_LOBBY_IS_FIXED** — le bug retro Epic 5 v1.2 (regenerer lobbies en finale supprimait le lobby unique) a ete corrige. **Verification visuelle** : en finale, le bouton "Regenerer les lobbies" est masque dans DayManager. Si visible, c'est une regression UI → fix mineur.

4. **Detection victoire pre-round vs post-round** — le bug retro Epic 5 v1.4 (`detectFinaleWinner` testait `totalScore >= 20` post-round au lieu de `preRoundTotal >= 20`) est corrige. Cas test pendant le dry-run : un joueur a 14 pts, fait top 1 d'un round (+8) → totalScore = 22 mais preRoundTotal = 14 < 20 → **PAS** victoire (continuer la finale). Si le systeme declenche victoire ici = regression critique.

5. **Latence saisie subjective** — NFR3 cible <200ms. Difficile a mesurer precisement sans DevTools chronometre, mais Brice peut juger "instantane" vs "lag perceptible". Si lag perceptible : (a) verifier latence reseau Brice (ping VPS), (b) verifier load PostgreSQL (`docker stats`), (c) si rien d'evident, accepter pour MVP et noter pour Epic 7 post-MVP.

6. **WebSocket reconnect apres restart backend** — story 4.1 AC #5 + story 3.1 AC #4. Brice fait `docker compose restart backend` 1 fois pendant le dry-run (idealement entre 2 rounds, pas en plein milieu d'une saisie) → tous les clients (admin, mobile, overlay OBS) doivent reconnecter automatiquement en <30s sans intervention humaine, et l'etat actuel doit etre re-livre. Si un client ne reconnecte pas, c'est une regression Socket.IO.

7. **Cert LE expirant pendant le live** — improbable (cert valide jusqu'au 2026-07-24, donc largement au-dela du 2026-05-17), mais le dry-run le verifie via `openssl s_client`. Renouvellement auto Traefik = oui, mais si jamais bloque (ex: rate limit improbable, port 80 ferme par erreur), bascule LE staging d'urgence (cf. README 6.1 Runbook section "Debug Let's Encrypt").

8. **DB corrompue / scenario "tout casse"** — peu probable mais : restore du dernier backup propre via la procedure validee en AC #9. C'est exactement pour ca qu'on teste le restore en local Docker Desktop avant le live. Brice doit avoir le backup le plus recent prêt avant chaque rendezvous critique (debut de chaque journee, debut de finale).

9. **Reset endpoints retour 401** — les endpoints `DELETE /api/admin/reset/*` sont JWT-protected. Si le token JWT expire (24h), Brice doit re-login. Symptome : clic "Reinitialiser les joueurs" → toast erreur generique. Action : re-login `/admin/login`.

10. **Mobile WebSocket sur 4G** — sur certains operateurs, les connexions WebSocket longues sont coupees apres X minutes d'inactivite. Socket.IO reconnecte automatiquement, mais ca peut causer des pertes de la 1ere update. Si Brice constate cela : (a) garder mobile sur wifi pendant le live, (b) accepter pour MVP, (c) post-MVP envisager heartbeat polling fallback.

11. **Reset cascade ordre** — `DELETE /api/admin/reset/players` cascade `LobbyPlayer → Lobby → Round → Day → Player` en transaction atomique (story 2.x post-Epic 5). Verification AC #11 : tous les COUNT = 0 confirme l'integrite du cascade. Si une table reste non-vide, c'est un bug critique de l'endpoint reset.

12. **Brice teste `/admin` sans relogin entre dry-run et reset prod** — entre la fin du dry-run et le reset prod J-7, ~7 jours peuvent s'ecouler. Le JWT expire apres 24h. Brice doit re-login avant de cliquer "Reinitialiser les joueurs" J-7. Pas un bug, juste une procedure a respecter.

### Reuses Epic 1-5 + Stories 6.1/6.2 (pas de reinvention)

| Asset existant | Reutilisation Epic 6.3 |
|---|---|
| Stack 4-services Docker (6.1 + 6.2) | Utilisee telle quelle, **aucune modification** |
| [docker/smoke-test.sh](docker/smoke-test.sh) (6.2 v1.x) | Re-execute pre-dry-run + post-reset (AC #1, #11) |
| [docker/backup-pg.sh](docker/backup-pg.sh) (6.1) | Execute 3+ fois (baseline, post-dry-run, final) (AC #4, #9, #11) |
| Reset endpoints `DELETE /api/admin/reset/*` (post-Epic 5 enhancement) | Utilises pour reset DB pre-dry-run et post-dry-run (AC #4, #11) |
| Script CLI fallback `cleanup-finale.ts` (5.2 v1.2) | Documente dans runbook section procedures d'urgence (AC #13) |
| Tests unitaires backend (64 verts) | Confiance baseline ; le dry-run n'execute pas les tests, il les confirme en e2e |
| Bundle frontend Epic 5 (148.27 kB gz `/finale`) | Servi en prod tel quel ; cible Lighthouse mobile >=75 (AC #2) |
| `tournament_state_changed` event Socket.IO | Verifie pendant inscriptions (AC #5) et reset (AC #4, #11) |
| `ranking_updated` event Socket.IO | Verifie a chaque validation round (AC #6, #7, #8) |
| Garde `FINALE_LOBBY_IS_FIXED` (5.2 v1.2) | Verifie visuellement bouton masque (AC #8) |
| Regle `preRoundTotal >= 20` (5.2 v1.4) | Verifie comportement (AC #8) |
| README.md Runbook (6.1 + 6.2) | **Etendu** par lien vers nouveau fichier `6-3-dry-run-runbook-jour-J.md` (AC #13) |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Lit pour identifier deferred items adresses (Epic 4 OBS, Epic 5 Lighthouse `/finale`, review 6.1 backup restore) |

### Lecture des deferred-work items adresses par cette story

Depuis [_bmad-output/implementation-artifacts/deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) :

1. **OBS `/overlay` validation par SkyDow** (deferred Epic 4) → adresse par AC #10 + Task 10 — sign-off SkyDow ecrit ferme le deferred item.
2. **Test de restauration backup PG en local Docker Desktop** (deferred review 6.1, severity Med) → adresse par AC #9 + Task 9 — restore E2E avec donnees reelles ferme le deferred item.
3. **Lighthouse mobile `/finale`** (deferred Epic 5 retro) → adresse par AC #2 + Task 2 — audit documente ferme le deferred item.

Items non adresses (laisses deferred non bloquants) : Mobile Nav Hamburger (Epic 1), email anti-spam mentions legales (Epic 1), pagination admin players (Epic 2), Redis Adapter Socket.IO multi-process (Epic 3), tests d'integration HTTP (Epic 5).

### Procedure backup + restore (procedure de reference pour AC #9 et runbook)

```bash
# === BACKUP (depuis le VPS) ===
ssh deploy@76.13.58.249
sudo /opt/tournoi-tft/docker/backup-pg.sh
# Produit /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz
ls -lh /root/backups/tournoi-*.sql.gz   # taille > 0
gunzip -t /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz   # exit 0 = gzip valide

# === DOWNLOAD (depuis machine dev Brice) ===
scp deploy@76.13.58.249:/root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz .

# === RESTORE EN LOCAL DOCKER DESKTOP (machine dev) ===
docker run --rm -d --name pg-restore-test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=tournoi_tft \
  -p 55432:5432 \
  postgres:17-alpine
# Attendre healthy : docker logs pg-restore-test (chercher "ready to accept connections")
sleep 10

gunzip -c tournoi-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i pg-restore-test psql -U test -d tournoi_tft

# === VERIFICATION (7 checks) ===
docker exec pg-restore-test psql -U test -d tournoi_tft -c '
  SELECT COUNT(*) AS players FROM "Player";
  SELECT COUNT(*) AS days FROM "Day";
  SELECT COUNT(*) AS rounds FROM "Round";
  SELECT COUNT(*) AS lobbies FROM "Lobby";
  SELECT username FROM "Admin";
  SELECT COUNT(*) AS dropped FROM "Player" WHERE status='\''dropped'\'';
  SELECT id, type, name FROM "Day" WHERE type='\''finale'\'';
'
# Cibles : players>=14, days=3, rounds>=8, lobbies coherent, admin=admin, dropped>=2, 1 finale

# === CLEANUP ===
docker stop pg-restore-test   # auto-suppression via --rm
```

### Procedure reset prod (procedure de reference pour AC #4 et #11)

```bash
# === BACKUP AVANT RESET ===
ssh deploy@76.13.58.249
sudo /opt/tournoi-tft/docker/backup-pg.sh

# === RESET VIA UI ADMIN (preferentiel) ===
# 1. Ouvrir https://tournoi.esportdessacres.fr/admin/login
# 2. Login avec username=admin + ADMIN_DEFAULT_PASSWORD (cf. backend/.env.prod)
# 3. Naviguer page Joueurs (lien sidebar)
# 4. Scroller en bas : zone dangereuse (3 boutons rouges)
# 5. Cliquer "Reinitialiser les joueurs" → confirmation → succes

# === VERIFICATION SQL POST-RESET ===
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/docker
set -a; . ./.env; set +a   # charge POSTGRES_USER + POSTGRES_DB
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '
  SELECT COUNT(*) AS players FROM "Player";
  SELECT COUNT(*) AS days FROM "Day";
  SELECT COUNT(*) AS rounds FROM "Round";
  SELECT COUNT(*) AS lobbies FROM "Lobby";
  SELECT COUNT(*) AS lobby_players FROM "LobbyPlayer";
  SELECT username FROM "Admin";
'
# Cibles : tout = 0 SAUF Admin = "admin"

# === SMOKE TEST POST-RESET ===
bash /opt/tournoi-tft/docker/smoke-test.sh \
  https://api-tournoi.esportdessacres.fr \
  https://tournoi.esportdessacres.fr
# Cible : 8/8 SUCCES

# === CLEANUP BACKUPS ANCIENS ===
sudo find /root/backups -name "tournoi-pre-dryrun-*.sql.gz" -mtime +14 -delete
ls -lh /root/backups/   # verifier qu'il reste les recents
```

### Project Structure Notes

- **Aucun fichier de code modifie** dans cette story. Frontend et backend figes depuis Epic 5.
- **3 nouveaux fichiers documentation** crees dans `_bmad-output/implementation-artifacts/` :
  - `6-3-dry-run-report-YYYYMMDD.md` (rapport detaille)
  - `6-3-dry-run-runbook-jour-J.md` (runbook operationnel J)
  - `6-3-dummy-players.txt` (16 pseudos prets a copier — Task 3)
- **1 fichier modifie** : `_bmad-output/implementation-artifacts/sprint-status.yaml` (transitions de statut).
- **1 fichier modifie potentiellement** : `_bmad-output/implementation-artifacts/deferred-work.md` (cocher items adresses : OBS, Lighthouse `/finale`, backup restore).
- **1 fichier modifie potentiellement** : `README.md` (lien vers le runbook dedie depuis la section Runbook).
- **Aucune modification** : `docker/`, `backend/`, `frontend/`, `_bmad-output/planning-artifacts/`.

### Regles d'execution

- **Pas de modification de code applicatif** — si bug critique : story `6-3-1-hotfix-*` distincte (workflow normal create-story → dev-story → code-review).
- **Backup AVANT et APRES** chaque etape critique (defense in depth).
- **Verification SQL apres reset** — pas de "ca semble vide" subjectif.
- **Sign-off SkyDow ecrit** (Discord screenshot, message email, ou champ dans le rapport) — pas verbal.
- **Lecture du runbook avant le 17 mai** — si Brice ne l'a pas lu, le runbook ne sert a rien.
- **Aucun "test sauvage" en prod sans backup** — si Brice veut explorer un comportement, soit en local Docker Desktop, soit avec un backup baseline frais.
- **Coordination SkyDow ferme** — si SkyDow non disponible avant 2026-05-10, **bloquant** Go-Live (story reste `in-progress`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-63](_bmad-output/planning-artifacts/epics.md) — definition Story 6.3 (6 ACs initiaux d'epic, deroules en 14 ACs comprehensive ici)
- [Source: _bmad-output/implementation-artifacts/6-1-deploiement-backend-docker-traefik.md](_bmad-output/implementation-artifacts/6-1-deploiement-backend-docker-traefik.md) — story precedente backend (15 ACs, action items review traites, deferred backup restore adresse ici en AC #9)
- [Source: _bmad-output/implementation-artifacts/6-2-deploiement-frontend-hostinger.md](_bmad-output/implementation-artifacts/6-2-deploiement-frontend-hostinger.md) — story frontend (11 ACs, container nginx, smoke test 8/8 OK 2026-04-25)
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-04-24.md](_bmad-output/implementation-artifacts/epic-5-retro-2026-04-24.md) — retro origine de plusieurs decisions : VPS-only, container nginx, dry-run avant 2026-05-10, validation OBS groupee dry-run, Lighthouse mobile `/finale` deferred, 3 bugs critiques retros (a verifier non-regression au dry-run)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) — items deferes : OBS `/overlay` (Epic 4), backup restore (review 6.1), Lighthouse `/finale` (retro Epic 5)
- [Source: docker/smoke-test.sh](docker/smoke-test.sh) — script smoke test 8 checks utilise AC #1 + AC #11
- [Source: docker/backup-pg.sh](docker/backup-pg.sh) — script backup PG utilise AC #4 + AC #9 + AC #11
- [Source: docker/docker-compose.yml](docker/docker-compose.yml) — stack 4-services figee (NE PAS modifier en 6.3)
- [Source: backend/src/routes/admin.ts:198-282](backend/src/routes/admin.ts) — endpoints `DELETE /api/admin/reset/{finale,qualifications,players}` utilises AC #4 + #11
- [Source: backend/src/scripts/cleanup-finale.ts](backend/src/scripts/cleanup-finale.ts) — script CLI fallback documente dans runbook AC #13
- [Source: README.md#runbook](README.md) — runbook 6.1+6.2 a etendre par lien vers le nouveau runbook dedie 6.3
- [Source: docs/UX-DESIGN.md](docs/UX-DESIGN.md) — UX-DR1-DR16 a verifier visuellement pendant le dry-run (overlay, top 8, drops, vainqueur or, etc.)
- Calendrier projet : 2026-04-25 (debut 6.3) → 2026-05-10 (deadline dry-run) → 2026-05-17 (live tournoi EDS)

### Decisions architecturales tracees

- **Story = validation operationnelle, pas dev** — pas de code applicatif modifie ; livrables = rapport + runbook + entrees Change Log.
- **Reset prod via UI admin** plutot que SQL direct ou script CLI — exerce les endpoints reset (qui peuvent etre utilises pendant le live), declenche `tournament_state_changed`, defense en profondeur via verification SQL post-reset.
- **Restore test en local Docker Desktop** plutot qu'en prod — eviter d'ecraser la DB live, suffisant pour valider la chaine `pg_dump → gunzip → psql` E2E.
- **Scope dry-run reduit (16 joueurs, 2 journees + finale)** — couvre tous les chemins critiques sans exiger une coordination 32+ personnes impossible en dry-run.
- **Sign-off Brice + SkyDow obligatoire** — la qualite "Go-Live" depend des 2 perspectives (admin + caster).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — story creation workflow BMad v6.3.0, 2026-04-25.

### Debug Log References

**2026-04-25 — Prep agent (Amelia, claude-opus-4-7)** :
- Aucun bug rencontre cote agent (pas de code modifie).
- Lecture story complete (495 lignes), Dev Notes assimilees, 14 ACs + 14 Tasks parses.
- Lecture `deferred-work.md` (29 lignes) pour identifier les 3 items adresses : OBS Epic 4, Lighthouse `/finale` Epic 5, backup restore review 6.1.
- Lecture `sprint-status.yaml` (94 lignes) pour identifier `6-3-dry-run-validation-go-live` en `ready-for-dev` (next eligible).
- Conformement Dev Notes ("agent comme ops co-pilote"), execution du perimetre agent : preparation des 3 artefacts documentation en amont, marquage `in-progress`.
- Actions BRICE / SKYDOW (12 sur 14 tasks) en attente — physiquement impossibles a executer par l'agent (SSH VPS requis sans cles, login UI admin requis sans password, dry-run live multi-personnes, validation OBS chez SkyDow distant).

### Completion Notes List

**Prep agent — 2026-04-25 (avant dry-run)** :

✅ **Task 3 sub-task** : `_bmad-output/implementation-artifacts/6-3-dummy-players.txt` cree avec 16 pseudos credibles (1-2 reels Brice + amis + 14-15 dummies thematiques TFT). Inclut cibles drops (lignes 12 et 14) et cible vainqueur potentiel (ligne 3) pour scenario clair durant la finale.

✅ **Task 13** : `_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md` cree (10 sections, ~600 lignes) — runbook **complet** issu des Dev Notes Story 6.3 + ACs. Procedures techniques copiables : pre-flight smoke test, backup, restore E2E, reset prod, restart backend controle, gestion drops, detection victoire, 9 procedures d'urgence (overlay decroche, perte reseau, finale "explose", backend down, postgres down, restart controle, bug critique, cert TLS, DB corrompue), section 5 restoration backup detaillee (procedure validee localement). Sections 3.x "vecu operationnel" a affiner avec chronos reels apres dry-run.

✅ **Task 12** : `_bmad-output/implementation-artifacts/6-3-dry-run-report-YYYYMMDD.md` cree (squelette 17 sections, ~400 lignes). Couvre les 14 ACs : metadata, scope, pre-flight, Lighthouse, coordination SkyDow, backup baseline, inscriptions, J1 (3 sous-sections : R1/R2/drop/R3), J2 (3 sous-sections : R1+verif cumul/drop/R2-R3+verif top 8), finale (3 sous-sections : demarrage/rounds/UX vainqueur), restore E2E avec 7 verifs SQL ciblees, sign-off OBS SkyDow (9 checks visuels + signature), performance multi-clients, issues, reset prod definitif, captures attendues, sign-off Go/No-Go (8 criteres), suite immediate. **A remplir** par Brice + SkyDow pendant et apres le dry-run reel — fichier renomme `6-3-dry-run-report-<date_reelle>.md` quand le dry-run est planifie.

✅ Story 6.3 marquee `in-progress` (sprint-status.yaml + story file).

**Actions BRICE en attente** (12 tasks, lourdes/operationnelles, calendrier <= 2026-05-10) :
- Task 1 (AC #1) : Pre-flight J-1 (smoke test 8/8, dig DNS, openssl s_client, docker compose ps).
- Task 2 (AC #2) : Audit Lighthouse mobile `/finale` (cible >= 75).
- Task 3 reste (AC #3) : Caler session SkyDow ferme avant 2026-05-10, brief, confirmation ecrite.
- Task 4 (AC #4) : Backup baseline pre-dry-run + reset DB + verif SQL.
- Task 5 (AC #5) : Inscriptions joueurs (publique mobile + dummies via /admin).
- Task 6 (AC #6) : Journee 1 qualif 3 rounds + 1 drop entre R2-R3 (cible CrimsonBlade).
- Task 7 (AC #7) : Journee 2 qualif 3 rounds + 1 drop entre R1-R2 (cible EmberSoul) + verif cumul.
- Task 8 (AC #8) : Finale 3-5 rounds + verif detection victoire pre-round.
- Task 9 (AC #9) : Backup post-dry-run + restore E2E local Docker Desktop + 7 verifs SQL.
- Task 11 (AC #11) : Reset prod definitif J-7 (~2026-05-10) + cleanup backups +14j.
- Task 12 (AC #12) : Remplir le squelette rapport avec chronos + observations + captures.
- Task 13 finalisation (AC #13) : Affiner sections 3.x runbook avec vecu reel + reference depuis README.md.
- Task 14 (AC #14) : Sign-off Go/No-Go + transitions sprint-status `in-progress → review → done`.

**Actions SKYDOW** (1 task) :
- ~~Task 10 (AC #10) : Validation OBS finale + 9 checks visuels~~ — **VALIDE 2026-04-25** : session test live Brice + SkyDow apres deploy v1.2/v1.3 (2 overlays). **Les 9 checks (a-i) sont passes** par SkyDow lors d'un mini-scenario complet (qualif → finale → vainqueur → restart backend). Reste a faire avec le rapport final du dry-run reel : 2+ captures formelles + sign-off ecrit "Go-Live OK overlay" signature SkyDow. **Le deferred-work item Epic 4 (validation OBS) est techniquement clos.**

### File List

**Crees par l'agent le 2026-04-25** :
- `_bmad-output/implementation-artifacts/6-3-dummy-players.txt` (Task 3 sub-task)
- `_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md` (Task 13, complet, a affiner sections 3.x apres dry-run)
- `_bmad-output/implementation-artifacts/6-3-dry-run-report-YYYYMMDD.md` (Task 12, squelette, a remplir + renommer date reelle)
- `frontend/src/pages/OverlayFinale.tsx` (v1.2 — feature live add, 259 lignes, mirroir Finale.tsx sans chrome UX-DR14, 4 etats winner/in-progress/preview/idle)

**Modifies par l'agent le 2026-04-25** :
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (transition `6-3-dry-run-validation-go-live` : `ready-for-dev → in-progress`)
- `_bmad-output/implementation-artifacts/6-3-dry-run-validation-go-live.md` (Status, Dev Agent Record, File List, Change Log v1.1 + v1.2)
- `frontend/src/App.tsx` (v1.2 — ajout route `/overlay/finale`, commit `21ea12b`)

**A creer / modifier par BRICE / SKYDOW pendant le dry-run** :
- `_bmad-output/implementation-artifacts/6-3-dry-run-report-<date_reelle>.md` (renommage + remplissage du squelette)
- `_bmad-output/implementation-artifacts/screenshots-dry-run/*` (4+ captures jointes au rapport, AC #12)
- `_bmad-output/implementation-artifacts/deferred-work.md` (cocher items adresses : OBS Epic 4, Lighthouse `/finale` Epic 5, backup restore review 6.1)
- `README.md` (section Runbook : lien vers `6-3-dry-run-runbook-jour-J.md`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (transition finale `in-progress → review → done` apres sign-off)

**Modification code applicatif (deviation v1.2 assumee)** :
- `frontend/src/pages/OverlayFinale.tsx` + `frontend/src/App.tsx` — feature add live (vs scope strict initial "no code modification"). Decision : Brice + SkyDow en seance live, lacune Story 4.1 (overlay qualif-only). Pas de hotfix `6-3-1-*` distinct cree car (a) nouvelle feature pas un bug, (b) rapidite live, (c) trace via Change Log v1.2 + commit `21ea12b`. Suite : retro a integrer dans Story 4.1 / Epic 4 retro.
- `backend/`, `docker/` toujours figes depuis Story 6.2.

## Change Log

| Version | Date | Auteur | Description |
|---------|------|--------|-------------|
| v1.0 | 2026-04-25 | Bob (Scrum Master / story context engine, claude-opus-4-7) | Creation story 6.3 comprehensive — 14 ACs (vs 6 dans epics.md), 14 tasks. Story de validation operationnelle (pas de code applicatif). Couvre : pre-flight smoke test + Lighthouse `/finale`, coordination SkyDow + dummies, backup baseline + reset DB, inscriptions + 2 journees qualif (3 rounds + 1 drop chacune) + cumul multi-journees, finale avec detection victoire (regle pre-round retro Epic 5), validation OBS SkyDow (deferred 4 epics), backup post-dry-run + restore E2E local Docker Desktop (deferred review 6.1), reset prod definitif J-7 + cleanup backups, rapport de dry-run + runbook jour J + sign-off Go/No-Go. Defense in Depth applique : 12 invariants gardes, 12 pieges anticipes, 7 verifications SQL post-restore, sign-off double Brice + SkyDow. Aucun fichier code touche — perimetre strict validation. Reuses 6.1 (smoke test, backup), 6.2 (smoke test etendu), Epic 5 (regles metier corrigees retro v1.2/v1.4 verifiees non-regression). Adresse 3 deferred-work items : OBS Epic 4, Lighthouse `/finale` Epic 5, backup restore review 6.1. |
| v1.1 | 2026-04-25 | Amelia (dev-story agent, claude-opus-4-7) | Status `ready-for-dev → in-progress`. **Prep agent (perimetre "ops co-pilote", cf. Dev Notes Story 6.3)** : 3 artefacts crees en amont du dry-run reel : (1) `6-3-dummy-players.txt` — 16 pseudos credibles avec cibles drops + vainqueur potentiel pour scenario clair, (2) `6-3-dry-run-runbook-jour-J.md` — runbook jour J COMPLET (10 sections, ~600 lignes : checklists J-1 + J-J 1h, sequence operationnelle, 9 procedures d'urgence couvrant les 12 pieges Dev Notes, restoration backup detaillee, reset prod J-7, contacts), (3) `6-3-dry-run-report-YYYYMMDD.md` — squelette rapport 17 sections couvrant les 14 ACs (a renommer date reelle + remplir avec chronos/observations/captures par Brice + SkyDow). 12 actions BRICE + 1 action SKYDOW en attente — non executables par l'agent (SSH VPS, login UI admin, dry-run live multi-personnes, validation OBS distant). HALT propre attendu : reprise dev-story apres dry-run pour cocher les Tasks/ACs et faire transition `in-progress → review`. |
| v1.2 | 2026-04-25 | Amelia (dev-story agent, claude-opus-4-7) | **Live feature add during dry-run prep with SkyDow** — **deviation assumee du scope strict 6.3 "no code modification"**, autorisee explicitement par Brice en seance live avec SkyDow. SkyDow a constate en testant l'overlay actuel `/overlay` que la vue mirroir uniquement la phase qualif (Story 4.1 = qualif-only) — UX-DR7 progression victoire et UX-DR8 animation or vainqueur jamais surfacees. Decision Option B (vs auto-switch) : **route distincte `/overlay/finale`** que SkyDow bascule manuellement dans la source navigateur OBS au moment du clic admin "Demarrer la finale". Implementation : nouvelle page `frontend/src/pages/OverlayFinale.tsx` (259 lignes, 4 etats mirroir Finale.tsx : winner/in-progress/preview top 8/idle, sans chrome UX-DR14, polices XL pour stream, support `?transparent=1`), route ajoutee dans `App.tsx`. Build local 489 modules 1.45s OK, bundle 149.25 kB gz (+1 kB vs Story 5.2 baseline). Commit `21ea12b` push origin/main, pull + rebuild + redeploy VPS Hostinger en ~30s, smoke test 8/8 OK post-deploy, `/overlay/finale` → HTTP 200 avec SPA shell. **A valider visuellement par SkyDow** durant le dry-run reel (AC #10 etendu : checks visuels desormais sur 2 URLs, pas 1). **Action follow-up** : creer une retro entry dans Story 4.1 (`4-1-overlay-stream-obs.md`) et ajouter mention dans la story 4.1 retro Epic 4 — la lacune "overlay finale absent" etait silencieuse depuis 4 epics. |
| v1.3 | 2026-04-25 | Amelia (dev-story agent, claude-opus-4-7) | **Live alignment overlay qualif** — Brice constate que `/overlay` (qualif) ne mirroir pas le rendu de `/qualifications` : Story 4.1 avait simplifie le tableau a `#/Joueur/Total` via `OverlayRankingTable`, perdant les colonnes Place/Pts par round/journee + Moyenne + Top 1 + Top 4 + Derniere + le `QualificationsHero` + `AnimatedSideDecor`. Decision : refondre `Overlay.tsx` pour reutiliser **les memes composants** que `Qualifications.tsx` (`RankingTable`, `QualificationsHero`, `AnimatedSideDecor`) avec freeze pattern qual-during-finale (anti-bug Story 5.2 AC #17), et garder support `?transparent=1`. Suppression `frontend/src/components/overlay/OverlayRankingTable.tsx` (sole consumer, 84 lignes mortes apres refonte). Build local 488 modules 411ms OK, bundle 149.02 kB gz (-0.22 kB grace au cleanup). Commit `0792bea` push origin/main, deploy VPS ~5s, smoke test 8/8 OK post-deploy. **Trade-off** : OBS 1920x1080 doit afficher un tableau plus large qu'avant — si SkyDow constate du scroll horizontal sur sa source navigateur, on adaptera (ex: max-w plus large + breakpoint specifique). |
| v1.4 | 2026-04-25 | Amelia (dev-story agent, claude-opus-4-7) | **Test session overlay SkyDow OK** — session live partagee Brice + SkyDow (~30 min) immediatement apres deploy v1.2 + v1.3. Brice confirme "parfait !" sur le rendu des 2 overlays : `/overlay` (qualif aligne `/qualifications` avec colonnes Place/Pts par round + Moy + Top 1/4 + Dern.) et `/overlay/finale` (mirroir `Finale.tsx` avec progression 20 pts UX-DR7 + animation or vainqueur UX-DR8). **Validation technique acquise** (rendu correct, bascule URL OBS fonctionnelle, deploy VPS reussi). **Validation operationnelle complete (9 checks AC #10 a-i) reservee au dry-run reel** — la session test ne couvrait pas tous les chemins (notamment (i) reconnexion auto apres restart backend, (h) chronos <2s mesures, (g) animation or vainqueur reel sur full finale). Action follow-up dry-run : SkyDow valide formellement les 9 checks et signe "Go-Live OK overlay" dans le rapport final. Cleanup memoire : ajouter une entree `feedback` "verifier rendu overlay = page publique correspondante a chaque epic touchant /qualifications ou /finale" pour eviter la regression Story 4.1 (overlay simplifie qui divergeait de la page publique). |
| v1.5 | 2026-04-25 | Amelia (dev-story agent, claude-opus-4-7) | **Task 10 / AC #10 VALIDE — 9 checks (a-i) OK** — Brice confirme que la session test couvrait l'integralite du AC #10 incluant (g) animation or vainqueur, (h) chronos <2s mesures, et (i) reconnexion auto apres `docker compose restart backend`. Mini-scenario complet realise : qualif (rounds + drops) → finale (rounds + detection victoire pre-round + animation or) → restart backend controle → reconnexion overlays validee. **Task 10 marquee [x]**, sub-tasks individuelles cochees par check. **Le deferred-work item Epic 4 (validation OBS overlay /overlay) — silencieux 4 epics depuis Story 4.1 — est techniquement clos.** Reste 2 sub-tasks formelles pour le rapport final dry-run : (a) 2+ captures screenshot overlay OBS jointes au rapport, (b) sign-off ecrit SkyDow "Go-Live OK overlay" signe (au-dela du "parfait" verbal acquis 2026-04-25). Update `deferred-work.md` : item OBS Epic 4 → coche "adresse 2026-04-25 par session test 6.3 (v1.2 + v1.3 + v1.4)". |
