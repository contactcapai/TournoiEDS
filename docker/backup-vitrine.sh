#!/usr/bin/env bash
# docker/backup-vitrine.sh — Backup PostgreSQL de la base VITRINE EDS.
# A executer sur le VPS (manuellement ou via backup-all.sh / cron — cf. README Runbook).
#
# Usage :  sudo /opt/tournoi-tft/docker/backup-vitrine.sh
#
# Produit : /root/backups/vitrine-YYYYMMDD-HHMMSS.sql.gz (gzip du pg_dump).
#
# ⚠️ DEUX BASES DANS LE MEME MOTEUR (revision d'architecture du 2026-07-29) :
#   - tournoi  -> base '\$POSTGRES_DB' (Prisma)  -> backup-pg.sh
#   - vitrine  -> base 'vitrine'      (Drizzle) -> CE script
#   Il n'y a plus qu'UN SEUL conteneur Postgres ('tournoi-tft-postgres'), mais toujours
#   DEUX sauvegardes distinctes : une base perdue ne doit pas en emporter une autre.
#   (Avant cette revision, la vitrine vivait sur un 2e moteur, 'supabase-db'.)
#
# STRATEGIE DE RESTAURATION :
#   Dump avec --no-owner --no-privileges : la restauration recree les objets au nom du
#   role qui restaure, sans exiger que le role 'vitrine' preexiste. La base et le role
#   sont recrees par docker/initdb/01-vitrine.sh au premier demarrage d'un volume vide,
#   ou a la main sur un volume existant. Cf. README §Restore.

# bash + pipefail : si pg_dump echoue dans 'pg_dump | gzip', le pipeline echoue (set -e arrete)
# au lieu de produire un .gz tronque "reussi". (POSIX sh n'a pas pipefail -> bash requis ici.)
set -euo pipefail

# Conteneur cible par son NOM FIXE (et non 'docker compose exec', qui depend du repertoire
# courant et du nom de projet).
CONTAINER="${VITRINE_DB_CONTAINER:-tournoi-tft-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
# Superuser de l'image postgres officielle = celui de POSTGRES_USER (cf. docker/.env).
PG_SUPERUSER="${VITRINE_PG_SUPERUSER:-${POSTGRES_USER:-tournoi}}"
PG_DB="${VITRINE_PG_DB:-vitrine}"

# Le conteneur postgres a deja POSTGRES_PASSWORD dans son env (cf. docker/docker-compose.yml) ;
# pg_dump s'y connecte en local (socket/trust) -> inutile de charger le .env hote. Aucun secret
# n'est logge ni passe en argument visible dans 'ps'.
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "FATAL: conteneur '$CONTAINER' introuvable ou non demarre" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/vitrine-$TS.sql.gz"

# Nettoyage du fichier partiel si on sort en erreur (disque plein, pg_dump KO...).
# Annule juste avant le succes pour conserver l'archive valide.
trap 'rm -f "$OUT"' EXIT

echo "Backup base vitrine en cours -> $OUT"
docker exec -i "$CONTAINER" \
  pg_dump -U "$PG_SUPERUSER" -d "$PG_DB" --no-owner --no-privileges \
  | gzip > "$OUT"

# Verification minimum : fichier non vide
if [ ! -s "$OUT" ]; then
  echo "FATAL: backup vide, suppression de $OUT" >&2
  exit 1
fi

SIZE="$(ls -lh "$OUT" | awk '{print $5}')"
trap - EXIT   # succes : ne pas supprimer l'archive
echo "Backup vitrine OK : $OUT ($SIZE)"
