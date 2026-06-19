# apps/vitrine/Dockerfile
# Build monorepo a contexte RACINE (cf. docker/docker-compose.yml -> context: ..).
# Runtime = serveur Next standalone (node apps/vitrine/server.js).
# NEXT_PUBLIC_SITE_URL est FIGE AU BUILD via --build-arg (inlineé dans le bundle).
# DATABASE_URL arrive UNIQUEMENT au runtime via env_file (server-only, jamais dans l'image).

# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 : Builder
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

# Manifests d'abord (cache des couches d'install tant que les deps ne bougent pas).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/vitrine/package.json               apps/vitrine/
COPY apps/tournoi-web/package.json           apps/tournoi-web/
COPY apps/tournoi-api/package.json           apps/tournoi-api/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json     packages/eslint-config/
COPY packages/ui/package.json                packages/ui/

RUN pnpm install --frozen-lockfile

# Sources
COPY packages/   packages/
COPY apps/vitrine/ apps/vitrine/

# NEXT_PUBLIC_SITE_URL : inlinée dans le bundle JS au build (comme VITE_API_URL
# pour tournoi-web). Valeur prod = https://esportdessacres.fr.
# Ne JAMAIS passer DATABASE_URL ici (server-only, contiendrait des identifiants).
ARG NEXT_PUBLIC_SITE_URL=https://esportdessacres.fr
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN pnpm --filter vitrine build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 : Runtime (Next standalone)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
# PORT et HOSTNAME requis : sinon le serveur standalone n'ecoute que sur 127.0.0.1
# (inaccessible depuis Traefik). Traefik termine le TLS en amont, le conteneur
# ecoute en HTTP:3000.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root (recommandation securite Next.js)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

WORKDIR /repo

# Avec outputFileTracingRoot = racine du monorepo, le standalone reproduit
# l'arborescence du repo : server.js est sous apps/vitrine/ (pas a la racine).
# Copier trois elements (standalone ne contient pas static/ ni public/).
COPY --from=builder --chown=nextjs:nodejs /repo/apps/vitrine/.next/standalone       ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/vitrine/.next/static           ./apps/vitrine/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/vitrine/public                 ./apps/vitrine/public

# Migrations Drizzle : schema.ts est VIDE (aucune table jusqu'a Story 3.1).
# Decision A : pas de migrate prod ici, cablage programme differe a Story 3.1
# (premiere vraie table). Ne pas appeler drizzle-kit : c'est une devDependency
# absente de l'image standalone. Voir Story 3.1 pour le migrate programmatique.

USER nextjs
EXPOSE 3000
CMD ["node", "apps/vitrine/server.js"]
