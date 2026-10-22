-- Baviera Control · EOTs: adenda conta como renovado e o contrato volta ao radar (2026-10-22)
-- Corre uma vez no SQL Editor do Supabase (projeto fyieckrmdrorjoevmrhm). Pode correr duas vezes sem estragar nada.
--
-- Uma adenda prolonga o contrato com o mesmo número. Quando o mapa do banco trouxer esse contrato com uma
-- data de fim nova, a importação volta a pô-lo em "Por contactar" (para avisar quando o novo fim se aproximar)
-- e grava aqui a data. Assim a adenda continua a contar como renovado mesmo depois de o contrato reabrir.
-- Só o chefe/financeiro mexe nesta coluna (o trigger eot_proteger já desfaz alterações de vendedores).

begin;

alter table public.eot_contratos add column if not exists adenda_em date;

comment on column public.eot_contratos.adenda_em is
  'Data em que o mapa trouxe a nova data de fim de um contrato com adenda (conta como renovado).';

commit;
