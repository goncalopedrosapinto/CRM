-- Baviera Control · Documentos emitidos: cada acordo de venda e folha de negócio descarregado fica guardado tal como saiu (2026-11-04)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Ao descarregar, o PDF vai para um "bucket" privado (negocio-documentos), numa pasta por negócio, e fica um registo
-- (quem, quando, o que foi preenchido). Mesmo que o negócio mude depois, o documento emitido fica igual.
-- Quem vê e quem emite: o chefe e o vendedor do negócio (as regras do negócio). Ninguém altera um documento emitido;
-- só o chefe apaga. Sem links públicos. Cada PDF tem ~150 KB (plano gratuito: 1 GB de ficheiros no total).

begin;

-- 1) bucket privado, só PDF, até 5 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('negocio-documentos', 'negocio-documentos', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists neg_doc_ler on storage.objects;
create policy neg_doc_ler on storage.objects for select to authenticated
  using (bucket_id = 'negocio-documentos' and (public.is_admin() or exists (
    select 1 from public.baviera_control b
     where b.id::text = (storage.foldername(name))[1] and b.vendedor_id = auth.uid())));

drop policy if exists neg_doc_juntar on storage.objects;
create policy neg_doc_juntar on storage.objects for insert to authenticated
  with check (bucket_id = 'negocio-documentos' and (public.is_admin() or exists (
    select 1 from public.baviera_control b
     where b.id::text = (storage.foldername(name))[1] and b.vendedor_id = auth.uid())));

drop policy if exists neg_doc_apagar on storage.objects;
create policy neg_doc_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'negocio-documentos' and public.is_admin());

-- 2) registo de cada documento emitido
create table if not exists public.documentos_emitidos (
  id bigint generated always as identity primary key,
  negocio_id bigint not null references public.baviera_control(id) on delete cascade,
  tipo text not null,
  caminho text not null unique,
  nome text not null,
  dados jsonb,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.profiles(id) on delete set null,
  constraint documentos_emitidos_tipo_check check (tipo in ('acordo_venda', 'folha_negocio')),
  constraint documentos_emitidos_pasta_check check (caminho like negocio_id::text || '/%')
);
create index if not exists documentos_emitidos_negocio_idx on public.documentos_emitidos (negocio_id, criado_em desc);

alter table public.documentos_emitidos enable row level security;
drop policy if exists doc_emit_ler on public.documentos_emitidos;
create policy doc_emit_ler on public.documentos_emitidos for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.baviera_control b where b.id = documentos_emitidos.negocio_id and b.vendedor_id = auth.uid()));
drop policy if exists doc_emit_juntar on public.documentos_emitidos;
create policy doc_emit_juntar on public.documentos_emitidos for insert to authenticated
  with check (public.is_admin() or exists (
    select 1 from public.baviera_control b where b.id = documentos_emitidos.negocio_id and b.vendedor_id = auth.uid()));
drop policy if exists doc_emit_apagar on public.documentos_emitidos;
create policy doc_emit_apagar on public.documentos_emitidos for delete to authenticated
  using (public.is_admin());
-- sem política de update: um documento emitido não muda
revoke all on public.documentos_emitidos from anon;
grant select, insert, delete on public.documentos_emitidos to authenticated;

-- quem e quando: gravado pelo servidor
create or replace function public.documentos_emitidos_carimbo()
returns trigger language plpgsql set search_path = public as $$
begin
  new.criado_em := now();
  new.criado_por := coalesce(auth.uid(), new.criado_por);
  return new;
end $$;
drop trigger if exists documentos_emitidos_carimbo_trg on public.documentos_emitidos;
create trigger documentos_emitidos_carimbo_trg before insert on public.documentos_emitidos
  for each row execute function public.documentos_emitidos_carimbo();

commit;
