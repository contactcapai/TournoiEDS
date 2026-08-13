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

# ──────────────────────────────────────────────────────────────────────────────
# Migrations Drizzle — jouees AU DEMARRAGE, par le serveur lui-meme (Story 7.4)
# ──────────────────────────────────────────────────────────────────────────────
# ⚠️ CE BLOC ANNONCAIT « schema.ts est VIDE (aucune table jusqu'a Story 3.1) — cablage
# programme differe a Story 3.1 ». Il est reste faux quatre epics : la 3.1 a cree les
# tables mais n'a JAMAIS cable le migrate, et le commentaire a survecu devant 11 tables
# et 14 migrations. Personne ne l'a vu parce que la vitrine n'avait jamais tourne hors du
# poste de dev, ou `pnpm --filter vitrine db:migrate` fait le travail a la main.
#
# Le cablage vit desormais dans `src/instrumentation.ts` -> `src/server/db/migrate.ts`,
# appele une fois au demarrage du serveur. RIEN A AJOUTER ICI, et c'est le fruit d'une
# mesure : `drizzle-orm` et `postgres` ne sont PAS dans le node_modules du standalone
# (Next les bundle dans les chunks serveur), donc un script de demarrage autonome n'aurait
# pas pu les importer. Les fichiers .sql, eux, entrent par `outputFileTracingIncludes`
# (next.config.ts).
# 🔴 Toujours vrai, et c'est la contrainte qui a dicte tout le reste : ne PAS appeler
# drizzle-kit — c'est une devDependency, absente de cette image.
# 🔴 Echec de migration = `process.exit(1)` : le conteneur redemarre en boucle plutot que
# de servir des pages sur un schema faux. Un incident VISIBLE vaut mieux qu'un site en
# ligne sur une base sans tables.

# ──────────────────────────────────────────────────────────────────────────────
# Point de montage des MEDIAS — cree ICI, et c'est une CORRECTION DE DEFAUT REEL
# ──────────────────────────────────────────────────────────────────────────────
# 🔴 Defaut MESURE le 2026-08-08 sur le staging (Story 7.4) : le premier televersement
# reel a echoue en `EACCES: permission denied` sur /repo/apps/vitrine/medias.
# Cause en DEUX couches :
#   ① ce repertoire n'existait PAS dans l'image -> Docker cree lui-meme le point de
#      montage, et il le cree en root:root ;
#   ② le processus tourne en `nextjs` (uid 1001) -> aucun droit d'ecriture.
# Docker n'initialise un volume nomme depuis l'image (contenu ET proprietaire) que si
# le chemin EXISTE dans l'image. En le creant ici avec le bon proprietaire, tout volume
# NEUF est utilisable d'emblee — c'est ce qui evitera de repayer ce defaut a la bascule
# de production (Story 7.5) ou sur un serveur reconstruit.
# ⚠️ Un volume DEJA cree reste inchange : il se corrige une fois a la main
#    (`docker run --rm -v docker_eds-medias:/v alpine chown -R 1001:1001 /v`),
#    procedure dans le README.
# ⚠️ Le mode de defaillance etait le pire possible : rien ne le signale avant qu'un
# benevole ne televerse pour de vrai — ni le build, ni le healthcheck, ni les portes.
# Meme famille que la dette R21.
RUN mkdir -p /repo/apps/vitrine/medias && chown -R nextjs:nodejs /repo/apps/vitrine/medias

USER nextjs
EXPOSE 3000
CMD ["node", "apps/vitrine/server.js"]
