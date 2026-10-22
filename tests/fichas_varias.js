// Várias fichas de margem no mesmo negócio: criar outra (outra mota), trocar entre elas sem misturar dados,
// gravar cada uma na sua linha, marcar a vendida (as outras arquivadas), alerta enquanto não se escolhe,
// voltar à mesma ficha depois de recarregar, apagar só a ficha aberta. E a aprovação quando o esforço passa a variável.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8768;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const ctx=await b.newContext({viewport:{width:1300,height:900}});
 const db={fichas:[{id:11,negocio_id:5,estado:'ativa',criado_em:'2026-10-20T10:00:00Z',updated_at:'2026-10-20T10:00:00Z',dados:{natureza:'MN',iva:23,modo:'civa',fv:2,modelo:'F 900 R',pvb:'14208.39',preco_venda:'13250',mg_fixa_pct:'6',mg_var_pct:'3.5'}}],seq:12,log:[]};
 const recs=[{id:5,status:'Quente',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Duas Motas',model:'F 900 R',updated_at:new Date().toISOString()}];
 await ctx.addInitScript(t=>{if(!localStorage.getItem('bc_session'))localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));},jwt('v1'));
 const rota=async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  if(u.includes('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt('v1'),refresh_token:'rt2'})});
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/rpc/ficha_marcar_vendida')){const id=JSON.parse(r.request().postData()).p_id;db.log.push('vendida '+id);const f=db.fichas.find(x=>x.id===id);db.fichas.filter(x=>x.negocio_id===f.negocio_id).forEach(x=>{x.estado=x.id===id?'vendida':'arquivada';});return json(null);}
  if(u.includes('/rpc/ficha_aprovar')){const b2=JSON.parse(r.request().postData());db.log.push('aprovar '+b2.p_id+' '+b2.p_aprovar);const f=db.fichas.find(x=>x.id===b2.p_id);f.aprovada_em=b2.p_aprovar?new Date().toISOString():null;f.aprovada_por=b2.p_aprovar?'c1':null;return json(f.aprovada_em);}
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='fichas_margem'){
   const porId=(u.match(/[?&]id=eq\.(\d+)/)||[])[1],porNeg=(u.match(/negocio_id=eq\.(\d+)/)||[])[1],ver=(u.match(/updated_at=eq\.([^&]+)/)||[])[1];
   const sel=db.fichas.filter(x=>(!porId||x.id===+porId)&&(!porNeg||x.negocio_id===+porNeg));
   if(m==='GET')return json(sel);
   if(m==='POST'){const body=JSON.parse(r.request().postData());const f=Object.assign({id:db.seq++,estado:'ativa',criado_em:new Date().toISOString()},body);db.fichas.push(f);db.log.push('post '+f.id);return json([f],201);}
   if(m==='PATCH'){const body=JSON.parse(r.request().postData());const alvo=sel.filter(x=>!ver||x.updated_at===ver);alvo.forEach(x=>{if(body.dados&&JSON.stringify(body.dados)!==JSON.stringify(x.dados)){x.aprovada_em=null;x.aprovada_por=null;}Object.assign(x,body);});db.log.push('patch '+(porId?'id '+porId:'neg '+porNeg)+' '+alvo.length);return json(alvo);}
   if(m==='DELETE'){db.log.push('delete '+(porId?'id '+porId:'neg '+porNeg));db.fichas=db.fichas.filter(x=>!sel.includes(x));return r.fulfill({status:204,body:''});}}
  if(t==='profiles')return json([{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}]);
  if(t==='baviera_control')return json(recs);
  return json([]);};
 ctx._rotaFichas=rota;await ctx.route('**/*',rota);
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
 const est=()=>p.evaluate(()=>({ficha:S.fmFicha,modelo:S.fm&&S.fm.modelo,preco:S.fm&&S.fm.preco_venda,chips:[...document.querySelectorAll('.fm-fi')].map(x=>x.textContent.replace(/\s+/g,' ').trim())}));
 const escrever=async(k,v)=>{await p.evaluate(([k,v])=>fmSet(k,v),[k,v]);await p.waitForTimeout(900);};
 await p.evaluate(()=>{setState({screen:'detail',selected:S.records[0]});});await p.waitForTimeout(200);
 await p.click('[data-action="fm-negocio"]');await p.waitForTimeout(600);
 const a1=await est();
 await escrever('preco_venda','13300');
 await p.click('[data-action="fm-ficha-nova"]');await p.waitForTimeout(700);
 const a2=await est();
 await escrever('modelo','R 1300 GS');await escrever('pvb','24500');await escrever('preco_venda','23200');
 await p.click('.fm-fi[data-id="11"]');await p.waitForTimeout(500);const a3=await est();
 await p.click('.fm-fi[data-id="12"]');await p.waitForTimeout(500);const a4=await est();
 const servidor1=db.fichas.map(f=>({id:f.id,modelo:f.dados.modelo,preco:f.dados.preco_venda,estado:f.estado}));
 // negócio fecha: alerta e aviso até escolher
 await p.evaluate(()=>{S.records[0].status='Carteira';render();});await p.waitForTimeout(200);
 const alerta1=await p.evaluate(()=>calcAlerts(S.records).some(a=>a.id==='fichas_escolher'));const aviso=await p.$eval('.app-layout',x=>/Negócio fechado com 2 fichas/.test(x.textContent));
 await p.click('[data-action="fm-ficha-vendida"]');await p.waitForTimeout(700);
 const a5=await est();await p.screenshot({path:path.join(__dirname,'fichas_varias.png')});const alerta2=await p.evaluate(()=>calcAlerts(S.records).some(a=>a.id==='fichas_escolher'));
 // recarregar a página com a ficha 12 aberta: volta à 12
 await p.evaluate(()=>guardarRascunho());await p.reload();await p.waitForTimeout(1800);const a6=await est();
 // apagar só a ficha aberta (a 11)
 await p.click('.fm-fi[data-id="11"]');await p.waitForTimeout(400);await p.click('[data-action="fm-limpar"],[data-action="fm-limpar-ficha"]').catch(async()=>{await p.evaluate(()=>fmLimpar());});await p.waitForTimeout(700);
 const a7=await est();const restam=db.fichas.map(f=>f.id);
 // aprovação: esforço acima da margem variável
 await escrever('mg_fixa_pct','6');await escrever('mg_var_pct','3.5');await escrever('preco_venda','21000');
 const aprov=await p.evaluate(()=>{const c=fmCalc();const el=document.querySelector('.fm-aprov');return{esf:c.esforcoPct,varr:c.margVarPct,aprovEsforco:c.aprovEsforco,txt:el?el.textContent:''};});
 // vendedor: vê que já aparece ao chefe
 const vendTxt=aprov.txt;
 // chefe: lista para aprovar, aprovar, e a aprovação cai se a ficha mudar
 const pc=await b.newContext({viewport:{width:1300,height:900}});
 await pc.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('c1'));
 await pc.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());if(u.includes('/rest/v1/profiles'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}])});return ctx._rotaFichas(r);});
 const q=await pc.newPage();q.on('pageerror',e=>erros.push('chefe: '+e.message));q.on('dialog',d=>d.accept());
 await q.goto(`http://localhost:${PORTA}/`);await q.waitForTimeout(1800);
 await q.evaluate(()=>{S.screen='dashboard';S.gppSec='home';render();});await q.waitForTimeout(300);
 const lista1=await q.$$eval('.fa-box .mr-row',x=>x.map(e=>e.textContent.replace(/\s+/g,' ').trim()));
 const badge=await q.evaluate(()=>fichasAprovarLista().length);
 await q.click('.fa-box [data-action="fa-aprovar"]');await q.waitForTimeout(700);
 const lista2=await q.$$('.fa-box .mr-row').then(x=>x.length);
 await q.click('.fa-box [data-action="fa-abrir"]').catch(()=>{});
 await q.evaluate(()=>fmAbrirNegocio('5','12'));await q.waitForTimeout(700);
 const bannerChefe=await q.$eval('.fm-aprov',x=>x.textContent).catch(()=>'');
 const pdf=await q.evaluate(()=>{let h='';const o=window.open;window.open=()=>({document:{open(){},write:x=>{h+=x;},close(){}},focus(){},print(){}});try{fmPDF();}catch(e){}window.open=o;return /APROVADO PELA CHEFIA/.test(h);});
 // o vendedor muda a ficha: a aprovação cai e volta à lista do chefe
 await escrever('preco_venda','20900');
 await q.evaluate(()=>loadFichasAprovar().then(()=>{S.fmNeg=null;S.screen='dashboard';S.gppSec='home';render();}));await q.waitForTimeout(500);
 const lista3=await q.$$('.fa-box .mr-row').then(x=>x.length);
 await pc.close();
 const R={a1,a2,a3,a4,servidor1,alerta1,aviso,a5,alerta2,a6,a7,restam,aprov,vendTxt,lista1,badge,lista2,bannerChefe,pdf,lista3,log:db.log,erros};
 console.log(JSON.stringify(R,null,1));
 const ok={
  'abre a ficha existente do negócio':a1.ficha===11&&a1.modelo==='F 900 R',
  'outra mota cria ficha nova vazia, sem estragar a primeira':a2.ficha===12&&!a2.modelo&&a2.chips.length===2,
  'cada ficha grava na sua linha':JSON.stringify(servidor1)===JSON.stringify([{id:11,modelo:'F 900 R',preco:'13300',estado:'ativa'},{id:12,modelo:'R 1300 GS',preco:'23200',estado:'ativa'}])&&db.log.some(l=>l.startsWith('patch id 11'))&&db.log.some(l=>l.startsWith('patch id 12')),
  'trocar de ficha não mistura dados':a3.modelo==='F 900 R'&&a3.preco==='13300'&&a4.modelo==='R 1300 GS'&&a4.preco==='23200',
  'negócio fechado sem escolha: alerta e aviso':alerta1&&aviso,
  'marcar vendida: uma vendida, a outra arquivada, alerta some':a5.chips.some(c=>/R 1300 GS.*vendida/.test(c))&&a5.chips.some(c=>/F 900 R.*arquivada/.test(c))&&!alerta2,
  'depois de recarregar volta à mesma ficha':a6.ficha===12&&a6.modelo==='R 1300 GS',
  'apagar só apaga a ficha aberta':JSON.stringify(restam)===JSON.stringify([12])&&db.log.includes('delete id 11')&&a7.ficha===12,
  'esforço acima da variável pede aprovação':aprov.aprovEsforco&&/acima da margem variável/.test(aprov.txt),
  'vendedor vê que a ficha já aparece ao chefe':/Já aparece ao chefe/.test(vendTxt),
  'chefe: ficha aparece para aprovar e conta nos pendentes':lista1.length===1&&/Cliente Duas Motas/.test(lista1[0])&&/acima da margem variável/.test(lista1[0])&&badge===1,
  'chefe: aprovar tira da lista e fica registado':lista2===0&&db.log.includes('aprovar 12 true'),
  'ficha aprovada mostra quem aprovou (e no PDF)':/Aprovada por Chefe GPP/.test(bannerChefe)&&pdf,
  'vendedor muda a ficha aprovada: volta para aprovar':lista3===1,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Várias fichas corretas');await b.close();srv.close();process.exit(f?1:0);})();
