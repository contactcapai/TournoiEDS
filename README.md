# TournoiEDS + Vitrine — Esport des Sacres (monorepo)

Monorepo Turborepo/pnpm : tournoi TFT + site vitrine association EDS.

## Structure

- `apps/tournoi-web/` — Application React tournoi (Vite + TypeScript + Tailwind)
- `apps/tournoi-api/` — API Express tournoi (TypeScript + Prisma + Socket.IO)
- `apps/vitrine/` — Site vitrine Next.js (esportdessacres.fr)
- `packages/` — Packages partagés (@repo/ui, @repo/eslint-config, @repo/typescript-config)
- `docker/` — Infrastructure Docker prod (Traefik + Postgres + tournoi + vitrine)

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
`tournoi-*` / `vitrine-*` / `medias-*` au-delà de **14 jours** en local (et 30 j sur le
remote off-site, si configuré). Voir §Sauvegardes automatiques.

Purge manuelle ponctuelle (équivalent, si besoin hors cron) :

```bash
sudo find /root/backups -name "tournoi-*.sql.gz"  -mtime +14 -delete
sudo find /root/backups -name "vitrine-*.sql.gz" -mtime +14 -delete
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

### Restore DB vitrine (base `vitrine`)

> ⚠️ **Distinct du tournoi, mais MÊME MOTEUR** depuis la révision d'architecture du
> 2026-07-29 : un seul conteneur `tournoi-tft-postgres`, **deux bases cloisonnées**
> (`$POSTGRES_DB` pour le tournoi, `vitrine` pour le site) et **deux rôles**.
> Ne pas confondre les deux dumps : `tournoi-*.sql.gz` et `vitrine-*.sql.gz`.

Le dump est produit avec `--no-owner --no-privileges` (cf. `backup-vitrine.sh`) : la
restauration recrée les objets au nom du rôle qui restaure, sans exiger que le rôle
`vitrine` préexiste.

```bash
cd /opt/tournoi-tft/docker
# La base 'vitrine' doit exister (créée par initdb/01-vitrine.sh, ou à la main — voir
# « Créer la base vitrine sur un volume existant » ci-dessous).
gunzip -c /root/backups/vitrine-YYYYMMDD-HHMMSS.sql.gz   | docker exec -i tournoi-tft-postgres psql -U "$POSTGRES_USER" -d vitrine
```

> Pour une restauration **propre** : `DROP DATABASE vitrine;` puis `CREATE DATABASE
> vitrine OWNER vitrine;` avant le restore. ⚠️ **Ne jamais supprimer le volume
> `tournoi-pg-data`** pour repartir « propre » côté vitrine — il porte **aussi** la base
> du tournoi. C'est le prix du moteur mutualisé, et c'est le piège à connaître.

**Ordre obligatoire : base `vitrine` AVANT les médias** (la table `photo` référence les
fichiers).

### Créer la base `vitrine` sur un volume DÉJÀ initialisé (cas du VPS)

`docker/initdb/01-vitrine.sh` ne s'exécute qu'au **premier** démarrage d'un volume vide.
Sur le VPS, où le tournoi tourne déjà, jouer les ordres à la main **une fois** :

```bash
cd /opt/tournoi-tft/docker
# 🔴 Charger docker/.env dans le SHELL : $POSTGRES_USER / $POSTGRES_DB ci-dessous sont
# developpes par le shell de l'HOTE, pas par Compose. Sans cette ligne, psql recoit
# -U "" et tente de se connecter sous l'utilisateur systeme (deploy), qui n'est pas un
# role Postgres -> echec. (Meme prerequis qu'au § Restore DB tournoi, qui lui le disait.)
set -a; . ./.env; set +a

# Le mot de passe doit être IDENTIQUE a VITRINE_DB_PASSWORD de docker/.env
# et a celui de DATABASE_URL dans apps/vitrine/.env.prod.
docker exec -i tournoi-tft-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE ROLE vitrine WITH LOGIN PASSWORD 'le-mot-de-passe-de-VITRINE_DB_PASSWORD';
CREATE DATABASE vitrine OWNER vitrine;
REVOKE CONNECT ON DATABASE vitrine FROM PUBLIC;
GRANT  CONNECT ON DATABASE vitrine TO vitrine;
SQL
# Cloisonnement dans l'autre sens (le role vitrine ne doit pas voir la base tournoi) :
docker exec -i tournoi-tft-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"   -c "REVOKE CONNECT ON DATABASE \"$POSTGRES_DB\" FROM PUBLIC;"   -c "GRANT CONNECT ON DATABASE \"$POSTGRES_DB\" TO \"$POSTGRES_USER\";"
```

Vérifier ensuite que le cloisonnement tient :

```bash
# Doit ECHOUER (permission denied) :
docker exec -i tournoi-tft-postgres psql "postgresql://vitrine:MDP@localhost:5432/$POSTGRES_DB" -c '\conninfo'
# Doit REUSSIR :
docker exec -i tournoi-tft-postgres psql "postgresql://vitrine:MDP@localhost:5432/vitrine" -c '\conninfo'
```

### Restore médias de la vitrine

Les fichiers téléversés vivent dans le volume `docker_eds-medias`. Restaurer **après** la
base, **conteneur `vitrine` arrêté** (évite les écritures concurrentes) :

```bash
cd /opt/tournoi-tft/docker
docker compose stop vitrine

# Restaurer dans le volume existant (écrase le contenu courant) :
docker run --rm -i -v docker_eds-medias:/data alpine tar xzf - -C /data   < /root/backups/medias-YYYYMMDD-HHMMSS.tar.gz

docker compose start vitrine
```

> Pour restaurer dans un volume **neuf** : `docker volume rm docker_eds-medias` puis
> `docker volume create docker_eds-medias` avant le `tar xzf`.

**Restauration vérifiée localement** (Docker Desktop, cibles jetables — cf. Dev Agent Record
de la Story 1.10). ⚠️ Cette vérification datait de la stack Supabase : **elle est à rejouer**
sur la cible actuelle. La **restauration de production (DR)** sur le VPS reste une **étape
opérationnelle** à planifier périodiquement (cf. `docs/PASSATION.md`).

### Restore n8n (workflows + credentials des comptes sociaux)

Les données n8n (base SQLite : workflows, **credentials chiffrés**) vivent dans le volume
`docker_n8n-data`. Restaurer **conteneur `eds-n8n` arrêté** :

```bash
cd /opt/tournoi-tft/docker
docker compose stop n8n

# Restaurer dans le volume existant (écrase le contenu courant) :
docker run --rm -i -v docker_n8n-data:/data alpine tar xzf - -C /data   < /root/backups/n8n-YYYYMMDD-HHMMSS.tar.gz

docker compose start n8n
```

> 🔴 **L'archive seule est MORTE sans `N8N_ENCRYPTION_KEY`** (docker/.env) : les credentials
> y sont chiffrés par cette clé, qui ne part **pas** dans les sauvegardes (voulu — secrets).
> Restaurer avec une autre clé donne une instance qui démarre, montre ses workflows… et rend
> `403` à chaque appel authentifié — indistinguable d'un mauvais jeton. Conservation de la
> clé hors VPS : `docs/PASSATION.md` §3.
> Vérification post-restore : ouvrir le workflow, **re-vérifier chaque nœud**
> (`apps/vitrine/n8n/README.md`), puis un **appel réel** au webhook.

### Sauvegardes automatiques (base tournoi + base vitrine + médias + n8n, off-site)

L'orchestrateur `backup-all.sh` (Story 1.10, étendu par la Story 7.1) enchaîne les
**4 sauvegardes**, copie **hors-VPS** (optionnel) et applique la **rotation** :

```bash
sudo /opt/tournoi-tft/docker/backup-all.sh
# -> /root/backups/{tournoi,vitrine}-YYYYMMDD-HHMMSS.sql.gz
#    /root/backups/{medias,n8n}-YYYYMMDD-HHMMSS.tar.gz
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
> pour mettre la vitrine en ligne sur `esportdessacres.fr`.

### Prérequis

- VPS provisionné, Docker Engine + Compose v2 installés, Traefik + tournoi déjà opérationnels.
- Accès SSH : `ssh <USER_SSH>@<IP_VPS>`
- Espace disque suffisant : la vitrine ajoute son image Next standalone (~200 Mo).

### Étape 1 — Pull du code

> 🔴 **Piège mesuré le 2026-07-29 — lire AVANT de tirer.** Le VPS était resté à `c158e56`
> (26 avril 2026), soit **60 commits en retard et en structure PRÉ-MONOREPO** (`backend/`,
> `frontend/` à la racine). Le `git pull` fait apparaître `apps/` et `packages/` — mais les
> fichiers de secrets sont **gitignorés, donc ils ne bougent pas** : `backend/.env.prod`
> reste où il est, alors que le compose attend désormais `../apps/tournoi-api/.env.prod`.
>
> **Symptôme si on saute l'étape** : Compose valide les `env_file` de **tous** les services
> au chargement du fichier → `docker compose up -d vitrine` échoue lui aussi, alors même
> qu'il ne concerne pas le backend. Le tournoi continue de tourner (images déjà
> construites), ce qui rend le diagnostic contre-intuitif.

```bash
cd /opt/tournoi-tft

# Filet : dump de la base du tournoi, sans sudo (l'utilisateur deploy est dans le groupe docker).
set -a; . docker/.env; set +a
docker exec tournoi-tft-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > ~/pre-pull-tournoi-$(date -u +%Y%m%d-%H%M%S).sql.gz

# Sauvegarder les fichiers de secrets AVANT toute manipulation
cp docker/.env         ~/env-docker.bak
cp backend/.env.prod   ~/env-backend.bak   # n'existe que sur un VPS pré-monorepo

git pull origin main

# 🔴 Relocaliser les secrets du backend vers leur nouveau chemin (monorepo)
[ -f backend/.env.prod ] && cp backend/.env.prod apps/tournoi-api/.env.prod

# Vérifier que Compose relit le fichier sans erreur AVANT de démarrer quoi que ce soit
docker compose -f docker/docker-compose.yml config >/dev/null && echo "compose OK"
```

### Étape 2 — Remplir les fichiers `.env` (JAMAIS commités)

```bash
nano docker/.env
# Ajouter VITRINE_DB_PASSWORD (mot de passe du role applicatif de la vitrine).
# 🔴 PAS `openssl rand -base64 32` pour CE secret : il finit dans le userinfo d'une
# DSN (postgresql://vitrine:<MDP>@...), ou '+', '/' et '=' sont invalides sans
# pourcent-encodage — et l'echec n'arriverait qu'au PREMIER APPEL BASE (connexion
# Drizzle paresseuse), avec un message d'authentification trompeur. Generer :
#   tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 40; echo
#
# Ajouter AUSSI (cf. docker/.env.example) :
#   VITRINE_HOST=preprod.esportdessacres.fr
#   VITRINE_ROBOTS="noindex, nofollow"   <- GUILLEMETS OBLIGATOIRES
# 🔴 docker/.env a DEUX lecteurs : Compose ET le shell (`set -a; . ./.env`). Compose
# tolere une valeur non quotee avec des espaces, le shell NON : il lirait
# `VITRINE_ROBOTS=noindex,` puis executerait `nofollow`. Piege paye le 2026-07-29.
# VITRINE_HOST pilote la regle Traefik ET le build-arg NEXT_PUBLIC_SITE_URL.
# ⚠️ Ne PAS mettre esportdessacres.fr d'emblee : l'apex sert le site Hostinger
# actuel de l'asso (cf. Etape 3).

# Secrets vitrine
cp apps/vitrine/.env.prod.example apps/vitrine/.env.prod
nano apps/vitrine/.env.prod
# Remplir : DATABASE_URL
#   postgresql://vitrine:<VITRINE_DB_PASSWORD>@tournoi-tft-postgres:5432/vitrine
# ⚠️ Le mot de passe doit etre IDENTIQUE a VITRINE_DB_PASSWORD de docker/.env.
# NEXT_PUBLIC_SITE_URL est une valeur de BUILD (build-arg dans docker-compose.yml),
# pas besoin de la remettre ici (déjà figée à https://esportdessacres.fr au build).
```

### Étape 2 bis — 🔴 Créer la base `vitrine` (volume Postgres DÉJÀ initialisé)

`docker/initdb/01-vitrine.sh` ne tourne qu'au **premier** démarrage d'un volume vide. Sur
le VPS, le tournoi tourne déjà : **le script sera ignoré**. Créer la base à la main —
procédure complète au §« Créer la base `vitrine` sur un volume DÉJÀ initialisé ».

⚠️ **Ne pas sauter cette étape** : sans elle, la vitrine démarre (ses pages sont statiques)
mais toute requête base échouera — et la connexion Drizzle étant **paresseuse**, l'erreur
n'apparaîtra qu'au premier appel réel, pas au démarrage du conteneur.

### Étape 3 — DNS

> 🔴 **Corrigé le 2026-07-29 — la version précédente de cette étape se trompait de
> prémisse.** Elle disait « créer (ou vérifier) l'enregistrement A `esportdessacres.fr` »,
> comme si l'apex était vierge. **Il ne l'est pas** : mesuré le 2026-07-29, il sert le site
> public de l'association (`Server: hcdn`, `X-Powered-By: HostingerWebsiteBuilder`, 200,
> 385 Ko, `<title>` « Le club d'esport Reims | Esport des Sacres »). Y pointer le VPS est
> une **bascule de site public**, pas une mise en service.
>
> De plus, à la date de rédaction, le site à basculer laisse **`/agenda` (Epic 3) et
> `/partenaires` (Story 4.6) en 404** — dont le CTA doré du hero et la moitié droite de la
> double porte, soit les deux appels à l'action principaux de l'accueil.

**Préproduction (défaut).** Créer dans le panel Hostinger DNS :
```
A  preprod.esportdessacres.fr  →  <IP_VPS>  (TTL 3600)
```

**Bascule en production**, une fois `/agenda` et `/partenaires` livrées : repointer l'apex
sur `<IP_VPS>`, passer `VITRINE_HOST=esportdessacres.fr` + `VITRINE_ROBOTS=` (vide) dans
`docker/.env`, puis `docker compose build vitrine && docker compose up -d vitrine`.
⚠️ **Traiter `www` dans le même geste** : `www.esportdessacres.fr` est un CNAME vers le CDN
Hostinger et servirait sinon l'**ancien** site à côté du nouveau. Le routeur Traefik ne
déclare qu'un seul hôte — ajouter `www` à la règle + une redirection 301 vers l'apex.
*Atout : le TTL de l'apex est à 17 s → bascule et rollback quasi instantanés.*

Vérifier la propagation AVANT de démarrer (sinon Let's Encrypt brûle une tentative sur le
rate limit prod, 5 / 7 jours) :
```bash
dig +short preprod.esportdessacres.fr
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

# Démarrer la stack (tournoi + vitrine) — UN SEUL fichier compose
docker compose up -d

# Vérifier que tous les services sont healthy (5 services attendus)
docker compose ps
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
docker compose down traefik
docker volume rm docker_traefik-acme
# ou : docker volume ls | grep acme  →  trouver le nom exact

# Redémarrer Traefik (les autres services restent up)
docker compose up -d traefik
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

### Inspecter la base `vitrine`

Il n'y a **plus de console web** depuis la sortie de Supabase (Studio était la seule perte
réelle de la révision du 2026-07-29, et elle était assumée). Deux accès :

```bash
# 1. psql directement dans le conteneur (le plus simple sur le VPS)
docker exec -it tournoi-tft-postgres psql -U "$POSTGRES_USER" -d vitrine

# 2. Client graphique (DBeaver, pgAdmin, TablePlus) via tunnel SSH.
#    Postgres n'est PAS exposé publiquement — c'est voulu.
ssh -L 5433:tournoi-tft-postgres:5432 <USER_SSH>@<IP_VPS>
#    Puis se connecter sur localhost:5433, base 'vitrine', role 'vitrine'.
```

### Redéploiement vitrine après push code

```bash
cd /opt/tournoi-tft
git pull
cd docker
docker compose build vitrine
docker compose up -d vitrine
docker compose logs -f eds-vitrine
```

### Logs vitrine

```bash
cd /opt/tournoi-tft/docker
docker compose logs -f eds-vitrine      # app Next
docker compose logs -f postgres         # base (tournoi ET vitrine — moteur mutualise)
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

---

## Runbook — Installer le n8n d'EDS (Story 7.1)

> ⚠️ **Opérationnel — à exécuter sur le VPS (pas automatisé, pas en CI).** Instance
> **propre à l'association** (décision du 2026-08-07) : les jetons d'API des comptes
> sociaux ne vivent pas sur l'instance d'un prestataire. Doc-first :
> `apps/vitrine/n8n/README.md` (liste de re-vérification nœud par nœud) et
> `00 référence/pieges/webhook-n8n.md`.

### Étape 1 — DNS d'abord, et le vérifier

```bash
# Créer l'enregistrement A : n8n.esportdessacres.fr -> IP du VPS (registrar Hostinger).
# 🔴 NE PAS FAIRE `up -d` AVANT CE TÉMOIN : une tentative Let's Encrypt sur un hôte
# sans DNS échoue et brûle le rate limit prod (5 échecs / 7 jours).
dig +short n8n.esportdessacres.fr
# Attendu : l'IP du VPS, et RIEN d'autre.
```

### Étape 2 — Secrets dans `docker/.env`

```bash
cd /opt/tournoi-tft/docker
# Ajouter (cf. .env.example, commentaires compris) :
#   N8N_HOST=n8n.esportdessacres.fr
#   N8N_ENCRYPTION_KEY=<40 alphanumériques>   <- tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 40
#   N8N_BASICAUTH='<user>:<hash bcrypt>'      <- QUOTES SIMPLES (le hash contient des $)
# Hash : docker run --rm httpd:2.4-alpine htpasswd -nbB brice 'LE_MOT_DE_PASSE'
# 🔴 Conserver N8N_ENCRYPTION_KEY hors VPS (PASSATION §3) : sans elle, les sauvegardes
# n8n-*.tar.gz sont mortes.
```

### Étape 3 — Démarrage & compte owner

```bash
docker compose up -d n8n
docker compose ps n8n            # attendre "healthy"
# Ouvrir https://n8n.esportdessacres.fr -> le basic auth Traefik s'interpose (voulu),
# PUIS l'écran n8n "Set up owner account" : le créer IMMÉDIATEMENT (compte de l'asso).
# Vérifier la frontière : /webhook/nimportequoi doit répondre SANS basic auth (404 n8n),
# et / doit l'exiger.
```

### Étape 4 — Import du workflow & credential (⚠️ à la main, pas par l'API)

```bash
# UI n8n : Workflows -> Import from File -> apps/vitrine/n8n/publication-reseaux.json
# 🔴 Après l'import, RE-VÉRIFIER CHAQUE NŒUD (l'import drope des paramètres en silence) :
#    la liste exacte est dans apps/vitrine/n8n/README.md §Ré-importer.
# 🔴 Credential "Header Auth" : le créer DANS L'INTERFACE (Name = x-eds-webhook-token,
#    Value = jeton NEUF généré ici — jamais recycler une valeur d'une autre instance),
#    puis le RATTACHER au nœud Webhook : la référence importée pointe l'id de l'ancienne
#    instance. L'écriture par l'API a rendu des credentials inertes (403) sur l'instance
#    CapAI — cause jamais établie, à RE-MESURER, pas à supposer résolue.
# Activer le workflow (l'URL de production /webhook/... n'existe QUE workflow ACTIF).
```

### Étape 5 — Verify d'entrée (le témoin est l'exécution, pas le 200)

```bash
# Depuis le back-office vitrine (poste de dev, .env.local) :
#   N8N_WEBHOOK_URL=https://n8n.esportdessacres.fr/webhook/eds-publication-evenement
#   N8N_WEBHOOK_TOKEN=<le jeton ci-dessus>
# Cliquer "Annoncer sur les réseaux" sur un événement publié, puis côté n8n :
# Executions -> l'exécution doit être là, avec LE BON CORPS REÇU (id, titre, debut avec
# offset +0X:00). Un HTTP 200 seul ne prouve rien (pieges/faux-succes.md).
# Cas d'échec : docker compose stop n8n -> le back-office doit afficher un message
# utilisable et NE PAS horodater social_posted_at. Puis docker compose start n8n.
```

### Étape 6 — La 4ᵉ sauvegarde, éprouvée

```bash
sudo /opt/tournoi-tft/docker/backup-all.sh     # les logs doivent dire 1/4 ... 4/4
ls -lh /root/backups/n8n-*.tar.gz
# Restauration ÉPROUVÉE (cible jetable, sans toucher la prod) :
docker volume create n8n-restore-test
docker run --rm -i -v n8n-restore-test:/data alpine tar xzf - -C /data   < /root/backups/n8n-<TS>.tar.gz
docker run --rm -v n8n-restore-test:/data:ro alpine test -f /data/database.sqlite && echo "SQLite présent"
docker volume rm n8n-restore-test
# (La preuve complète — credentials déchiffrables — est celle de l'Étape 5 rejouée après
# un restore réel ; à planifier avec les DR périodiques, PASSATION §3.)
```
