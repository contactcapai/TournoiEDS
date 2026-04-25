# Blind Hunter Review Prompt (Story 6.1 : Déploiement Backend Docker & Traefik)

You are a Blind Hunter. Review the following code changes without any external context. Look for:
- Logical errors in Docker Compose networking and volumes
- Security vulnerabilities in Traefik configuration (exposed sockets, open ports)
- Issues in shell script robustness (missing set -e, insecure handling of variables)
- Gaps in backend security patches (CORS logic, environment variable assertions)
- Typographical errors or duplicated blocks in configuration files

## Code Changes

### docker/docker-compose.yml
```yaml
# docker-compose.yml — Stack PROD complete (Tournoi TFT EDS)
services:
  traefik:
    image: traefik:v3
    container_name: tournoi-tft-traefik
    restart: unless-stopped
    command:
      - --providers.docker=true
      - --providers.docker.exposedByDefault=false
      - --providers.docker.network=tournoi-net
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.web.http.redirections.entrypoint.scheme=https
      - --entrypoints.web.http.redirections.entrypoint.permanent=true
      - --certificatesresolvers.letsencrypt.acme.email=${LETSENCRYPT_EMAIL}
      - --certificatesresolvers.letsencrypt.acme.storage=/acme/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
      - --certificatesresolvers.letsencrypt.acme.caServer=${LETSENCRYPT_CA_SERVER}
      - --log.level=INFO
      - --accesslog=false
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-acme:/acme
    networks:
      - tournoi-net

  postgres:
    image: postgres:17-alpine
    container_name: tournoi-tft-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - tournoi-pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - tournoi-net

  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: tournoi-tft-backend
    restart: unless-stopped
    env_file:
      - ../backend/.env.prod
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- --spider http://127.0.0.1:3001/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=tournoi-net"
      - "traefik.http.routers.tournoi-tft-api.rule=Host(`api-tournoi.esportdessacres.fr`)"
      - "traefik.http.routers.tournoi-tft-api.entrypoints=websecure"
      - "traefik.http.routers.tournoi-tft-api.tls=true"
      - "traefik.http.routers.tournoi-tft-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.tournoi-tft-api.loadbalancer.server.port=3001"
    networks:
      - tournoi-net

networks:
  tournoi-net:
    name: tournoi-net
    driver: bridge

volumes:
  tournoi-pg-data:
  traefik-acme:
```

### backend/Dockerfile
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev && npx prisma generate
COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

### backend/docker-entrypoint.sh
```sh
#!/bin/sh
set -e
echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy
echo "[entrypoint] Starting server..."
exec node dist/index.js
```

### backend/src/app.ts
```typescript
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: frontendUrl }));
```

### backend/src/index.ts
```typescript
if (NODE_ENV === 'production') {
  const required = ['FRONTEND_URL', 'JWT_SECRET', 'DATABASE_URL'] as const;
  for (const name of required) {
    const value = process.env[name];
    if (!value) {
      console.error(`FATAL: ${name} environment variable is required in production`);
      process.exit(1);
    }
    if (DEV_DEFAULTS[name] && value === DEV_DEFAULTS[name]) {
      console.error(`FATAL: ${name} is set to the dev default in production (must be rotated)`);
      process.exit(1);
    }
  }
}
```

### docker/backup-pg.sh
```sh
#!/bin/sh
set -eu
COMPOSE_FILE="${COMPOSE_FILE:-/opt/tournoi-tft/docker/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
. "$ENV_FILE"
: "${POSTGRES_USER:?POSTGRES_USER manquant dans $ENV_FILE}"
: "${POSTGRES_DB:?POSTGRES_DB manquant dans $ENV_FILE}"
mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/tournoi-$TS.sql.gz"
echo "Backup en cours -> $OUT"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > "$OUT"
if [ ! -s "$OUT" ]; then
  echo "FATAL: backup vide, suppression de $OUT" >&2
  rm -f "$OUT"
  exit 1
fi
```

### docker/smoke-test.sh
```sh
#!/bin/sh
set -u
BASE_URL="${1:-https://api-tournoi.esportdessacres.fr}"
# ... (tests curl sur health, redirect, socket.io, cert, rankings)
```
