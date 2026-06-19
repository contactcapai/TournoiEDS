# TournoiEDS + Vitrine — Esport des Sacres (monorepo)

Monorepo Turborepo/pnpm : tournoi TFT + site vitrine association EDS.

## Structure

- `apps/tournoi-web/` — Application React tournoi (Vite + TypeScript + Tailwind)
- `apps/tournoi-api/` — API Express tournoi (TypeScript + Prisma + Socket.IO)
- `apps/vitrine/` — Site vitrine Next.js (esportdessacres.fr)
- `packages/` — Packages partagés (@repo/ui, @repo/eslint-config, @repo/typescript-config)
- `docker/` — Infrastructure Docker prod (Traefik + tournoi + vitrine + Supabase)

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

- VPS Ubuntu 24.04 LTS (ici `76.13.58.249`) fraîchement provisionné.
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

1. **Durcir le VPS** — créer user `deploy`, installer clé SSH, désactiver `PasswordAuthentication` et `PermitRootLogin password` dans `/etc/ssh/sshd_config.d/99-harden.conf`, `systemctl restart sshd`.
2. **Firewall & fail2ban** — `ufw default deny incoming`, `ufw allow 22,80,443/tcp`, `ufw enable` ; `apt install fail2ban`, jail `sshd` enabled.
3. **Docker Engine + Compose v2** — dépôt officiel Docker (`docs.docker.com/engine/install/ubuntu/`), `usermod -aG docker deploy`, tester `docker run --rm hello-world`.
4. **DNS Hostinger** — créer deux enregistrements A `api-tournoi.esportdessacres.fr` et `tournoi.esportdessacres.fr` → `76.13.58.249` (TTL ≤ 3600s). Vérifier la propagation avec `dig +short api-tournoi.esportdessacres.fr` et `dig +short tournoi.esportdessacres.fr` **avant** la suite (sinon Let's Encrypt brûle une tentative sur le rate limit prod 5/7j).
5. **Cloner le repo** — `git clone <repo-url> /opt/tournoi-tft` (utilisateur `deploy`).
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

- **VPS Hostinger** — `76.13.58.249`, SSH `deploy@76.13.58.249` (clé).
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

Pas de rotation automatique configurée (KISS pour MVP). Pour purger les backups de plus de 14 jours :

```bash
sudo find /root/backups -name "tournoi-*.sql.gz" -mtime +14 -delete
```

À exécuter manuellement de temps en temps si l'accumulation devient un souci. Surveiller l'espace disque pendant un événement live (`df -h /root`).

### Restore DB

```bash
cd /opt/tournoi-tft/docker
# docker/.env doit être chargé pour $POSTGRES_USER / $POSTGRES_DB
set -a; . ./.env; set +a
gunzip -c /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

**Tester la restoration en local Docker Desktop** avant de dépendre d'elle en prod.

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
- Accès SSH : `ssh deploy@76.13.58.249`
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
A  esportdessacres.fr  →  76.13.58.249  (TTL 3600)
```
Vérifier la propagation AVANT de démarrer (sinon Let's Encrypt rate limit) :
```bash
dig +short esportdessacres.fr
# Attendu : 76.13.58.249
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
ssh -L 3001:supabase-studio:3000 deploy@76.13.58.249
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
