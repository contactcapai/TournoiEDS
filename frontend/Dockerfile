# Stage 1: Build (Vite + tsc strict)
# Vite injecte les variables VITE_* au moment du build (pas au runtime).
# La valeur de VITE_API_URL DOIT etre passee via --build-arg pour que le bundle prod
# pointe sur https://api-tournoi.esportdessacres.fr (sinon fallback localhost:3001).
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Stage 2: Runtime (nginx statique servant le dist/)
# Image officielle nginx Alpine. Traefik fait le TLS en amont, le container ecoute en HTTP:80.
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
