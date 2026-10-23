-- Baviera Control · Declaração de circulação e aniversário do cliente nos negócios (2026-10-23)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Declaração de circulação: 90 dias depois da data de matrícula de uma mota nova vendida, o vendedor é avisado
-- para confirmar se está atualizada. A resposta fica no negócio ('Atualizada' ou 'Por atualizar') e a data
-- da resposta é posta pelo servidor (ninguém a escreve à mão).
-- Aniversário: data de nascimento do cliente no negócio. Os vendedores veem no dia; a secretaria não vê
-- (a vista negocios_secretaria não tem esta coluna).

begin;

alter table public.baviera_control add column if not exists data_nascimento date;
alter table public.baviera_control add column if not exists decl_circ text;
alter table public.baviera_control add column if not exists decl_circ_em timestamptz;

alter table public.baviera_control drop constraint if exists baviera_control_decl_circ_check;
alter table public.baviera_control add constraint baviera_control_decl_circ_check
  check (decl_circ in ('Atualizada', 'Por atualizar'));

-- a data da resposta acompanha a resposta: muda quando a resposta muda, desaparece se a resposta for apagada
create or replace function public.bc_decl_circ_data()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.decl_circ is distinct from old.decl_circ then
    new.decl_circ_em := case when new.decl_circ is null then null else now() end;
  else
    new.decl_circ_em := old.decl_circ_em;
  end if;
  return new;
end $$;
revoke execute on function public.bc_decl_circ_data() from public, anon, authenticated;

drop trigger if exists bc_decl_circ_data_trg on public.baviera_control;
create trigger bc_decl_circ_data_trg before insert or update on public.baviera_control
  for each row execute function public.bc_decl_circ_data();

commit;
