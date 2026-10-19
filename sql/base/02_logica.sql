-- Funções, vistas, regras RLS, triggers e permissões tal como estavam em produção a 2026-10-19 (lido do Supabase, sem dados).
CREATE OR REPLACE FUNCTION public.bc_mes1_validacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.bc_recontactar()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.status = 'Perdido' and (tg_op = 'INSERT' or old.status is distinct from 'Perdido') then
    -- sempre que um negócio (volta a) passar a Perdido, conta 6 meses a partir de hoje
    if new.recontactar_em is null or (tg_op = 'UPDATE' and new.recontactar_em is not distinct from old.recontactar_em) then
      new.recontactar_em := (now() + interval '6 months')::date;
    end if;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.com_mes_fechado(p_mes text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.comissoes_fecho where mes = p_mes);
$function$
;
CREATE OR REPLACE FUNCTION public.eot_hist_autor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null then
    new.autor_id := auth.uid();
    select p.nome, case when p.financeiro and p.role <> 'admin' then 'financeiro' else p.role end
      into new.autor_nome, new.autor_role
      from public.profiles p where p.id = auth.uid();
  end if;
  new.criado_em := now();
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.eot_log_alteracoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k text; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
  imp boolean := new.ultima_import is distinct from old.ultima_import;
begin
  for k in select jsonb_object_keys(n) loop
    continue when k in ('updated_at','ultima_import','criado_em','saiu_em','contrato');
    continue when imp and k <> 'no_mapa';
    if (o -> k) is distinct from (n -> k) then
      insert into public.eot_historico (contrato, tipo, campo, valor_antes, valor_depois)
      values (new.contrato, case when imp then 'sistema' else 'alteracao' end, k, o ->> k, n ->> k);
    end if;
  end loop;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.eot_proteger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare r public.eot_contratos;
begin
  if public.is_admin() or public.is_financeiro() then return new; end if;
  r := old;
  r.fase := new.fase; r.temperatura := new.temperatura;
  r.proxima_acao := new.proxima_acao; r.proxima_data := new.proxima_data;
  r.notas := new.notas; r.negocio_id := new.negocio_id; r.updated_at := now();
  return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.equip_bloqueio_fecho()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, nome, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'vendedor');
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.inscricoes_ranking(p_evento bigint)
 RETURNS TABLE(vendedor_id uuid, nome text, total bigint, acompanhantes bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select i.vendedor_id, p.nome, count(*)::bigint,
         coalesce(sum(i.acompanhantes),0)::bigint
  from inscricoes i join profiles p on p.id = i.vendedor_id
  where i.evento_id = p_evento and i.estado <> 'Cancelado'
  group by i.vendedor_id, p.nome
  order by count(*) desc;
$function$
;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_financeiro()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and (role = 'financeiro' or financeiro));
$function$
;
CREATE OR REPLACE FUNCTION public.log_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (tg_op='INSERT') then
    insert into status_historico(negocio_id,de,para,quem,quando)
    values (new.id, null, new.status, auth.uid(), now());
  elsif (tg_op='UPDATE' and new.status is distinct from old.status) then
    insert into status_historico(negocio_id,de,para,quem,quando)
    values (new.id, old.status, new.status, auth.uid(), now());
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.margens_bloqueio_fecho()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m text;
begin
  select to_char(b.col_298,'YYYY/MM') into m
    from public.baviera_control b where b.id = coalesce(new.negocio_id, old.negocio_id);
  if public.com_mes_fechado(m) then
    raise exception 'Comissões de % já lançadas — o chefe tem de desbloquear o mês.', m;
  end if;
  return coalesce(new, old);
end $function$
;
CREATE OR REPLACE FUNCTION public.meu_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT role FROM public.profiles WHERE id = auth.uid() $function$
;
CREATE OR REPLACE FUNCTION public.my_linha()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select linha from public.profiles where id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.neg_log_alteracoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.norma_vend_kms(p_id bigint, p_kms integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update stock_norma set kms=p_kms, updated_at=now() where id=p_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.profiles_proteger_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.role := old.role; new.linha := old.linha; new.id := old.id; new.financeiro := old.financeiro;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.stock_mudar_estado(p_id bigint, p_estado text, p_assumir boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;
  if p_estado not in ('Disponível','A negociar','Vendida') then
    raise exception 'Estado inválido';
  end if;

  update public.stock_usadas
  set estado = p_estado,
      -- Se assumir, o negociador passa a ser o próprio; se voltar a Disponível, limpa
      negociado_por = case
        when p_estado = 'Disponível' then null
        when p_assumir then v_uid
        else negociado_por
      end,
      updated_at = now(),
      updated_by = v_uid
  where id = p_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.stock_vend_kms(p_id bigint, p_kms integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update stock_usadas set kms=p_kms, updated_at=now() where id=p_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.touch_baviera_control()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_escala()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at:=now(); new.updated_by:=auth.uid(); return new; end; $function$
;
CREATE OR REPLACE FUNCTION public.touch_nps()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end; $function$
;
create or replace view public.entregas_publico as  SELECT negocio_id,
    docs,
    pedido_matricula,
    prep_pedida,
    pecas_precisa,
    pecas_chegaram,
    pecas_obs,
    pago,
    fs_tratado,
    data_entrega
   FROM entregas
  WHERE (meu_role() = ANY (ARRAY['admin'::text, 'vendedor'::text, 'secretario'::text]));
create or replace view public.inscricoes_publico as  SELECT id,
    evento_id,
    cliente,
    mota,
    vendedor_id,
    estado,
    funil,
    acompanhantes,
    created_at
   FROM inscricoes
  WHERE (meu_role() = ANY (ARRAY['admin'::text, 'vendedor'::text]));
create or replace view public.negocios_secretaria as  SELECT id,
    status,
    type,
    vendedor_id,
    id_cliente,
    nif,
    morada,
    email,
    contacto,
    model,
    version,
    mat,
    chas,
    enc,
    col_298,
    mes1,
    neg,
    dmat,
    biz,
    fin,
    retoma,
    retoma_modelo,
    retoma_mat,
    pvp,
    gar,
    gar_periodo,
    venda_direta,
    automatricula,
    obs
   FROM baviera_control
  WHERE ((status = ANY (ARRAY['Retail'::text, 'Carteira'::text])) AND (meu_role() = ANY (ARRAY['admin'::text, 'secretario'::text])));
create or replace view public.stock_norma_publico with (security_invoker=false) as  SELECT id,
    ordem,
    modelo,
    estado,
    matricula,
    data_matricula,
    kms,
    tem_seguro
   FROM stock_norma;
create or replace view public.stock_usadas_publico as  SELECT id,
    modelo,
    maxterauto,
    estado,
    negociado_por,
    created_at,
    categoria,
    kms,
    matricula,
    valor_anunciado,
    valor_campanha,
    tem_seguro,
    valor_min,
    ano
   FROM stock_usadas
  WHERE (meu_role() = ANY (ARRAY['admin'::text, 'vendedor'::text]));
create policy bc_delete on public.baviera_control as PERMISSIVE for DELETE to public using (((vendedor_id = auth.uid()) OR is_admin()));
create policy bc_insert on public.baviera_control as PERMISSIVE for INSERT to public with check (((vendedor_id = auth.uid()) OR is_admin()));
create policy bc_select on public.baviera_control as PERMISSIVE for SELECT to public using (((vendedor_id = auth.uid()) OR is_admin()));
create policy bc_update on public.baviera_control as PERMISSIVE for UPDATE to public using (((vendedor_id = auth.uid()) OR is_admin()));
create policy fecho_admin on public.comissoes_fecho as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy fecho_ler on public.comissoes_fecho as PERMISSIVE for SELECT to authenticated using (true);
create policy comissoes_admin on public.comissoes as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy entregas_admin on public.entregas as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy eot_admin_all on public.eot_contratos as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy eot_fin_sel on public.eot_contratos as PERMISSIVE for SELECT to public using (is_financeiro());
create policy eot_fin_upd on public.eot_contratos as PERMISSIVE for UPDATE to public using (is_financeiro()) with check (is_financeiro());
create policy eot_vend_sel on public.eot_contratos as PERMISSIVE for SELECT to authenticated using ((responsavel_id = auth.uid()));
create policy eot_vend_upd on public.eot_contratos as PERMISSIVE for UPDATE to authenticated using ((responsavel_id = auth.uid())) with check ((responsavel_id = auth.uid()));
create policy eot_hist_com on public.eot_historico as PERMISSIVE for INSERT to public with check (((tipo = 'comentario'::text) AND (length(TRIM(BOTH FROM COALESCE(texto, ''::text))) > 0) AND (is_admin() OR is_financeiro() OR (EXISTS ( SELECT 1
   FROM eot_contratos c
  WHERE ((c.contrato = eot_historico.contrato) AND (c.responsavel_id = auth.uid())))))));
create policy eot_hist_sel on public.eot_historico as PERMISSIVE for SELECT to public using ((is_admin() OR is_financeiro() OR (EXISTS ( SELECT 1
   FROM eot_contratos c
  WHERE ((c.contrato = eot_historico.contrato) AND (c.responsavel_id = auth.uid()))))));
create policy equip_admin on public.equipamento as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy equip_assessor_inserir on public.equipamento as PERMISSIVE for INSERT to authenticated with check (((vendedor_id = auth.uid()) AND (meu_role() = 'assessor'::text)));
create policy equip_vend_inserir on public.equipamento as PERMISSIVE for INSERT to authenticated with check (((vendedor_id = auth.uid()) AND (meu_role() = 'vendedor'::text)));
create policy equip_vend_ler on public.equipamento as PERMISSIVE for SELECT to authenticated using ((vendedor_id = auth.uid()));
create policy escala_admin_all on public.escala as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy escala_select on public.escala as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy eventos_admin_all on public.eventos as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy eventos_select on public.eventos as PERMISSIVE for SELECT to public using (true);
create policy fichas_acesso on public.fichas_margem as PERMISSIVE for ALL to authenticated using ((is_admin() OR (EXISTS ( SELECT 1
   FROM baviera_control b
  WHERE ((b.id = fichas_margem.negocio_id) AND (b.vendedor_id = auth.uid())))))) with check ((is_admin() OR (EXISTS ( SELECT 1
   FROM baviera_control b
  WHERE ((b.id = fichas_margem.negocio_id) AND (b.vendedor_id = auth.uid()))))));
create policy insc_admin_all on public.inscricoes as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy insc_own_delete on public.inscricoes as PERMISSIVE for DELETE to public using ((vendedor_id = auth.uid()));
create policy insc_own_insert on public.inscricoes as PERMISSIVE for INSERT to public with check ((vendedor_id = auth.uid()));
create policy insc_own_select on public.inscricoes as PERMISSIVE for SELECT to public using ((vendedor_id = auth.uid()));
create policy insc_own_update on public.inscricoes as PERMISSIVE for UPDATE to public using ((vendedor_id = auth.uid())) with check ((vendedor_id = auth.uid()));
create policy margens_escrever on public.margens as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy margens_ler on public.margens as PERMISSIVE for SELECT to authenticated using ((meu_role() = ANY (ARRAY['admin'::text, 'vendedor'::text])));
create policy neg_hist_com on public.negocio_historico as PERMISSIVE for INSERT to public with check (((tipo = 'comentario'::text) AND (length(TRIM(BOTH FROM COALESCE(texto, ''::text))) > 0) AND (is_admin() OR (EXISTS ( SELECT 1
   FROM baviera_control b
  WHERE ((b.id = negocio_historico.negocio_id) AND (b.vendedor_id = auth.uid())))))));
create policy neg_hist_sel on public.negocio_historico as PERMISSIVE for SELECT to public using ((is_admin() OR (EXISTS ( SELECT 1
   FROM baviera_control b
  WHERE ((b.id = negocio_historico.negocio_id) AND (b.vendedor_id = auth.uid()))))));
create policy nps_admin_all on public.nps as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy nps_select on public.nps as PERMISSIVE for SELECT to public using (((vendedor_id = auth.uid()) OR is_admin()));
create policy objeq_admin_all on public.objetivos_equipa as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy obj_admin_all on public.objetivos as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy obj_select on public.objetivos as PERMISSIVE for SELECT to public using (((vendedor_id = auth.uid()) OR is_admin()));
create policy precos_ref_admin on public.precos_ref as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy precos_ref_ler on public.precos_ref as PERMISSIVE for SELECT to authenticated using ((meu_role() = ANY (ARRAY['vendedor'::text, 'assessor'::text])));
create policy premios_admin on public.premios_config as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy premios_mes_admin on public.premios_mes as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy profiles_select on public.profiles as PERMISSIVE for SELECT to public using (((id = auth.uid()) OR is_admin() OR (linha = my_linha())));
create policy profiles_update_own on public.profiles as PERMISSIVE for UPDATE to public using ((id = auth.uid()));
create policy sh_admin_all on public.status_historico as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy slog_select on public.status_log as PERMISSIVE for SELECT to public using (((EXISTS ( SELECT 1
   FROM baviera_control bc
  WHERE ((bc.id = status_log.registo_id) AND (bc.vendedor_id = auth.uid())))) OR is_admin()));
create policy stock_equip_admin on public.stock_equip as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy stock_equip_ler on public.stock_equip as PERMISSIVE for SELECT to authenticated using ((meu_role() = ANY (ARRAY['vendedor'::text, 'assessor'::text])));
create policy norma_admin_all on public.stock_norma as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
create policy stock_admin_only on public.stock_usadas as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
CREATE TRIGGER baviera_control_touch BEFORE UPDATE ON public.baviera_control FOR EACH ROW EXECUTE FUNCTION touch_baviera_control();
CREATE TRIGGER bc_mes1_validacao_trg BEFORE INSERT OR UPDATE ON public.baviera_control FOR EACH ROW EXECUTE FUNCTION bc_mes1_validacao();
CREATE TRIGGER bc_recontactar_trg BEFORE INSERT OR UPDATE ON public.baviera_control FOR EACH ROW EXECUTE FUNCTION bc_recontactar();
CREATE TRIGGER eot_hist_autor_trg BEFORE INSERT ON public.eot_historico FOR EACH ROW EXECUTE FUNCTION eot_hist_autor();
CREATE TRIGGER eot_log_trg AFTER UPDATE ON public.eot_contratos FOR EACH ROW EXECUTE FUNCTION eot_log_alteracoes();
CREATE TRIGGER eot_proteger_trg BEFORE UPDATE ON public.eot_contratos FOR EACH ROW EXECUTE FUNCTION eot_proteger();
CREATE TRIGGER equip_bloqueio_fecho BEFORE INSERT OR DELETE OR UPDATE ON public.equipamento FOR EACH ROW EXECUTE FUNCTION equip_bloqueio_fecho();
CREATE TRIGGER escala_touch BEFORE UPDATE ON public.escala FOR EACH ROW EXECUTE FUNCTION touch_escala();
CREATE TRIGGER margens_bloqueio_fecho BEFORE INSERT OR DELETE OR UPDATE ON public.margens FOR EACH ROW EXECUTE FUNCTION margens_bloqueio_fecho();
CREATE TRIGGER neg_hist_autor_trg BEFORE INSERT ON public.negocio_historico FOR EACH ROW EXECUTE FUNCTION eot_hist_autor();
CREATE TRIGGER neg_log_trg AFTER INSERT OR UPDATE ON public.baviera_control FOR EACH ROW EXECUTE FUNCTION neg_log_alteracoes();
CREATE TRIGGER nps_touch BEFORE UPDATE ON public.nps FOR EACH ROW EXECUTE FUNCTION touch_nps();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER profiles_proteger_role_trg BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_proteger_role();
CREATE TRIGGER trg_log_status AFTER INSERT OR UPDATE OF status ON public.baviera_control FOR EACH ROW EXECUTE FUNCTION log_status_change();
grant DELETE on public.baviera_control to anon;
grant INSERT on public.baviera_control to anon;
grant REFERENCES on public.baviera_control to anon;
grant SELECT on public.baviera_control to anon;
grant TRIGGER on public.baviera_control to anon;
grant TRUNCATE on public.baviera_control to anon;
grant UPDATE on public.baviera_control to anon;
grant DELETE on public.baviera_control to authenticated;
grant INSERT on public.baviera_control to authenticated;
grant REFERENCES on public.baviera_control to authenticated;
grant SELECT on public.baviera_control to authenticated;
grant TRIGGER on public.baviera_control to authenticated;
grant TRUNCATE on public.baviera_control to authenticated;
grant UPDATE on public.baviera_control to authenticated;
grant DELETE on public.comissoes_fecho to anon;
grant INSERT on public.comissoes_fecho to anon;
grant REFERENCES on public.comissoes_fecho to anon;
grant SELECT on public.comissoes_fecho to anon;
grant TRIGGER on public.comissoes_fecho to anon;
grant TRUNCATE on public.comissoes_fecho to anon;
grant UPDATE on public.comissoes_fecho to anon;
grant DELETE on public.comissoes_fecho to authenticated;
grant INSERT on public.comissoes_fecho to authenticated;
grant REFERENCES on public.comissoes_fecho to authenticated;
grant SELECT on public.comissoes_fecho to authenticated;
grant TRIGGER on public.comissoes_fecho to authenticated;
grant TRUNCATE on public.comissoes_fecho to authenticated;
grant UPDATE on public.comissoes_fecho to authenticated;
grant DELETE on public.comissoes to anon;
grant INSERT on public.comissoes to anon;
grant REFERENCES on public.comissoes to anon;
grant SELECT on public.comissoes to anon;
grant TRIGGER on public.comissoes to anon;
grant TRUNCATE on public.comissoes to anon;
grant UPDATE on public.comissoes to anon;
grant DELETE on public.comissoes to authenticated;
grant INSERT on public.comissoes to authenticated;
grant REFERENCES on public.comissoes to authenticated;
grant SELECT on public.comissoes to authenticated;
grant TRIGGER on public.comissoes to authenticated;
grant TRUNCATE on public.comissoes to authenticated;
grant UPDATE on public.comissoes to authenticated;
grant DELETE on public.entregas_publico to anon;
grant INSERT on public.entregas_publico to anon;
grant REFERENCES on public.entregas_publico to anon;
grant SELECT on public.entregas_publico to anon;
grant TRIGGER on public.entregas_publico to anon;
grant TRUNCATE on public.entregas_publico to anon;
grant UPDATE on public.entregas_publico to anon;
grant DELETE on public.entregas_publico to authenticated;
grant INSERT on public.entregas_publico to authenticated;
grant REFERENCES on public.entregas_publico to authenticated;
grant SELECT on public.entregas_publico to authenticated;
grant TRIGGER on public.entregas_publico to authenticated;
grant TRUNCATE on public.entregas_publico to authenticated;
grant UPDATE on public.entregas_publico to authenticated;
grant DELETE on public.entregas to anon;
grant INSERT on public.entregas to anon;
grant REFERENCES on public.entregas to anon;
grant SELECT on public.entregas to anon;
grant TRIGGER on public.entregas to anon;
grant TRUNCATE on public.entregas to anon;
grant UPDATE on public.entregas to anon;
grant DELETE on public.entregas to authenticated;
grant INSERT on public.entregas to authenticated;
grant REFERENCES on public.entregas to authenticated;
grant SELECT on public.entregas to authenticated;
grant TRIGGER on public.entregas to authenticated;
grant TRUNCATE on public.entregas to authenticated;
grant UPDATE on public.entregas to authenticated;
grant DELETE on public.eot_contratos to anon;
grant INSERT on public.eot_contratos to anon;
grant REFERENCES on public.eot_contratos to anon;
grant SELECT on public.eot_contratos to anon;
grant TRIGGER on public.eot_contratos to anon;
grant TRUNCATE on public.eot_contratos to anon;
grant UPDATE on public.eot_contratos to anon;
grant DELETE on public.eot_contratos to authenticated;
grant INSERT on public.eot_contratos to authenticated;
grant REFERENCES on public.eot_contratos to authenticated;
grant SELECT on public.eot_contratos to authenticated;
grant TRIGGER on public.eot_contratos to authenticated;
grant TRUNCATE on public.eot_contratos to authenticated;
grant UPDATE on public.eot_contratos to authenticated;
grant DELETE on public.eot_historico to anon;
grant INSERT on public.eot_historico to anon;
grant REFERENCES on public.eot_historico to anon;
grant SELECT on public.eot_historico to anon;
grant TRIGGER on public.eot_historico to anon;
grant TRUNCATE on public.eot_historico to anon;
grant UPDATE on public.eot_historico to anon;
grant DELETE on public.eot_historico to authenticated;
grant INSERT on public.eot_historico to authenticated;
grant REFERENCES on public.eot_historico to authenticated;
grant SELECT on public.eot_historico to authenticated;
grant TRIGGER on public.eot_historico to authenticated;
grant TRUNCATE on public.eot_historico to authenticated;
grant UPDATE on public.eot_historico to authenticated;
grant DELETE on public.equipamento to anon;
grant INSERT on public.equipamento to anon;
grant REFERENCES on public.equipamento to anon;
grant SELECT on public.equipamento to anon;
grant TRIGGER on public.equipamento to anon;
grant TRUNCATE on public.equipamento to anon;
grant UPDATE on public.equipamento to anon;
grant DELETE on public.equipamento to authenticated;
grant INSERT on public.equipamento to authenticated;
grant REFERENCES on public.equipamento to authenticated;
grant SELECT on public.equipamento to authenticated;
grant TRIGGER on public.equipamento to authenticated;
grant TRUNCATE on public.equipamento to authenticated;
grant UPDATE on public.equipamento to authenticated;
grant DELETE on public.escala to anon;
grant INSERT on public.escala to anon;
grant REFERENCES on public.escala to anon;
grant SELECT on public.escala to anon;
grant TRIGGER on public.escala to anon;
grant TRUNCATE on public.escala to anon;
grant UPDATE on public.escala to anon;
grant DELETE on public.escala to authenticated;
grant INSERT on public.escala to authenticated;
grant REFERENCES on public.escala to authenticated;
grant SELECT on public.escala to authenticated;
grant TRIGGER on public.escala to authenticated;
grant TRUNCATE on public.escala to authenticated;
grant UPDATE on public.escala to authenticated;
grant DELETE on public.eventos to anon;
grant INSERT on public.eventos to anon;
grant REFERENCES on public.eventos to anon;
grant SELECT on public.eventos to anon;
grant TRIGGER on public.eventos to anon;
grant TRUNCATE on public.eventos to anon;
grant UPDATE on public.eventos to anon;
grant DELETE on public.eventos to authenticated;
grant INSERT on public.eventos to authenticated;
grant REFERENCES on public.eventos to authenticated;
grant SELECT on public.eventos to authenticated;
grant TRIGGER on public.eventos to authenticated;
grant TRUNCATE on public.eventos to authenticated;
grant UPDATE on public.eventos to authenticated;
grant DELETE on public.fichas_margem to anon;
grant INSERT on public.fichas_margem to anon;
grant REFERENCES on public.fichas_margem to anon;
grant SELECT on public.fichas_margem to anon;
grant TRIGGER on public.fichas_margem to anon;
grant TRUNCATE on public.fichas_margem to anon;
grant UPDATE on public.fichas_margem to anon;
grant DELETE on public.fichas_margem to authenticated;
grant INSERT on public.fichas_margem to authenticated;
grant REFERENCES on public.fichas_margem to authenticated;
grant SELECT on public.fichas_margem to authenticated;
grant TRIGGER on public.fichas_margem to authenticated;
grant TRUNCATE on public.fichas_margem to authenticated;
grant UPDATE on public.fichas_margem to authenticated;
grant DELETE on public.inscricoes_publico to anon;
grant INSERT on public.inscricoes_publico to anon;
grant REFERENCES on public.inscricoes_publico to anon;
grant SELECT on public.inscricoes_publico to anon;
grant TRIGGER on public.inscricoes_publico to anon;
grant TRUNCATE on public.inscricoes_publico to anon;
grant UPDATE on public.inscricoes_publico to anon;
grant DELETE on public.inscricoes_publico to authenticated;
grant INSERT on public.inscricoes_publico to authenticated;
grant REFERENCES on public.inscricoes_publico to authenticated;
grant SELECT on public.inscricoes_publico to authenticated;
grant TRIGGER on public.inscricoes_publico to authenticated;
grant TRUNCATE on public.inscricoes_publico to authenticated;
grant UPDATE on public.inscricoes_publico to authenticated;
grant DELETE on public.inscricoes to anon;
grant INSERT on public.inscricoes to anon;
grant REFERENCES on public.inscricoes to anon;
grant SELECT on public.inscricoes to anon;
grant TRIGGER on public.inscricoes to anon;
grant TRUNCATE on public.inscricoes to anon;
grant UPDATE on public.inscricoes to anon;
grant DELETE on public.inscricoes to authenticated;
grant INSERT on public.inscricoes to authenticated;
grant REFERENCES on public.inscricoes to authenticated;
grant SELECT on public.inscricoes to authenticated;
grant TRIGGER on public.inscricoes to authenticated;
grant TRUNCATE on public.inscricoes to authenticated;
grant UPDATE on public.inscricoes to authenticated;
grant DELETE on public.margens to anon;
grant INSERT on public.margens to anon;
grant REFERENCES on public.margens to anon;
grant SELECT on public.margens to anon;
grant TRIGGER on public.margens to anon;
grant TRUNCATE on public.margens to anon;
grant UPDATE on public.margens to anon;
grant DELETE on public.margens to authenticated;
grant INSERT on public.margens to authenticated;
grant REFERENCES on public.margens to authenticated;
grant SELECT on public.margens to authenticated;
grant TRIGGER on public.margens to authenticated;
grant TRUNCATE on public.margens to authenticated;
grant UPDATE on public.margens to authenticated;
grant DELETE on public.negocio_historico to anon;
grant INSERT on public.negocio_historico to anon;
grant REFERENCES on public.negocio_historico to anon;
grant SELECT on public.negocio_historico to anon;
grant TRIGGER on public.negocio_historico to anon;
grant TRUNCATE on public.negocio_historico to anon;
grant UPDATE on public.negocio_historico to anon;
grant DELETE on public.negocio_historico to authenticated;
grant INSERT on public.negocio_historico to authenticated;
grant REFERENCES on public.negocio_historico to authenticated;
grant SELECT on public.negocio_historico to authenticated;
grant TRIGGER on public.negocio_historico to authenticated;
grant TRUNCATE on public.negocio_historico to authenticated;
grant UPDATE on public.negocio_historico to authenticated;
grant DELETE on public.negocios_secretaria to anon;
grant INSERT on public.negocios_secretaria to anon;
grant REFERENCES on public.negocios_secretaria to anon;
grant SELECT on public.negocios_secretaria to anon;
grant TRIGGER on public.negocios_secretaria to anon;
grant TRUNCATE on public.negocios_secretaria to anon;
grant UPDATE on public.negocios_secretaria to anon;
grant DELETE on public.negocios_secretaria to authenticated;
grant INSERT on public.negocios_secretaria to authenticated;
grant REFERENCES on public.negocios_secretaria to authenticated;
grant SELECT on public.negocios_secretaria to authenticated;
grant TRIGGER on public.negocios_secretaria to authenticated;
grant TRUNCATE on public.negocios_secretaria to authenticated;
grant UPDATE on public.negocios_secretaria to authenticated;
grant DELETE on public.nps to anon;
grant INSERT on public.nps to anon;
grant REFERENCES on public.nps to anon;
grant SELECT on public.nps to anon;
grant TRIGGER on public.nps to anon;
grant TRUNCATE on public.nps to anon;
grant UPDATE on public.nps to anon;
grant DELETE on public.nps to authenticated;
grant INSERT on public.nps to authenticated;
grant REFERENCES on public.nps to authenticated;
grant SELECT on public.nps to authenticated;
grant TRIGGER on public.nps to authenticated;
grant TRUNCATE on public.nps to authenticated;
grant UPDATE on public.nps to authenticated;
grant DELETE on public.objetivos_equipa to anon;
grant INSERT on public.objetivos_equipa to anon;
grant REFERENCES on public.objetivos_equipa to anon;
grant SELECT on public.objetivos_equipa to anon;
grant TRIGGER on public.objetivos_equipa to anon;
grant TRUNCATE on public.objetivos_equipa to anon;
grant UPDATE on public.objetivos_equipa to anon;
grant DELETE on public.objetivos_equipa to authenticated;
grant INSERT on public.objetivos_equipa to authenticated;
grant REFERENCES on public.objetivos_equipa to authenticated;
grant SELECT on public.objetivos_equipa to authenticated;
grant TRIGGER on public.objetivos_equipa to authenticated;
grant TRUNCATE on public.objetivos_equipa to authenticated;
grant UPDATE on public.objetivos_equipa to authenticated;
grant DELETE on public.objetivos to anon;
grant INSERT on public.objetivos to anon;
grant REFERENCES on public.objetivos to anon;
grant SELECT on public.objetivos to anon;
grant TRIGGER on public.objetivos to anon;
grant TRUNCATE on public.objetivos to anon;
grant UPDATE on public.objetivos to anon;
grant DELETE on public.objetivos to authenticated;
grant INSERT on public.objetivos to authenticated;
grant REFERENCES on public.objetivos to authenticated;
grant SELECT on public.objetivos to authenticated;
grant TRIGGER on public.objetivos to authenticated;
grant TRUNCATE on public.objetivos to authenticated;
grant UPDATE on public.objetivos to authenticated;
grant DELETE on public.precos_ref to anon;
grant INSERT on public.precos_ref to anon;
grant REFERENCES on public.precos_ref to anon;
grant SELECT on public.precos_ref to anon;
grant TRIGGER on public.precos_ref to anon;
grant TRUNCATE on public.precos_ref to anon;
grant UPDATE on public.precos_ref to anon;
grant DELETE on public.precos_ref to authenticated;
grant INSERT on public.precos_ref to authenticated;
grant REFERENCES on public.precos_ref to authenticated;
grant SELECT on public.precos_ref to authenticated;
grant TRIGGER on public.precos_ref to authenticated;
grant TRUNCATE on public.precos_ref to authenticated;
grant UPDATE on public.precos_ref to authenticated;
grant DELETE on public.premios_config to anon;
grant INSERT on public.premios_config to anon;
grant REFERENCES on public.premios_config to anon;
grant SELECT on public.premios_config to anon;
grant TRIGGER on public.premios_config to anon;
grant TRUNCATE on public.premios_config to anon;
grant UPDATE on public.premios_config to anon;
grant DELETE on public.premios_config to authenticated;
grant INSERT on public.premios_config to authenticated;
grant REFERENCES on public.premios_config to authenticated;
grant SELECT on public.premios_config to authenticated;
grant TRIGGER on public.premios_config to authenticated;
grant TRUNCATE on public.premios_config to authenticated;
grant UPDATE on public.premios_config to authenticated;
grant DELETE on public.premios_mes to anon;
grant INSERT on public.premios_mes to anon;
grant REFERENCES on public.premios_mes to anon;
grant SELECT on public.premios_mes to anon;
grant TRIGGER on public.premios_mes to anon;
grant TRUNCATE on public.premios_mes to anon;
grant UPDATE on public.premios_mes to anon;
grant DELETE on public.premios_mes to authenticated;
grant INSERT on public.premios_mes to authenticated;
grant REFERENCES on public.premios_mes to authenticated;
grant SELECT on public.premios_mes to authenticated;
grant TRIGGER on public.premios_mes to authenticated;
grant TRUNCATE on public.premios_mes to authenticated;
grant UPDATE on public.premios_mes to authenticated;
grant DELETE on public.profiles to anon;
grant INSERT on public.profiles to anon;
grant REFERENCES on public.profiles to anon;
grant SELECT on public.profiles to anon;
grant TRIGGER on public.profiles to anon;
grant TRUNCATE on public.profiles to anon;
grant DELETE on public.profiles to authenticated;
grant INSERT on public.profiles to authenticated;
grant REFERENCES on public.profiles to authenticated;
grant SELECT on public.profiles to authenticated;
grant TRIGGER on public.profiles to authenticated;
grant TRUNCATE on public.profiles to authenticated;
grant UPDATE on public.profiles to authenticated;
grant DELETE on public.status_historico to anon;
grant INSERT on public.status_historico to anon;
grant REFERENCES on public.status_historico to anon;
grant SELECT on public.status_historico to anon;
grant TRIGGER on public.status_historico to anon;
grant TRUNCATE on public.status_historico to anon;
grant UPDATE on public.status_historico to anon;
grant DELETE on public.status_historico to authenticated;
grant INSERT on public.status_historico to authenticated;
grant REFERENCES on public.status_historico to authenticated;
grant SELECT on public.status_historico to authenticated;
grant TRIGGER on public.status_historico to authenticated;
grant TRUNCATE on public.status_historico to authenticated;
grant UPDATE on public.status_historico to authenticated;
grant DELETE on public.status_log to anon;
grant INSERT on public.status_log to anon;
grant REFERENCES on public.status_log to anon;
grant SELECT on public.status_log to anon;
grant TRIGGER on public.status_log to anon;
grant TRUNCATE on public.status_log to anon;
grant UPDATE on public.status_log to anon;
grant DELETE on public.status_log to authenticated;
grant INSERT on public.status_log to authenticated;
grant REFERENCES on public.status_log to authenticated;
grant SELECT on public.status_log to authenticated;
grant TRIGGER on public.status_log to authenticated;
grant TRUNCATE on public.status_log to authenticated;
grant UPDATE on public.status_log to authenticated;
grant DELETE on public.stock_equip to anon;
grant INSERT on public.stock_equip to anon;
grant REFERENCES on public.stock_equip to anon;
grant SELECT on public.stock_equip to anon;
grant TRIGGER on public.stock_equip to anon;
grant TRUNCATE on public.stock_equip to anon;
grant UPDATE on public.stock_equip to anon;
grant DELETE on public.stock_equip to authenticated;
grant INSERT on public.stock_equip to authenticated;
grant REFERENCES on public.stock_equip to authenticated;
grant SELECT on public.stock_equip to authenticated;
grant TRIGGER on public.stock_equip to authenticated;
grant TRUNCATE on public.stock_equip to authenticated;
grant UPDATE on public.stock_equip to authenticated;
grant DELETE on public.stock_norma_publico to anon;
grant INSERT on public.stock_norma_publico to anon;
grant REFERENCES on public.stock_norma_publico to anon;
grant SELECT on public.stock_norma_publico to anon;
grant TRIGGER on public.stock_norma_publico to anon;
grant TRUNCATE on public.stock_norma_publico to anon;
grant UPDATE on public.stock_norma_publico to anon;
grant DELETE on public.stock_norma_publico to authenticated;
grant INSERT on public.stock_norma_publico to authenticated;
grant REFERENCES on public.stock_norma_publico to authenticated;
grant SELECT on public.stock_norma_publico to authenticated;
grant TRIGGER on public.stock_norma_publico to authenticated;
grant TRUNCATE on public.stock_norma_publico to authenticated;
grant UPDATE on public.stock_norma_publico to authenticated;
grant DELETE on public.stock_norma to anon;
grant INSERT on public.stock_norma to anon;
grant REFERENCES on public.stock_norma to anon;
grant SELECT on public.stock_norma to anon;
grant TRIGGER on public.stock_norma to anon;
grant TRUNCATE on public.stock_norma to anon;
grant UPDATE on public.stock_norma to anon;
grant DELETE on public.stock_norma to authenticated;
grant INSERT on public.stock_norma to authenticated;
grant REFERENCES on public.stock_norma to authenticated;
grant SELECT on public.stock_norma to authenticated;
grant TRIGGER on public.stock_norma to authenticated;
grant TRUNCATE on public.stock_norma to authenticated;
grant UPDATE on public.stock_norma to authenticated;
grant DELETE on public.stock_usadas_publico to anon;
grant INSERT on public.stock_usadas_publico to anon;
grant REFERENCES on public.stock_usadas_publico to anon;
grant SELECT on public.stock_usadas_publico to anon;
grant TRIGGER on public.stock_usadas_publico to anon;
grant TRUNCATE on public.stock_usadas_publico to anon;
grant UPDATE on public.stock_usadas_publico to anon;
grant DELETE on public.stock_usadas_publico to authenticated;
grant INSERT on public.stock_usadas_publico to authenticated;
grant REFERENCES on public.stock_usadas_publico to authenticated;
grant SELECT on public.stock_usadas_publico to authenticated;
grant TRIGGER on public.stock_usadas_publico to authenticated;
grant TRUNCATE on public.stock_usadas_publico to authenticated;
grant UPDATE on public.stock_usadas_publico to authenticated;
grant DELETE on public.stock_usadas to authenticated;
grant INSERT on public.stock_usadas to authenticated;
grant SELECT on public.stock_usadas to authenticated;
grant UPDATE on public.stock_usadas to authenticated;
-- Sequências: em produção anon e authenticated têm usage/select/update em todas.
grant usage, select, update on all sequences in schema public to anon, authenticated;
