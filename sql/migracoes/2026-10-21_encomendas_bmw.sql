-- Baviera Control · Encomendas BMW (2026-10-21)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Mapa de encomendas/produção exportado do portal BMW. O chefe carrega o ficheiro na plataforma;
-- o mapa anterior é substituído de uma vez (tudo ou nada). Chefe e vendedores leem; ninguém edita linha a linha.
-- Contém o apelido do cliente (Customer (Last)): dado pessoal, por isso só chefe e vendedores o leem.

begin;

create table if not exists public.encomendas_bmw (
  production_number text primary key,
  chassis           text,
  body_group        text,
  model_code        text,
  model_desc        text,
  color_code        text,
  options           text,
  order_status      text,
  ts_order_status   date,
  processing_type   text,
  actual_prod_date  date,
  conf_f3_from      date,
  conf_f3_to        date,
  customer_last     text,
  exp_del_wk        text,
  importado_em      timestamptz not null default now(),
  importado_por     uuid default auth.uid()
);

alter table public.encomendas_bmw enable row level security;

-- Só leitura pela API; a escrita passa apenas pela função abaixo (que confirma que é o chefe).
revoke all on public.encomendas_bmw from anon, authenticated;
grant select on public.encomendas_bmw to authenticated;

drop policy if exists encomendas_bmw_ler on public.encomendas_bmw;
create policy encomendas_bmw_ler on public.encomendas_bmw for select to authenticated
  using (public.is_admin() or public.meu_role() = 'vendedor');

create or replace function public.encomendas_bmw_substituir(linhas jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if linhas is null or jsonb_typeof(linhas) <> 'array' or jsonb_array_length(linhas) = 0 then
    raise exception 'Ficheiro sem encomendas: o mapa atual fica como está';
  end if;
  delete from public.encomendas_bmw where true;
  insert into public.encomendas_bmw (production_number, chassis, body_group, model_code, model_desc, color_code,
         options, order_status, ts_order_status, processing_type, actual_prod_date, conf_f3_from, conf_f3_to,
         customer_last, exp_del_wk)
  select production_number, chassis, body_group, model_code, model_desc, color_code,
         options, order_status, ts_order_status, processing_type, actual_prod_date, conf_f3_from, conf_f3_to,
         customer_last, exp_del_wk
    from jsonb_to_recordset(linhas) as x(production_number text, chassis text, body_group text, model_code text,
         model_desc text, color_code text, options text, order_status text, ts_order_status date,
         processing_type text, actual_prod_date date, conf_f3_from date, conf_f3_to date,
         customer_last text, exp_del_wk text)
   where coalesce(production_number, '') <> '';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.encomendas_bmw_substituir(jsonb) from public, anon;
grant  execute on function public.encomendas_bmw_substituir(jsonb) to authenticated;

commit;
