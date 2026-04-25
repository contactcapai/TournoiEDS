# Story 6.2 : Deploiement Frontend (Container nginx derriere Traefik)

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **admin (Brice)**,
I want **que le frontend Vite/React (build statique) soit servi par un container nginx co-localise sur le VPS, derriere le Traefik existant, en HTTPS sur `tournoi.esportdessacres.fr`**,
so that **les joueurs et spectateurs accedent au site sans dependre d'un hosting FTP separe, en reutilisant la stack Docker + cert resolver Let's Encrypt deployee par la Story 6.1**.

## Contexte de la story

**Deuxieme story d'Epic 6** — succes de Story 6.1 (backend operationnel sur `https://api-tournoi.esportdessacres.fr`, cert Let's Encrypt prod issuer R13 valide jusqu'au 2026-07-23, smoke test 5/5 OK le 2026-04-24). Tout le socle infra (VPS durci, Docker Engine 29.4.1 + Compose v5.1.3, reseau `tournoi-net`, volume `traefik-acme`, resolver `letsencrypt` configure HTTP-01) **existe deja** — cette story ne fait qu'**ajouter un service `frontend`** a la stack et un enregistrement DNS frontend (deja cree en avance pendant Task 5 de 6.1, a valider).

**Pivot vs architecture.md/epics.md d'origine** : la version initiale prevoyait un hosting FTP Hostinger pour le frontend (`architecture.md:585-588`). **Decision retro Epic 5 (2026-04-24)** confirmee : tout sur le meme VPS, container nginx derriere Traefik (`tournoi.esportdessacres.fr`). La cle de sprint-status reste `6-2-deploiement-frontend-hostinger` (heritage), mais l'implementation est **Container nginx VPS, pas FTP Hostinger**.

**Etat actuel du code (hotspots)** :

1. [frontend/src/services/api.ts:3](frontend/src/services/api.ts) — `const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';`. **Vite injecte les variables `VITE_*` au moment du `npm run build`**, pas au runtime. Consequence : le build prod doit etre execute avec `VITE_API_URL=https://api-tournoi.esportdessacres.fr` dans l'environnement (pas dans le container nginx final). Si on oublie cette var au build, le frontend prod tape `localhost:3001` et echoue. **Defense in Depth (AC #1)** : la valeur est passee via `ARG` Docker au stage 1 de build.
2. [frontend/src/services/socket.ts:4](frontend/src/services/socket.ts) — meme pattern : `const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';`. Une seule var `VITE_API_URL` couvre REST + WebSocket. Pas de var separee a gerer.
3. [frontend/src/App.tsx](frontend/src/App.tsx) — React Router v7 `<BrowserRouter>` avec routes `/`, `/mentions-legales`, `/qualifications`, `/finale`, `/overlay`, `/admin/login`, `/admin`. **Toutes** ces routes doivent etre servies par nginx via fallback SPA (`try_files $uri $uri/ /index.html;`) — sinon `tournoi.esportdessacres.fr/qualifications` renverra **404 nginx** au lieu de servir `index.html` qui charge React et resout le routing client-side.
4. [frontend/vite.config.ts](frontend/vite.config.ts) — Vite 8 config minimale (plugins React + Tailwind v4). Vite produit par defaut `dist/` avec `index.html`, `assets/index-{hash}.css`, `assets/index-{hash}.js`, et copie `public/*` (favicon.svg, icons.svg) a la racine. Les fichiers de `assets/` sont **immutables et nommes par hash** → cache `Cache-Control: public, max-age=31536000, immutable` correct. `index.html` est mutable → `Cache-Control: no-cache` ou `max-age=0, must-revalidate`.
5. [frontend/package.json](frontend/package.json) — `npm run build` = `tsc -b && vite build`. **TSC strict `noEmit` puis vite build** — toute erreur TS bloque le build. C'est le comportement souhaite (AC #1) : un build cassant doit fail-fast plutot que servir un `dist/` incoherent.
6. [docker/docker-compose.yml](docker/docker-compose.yml) — stack 6.1 actuelle : 3 services (`traefik`, `postgres`, `backend`) + reseau `tournoi-net` + volumes `tournoi-pg-data` + `traefik-acme`. **A enrichir** : ajouter un 4eme service `frontend` (build `../frontend`), labels Traefik pour `tournoi.esportdessacres.fr`, network `tournoi-net`, healthcheck, restart policy. **Aucune modification** des 3 services existants — perimetre strict.
7. [backend/.env.prod sur VPS](backend/.env.prod) — verifie en review 6.1 (Action item #2) : `FRONTEND_URL=https://tournoi.esportdessacres.fr` (sans trailing slash). Le CORS backend repond donc deja `Access-Control-Allow-Origin: https://tournoi.esportdessacres.fr` pour les requetes pre-flight. Aucun changement backend requis dans cette story.
8. **DNS** : enregistrement A `tournoi.esportdessacres.fr` → `76.13.58.249` deja **cree** en Task 5 de 6.1 (avance). **A verifier** propagation (`dig +short tournoi.esportdessacres.fr` doit retourner `76.13.58.249`) avant d'emettre le cert prod (AC #6).
9. **Cert resolver Traefik** : le resolver `letsencrypt` configure dans `docker-compose.yml` (cmd `--certificatesresolvers.letsencrypt.acme.caServer=${LETSENCRYPT_CA_SERVER}`) est **partage** entre tous les services labellises. Le `caServer` est actuellement en mode **prod** (`https://acme-v02.api.letsencrypt.org/directory`) suite a la bascule reussie de 6.1. **Implication critique (AC #5/#6)** : ajouter le label Traefik frontend declenche **directement** une emission cert prod. Si la config (DNS, label, redirect HTTP→HTTPS, port 80 atteignable) n'est pas correcte, on **brule** une tentative sur les 5 duplicate certs / 7 jours du rate limit prod. **Mitigation** : tester localement Docker Desktop d'abord (AC #2/#3) ; si doute, basculer **temporairement** le `caServer` en staging dans `docker/.env` sur VPS, valider, puis rebasculer prod (cf. piege LE — Dev Notes).

**Perimetre clair (DANS 6.2)** :

1. **Multi-stage Dockerfile frontend** — `frontend/Dockerfile` (nouveau). Stage 1 `node:22-alpine` : `npm ci`, `ARG VITE_API_URL`, `ENV VITE_API_URL=${VITE_API_URL}`, `npm run build` → produit `dist/`. Stage 2 `nginx:1.27-alpine` (ou `nginx:alpine` floating si pinning trop strict) : copie `dist/` dans `/usr/share/nginx/html`, copie config nginx custom. Pattern symetrique au [backend/Dockerfile](backend/Dockerfile) (multi-stage, Alpine, pas de root explicite mais image officielle deja non-root pour nginx via `USER nginx` au runtime — natif image officielle).
2. **Config nginx SPA-friendly** — `frontend/nginx.conf` (nouveau). Server bloc avec :
   - `listen 80;` (Traefik fait le TLS, pas le frontend container)
   - `root /usr/share/nginx/html;`
   - `index index.html;`
   - `location / { try_files $uri $uri/ /index.html; }` — fallback SPA pour toutes les routes React Router
   - `location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }` — assets hashes Vite (long cache)
   - `location = /index.html { add_header Cache-Control "no-cache, must-revalidate"; expires 0; }` — bypass cache sur HTML (pour deployer une nouvelle version sans purge)
   - `gzip on;` + `gzip_types` (text/css, application/javascript, image/svg+xml, application/json) — reduction bande passante (deja gzip via build Vite mais gzip nginx supplementaire couvre le HTML statique)
   - **Pas** de log access verbose en prod (`access_log off;` ou `access_log /var/log/nginx/access.log;` si on veut conserver, decision retenue : `access_log off;` car Traefik logue deja les hits — eviter doublon).
3. **Service `frontend` dans docker-compose.yml** — ajouter au [docker/docker-compose.yml](docker/docker-compose.yml) existant (NE PAS recreer le fichier, NE PAS toucher aux 3 services existants) :
   - `build: context: ../frontend, dockerfile: Dockerfile, args: VITE_API_URL: https://api-tournoi.esportdessacres.fr`
   - `container_name: tournoi-tft-frontend`
   - `restart: unless-stopped`
   - `healthcheck: test: ["CMD-SHELL", "wget -qO- --spider http://127.0.0.1/ || exit 1"]` (`wget` natif `nginx:alpine`), `interval: 30s`, `timeout: 5s`, `retries: 3`, `start_period: 10s`
   - **labels Traefik** :
     - `traefik.enable=true`
     - `traefik.docker.network=tournoi-net`
     - `traefik.http.routers.tournoi-tft-web.rule=Host(`tournoi.esportdessacres.fr`)`
     - `traefik.http.routers.tournoi-tft-web.entrypoints=websecure`
     - `traefik.http.routers.tournoi-tft-web.tls=true`
     - `traefik.http.routers.tournoi-tft-web.tls.certresolver=letsencrypt`
     - `traefik.http.services.tournoi-tft-web.loadbalancer.server.port=80`
   - `networks: - tournoi-net`
   - **PAS de `ports:`** (Traefik route en interne, redirection HTTP→HTTPS deja globale)
4. **DNS verification** — `dig +short tournoi.esportdessacres.fr` (depuis machine dev + resolver externe `8.8.8.8`) doit retourner `76.13.58.249`. Si non propage, attendre / forcer un refresh, **avant** `docker compose up -d frontend`.
5. **Validation locale Docker Desktop** — Brice teste la stack complete sur son poste avant push VPS, en utilisant `127.0.0.1 tournoi.esportdessacres.fr` dans `C:\Windows\System32\drivers\etc\hosts` + LE staging temporaire (commenter le label cert resolver ou basculer `LETSENCRYPT_CA_SERVER` en staging dans `.env`). Pattern repris de 6.1 — debusque 90% des erreurs de config sans bruler de rate-limit.
6. **Build + deploy VPS** — sur le VPS : `cd /opt/tournoi-tft && git pull` (recupere `frontend/Dockerfile`, `frontend/nginx.conf`, `docker/docker-compose.yml` mis a jour), `cd docker && docker compose build frontend && docker compose up -d frontend`. Cert prod LE emis automatiquement (le resolver est deja en mode prod cote Traefik). Apres au plus 2 min, `curl -I https://tournoi.esportdessacres.fr` → 200.
7. **Tests fonctionnels post-deploy** :
   - Routes SPA directement par URL (`/qualifications`, `/finale`, `/admin`, `/admin/login`, `/mentions-legales`, `/overlay`) : `curl -fsS -o /dev/null -w "%{http_code}\n" https://tournoi.esportdessacres.fr/qualifications` doit retourner `200` (pas `404`).
   - Page d'accueil charge : `curl -fsS https://tournoi.esportdessacres.fr/ | grep -q '<div id="root">'` reussi.
   - Assets hashes : `curl -I https://tournoi.esportdessacres.fr/assets/index-<hash>.js` retourne `Cache-Control: public, max-age=31536000, immutable`.
   - Redirect HTTP→HTTPS : `curl -I http://tournoi.esportdessacres.fr/` retourne `301` ou `308`.
   - Cert prod : `openssl s_client -connect tournoi.esportdessacres.fr:443 -servername tournoi.esportdessacres.fr </dev/null 2>&1 | openssl x509 -noout -issuer -dates` → issuer "Let's Encrypt" prod (pas "STAGING"), `notBefore` recente.
   - Integration browser : depuis un navigateur, ouvrir `https://tournoi.esportdessacres.fr/qualifications` → page se charge, classement visible (vide si DB vide), connexion WebSocket etablie (DevTools Network → WS frame), aucun warning **mixed-content** (rouge dans console), aucun erreur CORS rouge.
8. **Workflow redeploy documente** — pattern retenu : **build sur le VPS** via `git pull && docker compose build frontend && docker compose up -d frontend` (option B des epics, plus simple que le scp local). Documente dans la section `## Deploy` du `README.md` racine, en mise a jour de la section existante 6.1.
9. **Smoke test enrichi** — etendre `docker/smoke-test.sh` (deja existant pour le backend) pour ajouter 2-3 checks frontend (homepage 200, route SPA 200, redirect HTTP→HTTPS), passe en argument optionnel `FRONTEND_URL=https://tournoi.esportdessacres.fr`. **Alternative** : creer `docker/smoke-test-web.sh` separe. **Decision retenue (AC #9)** : etendre le script existant — un seul script de smoke test pour toute la stack = un seul cmd a memoriser pour Brice le jour J.
10. **Documentation README** — section `## Deploy` enrichie (sequence integre l'etape frontend), tableau env vars enrichi (mention `VITE_API_URL` build-time pour le frontend), section `## Runbook` enrichie (commande redeploy frontend + inspection logs frontend `docker compose logs -f frontend`).
11. **Change Log granulaire v1.x** — pattern retro Epic 5 conservé. Chaque hotfix post-review = entree v1.x.

**Perimetre explicitement HORS 6.2 (a ne PAS implementer ici)** :

- ❌ **Dry-run complet et validation SkyDow** — Story 6.3 (le test `/overlay` reel necessite SkyDow + OBS).
- ❌ **CI/CD automatisee** — retro Epic 5 acte "deploiement manuel". Pas de GitHub Actions ici.
- ❌ **Monitoring / alerting** — non-MVP.
- ❌ **Backup automatise (cron)** — deja documente Runbook 6.1, non touche.
- ❌ **Refactor backend** — backend 100 % fige depuis 6.1 review APPROVED. Aucune modif `backend/src/*` n'est autorisee dans cette story.
- ❌ **Modification des services `traefik`, `postgres`, `backend` dans `docker-compose.yml`** — perimetre strict : seul `frontend` est ajoute. Aucun champ des autres services n'est touche.
- ❌ **Optimisation bundle Vite** — bundle 148 kB gz est deja sous le plafond. Ne pas "profiter" de la story pour code-splitter ou prefetch.
- ❌ **Implementation d'une CSP / Strict-Transport-Security headers avancee** — Traefik ne pose pas de HSTS par defaut, et l'image nginx officielle non plus. Documenter comme dette Epic 6 si souhait, mais **non bloquant** MVP. (Note : Let's Encrypt + HTTPS forcing via Traefik redirect couvre le besoin baseline.)
- ❌ **Hostinger FTP / hosting alternatif** — explicitement rejete (decision retro Epic 5).
- ❌ **Optimisation images / WebP further compression** — les `.webp` partenaires sont deja optimises en Epic 1.
- ❌ **Service worker / PWA** — non-MVP.

**Regles projet rappelees (memoire Brice)** :

- **VPS Hostinger `76.13.58.249`** — backend deja deploye en 6.1, frontend a co-localiser dans la meme stack Docker.
- **DNS Hostinger** — enregistrement A `tournoi.esportdessacres.fr` deja cree en avance Task 5 de 6.1. **Verifier propagation** avant deploy frontend.
- **Validation OBS dependante SkyDow** — la route `/overlay` doit **etre servie 200** par le frontend (AC #7), mais la **validation visuelle finale dans OBS** est report en 6.3 (dependance SkyDow). Cette story ne pretend pas que `/overlay` est valide pixel-perfect dans OBS — uniquement que la route est accessible.
- **Docker Desktop local (Brice)** — Brice doit imperativement tester la stack complete en local avant push VPS. Pattern 6.1 retenu : `127.0.0.1 tournoi.esportdessacres.fr` dans `hosts` + `LETSENCRYPT_CA_SERVER` staging temporaire si on veut tester l'emission cert ; ou skip Traefik en local et `docker compose up frontend` puis `curl -H "Host: tournoi.esportdessacres.fr" http://localhost`.
- **Defense in Depth pour invariants infra** (pattern retro Epic 5 reconduit) : (a) build args explicites (echec si oublie), (b) `wget --spider /` healthcheck (container marque unhealthy si nginx down), (c) `try_files` fallback SPA explicite (pas de 404 React Router), (d) `Cache-Control` immutable strict sur `/assets/*` mais `no-cache` sur `index.html` (rollback instantane sans purge cache navigateur).
- **Change Log granulaire v1.x par story** (pattern retro Epic 5 reconduit) — chaque hotfix infra post-review = entree v1.x dans ce fichier.

**Decision d'architecture cle** : **Multi-stage Docker build** (option B des epics) plutot que bind-mount du `dist/` local (option A). Raison : (a) image self-contained, reproductible, identique sur Docker Desktop et VPS ; (b) pas de risque "j'ai oublie de rebuild localement avant scp" ; (c) symetrique au backend (meme pattern multi-stage Alpine) ; (d) le build prod tourne sur l'image, donc Brice n'a pas besoin de Node 22 sur le VPS — uniquement Docker. Cout : un peu plus de RAM/CPU pendant le build VPS (~30 s sur un VPS Hostinger basique). Acceptable.

**Decision d'architecture secondaire** : **`VITE_API_URL` passee via `ARG` Docker** plutot que via `.env.production` commite. Raison : (a) la valeur est de la config infra (URL prod), pas un secret, mais elle est specifique a cet environnement — un fichier `frontend/.env.production` commite contraindrait des contributeurs futurs a un seul environnement ; (b) en passant via `args:` dans `docker-compose.yml`, la valeur est centralisee dans un fichier orchestration deja sous controle ; (c) si demain on veut un staging ou un autre tournoi, on change l'arg et c'est tout. Alternative rejetee : `frontend/.env.production` commite avec `VITE_API_URL=https://api-tournoi.esportdessacres.fr` — fonctionne mais moins flexible.

**Decision d'architecture tertiaire** : **Reutiliser le resolver `letsencrypt` existant** plutot qu'en creer un dedie au frontend. Le resolver est partage entre routers Traefik — un seul ACME account, un seul `acme.json`, gestion centralisee. Le cert prod sera emis automatiquement au premier hit `tournoi.esportdessacres.fr` une fois le service frontend up et le DNS propage. **Risque rate-limit prod LE** mitige par : (a) DNS pre-cree (pas d'aller-retour), (b) test local Docker Desktop avant VPS, (c) si echec, bascule temporaire `LETSENCRYPT_CA_SERVER` en staging dans `docker/.env` sur VPS le temps de fixer.

## Acceptance Criteria

1. **Given** le code frontend est pret et inchange depuis Epic 5 **When** je definis le build de production **Then** un fichier `frontend/Dockerfile` (nouveau) existe avec **2 stages** : stage 1 `node:22-alpine` qui execute `npm ci` puis `npm run build` apres avoir injecte `VITE_API_URL` via `ARG VITE_API_URL` + `ENV VITE_API_URL=${VITE_API_URL}` ; stage 2 `nginx:1.27-alpine` (ou `nginx:alpine` documente comme tag floating) qui copie `dist/` du stage 1 vers `/usr/share/nginx/html` et copie la config nginx custom **And** un build local `docker build --build-arg VITE_API_URL=https://api-tournoi.esportdessacres.fr -t tournoi-tft-frontend ./frontend` reussit **And** un `docker run -p 8080:80 tournoi-tft-frontend` puis `curl -fsS http://localhost:8080/` retourne le HTML de la SPA (`<div id="root">`) **And** un `grep -r "localhost:3001" dist/` dans une image debugging confirme que **aucun bundle JS de prod ne reference `localhost:3001`** (la var `VITE_API_URL` a bien ete injectee — sinon Vite a fallback sur localhost).

2. **Given** le frontend Dockerfile est pret **When** je configure nginx pour servir une SPA React Router **Then** un fichier `frontend/nginx.conf` (nouveau) existe definissant un `server` bloc avec : `listen 80;`, `server_name _;` (catch-all — Traefik filtre par Host), `root /usr/share/nginx/html;`, `index index.html;`, `location / { try_files $uri $uri/ /index.html; }` (fallback SPA), `location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }` (cache long sur fichiers hashes Vite), `location = /index.html { add_header Cache-Control "no-cache, must-revalidate"; expires 0; }` (HTML jamais cache), `gzip on;` + `gzip_types text/css application/javascript application/json image/svg+xml font/ttf font/woff font/woff2;`, `access_log off;` (Traefik logue deja) **And** la config est copiee dans l'image au stage 2 (`COPY nginx.conf /etc/nginx/conf.d/default.conf`) **And** le container demarre sans erreur (`docker compose logs frontend` ne contient aucun `nginx: [emerg]`).

3. **Given** la stack 6.1 est operationnelle **When** je modifie [docker/docker-compose.yml](docker/docker-compose.yml) pour ajouter le service frontend **Then** un 4eme service `frontend` est ajoute (les 3 services existants `traefik`, `postgres`, `backend` ne sont **PAS modifies**), avec : `build: context: ../frontend, dockerfile: Dockerfile, args: VITE_API_URL: https://api-tournoi.esportdessacres.fr`, `container_name: tournoi-tft-frontend`, `restart: unless-stopped`, `healthcheck: test: ["CMD-SHELL", "wget -qO- --spider http://127.0.0.1/ || exit 1"], interval: 30s, timeout: 5s, retries: 3, start_period: 10s`, `networks: [tournoi-net]`, **AUCUN `ports:` expose sur l'host** (Traefik route en interne) **And** les labels Traefik sont definis : `traefik.enable=true`, `traefik.docker.network=tournoi-net`, `traefik.http.routers.tournoi-tft-web.rule=Host(\`tournoi.esportdessacres.fr\`)`, `traefik.http.routers.tournoi-tft-web.entrypoints=websecure`, `traefik.http.routers.tournoi-tft-web.tls=true`, `traefik.http.routers.tournoi-tft-web.tls.certresolver=letsencrypt`, `traefik.http.services.tournoi-tft-web.loadbalancer.server.port=80` **And** `docker compose config` (validation syntaxique YAML + interpolation env) reussit sans erreur.

4. **Given** la stack 4-services est definie **When** je teste localement Docker Desktop avant push VPS **Then** depuis la machine dev (Windows + Docker Desktop), `cd docker && docker compose build frontend` reussit (build multi-stage termine sans erreur) **And** apres ajout temporaire de `127.0.0.1 tournoi.esportdessacres.fr` dans `C:\Windows\System32\drivers\etc\hosts`, un `docker compose up -d` (stack complete) demarre les 4 services et `docker compose ps` montre `frontend Up X (healthy)` apres 30 s **And** `curl -H "Host: tournoi.esportdessacres.fr" http://localhost/` (sans Traefik TLS test, ou via `--insecure` si on teste avec resolver staging local) retourne 200 + HTML SPA (`<div id="root">`) **And** `curl -H "Host: tournoi.esportdessacres.fr" http://localhost/qualifications` retourne 200 + meme HTML (preuve fallback SPA `try_files`) **And** la sequence complete de validation locale est documentee dans le README (section Deploy ou bloc dedie de la story dev notes).

5. **Given** le DNS frontend a ete cree en Task 5 de 6.1 **When** je verifie la propagation avant deploy VPS **Then** `dig +short tournoi.esportdessacres.fr` depuis la machine dev retourne `76.13.58.249` **And** `nslookup tournoi.esportdessacres.fr 8.8.8.8` retourne egalement `76.13.58.249` (resolver externe, propagation confirmee) **And** la propagation est verifiee **avant** le `docker compose up -d frontend` sur le VPS — sinon Let's Encrypt echoue le challenge HTTP-01 et brule une tentative sur le rate limit prod 5/7j.

6. **Given** la stack mise a jour est pushee et le DNS est propage **When** je deploie sur le VPS **Then** depuis le VPS (`ssh deploy@76.13.58.249`), `cd /opt/tournoi-tft && git pull` recupere `frontend/Dockerfile`, `frontend/nginx.conf`, le service `frontend` ajoute dans `docker/docker-compose.yml` (et la maj README) **And** `cd docker && docker compose build frontend` reussit (build multi-stage Node 22 + nginx) **And** `docker compose up -d frontend` cree et demarre le container `tournoi-tft-frontend` **And** apres au plus 2 minutes, `docker compose ps` montre `tournoi-tft-frontend Up X (healthy)` **And** `docker compose logs traefik 2>&1 | grep -i acme` ne contient aucune erreur ACME persistante pour le domaine `tournoi.esportdessacres.fr`.

7. **Given** le frontend est deploye et le cert prod est emis **When** je verifie l'acces public HTTPS **Then** `curl -I https://tournoi.esportdessacres.fr/` (sans `--insecure`) retourne `HTTP/2 200` **And** `curl -I http://tournoi.esportdessacres.fr/` retourne `301` ou `308` avec `Location: https://tournoi.esportdessacres.fr/` (redirection forcee par l'entrypoint `web` Traefik configure en 6.1) **And** `openssl s_client -connect tournoi.esportdessacres.fr:443 -servername tournoi.esportdessacres.fr </dev/null 2>&1 | openssl x509 -noout -issuer -dates` retourne un issuer **"Let's Encrypt"** prod (pas "STAGING"/"Fake LE") et une `notBefore` recente **And** **toutes** les routes SPA suivantes retournent `200` (pas `404`) directement par URL : `/`, `/qualifications`, `/finale`, `/mentions-legales`, `/admin`, `/admin/login`, `/overlay` — verifie via `for r in / /qualifications /finale /mentions-legales /admin /admin/login /overlay; do curl -fsS -o /dev/null -w "%{http_code} $r\n" https://tournoi.esportdessacres.fr$r; done` qui doit afficher `200` sur chaque ligne.

8. **Given** la SPA est servie en HTTPS **When** je teste l'integration backend depuis un navigateur **Then** depuis `https://tournoi.esportdessacres.fr/qualifications` (DevTools ouvert, onglet Network), la fetch initiale `GET https://api-tournoi.esportdessacres.fr/api/rankings` retourne `200` (pas d'erreur CORS rouge) **And** la connexion WebSocket Socket.IO `wss://api-tournoi.esportdessacres.fr/socket.io/?EIO=4&transport=websocket` aboutit (status `101 Switching Protocols`) **And** **aucun** warning **mixed-content** (rouge dans la console) ne s'affiche : tous les assets et fetches utilisent `https://` **And** **aucune** erreur CORS visible (pas de "Access to fetch... has been blocked by CORS policy") **And** un test de soumission du formulaire d'inscription (`POST https://api-tournoi.esportdessacres.fr/api/players` depuis la page `/`) reussit (verifie via DevTools : status `201` ou `200` + payload joueur).

9. **Given** la stack est en prod **When** je verifie les performances et le cache **Then** la requete `https://tournoi.esportdessacres.fr/` charge en moins de **2 secondes** (mesure DevTools Network sur reseau standard fibre/4G — onglet Performance → DOMContentLoaded < 2 s) **And** un asset hashe Vite (ex: `/assets/index-{hash}.js`) retourne le header `Cache-Control: public, max-age=31536000, immutable` (`curl -I https://tournoi.esportdessacres.fr/assets/<un-fichier-hashe>`) **And** `https://tournoi.esportdessacres.fr/index.html` retourne `Cache-Control: no-cache, must-revalidate` (rollback instantane possible sans purge cache) **And** les polices `Bebas Neue` et `Roboto` se chargent (visible dans DevTools → Network filtre Font, et visuellement les titres rendent dans la bonne police charte EDS) **And** les logos partenaires `.webp` (`logo-eds-*.webp`, `logotype-orange-*.webp`, `LOGO-V3-BLANC*.webp`, `logo clavicule*.webp`) se chargent sans 404.

10. **Given** la stack frontend est validee en prod **When** je mets a jour le smoke test pour couvrir le frontend **Then** [docker/smoke-test.sh](docker/smoke-test.sh) (existant) est etendu avec **3 nouveaux checks** dedies frontend (rajoutes apres les 5 backend existants) : (a) `curl -fsS https://tournoi.esportdessacres.fr/ | grep -q '<div id="root">'` — homepage SPA HTML servi, (b) `curl -fsS -o /dev/null -w "%{http_code}" https://tournoi.esportdessacres.fr/qualifications` retourne `200` — fallback SPA OK, (c) `curl -fsS -o /dev/null -w "%{http_code}" http://tournoi.esportdessacres.fr/` retourne `301` ou `308` — redirect HTTP→HTTPS frontend OK **And** le script accepte un 2eme argument optionnel `FRONTEND_URL` (default `https://tournoi.esportdessacres.fr`) **And** une execution `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` retourne **8/8 checks OK** (5 backend + 3 frontend).

11. **Given** la stack 4-services est en prod **When** je documente le workflow operationnel **Then** [README.md](README.md) racine est mis a jour : (a) section `## Deploy` enrichie — la sequence numerotee inclut une nouvelle etape `13. Deployer le frontend` (avec la commande `cd docker && docker compose build frontend && docker compose up -d frontend`) ; (b) tableau env vars `docker/.env` inchange ; (c) un nouveau tableau ou une note explique `VITE_API_URL` (build-time, injecte via `args:` Docker — pas dans `.env`) ; (d) section `## Runbook` enrichie — ajouter le sous-chapitre **Redeploiement frontend apres push code** (`git pull && docker compose build frontend && docker compose up -d frontend`, downtime <3 s) et **Inspection logs frontend** (`docker compose logs -f frontend`) **And** la section "Versions installees" du Runbook est completee : ajout de **nginx 1.27-alpine** (ou `nginx:alpine` selon decision retenue Task 1) **And** la commande `bash docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` est documentee dans la section Smoke Test.

## Tasks / Subtasks

- [x] **Task 1 — `frontend/Dockerfile` multi-stage (AC: #1)**
  - [x] Creer `frontend/Dockerfile` (racine du package frontend, meme niveau que `package.json`)
  - [x] Stage 1 `FROM node:22-alpine AS builder` : `WORKDIR /app`, `COPY package.json package-lock.json ./`, `RUN npm ci`, `COPY . .`, `ARG VITE_API_URL`, `ENV VITE_API_URL=${VITE_API_URL}`, `RUN npm run build`
  - [x] Stage 2 `FROM nginx:1.27-alpine` (pin version explicite ; `nginx:alpine` floating accepte si documente Task 11 README) : `COPY --from=builder /app/dist /usr/share/nginx/html`, `COPY nginx.conf /etc/nginx/conf.d/default.conf`, `EXPOSE 80`, **pas de CMD custom** (l'image nginx officielle a deja le bon ENTRYPOINT/CMD)
  - [x] Creer `frontend/.dockerignore` : `node_modules`, `dist`, `*.log`, `.env*`, `README.md` (eviter d'envoyer 500 Mo de `node_modules` au build context)
  - [ ] **(BRICE)** Test local : `cd frontend && docker build --build-arg VITE_API_URL=https://api-tournoi.esportdessacres.fr -t tournoi-tft-frontend-test .` → build OK, image taggee
  - [ ] **(BRICE)** Verifier que le bundle prod ne contient pas `localhost:3001` : `docker run --rm tournoi-tft-frontend-test sh -c 'grep -r "localhost:3001" /usr/share/nginx/html || echo OK_NOT_FOUND'` → `OK_NOT_FOUND`

- [x] **Task 2 — Config nginx SPA + cache (AC: #2)**
  - [x] Creer `frontend/nginx.conf` avec server bloc `listen 80; server_name _; root /usr/share/nginx/html; index index.html;`
  - [x] Bloc `location / { try_files $uri $uri/ /index.html; }` — fallback SPA pour toutes les routes React Router
  - [x] Bloc `location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }` — cache long sur assets hashes Vite
  - [x] Bloc `location = /index.html { add_header Cache-Control "no-cache, must-revalidate"; expires 0; }` — HTML jamais cache
  - [x] `gzip on; gzip_min_length 1024; gzip_types text/css application/javascript application/json image/svg+xml font/ttf font/woff font/woff2;`
  - [x] `access_log off;` (Traefik logue, eviter doublon)
  - [ ] **(BRICE)** Test local : `docker run --rm -p 8080:80 tournoi-tft-frontend-test`, puis `curl -I http://localhost:8080/` (200), `curl -I http://localhost:8080/qualifications` (200), `curl -I http://localhost:8080/assets/<hash>.js` (verifier Cache-Control immutable)

- [x] **Task 3 — Service `frontend` dans docker-compose.yml (AC: #3)**
  - [x] Editer [docker/docker-compose.yml](docker/docker-compose.yml) **uniquement pour ajouter le service `frontend`** — services `traefik`, `postgres`, `backend` non modifies
  - [x] Service `frontend` : `build.context ../frontend`, `args.VITE_API_URL https://api-tournoi.esportdessacres.fr`, `container_name tournoi-tft-frontend`, `restart unless-stopped`, healthcheck `wget -qO- --spider http://127.0.0.1/`, networks `[tournoi-net]`, **pas de `ports:`**
  - [x] Labels Traefik : `traefik.enable=true`, `traefik.docker.network=tournoi-net`, router `tournoi-tft-web` Host `tournoi.esportdessacres.fr` entrypoint websecure tls letsencrypt, service `tournoi-tft-web` loadbalancer port 80
  - [x] Validation : `cd docker && docker compose config --quiet` → exit 0 (warnings sur env vars locales = attendu, validation syntaxe YAML OK)

- [ ] **Task 4 — Validation locale Docker Desktop avant push VPS (AC: #4) — A EXECUTER PAR BRICE**
  - [ ] Ajouter temporairement `127.0.0.1 tournoi.esportdessacres.fr` dans `C:\Windows\System32\drivers\etc\hosts` (notepad **as admin**)
  - [ ] Optionnel mais recommande : basculer `LETSENCRYPT_CA_SERVER` en staging dans `docker/.env` local pour ne pas bruler de quota prod en test
  - [ ] `cd docker && docker compose build frontend` → build reussit (~30-60 s premier coup, layers caches ensuite)
  - [ ] `docker compose up -d` → 4 services demarrent (`docker compose ps` : `traefik`, `postgres`, `backend`, `frontend` tous `Up (healthy)` apres ~30 s pour frontend)
  - [ ] `curl -kI https://tournoi.esportdessacres.fr/` → 200 (`-k` car cert staging local)
  - [ ] `curl -k https://tournoi.esportdessacres.fr/qualifications | grep '<div id="root">'` → match (preuve SPA fallback)
  - [ ] `docker compose down` apres validation, retirer la ligne `hosts` ajoutee, rebasculer `LETSENCRYPT_CA_SERVER` en prod si touche

- [ ] **Task 5 — Verification DNS frontend (AC: #5) — A EXECUTER PAR BRICE**
  - [ ] `dig +short tournoi.esportdessacres.fr` depuis machine dev → `76.13.58.249`
  - [ ] `nslookup tournoi.esportdessacres.fr 8.8.8.8` → `76.13.58.249`
  - [ ] Si propagation incomplete (TTL pas expire), patienter / forcer un refresh ; **NE PAS** deployer tant que la propagation n'est pas confirmee

- [ ] **Task 6 — Push code + deploy VPS (AC: #6) — A EXECUTER PAR BRICE**
  - [ ] Commit + push `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`, `docker/docker-compose.yml`, `docker/smoke-test.sh`, `README.md`, `.gitattributes`
  - [ ] `ssh deploy@76.13.58.249 "cd /opt/tournoi-tft && git pull"`
  - [ ] `ssh deploy@76.13.58.249 "cd /opt/tournoi-tft/docker && docker compose build frontend"` → build multi-stage termine
  - [ ] `ssh deploy@76.13.58.249 "cd /opt/tournoi-tft/docker && docker compose up -d frontend"` → service cree
  - [ ] Patienter 1-2 min puis `docker compose ps` → `tournoi-tft-frontend Up X (healthy)`
  - [ ] `docker compose logs traefik | tail -50` → recherche d'erreurs ACME (`Unable to obtain ACME certificate`...) — si vide ou seulement INFO, OK

- [ ] **Task 7 — Tests fonctionnels prod & cert LE (AC: #7) — A EXECUTER PAR BRICE**
  - [ ] `curl -I https://tournoi.esportdessacres.fr/` (sans `--insecure`) → 200
  - [ ] `curl -I http://tournoi.esportdessacres.fr/` → 301 ou 308 + `Location: https://...`
  - [ ] `openssl s_client -connect tournoi.esportdessacres.fr:443 -servername tournoi.esportdessacres.fr </dev/null 2>&1 | openssl x509 -noout -issuer -dates` → issuer `Let's Encrypt` prod (R10/R11/R12/R13/R14...), `notBefore` du jour
  - [ ] Boucle bash : `for r in / /qualifications /finale /mentions-legales /admin /admin/login /overlay; do echo -n "$r → "; curl -fsS -o /dev/null -w "%{http_code}\n" https://tournoi.esportdessacres.fr$r; done` → toutes les lignes en 200
  - [ ] Si une route retourne 404, **stop** : config nginx `try_files` mal copiee → fix + rebuild

- [ ] **Task 8 — Validation integration browser (AC: #8) — A EXECUTER PAR BRICE**
  - [ ] Ouvrir `https://tournoi.esportdessacres.fr/` dans Chrome (DevTools ouverts, onglet Network)
  - [ ] Verifier requetes `https://api-tournoi.esportdessacres.fr/api/*` → 200 (pas d'erreur CORS rouge)
  - [ ] Onglet Network filtre WS → connexion `wss://api-tournoi.esportdessacres.fr/socket.io/...` → 101 Switching Protocols
  - [ ] Console : aucun warning **mixed-content** rouge, aucune erreur CORS rouge
  - [ ] Test inscription depuis page d'accueil : remplir le formulaire, submit → status 201/200 dans DevTools, joueur cree
  - [ ] Test login admin depuis `/admin/login` → redirige vers `/admin`, dashboard charge

- [ ] **Task 9 — Verification performance & cache (AC: #9) — A EXECUTER PAR BRICE**
  - [ ] DevTools Performance → reload `/` → DOMContentLoaded < 2s sur reseau standard
  - [ ] `curl -I https://tournoi.esportdessacres.fr/assets/<un-fichier-hashe>.js` → header `Cache-Control: public, max-age=31536000, immutable`
  - [ ] `curl -I https://tournoi.esportdessacres.fr/index.html` → header `Cache-Control: no-cache, must-revalidate`
  - [ ] Verifier polices Bebas Neue + Roboto rendues correctement (visuel + DevTools Network filtre Font)
  - [ ] Verifier logos partenaires `.webp` se chargent (DevTools Network filtre Img)

- [x] **Task 10 — Etendre `docker/smoke-test.sh` (AC: #10)**
  - [x] Editer [docker/smoke-test.sh](docker/smoke-test.sh) — accepter un 2eme arg optionnel `FRONTEND_URL` (default `https://tournoi.esportdessacres.fr`)
  - [x] Ajouter check 6 : `curl -fsS "$FRONTEND_URL/" | grep -q '<div id="root">'` → "Frontend homepage SPA OK"
  - [x] Ajouter check 7 : `curl -fsS -o /dev/null -w "%{http_code}" "$FRONTEND_URL/qualifications"` → 200, "Frontend SPA fallback /qualifications OK"
  - [x] Ajouter check 8 : `curl -fsS -o /dev/null -w "%{http_code}" "${FRONTEND_URL/https/http}/"` → 301 ou 308, "Frontend HTTP→HTTPS redirect OK"
  - [ ] **(BRICE)** Tester sur VPS : `bash /opt/tournoi-tft/docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` → 8/8 OK
  - [x] LF + executable preserve (verifie : `git ls-files --stage docker/smoke-test.sh` → `100755`, `file docker/smoke-test.sh` → `POSIX shell script` sans CRLF)

- [x] **Task 11 — Documentation README Deploy + Runbook (AC: #11)**
  - [x] Editer [README.md](README.md) section `## Deploy` :
    - [x] Ajouter etape 13 + 14 a la sequence : "Deployer le frontend" + "Smoke test end-to-end complet"
    - [x] Ajouter mini-tableau **Build args frontend** : `VITE_API_URL` injectee via `args:` dans `docker-compose.yml` (build-time uniquement, pas dans `.env`)
    - [x] Phrase introductive Deploy maj : "Le frontend est servi par un container nginx co-localise sur le meme VPS, derriere Traefik (cf. service `frontend` dans `docker/docker-compose.yml`)."
    - [x] Etape 4 DNS Hostinger : ajout enregistrement A `tournoi.esportdessacres.fr` (deja cree en avance Task 5 de 6.1, juste documente ici)
  - [x] Editer section `## Runbook` :
    - [x] Sous-section **Redeploiement frontend apres push code** : sequence + downtime <3s
    - [x] Sous-section **Inspection des logs** : ligne `docker compose logs -f frontend # nginx error (access_log off)`
    - [x] Tableau "Versions installees" : ligne `nginx (frontend runtime) 1.27-alpine` + ligne Traefik mise a jour `v3` (floating, image `traefik:v3`) pour reflet l'etat post-hotfix v1.3 6.1
    - [x] Sous-section **Smoke test post-deploy** : commande mise a jour `bash /opt/tournoi-tft/docker/smoke-test.sh https://api-tournoi.esportdessacres.fr https://tournoi.esportdessacres.fr` (8 checks)

- [x] **Task 12 — Change Log & finalisation story**
  - [x] Entree Change Log v1.0 : creation story 6.2 comprehensive (cf. ci-dessous)
  - [x] Entree Change Log v1.1 : implementation code (Dockerfile + nginx.conf + service compose + smoke-test + README)
  - [x] `## Dev Agent Record` rempli : Agent Model, Completion Notes, Debug Log References, File List (cf. ci-dessous)
  - [ ] **(BRICE)** Status story passe a `review` une fois Tasks 4-9 valides en prod (validation manuelle requise — voir handoff dans Completion Notes)

## Dev Notes

### Stack technique imposee (decision retenue)

- **OS VPS** : Ubuntu 24.04.4 LTS (deja prep en 6.1)
- **Docker** : Engine 29.4.1 + Compose v5.1.3 (deja installe en 6.1)
- **Traefik** : `v3` (tag floating v3.x stable, deja en place — bascule v3.2→v3 hotfix v1.3 de 6.1)
- **nginx** : `nginx:1.27-alpine` (recommande, pin explicite) ou `nginx:alpine` (floating). Image officielle, root non-applicatif (USER nginx au runtime), 18 Mo. Pas de modules dynamiques requis (pas de Brotli, pas de modsecurity — KISS MVP).
- **Node.js (build only, stage 1)** : `node:22-alpine` (deja standardise par 6.1 — meme image stage 1 backend)
- **Frontend** : Vite 8 + React 19 + React Router 7 + Tailwind CSS 4 + framer-motion + socket.io-client (cf. [frontend/package.json](frontend/package.json) — fige depuis Epic 5)

### Defense in Depth pour invariants infra (pattern reconduit Epic 5/6.1)

| Invariant | Garde | Defaut refuse |
|---|---|---|
| `VITE_API_URL` requis au build prod | **AC #1** : `ARG VITE_API_URL` + verif "no localhost:3001 in dist" | Fallback `localhost:3001` interdit en prod |
| Routes SPA accessibles directement par URL | **AC #7** : `try_files $uri $uri/ /index.html` | 404 nginx interdit pour URLs frontend |
| `tournoi.esportdessacres.fr` HTTPS-only | **AC #7** : redirect Traefik HTTP→HTTPS (deja en place 6.1) | Pas d'acces HTTP non chiffre |
| `index.html` jamais cache | **AC #2** : `Cache-Control: no-cache, must-revalidate` sur `/index.html` | Rollback impossible si cache navigateur fige |
| Assets hashes immuables | **AC #2** : `Cache-Control: max-age=31536000, immutable` sur `/assets/` | Bundle perdu = revalidation systematique inutile |
| Frontend container pas expose Internet directement | **AC #3** : pas de `ports:` sur service frontend | Traefik = unique entree publique |
| WebSocket cote frontend en HTTPS | **AC #8** : pas de mixed-content | `ws://` interdit en prod |
| CORS backend strict | (deja en place 6.1) `FRONTEND_URL=https://tournoi.esportdessacres.fr` | Pas de CORS open en prod |

### Pieges typiques

1. **`VITE_API_URL` injecte au build, pas au runtime**. C'est le piege #1 frontend Vite. Si on oublie de passer `--build-arg VITE_API_URL=...` (ou `args:` dans compose), Vite tombe sur le fallback `'http://localhost:3001'` (cf. [frontend/src/services/api.ts:3](frontend/src/services/api.ts)). Le bundle est alors fige avec cette URL — **rebuild obligatoire** pour fixer. Verification AC #1 : `grep -r "localhost:3001" dist/` doit ne rien retourner. **NE PAS** tenter de patcher post-build (sed dans le JS, etc.) — c'est rebuild ou rien.

2. **Rate limit Let's Encrypt prod prod** (rappel 6.1) : 5 duplicate certs / 7 jours sur **chaque** subdomain. Le cert `tournoi.esportdessacres.fr` est neuf (jamais emis), donc on a 5 tentatives. La config Traefik est testee sur le backend depuis le 2026-04-24 — cela donne confiance, mais une mauvaise config DNS frontend / label Traefik / firewall reste possible. **Mitigation systematique** : (a) test local Docker Desktop AC #4 avec `127.0.0.1 tournoi.esportdessacres.fr` dans `hosts`, (b) verif DNS prop AC #5 avant deploy, (c) si echec en prod, bascule **temporaire** `LETSENCRYPT_CA_SERVER` en staging dans `docker/.env` sur VPS, fix, retest staging, rebascule prod (cf. README Runbook 6.1).

3. **`nginx:alpine` n'inclut pas curl par defaut, mais wget oui** — meme constat que pour le backend `node:22-alpine` (cf. retro 6.1 piege 3). Utiliser `wget --spider` dans le healthcheck (AC #3). Si on veut curl, `RUN apk add --no-cache curl` dans stage 2 — mais inutile ici.

4. **Healthcheck container vs Traefik route** (rappel 6.1 piege 4) : `healthcheck` Docker → `docker compose ps healthy`. Traefik route quand le container est `up` (pas necessairement healthy). Pour ajouter un healthcheck cote Traefik, label `traefik.http.services.tournoi-tft-web.loadbalancer.healthcheck.path=/`. **Optionnel** ici (frontend statique, peu de risques d'unhealthy avec serveur OK) — non bloquant AC.

5. **`try_files` order matters** : `try_files $uri $uri/ /index.html;` — d'abord essaie le fichier exact (`/qualifications` n'existe pas en fs), puis le dossier (`/qualifications/`), puis fallback `/index.html`. **NE PAS** mettre `/index.html` en premier (cela ferait toujours servir le HTML, meme pour les assets — casse).

6. **`location /assets/` doit etre AVANT `location /`** dans nginx.conf — premiere match wins (avec specificite, mais en doute, ordre safe). En realite, nginx prefere les `location` plus specifiques avant les generales — mais redondance d'ordre = defense en profondeur lecture.

7. **CRLF dans `nginx.conf` sur Windows** (rappel 6.1 piege 11) : si `nginx.conf` est ecrit en CRLF, nginx Alpine peut booter mais lever des warnings cryptiques sur certaines directives. **Mitigation** : ajouter `nginx.conf text eol=lf` dans `.gitattributes` racine (le pattern `* text=auto` deja en place le couvre normalement, mais explicite est plus sur). Verifier `file frontend/nginx.conf` apres commit doit reporter "ASCII text" pas "with CRLF".

8. **Build context Docker (taille)** — sans `.dockerignore`, le `node_modules/` du frontend (~500 Mo) est envoye au daemon Docker. Le build est 10x plus lent et peut echouer en RAM sur le VPS Hostinger basique. **Toujours** un `.dockerignore` qui exclut `node_modules`, `dist`, `.env*` (Task 1 subtask 4).

9. **Cert prod resolver partage** : le label `traefik.http.routers.tournoi-tft-web.tls.certresolver=letsencrypt` reutilise le resolver deja configure dans 6.1 (qui pointe vers `caServer=https://acme-v02.api.letsencrypt.org/directory`). **Aucun** changement a faire dans `docker/.env` ou `docker-compose.yml` cmd Traefik — uniquement les labels du nouveau service. Le partage est l'objectif (un seul `acme.json`, un seul ACME account, gestion centralisee).

10. **Vite + React Router v7 BrowserRouter** — `<BrowserRouter>` (vs `HashRouter`) signifie URLs propres (`/qualifications`, pas `/#/qualifications`). Cela **necessite** la config nginx `try_files` AC #2 — sans elle, F5 sur `/qualifications` retourne 404 nginx. C'est la principale raison de cette story.

11. **Build `tsc -b && vite build` strict** : `npm run build` execute d'abord `tsc --build` (typecheck strict, `noEmit`), puis `vite build`. Toute erreur TS bloque le build et l'image Docker rate. C'est le comportement souhaite — fail-fast vaut mieux qu'un bundle incoherent. Si erreur TS surgit en build (ex: dependance non typee dans node_modules), **fixer le code** plutot que skipper TS.

12. **Tailwind v4 + `@tailwindcss/vite`** — la config Tailwind v4 est inline dans `vite.config.ts` via le plugin `tailwindcss()`. Pas de `tailwind.config.ts` separe (pattern Tailwind v4). Aucune action speciale requise au build container — la stack est self-contained.

### Reuses Epic 1-5 + Story 6.1 (pas de reinvention)

| Asset existant | Reutilisation Epic 6.2 |
|---|---|
| [frontend/](frontend/) (build 148 kB gz Epic 5) | Servi tel quel par nginx — aucune modif code frontend |
| [frontend/src/services/api.ts](frontend/src/services/api.ts) | `VITE_API_URL` deja branche, juste injecter au build (Task 1) |
| [frontend/src/services/socket.ts](frontend/src/services/socket.ts) | `VITE_API_URL` partage avec REST, idem |
| [docker/docker-compose.yml](docker/docker-compose.yml) (3 services 6.1) | **Etendre** avec service `frontend` (Task 3), **NE PAS** toucher aux 3 services existants |
| Resolver Traefik `letsencrypt` (6.1) | Partage avec frontend — labels uniquement |
| Reseau `tournoi-net` (6.1) | Partage |
| Volume `traefik-acme` (6.1) | Partage (un seul `acme.json` pour les 2 certs) |
| Backend CORS strict `FRONTEND_URL=https://tournoi.esportdessacres.fr` (6.1) | Aucun changement backend — origine deja autorisee |
| `docker/smoke-test.sh` (6.1) | **Etendre** avec 3 checks frontend (Task 10) |
| `.gitattributes` LF rules (6.1) | Couvre `nginx.conf` via `* text=auto` ; explicit `nginx.conf text eol=lf` recommande |
| `README.md` sections `## Deploy` + `## Runbook` (6.1) | **Enrichir** (Task 11), pas recreer |

### Validation locale Docker Desktop avant deploy VPS (recommandation forte)

Pattern reproduit de 6.1 — debusque ~90% des erreurs avant de bruler du quota LE prod ou du temps SSH.

```bash
# 1. Edit C:\Windows\System32\drivers\etc\hosts (notepad as admin) :
#    127.0.0.1 tournoi.esportdessacres.fr
#    127.0.0.1 api-tournoi.esportdessacres.fr  (deja recommande 6.1)

# 2. Optionnel : basculer LE staging dans docker/.env local
#    LETSENCRYPT_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory
#    docker volume rm <project>_traefik-acme  (forcer reemission avec le resolver staging)

# 3. Build + up stack complete
cd docker
docker compose build frontend
docker compose up -d
docker compose ps   # 4 services Up (healthy)

# 4. Tests fonctionnels (TLS staging => -k)
curl -kI https://tournoi.esportdessacres.fr/                    # 200
curl -k https://tournoi.esportdessacres.fr/qualifications | grep '<div id="root">'   # match
curl -kI https://tournoi.esportdessacres.fr/assets/<hash>.js    # Cache-Control immutable

# 5. Cleanup
docker compose down
# Retirer la ligne hosts ajoutee
# Si on a touche a docker/.env : remettre LE prod avant deploy VPS
```

### Project Structure Notes

- **Conserver** [docker/docker-compose.yml](docker/docker-compose.yml) comme **fichier prod unique** (decision 6.1 reconduite — un seul docker-compose pour le projet, pas de split dev/prod).
- **Ajouter** `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore` (3 nouveaux fichiers, racine du package frontend, meme niveau que `package.json`).
- **NE PAS** creer de `frontend/.env.production` commite — `VITE_API_URL` passe via `args:` dans `docker-compose.yml` (decision retenue cf. Contexte). Si Brice veut un fallback pour `npm run dev` local distinct, il peut creer `frontend/.env` (deja gitignore via pattern racine `.env`).
- **NE PAS** modifier `frontend/src/*` ou `frontend/package.json` — le code applicatif est fige depuis Epic 5 (148 kB gz, retro Epic 5).
- **Variance vs architecture.md** : architecture.md ligne 437-498 et 583-588 mentionne `frontend/` build deploye sur Hostinger via FTP. **Decision retro Epic 5 (2026-04-24)** : VPS only, container nginx. La structure de `frontend/` reste inchangee, seul le mode de deploiement diverge. **Pas de modification de l'architecture.md requise pour cette story** — la divergence est tracee par cette story 6.2 + le contexte 6.1.

### Regles d'execution

- **Un seul `docker-compose.yml`** (decision 6.1 reconduite).
- **Aucune modification des services 6.1** (`traefik`, `postgres`, `backend`) — perimetre strict cette story.
- **Aucune modification du code frontend `src/*`** — fige depuis Epic 5.
- **Pas de CI/CD** — deploiement manuel (retro Epic 5 confirmee).
- **Change Log granulaire** : chaque hotfix post-review = entree v1.x dans ce fichier.
- **Tests browser obligatoires (AC #8)** — pas de "ca marche en `curl` donc OK". Brice doit ouvrir DevTools et verifier mixed-content, CORS, WebSocket.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-62](_bmad-output/planning-artifacts/epics.md) — definition Story 6.2 (container nginx derriere Traefik, pas Hostinger FTP)
- [Source: _bmad-output/planning-artifacts/architecture.md#deployment-structure](_bmad-output/planning-artifacts/architecture.md) — sec 583+ : version FTP **obsolete**, voir retro Epic 5
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-04-24.md#decouverte-significative-—-impact-epic-6](_bmad-output/implementation-artifacts/epic-5-retro-2026-04-24.md) — decision "tout sur le meme VPS, container nginx frontend"
- [Source: _bmad-output/implementation-artifacts/6-1-deploiement-backend-docker-traefik.md](_bmad-output/implementation-artifacts/6-1-deploiement-backend-docker-traefik.md) — story precedente (15 ACs, stack 3-services Traefik+PG+backend, hotfixes v1.2/v1.3/v1.4, review APPROVED 2026-04-24, action item #2 verifie : `FRONTEND_URL` sans trailing slash)
- [Source: docker/docker-compose.yml](docker/docker-compose.yml) — stack 3-services 6.1 a etendre (ne pas recreer)
- [Source: frontend/src/services/api.ts:3](frontend/src/services/api.ts) — `VITE_API_URL` injection point REST
- [Source: frontend/src/services/socket.ts:4](frontend/src/services/socket.ts) — `VITE_API_URL` injection point WebSocket
- [Source: frontend/src/App.tsx](frontend/src/App.tsx) — routes React Router a couvrir par fallback SPA (`/`, `/qualifications`, `/finale`, `/mentions-legales`, `/overlay`, `/admin/login`, `/admin`)
- [Source: frontend/vite.config.ts](frontend/vite.config.ts) — config build (Tailwind v4 inline, React plugin)
- [Source: frontend/package.json](frontend/package.json) — `npm run build = tsc -b && vite build`, deps fige Epic 5
- [Source: README.md#deploy](README.md) — sequence deploiement actuelle 6.1 (a enrichir)
- [Source: README.md#runbook](README.md) — runbook actuel 6.1 (a enrichir)
- nginx SPA routing : [nginx.org/en/docs/http/ngx_http_core_module.html#try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files)
- Vite env vars build-time : [vite.dev/guide/env-and-mode](https://vite.dev/guide/env-and-mode)
- Traefik v3 routers + TLS resolver : [doc.traefik.io/traefik/v3.2/routing/routers/](https://doc.traefik.io/traefik/v3.2/routing/routers/)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — dev-story workflow BMad v6.3.0, 2026-04-25.

### Debug Log References

- `docker compose config --quiet` validation Task 3 : exit 0 apres avoir touche `backend/.env.prod` temporairement (le fichier est gitignored / cree uniquement sur le VPS, son absence en local est normale et ne bloque pas la validation reelle de mon delta YAML). Warnings sur `LETSENCRYPT_*` et `POSTGRES_*` attendus (vars dans `docker/.env` aussi gitignored).
- `bash -n docker/smoke-test.sh` Task 10 : exit 0 (syntaxe POSIX OK).
- `file docker/smoke-test.sh frontend/nginx.conf frontend/Dockerfile frontend/.dockerignore` Tasks 1-2-10 : tous les fichiers en LF (pas de "CRLF" dans le rapport `file`). `.gitattributes` mis a jour pour explicitement forcer LF sur `frontend/nginx.conf`, `frontend/Dockerfile`, `frontend/.dockerignore` (defense en profondeur vs piege CRLF Alpine documente Dev Notes piege #7).
- `git ls-files --stage docker/smoke-test.sh` : mode `100755` preserve (executable bit OK pour shebang Alpine).

### Completion Notes List

**Code livre (Tasks 1, 2, 3, 10, 11 + .gitattributes)** :

1. **`frontend/Dockerfile`** (nouveau) — multi-stage `node:22-alpine` (build) + `nginx:1.27-alpine` (runtime). `ARG VITE_API_URL` + `ENV VITE_API_URL=${VITE_API_URL}` injecte la valeur **avant** `npm run build` pour figer l'URL backend dans le bundle JS. Stage 2 copie `dist/` dans `/usr/share/nginx/html` et la config nginx custom dans `/etc/nginx/conf.d/default.conf`. Pas de `CMD` custom (l'image officielle nginx a deja le bon entrypoint).
2. **`frontend/.dockerignore`** (nouveau) — exclut `node_modules`, `dist`, `.env*`, `.git`, IDE files, OS junk. Indispensable : sans lui, le build context envoie ~500 Mo au daemon Docker (build 10x plus lent, peut OOM sur VPS).
3. **`frontend/nginx.conf`** (nouveau) — server bloc minimal `listen 80 / server_name _ / root /usr/share/nginx/html`. **3 location blocks ordonnes du plus specifique au plus generique** : (a) `location = /index.html` → `Cache-Control: no-cache, must-revalidate` pour rollback instantane sans purge cache, (b) `location /assets/` → `Cache-Control: public, max-age=31536000, immutable` + `try_files $uri =404` (404 strict, pas de fallback HTML pour eviter cache poisoning sur un mauvais hash JS), (c) `location /` → `try_files $uri $uri/ /index.html` fallback SPA pour toutes les routes React Router. `gzip on` avec `gzip_min_length 1024` + types text/CSS/JS/JSON/SVG/fonts. `access_log off` (Traefik logue deja, doublon evite).
4. **`docker/docker-compose.yml`** (modifie) — ajout du service `frontend` **a la suite** des 3 services existants (`traefik`, `postgres`, `backend` non touches, perimetre strict respecte). Build args `VITE_API_URL: https://api-tournoi.esportdessacres.fr` figee. Healthcheck `wget -qO- --spider http://127.0.0.1/` (wget natif Alpine, pas curl). Pas de `ports:` (Traefik = unique entree publique). 7 labels Traefik : enable, docker.network, router `tournoi-tft-web` Host `tournoi.esportdessacres.fr` entrypoint `websecure` tls letsencrypt, service `tournoi-tft-web` loadbalancer port 80. Resolver `letsencrypt` partage avec backend (un seul `acme.json`).
5. **`docker/smoke-test.sh`** (modifie) — ajout d'un 2eme arg optionnel `FRONTEND_URL` (default `https://tournoi.esportdessacres.fr`). 3 nouveaux checks (6, 7, 8) apres les 5 backend existants : (6) homepage HTML servi `<div id="root">`, (7) route SPA `/qualifications` retourne 200 (preuve fallback `try_files`), (8) redirect HTTP→HTTPS frontend retourne 301/308. Bit executable git preserve (`100755`). Compteur final passe a "8 checks" attendus en prod.
6. **`README.md`** (modifie) — section `## Deploy` : phrase intro maj (frontend = container nginx co-localise, plus FTP), DNS step 4 enrichi (mention enregistrement A `tournoi.esportdessacres.fr`), nouveau mini-tableau **Build args frontend** documentant `VITE_API_URL` build-time, sequence enrichie de 12 a 14 etapes (12 = smoke backend partiel, 13 = deploy frontend, 14 = smoke complet 8 checks). Section `## Runbook` : nouvelle sous-section **Redeploiement frontend apres push code** (sequence + downtime <3 s), ligne `docker compose logs -f frontend` ajoutee a Inspection des logs, tableau Versions enrichi (nginx 1.27-alpine + Traefik v3 floating maj post-hotfix 6.1 v1.3), smoke test commande maj avec 2eme arg.
7. **`.gitattributes`** (modifie) — ajout explicit `frontend/nginx.conf text eol=lf`, `frontend/Dockerfile text eol=lf`, `frontend/.dockerignore text eol=lf`. Defense en profondeur vs piege #7 Dev Notes (CRLF sur Windows casse subtilement nginx Alpine).

**Validations effectuees en environnement local (Claude)** :

- `docker compose config --quiet` → exit 0 (YAML valide). Cf. note Debug Log References.
- `bash -n docker/smoke-test.sh` → exit 0 (syntaxe POSIX OK).
- `file` sur les nouveaux fichiers → tous LF, pas de CRLF.
- `git ls-files --stage docker/smoke-test.sh` → `100755` (bit executable conserve).

**Validations runtime DEPENDANT de l'environnement Brice (NON effectuees, hand-off explicite) — Tasks 4-9** :

Les ACs runtime (build Docker reel, deploy VPS, cert LE prod emis, integration browser, perf DOMContentLoaded) **ne peuvent etre validees que par Brice** (Docker Desktop Windows local + acces SSH VPS + navigateur DevTools). Voici le plan :

| Task | Ce que Brice doit faire | AC couvert |
|---|---|---|
| Task 4 | Test stack 4-services en local Docker Desktop avec `127.0.0.1 tournoi.esportdessacres.fr` dans `hosts` (recommande : LE staging dans `docker/.env` pour eviter de bruler quota prod) | AC #1 partiel (build OK), AC #2, AC #4 |
| Task 5 | `dig +short tournoi.esportdessacres.fr` + `nslookup tournoi.esportdessacres.fr 8.8.8.8` → `76.13.58.249` | AC #5 |
| Task 6 | `git push` + `ssh deploy@76.13.58.249` + `git pull` + `docker compose build frontend` + `docker compose up -d frontend` | AC #6 |
| Task 7 | `curl` + `openssl s_client` pour verifier cert LE prod issuer + boucle bash sur les 7 routes SPA | AC #7 |
| Task 8 | Chrome DevTools : Network REST + WS + console (mixed-content + CORS) + tests inscription / login admin | AC #8 |
| Task 9 | DevTools Performance + `curl -I` headers Cache-Control + visual check polices + logos webp | AC #9 |

**Apres validation Brice** : si tout OK, Brice coche les Tasks 4-9 dans cette story file, passe Status `in-progress` → `review` ici et `6-2-deploiement-frontend-hostinger: review` dans `_bmad-output/implementation-artifacts/sprint-status.yaml`, puis lance le workflow `code-review` (recommande LLM different cf. retro 6.1).

**Precaution Let's Encrypt prod (rate limit 5/7j)** : la config Traefik est validee depuis 6.1 sur `api-tournoi.esportdessacres.fr` (cert R13 emis le 2026-04-24). Le risque sur `tournoi.esportdessacres.fr` est plus faible mais existe. Si Brice fait une seule erreur de config (DNS pas propage, label mal copie, port 80 ferme, etc.), il brule 1 tentative sur 5 et doit attendre 7j. **Mitigation** : Task 4 (test local Docker Desktop AVANT le push VPS Task 6) — meme protocole que 6.1.

### File List

**Nouveaux** :
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/nginx.conf`

**Modifies** :
- `docker/docker-compose.yml` (ajout service `frontend` apres `backend`, +30 lignes ; services existants intacts)
- `docker/smoke-test.sh` (param `FRONTEND_URL` + 3 checks frontend ajoutes apres les 5 backend ; mode `100755` preserve)
- `README.md` (section Deploy : phrase intro + DNS step 4 + tableau build args frontend + etapes 13/14 ; section Runbook : Redeploiement frontend + Inspection logs frontend + tableau Versions + commande smoke test maj)
- `.gitattributes` (3 lignes explicit LF pour `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut `6-2-deploiement-frontend-hostinger` : `ready-for-dev` → `in-progress` ; sera `in-progress` → `review` apres validation Brice Tasks 4-9)
- `_bmad-output/implementation-artifacts/6-2-deploiement-frontend-hostinger.md` (Status, checkboxes, Dev Agent Record, Change Log)

## Change Log

| Version | Date | Auteur | Description |
|---------|------|--------|-------------|
| v1.0 | 2026-04-25 | Bob (Scrum Master / story context engine) | Creation story 6.2 comprehensive — 11 ACs, 12 tasks, dev notes complets avec Defense in Depth + reuses 6.1 + pieges Vite/nginx/Docker. Story batie sur les decisions retro Epic 5 (VPS-only, container nginx) et le contexte 6.1 (resolver LE deja prod, DNS frontend deja pre-cree, CORS backend deja strict). |
| v1.1 | 2026-04-25 | Amelia (dev-story / Claude Opus 4.7) | Implementation code-only (Tasks 1, 2, 3, 10, 11 + .gitattributes). Cree `frontend/Dockerfile` multi-stage Node 22 + nginx 1.27 Alpine, `frontend/.dockerignore`, `frontend/nginx.conf` SPA-friendly avec 3 location blocks (index.html no-cache / assets immutable / fallback try_files). Etend `docker/docker-compose.yml` avec service `frontend` (build args `VITE_API_URL` figee, healthcheck wget, 7 labels Traefik router `tournoi-tft-web` Host `tournoi.esportdessacres.fr` resolver `letsencrypt` partage). Etend `docker/smoke-test.sh` avec 2eme arg `FRONTEND_URL` et 3 nouveaux checks (homepage SPA, fallback `/qualifications`, redirect HTTP→HTTPS). Maj `README.md` Deploy + Runbook + Versions. Maj `.gitattributes` LF explicit pour les 3 nouveaux fichiers frontend. Validations locales : `docker compose config --quiet` exit 0, `bash -n smoke-test.sh` exit 0, line endings LF confirmes. **Hand-off Brice pour Tasks 4-9** (build local Docker Desktop, DNS, push VPS, cert LE prod, browser integration, perf) — story reste `in-progress` jusqu'a validation runtime par Brice. |
