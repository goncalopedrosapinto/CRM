// Duplicar a ficha de margem (pedido do chefe, 18/11/2026): «Duplicar esta» cria uma cópia com os mesmos dados e abre-a;
// mexer na cópia não muda a original, e a original guarda a aprovação que tinha; a cópia é uma ficha nova (sem aprovação)
// e aparece marcada como «cópia». Também as percentagens perto de zero e do limite (margem de −3 € não é «0,0 %»).
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8788;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const ctx=await b.newContext({viewport:{width:1300,height:900}});
 const APROV='2026-11-17T10:00:00Z';
 const db={fichas:[{id:11,negocio_id:5,estado:'ativa',criado_em:'2026-11-17T09:00:00Z',updated_at:'2026-11-17T09:00:00Z',aprovada_em:APROV,aprovada_por:'c1',
   dados:{natureza:'MN',iva:23,modo:'civa',fv:2,modelo:'R 12 nineT',cliente:'Cliente Ficticio',pvb:'20000',preco_venda:'17500',mg_fixa_pct:'6',mg_var_pct:'3.5',compart_conc:'150'}}],seq:12,log:[],posts:[]};
 const recs=[{id:5,status:'Quente',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Ficticio',model:'R 12 nineT',updated_at:new Date().toISOString()}];
 await ctx.addInitScript(t=>{if(!localStorage.getItem('bc_session'))localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));},jwt('v1'));
 await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  if(u.includes('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt('v1'),refresh_token:'rt2'})});
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='fichas_margem'){
   const porId=(u.match(/[?&]id=eq\.(\d+)/)||[])[1],porNeg=(u.match(/negocio_id=eq\.(\d+)/)||[])[1],ver=(u.match(/updated_at=eq\.([^&]+)/)||[])[1];
   const sel=db.fichas.filter(x=>(!porId||x.id===+porId)&&(!porNeg||x.negocio_id===+porNeg));
   if(m==='GET')return json(sel);
   if(m==='POST'){const body=JSON.parse(r.request().postData());db.posts.push(body);const f=Object.assign({id:db.seq++,estado:'ativa',aprovada_em:null,aprovada_por:null,criado_em:new Date().toISOString()},body);db.fichas.push(f);db.log.push('post '+f.id);return json([f],201);}
   if(m==='PATCH'){const body=JSON.parse(r.request().postData());const alvo=sel.filter(x=>!ver||x.updated_at===ver);alvo.forEach(x=>{if(body.dados&&JSON.stringify(body.dados)!==JSON.stringify(x.dados)){x.aprovada_em=null;x.aprovada_por=null;}Object.assign(x,body);});db.log.push('patch id '+porId);return json(alvo);}
   return json([]);}
  if(t==='profiles')return json([{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}]);
  if(t==='baviera_control')return json(recs);
  return json([]);});
 const p=await ctx.newPage();const erros=[],avisos=[];p.on('pageerror',e=>erros.push(e.message));await ligarAvisos(p,avisos);
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
 const tx=s=>s.replace(/[  ]/g,' ').replace(/\s+/g,' ').trim();
 const est=()=>p.evaluate(()=>({ficha:S.fmFicha,modelo:S.fm&&S.fm.modelo,preco:S.fm&&S.fm.preco_venda,compart:S.fm&&S.fm.compart_conc,
   chips:[...document.querySelectorAll('.fm-fi')].map(x=>x.textContent.replace(/[  ]/g,' ').replace(/\s+/g,' ').trim()),
   botao:!!document.querySelector('[data-action="fm-ficha-duplicar"]'),aprov:(document.querySelector('.fm-aprov')||{}).textContent||'',estado:(document.getElementById('fm-estado')||{}).textContent||''}));
 const escrever=async(k,v)=>{await p.evaluate(([k,v])=>fmSet(k,v),[k,v]);await p.waitForTimeout(900);};
 await p.evaluate(()=>{setState({screen:'detail',selected:S.records[0]});});await p.waitForTimeout(200);
 await p.click('[data-action="fm-negocio"]');await p.waitForTimeout(700);
 const a1=await est();
 await p.click('[data-action="fm-ficha-duplicar"]');await p.waitForTimeout(800);
 const a2=await est();const toast=await p.evaluate(()=>(document.querySelector('#bm-toast .bm-toast-m')||{}).textContent||'');
 await p.screenshot({path:path.join(__dirname,'ficha_duplicar.png')});
 // mexer na cópia
 await escrever('preco_venda','17300');const a3=await est();
 const srv1=db.fichas.map(f=>({id:f.id,preco:f.dados.preco_venda,copia:f.dados.copia_de==null?null:f.dados.copia_de,aprov:!!f.aprovada_em}));
 // voltar à original
 await p.click('.fm-fi[data-id="11"]');await p.waitForTimeout(500);const a4=await est();
 // percentagens perto de zero e do limite
 const pcs=await p.evaluate(()=>({m:fmtPcLim(-0.00018,0.005),e:fmtPcLim(0.0352,0.035),z:fmtPcLim(0.0002),zero:fmtPcLim(0),eur:fmtEur(7100,0),neg:fmtEur(-3.4,0),quase:fmtEur(-0.001,2)}));
 const R={a1,a2,toast,a3,srv1,a4,pcs,posts:db.posts,log:db.log,avisos,erros};console.log(JSON.stringify(R,null,1));
 const N=' ';
 const ok={
  'abre a ficha do negócio, aprovada, com o botão «Duplicar esta»':a1.ficha===11&&a1.botao&&/Aprovada por/.test(a1.aprov)&&a1.chips.length===1,
  'duplicar cria uma ficha nova com os mesmos dados e abre-a':a2.ficha===12&&a2.modelo==='R 12 nineT'&&a2.preco==='17500'&&a2.compart==='150'&&a2.chips.length===2&&db.posts.length===1&&db.posts[0].negocio_id===5&&db.posts[0].dados.copia_de===11&&db.posts[0].dados.pvb==='20000',
  'a cópia aparece marcada e diz que a original fica como estava':/R 12 nineT.*cópia/.test(a2.chips[1])&&!/cópia/.test(a2.chips[0])&&/original fica como estava/.test(toast)&&/original fica como estava/.test(a2.estado),
  'a cópia não traz a aprovação (é uma ficha nova e volta a pedir aprovação)':!('aprovada_em' in db.posts[0])&&/Necessário aprovação da chefia/.test(a2.aprov),
  'mexer na cópia não muda a original, que guarda a aprovação':JSON.stringify(srv1)===JSON.stringify([{id:11,preco:'17500',copia:null,aprov:true},{id:12,preco:'17300',copia:11,aprov:false}])&&db.log.includes('patch id 12')&&!db.log.includes('patch id 11'),
  'voltar à original: dados e aprovação como estavam':a4.ficha===11&&a4.preco==='17500'&&/Aprovada por/.test(a4.aprov),
  'percentagens: margem de −3 € não é «0,0 %», 3,52 % não vira 3,5 %, milhares agrupados e sinal de menos':pcs.m==='−0,02'+N+'%'&&pcs.e==='3,52'+N+'%'&&pcs.z==='0,02'+N+'%'&&pcs.zero==='0,0'+N+'%'&&pcs.eur==='7'+N+'100'+N+'€'&&pcs.neg==='−3'+N+'€'&&pcs.quase==='0,00'+N+'€',
  'sem erros JS nem avisos de erro':!erros.length&&!avisos.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Duplicar ficha correto');await b.close();srv.close();process.exit(f?1:0);})();
