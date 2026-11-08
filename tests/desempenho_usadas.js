// Usadas › Desempenho e Melhorias (só o chefe): o que mudou desde o início (1 jul) — vendas herdadas vs compras novas,
// dias até vender, margem libertada lançada (só a real; o resto fica «por lançar»), stock médio e custo do stock parado
// mês a mês, o relatório para imprimir (sem as sugestões) e as sugestões do separador Melhorias. Dados fictícios.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const RAIZ=path.resolve(__dirname,'..');const FILE=path.resolve(process.argv[2]||path.join(RAIZ,'index.html'));
const PORTA=8784;
const srv=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=u==='/'||u==='/index.html'?FILE:path.join(RAIZ,u.replace(/^\/+/,''));
  if(!f.startsWith(RAIZ)||!fs.existsSync(f)){s.writeHead(404);return s.end('');}s.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});s.end(fs.readFileSync(f));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'},v2:{id:'v2',nome:'Vendedor Dois',role:'vendedor',linha:'motorrad'}};
const AGORA=new Date('2026-11-08T10:00:00Z');
const T0='2026-07-21T09:00:00Z';// o registo do stock foi carregado de uma vez neste dia
const mota=(o)=>Object.assign({categoria:'usada',estado:'Disponível',consignada:false,data_rececao:null,created_at:T0,updated_at:T0,valor_entrada:null,valor_anunciado:null,valor_min:null,valor_campanha:null,dep_manual:null,prep_oficina:null,prep_garantia:null,prep_legalizacao:null,kms:null,ano:null},o);
const STOCK=[
  mota({id:101,modelo:'R 1250 GS',matricula:'AA-11-AA',estado:'Vendida',data_rececao:'2025-05-01',updated_at:'2026-09-12T10:00:00Z',valor_entrada:10000,valor_anunciado:12500,valor_min:11800,dep_manual:2000}),        // herdada, vendida aos 497 dias
  mota({id:102,modelo:'R 1250 RT',matricula:'AA22BB',estado:'Vendida',data_rececao:'2026-03-01',updated_at:'2026-08-10T10:00:00Z',valor_entrada:15000,valor_anunciado:15500,valor_min:14800}),                   // herdada, ligada pela matrícula
  mota({id:103,modelo:'R 1300 RT',matricula:'CC-33-CC',data_rececao:'2026-01-10',valor_entrada:20000,valor_anunciado:21000,valor_min:20000,valor_campanha:20500,dep_manual:1500,prep_oficina:300}),            // herdada, 302 dias em stock
  mota({id:104,modelo:'F 900 XR',matricula:'DD-44-DD',data_rececao:'2026-06-15',valor_entrada:8000,valor_anunciado:9500,valor_min:9000}),                                                                     // herdada, 146 dias
  mota({id:105,modelo:'R 1200 GS',matricula:'EE-55-EE',estado:'Vendida',data_rececao:'2026-07-10',updated_at:'2026-08-03T10:00:00Z',valor_entrada:9000,valor_anunciado:11000,valor_min:10500}),              // compra nova, 22 dias
  mota({id:106,modelo:'S 1000 XR',matricula:'FF-66-FF',estado:'Vendida',data_rececao:'2026-09-01',created_at:'2026-09-01T10:00:00Z',updated_at:'2026-10-15T10:00:00Z',valor_entrada:12000,valor_anunciado:14000,valor_min:13500}), // compra nova, 44 dias
  mota({id:107,modelo:'F 900 GS',matricula:'GG-77-GG',data_rececao:'2026-10-01',created_at:'2026-10-01T10:00:00Z',valor_entrada:13800,valor_anunciado:15000,valor_min:14500}),                                 // compra nova em stock (margem curta)
  mota({id:108,modelo:'R 1250 RT',matricula:'HH-88-HH',estado:'Vendida',created_at:'2026-09-20T10:00:00Z',updated_at:'2026-09-28T10:00:00Z',valor_entrada:16000,valor_anunciado:18000,valor_min:17500}),  // sem data de receção (≈)
  mota({id:109,modelo:'M 1000 R',matricula:'II-99-II',consignada:true,data_rececao:'2026-08-15',created_at:'2026-08-16T10:00:00Z',valor_entrada:24000,valor_anunciado:26000,valor_min:24000}),             // consignada: à parte
  mota({id:110,modelo:'R 1300 RT',matricula:'JJ-00-JJ',categoria:'demo',data_rececao:'2026-02-01',valor_entrada:22000}),                                                                                      // demo: não conta
  mota({id:111,modelo:'teste',matricula:'te-st-te',created_at:'2026-09-16T08:00:00Z',valor_entrada:5000})                                                                                                      // registo de teste
];
const neg=(o)=>Object.assign({type:'MU',status:'Retail',col_298:null,stock_id:null,mat:'',model:'',version:'',pvp:null,valor_entrada:null,venda_direta:false,vendedor_id:'v1',id_cliente:'Cliente Ficticio '+o.id,updated_at:'2026-11-07T10:00:00Z'},o);
const RECS=[
  neg({id:201,neg:'2026-09-10',col_298:'2026-09-12',stock_id:101,mat:'AA-11-AA',model:'R 1250',version:'GS',pvp:12000}),
  neg({id:202,neg:'2026-08-05',col_298:'2026-08-10',mat:'aa-22-bb',model:'R 1250',version:'RT',pvp:14800,vendedor_id:'v2'}),
  neg({id:203,neg:'2026-08-01',col_298:'2026-08-03',stock_id:105,mat:'EE-55-EE',model:'R 1200',version:'GS',pvp:10500}),
  neg({id:204,status:'Carteira',neg:'2026-10-15',stock_id:106,mat:'FF-66-FF',model:'S 1000',version:'XR',pvp:13800,vendedor_id:'v2'}),
  neg({id:205,neg:'2026-09-25',col_298:'2026-09-28',stock_id:108,mat:'HH-88-HH',model:'R 1250',version:'RT',pvp:17800}),
  neg({id:206,neg:'2026-07-05',col_298:'2026-07-07',mat:'ZZ-99-ZZ',model:'K 1600',version:'GT',pvp:16000,vendedor_id:'v2'}),   // sem ficha no stock (antes do registo)
  neg({id:207,neg:'2026-06-25',col_298:'2026-07-02',mat:'YY-88-YY',model:'R 1250',version:'GSA',pvp:21000}),                   // negociada antes de 1 jul, entregue depois
  neg({id:208,neg:'2026-10-20',col_298:'2026-10-20',mat:'XX-77-XX',model:'Honda',version:'NC 750',pvp:5000,valor_entrada:5000,venda_direta:true}), // a comerciante
  neg({id:209,status:'Perdido',neg:'2026-09-01',stock_id:103,mat:'CC-33-CC',model:'R 1300',version:'RT',pvp:20500}),
  neg({id:210,type:'MN',neg:'2026-09-05',col_298:'2026-09-06',model:'R 1300',version:'GS',pvp:25000}),
  neg({id:211,status:'Quente',neg:'2026-11-02',stock_id:104,model:'F 900',version:'XR'})
];
const MARGENS=[{negocio_id:201,margem:500},{negocio_id:202,margem:-400},{negocio_id:203,margem:700},{negocio_id:205,margem:300},{negocio_id:206,margem:900},{negocio_id:207,margem:1000}];
const nb=s=>String(s||'').replace(/[  ]/g,' ').replace(/\s+/g,' ').trim();
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const erros=[],pedidos=[];
 const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];if(t)pedidos.push(quem+' '+t);
  if(t==='stock_usadas')return quem==='c1'?json(STOCK):json({code:'42501',message:'permission denied'},403);
  if(t==='stock_usadas_publico')return json(STOCK.filter(m=>m.estado!=='Vendida').map(m=>({id:m.id,modelo:m.modelo,matricula:m.matricula,categoria:m.categoria,estado:m.estado})));
  if(t==='margens')return json(quem==='c1'?MARGENS:[]);
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control')return json(quem==='c1'?RECS:RECS.filter(r=>r.vendedor_id===quem));
  return json([]);};
 const abrir=async(quem,vp,ls)=>{const ctx=await b.newContext({viewport:vp||{width:1280,height:1000},timezoneId:'Europe/Lisbon',locale:'pt-PT'});
  await ctx.clock.install({time:AGORA});
  await ctx.addInitScript(([t,ls])=>{localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));for(const [k,v] of Object.entries(ls||{}))localStorage.setItem(k,v);},[jwt(quem),ls||{}]);
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 const sec=async(p,s)=>{await p.evaluate(s=>{const x=document.createElement('button');x.dataset.action='gpp-sec';x.dataset.s=s;document.getElementById('app').appendChild(x);x.click();x.remove();},s);await p.waitForTimeout(700);};
 // texto como se lê: blocos separados por espaço (cartões, linhas de baixo), sem depender do CSS (maiúsculas)
 const ler=p=>p.evaluate(()=>{const tx=e=>[...e.childNodes].map(n=>n.nodeType===3?n.textContent:(n.nodeType===1?(/^(DIV|P|LI|TD|TH|TR|UL|BR|FIGCAPTION)$/.test(n.tagName)?' '+tx(n)+' ':tx(n)):'')).join('');
   const t=e=>e?tx(e).replace(/[\s\u00a0\u202f]+/g,' ').trim():'';const dz=document.querySelector('.dz');
   return {tem:!!dz,titulo:t(document.querySelector('.dz-h1')),tabs:[...document.querySelectorAll('[data-action="gpp-sec"]')].map(x=>x.dataset.s),
     tiles:[...document.querySelectorAll('.dz-tile')].map(t),resumo:[...document.querySelectorAll('.dz-resumo li')].map(t),
     arias:[...document.querySelectorAll('.dz-fig svg')].map(s=>s.getAttribute('aria-label')),notas:[...document.querySelectorAll('.dz-fig .dz-nota')].map(t),
     vaz:[...document.querySelectorAll('.dz-vaz')].map(t),tabelas:[...document.querySelectorAll('.dz-card table')].map(tb=>[...tb.rows].map(r=>[...r.cells].map(t))),
     notasFim:t(document.querySelector('.dz-notas')),motas:[...document.querySelectorAll('.dz-mota')].map(t),leitura:t(document.querySelector('.dz-leitura')),
     cards:[...document.querySelectorAll('.dz .gpp-card')].map(t),aviso:t(document.querySelector('.mg-aviso')),texto:t(dz),
     modo:(document.querySelector('[data-dz="modo"]')||{}).value,inicio:(document.querySelector('[data-dz="inicio"]')||{}).value,
     ferramentas:document.querySelectorAll('.dz-grid2 .tbl-tools').length};});
 const largura=p=>p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
 // ---------- chefe: Desempenho ----------
 const C=await abrir('c1');const p=C.p;
 const margAntes=pedidos.filter(x=>x==='c1 margens').length;
 await sec(p,'desempenho');const A=await ler(p);const margDepois=pedidos.filter(x=>x==='c1 margens').length;
 const D=await p.evaluate(()=>{const D=dzDados();return {nV:D.vendas.length,margTot:D.margTot,depTot:D.depTot,stockJul:D.M['2026-07'].stockMed,stockNov:D.M['2026-11'].stockMed,
   fotoIni:D.fotoIni.faixas.map(f=>f.n),fotoHoje:D.fotoHoje.faixas.map(f=>f.n),novasDias:D.novasDias,herdDias:D.herdDias,origem:D.vendas.map(v=>v.id+':'+v.origem)};});
 await p.screenshot({path:path.join(__dirname,'desempenho_usadas.png'),fullPage:false});
 // relatório para imprimir: abre noutro separador, sem as sugestões nem a coluna do vendedor
 const [pop]=await Promise.all([p.context().waitForEvent('page',{timeout:10000}),p.click('[data-action="dz-pdf"]')]);await pop.waitForLoadState();await pop.waitForTimeout(300);
 const R=await pop.evaluate(()=>({titulo:document.title,texto:document.body.innerText.replace(/[\s  ]+/g,' '),imprimir:!!document.querySelector('button[onclick="window.print()"]'),
   ths:[...document.querySelectorAll('th')].map(x=>x.textContent.trim()),svgs:document.querySelectorAll('svg').length,controlos:document.querySelectorAll('[data-dz],[data-action]').length}));
 await pop.close();
 // contar pela data do negócio (fica guardado)
 await p.selectOption('[data-dz="modo"]','negocio');await p.waitForTimeout(400);const N=await ler(p);
 const lsModo=await p.evaluate(()=>localStorage.getItem('bc_dz_modo'));
 // outra data de início
 await p.fill('[data-dz="inicio"]','2026-08-01');await p.waitForTimeout(400);const I=await ler(p);
 const lsIni=await p.evaluate(()=>localStorage.getItem('bc_dz_inicio'));
 await p.evaluate(()=>{localStorage.removeItem('bc_dz_inicio');localStorage.removeItem('bc_dz_modo');render();});await p.waitForTimeout(300);
 // ---------- chefe: Melhorias ----------
 await sec(p,'melhorias');const M=await ler(p);
 await p.screenshot({path:path.join(__dirname,'desempenho_usadas_melhorias.png'),fullPage:false});
 await C.ctx.close();
 // ---------- escuro e telemóvel ----------
 const E=await abrir('c1',null,{bm_tema:'escuro'});await sec(E.p,'desempenho');
 const corEscuro=await E.p.evaluate(()=>{const x=document.querySelector('.dz-fig svg path.dz-s1');return x?getComputedStyle(x).fill:'';});await E.ctx.close();
 const T=await abrir('c1',{width:390,height:844});await sec(T.p,'desempenho');const larg1=await largura(T.p);const Tt=await ler(T.p);
 await T.p.screenshot({path:path.join(__dirname,'desempenho_usadas_telemovel.png'),fullPage:false});
 await sec(T.p,'melhorias');const larg2=await largura(T.p);await T.ctx.close();
 // ---------- taxa mensal da Calculadora definida: as compras novas também depreciam ----------
 const X=await abrir('c1',null,{bc_dep_taxa:'1'});await sec(X.p,'desempenho');const Dx=await X.p.evaluate(()=>{const D=dzDados();return {taxa:D.taxa,depN:D.M['2026-10'].depN,semDep:D.semDep.length};});const Xl=await ler(X.p);await X.ctx.close();
 // ---------- vendedor: nada disto ----------
 const V=await abrir('v1');await sec(V.p,'desempenho');const Vl=await ler(V.p);
 const vFun=await V.p.evaluate(()=>({d:desempenhoView(),m:melhoriasView()}));await V.ctx.close();
 const vPed=pedidos.filter(x=>x.startsWith('v1 '));
 console.log(JSON.stringify({A,D,R,N,I,M,corEscuro,larg1,larg2,Dx,Xl:{tiles:Xl.tiles,resumo:Xl.resumo},Vl:{tem:Vl.tem,tabs:Vl.tabs},vFun,margAntes,margDepois,erros},null,1));
 const tab=(L,cab)=>(L.tabelas.find(t=>t[0]&&t[0][0]!=null&&t[0][0].startsWith(cab))||[]);
 const ok={
  'separadores Desempenho e Melhorias nas Usadas do chefe':A.tabs.includes('desempenho')&&A.tabs.includes('melhorias')&&A.tem&&A.titulo==='Usadas · desde 1 jul 2026',
  'as margens são pedidas ao abrir (o chefe não as carrega ao entrar)':margAntes===0&&margDepois>=1&&!A.aviso,
  'herdadas vs compras novas: classificação de cada venda':D.origem.join(' ')==='207:herdada 206:herdada 203:nova 202:herdada 201:herdada 205:nova 204:nova',
  'cartões: vendidas, herdado vendido, dias das compras novas':nb(A.tiles[0])==='Usadas vendidas a clientes 7 + 1 a comerciante'&&nb(A.tiles[1])==='Stock herdado vendido 3 de 5 60 % · a mais antiga com 497 dias'&&
    nb(A.tiles[2])==='Compras novas: dias até vender 33 dias 3 de 4 vendidas · herdadas: 327 dias',
  'cartões: margem lançada (só a real), stock médio e custo do stock parado':nb(A.tiles[3])==='Margem libertada lançada +3 000 € 5 de 6 positivas · 1 por lançar'&&
    nb(A.tiles[4])==='Stock médio em novembro 3,0 motas julho: 4,8 · herdadas 4,1 → 2,0'&&nb(A.tiles[5])==='Custo do stock parado 936 € depreciação desde 1 jul 2026 · 6 motas sem valor contam 0 €',
  'contas: 7 vendas, +3 000 €, depreciação repartida pelos dias':D.nV===7&&Math.round(D.margTot)===3000&&Math.abs(D.depTot-936.37)<0.5&&Math.abs(D.stockJul-150/31)<1e-9&&Math.abs(D.stockNov-3)<1e-9,
  'dias até vender: a mota sem data de receção fica fora da média':D.novasDias.join(',')==='22,44'&&D.herdDias.join(',')==='497,157',
  'resumo: vendas, herdadas e a mais antiga':/^Desde 1 jul 2026 venderam-se 7 usadas a clientes \(e mais 1 retoma passada a comerciante\): 4 do stock que já existia e 3 das que entraram depois\.$/.test(nb(A.resumo[0]))&&
    nb(A.resumo[1])==='Do stock herdado (5 motas próprias no início) já foram vendidas 3 (60 %), incluindo a mais antiga: R 1250 GS com 497 dias em stock.',
  'resumo: dias das compras novas (só as com data)':nb(A.resumo[2])==='As motas compradas desde 1 jul 2026 vendem-se, em média, em 33 dias (3 de 4 já vendidas; a média conta as 2 com data de receção); as herdadas tinham, em média, 327 dias em stock quando foram vendidas.',
  'resumo: margem com as compras novas e a venda negociada antes do início':nb(A.resumo[3])==='Margem libertada lançada (julho, agosto, setembro): +3 000 € em 6 vendas; 5 foram positivas e a negativa era uma mota herdada. Nas compras novas: +1 000 € (2 vendas, todas positivas). Inclui 1 venda negociada antes de 1 jul 2026 e entregue depois (+1 000 €): pela data do negócio, a margem lançada é +2 000 €. Ainda por lançar: 1 venda.',
  'resumo: stock médio, custo e o que falta vender':nb(A.resumo[4])==='Stock médio de motas próprias: 4,8 em julho e 3,0 em novembro (herdadas: 4,1 → 2,0); o custo do stock parado (depreciação) foi de 279 € em julho e de 154 € em outubro (as compras novas sem depreciação na Calculadora contam 0 €).'&&
    nb(A.resumo[5])==='Falta vender: 2 motas herdadas (1 com mais de 180 dias). Das que entraram desde 1 jul 2026, a mais antiga ainda em stock tem 38 dias.',
  'gráfico das vendas por mês (herdadas e compras novas)':A.arias[0]==='Usadas vendidas por mês: julho 2, agosto 2, setembro 2, outubro 1, novembro 0',
  'gráfico da margem: por origem, «por lançar» e «sem vendas»':nb(A.arias[1])==='Margem libertada por mês: julho +1 900 € (herdadas +1 900 €, compras novas 0 €), agosto +300 € (herdadas −400 €, compras novas +700 €), setembro +800 € (herdadas +500 €, compras novas +300 €), outubro por lançar, novembro sem vendas',
  'margem: saldo de cada mês e o mês por lançar marcado no gráfico':/^Saldo do mês: julho \+1 900 € · agosto \+300 € · setembro \+800 €\.$/.test(nb(A.notas[0]))&&A.vaz.length===1&&nb(A.vaz[0])==='por lançar(1)',
  'stock médio e custo do stock parado por mês':nb(A.arias[2])==='Stock médio por mês: julho 4,8, agosto 3,1, setembro 3,5, outubro 3,5, novembro 3,0'&&nb(A.arias[3])==='Custo do stock parado por mês: julho 279 €, agosto 279 €, setembro 185 €, outubro 154 €, novembro 40 €',
  'custo do stock parado avisa das motas sem depreciação (taxa a 0 %)':/^6 motas não têm depreciação na Calculadora \(4 compras novas\) e a taxa mensal está a 0 % neste browser: contam 0 €\./.test(nb(A.notas[1])),
  'antiguidade do stock: início vs hoje':JSON.stringify(D.fotoIni)==='[1,2,1]'&&JSON.stringify(D.fotoHoje)==='[1,1,1]'&&nb(tab(A,'Motas próprias em stock')[4].join('|'))==='Total|4|3'&&nb(tab(A,'Motas próprias em stock')[6].join('|'))==='Idade média · mediana|183 · 146 dias|162 · 146 dias',
  'herdadas vs compras novas (tabela)':nb(tab(A,'')[2].join('|'))==='Já vendidas|3 · 60 %|3 · 75 %'&&nb(tab(A,'')[4].join('|'))==='Margem libertada média|+500 € (4)|+500 € (2)'&&nb(tab(A,'')[6].join('|'))==='Consignadas (à parte)|—|1 entrou · 0 vendidas',
  'vendas por tempo em stock (a sem data de receção à parte)':nb(tab(A,'Tempo em stock até vender').slice(1).map(r=>r[0]+'='+r[1]).join(' '))==='0–30 dias=1 31–90 dias=1 91–180 dias=1 181–365 dias=0 mais de 1 ano=1 sem data de receção=3',
  'lista de vendas: sem ficha, ≈ e margens; vendedor só na app':(()=>{const L=tab(A,'Data de retail');return L.length===8&&nb(L[0].join('|'))==='Data de retail|Modelo|Matrícula|Origem|Dias em stock|Margem libertada|Vendedor'&&
    L.some(r=>/HH-88-HH/.test(r[2])&&nb(r[4])==='5 ≈'&&r[5]==='+300 €')&&L.some(r=>/ZZ-99-ZZ/.test(r[2])&&/sem ficha/.test(r[3]))&&L.some(r=>/FF-66-FF/.test(r[2])&&/por lançar/.test(r[5]))&&L.some(r=>/AA22BB|aa-22-bb/i.test(r[2])&&r[5]==='−400 €');})(),
  'sem barras de pesquisa nas grelhas de duas colunas':A.ferramentas===0,
  'notas: como se conta':/Herdadas = motas próprias que já estavam em stock antes de 1 jul 2026/.test(A.notasFim)&&/2 vendas saíram de stock antes de haver ficha/.test(A.notasFim)&&/1 mota sem data de receção: conta no stock desde o dia em que foi registada \(≈\), mas fica fora das médias de dias/.test(A.notasFim),
  'relatório (PDF): mesmo conteúdo, sem controlos, sem vendedor e sem as sugestões':R.titulo==='Usadas desde 1 jul 2026'&&R.imprimir&&R.svgs===4&&R.controlos===0&&/Caetano BMW Motorrad Aveiro · 8 nov 2026/.test(R.texto)&&
    /margem libertada lançada \+3 000 €/i.test(R.texto)&&/Em resumo/.test(R.texto)&&!R.ths.includes('Vendedor')&&!/Melhorias|Motas paradas|Compra máx|Leitura\./.test(R.texto),
  'contar pela data do negócio: tira a venda negociada antes do início e fica guardado':N.modo==='negocio'&&lsModo==='negocio'&&nb(N.tiles[0])==='Usadas vendidas a clientes 6 + 1 a comerciante'&&/Margem libertada lançada \+2 000 €/.test(nb(N.tiles[3]))&&/pela data do negócio/.test(N.texto)&&!/negociada antes de/.test(N.texto),
  'outra data de início: muda tudo e fica guardada':lsIni==='2026-08-01'&&I.titulo==='Usadas · desde 1 ago 2026'&&I.inicio==='2026-08-01'&&tab(I,'Mês').length===5,
  'Melhorias: só o chefe, motas paradas com a regra dos 180 dias e o comerciante em números':M.titulo==='Melhorias · só tu vês'&&M.motas.length===2&&
    /^R 1300 RT CC-33-CC · Herdada 302 dias Entrada 20 000 € Preço atual 20 500 € mín\. 20 000 € Custo por mês 253 € dep\. 151 € \+ stock 103 € Margem ≈ a este preço \+107 € já desvalorizou 1 500 € Passou os 180 dias: pela tua regra, é altura de comerciante\. Última tentativa no retalho: preço mínimo \(20 000 €\)\. Comerciante ≈ 16 900 € \(82,5 % do preço, 3 100 € abaixo da entrada\): pede proposta a 1 ou 2\. Esperar custa ≈ 253 €\/mês; o desconto do comerciante \(3 600 €\) equivale a ≈ 14 meses parada\.$/.test(nb(M.motas[0])),
  'Melhorias: mota entre 91 e 180 dias desce para o mínimo; compra recente dentro da média não aparece':/^F 900 XR DD-44-DD · Herdada 146 dias .*Margem ≈ a este preço \+1 220 € Desce para o mínimo \(9 000 €\): aos 180 dias passa a comerciante \(faltam 34\)\.$/.test(nb(M.motas[1]))&&!M.motas.some(t=>/GG-77-GG/.test(t)),
  'Melhorias: leitura das motas com 180+ dias':/^Leitura\. Na mota com 180\+ dias, ir já a comerciante perde o equivalente a ≈ 14 meses parada/.test(M.leitura),
  'Melhorias: compras abaixo da margem bruta de 1 500 € ao preço mínimo, com a compra máxima':(()=>{const L=tab(M,'Mota');return L.length===2&&nb(L[1].join('|'))==='F 900 GS GG-77-GG|13 800 €|14 500 €|550 € padrão|+150 €|−16 €|12 450 €';})(),
  'Melhorias: stock parado custa por mês, por lançar e dados a corrigir':/O stock próprio de hoje \(3 motas\) custa ≈ \d[\d ]* € por mês parado/.test(M.texto)&&/1 venda sem margem libertada lançada \(outubro\)/.test(M.texto)&&
    /2 vendas sem mota no stock/.test(M.texto)&&/1 mota sem data de receção/.test(M.texto)&&/6 motas sem depreciação/.test(M.texto)&&/Há 1 registo de teste no stock \(teste\)/.test(M.texto)&&/falhou, em média, 752 €/.test(M.texto),
  'escuro: cores dos gráficos do tema escuro':corEscuro==='rgb(57, 135, 229)',
  'telemóvel sem scroll de lado (cartões 2 a 2)':larg1&&larg2&&Tt.tiles.length===6,
  'com a taxa mensal da Calculadora as compras novas também depreciam':Dx.taxa===1&&Dx.depN>0&&Dx.semDep===0&&!/sem valor contam 0 €/.test(nb(Xl.tiles[5]))&&!/contam 0 €/.test(Xl.resumo.join(' ')),
  'vendedor: sem separadores, sem conteúdo e sem ler o stock completo':!Vl.tem&&!Vl.tabs.includes('desempenho')&&!Vl.tabs.includes('melhorias')&&vFun.d===''&&vFun.m===''&&!vPed.includes('v1 stock_usadas'),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Desempenho das usadas correto');await b.close();srv.close();process.exit(f?1:0);})();
