// EOTs criadas à mão (não vieram no mapa do banco), só pelo chefe. Dados fictícios.
// - «＋ Contrato à mão» abre o formulário na página (sem janela); nº, cliente e data de fim obrigatórios;
// - o mesmo nº escrito de outra forma (espaços, zero à esquerda) não cria outro: avisa e abre o que existe;
// - números à portuguesa, matrícula em maiúsculas, responsável; o que se escreve sobrevive a redesenhar; Enter cria;
// - depois de criar abre a ficha (marca «à mão», quem criou, Apagar só nestes); lista, contagem e filtro mostram-no;
// - o vendedor vê-o na sua lista e não tem o botão; apagar só apaga criados à mão;
// - importar um mapa sem ele não o dá como saído; quando vem no mapa junta-se e passa a ser do banco;
// - sem o SQL novo diz o que falta e não perde o que se escreveu.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8780;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const IMP='2026-10-06T10:39:10Z';
const C=(contrato,o)=>Object.assign({contrato,tipo:'Leasing',cliente:'Cliente '+contrato,telemovel:null,data_fim:'2027-01-10',prazo:48,prestacao:150,matricula:'AA-00-AA',modelo:'R 1250 GS',
  residual:5000,total:5600,concessionario:'Caetano Baviera Aveiro',conc_resp:'Caetano Baviera Aveiro',no_mapa:true,ultima_import:IMP,fase:'Por contactar',responsavel_id:'v1',origem:'mapa'},o);
const CAB=['Concessionário','Vendedor','Tipo','Contrato','Cliente','Contacto','Telefone','Telemóvel','Data Fim','Prazo','Prestação','Kms Contratados','Matrícula','Marca','Modelo','Seguro','Manutenção','Manutenção','Valor Residual a Refinanciar','Despesas Finais','Valor Total a Pagar','Concessionário Responsável'];
const L=o=>{const x=Object.assign({conc:'Caetano Baviera Aveiro',vend:'Vendedor X',tipo:'Leasing',cliente:'',contacto:null,tel:null,tlm:null,fim:'10/01/2027',prazo:48,prest:150,kms:'40000',mat:'AA-00-AA',marca:'BMW Motorrad',modelo:'R 1250 GS',seg:null,m1:null,m2:null,resid:5000,desp:0,total:5600,resp:'Caetano Baviera Aveiro'},o);
  return [x.conc,x.vend,x.tipo,x.ct,x.cliente,x.contacto,x.tel,x.tlm,x.fim,x.prazo,x.prest,x.kms,x.mat,x.marca,x.modelo,x.seg,x.m1,x.m2,x.resid,x.desp,x.total,x.resp];};
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'},v2:{id:'v2',nome:'Vendedor Dois',role:'vendedor',linha:'motorrad'}};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const est={eot:[C('100001',{cliente:'Cliente Um'}),C('100002',{cliente:'Cliente Dois',responsavel_id:null}),C('100009',{cliente:'Cliente Antigo',no_mapa:false,saiu_em:IMP})],
   posts:[],upserts:[],deletes:[],semSql:false};
 const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='eot_contratos'&&m==='POST'&&u.includes('on_conflict')){const lote=JSON.parse(r.request().postData());est.upserts.push(...lote);
    for(const l of lote){const e=est.eot.find(x=>x.contrato===l.contrato);if(e){Object.assign(e,l);if(l.ultima_import)e.origem='mapa';}else est.eot.push(Object.assign({fase:'Por contactar',origem:'mapa'},l));} // o trigger passa-o a "do mapa"
    return r.fulfill({status:201,body:''});}
  if(t==='eot_contratos'&&m==='POST'){const body=JSON.parse(r.request().postData());est.posts.push(body);
    if(est.semSql)return json({code:'PGRST204',message:"Could not find the 'origem' column of 'eot_contratos' in the schema cache"},400);
    if(est.eot.some(x=>x.contrato===body.contrato))return json({code:'23505',message:'duplicate key value violates unique constraint "eot_contratos_pkey"'},409);
    const row=Object.assign({criado_em:new Date().toISOString(),criado_por:quem,ultima_import:null},body);est.eot.push(row);return json([row],201);}
  if(t==='eot_contratos'&&m==='PATCH'){const body=JSON.parse(r.request().postData());const ids=((u.match(/contrato=in\.\(([^)]*)\)/)||[])[1]||'').split(',').map(x=>x.replace(/"/g,''));
    const um=(u.match(/contrato=eq\.([^&]+)/)||[])[1];const alvo=est.eot.filter(x=>ids.includes(x.contrato)||x.contrato===um);alvo.forEach(x=>Object.assign(x,body));return json(alvo);}
  if(t==='eot_contratos'&&m==='DELETE'){est.deletes.push(u.slice(u.indexOf('/rest/')));const c=(u.match(/contrato=eq\.([^&]+)/)||[])[1];const so=/origem=eq\.manual/.test(u);
    est.eot=est.eot.filter(x=>!(x.contrato===c&&(!so||x.origem==='manual')));return r.fulfill({status:204,body:''});}
  if(t==='eot_contratos')return json(quem==='c1'?est.eot:est.eot.filter(x=>x.responsavel_id===quem));
  if(t==='profiles')return json(quem==='c1'?[PERFIS.c1,PERFIS.v1,PERFIS.v2]:[PERFIS[quem],PERFIS.c1,PERFIS.v1,PERFIS.v2].filter((x,i,a)=>a.indexOf(x)===i));
  return json([]);};
 const abrir=async(quem,vp)=>{const ctx=await b.newContext({viewport:vp||{width:1400,height:1000}});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p._dlg=[];await ligarAvisos(p,p._dlg);p.on('pageerror',e=>erros.push(quem+': '+e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1600);return {ctx,p};};
 const erros=[];const tx=s=>String(s||'').replace(/[\s  ]+/g,' ').trim();
 const C1=await abrir('c1');const p=C1.p;
 const eots=async()=>{await p.evaluate(()=>{S.eotAberto=null;S.screen='dashboard';S.gppSec='eots';render();});await p.waitForTimeout(250);};
 const form=()=>p.evaluate(()=>{const f=document.querySelector('.eotn');const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   return {existe:!!f,erros:[...document.querySelectorAll('.eotn .eotn-err')].map(e=>e.querySelector('input').dataset.eotn),msgs:[...document.querySelectorAll('.eotn-msg')].map(t),
     dup:t(document.querySelector('.eotn-dup')),erro:t(document.querySelector('.eotn .error')),foco:document.activeElement&&document.activeElement.id,
     invalid:[...document.querySelectorAll('.eotn [aria-invalid="true"]')].length};});
 const escrever=async(k,v)=>{await p.fill('#eotn-'+k,v);};
 await eots();
 const botao=await p.$eval('[data-action="eot-novo"]',x=>x.textContent.trim()).catch(()=>'');
 await p.click('[data-action="eot-novo"]');await p.waitForTimeout(200);const F0=await form();
 await p.screenshot({path:path.join(__dirname,'eot_manual_form.png')});
 // vazio: diz o que falta, não grava
 await p.click('[data-action="eot-novo-criar"]');await p.waitForTimeout(250);const F1=await form();const posts1=est.posts.length;
 // o mesmo nº escrito de outra forma
 await escrever('contrato',' 0100 001 ');await escrever('cliente','Cliente Repetido');await escrever('data_fim','2027-03-31');
 await p.click('[data-action="eot-novo-criar"]');await p.waitForTimeout(250);const F2=await form();const posts2=est.posts.length;
 await p.click('.eotn-dup [data-action="eot-abrir"]');await p.waitForTimeout(300);const abriuDup=await p.evaluate(()=>S.eotAberto);
 await p.evaluate(()=>eotFechar(true));await p.waitForTimeout(200);const F2b=await form();
 // dados válidos; o que se escreve sobrevive a redesenhar; Enter cria
 await escrever('contrato','555 123');await escrever('cliente','  Cliente À Mão ');await escrever('telemovel','912 345 678');await escrever('modelo','R 1300 GS');
 await escrever('matricula','aa-11-bb');await escrever('residual','4 500,50');await escrever('prestacao','120');
 await p.selectOption('#eotn-responsavel_id','v2');await escrever('notas','Veio de outro concessionário');
 await p.evaluate(()=>render());await p.waitForTimeout(150);
 const aposRender=await p.evaluate(()=>['contrato','cliente','residual','responsavel_id','notas'].map(k=>(document.getElementById('eotn-'+k)||{}).value));
 await p.press('#eotn-telemovel','Enter');await p.waitForTimeout(600);
 const post=est.posts[est.posts.length-1]||{};
 const ficha=await p.evaluate(()=>{const m=document.querySelector('.eotm');const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   return {aberto:S.eotAberto,sub:t(m&&m.querySelector('.eotm-sub')),nota:t(m&&m.querySelector('.eotm-man')),apagar:!!(m&&m.querySelector('[data-action="eot-apagar"]')),msg:S.eotMsg,form:!!S.eotNovo};});
 await p.screenshot({path:path.join(__dirname,'eot_manual_ficha.png')});
 await p.evaluate(()=>eotFechar(true));await eots();
 const lista=await p.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';const linha=document.querySelector('tr[data-c="555123"]');
   return {linha:t(linha),tag:!!(linha&&linha.querySelector('.eot-man')),kpi:t(document.querySelector('.lc-cards .mg-card')),filtro:t(document.querySelector('select[data-eot-filtro="saiu"] option')),
     outrasTag:[...document.querySelectorAll('tr.eot-click .eot-man')].length};});
 await p.screenshot({path:path.join(__dirname,'eot_manual_lista.png')});
 // a ficha de um contrato do mapa não tem Apagar
 await p.evaluate(()=>eotAbrir('100001'));await p.waitForTimeout(250);const apagarMapa=await p.$('.eotm [data-action="eot-apagar"]').then(Boolean);await p.evaluate(()=>eotFechar(true));
 // vendedor: vê o contrato atribuído com a marca, sem botão de criar
 const V2=await abrir('v2',{width:390,height:844});
 await V2.p.evaluate(()=>setState({screen:'veot'}));await V2.p.waitForTimeout(300);
 const vend=await V2.p.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';const c=document.querySelector('[data-c="555123"]');return {card:t(c),tag:!!(c&&c.querySelector('.eot-man')),botao:!!document.querySelector('[data-action="eot-novo"]')};});
 await V2.ctx.close();
 // outro criado à mão, por engano: apagar
 await eots();await p.click('[data-action="eot-novo"]');await p.waitForTimeout(150);
 await escrever('contrato','777001');await escrever('cliente','Por engano');await escrever('data_fim','2027-05-01');await p.click('[data-action="eot-novo-criar"]');await p.waitForTimeout(500);
 const dlg0=p._dlg.length;await p.click('.eotm [data-action="eot-apagar"]');await p.waitForTimeout(700);
 const apagado={dlg:p._dlg.slice(dlg0).join(' | '),del:est.deletes.slice(-1)[0]||'',existe:est.eot.some(x=>x.contrato==='777001'),aberto:await p.evaluate(()=>S.eotAberto)};
 // importar um mapa sem o criado à mão: não sai
 const importar=async rows=>{await p.evaluate(async rows=>{window.XLSX={read:()=>({SheetNames:['f'],Sheets:{f:{}}}),utils:{sheet_to_json:()=>rows}};
   await loadEot();S.screen='dashboard';S.gppSec='eots';render();await eotFicheiro({name:'mapa.xlsx',arrayBuffer:async()=>new ArrayBuffer(8)});},rows);await p.waitForTimeout(400);};
 await importar([['Mapa'],[],CAB,L({ct:'100001',cliente:'Cliente Um'})]);
 const impA=await p.evaluate(()=>({saem:S.eotPrev.saem.map(x=>x.contrato),adot:(S.eotPrev.adotados||[]).length,txt:document.querySelector('.eot-prev').textContent.replace(/[\s  ]+/g,' ')}));
 await p.click('[data-action="eot-cancelar"]');await p.waitForTimeout(200);
 // vem no mapa (mesmo nº): junta-se e passa a ser do banco
 await importar([['Mapa'],[],CAB,L({ct:'100001',cliente:'Cliente Um'}),L({ct:'100002',cliente:'Cliente Dois'}),L({ct:'555123',cliente:'Cliente À Mão (banco)',resid:4400,mat:'AA-11-BB',fim:'31/03/2027'})]);
 const impB=await p.evaluate(()=>({saem:S.eotPrev.saem.map(x=>x.contrato),adot:(S.eotPrev.adotados||[]).map(x=>x.contrato),novos:S.eotPrev.novos.map(x=>x.contrato),txt:document.querySelector('.eot-prev').textContent.replace(/[\s  ]+/g,' ')}));
 await p.click('[data-action="eot-confirmar"]');await p.waitForTimeout(900);
 const depois=await p.evaluate(()=>{const x=S.eot.find(y=>y.contrato==='555123')||{};const linha=document.querySelector('tr[data-c="555123"]');
   return {origem:x.origem,resp:x.responsavel_id,notas:x.notas,residual:x.residual,tag:!!(linha&&linha.querySelector('.eot-man')),kpi:document.querySelector('.lc-cards .mg-card').textContent.replace(/[\s  ]+/g,' ').trim()};});
 const up=est.upserts.find(x=>x.contrato==='555123')||{};
 // sem o SQL novo
 est.semSql=true;await eots();await p.click('[data-action="eot-novo"]');await p.waitForTimeout(150);
 await escrever('contrato','888001');await escrever('cliente','Sem SQL');await escrever('data_fim','2027-06-01');await p.click('[data-action="eot-novo-criar"]');await p.waitForTimeout(500);
 const semSql=await p.evaluate(()=>({erro:(document.querySelector('.eotn .error')||{}).textContent||'',valor:(document.getElementById('eotn-cliente')||{}).value,existe:S.eot.some(x=>x.contrato==='888001')}));
 await C1.ctx.close();
 const R={botao,F0,F1,posts1,F2,posts2,abriuDup,F2b,aposRender,post,ficha,lista,apagarMapa,vend,apagado,impA,impB,depois,up,semSql,dialogos:p._dlg,erros};
 console.log(JSON.stringify(R,null,1));
 const ok={
  'chefe: botão «＋ Contrato à mão» abre o formulário na página, com o cursor no nº':/Contrato à mão/.test(botao)&&F0.existe&&F0.foco==='eotn-contrato',
  'vazio: diz o que falta (nº, cliente, data de fim) e não grava':JSON.stringify(F1.erros)==='["contrato","cliente","data_fim"]'&&F1.invalid===3&&posts1===0&&F1.foco==='eotn-contrato',
  'o mesmo nº escrito de outra forma: avisa, não grava e abre o que existe':/Já existe o contrato 100001 \(Cliente Um\)/.test(F2.dup)&&posts2===0&&abriuDup==='100001'&&F2b.existe,
  'o que se escreve sobrevive a redesenhar':JSON.stringify(aposRender)===JSON.stringify(['555 123','  Cliente À Mão ','4 500,50','v2','Veio de outro concessionário']),
  'Enter cria com os dados certos (nº sem espaços, números à portuguesa, matrícula em maiúsculas, à mão, ativo)':
    post.contrato==='555123'&&post.cliente==='Cliente À Mão'&&post.residual===4500.5&&post.prestacao===120&&post.matricula==='AA-11-BB'&&post.data_fim==='2027-03-31'&&post.origem==='manual'&&post.no_mapa===true&&post.fase==='Por contactar'&&post.responsavel_id==='v2'&&post.telemovel==='912 345 678'&&!('ultima_import' in post),
  'depois de criar abre a ficha: marca à mão, quem criou, Apagar':ficha.aberto==='555123'&&/à mão/.test(ficha.sub)&&/Criado à mão por Chefe GPP/.test(ficha.nota)&&ficha.apagar&&!ficha.form&&/criado à mão e atribuído a Vendedor Dois/.test(ficha.msg),
  'lista: marca só no criado à mão; contagem e filtro dizem quantos':lista.tag&&lista.outrasTag===1&&/^No mapa ?2 ?\+ 1 criado à mão$/.test(lista.kpi)&&lista.filtro==='No mapa e à mão',
  'contrato do mapa não tem Apagar':apagarMapa===false,
  'vendedor vê o contrato com a marca e não tem o botão':vend.tag&&/Cliente À Mão/.test(vend.card)&&!vend.botao,
  'apagar um criado à mão: confirma e só apaga criados à mão':/Apagar o contrato 777001/.test(apagado.dlg)&&/contrato=eq\.777001&origem=eq\.manual/.test(apagado.del)&&!apagado.existe&&!apagado.aberto,
  'mapa sem o criado à mão: não o dá como saído':JSON.stringify(impA.saem)==='["100002"]'&&impA.adot===0&&/os criados à mão ficam/.test(impA.txt),
  'vem no mapa: junta-se (não é novo), passa a ser do banco e mantém o trabalho da equipa':JSON.stringify(impB.adot)==='["555123"]'&&!impB.novos.includes('555123')&&impB.saem.length===0&&/1 criado à mão vem agora no mapa/.test(impB.txt)&&
    up.no_mapa===true&&depois.origem==='mapa'&&depois.resp==='v2'&&depois.notas==='Veio de outro concessionário'&&depois.residual===4400&&!depois.tag&&!/criado à mão/.test(depois.kpi),
  'sem o SQL novo: diz que SQL falta e não perde o que se escreveu':/Falta correr o SQL "2026-11-03_eot_manual"/.test(semSql.erro)&&semSql.valor==='Sem SQL'&&!semSql.existe,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'EOTs criadas à mão corretas');await b.close();srv.close();process.exit(f?1:0);})();
