// PAC do trimestre (pedido do chefe, 22/11/2026): o chefe grava a tabela do PAC (configuracoes, chave pac_trimestre) com
// datas, gamas em que o BMSI pode ser trocado, modelos sem PAC, regras e o valor por modelo; pode sugerir os valores a partir
// das fichas do trimestre (o BMSI 3/30 das propostas lidas conta primeiro) e confirma antes de gravar.
// A ficha de margem sugere o PAC pelo modelo («Usar»), diz se a gama pode trocar o BMSI, avisa modelos sem PAC, modelos sem
// valor na tabela e PAC fora de prazo; a leitura da proposta compara o PAC com a tabela. As regras e os valores usados são inventados.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8790;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const db={cfg:null,posts:[],fichasGet:[]};
const FICHAS=[{criado_em:'2026-11-02T10:00:00Z',dados:{modelo:'R 1300 GSA - Auto',pac:'1260'}},{criado_em:'2026-11-03T10:00:00Z',dados:{modelo:'R 1300 GSA Triple Black',pac:'1260'}},
  {criado_em:'2026-11-04T10:00:00Z',dados:{modelo:'M 1000 XR',pac:'1000',proposta_bmw:{modelo:'M 1000 XR',servico:[{c:'S07A2',n:'Serviço manutenção 3/30',v:1080}]}}},
  {criado_em:'2026-11-05T10:00:00Z',dados:{modelo:'F900 R',pac:'1025'}},{criado_em:'2026-11-06T10:00:00Z',dados:{modelo:'1300GSA',pac:'1260'}},{criado_em:'2026-11-06T11:00:00Z',dados:{modelo:'S 1000 RR',pac:''}}];
async function contexto(b,uid,perfis){const ctx=await b.newContext({viewport:{width:1300,height:900}});
  await ctx.addInitScript(t=>{localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));},jwt(uid));
  await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
    const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return json({access_token:jwt(uid),refresh_token:'rt2'});
    const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
    if(t==='configuracoes'){if(m==='GET')return json(db.cfg?[{valor:db.cfg,atualizado_em:'2026-11-22T12:00:00Z'}]:[]);
      if(m==='POST'){const body=JSON.parse(r.request().postData());db.posts.push({url:u,body});db.cfg=body[0].valor;return r.fulfill({status:201,body:''});}}
    if(t==='fichas_margem'&&m==='GET'){db.fichasGet.push(u);return json(u.includes('select=dados,criado_em')?FICHAS:[]);}
    if(t==='profiles')return json(perfis);
    return json([]);});
  const p=await ctx.newPage();const erros=[],avisos=[];p.on('pageerror',e=>erros.push(uid+': '+e.message));await ligarAvisos(p,avisos);
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p,erros,avisos};}
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const perfis=[{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}];
  // ---------- chefe ----------
  const C=await contexto(b,'c1',perfis);const p=C.p;
  await p.evaluate(()=>{S.screen='dashboard';S.gppSec='pac';render();});await p.waitForTimeout(500);
  const nav=await p.evaluate(()=>!!document.querySelector('.gpp-nav-item[data-s="pac"]'));
  const ini=await p.evaluate(()=>({nome:S.pacEd&&S.pacEd.nome,txt:(document.querySelector('.pac-top')||{}).textContent||'',q4:pacPadrao(new Date(2026,10,22))}));
  await p.click('[data-action="pac-sugerir"]');await p.waitForTimeout(600);
  const sug=await p.evaluate(()=>S.pacEd.modelos.map(r=>r.m+'='+r.v));
  // o chefe confirma: corrige um valor, junta um modelo sem valor (não grava) e depois com valor
  await p.fill('[data-pac-row="0"][data-pac-k="v"]','1080');
  await p.click('[data-action="pac-juntar"]');await p.waitForTimeout(100);const n=sug.length;
  await p.fill(`[data-pac-row="${n}"][data-pac-k="m"]`,'C 400 GT');
  await p.click('[data-action="pac-gravar"]');await p.waitForTimeout(300);const semValor={posts:db.posts.length,aviso:C.avisos.slice(-1)[0]||''};
  await p.fill(`[data-pac-row="${n}"][data-pac-k="v"]`,'650');await p.fill(`[data-pac-row="${n}"][data-pac-k="nota"]`,'BMSI 3/30');
  await p.fill('#pac-nome','PAC Q4 2026');await p.fill('#pac-ini','2026-10-01');await p.fill('#pac-fim','2026-12-31');await p.fill('#pac-sem','F 450 GS');
  await p.evaluate(()=>{S.pacEd.flex=['C','F','M','S'];S.pacEd.notas='Regra de teste inventada.';});
  await p.screenshot({path:path.join(__dirname,'pac_trimestre.png'),fullPage:true});
  await p.click('[data-action="pac-gravar"]');await p.waitForTimeout(400);
  const grav={top:await p.evaluate(()=>(document.querySelector('.pac-top')||{}).textContent||''),posts:db.posts.length,url:(db.posts[0]||{}).url||'',valor:db.cfg,toast:await p.evaluate(()=>(document.querySelector('#bm-toast .bm-toast-m')||{}).textContent||''),ed:await p.evaluate(()=>S.pacEd&&S.pacEd.nome)};
  // ---------- vendedor ----------
  const V=await contexto(b,'v1',perfis);const q=V.p;
  const ficha=async(fm)=>{await q.evaluate(fm=>{S.fm=Object.assign({natureza:'MN',iva:23,modo:'civa',fv:2,pvb:'25000'},fm);S.screen='ficha';S.fmNeg=null;render();},fm);await q.waitForTimeout(400);
    return q.evaluate(()=>{const e=document.querySelector('.fm-pac');return e?{txt:e.textContent.replace(/[  ]/g,' ').replace(/\s+/g,' ').trim(),fora:e.classList.contains('fora'),usar:((document.querySelector('[data-action="fm-pac-usar"]')||{}).textContent||'').replace(/[\u00a0\u202f]/g,' '),regras:!!e.querySelector('details summary')}:null;});};
  const gsa=await ficha({modelo:'R 1300 GSA - Auto',pac:''});
  await q.click('[data-action="fm-pac-usar"]');await q.waitForTimeout(300);const usado={pac:await q.evaluate(()=>S.fm.pac),txt:(await q.evaluate(()=>(document.querySelector('.fm-pac')||{}).textContent||''))};
  await q.screenshot({path:path.join(__dirname,'pac_trimestre_ficha.png')});
  const f9=await ficha({modelo:'F 900 R',pac:''});
  const f450=await ficha({modelo:'F 450 GS',pac:'500'});
  const k16=await ficha({modelo:'K 1600 GTL',pac:''});
  await q.evaluate(()=>{S.pac=Object.assign({},S.pac,{fim:'2020-01-01'});});const fora=await ficha({modelo:'C 400 GT',pac:'650'});
  await q.evaluate(()=>{S.pac=Object.assign({},S.pac,{fim:'2026-12-31'});});
  const prop=await q.evaluate(()=>{const base=["RESUMO GERAL.","BMW M 1000 XR (0E91, 01.11.2026)","Modelo 27.549,04","Serviço & Garantia 1.590,00","Diversos - Outras Despesas 924,40","Preço total (impostos incl.) 30.064,40","ISV (1,18 %) 245,14","SGPU 0,78","IVA (23,00 %) 5.000,00","Valor a pagar 30.064,40"];
    const sem=fmPropPreparar(bmwPropostaLer([["Concessionário Motorrad","Cliente Ficticio"],base,["DIVERSOS - OUTRAS DESPESAS.","ECO EcoValor 1,90","TRA Transporte 922,50"]]),{});
    const dif=fmPropPreparar(bmwPropostaLer([["Concessionário Motorrad","Cliente Ficticio"],base.map(x=>x.replace('Diversos - Outras Despesas 924,40','Diversos - Outras Despesas -75,60').replace(/30\.064,40/g,'29.064,40')),["DIVERSOS - OUTRAS DESPESAS.","Oferta BMSI -1.000,00","ECO EcoValor 1,90","TRA Transporte 922,50"]]),{});
    S.fm={natureza:'MN',iva:23,modo:'civa',fv:2};S.fmProp=sem;S.fmProp.ficheiro='p.pdf';fmPropAplicar();const fmT=Object.assign({},S.fm);
    return {sem:sem.av,dif:dif.av,opc:sem.opc.filter(o=>o.k==='pac_troca'),fmT:{pac:fmT.pac,troca:fmT.pac_troca,plat:+fmCalc().pvpPlat.toFixed(2),tab:+fmCalc().pvpTab.toFixed(2)}};});
  const R={nav,ini:{nome:ini.nome,txt:ini.txt,q4:ini.q4},sug,semValor,grav,gsa,usado,f9,f450,k16,fora,prop,erros:C.erros.concat(V.erros)};console.log(JSON.stringify(R,null,1));
  const v=grav.valor||{};const mod=(v.modelos||[]).map(r=>r.m+'='+r.v);
  const ok={
   'chefe: «PAC do trimestre» nas Ferramentas, por gravar, com o trimestre atual':nav&&/^PAC Q\d \d{4}$/.test(ini.nome||'')&&/Ainda não gravado/.test(ini.txt),
   'trimestre novo em branco, com as datas do trimestre (nada da circular no código)':ini.q4.nome==='PAC Q4 2026'&&ini.q4.inicio==='2026-10-01'&&ini.q4.fim==='2026-12-31'&&!ini.q4.flex.length&&!ini.q4.sem.length&&ini.q4.notas===''&&!ini.q4.modelos.length,
   'sugere da ficha e das propostas do trimestre (o BMSI 3/30 da proposta pesa mais); ignora nomes sem modelo':JSON.stringify(sug)===JSON.stringify(['F 900 R=1025','M 1000 XR=1080','R 1300 GSA=1260'])&&db.fichasGet.some(u=>/criado_em=gte\.2026-1[0-2]-01|criado_em=gte\.\d{4}-\d\d-01/.test(u)),
   'não grava modelo sem valor':semValor.posts===0&&/Confirma o modelo e o valor de: C 400 GT/.test(semValor.aviso),
   'grava na configuração com tudo o que o chefe confirmou':grav.posts===1&&/configuracoes\?on_conflict=chave/.test(grav.url)&&v.nome==='PAC Q4 2026'&&v.inicio==='2026-10-01'&&v.fim==='2026-12-31'&&JSON.stringify(v.sem)==='["F 450 GS"]'&&JSON.stringify(v.flex)==='["C","F","M","S"]'&&JSON.stringify(mod)===JSON.stringify(['F 900 R=1080','M 1000 XR=1080','R 1300 GSA=1260','C 400 GT=650'])&&/PAC gravado/.test(grav.toast)&&/Gravado a/.test(grav.top)&&v.modelos[1].nota==='por confirmar (visto em 1 ficha)',
   'ficha: sugere o PAC do modelo e «Usar» põe-no na ficha':gsa&&/PAC Q4 2026 para R 1300 GSA: 1 260,00 €/.test(gsa.txt)&&/oferta do BMSI 3\/30/.test(gsa.txt)&&/Usar 1 260 €/.test(gsa.usar)&&gsa.regras&&usado.pac==='1260'&&/igual à tabela/.test(usado.txt),
   'gama que pode trocar o BMSI diz como':f9&&/F 900 R: 1 080,00 €/.test(f9.txt)&&/ou outra oferta de igual valor nesta gama/.test(f9.txt),
   'modelo sem PAC com PAC na ficha: avisa':f450&&/F 450 GS: sem PAC no PAC Q4 2026/.test(f450.txt)&&/A ficha tem PAC: confirma/.test(f450.txt),
   'modelo sem valor na tabela: diz para confirmar':k16&&/não tem valor para K 1600 GTL/.test(k16.txt),
   'PAC fora de prazo: avisa':fora&&fora.fora&&/acabou a 01\/01\/2020/.test(fora.txt),
   'proposta: sem oferta do BMSI ou com PAC diferente da tabela, avisa':prop.sem.some(a=>/não traz a oferta do BMSI; no PAC Q4 2026 o M 1000 XR tem 1 080,00 €/.test(a.replace(/[ ]/g,' ')))&&prop.dif.some(a=>/O PAC da proposta \(1 000,00 €\) não é o da tabela/.test(a.replace(/[ ]/g,' '))),
   'proposta sem o BMSI numa gama com troca: propõe manter o PAC como apoio e preenche-o':prop.opc.length===1&&prop.opc[0].on===true&&prop.opc[0].v===1080&&prop.fmT.pac==='1080'&&prop.fmT.troca==='1'&&prop.fmT.plat===prop.fmT.tab,
   'sem erros JS':!R.erros.length};
  let f=0;for(const [k,x] of Object.entries(ok)){console.log((x?'✓ ':'✗ ')+k);if(!x)f++;}
  console.log(f?`FALHOU (${f})`:'PAC do trimestre correto');await b.close();srv.close();process.exit(f?1:0);})();
