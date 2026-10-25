// Ecrã "Hoje" do vendedor e Ficha de Margem solta (dados fictícios).
// 1) Registo rápido: nome + telemóvel + modelo + fase (Morno por omissão) → negócio no funil com o lembrete marcado.
// 2) Ações na linha "Para contactar hoje", sem abrir o negócio: Contactei (próximo contacto pela fase), Adiar (1 semana,
//    2 semanas, 1 mês) e Perdido (motivo num toque; a mota do stock volta a Disponível). Se o servidor recusar, a linha volta.
// 3) Ficha solta → "Guardar num negócio": criar negócio novo (Quente) ou juntar a um negócio em curso (funil ou Carteira),
//    com o mesmo nome primeiro; a ficha passa a ser do negócio e o rascunho deste computador é limpo.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8775;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const pad=n=>String(n).padStart(2,'0');
const loc=n=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const ha=h=>new Date(Date.now()-h*3600e3).toISOString();
const R=(id,o)=>Object.assign({id,vendedor_id:'v1',created_at:ha(24*30),updated_at:ha(24*3),status_updated_at:ha(24*10)},o);
const db={seq:900,patches:[],posts:[],rpc:[],falhar:null,fichas:[],
  recs:[R(3,{status:'Carteira',type:'MN',id_cliente:'Marta Silva',model:'R 1300 RT',mes1:loc(0).slice(0,7),mes1_validado:true,updated_at:ha(5)}),
    R(5,{status:'Quente',type:'MN',id_cliente:'Pedro Almeida',model:'R 1300 GS Adventure',contacto:'912 345 678',alert_date:loc(-4)}),
    R(6,{status:'Morno',type:'MU',id_cliente:'Carla Nunes',model:'R nineT',contacto:'913 222 111',alert_date:loc(-9),stock_id:77}),
    R(7,{status:'Morno',type:'MN',id_cliente:'Tiago Fernandes',model:'F 900 GS',alert_date:loc(-2)}),
    R(8,{status:'Frio',type:'MN',id_cliente:'Sofia Lopes',model:'CE 04',alert_date:loc(-20)}),
    R(12,{status:'Frio',type:'MN',id_cliente:'Pedro Gomes',model:'F 800 GS',alert_date:loc(10)}),
    R(13,{status:'Retail',type:'MN',id_cliente:'Pedro Almeida',model:'G 310 R',col_298:loc(-200)}),
    R(14,{status:'Perdido',type:'MN',id_cliente:'Hugo Reis',motivo_perda:'Concorrência'})]};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const erros=[];const R2={};
 const contexto=async(vp,quem)=>{quem=quem||'v1';const ctx=await b.newContext({viewport:vp});
  await ctx.addInitScript(t=>{localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));
    if(!sessionStorage.getItem('_fm')){sessionStorage.setItem('_fm','1');localStorage.setItem('bc_fm',JSON.stringify({natureza:'MN',iva:23,modo:'civa',fv:2,cliente:'Pedro Almeida',modelo:'R 1300 GS Adventure',preco_venda:'26500'}));}},jwt(quem));
  await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
   const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
   if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'x'});
   const t=(u.match(/rest\/v1\/(rpc\/)?([a-z_]+)/)||[])[2];const id=(u.match(/[?&]id=eq\.([^&]+)/)||[])[1];
   if(t==='profiles'){const P=[{id:'v1',nome:'Felipe Gomes',role:'vendedor',linha:'motorrad'},{id:'c1',nome:'Gonçalo Pinto',role:'admin',linha:'motorrad'}];return json(id?P.filter(x=>x.id===id):P);}
   if(t==='stock_mudar_estado'){db.rpc.push(JSON.parse(r.request().postData()));return json(null);}
   if(t==='baviera_control'){if(m==='GET')return json(db.recs);
     const body=JSON.parse(r.request().postData()||'{}');
     if(m==='POST'){const row=Object.assign({id:++db.seq,vendedor_id:quem,created_at:new Date().toISOString()},body);db.recs.push(row);db.posts.push(['baviera_control',body]);return json([row],201);}
     if(m==='PATCH'){db.patches.push([id,body]);if(db.falhar===id)return json({message:'erro de teste',code:'XX000'},500);
       const x=db.recs.find(y=>String(y.id)===String(id));if(!x)return json([]);Object.assign(x,body);if(body.status==='Perdido')x.recontactar_em=loc(182);return json([x]);}}
   if(t==='fichas_margem'){if(m==='POST'){const body=JSON.parse(r.request().postData());const row=Object.assign({id:++db.seq,estado:'ativa',criado_em:new Date().toISOString()},body);db.fichas.push(row);db.posts.push(['fichas_margem',body]);return json([row],201);}
     const neg=(u.match(/negocio_id=eq\.([^&]+)/)||[])[1];return json(neg?db.fichas.filter(f=>String(f.negocio_id)===String(neg)):db.fichas);}
   if(m!=='GET')return json([]);
   return json([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));p.on('dialog',d=>{erros.push('dialog: '+d.message());d.dismiss();});
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1600);
  return {ctx,p};};
 const {ctx,p}=await contexto({width:1440,height:1000});
 const hoje=async()=>{await p.evaluate(()=>{S.screen='list';S.statusFilter='_hoje';S.sidebarOpen=true;render();});await p.waitForTimeout(300);};
 const lista=()=>p.evaluate(()=>[...document.querySelectorAll('.vh-crow .vh-cnome b')].map(x=>x.textContent));
 const toastTxt=async()=>{await p.waitForTimeout(700);return p.evaluate(()=>((document.getElementById('bm-toast')||{}).textContent||'').trim());};
 const kpiFunil=()=>p.evaluate(()=>{const k=[...document.querySelectorAll('.vh-kpi')].find(x=>/Funil/i.test(x.textContent));return k?k.querySelector('.vh-v').textContent.trim():'';});
 await hoje();
 R2.inicio={lista:await lista(),funil:await kpiFunil(),resumo:await p.evaluate(()=>((document.querySelector('.vh-resumo')||{}).textContent||'').trim())};

 // ---------- 1) registo rápido
 await p.click('[data-action="vh-novo-registar"]');await p.waitForTimeout(300);
 R2.semNome={erro:await p.evaluate(()=>((document.querySelector('.vh-n-err')||{}).textContent||'')),posts:db.posts.length};
 await p.fill('#vh-novo-nome','Nuno Ferreira');await p.fill('#vh-novo-tel','911 111 111');
 await p.click('[data-action="vh-novo-fase"][data-f="Quente"]');await p.waitForTimeout(200);
 R2.preservado=await p.evaluate(()=>document.getElementById('vh-novo-nome').value);   // escolher a fase não apaga o que já se escreveu
 await p.fill('#vh-novo-mod','R 12 nineT');await p.press('#vh-novo-mod','Enter');
 R2.registoToast=await toastTxt();
 const post1=(db.posts.find(x=>x[0]==='baviera_control')||[])[1]||{};
 R2.registo={post:post1,campos:await p.evaluate(()=>['vh-novo-nome','vh-novo-tel','vh-novo-mod'].map(i=>document.getElementById(i).value)),
   fase:await p.evaluate(()=>(document.querySelector('.vh-n-chip.on')||{}).textContent),funil:await kpiFunil()};

 // ---------- 2) ações na linha
 await p.click('.vh-crow:has-text("Tiago Fernandes") [data-action="vh-contactei"]');R2.contacteiToast=await toastTxt();
 R2.contactei={patch:db.patches.slice(-1)[0],lista:await lista()};
 await p.click('.vh-crow:has-text("Sofia Lopes") [data-action="vh-acao"][data-t="adiar"]');await p.waitForTimeout(250);
 R2.painelAdiar=await p.evaluate(()=>[...document.querySelectorAll('.vh-painel .vh-pchip')].map(x=>x.textContent));
 await p.click('.vh-painel [data-action="vh-adiar"][data-dias="14"]');R2.adiarToast=await toastTxt();
 R2.adiar={patch:db.patches.slice(-1)[0],lista:await lista()};
 await p.click('.vh-crow:has-text("Carla Nunes") [data-action="vh-acao"][data-t="perdido"]');await p.waitForTimeout(250);
 R2.painelPerdido=await p.evaluate(()=>[...document.querySelectorAll('.vh-painel .vh-pchip')].map(x=>x.textContent));
 await p.click('.vh-painel [data-action="vh-perdido"][data-m="Preço"]');R2.perdidoToast=await toastTxt();await p.waitForTimeout(300);
 R2.perdido={patch:db.patches.slice(-1)[0],rpc:db.rpc.slice(-1)[0],lista:await lista(),
   perdidos:await p.evaluate(()=>String(statusCounts()['Perdido']||0))};
 // servidor recusa: a linha volta e aparece o erro
 db.falhar='5';await p.click('.vh-crow:has-text("Pedro Almeida") [data-action="vh-contactei"]');await p.waitForTimeout(300);
 R2.falha={toast:await toastTxt(),lista:await lista(),alerta:await p.evaluate(()=>S.records.find(x=>String(x.id)==='5').alert_date)};db.falhar=null;
 // teclado: Enter abre o painel; Esc fecha; voltar a carregar no mesmo botão também fecha
 await p.focus('.vh-crow:has-text("Pedro Almeida") [data-action="vh-acao"][data-t="adiar"]');await p.keyboard.press('Enter');await p.waitForTimeout(250);
 const abertoTecl=await p.evaluate(()=>!!document.querySelector('.vh-painel')&&document.querySelector('[data-action="vh-acao"][data-t="adiar"][aria-expanded="true"]')!=null);
 await p.keyboard.press('Escape');await p.waitForTimeout(250);const fechadoEsc=await p.evaluate(()=>!document.querySelector('.vh-painel'));
 await p.click('.vh-crow:has-text("Pedro Almeida") [data-action="vh-acao"][data-t="perdido"]');await p.waitForTimeout(150);
 await p.click('.vh-crow:has-text("Pedro Almeida") [data-action="vh-acao"][data-t="perdido"]');await p.waitForTimeout(250);
 R2.teclado={abertoTecl,fechadoEsc,toggle:await p.evaluate(()=>!document.querySelector('.vh-painel'))};
 await p.screenshot({path:path.join(__dirname,'vendedor_hoje.png')});

 // ---------- 3) ficha solta → negócio
 await p.click('.sidebar [data-action="go-ficha"]');await p.waitForTimeout(400);
 R2.fichaBotao=await p.evaluate(()=>!!document.querySelector('[data-action="fm-guardar-abrir"]'));
 await p.click('[data-action="fm-guardar-abrir"]');await p.waitForTimeout(300);
 const cand=()=>p.evaluate(()=>[...document.querySelectorAll('.fm-g-row')].map(r=>r.querySelector('b').textContent+(r.querySelector('em')?' *':'')+' ['+r.querySelector('.card-status').textContent+']'));
 R2.candidatos=await cand();
 R2.novoTxt=await p.evaluate(()=>(document.querySelector('.fm-g-d')||{}).textContent||'');
 await p.fill('#fm-assoc-q','marta');await p.waitForTimeout(300);R2.procura=await cand();
 R2.procuraFoco=await p.evaluate(()=>document.activeElement&&document.activeElement.id);
 await p.fill('#fm-assoc-q','');await p.waitForTimeout(300);
 await p.click('.fm-g-row:has-text("Pedro Almeida") [data-action="fm-associar"]');R2.juntarToast=await toastTxt();
 const postF=db.posts.filter(x=>x[0]==='fichas_margem').slice(-1)[0];
 R2.juntar={negocio:postF&&postF[1].negocio_id,cliente:postF&&postF[1].dados&&postF[1].dados.cliente,
   estado:await p.evaluate(()=>({neg:S.fmNeg,ficha:S.fmFicha!=null,barra:!!document.querySelector('.fm-negbar'),botao:!!document.querySelector('[data-action="fm-guardar-abrir"]'),rascunho:localStorage.getItem('bc_fm')}))};
 // voltar e fazer uma ficha nova para um cliente que ainda não existe
 await p.click('[data-action="fm-voltar"]');await p.waitForTimeout(300);
 R2.voltar=await p.evaluate(()=>S.screen);
 await p.click('.sidebar [data-action="go-ficha"]');await p.waitForTimeout(300);
 await p.click('[data-action="fm-guardar-abrir"]');await p.waitForTimeout(250);
 R2.semCliente=await p.evaluate(()=>({desativado:document.querySelector('[data-action="fm-guardar-novo"]').disabled,dica:(document.querySelector('.fm-g-d')||{}).textContent}));
 await p.fill('[data-fm="cliente"]','Rita Sousa');await p.press('[data-fm="cliente"]','Tab');await p.fill('[data-fm="modelo"]','F 900 XR');await p.press('[data-fm="modelo"]','Tab');await p.waitForTimeout(300);
 const nPosts=db.posts.length;
 await p.click('[data-action="fm-guardar-novo"]');R2.novoToast=await toastTxt();
 const novos=db.posts.slice(nPosts);
 R2.novo={neg:(novos.find(x=>x[0]==='baviera_control')||[])[1],ficha:(novos.find(x=>x[0]==='fichas_margem')||[])[1],
   estado:await p.evaluate(()=>({neg:S.fmNeg,barra:!!document.querySelector('.fm-negbar'),noFunil:S.records.some(r=>r.id_cliente==='Rita Sousa'&&r.status==='Quente')}))};
 // ---------- menu do vendedor: Vender · Clientes · O meu mês; Stock e Vendidos e perdidos com separadores
 await hoje();
 const menu=()=>p.evaluate(()=>[...document.querySelectorAll('.sidebar .vnav > *')].map(e=>e.classList.contains('vnav-sec')?'#'+e.textContent.trim():e.querySelector('.vnav-lb').textContent.trim()));
 R2.menu=await menu();
 const tabs=()=>p.evaluate(()=>[...document.querySelectorAll('.top-tabs .top-tab')].map(b=>b.querySelector('.t-longo').textContent+(b.classList.contains('on')?' *':'')));
 await p.click('.sidebar [data-action="go-vstock"]');await p.waitForTimeout(500);
 R2.stock1={ecra:await p.evaluate(()=>S.screen),tabs:await tabs(),titulo:await p.evaluate(()=>(document.querySelector('.hdr-title')||{}).textContent),menuOn:await p.evaluate(()=>(document.querySelector('.vnav-item.on .vnav-lb')||{}).textContent)};
 await p.click('.top-tabs [data-action="go-stock-vend"]');await p.waitForTimeout(600);
 R2.stock2={ecra:await p.evaluate(()=>S.screen),tabs:await tabs(),titulo:await p.evaluate(()=>(document.querySelector('.hdr-title')||{}).textContent)};
 await hoje();await p.click('.sidebar [data-action="go-vstock"]');await p.waitForTimeout(600);
 R2.stock3=await p.evaluate(()=>S.screen);   // abre no último que se usou
 await p.click('.sidebar .vnav-item:has-text("Vendidos e perdidos")');await p.waitForTimeout(400);
 R2.arq1={sf:await p.evaluate(()=>S.statusFilter),tabs:await p.evaluate(()=>[...document.querySelectorAll('.top-tabs .top-tab')].map(b=>(b.querySelector('.t-longo').textContent+' '+((b.querySelector('.sec-tab-n')||{}).textContent||'')).trim()+(b.classList.contains('on')?' *':''))),menuOn:await p.evaluate(()=>(document.querySelector('.vnav-item.on .vnav-lb')||{}).textContent)};
 await p.click('.top-tabs .top-tab:has-text("Perdidos")');await p.waitForTimeout(400);
 R2.arq2={sf:await p.evaluate(()=>S.statusFilter),menuOn:await p.evaluate(()=>(document.querySelector('.vnav-item.on .vnav-lb')||{}).textContent),tabs:await tabs()};
 await ctx.close();

 // ---------- 4) telemóvel: registo rápido recolhido, sem scroll lateral
 const t=await contexto({width:390,height:844});
 await t.p.evaluate(()=>{S.screen='list';S.statusFilter='_hoje';S.sidebarOpen=false;render();});await t.p.waitForTimeout(300);
 const recolhido=await t.p.evaluate(()=>!!document.querySelector('[data-action="vh-novo-abrir"]')&&!document.getElementById('vh-novo-nome'));
 await t.p.click('[data-action="vh-novo-abrir"]');await t.p.waitForTimeout(300);
 R2.tel={recolhido,abriu:await t.p.evaluate(()=>!!document.getElementById('vh-novo-nome')),
   largura:await t.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),
   acoes:await t.p.evaluate(()=>document.querySelectorAll('.vh-crow .vh-act').length),
   barra:await t.p.evaluate(()=>[...document.querySelectorAll('.vbn .vbn-i')].map(b=>b.textContent.replace(/\d+/g,'').trim()))};
 await t.ctx.close();
 // ---------- 5) chefe: Retail do mês contra o mês anterior (até ao mesmo dia), em motas
 {const h=new Date(),ymA=`${h.getFullYear()}-${pad(h.getMonth()+1)}`,pd=new Date(h.getFullYear(),h.getMonth()-1,1),ymP=`${pd.getFullYear()}-${pad(pd.getMonth()+1)}`;
  const ultP=new Date(pd.getFullYear(),pd.getMonth()+1,0).getDate(),dd=h.getDate();
  db.recs.push(R(30,{status:'Retail',type:'MN',id_cliente:'Cliente R1',col_298:ymA+'-01'}),R(31,{status:'Retail',type:'MN',id_cliente:'Cliente R2',col_298:loc(0)}),
    R(32,{status:'Retail',type:'MN',id_cliente:'Cliente R3',col_298:ymP+'-01'}),R(33,{status:'Retail',type:'MU',id_cliente:'Cliente R4',col_298:ymP+'-01'}));
  if(dd<ultP)db.recs.push(R(34,{status:'Retail',type:'MN',id_cliente:'Cliente R5 (depois do dia)',col_298:ymP+'-'+pad(dd+1)}));}
 // ---------- 6) chefe na ficha solta: escolhe o vendedor do negócio novo
 const c=await contexto({width:1440,height:1000},'c1');
 await c.p.evaluate(()=>{S.fm=fmParaCiva(fmMigra({natureza:'MU',iva:23,modo:'civa',fv:2,cliente:'Luís Matos',modelo:'R 1250 GS'}));setState({screen:'ficha'});});await c.p.waitForTimeout(400);
 await c.p.click('[data-action="fm-guardar-abrir"]');await c.p.waitForTimeout(250);
 const nC=db.posts.length;
 await c.p.click('[data-action="fm-guardar-novo"]');await c.p.waitForTimeout(400);
 const semVend={posts:db.posts.length-nC,toast:await c.p.evaluate(()=>((document.getElementById('bm-toast')||{}).textContent||''))};
 await c.p.selectOption('#fm-g-vend','v1');await c.p.click('[data-action="fm-guardar-novo"]');await c.p.waitForTimeout(800);
 await c.p.evaluate(()=>{S.screen='dashboard';S.gppSec='home';render();});await c.p.waitForTimeout(500);
 const deltas=await c.p.evaluate(()=>[...document.querySelectorAll('.gpp-table .gpp-delta')].map(x=>x.textContent.replace(/\s+/g,' ').trim()));
 const nota=await c.p.evaluate(()=>((document.querySelector('.gpp-delta-nota')||{}).textContent||'').trim());
 R2.chefe={semVend,deltas,nota,neg:(db.posts.slice(nC).find(x=>x[0]==='baviera_control')||[])[1],registoRapido:await c.p.evaluate(()=>{S.screen='list';S.statusFilter='_hoje';render();return !!document.getElementById('vh-novo-nome');})};
 await c.ctx.close();
 R2.erros=erros;console.log(JSON.stringify(R2,null,1));
 const ok={
  'início: só os atrasados do funil na lista':JSON.stringify(R2.inicio.lista.slice().sort())===JSON.stringify(['Carla Nunes','Pedro Almeida','Sofia Lopes','Tiago Fernandes'])&&R2.inicio.funil==='5',
  'registo rápido: sem nome não grava e diz porquê':/Escreve o nome do cliente/.test(R2.semNome.erro)&&R2.semNome.posts===0,
  'registo rápido: escolher a fase não apaga o que já se escreveu':R2.preservado==='Nuno Ferreira',
  'registo rápido: Enter grava no funil com o lembrete pela fase':R2.registo.post.status==='Quente'&&R2.registo.post.id_cliente==='Nuno Ferreira'&&R2.registo.post.contacto==='911 111 111'&&R2.registo.post.model==='R 12 nineT'&&R2.registo.post.alert_date===loc(3)&&R2.registo.post.resp==='Felipe Gomes'&&!!R2.registo.post.status_updated_at,
  'registo rápido: limpa os campos, mantém a fase e conta no funil':JSON.stringify(R2.registo.campos)==='["","",""]'&&R2.registo.fase==='Quente'&&R2.registo.funil==='6'&&/Nuno Ferreira registado em Quente/.test(R2.registoToast),
  'Contactei: próximo contacto pela fase (Morno = 7 dias) e sai da lista':R2.contactei.patch[0]==='7'&&R2.contactei.patch[1].alert_date===loc(7)&&Object.keys(R2.contactei.patch[1]).length===1&&!R2.contactei.lista.includes('Tiago Fernandes')&&/próximo a/.test(R2.contacteiToast),
  'Adiar: 1 semana / 2 semanas / 1 mês':JSON.stringify(R2.painelAdiar)==='["1 semana","2 semanas","1 mês"]'&&R2.adiar.patch[0]==='8'&&R2.adiar.patch[1].alert_date===loc(14)&&!R2.adiar.lista.includes('Sofia Lopes'),
  'Perdido: motivo num toque, mota volta ao stock':R2.painelPerdido.length===8&&R2.perdido.patch[0]==='6'&&R2.perdido.patch[1].status==='Perdido'&&R2.perdido.patch[1].motivo_perda==='Preço'&&!!R2.perdido.patch[1].status_updated_at&&
    R2.perdido.rpc&&R2.perdido.rpc.p_id===77&&R2.perdido.rpc.p_estado==='Disponível'&&!R2.perdido.lista.includes('Carla Nunes')&&R2.perdido.perdidos==='2'&&/re-contactar daqui a 6 meses/.test(R2.perdidoToast),
  'servidor recusa: a linha volta e aparece o erro':R2.falha.lista.includes('Pedro Almeida')&&R2.falha.alerta===loc(-4)&&/Não gravei/.test(R2.falha.toast),
  'teclado: Enter abre, Esc fecha, o mesmo botão alterna':R2.teclado.abertoTecl&&R2.teclado.fechadoEsc&&R2.teclado.toggle,
  'ficha solta: candidatos do funil e Carteira, com o mesmo nome primeiro (só nome completo conta)':R2.fichaBotao&&R2.candidatos[0]==='Pedro Almeida * [Quente]'&&R2.candidatos.includes('Pedro Gomes [Frio]')&&R2.candidatos.includes('Marta Silva [Carteira]')&&
    !R2.candidatos.some(c=>/Retail|Perdido|Hugo|Carla/.test(c))&&/Cria Pedro Almeida no funil como Quente/.test(R2.novoTxt),
  'ficha solta: procurar pelo nome (sem perder o foco)':JSON.stringify(R2.procura)==='["Marta Silva [Carteira]"]'&&R2.procuraFoco==='fm-assoc-q',
  'juntar a um negócio em curso: a ficha passa a ser desse negócio e o rascunho sai do computador':R2.juntar.negocio===5&&R2.juntar.cliente==='Pedro Almeida'&&R2.juntar.estado.neg==='5'&&R2.juntar.estado.ficha&&R2.juntar.estado.barra&&!R2.juntar.estado.botao&&R2.juntar.estado.rascunho===null&&/Ficha junta ao negócio de Pedro Almeida/.test(R2.juntarToast),
  'voltar depois de juntar leva à lista':R2.voltar==='list',
  'sem cliente na ficha: não deixa criar e diz o que falta':R2.semCliente.desativado&&/Escreve primeiro o nome do cliente/.test(R2.semCliente.dica),
  'criar negócio novo: Quente com o lembrete, e a ficha fica ligada':R2.novo.neg&&R2.novo.neg.status==='Quente'&&R2.novo.neg.id_cliente==='Rita Sousa'&&R2.novo.neg.type==='MN'&&R2.novo.neg.model==='F 900 XR'&&R2.novo.neg.alert_date===loc(3)&&R2.novo.neg.resp==='Felipe Gomes'&&
    R2.novo.ficha&&R2.novo.ficha.dados.cliente==='Rita Sousa'&&String(R2.novo.estado.neg)===String(R2.novo.ficha.negocio_id)&&R2.novo.estado.barra&&R2.novo.estado.noFunil&&/Negócio de Rita Sousa criado em Quente/.test(R2.novoToast),
  'telemóvel: registo recolhido num botão, abre, sem scroll lateral':R2.tel.recolhido&&R2.tel.abriu&&R2.tel.largura&&R2.tel.acoes>0,
  'menu do vendedor: Vender · Clientes · O meu mês, sem Notificações, Retail e Perdidos soltos':JSON.stringify(R2.menu)===JSON.stringify(['Hoje','#Vender','Funil','Carteira','Ficha de margem','Stock','#Clientes','EOTs','Vendidos e perdidos','#O meu mês','Comissões','Escala']),
  'Stock: abre em Novas BMW, separadores, título único e lembra o último':R2.stock1.ecra==='vencomendas'&&JSON.stringify(R2.stock1.tabs)==='["Novas BMW *","Usadas e demos","Equipamento"]'&&R2.stock1.titulo==='Stock'&&R2.stock1.menuOn==='Stock'&&
    R2.stock2.ecra==='stockvend'&&JSON.stringify(R2.stock2.tabs)==='["Novas BMW","Usadas e demos *","Equipamento"]'&&R2.stock2.titulo==='Stock'&&R2.stock3==='stockvend',
  'Vendidos e perdidos: um item, separadores Retail e Perdidos com as contagens':R2.arq1.sf==='Retail'&&R2.arq1.menuOn==='Vendidos e perdidos'&&R2.arq1.tabs[0]==='Retail 1 *'&&/^Perdidos \d+$/.test(R2.arq1.tabs[1])&&R2.arq2.sf==='Perdido'&&R2.arq2.menuOn==='Vendidos e perdidos'&&R2.arq2.tabs[1]==='Perdidos *',
  'telemóvel: barra de baixo igual (Hoje · Funil · Carteira · EOTs · Mais)':JSON.stringify(R2.tel.barra)==='["Hoje","Funil","Carteira","EOTs","Mais"]',
  'Hoje: frase-resumo com os mesmos números':R2.inicio.resumo==='Hoje: 4 clientes para contactar.',
  'chefe: Retail contra o mês anterior até ao mesmo dia, em motas':JSON.stringify(R2.chefe.deltas.map(x=>x.split(' vs ')[0]))==='["+1","−1","="]'&&/^Retail: diferença em motas para [a-z]{3}\.( até ao dia \d+)?$/.test(R2.chefe.nota),
  'chefe: tem de escolher o vendedor; o negócio fica em nome dele':R2.chefe.semVend.posts===0&&/Escolhe o vendedor/.test(R2.chefe.semVend.toast)&&R2.chefe.neg&&R2.chefe.neg.vendedor_id==='v1'&&R2.chefe.neg.resp==='Felipe Gomes'&&R2.chefe.neg.type==='MU'&&R2.chefe.neg.id_cliente==='Luís Matos'&&!R2.chefe.registoRapido,
  'sem erros JS nem alertas':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Hoje do vendedor e ficha solta corretos');await b.close();srv.close();process.exit(f?1:0);})();
