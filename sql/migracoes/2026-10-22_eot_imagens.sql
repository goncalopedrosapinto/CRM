-- Baviera Control · Imagens nos comentários das EOTs (2026-10-22)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- As imagens ficam no Storage do Supabase, num "bucket" privado (eot-imagens), numa pasta por contrato.
-- Quem vê e quem pode juntar imagens a uma EOT = quem já vê e comenta essa EOT:
--   chefe, financeiro e o vendedor responsável pelo contrato.
-- Não há links públicos: cada imagem só abre com sessão iniciada e permissão.
-- Plano gratuito: 1 GB de ficheiros. Cada print fica com ~100-300 KB (a plataforma reduz antes de enviar).

begin;

-- 1) bucket privado, até 5 MB por imagem, só imagens
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eot-imagens', 'eot-imagens', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) quem pode ver / juntar / apagar (pasta = nº do contrato)
drop policy if exists eot_img_ler on storage.objects;
create policy eot_img_ler on storage.objects for select to authenticated
  using (bucket_id = 'eot-imagens' and (public.is_admin() or public.is_financeiro() or exists (
    select 1 from public.eot_contratos c
     where c.contrato = (storage.foldername(name))[1] and c.responsavel_id = auth.uid())));

drop policy if exists eot_img_juntar on storage.objects;
create policy eot_img_juntar on storage.objects for insert to authenticated
  with check (bucket_id = 'eot-imagens' and (public.is_admin() or public.is_financeiro() or exists (
    select 1 from public.eot_contratos c
     where c.contrato = (storage.foldername(name))[1] and c.responsavel_id = auth.uid())));

-- apagar: o chefe, ou quem a enviou (para desfazer um envio que falhou a meio)
drop policy if exists eot_img_apagar on storage.objects;
create policy eot_img_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'eot-imagens' and (public.is_admin() or owner = auth.uid()));

-- 3) o comentário guarda os caminhos das imagens; passa a poder ser só imagem, sem texto
alter table public.eot_historico add column if not exists imagens text[];

drop policy if exists eot_hist_com on public.eot_historico;
create policy eot_hist_com on public.eot_historico for insert to public
  with check (tipo = 'comentario'
    and (length(trim(coalesce(texto, ''))) > 0 or coalesce(array_length(imagens, 1), 0) > 0)
    and (imagens is null or not exists (select 1 from unnest(imagens) p where p not like contrato || '/%'))
    and (public.is_admin() or public.is_financeiro() or exists (
      select 1 from public.eot_contratos c where c.contrato = eot_historico.contrato and c.responsavel_id = auth.uid())));

commit;
