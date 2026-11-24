// Funil: «Adiado» é um estado (não um motivo de perda) e cada fase mostra o que quer dizer. Dados fictícios.
// - o vendedor adia um negócio no painel (1/3/6 meses): estado Adiado, data de re-contacto, sem motivo de perda;
// - a lista de motivos de perda já não tem «Adiado»; o adiado aparece no chip «Adiado» e volta a aparecer na data;
// - gravar Adiado sem data futura é recusado com aviso;
// - o quadro do chefe tem a coluna Adiado e a definição de cada fase.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8793;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}};
const hoje=new Date().toISOString().slice(0,10);
const R=(id,status,o)=>Object.assign({id,vendedor_id:'v1',status,type:'MN',id_cliente:'Cliente '+id,model:'R 1300 GS',version:'',alert_date:hoje,updated_at:new Date().toISOString(),status_updated_at:new Date().toISOString()},o||{});
const est={recs:[R(1,'Quente'),R(2,'Morno'),R(3,'Frio'),R(4,'Adiado',{recontactar_em:'2026-01-10'}),R(5,'Perdido',{motivo_perda:'Preço'})],patches:[]};
const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control'){if(m==='GET')return json(est.recs);const b=JSON.parse(r.request().postData()||'{}');const id=Number((u.match(/id=eq\.(\d+)/)||[])[1]);
    est.patches.push([id,b]);const x=est.recs.find(y=>y.id===id);if(x)Object.assign(x,b);return json(x?[x]:[]);}
  return json([]);};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const erros=[];const alertas=[];
 const abrir=async(quem,vp)=>{const ctx=await b.newContext({viewport:vp||{width:1400,height:1000}});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));await ligarAvisos(p,alertas);
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 // vendedor
 const V=await abrir('v1');const p=V.p;
 const motivos=await p.evaluate(()=>MOTIVOS_PERDA.slice());
 const painel=await p.evaluate(()=>{S.vhAcao={id:1,t:'perder'};const h=vhPainelHTML(S.records.find(r=>r.id===1));const d=document.createElement('div');d.innerHTML=h;
   return {txt:d.textContent.replace(/\s+/g,' '),adi:[...d.querySelectorAll('[data-action="vh-adiado"]')].map(x=>x.dataset.meses),perd:[...d.querySelectorAll('[data-action="vh-perdido"]')].map(x=>x.dataset.m)};});
 await p.evaluate(()=>vhAdiado(1,3));await p.waitForTimeout(500);
 const pat=(est.patches.find(x=>x[0]===1)||[])[1]||{};
 const esperado=(()=>{const d=new Date();d.setMonth(d.getMonth()+3);return d.toISOString().slice(0,10);})();
 const chip=await p.evaluate(()=>{setState({screen:'list',statusFilter:'Adiado'});return null;});await p.waitForTimeout(300);
 const lista=await p.evaluate(()=>({n:filtered().length,ids:filtered().map(r=>r.id).sort(),devido:recontLista().map(r=>r.id)}));
 // gravar Adiado sem data
 const semData=await p.evaluate(async()=>{const r=S.records.find(x=>x.id===2);S.selected=r;S.form=Object.assign({},r,{status:'Adiado',recontactar_em:''});S.screen='edit';await saveRecord();return S.error||'';});
 await V.ctx.close();
 // chefe: quadro do funil
 const C=await abrir('c1');const q=C.p;
 await q.evaluate(()=>setState({screen:'dashboard',gppSec:'funil'}));await q.waitForTimeout(400);
 const quadro=await q.evaluate(()=>[...document.querySelectorAll('.fq-col')].map(c=>c.querySelector('.fq-h span').textContent+'|'+(c.querySelector('.fq-def')||{}).textContent));
 await C.ctx.close();
 const R0={motivos,painel,pat,esperado,lista,semData,quadro,alertas,erros};console.log(JSON.stringify(R0,null,1));
 const ok={
  'motivos de perda sem «Adiado»':!motivos.includes('Adiado'),
  'painel: perda só com motivos; adiar à parte (1/3/6 meses)':JSON.stringify(painel.adi)==='["1","3","6"]'&&!painel.perd.includes('Adiado')&&/o cliente adiou/.test(painel.txt),
  'adiar grava estado Adiado, data e sem motivo de perda':pat.status==='Adiado'&&pat.recontactar_em===esperado&&pat.motivo_perda===null,
  'chip Adiado lista os adiados; o que já passou da data volta a aparecer':JSON.stringify(lista.ids)==='[1,4]'&&lista.devido.includes(4)&&!lista.devido.includes(1),
  'Adiado sem data é recusado':/Adiado precisa da data/.test(semData)&&!est.patches.some(x=>x[0]===2),
  'quadro do chefe: coluna Adiado e definição em cada fase':quadro.length===4&&/^Adiado\|O cliente disse que adia/.test(quadro[0])&&quadro.some(c=>/^Quente\|Compra até ao fim deste mês/.test(c))&&quadro.some(c=>/^Morno\|Compra nos próximos 2 meses/.test(c))&&quadro.some(c=>/^Frio\|Interessado, sem data/.test(c)),
  'sem erros na página':erros.length===0,
 };
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'TUDO OK');srv.close();await b.close();process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
