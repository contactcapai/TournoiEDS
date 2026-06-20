#!/usr/bin/env bash
# docker/backup-supabase.sh — Backup PostgreSQL Supabase (base de la VITRINE EDS).
# A executer sur le VPS (manuellement ou via backup-all.sh / cron — cf. README Runbook).
#
# Usage :  sudo /opt/tournoi-tft/docker/backup-supabase.sh
#
# Produit : /root/backups/supabase-YYYYMMDD-HHMMSS.sql.gz (gzip du pg_dump).
#
# ATTENTION — DISTINCT du backup tournoi (backup-pg.sh) :
#   - tournoi  -> conteneur 'tournoi-tft-postgres' (base Prisma)   -> backup-pg.sh
#   - vitrine  -> conteneur 'supabase-db'          (base postgres) -> CE script
#   Les deux Postgres coexistent (cf. Story 1.7/1.8). Ne pas confondre les identifiants.
#
# CHOIX DE STRATEGIE DE RESTAURATION (Garde-fou n3, strategie A — recommandee) :
#   On dumpe la base 'postgres' avec --no-owner --no-privileges. La restauration se fait
#   sur une instance Supabase FRAICHEMENT INITIALISEE : les init SQL vendored
#   (volumes/db/roles.sql, jwt.sql...) recreent les roles/extensions supabase_*, PUIS on
#   restaure les donnees. --no-owner --no-privileges evite les erreurs "role does not exist"
#   et reattribue les objets au role qui restaure (supabase_admin). Cf. README §Restore.
#
# PERIMETRE DES BASES :
#   On sauvegarde la base 'postgres' (vitrine + auth + metadonnees Storage, schema 'storage').
#   La base '_analytics' (logs Logflare, service 'analytics') est VOLONTAIREMENT EXCLUE
#   (regenerable, jetable). Un dump de 'postgres' ne couvre donc PAS "tout Supabase".

# bash + pipefail : si pg_dump echoue dans 'pg_dump | gzip', le pipeline echoue (set -e arrete)
# au lieu de produire un .gz tronque "reussi". (POSIX sh n'a pas pipefail -> bash requis ici.)
set -euo pipefail

# Conteneur cible par son NOM FIXE (pas 'docker compose exec' : la stack tourne en
# multi-fichiers compose, projet 'supabase' -> compose exec sans -f/-p viserait le mauvais service).
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
# Superuser reel de l'image supabase/postgres = supabase_admin (confirme : 'postgres' n'est PAS superuser).
PG_SUPERUSER="${SUPABASE_PG_SUPERUSER:-supabase_admin}"
PG_DB="${SUPABASE_PG_DB:-postgres}"

# Le conteneur supabase-db a deja PGPASSWORD dans son env (cf. docker/supabase/docker-compose.yml).
# pg_dump l'utilise directement -> inutile de charger le .env hote (moins de surface de fuite ;
# aucun secret n'est logge ni passe en argument visible dans 'ps').
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "FATAL: conteneur '$CONTAINER' introuvable ou non demarre" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/supabase-$TS.sql.gz"

# Nettoyage du fichier partiel si on sort en erreur (disque plein, pg_dump KO...).
# Annule juste avant le succes pour conserver l'archive valide.
trap 'rm -f "$OUT"' EXIT

echo "Backup Supabase DB en cours -> $OUT"
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
echo "Backup Supabase OK : $OUT ($SIZE)"
