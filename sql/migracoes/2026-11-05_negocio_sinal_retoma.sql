-- Baviera Control · Sinal e dados da retoma no próprio negócio (2026-11-05)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- O acordo de venda (usadas) e a folha de negócio (novas/demos) vão buscar ao negócio o sinal e os dados da retoma,
-- em vez de se escreverem em cada documento. Mesmas regras do negócio (quem vê e edita o negócio vê e edita estes campos).
-- Não mexe em nada do que já existe.

begin;

alter table public.baviera_control
  add column if not exists sinal numeric(12,2),
  add column if not exists sinal_forma text,
  add column if not exists retoma_ano integer,
  add column if not exists retoma_kms integer,
  add column if not exists retoma_cor text,
  add column if not exists retoma_data_matricula date,
  add column if not exists retoma_valor numeric(12,2),
  add column if not exists retoma_valor_comercio numeric(12,2);

alter table public.baviera_control drop constraint if exists baviera_control_sinal_forma_check;
alter table public.baviera_control add constraint baviera_control_sinal_forma_check
  check (sinal_forma is null or sinal_forma in ('Numerário', 'Cheque', 'Transferência', 'MB'));
alter table public.baviera_control drop constraint if exists baviera_control_sinal_retoma_check;
alter table public.baviera_control add constraint baviera_control_sinal_retoma_check
  check (coalesce(sinal, 0) >= 0 and coalesce(retoma_valor, 0) >= 0 and coalesce(retoma_valor_comercio, 0) >= 0
    and coalesce(retoma_kms, 0) >= 0 and (retoma_ano is null or retoma_ano between 1950 and 2100));

commit;
