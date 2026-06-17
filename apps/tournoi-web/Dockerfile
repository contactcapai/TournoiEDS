# Build monorepo a contexte RACINE (cf. docker/docker-compose.yml -> context: ..).
# Vite injecte les variables VITE_* au build (pas au runtime) : VITE_API_URL DOIT etre
# passe via --build-arg pour que le bundle prod pointe sur api-tournoi.esportdessacres.fr
# (sinon fallback localhost:3001). Stage runtime = nginx statique servant dist/.

# Stage 1: Build (pnpm + tsc strict + Vite)
FROM node:22-alpine AS builder
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

# Manifests d'abord (cache des couches d'install)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/tournoi-web/package.json apps/tournoi-web/
COPY apps/tournoi-api/package.json apps/tournoi-api/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# packages/ requis : tsconfig.app.json etend @repo/typescript-config
COPY packages/ packages/
COPY apps/tournoi-web/ apps/tournoi-web/

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter tournoi-web build

# Stage 2: Runtime (nginx statique)
# Traefik termine le TLS en amont, le conteneur ecoute en HTTP:80.
FROM nginx:1.27-alpine

COPY --from=builder /repo/apps/tournoi-web/dist /usr/share/nginx/html
COPY apps/tournoi-web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
