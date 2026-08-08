#!/bin/sh
# docker/backup-all.sh — Orchestrateur de sauvegarde self-hosted EDS (a planifier via cron).
# A executer sur le VPS (cf. docker/backups.cron + README §Sauvegardes automatiques).
#
# Usage :  sudo /opt/tournoi-tft/docker/backup-all.sh
#
# Enchaine les 4 sauvegardes locales, puis (optionnel) copie hors-VPS, puis rotation :
#   1. backup-pg.sh        -> tournoi-*.sql.gz   (Postgres tournoi, REUTILISE tel quel)
#   2. backup-vitrine.sh   -> vitrine-*.sql.gz   (base 'vitrine', meme moteur Postgres)
#   3. backup-medias.sh    -> medias-*.tar.gz    (volume des medias de la vitrine)
#   4. backup-n8n.sh       -> n8n-*.tar.gz       (volume n8n : credentials sociaux, Story 7.1)
#   5. copie hors-VPS (rclone) si docker/offsite.env present et OFFSITE_ENABLED=true
#   6. rotation locale (et distante) au-dela de la fenetre de retention
#
# 🔴 CE COMPTE EST ECRIT EN DUR ICI ET DANS LES log() CI-DESSOUS (« x/4 »). Ajouter une
# 5e cible sans toucher TOUTES ces chaines les rendrait fausses, et aucune porte ne le
# verrait (les scripts d'infra ne sont ni lintes, ni types, ni gardes). Temoin a
# declarer AVANT la mesure : /4 -> /5 partout, en-tete ET rotation (Story 7.1, fait ②).
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

log "1/4 Sauvegarde DB tournoi (backup-pg.sh)..."
sh   "$SCRIPT_DIR/backup-pg.sh"       || { log "ECHEC sauvegarde tournoi";  rc=1; }

log "2/4 Sauvegarde base vitrine (backup-vitrine.sh)..."
# backup-vitrine.sh = bash (pipefail) -> l'invoquer avec bash (pas sh, qui ignorerait pipefail).
bash "$SCRIPT_DIR/backup-vitrine.sh" || { log "ECHEC sauvegarde base vitrine"; rc=1; }

log "3/4 Sauvegarde medias (backup-medias.sh)..."
sh   "$SCRIPT_DIR/backup-medias.sh"  || { log "ECHEC sauvegarde medias";  rc=1; }

log "4/4 Sauvegarde n8n (backup-n8n.sh)..."
sh   "$SCRIPT_DIR/backup-n8n.sh"     || { log "ECHEC sauvegarde n8n";  rc=1; }

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
# Rotation locale : purge les 4 familles au-dela de la fenetre de retention locale.
# (Generalise le 'find -mtime' historique, limite a tournoi-*, aux 4 prefixes.)
# ─────────────────────────────────────────────────
log "Rotation locale : purge > ${RETENTION_LOCAL_DAYS} j (tournoi-*/vitrine-*/medias-*/n8n-*)"
find "$BACKUP_DIR" -name 'tournoi-*.sql.gz'  -mtime +"$RETENTION_LOCAL_DAYS" -delete
find "$BACKUP_DIR" -name 'vitrine-*.sql.gz'  -mtime +"$RETENTION_LOCAL_DAYS" -delete
find "$BACKUP_DIR" -name 'medias-*.tar.gz'   -mtime +"$RETENTION_LOCAL_DAYS" -delete
find "$BACKUP_DIR" -name 'n8n-*.tar.gz'      -mtime +"$RETENTION_LOCAL_DAYS" -delete

log "Sauvegarde complete terminee (rc=0)."
