-- Baviera Control · EOTs: visto "tratado" dos financeiros (2026-10-24)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- O financeiro dá o visto quando acabou de tratar o contrato (dar indicação não chega: pode ficar a faltar algo).
-- Quem e quando são gravados pelo servidor (não dá para pôr o visto em nome de outra pessoa).
-- Vendedores não mexem nestas colunas: o trigger eot_proteger já desfaz o que não é deles.
-- O visto deixa de valer na página quando o vendedor/chefe escreve depois dele ou o mapa reabre o contrato
-- (isso é calculado na página; aqui não se apaga nada).

begin;

alter table public.eot_contratos add column if not exists fin_visto_em timestamptz;
alter table public.eot_contratos add column if not exists fin_visto_por uuid;
alter table public.eot_contratos add column if not exists fin_visto_nome text;

comment on column public.eot_contratos.fin_visto_em is 'Quando um financeiro deu o contrato como tratado (visto). Vazio = sem visto.';
comment on column public.eot_contratos.fin_visto_por is 'Quem deu o visto (gravado pelo servidor).';
comment on column public.eot_contratos.fin_visto_nome is 'Nome de quem deu o visto (gravado pelo servidor).';

-- carimbo do servidor: hora e autor reais; tirar o visto limpa tudo
create or replace function public.eot_visto_carimbo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fin_visto_em is distinct from old.fin_visto_em then
    if new.fin_visto_em is null then
      new.fin_visto_por := null;
      new.fin_visto_nome := null;
    else
      new.fin_visto_em := now();
      new.fin_visto_por := auth.uid();
      new.fin_visto_nome := (select p.nome from public.profiles p where p.id = auth.uid());
    end if;
  else
    new.fin_visto_por := old.fin_visto_por;
    new.fin_visto_nome := old.fin_visto_nome;
  end if;
  return new;
end $$;

-- corre depois do eot_proteger_trg (ordem alfabética), por isso o vendedor nunca chega aqui com um visto novo
drop trigger if exists eot_visto_trg on public.eot_contratos;
create trigger eot_visto_trg before update on public.eot_contratos
  for each row execute function public.eot_visto_carimbo();

-- histórico: o visto fica registado uma vez ("Tratado (visto dos financeiros)"), sem repetir quem/nome
create or replace function public.eot_log_alteracoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
  imp boolean := new.ultima_import is distinct from old.ultima_import;
begin
  for k in select jsonb_object_keys(n) loop
    continue when k in ('updated_at','ultima_import','criado_em','saiu_em','contrato','fin_visto_por','fin_visto_nome');
    continue when imp and k <> 'no_mapa';
    if (o -> k) is distinct from (n -> k) then
      insert into public.eot_historico (contrato, tipo, campo, valor_antes, valor_depois)
      values (new.contrato, case when imp then 'sistema' else 'alteracao' end, k, o ->> k, n ->> k);
    end if;
  end loop;
  return new;
end $$;

commit;
