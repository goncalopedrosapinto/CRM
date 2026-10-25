-- Baviera Control · Reunião semanal: compromissos de cada vendedor (2026-10-25)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- O chefe regista na reunião de terça o que cada vendedor se compromete a fazer (o quê e até quando);
-- a reunião seguinte abre por eles. Só o chefe vê e escreve (os vendedores não veem esta tabela).

begin;

create table if not exists public.reuniao_compromissos (
  id          bigint generated always as identity primary key,
  reuniao     date not null,                                   -- dia da reunião em que ficou combinado
  vendedor_id uuid references public.profiles(id) on delete set null,   -- vazio = a equipa toda
  ponto       text,                                            -- ponto da reunião (resultados, carteira, eots, stock, equip, eventos…)
  texto       text not null check (length(trim(texto)) > 0),
  prazo       date,
  feito       boolean not null default false,
  feito_em    timestamptz,
  criado_em   timestamptz not null default now(),
  criado_por  uuid default auth.uid()
);

create index if not exists reuniao_compromissos_aberto_idx on public.reuniao_compromissos (feito, reuniao);

alter table public.reuniao_compromissos enable row level security;

drop policy if exists reuniao_comp_chefe on public.reuniao_compromissos;
create policy reuniao_comp_chefe on public.reuniao_compromissos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.reuniao_compromissos from anon;
grant select, insert, update, delete on public.reuniao_compromissos to authenticated;

comment on table public.reuniao_compromissos is 'Compromissos combinados na reunião semanal (só o chefe vê).';

commit;
