-- Comissões lançadas: bloqueio por mês (2026-10-14)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm).

create table if not exists public.comissoes_fecho (
  mes         text primary key check (mes ~ '^\d{4}/\d{2}$'),   -- 'AAAA/MM'
  fechado_em  timestamptz not null default now(),
  fechado_por uuid default auth.uid()
);

alter table public.comissoes_fecho enable row level security;

drop policy if exists fecho_ler on public.comissoes_fecho;
create policy fecho_ler on public.comissoes_fecho
  for select to authenticated using (true);           -- vendedores veem "lançadas"

drop policy if exists fecho_admin on public.comissoes_fecho;
create policy fecho_admin on public.comissoes_fecho
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Bloqueio a sério: com o mês lançado, ninguém altera margens nem equipamento desse mês.
create or replace function public.com_mes_fechado(p_mes text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.comissoes_fecho where mes = p_mes);
$$;

create or replace function public.equip_bloqueio_fecho()
returns trigger language plpgsql security definer set search_path = public as $$
declare m_old text; m_new text;
begin
  if tg_op in ('UPDATE','DELETE') then m_old := to_char(old.data,'YYYY/MM'); end if;
  if tg_op in ('UPDATE','INSERT') then m_new := to_char(new.data,'YYYY/MM'); end if;
  if public.com_mes_fechado(m_old) then
    raise exception 'Comissões de % já lançadas — o chefe tem de desbloquear o mês.', m_old;
  end if;
  if public.com_mes_fechado(m_new) then
    raise exception 'Comissões de % já lançadas — o chefe tem de desbloquear o mês.', m_new;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists equip_bloqueio_fecho on public.equipamento;
create trigger equip_bloqueio_fecho before insert or update or delete on public.equipamento
  for each row execute function public.equip_bloqueio_fecho();

create or replace function public.margens_bloqueio_fecho()
returns trigger language plpgsql security definer set search_path = public as $$
declare m text;
begin
  select to_char(b.col_298,'YYYY/MM') into m
    from public.baviera_control b where b.id = coalesce(new.negocio_id, old.negocio_id);
  if public.com_mes_fechado(m) then
    raise exception 'Comissões de % já lançadas — o chefe tem de desbloquear o mês.', m;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists margens_bloqueio_fecho on public.margens;
create trigger margens_bloqueio_fecho before insert or update or delete on public.margens
  for each row execute function public.margens_bloqueio_fecho();
