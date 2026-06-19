-- jwt.sql — Injection du JWT_SECRET dans la config Postgres (vendored depuis supabase/docker)
-- Permet a pgjwt de signer/verifier les tokens JWT cote SQL.

create schema if not exists extensions;
create extension if not exists pgjwt with schema extensions;

-- Stocker le JWT_SECRET dans la configuration Postgres pour pgrst
alter database postgres set "app.settings.jwt_secret" to 'JWT_PLACEHOLDER_REPLACE_AT_RUNTIME';
alter database postgres set "app.settings.jwt_exp"    to '3600';
