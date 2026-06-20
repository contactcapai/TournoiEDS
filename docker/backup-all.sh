#!/bin/sh
# docker/backup-all.sh — Orchestrateur de sauvegarde self-hosted EDS (a planifier via cron).
# A executer sur le VPS (cf. docker/backups.cron + README §Sauvegardes automatiques).
#
# Usage :  sudo /opt/tournoi-tft/docker/backup-all.sh
#
# Enchaine les 3 sauvegardes locales, puis (optionnel) copie hors-VPS, puis rotation :
#   1. backup-pg.sh        -> tournoi-*.sql.gz   (Postgres tournoi, REUTILISE tel quel)
#   2. backup-supabase.sh  -> supabase-*.sql.gz  (Postgres Supabase / vitrine)
#   3. backup-storage.sh   -> storage-*.tar.gz   (bucket Storage)
#   4. copie hors-VPS (rclone) si docker/offsite.env present et OFFSITE_ENABLED=true
#   5. rotation locale (et distante) au-dela de la fenetre de retention
#
# Echoue FRANCHEMENT si une sauvegarde echoue (rc agrege) : ni upload ni rotation dans ce cas
# (on ne purge jamais d'anciennes sauvegardes si la nouvelle n'est pas garantie).

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
OFFSITE_ENV="${OFFSITE_ENV:-$SCRIPT_DIR/offsite.env}"
RETENTION_LOCAL_DAYS="${RETENTION_LOCAL_DAYS:-14}"   # aligne sur la §Cleanup tournoi existante
RETENTION_REMOTE_DAYS="${RETENTION_REMOTE_DAYS:-30}"

log() { echo "[backup-all $(date +%Y-%m-%d_%H:%M:%S)] $*"; }

# ─────────────────────────────────────────────────
# Verrou anti-chevauchement (P4) : si un run precedent est encore en cours (gros dump,
# upload lent) et que le cron relance, on abandonne proprement au lieu de lancer 2 dumps
# concurrents (charge + risque d'incoherence). flock = util-linux (present sur le VPS).
# ─────────────────────────────────────────────────
LOCK_FILE="${LOCK_FILE:-/tmp/eds-backup-all.lock}"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  flock -n 9 || { log "Un backup est deja en cours (lock $LOCK_FILE) -> abandon."; exit 0; }
else
  log "AVERTISSEMENT: 'flock' indisponible -> pas de protection anti-chevauchement."
fi

export BACKUP_DIR
rc=0

log "1/3 Sauvegarde DB tournoi (backup-pg.sh)..."
sh   "$SCRIPT_DIR/backup-pg.sh"       || { log "ECHEC sauvegarde tournoi";  rc=1; }

log "2/3 Sauvegarde DB Supabase (backup-supabase.sh)..."
# backup-supabase.sh = bash (pipefail) -> l'invoquer avec bash (pas sh, qui ignorerait pipefail).
bash "$SCRIPT_DIR/backup-supabase.sh" || { log "ECHEC sauvegarde Supabase"; rc=1; }

log "3/3 Sauvegarde Storage (backup-storage.sh)..."
sh   "$SCRIPT_DIR/backup-storage.sh"  || { log "ECHEC sauvegarde Storage";  rc=1; }

if [ "$rc" -ne 0 ]; then
  log "FATAL: au moins une sauvegarde a echoue -> pas d'upload hors-VPS, pas de rotation."
  exit 1
fi

# ─────────────────────────────────────────────────
# Copie hors-VPS (boring & multi-fournisseur — cf. Garde-fou n2 / offsite.env.example).
# Desactivee tant que docker/offsite.env n'existe pas (= validation locale, dev).
# ─────────────────────────────────────────────────
if [ -f "$OFFSITE_ENV" ]; then
  # ⚠️ P6 : ce fichier est SOURCE (.) sous 'set -eu' -> il doit contenir UNIQUEMENT des
  # affectations KEY=value (aucune commande : une commande echouante arreterait le script
  # ICI, apres les backups locaux mais avant l'upload). Le proteger : chmod 600 (secrets).
  # shellcheck disable=SC1090
  . "$OFFSITE_ENV"
  if [ "${OFFSITE_ENABLED:-false}" = "true" ]; then
    : "${RCLONE_REMOTE:?RCLONE_REMOTE manquant dans $OFFSITE_ENV}"
    RCLONE_CONFIG_FILE="${RCLONE_CONFIG_FILE:-$SCRIPT_DIR/rclone.conf}"
    REMOTE_DAYS="${RETENTION_REMOTE_DAYS:-30}"
    log "Copie hors-VPS via rclone -> $RCLONE_REMOTE"
    rclone --config "$RCLONE_CONFIG_FILE" copy "$BACKUP_DIR" "$RCLONE_REMOTE" --min-age 1m
    # Rotation distante FATALE (P3) : un echec de purge = accumulation silencieuse sur le
    # remote -> on echoue franchement (les backups sont deja uploades, la donnee est sauve ;
    # c'est la purge qui doit etre corrigee). Visible dans /var/log/eds-backup.log.
    if ! rclone --config "$RCLONE_CONFIG_FILE" delete "$RCLONE_REMOTE" --min-age "${REMOTE_DAYS}d"; then
      log "FATAL: rotation distante echouee -> accumulation sur $RCLONE_REMOTE (a corriger)."
      exit 1
    fi
    log "Copie hors-VPS OK"
  else
    log "Hors-VPS desactive (OFFSITE_ENABLED != true) -> sauvegardes locales seulement."
  fi
else
  log "Pas de $OFFSITE_ENV -> etape hors-VPS ignoree (cf. offsite.env.example)."
fi

# ─────────────────────────────────────────────────
# Rotation locale : purge les 3 familles au-dela de la fenetre de retention locale.
# (Generalise le 'find -mtime' historique, limite a tournoi-*, aux 3 prefixes.)
# ─────────────────────────────────────────────────
log "Rotation locale : purge > ${RETENTION_LOCAL_DAYS} j (tournoi-*/supabase-*/storage-*)"
find "$BACKUP_DIR" -name 'tournoi-*.sql.gz'  -mtime +"$RETENTION_LOCAL_DAYS" -delete
find "$BACKUP_DIR" -name 'supabase-*.sql.gz' -mtime +"$RETENTION_LOCAL_DAYS" -delete
find "$BACKUP_DIR" -name 'storage-*.tar.gz'  -mtime +"$RETENTION_LOCAL_DAYS" -delete

log "Sauvegarde complete terminee (rc=0)."
