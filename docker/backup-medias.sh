#!/bin/sh
# docker/backup-medias.sh — Backup des MEDIAS de la vitrine (photos de la galerie).
# A executer sur le VPS (manuellement ou via backup-all.sh / cron — cf. README Runbook).
#
# Usage :  sudo /opt/tournoi-tft/docker/backup-medias.sh
#
# Produit : /root/backups/medias-YYYYMMDD-HHMMSS.tar.gz (archive du volume Docker).
#
# Les fichiers televerses par le back-office vivent dans le volume nomme 'eds-medias'
# (montage /repo/apps/vitrine/medias dans le conteneur vitrine — chemin CORRIGE par la
# Story 4.3, il valait /app/... alors que le Dockerfile fixe WORKDIR /repo). Ce script
# sauvegarde le VOLUME et non un chemin du conteneur : il etait donc juste malgre
# l'erreur de montage, et c'est precisement pourquoi elle n'a rien signale.
# Revision d'architecture
# du 2026-07-29 : remplace le bucket Supabase Storage, retire avec le reste de la stack.
#
# COHERENCE (Garde-fou n3, INCHANGE PAR LA REVISION) :
#   Les METADONNEES des medias (table 'photo', Story 4.3) vivent dans la base 'vitrine'
#   -> restaurer BASE + MEDIAS ENSEMBLE, dans l'ordre base -> medias.
#   Le tar (volume) et le pg_dump (base) sont SEQUENTIELS : un televersement concurrent
#   peut faire diverger fichiers <-> metadonnees. Tolere pour une vitrine a faible trafic
#   en FENETRE CALME (cron nocturne). Pour une coherence STRICTE : arreter le conteneur
#   'vitrine' le temps du tar (indisponibilite courte). On ne pretend pas "coherent" sans
#   cette reserve.

set -eu

# Nom du volume tel que Docker Compose le prefixe (projet "docker").
VOLUME="${EDS_MEDIAS_VOLUME:-docker_eds-medias}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"

if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "FATAL: volume Docker introuvable : $VOLUME" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/medias-$TS.tar.gz"

# Nettoyage du fichier partiel si on sort en erreur (disque plein, tar KO...).
# Annule juste avant le succes pour conserver l'archive valide.
trap 'rm -f "$OUT"' EXIT

echo "Backup medias en cours -> $OUT"
# Archive le volume en LECTURE SEULE via un conteneur alpine jetable (ne touche pas la stack).
docker run --rm -v "$VOLUME":/data:ro alpine tar czf - -C /data . > "$OUT"

# Verification minimum : archive non vide (un dossier vide produit un tar.gz minimal non vide).
if [ ! -s "$OUT" ]; then
  echo "FATAL: archive vide, suppression de $OUT" >&2
  exit 1
fi

SIZE="$(ls -lh "$OUT" | awk '{print $5}')"
trap - EXIT   # succes : ne pas supprimer l'archive
echo "Backup medias OK : $OUT ($SIZE)"
