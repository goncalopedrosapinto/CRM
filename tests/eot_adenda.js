// EOTs com adenda: a fase Adenda conta como renovado (verde, no cartão e por vendedor). Quando o mapa do banco traz o
// mesmo contrato com uma data de fim nova, a pré-visualização mostra que vai reabrir; ao confirmar, volta a "Por contactar",
// fica a data da adenda (continua a contar como renovado) e a próxima ação antiga é limpa. Contratos com a mesma data
// ou sem adenda não mexem. Sem o SQL, a importação não falha: avisa que falta correr a migração.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8768;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const base=()=>[
  {contrato:'A1',cliente:'Cliente Adenda',data_fim:'2026-11-01',fase:'Adenda',no_mapa:true,responsavel_id:'v1',proxima_acao:'Assinar adenda',proxima_data:'2026-10-01'},
  {contrato:'B2',cliente:'Cliente Saiu',data_fim:'2026-10-15',fase:'Adenda',no_mapa:false,responsavel_id:'v1'},
  {contrato:'C3',cliente:'Cliente Normal',data_fim:'2027-01-10',fase:'Por contactar',no_mapa:true,responsavel_id:'v2'},
  {contrato:'D4',cliente:'Cliente Mesma Data',data_fim:'2026-12-01',fase:'Adenda',no_mapa:true,responsavel_id:'v2'},
  {contrato:'E5',cliente:'Cliente Renovou',data_fim:'2026-11-20',fase:'Renovado',no_mapa:true,responsavel_id:'v2'}];
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const est={eot:base(),patches:[],semColuna:false};
 const ctx=await b.newContext({viewport:{width:1400,height:900}});
 await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('c1'));
 await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  if(u.includes('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt('c1'),refresh_token:'rt2'})});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='eot_contratos'&&m==='POST'){for(const l of JSON.parse(r.request().postData())){const e=est.eot.find(x=>x.contrato===l.contrato);if(e)Object.assign(e,l);else est.eot.push(Object.assign({fase:'Por contactar'},l));}return r.fulfill({status:201,body:''});}
  if(t==='eot_contratos'&&m==='PATCH'){const body=JSON.parse(r.request().postData());est.patches.push({u,body});
    if(est.semColuna&&'adenda_em' in body)return r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'PGRST204',message:"Could not find the 'adenda_em' column of 'eot_contratos' in the schema cache"})});
    const ids=((u.match(/contrato=in\.\(([^)]*)\)/)||[])[1]||'').split(',').map(x=>x.replace(/"/g,''));const soAd=/fase=eq\.Adenda/.test(u);
    const alvo=est.eot.filter(x=>ids.includes(x.contrato)&&(!soAd||x.fase==='Adenda'));alvo.forEach(x=>Object.assign(x,body));
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(alvo)});}
  if(t==='eot_contratos')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(est.eot)});
  if(t==='profiles')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'c1',nome:'Chefe',role:'admin',linha:'motorrad'},{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'},{id:'v2',nome:'Vendedor Dois',role:'vendedor',linha:'motorrad'}])});
  return r.fulfill({status:200,contentType:'application/json',body:'[]'});});
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
 // mapa novo: A1 e B2 com data de fim nova (adenda), D4 com a mesma data, C3 e E5 iguais
 const linhas=[{contrato:'A1',cliente:'Cliente Adenda',data_fim:'2028-11-01'},{contrato:'B2',cliente:'Cliente Saiu',data_fim:'2028-10-15'},
   {contrato:'C3',cliente:'Cliente Normal',data_fim:'2027-01-10'},{contrato:'D4',cliente:'Cliente Mesma Data',data_fim:'2026-12-01'},{contrato:'E5',cliente:'Cliente Renovou',data_fim:'2026-11-20'}];
 const importar=async()=>{await p.evaluate(async L=>{await loadEot();const d=eotDiff(L,S.eot);S.eotPrev=Object.assign({nome:'mapa.xlsx',linhas:L,total:L.length,exMarca:0,exConc:0},d);S.screen='dashboard';S.gppSec='eots';render();},linhas);await p.waitForTimeout(300);};
 // antes de importar: Adenda conta como renovado
 await p.evaluate(async()=>{await loadEot();S.screen='dashboard';S.gppSec='eots';S.eotPrev=null;render();});await p.waitForTimeout(300);
 const cartao=async()=>p.evaluate(()=>{const c=[...document.querySelectorAll('.mg-card')].find(x=>/Renovados/.test(x.textContent));return c?c.textContent.replace(/\s+/g,' ').trim():'';});
 const antes={cartao:await cartao(),tagAd:await p.evaluate(()=>eotFaseHTML({fase:'Adenda'}))};
 // sem o SQL: não reabre, avisa e não rebenta
 est.semColuna=true;await importar();
 const prev={txt:await p.textContent('.eot-prev'),reab:await p.evaluate(()=>(S.eotPrev.reabrir||[]).map(x=>x.contrato))};
 await p.click('[data-action="eot-confirmar"]');await p.waitForTimeout(800);
 const semSql={msg:await p.evaluate(()=>S.eotMsg||S.eotErrImp||''),fases:est.eot.map(x=>x.contrato+':'+x.fase).join(' ')};
 // com o SQL
 est.semColuna=false;est.eot=base();est.patches=[];await importar();
 await p.click('[data-action="eot-confirmar"]');await p.waitForTimeout(800);
 const hoje=new Date().toISOString().slice(0,10);const pa=est.patches.find(x=>'adenda_em' in x.body)||{body:{},u:''};
 const depois={msg:await p.evaluate(()=>S.eotMsg||''),patch:pa,
   A1:est.eot.find(x=>x.contrato==='A1'),B2:est.eot.find(x=>x.contrato==='B2'),D4:est.eot.find(x=>x.contrato==='D4'),C3:est.eot.find(x=>x.contrato==='C3'),
   cartao:await cartao(),
   linhaA1:await p.evaluate(()=>{const r=[...document.querySelectorAll('[data-action="eot-abrir"]')].find(x=>x.dataset.c==='A1');return r?r.textContent.replace(/\s+/g,' '):'';}),
   acaoA1:await p.evaluate(()=>eotPrecisaAcao(S.eot.find(x=>x.contrato==='A1'))),
   porVend:await p.evaluate(()=>{const t=[...document.querySelectorAll('.eotd-row')].map(r=>r.textContent.replace(/\s+/g,' ').trim());return t;})};
 await p.screenshot({path:path.join(__dirname,'eot_adenda.png'),fullPage:false});
 const R={antes,prev,semSql,depois,erros};console.log(JSON.stringify(R,null,1));
 const ok={
  'Adenda a verde e conta como renovado (A1, B2, D4 + E5 renovado = 4)':/atag-ok/.test(antes.tagAd)&&/Renovados \/ Retomados\s*4\s*inclui 3 adendas/.test(antes.cartao),
  'pré-visualização: só A1 e B2 reabrem (data de fim nova), D4 não':JSON.stringify(prev.reab)==='["A1","B2"]'&&/2 com adenda e data de fim nova/.test(prev.txt)&&/01\/11\/2026 → 01\/11\/2028/.test(prev.txt),
  'sem o SQL: não reabre, avisa e não falha':/falta correr o SQL "2026-10-22_eot_adenda"/.test(semSql.msg)&&/A1:Adenda/.test(semSql.fases),
  'ao confirmar: A1 e B2 voltam a Por contactar com a data da adenda e sem a ação antiga':depois.A1.fase==='Por contactar'&&depois.A1.adenda_em===hoje&&depois.A1.proxima_acao===null&&depois.A1.proxima_data===null&&depois.B2.fase==='Por contactar'&&depois.B2.adenda_em===hoje,
  'só reabre contratos que ainda estão em Adenda':/fase=eq\.Adenda/.test(depois.patch.u)&&depois.D4.fase==='Adenda'&&!depois.D4.adenda_em&&depois.C3.fase==='Por contactar'&&!depois.C3.adenda_em,
  'mensagem diz quantos reabriram':/2 com adenda voltaram a "Por contactar"/.test(depois.msg),
  'reabertos continuam a contar como renovado':/Renovados \/ Retomados\s*4\s*inclui 3 adendas/.test(depois.cartao),
  'linha do contrato mostra que teve adenda':/adenda \d\d\/\d\d\/\d{4}/.test(depois.linhaA1),
  'nova data longe: não pede ação já':depois.acaoA1===false,
  'renovados por vendedor contam a adenda':depois.porVend.some(t=>/Vendedor Um .*\d+\/\d+ 2 /.test(t)),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Adendas nas EOTs corretas');await b.close();srv.close();process.exit(f?1:0);})();
