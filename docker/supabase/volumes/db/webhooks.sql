-- webhooks.sql — Schema supabase_functions + hooks HTTP (vendored depuis supabase/docker)

create schema if not exists supabase_functions;
create extension if not exists pg_net with schema extensions;

create or replace function supabase_functions.http_request()
  returns trigger
  language plpgsql
  security definer
as $$
declare
  request_id bigint;
  payload jsonb;
  url text := tg_argv[0]::text;
  method text := tg_argv[1]::text;
  headers jsonb default '{}'::jsonb;
  params  jsonb default '{}'::jsonb;
  timeout_ms integer default 1000;
begin
  if url is null or url = 'null' then
    raise exception 'url argument is missing';
  end if;
  if method is null or method = 'null' then
    raise exception 'method argument is missing';
  end if;
  if tg_argv[2] is null or tg_argv[2] = 'null' then
    headers = '{"Content-Type": "application/json"}'::jsonb;
  else
    headers = tg_argv[2]::jsonb;
  end if;
  if tg_argv[3] is null or tg_argv[3] = 'null' then
    params = '{}'::jsonb;
  else
    params = tg_argv[3]::jsonb;
  end if;
  if tg_argv[4] is null or tg_argv[4] = 'null' then
    timeout_ms = 1000;
  else
    timeout_ms = tg_argv[4]::integer;
  end if;
  case
    when method = 'GET' then
      select http_get into request_id from extensions.http_get(url::text, params::jsonb, timeout_ms::integer);
    when method = 'POST' then
      payload = jsonb_build_object(
        'old_record', old,
        'record', new,
        'type', tg_op,
        'table', tg_table_name,
        'schema', tg_table_schema
      );
      select http_post into request_id from extensions.http_post(url::text, payload::jsonb, headers::jsonb, timeout_ms::integer);
    else
      raise exception 'method argument % is invalid', method;
  end case;
  insert into supabase_functions.hooks
    (hook_table_id, hook_name, request_id)
  values
    (tg_relid, tg_name, request_id);
  return new;
exception
  when others then return new;
end
$$;

create table if not exists supabase_functions.hooks (
  id              bigserial primary key,
  hook_table_id   integer   not null,
  hook_name       text      not null,
  created_at      timestamptz not null default now(),
  request_id      bigint
);
create index if not exists supabase_functions_hooks_request_id_idx on supabase_functions.hooks using btree (request_id);
create index if not exists supabase_functions_hooks_h_table_id_h_name_idx on supabase_functions.hooks using btree (hook_table_id, hook_name);

grant usage on schema supabase_functions to postgres, anon, authenticated, service_role;
