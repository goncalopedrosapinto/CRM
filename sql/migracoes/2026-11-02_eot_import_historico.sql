-- Baviera Control · EOTs: a importação do mapa deixa registo do que mudou nos dados do banco (2026-11-02)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Até aqui, quando um mapa novo mudava um dado do banco (telefone, data de fim, valores…), o valor antigo
-- desaparecia sem rasto: o histórico só registava a entrada/saída do mapa.
-- Agora cada dado do banco que a importação muda fica no histórico do contrato ("Importação do mapa":
-- antes → depois). O que não muda não gera registo. Fase, responsável, notas, indicações e visto continuam
-- a não ser tocados pela importação (a plataforma nem os envia).

begin;

create or replace function public.eot_log_alteracoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
  imp boolean := new.ultima_import is distinct from old.ultima_import;
  banco constant text[] := array['tipo','cliente','contacto_nome','telefone','telemovel','data_fim','prazo','prestacao','kms',
    'matricula','modelo','seguro','manutencao','residual','despesas','total','concessionario','conc_resp','vendedor_origem'];
begin
  for k in select jsonb_object_keys(n) loop
    continue when k in ('updated_at','ultima_import','criado_em','saiu_em','contrato','fin_visto_por','fin_visto_nome');
    continue when imp and k <> 'no_mapa' and not (k = any(banco));
    if (o -> k) is distinct from (n -> k) then
      insert into public.eot_historico (contrato, tipo, campo, valor_antes, valor_depois)
      values (new.contrato, case when imp then 'sistema' else 'alteracao' end, k, o ->> k, n ->> k);
    end if;
  end loop;
  return new;
end $$;

commit;
