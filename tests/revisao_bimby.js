// Revisão da Bimby (2026-11-26). Dados fictícios.
// - NIF português validado (estrangeiro não é validado); dados em falta das Carteiras no Hoje do vendedor; contador para o chefe;
// - checklist de entrega marcada pelo vendedor (pela função entrega_vendedor), sem as notas do chefe;
// - mota nova/demo não passa a Carteira sem ficha; com várias fichas o vendedor escolhe a vendida; ficha única fica marcada;
// - Retail traz a data 298 de hoje; Campanha só aparece quando está preenchida;
// - saíram 4 alertas de encomendas/CME; ficam a encomenda repetida e a entrega do mês sem encomenda;
// - usadas paradas há +90 dias com preço sugerido, uma vez por semana;
// - escala: os vendedores preenchem e submetem; o chefe valida ou devolve com comentário.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8795;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'},v2:{id:'v2',nome:'Vendedor Dois',role:'vendedor',linha:'motorrad'}};
const d0=new Date();const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const hoje=iso(d0);const ym=`${d0.getFullYear()}/${String(d0.getMonth()+1).padStart(2,'0')}`;const mesE=ym.replace('/','-');
const mesPassado=(()=>{const d=new Date(d0.getFullYear(),d0.getMonth()-1,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
const ha=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
const R=(id,status,o)=>Object.assign({id,vendedor_id:'v1',status,type:'MN',id_cliente:'Cliente '+id,model:'R 1300 GS',version:'',updated_at:new Date().toISOString(),status_updated_at:new Date().toISOString()},o||{});
const completo={contacto:'910000000',nif:'123456789',email:'a@b.pt',morada:'Rua A 1',local:'3800-000 Aveiro'};
const novoEst=()=>({recs:[
  R(1,'Carteira',{mes1:ym,enc:'7000001'}),                                   // sem dados nenhuns
  R(2,'Carteira',Object.assign({},completo,{mes1:ym,enc:'7000002',nif:'123456780',retoma:'Sim',retoma_valor:null})), // NIF inválido + retoma sem valor
  R(3,'Carteira',Object.assign({},completo,{mes1:ym,enc:'7000003'})),        // completo
  R(4,'Retail',{col_298:hoje}),                                                // Retail: não conta
  R(5,'Quente',Object.assign({},completo)),                                    // MN sem ficha
  R(6,'Quente',Object.assign({},completo)),                                    // MN com 2 fichas
  R(7,'Morno',Object.assign({},completo,{type:'MU'})),                         // MU sem ficha
  R(8,'Carteira',Object.assign({},completo,{mes1:ym,enc:'7000008'})),        // 1 ficha, passa a Retail
  R(9,'Carteira',Object.assign({},completo,{mes1:'2026/01',vendedor_id:'v2'})),// do colega, atrasada, sem encomenda
  R(10,'Quente',{enc:'7000001',vendedor_id:'v2'}),                             // encomenda repetida com o 1
  R(11,'Quente',Object.assign({},completo,{origin:'Lead',campanha:'P6 08/26'})),
],fichas:{6:[{id:61,negocio_id:6,estado:'ativa',dados:{modelo:'R 1300 GS',preco_venda:21000}},{id:62,negocio_id:6,estado:'ativa',dados:{modelo:'R 1300 GS Adventure',preco_venda:24500}}],
  8:[{id:81,negocio_id:8,estado:'ativa',dados:{modelo:'R 1300 GS'}}]},
  escalaMeses:[],rpc:[],patches:[],stock:[{id:1,categoria:'usada',modelo:'R 1250 RT',matricula:'AA-11-BB',estado:'Disponível',kms:30000,data_rececao:ha(125),valor_anunciado:10000,valor_min:9000},
    {id:2,categoria:'usada',modelo:'F 900 R',matricula:'CC-22-DD',estado:'Disponível',data_rececao:ha(20),valor_anunciado:7000}]});
let est=novoEst();
const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const rpc=(u.match(/rest\/v1\/rpc\/([a-z_]+)/)||[])[1];
  if(rpc){const b=JSON.parse(r.request().postData()||'{}');est.rpc.push([rpc,b]);
    if(rpc==='escala_submeter'){est.escalaMeses=est.escalaMeses.filter(x=>x.mes!==b.p_mes);est.escalaMeses.push({linha:'motorrad',mes:b.p_mes,estado:'submetido',submetido_por:quem,submetido_em:new Date().toISOString()});}
    if(rpc==='escala_decidir'){est.escalaMeses=est.escalaMeses.filter(x=>x.mes!==b.p_mes);est.escalaMeses.push({linha:b.p_linha,mes:b.p_mes,estado:b.p_validar?'validado':'devolvido',comentario:b.p_comentario,decidido_em:new Date().toISOString()});}
    return r.fulfill({status:204,body:''});}
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control'){if(m==='GET')return json(quem==='c1'?est.recs:est.recs.filter(x=>x.vendedor_id===quem));const b=JSON.parse(r.request().postData()||'{}');const id=Number((u.match(/id=eq\.(\d+)/)||[])[1]);
    est.patches.push([id,b]);const x=est.recs.find(y=>y.id===id);if(x)Object.assign(x,b);return json(x?[x]:[]);}
  if(t==='fichas_margem'){const id=Number((u.match(/negocio_id=eq\.(\d+)/)||[])[1]);if(id)return json(est.fichas[id]||[]);return json(Object.values(est.fichas).flat());}
  if(t==='escala_meses')return json(est.escalaMeses);
  if(t==='stock_usadas'||t==='stock_usadas_publico')return json(est.stock);
  return json([]);};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const erros=[];const alertas=[];
 const abrir=async(quem,vp,ls)=>{const ctx=await b.newContext({viewport:vp||{width:1400,height:1000}});
  await ctx.addInitScript(([t,ls])=>{localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));Object.entries(ls||{}).forEach(([k,v])=>localStorage.setItem(k,v));},[jwt(quem),ls]);
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));await ligarAvisos(p,alertas);
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 // ---------- vendedor ----------
 const V=await abrir('v1');const p=V.p;
 const nif=await p.evaluate(()=>['123456789','123 456 789','PT123456789','123456780','12345678','ES12345678Z','',null].map(nifEstado));
 await p.evaluate(()=>setState({screen:'list',statusFilter:'_hoje'}));await p.waitForTimeout(400);
 const hojeV=await p.evaluate(()=>{const secs=[...document.querySelectorAll('.vh-sec')].map(x=>x.textContent.trim());
   const falta=[...document.querySelectorAll('.vh-falta')].map(x=>x.dataset.id+':'+[...x.querySelectorAll('.ve-chip')].map(c=>c.textContent).join(','));
   const ent=[...document.querySelectorAll('.vh-ent .en-card')];
   return {secs,falta,nEnt:ent.length,notas:document.querySelectorAll('.vh-ent [data-ent-f="docs_obs"],.vh-ent [data-ent-f="obs"]').length,badge:vPendentes().incompl};});
 await p.screenshot({path:path.join(__dirname,'revisao_hoje.png'),fullPage:true});
 await p.click('.vh-ent [data-action="ent-toggle"][data-id="1"][data-k="prep_pedida"]');await p.waitForTimeout(400);
 const rpcEnt=est.rpc.find(x=>x[0]==='entrega_vendedor');
 // 298 ao escolher Retail no formulário rápido; Campanha só se preenchida
 const f298=await p.evaluate(()=>{S.selected=null;S.form={status:'Carteira'};S.screen='edit';render();const c=document.querySelector('[data-action="qf-set"][data-k="status"][data-v="Retail"]');c.click();return S.form.col_298;});
 const camp=await p.evaluate(()=>{const fd=FIELD_GROUPS.flatMap(g=>g.fields).find(f=>f.k==='campanha');S.form={origin:'Lead'};const a=campoVisivel(fd);S.form={origin:'Lead',campanha:'P6'};return [a,campoVisivel(fd)];});
 // ficha obrigatória: 5 (MN sem ficha) não passa a Carteira
 const bloq=await p.evaluate(async()=>{const r=S.records.find(x=>x.id===5);S.selected=r;S.form=Object.assign({},r,{status:'Carteira',mes1:'2026/12'});S.screen='edit';await saveRecord();return S.error||'';});
 const patch5=est.patches.some(x=>x[0]===5);
 // 7 (MU sem ficha) passa
 await p.evaluate(async()=>{const r=S.records.find(x=>x.id===7);S.selected=r;S.form=Object.assign({},r,{status:'Carteira',mes1:'2026/12'});S.screen='edit';S.error='';await saveRecord();});
 const patch7=est.patches.some(x=>x[0]===7&&x[1].status==='Carteira');
 // 6 (2 fichas): escolhe a segunda
 p.evaluate(async()=>{const r=S.records.find(x=>x.id===6);S.selected=r;S.form=Object.assign({},r,{status:'Carteira',mes1:'2026/12'});S.screen='edit';S.error='';await saveRecord();});
 await p.waitForSelector('.cf-op',{timeout:3000});
 const opcoes=await p.evaluate(()=>[...document.querySelectorAll('.cf-op')].map(x=>x.textContent.replace(/\s+/g,' ').trim()));
 await p.screenshot({path:path.join(__dirname,'revisao_escolher_ficha.png')});
 await p.click('.cf-op[data-i="1"]');await p.waitForTimeout(700);
 const vend6=est.rpc.find(x=>x[0]==='ficha_marcar_vendida');const patch6=est.patches.some(x=>x[0]===6&&x[1].status==='Carteira');
 // escala: o vendedor preenche e submete
 await p.evaluate(async()=>{S.escalaMes=null;await loadEscala();setState({screen:'escala'});});await p.waitForTimeout(400);
 const escV=await p.evaluate(()=>({ed:document.querySelectorAll('.esc-gc.esc-editable').length,sub:!!document.querySelector('[data-action="escala-submeter"]'),st:(document.querySelector('.esc-st')||{}).textContent||''}));
 await p.screenshot({path:path.join(__dirname,'revisao_escala_vendedor.png')});
 await p.click('[data-action="escala-submeter"]');await p.waitForTimeout(800);
 const sub=est.rpc.find(x=>x[0]==='escala_submeter');
 const escV2=await p.evaluate(()=>({ed:document.querySelectorAll('.esc-gc.esc-editable').length,st:(document.querySelector('.esc-st')||{}).textContent||''}));
 const passado=await p.evaluate(m=>escalaVendPode(m),mesPassado);
 await V.ctx.close();
 // ---------- chefe ----------
 est.rpc=[];
 const C=await abrir('c1',null,{bc_dep_taxa:'2'});const q=C.p;
 // 8 (1 ficha) passa a Retail: ficha marcada como vendida
 await q.evaluate(async()=>{const r=S.records.find(x=>x.id===8);S.selected=r;S.form=Object.assign({},r,{status:'Retail',col_298:new Date().toISOString().slice(0,10)});S.screen='edit';await saveRecord();});await q.waitForTimeout(300);
 const vend8=est.rpc.find(x=>x[0]==='ficha_marcar_vendida');
 const al=await q.evaluate(()=>calcAlerts(S.records).map(a=>a.id));
 await q.evaluate(()=>setState({screen:'dashboard',gppSec:'home',homeTratar:true}));await q.waitForTimeout(500);
 const home=await q.evaluate(()=>({txt:document.querySelector('.ht')?document.querySelector('.ht').textContent.replace(/\s+/g,' '):'',
   inc:[...document.querySelectorAll('.inc-v')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),
   up:[...document.querySelectorAll('.up-box .mr-row')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),
   esc:[...document.querySelectorAll('[data-action="escala-validar"]')].map(x=>x.dataset.mes)}));
 await q.screenshot({path:path.join(__dirname,'revisao_chefe.png'),fullPage:true});
 await q.click('[data-action="usadas-visto"]');await q.waitForTimeout(300);
 const upDepois=await q.evaluate(()=>document.querySelectorAll('.up-box').length);
 // fichas por aprovar: a do negócio já em Carteira vem primeiro e destacada
 const fa=await q.evaluate(()=>{window.fichasCalcDe=()=>({aprovacao:true,venda:0,margem:0});S.fichasAprov=[{id:91,negocio_id:5,dados:{},updated_at:'2026-11-26T10:00:00Z'},{id:92,negocio_id:3,dados:{},updated_at:'2026-11-01T10:00:00Z'},{id:61,negocio_id:6,estado:'ativa',dados:{},updated_at:'2026-11-25T10:00:00Z'},{id:62,negocio_id:6,estado:'vendida',dados:{},updated_at:'2026-11-20T10:00:00Z'}];
   return fichasAprovarLista().map(x=>x.r.id+':'+fichaJaFechada(x.r));});
 // escala: devolver sem comentário é recusado; com comentário grava; validar grava
 await q.evaluate(async()=>{S.escalaMes=null;await loadEscala();setState({screen:'escala'});});await q.waitForTimeout(400);
 await q.click('.esc-st [data-action="escala-devolver"]');await q.waitForTimeout(300);
 const semComent=est.rpc.filter(x=>x[0]==='escala_decidir').length;
 await q.fill('#esc-coment','Falta o sábado dia 6');await q.click('.esc-st [data-action="escala-devolver"]');await q.waitForTimeout(600);
 const dev=est.rpc.find(x=>x[0]==='escala_decidir');
 const escC=await q.evaluate(()=>(document.querySelector('.esc-st')||{}).textContent||'');
 await C.ctx.close();
 // vendedor vê a devolução e volta a poder mexer
 const V2=await abrir('v1');const p2=V2.p;
 await p2.evaluate(async()=>{await loadEscala();setState({screen:'escala'});});await p2.waitForTimeout(400);
 const escV3=await p2.evaluate(()=>({ed:document.querySelectorAll('.esc-gc.esc-editable').length,st:(document.querySelector('.esc-st')||{}).textContent||''}));
 await V2.ctx.close();
 const R0={nif,hojeV,rpcEnt,f298,camp,bloq,patch5,patch7,opcoes,vend6,patch6,escV,sub,escV2,passado,vend8,al,home,upDepois,fa,semComent,dev,escC,escV3,alertas,erros};console.log(JSON.stringify(R0,null,1));
 const ok={
  'NIF: válido, com espaços, com PT, inválido, curto, estrangeiro, vazio':JSON.stringify(nif)==='["ok","ok","ok","invalido","invalido","estrangeiro","",""]',
  'Hoje: secções Dados em falta e Entregas':hojeV.secs.some(x=>/^Dados em falta/.test(x))&&hojeV.secs.some(x=>/^Entregas/.test(x)),
  'dados em falta: só Carteiras incompletas do vendedor (1 e 2), com o que falta':JSON.stringify(hojeV.falta.map(x=>x.split(':')[0]))==='["1","2"]'
    &&/telefone,NIF,email,morada,código postal/.test(hojeV.falta[0])&&/NIF inválido,valor da retoma/.test(hojeV.falta[1]),
  'entregas do mês no Hoje, sem as notas do chefe':hojeV.nEnt===4&&hojeV.notas===0,
  'contagem do Hoje inclui os dados em falta':hojeV.badge===2,
  'vendedor marca a entrega pela função (só o campo mexido)':!!rpcEnt&&rpcEnt[1].p_negocio===1&&JSON.stringify(rpcEnt[1].p_patch)==='{"prep_pedida":true}',
  'Retail traz a data 298 de hoje':f298===hoje,
  'Campanha só aparece preenchida':JSON.stringify(camp)==='[false,true]',
  'mota nova sem ficha não passa a Carteira':/Sem ficha de margem/.test(bloq)&&!patch5,
  'usada sem ficha passa a Carteira':patch7,
  'várias fichas: escolhe a vendida e fica marcada':opcoes.length===2&&/Adventure/.test(opcoes[1])&&patch6&&vend6&&vend6[1].p_id===62,
  'escala: vendedor mexe no mês atual e submete':escV.ed>0&&escV.sub&&/Rascunho/.test(escV.st)&&sub&&sub[1].p_mes===mesE,
  'escala submetida: vendedor deixa de mexer':escV2.ed===0&&/Submetida/.test(escV2.st),
  'escala: mês passado não se mexe':passado===false,
  'ficha única fica marcada ao passar a Retail':!!vend8&&vend8[1].p_id===81,
  'alertas: saem os 4; ficam encomenda repetida e entrega do mês sem encomenda':!al.some(a=>['cart','cme','sem_chassis','enc_parada'].includes(a))&&al.includes('enc_repetida')&&al.includes('entrega_risco'),
  'chefe: contador de dados em falta por vendedor':home.inc.length===1&&/Vendedor Um\s*2|V.*2/.test(home.inc[0]),
  'chefe: usada parada com preço sugerido (só a de +90 dias)':home.up.length===1&&/125 dias/.test(home.up[0])&&/sugerido 9\s?800 €/.test(home.up[0])&&/mínimo 9\s?000 €/.test(home.up[0]),
  'chefe: «Visto esta semana» tira o aviso':upDepois===0,
  'chefe: escala submetida aparece para validar':home.esc.includes(mesE),
  'fichas por aprovar: só a vendida ou a única; negócio já em Carteira primeiro':JSON.stringify(fa)==='["6:1","3:1","5:0"]',
  'devolver sem comentário é recusado':semComent===0,
  'devolver com comentário grava':!!dev&&dev[1].p_validar===false&&dev[1].p_comentario==='Falta o sábado dia 6'&&/Devolvida/.test(escC),
  'vendedor vê a devolução e volta a mexer':escV3.ed>0&&/Devolvida pelo chefe.*Falta o sábado dia 6/.test(escV3.st),
  'sem erros na página':erros.length===0,
 };
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'TUDO OK');srv.close();await b.close();process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
