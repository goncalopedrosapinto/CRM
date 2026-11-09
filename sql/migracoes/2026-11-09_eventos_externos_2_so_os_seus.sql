-- Baviera Control · Eventos: o perfil externo só vê as inscrições dos vendedores; altera apenas os convidados que registou (2026-11-09)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm), depois de 2026-11-09_eventos_externos. Pode correr duas vezes.
--
-- Antes: o externo completava qualquer inscrição dos eventos a que tem acesso.
-- Agora: lê todas as inscrições desses eventos; cria convidados; muda, apaga e junta/apaga documentos só nos que ele registou.

begin;

drop policy if exists insc_ext_update on public.inscricoes;
create policy insc_ext_update on public.inscricoes for update to authenticated
  using (public.evento_tem_acesso(evento_id) and vendedor_id = auth.uid())
  with check (public.evento_tem_acesso(evento_id) and vendedor_id = auth.uid());

-- documentos: o externo só junta e apaga nos convidados que registou (continua a ver os do evento)
drop policy if exists evt_doc_juntar on storage.objects;
create policy evt_doc_juntar on storage.objects for insert to authenticated
  with check (bucket_id = 'evento-documentos' and exists (select 1 from public.inscricoes i
         where i.evento_id::text = (storage.foldername(name))[1] and i.id::text = (storage.foldername(name))[2]
           and i.docs_consentimento
           and (coalesce(public.meu_role(), '') <> 'eventos' or i.vendedor_id = auth.uid())));
drop policy if exists evt_doc_apagar on storage.objects;
create policy evt_doc_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'evento-documentos' and exists (select 1 from public.inscricoes i
         where i.evento_id::text = (storage.foldername(name))[1] and i.id::text = (storage.foldername(name))[2]
           and (coalesce(public.meu_role(), '') <> 'eventos' or i.vendedor_id = auth.uid())));

commit;
