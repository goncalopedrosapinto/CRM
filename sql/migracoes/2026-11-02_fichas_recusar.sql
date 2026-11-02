-- Baviera Control · Fichas de margem: o chefe também pode NÃO aprovar, com motivo (2026-11-02)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Até aqui o chefe só podia aprovar. Agora também pode não aprovar, e tem de escrever porquê.
-- Fica registado quem, quando e o motivo; o motivo entra também como comentário no negócio,
-- para o vendedor o ver em "Comentários novos nos teus negócios".
-- A ficha sai da lista do chefe até o vendedor a mudar: quando os valores da ficha mudam, a recusa cai
-- e, se continuar a precisar de aprovação, volta a aparecer ao chefe. Aprovar depois de recusar limpa a recusa.
-- Só o chefe aprova ou recusa; os outros perfis não conseguem escrever estes campos (ficam como estavam).

begin;

alter table public.fichas_margem add column if not exists recusada_em   timestamptz;
alter table public.fichas_margem add column if not exists recusada_por  uuid references public.profiles(id) on delete set null;
alter table public.fichas_margem add column if not exists recusa_motivo text;

-- só o chefe aprova/recusa; se os valores da ficha mudarem, a aprovação e a recusa caem
create or replace function public.fichas_proteger_aprovacao()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.aprovada_em := null; new.aprovada_por := null;
      new.recusada_em := null; new.recusada_por := null; new.recusa_motivo := null;
    else
      new.aprovada_em := old.aprovada_em; new.aprovada_por := old.aprovada_por;
      new.recusada_em := old.recusada_em; new.recusada_por := old.recusada_por; new.recusa_motivo := old.recusa_motivo;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.dados is distinct from old.dados then
    if new.aprovada_em is not distinct from old.aprovada_em then
      new.aprovada_em := null; new.aprovada_por := null;
    end if;
    if new.recusada_em is not distinct from old.recusada_em then
      new.recusada_em := null; new.recusada_por := null; new.recusa_motivo := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists fichas_proteger_aprovacao_trg on public.fichas_margem;
create trigger fichas_proteger_aprovacao_trg before insert or update on public.fichas_margem
  for each row execute function public.fichas_proteger_aprovacao();

-- aprovar (ou retirar a aprovação); aprovar limpa uma recusa anterior
create or replace function public.ficha_aprovar(p_id bigint, p_aprovar boolean default true)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare t timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão: só o chefe de vendas aprova fichas' using errcode = '42501';
  end if;
  update public.fichas_margem
     set aprovada_em   = case when p_aprovar then now() end,
         aprovada_por  = case when p_aprovar then auth.uid() end,
         recusada_em   = case when p_aprovar then null else recusada_em end,
         recusada_por  = case when p_aprovar then null else recusada_por end,
         recusa_motivo = case when p_aprovar then null else recusa_motivo end
   where id = p_id
  returning aprovada_em into t;
  if not found then raise exception 'Ficha não encontrada'; end if;
  return t;
end $$;
revoke execute on function public.ficha_aprovar(bigint, boolean) from public, anon;
grant  execute on function public.ficha_aprovar(bigint, boolean) to authenticated;

-- não aprovar: motivo obrigatório; fica quem/quando/porquê e vai como comentário no negócio
create or replace function public.ficha_recusar(p_id bigint, p_motivo text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  t timestamptz; n bigint; modelo text;
  m text := left(btrim(coalesce(p_motivo, ''), E' \t\r\n'), 500);
begin
  if not public.is_admin() then
    raise exception 'Sem permissão: só o chefe de vendas pode não aprovar fichas' using errcode = '42501';
  end if;
  if m = '' then
    raise exception 'Escreve o motivo: o vendedor precisa de saber o que mudar' using errcode = '22023';
  end if;
  update public.fichas_margem
     set recusada_em = now(), recusada_por = auth.uid(), recusa_motivo = m,
         aprovada_em = null, aprovada_por = null
   where id = p_id
  returning recusada_em, negocio_id, nullif(btrim(coalesce(dados ->> 'modelo', '')), '') into t, n, modelo;
  if not found then raise exception 'Ficha não encontrada'; end if;
  if n is not null then
    insert into public.negocio_historico (negocio_id, tipo, texto)
    values (n, 'comentario', 'Ficha de margem' || coalesce(' (' || modelo || ')', '') || ' não aprovada: ' || m);
  end if;
  return t;
end $$;
revoke execute on function public.ficha_recusar(bigint, text) from public, anon;
grant  execute on function public.ficha_recusar(bigint, text) to authenticated;

commit;
