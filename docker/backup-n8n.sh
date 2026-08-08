#!/bin/sh
# docker/backup-n8n.sh — Backup du n8n d'Esport des Sacres (Story 7.1, dette R42 ①).
# A executer sur le VPS (manuellement ou via backup-all.sh / cron — cf. README Runbook).
#
# Usage :  sudo /opt/tournoi-tft/docker/backup-n8n.sh
#
# Produit : /root/backups/n8n-YYYYMMDD-HHMMSS.tar.gz (archive du volume Docker).
#
# Le volume 'n8n-data' porte la base SQLite de n8n : workflows, executions, et surtout
# les CREDENTIALS CHIFFRES des comptes sociaux de l'asso — la pire des quatre pertes
# possibles (les 3 autres cibles se regenerent ou se ressaisissent ; un jeton d'API
# perdu se re-emet chez chaque plateforme, avec les delais de validation qui vont avec).
#
# 🔴 UNE ARCHIVE SEULE NE SUFFIT PAS A RESTAURER : les credentials sont chiffres par
# N8N_ENCRYPTION_KEY (docker/.env), qui ne part PAS dans les sauvegardes (voulu —
# secrets). Restauration = archive + la MEME cle. Conservation de la cle hors VPS :
# docs/PASSATION.md §3.
#
# COHERENCE (meme reserve ecrite que backup-medias.sh) : le tar se fait A CHAUD sur une
# base SQLite en mode WAL. L'archive contient donc database.sqlite ET database.sqlite-wal
# (+ -shm). C'est VOULU : les trois pris ensemble au meme instant sont rejouables. Tolere
# parce que le cron tourne a 03:30, fenetre ou n8n n'execute rien (aucun declencheur
# planifie, webhooks au trafic nul la nuit). Pour une coherence STRICTE : arreter le
# conteneur 'eds-n8n' le temps du tar (indisponibilite courte). On ne pretend pas
# « coherent » sans cette reserve.
# 🔴 RESTAURATION : le volume cible doit etre VIDE avant l'extraction (README §Restore n8n).
# Extraire par dessus un -wal/-shm posterieur ferait rejouer des pages plus recentes que
# la sauvegarde — corruption silencieuse. tar superpose, il n'efface pas.

set -eu

# Nom du volume tel que Docker Compose le prefixe (projet "docker").
VOLUME="${N8N_DATA_VOLUME:-docker_n8n-data}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"

if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "FATAL: volume Docker introuvable : $VOLUME" >&2
  exit 1
fi

# Temoin de structure : la base SQLite doit exister dans le volume. Si n8n change la
# disposition de /home/node/.n8n (montee de version), ce script doit echouer FRANCHEMENT
# plutot que d'archiver un volume qui ne contient plus la donnee qu'il promet.
if ! docker run --rm -v "$VOLUME":/data:ro alpine test -f /data/database.sqlite; then
  echo "FATAL: /data/database.sqlite absent du volume $VOLUME — la disposition n8n a change, ce script ne sauvegarde plus ce qu'il annonce." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/n8n-$TS.tar.gz"

# Nettoyage du fichier partiel si on sort en erreur (disque plein, tar KO...).
# Annule juste avant le succes pour conserver l'archive valide.
trap 'rm -f "$OUT"' EXIT

echo "Backup n8n en cours -> $OUT"
# Archive le volume en LECTURE SEULE via un conteneur alpine jetable (ne touche pas la stack).
docker run --rm -v "$VOLUME":/data:ro alpine tar czf - -C /data . > "$OUT"

# Verification minimum : archive non vide.
if [ ! -s "$OUT" ]; then
  echo "FATAL: archive vide, suppression de $OUT" >&2
  exit 1
fi

SIZE="$(ls -lh "$OUT" | awk '{print $5}')"
trap - EXIT   # succes : ne pas supprimer l'archive
echo "Backup n8n OK : $OUT ($SIZE)"
