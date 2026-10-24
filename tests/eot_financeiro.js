// Financeiros nas EOTs: ver de relance se já deram indicação. Separadores "Precisa de vocês / Já tratados / Todos" e
// coluna "Indicações": Novo (entrou no último mapa), Por tratar (sem indicação dos financeiros), Pergunta/Resposta do
// vendedor (a última indicação é dele), Tratado (a última é de um financeiro, ou a pergunta foi marcada como lida).
// Reaberto: contrato com adenda que o mapa reabriu (data de fim nova) sem indicação vossa depois disso.
// Fechadas sem conversa só aparecem em "Todos". Submeter uma indicação passa a EOT para "Já tratados".
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8774;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const ha=h=>new Date(Date.now()-h*3600e3).toISOString();const dia=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const imp=ha(2),antigo=ha(24*20);
const E=(c,cli,fim,fase,criado)=>({contrato:c,cliente:cli,modelo:'R 1250 GS',data_fim:dia(fim),fase,responsavel_id:'v1',no_mapa:true,residual:5000,criado_em:criado||antigo,ultima_import:imp});
const db={seq:20,eot:[E('E1','Cliente Por Tratar',10,'Por contactar'),E('E2','Cliente Novo',20,'Por contactar',ha(2.2)),E('E3','Cliente Tratado',30,'Por contactar'),
  E('E4','Cliente Resposta',40,'Contactado'),E('E5','Cliente Pergunta',50,'Por contactar'),E('E6','Cliente Fechado',60,'Renovado'),E('E7','Cliente Lida',70,'Por contactar'),Object.assign(E('E8','Cliente Reaberto',80,'Por contactar'),{adenda_em:dia(0)})],
  hist:[{id:1,contrato:'E3',tipo:'comentario',autor_id:'f2',autor_nome:'Beatriz Amaral',autor_role:'financeiro',criado_em:ha(30),texto:'Propor novo contrato'},
    {id:2,contrato:'E4',tipo:'comentario',autor_id:'f2',autor_nome:'Beatriz Amaral',autor_role:'financeiro',criado_em:ha(20),texto:'Residual alto: propor adenda'},
    {id:3,contrato:'E4',tipo:'comentario',autor_id:'v1',autor_nome:'Felipe Gomes',autor_role:'vendedor',criado_em:ha(3),texto:'Cliente aceita, e agora?'},
    {id:4,contrato:'E5',tipo:'comentario',autor_id:'v1',autor_nome:'Felipe Gomes',autor_role:'vendedor',criado_em:ha(5),texto:'Que valor dou?'},
    {id:6,contrato:'E8',tipo:'comentario',autor_id:'f2',autor_nome:'Beatriz Amaral',autor_role:'financeiro',criado_em:ha(24*30),texto:'Fazer adenda de 12 meses'},
    {id:5,contrato:'E7',tipo:'comentario',autor_id:'v1',autor_nome:'Felipe Gomes',autor_role:'vendedor',criado_em:ha(8),texto:'Obrigado'}],
  lidas:[{user_id:'f1',contrato:'E7',hist_id:5,lido_em:ha(7)}]};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});
 await ctx.addInitScript(t=>{localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));localStorage.removeItem('bm_fin_tab');},jwt('f1'));
 await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt('f1'),refresh_token:'x'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];const q=k=>(u.match(new RegExp('[?&]'+k+'=eq\\.([^&]+)'))||[])[1];
  if(t==='profiles'){const id=q('id');const P=[{id:'f1',nome:'Francisco Dias',role:'financeiro',linha:'motorrad'},{id:'v1',nome:'Felipe Gomes',role:'vendedor',linha:'motorrad'}];return json(id?P.filter(p=>p.id===id):P);}
  if(t==='eot_contratos')return json(db.eot);
  if(t==='eot_historico'){if(m==='POST'){const body=JSON.parse(r.request().postData());db.hist.push(Object.assign({id:db.seq++,criado_em:new Date().toISOString(),autor_id:'f1',autor_nome:'Francisco Dias',autor_role:'financeiro'},body));return r.fulfill({status:201,body:''});}
    let L=db.hist.slice();const c=q('contrato');if(c)L=L.filter(h=>h.contrato===c);L.sort((a,b2)=>b2.id-a.id);if(/select=id(&|$)/.test(u))L=L.slice(0,1).map(h=>({id:h.id}));return json(L);}
  if(t==='eot_notif_lidas')return json(db.lidas);
  return json([]);});
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1800);
 await p.evaluate(()=>{setState({screen:'financeiro'});});await p.waitForTimeout(400);
 const ver=()=>p.evaluate(()=>({tabs:[...document.querySelectorAll('.fin-tabs .vchip')].map(b=>b.textContent.replace(/\s+/g,' ').trim()+(b.classList.contains('on')?' *':'')),
   linhas:[...document.querySelectorAll('.fin-tbl tbody tr')].map(tr=>{const td=tr.querySelector('.fin-ind-td');return tr.querySelector('td b').textContent+' | '+(td?td.innerText.replace(/\s+/g,' ').trim():'');}),
   vazio:((document.querySelector('.bm-vazio')||{}).textContent||'').replace(/\s+/g,' ').trim()}));
 const R={};
 R.precisa=await ver();
 await p.click('.fin-tabs [data-t="tratados"]');await p.waitForTimeout(250);R.tratados=await ver();
 await p.click('.fin-tabs [data-t="todos"]');await p.waitForTimeout(250);R.todos=await ver();
 R.lembra=await p.evaluate(()=>localStorage.getItem('bm_fin_tab'));
 // dar a indicação na E1 (por tratar) → passa para "Já tratados"
 await p.click('.fin-tabs [data-t="precisa"]');await p.waitForTimeout(250);
 await p.evaluate(()=>eotAbrir('E1'));await p.waitForTimeout(600);
 await p.fill('#eotm-com','Propor renovação com entrada');await p.click('[data-action="eotm-comentar"]');await p.waitForTimeout(900);
 await p.evaluate(()=>{eotFechar&&eotFechar();});await p.waitForTimeout(600);
 R.depois=await ver();
 await p.screenshot({path:path.join(__dirname,'eot_financeiro.png')});
 // tratar as restantes: o separador fica vazio, com uma mensagem útil (não "Nada com estes filtros")
 for(const c of ['E2','E4','E5','E8']){await p.evaluate(c=>eotAbrir(c),c);await p.waitForTimeout(500);
   await p.fill('#eotm-com','Indicação dada');await p.click('[data-action="eotm-comentar"]');await p.waitForTimeout(700);
   await p.evaluate(()=>{eotFechar&&eotFechar();});await p.waitForTimeout(400);}
 R.vazio=await ver();
 R.erros=erros;console.log(JSON.stringify(R,null,1));
 const ok={
  '"Precisa de vocês" por omissão: por tratar, novo, pergunta e resposta do vendedor, reaberto (pela data de fim)':JSON.stringify(R.precisa.tabs)==='["Precisa de vocês 5 *","Já tratados 2","Todos 8"]'&&JSON.stringify(R.precisa.linhas.map(l=>l.split(' | ')[0]))==='["Cliente Por Tratar","Cliente Novo","Cliente Resposta","Cliente Pergunta","Cliente Reaberto"]',
  'estado de cada uma na coluna Indicações':/Cliente Por Tratar \| Por tratar sem indicação vossa/.test(R.precisa.linhas[0])&&/Cliente Novo \| Novo entrou no mapa a/.test(R.precisa.linhas[1])&&/Cliente Resposta \| 🔔 Resposta Felipe · há 3 h/.test(R.precisa.linhas[2])&&/Cliente Pergunta \| 🔔 Pergunta Felipe/.test(R.precisa.linhas[3])&&/Cliente Reaberto \| ↻ Reaberto adenda · novo fim \d\d\/\d\d\/\d{4}/.test(R.precisa.linhas[4]),
  '"Já tratados": a última indicação é vossa, ou a pergunta foi marcada como lida':JSON.stringify(R.tratados.linhas)==='["Cliente Tratado | ✓ Tratado Beatriz · '+new Date(Date.now()-30*3600e3).toISOString().slice(0,10).split('-').reverse().join('/')+'","Cliente Lida | ✓ Tratado marcada como lida"]',
  '"Todos" inclui a fechada sem conversa':R.todos.linhas.length===8&&R.todos.linhas.some(l=>/Cliente Fechado \| fechado/.test(l)),
  'lembra o separador neste computador':R.lembra==='todos',
  'submeter uma indicação passa a EOT para "Já tratados"':JSON.stringify(R.depois.tabs)==='["Precisa de vocês 4 *","Já tratados 3","Todos 8"]'&&!R.depois.linhas.some(l=>/Cliente Por Tratar/.test(l)),
  'tudo tratado: "Nada à vossa espera" em vez de uma tabela vazia':JSON.stringify(R.vazio.tabs)==='["Precisa de vocês 0 *","Já tratados 7","Todos 8"]'&&!R.vazio.linhas.length&&/Nada à vossa espera/.test(R.vazio.vazio),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Indicações dos financeiros corretas');await b.close();srv.close();process.exit(f?1:0);})();
