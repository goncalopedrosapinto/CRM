-- Mês de referência validado pelo chefe (2026-10-14)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm).
--
-- Regra (só para negócios em CARTEIRA):
--  * O vendedor pode definir o mês ao criar ou ao passar para Carteira -> fica "por validar".
--  * Enquanto não está validado, o vendedor ainda o pode acertar.
--  * Depois de validado, se o vendedor mudar o mês, o mês NÃO muda: fica um pedido para o chefe.
--  * O chefe aprova (o mês muda), recusa (fica o que estava) ou valida.

alter table public.baviera_control
  add column if not exists mes1_validado   boolean not null default false,
  add column if not exists mes1_pedido     text,
  add column if not exists mes1_pedido_em  timestamptz,
  add column if not exists mes1_pedido_por uuid;

-- O que já existe hoje conta como validado (não enche o "A tratar" no primeiro dia).
alter table public.baviera_control disable trigger user;
update public.baviera_control set mes1_validado = true where mes1_validado = false;
alter table public.baviera_control enable trigger user;

create or replace function public.bc_mes1_validacao()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  entra boolean;
begin
  -- Contexto de servidor (SQL Editor, importações sem utilizador): não mexe.
  if auth.uid() is null then return new; end if;

  new.mes1 := nullif(new.mes1, '');
  entra := tg_op = 'INSERT' or old.status is distinct from 'Carteira';

  if public.is_admin() then
    if new.status = 'Carteira' and (entra or new.mes1 is distinct from old.mes1) then
      new.mes1_validado := true;
      new.mes1_pedido := null; new.mes1_pedido_em := null; new.mes1_pedido_por := null;
    end if;
    return new;
  end if;

  -- Não-admin: não mexe diretamente nos campos de validação.
  if tg_op = 'UPDATE' then
    new.mes1_validado   := old.mes1_validado;
    new.mes1_pedido     := old.mes1_pedido;
    new.mes1_pedido_em  := old.mes1_pedido_em;
    new.mes1_pedido_por := old.mes1_pedido_por;
  else
    new.mes1_validado := false;
    new.mes1_pedido := null; new.mes1_pedido_em := null; new.mes1_pedido_por := null;
  end if;

  if new.status is distinct from 'Carteira' then
    -- Fora da carteira o mês é livre; um pedido pendente deixa de fazer sentido.
    new.mes1_pedido := null; new.mes1_pedido_em := null; new.mes1_pedido_por := null;
    return new;
  end if;

  if entra then
    new.mes1_validado := false;               -- entrou agora na carteira: o chefe valida
    new.mes1_pedido := null; new.mes1_pedido_em := null; new.mes1_pedido_por := null;
    return new;
  end if;

  if new.mes1 is distinct from old.mes1 then
    if old.mes1 is null or not old.mes1_validado then
      return new;                             -- ainda por validar: pode acertar
    end if;
    -- já validado: vira pedido, o mês fica como estava
    new.mes1_pedido     := coalesce(new.mes1, '(sem mês)');
    new.mes1_pedido_em  := now();
    new.mes1_pedido_por := auth.uid();
    new.mes1            := old.mes1;
  end if;
  return new;
end $$;

drop trigger if exists bc_mes1_validacao_trg on public.baviera_control;
create trigger bc_mes1_validacao_trg before insert or update on public.baviera_control
  for each row execute function public.bc_mes1_validacao();

-- Histórico do negócio: regista o pedido, mas não os campos técnicos do pedido.
create or replace function public.neg_log_alteracoes()
returns trigger language plpgsql security definer set search_path = public as $function$
declare k text; o jsonb; n jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    insert into public.negocio_historico (negocio_id, tipo, texto)
    values (new.id, 'criacao', 'criou o negócio (' || coalesce(new.status,'sem status') || ')');
    return new;
  end if;
  o := to_jsonb(old);
  for k in select jsonb_object_keys(n) loop
    continue when k in ('updated_at','updated_by','status_updated_at','created_at','obs_gestor','id',
                        'mes1_pedido_em','mes1_pedido_por','mes1_validado');
    if (o -> k) is distinct from (n -> k) then
      insert into public.negocio_historico (negocio_id, tipo, campo, valor_antes, valor_depois)
      values (new.id, 'alteracao', k, o ->> k, n ->> k);
    end if;
  end loop;
  return new;
end $function$;
