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
await db.exec("set session_replication_role = replica"); // dados de partida: inclui uma encomenda repetida antiga, como existe em produção
await db.query(`update public.baviera_control set enc='7000001' where id=${N.v2q}`);
await db.query(`update public.baviera_control set enc='7000005' where id in (${N.carteira},${N.retail2})`);
await db.exec("set session_replication_role = origin");

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
