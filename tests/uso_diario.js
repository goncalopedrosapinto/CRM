// Uso diário (nov/2026): pesquisa por telemóvel e matrícula sem hífenes, WhatsApp ao lado do telefone, Home do chefe com
// uma só faixa «A tratar (N)» e os números primeiro, barra inferior e menu «Menos usadas», formulário com bloco Essencial,
// Ctrl+P na pesquisa, letra mínima de 11px, avisos na página (sem janelas do browser) com «Anular», um só nome e
// vermelho só para o que está atrasado. Dados fictícios.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const RAIZ=path.resolve(__dirname,'..');const FILE=path.resolve(process.argv[2]||path.join(RAIZ,'index.html'));
const PORTA=8787;
const srv=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=u==='/'||u==='/index.html'?FILE:path.join(RAIZ,u.replace(/^\/+/,''));
  if(!f.startsWith(RAIZ)||!fs.existsSync(f)){s.writeHead(404);return s.end('');}s.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':(f.endsWith('.json')?'application/json':'application/octet-stream')});s.end(fs.readFileSync(f));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}};
const h=new Date();const iso=d=>d.toISOString().slice(0,10);const dias=n=>{const x=new Date(h);x.setDate(x.getDate()+n);return iso(x);};
const ym=`${h.getFullYear()}/${String(h.getMonth()+1).padStart(2,'0')}`;const ymAnt=(()=>{const x=new Date(h.getFullYear(),h.getMonth()-2,1);return `${x.getFullYear()}/${String(x.getMonth()+1).padStart(2,'0')}`;})();
const COLS={sinal:null,sinal_forma:null,retoma_ano:null,retoma_kms:null,retoma_cor:null,retoma_data_matricula:null,retoma_valor:null,retoma_valor_comercio:null,data_nascimento:null,decl_circ:null};
const R=(id,st,extra)=>Object.assign({id,vendedor_id:'v1',status:st,type:'MN',id_cliente:'Cliente '+id,model:'R 1300 GS',version:'',neg:dias(-20),mes1:ym,pvp:21000,enc:'90000'+id,chas:'CH'+id,biz:'B'+id,updated_at:new Date().toISOString(),status_updated_at:dias(-1)+'T10:00:00Z',alert_date:dias(5)},COLS,extra||{});
const base=()=>[R(1,'Quente',{id_cliente:'Ana Telefone',contacto:'912 345 678',nif:'123456789',email:'ana@exemplo.pt',alert_date:dias(-1)}),R(2,'Morno',{id_cliente:'Bruno Fixo',contacto:'234 111 222'}),
  R(3,'Carteira',{id_cliente:'Carla Matricula',type:'MU',mat:'AA-11-BB',contacto:'+351 913 000 111',stock_id:31}),R(4,'Retail',{id_cliente:'Duarte Retail',col_298:null,mat:'CC-22-DD'})];
const est={recs:base(),stock:[{id:31,modelo:'F 900 R',matricula:'AA-11-BB',categoria:'usada',estado:'Disponível',data_rececao:dias(-30),valor_entrada:7000,valor_anunciado:8500,created_at:new Date().toISOString(),updated_at:new Date().toISOString()},
  {id:32,modelo:'C 400 X',matricula:'EE-33-FF',categoria:'usada',estado:'Disponível',data_rececao:dias(-10),valor_entrada:4000,valor_anunciado:5500,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],apagados:[],escritas:[]};
const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control'){if(m==='GET')return json(quem==='c1'?est.recs:est.recs.filter(x=>x.vendedor_id===quem));
    const b=JSON.parse(r.request().postData()||'{}');est.escritas.push([m,b]);if(m==='POST'){const n=Object.assign({id:900+est.escritas.length,vendedor_id:quem},COLS,b);est.recs.push(n);return json([n],201);}return json([b]);}
  if(t==='stock_usadas'||t==='stock_usadas_publico'){if(m==='DELETE'){const id=+(u.match(/id=eq\.(\d+)/)||[])[1];est.apagados.push(id);est.stock=est.stock.filter(x=>x.id!==id);return json([]);}return json(est.stock);}
  return json([]);};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const erros=[],dialogos=[];
 const abrir=async(quem,vp)=>{const ctx=await b.newContext({viewport:vp||{width:1366,height:900}});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));p.on('dialog',d=>{dialogos.push(d.message());d.dismiss().catch(()=>{});});
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 const sec=async(p,s)=>{await p.evaluate(s=>{const x=document.createElement('button');x.dataset.action='gpp-sec';x.dataset.s=s;document.getElementById('app').appendChild(x);x.click();x.remove();},s);await p.waitForTimeout(500);};
 const txt=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);return e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';},sel);
 const letraMin=p=>p.evaluate(()=>{let min=99,onde='';const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(!n.textContent.trim())continue;const e=n.parentElement;if(!e||e.closest('svg'))continue;const r=e.getClientRects();if(!r.length)continue;
   const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')continue;const px=parseFloat(cs.fontSize);if(px<min){min=px;onde=(e.className||e.tagName)+': '+n.textContent.trim().slice(0,30);}}return {min,onde};});
 const busca=async(p,q)=>{await p.fill('#gpp-search',q);await p.waitForTimeout(350);return p.evaluate(()=>[...document.querySelectorAll('tr.gpp-lrow')].map(tr=>tr.cells[0].textContent.trim()));};
 // ---------- chefe, computador ----------
 const C=await abrir('c1');const p=C.p;const T={};
 T.nome={titulo:await p.title(),apple:await p.evaluate(()=>document.querySelector('meta[name="apple-mobile-web-app-title"]').content),menu:await txt(p,'.gpp-nav-nome'),manifesto:JSON.parse(fs.readFileSync(path.join(RAIZ,'manifest.json'),'utf8'))};
 // Home: faixa fechada, números à vista
 T.home=await p.evaluate(()=>{const ht=document.querySelector('.ht'),tab=document.querySelector('.main-panel table');return {faixa:!!ht,aberta:!!document.querySelector('.ht-b'),n:(document.querySelector('.ht-n')||{}).textContent,res:(document.querySelector('.ht-res')||{}).textContent,
   alertasFora:document.querySelectorAll('.content>.gpp-alerta,.main-panel>.gpp-alerta').length,faixaAntesTabela:!!(ht&&tab&&(ht.compareDocumentPosition(tab)&Node.DOCUMENT_POSITION_FOLLOWING)),topoTabela:tab?Math.round(tab.getBoundingClientRect().top):null,
   corN:getComputedStyle(document.querySelector('.ht-n')).color,badgeNav:(document.querySelector('.gpp-nav-item[data-s="atratar"] .gpp-nav-badge')||{}).className};});
 await p.click('[data-action="home-tratar"]');await p.waitForTimeout(250);
 T.homeAberta=await p.evaluate(()=>({aberta:!!document.querySelector('.ht-b'),sem298:/Retail sem data 298/.test((document.querySelector('.ht-b')||{}).textContent||''),ir:!!document.querySelector('.ht-b [data-s="atratar"]')}));
 await p.click('[data-action="home-tratar"]');await p.waitForTimeout(150);
 T.letraChefe=await letraMin(p);
 // menu «Menos usadas»
 T.menu=await p.evaluate(()=>({grupos:[...document.querySelectorAll('.gpp-nav-grupo')].map(x=>x.textContent.replace(/[▸▾\s]+$/,'').trim()),leadsVisivel:!!(document.querySelector('.gpp-nav-item[data-s="leads"]')||{}).offsetParent,
   exp:document.querySelector('.gpp-nav-menos-h').getAttribute('aria-expanded')}));
 await p.click('[data-action="nav-menos"]');await p.waitForTimeout(200);
 T.menuAberto=await p.evaluate(()=>({itens:[...document.querySelectorAll('.gpp-nav-menos .gpp-nav-item')].map(x=>x.dataset.s),visivel:!!document.querySelector('.gpp-nav-item[data-s="leads"]').offsetParent,guardado:localStorage.getItem('bm_nav_menos')}));
 await p.click('[data-action="nav-menos"]');await p.waitForTimeout(150);
 // Ctrl+P
 await p.keyboard.press('Control+p');await p.waitForTimeout(150);T.ctrlP=await p.evaluate(()=>document.activeElement&&document.activeElement.id);
 // pesquisa
 T.b1=await busca(p,'912345678');T.b2=await busca(p,'+351 912 345 678');T.b3=await busca(p,'913000');T.b4=await busca(p,'aa11bb');T.b5=await busca(p,'AA-11');T.b6=await busca(p,'bruno');T.b7=await busca(p,'999999999');
 await p.fill('#gpp-search','912345678');await p.waitForTimeout(350);T.colTel=await p.evaluate(()=>[...document.querySelectorAll('.main-panel th')].map(x=>x.textContent.trim()));T.colTelVal=await p.evaluate(()=>{const tr=document.querySelector('tr.gpp-lrow');return tr?tr.cells[1].textContent.trim():'';});
 await p.fill('#gpp-search','');await p.waitForTimeout(300);
 // WhatsApp no negócio
 const det=async id=>{await p.evaluate(id=>setState({screen:'detail',selected:S.records.find(r=>r.id===id),openGroups:{INFO:true,'Identificação':true}}),id);await p.waitForTimeout(250);
   return p.evaluate(()=>({wa:[...document.querySelectorAll('a.wa-btn')].map(a=>a.getAttribute('href')+'|'+a.target+'|'+a.rel),tel:[...document.querySelectorAll('a.eot-tel')].map(a=>a.getAttribute('href')),faixa:!!document.querySelector('.neg-contacto')}));};
 T.wa1=await det(1);T.wa2=await det(2);T.wa3=await det(3);
 // formulário: Essencial + grupos fechados
 await p.evaluate(()=>{const r=S.records.find(x=>x.id===1);setState({selected:r,form:recordToForm(r),screen:'edit',error:'',openGroups:{INFO:true}});});await p.waitForTimeout(300);
 const form=()=>p.evaluate(()=>{const ess=document.querySelector('.neg-ess');const ks=[...document.querySelectorAll('[data-field]')].map(e=>e.dataset.field);
   return {ess:ess?[...ess.querySelectorAll('[data-field]')].map(e=>e.dataset.field):null,dup:ks.filter((k,i)=>ks.indexOf(k)!==i),grupos:[...document.querySelectorAll('.section:not(.neg-ess) .section-title')].map(x=>x.textContent.trim()),
     abertos:document.querySelectorAll('.section:not(.neg-ess) .section-body').length,tel:(document.querySelector('[data-field="contacto"]')||{}).value};});
 T.f1=await form();
 await p.selectOption('.neg-ess [data-field="retoma"]','Sim');await p.waitForTimeout(250);T.f2=await form();
 await p.fill('[data-field="retoma_modelo"]','Honda NC750X');await p.fill('[data-field="sinal"]','500');
 await p.click('[data-action="toggle-section"][data-group="Identificação"]');await p.waitForTimeout(200);T.f3=await form();
 T.f3.modeloRetoma=await p.evaluate(()=>document.querySelector('[data-field="retoma_modelo"]').value);
 await p.screenshot({path:path.join(__dirname,'uso_diario_form.png')});
 // negócio novo (rápido): os mesmos dados essenciais
 await p.evaluate(()=>{S.fmRascunho=null;S.formCompleto=false;setState({encNovoVend:null,selected:null,form:emptyForm(),screen:'edit',error:'',openGroups:{INFO:true}});});await p.waitForTimeout(250);
 T.novo=await p.evaluate(()=>[...document.querySelectorAll('.qf [data-field]')].map(e=>e.dataset.field));
 await p.selectOption('.qf [data-field="retoma"]','Sim');await p.waitForTimeout(250);T.novoRetoma=await p.evaluate(()=>[...document.querySelectorAll('.qf [data-field]')].map(e=>e.dataset.field).filter(k=>/^retoma_/.test(k)));
 await p.evaluate(()=>setState({screen:'dashboard',selected:null,form:null}));await p.waitForTimeout(200);
 // avisos na página
 await p.evaluate(()=>avisoErro('Erro de teste\nsegunda linha'));await p.waitForTimeout(150);
 T.aviso=await p.evaluate(()=>{const t=document.getElementById('bm-toast');return {role:t.getAttribute('role'),cls:t.className,txt:t.querySelector('.bm-toast-m').innerHTML,x:!!t.querySelector('.bm-toast-x')};});
 await p.click('.bm-toast-x');await p.waitForTimeout(150);T.avisoFechado=await p.evaluate(()=>!document.getElementById('bm-toast').classList.contains('show'));
 const pc=p.evaluate(()=>confirmar('Pergunta de teste?',{ok:'Sim'}));await p.waitForTimeout(150);
 T.conf=await p.evaluate(()=>({role:document.getElementById('cf-box').getAttribute('role'),msg:document.getElementById('cf-msg').textContent,foco:document.activeElement.id,ok:document.getElementById('cf-ok').textContent}));
 await p.keyboard.press('Escape');T.confEsc=await pc;
 const pc2=p.evaluate(()=>confirmar('Outra?'));await p.waitForTimeout(100);await p.click('#cf-ok');T.confOk=await pc2;T.confSome=await p.evaluate(()=>!document.getElementById('cf-bd'));
 // apagar com Anular (mota do stock)
 await sec(p,'stock');await p.waitForTimeout(500);await p.evaluate(()=>{ANULAR_MS=900;});
 const nStock=()=>p.evaluate(()=>document.querySelectorAll('[data-action="stock-del"]').length);
 T.s0=await nStock();await p.click('[data-action="stock-del"][data-id="32"]');await p.waitForTimeout(200);
 T.s1={n:await nStock(),apagados:est.apagados.slice(),toast:await txt(p,'#bm-toast'),botao:await txt(p,'.bm-toast-b')};
 await p.click('.bm-toast-b');await p.waitForTimeout(1500);T.s2={n:await nStock(),apagados:est.apagados.slice()};
 await p.click('[data-action="stock-del"][data-id="32"]');await p.waitForTimeout(1700);T.s3={n:await nStock(),apagados:est.apagados.slice()};
 await C.ctx.close();
 // ---------- chefe com atraso: vermelho ----------
 est.recs=base().concat([R(5,'Carteira',{id_cliente:'Elsa Atrasada',mes1:ymAnt})]);
 const C2=await abrir('c1');T.atraso=await C2.p.evaluate(()=>({corN:getComputedStyle(document.querySelector('.ht-n')).color,res:document.querySelector('.ht-res').textContent,badge:(document.querySelector('.gpp-nav-item[data-s="atratar"] .gpp-nav-badge')||{}).className}));
 await C2.p.screenshot({path:path.join(__dirname,'uso_diario.png')});await C2.ctx.close();est.recs=base();
 // ---------- chefe, telemóvel ----------
 const M=await abrir('c1',{width:390,height:844});
 T.barra=await M.p.evaluate(()=>({tabs:[...document.querySelectorAll('.gpp-tabbar .gpp-tab')].map(x=>x.dataset.s||x.dataset.action),badgeHome:(document.querySelector('.gpp-tab[data-s="home"] .gpp-tab-badge')||{}).className||'',
   larg:document.documentElement.scrollWidth<=window.innerWidth+1}));
 T.letraTel=await letraMin(M.p);await M.p.screenshot({path:path.join(__dirname,'uso_diario_telemovel.png')});
 await M.p.click('[data-action="gpp-mais"]');await M.p.waitForTimeout(300);T.sheet=await M.p.evaluate(()=>[...document.querySelectorAll('.gpp-sheet-grupo')].map(x=>x.textContent.trim()));
 await M.ctx.close();
 // ---------- vendedor ----------
 const V=await abrir('v1');T.letraVend=await letraMin(V.p);
 T.vend=await V.p.evaluate(()=>({wa:[...document.querySelectorAll('a.wa-btn')].length,badge:(document.querySelector('.vnav-badge')||{}).className||''}));
 await V.p.evaluate(()=>setState({statusFilter:'all',screen:'list'}));await V.p.waitForTimeout(300);
 const si=await V.p.$('#f-search');if(si){await V.p.fill('#f-search','913000111');await V.p.waitForTimeout(700);T.vendBusca=await V.p.evaluate(()=>[...document.querySelectorAll('.vcard,.card')].map(c=>c.textContent.replace(/\s+/g,' ').trim().slice(0,40)));}
 await V.ctx.close();
 console.log(JSON.stringify(Object.assign(T,{erros,dialogos}),null,1));
 const ESS=['status','alert_date','id_cliente','contacto','nif','email','type','model','version','origin','pvp','fin','retoma','sinal','sinal_forma'];
 const ok={
  'um só nome: Bimby Motorrad no título, no ícone do iPhone, no menu e no manifesto':T.nome.titulo==='Bimby Motorrad'&&T.nome.apple==='Bimby Motorrad'&&T.nome.menu==='Bimby Motorrad'&&T.nome.manifesto.name==='Bimby Motorrad'&&T.nome.manifesto.short_name==='Bimby Motorrad',
  'Home: uma só faixa «A tratar (N)» fechada, com os números logo a seguir':T.home.faixa&&!T.home.aberta&&Number(T.home.n)>=1&&/Retail sem 298/.test(T.home.res||'')&&T.home.alertasFora===0&&T.home.faixaAntesTabela&&T.home.topoTabela<420,
  'Home: a faixa abre com os avisos e leva a «A tratar»':T.homeAberta.aberta&&T.homeAberta.sem298&&T.homeAberta.ir,
  'cores: sem nada atrasado o contador é âmbar; com uma entrega em atraso passa a vermelho e diz «em atraso»':/hoje/.test(T.home.badgeNav||'')&&!/alert/.test(T.home.badgeNav||'')&&T.home.corN!==T.atraso.corN&&/alert/.test(T.atraso.badge||'')&&/1 em atraso/.test(T.atraso.res||''),
  'menu: Leads, Escala e Exportar em «Menos usadas», fechado; abre e fica guardado':T.menu.grupos.join('|')==='Diário|Negócio|Recursos|Ferramentas|Menos usadas'&&!T.menu.leadsVisivel&&T.menu.exp==='false'&&T.menuAberto.itens.join(',')==='leads,escala,exportar'&&T.menuAberto.visivel&&T.menuAberto.guardado==='1',
  'Ctrl+P põe o cursor na pesquisa':T.ctrlP==='gpp-search',
  'pesquisa por telemóvel (com espaços, +351 ou só parte) e matrícula sem hífenes':T.b1.join()==='Ana Telefone'&&T.b2.join()==='Ana Telefone'&&T.b3.join()==='Carla Matricula'&&T.b4.join()==='Carla Matricula'&&T.b5.join()==='Carla Matricula'&&T.b6.join()==='Bruno Fixo'&&T.b7.length===0,
  'resultados mostram o telemóvel':T.colTel.includes('Telemóvel')&&T.colTelVal==='912 345 678',
  'WhatsApp ao lado do telemóvel (abre a conversa, sem texto); fixo não tem':T.wa1.faixa&&T.wa1.wa.every(x=>x==='https://wa.me/351912345678|_blank|noopener noreferrer')&&T.wa1.wa.length>=1&&T.wa1.tel[0]==='tel:912345678'&&T.wa2.wa.length===0&&T.wa3.wa[0].startsWith('https://wa.me/351913000111|'),
  'formulário: bloco Essencial com os dados combinados; grupos fechados; nenhum campo repetido':!!T.f1.ess&&ESS.every(k=>T.f1.ess.includes(k))&&T.f1.dup.length===0&&T.f1.abertos===0&&!T.f1.grupos.includes('INFO')&&T.f1.grupos.includes('Identificação')&&T.f1.tel==='912 345 678',
  'formulário: Retoma = Sim abre os dados da retoma no Essencial; abrir um grupo não perde o que se escreveu':['retoma_modelo','retoma_mat','retoma_ano','retoma_kms','retoma_cor','retoma_data_matricula','retoma_valor','retoma_valor_comercio'].every(k=>T.f2.ess.includes(k))&&T.f3.abertos===1&&T.f3.dup.length===0&&T.f3.modeloRetoma==='Honda NC750X',
  'negócio novo: NIF, e-mail, PVP, financiamento, retoma e sinal logo no registo':['id_cliente','contacto','model','origin','pvp','fin','nif','email','retoma','sinal','sinal_forma'].every(k=>T.novo.includes(k))&&T.novoRetoma.length===8,
  'letra mínima de 11px (chefe, telemóvel e vendedor)':T.letraChefe.min>=11&&T.letraTel.min>=11&&T.letraVend.min>=11,
  'erros num aviso na página (fica até fechar), sem janelas do browser':T.aviso.role==='alert'&&/erro/.test(T.aviso.cls)&&T.aviso.txt==='Erro de teste<br>segunda linha'&&T.aviso.x&&T.avisoFechado&&dialogos.length===0,
  'perguntas na página: Esc cancela, o botão confirma':T.conf.role==='alertdialog'&&T.conf.msg==='Pergunta de teste?'&&T.conf.foco==='cf-ok'&&T.conf.ok==='Sim'&&T.confEsc===false&&T.confOk===true&&T.confSome,
  'apagar com «Anular»: some logo, não apaga na base de dados; Anular repõe; sem Anular apaga':T.s0===2&&T.s1.n===1&&T.s1.apagados.length===0&&/Mota apagada do stock/.test(T.s1.toast)&&T.s1.botao==='Anular'&&T.s2.n===2&&T.s2.apagados.length===0&&T.s3.n===1&&T.s3.apagados.join()==='32',
  'barra inferior: Home, Vendas, Usadas, Funil, Mais; contador na Home':T.barra.tabs.join(',')==='home,vendas,usadas,funil,gpp-mais'&&/gpp-tab-badge/.test(T.barra.badgeHome)&&T.barra.larg&&T.sheet.includes('Menos usadas'),
  'vendedor: WhatsApp no «Hoje», contador vermelho com contacto em atraso, pesquisa por telemóvel':T.vend.wa>=1&&/vnav-badge/.test(T.vend.badge)&&!/ am/.test(T.vend.badge)&&!!T.vendBusca&&T.vendBusca.length===1&&/Carla/.test(T.vendBusca[0]),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Uso diário correto');await b.close();srv.close();process.exit(f?1:0);})();
