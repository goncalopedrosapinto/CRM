-- Baviera Control · Eventos: perfil externo «Eventos», ficha de inscrição completa e documentos (2026-11-09)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- 1. Perfil novo «eventos» (pessoa de fora): só vê e trabalha nos eventos a que o chefe lhe der acesso
--    (tabela evento_acessos). O acesso não depende de o evento estar ativo: continua depois de o evento acabar.
--    Não vê negócios, stock, escala, configurações, comissões nem perfis da equipa.
-- 2. Inscrições com nome completo, data de nascimento, NIF, telemóvel, camisola, pendura (os mesmos dados),
--    mota que leva (própria / Caetano / outra + modelo) e documentos (cartão de cidadão e carta de condução,
--    só com o consentimento escrito do cliente marcado).
-- 3. Só o chefe muda quem registou a inscrição (vendedor_id).
-- 4. Bucket privado «evento-documentos» (pasta evento/inscrição): quem vê a inscrição vê os documentos.
-- 5. O chefe dá ou tira o perfil «eventos» a uma conta nova sem ir ao Supabase (função perfil_eventos).

begin;

-- ---------- 1. perfil ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin','vendedor','assessor','secretario','financeiro','pendente','eventos']));

create table if not exists public.evento_acessos (
  evento_id bigint not null references public.eventos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  primary key (evento_id, user_id)
);
alter table public.evento_acessos enable row level security;
drop policy if exists evento_acessos_chefe on public.evento_acessos;
create policy evento_acessos_chefe on public.evento_acessos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists evento_acessos_proprio on public.evento_acessos;
create policy evento_acessos_proprio on public.evento_acessos for select to authenticated
  using (user_id = auth.uid());
grant select, insert, delete on public.evento_acessos to authenticated;

create or replace function public.evento_tem_acesso(p_evento bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.evento_acessos a join public.profiles p on p.id = a.user_id
                 where a.evento_id = p_evento and a.user_id = auth.uid() and p.role = 'eventos');
$$;
revoke all on function public.evento_tem_acesso(bigint) from public, anon;
grant execute on function public.evento_tem_acesso(bigint) to authenticated;

-- eventos: o perfil externo só vê aqueles a que tem acesso (os outros perfis como antes)
drop policy if exists eventos_select on public.eventos;
create policy eventos_select on public.eventos for select to authenticated
  using (coalesce(public.meu_role(), '') <> 'eventos' or public.evento_tem_acesso(id));

-- o que hoje qualquer conta lê: fica fechado ao perfil externo
drop policy if exists escala_select on public.escala;
create policy escala_select on public.escala for select
  using (auth.uid() is not null and coalesce(public.meu_role(), '') <> 'eventos');
drop policy if exists cfg_ler on public.configuracoes;
create policy cfg_ler on public.configuracoes for select to authenticated
  using (coalesce(public.meu_role(), '') <> 'eventos');
drop policy if exists fecho_ler on public.comissoes_fecho;
create policy fecho_ler on public.comissoes_fecho for select to authenticated
  using (coalesce(public.meu_role(), '') <> 'eventos');
-- perfis: o externo só se vê a si próprio
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin()
         or (linha = public.my_linha() and coalesce(public.meu_role(), '') <> 'eventos'));

-- ranking: contas novas e o externo (fora dos seus eventos) não leem
create or replace function public.inscricoes_ranking(p_evento bigint)
returns table(vendedor_id uuid, nome text, total bigint, acompanhantes bigint)
language sql security definer set search_path = public as $$
  select i.vendedor_id, p.nome, count(*)::bigint, coalesce(sum(i.acompanhantes), 0)::bigint
  from inscricoes i join profiles p on p.id = i.vendedor_id
  where i.evento_id = p_evento and i.estado <> 'Cancelado'
    and (coalesce(public.meu_role(), '') not in ('', 'pendente', 'eventos') or public.evento_tem_acesso(p_evento))
  group by i.vendedor_id, p.nome order by count(*) desc;
$$;

-- nomes de quem registou as inscrições de um evento (para o externo, que não lê os perfis da equipa)
create or replace function public.evento_registos(p_evento bigint)
returns table(id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.nome from public.inscricoes i join public.profiles p on p.id = i.vendedor_id
  where i.evento_id = p_evento and (public.is_admin() or public.evento_tem_acesso(p_evento)
                                    or coalesce(public.meu_role(), '') in ('vendedor', 'assessor', 'secretario', 'financeiro'));
$$;
revoke all on function public.evento_registos(bigint) from public, anon;
grant execute on function public.evento_registos(bigint) to authenticated;

-- ---------- 2. ficha de inscrição ----------
alter table public.inscricoes
  add column if not exists data_nascimento date,
  add column if not exists nif text,
  add column if not exists camisola text,
  add column if not exists pendura boolean not null default false,
  add column if not exists pendura_nome text,
  add column if not exists pendura_data_nascimento date,
  add column if not exists pendura_nif text,
  add column if not exists pendura_telefone text,
  add column if not exists pendura_camisola text,
  add column if not exists mota_origem text,
  add column if not exists mota_modelo text,
  add column if not exists docs jsonb not null default '[]'::jsonb,
  add column if not exists docs_consentimento boolean not null default false,
  add column if not exists updated_at timestamptz default now();

alter table public.inscricoes drop constraint if exists inscricoes_ficha_check;
alter table public.inscricoes add constraint inscricoes_ficha_check check (
  (nif is null or nif ~ '^[0-9]{9}$')
  and (pendura_nif is null or pendura_nif ~ '^[0-9]{9}$')
  and (camisola is null or camisola in ('XS','S','M','L','XL','XXL','3XL'))
  and (pendura_camisola is null or pendura_camisola in ('XS','S','M','L','XL','XXL','3XL'))
  and (mota_origem is null or mota_origem in ('Própria','Caetano','Outra'))
  and jsonb_typeof(docs) = 'array'
  and (jsonb_array_length(docs) = 0 or docs_consentimento)
);

-- ---------- 3. regras das inscrições ----------
-- equipa: as suas (como antes); contas novas e o externo deixam de as poder criar por esta via
drop policy if exists insc_own_select on public.inscricoes;
create policy insc_own_select on public.inscricoes for select
  using (vendedor_id = auth.uid() and coalesce(public.meu_role(), '') not in ('', 'pendente', 'eventos'));
drop policy if exists insc_own_insert on public.inscricoes;
create policy insc_own_insert on public.inscricoes for insert
  with check (vendedor_id = auth.uid() and coalesce(public.meu_role(), '') not in ('', 'pendente', 'eventos'));
drop policy if exists insc_own_update on public.inscricoes;
create policy insc_own_update on public.inscricoes for update
  using (vendedor_id = auth.uid() and coalesce(public.meu_role(), '') not in ('', 'pendente', 'eventos'))
  with check (vendedor_id = auth.uid() and coalesce(public.meu_role(), '') not in ('', 'pendente', 'eventos'));
drop policy if exists insc_own_delete on public.inscricoes;
create policy insc_own_delete on public.inscricoes for delete
  using (vendedor_id = auth.uid() and coalesce(public.meu_role(), '') not in ('', 'pendente', 'eventos'));
-- externo: todas as inscrições dos eventos a que tem acesso; cria em seu nome; apaga só as que registou
drop policy if exists insc_ext_select on public.inscricoes;
create policy insc_ext_select on public.inscricoes for select to authenticated
  using (public.evento_tem_acesso(evento_id));
drop policy if exists insc_ext_insert on public.inscricoes;
create policy insc_ext_insert on public.inscricoes for insert to authenticated
  with check (public.evento_tem_acesso(evento_id) and vendedor_id = auth.uid());
drop policy if exists insc_ext_update on public.inscricoes;
create policy insc_ext_update on public.inscricoes for update to authenticated
  using (public.evento_tem_acesso(evento_id)) with check (public.evento_tem_acesso(evento_id));
drop policy if exists insc_ext_delete on public.inscricoes;
create policy insc_ext_delete on public.inscricoes for delete to authenticated
  using (public.evento_tem_acesso(evento_id) and vendedor_id = auth.uid());

-- só o chefe muda quem registou
create or replace function public.inscricoes_proteger()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.vendedor_id is distinct from old.vendedor_id and current_user in ('authenticated', 'anon') and not public.is_admin() then
    raise exception 'Sem permissão: só o chefe muda quem registou a inscrição' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists inscricoes_proteger_trg on public.inscricoes;
create trigger inscricoes_proteger_trg before update on public.inscricoes
  for each row execute function public.inscricoes_proteger();

-- ---------- 4. documentos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evento-documentos', 'evento-documentos', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- quem vê a inscrição (pelas regras acima) vê, junta e apaga os documentos dela; pasta = evento/inscrição/ficheiro
drop policy if exists evt_doc_ler on storage.objects;
create policy evt_doc_ler on storage.objects for select to authenticated
  using (bucket_id = 'evento-documentos' and exists (select 1 from public.inscricoes i
         where i.evento_id::text = (storage.foldername(name))[1] and i.id::text = (storage.foldername(name))[2]));
drop policy if exists evt_doc_juntar on storage.objects;
create policy evt_doc_juntar on storage.objects for insert to authenticated
  with check (bucket_id = 'evento-documentos' and exists (select 1 from public.inscricoes i
         where i.evento_id::text = (storage.foldername(name))[1] and i.id::text = (storage.foldername(name))[2]
           and i.docs_consentimento));
drop policy if exists evt_doc_apagar on storage.objects;
create policy evt_doc_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'evento-documentos' and exists (select 1 from public.inscricoes i
         where i.evento_id::text = (storage.foldername(name))[1] and i.id::text = (storage.foldername(name))[2]));

-- ---------- 5. o chefe dá / tira o perfil «eventos» ----------
create or replace function public.perfil_eventos(p_user uuid, p_ativo boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not public.is_admin() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select role into v from public.profiles where id = p_user;
  if v is null then raise exception 'Conta não encontrada'; end if;
  if p_ativo then
    if v not in ('pendente', 'eventos') then raise exception 'Só contas novas (à espera) passam a Eventos'; end if;
    update public.profiles set role = 'eventos' where id = p_user;
    return 'eventos';
  else
    if v <> 'eventos' then raise exception 'Esta conta não tem o perfil Eventos'; end if;
    delete from public.evento_acessos where user_id = p_user;
    update public.profiles set role = 'pendente' where id = p_user;
    return 'pendente';
  end if;
end $$;
revoke all on function public.perfil_eventos(uuid, boolean) from public, anon;
grant execute on function public.perfil_eventos(uuid, boolean) to authenticated;

commit;
