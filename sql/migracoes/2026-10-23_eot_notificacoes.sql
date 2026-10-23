-- Baviera Control · Notificações das EOTs: «Lido» por pessoa (2026-10-23)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- As notificações em si saem do histórico das EOTs (a última indicação de cada conversa espera pelo outro lado)
-- e já funcionam sem isto. Esta tabela só guarda quem marcou o quê como lido: cada pessoa vê e mexe só nas suas
-- marcas; o chefe lê todas (para saber que conversas ninguém viu).

begin;

create table if not exists public.eot_notif_lidas (
  user_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  contrato text not null references public.eot_contratos(contrato) on delete cascade,
  hist_id  bigint not null,
  lido_em  timestamptz not null default now(),
  primary key (user_id, contrato)
);

alter table public.eot_notif_lidas enable row level security;

drop policy if exists eot_notif_ler on public.eot_notif_lidas;
create policy eot_notif_ler on public.eot_notif_lidas for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists eot_notif_marcar on public.eot_notif_lidas;
create policy eot_notif_marcar on public.eot_notif_lidas for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists eot_notif_mudar on public.eot_notif_lidas;
create policy eot_notif_mudar on public.eot_notif_lidas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists eot_notif_tirar on public.eot_notif_lidas;
create policy eot_notif_tirar on public.eot_notif_lidas for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.eot_notif_lidas from anon;
grant select, insert, update, delete on public.eot_notif_lidas to authenticated;

-- as notificações leem as últimas indicações a cada minuto: índice só para os comentários
create index if not exists eot_historico_coment_idx on public.eot_historico (id desc) where tipo = 'comentario';

commit;
