-- realtime.sql — Schema _realtime pour Supabase Realtime (vendored depuis supabase/docker)

create schema if not exists _realtime;
create extension if not exists pgcrypto;

-- Migrations Realtime gerees par le service realtime lui-meme au demarrage
-- (via /app/bin/migrate dans le CMD du conteneur).
-- Ce fichier cree uniquement le schema initial requis.
