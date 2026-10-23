-- Baviera Control · Stock Aveiro: lembrar o dia em que cada mota chegou a 193 e a 198 (2026-10-23)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- O ficheiro da BMW só traz a data do estado ATUAL: quando uma mota passa de 193 para 198, a data de 193 perde-se.
-- A partir de agora, cada carregamento do Stock Aveiro guarda a primeira data em que cada mota apareceu em 193 e
-- em 198 (nunca anda para a frente). A plataforma mostra "desde 193: x dias · desde 198: y dias".
-- Para as motas que hoje já estão em 198 não há data de 193 guardada: mostram só "desde 198".

begin;

create table if not exists public.encomendas_chegadas (
  production_number text primary key,
  data_193 date,
  data_198 date,
  atualizado_em timestamptz not null default now()
);

alter table public.encomendas_chegadas enable row level security;
revoke all on public.encomendas_chegadas from anon;
grant select on public.encomendas_chegadas to authenticated;

-- lê quem lê o stock (chefe e vendedores); ninguém escreve à mão: só o carregamento do ficheiro
drop policy if exists encomendas_chegadas_ler on public.encomendas_chegadas;
create policy encomendas_chegadas_ler on public.encomendas_chegadas for select to authenticated
  using (public.is_admin() or public.meu_role() = 'vendedor');

create or replace function public.encomendas_guardar_chegada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origem = 'aveiro' and new.ts_order_status is not null and trim(coalesce(new.order_status, '')) in ('193', '198') then
    insert into public.encomendas_chegadas as c (production_number, data_193, data_198)
    values (new.production_number,
            case when trim(new.order_status) = '193' then new.ts_order_status end,
            case when trim(new.order_status) = '198' then new.ts_order_status end)
    on conflict (production_number) do update
      set data_193 = least(c.data_193, excluded.data_193),   -- least ignora vazios: fica sempre a data mais antiga
          data_198 = least(c.data_198, excluded.data_198),
          atualizado_em = now();
  end if;
  return new;
end $$;
revoke execute on function public.encomendas_guardar_chegada() from public, anon, authenticated;

drop trigger if exists encomendas_guardar_chegada_trg on public.encomendas_bmw;
create trigger encomendas_guardar_chegada_trg after insert on public.encomendas_bmw
  for each row execute function public.encomendas_guardar_chegada();

-- o que já se sabe hoje, a partir do último ficheiro carregado
insert into public.encomendas_chegadas (production_number, data_193, data_198)
select production_number,
       case when trim(order_status) = '193' then ts_order_status end,
       case when trim(order_status) = '198' then ts_order_status end
  from public.encomendas_bmw
 where origem = 'aveiro' and ts_order_status is not null and trim(order_status) in ('193', '198')
on conflict (production_number) do nothing;

commit;
