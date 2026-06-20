#!/bin/sh
# docker/backup-storage.sh — Backup du bucket Storage Supabase (fichiers/medias de la vitrine).
# A executer sur le VPS (manuellement ou via backup-all.sh / cron — cf. README Runbook).
#
# Usage :  sudo /opt/tournoi-tft/docker/backup-storage.sh
#
# Produit : /root/backups/storage-YYYYMMDD-HHMMSS.tar.gz (archive du volume Docker).
#
# Le backend Storage est 'file' (STORAGE_BACKEND=file) : les fichiers du bucket vivent
# dans le volume nomme 'supabase-storage-data' (-> /var/lib/storage).
#
# COHERENCE (Garde-fou n3) :
#   Les METADONNEES du bucket (schema 'storage') vivent dans le Postgres Supabase
#   -> restaurer DB Supabase + Storage ENSEMBLE pour la coherence (ordre db -> storage).
#   Le tar (volume) et le pg_dump (DB) sont SEQUENTIELS : un upload concurrent peut faire
#   diverger fichiers <-> metadonnees. Tolere pour une vitrine a faible trafic en FENETRE
#   CALME (cron nocturne). Pour une coherence STRICTE : arreter 'storage'+'imgproxy' le
#   temps du tar (indisponibilite courte). On ne pretend pas "coherent" sans cette reserve.

set -eu

VOLUME="${SUPABASE_STORAGE_VOLUME:-supabase-storage-data}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"

if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "FATAL: volume Docker introuvable : $VOLUME" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/storage-$TS.tar.gz"

# Nettoyage du fichier partiel si on sort en erreur (disque plein, tar KO...).
# Annule juste avant le succes pour conserver l'archive valide.
trap 'rm -f "$OUT"' EXIT

echo "Backup Storage en cours -> $OUT"
# Archive le volume en LECTURE SEULE via un conteneur alpine jetable (ne touche pas la stack).
docker run --rm -v "$VOLUME":/data:ro alpine tar czf - -C /data . > "$OUT"

# Verification minimum : archive non vide (un bucket vide produit un tar.gz minimal non vide).
if [ ! -s "$OUT" ]; then
  echo "FATAL: archive vide, suppression de $OUT" >&2
  exit 1
fi

SIZE="$(ls -lh "$OUT" | awk '{print $5}')"
trap - EXIT   # succes : ne pas supprimer l'archive
echo "Backup Storage OK : $OUT ($SIZE)"
