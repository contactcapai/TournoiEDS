# Tournoi TFT — Esport des Sacres

Site web pour la gestion du tournoi TFT de l'association Esport des Sacres.

## Structure

- `frontend/` — Application React (Vite + TypeScript + Tailwind CSS)
- `backend/` — API Express (TypeScript + Prisma + Socket.IO)
- `docker/` — Configuration Docker pour le deploiement

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

Déploiement **manuel** du backend sur le VPS Hostinger (pas de CI/CD). Le frontend est servi séparément (cf. Story 6.2).

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

### Séquence de déploiement

1. **Durcir le VPS** — créer user `deploy`, installer clé SSH, désactiver `PasswordAuthentication` et `PermitRootLogin password` dans `/etc/ssh/sshd_config.d/99-harden.conf`, `systemctl restart sshd`.
2. **Firewall & fail2ban** — `ufw default deny incoming`, `ufw allow 22,80,443/tcp`, `ufw enable` ; `apt install fail2ban`, jail `sshd` enabled.
3. **Docker Engine + Compose v2** — dépôt officiel Docker (`docs.docker.com/engine/install/ubuntu/`), `usermod -aG docker deploy`, tester `docker run --rm hello-world`.
4. **DNS Hostinger** — créer un enregistrement A `api-tournoi.esportdessacres.fr` → `76.13.58.249` (TTL ≤ 3600s). Vérifier la propagation avec `dig +short api-tournoi.esportdessacres.fr` **avant** la suite.
5. **Cloner le repo** — `git clone <repo-url> /opt/tournoi-tft` (utilisateur `deploy`).
6. **Remplir les `.env`** — `cp docker/.env.example docker/.env` et `cp backend/.env.example backend/.env.prod`, éditer avec des secrets forts. Démarrer avec `LETSENCRYPT_CA_SERVER=staging`.
7. **Premier démarrage (staging LE)** — `cd /opt/tournoi-tft/docker && docker compose up -d`. L'entrypoint du backend exécute `prisma migrate deploy` au boot (migrations appliquées automatiquement).
8. **Vérifier staging** — `curl -I --insecure https://api-tournoi.esportdessacres.fr/api/health` → 200. Issuer cert contient "STAGING" (ou "Fake") via `openssl s_client`.
9. **Bascule Let's Encrypt prod** — éditer `docker/.env` : `LETSENCRYPT_CA_SERVER=https://acme-v02.api.letsencrypt.org/directory`. Vider le volume acme : `docker compose down traefik && docker volume rm <project>_traefik-acme`. `docker compose up -d --force-recreate traefik`.
10. **Vérifier prod** — `curl -I https://api-tournoi.esportdessacres.fr/api/health` (sans `--insecure`) → 200. Issuer "Let's Encrypt" (sans STAGING).
11. **Seed admin** — `docker compose exec backend npx prisma db seed`. Logs : `Admin seeded: admin (id: 1)`.
12. **Smoke test end-to-end** — `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr`. Tous les checks OK.

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
| Traefik | `v3.2` | `docker compose images traefik` |
| PostgreSQL | `17-alpine` | `docker compose images postgres` |
| Node.js | `22-alpine` | `docker compose images backend` |

### Backup manuel PG

```bash
sudo /opt/tournoi-tft/docker/backup-pg.sh
# Produit /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz
```

À exécuter **avant** tout déploiement risqué et **après** chaque journée de tournoi.

### Restore DB

```bash
cd /opt/tournoi-tft/docker
# docker/.env doit être chargé pour $POSTGRES_USER / $POSTGRES_DB
set -a; . ./.env; set +a
gunzip -c /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

**Tester la restoration en local Docker Desktop** avant de dépendre d'elle en prod.

### Redéploiement après push code

```bash
cd /opt/tournoi-tft
git pull
cd docker
docker compose build backend
docker compose up -d backend
docker compose logs -f backend   # verifier migrations + demarrage
```

### Inspection des logs

```bash
cd /opt/tournoi-tft/docker
docker compose logs -f backend          # app
docker compose logs -f traefik          # routing + ACME
docker compose logs -f postgres         # DB
docker compose ps                       # status (healthy/unhealthy)
```

### Smoke test post-deploy

```bash
bash /opt/tournoi-tft/docker/smoke-test.sh https://api-tournoi.esportdessacres.fr
```

### Debug Let's Encrypt

Si le cert prod ne s'émet pas après 2 min :
1. `docker compose logs traefik | grep -i acme` → chercher erreurs.
2. Vérifier DNS : `dig +short api-tournoi.esportdessacres.fr` depuis un resolver externe.
3. Vérifier port 80 ouvert : `curl -I http://api-tournoi.esportdessacres.fr` depuis l'extérieur doit atteindre Traefik (pas de timeout UFW).
4. **Ne pas** redémarrer en boucle (rate limit LE prod : 5 duplicate / 7j). Repasser en **staging** pour debug, puis rebasculer prod une fois la config validée.
