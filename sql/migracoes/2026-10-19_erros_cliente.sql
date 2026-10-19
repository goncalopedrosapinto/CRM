-- Baviera Control · Registo de erros do browser (fase 5, 2026-10-19)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm).
-- Cada utilizador com sessão só consegue ACRESCENTAR erros seus; só o chefe os lê.

begin;

create table if not exists public.erros_cliente (
  id        bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  user_id   uuid default auth.uid(),
  perfil    text,
  versao    text,
  ecra      text,
  tipo      text,
  mensagem  text not null,
  origem    text,
  pilha     text,
  agente    text,
  largura   integer,
  constraint erros_tamanhos check (
    length(mensagem) <= 500 and coalesce(length(pilha),0) <= 2000 and coalesce(length(origem),0) <= 300
    and coalesce(length(agente),0) <= 300 and coalesce(length(ecra),0) <= 80 and coalesce(length(versao),0) <= 40
    and coalesce(length(tipo),0) <= 20 and coalesce(length(perfil),0) <= 20)
);
create index if not exists erros_cliente_criado_idx on public.erros_cliente (criado_em desc);

alter table public.erros_cliente enable row level security;

drop policy if exists erros_inserir on public.erros_cliente;
create policy erros_inserir on public.erros_cliente for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists erros_ler on public.erros_cliente;
create policy erros_ler on public.erros_cliente for select to authenticated
  using (public.is_admin());

revoke all on public.erros_cliente from anon;
revoke update, delete, truncate, trigger, references on public.erros_cliente from authenticated;
grant insert, select on public.erros_cliente to authenticated;

-- Travão: no máximo 60 erros por utilizador por hora (um ciclo de erros não enche a base);
-- e apaga sozinho o que tiver mais de 90 dias.
create or replace function public.erros_cliente_travao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  if (select count(*) from public.erros_cliente
       where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 60 then
    return null;
  end if;
  delete from public.erros_cliente where criado_em < now() - interval '90 days';
  return new;
end $$;
revoke execute on function public.erros_cliente_travao() from public, anon, authenticated;
drop trigger if exists erros_cliente_travao on public.erros_cliente;
create trigger erros_cliente_travao before insert on public.erros_cliente
  for each row execute function public.erros_cliente_travao();

-- Resumo para o relatório semanal (só o chefe ou o servidor o conseguem correr).
create or replace function public.erros_resumo(p_dias integer default 7)
returns table(mensagem text, tipo text, vezes bigint, utilizadores bigint, perfis text, versoes text, ecras text, primeiro timestamptz, ultimo timestamptz)
language sql stable security definer set search_path = public as $$
  select e.mensagem, e.tipo, count(*), count(distinct e.user_id),
         string_agg(distinct coalesce(e.perfil,'?'), ', '), string_agg(distinct coalesce(e.versao,'?'), ', '),
         string_agg(distinct coalesce(e.ecra,'?'), ', '), min(e.criado_em), max(e.criado_em)
    from public.erros_cliente e
   where e.criado_em > now() - make_interval(days => p_dias)
     and (auth.uid() is null or public.is_admin())
   group by e.mensagem, e.tipo
   order by count(*) desc
   limit 50;
$$;
revoke execute on function public.erros_resumo(integer) from public, anon;
grant execute on function public.erros_resumo(integer) to authenticated;

commit;
