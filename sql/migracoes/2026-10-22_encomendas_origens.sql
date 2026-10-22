-- Baviera Control · Encomendas BMW em três origens: Stock Aveiro, Stock Rede, Stock BMW (2026-10-22)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Cada ficheiro do portal BMW passa a ter a sua origem e substitui só as motas dessa origem.
-- As motas que já estão na tabela ficam como Stock Aveiro.
-- Stock Rede e Stock BMW não guardam o cliente nem o vendedor do outro concessionário:
-- a função limpa esses campos, mesmo que o browser os envie.

begin;

alter table public.encomendas_bmw add column if not exists origem      text not null default 'aveiro';
alter table public.encomendas_bmw add column if not exists dealer_num  text;
alter table public.encomendas_bmw add column if not exists dealer_nome text;
alter table public.encomendas_bmw add column if not exists regiao      text;

alter table public.encomendas_bmw drop constraint if exists encomendas_bmw_origem_check;
alter table public.encomendas_bmw add constraint encomendas_bmw_origem_check check (origem in ('aveiro', 'rede', 'bmw'));

-- a mesma mota pode aparecer em dois ficheiros: a chave passa a ser (origem, nº de produção)
do $$
begin
  if exists (select 1 from pg_constraint
              where conrelid = 'public.encomendas_bmw'::regclass and conname = 'encomendas_bmw_pkey'
                and array_length(conkey, 1) = 1) then
    alter table public.encomendas_bmw drop constraint encomendas_bmw_pkey;
    alter table public.encomendas_bmw add constraint encomendas_bmw_pkey primary key (origem, production_number);
  end if;
end $$;

drop function if exists public.encomendas_bmw_substituir(jsonb);

create or replace function public.encomendas_bmw_substituir(linhas jsonb, p_origem text default 'aveiro')
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_origem is null or p_origem not in ('aveiro', 'rede', 'bmw') then
    raise exception 'Origem desconhecida: %', p_origem;
  end if;
  if linhas is null or jsonb_typeof(linhas) <> 'array' or jsonb_array_length(linhas) = 0 then
    raise exception 'Ficheiro sem encomendas: o mapa atual fica como está';
  end if;
  delete from public.encomendas_bmw where origem = p_origem;
  insert into public.encomendas_bmw (origem, production_number, chassis, body_group, model_code, model_desc, color_code,
         options, order_status, ts_order_status, processing_type, actual_prod_date, conf_f3_from, conf_f3_to,
         customer_last, exp_del_wk, salesperson, dealer_num, dealer_nome, regiao)
  select p_origem, production_number, chassis, body_group, model_code, model_desc, color_code,
         options, order_status, ts_order_status, processing_type, actual_prod_date, conf_f3_from, conf_f3_to,
         case when p_origem = 'aveiro' then customer_last end,
         exp_del_wk,
         case when p_origem = 'aveiro' then salesperson end,
         dealer_num, dealer_nome, regiao
    from jsonb_to_recordset(linhas) as x(production_number text, chassis text, body_group text, model_code text,
         model_desc text, color_code text, options text, order_status text, ts_order_status date,
         processing_type text, actual_prod_date date, conf_f3_from date, conf_f3_to date,
         customer_last text, exp_del_wk text, salesperson text, dealer_num text, dealer_nome text, regiao text)
   where coalesce(production_number, '') <> '';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.encomendas_bmw_substituir(jsonb, text) from public, anon;
grant  execute on function public.encomendas_bmw_substituir(jsonb, text) to authenticated;

commit;
