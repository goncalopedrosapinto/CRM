-- Baviera Control · Acordo de venda das motas usadas (2026-11-04)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- O PDF do acordo é preenchido com os dados do negócio (cliente, NIF, morada, CC, contactos, modelo, matrícula,
-- valor de venda, retoma…). Aqui fica só o que é do acordo e não existe no negócio: data do acordo, cor, estofos,
-- km e data da matrícula da mota, dados da empresa, dados e valor da retoma, sinal e forma de pagamento,
-- observações e o "tomei conhecimento" da BMW Financial Services. Um acordo por negócio.
-- Vê e escreve: o vendedor do negócio e o chefe (as mesmas regras do negócio). Fica quem e quando mudou.

begin;

create table if not exists public.acordos_venda (
  negocio_id bigint primary key references public.baviera_control(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null
);

alter table public.acordos_venda enable row level security;
drop policy if exists acordos_venda_acesso on public.acordos_venda;
create policy acordos_venda_acesso on public.acordos_venda for all to authenticated
  using (public.is_admin() or exists (
    select 1 from public.baviera_control b where b.id = acordos_venda.negocio_id and b.vendedor_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.baviera_control b where b.id = acordos_venda.negocio_id and b.vendedor_id = auth.uid()));
revoke all on public.acordos_venda from anon;
grant select, insert, update, delete on public.acordos_venda to authenticated;

-- quem e quando: gravado pelo servidor
create or replace function public.acordos_venda_carimbo()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
drop trigger if exists acordos_venda_carimbo_trg on public.acordos_venda;
create trigger acordos_venda_carimbo_trg before insert or update on public.acordos_venda
  for each row execute function public.acordos_venda_carimbo();

commit;
