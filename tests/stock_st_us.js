// Lembrete ao chefe: motas ST de Aveiro com 90+ dias em stock (desde 193; sem 193, desde 198) → pedir a mudança para US.
// Aparece no Home e em "A tratar", conta nos pendentes, marca "→ US" na tabela; "Já pedi" esconde até ao próximo ficheiro
// (se ainda vier em ST, volta); "Ver no stock" abre o Stock Aveiro com a mota. Rede/BMW, US, fora do stand e vendedores: não.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8771;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const ha=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const imp=new Date(Date.now()-3600e3).toISOString();
const L=(pn,tipo,st,dias,o,extra)=>Object.assign({origem:o||'aveiro',production_number:pn,model_code:'0M21',model_desc:'Mota '+pn,color_code:'N52',processing_type:tipo,order_status:st,ts_order_status:ha(dias),importado_em:imp},extra||{});
const enc=[L('8000001','ST','193',120),L('8000002','ST','198',30),L('8000003','US','193',200),L('8000004','ST','111',200),L('8000005','ST','198',95,'rede'),L('8000006','ST','198',60)];
const cheg=[{production_number:'8000006',data_193:ha(100),data_198:ha(60)}];
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const ctx=await b.newContext({viewport:{width:1400,height:900}});
 await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('c1'));
 await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());if(u.startsWith('http://localhost'))return r.continue();
  const json=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt('c1'),refresh_token:'x'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([{id:'c1',nome:'Chefe',role:'admin',linha:'motorrad'}]);
  if(t==='encomendas_bmw')return json(u.includes('offset=0')?enc:[]);
  if(t==='encomendas_chegadas')return json(u.includes('offset=0')?cheg:[]);
  return json([]);});
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(2000);
 const R={};
 await p.evaluate(()=>{S.screen='dashboard';S.gppSec='home';render();});await p.waitForTimeout(300);
 const linhas=()=>p.$$eval('.us-box .mr-row',x=>x.map(e=>e.textContent.replace(/\s+/g,' ').trim()));
 R.home=await linhas();R.titulo=await p.evaluate(()=>(document.querySelector('.us-box .mr-h')||{}).textContent||'');
 R.pend=await p.evaluate(()=>{const b=[...document.querySelectorAll('.gpp-nav-item,.gpp-tab')].find(x=>/A tratar/.test(x.textContent));return b?b.textContent.replace(/\s+/g,' ').trim():'';});
 await p.evaluate(()=>{S.gppSec='pendentes';render();});await p.waitForTimeout(200);R.pendentes=(await linhas()).length;
 // tabela do Stock Aveiro
 await p.evaluate(()=>{S.gppSec='encomendas';S.encOrigem='aveiro';S.encF={q:'',ex:{}};render();});await p.waitForTimeout(300);
 R.marcas=await p.evaluate(()=>{const ths=[...document.querySelectorAll('.enc-t th')].map(t=>t.textContent);const iP=ths.indexOf('Produção');const o=[];document.querySelectorAll('.enc-t tbody tr:not(.enc-grp)').forEach(tr=>{if(tr.querySelector('.enc-us'))o.push(tr.children[iP].textContent);});return o.sort();});
 R.resumo=await p.evaluate(()=>((document.querySelector('.enc-stock')||{}).textContent||'').replace(/\s+/g,' '));
 // "Ver no stock"
 await p.evaluate(()=>{S.gppSec='home';render();});await p.waitForTimeout(200);
 await p.click('.us-box [data-action="us-ver"][data-pn="8000006"]');await p.waitForTimeout(400);
 R.ver=await p.evaluate(()=>({sec:S.gppSec,or:S.encOrigem,q:(document.getElementById('enc-q')||{}).value,linhas:document.querySelectorAll('.enc-t tbody tr:not(.enc-grp)').length}));
 // "Já pedi" esconde até ao próximo ficheiro
 await p.evaluate(()=>{S.gppSec='home';S.encF={q:'',ex:{}};render();});await p.waitForTimeout(200);
 await p.click('.us-box [data-action="us-feito"][data-pn="8000001"]');await p.waitForTimeout(300);
 R.depoisFeito=await linhas();
 await p.evaluate(()=>{S.enc.forEach(x=>{x.importado_em=new Date().toISOString();});render();});await p.waitForTimeout(200);
 R.novoFicheiro=await linhas();
 R.vendedor=await p.evaluate(()=>{const r=S.me.role;S.me.role='vendedor';const n=encStParaUs().length;S.me.role=r;return n;});
 await p.evaluate(()=>{S.gppSec='home';render();});await p.waitForTimeout(200);await p.screenshot({path:path.join(__dirname,'stock_st_us.png')});
 R.erros=erros;console.log(JSON.stringify(R,null,1));
 const ok={
  'só ST de Aveiro no stand com 90+ dias (conta desde 193 quando se sabe), as mais antigas primeiro':R.home.length===2&&/Mota 8000001/.test(R.home[0])&&/120 dias/.test(R.home[0])&&/Mota 8000006/.test(R.home[1])&&/100 dias/.test(R.home[1])&&/Mudar de ST para US · 2/.test(R.titulo),
  'aparece também em "A tratar" e conta nos pendentes':R.pendentes===2&&/A tratar\s*\d+/.test(R.pend),
  'tabela marca "→ US" nessas motas e o resumo conta-as':JSON.stringify(R.marcas)==='["8000001","8000006"]'&&/2 ST para passar a US/.test(R.resumo),
  '"Ver no stock" abre o Stock Aveiro já com a mota':R.ver.sec==='encomendas'&&R.ver.or==='aveiro'&&R.ver.q==='8000006'&&R.ver.linhas===1,
  '"Já pedi" esconde; ficheiro novo ainda em ST faz voltar':R.depoisFeito.length===1&&/8000006/.test(R.depoisFeito[0])&&R.novoFicheiro.length===2,
  'vendedores não veem o lembrete':R.vendedor===0,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Lembrete ST → US correto');await b.close();srv.close();process.exit(f?1:0);})();
