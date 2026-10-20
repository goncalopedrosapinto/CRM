-- Baviera Control · Áreas extra por utilizador (2026-10-20)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm).
--
-- profiles.areas = áreas que o utilizador tem além do seu perfil principal:
--   'secretaria'  vê a Secretaria comercial (ex.: Diana, assessora + secretaria)
--   'previsao'    tem a página "Previsão do mês" como página principal (ex.: João Duarte)
-- Só o chefe (ou o SQL Editor) muda esta coluna.

begin;

alter table public.profiles add column if not exists areas text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_areas_check;
alter table public.profiles add constraint profiles_areas_check
  check (areas <@ array['secretaria','previsao']::text[]);

-- Ninguém se dá áreas a si próprio.
create or replace function public.profiles_proteger_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.role := old.role; new.linha := old.linha; new.id := old.id;
    new.financeiro := old.financeiro; new.areas := old.areas;
  end if;
  return new;
end $$;

create or replace function public.is_secretaria()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                  where id = auth.uid() and (role = 'secretario' or 'secretaria' = any(areas)));
$$;
revoke execute on function public.is_secretaria() from public, anon;
grant  execute on function public.is_secretaria() to authenticated;

-- As vistas da secretaria passam a aceitar também quem tem a área 'secretaria'.
create or replace view public.negocios_secretaria as
  select id, status, type, vendedor_id, id_cliente, nif, morada, email, contacto, model, version,
         mat, chas, enc, col_298, mes1, neg, dmat, biz, fin, retoma, retoma_modelo, retoma_mat,
         pvp, gar, gar_periodo, venda_direta, automatricula, obs
    from public.baviera_control
   where status = any (array['Retail','Carteira'])
     and (public.meu_role() = 'admin' or public.is_secretaria());

create or replace view public.entregas_publico as
  select negocio_id, docs, pedido_matricula, prep_pedida, pecas_precisa, pecas_chegaram,
         pecas_obs, pago, fs_tratado, data_entrega
    from public.entregas
   where public.meu_role() = any (array['admin','vendedor','secretario']) or public.is_secretaria();

revoke all on public.negocios_secretaria, public.entregas_publico from anon;

-- Atribuições pedidas pelo chefe de vendas.
update public.profiles set areas = array['previsao']   where id = '3ae849ef-7fa0-4621-8fca-1dab54a19009'; -- João Duarte
update public.profiles set areas = array['secretaria'] where id = 'f4ce141b-0478-434e-8493-fa0d481ec06b'; -- Diana Silva

commit;
