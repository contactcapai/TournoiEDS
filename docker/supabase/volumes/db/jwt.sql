-- jwt.sql — Extension pgjwt (vendored depuis supabase/docker)
-- Installe pgjwt pour les fonctions JWT cote SQL.
-- Note : app.settings.jwt_secret n'est PAS defini ici (le placeholder ne serait jamais
-- remplace par l'init script). GoTrue lit GOTRUE_JWT_SECRET et PostgREST lit
-- PGRST_APP_SETTINGS_JWT_SECRET depuis leurs propres variables d'environnement.
-- Si des fonctions SQL ont besoin de jwt_secret, l'operateur peut l'injecter via
-- une migration Drizzle (Story 3.1+) une fois la base initialisee.

create schema if not exists extensions;
create extension if not exists pgjwt with schema extensions;
