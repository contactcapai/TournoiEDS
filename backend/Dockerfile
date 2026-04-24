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
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY prisma ./prisma
COPY prisma.config.ts ./

# Entrypoint : lance les migrations Prisma avant de demarrer le serveur.
# chmod +x en defense en profondeur (le bit executable du repo peut etre perdu
# en checkout Windows ; .gitattributes force LF et chmod ici re-applique le bit).
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
