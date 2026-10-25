// Reunião semanal do chefe (terças às 15:00, 20 minutos), com dados fictícios e o relógio parado numa terça às 14:30.
// 1) Preparação: os números de cada ponto desde a reunião anterior (terça passada às 15:00), as listas e as perguntas.
// 2) Preços das usadas alterados na própria reunião (grava no stock; valor inválido não grava).
// 3) Compromissos: registar (Enter ou botão), sem texto não grava, marcar feito (e voltar atrás se o servidor recusar), apagar.
// 4) Conduzir: um ponto de cada vez, relógio total e do ponto (fica vermelho quando passa), dinâmica sugerida como compromisso,
//    resumo para a equipa sem margens, terminar e retomar (o estado fica guardado neste computador).
// 5) Antes do SQL: aviso no ponto dos compromissos e sem formulário. 6) Telemóvel sem scroll lateral.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8776;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const AGORA=new Date('2026-10-20T13:30:00Z');   // terça-feira, 14:30 em Lisboa (meia hora antes da reunião)
const R=(id,o)=>Object.assign({id,vendedor_id:'v1',created_at:'2026-08-01T10:00:00Z',updated_at:'2026-10-10T10:00:00Z',status_updated_at:'2026-10-10T10:00:00Z'},o);
const base=()=>({seq:900,patches:[],posts:[],deletes:[],falhar:null,semSql:false,
  recs:[R(101,{status:'Retail',type:'MN',id_cliente:'Cliente Alfa',model:'R 1300 GS',col_298:'2026-10-19'}),
    R(102,{status:'Retail',type:'MN',vendedor_id:'v2',id_cliente:'Cliente Beta',model:'F 900 R',col_298:'2026-10-14'}),
    R(103,{status:'Retail',type:'MN',id_cliente:'Cliente Gama',model:'G 310 R',col_298:'2026-10-05'}),
    R(104,{status:'Retail',type:'MU',vendedor_id:'v2',id_cliente:'Cliente Delta',model:'R nineT',col_298:'2026-10-16'}),
    R(105,{status:'Retail',type:'MN',id_cliente:'Cliente Épsilon',model:'F 800 GS',col_298:'2026-09-10'}),
    R(106,{status:'Retail',type:'MN',vendedor_id:'v2',id_cliente:'Cliente Zeta',model:'F 900 XR',col_298:'2026-09-25'}),
    R(107,{status:'Retail',type:'MN',id_cliente:'Cliente Ómega',model:'R 1250 RT',col_298:'2026-08-12'}),
    R(108,{status:'Retail',type:'MN',vendedor_id:'v2',id_cliente:'Cliente Sigma',model:'S 1000 RR',col_298:'2026-08-20'}),
    R(109,{status:'Retail',type:'MD',id_cliente:'Cliente Demo',model:'R 1300 GS',col_298:'2026-08-22'}),
    R(110,{status:'Carteira',type:'MN',id_cliente:'Cliente Eta',model:'R 1300 RT',mes1:'2026/10',enc:'E123',chas:'WB10A'}),
    R(111,{status:'Carteira',type:'MN',vendedor_id:'v2',id_cliente:'Cliente Teta',model:'S 1000 XR',mes1:'2026/09'}),
    R(112,{status:'Carteira',type:'MU',id_cliente:'Cliente Iota',model:'R 1250 GS',mes1:'2026/10',mes1_pedido:'2026/11'}),
    R(113,{status:'Quente',type:'MN',id_cliente:'Cliente Lambda',model:'CE 04',alert_date:'2026-10-22'})],
  eot:[{contrato:'EOT001',cliente:'Cliente Kapa',modelo:'R 1250 RT',responsavel_id:'v1',data_fim:'2026-12-15',fase:'Por contactar',no_mapa:true},
    {contrato:'EOT002',cliente:'Cliente Mu',modelo:'F 850 GS',responsavel_id:'v2',data_fim:'2027-01-10',fase:null,no_mapa:true},
    {contrato:'EOT003',cliente:'Cliente Nu',modelo:'R 1200 GS',responsavel_id:'v1',data_fim:'2027-03-01',fase:'Por contactar',no_mapa:true},
    {contrato:'EOT004',cliente:'Cliente Xi',modelo:'K 1600 GT',responsavel_id:null,data_fim:'2026-11-30',fase:'Por contactar',no_mapa:true},
    {contrato:'EOT005',cliente:'Cliente Ómicron',modelo:'R 18',responsavel_id:'v2',data_fim:'2026-11-15',fase:'Renovado',no_mapa:true},
    {contrato:'EOT006',cliente:'Cliente Pi',modelo:'F 900 R',responsavel_id:'v1',data_fim:'2026-11-20',fase:'Contactado',no_mapa:true}],
  hist:[{id:61,contrato:'EOT002',autor_id:'v2',autor_nome:'Rui Costa',autor_role:'vendedor',criado_em:'2026-10-19T09:00:00Z',texto:'Cliente pediu proposta'},
    {id:60,contrato:'EOT006',autor_id:'f1',autor_nome:'Ana Ribeiro',autor_role:'financeiro',criado_em:'2026-10-18T09:00:00Z',texto:'Valor residual confirmado'},
    {id:58,contrato:'EOT003',autor_id:'f1',autor_nome:'Ana Ribeiro',autor_role:'financeiro',criado_em:'2026-10-16T09:00:00Z',texto:'Liquidação simulada'},
    {id:55,contrato:'EOT001',autor_id:'f1',autor_nome:'Ana Ribeiro',autor_role:'financeiro',criado_em:'2026-10-14T09:00:00Z',texto:'Pode avançar'}],
  lidas:[{user_id:'v1',contrato:'EOT001',hist_id:55,lido_em:'2026-10-14T10:00:00Z'}],
  enc:[{origem:'aveiro',production_number:'9200001',model_desc:'R 1300 GS Adventure',color_code:'P0N3M',order_status:'193',ts_order_status:'2026-06-01',processing_type:'ST',customer_last:'',importado_em:'2026-10-19T08:00:00Z'},
    {origem:'aveiro',production_number:'9200002',model_desc:'F 900 GS',color_code:'P0N1N',order_status:'198',ts_order_status:'2026-09-30',processing_type:'US',customer_last:'',importado_em:'2026-10-19T08:00:00Z'},
    {origem:'aveiro',production_number:'9200003',model_desc:'R 1300 RT',order_status:'193',ts_order_status:'2026-07-01',processing_type:'DE',customer_last:'Apelido',importado_em:'2026-10-19T08:00:00Z'},
    {origem:'aveiro',production_number:'9200004',model_desc:'S 1000 R',order_status:'150',ts_order_status:'2026-10-01',processing_type:'ST',customer_last:'',importado_em:'2026-10-19T08:00:00Z'},
    {origem:'rede',production_number:'9200005',model_desc:'R 12',order_status:'193',ts_order_status:'2026-05-01',processing_type:'ST',customer_last:'',importado_em:'2026-10-19T08:00:00Z'}],
  stock:[{id:201,modelo:'R 1250 GS',matricula:'AA-00-AA',ano:2021,kms:30000,data_rececao:'2026-06-01',valor_anunciado:15900,categoria:'usada',estado:'Disponível'},
    {id:202,modelo:'F 750 GS',matricula:'BB-11-BB',ano:2022,kms:12000,data_rececao:'2026-10-01',valor_anunciado:7900,valor_campanha:7500,categoria:'usada',estado:'A negociar'},
    {id:203,modelo:'R 1300 GS',matricula:'CC-22-CC',categoria:'demo',estado:'Disponível',data_rececao:'2026-03-01'},
    {id:204,modelo:'G 310 GS',matricula:'DD-33-DD',categoria:'usada',estado:'Vendida',data_rececao:'2026-01-10',valor_anunciado:4500}],
  seq:[{id:1,lote:'L1',ref:'X1',descricao:'Lote antigo',qualidade:'Morto',qtd:9,custo_total:9999},
    {id:2,lote:'L2',ref:'76228526101',descricao:'Botas Teste A',qualidade:'Morto',qtd:3,custo_total:300,desc_max:0.3},
    {id:3,lote:'L2',ref:'76228526102',descricao:'Casaco Teste B',qualidade:'Moribundo',qtd:1,custo_unit:250,desc_max:0.15},
    {id:4,lote:'L2',ref:'76228526103',descricao:'Luvas Teste C',qualidade:'Vivo',qtd:5,custo_total:100},
    {id:5,lote:'L2',ref:'76228526104',descricao:'Capacete Teste D',qualidade:'Morto',qtd:0,custo_total:0}],
  equip:[{id:301,data:'2026-10-15',vendedor_id:'v1',estado_stock:'Morto',venda:120,qtd:1},{id:302,data:'2026-10-18',vendedor_id:'v2',estado_stock:'Normal',venda:200,qtd:2},
    {id:303,data:'2026-10-01',vendedor_id:'v1',estado_stock:'Normal',venda:999,qtd:1},{id:304,data:'2026-10-19',vendedor_id:'v2',estado_stock:'Moribundo',venda:50,qtd:1}],
  eventos:[{id:1,nome:'Test-ride Outono',data:'2026-10-31',local:'Aveiro',lotacao:20,ativo:true,motas:[{m:'R 1300 GS'},{m:'F 900 GS'}],created_at:'2026-10-01T10:00:00Z'},
    {id:2,nome:'Evento Antigo',data:'2026-09-01',local:'Porto',ativo:false,created_at:'2026-08-01T10:00:00Z'}],
  insc:[{id:1,evento_id:1,estado:'Confirmado',vendedor_id:'v1'},{id:2,evento_id:1,estado:'Lista de espera',vendedor_id:'v1'},{id:3,evento_id:1,estado:'Cancelado',vendedor_id:'v2'},{id:4,evento_id:2,estado:'Confirmado',vendedor_id:'v2'}],
  comp:[{id:1,reuniao:'2026-10-13',vendedor_id:'v1',ponto:'eots',texto:'Ligar aos 3 clientes EOT',prazo:'2026-10-17',feito:false,feito_em:null,criado_em:'2026-10-13T14:10:00Z'},
    {id:2,reuniao:'2026-10-13',vendedor_id:'v2',ponto:'resultados',texto:'Fechar a F 900 R do cliente Beta',prazo:'2026-10-20',feito:true,feito_em:'2026-10-19T10:00:00Z',criado_em:'2026-10-13T14:12:00Z'},
    {id:3,reuniao:'2026-10-06',vendedor_id:'v1',ponto:'stock',texto:'Rever preços das usadas',prazo:'2026-10-10',feito:true,feito_em:'2026-10-08T10:00:00Z',criado_em:'2026-10-06T14:10:00Z'},
    {id:4,reuniao:'2026-10-13',vendedor_id:null,ponto:'eventos',texto:'Inscrever clientes no test-ride',prazo:'2026-10-24',feito:false,feito_em:null,criado_em:'2026-10-13T14:15:00Z'},
    {id:5,reuniao:'2026-10-06',vendedor_id:'v2',ponto:'eots',texto:'Enviar proposta ao cliente Mu',prazo:'2026-10-13',feito:false,feito_em:null,criado_em:'2026-10-06T14:20:00Z'},          // por cumprir há uma semana
    {id:6,reuniao:'2026-09-29',vendedor_id:'v1',ponto:'equip',texto:'Rever stock de capacetes',prazo:'2026-10-20',feito:false,feito_em:null,adiamentos:1,adiado_em:'2026-10-13',criado_em:'2026-09-29T14:10:00Z'},   // já levou nova data
    {id:7,reuniao:'2026-10-13',vendedor_id:'v2',ponto:'eots',texto:'Ligar ao cliente Xi',prazo:'2026-10-20',feito:false,feito_em:null,criado_em:'2026-10-13T14:20:00Z'}   // vence no dia da reunião
  ].map(c=>Object.assign({adiamentos:0,adiado_em:null},c))});
const P=[{id:'c1',nome:'Gonçalo Pinto',role:'admin',linha:'motorrad'},{id:'v1',nome:'Felipe Gomes',role:'vendedor',linha:'motorrad'},{id:'v2',nome:'Rui Costa',role:'vendedor',linha:'motorrad'},{id:'f1',nome:'Ana Ribeiro',role:'financeiro',linha:'motorrad'}];
const AXE=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
// axe (WCAG 2.2 AA) só na zona da reunião + contraste medido à mão nos textos com cor própria (o axe às vezes não decide)
const auditar=async(pg,sels)=>{if(await pg.evaluate(()=>typeof axe==='undefined'))await pg.evaluate(AXE);
  const v=await pg.evaluate(async()=>{document.getAnimations().forEach(a=>{try{a.finish();}catch(e){}});
    const x=await axe.run(document.querySelector('.reu')||document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
    return x.violations.map(v=>v.id+': '+v.nodes.map(n=>n.target.join(' ')).slice(0,3).join(', '));});
  const c=await pg.evaluate(sels=>{const parse=c=>{const m=String(c).match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return{r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1};};
    const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
    const mix=(t,b)=>({r:t.r*t.a+b.r*(1-t.a),g:t.g*t.a+b.g*(1-t.a),b:t.b*t.a+b.b*(1-t.a),a:1});
    const bgDe=el=>{const L=[];let e=el;while(e&&e.nodeType===1){const c=parse(getComputedStyle(e).backgroundColor);if(c&&c.a>0)L.push(c);if(c&&c.a>=1)break;e=e.parentElement;}
      let base={r:255,g:255,b:255,a:1};const root=parse(getComputedStyle(document.body).backgroundColor);if(root&&root.a>=1)base=root;for(let i=L.length-1;i>=0;i--)base=mix(L[i],base);return base;};
    const out=[];let n=0;sels.forEach(s=>document.querySelectorAll(s).forEach(el=>{if(!el.getClientRects().length)return;n++;const cs=getComputedStyle(el);let fg=parse(cs.color);const bg=bgDe(el);if(fg.a<1)fg=mix(fg,bg);
      const x=lum(fg),y=lum(bg);const r=(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);const px=parseFloat(cs.fontSize),w=parseInt(cs.fontWeight)||400;const min=(px>=24||(px>=18.66&&w>=700))?3:4.5;
      if(r<min-0.01)out.push(s+' '+r.toFixed(2)+' «'+el.textContent.trim().slice(0,24)+'»');}));return{n,out};},sels);
  return{axe:v,contraste:c.out,medidos:c.n};};
const SEL_PREP=['.reu-sub','.reu-fim','.reu-agenda small','.reu-bmin','.reu-priv','.reu-perg .reu-lt','.reu-perg li','.reu-c.atras small','.reu-c.feito .reu-c-t','.reu-c-t small','.reu-rs','.reu-lt','.reu-preco span','.reu-vazio'];
const SEL_COND=['#reu-total','#reu-passo-t','.reu-pt','.reu-pt.on','.reu-ptempo','.reu-perg .reu-lt'];
const nb=s=>String(s||'').replace(/[  ]/g,' ').replace(/[ \t]+/g,' ').trim();
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const erros=[],dialogos=[];const T={};
 const contexto=async(vp,db)=>{const ctx=await b.newContext({viewport:vp,timezoneId:'Europe/Lisbon',locale:'pt-PT'});
  await ctx.clock.install({time:AGORA});
  await ctx.addInitScript(t=>{localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));
    try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:x=>{window._clip=x;return Promise.resolve();}}});}catch(e){}},jwt('c1'));
  await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
   const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
   if(u.includes('/auth/v1/token'))return json({access_token:jwt('c1'),refresh_token:'x'});
   const t=(u.match(/rest\/v1\/(rpc\/)?([a-z_]+)/)||[])[2];const id=(u.match(/[?&]id=eq\.([^&]+)/)||[])[1];const p0=!/offset=[1-9]/.test(u);
   const body=()=>{try{return JSON.parse(r.request().postData()||'{}');}catch(e){return{};}};
   if(t==='profiles')return json(id?P.filter(x=>x.id===id):P);
   if(t==='reuniao_compromissos'){
     if(db.semSql)return json({code:'PGRST205',message:"Could not find the table 'public.reuniao_compromissos' in the schema cache"},404);
     if(m==='GET')return json(db.comp);
     if(m==='POST'){const x=body();const row=Object.assign({id:++db.seq,feito:false,feito_em:null,criado_em:new Date().toISOString()},x);db.comp.push(row);db.posts.push(['reuniao_compromissos',x]);return json([row],201);}
     if(m==='PATCH'){const x=body();db.patches.push(['reuniao_compromissos',id,x]);if(db.falhar===id)return json({message:'erro de teste',code:'XX000'},500);
       const c=db.comp.find(y=>String(y.id)===String(id));if(c)Object.assign(c,x);return json(c?[c]:[]);}
     if(m==='DELETE'){db.deletes.push(['reuniao_compromissos',id]);db.comp=db.comp.filter(y=>String(y.id)!==String(id));return json([]);}}
   if(t==='stock_usadas'){if(m==='GET')return json(db.stock);
     if(m==='PATCH'){const x=body();db.patches.push(['stock_usadas',id,x]);const s=db.stock.find(y=>String(y.id)===String(id));if(s)Object.assign(s,x);return json(s?[s]:[]);}}
   if(m!=='GET')return json([]);
   const G={baviera_control:db.recs,objetivos_equipa:[{mes:'2026-10-01',tipo:'novas',objetivo:10}],comissoes_fecho:[{mes:'2026/07',fechado_em:'2026-09-20T10:00:00Z'},{mes:'2026/08',fechado_em:'2026-10-15T10:00:00Z'}],
     margens:[{negocio_id:107,margem:850},{negocio_id:108,margem:-120},{negocio_id:109,margem:999}],entregas:[{negocio_id:110,data_entrega:'2026-10-23',pago:false,pedido_matricula:true,prep_pedida:false,docs:{}}],
     eot_contratos:db.eot,eot_historico:db.hist,eot_notif_lidas:db.lidas,encomendas_bmw:p0?db.enc:[],stock_equip:p0?db.seq:[],equipamento:db.equip,eventos:db.eventos,inscricoes:db.insc};
   return json(G[t]||[]);});
  const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));p.on('dialog',d=>{dialogos.push(d.message());d.accept();});
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1800);
  return {ctx,p};};
 const db=base();const {ctx,p}=await contexto({width:1440,height:1000},db);
 const entrar=async(pg)=>{await pg.evaluate(()=>{S.screen='dashboard';S.gppSec='home';render();});await pg.waitForTimeout(300);
   await pg.evaluate(()=>document.querySelector('.gpp-nav-item[data-s="reuniao"]').click());await pg.waitForTimeout(900);};   // no telemóvel o menu está recolhido
 const bloco=(pg,k)=>pg.evaluate(k=>{const s=document.querySelector(`.reu-bloco[aria-labelledby="reu-h-${k}"]`);if(!s)return null;
   const tx=e=>e.innerText.replace(/\s+/g,' ').trim();
   return {frases:[...s.querySelectorAll('.reu-frases li')].map(tx),perg:[...s.querySelectorAll('.reu-perg li')].map(tx),
     listas:[...s.querySelectorAll('.reu-lista')].map(l=>({t:tx(l.querySelector('.reu-lt')),rows:[...l.querySelectorAll('.reu-row')].map(r=>[...r.querySelectorAll('.reu-rn,.reu-rs,.reu-rv')].map(tx).join(' | ')),vazio:l.querySelector('.reu-vazio')?tx(l.querySelector('.reu-vazio')):''})),
     comp:[...s.querySelectorAll('.reu-c')].map(c=>tx(c.querySelector('.reu-c-t'))+(c.classList.contains('feito')?' [feito]':'')+(c.classList.contains('atras')?' [atras]':'')+(c.querySelector('.reu-c-rep')?' ['+tx(c.querySelector('.reu-c-rep'))+']':'')),
     datas:[...s.querySelectorAll('.reu-c-data')].map(l=>tx(l.querySelector('span'))+' '+l.querySelector('input').value),
     aviso:s.querySelector('.mg-aviso')?tx(s.querySelector('.mg-aviso')):'',form:!!s.querySelector('#reu-c-texto')};},k).then(x=>x&&JSON.parse(JSON.stringify(x).replace(/[  ]/g,' ')));
 const toastTxt=async(pg)=>{pg=pg||p;await pg.waitForTimeout(800);return nb(await pg.evaluate(()=>((document.getElementById('bm-toast')||{}).textContent||'')));};

 // ---------- 1) preparação
 await entrar(p);
 T.menu=await p.evaluate(()=>{const g=[...document.querySelectorAll('.gpp-nav-item')].map(x=>x.dataset.s);return{tem:g.includes('reuniao'),depoisAtratar:g.indexOf('reuniao')===g.indexOf('atratar')+1&&g.indexOf('atratar')===g.indexOf('home')+1,ativo:(document.querySelector('.gpp-nav-item.active')||{dataset:{}}).dataset.s};});
 T.topo=await p.evaluate(()=>({t:document.querySelector('.reu-t').textContent,sub:document.querySelector('.reu-sub').textContent.replace(/\s+/g,' '),
   btn:document.querySelector('[data-action="reu-comecar"]').textContent.trim(),agenda:[...document.querySelectorAll('.reu-agenda span')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),
   blocos:document.querySelectorAll('.reu-bloco').length,carga:!!document.querySelector('.reu-carga')}));
 for(const k of ['compromissos','resultados','carteira','eots','stock','equip','eventos','fecho'])T[k]=await bloco(p,k);
 T.resumo=await p.evaluate(()=>document.getElementById('reu-resumo').value);
 await p.screenshot({path:path.join(__dirname,'reuniao.png'),fullPage:false});

 // ---------- 2) preço das usadas na própria reunião
 const inpAnunc='input[data-reu-preco="202"][data-campo="valor_anunciado"]',inpCamp='input[data-reu-preco="202"][data-campo="valor_campanha"]';
 T.precoIni=await p.evaluate(s=>[document.querySelector(s[0]).value,document.querySelector(s[1]).value,document.querySelector(s[0]).getAttribute('aria-label')],[inpAnunc,inpCamp]);
 await p.fill(inpAnunc,'abc');await p.press(inpAnunc,'Tab');
 T.precoInvalido={toast:await toastTxt(),patches:db.patches.filter(x=>x[0]==='stock_usadas').length,erro:await p.evaluate(s=>document.querySelector(s).classList.contains('num-erro'),inpAnunc)};
 await p.fill(inpAnunc,'7 700');await p.press(inpAnunc,'Tab');await p.waitForTimeout(500);
 await p.fill(inpCamp,'');await p.press(inpCamp,'Tab');await p.waitForTimeout(500);
 T.preco={patches:db.patches.filter(x=>x[0]==='stock_usadas').map(x=>[x[1],Object.keys(x[2]).filter(k=>k!=='updated_at').map(k=>k+'='+x[2][k]).join(',')]),frase:(await bloco(p,'stock')).frases[1]};

 // ---------- 3) compromissos
 await p.click('[data-action="reu-comp-add"]');
 T.semTexto={toast:await toastTxt(),posts:db.posts.length};
 await p.selectOption('#reu-c-vend','v2');await p.fill('#reu-c-texto','Ligar à Cliente Teta sobre a S 1000 XR');await p.press('#reu-c-texto','Enter');
 T.registo={toast:await toastTxt(),post:(db.posts[0]||[])[1]||null,campos:await p.evaluate(()=>({texto:document.getElementById('reu-c-texto').value,vend:document.getElementById('reu-c-vend').value})),
   fecho:(await bloco(p,'fecho')),resumo:await p.evaluate(()=>document.getElementById('reu-resumo').value)};
 await p.click('.reu-bloco[aria-labelledby="reu-h-compromissos"] [data-action="reu-comp-feito"][data-id="1"]');await p.waitForTimeout(400);
 T.feito={patch:db.patches.filter(x=>x[0]==='reuniao_compromissos').slice(-1)[0],bloco:await bloco(p,'compromissos'),pressed:await p.evaluate(()=>document.querySelector('[data-action="reu-comp-feito"][data-id="1"]').getAttribute('aria-pressed'))};
 db.falhar='4';await p.click('.reu-bloco[aria-labelledby="reu-h-compromissos"] [data-action="reu-comp-feito"][data-id="4"]');
 T.feitoFalha={toast:await toastTxt(),feito:await p.evaluate(()=>S.reuComp.find(c=>c.id===4).feito),classe:await p.evaluate(()=>document.querySelector('[data-action="reu-comp-feito"][data-id="4"]').closest('.reu-c').classList.contains('feito'))};db.falhar=null;
 await p.click('.reu-bloco[aria-labelledby="reu-h-compromissos"] [data-action="reu-comp-apagar"][data-id="4"]');await p.waitForTimeout(400);
 T.apagar={dialogo:dialogos.slice(-1)[0]||'',del:db.deletes.slice(-1)[0],bloco:await bloco(p,'compromissos')};
 const inpData='.reu-bloco[aria-labelledby="reu-h-compromissos"] input[data-reu-prazo="7"]';const nPD=()=>db.patches.filter(x=>x[0]==='reuniao_compromissos');
 await p.fill(inpData,'2026-10-28');await p.waitForTimeout(400);
 T.novaData={patch:nPD().slice(-1)[0],bloco:await bloco(p,'compromissos')};
 await p.fill(inpData,'2026-10-27');await p.waitForTimeout(400);T.novaData.corrigir=nPD().slice(-1)[0];
 const nAntes=nPD().length;await p.fill(inpData,'2026-10-19');
 T.novaData.invalida={toast:await toastTxt(),patches:nPD().length-nAntes,valor:await p.evaluate(s=>document.querySelector(s).value,inpData)};

 // ---------- 4) conduzir
 await p.click('[data-action="reu-comecar"]');await p.waitForTimeout(400);
 const passo=()=>p.evaluate(()=>({n:[...document.querySelectorAll('.reu-pt')].length,on:(document.querySelector('.reu-pt[aria-current="step"]')||{}).textContent,
   titulo:(document.querySelector('.reu-bloco.passo h3')||{}).textContent,ptempo:(document.querySelector('.reu-ptempo')||{}).textContent,total:(document.getElementById('reu-total')||{}).textContent,
   passoT:(document.getElementById('reu-passo-t')||{}).textContent,overT:document.getElementById('reu-total').classList.contains('over'),overP:document.getElementById('reu-passo-t').classList.contains('over'),
   form:!!document.getElementById('reu-c-texto'),formP:(document.querySelector('[data-action="reu-comp-add"]')||{dataset:{}}).dataset.p,blocos:document.querySelectorAll('.reu-bloco').length,
   prox:((document.querySelector('[data-action="reu-prox"]')||{}).textContent||'').trim(),terminar:!!document.querySelector('[data-action="reu-terminar"]'),antDis:(document.querySelector('[data-action="reu-ant"]')||{}).disabled}));
 T.c1=await passo();
 await ctx.clock.fastForward('01:05');await p.waitForTimeout(200);T.c1t=await passo();
 await ctx.clock.fastForward('01:00');await p.waitForTimeout(200);T.c1over=await passo();T.a11yCond={claro:await auditar(p,SEL_COND)};
 await p.evaluate(()=>{temaAplicar('escuro');render();});await p.waitForTimeout(200);T.a11yCond.escuro=await auditar(p,SEL_COND);await p.evaluate(()=>{temaAplicar('claro');render();});
 await p.click('[data-action="reu-prox"]');await p.waitForTimeout(300);T.c2=await passo();
 await p.click('[data-action="reu-passo"][data-p="5"]');await p.waitForTimeout(300);T.c6=await passo();
 await p.click('.reu-bloco.passo [data-action="reu-usar"]');await p.waitForTimeout(300);
 T.usar=await p.evaluate(()=>document.getElementById('reu-c-texto').value);
 await p.selectOption('#reu-c-vend','');await p.click('[data-action="reu-comp-add"]');await p.waitForTimeout(700);
 T.usarPost=(db.posts[1]||[])[1]||null;
 await p.screenshot({path:path.join(__dirname,'reuniao_conduzir.png'),fullPage:false});
 await p.click('[data-action="reu-passo"][data-p="7"]');await p.waitForTimeout(300);T.c8=await passo();
 T.c8fecho=await bloco(p,'fecho');
 await p.click('[data-action="reu-copiar"]');T.copiar={toast:await toastTxt(),clip:await p.evaluate(()=>window._clip||''),txt:await p.evaluate(()=>document.getElementById('reu-resumo').value)};
 await ctx.clock.fastForward('00:20');
 await p.click('[data-action="reu-terminar"]');T.terminar={toast:await toastTxt(),modo:await p.evaluate(()=>S.reu.modo),
   fim:await p.evaluate(()=>((document.querySelector('.reu-fim')||{}).textContent||'')),btn:await p.evaluate(()=>document.querySelector('[data-action="reu-comecar"]').textContent.trim())};
 T.a11y={prepClaro:await auditar(p,SEL_PREP)};
 await p.evaluate(()=>{temaAplicar('escuro');render();});await p.waitForTimeout(200);T.a11y.prepEscuro=await auditar(p,SEL_PREP);
 await p.evaluate(()=>{temaAplicar('claro');render();});
 // guardado neste computador: abrir de novo mostra a reunião terminada; retomar volta ao último ponto e desconta a pausa
 await ctx.clock.fastForward('05:00');
 await p.reload();await p.waitForTimeout(1800);await entrar(p);
 T.reaberto={fim:await p.evaluate(()=>!!document.querySelector('.reu-fim')),btn:await p.evaluate(()=>document.querySelector('[data-action="reu-comecar"]').textContent.trim())};
 await p.click('[data-action="reu-comecar"]');await p.waitForTimeout(1300);T.retomar=await passo();
 await p.click('[data-action="reu-sair"]');await p.waitForTimeout(300);
 T.sair={modo:await p.evaluate(()=>S.reu.modo),btn:await p.evaluate(()=>document.querySelector('[data-action="reu-comecar"]').textContent.trim())};
 // que reunião é «esta»: segunda a quarta = a de terça (quarta serve para feriados); quinta a domingo = a da terça seguinte
 T.dias=[];for(const iso of ['2026-10-19T09:00:00Z','2026-10-20T20:00:00Z','2026-10-21T16:00:00Z','2026-10-22T09:00:00Z','2026-10-25T12:00:00Z']){await ctx.clock.setFixedTime(new Date(iso));
   T.dias.push(await p.evaluate(()=>reuISO(reuData())+' desde '+reuISO(reuJanela().ini)+' '+reuJanela().ini.getHours()+'h'));}
 await ctx.clock.setFixedTime(new Date('2026-10-27T13:30:00Z'));await entrar(p);T.semanaSeguinte=await bloco(p,'compromissos');
 await ctx.close();

 // ---------- 5) antes de correr o SQL
 const db2=base();db2.semSql=true;const s2=await contexto({width:1440,height:1000},db2);await entrar(s2.p);
 T.semSql={comp:await bloco(s2.p,'compromissos'),form:await s2.p.evaluate(()=>!!document.getElementById('reu-c-texto')),resultados:((await bloco(s2.p,'resultados'))||{frases:[]}).frases[0]};
 await s2.ctx.close();
 const db4=base();db4.comp.forEach(c=>{delete c.adiamentos;delete c.adiado_em;});const s4=await contexto({width:1440,height:1000},db4);await entrar(s4.p);
 const b4=await bloco(s4.p,'compromissos');await s4.p.fill('.reu-bloco[aria-labelledby="reu-h-compromissos"] input[data-reu-prazo="7"]','2026-10-27');await s4.p.waitForTimeout(400);
 T.semAdiam={aviso:b4.aviso,frase:b4.frases[0],patch:db4.patches.filter(x=>x[0]==='reuniao_compromissos').slice(-1)[0]};
 await s4.ctx.close();

 // ---------- 6) telemóvel
 const db3=base();const t=await contexto({width:390,height:844},db3);await entrar(t.p);
 const larg=()=>t.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
 T.tel={prep:await larg()};await t.p.click('[data-action="reu-comecar"]');await t.p.waitForTimeout(300);
 await t.p.click('[data-action="reu-passo"][data-p="4"]');await t.p.waitForTimeout(300);T.tel.stock=await larg();
 await t.p.click('[data-action="reu-passo"][data-p="7"]');await t.p.waitForTimeout(300);T.tel.fecho=await larg();
 await t.ctx.close();
 T.erros=erros;T.dialogos=dialogos;console.log(JSON.stringify(T,null,1));

 const F=x=>(x&&x.frases)||[];const PG=x=>(x&&x.perg)||[];const L=(x,i)=>((x&&x.listas)||[])[i]||{rows:[]};
 const ok={
  'menu do chefe: Reunião semanal no Diário, a seguir a A tratar':T.menu.tem&&T.menu.depoisAtratar&&T.menu.ativo==='reuniao',
  'topo: dia e hora da reunião, desde quando contam os números':T.topo.t==='Reunião semanal'&&T.topo.sub==='terça-feira, 20/10 às 15:00 · 20 min · números desde terça-feira, 13/10 às 15:00'&&T.topo.btn==='Começar a reunião'&&!T.topo.carga,
  'agenda: 8 pontos que somam 20 minutos':T.topo.agenda.length===8&&T.topo.agenda.reduce((a,x)=>a+Number((x.match(/(\d+) min$/)||[])[1]||0),0)===20&&T.topo.blocos===9,
  'compromissos da semana passada: cumpridos, por cumprir (o que vence no dia da reunião também) e repetidos primeiro':F(T.compromissos)[0]==='1 de 6 compromissos cumpridos · 4 por cumprir, 2 repetidos.'&&
    JSON.stringify(T.compromissos.comp)===JSON.stringify(['Felipe Rever stock de capacetes por cumprir pela 2.ª vez desde 20/10 [atras] [Repetido · 2.ª vez]','Rui Enviar proposta ao cliente Mu por cumprir pela 2.ª vez desde 13/10 [atras] [Repetido · 2.ª vez]',
      'Felipe Ligar aos 3 clientes EOT por cumprir desde 17/10 [atras]','Rui Ligar ao cliente Xi por cumprir desde 20/10 [atras]','Equipa Inscrever clientes no test-ride','Rui Fechar a F 900 R do cliente Beta feito a 19/10 [feito]'])&&
    JSON.stringify(T.compromissos.datas)===JSON.stringify(['Nova data 2026-10-20','Nova data 2026-10-13','Nova data 2026-10-17','Nova data 2026-10-20','Nova data 2026-10-24']),
  'perguntas: repetidos com pergunta própria, depois o que impediu':JSON.stringify(PG(T.compromissos))===JSON.stringify(['Felipe: é a 2.ª vez que «Rever stock de capacetes» fica por cumprir. O que muda esta semana para não haver 3.ª?',
      'Rui: é a 2.ª vez que «Enviar proposta ao cliente Mu» fica por cumprir. O que muda esta semana para não haver 3.ª?','Felipe: o que impediu «Ligar aos 3 clientes EOT»? Qual é a data nova?']),
  'resultados: objetivo, mês anterior até ao mesmo dia, ritmo e Carteira':F(T.resultados)[0]==='Retail novas: 3 de 10 (30%) — faltam 7 em 11 dias.'&&F(T.resultados)[1]==='Contra set. até ao dia 20: novas +2, usadas +1 (usadas no mês: 1).'&&
    F(T.resultados)[2]==='A este ritmo o mês fecha com ~5 novas. Se a Carteira deste mês entregar toda (1 nova), chega a 4.'&&F(T.resultados)[3]==='Desde a última reunião: 3 retail (Felipe 1 · Rui 2).',
  'resultados: margem do último mês lançado só nesta vista (sem demos)':F(T.resultados)[4]==='Só para ti Margem de Ago 26 (último mês com comissões fechadas): 730 € em 2 motas, 1 com margem negativa.',
  'resultados: lista da semana e perguntas':JSON.stringify(L(T.resultados,0).rows)===JSON.stringify(['Cliente Alfa | MN · R 1300 GS · Felipe | 19/10','Cliente Beta | MN · F 900 R · Rui | 14/10','Cliente Delta | MU · R nineT · Rui | 16/10'])&&
    JSON.stringify(PG(T.resultados))===JSON.stringify(['Que negócios fecham até sexta para recuperar 5 novas de ritmo?','O que falta para entregar a nova da Carteira deste mês?']),
  'carteira: entregas a 2 semanas com o que falta, atrasos, sem encomenda e pedidos de mês':F(T.carteira)[0]==='1 entrega nas próximas 2 semanas · 1 em atraso · 1 nova sem encomenda nem chassis · 1 pedido de mudança de mês por validar.'&&
    L(T.carteira,0).rows[0]==='Cliente Eta | Felipe · por pagar · matrícula pedida · preparação por pedir | 23/10'&&L(T.carteira,1).rows[0]==='Cliente Teta | Rui · S 1000 XR | mês Set 26'&&
    L(T.carteira,2).rows[0]==='Cliente Teta | Rui · S 1000 XR | sem encomenda'&&L(T.carteira,3).rows[0]==='Cliente Iota | Felipe | Out 26 → 2026/11'&&PG(T.carteira)[0]==='Rui: o que falta para entregar a mota de Cliente Teta?',
  'EOTs: a 90 dias por contactar, indicações por ler (lidas não contam) e por atribuir':F(T.eots)[0]==='3 contratos a terminar em 90 dias ou menos ainda por contactar (por atribuir 1 · Felipe 1 · Rui 1).'&&
    F(T.eots)[1]==='Indicações dos financeiros por ler: Felipe 2.'&&F(T.eots)[2]==='1 EOT por atribuir.'&&JSON.stringify(L(T.eots,0).rows.map(r=>r.split(' | ')[0]))==='["Cliente Xi","Cliente Kapa","Cliente Mu"]'&&
    PG(T.eots).includes('Felipe: quando ligas ao contrato que termina em menos de 90 dias?')&&PG(T.eots).includes('Felipe: tens 2 indicações dos financeiros por ler. Quando as tratas?'),
  'stock: novas livres de Aveiro, ST→US e usadas por antiguidade':F(T.stock)[0]==='Novas livres em stock em Aveiro: 2, 1 há 90 dias ou mais · 1 para mudar de ST para US.'&&
    F(T.stock)[1]==='Usadas à venda: 2 (23 800 € anunciados, 80 dias em média) · 1 há 90 dias ou mais: rever preço · 1 demo.'&&JSON.stringify(L(T.stock,0).rows.map(r=>r.split(' | ')[0]+' '+r.split(' | ').pop()))==='["R 1300 GS Adventure 141 d","F 900 GS 20 d"]'&&
    PG(T.stock)[0]==='R 1250 GS (AA-00-AA) está há 141 dias a 15 900 €: baixamos, fazemos campanha ou vai para comerciante?'&&PG(T.stock)[1]==='Quem pede à BMW a passagem de ST para US da mota com 90 dias ou mais?',
  'equipamento: faturado da semana por vendedor, stock morto/moribundo e dinâmica':F(T.equip)[0]==='Equipamento desde a última reunião: 570 € faturados s/IVA (Rui 450 € · Felipe 120 €) · 1 de stock morto e 1 de moribundo.'&&
    F(T.equip)[1]==='Stock morto: 300 € a custo (2 ref.) · moribundo: 250 € (1 ref.). Comissão: 20% do faturado no morto, 10% no moribundo.'&&/^Dinâmica sugerida: Desafio até 27\/10: cada vendedor vende 2 artigos de stock morto \(comissão de 20%\)\. Usar como compromisso$/.test(F(T.equip)[2])&&
    JSON.stringify(L(T.equip,0).rows)===JSON.stringify(['Botas Teste A | 76228526101 · Morto · 3 un. · desc. máx. 30% | 300 €','Casaco Teste B | 76228526102 · Moribundo · 1 un. · desc. máx. 15% | 250 €']),
  'eventos: inscritos por vendedor e quem ainda não convidou ninguém':F(T.eventos)[0]==='Test-ride Outono · 31/10 · Aveiro: 2 inscritos de 20 (1 confirmado, 1 em espera) · Felipe 2 · 2 motas.'&&F(T.eventos).length===1&&
    JSON.stringify(PG(T.eventos))===JSON.stringify(['Rui: ainda não inscreveste ninguém em Test-ride Outono. Que clientes do teu funil convidas?']),
  'resumo para a equipa: números certos e sem margens':/^Reunião comercial · terça-feira, 20\/10\n\nResultados: retail novas 3\/10 \(30%\) · usadas 1 · Carteira do mês 2\nCarteira: 1 entrega\(s\) nas próximas 2 semanas · 1 em atraso\nEOTs: 3 contrato\(s\) a terminar em ≤90 dias por contactar\nStock: 1 ST→US · 1 usada\(s\) há 90\+ dias\nEquipamento: 570 € faturados desde a última reunião\nEvento: Test-ride Outono 31\/10 · 2 inscrito\(s\)$/.test(nb(T.resumo).replace(/ ?\n ?/g,'\n'))&&!/margem|730/i.test(T.resumo),
  'preço das usadas: valor inválido não grava e marca o campo':/Valor inválido/.test(T.precoInvalido.toast)&&T.precoInvalido.patches===0&&T.precoInvalido.erro&&T.precoIni[0]==='7900'&&T.precoIni[1]==='7500'&&T.precoIni[2]==='Anunciado de F 750 GS',
  'preço das usadas: grava no stock e o total anunciado acompanha':JSON.stringify(T.preco.patches)==='[["202","valor_anunciado=7700"],["202","valor_campanha=null"]]'&&/^Usadas à venda: 2 \(23 600 € anunciados/.test(T.preco.frase),
  'compromisso sem texto não grava e diz porquê':/Escreve o compromisso/.test(T.semTexto.toast)&&T.semTexto.posts===0,
  'compromisso com Enter: grava quem, o quê, a reunião e o prazo (próxima terça)':T.registo.post&&T.registo.post.reuniao==='2026-10-20'&&T.registo.post.vendedor_id==='v2'&&T.registo.post.ponto===null&&T.registo.post.texto==='Ligar à Cliente Teta sobre a S 1000 XR'&&T.registo.post.prazo==='2026-10-27'&&
    /Compromisso registado/.test(T.registo.toast)&&T.registo.campos.texto===''&&T.registo.campos.vend==='v2',
  'compromisso aparece no fecho e no resumo':F(T.registo.fecho)[0]==='1 compromisso registado nesta reunião.'&&/\nCompromissos:\n- Rui: Ligar à Cliente Teta sobre a S 1000 XR \(até 27\/10\)$/.test(T.registo.resumo),
  'marcar feito: grava, conta e sai dos por cumprir':T.feito.patch&&T.feito.patch[1]==='1'&&T.feito.patch[2].feito===true&&!!T.feito.patch[2].feito_em&&F(T.feito.bloco)[0]==='2 de 6 compromissos cumpridos · 3 por cumprir, 2 repetidos.'&&T.feito.pressed==='true'&&
    !PG(T.feito.bloco).some(q=>/Ligar aos 3 clientes/.test(q))&&PG(T.feito.bloco).length===3,
  'servidor recusa o feito: volta atrás e avisa':/Não gravei/.test(T.feitoFalha.toast)&&T.feitoFalha.feito===false&&!T.feitoFalha.classe,
  'apagar compromisso: pergunta antes e apaga':/Apagar o compromisso «Inscrever clientes no test-ride»/.test(T.apagar.dialogo)&&T.apagar.del&&T.apagar.del[1]==='4'&&T.apagar.bloco.comp.length===5,
  'nova data num compromisso por cumprir: conta o adiamento e continua contado nesta reunião':T.novaData.patch&&T.novaData.patch[1]==='7'&&JSON.stringify(T.novaData.patch[2])==='{"prazo":"2026-10-28","adiamentos":1,"adiado_em":"2026-10-20"}'&&
    F(T.novaData.bloco)[0]==='2 de 5 compromissos cumpridos · 3 por cumprir, 2 repetidos.'&&T.novaData.bloco.comp.includes('Rui Ligar ao cliente Xi por cumprir · nova data dada hoje [atras]')&&!PG(T.novaData.bloco).some(q=>/cliente Xi/.test(q)),
  'corrigir a nova data na mesma reunião não conta outra vez; data antes da reunião recusada':JSON.stringify(T.novaData.corrigir[2])==='{"prazo":"2026-10-27"}'&&/A nova data tem de ser depois da reunião \(20\/10\)/.test(T.novaData.invalida.toast)&&T.novaData.invalida.patches===0&&T.novaData.invalida.valor==='2026-10-27',
  'semana seguinte: o adiado que volta a falhar é repetido; os outros sobem para a 3.ª vez':F(T.semanaSeguinte)[0]==='0 de 5 compromissos cumpridos · 5 por cumprir, 3 repetidos.'&&
    JSON.stringify(T.semanaSeguinte.comp.slice(0,3).map(x=>x.replace(/^(\S+) .*\[(Repetido · \d\.ª vez)\]$/,'$1 $2')))===JSON.stringify(['Felipe Repetido · 3.ª vez','Rui Repetido · 3.ª vez','Rui Repetido · 2.ª vez'])&&/não haver 4\.ª\?$/.test(PG(T.semanaSeguinte)[0]),
  'antes do SQL dos repetidos: aviso, a data muda na mesma e a contagem fica pelas semanas':/falta correr o SQL «2026-10-25_reuniao_repetidos»/.test(T.semAdiam.aviso)&&T.semAdiam.frase==='1 de 6 compromissos cumpridos · 4 por cumprir, 1 repetido.'&&JSON.stringify(T.semAdiam.patch[2])==='{"prazo":"2026-10-27"}',
  'conduzir: um ponto de cada vez, 8 passos, relógios a zero':T.c1.n===8&&T.c1.on==='1'&&T.c1.titulo==='Compromissos da semana passada'&&T.c1.blocos===1&&!T.c1.form&&T.c1.antDis===true&&/^Próximo: Resultados contra o objetivo/.test(T.c1.prox)&&/^0:0\d \/ 20:00$/.test(T.c1.total)&&/^0:0\d \/ 2:00$/.test(T.c1.passoT),
  'relógio: conta o total e o ponto; o ponto fica vermelho quando passa do tempo':/^1:0[5-8] \/ 20:00$/.test(T.c1t.total)&&/^1:0[5-8] \/ 2:00$/.test(T.c1t.passoT)&&!T.c1t.overP&&/^2:0[5-8] \/ 2:00$/.test(T.c1over.passoT)&&T.c1over.overP&&!T.c1over.overT,
  'próximo ponto: relógio do ponto recomeça e há formulário de compromisso do ponto':T.c2.on==='2'&&T.c2.titulo==='Resultados contra o objetivo'&&/^0:0\d \/ 3:00$/.test(T.c2.passoT)&&/^2:\d\d \/ 20:00$/.test(T.c2.total)&&T.c2.form&&T.c2.formP==='resultados'&&T.c2.antDis===false,
  'dinâmica do equipamento vira compromisso da equipa com um clique':T.c6.titulo==='Equipamento: dinâmicas comerciais'&&T.usar==='Desafio até 27/10: cada vendedor vende 2 artigos de stock morto (comissão de 20%).'&&
    T.usarPost&&T.usarPost.ponto==='equip'&&T.usarPost.vendedor_id===null&&T.usarPost.texto===T.usar,
  'último ponto: compromissos da reunião, resumo e Terminar':T.c8.on==='8'&&T.c8.terminar&&!T.c8.prox&&F(T.c8fecho)[0]==='2 compromissos registados nesta reunião.'&&T.c8fecho.comp.length===2,
  'copiar resumo: vai para a área de transferência, com os compromissos e sem margens':/Resumo copiado/.test(T.copiar.toast)&&T.copiar.clip===T.copiar.txt&&/- Equipa: Desafio até 27\/10/.test(T.copiar.clip)&&/- Rui: Ligar à Cliente Teta/.test(T.copiar.clip)&&!/margem|730/i.test(T.copiar.clip),
  'terminar: diz quanto durou e passa a Retomar':/^Reunião terminada · \d+:\d\d$/.test(T.terminar.toast)&&T.terminar.modo==='prep'&&/^Terminada às 14:3\d · durou \d+:\d\d$/.test(nb(T.terminar.fim))&&T.terminar.btn==='Retomar a reunião',
  'guardado neste computador e retomar volta ao último ponto sem contar a pausa':T.reaberto.fim&&T.reaberto.btn==='Retomar a reunião'&&T.retomar.on==='8'&&/^2:[2-5]\d \/ 20:00$/.test(T.retomar.total),
  'ver preparação a meio: o relógio continua e o botão diz Continuar':T.sair.modo==='prep'&&T.sair.btn==='Continuar a reunião',
  'que reunião é esta: seg–qua a de terça (quarta para feriados), qui–dom a seguinte':JSON.stringify(T.dias)===JSON.stringify(['2026-10-20 desde 2026-10-13 15h','2026-10-20 desde 2026-10-13 15h','2026-10-20 desde 2026-10-13 15h','2026-10-27 desde 2026-10-20 15h','2026-10-27 desde 2026-10-20 15h']),
  'antes do SQL: aviso nos compromissos, sem formulário, o resto funciona':/falta correr o SQL «2026-10-25_reuniao_compromissos»/.test(T.semSql.comp.aviso)&&!T.semSql.form&&!T.semSql.comp.comp.length&&T.semSql.resultados==='Retail novas: 3 de 10 (30%) — faltam 7 em 11 dias.',
  'telemóvel: preparação e condução sem scroll lateral':T.tel.prep&&T.tel.stock&&T.tel.fecho,
  'acessibilidade (claro e escuro): axe sem violações e contraste medido certo, também no vermelho do relógio':[T.a11y.prepClaro,T.a11y.prepEscuro,T.a11yCond.claro,T.a11yCond.escuro].every(x=>!x.axe.length&&!x.contraste.length&&x.medidos>5),
  'sem erros JS; só a confirmação de apagar':!erros.length&&dialogos.length===1};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Reunião semanal correta');await b.close();srv.close();process.exit(f?1:0);})();
