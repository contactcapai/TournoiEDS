#!/bin/sh
# Base et role dedies a la VITRINE, sur le Postgres mutualise.
# Revision d'architecture du 2026-07-29 : sortie de Supabase self-hosted.
#
# ─────────────────────────────────────────────────────────────────────────────
# POURQUOI UN SCRIPT SHELL ET NON UN .sql
# /docker-entrypoint-initdb.d execute les .sql via `psql -f`, SANS passer de
# variables : un `:'mot_de_passe'` n'y serait jamais substitue et le fichier
# echouerait. Un .sh, lui, est source par le point d'entree avec l'environnement
# du conteneur disponible. C'est le motif officiel de l'image postgres.
#
# ⚠️ EXECUTE UNE SEULE FOIS, au tout premier demarrage, sur un volume VIDE.
# Sur le VPS, ou le volume du tournoi est DEJA initialise, ce script est IGNORE :
# les memes ordres sont a jouer a la main (procedure dans docs/PASSATION.md).
#
# 🔴 POURQUOI UN ROLE DEDIE, ET PAS LE SUPERUTILISATEUR DU TOURNOI
# Mutualiser le moteur cree un couplage d'exploitation, assume par la revision.
# Ce role en est la parade : il ne peut RIEN faire sur la base du tournoi. Le
# couplage reste physique (meme moteur, meme disque), il n'est pas logique.
# ─────────────────────────────────────────────────────────────────────────────
set -e

if [ -z "$VITRINE_DB_PASSWORD" ]; then
  echo "01-vitrine.sh : VITRINE_DB_PASSWORD absente — base 'vitrine' NON creee." >&2
  echo "  Renseigner docker/.env (voir docker/.env.example) puis recreer le volume." >&2
  exit 1
fi

# --username/--dbname : le superutilisateur cree par l'image (variables POSTGRES_*).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE vitrine WITH LOGIN PASSWORD '${VITRINE_DB_PASSWORD}';
    CREATE DATABASE vitrine OWNER vitrine;

    -- Cloisonnement : Postgres accorde CONNECT a PUBLIC sur toute base creee.
    -- On le retire des DEUX cotes pour que chaque role reste chez lui.
    REVOKE CONNECT ON DATABASE ${POSTGRES_DB} FROM PUBLIC;
    GRANT  CONNECT ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};

    REVOKE CONNECT ON DATABASE vitrine FROM PUBLIC;
    GRANT  CONNECT ON DATABASE vitrine TO vitrine;
EOSQL

echo "01-vitrine.sh : base 'vitrine' et role 'vitrine' crees, cloisonnes de '${POSTGRES_DB}'."
