-- Peças mínimas do Supabase para a base de ensaio (sem dados).
-- auth.uid() lê o utilizador de request.jwt.claims, como no Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
create or replace function auth.role() returns text language sql stable as
$$ select current_setting('request.jwt.claims', true)::json->>'role' $$;
create table if not exists auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
-- Storage (ficheiros): só o necessário para testar as regras de acesso às imagens
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets(id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table if not exists storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid default auth.uid(), owner_id text default auth.uid()::text, created_at timestamptz default now(), metadata jsonb);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
