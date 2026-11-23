// EOTs: o financeiro (e o chefe) acrescenta contratos a partir de um Excel (ex.: o histórico desde 2023). Dados fictícios.
// - só entram contratos novos; os que já existem (mesmo nº, escrito de outra forma) aparecem e não são tocados (sem PATCH/DELETE);
// - linhas com erro (sem nº, data impossível) aparecem e não entram; outras marcas e concessionários ficam de fora;
// - prováveis duplicados (a mesma mota noutro contrato, mais recente, ou já registada) só entram se marcados;
// - entram sem responsável, origem «historico», fase inicial; NIF, VIN e produto guardados; morada e código postal não;
// - números e matrículas à portuguesa; o que já terminou fica fora da lista ativa; o que termina a mais de 12 meses fica em carteira;
// - gravação com «ignorar duplicados» (se alguém o acrescentou entretanto, fica como estava e diz quantos);
// - o financeiro cria contratos à mão sem escolher responsável e não muda o responsável na ficha; não apaga;
// - o mapa do banco não dá os do histórico como saídos e adota-os quando vêm; avisa se lhe derem o ficheiro do histórico;
// - sem o SQL novo diz o que falta; texto do ficheiro não corre como código (XSS).
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8791;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const IMP='2026-10-06T10:39:10Z';
const dia=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return d;};
const iso=n=>dia(n).toISOString().slice(0,10);
const pt=n=>{const d=dia(n);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();};
const serial=n=>Math.round(Date.UTC(dia(n).getFullYear(),dia(n).getMonth(),dia(n).getDate())/864e5)+25569;   // data do Excel em número
const C=(contrato,o)=>Object.assign({contrato,tipo:'CSMOTOS',cliente:'Cliente '+contrato,data_fim:iso(60),prazo:48,prestacao:150,matricula:'AA-00-AA',modelo:'R 1250 GS',
  residual:5000,total:5600,concessionario:'Caetano Baviera Aveiro',conc_resp:'Caetano Baviera Aveiro',no_mapa:true,ultima_import:IMP,fase:'Por contactar',responsavel_id:'v1',origem:'mapa',criado_em:IMP},o);
const CAB=['Concessionário','Vendedor','Tipo','Contrato','NºDoc cliente','Cliente','Contacto','Telefone','Telemovel','Morada','Código Postal','Data Fim','Prazo','Prestação','Kms Contratados','Matrícula','Marca','Modelo','Seguro','Manutenção','Manutenção','Valor Residual a Refinanciar','Despesas Finais','Valor Total a Pagar','Concessionário Responsável','Conta para retenção?','Motivo','Produto Financeiro','VIN'];
const R=o=>{const x=Object.assign({conc:'Baviera Aveiro',vend:'Vendedor Antigo',tipo:null,ct:null,nif:'123456789',cliente:'Cliente Fictício',contacto:'Cliente Fictício',tel:null,tlm:'910000000',mor:'Rua Fictícia 1',cp:'3800-000',
  fim:pt(150),prazo:49,prest:150.5,kms:null,mat:'ZZ99ZZ',marca:'BMW Motorrad',modelo:'R 1300 GS',seg:null,resid:5000,prod:'3asyRide DF',vin:'WBATESTE000000000'},o);
  return [x.conc,x.vend,x.tipo,x.ct,x.nif,x.cliente,x.contacto,x.tel,x.tlm,x.mor,x.cp,x.fim,x.prazo,x.prest,x.kms,x.mat,x.marca,x.modelo,x.seg,null,null,x.resid,null,null,null,null,null,x.prod,x.vin];};
const XSS='<img src=x onerror="window.__xss=1">Ana';
const FICH=[CAB,
  R({ct:200001,nif:'123456789',cliente:XSS,tlm:912000001,fim:pt(150),prazo:49,prest:'1 234,50',mat:'BB11CC',seg:12.12,resid:'10 834,83 10 834,83',prod:'3asyRide DF 3asyRide DF',vin:'wbateste000000001'}),
  R({ct:200002,nif:'234567890',cliente:'Cliente Longe',fim:serial(1200),mat:'CC22DD',vin:'WBATESTE000000002'}),
  R({ct:200003,nif:'345678901',cliente:'Cliente Terminou',fim:'17/08/2025',mat:'DD33EE',vin:'WBATESTE000000003'}),
  R({ct:100001,cliente:'Outro Nome',mat:'AA00AA',vin:'WBATESTE000000004'}),
  R({ct:' 0100002',cliente:'Cliente Dois Excel',mat:'EE44FF',vin:'WBATESTE000000005'}),
  R({ct:200004,cliente:'Cliente Data Errada',fim:'29/02/2029',mat:'FF55GG',vin:'WBATESTE000000006'}),
  R({ct:null,cliente:'Cliente Sem Número',mat:'GG66HH',vin:'WBATESTE000000007'}),
  R({ct:200005,marca:'Yamaha',mat:'HH77II',vin:'JYATESTE000000008'}),
  R({ct:200006,conc:'Baviera Lisboa',mat:'II88JJ',vin:'WBATESTE000000009'}),
  R({ct:200007,nif:'111111111',cliente:'Primeiro Dono',fim:pt(200),prazo:49,mat:'JJ99KK',vin:'WBAPAR0000000000X'}),
  R({ct:200008,nif:'222222222',cliente:'Segundo Dono',fim:pt(2000),prazo:84,mat:'JJ99KK',vin:'WBAPAR0000000000X',prod:'Crédito DF'}),
  R({ct:200009,nif:'333333333',cliente:'Mota Já Registada',fim:pt(250),mat:'AA00AA',vin:'WBATESTE000000010'}),
  R({ct:200010,nif:'444444444',cliente:'Cliente Repetido',fim:pt(300),mat:'KK11LL',vin:'WBATESTE000000011'}),
  R({ct:200010,nif:'444444444',cliente:'Cliente Repetido',fim:pt(300),mat:'KK11LL',vin:'WBATESTE000000011',tlm:null}),
];
const CABM=['Concessionário','Vendedor','Tipo','Contrato','Cliente','Contacto','Telefone','Telemóvel','Data Fim','Prazo','Prestação','Kms Contratados','Matrícula','Marca','Modelo','Seguro','Manutenção','Manutenção','Valor Residual a Refinanciar','Despesas Finais','Valor Total a Pagar','Concessionário Responsável'];
const M=(ct,cli,fim)=>['Caetano Baviera Aveiro','Vendedor X','CSMOTOS',ct,cli,null,null,null,fim||pt(60),48,150,'40000','AA-00-AA','BMW Motorrad','R 1250 GS','N',null,null,5000,0,5600,'Caetano Baviera Aveiro'];
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},f1:{id:'f1',nome:'Financeiro EOT',role:'financeiro',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'},v2:{id:'v2',nome:'Vendedor Dois',role:'vendedor',linha:'motorrad'}};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const est={eot:[C('100001',{cliente:'Cliente Um'}),C('100002',{cliente:'Cliente Dois',responsavel_id:null,data_fim:iso(100)}),C('555001',{cliente:'Cliente À Mão',origem:'manual',ultima_import:null,data_fim:iso(120)})],
   ins:[],insHdr:[],upserts:[],posts:[],patches:[],deletes:[],semSql:false,entretanto:null};
 const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  const prefer=(r.request().headers()['prefer']||'');
  if(t==='eot_contratos'&&m==='POST'&&/ignore-duplicates/.test(prefer)){const lote=JSON.parse(r.request().postData());est.ins.push(...lote);est.insHdr.push({url:u.slice(u.indexOf('/rest/')),prefer});
    if(est.semSql)return json({code:'PGRST204',message:"Could not find the 'nif' column of 'eot_contratos' in the schema cache"},400);
    if(est.entretanto){est.eot.push(C(est.entretanto,{origem:'historico',responsavel_id:null,cliente:'Já lá estava',data_fim:iso(300)}));est.entretanto=null;}
    const novos=lote.filter(l=>!est.eot.some(x=>x.contrato===l.contrato)).map(l=>Object.assign({criado_em:new Date().toISOString(),criado_por:quem,ultima_import:null,responsavel_id:null},l));
    est.eot.push(...novos);return json(novos.map(x=>({contrato:x.contrato})),201);}
  if(t==='eot_contratos'&&m==='POST'&&u.includes('on_conflict')){const lote=JSON.parse(r.request().postData());est.upserts.push(...lote);
    for(const l of lote){const e=est.eot.find(x=>x.contrato===l.contrato);if(e){Object.assign(e,l);if(l.ultima_import)e.origem='mapa';}else est.eot.push(Object.assign({fase:'Por contactar',origem:'mapa'},l));}
    return r.fulfill({status:201,body:''});}
  if(t==='eot_contratos'&&m==='POST'){const body=JSON.parse(r.request().postData());est.posts.push(body);
    if(est.eot.some(x=>x.contrato===body.contrato))return json({code:'23505',message:'duplicate key'},409);
    const row=Object.assign({criado_em:new Date().toISOString(),criado_por:quem,ultima_import:null},body);est.eot.push(row);return json([row],201);}
  if(t==='eot_contratos'&&m==='PATCH'){est.patches.push(u.slice(u.indexOf('/rest/')));const body=JSON.parse(r.request().postData());const ids=((u.match(/contrato=in\.\(([^)]*)\)/)||[])[1]||'').split(',').map(x=>x.replace(/"/g,''));
    const um=(u.match(/contrato=eq\.([^&]+)/)||[])[1];const alvo=est.eot.filter(x=>ids.includes(x.contrato)||x.contrato===um);alvo.forEach(x=>Object.assign(x,body));return json(alvo);}
  if(t==='eot_contratos'&&m==='DELETE'){est.deletes.push(u.slice(u.indexOf('/rest/')));return r.fulfill({status:204,body:''});}
  if(t==='eot_contratos')return json(quem==='c1'||quem==='f1'?est.eot:est.eot.filter(x=>x.responsavel_id===quem));
  if(t==='profiles')return json([PERFIS[quem],...Object.values(PERFIS).filter(x=>x.id!==quem)]);
  return json([]);};
 const erros=[];
 const abrir=async(quem,vp)=>{const ctx=await b.newContext({viewport:vp||{width:1400,height:1000}});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p._dlg=[];await ligarAvisos(p,p._dlg);p.on('pageerror',e=>erros.push(quem+': '+e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1600);return {ctx,p};};
 const txt=(p,sel)=>p.evaluate(sel=>{const e=document.querySelector(sel);return e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';},sel);
 const carregar=async(p,rows,id,nome)=>{await p.evaluate(async([rows,id,nome])=>{window.XLSX={read:()=>({SheetNames:['f'],Sheets:{f:{}}}),utils:{sheet_to_json:()=>rows}};
   await (id==='hist'?eotAcrFicheiro:eotFicheiro)({name:nome,arrayBuffer:async()=>new ArrayBuffer(8)});},[rows,id,nome]);await p.waitForTimeout(400);};

 // ===== financeiro =====
 const F1=await abrir('f1');const p=F1.p;
 await p.evaluate(()=>setState({screen:'financeiro'}));await p.waitForTimeout(300);
 const botoes=await p.evaluate(()=>({acr:!!document.querySelector('#eot-hist-file'),man:!!document.querySelector('[data-action="eot-novo"]'),mapa:!!document.querySelector('#eot-file'),
   txt:[...document.querySelectorAll('.fin-acr .btn')].map(x=>x.textContent.replace(/[\s  ]+/g,' ').trim())}));
 await carregar(p,FICH,'hist','histórico <b>2023</b>.xlsx');
 const prev=await p.evaluate(()=>{const A=S.eotAcr||{};const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   return {novos:(A.novos||[]).map(x=>x.contrato).sort(),dups:(A.dups||[]).map(x=>x.l.contrato).sort(),prov:(A.prov||[]).map(x=>x.l.contrato+':'+x.incluir+':'+x.motivo),
     erros:(A.erros||[]).map(x=>x.contrato+':'+x.motivo),rep:(A.repetidos||[]).length,exMarca:A.exMarca,exConc:A.exConc,
     card:t(document.querySelector('.eot-acr')),botao:t(document.querySelector('[data-action="eot-acr-confirmar"]')),titulo:document.querySelector('.eot-acr .vd-form-t')?document.querySelector('.eot-acr .vd-form-t').innerHTML:'',
     caixas:[...document.querySelectorAll('[data-eot-acr-prov]')].map(x=>x.dataset.eotAcrProv+':'+x.checked)};});
 await p.screenshot({path:path.join(__dirname,'eot_historico_prev.png'),fullPage:true});
  // marca o mais antigo da mota revendida: passa a entrar
 await p.click('[data-eot-acr-prov="200007"]');await p.waitForTimeout(200);
 const botao2=await txt(p,'[data-action="eot-acr-confirmar"]');
 est.entretanto='200010';   // alguém o acrescentou entre a leitura e a gravação
 await p.click('[data-action="eot-acr-confirmar"]');await p.waitForTimeout(900);
 const msg=await p.evaluate(()=>S.eotMsg||'');
 const nIns=est.ins.length;
 const L=Object.fromEntries(est.ins.map(x=>[x.contrato,x]));const chaves=new Set(est.ins.map(x=>Object.keys(x).sort().join(',')));
 const lista=await p.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   return {linhas:[...document.querySelectorAll('.fin-tbl tr[data-c]')].map(x=>x.dataset.c),tag:!!document.querySelector('.fin-tbl tr[data-c="200001"] .eot-hist'),
     kpi:t(document.querySelector('.kpi-c')),xssEl:!!document.querySelector('img[src="x"]'),xss:window.__xss===1,cliente:t(document.querySelector('.fin-tbl tr[data-c="200001"] b'))};});
 await p.evaluate(()=>{S.finTab='todos';render();});await p.waitForTimeout(150);
 const todosTab=await p.evaluate(()=>[...document.querySelectorAll('.fin-tbl tr[data-c]')].map(x=>x.dataset.c));
 await p.selectOption('select[data-fin-f="prazo"]','cart');await p.waitForTimeout(200);
 const cart=await p.evaluate(()=>[...document.querySelectorAll('.fin-tbl tr[data-c]')].map(x=>x.dataset.c).sort());
 await p.selectOption('select[data-fin-f="prazo"]','');await p.selectOption('select[data-fin-f="mapa"]','');await p.waitForTimeout(200);
 const comSaidos=await p.evaluate(()=>{const tr=document.querySelector('.fin-tbl tr[data-c="200003"]');return tr?tr.textContent.replace(/[\s  ]+/g,' '):'';});
 // ficha aberta pelo financeiro: vê NIF, VIN e produto; não escolhe responsável; não apaga
 await p.evaluate(()=>eotAbrir('200001'));await p.waitForTimeout(400);
 await p.evaluate(()=>{S.eotDetAberto=true;render();});await p.waitForTimeout(200);
 const fichaF=await p.evaluate(()=>{const m=document.querySelector('.eotm');const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   return {resp:!!(m&&m.querySelector('[data-eotm="responsavel_id"]')),nif:t(m&&m.querySelector('[data-eotm="nif"]')?m.querySelector('[data-eotm="nif"]').parentElement:null)+'|'+((m&&m.querySelector('[data-eotm="nif"]'))||{}).value,
     prod:((m&&m.querySelector('[data-eotm="produto"]'))||{}).value,apagar:!!(m&&m.querySelector('[data-action="eot-apagar"]')),nota:t(m&&m.querySelector('.eotm-man')),sub:t(m&&m.querySelector('.eotm-sub'))};});
 await p.screenshot({path:path.join(__dirname,'eot_historico_ficha.png')});
 await p.evaluate(()=>eotFechar(true));await p.waitForTimeout(200);
 // contrato à mão pelo financeiro: sem responsável
 await p.click('[data-action="eot-novo"]');await p.waitForTimeout(200);
 const formF=await p.evaluate(()=>({form:!!document.querySelector('.eotn'),resp:!!document.getElementById('eotn-responsavel_id'),sub:(document.querySelector('.eotn .vd-form-sub')||{}).textContent||''}));
 await p.fill('#eotn-contrato','300001');await p.fill('#eotn-cliente','Cliente Do Financeiro');await p.fill('#eotn-data_fim',iso(90));
 await p.click('[data-action="eot-novo-criar"]');await p.waitForTimeout(600);
 const postF=est.posts.slice(-1)[0]||{};
 await p.evaluate(()=>eotFechar(true));await p.waitForTimeout(150);
 // sem o SQL novo
 est.semSql=true;await p.evaluate(()=>setState({screen:'financeiro',eotMsg:''}));
 await carregar(p,[CAB,R({ct:400001,nif:'555555555',cliente:'Sem SQL',fim:pt(100),mat:'MM11NN',vin:'WBATESTE000000099'})],'hist','outro.xlsx');
 await p.click('[data-action="eot-acr-confirmar"]');await p.waitForTimeout(600);
 const semSql=await p.evaluate(()=>({erro:S.eotErrImp||'',ecra:(document.querySelector('.sec-wrap .error')||{}).textContent||'',existe:S.eot.some(x=>x.contrato==='400001')}));
 est.semSql=false;
 await F1.ctx.close();

 // ===== chefe =====
 const patch0=est.patches.length;
 const C1=await abrir('c1');const q=C1.p;await q.waitForTimeout(600);
 // rotação: os do histórico que já estão nos 12 meses e sem responsável são repartidos sozinhos
 const rot={patches:est.patches.slice(patch0),resp:Object.fromEntries(['200001','200007','200010','200002','200003','300001','100002'].map(c=>[c,(est.eot.find(x=>x.contrato===c)||{}).responsavel_id||null])),
   toast:await txt(q,'#bm-toast'),botao:await txt(q,'#bm-toast .bm-toast-b'),msg:await q.evaluate(()=>S.eotMsg||'')};
await q.evaluate(()=>document.querySelector('#bm-toast .bm-toast-b').click());await q.waitForTimeout(700);
 await q.evaluate(()=>loadEot());await q.waitForTimeout(500);
 const desfeito={resp:['200001','200007','200010'].map(c=>(est.eot.find(x=>x.contrato===c)||{}).responsavel_id||null),msg:await q.evaluate(()=>S.eotMsg||''),
   patches:est.patches.length-patch0-rot.patches.length,guardado:await q.evaluate(()=>localStorage.getItem('bm_eot_rot_nao')||'')};
 const eots=async()=>{await q.evaluate(()=>{S.eotAberto=null;S.screen='dashboard';S.gppSec='eots';S.eotF={};render();});await q.waitForTimeout(250);};
 await eots();
 const chefe=await q.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';const cards=[...document.querySelectorAll('.lc-cards .mg-card')].map(t);
   const esperado=S.eot.filter(x=>x.no_mapa!==false&&!x.responsavel_id&&!EOT_FECHO.includes(x.fase)&&eotDias(x)<=365).length;
   const comCart=S.eot.filter(x=>x.no_mapa!==false&&!x.responsavel_id&&!EOT_FECHO.includes(x.fase)).length;
   return {acr:!!document.querySelector('#eot-hist-file'),mapa:!!document.querySelector('#eot-file'),cards,esperado,comCart,
     porAtribuir:Number((cards.find(c=>/^Por atribuir/.test(c))||'').replace(/\D/g,'')),linhas:[...document.querySelectorAll('.eot-tbl tr[data-c]')].map(x=>x.dataset.c),
     opcoes:[...document.querySelectorAll('select[data-eot-filtro="saiu"] option')].map(o=>o.value+'='+o.textContent),aviso:t([...document.querySelectorAll('.mg-aviso')].find(x=>/fora do mapa/.test(x.textContent)))};});
 const badge=await q.evaluate(()=>{const b=document.querySelector('.gpp-nav-badge[title="EOTs por atribuir"]');return b?Number(b.textContent):0;});
 await q.selectOption('select[data-eot-filtro="saiu"]','cart');await q.waitForTimeout(200);
 const chefeCart=await q.evaluate(()=>[...document.querySelectorAll('.eot-tbl tr[data-c]')].map(x=>x.dataset.c).sort());
 await q.selectOption('select[data-eot-filtro="saiu"]','1');await q.waitForTimeout(200);
 const chefeSaiu=await q.evaluate(()=>[...document.querySelectorAll('.eot-tbl tr[data-c]')].map(x=>x.dataset.c).sort());
 await q.evaluate(()=>eotAbrir('200001'));await q.waitForTimeout(400);
 const fichaC=await q.evaluate(()=>{const m=document.querySelector('.eotm');return {resp:!!(m&&m.querySelector('[data-eotm="responsavel_id"]')),apagar:!!(m&&m.querySelector('[data-action="eot-apagar"]'))};});
 await q.evaluate(()=>eotFechar(true));
 // mapa do banco sem os do histórico: não saem; com um deles: junta-se
 await eots();
 await carregar(q,[['Mapa'],[],CABM,M(100001,'Cliente Um')],'mapa','mapa.xlsx');
 const mapaA=await q.evaluate(()=>({saem:S.eotPrev.saem.map(x=>x.contrato).sort(),txt:document.querySelector('.eot-prev').textContent.replace(/[\s  ]+/g,' ')}));
 await q.click('[data-action="eot-cancelar"]');await q.waitForTimeout(150);
 await carregar(q,[['Mapa'],[],CABM,M(100001,'Cliente Um'),M(100002,'Cliente Dois'),M(200001,'Ana (banco)',pt(150))],'mapa','mapa.xlsx');
 const mapaB=await q.evaluate(()=>({saem:S.eotPrev.saem.map(x=>x.contrato).sort(),adot:(S.eotPrev.adotados||[]).map(x=>x.contrato)}));
 await q.click('[data-action="eot-cancelar"]');await q.waitForTimeout(150);
 // o ficheiro do histórico pelo botão do mapa: avisa
 await carregar(q,FICH,'mapa','histórico.xlsx');
 const mapaHist=await txt(q,'.eot-prev');
 await q.click('[data-action="eot-cancelar"]');await q.waitForTimeout(150);
 await q.screenshot({path:path.join(__dirname,'eot_historico_chefe.png')});
 await C1.ctx.close();
 // vendedor: não acrescenta; tem o botão para os que terminam depois de 12 meses
 Object.assign(est.eot.find(x=>x.contrato==='200002'),{responsavel_id:'v1'});
 const V1=await abrir('v1',{width:390,height:844});
 await V1.p.evaluate(()=>setState({screen:'veot'}));await V1.p.waitForTimeout(300);
 const vend=await V1.p.evaluate(()=>({acr:!!document.querySelector('#eot-hist-file'),pode:eotPodeAcrescentar()}));
 const cartoes=()=>V1.p.evaluate(()=>[...document.querySelectorAll('.ve-list [data-c]')].map(x=>x.dataset.c));
 const vAbertos=await cartoes();const chipLonge=await txt(V1.p,'[data-action="v-eot-f"][data-f="longe"]');
 await V1.p.click('[data-action="v-eot-f"][data-f="longe"]');await V1.p.waitForTimeout(200);
 const vendLonge={abertos:vAbertos,chip:chipLonge,longe:await cartoes()};
 await V1.ctx.close();

 const R0={rot,desfeito,vendLonge,botoes,prev,botao2,msg,ins:nIns,chaves:[...chaves],insHdr:est.insHdr,L200001:L['200001'],L200003:L['200003'],lista,todosTab,cart,comSaidos,fichaF,formF,postF,semSql,
   chefe,badge,chefeCart,chefeSaiu,fichaC,mapaA,mapaB,mapaHist:mapaHist.slice(0,400),vend,patches:est.patches,deletes:est.deletes,dialogos:p._dlg,erros};
 console.log(JSON.stringify(R0,null,1));
 const a=L['200001']||{};const um=est.eot.find(x=>x.contrato==='100001')||{};
 const ok={
  'rotação: os do histórico nos 12 meses são repartidos sozinhos (só os sem responsável)':rot.resp['200001']&&rot.resp['200007']&&rot.resp['200010']&&!rot.resp['200002']&&!rot.resp['200003']&&!rot.resp['300001']&&!rot.resp['100002']
    &&new Set([rot.resp['200001'],rot.resp['200007'],rot.resp['200010']]).size===2&&rot.patches.length&&rot.patches.every(u=>/responsavel_id=is\.null/.test(u)),
  'rotação: avisa quantos e a quem, com Desfazer':/3 contratos do histórico entraram nos últimos 12 meses e foram atribuídos em rotação/.test(rot.toast)&&/Vendedor Dois/.test(rot.toast)&&rot.botao==='Desfazer'&&/em rotação/.test(rot.msg),
  'desfazer: voltam a «por atribuir» e não são atribuídos sozinhos outra vez':desfeito.resp.every(x=>x===null)&&desfeito.patches>0&&/Rotação desfeita/.test(desfeito.msg)&&/200001/.test(desfeito.guardado),
  'vendedor: botão «Fim depois de 12 meses» com os seus contratos longe; fora de «Em aberto»':!vendLonge.abertos.includes('200002')&&/Fim depois de 12 meses \(1\)/.test(vendLonge.chip)&&JSON.stringify(vendLonge.longe)==='["200002"]',
  'financeiro: botões «Contrato à mão» e «Acrescentar contratos (Excel)»; não carrega o mapa do banco':botoes.acr&&botoes.man&&!botoes.mapa,
  'pré-visualização: novos, já existentes (mesmo nº escrito de outra forma) e erros':JSON.stringify(prev.novos)==='["200001","200002","200003","200008","200010"]'&&JSON.stringify(prev.dups)==='["0100002","100001"]'
    &&prev.erros.length===2&&prev.erros.some(e=>/^200004:data de fim inválida \(29\/02\/2029\)/.test(e))&&prev.erros.some(e=>/^:sem nº de contrato/.test(e)),
  'outras marcas e concessionários ficam de fora; repetido no ficheiro entra uma vez':prev.exMarca===1&&prev.exConc===1&&prev.rep===1,
  'prováveis duplicados: mota revendida (o mais antigo) e mota já registada, por marcar':prev.prov.length===2&&prev.prov.some(x=>/^200007:false:a mesma mota passou para o contrato 200008/.test(x))&&prev.prov.some(x=>/^200009:false:a mesma mota já está no contrato 100001/.test(x))
    &&JSON.stringify(prev.caixas)==='["200007:false","200009:false"]',
  'resumo diz o que entra (12 meses, carteira, terminados) e o botão conta':/＋ 5 entram: 2 terminam nos próximos 12 meses · 2 em carteira .* 1 já terminaram/.test(prev.card)&&/⊘ 2 já existem/.test(prev.card)&&/Acrescentar 5 contratos/.test(prev.botao),
  'marcar um provável soma ao botão':/Acrescentar 6 contratos/.test(botao2),
  'grava com «ignorar duplicados» (nunca altera nem apaga o que existe)':est.insHdr.every(h=>/on_conflict=contrato/.test(h.url)&&/resolution=ignore-duplicates/.test(h.prefer))&&patch0===0&&est.deletes.length===0
    &&um.cliente==='Cliente Um'&&um.responsavel_id==='v1'&&!est.ins.some(x=>['100001','0100002','200004','200005','200006','200009'].includes(x.contrato)),
  'todas as linhas com as mesmas colunas; sem responsável, sem morada nem código postal':chaves.size===1&&![...chaves][0].split(',').some(k=>/responsavel|morada|postal|linha/.test(k))&&nIns===6,
  'origem histórico, fase inicial, ativo; o que já terminou fica fora da lista ativa':a.origem==='historico'&&a.fase==='Por contactar'&&a.no_mapa===true&&(L['200003']||{}).no_mapa===false,
  'números e matrícula à portuguesa; seguro com valor = S; NIF, VIN e produto':a.matricula==='BB-11-CC'&&a.residual===10834.83&&a.prestacao===1234.5&&a.seguro==='S'&&a.telemovel==='912000001'
    &&a.nif==='123456789'&&a.vin==='WBATESTE000000001'&&a.produto==='3asyRide DF'&&a.vendedor_origem==='Vendedor Antigo'&&a.cliente===XSS,
  'quem já tinha sido acrescentado entretanto fica como estava e a mensagem diz':/^5 contratos acrescentados do histórico, sem responsável/.test(msg)&&/1 já existiam entretanto e ficaram como estavam/.test(msg)
    &&(est.eot.find(x=>x.contrato==='200010')||{}).cliente==='Já lá estava',
  'lista do financeiro: marca «histórico»; sem os de carteira nem os terminados; KPI diz quantos em carteira':lista.tag&&todosTab.includes('200001')&&!todosTab.includes('200002')&&!todosTab.includes('200008')&&!todosTab.includes('200003')&&/em carteira/.test(lista.kpi),
  'filtro «em carteira» mostra os de fim a mais de 12 meses':JSON.stringify(cart)==='["200002","200008"]',
  'o que já terminou aparece com os que saíram e diz que já tinha terminado':/já tinha terminado/.test(comSaidos),
  'XSS: o nome do cliente aparece como texto e não corre':!lista.xssEl&&!lista.xss&&lista.cliente.includes('<img')&&!/<b>2023<\/b>/.test(prev.titulo)&&/&lt;b&gt;2023/.test(prev.titulo),
  'ficha (financeiro): vê NIF e produto, não escolhe responsável, não apaga, diz de onde veio':!fichaF.resp&&/123456789/.test(fichaF.nif)&&fichaF.prod==='3asyRide DF'&&!fichaF.apagar&&/Acrescentado do histórico \(Excel\) por Financeiro EOT/.test(fichaF.nota)&&/histórico/.test(fichaF.sub),
  'contrato à mão pelo financeiro: sem campo de responsável e grava sem ele':formF.form&&!formF.resp&&/chefe de vendas que escolhe o responsável/.test(formF.sub)&&postF.contrato==='300001'&&postF.responsavel_id===null&&postF.origem==='manual',
  'sem o SQL novo: diz qual falta e nada entra':/2026-11-23_eot_historico_financeiro/.test(semSql.erro)&&/2026-11-23_eot_historico_financeiro/.test(semSql.ecra)&&!semSql.existe,
  'chefe: tem os dois botões (mapa e acrescentar)':chefe.acr&&chefe.mapa,
  '«Por atribuir» e o aviso do menu não contam os de carteira':chefe.porAtribuir===chefe.esperado&&badge===chefe.esperado&&chefe.comCart>chefe.esperado&&!chefe.linhas.includes('200002'),
  'chefe: filtros «em carteira» e «Saíram do mapa / terminados»; aviso para marcar como acabaram':chefe.opcoes.some(o=>/^cart=Em carteira: fim a mais de 12 meses \(2\)/.test(o))&&chefe.opcoes.includes('1=Saíram do mapa / terminados')
    &&JSON.stringify(chefeCart)==='["200002","200008"]'&&chefeSaiu.includes('200003')&&/já tinham terminado quando vieram do histórico/.test(chefe.aviso),
  'ficha (chefe): escolhe responsável e pode apagar um do histórico':fichaC.resp&&fichaC.apagar,
  'mapa do banco: os do histórico não saem; quando vêm, juntam-se':JSON.stringify(mapaA.saem)==='["100002"]'&&/os criados à mão e os do histórico ficam/.test(mapaA.txt)&&JSON.stringify(mapaB.adot)==='["200001"]'&&!mapaB.saem.some(c=>/^200/.test(c)),
  'ficheiro do histórico no botão do mapa: avisa':/parece o histórico de contratos do financeiro/.test(mapaHist),
  'vendedor não acrescenta contratos':!vend.acr&&!vend.pode,
  'sem erros na página':erros.length===0,
 };
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'TUDO OK');srv.close();await b.close();process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
