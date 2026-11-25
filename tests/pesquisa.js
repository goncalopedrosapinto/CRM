// Pesquisa: escrever sem perder o teclado e encontrar a matrícula escrita de qualquer forma. Dados fictícios.
// - enquanto se escreve na pesquisa, o ecrã atualiza mas o campo é o mesmo elemento (o teclado do telemóvel não volta às letras) e mantém o foco e o cursor;
// - «ci86cj» encontra «CI-86-CJ» e «ci-86-cj» encontra «CI86CJ»; «r1300» encontra «R 1300 GS»; acentos e maiúsculas não contam;
// - na pesquisa do chefe (telemóvel) e no filtro das tabelas é igual.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8794;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}};
const hoje=new Date().toISOString().slice(0,10);
const R=(id,o)=>Object.assign({id,vendedor_id:'v1',status:'Quente',type:'MN',id_cliente:'Cliente '+id,model:'F 900 R',version:'',alert_date:hoje,updated_at:new Date().toISOString()},o);
const recs=[R(1,{id_cliente:'João Ávila',mat:'CI-86-CJ',model:'R 1300 GS'}),R(2,{id_cliente:'Maria Sousa',mat:'AB12CD'}),R(3,{id_cliente:'Rui Costa',mat:'99-XY-88',model:'S 1000 RR'})];
const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control')return json(recs);
  return json([]);};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const erros=[];const alertas=[];
 const abrir=async(quem,vp)=>{const ctx=await b.newContext({viewport:vp,isMobile:true,hasTouch:true});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));await ligarAvisos(p,alertas);
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 // vendedor, telemóvel: lista com pesquisa
 const V=await abrir('v1',{width:390,height:844});const p=V.p;
 await p.evaluate(()=>setState({screen:'list',statusFilter:'all'}));await p.waitForTimeout(300);
 await p.evaluate(()=>{const e=document.getElementById('f-search');e._marca='original';e.focus();});
 await p.keyboard.type('ci',{delay:60});await p.waitForTimeout(400);
 await p.keyboard.type('86',{delay:400});   // devagar: há redesenho entre os dois algarismos
 await p.waitForTimeout(400);await p.keyboard.type('cj',{delay:60});await p.waitForTimeout(500);
 const v1=await p.evaluate(()=>{const e=document.getElementById('f-search');return {mesmo:e&&e._marca==='original',foco:document.activeElement===e,valor:e&&e.value,cursor:e&&e.selectionStart,lista:recsInContext().filter(r=>negProcura(r,e.value)).map(r=>r.id)};});
 const procura=await p.evaluate(()=>{const r=id=>S.records.find(x=>x.id===id);return {
   semTraco:negProcura(r(1),'ci86cj'),comTraco:negProcura(r(2),'ab-12-cd'),espacos:negProcura(r(1),'r1300'),acento:negProcura(r(1),'joao avila'),
   numMat:negProcura(r(3),'99xy'),naoEncontra:negProcura(r(2),'ci86cj')};});
 await V.ctx.close();
 // chefe, telemóvel: pesquisa geral
 const C=await abrir('c1',{width:390,height:844});const q=C.p;
 await q.evaluate(()=>setState({screen:'dashboard',gppSec:'home',gppMais:true}));await q.waitForTimeout(300);
 const temM=await q.evaluate(()=>{const e=document.getElementById('gpp-search-m');if(!e)return false;e._marca='original';e.focus();return true;});
 let c1={};
 if(temM){await q.keyboard.type('ci-86',{delay:350});await q.waitForTimeout(600);
   c1=await q.evaluate(()=>{const e=document.getElementById('gpp-search-m');return {mesmo:e&&e._marca==='original',foco:document.activeElement===e,valor:e&&e.value,res:document.body.textContent.includes('João Ávila')};});}
 // filtro das tabelas
 const tabela=await q.evaluate(()=>{const t=document.createElement('table');t.innerHTML='<tbody><tr><td>CI-86-CJ</td></tr><tr><td>AB-12-CD</td></tr></tbody>';document.body.appendChild(t);
   tblFiltrar(t,'ci86cj');const vis=[...t.tBodies[0].rows].map(r=>r.style.display!=='none');t.remove();return vis;});
 await C.ctx.close();
 const R0={v1,procura,temM,c1,tabela,alertas,erros};console.log(JSON.stringify(R0,null,1));
 const ok={
  'vendedor: a escrever, o campo é o mesmo elemento, com foco e cursor no fim':v1.mesmo&&v1.foco&&v1.valor==='ci86cj'&&v1.cursor===6,
  'vendedor: «ci86cj» encontra a CI-86-CJ e só ela':JSON.stringify(v1.lista)==='[1]',
  'matrícula com ou sem traços, modelo sem espaços, nome sem acentos':procura.semTraco&&procura.comTraco&&procura.espacos&&procura.acento&&procura.numMat&&!procura.naoEncontra,
  'chefe (telemóvel): o campo da pesquisa geral não é trocado e encontra «ci-86»':temM&&c1.mesmo&&c1.foco&&c1.valor==='ci-86'&&c1.res,
  'filtro das tabelas ignora traços':JSON.stringify(tabela)==='[true,false]',
  'sem erros na página':erros.length===0,
 };
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'TUDO OK');srv.close();await b.close();process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
