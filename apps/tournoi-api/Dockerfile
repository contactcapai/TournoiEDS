# Build monorepo a contexte RACINE (cf. docker/docker-compose.yml -> context: ..).
# Adapte a pnpm + workspace : on copie le lockfile + manifests racine, on installe,
# puis on build le seul backend via `pnpm --filter tournoi-api`.

# Stage 1: Build
FROM node:22-alpine AS builder
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

# Manifests d'abord (cache des couches d'install tant que les deps ne bougent pas)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/tournoi-web/package.json apps/tournoi-web/
COPY apps/tournoi-api/package.json apps/tournoi-api/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# Sources puis build (script "build" = prisma generate && tsc)
COPY packages/ packages/
COPY apps/tournoi-api/ apps/tournoi-api/
RUN pnpm --filter tournoi-api build

# Stage 2: Production
FROM node:22-alpine
RUN npm install -g pnpm@9.15.9
WORKDIR /repo
ENV NODE_ENV=production

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/tournoi-web/package.json apps/tournoi-web/
COPY apps/tournoi-api/package.json apps/tournoi-api/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --prod

# Schema + config Prisma : requis pour `prisma generate` (ci-dessous) et
# `prisma migrate deploy` (docker-entrypoint.sh au demarrage du conteneur).
COPY apps/tournoi-api/prisma apps/tournoi-api/prisma
COPY apps/tournoi-api/prisma.config.ts apps/tournoi-api/
RUN pnpm --filter tournoi-api exec prisma generate

# Artefact compile depuis le builder
COPY --from=builder /repo/apps/tournoi-api/dist apps/tournoi-api/dist

# Entrypoint : migrations Prisma puis demarrage serveur
COPY apps/tournoi-api/docker-entrypoint.sh apps/tournoi-api/docker-entrypoint.sh
RUN chmod +x apps/tournoi-api/docker-entrypoint.sh

EXPOSE 3001
WORKDIR /repo/apps/tournoi-api
ENTRYPOINT ["/repo/apps/tournoi-api/docker-entrypoint.sh"]
