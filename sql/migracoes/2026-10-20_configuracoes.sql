-- Baviera Control · Configurações gerais editáveis pelo chefe (2026-10-20)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm).
-- Primeira configuração: margem variável permitida aos vendedores (%), usada no "Esforço" da ficha de margem.

begin;

create table if not exists public.configuracoes (
  chave          text primary key,
  valor          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
alter table public.configuracoes enable row level security;

drop policy if exists cfg_ler on public.configuracoes;
create policy cfg_ler on public.configuracoes for select to authenticated using (true);

drop policy if exists cfg_chefe on public.configuracoes;
create policy cfg_chefe on public.configuracoes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.configuracoes from anon;
grant select, insert, update, delete on public.configuracoes to authenticated;  -- quem pode o quê decide-o a RLS acima
revoke truncate, trigger, references on public.configuracoes from authenticated;

create or replace function public.cfg_touch()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); new.atualizado_por := auth.uid(); return new; end $$;
revoke execute on function public.cfg_touch() from public, anon, authenticated;
drop trigger if exists cfg_touch on public.configuracoes;
create trigger cfg_touch before insert or update on public.configuracoes
  for each row execute function public.cfg_touch();

insert into public.configuracoes (chave, valor) values ('margem_variavel_pct', '3.5')
  on conflict (chave) do nothing;

commit;
