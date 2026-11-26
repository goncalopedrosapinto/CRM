-- Baviera Control · Revisão da Bimby: checklist de entrega pelo vendedor e escala feita pelos vendedores (2026-11-26)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
-- Não apaga nem altera dados que já existem.
--
-- 1. Entregas: o vendedor do negócio marca os itens da checklist (documentos, pedido de matrícula, preparação, peças,
--    pago, BMW FS, data de entrega) através da função entrega_vendedor. Não lê nem escreve as notas do chefe
--    (docs_obs e obs). O chefe continua a mexer em tudo diretamente na tabela.
-- 2. Escala: os vendedores preenchem a escala da sua linha (todos os dias da linha, não só os seus), do mês atual
--    em diante, enquanto o mês não estiver submetido nem validado. Submetem o mês; o chefe valida ou devolve com
--    um comentário. Depois de validado, só o chefe mexe (ou devolve para os vendedores corrigirem).
--    Estado de cada mês na tabela nova escala_meses (sem linha = rascunho).

begin;

-- ---------- 1. Entregas ----------
create or replace function public.entrega_vendedor(p_negocio bigint, p_patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  k text;
  permitidos constant text[] := array['docs','pedido_matricula','prep_pedida','pecas_precisa','pecas_chegaram','pecas_obs','pago','fs_tratado','data_entrega'];
begin
  if auth.uid() is null then raise exception 'Sem sessão' using errcode = '42501'; end if;
  if not (public.is_admin() or (coalesce(public.meu_role(), '') = 'vendedor'
          and exists (select 1 from public.baviera_control b where b.id = p_negocio and b.vendedor_id = auth.uid()))) then
    raise exception 'Sem permissão: só o vendedor do negócio marca a entrega' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'Pedido inválido'; end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any (permitidos)) then raise exception 'Sem permissão para o campo %', k using errcode = '42501'; end if;
  end loop;
  insert into public.entregas(negocio_id) values (p_negocio) on conflict (negocio_id) do nothing;
  update public.entregas set
    docs             = case when p_patch ? 'docs' then coalesce(nullif(p_patch->'docs', 'null'::jsonb), '{}'::jsonb) else docs end,
    pedido_matricula = case when p_patch ? 'pedido_matricula' then coalesce((p_patch->>'pedido_matricula')::boolean, false) else pedido_matricula end,
    prep_pedida      = case when p_patch ? 'prep_pedida' then coalesce((p_patch->>'prep_pedida')::boolean, false) else prep_pedida end,
    pecas_precisa    = case when p_patch ? 'pecas_precisa' then coalesce((p_patch->>'pecas_precisa')::boolean, false) else pecas_precisa end,
    pecas_chegaram   = case when p_patch ? 'pecas_chegaram' then coalesce((p_patch->>'pecas_chegaram')::boolean, false) else pecas_chegaram end,
    pecas_obs        = case when p_patch ? 'pecas_obs' then nullif(p_patch->>'pecas_obs', '') else pecas_obs end,
    pago             = case when p_patch ? 'pago' then coalesce((p_patch->>'pago')::boolean, false) else pago end,
    fs_tratado       = case when p_patch ? 'fs_tratado' then coalesce((p_patch->>'fs_tratado')::boolean, false) else fs_tratado end,
    data_entrega     = case when p_patch ? 'data_entrega' then nullif(p_patch->>'data_entrega', '')::date else data_entrega end,
    updated_at       = now()
  where negocio_id = p_negocio;
end $$;
revoke all on function public.entrega_vendedor(bigint, jsonb) from public, anon;
grant execute on function public.entrega_vendedor(bigint, jsonb) to authenticated;

-- ---------- 2. Escala ----------
create table if not exists public.escala_meses (
  linha text not null,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  estado text not null check (estado in ('submetido', 'validado', 'devolvido')),
  comentario text,
  submetido_por uuid references public.profiles(id),
  submetido_em timestamptz,
  decidido_por uuid references public.profiles(id),
  decidido_em timestamptz,
  primary key (linha, mes)
);
alter table public.escala_meses enable row level security;
drop policy if exists escala_meses_ler on public.escala_meses;
create policy escala_meses_ler on public.escala_meses for select to authenticated
  using (auth.uid() is not null and coalesce(public.meu_role(), '') <> 'eventos');
drop policy if exists escala_meses_admin on public.escala_meses;
create policy escala_meses_admin on public.escala_meses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.escala_meses from anon;
grant select, insert, update, delete on public.escala_meses to authenticated;

-- o vendedor pode mexer neste dia desta pessoa?
create or replace function public.escala_vend_pode(p_dia date, p_vendedor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_role(), '') = 'vendedor'
     and p_dia >= date_trunc('month', current_date)::date
     and exists (select 1 from public.profiles eu, public.profiles ele
                  where eu.id = auth.uid() and ele.id = p_vendedor
                    and ele.role = 'vendedor' and eu.linha is not null and ele.linha = eu.linha)
     and coalesce((select m.estado from public.escala_meses m, public.profiles eu
                    where eu.id = auth.uid() and m.linha = eu.linha and m.mes = to_char(p_dia, 'YYYY-MM')), 'rascunho')
         in ('rascunho', 'devolvido')
$$;
revoke all on function public.escala_vend_pode(date, uuid) from public, anon;
grant execute on function public.escala_vend_pode(date, uuid) to authenticated;

drop policy if exists escala_vend_ins on public.escala;
create policy escala_vend_ins on public.escala for insert to authenticated
  with check (public.escala_vend_pode(dia, vendedor_id));
drop policy if exists escala_vend_upd on public.escala;
create policy escala_vend_upd on public.escala for update to authenticated
  using (public.escala_vend_pode(dia, vendedor_id)) with check (public.escala_vend_pode(dia, vendedor_id));
drop policy if exists escala_vend_del on public.escala;
create policy escala_vend_del on public.escala for delete to authenticated
  using (public.escala_vend_pode(dia, vendedor_id));

-- o vendedor submete o mês da sua linha
create or replace function public.escala_submeter(p_mes text)
returns void language plpgsql security definer set search_path = public as $$
declare l text; e text;
begin
  if coalesce(public.meu_role(), '') <> 'vendedor' then raise exception 'Sem permissão: só os vendedores submetem a escala' using errcode = '42501'; end if;
  select linha into l from public.profiles where id = auth.uid();
  if l is null then raise exception 'Sem linha atribuída'; end if;
  if p_mes !~ '^\d{4}-\d{2}$' then raise exception 'Mês inválido'; end if;
  if (p_mes || '-01')::date < date_trunc('month', current_date)::date then raise exception 'Este mês já passou'; end if;
  select estado into e from public.escala_meses where linha = l and mes = p_mes;
  if e = 'submetido' then raise exception 'Este mês já está submetido'; end if;
  if e = 'validado' then raise exception 'Este mês já está validado'; end if;
  insert into public.escala_meses(linha, mes, estado, submetido_por, submetido_em)
    values (l, p_mes, 'submetido', auth.uid(), now())
  on conflict (linha, mes) do update set estado = 'submetido', submetido_por = auth.uid(), submetido_em = now();
end $$;
revoke all on function public.escala_submeter(text) from public, anon;
grant execute on function public.escala_submeter(text) to authenticated;

-- o chefe valida ou devolve (devolver pede um comentário; também reabre um mês validado)
create or replace function public.escala_decidir(p_linha text, p_mes text, p_validar boolean, p_comentario text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão: só o chefe valida a escala' using errcode = '42501'; end if;
  if p_mes !~ '^\d{4}-\d{2}$' then raise exception 'Mês inválido'; end if;
  if not p_validar and coalesce(btrim(p_comentario), '') = '' then raise exception 'Escreve o que os vendedores têm de mudar'; end if;
  insert into public.escala_meses(linha, mes, estado, comentario, decidido_por, decidido_em)
    values (p_linha, p_mes, case when p_validar then 'validado' else 'devolvido' end,
            case when p_validar then null else btrim(p_comentario) end, auth.uid(), now())
  on conflict (linha, mes) do update set
    estado = excluded.estado, comentario = excluded.comentario, decidido_por = auth.uid(), decidido_em = now();
end $$;
revoke all on function public.escala_decidir(text, text, boolean, text) from public, anon;
grant execute on function public.escala_decidir(text, text, boolean, text) to authenticated;

commit;
