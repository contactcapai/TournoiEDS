# TournoiEDS + Vitrine — Esport des Sacres (monorepo)

Monorepo Turborepo/pnpm : tournoi TFT + site vitrine association EDS.

## Structure

- `apps/tournoi-web/` — Application React tournoi (Vite + TypeScript + Tailwind)
- `apps/tournoi-api/` — API Express tournoi (TypeScript + Prisma + Socket.IO)
- `apps/vitrine/` — Site vitrine Next.js (esportdessacres.fr)
- `packages/` — Packages partagés (@repo/ui, @repo/eslint-config, @repo/typescript-config)
- `docker/` — Infrastructure Docker prod (Traefik + tournoi + vitrine + Supabase)

> 📘 **Reprise d'exploitation par l'asso** : [`docs/PASSATION.md`](docs/PASSATION.md) —
> démarrer/arrêter la stack, mises à jour, sauvegardes & restauration, tâches courantes
> et rationale « boring tech » (aucune dépendance à un prestataire unique, NFR6).

## Demarrage rapide

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

## Variables d'environnement

Copier `.env.example` en `.env` et configurer les valeurs.

## Scripts utilitaires

### Reset tournoi depuis l'admin UI (recommandé)

Depuis 2026-04-18, la page Joueurs du backoffice expose une **zone dangereuse** en bas de page avec 3 boutons :

- **Réinitialiser la finale** — supprime uniquement la `Day type='finale'` et ses données (rounds, lobbies, placements). Qualifs et joueurs intacts.
- **Réinitialiser les qualifications** — supprime toutes les `Day` (qualifs + finale dépendante). Joueurs intacts.
- **Réinitialiser les joueurs** — reset complet : joueurs + historique de tournoi.

Chaque action déclenche une confirmation explicite et émet `tournament_state_changed` vers l'overlay et les pages publiques.

### `cleanup-finale` — réinitialiser la phase finale (CLI, fallback)

Équivalent CLI du bouton "Réinitialiser la finale". Supprime la `Day` `type='finale'` actuelle et toutes ses données dépendantes (`Round`, `Lobby`, `LobbyPlayer`) en transaction atomique. À utiliser si l'admin UI est inaccessible.

```bash
cd backend
npm run build
node dist/scripts/cleanup-finale.js
```

Après exécution, recliquer sur "Lancer la finale" dans l'admin recrée une finale propre via `POST /api/admin/finale/start` (Story 5.1).

## Deploy

Déploiement **manuel** sur le VPS Hostinger (pas de CI/CD). Le frontend est servi par un container nginx co-localisé sur le même VPS, derrière Traefik (cf. service `frontend` dans `docker/docker-compose.yml`).

### Pré-requis

- VPS Ubuntu 24.04 LTS (ici `<IP_VPS>`) fraîchement provisionné.
- Accès DNS chez Hostinger pour `esportdessacres.fr`.
- Clé SSH publique de la machine de dev (Brice) prête à être installée sur le VPS.
- Email valide pour les notifications Let's Encrypt.

### Variables d'environnement

Deux fichiers `.env` **distincts**, **jamais commités** (cf. `.gitignore`). Utiliser `openssl rand -base64 32` pour générer les secrets forts.

#### `docker/.env` — substitution `${VAR}` dans `docker-compose.yml`

| Nom | Description | Exemple | Secret |
|---|---|---|---|
| `POSTGRES_DB` | Nom de la base applicative | `tournoi_tft` | non |
| `POSTGRES_USER` | User PG applicatif | `tournoi` | non |
| `POSTGRES_PASSWORD` | Mot de passe PG (fort) | `<openssl rand -base64 32>` | **oui** |
| `LETSENCRYPT_EMAIL` | Email contact ACME | `bricecharley@gmail.com` | non |
| `LETSENCRYPT_CA_SERVER` | CA server Let's Encrypt | `https://acme-staging-v02.api.letsencrypt.org/directory` (puis bascule prod) | non |

#### `backend/.env.prod` — lu par le container backend (`env_file`)

| Nom | Description | Exemple | Secret |
|---|---|---|---|
| `NODE_ENV` | Mode d'exécution | `production` | non |
| `PORT` | Port interne container | `3001` | non |
| `DATABASE_URL` | DSN PG via réseau Docker | `postgresql://tournoi:<pwd>@postgres:5432/tournoi_tft?schema=public` | **oui** |
| `FRONTEND_URL` | Origine autorisée CORS | `https://tournoi.esportdessacres.fr` | non |
| `JWT_SECRET` | Secret signature JWT (fort) | `<openssl rand -base64 32>` | **oui** |
| `ADMIN_DEFAULT_PASSWORD` | Mot de passe admin initial (seed) | `<openssl rand -base64 16>` | **oui** |

#### Build args frontend — pas dans `.env`

Le frontend Vite injecte les variables `VITE_*` **au moment du `npm run build`**, pas au runtime. La valeur est passée via `args:` dans `docker-compose.yml` (service `frontend`), pas dans `docker/.env`.

| Nom | Description | Valeur figée | Où |
|---|---|---|---|
| `VITE_API_URL` | URL backend (REST + WebSocket) injectée dans le bundle JS | `https://api-tournoi.esportdessacres.fr` | `docker-compose.yml` → `services.frontend.build.args` |

Pour pointer un autre environnement, modifier la valeur dans `docker-compose.yml` puis `docker compose build frontend` (rebuild requis, le bundle est figé). **Ne pas** créer de `frontend/.env.production` commité.

### Séquence de déploiement

1. **Durcir le VPS** — créer user `<USER_SSH>` (nom au choix), installer clé SSH, désactiver `PasswordAuthentication` et `PermitRootLogin password` dans `/etc/ssh/sshd_config.d/99-harden.conf`, `systemctl restart sshd`.
2. **Firewall & fail2ban** — `ufw default deny incoming`, `ufw allow 22,80,443/tcp`, `ufw enable` ; `apt install fail2ban`, jail `sshd` enabled.
3. **Docker Engine + Compose v2** — dépôt officiel Docker (`docs.docker.com/engine/install/ubuntu/`), `usermod -aG docker <USER_SSH>`, tester `docker run --rm hello-world`.
4. **DNS Hostinger** — créer deux enregistrements A `api-tournoi.esportdessacres.fr` et `tournoi.esportdessacres.fr` → `<IP_VPS>` (TTL ≤ 3600s). Vérifier la propagation avec `dig +short api-tournoi.esportdessacres.fr` et `dig +short tournoi.esportdessacres.fr` **avant** la suite (sinon Let's Encrypt brûle une tentative sur le rate limit prod 5/7j).
5. **Cloner le repo** — `git clone <repo-url> /opt/tournoi-tft` (utilisateur `<USER_SSH>`).
6. **Remplir les `.env`** — `cp docker/.env.example docker/.env` et `cp backend/.env.example backend/.env.prod`, éditer avec des secrets forts. Démarrer avec `LETSENCRYPT_CA_SERVER=staging`.
7. **Premier démarrage (staging LE)** — `cd /opt/tournoi-tft/docker && docker compose up -d`. L'entrypoint du backend exécute `prisma migrate deploy` au boot (migrations appliquées automatiquement).
8. **Vérifier staging** — `curl -I --insecure https://api-tournoi.esportdessacres.fr/api/health` → 200. Issuer cert contient "STAGING" (ou "Fake") via `openssl s_client`.
9. **Bascule Let's Encrypt prod** — éditer `docker/.env` : `LETSENCRYPT_CA_SERVER=https://acme-v02.api.letsencrypt.org/directory`. Vider le volume acme : `docker compose down traefik && docker volume rm <project>_traefik-acme`. `docker compose up -d --force-recreate traefik`.
10. **Vérifier prod** — `curl -I https://api-tournoi.esportdessacres.fr/api/health` (sans `--insecure`) → 200. Issuer "Let's Encrypt" (sans STAGING).
11. **Seed admin** — `docker compose exec backend npx prisma db seed`. Logs : `Admin seeded: admin (id: 1)`.
12. **Smoke test end-to-end backend** — `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr`. Les 5 premiers checks (backend) doivent passer (les checks 6-8 frontend échoueront tant que l'étape 13 n'est pas faite).
13. **Déployer le frontend** — `cd /opt/tournoi-tft/docker && docker compose build frontend && docker compose up -d frontend`. Patienter 1-2 min, vérifier `docker compose ps` (`tournoi-tft-frontend Up healthy`), puis `curl -I https://tournoi.esportdessacres.fr/` → 200. Le cert prod Let's Encrypt est émis automatiquement (resolver `letsencrypt` partagé avec le backend).
14. **Smoke test end-to-end complet** — `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr`. Les 8 checks doivent passer (5 backend + 3 frontend).

### Rollback

Stopper la stack, restaurer le dernier dump PG, redémarrer :

```bash
cd /opt/tournoi-tft/docker
docker compose down
# Restaurer (cf. Runbook)
gunzip -c /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose up -d
```

### Contacts & accès

> 🔐 **Placeholders** : `<IP_VPS>` et `<USER_SSH>` ne sont **pas** committés en clair (le repo
> ne doit pas exposer la cible exacte). Les vraies valeurs sont détenues par Brice / le bureau
> de l'asso (gestionnaire de mots de passe). Remplacer mentalement dans les commandes ci-dessous.

- **VPS Hostinger** — `<IP_VPS>`, SSH `<USER_SSH>@<IP_VPS>` (clé).
- **DNS Hostinger** — panel `esportdessacres.fr`, user Brice.
- **Dev machine (Brice)** — Windows + Docker Desktop pour tests locaux avant push VPS.

## Runbook

### Versions installées (à renseigner lors du prep VPS)

| Composant | Version | Vérification |
|---|---|---|
| OS | Ubuntu 24.04.4 LTS (Noble Numbat) | `cat /etc/os-release` |
| Docker Engine | 29.4.1 | `docker --version` |
| Docker Compose | v5.1.3 | `docker compose version` |
| Traefik | `v3` (floating, image `traefik:v3`) | `docker compose images traefik` |
| PostgreSQL | `17-alpine` | `docker compose images postgres` |
| Node.js (backend + frontend build) | `22-alpine` | `docker compose images backend` |
| nginx (frontend runtime) | `1.27-alpine` | `docker compose images frontend` |

### Backup manuel PG

```bash
sudo /opt/tournoi-tft/docker/backup-pg.sh
# Produit /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz
```

À exécuter **avant** tout déploiement risqué et **après** chaque journée de tournoi.

### Cleanup dossier `/root/backups`

La rotation est **automatisée** par `backup-all.sh` (Story 1.10) : purge des 3 familles
`tournoi-*` / `supabase-*` / `storage-*` au-delà de **14 jours** en local (et 30 j sur le
remote off-site, si configuré). Voir §Sauvegardes automatiques.

Purge manuelle ponctuelle (équivalent, si besoin hors cron) :

```bash
sudo find /root/backups -name "tournoi-*.sql.gz"  -mtime +14 -delete
sudo find /root/backups -name "supabase-*.sql.gz" -mtime +14 -delete
sudo find /root/backups -name "storage-*.tar.gz"  -mtime +14 -delete
```

Surveiller l'espace disque pendant un événement live (`df -h /root`).

### Restore DB tournoi

```bash
cd /opt/tournoi-tft/docker
# docker/.env doit être chargé pour $POSTGRES_USER / $POSTGRES_DB
set -a; . ./.env; set +a
gunzip -c /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

**Tester la restoration en local Docker Desktop** avant de dépendre d'elle en prod.

### Restore DB Supabase (base de la vitrine)

> ⚠️ **Distinct du tournoi.** Cible le conteneur `supabase-db` (base `postgres`), superuser
> **`supabase_admin`** (le rôle `postgres` n'est PAS superuser dans l'image `supabase/postgres`).

**Stratégie A — restore sur une instance Supabase initialisée (recommandée).** Le dump est
produit avec `--no-owner --no-privileges` (cf. `backup-supabase.sh`). On restaure dans une
instance dont les init SQL (`volumes/db/roles.sql`, `jwt.sql`…) ont **déjà recréé** les rôles
et extensions `supabase_*` :

```bash
cd /opt/tournoi-tft/docker
# La stack Supabase doit tourner (db healthy). PGPASSWORD est déjà dans l'env du conteneur.
gunzip -c /root/backups/supabase-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i supabase-db psql -U supabase_admin -d postgres
```

**Nuances Supabase (important) :**
- Sur une instance **déjà initialisée**, psql affiche des erreurs **bénignes** « already
  exists » / « duplicate key » (`schema_migrations`, extensions, schémas internes Supabase
  déjà créés par les init SQL). C'est **normal** : ce qui compte est que les **données
  applicatives** (schéma `public` de la vitrine + schéma `storage` = métadonnées du bucket)
  soient restaurées. Ne **pas** mettre `ON_ERROR_STOP=on` (psql doit passer outre les
  conflits bénins). Pour une restauration **propre**, repartir d'un volume `supabase-db-data`
  **vierge** (`docker compose down` + `docker volume rm supabase-db-data`) puis laisser les
  init SQL recréer les rôles avant ce restore.
- La base `_analytics` (logs Logflare) n'est **pas** sauvegardée (jetable, régénérée au boot).
- **Ordre obligatoire : DB Supabase AVANT Storage** (les métadonnées du bucket sont en DB).

### Restore bucket Storage

Le bucket (fichiers) est une archive du volume `supabase-storage-data`. Restaurer **après**
la DB Supabase, **services `storage` + `imgproxy` arrêtés** (évite les écritures concurrentes) :

```bash
cd /opt/tournoi-tft/docker
COMPOSE="docker compose -f docker-compose.yml -f supabase/docker-compose.yml"
$COMPOSE stop storage imgproxy

# Restaurer dans le volume existant (écrase le contenu courant) :
docker run --rm -i -v supabase-storage-data:/data alpine tar xzf - -C /data \
  < /root/backups/storage-YYYYMMDD-HHMMSS.tar.gz

$COMPOSE start storage imgproxy
```

> Pour restaurer dans un volume **neuf** : `docker volume rm supabase-storage-data` puis
> `docker volume create supabase-storage-data` avant le `tar xzf`.

**Restauration vérifiée localement** (Docker Desktop, cibles jetables — cf. Dev Agent Record)
pour la **DB Supabase** (donnée connue relue) et le **Storage** (fichier connu relu). La
**restauration de production (DR)** sur le VPS reste une **étape opérationnelle** à planifier
périodiquement (cf. `docs/PASSATION.md`).

### Sauvegardes automatiques (tournoi + Supabase + Storage, off-site)

L'orchestrateur `backup-all.sh` (Story 1.10) enchaîne les **3 sauvegardes**, copie **hors-VPS**
(optionnel) et applique la **rotation** :

```bash
sudo /opt/tournoi-tft/docker/backup-all.sh
# -> /root/backups/{tournoi,supabase,storage}-YYYYMMDD-HHMMSS.{sql.gz,tar.gz}
```

**Copie hors-VPS (boring & multi-fournisseur, anti-lock-in — NFR6) :**
1. Installer rclone : `curl https://rclone.org/install.sh | sudo bash`.
2. `cp docker/offsite.env.example docker/offsite.env` et `cp docker/rclone.conf.example
   docker/rclone.conf` (les deux sont **gitignored** — n'y mettre que des secrets locaux).
3. Renseigner les vraies clés (Backblaze B2 / S3 / SFTP…) dans `docker/rclone.conf`, puis
   `OFFSITE_ENABLED=true` + `RCLONE_REMOTE` dans `docker/offsite.env`.
4. **Premier upload réel** (à lancer une fois manuellement, puis vérifier l'arrivée côté
   remote) : `sudo /opt/tournoi-tft/docker/backup-all.sh`.

> Alternative tout aussi boring : `rsync`/`scp` vers un 2ᵉ hôte SSH (adapter le bloc off-site
> de `backup-all.sh`). Option avancée (chiffrement client) : `rclone crypt` (cf. `offsite.env.example`).

**Planification (cron quotidien) — étape opérationnelle VPS** (cf. `docker/backups.cron`) :

```bash
# /etc/cron.d (versionnable) :
sudo cp /opt/tournoi-tft/docker/backups.cron /etc/cron.d/eds-backups
sudo chmod 644 /etc/cron.d/eds-backups
# Vérifier ensuite : tail -f /var/log/eds-backup.log
```

`backup.cron` documente aussi la variante **systemd timer**. Rétention : **14 j local / 30 j
remote** (surchargeable via `RETENTION_LOCAL_DAYS` / `RETENTION_REMOTE_DAYS`).

### Redéploiement backend après push code

```bash
cd /opt/tournoi-tft
git pull
cd docker
docker compose build backend
docker compose up -d backend
docker compose logs -f backend   # verifier migrations + demarrage
```

### Redéploiement frontend après push code

Le frontend est rebuild dans son image Docker (multi-stage Node 22 + nginx 1.27). La valeur de `VITE_API_URL` est figée à chaque build (cf. `args:` dans `docker-compose.yml`).

```bash
cd /opt/tournoi-tft
git pull
cd docker
docker compose build frontend
docker compose up -d frontend
docker compose logs -f frontend   # nginx start + access (off par defaut, juste les errors)
```

Downtime attendu : <3 s (recreate du container nginx). Pas de migration DB. Si une URL change (`VITE_API_URL`), modifier `docker-compose.yml` puis rebuild.

### Inspection des logs

```bash
cd /opt/tournoi-tft/docker
docker compose logs -f backend          # app
docker compose logs -f frontend         # nginx error (access_log off)
docker compose logs -f traefik          # routing + ACME
docker compose logs -f postgres         # DB
docker compose ps                       # status (healthy/unhealthy)
```

### Smoke test post-deploy

```bash
bash /opt/tournoi-tft/docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr https://esportdessacres.fr
# 11 checks attendus OK (5 backend + 3 tournoi-frontend + 3 vitrine)
```

---

## Runbook — Mise en ligne de la Vitrine EDS (Story 1.8)

> ⚠️ **Opérationnel — à exécuter sur le VPS Hostinger (pas automatisé, pas en CI).**
> La configuration a été validée localement (Docker Desktop). Suivre ces étapes
> pour mettre la vitrine et la stack Supabase en ligne sur `esportdessacres.fr`.

### Prérequis

- VPS provisionné, Docker Engine + Compose v2 installés, Traefik + tournoi déjà opérationnels.
- Accès SSH : `ssh <USER_SSH>@<IP_VPS>`
- Espace disque suffisant : Supabase ajoute ~1 Go d'images + données.

### Étape 1 — Pull du code

```bash
cd /opt/tournoi-tft
git pull origin main
```

### Étape 2 — Remplir les fichiers `.env` (JAMAIS commités)

```bash
# Secrets Supabase
cp docker/supabase/.env.example docker/supabase/.env
nano docker/supabase/.env
# Remplir : POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
#           DASHBOARD_USERNAME/PASSWORD, TRAEFIK_BASIC_AUTH_USERS
# Generer JWT_SECRET : openssl rand -hex 32
# Generer ANON_KEY/SERVICE_ROLE_KEY : https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# Generer TRAEFIK_BASIC_AUTH_USERS : htpasswd -nb admin <mot-de-passe>  (doubler les $)

# Secrets vitrine
cp apps/vitrine/.env.prod.example apps/vitrine/.env.prod
nano apps/vitrine/.env.prod
# Remplir : DATABASE_URL (postgresql://postgres:<POSTGRES_PASSWORD>@supabase-db:5432/postgres)
# NEXT_PUBLIC_SITE_URL est une valeur de BUILD (build-arg dans docker-compose.yml),
# pas besoin de la remettre ici (déjà figée à https://esportdessacres.fr au build).
```

### Étape 3 — DNS `esportdessacres.fr`

Dans le panel Hostinger DNS, créer (ou vérifier) l'enregistrement :
```
A  esportdessacres.fr  →  <IP_VPS>  (TTL 3600)
```
Vérifier la propagation AVANT de démarrer (sinon Let's Encrypt rate limit) :
```bash
dig +short esportdessacres.fr
# Attendu : <IP_VPS>
```

### Étape 4 — Premier démarrage en ACME staging (évite le rate limit prod)

S'assurer que `docker/.env` a :
```
LETSENCRYPT_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory
```

Depuis `docker/` :
```bash
cd /opt/tournoi-tft/docker

# Démarrer la stack COMPLÈTE (tournoi + vitrine + Supabase)
docker compose -f docker-compose.yml -f supabase/docker-compose.yml up -d

# Suivre le démarrage Supabase (les ~10 services prennent 1-2 min)
docker compose -f docker-compose.yml -f supabase/docker-compose.yml logs -f supabase-kong supabase-db supabase-auth

# Vérifier que tous les services sont healthy
docker compose -f docker-compose.yml -f supabase/docker-compose.yml ps
```

### Étape 5 — Vérification locale staging

```bash
# La vitrine répond (cert STAGING = normal à cette étape)
curl -k https://esportdessacres.fr/

# Ou avec marqueur HTML
curl -ks https://esportdessacres.fr/ | grep 'id="content"'
# Attendu : <main id="content">
```

### Étape 6 — Bascule Let's Encrypt prod

Une fois staging confirmé :
```bash
nano /opt/tournoi-tft/docker/.env
# Modifier :
# LETSENCRYPT_CA_SERVER=https://acme-v02.api.letsencrypt.org/directory

# Supprimer le volume ACME staging (obligatoire pour réémettre un cert prod)
docker compose -f docker-compose.yml -f supabase/docker-compose.yml down traefik
docker volume rm docker_traefik-acme
# ou : docker volume ls | grep acme  →  trouver le nom exact

# Redémarrer Traefik (les autres services restent up)
docker compose -f docker-compose.yml -f supabase/docker-compose.yml up -d traefik
```

### Étape 7 — Smoke test complet

```bash
# Attendre ~2 min que le cert prod soit émis, puis :
bash /opt/tournoi-tft/docker/smoke-test.sh \
  https://api-tournoi.esportdessacres.fr \
  https://tournoi.esportdessacres.fr \
  https://esportdessacres.fr
# 11 checks attendus SUCCES (dont cert vitrine "Let's Encrypt" sans STAGING)
```

### Accès Studio Supabase (admin base vitrine)

Studio n'est **pas** exposé publiquement (sécurité). Accès par SSH tunnel :
```bash
# Depuis la machine locale (Brice)
ssh -L 3001:supabase-studio:3000 <USER_SSH>@<IP_VPS>
# Puis ouvrir http://localhost:3001 dans le navigateur
```

### Redéploiement vitrine après push code

```bash
cd /opt/tournoi-tft
git pull
cd docker
docker compose -f docker-compose.yml -f supabase/docker-compose.yml build vitrine
docker compose -f docker-compose.yml -f supabase/docker-compose.yml up -d vitrine
docker compose -f docker-compose.yml -f supabase/docker-compose.yml logs -f eds-vitrine
```

### Logs Supabase

```bash
cd /opt/tournoi-tft/docker
docker compose -f docker-compose.yml -f supabase/docker-compose.yml logs -f supabase-kong
docker compose -f docker-compose.yml -f supabase/docker-compose.yml logs -f supabase-auth
docker compose -f docker-compose.yml -f supabase/docker-compose.yml logs -f supabase-db
docker compose -f docker-compose.yml -f supabase/docker-compose.yml logs -f eds-vitrine
```

### Overlays OBS pour stream

Deux URLs distinctes sont prevues pour la source navigateur OBS, a basculer manuellement par le caster (SkyDow) au moment du clic admin "Demarrer la finale" :

| Phase tournoi | URL overlay | Rendu |
|---|---|---|
| Qualifications | `https://tournoi.esportdessacres.fr/overlay` | Mirroir `/qualifications` (RankingTable complet : Place/Pts par round, Moy, Top 1/4, Dern.) |
| Finale | `https://tournoi.esportdessacres.fr/overlay/finale` | Mirroir `/finale` (preview top 8 → progression victoire UX-DR7 → animation or vainqueur UX-DR8) |

- Format OBS recommande : source navigateur 1920x1080.
- Support `?transparent=1` sur les 2 URLs si chroma key necessaire (fond transparent au lieu de `bg-eds-dark`).
- Pas de chrome UI (header de nav, footer, scrollbar) : routes hors `<Layout>` (UX-DR14).
- Reconnexion Socket.IO automatique en cas de `docker compose restart backend` (story 4.1 AC #5 + 3.1 AC #4).
- Workflow detaille : [_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md](_bmad-output/implementation-artifacts/6-3-dry-run-runbook-jour-J.md) sections 2 + 3.7.


### Debug Let's Encrypt

Si le cert prod ne s'émet pas après 2 min :
1. `docker compose logs traefik | grep -i acme` → chercher erreurs.
2. Vérifier DNS : `dig +short api-tournoi.esportdessacres.fr` depuis un resolver externe.
3. Vérifier port 80 ouvert : `curl -I http://api-tournoi.esportdessacres.fr` depuis l'extérieur doit atteindre Traefik (pas de timeout UFW).
4. **Ne pas** redémarrer en boucle (rate limit LE prod : 5 duplicate / 7j). Repasser en **staging** pour debug, puis rebasculer prod une fois la config validée.
