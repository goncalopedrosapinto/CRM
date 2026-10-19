-- Baviera Control · Segurança fase 1: permissões (2026-10-18)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm).
-- Não apaga nem altera dados de negócio: só regras de acesso.
-- Tudo dentro de uma transação: se uma linha falhar, nada fica aplicado.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- [ALTA 1] Funções que mudam kms do stock sem verificar quem chama
--          (hoje qualquer pessoa com a chave pública da página as consegue correr)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.norma_vend_kms(p_id bigint, p_kms integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.meu_role(),'') not in ('admin','vendedor') then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_kms is null or p_kms < 0 or p_kms > 500000 then
    raise exception 'Kms inválidos';
  end if;
  update public.stock_norma set kms = p_kms, updated_at = now() where id = p_id;
end $$;

create or replace function public.stock_vend_kms(p_id bigint, p_kms integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.meu_role(),'') not in ('admin','vendedor') then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_kms is null or p_kms < 0 or p_kms > 500000 then
    raise exception 'Kms inválidos';
  end if;
  update public.stock_usadas set kms = p_kms, updated_at = now(), updated_by = auth.uid() where id = p_id;
end $$;

-- [MÉDIA] Estado das usadas: hoje secretário, assessor e financeiro também mudam.
create or replace function public.stock_mudar_estado(p_id bigint, p_estado text, p_assumir boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or coalesce(public.meu_role(),'') not in ('admin','vendedor') then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_estado not in ('Disponível','A negociar','Vendida') then
    raise exception 'Estado inválido';
  end if;
  update public.stock_usadas
     set estado = p_estado,
         negociado_por = case when p_estado = 'Disponível' then null
                              when p_assumir then v_uid else negociado_por end,
         updated_at = now(), updated_by = v_uid
   where id = p_id;
end $$;

-- Ninguém sem sessão corre funções que escrevem ou que revelam nomes.
revoke execute on function public.norma_vend_kms(bigint,integer)              from public, anon;
revoke execute on function public.stock_vend_kms(bigint,integer)              from public, anon;
revoke execute on function public.stock_mudar_estado(bigint,text,boolean)     from public, anon;
revoke execute on function public.inscricoes_ranking(bigint)                  from public, anon;
revoke execute on function public.com_mes_fechado(text)                       from public, anon;
grant  execute on function public.norma_vend_kms(bigint,integer)              to authenticated;
grant  execute on function public.stock_vend_kms(bigint,integer)              to authenticated;
grant  execute on function public.stock_mudar_estado(bigint,text,boolean)     to authenticated;
grant  execute on function public.inscricoes_ranking(bigint)                  to authenticated;
grant  execute on function public.com_mes_fechado(text)                       to authenticated;

-- Funções de trigger não são para chamar à mão (os triggers continuam a disparar).
revoke execute on function
  public.bc_mes1_validacao(), public.bc_recontactar(), public.eot_hist_autor(),
  public.eot_log_alteracoes(), public.eot_proteger(), public.equip_bloqueio_fecho(),
  public.handle_new_user(), public.log_status_change(), public.margens_bloqueio_fecho(),
  public.neg_log_alteracoes(), public.profiles_proteger_role(), public.touch_baviera_control(),
  public.touch_escala(), public.touch_nps()
from public, anon, authenticated;

-- [BAIXA] search_path fixo nas funções que não o tinham.
alter function public.bc_recontactar()        set search_path = public;
alter function public.eot_proteger()          set search_path = public;
alter function public.touch_baviera_control() set search_path = public;
alter function public.touch_escala()          set search_path = public;
alter function public.touch_nps()             set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- [ALTA 2] Contas novas entram como 'vendedor' automaticamente.
--          Passam a entrar sem acesso ('pendente') até o chefe definir o perfil
--          (Table Editor → profiles → role).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin','vendedor','assessor','secretario','financeiro','pendente']));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'pendente');
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Um 'pendente' não cria negócios nem lê os próprios (fecha o resto das portas).
drop policy if exists bc_insert on public.baviera_control;
create policy bc_insert on public.baviera_control for insert to authenticated
  with check (public.is_admin()
              or (vendedor_id = auth.uid() and public.meu_role() = 'vendedor'));

-- ─────────────────────────────────────────────────────────────────────────────
-- [ALTA 3] Vendedor apaga negócios vendidos → em cascata somem margens, ficha,
--          histórico e entregas (a prova da comissão).
--          Passa a apagar só o que nunca esteve em Carteira/Retail e não tem margem.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bc_ja_vendido(p_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.baviera_control where id = p_id and status in ('Retail','Carteira'))
      or exists (select 1 from public.status_historico where negocio_id = p_id and para in ('Retail','Carteira'))
      or exists (select 1 from public.margens        where negocio_id = p_id)
      or exists (select 1 from public.fichas_margem  where negocio_id = p_id);
$$;
revoke execute on function public.bc_ja_vendido(bigint) from public, anon;
grant  execute on function public.bc_ja_vendido(bigint) to authenticated;

drop policy if exists bc_delete on public.baviera_control;
create policy bc_delete on public.baviera_control for delete to authenticated
  using (public.is_admin()
         or (vendedor_id = auth.uid() and not public.bc_ja_vendido(id)));

-- ─────────────────────────────────────────────────────────────────────────────
-- [MÉDIA] Observação do chefe: o vendedor vê (é de propósito), mas hoje também
--         a consegue reescrever pela API. Passa a ser só de leitura para ele.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bc_proteger_obs_gestor()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.obs_gestor := null;
  else new.obs_gestor := old.obs_gestor; end if;
  return new;
end $$;
revoke execute on function public.bc_proteger_obs_gestor() from public, anon, authenticated;
drop trigger if exists bc_proteger_obs_gestor on public.baviera_control;
create trigger bc_proteger_obs_gestor before insert or update on public.baviera_control
  for each row execute function public.bc_proteger_obs_gestor();

-- ─────────────────────────────────────────────────────────────────────────────
-- [MÉDIA] Vendedor lê as margens de todos. Passa a ler só as dos seus negócios.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists margens_ler on public.margens;
create policy margens_ler on public.margens for select to authenticated
  using (public.is_admin()
         or (public.meu_role() = 'vendedor'
             and exists (select 1 from public.baviera_control b
                          where b.id = margens.negocio_id and b.vendedor_id = auth.uid())));

-- ─────────────────────────────────────────────────────────────────────────────
-- [MÉDIA] Vistas: a de demos não tinha filtro (anónimos liam 14 motas com matrícula).
--         As vistas continuam a correr como dono (é isso que deixa o secretário
--         ver só algumas colunas), mas anónimos deixam de lhes chegar.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.stock_norma_publico as
  select id, ordem, modelo, estado, matricula, data_matricula, kms, tem_seguro
    from public.stock_norma
   where public.meu_role() = any (array['admin','vendedor']);

revoke all on public.stock_norma_publico, public.stock_usadas_publico, public.entregas_publico,
              public.inscricoes_publico, public.negocios_secretaria from anon;

-- [BAIXA] Eventos legíveis sem sessão.
drop policy if exists eventos_select on public.eventos;
create policy eventos_select on public.eventos for select to authenticated using (true);

-- [MÉDIA] Defesa em profundidade: o perfil anónimo tinha todos os privilégios em todas as
--         tabelas (incluindo TRUNCATE), travado só pelas regras RLS. A plataforma nunca
--         lê dados antes do login, por isso o anónimo deixa de ter acesso a qualquer tabela.
--         Se um dia uma regra RLS ficar mal escrita, o anónimo continua sem ver nada.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
-- Utilizadores com sessão também não precisam de TRUNCATE/TRIGGER/REFERENCES.
revoke truncate, trigger, references on all tables in schema public from authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- Depois de correr: no Dashboard
--  1. Authentication → Sign In / Providers → "Allow new users to sign up": DESLIGADO.
--  2. Authentication → Attack Protection → "Leaked password protection": LIGADO.
--  3. Advisors → Security → Rerun. Ficam de propósito 5 avisos "Security Definer View"
--     (as vistas filtram por perfil; trocá-las cortava o acesso do secretário).
-- ─────────────────────────────────────────────────────────────────────────────
