-- Baviera Control · Comissão fixa por negócio (2026-11-10)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- O chefe escreve, nas Comissões, um valor em € para um negócio; esse valor substitui a regra (percentagem / mínimo / demo).
-- Fica na tabela das margens: só o chefe escreve; o vendedor lê a do seu negócio (já é assim para a margem).

begin;
alter table public.margens add column if not exists comissao_fixa numeric(12,2);
alter table public.margens alter column margem drop not null;
alter table public.margens drop constraint if exists margens_comissao_fixa_check;
alter table public.margens add constraint margens_comissao_fixa_check check (comissao_fixa is null or comissao_fixa >= 0);
commit;
