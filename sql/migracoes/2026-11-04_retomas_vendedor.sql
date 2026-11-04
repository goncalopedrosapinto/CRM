-- Baviera Control · Usadas › Retomas: o registo passa a guardar o vendedor que pediu o valor (2026-11-04)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- A mota já fica identificada pela matrícula; em vez do cliente, regista-se o vendedor (ou o chefe).
-- Não mexe nos registos que já existem: a coluna "cliente" fica como está e a app mostra-a nos registos antigos.
-- O vendedor pode ser corrigido depois (não entra na regra dos valores fixos). Só o chefe vê e escreve (regra da tabela).

begin;

alter table public.retomas_valores
  add column if not exists vendedor_id uuid references public.profiles(id) on delete set null;

create index if not exists retomas_valores_vendedor_idx on public.retomas_valores (vendedor_id);

commit;
