#!/bin/sh
# docker/backup-pg.sh — Backup manuel PostgreSQL du tournoi (execute sur le VPS).
#
# Usage :  sudo /opt/tournoi-tft/docker/backup-pg.sh
#
# Produit : /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz (gzip du pg_dump).
# Le dump contient UNIQUEMENT les tables applicatives PG (pas de secrets .env).
#
# Procedure de restore (documentee dans README.md Runbook) :
#   gunzip -c /root/backups/tournoi-YYYYMMDD-HHMMSS.sql.gz \
#     | docker compose -f /opt/tournoi-tft/docker/docker-compose.yml exec -T postgres \
#         psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

set -eu

COMPOSE_FILE="${COMPOSE_FILE:-/opt/tournoi-tft/docker/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "FATAL: compose file introuvable : $COMPOSE_FILE" >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "FATAL: .env introuvable : $ENV_FILE" >&2
  exit 1
fi

# Charger POSTGRES_USER / POSTGRES_DB depuis docker/.env (pas les mots de passe, non loggue)
# shellcheck disable=SC1090
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

# Verification minimum : fichier non vide
if [ ! -s "$OUT" ]; then
  echo "FATAL: backup vide, suppression de $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

SIZE="$(ls -lh "$OUT" | awk '{print $5}')"
echo "Backup OK : $OUT ($SIZE)"
