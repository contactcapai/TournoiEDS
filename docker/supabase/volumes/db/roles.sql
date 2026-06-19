-- roles.sql — Roles Supabase (vendored depuis supabase/docker officiel)
-- Cree les roles applicatifs requis par GoTrue, PostgREST et Storage.

-- Role anon : utile pour les requetes non authentifiees via PostgREST
create role anon nologin noinherit;
-- Role authenticated : attribue apres connexion via GoTrue
create role authenticated nologin noinherit;
-- Role service_role : admin bypass des politiques RLS
create role service_role nologin noinherit bypassrls;
-- Role supabase_admin : super-utilisateur interne
create role supabase_admin nologin noinherit;
-- Role authenticator : utilisateur de connexion PostgREST (bascule de role selon JWT)
create role authenticator noinherit login;

grant anon              to authenticator;
grant authenticated     to authenticator;
grant service_role      to authenticator;
grant supabase_admin    to authenticator;

-- Roles internes GoTrue
create role supabase_auth_admin nologin noinherit;
grant all privileges on schema auth to supabase_auth_admin;

-- Role interne Storage
create role supabase_storage_admin nologin noinherit;
grant all privileges on schema storage to supabase_storage_admin;

-- Extension pgcrypto (requise pour uuid_generate_v4)
create extension if not exists pgcrypto;
-- Extension pg_net (webhooks HTTP asynchrones)
create extension if not exists pg_net schema extensions;
-- Extension pgjwt (generation/verification JWT en SQL)
create extension if not exists pgjwt schema extensions;
