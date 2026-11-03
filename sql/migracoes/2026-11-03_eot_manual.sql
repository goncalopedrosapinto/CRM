-- Baviera Control · EOTs: criar contratos à mão, além do mapa do banco (2026-11-03)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- O chefe pode criar um contrato que não veio no mapa. Fica "criado à mão", com quem e quando.
-- A importação do mapa não o dá como "saiu do mapa" (nunca lá esteve). Se um dia o contrato vier no mapa,
-- passa a ser "do mapa": o banco atualiza os dados e, quando deixar de vir, sai como os outros.
-- Essa passagem fica no histórico do contrato. Só o chefe cria contratos (já era assim); os vendedores não mudam a origem.

begin;

alter table public.eot_contratos add column if not exists origem text not null default 'mapa';
alter table public.eot_contratos drop constraint if exists eot_contratos_origem_check;
alter table public.eot_contratos add constraint eot_contratos_origem_check check (origem in ('mapa', 'manual'));
alter table public.eot_contratos add column if not exists criado_por uuid default auth.uid() references public.profiles(id) on delete set null;

-- veio no mapa: deixa de ser "criado à mão"
create or replace function public.eot_origem()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.ultima_import is not null and new.ultima_import is distinct from old.ultima_import then
    new.origem := 'mapa';
  end if;
  return new;
end $$;
drop trigger if exists eot_origem_trg on public.eot_contratos;
create trigger eot_origem_trg before update on public.eot_contratos
  for each row execute function public.eot_origem();

-- histórico: a importação regista também quando um contrato criado à mão passa a vir no mapa
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
    continue when k in ('updated_at','ultima_import','criado_em','criado_por','saiu_em','contrato','fin_visto_por','fin_visto_nome');
    continue when imp and k not in ('no_mapa', 'origem') and not (k = any(banco));
    if (o -> k) is distinct from (n -> k) then
      insert into public.eot_historico (contrato, tipo, campo, valor_antes, valor_depois)
      values (new.contrato, case when imp then 'sistema' else 'alteracao' end, k, o ->> k, n ->> k);
    end if;
  end loop;
  return new;
end $$;

commit;
