-- Baviera Control · Usadas › Retomas: registo dos valores de retoma que o chefe dá (2026-11-03)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Cada valor de retoma dado fica registado: cliente, mota (modelo, ano, km, extras, matrícula), valor oferecido,
-- preparação estimada, venda prevista e venda mínima esperada. Serve para dar o mesmo valor se o cliente voltar a perguntar
-- e para controlar o que foi aceite.
-- Os valores ficam fixos depois de gravados (é o registo do que foi dito ao cliente): só o estado (proposta / aceite /
-- recusada) e as notas mudam. Para dar outro valor, grava-se um registo novo. Só o chefe vê e escreve.

begin;

create table if not exists public.retomas_valores (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  cliente text,
  matricula text,
  modelo text not null,
  ano integer,
  kms integer,
  extras text,
  valor_retoma numeric(12,2) not null,
  preparacao numeric(12,2),
  valor_venda numeric(12,2),
  venda_minima numeric(12,2),
  estado text not null default 'proposta',
  notas text,
  constraint retomas_valores_modelo_check check (length(btrim(modelo)) > 0),
  constraint retomas_valores_ano_check check (ano is null or ano between 1950 and 2100),
  constraint retomas_valores_kms_check check (kms is null or kms >= 0),
  constraint retomas_valores_valores_check check (valor_retoma >= 0 and coalesce(preparacao, 0) >= 0
    and coalesce(valor_venda, 0) >= 0 and coalesce(venda_minima, 0) >= 0),
  constraint retomas_valores_estado_check check (estado in ('proposta', 'aceite', 'recusada'))
);
create index if not exists retomas_valores_criado_idx on public.retomas_valores (criado_em desc);

alter table public.retomas_valores enable row level security;
drop policy if exists retomas_valores_chefe on public.retomas_valores;
create policy retomas_valores_chefe on public.retomas_valores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.retomas_valores from anon;
grant select, insert, update, delete on public.retomas_valores to authenticated;

-- os valores dados não mudam depois de gravados; o estado e as notas sim
create or replace function public.retomas_valores_fixos()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.cliente, new.matricula, new.modelo, new.ano, new.kms, new.extras, new.valor_retoma, new.preparacao,
      new.valor_venda, new.venda_minima, new.criado_em, new.criado_por)
     is distinct from
     (old.cliente, old.matricula, old.modelo, old.ano, old.kms, old.extras, old.valor_retoma, old.preparacao,
      old.valor_venda, old.venda_minima, old.criado_em, old.criado_por) then
    raise exception 'Os valores de uma retoma já registada não mudam: regista um valor novo' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists retomas_valores_fixos_trg on public.retomas_valores;
create trigger retomas_valores_fixos_trg before update on public.retomas_valores
  for each row execute function public.retomas_valores_fixos();

commit;
