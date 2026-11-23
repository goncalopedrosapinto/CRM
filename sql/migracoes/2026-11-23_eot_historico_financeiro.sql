-- Baviera Control · EOTs: o financeiro acrescenta contratos (Excel do histórico desde 2023 e à mão) (2026-11-23)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
-- Não apaga nem altera contratos que já existem.
--
-- 1. Nova origem "historico": contratos acrescentados a partir do Excel do financeiro.
--    Como os criados à mão, a importação do mapa do banco não os dá como saídos. Se um vier no mapa com o mesmo nº,
--    passa a "do mapa" e o banco atualiza os dados (o trigger eot_origem já o faz para qualquer origem; fica no histórico).
-- 2. Três colunas novas: nif, vin e produto (produto financeiro). A morada e o código postal do Excel não entram.
-- 3. O financeiro pode inserir contratos, só novos e na fase inicial: sem responsável (é o chefe de vendas que atribui),
--    sem acompanhamento, sem visto e sem marca de importação do mapa. Não pode apagar (continua sem política de delete).
-- 4. O financeiro deixa de poder mudar o responsável, a origem e quem criou um contrato.
--    Até aqui podia mudar tudo pela API; no histórico nunca mudou um responsável.

begin;

alter table public.eot_contratos add column if not exists nif text;
alter table public.eot_contratos add column if not exists vin text;
alter table public.eot_contratos add column if not exists produto text;

alter table public.eot_contratos drop constraint if exists eot_contratos_origem_check;
alter table public.eot_contratos add constraint eot_contratos_origem_check check (origem in ('mapa', 'manual', 'historico'));

drop policy if exists eot_fin_ins on public.eot_contratos;
create policy eot_fin_ins on public.eot_contratos for insert to authenticated
  with check (
    public.is_financeiro()
    and origem in ('historico', 'manual')
    and responsavel_id is null
    and fase = 'Por contactar'
    and temperatura is null and proxima_acao is null and proxima_data is null
    and negocio_id is null and adenda_em is null
    and ultima_import is null
    and fin_visto_em is null and fin_visto_por is null
    and criado_por = auth.uid()
  );

-- vendedores: só mexem no acompanhamento (como até aqui); financeiro: tudo menos responsável, origem e quem criou
create or replace function public.eot_proteger()
returns trigger
language plpgsql
set search_path = public
as $$
declare r public.eot_contratos;
begin
  if public.is_admin() then return new; end if;
  if public.is_financeiro() then
    new.responsavel_id := old.responsavel_id;
    new.origem := old.origem;
    new.criado_por := old.criado_por;
    return new;
  end if;
  r := old;
  r.fase := new.fase; r.temperatura := new.temperatura;
  r.proxima_acao := new.proxima_acao; r.proxima_data := new.proxima_data;
  r.notas := new.notas; r.negocio_id := new.negocio_id; r.updated_at := now();
  return r;
end $$;

commit;
