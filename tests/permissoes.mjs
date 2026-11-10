// Matriz de permissões: tabela × operação × perfil, na base de ensaio (esquema real + migrações pendentes).
// Cada célula corre dentro de uma transação que é sempre anulada. Falha (código 1) se alguma célula não der o esperado.
import {baseDeEnsaio} from './base.mjs';

const U={chefe:'00000000-0000-0000-0000-0000000000a1',vend:'00000000-0000-0000-0000-0000000000b1',vend2:'00000000-0000-0000-0000-0000000000b2',
  sec:'00000000-0000-0000-0000-0000000000c1',assSec:'00000000-0000-0000-0000-0000000000d2',secPrev:'00000000-0000-0000-0000-0000000000c2',ass:'00000000-0000-0000-0000-0000000000d1',fin:'00000000-0000-0000-0000-0000000000e1',novo:'00000000-0000-0000-0000-0000000000f1'};
const {db,pendentes}=await baseDeEnsaio();

// ---------- dados fictícios (como servidor, sem utilizador) ----------
const perfis=[['chefe','admin'],['vend','vendedor'],['vend2','vendedor'],['sec','secretario'],['ass','assessor'],['fin','financeiro'],['assSec','assessor'],['secPrev','secretario']];
for(const [k,role] of perfis){
  await db.query("insert into auth.users(id,email) values($1,$2)",[U[k],k+'@teste.pt']);
  await db.query("update public.profiles set role=$2, linha='motorrad', nome=$3 where id=$1",[U[k],role,k]);
}
await db.query("update public.profiles set areas=array['secretaria'] where id=$1",[U.assSec]);
await db.query("update public.profiles set areas=array['previsao'] where id=$1",[U.secPrev]);
await db.query("insert into public.objetivos_equipa(mes,tipo,objetivo) values('2026-10-01','novas',9)");
await db.query("insert into auth.users(id,email) values($1,'novo@teste.pt')",[U.novo]); // conta nova: fica com o perfil que o trigger lhe der
const neg=async(v,s)=>(await db.query("insert into public.baviera_control(vendedor_id,status,id_cliente,obs_gestor,col_298) values($1,$2,'Cliente','nota do chefe','2026-09-10') returning id",[v,s])).rows[0].id;
const N={retail:await neg(U.vend,'Retail'),carteira:await neg(U.vend,'Carteira'),exCarteira:await neg(U.vend,'Carteira'),frio:await neg(U.vend,'Frio'),comFicha:await neg(U.vend,'Quente'),retail2:await neg(U.vend2,'Retail')};
await db.query("update public.baviera_control set status='Quente' where id=$1",[N.exCarteira]);
await db.query("insert into public.margens(negocio_id,margem) values($1,500),($2,700)",[N.retail,N.retail2]);
await db.query("insert into public.fichas_margem(negocio_id,dados) values($1,'{}')",[N.comFicha]);
await db.query("insert into public.entregas(negocio_id) values($1)",[N.retail]);
await db.query("insert into public.stock_norma(modelo,matricula,kms) values('R 1300 GS','AA-00-AA',1200)");
await db.query("insert into public.stock_usadas(modelo,estado,kms) values('R nineT','Disponível',20000)");
await db.query("insert into public.eventos(nome) values('Test ride')");
await db.query("insert into public.eot_contratos(contrato,cliente,responsavel_id) values('C1','Cliente EOT',$1),('C2','Outro',$2)",[U.vend,U.vend2]);
await db.query("insert into public.stock_equip(lote,ref,custo_unit) values('L1','REF1',10)");
await db.query("insert into public.precos_ref(ref,pvp) values('REF1',20)");
await db.query("insert into public.equipamento(vendedor_id,data,custo,venda) values($1,'2026-09-10',10,20)",[U.vend]);
await db.query("insert into public.encomendas_bmw(production_number,model_code,customer_last) values('8000001','0M21','Cliente')");
N.v2q=await neg(U.vend2,'Quente');
await db.query("insert into storage.objects(bucket_id,name,owner) values('eot-imagens','C1/foto.webp',$1),('eot-imagens','C2/foto.webp',$2)",[U.vend,U.vend2]);
await db.query("insert into storage.objects(bucket_id,name,owner) values('negocio-imagens',$1,$2),('negocio-imagens',$3,$4)",[N.frio+'/foto.webp',U.vend,N.v2q+'/foto.webp',U.vend2]);
await db.exec("set session_replication_role = replica"); // dados de partida: inclui uma encomenda repetida antiga, como existe em produção
await db.query(`update public.baviera_control set enc='7000001' where id=${N.v2q}`);
await db.query(`update public.baviera_control set enc='7000005' where id in (${N.carteira},${N.retail2})`);
await db.exec("set session_replication_role = origin");

// eventos: perfil externo com acesso só ao «Test ride»; outro externo sem acessos
U.evt='00000000-0000-0000-0000-000000000901';U.evt2='00000000-0000-0000-0000-000000000902';
await db.query("insert into auth.users(id,email) values($1,'evt@teste.pt'),($2,'evt2@teste.pt')",[U.evt,U.evt2]);
await db.query("update public.profiles set role='eventos', nome='Externo' where id in ($1,$2)",[U.evt,U.evt2]);
const EV1=(await db.query("select id from public.eventos where nome='Test ride'")).rows[0].id;
const EV2=(await db.query("insert into public.eventos(nome) values('Passeio') returning id")).rows[0].id;
await db.query("insert into public.evento_acessos(evento_id,user_id) values($1,$2)",[EV1,U.evt]);
const insc=async(ev,v,c)=>(await db.query("insert into public.inscricoes(evento_id,cliente,vendedor_id,funil) values($1,$2,$3,'Quente') returning id",[ev,c,v])).rows[0].id;
const I1=await insc(EV1,U.vend,'Cliente do vendedor'),I2=await insc(EV2,U.vend2,'Cliente do colega'),I3=await insc(EV1,U.evt,'Cliente do externo');
await db.query("insert into storage.objects(bucket_id,name,owner) values('evento-documentos',$1,$2),('evento-documentos',$3,$4)",[EV1+'/'+I1+'/cc.pdf',U.vend,EV2+'/'+I2+'/cc.pdf',U.vend2]);
// ---------- motor ----------
async function como(quem,fn){
  await db.exec('begin');
  try{
    if(quem==='anon')await db.exec(`select set_config('request.jwt.claims','{"role":"anon"}',true); set local role anon;`);
    else await db.exec(`select set_config('request.jwt.claims','{"sub":"${U[quem]}","role":"authenticated"}',true); set local role authenticated;`);
    return await fn();
  }catch(e){return /permission denied|Sem permissão|row-level security|42501/i.test(e.message)?'recusado':'ERRO: '+e.message.slice(0,90);}
  finally{await db.exec('rollback');}
}
const n=async q=>Number((await db.query(q)).rows[0].n);
const conta=t=>()=>n(`select count(*) n from public.${t}`);
const apaga=(where)=>()=>n(`with d as (delete from public.baviera_control where ${where} returning 1) select count(*) n from d`);
const ok=async q=>{await db.query(q);return 'consegue';};
const bloq=q=>async()=>{try{await db.query(q);return 'passou';}catch(e){return /já está/.test(e.message)?'bloqueado':'ERRO: '+e.message.slice(0,90);}};

const C=[ // [área, perfil, descrição, função, esperado]
  ['anónimo','anon','lê negócios',conta('baviera_control'),'recusado'],
  ['vendedor','vend','fixa a própria comissão',()=>n(`with u as (update public.margens set comissao_fixa=999 where negocio_id=${N.retail} returning 1) select count(*) n from u`),0],
  ['vendedor','vend','lê a comissão fixa do seu negócio',async()=>{await db.exec('reset role');await db.query(`update public.margens set comissao_fixa=150 where negocio_id=${N.retail}`);await db.exec('set local role authenticated');return n(`select count(*) n from public.margens where comissao_fixa=150`);},1],
  ['chefe','chefe','fixa a comissão de um negócio',()=>n(`with u as (update public.margens set comissao_fixa=150 where negocio_id=${N.retail} returning 1) select count(*) n from u`),1],
  ['chefe','chefe','comissão fixa negativa é recusada',async()=>{await db.exec('savepoint s');try{await db.query(`update public.margens set comissao_fixa=-1 where negocio_id=${N.retail}`);return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return 'recusado';}},'recusado'],
  ['eventos','evt','lê negócios',conta('baviera_control'),0],
  ['eventos','evt','lê só os eventos a que tem acesso',conta('eventos'),1],
  ['eventos','evt','lê as inscrições desses eventos (também dos vendedores)',conta('inscricoes'),2],
  ['eventos','evt','inscreve cliente num evento seu',()=>ok(`insert into public.inscricoes(evento_id,cliente,vendedor_id) values(${EV1},'Novo',auth.uid())`),'consegue'],
  ['eventos','evt','inscreve cliente noutro evento',()=>ok(`insert into public.inscricoes(evento_id,cliente,vendedor_id) values(${EV2},'Novo',auth.uid())`),'recusado'],
  ['eventos','evt','inscreve em nome de um vendedor',()=>ok(`insert into public.inscricoes(evento_id,cliente,vendedor_id) values(${EV1},'Novo','${U.vend}')`),'recusado'],
  ['eventos','evt','altera uma inscrição do vendedor (só leitura)',()=>n(`with u as (update public.inscricoes set nif='123456789',pendura=true,pendura_nome='Pendura' where id=${I1} returning 1) select count(*) n from u`),0],
  ['eventos','evt','completa a ficha de um convidado que registou',()=>n(`with u as (update public.inscricoes set nif='123456789',pendura=true,pendura_nome='Pendura' where id=${I3} returning 1) select count(*) n from u`),1],
  ['eventos','evt','passa um convidado seu para outro evento',()=>ok(`update public.inscricoes set evento_id=${EV2} where id=${I3}`),'recusado'],
  ['eventos','evt','passa um convidado seu para um vendedor',()=>ok(`update public.inscricoes set vendedor_id='${U.vend}' where id=${I3}`),'recusado'],
  ['eventos','evt','apaga inscrição do vendedor',()=>n(`with d as (delete from public.inscricoes where id=${I1} returning 1) select count(*) n from d`),0],
  ['eventos','evt','apaga inscrição que registou',()=>n(`with d as (delete from public.inscricoes where id=${I3} returning 1) select count(*) n from d`),1],
  ['eventos','evt','lê escala, configurações e fecho de comissões',async()=>[await n('select count(*) n from public.escala'),await n('select count(*) n from public.configuracoes'),await n('select count(*) n from public.comissoes_fecho')].join('/'),'0/0/0'],
  ['eventos','evt','lê perfis (só o seu)',conta('profiles'),1],
  ['eventos','evt','lê stock, demos e inscrições da equipa (vistas)',async()=>[await n('select count(*) n from public.stock_usadas_publico'),await n('select count(*) n from public.stock_norma_publico'),await n('select count(*) n from public.inscricoes_publico')].join('/'),'0/0/0'],
  ['eventos','evt','ranking de evento sem acesso',()=>n(`select count(*) n from public.inscricoes_ranking(${EV2})`),0],
  ['eventos','evt','nomes de quem registou: no seu evento / noutro',async()=>(await n(`select count(*) n from public.evento_registos(${EV1})`))+'/'+(await n(`select count(*) n from public.evento_registos(${EV2})`)),'2/0'],
  ['eventos','evt','dá a si próprio acesso a outro evento',()=>ok(`insert into public.evento_acessos(evento_id,user_id) values(${EV2},auth.uid())`),'recusado'],
  ['eventos','evt','muda o próprio perfil para chefe',async()=>{await db.query("update public.profiles set role='admin' where id=auth.uid()");return n("select count(*) n from public.profiles where id=auth.uid() and role='admin'");},0],
  ['eventos','evt','dá perfis (função do chefe)',()=>ok(`select public.perfil_eventos('${U.novo}',true)`),'recusado'],
  ['eventos','evt','vê documentos (só do seu evento)',()=>n("select count(*) n from storage.objects where bucket_id='evento-documentos'"),1],
  ['eventos','evt','junta documento sem consentimento',()=>ok(`insert into storage.objects(bucket_id,name) values('evento-documentos','${EV1}/${I3}/carta.pdf')`),'recusado'],
  ['eventos','evt','junta documento com consentimento (convidado seu)',async()=>{await db.query(`update public.inscricoes set docs_consentimento=true where id=${I3}`);return ok(`insert into storage.objects(bucket_id,name) values('evento-documentos','${EV1}/${I3}/carta.pdf')`);},'consegue'],
  ['eventos','evt','junta documento numa inscrição do vendedor',async()=>{await db.exec('reset role');await db.query(`update public.inscricoes set docs_consentimento=true where id=${I1}`);await db.exec('set local role authenticated');return ok(`insert into storage.objects(bucket_id,name) values('evento-documentos','${EV1}/${I1}/carta.pdf')`);},'recusado'],
  ['eventos','evt','apaga documento de uma inscrição do vendedor',()=>n(`with d as (delete from storage.objects where bucket_id='evento-documentos' and name like '${EV1}/${I1}/%' returning 1) select count(*) n from d`),0],
  ['eventos','evt','junta documento noutro evento',()=>ok(`insert into storage.objects(bucket_id,name) values('evento-documentos','${EV2}/${I2}/x.pdf')`),'recusado'],
  ['eventos','evt2','sem acessos: eventos / inscrições',async()=>(await n('select count(*) n from public.eventos'))+'/'+(await n('select count(*) n from public.inscricoes')),'0/0'],
  ['vendedor','vend','não lê a inscrição registada pelo externo',conta('inscricoes'),1],
  ['vendedor','vend','muda quem registou a sua inscrição',()=>ok(`update public.inscricoes set vendedor_id='${U.vend2}' where id=${I1}`),'recusado'],
  ['vendedor','vend','vê documentos (só das suas inscrições)',()=>n("select count(*) n from storage.objects where bucket_id='evento-documentos'"),1],
  ['vendedor','vend','dá acesso externo a um evento',()=>ok(`insert into public.evento_acessos(evento_id,user_id) values(${EV2},'${U.evt}')`),'recusado'],
  ['conta nova','novo','inscreve cliente num evento',()=>ok(`insert into public.inscricoes(evento_id,cliente,vendedor_id) values(${EV1},'X',auth.uid())`),'recusado'],
  ['chefe','chefe','muda quem registou',()=>n(`with u as (update public.inscricoes set vendedor_id='${U.vend2}' where id=${I1} returning 1) select count(*) n from u`),1],
  ['chefe','chefe','dá acesso externo a um evento',()=>ok(`insert into public.evento_acessos(evento_id,user_id) values(${EV2},'${U.evt}')`),'consegue'],
  ['chefe','chefe','dá o perfil Eventos a uma conta nova',()=>db.query(`select public.perfil_eventos('${U.novo}',true) r`).then(r=>r.rows[0].r),'eventos'],
  ['chefe','chefe','não transforma um vendedor em Eventos',async()=>{await db.exec('savepoint s');try{await db.query(`select public.perfil_eventos('${U.vend}',true)`);return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return 'recusado';}},'recusado'],
  ['chefe','chefe','tira o perfil Eventos (e os acessos)',async()=>{await db.query(`select public.perfil_eventos('${U.evt}',false)`);return (await n(`select count(*) n from public.evento_acessos where user_id='${U.evt}'`))+'/'+(await db.query(`select role from public.profiles where id='${U.evt}'`)).rows[0].role;},'0/pendente'],
  ['chefe','chefe','documentos sem consentimento são recusados',async()=>{await db.exec('savepoint s');try{await db.query(`update public.inscricoes set docs='[{"tipo":"cc"}]'::jsonb, docs_consentimento=false where id=${I1}`);return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return 'recusado';}},'recusado'],
  ['chefe','chefe','NIF inválido é recusado',async()=>{await db.exec('savepoint s');try{await db.query(`update public.inscricoes set nif='12AB' where id=${I1}`);return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return 'recusado';}},'recusado'],
  ['anónimo','anon','lê margens',conta('margens'),'recusado'],
  ['anónimo','anon','lê perfis',conta('profiles'),'recusado'],
  ['anónimo','anon','lê eventos',conta('eventos'),'recusado'],
  ['anónimo','anon','lê demos (vista)',conta('stock_norma_publico'),'recusado'],
  ['anónimo','anon','lê negócios (vista secretaria)',conta('negocios_secretaria'),'recusado'],
  ['anónimo','anon','muda kms de demo',()=>ok('select public.norma_vend_kms(1,0)'),'recusado'],
  ['anónimo','anon','muda kms de usada',()=>ok('select public.stock_vend_kms(1,0)'),'recusado'],
  ['anónimo','anon','vê ranking de inscrições',()=>ok('select * from public.inscricoes_ranking(1)'),'recusado'],
  ['anónimo','anon','grava erro',()=>ok("insert into public.erros_cliente(mensagem) values('x')"),'recusado'],

  ['vendedor','vend','lê os seus negócios',conta('baviera_control'),5],
  ['vendedor','vend','lê a nota do chefe (de propósito, só leitura)',()=>n("select count(*) n from public.baviera_control where obs_gestor is not null"),5],
  ['vendedor','vend','reescreve a nota do chefe',async()=>{await db.query("update public.baviera_control set obs_gestor='X'");return n("select count(*) n from public.baviera_control where obs_gestor='X'");},0],
  ['vendedor','vend','edita os seus negócios',async()=>{await db.query("update public.baviera_control set obs='editado'");return n("select count(*) n from public.baviera_control where obs='editado'");},5],
  ['vendedor','vend','edita negócio do colega',()=>n(`with u as (update public.baviera_control set obs='x' where id=${N.retail2} returning 1) select count(*) n from u`),0],
  ['vendedor','vend','passa negócio para o colega',()=>ok(`update public.baviera_control set vendedor_id='${U.vend2}' where id=${N.frio}`),'recusado'],
  ['vendedor','vend','apaga Retail',apaga(`id=${N.retail}`),0],
  ['vendedor','vend','apaga Carteira',apaga(`id=${N.carteira}`),0],
  ['vendedor','vend','apaga negócio que já foi Carteira',apaga(`id=${N.exCarteira}`),0],
  ['vendedor','vend','apaga negócio com ficha de margem',apaga(`id=${N.comFicha}`),0],
  ['vendedor','vend','apaga negócio frio sem histórico de venda',apaga(`id=${N.frio}`),1],
  ['vendedor','vend','lê margens',conta('margens'),1],
  ['vendedor','vend','grava margem',()=>ok(`insert into public.margens(negocio_id,margem) values(${N.carteira},1)`),'recusado'],
  ['vendedor','vend','regista equipamento em seu nome',()=>ok(`insert into public.equipamento(vendedor_id,data,custo,venda) values('${U.vend}','2026-10-01',1,2)`),'consegue'],
  ['vendedor','vend','regista equipamento em nome do colega',()=>ok(`insert into public.equipamento(vendedor_id,data,custo,venda) values('${U.vend2}','2026-10-01',1,2)`),'recusado'],
  ['vendedor','vend','altera linha de equipamento',()=>n("with u as (update public.equipamento set venda=999 returning 1) select count(*) n from u"),0],
  ['vendedor','vend','lê EOTs (só as suas)',conta('eot_contratos'),1],
  ['vendedor','vend','muda kms de demo',()=>ok('select public.norma_vend_kms(1,1300)'),'consegue'],
  ['vendedor','vend','muda estado de usada',()=>ok("select public.stock_mudar_estado(1,'A negociar',true)"),'consegue'],
  ['vendedor','vend','lê demos (vista)',conta('stock_norma_publico'),1],
  ['vendedor','vend','muda o próprio perfil para chefe',async()=>{await db.query("update public.profiles set role='admin' where id=auth.uid()");return (await db.query('select role from public.profiles where id=auth.uid()')).rows[0].role;},'vendedor'],
  ['vendedor','vend','fecha mês de comissões',()=>ok("insert into public.comissoes_fecho(mes) values('2026/09')"),'recusado'],
  ['vendedor','vend','grava erro do browser',()=>ok("insert into public.erros_cliente(mensagem) values('teste')"),'consegue'],
  ['vendedor','vend','grava erro em nome de outro (fica em nome dele)',async()=>{await db.query(`insert into public.erros_cliente(mensagem,user_id) values('t','${U.chefe}')`);return (await db.query("select count(*) n from public.erros_cliente")).rows[0].n;},0],
  ['vendedor','vend','lê erros do browser',conta('erros_cliente'),0],

  ['secretário','sec','lê negócios diretamente',conta('baviera_control'),0],
  ['secretário','sec','lê vista secretaria (Carteira + Retail)',conta('negocios_secretaria'),3],
  ['secretário','sec','lê margens',conta('margens'),0],
  ['secretário','sec','muda estado de usada',()=>ok("select public.stock_mudar_estado(1,'Vendida',false)"),'recusado'],
  ['secretário','sec','muda kms de demo',()=>ok('select public.norma_vend_kms(1,9)'),'recusado'],

  ['assessor','ass','lê stock de equipamento',conta('stock_equip'),1],
  ['assessor','ass','lê negócios',conta('baviera_control'),0],
  ['assessor','ass','lê margens',conta('margens'),0],
  ['assessor','ass','muda estado de usada',()=>ok("select public.stock_mudar_estado(1,'Vendida',false)"),'recusado'],

  ['assessor','ass','lê vista secretaria (sem área extra)',conta('negocios_secretaria'),0],
  ['assessor','ass','dá a si próprio a área secretaria',async()=>{await db.query("update public.profiles set areas=array['secretaria'] where id=auth.uid()");return (await db.query('select areas from public.profiles where id=auth.uid()')).rows[0].areas.length;},0],
  ['ass.+secret.','assSec','lê vista secretaria (com área extra)',conta('negocios_secretaria'),3],
  ['ass.+secret.','assSec','lê entregas (vista)',conta('entregas_publico'),1],
  ['ass.+secret.','assSec','lê stock de equipamento',conta('stock_equip'),1],
  ['ass.+secret.','assSec','regista equipamento em seu nome',()=>ok(`insert into public.equipamento(vendedor_id,data,custo,venda) values('${U.assSec}','2026-10-01',1,2)`),'consegue'],
  ['ass.+secret.','assSec','lê negócios diretamente (NIF, CC, notas)',conta('baviera_control'),0],
  ['ass.+secret.','assSec','lê margens',conta('margens'),0],
  ['secretário','sec','lê objetivos de equipa (sem área)',conta('objetivos_equipa'),0],
  ['secr.+previsão','secPrev','lê objetivos de equipa',conta('objetivos_equipa'),1],
  ['secr.+previsão','secPrev','altera objetivo de equipa',()=>n("with u as (update public.objetivos_equipa set objetivo=99 returning 1) select count(*) n from u"),0],
  ['vendedor','vend','lê objetivos de equipa',conta('objetivos_equipa'),0],
  ['vendedor','vend','lê margem variável (configurações)',conta('configuracoes'),1],
  ['vendedor','vend','altera margem variável',()=>n("with u as (update public.configuracoes set valor='9' returning 1) select count(*) n from u"),0],
  ['vendedor','vend','cria configuração',()=>ok("insert into public.configuracoes(chave,valor) values('x','1')"),'recusado'],
  ['anónimo','anon','lê configurações',conta('configuracoes'),'recusado'],
  ['chefe','chefe','altera margem variável',()=>n("with u as (update public.configuracoes set valor='4' returning 1) select count(*) n from u"),1],
  ['financeiro','fin','lê EOTs (todas)',conta('eot_contratos'),2],
  ['financeiro','fin','lê negócios',conta('baviera_control'),0],
  ['financeiro','fin','lê margens',conta('margens'),0],

  ['conta nova','novo','perfil com que entra',()=>db.query('select role from public.profiles where id=auth.uid()').then(r=>r.rows[0].role),'pendente'],
  ['conta nova','novo','cria negócio',()=>ok("insert into public.baviera_control(vendedor_id,status) values(auth.uid(),'Quente')"),'recusado'],
  ['conta nova','novo','lê margens',conta('margens'),0],
  ['conta nova','novo','lê demos (vista)',conta('stock_norma_publico'),0],
  ['conta nova','novo','lê stock de equipamento',conta('stock_equip'),0],

  ['chefe','chefe','lê todos os negócios',conta('baviera_control'),7],
  ['chefe','chefe','lê todas as margens',conta('margens'),2],
  ['chefe','chefe','reescreve nota',async()=>{await db.query(`update public.baviera_control set obs_gestor='nova' where id=${N.retail}`);return n("select count(*) n from public.baviera_control where obs_gestor='nova'");},1],
  ['chefe','chefe','apaga Retail',apaga(`id=${N.retail}`),1],
  ['chefe','chefe','fecha mês de comissões',()=>ok("insert into public.comissoes_fecho(mes) values('2026/09')"),'consegue'],
  ['chefe','chefe','lê resumo de erros',()=>ok('select * from public.erros_resumo(7)'),'consegue'],
  ['anónimo','anon','lê encomendas BMW',conta('encomendas_bmw'),'recusado'],
  ['anónimo','anon','substitui encomendas BMW',()=>ok(`select public.encomendas_bmw_substituir('[{"production_number":"1"}]')`),'recusado'],
  ['vendedor','vend','lê encomendas BMW',conta('encomendas_bmw'),1],
  ['vendedor','vend','substitui encomendas BMW',()=>ok(`select public.encomendas_bmw_substituir('[{"production_number":"1"}]')`),'recusado'],
  ['vendedor','vend','acrescenta encomenda diretamente',()=>ok("insert into public.encomendas_bmw(production_number) values('9')"),'recusado'],
  ['vendedor','vend','altera encomenda diretamente',()=>ok("update public.encomendas_bmw set customer_last='X'"),'recusado'],
  ['secretário','sec','lê encomendas BMW',conta('encomendas_bmw'),0],
  ['assessor','ass','lê encomendas BMW',conta('encomendas_bmw'),0],
  ['ass.+secret.','assSec','lê encomendas BMW',conta('encomendas_bmw'),0],
  ['financeiro','fin','lê encomendas BMW',conta('encomendas_bmw'),0],
  ['conta nova','novo','lê encomendas BMW',conta('encomendas_bmw'),0],
  ['chefe','chefe','lê encomendas BMW',conta('encomendas_bmw'),1],
  ['anónimo','anon','lê quem negoceia cada mota',()=>n('select count(*) n from public.encomendas_reservas()'),'recusado'],
  ['vendedor','vend','lê quem negoceia cada mota (sem clientes)',()=>n('select count(*) n from public.encomendas_reservas()'),3],
  ['secretário','sec','lê quem negoceia cada mota',()=>n('select count(*) n from public.encomendas_reservas()'),0],
  ['vendedor','vend','reserva mota livre no seu negócio Quente',()=>n(`with u as (update public.baviera_control set enc='7000009' where id=${N.comFicha} returning 1) select count(*) n from u`),1],
  ['vendedor','vend','reserva mota que o colega está a negociar',bloq(`update public.baviera_control set enc='7000001' where id=${N.comFicha}`),'bloqueado'],
  ['vendedor','vend','reserva mota que já está noutro negócio seu',bloq(`update public.baviera_control set enc='7000005' where id=${N.comFicha}`),'bloqueado'],
  ['vendedor','vend','negócio Perdido com a mesma mota não bloqueia',()=>ok("insert into public.baviera_control(vendedor_id,status,id_cliente,enc) values(auth.uid(),'Perdido','X','7000001')"),'consegue'],
  ['vendedor','vend','reabre Perdido como Quente com mota do colega',async()=>{const id=(await db.query("insert into public.baviera_control(vendedor_id,status,id_cliente,enc) values(auth.uid(),'Perdido','X','7000001') returning id")).rows[0].id;return bloq(`update public.baviera_control set status='Quente' where id=${id}`)();},'bloqueado'],
  ['vendedor','vend','grava outro campo em negócio com encomenda repetida antiga',()=>n(`with u as (update public.baviera_control set obs='ok' where id=${N.carteira} returning 1) select count(*) n from u`),1],
  ['chefe','chefe','passa a mota do colega para outro negócio',()=>n(`with u as (update public.baviera_control set enc='7000001' where id=${N.comFicha} returning 1) select count(*) n from u`),1],
  ['chefe','chefe','substitui encomendas BMW (fica só o ficheiro novo)',async()=>{await db.query(`select public.encomendas_bmw_substituir('[{"production_number":"1","ts_order_status":"2026-10-03"},{"production_number":"2"}]')`);return n("select count(*) n from public.encomendas_bmw");},2],
  ['anónimo','anon','vê imagens de EOT (nenhuma)',()=>n("select count(*) n from storage.objects where bucket_id='eot-imagens'"),0],
  ['vendedor','vend','junta imagem à sua EOT',()=>ok("insert into storage.objects(bucket_id,name) values('eot-imagens','C1/nova.webp')"),'consegue'],
  ['vendedor','vend','junta imagem à EOT do colega',()=>ok("insert into storage.objects(bucket_id,name) values('eot-imagens','C2/intrusa.webp')"),'recusado'],
  ['vendedor','vend','vê imagens (só as da sua EOT)',()=>n("select count(*) n from storage.objects where bucket_id='eot-imagens'"),1],
  ['vendedor','vend','apaga imagem enviada pelo colega',()=>n("with d as (delete from storage.objects where name='C2/foto.webp' returning 1) select count(*) n from d"),0],
  ['vendedor','vend','comentário só com imagem',()=>ok("insert into public.eot_historico(contrato,tipo,imagens) values('C1','comentario',array['C1/a.webp'])"),'consegue'],
  ['vendedor','vend','comentário sem texto nem imagem',()=>ok("insert into public.eot_historico(contrato,tipo,texto) values('C1','comentario','  ')"),'recusado'],
  ['vendedor','vend','comentário que aponta para imagem de outra EOT',()=>ok("insert into public.eot_historico(contrato,tipo,imagens) values('C1','comentario',array['C2/foto.webp'])"),'recusado'],
  ['anónimo','anon','vê imagens de negócios (nenhuma)',()=>n("select count(*) n from storage.objects where bucket_id='negocio-imagens'"),0],
  ['vendedor','vend','junta imagem ao seu negócio',()=>ok(`insert into storage.objects(bucket_id,name) values('negocio-imagens','${N.frio}/nova.webp')`),'consegue'],
  ['vendedor','vend','junta imagem ao negócio do colega',()=>ok(`insert into storage.objects(bucket_id,name) values('negocio-imagens','${N.v2q}/intrusa.webp')`),'recusado'],
  ['vendedor','vend','vê imagens de negócios (só as dos seus)',()=>n("select count(*) n from storage.objects where bucket_id='negocio-imagens'"),1],
  ['vendedor','vend','apaga imagem de negócio enviada pelo colega',()=>n(`with d as (delete from storage.objects where name='${N.v2q}/foto.webp' returning 1) select count(*) n from d`),0],
  ['vendedor','vend','comenta o seu negócio só com imagem',()=>ok(`insert into public.negocio_historico(negocio_id,tipo,imagens) values(${N.frio},'comentario',array['${N.frio}/a.webp'])`),'consegue'],
  ['vendedor','vend','comenta o seu negócio com texto (como antes)',()=>ok(`insert into public.negocio_historico(negocio_id,tipo,texto) values(${N.frio},'comentario','Liguei ao cliente')`),'consegue'],
  ['vendedor','vend','comentário sem texto nem imagem',()=>ok(`insert into public.negocio_historico(negocio_id,tipo,texto) values(${N.frio},'comentario','  ')`),'recusado'],
  ['vendedor','vend','comentário que aponta para imagem de outro negócio',()=>ok(`insert into public.negocio_historico(negocio_id,tipo,imagens) values(${N.frio},'comentario',array['${N.v2q}/foto.webp'])`),'recusado'],
  ['vendedor','vend','comenta o negócio do colega',()=>ok(`insert into public.negocio_historico(negocio_id,tipo,texto) values(${N.v2q},'comentario','Intruso')`),'recusado'],
  ['secretário','sec','vê imagens de negócios',()=>n("select count(*) n from storage.objects where bucket_id='negocio-imagens'"),0],
  ['financeiro','fin','vê imagens de negócios',()=>n("select count(*) n from storage.objects where bucket_id='negocio-imagens'"),0],
  ['assessor','ass','vê imagens de negócios',()=>n("select count(*) n from storage.objects where bucket_id='negocio-imagens'"),0],
  ['chefe','chefe','vê imagens de todos os negócios',()=>n("select count(*) n from storage.objects where bucket_id='negocio-imagens'"),2],
  ['chefe','chefe','comenta negócio de um vendedor com imagem',()=>ok(`insert into public.negocio_historico(negocio_id,tipo,texto,imagens) values(${N.v2q},'comentario','Vê isto',array['${N.v2q}/b.webp'])`),'consegue'],
  ['secretário','sec','vê imagens de EOT',()=>n("select count(*) n from storage.objects where bucket_id='eot-imagens'"),0],
  ['financeiro','fin','vê imagens de todas as EOTs',()=>n("select count(*) n from storage.objects where bucket_id='eot-imagens'"),2],
  ['vendedor','vend','marca adenda à mão na sua EOT (fica sem efeito)',async()=>{await db.query("update public.eot_contratos set adenda_em='2026-10-22' where contrato='C1'");return n("select count(*) n from public.eot_contratos where adenda_em is not null");},0],
  ['vendedor','vend','marca a fase Adenda na sua EOT',async()=>{await db.query("update public.eot_contratos set fase='Adenda' where contrato='C1'");return n("select count(*) n from public.eot_contratos where fase='Adenda'");},1],
  ['chefe','chefe','importação reabre EOT com adenda (fica a data)',async()=>{await db.query("update public.eot_contratos set fase='Por contactar',adenda_em='2026-10-22' where contrato='C1'");return n("select count(*) n from public.eot_contratos where adenda_em is not null and fase='Por contactar'");},1],
  ['vendedor','vend','responde à declaração de circulação (a data é do servidor)',async()=>{await db.query(`update public.baviera_control set decl_circ='Por atualizar' where id=${N.carteira}`);return n(`select count(*) n from public.baviera_control where id=${N.carteira} and decl_circ='Por atualizar' and decl_circ_em is not null`);},1],
  ['vendedor','vend','escreve a data da declaração à mão (fica sem efeito)',async()=>{await db.query(`update public.baviera_control set decl_circ_em='2020-01-01' where id=${N.carteira}`);return n("select count(*) n from public.baviera_control where decl_circ_em is not null");},0],
  ['vendedor','vend','resposta inventada na declaração',async()=>{await db.exec('savepoint s');try{await db.query(`update public.baviera_control set decl_circ='Talvez' where id=${N.carteira}`);return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return /check constraint|violates/i.test(e.message)?'recusado':'ERRO '+e.message.slice(0,60);}},'recusado'],
  ['vendedor','vend','grava a data de nascimento do seu cliente',async()=>{await db.query(`update public.baviera_control set data_nascimento='1980-10-23' where id=${N.carteira}`);return n("select count(*) n from public.baviera_control where data_nascimento is not null");},1],
  ['vendedor','vend','grava a data de nascimento no cliente do colega',()=>n(`with u as (update public.baviera_control set data_nascimento='1980-01-01' where id=${N.retail2} returning 1) select count(*) n from u`),0],
  ['secretário','sec','vê a data de nascimento dos clientes',()=>n("select count(*) n from information_schema.columns where table_schema='public' and table_name='negocios_secretaria' and column_name='data_nascimento'"),0],
  ['vendedor','vend','dá o visto de tratado na sua EOT (fica sem efeito)',async()=>{await db.query("update public.eot_contratos set fin_visto_em=now() where contrato='C1'");return n("select count(*) n from public.eot_contratos where fin_visto_em is not null");},0],
  ['financeiro','fin','dá o visto de tratado (fica quem, pelo servidor)',async()=>{await db.query("update public.eot_contratos set fin_visto_em='2020-01-01' where contrato='C1'");return n(`select count(*) n from public.eot_contratos where fin_visto_por='${U.fin}' and fin_visto_nome='fin' and fin_visto_em>'2025-01-01'`);},1],
  ['financeiro','fin','dá o visto em nome de outra pessoa (fica o seu)',async()=>{await db.query(`update public.eot_contratos set fin_visto_em=now(),fin_visto_por='${U.vend2}',fin_visto_nome='Outro' where contrato='C1'`);return n(`select count(*) n from public.eot_contratos where fin_visto_por='${U.fin}' and fin_visto_nome='fin'`);},1],
  ['financeiro','fin','muda só o autor de um visto que já existe (fica sem efeito)',async()=>{await db.exec('reset role');await db.query(`update public.eot_contratos set fin_visto_em=now(),fin_visto_por='${U.fin}',fin_visto_nome='fin' where contrato='C1'`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.fin}","role":"authenticated"}',true); set local role authenticated;`);await db.query(`update public.eot_contratos set fin_visto_por='${U.vend2}',fin_visto_nome='Outro' where contrato='C1'`);return n(`select count(*) n from public.eot_contratos where fin_visto_por='${U.fin}'`);},1],
  ['financeiro','fin','tira o visto (limpa quem e quando)',async()=>{await db.exec('reset role');await db.query(`update public.eot_contratos set fin_visto_em=now(),fin_visto_por='${U.fin}',fin_visto_nome='fin' where contrato='C1'`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.fin}","role":"authenticated"}',true); set local role authenticated;`);await db.query("update public.eot_contratos set fin_visto_em=null where contrato='C1'");return n("select count(*) n from public.eot_contratos where fin_visto_em is not null or fin_visto_por is not null or fin_visto_nome is not null");},0],
  ['financeiro','fin','visto fica no histórico uma vez (sem quem/nome repetidos)',async()=>{await db.query("update public.eot_contratos set fin_visto_em=now() where contrato='C1'");return n("select count(*) n from public.eot_historico where contrato='C1' and campo like 'fin_visto%'");},1],
  ['chefe','chefe','regista compromisso da reunião (fica quem criou)',async()=>{await db.query(`insert into public.reuniao_compromissos(reuniao,vendedor_id,ponto,texto,prazo) values('2026-10-27','${U.vend}','carteira','Ligar ao cliente','2026-11-03')`);return n(`select count(*) n from public.reuniao_compromissos where criado_por='${U.chefe}'`);},1],
  ['chefe','chefe','dá nova data a um compromisso por cumprir (conta o adiamento)',async()=>{await db.query("insert into public.reuniao_compromissos(reuniao,texto,prazo) values('2026-10-27','Nova data teste','2026-11-03')");await db.query("update public.reuniao_compromissos set prazo='2026-11-10',adiamentos=adiamentos+1,adiado_em='2026-11-03' where texto='Nova data teste'");return n("select count(*) n from public.reuniao_compromissos where texto='Nova data teste' and adiamentos=1 and adiado_em='2026-11-03' and prazo='2026-11-10'");},1],
  ['chefe','chefe','adiamentos negativos são recusados',async()=>{await db.exec('savepoint s');try{await db.query("insert into public.reuniao_compromissos(reuniao,texto,adiamentos) values('2026-10-27','Negativo',-1)");return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return 'recusado';}},'recusado'],
  ['chefe','chefe','compromisso sem texto é recusado',async()=>{await db.exec('savepoint s');try{await db.query("insert into public.reuniao_compromissos(reuniao,texto) values('2026-10-27','  ')");return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return 'recusado';}},'recusado'],
  ['vendedor','vend','vê os compromissos da reunião',async()=>{await db.exec('reset role');await db.query(`insert into public.reuniao_compromissos(reuniao,vendedor_id,texto) values('2026-10-27','${U.vend}','Ligar ao cliente')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.reuniao_compromissos");},0],
  ['vendedor','vend','escreve um compromisso',()=>ok("insert into public.reuniao_compromissos(reuniao,texto) values('2026-10-27','Feito por mim')"),'recusado'],
  ['financeiro','fin','vê os compromissos da reunião',async()=>{await db.exec('reset role');await db.query(`insert into public.reuniao_compromissos(reuniao,vendedor_id,texto) values('2026-10-27','${U.vend}','Ligar ao cliente')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.fin}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.reuniao_compromissos");},0],
  ['secretário','sec','vê os compromissos da reunião',async()=>{await db.exec('reset role');await db.query(`insert into public.reuniao_compromissos(reuniao,vendedor_id,texto) values('2026-10-27','${U.vend}','Ligar ao cliente')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.sec}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.reuniao_compromissos");},0],
  ['anónimo','anon','lê compromissos da reunião',conta('reuniao_compromissos'),'recusado'],
  ['vendedor','vend','marca como lida uma indicação da sua EOT',()=>ok("insert into public.eot_notif_lidas(contrato,hist_id) values('C1',1)"),'consegue'],
  ['vendedor','vend','marca como lida em nome de outra pessoa',()=>ok(`insert into public.eot_notif_lidas(user_id,contrato,hist_id) values('${U.vend2}','C1',1)`),'recusado'],
  ['vendedor','vend','vê as marcas de lido dos outros',async()=>{await db.exec('reset role');await db.query(`insert into public.eot_notif_lidas(user_id,contrato,hist_id) values('${U.vend2}','C2',1),('${U.fin}','C1',1)`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.eot_notif_lidas");},0],
  ['financeiro','fin','vê só as suas marcas de lido',async()=>{await db.exec('reset role');await db.query(`insert into public.eot_notif_lidas(user_id,contrato,hist_id) values('${U.vend2}','C2',1),('${U.fin}','C1',1)`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.fin}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.eot_notif_lidas");},1],
  ['chefe','chefe','vê as marcas de lido de toda a gente',async()=>{await db.exec('reset role');await db.query(`insert into public.eot_notif_lidas(user_id,contrato,hist_id) values('${U.vend2}','C2',1),('${U.fin}','C1',1)`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.chefe}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.eot_notif_lidas");},2],
  ['anónimo','anon','lê marcas de lido',conta('eot_notif_lidas'),'recusado'],
  ['chefe','chefe','Stock Aveiro guarda a 1.ª chegada a 193 e a 198',async()=>{await db.query(`select public.encomendas_bmw_substituir('[{"production_number":"8000001","order_status":"193","ts_order_status":"2026-06-20"}]','aveiro')`);await db.query(`select public.encomendas_bmw_substituir('[{"production_number":"8000001","order_status":"198","ts_order_status":"2026-07-03"}]','aveiro')`);await db.query(`select public.encomendas_bmw_substituir('[{"production_number":"8000001","order_status":"198","ts_order_status":"2026-07-10"}]','aveiro')`);return n("select count(*) n from public.encomendas_chegadas where production_number='8000001' and data_193='2026-06-20' and data_198='2026-07-03'");},1],
  ['chefe','chefe','Stock Rede não guarda chegadas',async()=>{await db.query(`select public.encomendas_bmw_substituir('[{"production_number":"8000001","order_status":"193","ts_order_status":"2026-06-20"}]','rede')`);return n("select count(*) n from public.encomendas_chegadas where production_number='8000001'");},0],
  ['vendedor','vend','lê as chegadas do Stock Aveiro',async()=>{await db.exec('reset role');await db.query("insert into public.encomendas_chegadas(production_number,data_193) values('8000002','2026-05-01')");await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.encomendas_chegadas where production_number='8000002'");},1],
  ['vendedor','vend','escreve uma chegada à mão',()=>ok("insert into public.encomendas_chegadas(production_number,data_193) values('8000003','2020-01-01')"),'recusado'],
  ['anónimo','anon','lê as chegadas do stock',conta('encomendas_chegadas'),'recusado'],
  ['chefe','chefe','importação que muda um dado do banco deixa o valor antigo no histórico',async()=>{await db.query("update public.eot_contratos set telemovel='919999999',ultima_import=now() where contrato='C1'");return n("select count(*) n from public.eot_historico where contrato='C1' and tipo='sistema' and campo='telemovel' and valor_depois='919999999'");},1],
  ['chefe','chefe','importação sem alterações não deixa registo',async()=>{await db.query("update public.eot_contratos set cliente=cliente,ultima_import=now() where contrato='C1'");return n("select count(*) n from public.eot_historico where contrato='C1' and tipo='sistema'");},0],
  ['chefe','chefe','correção à mão de um dado do banco fica no histórico como alteração',async()=>{await db.query("update public.eot_contratos set telemovel='918888888' where contrato='C1'");return n("select count(*) n from public.eot_historico where contrato='C1' and tipo='alteracao' and campo='telemovel'");},1],
  ['chefe','chefe','cria EOT à mão (origem, quem criou, ativa)',async()=>{await db.query("insert into public.eot_contratos(contrato,cliente,data_fim,origem) values('M1','Cliente à mão','2027-02-01','manual')");
    return n(`select count(*) n from public.eot_contratos where contrato='M1' and origem='manual' and criado_por='${U.chefe}' and no_mapa and fase='Por contactar' and ultima_import is null`);},1],
  ['vendedor','vend','cria EOT à mão',()=>ok("insert into public.eot_contratos(contrato,cliente,origem,responsavel_id) values('M2','X','manual',auth.uid())"),'recusado'],
  ['financeiro','fin','cria EOT à mão',()=>ok("insert into public.eot_contratos(contrato,cliente,origem) values('M3','X','manual')"),'recusado'],
  ['chefe','chefe','origem inventada é recusada',async()=>{await db.exec('savepoint s');try{await db.query("insert into public.eot_contratos(contrato,origem) values('M4','excel')");return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return /origem_check/.test(e.message)?'recusada':'ERRO '+e.message.slice(0,60);}},'recusada'],
  ['vendedor','vend','muda a origem da sua EOT (fica sem efeito)',async()=>{await db.query("update public.eot_contratos set origem='manual' where contrato='C1'");return n("select count(*) n from public.eot_contratos where contrato='C1' and origem='mapa'");},1],
  ['chefe','chefe','EOT à mão que vem no mapa passa a "do mapa" (fica no histórico)',async()=>{await db.query("insert into public.eot_contratos(contrato,cliente,origem) values('M5','Cliente','manual')");await db.query("update public.eot_contratos set residual=4800,ultima_import=now() where contrato='M5'");
    return (await n("select count(*) n from public.eot_contratos where contrato='M5' and origem='mapa'"))+'/'+await n("select count(*) n from public.eot_historico where contrato='M5' and tipo='sistema' and campo='origem' and valor_antes='manual' and valor_depois='mapa'");},'1/1'],
  ['chefe','chefe','editar uma EOT à mão não a passa a "do mapa"',async()=>{await db.query("insert into public.eot_contratos(contrato,cliente,origem) values('M6','Cliente','manual')");await db.query("update public.eot_contratos set telemovel='912345678',fase='Contactado' where contrato='M6'");return n("select count(*) n from public.eot_contratos where contrato='M6' and origem='manual'");},1],
  ['chefe','chefe','apaga EOT criada à mão',async()=>{await db.query("insert into public.eot_contratos(contrato,cliente,origem) values('M7','Cliente','manual')");return n("with d as (delete from public.eot_contratos where contrato='M7' and origem='manual' returning 1) select count(*) n from d");},1],
  ['vendedor','vend','apaga a sua EOT criada à mão',async()=>{await db.exec('reset role');await db.query(`insert into public.eot_contratos(contrato,cliente,origem,responsavel_id) values('M8','Cliente','manual','${U.vend}')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);
    await db.query("delete from public.eot_contratos where contrato='M8'");await db.exec('reset role');return n("select count(*) n from public.eot_contratos where contrato='M8'");},1],
  ['chefe','chefe','regista valor de retoma (fica quem e quando)',async()=>{await db.query("insert into public.retomas_valores(cliente,modelo,valor_retoma,valor_venda) values('Cliente','R 1250 GS',9000,12500)");return n(`select count(*) n from public.retomas_valores where criado_por='${U.chefe}' and estado='proposta' and criado_em is not null`);},1],
  ['chefe','chefe','muda o estado e as notas de uma retoma',async()=>{const id=(await db.query("insert into public.retomas_valores(cliente,modelo,valor_retoma,valor_venda) values('Cliente','R 1250 GS',9000,12500) returning id")).rows[0].id;await db.query(`update public.retomas_valores set estado='aceite',notas='Aceitou' where id=${id}`);return n(`select count(*) n from public.retomas_valores where id=${id} and estado='aceite' and notas='Aceitou'`);},1],
  ['chefe','chefe','muda o valor oferecido depois de gravado',async()=>{const id=(await db.query("insert into public.retomas_valores(cliente,modelo,valor_retoma,valor_venda) values('Cliente','R 1250 GS',9000,12500) returning id")).rows[0].id;await db.exec('savepoint s');try{await db.query(`update public.retomas_valores set valor_retoma=9500 where id=${id}`);return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return /não mudam/.test(e.message)?'recusado':'ERRO '+e.message.slice(0,60);}},'recusado'],
  ['chefe','chefe','retoma sem modelo é recusada',async()=>{await db.exec('savepoint s');try{await db.query("insert into public.retomas_valores(modelo,valor_retoma) values('  ',100)");return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return /modelo_check/.test(e.message)?'recusado':'ERRO '+e.message.slice(0,60);}},'recusado'],
  ['chefe','chefe','estado inventado é recusado',async()=>{await db.exec('savepoint s');try{await db.query("insert into public.retomas_valores(modelo,valor_retoma,estado) values('X',100,'talvez')");return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return /estado_check/.test(e.message)?'recusado':'ERRO '+e.message.slice(0,60);}},'recusado'],
  ['chefe','chefe','regista retoma com o vendedor e corrige o vendedor depois',async()=>{const id=(await db.query(`insert into public.retomas_valores(vendedor_id,modelo,valor_retoma) values('${U.vend}','R 1250 GS',9000) returning id`)).rows[0].id;await db.query(`update public.retomas_valores set vendedor_id='${U.vend2}' where id=${id}`);return n(`select count(*) n from public.retomas_valores where id=${id} and vendedor_id='${U.vend2}'`);},1],
  ['chefe','chefe','apaga um registo de retoma',async()=>{const id=(await db.query("insert into public.retomas_valores(cliente,modelo,valor_retoma,valor_venda) values('Cliente','R 1250 GS',9000,12500) returning id")).rows[0].id;return n(`with d as (delete from public.retomas_valores where id=${id} returning 1) select count(*) n from d`);},1],
  ['vendedor','vend','lê os valores de retoma do chefe',async()=>{await db.exec('reset role');await db.query("insert into public.retomas_valores(cliente,modelo,valor_retoma,valor_venda) values('Cliente','R 1250 GS',9000,12500)");await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.retomas_valores");},0],
  ['vendedor','vend','regista valor de retoma',()=>ok("insert into public.retomas_valores(cliente,modelo,valor_retoma,valor_venda) values('Cliente','R 1250 GS',9000,12500)"),'recusado'],
  ['financeiro','fin','lê os valores de retoma do chefe',async()=>{await db.exec('reset role');await db.query("insert into public.retomas_valores(cliente,modelo,valor_retoma,valor_venda) values('Cliente','R 1250 GS',9000,12500)");await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.fin}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.retomas_valores");},0],
  ['secretário','sec','lê os valores de retoma do chefe',async()=>{await db.exec('reset role');await db.query("insert into public.retomas_valores(cliente,modelo,valor_retoma,valor_venda) values('Cliente','R 1250 GS',9000,12500)");await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.sec}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.retomas_valores");},0],
  ['anónimo','anon','lê os valores de retoma',conta('retomas_valores'),'recusado'],
  ['vendedor','vend','grava o acordo de venda do seu negócio (fica quem e quando)',async()=>{await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.frio},'{"cor":"Azul"}')`);return n(`select count(*) n from public.acordos_venda where negocio_id=${N.frio} and updated_by='${U.vend}' and updated_at is not null`);},1],
  ['vendedor','vend','muda o acordo do seu negócio',async()=>{await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.frio},'{"cor":"Azul"}')`);await db.query(`update public.acordos_venda set dados='{"cor":"Verde"}' where negocio_id=${N.frio}`);return n(`select count(*) n from public.acordos_venda where negocio_id=${N.frio} and dados->>'cor'='Verde'`);},1],
  ['vendedor','vend','põe outro nome em «quem gravou» o acordo (fica o seu)',async()=>{await db.query(`insert into public.acordos_venda(negocio_id,dados,updated_by) values(${N.frio},'{}','${U.vend2}')`);return n(`select count(*) n from public.acordos_venda where negocio_id=${N.frio} and updated_by='${U.vend}'`);},1],
  ['vendedor','vend','grava acordo de venda no negócio do colega',()=>ok(`insert into public.acordos_venda(negocio_id,dados) values(${N.v2q},'{}')`),'recusado'],
  ['vendedor','vend','lê o acordo de venda do colega',async()=>{await db.exec('reset role');await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.v2q},'{"cor":"Azul"}')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.acordos_venda");},0],
  ['vendedor','vend','muda o acordo de venda do colega',async()=>{await db.exec('reset role');await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.v2q},'{"cor":"Azul"}')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);return n(`with u as (update public.acordos_venda set dados='{}' where negocio_id=${N.v2q} returning 1) select count(*) n from u`);},0],
  ['vendedor','vend','passa o seu acordo para o negócio do colega',async()=>{await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.frio},'{}')`);return ok(`update public.acordos_venda set negocio_id=${N.v2q} where negocio_id=${N.frio}`);},'recusado'],
  ['vendedor','vend','apaga negócio frio com acordo (o acordo vai junto)',async()=>{await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.frio},'{}')`);const d=await n(`with d as (delete from public.baviera_control where id=${N.frio} returning 1) select count(*) n from d`);await db.exec('reset role');return d+'/'+await n(`select count(*) n from public.acordos_venda where negocio_id=${N.frio}`);},'1/0'],
  ['chefe','chefe','grava o acordo de venda de qualquer negócio',async()=>{await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.v2q},'{}'),(${N.frio},'{}')`);return n(`select count(*) n from public.acordos_venda where updated_by='${U.chefe}'`);},2],
  ['secretário','sec','lê os acordos de venda',async()=>{await db.exec('reset role');await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.frio},'{}')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.sec}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.acordos_venda");},0],
  ['financeiro','fin','lê os acordos de venda',async()=>{await db.exec('reset role');await db.query(`insert into public.acordos_venda(negocio_id,dados) values(${N.frio},'{}')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.fin}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.acordos_venda");},0],
  ['assessor','ass','grava acordo de venda',()=>ok(`insert into public.acordos_venda(negocio_id,dados) values(${N.frio},'{}')`),'recusado'],
  ['anónimo','anon','lê os acordos de venda',conta('acordos_venda'),'recusado'],
  ['vendedor','vend','escreve o sinal e os dados da retoma no seu negócio',async()=>{await db.query(`update public.baviera_control set sinal=1000,sinal_forma='MB',retoma_ano=2017,retoma_kms=48000,retoma_valor=6000,retoma_valor_comercio=5500 where id=${N.frio}`);return n(`select count(*) n from public.baviera_control where id=${N.frio} and sinal=1000 and retoma_valor_comercio=5500`);},1],
  ['vendedor','vend','forma do sinal inventada é recusada',async()=>{try{await db.query(`update public.baviera_control set sinal_forma='Bitcoin' where id=${N.frio}`);return 'aceitou';}catch(e){return /sinal_forma_check/.test(e.message)?'recusado':'ERRO '+e.message.slice(0,60);}},'recusado'],
  ['vendedor','vend','guarda documento emitido do seu negócio (fica quem e quando)',async()=>{await db.query(`insert into public.documentos_emitidos(negocio_id,tipo,caminho,nome,criado_por) values(${N.frio},'acordo_venda','${N.frio}/a.pdf','A.pdf','${U.vend2}')`);return n(`select count(*) n from public.documentos_emitidos where negocio_id=${N.frio} and criado_por='${U.vend}'`);},1],
  ['vendedor','vend','guarda documento no negócio do colega',()=>ok(`insert into public.documentos_emitidos(negocio_id,tipo,caminho,nome) values(${N.v2q},'acordo_venda','${N.v2q}/a.pdf','A.pdf')`),'recusado'],
  ['vendedor','vend','documento com caminho fora da pasta do negócio',async()=>{try{await db.query(`insert into public.documentos_emitidos(negocio_id,tipo,caminho,nome) values(${N.frio},'acordo_venda','${N.v2q}/a.pdf','A.pdf')`);return 'aceitou';}catch(e){return /pasta_check/.test(e.message)?'recusado':'ERRO '+e.message.slice(0,60);}},'recusado'],
  ['vendedor','vend','lê documentos do colega',async()=>{await db.exec('reset role');await db.query(`insert into public.documentos_emitidos(negocio_id,tipo,caminho,nome) values(${N.v2q},'acordo_venda','${N.v2q}/a.pdf','A.pdf')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.documentos_emitidos");},0],
  ['vendedor','vend','altera um documento emitido',async()=>{await db.exec('reset role');await db.query(`insert into public.documentos_emitidos(negocio_id,tipo,caminho,nome) values(${N.frio},'acordo_venda','${N.frio}/a.pdf','A.pdf')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);try{return n(`with u as (update public.documentos_emitidos set nome='X' where negocio_id=${N.frio} returning 1) select count(*) n from u`);}catch(e){return /permission denied/.test(e.message)?'recusado':'ERRO '+e.message.slice(0,60);}},'recusado'],
  ['vendedor','vend','apaga um documento emitido',async()=>{await db.exec('reset role');await db.query(`insert into public.documentos_emitidos(negocio_id,tipo,caminho,nome) values(${N.frio},'acordo_venda','${N.frio}/a.pdf','A.pdf')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);return n(`with d as (delete from public.documentos_emitidos where negocio_id=${N.frio} returning 1) select count(*) n from d`);},0],
  ['chefe','chefe','guarda e apaga documento de qualquer negócio',async()=>{await db.query(`insert into public.documentos_emitidos(negocio_id,tipo,caminho,nome) values(${N.v2q},'folha_negocio','${N.v2q}/f.pdf','F.pdf')`);return n(`with d as (delete from public.documentos_emitidos where negocio_id=${N.v2q} returning 1) select count(*) n from d`);},1],
  ['secretário','sec','lê documentos emitidos',async()=>{await db.exec('reset role');await db.query(`insert into public.documentos_emitidos(negocio_id,tipo,caminho,nome) values(${N.frio},'acordo_venda','${N.frio}/a.pdf','A.pdf')`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.sec}","role":"authenticated"}',true); set local role authenticated;`);return n("select count(*) n from public.documentos_emitidos");},0],
  ['anónimo','anon','lê documentos emitidos',conta('documentos_emitidos'),'recusado'],
  ['vendedor','vend','junta PDF na pasta do seu negócio',()=>ok(`insert into storage.objects(bucket_id,name,owner) values('negocio-documentos','${N.frio}/a.pdf','${U.vend}')`),'consegue'],
  ['vendedor','vend','junta PDF na pasta do negócio do colega',()=>ok(`insert into storage.objects(bucket_id,name,owner) values('negocio-documentos','${N.v2q}/a.pdf','${U.vend}')`),'recusado'],
  ['vendedor','vend','apaga PDF emitido (mesmo o seu)',async()=>{await db.query(`insert into storage.objects(bucket_id,name,owner) values('negocio-documentos','${N.frio}/b.pdf','${U.vend}')`);return n(`with d as (delete from storage.objects where bucket_id='negocio-documentos' returning 1) select count(*) n from d`);},0],
  ['chefe','chefe','apaga imagem de EOT',()=>n("with d as (delete from storage.objects where name='C2/foto.webp' returning 1) select count(*) n from d"),1],
  ['vendedor','vend','cria segunda ficha no seu negócio',()=>ok(`insert into public.fichas_margem(negocio_id,dados,nome) values(${N.comFicha},'{}','Outra mota')`),'consegue'],
  ['vendedor','vend','cria ficha no negócio do colega',()=>ok(`insert into public.fichas_margem(negocio_id,dados) values(${N.retail2},'{}')`),'recusado'],
  ['vendedor','vend','marca a ficha vendida (as outras ficam arquivadas)',async()=>{const id=(await db.query(`insert into public.fichas_margem(negocio_id,dados) values(${N.comFicha},'{}') returning id`)).rows[0].id;await db.query(`select public.ficha_marcar_vendida(${id})`);return (await n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and estado='vendida'`))+'/'+await n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and estado='arquivada'`);},'1/1'],
  ['vendedor','vend','duas fichas vendidas no mesmo negócio',async()=>{await db.query(`insert into public.fichas_margem(negocio_id,dados) values(${N.comFicha},'{}')`);try{await db.query(`update public.fichas_margem set estado='vendida' where negocio_id=${N.comFicha}`);return 'passou';}catch(e){return /fichas_margem_uma_vendida/.test(e.message)?'recusado':'ERRO '+e.message;}},'recusado'],
  ['vendedor','vend','marca vendida a ficha do colega',async()=>{const id=(await db.query(`select id from public.fichas_margem where negocio_id=${N.retail2}`)).rows[0];if(!id)return 'sem ficha';await db.query(`select public.ficha_marcar_vendida(${id.id})`);return 'passou';},'sem ficha'],
  ['vendedor','vend','aprova a própria ficha',()=>ok(`select public.ficha_aprovar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1))`),'recusado'],
  ['vendedor','vend','escreve a aprovação diretamente (fica sem efeito)',async()=>{await db.query(`update public.fichas_margem set aprovada_em=now() where negocio_id=${N.comFicha}`);return n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and aprovada_em is not null`);},0],
  ['chefe','chefe','aprova ficha (fica quem e quando)',async()=>{await db.query(`select public.ficha_aprovar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1))`);return n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and aprovada_em is not null and aprovada_por='${U.chefe}'`);},1],
  ['vendedor','vend','muda a ficha aprovada: a aprovação cai',async()=>{await db.exec('reset role');await db.query(`update public.fichas_margem set aprovada_em=now(),aprovada_por='${U.chefe}' where negocio_id=${N.comFicha}`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);
    await db.query(`update public.fichas_margem set dados='{"preco_venda":"1"}' where negocio_id=${N.comFicha}`);return n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and aprovada_em is not null`);},0],
  ['vendedor','vend','marca vendida a ficha aprovada: a aprovação fica',async()=>{await db.exec('reset role');await db.query(`update public.fichas_margem set aprovada_em=now() where negocio_id=${N.comFicha}`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);
    await db.query(`select public.ficha_marcar_vendida((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1))`);return n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and aprovada_em is not null`);},1],
  ['chefe','chefe','não aprova ficha com motivo (quem, quando, motivo, comentário)',async()=>{await db.query(`select public.ficha_aprovar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1))`);await db.query(`select public.ficha_recusar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1),'  Margem negativa: rever o preço  ')`);
    return (await n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and recusada_por='${U.chefe}' and recusada_em is not null and recusa_motivo='Margem negativa: rever o preço' and aprovada_em is null`))+'/'+await n(`select count(*) n from public.negocio_historico where negocio_id=${N.comFicha} and tipo='comentario' and autor_id='${U.chefe}' and texto='Ficha de margem não aprovada: Margem negativa: rever o preço'`);},'1/1'],
  ['chefe','chefe','não aprovar sem motivo é recusado',async()=>{await db.exec('savepoint s');try{await db.query(`select public.ficha_recusar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1),'   ')`);return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return /motivo/.test(e.message)?'recusado':'ERRO '+e.message.slice(0,60);}},'recusado'],
  ['vendedor','vend','não aprova a própria ficha (só o chefe)',()=>ok(`select public.ficha_recusar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1),'Rever a retoma')`),'recusado'],
  ['financeiro','fin','não aprova fichas',()=>ok(`select public.ficha_recusar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1),'Rever a retoma')`),'recusado'],
  ['anónimo','anon','não aprova fichas',()=>ok(`select public.ficha_recusar(1,'Rever a retoma')`),'recusado'],
  ['vendedor','vend','escreve a recusa diretamente (fica sem efeito)',async()=>{await db.query(`update public.fichas_margem set recusada_em=now(),recusa_motivo='x' where negocio_id=${N.comFicha}`);await db.query(`insert into public.fichas_margem(negocio_id,dados,recusada_em,recusa_motivo) values(${N.comFicha},'{}',now(),'y')`);
    return n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and (recusada_em is not null or recusa_motivo is not null)`);},0],
  ['vendedor','vend','muda a ficha não aprovada: volta para aprovar',async()=>{await db.exec('reset role');await db.query(`update public.fichas_margem set recusada_em=now(),recusada_por='${U.chefe}',recusa_motivo='Rever a retoma' where negocio_id=${N.comFicha}`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);
    await db.query(`update public.fichas_margem set dados='{"preco_venda":"2"}' where negocio_id=${N.comFicha}`);return n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and (recusada_em is not null or recusada_por is not null or recusa_motivo is not null)`);},0],
  ['vendedor','vend','marca vendida a ficha não aprovada: a recusa fica',async()=>{await db.exec('reset role');await db.query(`update public.fichas_margem set recusada_em=now(),recusada_por='${U.chefe}',recusa_motivo='Rever a retoma' where negocio_id=${N.comFicha}`);await db.exec(`select set_config('request.jwt.claims','{"sub":"${U.vend}","role":"authenticated"}',true); set local role authenticated;`);
    await db.query(`select public.ficha_marcar_vendida((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1))`);return n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and recusa_motivo='Rever a retoma'`);},1],
  ['chefe','chefe','aprovar depois de não aprovar limpa a recusa',async()=>{await db.query(`select public.ficha_recusar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1),'Rever a retoma')`);await db.query(`select public.ficha_aprovar((select id from public.fichas_margem where negocio_id=${N.comFicha} limit 1))`);
    return n(`select count(*) n from public.fichas_margem where negocio_id=${N.comFicha} and aprovada_em is not null and recusada_em is null and recusada_por is null and recusa_motivo is null`);},1],
  ['chefe','chefe','carrega Stock Rede sem mexer no Stock Aveiro',async()=>{await db.query(`select public.encomendas_bmw_substituir('[{"production_number":"5000001","customer_last":"Cliente de outro concessionário","salesperson":"XX","dealer_nome":"J&M Motos"}]','rede')`);return (await n("select count(*) n from public.encomendas_bmw where origem='aveiro'"))+'/'+await n("select count(*) n from public.encomendas_bmw where origem='rede'");},'1/1'],
  ['chefe','chefe','Stock Rede não guarda cliente nem vendedor de outro concessionário',async()=>{await db.query(`select public.encomendas_bmw_substituir('[{"production_number":"5000001","customer_last":"Nome","salesperson":"XX"}]','rede')`);return n("select count(*) n from public.encomendas_bmw where origem='rede' and (customer_last is not null or salesperson is not null)");},0],
  ['chefe','chefe','origem inventada é recusada',async()=>{await db.exec('savepoint s');try{await db.query(`select public.encomendas_bmw_substituir('[{"production_number":"1"}]','lisboa')`);return 'aceitou';}catch(e){await db.exec('rollback to savepoint s');return /Origem desconhecida/.test(e.message)?'recusada':'ERRO '+e.message.slice(0,60);}},'recusada'],
  ['vendedor','vend','substitui Stock BMW',()=>ok(`select public.encomendas_bmw_substituir('[{"production_number":"1"}]','bmw')`),'recusado'],
  ['chefe','chefe','carrega ficheiro vazio (mapa fica como está)',async()=>{await db.exec('savepoint s');try{await db.query(`select public.encomendas_bmw_substituir('[]')`);}catch(e){await db.exec('rollback to savepoint s');}return n("select count(*) n from public.encomendas_bmw");},1],
];

let falhas=0;const linhas=[];
for(const [area,quem,desc,fn,esp] of C){
  const r=await como(quem,fn);const passou=String(r)===String(esp);if(!passou)falhas++;
  linhas.push(`${passou?'✓':'✗'} ${area.padEnd(11)} ${desc.padEnd(52)} esperado ${String(esp).padEnd(9)} obtido ${r}`);
}
console.log('Migrações pendentes testadas: '+(pendentes.join(', ')||'nenhuma'));
console.log(linhas.join('\n'));
console.log(`\n${C.length-falhas}/${C.length} células corretas`);
process.exit(falhas?1:0);
