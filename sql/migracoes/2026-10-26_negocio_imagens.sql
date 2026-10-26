-- Baviera Control · Imagens nos comentários dos negócios (2026-10-26)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Como nas EOTs: colar um print (Ctrl+V) ou anexar uma imagem num comentário do negócio.
-- As imagens ficam num "bucket" privado (negocio-imagens), numa pasta por negócio (nº do negócio).
-- Quem vê e quem pode juntar imagens a um negócio = quem já vê e comenta esse negócio:
--   o chefe e o vendedor do negócio. Secretaria, financeiros e assessores não veem.
-- Não há links públicos: cada imagem só abre com sessão iniciada e permissão.
-- Cada print fica com ~100-300 KB (a plataforma reduz antes de enviar). Plano gratuito: 1 GB de ficheiros no total.

begin;

-- 1) bucket privado, até 5 MB por imagem, só imagens
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('negocio-imagens', 'negocio-imagens', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) quem pode ver / juntar / apagar (pasta = nº do negócio)
drop policy if exists neg_img_ler on storage.objects;
create policy neg_img_ler on storage.objects for select to authenticated
  using (bucket_id = 'negocio-imagens' and (public.is_admin() or exists (
    select 1 from public.baviera_control b
     where b.id::text = (storage.foldername(name))[1] and b.vendedor_id = auth.uid())));

drop policy if exists neg_img_juntar on storage.objects;
create policy neg_img_juntar on storage.objects for insert to authenticated
  with check (bucket_id = 'negocio-imagens' and (public.is_admin() or exists (
    select 1 from public.baviera_control b
     where b.id::text = (storage.foldername(name))[1] and b.vendedor_id = auth.uid())));

-- apagar: o chefe, ou quem a enviou (para desfazer um envio que falhou a meio)
drop policy if exists neg_img_apagar on storage.objects;
create policy neg_img_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'negocio-imagens' and (public.is_admin() or owner = auth.uid()));

-- 3) o comentário guarda os caminhos das imagens; passa a poder ser só imagem, sem texto
alter table public.negocio_historico add column if not exists imagens text[];

drop policy if exists neg_hist_com on public.negocio_historico;
create policy neg_hist_com on public.negocio_historico for insert to public
  with check (tipo = 'comentario'
    and (length(trim(coalesce(texto, ''))) > 0 or coalesce(array_length(imagens, 1), 0) > 0)
    and (imagens is null or not exists (select 1 from unnest(imagens) p where p not like negocio_id::text || '/%'))
    and (public.is_admin() or exists (
      select 1 from public.baviera_control b where b.id = negocio_historico.negocio_id and b.vendedor_id = auth.uid())));

commit;
