-- Baviera Control · Reunião semanal: assinalar compromissos repetidos (2026-10-25)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
-- Precisa da tabela reuniao_compromissos (SQL «2026-10-25_reuniao_compromissos», já corrido).
--
-- Quando um compromisso fica por cumprir e o chefe lhe dá uma nova data, conta um adiamento.
-- Na reunião seguinte, se voltar a ficar por cumprir, aparece como «Repetido · 2.ª vez» (3.ª, ...).
-- Sem novas datas também conta: por cumprir há mais de uma semana = repetido.

begin;

alter table public.reuniao_compromissos add column if not exists adiamentos integer not null default 0;
alter table public.reuniao_compromissos add column if not exists adiado_em date;

alter table public.reuniao_compromissos drop constraint if exists reuniao_compromissos_adiamentos_chk;
alter table public.reuniao_compromissos add constraint reuniao_compromissos_adiamentos_chk check (adiamentos >= 0);

comment on column public.reuniao_compromissos.adiamentos is 'Vezes que o compromisso ficou por cumprir e o chefe lhe deu nova data.';
comment on column public.reuniao_compromissos.adiado_em is 'Reunião (dia) em que levou a última nova data.';

commit;
