-- Baviera Control · Encomendas BMW: "estou a negociar esta mota" (2026-10-21)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- A reserva vive no próprio negócio: o campo "Encomenda" (enc) = Production Number da BMW.
--   Quente / Morno      -> em negociação
--   Carteira / Retail   -> vendida
--   Frio / Perdido      -> não reserva (a mota fica livre sozinha)
-- Uma mota só pode estar num negócio ativo de cada vez. Só o chefe passa uma mota de um negócio para outro.
-- Não muda dados existentes.

begin;

-- 1) Quem está com cada encomenda (sem nomes nem contactos de clientes). Chefe e vendedores.
create or replace function public.encomendas_reservas()
returns table (enc text, negocio_id bigint, vendedor_id uuid, status text, atualizado timestamptz)
language sql stable security definer set search_path = public as $$
  select trim(b.enc), b.id, b.vendedor_id, b.status, b.updated_at
    from public.baviera_control b
   where nullif(trim(b.enc), '') is not null
     and b.status in ('Quente', 'Morno', 'Carteira', 'Retail')
     and (public.is_admin() or public.meu_role() = 'vendedor');
$$;
revoke execute on function public.encomendas_reservas() from public, anon;
grant  execute on function public.encomendas_reservas() to authenticated;

-- 2) Uma mota, um negócio ativo. O chefe pode passar por cima (para trocar uma mota de negócio).
create or replace function public.bc_reserva_unica()
returns trigger language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if nullif(trim(new.enc), '') is null or new.status not in ('Quente', 'Morno', 'Carteira', 'Retail') then
    return new;
  end if;
  -- nada mudou na reserva: não volta a verificar (não bloqueia negócios antigos ao gravar outra coisa)
  if tg_op = 'UPDATE' and trim(coalesce(old.enc, '')) = trim(new.enc)
     and old.status in ('Quente', 'Morno', 'Carteira', 'Retail') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  select b.id, b.vendedor_id, b.status, coalesce(nullif(p.nome, ''), 'outro vendedor') as nome
    into o
    from public.baviera_control b
    left join public.profiles p on p.id = b.vendedor_id
   where trim(b.enc) = trim(new.enc) and b.id <> new.id
     and b.status in ('Quente', 'Morno', 'Carteira', 'Retail')
   limit 1;
  if found then
    if o.vendedor_id = new.vendedor_id then
      raise exception 'A encomenda % já está noutro negócio teu (%). Liberta-a lá primeiro.', trim(new.enc), o.status;
    end if;
    raise exception 'A encomenda % já está a ser trabalhada por % (%). Só o chefe de vendas a pode passar para outro negócio.',
      trim(new.enc), o.nome, o.status;
  end if;
  return new;
end $$;
revoke execute on function public.bc_reserva_unica() from public, anon;

drop trigger if exists bc_reserva_unica_trg on public.baviera_control;
create trigger bc_reserva_unica_trg before insert or update of enc, status on public.baviera_control
  for each row execute function public.bc_reserva_unica();

commit;
