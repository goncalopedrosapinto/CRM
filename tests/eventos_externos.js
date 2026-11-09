// Eventos: perfil externo «eventos» (só os eventos a que o chefe dá acesso), ficha de inscrição completa (cliente e pendura,
// camisola, mota que leva), documentos só com autorização escrita, Excel, e o chefe a gerir acessos e a mudar quem registou.
// Dados fictícios.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const XLSX=require('xlsx');
const RAIZ=path.resolve(__dirname,'..');const FILE=path.resolve(process.argv[2]||path.join(RAIZ,'index.html'));
const PORTA=8785;
const XLSX_JS=fs.readFileSync(path.join(__dirname,'node_modules/xlsx/dist/xlsx.full.min.js'));
const srv=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=u==='/'||u==='/index.html'?FILE:path.join(RAIZ,u.replace(/^\/+/,''));
  if(!f.startsWith(RAIZ)||!fs.existsSync(f)){s.writeHead(404);return s.end('');}s.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});s.end(fs.readFileSync(f));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'},
  e1:{id:'e1',nome:'Clube Externo',role:'eventos',linha:'auto'},p1:{id:'p1',nome:'Conta Nova',role:'pendente',linha:'auto'}};
const VAZIA={data_nascimento:null,nif:null,camisola:null,pendura:false,pendura_nome:null,pendura_data_nascimento:null,pendura_nif:null,pendura_telefone:null,pendura_camisola:null,mota_origem:null,mota_modelo:null,docs:[],docs_consentimento:false};
const est={eventos:[{id:1,nome:'Passeio Serra da Estrela',data:'2026-11-20',local:'Aveiro',ativo:true,motas:[],lotacao:null},{id:2,nome:'Test ride R 1300',data:'2026-12-05',ativo:false,motas:[],lotacao:null}],
  insc:[Object.assign({id:11,evento_id:1,cliente:'Cliente Do Vendedor',telefone:'912000001',vendedor_id:'v1',estado:'Confirmado',funil:'Quente',obs:'Quer ver a R 1300 GS',acompanhantes:0,mota:null,created_at:'2026-11-01T10:00:00Z'},VAZIA),
        Object.assign({id:12,evento_id:2,cliente:'Cliente Outro Evento',telefone:'912000002',vendedor_id:'v1',estado:'Confirmado',funil:'Frio',obs:null,acompanhantes:0,mota:null,created_at:'2026-11-02T10:00:00Z'},VAZIA)],
  acessos:[{evento_id:1,user_id:'e1',criado_em:'2026-11-09T10:00:00Z'}],docs:{},pedidos:[],escritas:[],rpc:[]};
let nextId=100;
const temAcesso=(quem,ev)=>est.acessos.some(a=>a.user_id===quem&&a.evento_id===ev);
const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  if(u.includes('cdnjs.cloudflare.com/ajax/libs/xlsx'))return r.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:XLSX_JS});
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const role=PERFIS[quem].role;
  if(u.includes('/storage/v1/object/')){const k=u.split(/evento-documentos\//)[1]||'';est.pedidos.push(quem+' storage '+m+' '+k);
    if(m==='POST'){est.docs[k]=r.request().postDataBuffer();return json({Key:k});}
    if(m==='DELETE'){delete est.docs[k];return json({});}
    return est.docs[k]?r.fulfill({status:200,contentType:'application/pdf',body:est.docs[k]}):json({message:'not found'},404);}
  const rpc=(u.match(/rest\/v1\/rpc\/([a-z_]+)/)||[])[1];
  if(rpc){const body=JSON.parse(r.request().postData()||'{}');est.rpc.push([quem,rpc,body]);
    if(rpc==='evento_registos')return json(role==='admin'||temAcesso(quem,body.p_evento)?[...new Set(est.insc.filter(i=>i.evento_id===body.p_evento).map(i=>i.vendedor_id))].map(id=>({id,nome:PERFIS[id].nome})):[]);
    if(rpc==='perfil_eventos'){if(role!=='admin')return json({code:'42501',message:'Sem permissão'},403);PERFIS[body.p_user].role=body.p_ativo?'eventos':'pendente';if(!body.p_ativo)est.acessos=est.acessos.filter(a=>a.user_id!==body.p_user);return json(PERFIS[body.p_user].role);}
    return json([]);}
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];if(t)est.pedidos.push(quem+' '+m+' '+t);
  const id=+(u.match(/[?&]id=eq\.(\d+)/)||[])[1];
  if(t==='profiles'){if(role==='eventos'||role==='pendente')return json([PERFIS[quem]]);return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem&&(role==='admin'||p.linha==='motorrad'))));}
  if(t==='eventos')return json(role==='eventos'?est.eventos.filter(e=>temAcesso(quem,e.id)):(role==='pendente'?[]:est.eventos));
  if(t==='evento_acessos'){if(role!=='admin')return json(est.acessos.filter(a=>a.user_id===quem));
    if(m==='GET')return json(est.acessos);const b=m==='POST'?JSON.parse(r.request().postData()):null;est.escritas.push(['acessos',m,b||u.split('?')[1]]);
    if(m==='POST'){est.acessos.push(Object.assign({criado_em:new Date().toISOString()},b));return json([b],201);}
    if(m==='DELETE'){const ev=+(u.match(/evento_id=eq\.(\d+)/)||[])[1],us=(u.match(/user_id=eq\.([^&]+)/)||[])[1];est.acessos=est.acessos.filter(a=>!(a.evento_id===ev&&a.user_id===us));return json([]);}}
  if(t==='inscricoes'){
    const vis=i=>role==='admin'||(role==='eventos'?temAcesso(quem,i.evento_id):(role==='vendedor'&&i.vendedor_id===quem));
    if(m==='GET')return json(est.insc.filter(vis));
    const b=m==='DELETE'?null:JSON.parse(r.request().postData());est.escritas.push([quem,m,id||null,b]);
    if(m==='POST'){if(role==='eventos'&&!temAcesso(quem,b.evento_id))return json({code:'42501',message:'new row violates row-level security policy'},403);
      const n=Object.assign({},VAZIA,{id:++nextId,vendedor_id:quem,estado:'Confirmado',acompanhantes:0,created_at:new Date().toISOString()},b);est.insc.push(n);return json([n],201);}
    const i=est.insc.find(x=>x.id===id);if(!i||!vis(i))return json([]);
    if(m==='PATCH'){if(b.vendedor_id&&b.vendedor_id!==i.vendedor_id&&role!=='admin')return json({code:'42501',message:'Sem permissão: só o chefe muda quem registou a inscrição'},403);Object.assign(i,b);return json([i]);}
    if(m==='DELETE'){est.insc=est.insc.filter(x=>x!==i);return json([]);}}
  if(t==='inscricoes_publico')return json(role==='admin'||role==='vendedor'?est.insc.map(i=>({id:i.id,evento_id:i.evento_id,cliente:i.cliente,mota:i.mota,vendedor_id:i.vendedor_id,estado:i.estado,funil:i.funil,acompanhantes:i.acompanhantes})):[]);
  return json([]);};
const nb=s=>String(s||'').replace(/[\s  ]+/g,' ').trim();
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const erros=[];
 const abrir=async(quem,vp)=>{const ctx=await b.newContext({viewport:vp||{width:1280,height:1000},acceptDownloads:true});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 const txt=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);return e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';},sel);
 const fill=async(p,k,v)=>{await p.fill('#if-'+k,v);};
 // ---------- externo ----------
 const E=await abrir('e1');const p=E.p;
 const ecra=await p.evaluate(()=>S.screen);const inicio={titulo:await txt(p,'.hdr-title'),nav:await p.evaluate(()=>document.querySelectorAll('[data-action="gpp-sec"],.gpp-nav-item').length),
   picker:await p.evaluate(()=>document.querySelectorAll('[data-action="evento-sel-ext"]').length),lista:await txt(p,'.ev-list'),cab:await txt(p,'.ev-head-card')};
 await p.click('[data-action="insc-ficha-nova"]');await p.waitForTimeout(200);
 const fichaNova=await p.evaluate(()=>({aberta:!!document.getElementById('if-box'),funil:!!document.getElementById('if-funil'),acomp:!!document.getElementById('if-acompanhantes'),quem:!!document.getElementById('if-vendedor_id'),
   docs:document.querySelector('#if-box').textContent.includes('Grava a inscrição para juntar')}));
 await fill(p,'cliente','Ana Ficticia Santos');await fill(p,'data_nascimento','1990-05-04');await fill(p,'nif','12345678');await fill(p,'telefone','913 000 111');
 await p.selectOption('#if-camisola','M');await p.check('#if-box [data-if="pendura"]');await p.waitForTimeout(150);
 const temPendura=await p.evaluate(()=>!!document.getElementById('if-pendura_nome')&&document.getElementById('if-cliente').value==='Ana Ficticia Santos'&&document.getElementById('if-camisola').value==='M');
 await p.click('[data-action="insc-ficha-gravar"]');await p.waitForTimeout(200);
 const erros1=await p.evaluate(()=>[...document.querySelectorAll('#if-box .eotn-msg')].map(x=>x.textContent));const nPost1=est.escritas.length;
 await fill(p,'nif','123456789');await fill(p,'pendura_nome','Rui Ficticio');await fill(p,'pendura_data_nascimento','1988-02-10');await fill(p,'pendura_nif','987654321');await fill(p,'pendura_telefone','914 000 222');
 await p.selectOption('#if-pendura_camisola','L');await p.selectOption('#if-mota_origem','Própria');await fill(p,'mota_modelo','R 1250 GS');await fill(p,'obs','Chega na véspera');
 await p.click('[data-action="insc-ficha-gravar"]');await p.waitForTimeout(500);
 const post=est.escritas.find(x=>x[0]==='e1'&&x[1]==='POST');const nova=est.insc.find(i=>i.cliente==='Ana Ficticia Santos');
 const depois=await p.evaluate(()=>({msg:(document.querySelector('#if-box .if-ok')||{}).textContent||'',up:[...document.querySelectorAll('#if-box [data-if-doc]')].map(x=>x.disabled),cons:!!document.querySelector('#if-box [data-if-cons]')}));
 // documentos: só com a autorização
 await p.check('#if-box [data-if-cons]');await p.waitForTimeout(400);
 const consGravado=!!(nova&&nova.docs_consentimento);
 const ups=await p.evaluate(()=>[...document.querySelectorAll('#if-box [data-if-doc]')].map(x=>x.dataset.ifDoc+':'+(x.disabled?'off':'on')));
 const pdf=Buffer.from('%PDF-1.4\n% ficticio\n');
 await p.setInputFiles('#if-box [data-if-doc="cc|cliente"]',{name:'cc-ana.pdf',mimeType:'application/pdf',buffer:pdf});await p.waitForTimeout(600);
 const docGuardado=nova&&nova.docs.slice();const caminho=docGuardado&&docGuardado[0]&&docGuardado[0].caminho;
 await p.setInputFiles('#if-box [data-if-doc="carta|cliente"]',{name:'nota.txt',mimeType:'text/plain',buffer:Buffer.from('x')});await p.waitForTimeout(300);
 const docsDepois=await p.evaluate(()=>({txt:document.querySelector('#if-box .if-docs').textContent.replace(/\s+/g,' '),consDis:document.querySelector('#if-box [data-if-cons]').disabled}));
 const [pop]=await Promise.all([p.context().waitForEvent('page',{timeout:8000}),p.click('#if-box [data-action="insc-doc-abrir"]')]);await p.waitForTimeout(500);const popUrl=pop.url();await pop.close().catch(()=>{});
 await p.click('[data-action="insc-ficha-fechar"]');await p.waitForTimeout(150);
 // ficha de uma inscrição do vendedor: completa sem funil e sem mudar quem registou
 await p.click('[data-action="insc-ficha"][data-id="11"]');await p.waitForTimeout(200);
 const fichaVend=await p.evaluate(()=>({nome:document.getElementById('if-cliente').value,funil:!!document.getElementById('if-funil'),obs:document.getElementById('if-obs').value}));
 await p.selectOption('#if-camisola','XL');await p.click('[data-action="insc-ficha-gravar"]');await p.waitForTimeout(400);
 const patch11=est.escritas.filter(x=>x[0]==='e1'&&x[1]==='PATCH'&&x[2]===11).pop();
 await p.click('[data-action="insc-ficha-fechar"]');await p.waitForTimeout(150);
 const listaFim=await txt(p,'.ev-list');
 await p.screenshot({path:path.join(__dirname,'eventos_externos.png'),fullPage:false});
 // Excel
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.click('[data-action="insc-xlsx"]')]);const xf=path.join(__dirname,'eventos_externos_teste.xlsx');await dl.saveAs(xf);
 const wb=XLSX.readFile(xf);const aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false});try{fs.unlinkSync(xf);}catch(e){}
 const cab=aoa[0]||[];const linhaAna=aoa.find(r=>r[0]==='Ana Ficticia Santos')||[];const col=n=>linhaAna[cab.indexOf(n)];
 const pedidosE=est.pedidos.filter(x=>x.startsWith('e1 ')).map(x=>x.split(' ').pop());
 await E.ctx.close();
 // telemóvel
 const T=await abrir('e1',{width:390,height:844});await T.p.click('[data-action="insc-ficha"][data-id="11"]');await T.p.waitForTimeout(200);
 const larg=await T.p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);await T.p.screenshot({path:path.join(__dirname,'eventos_externos_telemovel.png'),fullPage:false});await T.ctx.close();
 // ---------- vendedor ----------
 const V=await abrir('v1');await V.p.evaluate(()=>setState({screen:'evento'}));await V.p.waitForTimeout(400);
 await V.p.click('[data-action="insc-ficha-nova"]');await V.p.waitForTimeout(200);
 const vend=await V.p.evaluate(()=>({funil:!!document.getElementById('if-funil'),acomp:!!document.getElementById('if-acompanhantes'),quem:!!document.getElementById('if-vendedor_id'),botoes:document.querySelectorAll('[data-action="insc-ficha"]').length,
   resumo:(document.querySelector('.if-res')||{}).textContent||''}));
 await V.ctx.close();
 // ---------- chefe ----------
 const C=await abrir('c1');await C.p.evaluate(()=>{const x=document.createElement('button');x.dataset.action='gpp-sec';x.dataset.s='evento';document.getElementById('app').appendChild(x);x.click();x.remove();});await C.p.waitForTimeout(700);
 const ch1=await C.p.evaluate(()=>({acc:(document.querySelector('.evx-acc')||{}).textContent||'',chk:(document.querySelector('[data-evt-acesso="e1"]')||{}).checked,csv:!!document.querySelector('[data-action="export-inscricoes"]'),xlsx:!!document.querySelector('[data-action="insc-xlsx"]'),
   quem:[...document.querySelectorAll('.evx-quem')].map(s=>s.options[s.selectedIndex].textContent)}));
 await C.p.uncheck('[data-evt-acesso="e1"]');await C.p.waitForTimeout(400);const semAcesso=!est.acessos.some(a=>a.user_id==='e1'&&a.evento_id===1);
 await C.p.check('[data-evt-acesso="e1"]');await C.p.waitForTimeout(400);const comAcesso=est.acessos.some(a=>a.user_id==='e1'&&a.evento_id===1);
 await C.p.click('[data-action="evt-perfil"][data-uid="p1"]');await C.p.waitForTimeout(500);const rpcPerfil=est.rpc.find(x=>x[1]==='perfil_eventos');
 const ch2=await C.p.evaluate(()=>!!document.querySelector('[data-evt-acesso="p1"]'));
 await C.p.selectOption('.evx-quem >> nth=0','v1').catch(()=>{});
 const ana=est.insc.find(i=>i.cliente==='Ana Ficticia Santos');
 await C.p.selectOption(`[data-insc-id="${ana.id}"][data-insc-f="vendedor_id"]`,'v1');await C.p.waitForTimeout(400);
 const reatrib=est.escritas.filter(x=>x[0]==='c1'&&x[1]==='PATCH'&&x[2]===ana.id).pop();
 await C.p.click(`[data-action="insc-ficha"][data-id="${ana.id}"]`);await C.p.waitForTimeout(200);
 const fichaChefe=await C.p.evaluate(()=>({quem:!!document.getElementById('if-vendedor_id'),docs:document.querySelectorAll('#if-box .if-doc').length}));
 await C.p.screenshot({path:path.join(__dirname,'eventos_externos_chefe.png'),fullPage:false});
 await C.ctx.close();
 const R={ecra,inicio,fichaNova,temPendura,erros1,nPost1,post,depois,consGravado,ups,docGuardado,docsDepois,popUrl,fichaVend,patch11,listaFim,cab,linhaAna,pedidosE:[...new Set(pedidosE)],vend,ch1,semAcesso,comAcesso,rpcPerfil,ch2,reatrib,fichaChefe,larg,erros};
 console.log(JSON.stringify(R,null,1));
 const ok={
  'externo entra direto no ecrã de eventos, sem o resto da plataforma':ecra==='eventosext'&&/Eventos/.test(inicio.titulo)&&inicio.nav===0,
  'externo só vê o evento a que tem acesso (e as inscrições dele, também dos vendedores)':inicio.picker===0&&/Passeio Serra da Estrela/.test(inicio.cab)&&/Cliente Do Vendedor/.test(inicio.lista)&&/Vendedor/.test(inicio.lista)&&!/Cliente Outro Evento/.test(inicio.lista),
  'ficha nova do externo: sem funil, sem acompanhantes, sem «registado por»; documentos só depois de gravar':fichaNova.aberta&&!fichaNova.funil&&!fichaNova.acomp&&!fichaNova.quem&&fichaNova.docs,
  'pendura abre os campos sem perder o que se escreveu':temPendura,
  'valida NIF (9 algarismos) e nome do pendura antes de gravar':erros1.includes('O NIF tem 9 algarismos')&&erros1.includes('Falta o nome do pendura')&&nPost1===0,
  'grava a ficha completa (cliente, pendura, camisolas, mota, observações) em nome do externo':!!post&&post[3].evento_id===1&&post[3].cliente==='Ana Ficticia Santos'&&post[3].data_nascimento==='1990-05-04'&&post[3].nif==='123456789'&&post[3].telefone==='913 000 111'&&post[3].camisola==='M'&&
    post[3].pendura===true&&post[3].pendura_nome==='Rui Ficticio'&&post[3].pendura_nif==='987654321'&&post[3].pendura_camisola==='L'&&post[3].pendura_data_nascimento==='1988-02-10'&&post[3].mota_origem==='Própria'&&post[3].mota_modelo==='R 1250 GS'&&post[3].obs==='Chega na véspera'&&
    !('vendedor_id' in post[3])&&!('funil' in post[3])&&!('acompanhantes' in post[3]),
  'depois de gravar: fica aberta para os documentos, que esperam pela autorização':/Já podes juntar os documentos/.test(depois.msg)&&depois.cons&&depois.up.length===4&&depois.up.every(x=>x===true),
  'autorização grava logo e liberta os documentos (cliente e pendura)':consGravado&&ups.length===4&&ups.every(x=>/:on$/.test(x)),
  'documento vai para a pasta evento/inscrição e fica na ficha':!!caminho&&new RegExp('^1/'+(nova&&nova.id)+'/cc-cliente-[a-z0-9]+\\.pdf$').test(caminho)&&docGuardado[0].nome==='cc-ana.pdf'&&!!est.docs[caminho],
  'ficheiro que não é foto nem PDF é recusado; com documentos a autorização não se tira':(nova.docs||[]).length===1&&/✓ cc-ana\.pdf/.test(docsDepois.txt)&&docsDepois.consDis,
  'abre o documento num separador':/^blob:/.test(popUrl),
  'externo completa a ficha do vendedor sem ver o funil e sem mudar quem registou':fichaVend.nome==='Cliente Do Vendedor'&&!fichaVend.funil&&fichaVend.obs==='Quer ver a R 1300 GS'&&!!patch11&&patch11[3].camisola==='XL'&&!('vendedor_id' in patch11[3])&&!('funil' in patch11[3])&&est.insc.find(i=>i.id===11).funil==='Quente',
  'lista mostra o resumo da ficha':/NIF 123456789/.test(listaFim)&&/pendura: Rui Ficticio/.test(listaFim)&&/leva mota própria · R 1250 GS/.test(listaFim)&&/1 documento/.test(listaFim),
  'Excel com tudo (sem funil), NIF como texto':cab.includes('Nome completo')&&cab.includes('Pendura: NIF')&&cab.includes('Mota que leva')&&!cab.includes('Funil')&&col('NIF')==='123456789'&&col('Pendura: nome completo')==='Rui Ficticio'&&col('Camisola')==='M'&&col('Data de nascimento')==='04/05/1990'&&
    col('Registado por')==='Clube Externo'&&/Cartão de cidadão \(cliente\)/.test(col('Documentos na plataforma')||'')&&col('Autorização da cópia')==='Sim',
  'externo não pede stock, margens, comissões nem EOTs':!pedidosE.some(t=>['stock_usadas','stock_usadas_publico','margens','comissoes','eot_contratos','configuracoes','escala','stock_norma'].includes(t)),
  'telemóvel sem scroll de lado':larg,
  'vendedor: a mesma ficha, com funil e acompanhantes, e botão Ficha nas suas inscrições':vend.funil&&vend.acomp&&!vend.quem&&vend.botoes>=1,
  'chefe: cartão de acesso externo com o evento marcado; Excel em vez de CSV':/Acesso externo/.test(ch1.acc)&&/Clube Externo/.test(ch1.acc)&&ch1.chk===true&&!ch1.csv&&ch1.xlsx&&/Conta Nova/.test(ch1.acc),
  'chefe tira e volta a dar acesso ao evento':semAcesso&&comAcesso,
  'chefe dá o perfil Eventos a uma conta nova':!!rpcPerfil&&rpcPerfil[2].p_user==='p1'&&rpcPerfil[2].p_ativo===true&&ch2,
  'chefe muda quem registou':!!reatrib&&reatrib[3].vendedor_id==='v1'&&ana.vendedor_id==='v1'&&fichaChefe.quem,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Eventos externos corretos');await b.close();srv.close();process.exit(f?1:0);})();
