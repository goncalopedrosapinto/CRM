-- Baviera Control · Quem tem a área "Previsão do mês" vê o objetivo de equipa (2026-10-20)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm).
-- Só leitura: alterar objetivos continua a ser só do chefe.

begin;

create or replace function public.tem_area(p_area text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and p_area = any(areas));
$$;
revoke execute on function public.tem_area(text) from public, anon;
grant  execute on function public.tem_area(text) to authenticated;

drop policy if exists objeq_previsao_ler on public.objetivos_equipa;
create policy objeq_previsao_ler on public.objetivos_equipa for select to authenticated
  using (public.tem_area('previsao'));

commit;
