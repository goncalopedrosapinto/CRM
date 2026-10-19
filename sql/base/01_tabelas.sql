-- Tabelas, chaves, restrições e índices tal como estavam em produção a 2026-10-19 (lido do Supabase, sem dados).
create sequence if not exists public.baviera_control_id_seq;
create sequence if not exists public.comissoes_id_seq;
create sequence if not exists public.eot_historico_id_seq;
create sequence if not exists public.equipamento_id_seq;
create sequence if not exists public.escala_id_seq;
create sequence if not exists public.eventos_id_seq;
create sequence if not exists public.inscricoes_id_seq;
create sequence if not exists public.negocio_historico_id_seq;
create sequence if not exists public.nps_id_seq;
create sequence if not exists public.objetivos_equipa_id_seq;
create sequence if not exists public.objetivos_id_seq;
create sequence if not exists public.premios_config_id_seq;
create sequence if not exists public.status_historico_id_seq;
create sequence if not exists public.status_log_id_seq;
create sequence if not exists public.stock_equip_id_seq;
create sequence if not exists public.stock_norma_id_seq;
create sequence if not exists public.stock_usadas_id_seq;
create table public.baviera_control (  id bigint generated always as identity not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  updated_by uuid default auth.uid(),
  vendedor_id uuid default auth.uid(),
  status text,
  alert_days integer,
  status_updated_at timestamp with time zone,
  id_cliente text,
  resp text,
  local text,
  neg date,
  mes1 text,
  type text,
  origin text,
  profile text,
  biz text,
  fin text,
  model text,
  version text,
  enc text,
  chas text,
  mat text,
  gar text,
  qor integer,
  xev integer,
  bev integer,
  m_flag integer,
  csc integer,
  cme integer,
  cme_confirmed timestamp with time zone,
  col_198 text,
  dmat date,
  col_298 date,
  app date,
  obs text,
  retoma text,
  retoma_mat text,
  motivo_perda text,
  pvp numeric(10,2),
  stock text,
  gar_periodo text,
  flag_ccgo boolean default false,
  flag_rgpd boolean default false,
  flag_seguro boolean default false,
  flag_lifestyle boolean default false,
  obs_gestor text,
  stock_id bigint,
  lead_webapp text,
  alert_date date,
  nif text,
  morada text,
  cc text,
  email text,
  contacto text,
  valor_entrada numeric,
  venda_direta boolean default false not null,
  automatricula boolean default false not null,
  retoma_modelo text,
  campanha text,
  status_mota text,
  recontactar_em date,
  mes1_validado boolean default false not null,
  mes1_pedido text,
  mes1_pedido_em timestamp with time zone,
  mes1_pedido_por uuid);
create table public.comissoes (  id bigint default nextval('comissoes_id_seq'::regclass) not null,
  vendedor_id uuid not null,
  mes text not null,
  descricao text,
  valor numeric default 0 not null,
  created_at timestamp with time zone default now() not null);
create table public.comissoes_fecho (  mes text not null,
  fechado_em timestamp with time zone default now() not null,
  fechado_por uuid default auth.uid());
create table public.entregas (  negocio_id bigint not null,
  docs jsonb default '{}'::jsonb not null,
  docs_obs text,
  prep_pedida boolean default false not null,
  pecas_precisa boolean default false not null,
  pecas_chegaram boolean default false not null,
  pecas_obs text,
  pago boolean default false not null,
  fs_tratado boolean default false not null,
  data_entrega date,
  obs text,
  updated_at timestamp with time zone default now() not null,
  pedido_matricula boolean default false not null);
create table public.eot_contratos (  contrato text not null,
  tipo text,
  cliente text,
  contacto_nome text,
  telefone text,
  telemovel text,
  data_fim date,
  prazo integer,
  prestacao numeric,
  kms text,
  matricula text,
  modelo text,
  seguro text,
  manutencao text,
  residual numeric,
  despesas numeric,
  total numeric,
  concessionario text,
  conc_resp text,
  vendedor_origem text,
  responsavel_id uuid,
  fase text default 'Por contactar'::text not null,
  temperatura text,
  proxima_acao text,
  proxima_data date,
  notas text,
  negocio_id bigint,
  no_mapa boolean default true not null,
  saiu_em timestamp with time zone,
  criado_em timestamp with time zone default now() not null,
  ultima_import timestamp with time zone,
  updated_at timestamp with time zone default now());
create table public.eot_historico (  id bigint generated always as identity not null,
  contrato text not null,
  criado_em timestamp with time zone default now() not null,
  autor_id uuid,
  autor_nome text,
  autor_role text,
  tipo text not null,
  campo text,
  valor_antes text,
  valor_depois text,
  texto text);
create table public.equipamento (  id bigint default nextval('equipamento_id_seq'::regclass) not null,
  vendedor_id uuid not null,
  data date not null,
  wip text,
  fatura text,
  artigo text,
  descricao text,
  qtd numeric default 1 not null,
  custo numeric default 0 not null,
  venda numeric default 0 not null,
  campanha text,
  created_at timestamp with time zone default now() not null,
  estado_stock text);
create table public.escala (  id bigint generated always as identity not null,
  dia date not null,
  vendedor_id uuid not null,
  estado text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  updated_by uuid default auth.uid());
create table public.eventos (  id bigint generated always as identity not null,
  nome text not null,
  data date,
  local text,
  lotacao integer,
  ativo boolean default false not null,
  created_at timestamp with time zone default now(),
  motas jsonb default '[]'::jsonb not null);
create table public.fichas_margem (  negocio_id bigint not null,
  dados jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid default auth.uid());
create table public.inscricoes (  id bigint generated always as identity not null,
  evento_id bigint not null,
  cliente text not null,
  telefone text,
  acompanhantes integer default 0 not null,
  estado text default 'Confirmado'::text not null,
  obs text,
  vendedor_id uuid default auth.uid() not null,
  created_at timestamp with time zone default now(),
  funil text,
  mota text);
create table public.margens (  negocio_id bigint not null,
  margem numeric,
  updated_at timestamp with time zone default now() not null);
create table public.negocio_historico (  id bigint generated always as identity not null,
  negocio_id bigint not null,
  criado_em timestamp with time zone default now() not null,
  autor_id uuid,
  autor_nome text,
  autor_role text,
  tipo text not null,
  campo text,
  valor_antes text,
  valor_depois text,
  texto text);
create table public.nps (  id bigint generated always as identity not null,
  vendedor_id uuid not null,
  mes date not null,
  num_inqueritos integer default 0 not null,
  nps numeric(5,1),
  csi numeric(5,1),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  updated_by uuid default auth.uid());
create table public.objetivos (  id bigint generated always as identity not null,
  vendedor_id uuid not null,
  mes date not null,
  objetivo_unidades integer default 0 not null,
  objetivo_bev integer default 0 not null,
  created_at timestamp with time zone default now());
create table public.objetivos_equipa (  id bigint generated always as identity not null,
  mes date not null,
  tipo text default 'novas'::text not null,
  objetivo integer default 0 not null,
  updated_at timestamp with time zone default now());
create table public.precos_ref (  ref text not null,
  nome_site text,
  tamanho text,
  pvp numeric,
  venda_site numeric,
  url text,
  site_stock boolean,
  no_site boolean,
  lifestyle boolean,
  outlet boolean,
  dress_code boolean,
  categorias text,
  parent bigint,
  site_em timestamp with time zone,
  preco_aveiro numeric,
  preco_aveiro_origem text,
  updated_at timestamp with time zone default now());
create table public.premios_config (  id bigint default nextval('premios_config_id_seq'::regclass) not null,
  escopo text not null,
  pct_min numeric not null,
  valor numeric default 0 not null,
  nota text,
  created_at timestamp with time zone default now() not null);
create table public.premios_mes (  mes text not null,
  dados jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now() not null);
create table public.profiles (  id uuid not null,
  nome text,
  role text default 'vendedor'::text not null,
  created_at timestamp with time zone default now(),
  linha text default 'auto'::text not null,
  financeiro boolean default false not null);
create table public.status_historico (  id bigint generated always as identity not null,
  negocio_id bigint,
  de text,
  para text,
  quem uuid,
  quando timestamp with time zone default now() not null);
create table public.status_log (  id bigint generated always as identity not null,
  registo_id bigint not null,
  status_antigo text,
  status_novo text,
  changed_at timestamp with time zone default now() not null,
  changed_by uuid default auth.uid());
create table public.stock_equip (  id bigint default nextval('stock_equip_id_seq'::regclass) not null,
  lote text not null,
  ponto_venda text,
  polo text,
  ref text not null,
  descricao text,
  marca text,
  familia text,
  subfamilia text,
  categoria text,
  qualidade text,
  antig_saida text,
  ult_saida date,
  qtd numeric,
  custo_unit numeric,
  custo_total numeric,
  procura numeric,
  desc_max numeric,
  importado_em timestamp with time zone default now() not null);
create table public.stock_norma (  id bigint generated always as identity not null,
  ordem integer default 0 not null,
  modelo text not null,
  coluna text default 'M'::text not null,
  estado text default 'Em falta'::text not null,
  matricula text,
  kms integer,
  preco numeric,
  obs text,
  updated_at timestamp with time zone default now(),
  data_matricula date,
  encomenda text,
  tem_seguro boolean default false not null,
  vendida boolean default false not null,
  chassi text,
  pvp numeric,
  maxterauto boolean default false not null);
create table public.stock_usadas (  id bigint generated always as identity not null,
  modelo text not null,
  valor_min numeric(10,2),
  valor_anunciado numeric(10,2),
  maxterauto boolean default false,
  estado text default 'Disponível'::text,
  negociado_por uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  updated_by uuid default auth.uid(),
  categoria text default 'usada'::text,
  kms integer,
  matricula text,
  valor_campanha numeric(10,2),
  tem_seguro boolean default false not null,
  seguro_anulado boolean default false not null,
  valor_entrada numeric,
  ano smallint,
  data_rececao date,
  consignada boolean default false not null,
  dep_manual numeric,
  dep_prep numeric,
  venda_ficticia numeric,
  prep_oficina numeric,
  prep_garantia numeric,
  prep_legalizacao numeric,
  prep_comissao numeric);
alter table public.baviera_control add constraint baviera_control_pkey PRIMARY KEY (id);
alter table public.comissoes_fecho add constraint comissoes_fecho_mes_check CHECK ((mes ~ '^\d{4}/\d{2}$'::text));
alter table public.comissoes_fecho add constraint comissoes_fecho_pkey PRIMARY KEY (mes);
alter table public.comissoes add constraint comissoes_pkey PRIMARY KEY (id);
alter table public.entregas add constraint entregas_pkey PRIMARY KEY (negocio_id);
alter table public.eot_contratos add constraint eot_contratos_pkey PRIMARY KEY (contrato);
alter table public.eot_historico add constraint eot_historico_pkey PRIMARY KEY (id);
alter table public.eot_historico add constraint eot_historico_tipo_check CHECK ((tipo = ANY (ARRAY['comentario'::text, 'alteracao'::text, 'sistema'::text])));
alter table public.equipamento add constraint equipamento_pkey PRIMARY KEY (id);
alter table public.escala add constraint escala_dia_vendedor_id_key UNIQUE (dia, vendedor_id);
alter table public.escala add constraint escala_estado_check CHECK ((estado = ANY (ARRAY['Stand'::text, 'Apoio'::text, 'Livre'::text, 'Folga'::text, 'Férias'::text, 'Ausente'::text, 'Formação'::text])));
alter table public.escala add constraint escala_pkey PRIMARY KEY (id);
alter table public.eventos add constraint eventos_pkey PRIMARY KEY (id);
alter table public.fichas_margem add constraint fichas_margem_pkey PRIMARY KEY (negocio_id);
alter table public.inscricoes add constraint inscricoes_pkey PRIMARY KEY (id);
alter table public.margens add constraint margens_pkey PRIMARY KEY (negocio_id);
alter table public.negocio_historico add constraint negocio_historico_pkey PRIMARY KEY (id);
alter table public.negocio_historico add constraint negocio_historico_tipo_check CHECK ((tipo = ANY (ARRAY['comentario'::text, 'alteracao'::text, 'criacao'::text])));
alter table public.nps add constraint nps_mes_check CHECK ((EXTRACT(day FROM mes) = (1)::numeric));
alter table public.nps add constraint nps_pkey PRIMARY KEY (id);
alter table public.nps add constraint nps_vendedor_id_mes_key UNIQUE (vendedor_id, mes);
alter table public.objetivos_equipa add constraint objetivos_equipa_mes_tipo_key UNIQUE (mes, tipo);
alter table public.objetivos_equipa add constraint objetivos_equipa_pkey PRIMARY KEY (id);
alter table public.objetivos add constraint objetivos_mes_check CHECK ((EXTRACT(day FROM mes) = (1)::numeric));
alter table public.objetivos add constraint objetivos_pkey PRIMARY KEY (id);
alter table public.objetivos add constraint objetivos_vendedor_id_mes_key UNIQUE (vendedor_id, mes);
alter table public.precos_ref add constraint precos_ref_pkey PRIMARY KEY (ref);
alter table public.premios_config add constraint premios_config_escopo_check CHECK ((escopo = ANY (ARRAY['mensal'::text, 'trimestral'::text])));
alter table public.premios_config add constraint premios_config_pkey PRIMARY KEY (id);
alter table public.premios_mes add constraint premios_mes_pkey PRIMARY KEY (mes);
alter table public.profiles add constraint profiles_linha_check CHECK ((linha = ANY (ARRAY['motorrad'::text, 'auto'::text])));
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'vendedor'::text, 'assessor'::text, 'secretario'::text, 'financeiro'::text])));
alter table public.status_historico add constraint status_historico_pkey PRIMARY KEY (id);
alter table public.status_log add constraint status_log_pkey PRIMARY KEY (id);
alter table public.stock_equip add constraint stock_equip_pkey PRIMARY KEY (id);
alter table public.stock_norma add constraint stock_norma_pkey PRIMARY KEY (id);
alter table public.stock_usadas add constraint stock_usadas_categoria_check CHECK ((categoria = ANY (ARRAY['usada'::text, 'demo'::text])));
alter table public.stock_usadas add constraint stock_usadas_estado_check CHECK ((estado = ANY (ARRAY['Disponível'::text, 'A negociar'::text, 'Vendida'::text])));
alter table public.stock_usadas add constraint stock_usadas_pkey PRIMARY KEY (id);
alter table public.baviera_control add constraint baviera_control_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES stock_usadas(id) ON DELETE SET NULL;
alter table public.baviera_control add constraint baviera_control_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
alter table public.baviera_control add constraint baviera_control_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id);
alter table public.entregas add constraint entregas_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES baviera_control(id) ON DELETE CASCADE;
alter table public.eot_contratos add constraint eot_contratos_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.eot_historico add constraint eot_historico_contrato_fkey FOREIGN KEY (contrato) REFERENCES eot_contratos(contrato) ON DELETE CASCADE;
alter table public.escala add constraint escala_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
alter table public.escala add constraint escala_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.fichas_margem add constraint fichas_margem_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES baviera_control(id) ON DELETE CASCADE;
alter table public.inscricoes add constraint inscricoes_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE;
alter table public.inscricoes add constraint inscricoes_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id);
alter table public.margens add constraint margens_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES baviera_control(id) ON DELETE CASCADE;
alter table public.negocio_historico add constraint negocio_historico_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES baviera_control(id) ON DELETE CASCADE;
alter table public.nps add constraint nps_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
alter table public.nps add constraint nps_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.objetivos add constraint objetivos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.status_historico add constraint status_historico_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES baviera_control(id) ON DELETE CASCADE;
alter table public.status_log add constraint status_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id);
alter table public.status_log add constraint status_log_registo_id_fkey FOREIGN KEY (registo_id) REFERENCES baviera_control(id) ON DELETE CASCADE;
alter table public.stock_usadas add constraint stock_usadas_negociado_por_fkey FOREIGN KEY (negociado_por) REFERENCES profiles(id);
alter table public.stock_usadas add constraint stock_usadas_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
alter table public.baviera_control enable row level security;
alter table public.comissoes enable row level security;
alter table public.comissoes_fecho enable row level security;
alter table public.entregas enable row level security;
alter table public.eot_contratos enable row level security;
alter table public.eot_historico enable row level security;
alter table public.equipamento enable row level security;
alter table public.escala enable row level security;
alter table public.eventos enable row level security;
alter table public.fichas_margem enable row level security;
alter table public.inscricoes enable row level security;
alter table public.margens enable row level security;
alter table public.negocio_historico enable row level security;
alter table public.nps enable row level security;
alter table public.objetivos enable row level security;
alter table public.objetivos_equipa enable row level security;
alter table public.precos_ref enable row level security;
alter table public.premios_config enable row level security;
alter table public.premios_mes enable row level security;
alter table public.profiles enable row level security;
alter table public.status_historico enable row level security;
alter table public.status_log enable row level security;
alter table public.stock_equip enable row level security;
alter table public.stock_norma enable row level security;
alter table public.stock_usadas enable row level security;
CREATE INDEX eot_historico_contrato_idx ON public.eot_historico USING btree (contrato, criado_em DESC);
CREATE INDEX eot_resp_idx ON public.eot_contratos USING btree (responsavel_id);
CREATE INDEX idx_baviera_control_updated_at ON public.baviera_control USING btree (updated_at DESC);
CREATE INDEX idx_baviera_control_vendedor ON public.baviera_control USING btree (vendedor_id);
CREATE INDEX idx_bc_campanha ON public.baviera_control USING btree (campanha) WHERE (campanha IS NOT NULL);
CREATE INDEX idx_escala_dia ON public.escala USING btree (dia);
CREATE INDEX idx_sh_negocio ON public.status_historico USING btree (negocio_id);
CREATE INDEX idx_sh_quando ON public.status_historico USING btree (quando);
CREATE INDEX idx_status_log_changed ON public.status_log USING btree (changed_at DESC);
CREATE INDEX idx_status_log_registo ON public.status_log USING btree (registo_id);
CREATE INDEX negocio_historico_com_idx ON public.negocio_historico USING btree (criado_em DESC) WHERE (tipo = 'comentario'::text);
CREATE INDEX negocio_historico_neg_idx ON public.negocio_historico USING btree (negocio_id, criado_em DESC);
CREATE INDEX stock_equip_lote_idx ON public.stock_equip USING btree (lote);