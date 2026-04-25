# Runbook Jour J — Tournoi TFT EDS (2026-05-17)

> **Owner** : Brice (admin) | **Caster** : SkyDow (overlay OBS)
> **Stack** : VPS Hostinger 76.13.58.249 (Ubuntu 24.04), Docker Compose, 4 services (Traefik + PostgreSQL 17 + Backend Node 22 + Frontend nginx 1.27)
> **Domaines** : `https://api-tournoi.esportdessacres.fr` (backend) + `https://tournoi.esportdessacres.fr` (frontend)
> **Lecture obligatoire** par Brice **avant** le 2026-05-17 (et idealement par SkyDow).
> **Source** : ce runbook est issu du vecu du dry-run Story 6.3 (et non d'un theorique). Toute commande/clic ici a ete execute au moins 1 fois.

---

## 0. Statut "tout est OK" attendu (snapshot debut J)

| Verification | Cible attendue | Comment |
|---|---|---|
| `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` | `8/8 SUCCES` | 5 backend + 3 frontend |
| `dig +short api-tournoi.esportdessacres.fr` | `76.13.58.249` | DNS Hostinger stable |
| `dig +short tournoi.esportdessacres.fr` | `76.13.58.249` | DNS Hostinger stable |
| `openssl s_client -connect <domaine>:443` | issuer `Let's Encrypt R13`, notAfter >= 2026-05-24 | LE prod, valide jusqu'au 2026-07-24 |
| `ssh deploy@76.13.58.249 'cd /opt/tournoi-tft/docker && docker compose ps'` | 4 services `Up X (healthy)` | Traefik + postgres + backend + frontend |
| `https://tournoi.esportdessacres.fr/qualifications` mobile | "En attente de la 1ere journee" (etat idle) | DB vide applicative |
| `https://tournoi.esportdessacres.fr/finale` | "Finale pas encore commencee" | DB vide applicative |

---

## 1. Checklist J-1 (la veille du tournoi, 2026-05-16)

- [ ] **Smoke test 8/8 OK** :
  ```bash
  cd /e/Antigravity\ project/11\ site\ web\ tournoi\ tft
  bash docker/smoke-test.sh \
    https://api-tournoi.esportdessacres.fr \
    https://tournoi.esportdessacres.fr
  ```
  Cible : `8/8 SUCCES`. Si echec : voir section "Procedures d'urgence" → "Backend down" ou "Smoke test echoue".

- [ ] **Backup baseline pre-tournoi** :
  ```bash
  ssh deploy@76.13.58.249
  sudo /opt/tournoi-tft/docker/backup-pg.sh
  ls -lh /root/backups/tournoi-*.sql.gz | tail -3
  ```
  Renommer le plus recent en `tournoi-pre-jour-J-2026-05-16.sql.gz` (ou simplement noter le timestamp).
  Verifier integrite : `gunzip -t /root/backups/tournoi-pre-jour-J-*.sql.gz` → exit 0.

- [ ] **Confirmer DB applicative vide** (pas de residus dry-run) :
  ```bash
  ssh deploy@76.13.58.249
  cd /opt/tournoi-tft/docker
  set -a; . ./.env; set +a
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '
    SELECT COUNT(*) AS players FROM "Player";
    SELECT COUNT(*) AS days FROM "Day";
    SELECT username FROM "Admin";
  '
  ```
  Cible : `players=0`, `days=0`, `admin=admin`. Si != 0, executer le reset (cf. Story 6.3 AC #11).

- [ ] **Verifier cert TLS valide pendant tout mai** :
  ```bash
  echo | openssl s_client -connect api-tournoi.esportdessacres.fr:443 -servername api-tournoi.esportdessacres.fr 2>/dev/null | openssl x509 -noout -issuer -dates
  echo | openssl s_client -connect tournoi.esportdessacres.fr:443 -servername tournoi.esportdessacres.fr 2>/dev/null | openssl x509 -noout -issuer -dates
  ```
  Cibles : issuer `Let's Encrypt R13` (pas STAGING), notAfter >= 2026-05-24 (au moins 1 sem post-tournoi).

- [ ] **Briefer SkyDow** (Discord ou tel) :
  - URL overlay : `https://tournoi.esportdessacres.fr/overlay`
  - OBS source navigateur 16:9, taille 1920x1080
  - Combien de rounds environ : 4-6 par journee qualif (pas de limite — fin manuelle), finale 3-5 rounds
  - Comment signaler un decrochage overlay : Discord direct a Brice (ou voix si en call)

- [ ] **Lighthouse `/finale` mobile** (re-run rapide pour confirmer >= 75) :
  - Chrome DevTools → Lighthouse → mode mobile (Slow 4G + 4x CPU throttle)
  - URL : `https://tournoi.esportdessacres.fr/finale`
  - Cible : score Performance >= 75

- [ ] **Preparer dummies/joueurs** (si dry-run a montre que des inscriptions tardives sont a prevoir) :
  - Dossier `_bmad-output/implementation-artifacts/6-3-dummy-players.txt` pret en backup si des inscrits prevus n'arrivent pas

- [ ] **Verifier Discord EDS / canal annonce** : message d'ouverture rediee, avec `https://tournoi.esportdessacres.fr/qualifications` lien clair.

---

## 2. Checklist J-J — 1h avant le debut du tournoi (2026-05-17, T-60min)

- [ ] **Login admin** : `https://tournoi.esportdessacres.fr/admin/login`
  - username : `admin`
  - password : `ADMIN_DEFAULT_PASSWORD` du `backend/.env.prod` (Brice connait)
  - **Si JWT expire pendant le tournoi (apres ~24h)** : re-login simple, pas de panic.

- [ ] **Chrome desktop pret** avec onglets :
  - `https://tournoi.esportdessacres.fr/admin` (page Joueurs + DayManager)
  - `https://tournoi.esportdessacres.fr/qualifications` (controle visuel public)
  - `https://tournoi.esportdessacres.fr/finale` (a ouvrir en finale)
  - DevTools Network ouvert si possible (chrono saisie/WebSocket)

- [ ] **Mobile pret** (Brice + idealement 1 ami) :
  - `https://tournoi.esportdessacres.fr/qualifications` ouvert
  - WiFi prefere a 4G (ref. piege #10 Story 6.3 — operateurs coupent WS apres X min)
  - Si bascule 4G necessaire : Socket.IO reconnect automatique en <30s

- [ ] **OBS de SkyDow lance** avec **2 sources navigateur preparees** (depuis v1.2/v1.3 du 2026-04-25, cf. Story 6.3 Change Log) :
  - Source 1 : `https://tournoi.esportdessacres.fr/overlay` (phase qualif, mirroir `/qualifications`)
  - Source 2 : `https://tournoi.esportdessacres.fr/overlay/finale` (phase finale, mirroir `/finale` avec progression 20 pts UX-DR7 + animation or vainqueur UX-DR8)
  - Taille des deux : 1920x1080
  - **Workflow bascule** : SkyDow garde Source 1 visible pendant les qualifs, et bascule sur Source 2 (ou alterne la visibilite des sources dans la scene OBS) au moment ou Brice clique "Demarrer la finale". L'overlay finale s'auto-affiche en etat correct (preview top 8 → en cours → vainqueur) selon le state cote backend.
  - Verifier que le compteur joueurs initial = 0 (DB vierge) sur les deux sources
  - Support `?transparent=1` disponible sur les 2 URLs si chroma key necessaire

- [ ] **Pre-flight check final 5 min avant** :
  ```bash
  bash docker/smoke-test.sh \
    https://api-tournoi.esportdessacres.fr \
    https://tournoi.esportdessacres.fr
  ```
  → 8/8 OK. Si != 8/8, declencher procedure d'urgence appropriee.

---

## 3. Sequence operationnelle — pas-a-pas pendant le tournoi

> **Source** : sequence vecue lors du dry-run Story 6.3 (cf. `6-3-dry-run-report-YYYYMMDD.md`). Ajuster les chronos selon le nombre reel d'inscrits le jour J (cibles dry-run = 16 joueurs, mais le vrai tournoi peut etre plus large — la stack supporte sans limite).

### 3.1. Inscriptions (T-30min jusqu'a T+30min)

- Inscriptions publiques se font via `https://tournoi.esportdessacres.fr/` (formulaire mobile-first).
- Brice surveille `/admin` page Joueurs : la liste se rafraichit automatiquement (broadcast `tournament_state_changed`).
- Si un joueur signale "ma soumission a echoue" : Brice peut l'ajouter via `/admin` → page Joueurs → "Ajouter un joueur" (saisie manuelle).
- **Limite** : pas de cap technique, cible PRD ~32 joueurs.

### 3.2. Demarrage Journee 1 — Round 1

- [ ] Tous les joueurs sont inscrits → fermer les inscriptions (ne pas accepter de retardataires apres ce moment ; possible mais cree desordre).
- [ ] `/admin` → DayManager → "Demarrer la journee".
  - **Resultat** : Day 1 (`type='qualification'`) cree, status `in-progress`.
- [ ] "Generer les lobbies" R1.
  - **Resultat** : N lobbies de ~8 joueurs (via `generateRandomLobbies`, FR6 — random pour J1R1 uniquement).
  - **Verification visuelle** : ouvrir chaque lobby, joueurs aleatoirement repartis (pas de pattern ELO).
- [ ] **Annoncer aux joueurs** : "vos lobbies sont prets, lancez TFT, faites votre partie".

### 3.3. Cycle round (toutes les ~25-35 min selon partie TFT)

> **Repeter** ce cycle pour chaque round. Pas de limite sur le nombre de rounds par journee — fin manuelle via "Terminer la journee" (FR17, memoire `pas de limite de rounds par journee`).

- [ ] Joueurs terminent leur partie TFT, signalent leur placement (via Discord vocal ou texte).
- [ ] Brice clique sur le lobby concerne dans `/admin` → saisit les placements (dropdown 1-8).
  - **Latence cible** : <200ms perçue (NFR3). Si lag perceptible, voir piege #5 dans Dev Notes Story 6.3.
- [ ] "Valider le round".
  - **Verification** : broadcast `ranking_updated` declenche.
  - **Cibles temps reel** :
    - `/qualifications` mobile/desktop : update <2s (NFR2).
    - Overlay OBS chez SkyDow : update <2s (NFR2).
  - Si update tarde >5s : F5 sur la page qui pose probleme. Si OBS tarde, F5 dans la source navigateur OBS (clic droit → Refresh dans la source si supporte).
- [ ] Round suivant : "Generer les lobbies" RN.
  - **Resultat** : lobbies Swiss (les mieux classes ensemble, les moins bien classes ensemble — `aggregateQualificationRankings`).
  - **Verification cumul multi-journees** (J2R1+ critique) : en J2R1, les lobbies doivent reflêter le cumul J1, **pas un re-random** (ref. piege #2 Dev Notes — bug retro Epic 5 v1.2 corrige).

### 3.4. Gestion drops (en cours de journee)

- Un joueur signale qu'il abandonne ?
  - [ ] `/admin` → page Joueurs → trouver le joueur → bouton "Drop" (ou via DayManager si plus rapide).
  - [ ] Confirmation → joueur passe `status='dropped'`.
- **Resultat attendu** :
  - Le joueur **disparait** des lobbies des rounds suivants (FR16).
  - Il **conserve** ses points cumules (FR16).
  - Il apparait **grise/barre** dans `/qualifications` (UX-DR6).
  - Le compte total de lobbies du round suivant est ajuste (ex: 16 actifs - 1 drop = 15 → 1 lobby de 8 + 1 lobby de 7).

### 3.5. Fin de journee qualif

- [ ] Quand Brice juge que la journee est finie (souvent 4-6 rounds) :
  - "Terminer la journee" → Day passe `completed`.
  - Plus de bouton "Generer lobbies" pour cette Day (FR17).
- [ ] **Pause communautaire** : annoncer le break dans Discord, donner l'heure de reprise.

### 3.6. Demarrage Journee 2 (si pas la finale directement)

- [ ] "Demarrer la journee" → Day 2 (`type='qualification'`).
- [ ] "Generer les lobbies" R1 J2.
  - **Critique** : ces lobbies sont **Swiss sur le cumul J1** (les top 8 cumul ensemble, les bottom 8 ensemble), **pas un re-random**.
  - **Si J2R1 a l'air aleatoire** : c'est une regression du bug retro Epic 5 v1.2 → declencher procedure "Bug critique pendant tournoi" (section 4.7).
- [ ] Cycle rounds identique a J1.

### 3.7. Demarrage Finale

- [ ] J1+J2 (ou J1 seule si tournoi 1-jour) terminees, Brice verifie le top 8 cumul dans `/admin` :
  - Page Classement : tri par totalScore desc + tiebreakers (FR13, FR15).
  - Verifier visuellement les 8 premiers (UX-DR5, mis en valeur).
- [ ] DayManager → "Demarrer la finale".
  - **Resultat atomique** (transaction Prisma) : Day finale + Round 1 + 1 Lobby unique de 8 + 8 LobbyPlayer.
  - **Si la transaction echoue** : aucune Day finale creee (atomicite garantie). Re-tenter.
- [ ] **SkyDow bascule sa source OBS** : passer de `/overlay` (qualif) a `/overlay/finale` (preview top 8 → en cours apres validation R1, animation or vainqueur a la victoire).
- [ ] **Annoncer le top 8 finalistes** dans Discord + sur stream avec SkyDow.
- [ ] Ouvrir `/finale` publique sur desktop pour controle visuel :
  - 8 finalistes affiches avec barre de progression victoire (UX-DR7).
  - Bouton "Regenerer les lobbies" est **masque** (garde `FINALE_LOBBY_IS_FIXED`, retro Epic 5 v1.2).
  - **Si le bouton est visible** : c'est une regression UI critique → fix mineur ou story hotfix selon urgence.

### 3.8. Cycle round finale (3-5 rounds attendus)

- [ ] Saisie placements pour les 8 finalistes, "Valider".
- [ ] **Detection victoire** (regle pre-round, retro Epic 5 v1.4) :
  - Un joueur ayant `preRoundTotal >= 20` (cumule **avant** le round courant) ET termine **top 1 du round** = vainqueur.
  - Exemple **non-victoire** : joueur a 14 pts pre-round, top 1 du round (+8 pts) → totalScore=22 mais preRoundTotal=14 < 20 → continuer la finale.
  - Exemple **victoire** : joueur a 22 pts pre-round, top 1 du round → vainqueur immediat.
- [ ] A la victoire :
  - Backoffice indique le vainqueur (FR23).
  - `/finale` publique affiche animation/or `#DAB265` (UX-DR8).
  - Overlay OBS reflete egalement le vainqueur.
  - Day finale passe `completed`, plus de bouton "Round suivant".

### 3.9. Post-tournoi (T+0)

- [ ] **Annoncer le vainqueur** dans Discord EDS + sur stream avec SkyDow.
- [ ] **Screenshot final** :
  - `/finale` publique avec animation vainqueur (pour archives EDS).
  - Overlay OBS au moment de la victoire (pour archive SkyDow).
- [ ] **Backup post-event** :
  ```bash
  ssh deploy@76.13.58.249
  sudo /opt/tournoi-tft/docker/backup-pg.sh
  ls -lh /root/backups/tournoi-*.sql.gz | tail -1
  ```
  Renommer en `tournoi-post-event-2026-05-17.sql.gz` (ou retenir le timestamp).
  Verifier `gunzip -t` → exit 0.
- [ ] **Message Discord communaute** : remerciements, classement final, lien vers `/qualifications` qui restera consultable.
- [ ] **Brice et SkyDow** : signer un mini-rapport post-event (ce qui a marche, ce qui a surpris) — utile pour edition 2 du tournoi.

---

## 4. Procedures d'urgence

### 4.1. Overlay OBS decroche / n'affiche plus la mise a jour

**Symptome** : SkyDow signale que l'overlay reste fige sur l'avant-dernier round, alors qu'un nouveau round vient d'etre valide.

**Diagnostic en 30s** :
1. Brice verifie sur `/admin` que le round est bien **valide** (pas seulement saisi). Le broadcast `ranking_updated` n'est emis qu'au clic "Valider le round".
2. Brice verifie `/qualifications` desktop chez lui : se met a jour ?
   - **OUI** → probleme cote OBS de SkyDow (cf. action B).
   - **NON** → probleme cote backend ou WebSocket (cf. action A).

**Action A — backend ou WebSocket** :
```bash
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/docker
docker compose logs --tail 100 backend
# Chercher : "broadcast ranking_updated" ou erreurs Socket.IO
docker compose ps
# Cible : 4 services healthy
```
Si backend `Up X (unhealthy)` : `docker compose restart backend` (cf. 4.6).

**Action B — OBS source navigateur** :
- SkyDow : clic droit sur la source navigateur dans OBS → "Properties" → bouton "Refresh cache of current page" (sinon F5 si supporte).
- Si decrochage repete : SkyDow recree la source navigateur (Add → Browser source → URL `/overlay`).

### 4.2. Brice perd le reseau (wifi instable)

**Action immediate** : bascule 4G mobile (les sites tournent toujours sur le VPS, pas un probleme local).

- Re-login `/admin/login` si JWT a expire.
- Reprendre la sequence ou Brice s'est arrete (les rounds en cours sont preserves cote DB).
- **Pas de saisie en double** : verifier sur `/admin` quel etait l'etat avant la perte reseau (ex: round en attente de validation) avant de continuer.

### 4.3. Finale "explose" (placement saisi a tort, regression visible, etc.)

**Option 1 — Reset finale via UI admin (preferentiel)** :
- `/admin` → page Joueurs → zone dangereuse → "Reinitialiser la finale".
- Confirmation → la Day finale est supprimee (cascade LobbyPlayer → Lobby → Round → Day).
- Les Days qualifs et joueurs sont **preserves**.
- "Demarrer la finale" → recree une nouvelle finale propre avec le top 8 cumul.

**Option 2 — Script CLI fallback** (si UI inaccessible) :
```bash
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/backend
docker compose -f /opt/tournoi-tft/docker/docker-compose.yml exec backend node dist/scripts/cleanup-finale.js
# Ou directement depuis l'host si node 22 dispo, mais le container est plus sur
```
Documente Story 5.2 v1.2 + Enhancement 2026-04-18 (deferred-work.md).

### 4.4. Backend down (`docker compose ps` montre backend exited ou unhealthy)

```bash
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/docker
docker compose logs --tail 200 backend > /tmp/backend.log
cat /tmp/backend.log | tail -50
docker compose restart backend
sleep 10
docker compose ps  # cible : backend Up X (healthy)
bash /opt/tournoi-tft/docker/smoke-test.sh \
  https://api-tournoi.esportdessacres.fr \
  https://tournoi.esportdessacres.fr
# Cible : 5 backend checks /5
```

Si restart ne suffit pas :
- Verifier env : `cat .env` → POSTGRES_USER, POSTGRES_PASSWORD, ADMIN_DEFAULT_PASSWORD, JWT_SECRET tous presents.
- Recreer container : `docker compose up -d --force-recreate backend`.
- En dernier recours : `docker compose down && docker compose up -d` (downtime ~30s).

### 4.5. PostgreSQL down

```bash
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/docker
docker compose logs --tail 100 postgres
docker compose ps postgres
docker compose restart postgres
sleep 20
docker compose ps postgres  # cible : Up X (healthy)
docker compose exec -T postgres pg_isready -U "$POSTGRES_USER"  # cible : "accepting connections"
```

Si DB corrompue (improbable mais documente) : suivre **section 5 — Restoration backup en urgence**.

### 4.6. Restart backend controle (test reconnexion auto Socket.IO)

> Utilisation : pour tester la reconnexion (story 4.1 AC #5 + story 3.1 AC #4) en debut de tournoi, ou apres un patch hotfix.

```bash
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/docker
docker compose restart backend
# Attendre 10s
docker compose ps backend  # cible : healthy
```

**Verification cote clients** : tous les clients (admin, mobile, overlay OBS) doivent reconnecter en <30s automatiquement, sans intervention humaine. L'etat actuel est re-livre.

### 4.7. Bug critique pendant tournoi (regression non vue au dry-run)

**Si le bug est BLOQUANT (impossible de continuer sans fix)** :
- Communiquer immediatement aux joueurs : "petit incident technique, reprise dans 5-10 min".
- Brice + dev (LLM agent en backup) creent une story hotfix `6-3-1-hotfix-<nom>` :
  - Identification root cause (logs, code).
  - Fix minimal.
  - Build + redeploy backend ou frontend selon zone.
  - Re-smoke test.
- Cible : <15 min de downtime perçu.

**Si le bug est NON BLOQUANT (workaround possible)** :
- Noter dans `_bmad-output/implementation-artifacts/post-event-bugs.md`.
- Continuer le tournoi avec workaround.
- Fixer post-event en story regular.

### 4.8. Cert TLS expire pendant le live (improbable, valable jusqu'au 2026-07-24)

```bash
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/docker
docker compose logs --tail 200 traefik | grep -i "letsencrypt\|acme\|certificate"
# Si rate-limit Let's Encrypt : passer LE staging d'urgence (cf. README 6.1 section "Debug Let's Encrypt")
# Editer docker-compose.yml : remplacer caServer par https://acme-staging-v02.api.letsencrypt.org/directory
# Puis: docker compose up -d traefik (cert auto-genere mais NON FIABLE par les navigateurs)
```

**Note** : un cert staging va declencher des warnings navigateur "Connection not private" → utilisable en derniere extremite uniquement, communiquer aux joueurs "cliquer sur Avance → continuer quand meme".

### 4.9. DB corrompue / "tout casse"

→ Voir **section 5 — Restoration backup en urgence**.

---

## 5. Restoration backup en urgence

> **Source** : procedure validee end-to-end pendant le dry-run Story 6.3 AC #9 (deferred review 6.1 ferme).

### 5.1. Quand utiliser

- DB postgres corrompue (improbable, mais tous les autres reflexes ont echoue).
- Reset accidentel (ex: clic "Reinitialiser les joueurs" pendant le live).
- Crash hardware VPS (Hostinger doit aussi avoir leurs backups, mais on a notre propre filet).

### 5.2. Procedure complete (10-15 min)

```bash
# === 1. Stopper le backend pour eviter ecritures concurrentes ===
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/docker
docker compose stop backend
# postgres reste Up (sinon tu ne peux pas restaurer)

# === 2. Identifier le backup le plus recent valide ===
ls -lh /root/backups/tournoi-*.sql.gz
# Choisir le plus recent : celui de J-1 si dispo, sinon le pre-event J-J 1h
# Verifier integrite : gunzip -t /root/backups/<fichier>.sql.gz → exit 0

# === 3. Drop + Recreate la base (DESTRUCTIF — confirme par Brice avant) ===
set -a; . ./.env; set +a
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\";"

# === 4. Restaurer le dump ===
gunzip -c /root/backups/tournoi-<timestamp>.sql.gz | \
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# === 5. Verifier integrite ===
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '
  SELECT COUNT(*) AS players FROM "Player";
  SELECT COUNT(*) AS days FROM "Day";
  SELECT COUNT(*) AS rounds FROM "Round";
  SELECT username FROM "Admin";
'
# Cibles : nombres correspondant au backup (verifier vs ce qui etait attendu juste avant le crash)

# === 6. Redemarrer le backend ===
docker compose start backend
sleep 10
docker compose ps  # cible : 4 healthy

# === 7. Smoke test ===
bash /opt/tournoi-tft/docker/smoke-test.sh \
  https://api-tournoi.esportdessacres.fr \
  https://tournoi.esportdessacres.fr
# Cible : 8/8 OK

# === 8. Verifier UI ===
# Ouvrir https://tournoi.esportdessacres.fr/qualifications mobile
# Doit afficher l'etat tel que sauvegarde dans le backup
```

### 5.3. Test prealable de la procedure (livrable AC #9, fait pendant Story 6.3 dry-run)

> Procedure validee en **local Docker Desktop** Brice (machine dev), **pas en prod** (eviter d'ecraser une DB live), avec un dump issu d'un dry-run reel (16 joueurs + 2 journees + finale + vainqueur).

```bash
# === Backup VPS → local ===
scp deploy@76.13.58.249:/root/backups/tournoi-postdryrun-*.sql.gz .

# === Container PG ephemere local (port 55432 pour pas conflit) ===
docker run --rm -d --name pg-restore-test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=tournoi_tft \
  -p 55432:5432 \
  postgres:17-alpine
sleep 10  # attendre healthy

# === Restore ===
gunzip -c tournoi-postdryrun-*.sql.gz | docker exec -i pg-restore-test psql -U test -d tournoi_tft

# === 7 verifications SQL (AC #9) ===
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

# === Cleanup local ===
docker stop pg-restore-test  # auto-supprime via --rm
```

---

## 6. Reset prod definitif (a executer ~J-7, soit autour 2026-05-10, apres dry-run validee)

> **Pourquoi** : la DB prod ne doit **pas** demarrer le 2026-05-17 avec les ~16 dummies du dry-run. AC #11 Story 6.3.

```bash
# === 1. Backup archive AVANT reset ===
ssh deploy@76.13.58.249
sudo /opt/tournoi-tft/docker/backup-pg.sh
ls -lh /root/backups/tournoi-*.sql.gz | tail -1
# Renommer en tournoi-postdryrun-final-2026-05-XX.sql.gz pour archive nominative

# === 2. Reset via UI admin (preferentiel) ===
# Dans le navigateur :
# - https://tournoi.esportdessacres.fr/admin/login
# - login admin
# - Page Joueurs (sidebar)
# - Scroller en bas → zone dangereuse → "Reinitialiser les joueurs"
# - Confirmation modal → succes (toast vert)

# === 3. Verifications SQL post-reset ===
ssh deploy@76.13.58.249
cd /opt/tournoi-tft/docker
set -a; . ./.env; set +a
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '
  SELECT COUNT(*) AS players FROM "Player";
  SELECT COUNT(*) AS days FROM "Day";
  SELECT COUNT(*) AS rounds FROM "Round";
  SELECT COUNT(*) AS lobbies FROM "Lobby";
  SELECT COUNT(*) AS lobby_players FROM "LobbyPlayer";
  SELECT username FROM "Admin";
'
# Cibles : tout = 0 SAUF Admin = "admin"

# === 4. Smoke test post-reset ===
bash /opt/tournoi-tft/docker/smoke-test.sh \
  https://api-tournoi.esportdessacres.fr \
  https://tournoi.esportdessacres.fr
# Cible : 8/8 OK

# === 5. Verification UI ===
# Ouvrir https://tournoi.esportdessacres.fr/qualifications mobile → "En attente de la 1ere journee"
# Ouvrir https://tournoi.esportdessacres.fr/finale → "Finale pas encore commencee"

# === 6. Cleanup backups anciens (memoire feedback_infra_review_checklist item #3) ===
sudo find /root/backups -name "tournoi-pre-dryrun-*.sql.gz" -mtime +14 -delete
ls -lh /root/backups/  # verifier qu'il reste les recents (notamment le tournoi-postdryrun-final-*)
```

---

## 7. Contacts d'urgence

| Role | Personne | Canal | Disponibilite |
|---|---|---|---|
| Admin tournoi | Brice (bricecharley@gmail.com) | Discord EDS / mobile | J + J-1 + J+1 |
| Caster / overlay OBS | SkyDow | Discord EDS | J entier |
| Hosting VPS | Hostinger support | https://www.hostinger.com/contact | 24/7 (ticket + chat) |
| Communaute EDS | Discord EDS canal #annonces | Discord EDS | J entier |

**Numero mobile Brice** : (a renseigner par Brice avant J).

---

## 8. Checklist post-tournoi (J+1, 2026-05-18)

- [ ] **Backup post-event final** :
  ```bash
  ssh deploy@76.13.58.249
  sudo /opt/tournoi-tft/docker/backup-pg.sh
  # Renommer en tournoi-event-final-2026-05-17.sql.gz
  ```

- [ ] **Sauvegarde locale** (defense en profondeur) :
  ```bash
  scp deploy@76.13.58.249:/root/backups/tournoi-event-final-2026-05-17.sql.gz \
    /e/Antigravity\ project/11\ site\ web\ tournoi\ tft/backups-archive/
  ```

- [ ] **Screenshots archives** dans `_bmad-output/event-archive-2026-05-17/` :
  - `/finale` au moment de la victoire (vainqueur en or).
  - Overlay OBS au moment de la victoire (depuis SkyDow).
  - `/qualifications` final post-event.
  - Page Classement admin avec top 8.

- [ ] **Mini-retrospective** (~30 min, Brice + SkyDow) :
  - Ce qui a marche bien.
  - Ce qui a surpris (positif ou negatif).
  - Ce qu'il faudrait ameliorer pour edition 2.
  - Documente dans `_bmad-output/implementation-artifacts/event-retrospective-2026-05-17.md`.

- [ ] **Archivage stack** : laisser tourner 1 mois pour que les joueurs puissent revenir consulter `/qualifications`. Apres, decision : eteindre le VPS ou maintenir si edition 2 prevue.

---

## 9. References

- [Story 6.3 — Dry-run & validation Go-Live](6-3-dry-run-validation-go-live.md)
- [Story 6.1 — Deploiement backend Docker + Traefik](6-1-deploiement-backend-docker-traefik.md)
- [Story 6.2 — Deploiement frontend nginx](6-2-deploiement-frontend-hostinger.md)
- [docker/smoke-test.sh](../../docker/smoke-test.sh) — script smoke test 8 checks
- [docker/backup-pg.sh](../../docker/backup-pg.sh) — script backup PG
- [docker/docker-compose.yml](../../docker/docker-compose.yml) — stack 4-services
- [backend/src/scripts/cleanup-finale.ts](../../backend/src/scripts/cleanup-finale.ts) — script CLI fallback
- [README.md](../../README.md) — runbook 6.1 + 6.2 (etendu par ce document)
- [deferred-work.md](deferred-work.md) — items deferres (3 adresses par 6.3 : OBS, Lighthouse `/finale`, backup restore)

---

## 10. Change Log

| Version | Date | Auteur | Description |
|---|---|---|---|
| v1.0 | 2026-04-25 | Amelia (dev-story agent, claude-opus-4-7) | Squelette runbook jour J prepare en amont du dry-run. Procedures techniques completes (backup, restore, reset, smoke test, restart backend, gestion drops, detection victoire). Sections vecu (3.x) a affiner pendant le dry-run avec chronos reels et observations. Section 4 procedures d'urgence basee sur les 12 pieges identifies en Dev Notes Story 6.3. Section 5 restoration backup = procedure exacte issue de l'AC #9 (livrable deferred-work review 6.1). |
| v1.1 | 2026-04-25 | Amelia (dev-story agent, claude-opus-4-7) | **Mise a jour 2 URLs overlay** apres feature live add v1.2/v1.3 Story 6.3 : section 2 (Checklist J-J 1h) elargie pour preparer 2 sources navigateur dans OBS (`/overlay` qualif + `/overlay/finale` finale), avec workflow bascule au moment du clic admin "Demarrer la finale" + mention `?transparent=1` chroma key support. Section 3.7 (Demarrage Finale) : ajout step "SkyDow bascule sa source OBS". Sequence reflete le nouveau pattern Option B (bascule manuelle, pas auto-switch). |
