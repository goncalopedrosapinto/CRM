// Comissões: comissão fixa por negócio. O chefe escreve um valor em € que substitui a regra (percentagem / mínimo / demo);
// apagar volta à regra; não aceita negativos; o vendedor vê só o valor (sem a regra). Dados fictícios.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const RAIZ=path.resolve(__dirname,'..');const FILE=path.resolve(process.argv[2]||path.join(RAIZ,'index.html'));
const PORTA=8786;
const srv=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=u==='/'||u==='/index.html'?FILE:path.join(RAIZ,u.replace(/^\/+/,''));
  if(!f.startsWith(RAIZ)||!fs.existsSync(f)){s.writeHead(404);return s.end('');}s.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});s.end(fs.readFileSync(f));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}};
const h=new Date();const dia=String(Math.min(h.getDate(),2)).padStart(2,'0');const ymd=`${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${dia}`;
const R=(id,type,mat,extra)=>Object.assign({id,vendedor_id:'v1',status:'Retail',type,mat,id_cliente:'Cliente '+id,model:'Modelo',version:'',col_298:ymd,neg:ymd,updated_at:new Date().toISOString()},extra||{});
const recs=[R(1,'MU','AA-01-AA'),R(2,'MN','BB-02-BB'),R(3,'MU','CC-03-CC')];
const est={margens:{'1':{negocio_id:1,margem:-4320.72},'2':{negocio_id:2,margem:631.46},'3':{negocio_id:3,margem:1000}},escritas:[]};
const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control')return json(recs);
  if(t==='margens'){if(m==='GET')return json(Object.values(est.margens));
    if(quem!=='c1')return json({code:'42501',message:'new row violates row-level security policy'},403);
    const b=JSON.parse(r.request().postData());const id=String((u.match(/negocio_id=eq\.(\d+)/)||[])[1]||b.negocio_id);est.escritas.push([m,id,b]);
    if(m==='PATCH'){if(!est.margens[id])return json([]);Object.assign(est.margens[id],b);return json([est.margens[id]]);}
    est.margens[id]=Object.assign({negocio_id:Number(id)},b);return json([est.margens[id]],201);}
  return json([]);};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const erros=[];const alertas=[];
 const abrir=async(quem)=>{const ctx=await b.newContext({viewport:{width:1400,height:1000}});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));p.on('dialog',d=>{alertas.push(d.message());d.dismiss().catch(()=>{});});
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 const linha=(p,mat)=>p.evaluate(mat=>{const tr=[...document.querySelectorAll('tr')].find(x=>x.textContent.includes(mat));return tr?[...tr.cells].map(c=>c.textContent.replace(/[\s  ]+/g,' ').trim()):null;},mat);
 const C=await abrir('c1');const p=C.p;
 await p.evaluate(()=>{const x=document.createElement('button');x.dataset.action='gpp-sec';x.dataset.s='comissoes';document.getElementById('app').appendChild(x);x.click();x.remove();});await p.waitForTimeout(900);
 const cab=await p.evaluate(()=>[...document.querySelectorAll('th')].map(x=>x.textContent.trim()).filter(t=>/Comissão fixa/.test(t)).length);
 const antes=await linha(p,'AA-01-AA');
 await p.fill('[data-comfixa-id="1"]','150');await p.press('[data-comfixa-id="1"]','Tab');await p.waitForTimeout(500);
 const depois=await linha(p,'AA-01-AA');const esc1=est.escritas.slice(-1)[0];
 await p.fill('[data-comfixa-id="3"]','-5');await p.press('[data-comfixa-id="3"]','Tab');await p.waitForTimeout(400);
 const neg=est.margens['3'].comissao_fixa;
 await C.ctx.close();
 const V=await abrir('v1');await V.p.evaluate(()=>setState({screen:'vcom'}));await V.p.waitForTimeout(500);
 const vend=await V.p.evaluate(()=>{const it=[...document.querySelectorAll('.v-item')].find(x=>x.textContent.includes('AA-01-AA'));return it?it.textContent.replace(/[\s  ]+/g,' ').trim():'';});
 await V.ctx.close();
 const C2=await abrir('c1');await C2.p.evaluate(()=>{const x=document.createElement('button');x.dataset.action='gpp-sec';x.dataset.s='comissoes';document.getElementById('app').appendChild(x);x.click();x.remove();});await C2.p.waitForTimeout(900);
 await C2.p.fill('[data-comfixa-id="1"]','');await C2.p.press('[data-comfixa-id="1"]','Tab');await C2.p.waitForTimeout(500);
 const limpa=await linha(C2.p,'AA-01-AA');await C2.ctx.close();
 console.log(JSON.stringify({cab,antes,depois,esc1,neg,alertas,vend,limpa,erros},null,1));
 const ok={
  'coluna «Comissão fixa» nas Comissões':cab===1,
  'sem valor fixo segue a regra (margem negativa → mínimo)':!!antes&&antes.includes('35,00 €')&&antes.some(x=>/mínimo garantido/.test(x)),
  'valor fixo grava na margem do negócio e substitui a regra':!!esc1&&esc1[1]==='1'&&esc1[2].comissao_fixa===150&&!('margem' in esc1[2])&&depois.includes('150,00 €')&&depois.some(x=>x==='comissão fixa (substitui a regra)')&&est.margens['1'].margem===-4320.72,
  'valor negativo é recusado':neg==null&&alertas.some(a=>/igual ou maior que zero/.test(a)),
  'vendedor vê só o valor (sem dizer que é fixa)':/150,00 €/.test(vend)&&!/fixa|regra|mínimo/i.test(vend),
  'apagar volta à regra':est.margens['1'].comissao_fixa===null&&limpa.includes('35,00 €'),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Comissão fixa correta');await b.close();srv.close();process.exit(f?1:0);})();
