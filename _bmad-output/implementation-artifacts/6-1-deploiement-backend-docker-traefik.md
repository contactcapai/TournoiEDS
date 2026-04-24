# Story 6.1 : Preparation VPS + Deploiement Backend Docker & Traefik

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **admin (Brice)**,
I want **que le VPS Hostinger Ubuntu 24.04 (`76.13.58.249`) soit durci (SSH cles only, UFW, fail2ban) et que le backend Node.js + PostgreSQL dedie soient deployes en Docker derriere Traefik v3 avec Let's Encrypt (staging puis prod)**,
so that **l'API REST et le WebSocket Socket.IO sont accessibles en production via HTTPS sur `api-tournoi.esportdessacres.fr`, sur un socle infra reproductible, securise et documente, pret a accueillir le frontend (Story 6.2) et le dry-run (Story 6.3)**.

## Contexte de la story

**Premiere story d'Epic 6** — pivot majeur : Epic 1→5 etait 100 % **code** (backend Node/Express + frontend React), Epic 6 est 100 % **infrastructure** (ops Linux, Docker, Traefik, DNS, TLS, backup). Les patterns "services purs + tests" ne s'appliquent plus. Pattern Epic 6 retenu : documentation operationnelle (`README.md` sections Deploy + Runbook) + scripts (`backend/src/scripts/`) + configuration-as-code (`docker/`).

**Decision infra actee en retro Epic 5 (2026-04-24)** : tout le stack tourne sur le meme VPS Hostinger fraichement provisionne (`76.13.58.249`, Ubuntu 24.04, rien d'installe — ni Docker, ni Traefik, ni PG). Le frontend (Story 6.2) sera servi par un container nginx derriere le meme Traefik, **pas** par un hosting FTP externe. Un seul endroit a gerer. La reference architecture.md au reseau externe `postgresql-zvmf_default` (PG partage d'un autre projet sur un autre VPS) est **obsolete** pour ce projet — ce reseau n'existe pas sur le nouveau VPS.

**Etat actuel du code (hotspots)** :

1. [backend/Dockerfile](backend/Dockerfile) — multi-stage `node:22-alpine` OK, expose 3001, `CMD node dist/index.js`. **Ne lance PAS `prisma migrate deploy` au boot.** A decider : execution manuelle une fois (`docker compose exec backend npx prisma migrate deploy`) OU entrypoint script dedie. Decision retenue AC #10 : **entrypoint dedie** (cf. AC ci-dessous) — plus sur pour le dry-run.
2. [docker/docker-compose.yml](docker/docker-compose.yml) — fichier actuel obsolete : reference `postgresql-zvmf_default` (external) et ne definit ni Traefik ni PG. **A remplacer integralement** par `docker/docker-compose.prod.yml` (ou renommer l'actuel) qui inclut 3 services : `traefik`, `postgres`, `backend`.
3. [backend/.env.example](backend/.env.example) — variables actuelles : `DATABASE_URL`, `PORT`, `FRONTEND_URL`, `JWT_SECRET`, `ADMIN_DEFAULT_PASSWORD`. **Rien a ajouter backend-side** pour cette story — le deploiement ne necessite pas de nouvelle env var cote app. Les secrets Traefik/PG sont dans un `.env` separe cote `docker/` (voir AC #3).
4. [backend/src/app.ts:13](backend/src/app.ts) — `app.use(cors())` **ouvert par defaut** (tous origins). **Defense in Depth (pattern retro Epic 5) : a restreindre** a `process.env.FRONTEND_URL` en production (AC #7). Le WebSocket [backend/src/websocket/server.ts:9-12](backend/src/websocket/server.ts) est deja correctement restreint a `FRONTEND_URL`. Alignement CORS REST ↔ WebSocket requis.
5. [backend/src/index.ts:12-15](backend/src/index.ts) — exit fatal si `FRONTEND_URL` manquant en production. Bien. **Ajouter le meme garde-fou pour `JWT_SECRET` et `DATABASE_URL` en prod** (defense in depth — AC #11) pour eviter un demarrage silencieux sur des defauts non-securises.
6. [backend/src/app.ts:16-18](backend/src/app.ts) — `GET /api/health` existe deja (`{ data: { status: "ok" } }`). **Parfait pour Traefik healthcheck + script de smoke test post-deploy** (AC #9).
7. [backend/prisma/migrations/](backend/prisma/migrations/) — 2 migrations committees (`20260416095831_add_admin_model`, `20260416105911_add_tournament_models`). Migration Prisma `deploy` les applique sans prompt. OK pour prod.
8. [backend/prisma/seed.ts](backend/prisma/seed.ts) — seed admin via `bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 10)` + `upsert` sur `username: 'admin'`. A executer une fois apres migration initiale. `package.json` contient deja `"prisma": { "seed": "npx ts-node prisma/seed.ts" }` → `npx prisma db seed` fonctionne.

**Perimetre clair (DANS 6.1)** :

1. **Prep VPS (ops Linux)** — connexion SSH root, creation utilisateur dedie `deploy` (sudoers), installation cle SSH publique de la machine dev Brice, desactivation login root password (`PermitRootLogin prohibit-password` dans `/etc/ssh/sshd_config.d/99-harden.conf`), desactivation `PasswordAuthentication` (cles only), activation UFW avec regles `allow 22/tcp`, `allow 80/tcp`, `allow 443/tcp` + `default deny incoming` + `default allow outgoing`, installation et activation de `fail2ban` avec jail SSH par defaut.
2. **Install Docker Engine + Compose v2** — depot officiel Docker (`download.docker.com`), paquets `docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`, `systemctl enable --now docker`, ajout de `deploy` au groupe `docker`, verification `docker version` + `docker compose version` + `docker run --rm hello-world`.
3. **Reorganisation `docker/`** — remplacer [docker/docker-compose.yml](docker/docker-compose.yml) actuel (obsolete) par une stack complete. Nommage retenu : garder `docker/docker-compose.yml` comme fichier prod unique (pas de `docker-compose.dev.yml` vs `docker-compose.prod.yml` — Brice utilise Docker Desktop en local pour le dev). Le fichier definit 3 services :
   - `traefik` (image `traefik:v3.2`) — entrypoints `web` (80) + `websecure` (443), provider `docker` (sans exposer le socket — montage read-only `/var/run/docker.sock:/var/run/docker.sock:ro`), certificatesResolvers `letsencrypt` (HTTP-01 challenge, email configurable via env, caServer bascule staging→prod via variable), redirection globale 80→443, fichier `acme.json` persiste dans un volume Docker nomme (ex: `traefik-acme`), dashboard Traefik **desactive** (pas d'API publique) pour surface d'attaque minimale.
   - `postgres` (image `postgres:17-alpine`) — env vars `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` depuis `.env`, volume nomme `tournoi-pg-data:/var/lib/postgresql/data`, `healthcheck` `pg_isready`, **aucun port expose sur l'host** (uniquement reseau Docker interne), `restart: unless-stopped`.
   - `backend` (build `../backend`) — `depends_on: postgres` avec `condition: service_healthy`, env_file `../backend/.env.prod`, labels Traefik pour `api-tournoi.esportdessacres.fr` (entrypoint `websecure`, resolver `letsencrypt`, port service 3001), `healthcheck` sur `GET /api/health` (via `wget` ou `curl` dans l'image — **ajouter `curl` ou utiliser `wget` natif alpine** — decision retenue AC #9 : `wget -qO- --spider http://127.0.0.1:3001/api/health` qui est deja present dans `node:22-alpine`), `restart: unless-stopped`, **pas de port expose** (Traefik route en interne).
4. **Reseau Docker dedie** — reseau bridge nomme `tournoi-net` declare dans `docker-compose.yml`, connectant les 3 services. Aucun besoin de reseau externe.
5. **Entrypoint backend pour migration automatique** — creer `backend/docker-entrypoint.sh` execute au demarrage du container : `npx prisma migrate deploy && exec node dist/index.js`. Le seed admin n'est **pas** dans l'entrypoint (execute une fois a part via `docker compose exec backend npx prisma db seed` — eviter de re-seeder a chaque redemarrage si le password de `.env` change : l'upsert ecraserait le hash legitime par le defaut). Dockerfile : copier `docker-entrypoint.sh`, `chmod +x`, `ENTRYPOINT ["/app/docker-entrypoint.sh"]` (retirer `CMD` actuel). **Defense in Depth** : si `prisma migrate deploy` echoue (DB indisponible par ex.), le container s'arrete en erreur et `restart: unless-stopped` + `depends_on: service_healthy` couvrent les cas de demarrage a froid.
6. **CORS REST restriction** — modifier [backend/src/app.ts:13](backend/src/app.ts) : `app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: false }))`. Meme valeur que le WebSocket. En dev local le defaut `http://localhost:5173` preserve le workflow actuel de Brice (Docker Desktop PG + Vite dev server). En prod, `FRONTEND_URL=https://tournoi.esportdessacres.fr`.
7. **Assertions env vars production** — modifier [backend/src/index.ts:12-15](backend/src/index.ts) pour asserter **aussi** `JWT_SECRET` et `DATABASE_URL` en production (exit fatal si absent/defaut). `ADMIN_DEFAULT_PASSWORD` peut rester optionnel (lu uniquement par le seed).
8. **DNS Hostinger** — creer enregistrement A `api-tournoi.esportdessacres.fr` → `76.13.58.249` (TTL 3600 ou inferieur), verifier propagation avant d'emettre le certificat **prod** (`dig +short api-tournoi.esportdessacres.fr` doit retourner l'IP). **Bascule staging→prod Let's Encrypt** : demarrer avec `caServer: https://acme-staging-v02.api.letsencrypt.org/directory`, valider qu'un cert staging est emis (eviter de bruler les rate limits prod en cas de mauvaise config), puis commenter/remplacer par `caServer: https://acme-v02.api.letsencrypt.org/directory` et supprimer le fichier `acme.json` du volume avant redemarrage pour forcer une nouvelle emission prod.
9. **Script de backup PG** — `backend/src/scripts/backup-pg.sh` (ou `docker/backup-pg.sh`) executable qui fait `docker compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /root/backups/tournoi-$(date +%Y%m%d-%H%M%S).sql.gz`. Dossier `/root/backups/` cree manuellement, **hors volume Docker** (persistance host). Le script ne log jamais de secret. Execution manuelle testee une fois **avant** dry-run. Procedure de restoration (`gunzip | docker compose exec -T postgres psql`) testee sur une base PG locale (Docker Desktop) **avant** la mise en prod.
10. **Smoke test post-deploy** — script `docker/smoke-test.sh` qui verifie :
    - `curl -fsS https://api-tournoi.esportdessacres.fr/api/health` → `{ "data": { "status": "ok" } }` (200)
    - `curl -fsS -o /dev/null -w "%{http_code}\n" http://api-tournoi.esportdessacres.fr/api/health` → `301` ou `308` (redirect HTTP→HTTPS)
    - Handshake Socket.IO : `curl -fsS "https://api-tournoi.esportdessacres.fr/socket.io/?EIO=4&transport=polling"` → 200 avec payload `0{"sid":...}`
    - Verification certificat : `echo | openssl s_client -connect api-tournoi.esportdessacres.fr:443 -servername api-tournoi.esportdessacres.fr 2>/dev/null | openssl x509 -noout -issuer` → issuer contient "Let's Encrypt"
11. **Documentation** — section **Deploy** et **Runbook** ajoutees a `README.md` (racine) avec :
    - Ordre d'execution (prep VPS → Docker → `.env.prod` → DNS → `docker compose up -d` staging → verif → bascule prod → migrate → seed admin → smoke test)
    - Variables d'env requises (liste exhaustive cote app + stack)
    - Commande de backup manuel
    - Commande de rollback (arreter stack, restore dump, redemarrer)
    - Verification post-deploy (smoke test)

**Perimetre explicitement HORS 6.1 (a ne PAS implementer ici)** :

- ❌ **Deploiement frontend** — Story 6.2 (container nginx, DNS `tournoi.`, labels Traefik frontend).
- ❌ **Dry-run complet et validation SkyDow** — Story 6.3.
- ❌ **CI/CD automatisee (GitHub Actions, etc.)** — retro Epic 5 acte "deploiement manuel, dev solo, deadline courte". Deploiement manuel documente uniquement.
- ❌ **Monitoring / alerting automatise** (Prometheus, Grafana, uptime pings) — retro Epic 5 acte "surveillance manuelle le jour J". Non-MVP.
- ❌ **Backup automatise (cron)** — script de backup **manuel** documente et testable. Un cron peut etre ajoute post-MVP si souhait. AC #12 exige uniquement une execution manuelle reussie avant dry-run.
- ❌ **Log rotation centralisee (ELK, Loki, etc.)** — `docker logs` suffisent pour la duree du tournoi. Non-MVP.
- ❌ **Dashboard Traefik expose** — surface d'attaque inutile. Desactive par defaut.
- ❌ **Hardening avance (SELinux/AppArmor profiles custom, kernel sysctl tuning)** — le durcissement de base (SSH cles, UFW, fail2ban, user non-root dans containers via `node:22-alpine` + image `postgres` officielle) couvre le besoin MVP.
- ❌ **Refactor du backend** — le code existant est fige depuis Epic 5. Seuls 2 patchs chirurgicaux autorises : restriction CORS REST (AC #7) et assertion env vars prod (AC #11). Toute autre modif backend est OUT.
- ❌ **Healthcheck kubernetes-style (`/readyz`, `/livez`)** — `/api/health` existant suffit pour Traefik + smoke test. Pas de nouvelle route.
- ❌ **Tests automatises infra** — pas de framework Terraform/Ansible teste ; l'infra est documentee en runbook manuel dans `README.md`. Defense en profondeur = smoke test AC #10.

**Regles projet rappelees (memoire Brice)** :

- **VPS Hostinger neuf `76.13.58.249`** — confirme retro Epic 5. Aucun service pre-installe. Tout a bootstrapper.
- **DNS Hostinger** — Brice a acces. Enregistrements A a creer manuellement dans l'interface Hostinger. Pas d'API DNS automatisee prevue MVP.
- **Validation OBS dependante SkyDow** — Story 6.1 ne touche pas `/overlay`. Aucune dependance SkyDow dans cette story.
- **Docker Desktop local (Brice)** — Brice peut tester localement la partie `docker compose up` en local (avec DNS local `/etc/hosts` ou en accedant via `localhost:80/443` avec `curl -H "Host: api-tournoi.esportdessacres.fr"`) avant deploiement VPS. Pattern recommande : faire tourner la stack complete une fois en Docker Desktop **avant** de la pusher sur le VPS, pour debusquer les problemes de config docker-compose sans bruler de rate-limit Let's Encrypt.
- **Pas de limite de rounds** — N/A pour cette story.
- **Defense in Depth pour invariants metier** (pattern retro Epic 5) — appliquee ici aux invariants **infra** : (a) env var manquante = exit fatal (vs defaut silencieux), (b) migration echouee = container down (vs start degrade), (c) CORS strict (vs open), (d) PG non expose sur l'host (vs bind 5432 accessible).
- **Change Log granulaire v1.x par story** (pattern nouveau Epic 5) — a reconduire si hotfixes post-review en 6.1 (infra = probabilite elevee de hotfix, ex: label Traefik mal forme, redirect HTTP qui boucle, etc.).

**Decision d'architecture cle** : **Un seul `docker-compose.yml` en prod**, pas de split dev/prod. Le dev local de Brice continue sur Docker Desktop + Vite dev server (setup actuel Epic 1-5). Le `docker-compose.yml` du repo est **exclusivement** destine au VPS prod. Raison : le projet est mono-env (un seul tournoi live), pas de staging permanent, Brice veut le chemin le plus court de repo → prod. Un split dev/prod ajouterait de la complexite (fichiers override, env var en double) pour zero benefice.

**Decision d'architecture secondaire** : **Entrypoint script** (`docker-entrypoint.sh`) plutot qu'execution manuelle `prisma migrate deploy` apres chaque deploy. Raison : migrations idempotentes (Prisma skippe celles deja appliquees), coût marginal au boot (<1s si rien a migrer), et garantie que la DB matche toujours le schema Prisma du commit deploye. Alternative rejetee : `docker compose run --rm backend npx prisma migrate deploy` avant `up -d`. Plus explicite mais error-prone (oubli possible). Entrypoint = defense en profondeur.

**Decision d'architecture tertiaire** : **Let's Encrypt staging d'abord, puis bascule prod**. Meme si la config Traefik est standard, une erreur de DNS, de firewall UFW, ou de label Traefik peut bruler plusieurs tentatives. Rate limit Let's Encrypt prod : 5 duplicate certs / 7 jours. On veut pouvoir iterer sans stresser. Staging → validation → bascule prod = 1 cert prod genere, 0 risque de rate limit.

## Acceptance Criteria

1. **Given** le VPS `76.13.58.249` fraichement provisionne (Ubuntu 24.04, acces `ssh root@76.13.58.249` avec mot de passe initial Hostinger) **When** je durcis l'acces SSH et reseau **Then** un utilisateur `deploy` existe avec `sudo` NOPASSWD (ou equivalent documente), ma cle SSH publique (machine dev Brice) est installee dans `/home/deploy/.ssh/authorized_keys` avec permissions `600`, la config SSH (`/etc/ssh/sshd_config.d/99-harden.conf` ou equivalent) desactive `PermitRootLogin password` (root connectable uniquement par cle, ideal: `prohibit-password` ou `without-password`) et desactive `PasswordAuthentication` (cles SSH uniquement) **And** `systemctl restart sshd` a reussi **And** une session SSH test `ssh deploy@76.13.58.249` (via cle) reussit, et `ssh root@76.13.58.249` avec mot de passe **echoue** avec `Permission denied`.

2. **Given** l'acces SSH est durci **When** j'active le firewall et fail2ban **Then** UFW est actif (`ufw status verbose` = active) avec `default deny incoming`, `default allow outgoing`, et les seules regles `allow 22/tcp`, `allow 80/tcp`, `allow 443/tcp` **And** `fail2ban` est installe, actif (`systemctl is-active fail2ban` = active) avec la jail `sshd` enabled (`fail2ban-client status sshd` retourne une jail operationnelle) **And** un port non autorise (ex: `5432` PG) teste depuis l'exterieur (`nc -zv 76.13.58.249 5432`) retourne une connexion refusee/filtrée.

3. **Given** le VPS est durci **When** j'installe Docker Engine et Docker Compose v2 depuis le depot officiel **Then** `docker --version` retourne Docker Engine stable (>= 27.x ou derniere stable), `docker compose version` retourne Compose v2 stable (>= 2.30 ou derniere stable), `systemctl is-enabled docker` = enabled, `systemctl is-active docker` = active **And** l'utilisateur `deploy` est membre du groupe `docker` (`id deploy` contient `docker`) **And** `docker run --rm hello-world` reussit depuis une session `deploy` (sans `sudo`) **And** les versions installees (Docker Engine, Compose, OS) sont tracees dans la section Runbook de `README.md`.

4. **Given** Docker est operationnel **When** je prepare la stack Docker Compose de production **Then** le fichier [docker/docker-compose.yml](docker/docker-compose.yml) actuel est **remplace** par une stack prod complete definissant **3 services** : `traefik` (image `traefik:v3.2`), `postgres` (image `postgres:17-alpine`), `backend` (build `../backend`) **And** un reseau Docker bridge dedie `tournoi-net` connecte les 3 services (**aucune** reference au reseau externe `postgresql-zvmf_default` — cette mention est **supprimee** du fichier) **And** un volume Docker nomme `tournoi-pg-data` persiste les donnees PG dans `/var/lib/postgresql/data` **And** un volume Docker nomme `traefik-acme` persiste `acme.json` (certificats Let's Encrypt) **And** le service `postgres` n'expose **aucun port** sur l'host (pas de `ports:` bind — accessible uniquement via `tournoi-net`) **And** le service `backend` n'expose **aucun port** sur l'host (Traefik route en interne) **And** le service `traefik` expose uniquement `80:80` et `443:443` sur l'host **And** le socket Docker est monte **read-only** (`/var/run/docker.sock:/var/run/docker.sock:ro`) dans le service `traefik` **And** le dashboard Traefik est **desactive** (pas de `--api.insecure=true`, pas de router exposant l'API).

5. **Given** la stack Docker Compose est definie **When** je gere les secrets et la configuration **Then** un fichier `docker/.env.example` existe et liste **exhaustivement** les variables requises par la stack : `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `LETSENCRYPT_EMAIL`, `LETSENCRYPT_CA_SERVER` (avec les 2 valeurs possibles commentees : staging + prod) **And** un fichier `backend/.env.example` est **mis a jour** si necessaire pour refleter les env vars lues en production (actuelles : `DATABASE_URL`, `PORT`, `FRONTEND_URL`, `JWT_SECRET`, `ADMIN_DEFAULT_PASSWORD` — aucune nouvelle attendue, mais les commentaires sont clarifies pour la prod) **And** ni `docker/.env` ni `backend/.env.prod` ne sont committes (le `.gitignore` les couvre — verifier et compléter si manquant) **And** les valeurs de seed (`ADMIN_DEFAULT_PASSWORD`) sont lues depuis `.env`, **pas** hardcodees dans [backend/prisma/seed.ts](backend/prisma/seed.ts) (deja le cas — verifier) **And** la `DATABASE_URL` du backend utilise le nom de service Docker `postgres` comme host (ex: `postgresql://tournoi:<pwd>@postgres:5432/tournoi_tft?schema=public`) — **pas** `localhost`, **pas** l'IP du VPS.

6. **Given** la stack Compose est prete **When** je modifie [backend/Dockerfile](backend/Dockerfile) et ajoute `backend/docker-entrypoint.sh` **Then** un script `backend/docker-entrypoint.sh` existe avec shebang `#!/bin/sh`, exit sur erreur (`set -e`), execute `npx prisma migrate deploy` puis `exec node dist/index.js` **And** le script est `chmod +x` et copie dans l'image a `/app/docker-entrypoint.sh` **And** le `Dockerfile` remplace `CMD ["node", "dist/index.js"]` par `ENTRYPOINT ["/app/docker-entrypoint.sh"]` (sans `CMD`) **And** `prisma` CLI + `@prisma/client` sont disponibles dans l'image de production (actuellement `npm ci --omit=dev` en stage 2 exclut les devDependencies — **verifier** que `prisma` CLI est accessible : soit via `npx prisma` qui le pullera, soit en conservant `prisma` en `dependencies`, soit en installant via Docker layer dedie ; la solution retenue est documentee dans le README — recommandation : **bouger `prisma` de `devDependencies` vers `dependencies`** dans [backend/package.json](backend/package.json) car `prisma migrate deploy` doit tourner en production) **And** au `docker compose up -d` d'un container backend frais, les migrations s'appliquent automatiquement sur une DB vierge (verifie via `docker compose logs backend` montrant "Applied migration 20260416095831_add_admin_model..." etc.).

7. **Given** le backend tourne en production **When** je verifie la restriction CORS **Then** [backend/src/app.ts](backend/src/app.ts) utilise `cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' })` (**plus** de `cors()` ouvert) **And** une requete `OPTIONS /api/tournament/current` depuis l'origine `https://tournoi.esportdessacres.fr` (valeur `FRONTEND_URL` prod) retourne un header `Access-Control-Allow-Origin: https://tournoi.esportdessacres.fr` **And** la meme requete depuis une origine non autorisee (ex: `https://evil.example.com`) **ne** retourne **pas** de header `Access-Control-Allow-Origin` (la pre-flight CORS bloque le navigateur) **And** aucune autre modification du code backend n'est introduite (perimetre respect : uniquement CORS + env var assertions — AC #11).

8. **Given** le DNS est configurable cote Hostinger **When** je configure l'enregistrement A pour l'API **Then** un enregistrement DNS A `api-tournoi.esportdessacres.fr` → `76.13.58.249` est cree dans le panel Hostinger avec un TTL <= 3600s **And** `dig +short api-tournoi.esportdessacres.fr` depuis la machine dev retourne `76.13.58.249` (propagation confirmee) **And** `nslookup api-tournoi.esportdessacres.fr 8.8.8.8` retourne egalement `76.13.58.249` (propagation cote resolver externe) **And** cette propagation est verifiee **avant** de configurer Traefik en CA server **prod** (AC #10).

9. **Given** la stack est prete et DNS propage **When** je demarre Traefik avec Let's Encrypt en mode **staging** **Then** le champ `caServer` de la config Traefik pointe vers `https://acme-staging-v02.api.letsencrypt.org/directory` **And** `docker compose up -d` reussit **And** apres au plus 2 minutes, `curl -I https://api-tournoi.esportdessacres.fr/api/health --insecure` retourne `200 OK` **And** `openssl s_client -connect api-tournoi.esportdessacres.fr:443 -servername api-tournoi.esportdessacres.fr </dev/null 2>&1 | openssl x509 -noout -issuer` contient "STAGING" ou "Fake LE" (issuer staging Let's Encrypt) **And** les logs Traefik (`docker compose logs traefik`) ne contiennent aucune erreur `acme` persistante **And** un healthcheck Docker est configure sur le service `backend` (ex: `healthcheck: test: ["CMD-SHELL", "wget -qO- --spider http://127.0.0.1:3001/api/health || exit 1"]`, `interval: 30s`, `timeout: 5s`, `retries: 3`, `start_period: 15s`) et le container est rapporte `healthy` apres le `start_period` (`docker compose ps` colonne STATUS = `Up X (healthy)`).

10. **Given** le certificat staging est valide et la config est stable **When** je bascule Traefik en mode **prod** Let's Encrypt **Then** le `caServer` est remplace par `https://acme-v02.api.letsencrypt.org/directory` (ou commentaire/decommentaire approprie), le fichier `acme.json` du volume `traefik-acme` est **vide/supprime** avant redemarrage (pour forcer une nouvelle emission), `docker compose up -d --force-recreate traefik` redemarre Traefik **And** apres au plus 2 minutes, `curl -I https://api-tournoi.esportdessacres.fr/api/health` (sans `--insecure`) retourne `200 OK` **And** `openssl s_client -connect api-tournoi.esportdessacres.fr:443 </dev/null 2>&1 | openssl x509 -noout -issuer -dates` retourne un issuer **"Let's Encrypt"** prod (pas "STAGING") et une date `notBefore` recente **And** une requete HTTP (port 80) `curl -I http://api-tournoi.esportdessacres.fr/api/health` retourne un code de redirection (`301` ou `308`) vers `https://api-tournoi.esportdessacres.fr/api/health`.

11. **Given** le backend doit demarrer en production sans defaut silencieux **When** je verifie les assertions env vars **Then** [backend/src/index.ts](backend/src/index.ts) asserte en mode `NODE_ENV=production` la presence de **toutes** les variables critiques : `FRONTEND_URL` (deja present), **ajout** `JWT_SECRET` (exit 1 avec message fatal si absent ou egal au defaut de dev `dev-secret-tournoi-tft-eds-2026-change-in-production`), **ajout** `DATABASE_URL` (exit 1 si absent) **And** un demarrage test avec `NODE_ENV=production` sans ces vars echoue immediatement avec un message d'erreur clair stdout/stderr **And** un demarrage avec toutes les vars correctes reussit sans warning.

12. **Given** le backend tourne en prod avec DB peuplee **When** je pre-prod-teste le bout-en-bout de l'API **Then** `curl https://api-tournoi.esportdessacres.fr/api/health` retourne `{"data":{"status":"ok"}}` avec code 200 **And** `curl -X POST https://api-tournoi.esportdessacres.fr/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"<ADMIN_DEFAULT_PASSWORD>"}'` retourne un JWT valide (200 + `{ data: { token: "..." } }`) **And** `curl https://api-tournoi.esportdessacres.fr/api/tournament/current` retourne `200` avec un `TournamentState` coherent (phase `idle` si DB vierge) **And** un handshake Socket.IO polling (`curl "https://api-tournoi.esportdessacres.fr/socket.io/?EIO=4&transport=polling"`) retourne `200` avec un payload debutant par `0{"sid":...}` **And** une tentative de connexion Socket.IO depuis une origine non autorisee (ex: via un client JS custom avec `origin: https://evil.example.com`) est rejetee (pas d'upgrade WebSocket) — **verification indirecte** : les logs backend montrent un refus CORS WebSocket.

13. **Given** le backend est deploye et l'admin est seede **When** j'execute le seed initial **Then** `docker compose exec backend npx prisma db seed` reussit **And** les logs stdout contiennent `Admin seeded: admin (id: 1)` **And** une tentative de login avec le `ADMIN_DEFAULT_PASSWORD` de `.env.prod` reussit (cf. AC #12) **And** le seed n'est **pas** execute a chaque boot (absence dans `docker-entrypoint.sh`).

14. **Given** la base est peuplee avec au moins un enregistrement de test (ex: un joueur via `POST /api/players`) **When** je prepare et teste la strategie de backup **Then** un script executable `docker/backup-pg.sh` (ou `backend/src/scripts/backup-pg.sh`) existe et peut etre invoque depuis le VPS (`sudo /root/backup-pg.sh` ou equivalent) **And** le script cree un fichier `/root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz` non vide (verifie `ls -lh`) **And** le dump NE contient **pas** de secrets applicatifs (`.env`, `JWT_SECRET`) — il ne contient que le dump PG (tables applicatives, donnees joueurs, admin hash bcrypt) **And** la procedure de restoration (`gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB`) est testee **en local Docker Desktop** (pas en prod VPS) sur une base fraiche et restaure correctement toutes les tables **And** la procedure de backup + restore est documentee dans le Runbook `README.md` avec commandes exactes et ordre d'execution.

15. **Given** tous les ACs ci-dessus passent **When** je finalise la documentation **Then** [README.md](README.md) (racine) contient une section **"Deploy"** avec : (a) pre-requis (VPS Ubuntu 24.04, DNS Hostinger access, cle SSH publique), (b) sequence d'execution numerotee (prep VPS → Docker → .env → DNS → staging LE → prod LE → migrate auto → seed → smoke test), (c) variables d'environnement exhaustives (tableau nom/description/exemple/secret-oui-non), (d) commande de rollback (stop stack + restore dump), (e) contacts et acces (OVH/Hostinger, machine dev Brice) **And** une section **"Runbook"** contient : (a) commande de backup manuel, (b) commande de redeploy apres push code (`git pull && docker compose build backend && docker compose up -d backend`), (c) comment inspecter les logs (`docker compose logs -f backend`), (d) procedure de restoration DB, (e) versions installees (Docker, Compose, OS) — voir AC #3.

## Tasks / Subtasks

- [ ] **Task 1 — Prep VPS ops (AC: #1, #2, #3)**
  - [ ] Connexion SSH initiale `root@76.13.58.249`, changer immediatement le mot de passe root
  - [ ] Creer utilisateur `deploy` (`adduser deploy`, `usermod -aG sudo deploy`, configurer sudoers si NOPASSWD souhaite)
  - [ ] Installer cle SSH publique de la machine dev Brice dans `/home/deploy/.ssh/authorized_keys` (permissions `700` dossier, `600` fichier, `chown deploy:deploy`)
  - [ ] Durcir SSH : fichier `/etc/ssh/sshd_config.d/99-harden.conf` avec `PermitRootLogin prohibit-password`, `PasswordAuthentication no`, `PubkeyAuthentication yes`, `AllowUsers deploy` (ou equivalent)
  - [ ] `systemctl restart sshd` puis **tester** depuis une autre fenetre `ssh deploy@76.13.58.249` (ne pas fermer la session root tant que le test n'a pas reussi — safety)
  - [ ] Installer et configurer UFW : `apt install ufw`, `ufw default deny incoming`, `ufw default allow outgoing`, `ufw allow 22/tcp`, `ufw allow 80/tcp`, `ufw allow 443/tcp`, `ufw enable`, verifier `ufw status verbose`
  - [ ] Installer et activer fail2ban : `apt install fail2ban`, creer `/etc/fail2ban/jail.local` avec section `[sshd] enabled = true`, `systemctl enable --now fail2ban`, verifier `fail2ban-client status sshd`
  - [ ] Installer Docker Engine depuis depot officiel (instructions `docs.docker.com/engine/install/ubuntu/`) : cles GPG, repo apt, `apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`
  - [ ] `systemctl enable --now docker`, `usermod -aG docker deploy`, relog `deploy` pour appliquer groupe, tester `docker run --rm hello-world`
  - [ ] Tracer dans `README.md` section Runbook : versions `docker --version`, `docker compose version`, `cat /etc/os-release`

- [x] **Task 2 — Ecrire `docker/docker-compose.yml` prod (AC: #4, #5)**
  - [x] Sauvegarder l'actuel `docker/docker-compose.yml` (reference `postgresql-zvmf_default`) en le **remplacant** integralement (pas de backup dans repo, git garde l'historique)
  - [x] Declarer le reseau Docker bridge `tournoi-net` (non external)
  - [x] Declarer les volumes Docker nommes `tournoi-pg-data` et `traefik-acme`
  - [x] Service `traefik` (image `traefik:v3.2`) : command-line args pour entrypoints 80/443, provider Docker (`--providers.docker=true --providers.docker.exposedByDefault=false`), resolver Let's Encrypt HTTP-01 avec `--certificatesresolvers.letsencrypt.acme.email=${LETSENCRYPT_EMAIL}`, `--certificatesresolvers.letsencrypt.acme.storage=/acme/acme.json`, `--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web`, `--certificatesresolvers.letsencrypt.acme.caServer=${LETSENCRYPT_CA_SERVER}`, redirection globale 80→443 via middleware ou entrypoint config, ports `80:80` et `443:443`, volumes `/var/run/docker.sock:/var/run/docker.sock:ro` + `traefik-acme:/acme`, network `tournoi-net`, `restart: unless-stopped`, **aucune** activation API/dashboard
  - [x] Service `postgres` (image `postgres:17-alpine`) : env `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (depuis `.env`), volume `tournoi-pg-data:/var/lib/postgresql/data`, `healthcheck: test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]` (intervals 10s / timeout 5s / retries 5), network `tournoi-net`, **pas de `ports:`**, `restart: unless-stopped`
  - [x] Service `backend` : `build: context: ../backend`, env_file `../backend/.env.prod`, `depends_on: postgres: condition: service_healthy`, labels Traefik (`traefik.enable=true`, `traefik.http.routers.tournoi-tft-api.rule=Host(...)`, `traefik.http.routers.tournoi-tft-api.entrypoints=websecure`, `traefik.http.routers.tournoi-tft-api.tls.certresolver=letsencrypt`, `traefik.http.services.tournoi-tft-api.loadbalancer.server.port=3001`), `healthcheck` (wget sur `/api/health`), network `tournoi-net`, **pas de `ports:`**, `restart: unless-stopped`
  - [x] Creer `docker/.env.example` listant `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `LETSENCRYPT_EMAIL`, `LETSENCRYPT_CA_SERVER`
  - [x] Mettre a jour `backend/.env.example` si besoin (clarification commentaires prod — pas de nouvelle var — aucune modif necessaire)
  - [x] Verifier `.gitignore` racine : `**/.env`, `**/.env.prod` (complete : ajout `.env.prod`, `backend/.env`, `backend/.env.prod`, `docker/.env`)

- [x] **Task 3 — Entrypoint Dockerfile + migration auto (AC: #6)**
  - [x] Deplacer `prisma` de `devDependencies` vers `dependencies` dans [backend/package.json](backend/package.json) (necessaire pour `npx prisma migrate deploy` en prod avec `npm ci --omit=dev`)
  - [x] Regenerer `backend/package-lock.json` (`npm install --package-lock-only`) — verifie : `dependencies` contient prisma, `devDependencies` non
  - [x] Creer `backend/docker-entrypoint.sh` : shebang `#!/bin/sh`, `set -e`, `echo "Running Prisma migrations..."`, `npx prisma migrate deploy`, `echo "Starting server..."`, `exec node dist/index.js`
  - [x] `chmod +x backend/docker-entrypoint.sh` (bit executable applique en local ; sur Windows, git gere via `.gitattributes`)
  - [x] Creer/modifier `.gitattributes` racine pour forcer LF : `docker-entrypoint.sh text eol=lf` + `*.sh text eol=lf` + `docker/*.sh text eol=lf`. Verifie `file backend/docker-entrypoint.sh` = "POSIX shell script, ASCII text executable" (pas CRLF).
  - [x] Modifier [backend/Dockerfile](backend/Dockerfile) stage 2 : `COPY docker-entrypoint.sh /app/docker-entrypoint.sh`, `RUN chmod +x /app/docker-entrypoint.sh` (redondance defense en profondeur), `ENTRYPOINT ["/app/docker-entrypoint.sh"]` (CMD retire)
  - [ ] Tester **localement** Docker Desktop : `cd docker && docker compose up --build backend postgres` → observer les logs "Applied migration..." puis "Server running on port 3001" **(a executer par Brice en local avant push VPS)**

- [x] **Task 4 — Patches backend CORS + assertions env (AC: #7, #11)**
  - [x] Modifier [backend/src/app.ts:13](backend/src/app.ts) : `app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))` (fallback dev preserve ; en prod FRONTEND_URL est deja asserte dans index.ts)
  - [x] Modifier [backend/src/index.ts](backend/src/index.ts) lignes 12-15 : assertions `FRONTEND_URL`, `JWT_SECRET`, `DATABASE_URL` en prod. Refus explicite du defaut dev `dev-secret-tournoi-tft-eds-2026-change-in-production` pour `JWT_SECRET` (cf. `DEV_DEFAULTS`).
  - [x] Tester en local : `NODE_ENV=production node dist/index.js` avec `.env` dev (contient dev default JWT_SECRET) → exit 1 avec message `FATAL: JWT_SECRET is set to the dev default in production (must be rotated)` ; avec vars prod CLI → demarre sur port 3001.
  - [x] Verifier qu'aucun autre fichier backend n'est touche : modifs limitees a `backend/src/app.ts` + `backend/src/index.ts` + `backend/package.json` + `backend/package-lock.json` + `backend/Dockerfile` + `backend/docker-entrypoint.sh` (nouveau).

- [ ] **Task 5 — DNS Hostinger (AC: #8)**
  - [ ] Se connecter au panel DNS Hostinger pour `esportdessacres.fr`
  - [ ] Creer l'enregistrement A `api-tournoi` → `76.13.58.249`, TTL 3600s (ou plus court si permis)
  - [ ] Attendre propagation (typiquement <15 min chez Hostinger)
  - [ ] Verifier depuis machine dev : `dig +short api-tournoi.esportdessacres.fr` et `nslookup api-tournoi.esportdessacres.fr 8.8.8.8`
  - [ ] Documenter dans Runbook `README.md` : registrar = Hostinger, TTL choisi, proof de propagation (screenshot optionnel)

- [ ] **Task 6 — Deploy VPS staging + validation (AC: #9)**
  - [ ] `git clone <repo>` sur le VPS dans `/opt/tournoi-tft` (ou equivalent en user `deploy`)
  - [ ] Creer `docker/.env` et `backend/.env.prod` a partir des `.env.example`, renseigner les valeurs prod (secrets forts : `openssl rand -base64 32` pour `JWT_SECRET` et `POSTGRES_PASSWORD`)
  - [ ] S'assurer que `LETSENCRYPT_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory` dans `docker/.env` pour le **premier** demarrage
  - [ ] `docker compose up -d` → verifier `docker compose ps` (tous services `Up`, backend `healthy`)
  - [ ] `curl -I https://api-tournoi.esportdessacres.fr/api/health --insecure` → 200 OK
  - [ ] `openssl s_client -connect api-tournoi.esportdessacres.fr:443 -servername api-tournoi.esportdessacres.fr </dev/null 2>&1 | openssl x509 -noout -issuer` → issuer contient "STAGING"
  - [ ] `docker compose logs traefik | grep -i acme` → pas d'erreur persistante

- [ ] **Task 7 — Bascule Let's Encrypt prod (AC: #10)**
  - [ ] Modifier `docker/.env` : `LETSENCRYPT_CA_SERVER=https://acme-v02.api.letsencrypt.org/directory`
  - [ ] Vider le volume acme : `docker compose down traefik`, `docker volume rm tournoi-tft_traefik-acme` (ou equivalent selon nom projet compose) — **attention** : ne pas supprimer `tournoi-pg-data` !
  - [ ] `docker compose up -d --force-recreate traefik`
  - [ ] Attendre 1-2 minutes, verifier `curl -I https://api-tournoi.esportdessacres.fr/api/health` (sans `--insecure`) → 200 OK
  - [ ] `openssl s_client -connect api-tournoi.esportdessacres.fr:443 </dev/null 2>&1 | openssl x509 -noout -issuer -dates` → issuer "Let's Encrypt", notBefore recent
  - [ ] `curl -I http://api-tournoi.esportdessacres.fr/api/health` → 301/308 redirect vers https

- [ ] **Task 8 — Seed admin + smoke test end-to-end (AC: #12, #13)**
  - [x] Ecrire `docker/smoke-test.sh` (code livre — verifie health HTTPS, redirect HTTP->HTTPS, handshake Socket.IO, issuer cert prod LE, tournament/current 200)
  - [ ] `docker compose exec backend npx prisma db seed` → verifier log "Admin seeded" **(VPS / Brice)**
  - [ ] Executer `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr` sur le VPS **(VPS / Brice)**
  - [ ] Test login admin : `curl -X POST https://api-tournoi.esportdessacres.fr/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"<mot-de-passe-prod>"}'` → 200 + JWT **(VPS / Brice)**
  - [ ] Test handshake Socket.IO : `curl "https://api-tournoi.esportdessacres.fr/socket.io/?EIO=4&transport=polling"` → 200 + `0{"sid":...}` **(VPS / Brice)**
  - [ ] Test Tournament state : `curl https://api-tournoi.esportdessacres.fr/api/tournament/current` → 200 + JSON phase `idle` **(VPS / Brice)**

- [ ] **Task 9 — Script de backup PG + test restore (AC: #14)**
  - [x] Creer `docker/backup-pg.sh` : shebang, `set -eu`, charge `docker/.env`, `mkdir -p /root/backups`, `TS=$(date +%Y%m%d-%H%M%S)`, `docker compose exec -T postgres pg_dump -U $POSTGRES_USER -d $POSTGRES_DB | gzip > ...`, verification fichier non vide en sortie
  - [x] `chmod +x docker/backup-pg.sh`
  - [ ] Inserer un enregistrement test (player via `POST /api/players`) **(VPS / Brice)**
  - [ ] Executer le backup : `sudo /opt/tournoi-tft/docker/backup-pg.sh` → verifier fichier dans `/root/backups/`, non-vide (`ls -lh`), contenu (`gunzip -c | head -100` doit montrer du SQL PG) **(VPS / Brice)**
  - [ ] En **local Docker Desktop** (pas sur VPS) : creer une base PG test, executer le restore, verifier les tables et l'admin seede **(Brice en local)**

- [x] **Task 10 — Documentation README Deploy + Runbook (AC: #15)**
  - [x] Ajouter section **## Deploy** a [README.md](README.md) racine : pre-requis, sequence d'execution numerotee (12 etapes), tableau des env vars (2 tableaux : `docker/.env` + `backend/.env.prod`, colonnes nom/description/exemple/secret), commande de rollback, contacts & acces
  - [x] Ajouter section **## Runbook** : versions installees (tableau a remplir), backup manuel, restore DB, redeploy post-push, inspection logs, smoke test, debug Let's Encrypt
  - [x] Relecture coherence + mapping AC -> doc OK

- [ ] **Task 11 — Change Log & finalisation story**
  - [x] Ajouter section `## Change Log` en bas de ce fichier story, entree `v1.1 — 2026-04-24 — Amelia (Developer)` : implementation code Tasks 2/3/4/8-partial/9-partial/10
  - [x] Remplir `## Dev Agent Record` : Agent Model, Completion Notes (code-side), File List (fichiers commitables)
  - [ ] Status story passe a `review` une fois les 15 ACs valides en prod (pas avant) **— bloque tant que Tasks VPS 1/5/6/7 + volets VPS de 8/9 ne sont pas executes**

## Dev Notes

### Stack technique imposee (architecture.md + retro Epic 5)

- **OS VPS** : Ubuntu 24.04 LTS
- **Docker** : Docker Engine stable (>= 27.x) + Compose v2 (>= 2.30) — paquets `docker-ce*` du depot officiel Docker
- **Traefik** : v3.2 (image `traefik:v3.2`) — provider Docker, HTTP-01 challenge Let's Encrypt, pas de dashboard expose
- **PostgreSQL** : 17 Alpine (image `postgres:17-alpine`) — deja cible dans architecture.md:170
- **Node.js** : 22 Alpine (image `node:22-alpine`) — deja utilise dans [backend/Dockerfile:2](backend/Dockerfile)
- **Prisma** : 7.7.0 — migrations deployees en prod via `prisma migrate deploy` (architecture.md:180)

### Defense in Depth pour invariants infra (pattern retro Epic 5)

Appliquer systematiquement le principe : **invariant = garde explicite + message d'erreur clair + defaut refuse**. Illustrations :

| Invariant | Garde backend | Defaut refuse |
|---|---|---|
| `FRONTEND_URL` requis en prod | `process.exit(1)` dans [index.ts:12-15](backend/src/index.ts) | Pas de defaut prod (dev: `http://localhost:5173`) |
| `JWT_SECRET` requis en prod | **AC #11** : exit fatal si absent ou egal au defaut dev | Secret dev connu = rejete en prod |
| `DATABASE_URL` requis en prod | **AC #11** : exit fatal si absent | Pas de defaut |
| PG pas expose Internet | **AC #4** : `ports:` absent sur service `postgres` | UFW block 5432 redondant |
| Dashboard Traefik off | **AC #4** : pas de `--api.insecure=true` | Surface d'attaque reduite |
| Root SSH password off | **AC #1** : `PermitRootLogin prohibit-password` + `PasswordAuthentication no` | Brute force impossible |
| CORS REST strict | **AC #7** : `origin: FRONTEND_URL` | Pas de `cors()` open |
| Migration echouee = container down | **AC #6** : `set -e` dans entrypoint | Pas de start degrade sur schema obsolete |

### Pieges typiques (web intelligence + retro Epic 5)

1. **Rate limit Let's Encrypt prod** : 5 duplicate certs / 7 jours, 50 certs / registered domain / semaine. **Toujours tester en staging d'abord** (AC #9 → #10). Si on bursh les 5, attendre 7 jours.

2. **`docker compose up` charge `.env` du dossier courant par defaut**. Le `env_file: ../backend/.env.prod` pour le service backend est explicite. Le `docker/.env` sert **uniquement** pour la substitution `${VAR}` dans `docker-compose.yml` (secrets Traefik + PG). Deux fichiers `.env` distincts, deux usages.

3. **Montage socket Docker dans Traefik** : toujours `:ro` (read-only). Sans ca, un compromise Traefik = compromise host complet (escape container trivial). Meme avec `:ro`, c'est deja dangereux ; la mitigation est : pas de dashboard Traefik expose, image officielle uniquement, `cap_drop: ALL` + `cap_add: NET_BIND_SERVICE` (optionnel — a ajouter si scope permet, non bloquant AC).

4. **Healthcheck Docker vs Traefik route** : le healthcheck Docker (`docker compose ps` → healthy) ne suffit pas pour Traefik — Traefik route vers le service des qu'il est up, meme si unhealthy. Solution : `depends_on: condition: service_healthy` (ce qu'on fait pour backend → postgres) + labels Traefik `traefik.http.services.tournoi-tft-api.loadbalancer.healthcheck.path=/api/health` (optionnel mais recommande pour defense en profondeur). A ajouter au moment de Task 2 si trivial, sinon documente en dette Epic 6.

5. **`prisma migrate deploy` vs `prisma db push`** : **toujours `migrate deploy`** en prod. `db push` synchronise le schema sans migration files → dangereux, perd l'historique, pas d'audit. On a 2 migrations commitees — `migrate deploy` les applique propres.

6. **Prisma CLI en prod** : `npm ci --omit=dev` supprime `prisma` (devDep). Deux solutions : (a) bouger `prisma` en `dependencies` (Task 3 — retenu), (b) `npx prisma@7.7.0` pull a la volee (lent au boot). Option (a) plus propre.

7. **Seed en boucle** : `prisma.admin.upsert` avec `update: { passwordHash }` ecrasera le password si l'entrypoint re-seed a chaque boot. **Ne pas** mettre le seed dans l'entrypoint — execution manuelle une fois (AC #13).

8. **`FRONTEND_URL=https://tournoi.esportdessacres.fr` en prod** — mais la Story 6.2 deploie ce frontend plus tard. Entre 6.1 deploye et 6.2 deploye, le frontend prod n'existera pas encore. Le backend 6.1 est neanmoins testable via `curl` (pas besoin de frontend). L'AC #12 smoke test utilise `curl`, pas de navigateur. Les requetes CORS sont rejetees tant que le frontend 6.2 n'est pas deploye — comportement attendu, c'est la definition de Defense in Depth.

9. **Ordre de demarrage des services** : `traefik` peut demarrer en parallele de `postgres` et `backend`. `backend` attend `postgres healthy` (AC #6). Pas de dependance `traefik → backend` : Traefik decouvre le backend via labels Docker provider une fois que le container est up, meme retard.

10. **Volumes nommes vs bind mounts** : **toujours nomme** (`tournoi-pg-data`, `traefik-acme`). Permet `docker volume ls`, migration facile, pas de permissions host a gerer. Bind mount uniquement pour `/var/run/docker.sock:ro` (seule exception legitime).

11. **Windows CRLF dans `docker-entrypoint.sh`** (Brice dev sur Windows) : si le fichier est ecrit en CRLF, le shell alpine (`#!/bin/sh`) echoue au boot container avec `exec format error` ou equivalent cryptique. **Mitigation obligatoire** : ajouter `docker-entrypoint.sh text eol=lf` dans `.gitattributes` racine (creer si absent), et verifier via `file backend/docker-entrypoint.sh` apres commit (doit reporter "ASCII text" pas "with CRLF"). Sinon : `dos2unix backend/docker-entrypoint.sh` avant commit.

### Reuses Epic 1-5 (pas de reinvention)

| Asset existant | Reutilisation Epic 6 |
|---|---|
| [backend/Dockerfile](backend/Dockerfile) multi-stage | Base — ajouter entrypoint seulement (Task 3) |
| [backend/src/app.ts](backend/src/app.ts) `/api/health` | Healthcheck Traefik + smoke test (AC #9, #12) |
| [backend/prisma/migrations/](backend/prisma/migrations/) (2 migrations) | `prisma migrate deploy` les applique telles quelles (AC #6) |
| [backend/prisma/seed.ts](backend/prisma/seed.ts) | Seed admin prod (AC #13) — deja lit `ADMIN_DEFAULT_PASSWORD` de l'env |
| [backend/.env.example](backend/.env.example) | Template pour `.env.prod` — aucune nouvelle var requise (AC #5) |
| [backend/src/websocket/server.ts](backend/src/websocket/server.ts) CORS WS | Reference pour aligner CORS REST (AC #7) |
| Script pattern `backend/src/scripts/cleanup-finale.ts` (retro Epic 5) | Meme pattern pour `backup-pg.sh` (Task 9) |

### Regles d'execution

- **Un seul `docker-compose.yml` en prod** (pas de split dev/prod) — decision retenue (cf. Contexte).
- **`.env.prod` jamais committe** — verifier `.gitignore`.
- **Secrets forts en prod** : `openssl rand -base64 32` pour `JWT_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_DEFAULT_PASSWORD` (Task 6).
- **Pas de modif backend au-dela de AC #7 + AC #11** — ne pas "profiter" de la story pour refacto.
- **Pas de CI/CD dans cette story** — deploiement manuel (retro Epic 5 confirmee).
- **Change Log granulaire** : chaque hotfix post-review = entree v1.x dans ce fichier.

### Validation locale avant deploy VPS (recommandation)

Avant de pousser sur le VPS, Brice **doit** tester la stack en Docker Desktop local :

```bash
cd docker
cp .env.example .env   # remplir les valeurs dev (LE staging, password random)
# Pour tester avec le DNS prod sur machine locale, ajouter temporairement dans C:\Windows\System32\drivers\etc\hosts :
#   127.0.0.1 api-tournoi.esportdessacres.fr
docker compose up --build
# Dans une autre fenetre :
curl -I http://api-tournoi.esportdessacres.fr/api/health  # devrait rediriger vers https
curl -Ik https://api-tournoi.esportdessacres.fr/api/health  # LE staging -> insecure OK
```

Ce test local debusque 90% des erreurs de config `docker-compose.yml` **sans** bruler de rate-limit Let's Encrypt staging cote VPS.

### Project Structure Notes

- **Conserver** l'emplacement `docker/docker-compose.yml` (deja utilise en Epic 1-5).
- **Ajouter** `docker/.env.example`, `docker/backup-pg.sh`, `docker/smoke-test.sh`.
- **Ajouter** `backend/docker-entrypoint.sh` (a la racine de `backend/`, meme niveau que `Dockerfile`).
- **Ne pas** creer de dossier `/opt/tournoi-tft/.github/` ou `/ops/` separe — tout reste sous `docker/` et `backend/`.
- **README.md racine** : sections "Deploy" et "Runbook" a la fin, apres la section existante "Structure" / "Dev setup".

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-61](_bmad-output/planning-artifacts/epics.md) — version mise a jour en retro Epic 5 (VPS propre, PG dedie, prep VPS, DNS Hostinger, backup PG)
- [Source: _bmad-output/planning-artifacts/architecture.md#infrastructure--deployment](_bmad-output/planning-artifacts/architecture.md) — stack technique, CORS strategy, backup manuel (NB: reseau `postgresql-zvmf_default` obsolete, voir retro Epic 5)
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-04-24.md#découverte-significative-—-impact-epic-6](_bmad-output/implementation-artifacts/epic-5-retro-2026-04-24.md) — decision "tout sur le meme VPS", VPS tout propre, DNS Hostinger, **enseignements Defense in Depth + Change Log granulaire**
- [Source: backend/Dockerfile](backend/Dockerfile) — multi-stage actuel, base pour Task 3
- [Source: backend/src/app.ts:13](backend/src/app.ts) — CORS ouvert a restreindre (AC #7)
- [Source: backend/src/app.ts:16-18](backend/src/app.ts) — `/api/health` existe deja, reutilise
- [Source: backend/src/index.ts:9-15](backend/src/index.ts) — assertion `FRONTEND_URL` prod existante, base pour AC #11
- [Source: backend/src/websocket/server.ts:6-13](backend/src/websocket/server.ts) — CORS WebSocket strict, **reference pour aligner REST**
- [Source: backend/prisma/seed.ts](backend/prisma/seed.ts) — seed admin deja conforme prod (pas a modifier)
- [Source: backend/prisma/migrations/](backend/prisma/migrations/) — 2 migrations commitees, `migrate deploy` les applique
- [Source: docker/docker-compose.yml](docker/docker-compose.yml) — ancien fichier reference `postgresql-zvmf_default` obsolete, **a remplacer integralement**
- Traefik v3 docs : [doc.traefik.io/traefik/v3.2/](https://doc.traefik.io/traefik/v3.2/) — config ACME HTTP-01, providers Docker
- Prisma migrate deploy : [prisma.io/docs/orm/prisma-migrate/workflows/production-and-testing](https://www.prisma.io/docs/orm/prisma-migrate/workflows/production-and-testing)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — story context engine

### Debug Log References

- `npm install --package-lock-only` apres deplacement prisma devDep -> dep : lockfile regenere, `packages[''].dependencies.prisma` present, `devDependencies.prisma` absent.
- `npm run build` (backend) apres patches app.ts / index.ts : OK, aucune erreur TS.
- Test assertion prod env : `NODE_ENV=production node dist/index.js` avec `.env` dev (contenant `JWT_SECRET=dev-secret-...`) -> `FATAL: JWT_SECRET is set to the dev default in production (must be rotated)` + exit code 1. Test avec vars prod via CLI -> `Server running on port 3001 (HTTP + Socket.IO)`. Asserts valides.
- `file backend/docker-entrypoint.sh` -> "POSIX shell script, ASCII text executable" (LF confirme, pas de CRLF Windows).
- `.gitattributes` cree a la racine avec rules LF explicites sur `*.sh`, `docker-entrypoint.sh`, `backend/docker-entrypoint.sh`, `docker/*.sh` (defense en profondeur piege #11 Dev Notes).

### Completion Notes List

**Phase 1 — Code livre (repo) :**

- ✅ **docker/docker-compose.yml** : remplacement integral. 3 services (`traefik:v3.2`, `postgres:17-alpine`, `backend` build `../backend`), reseau `tournoi-net` bridge, volumes nommes `tournoi-pg-data` + `traefik-acme`. Traefik : HTTP-01 LE via `${LETSENCRYPT_CA_SERVER}` (bascule staging->prod par env), redirection globale 80->443, socket Docker `:ro`, aucun dashboard ni `--api.insecure`. PG : aucun port expose, healthcheck `pg_isready`. Backend : labels Traefik (`api-tournoi.esportdessacres.fr`, resolver `letsencrypt`, port 3001), healthcheck `wget --spider /api/health`, `depends_on: postgres: service_healthy`, `env_file: ../backend/.env.prod`, aucun port expose.
- ✅ **docker/.env.example** : 5 vars (`POSTGRES_DB/USER/PASSWORD`, `LETSENCRYPT_EMAIL`, `LETSENCRYPT_CA_SERVER` avec les 2 valeurs commentees staging + prod).
- ✅ **.gitignore** : ajout `.env.prod`, `backend/.env`, `backend/.env.prod`, `docker/.env` (en plus de `.env` existant).
- ✅ **.gitattributes** (nouveau) : rules LF pour tous les `.sh` + entries dediees `docker-entrypoint.sh`.
- ✅ **backend/package.json** : `prisma` deplace de `devDependencies` vers `dependencies` (`npx prisma migrate deploy` accessible en image prod `npm ci --omit=dev`).
- ✅ **backend/package-lock.json** : regenere (`npm install --package-lock-only`).
- ✅ **backend/docker-entrypoint.sh** (nouveau) : `#!/bin/sh` + `set -e` + `npx prisma migrate deploy` + `exec node dist/index.js`. LF, executable.
- ✅ **backend/Dockerfile** : stage 2 copie l'entrypoint, `chmod +x`, remplace `CMD` par `ENTRYPOINT`.
- ✅ **backend/src/app.ts** : CORS passe de `cors()` (ouvert) a `cors({ origin: FRONTEND_URL || localhost:5173 })`. Align avec WebSocket.
- ✅ **backend/src/index.ts** : assertions prod `FRONTEND_URL` (deja present), `JWT_SECRET`, `DATABASE_URL`. `JWT_SECRET` egal au defaut dev (`dev-secret-tournoi-tft-eds-2026-change-in-production`) refuse explicitement. Exit 1 + message fatal.
- ✅ **docker/smoke-test.sh** (nouveau) : 5 checks end-to-end (health HTTPS, redirect HTTP->HTTPS, Socket.IO handshake, issuer cert LE prod, `/api/tournament/current`). LF, executable.
- ✅ **docker/backup-pg.sh** (nouveau) : charge `docker/.env`, `pg_dump | gzip > /root/backups/tournoi-TS.sql.gz`, verification fichier non vide, variables manquantes refusees. LF, executable.
- ✅ **README.md** : sections **## Deploy** (12 etapes, tableaux env vars, rollback, contacts) + **## Runbook** (versions, backup, restore, redeploy, logs, smoke test, debug LE).

**Phase 2 — Execution VPS requise (Brice) :**

Les Tasks 1, 5, 6, 7 et les volets VPS de 8/9 ne peuvent pas etre executes cote agent (acces SSH root VPS, panel DNS Hostinger, emission certs LE). Runbook operationnel livre dans `README.md` section Deploy (etapes 1-12) et dans la messagerie de fin de tour. Une fois le VPS deploye et les ACs 1-3, 8-10, 12-14 valides, le reste des checkboxes peut etre coche et le status passera a `review`.

**Verifications code-side effectuees :**

- Build TS backend : OK, aucune regression.
- Asserts env prod testes en local (exit 1 + message fatal).
- Dockerfile : entrypoint LF, bit executable applique.
- Lockfile prisma correctement deplace.

### File List

_Fichiers crees :_
- `backend/docker-entrypoint.sh` (nouveau)
- `docker/.env.example` (nouveau)
- `docker/backup-pg.sh` (nouveau)
- `docker/smoke-test.sh` (nouveau)

_Fichiers modifies :_
- `backend/src/app.ts` (CORS strict prod)
- `backend/src/index.ts` (assertions env vars prod)
- `backend/package.json` (prisma -> dependencies)
- `backend/package-lock.json` (regenere)
- `backend/Dockerfile` (ENTRYPOINT)
- `docker/docker-compose.yml` (remplacement complet : Traefik + PG + backend)
- `README.md` (sections Deploy + Runbook)

_Fichiers hors repo (config VPS) :_
- `/etc/ssh/sshd_config.d/99-harden.conf` (VPS)
- `/etc/fail2ban/jail.local` (VPS)
- `/opt/tournoi-tft/docker/.env` (VPS, non committe)
- `/opt/tournoi-tft/backend/.env.prod` (VPS, non committe)
- `/root/backups/tournoi-*.sql.gz` (VPS, non committe)

## Change Log

| Version | Date | Auteur | Description |
|---------|------|--------|-------------|
| v1.0 | 2026-04-24 | Amelia (Developer) | Creation story 6.1 comprehensive — 15 ACs, 11 tasks, dev notes complets avec Defense in Depth pattern et pieges typiques Let's Encrypt/Docker/Prisma |
| v1.1 | 2026-04-24 | Amelia (Developer) | Implementation code-side : docker-compose.yml (Traefik + PG + backend), docker/.env.example, .gitignore + .gitattributes, package.json (prisma -> deps), docker-entrypoint.sh, Dockerfile (ENTRYPOINT), app.ts (CORS strict), index.ts (asserts prod JWT_SECRET/DATABASE_URL/FRONTEND_URL), smoke-test.sh, backup-pg.sh, README.md (Deploy + Runbook). Tasks VPS (1, 5, 6, 7 + volets 8/9) en attente execution Brice. |
