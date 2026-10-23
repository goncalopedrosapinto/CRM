// Encomendas BMW: o ficheiro do portal (CSV em Windows-1252 com uma linha JSON por cima, ou Excel) é lido pelo formato fixo,
// o código de modelo estragado pelo Excel ("0,00E+00") é recuperado do chassis, a ordem é Model Code e depois ST, US, DE, CS,
// o vendedor só lê (sem botão de carregar), a pesquisa e as caixas de verificação filtram, e o chefe grava tudo de uma vez.
// Dados 100% fictícios (o repositório é público: nunca pôr aqui um ficheiro real, tem apelidos de clientes).
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');const XLSX=require('xlsx');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const diasDe=s=>{const [d,m,y]=s.split('.').map(Number);const t=new Date(y,m-1,d);const h=new Date();h.setHours(0,0,0,0);return Math.max(0,Math.round((h-t)/864e5));};
const PORTA=8766;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=(sub)=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';

// ---------- ficheiro fictício no formato do portal ----------
const CAB='Production Number;Chassis No.;Body Group;Brand;Model Code;Model Description;Model Series;Color Code;Upholstery Code;Options String;Order Template ID;Wholesaler;Dealer Number;Dealer No.;Region;District;Act. Location;Dest. Loc.;Order Status;Timestamp Order Status;Processing Type;Sales Channel;Port Location;Confirmed Production Week;Subsidiary Requested Production Week;Actual Production Date;Conf F3 From;Conf.F3 To;AG Inv. Date;Wholesale Invoice Ind;Retail System Date (GMT);New vehicle retail;Current Release Date;Holds;Customer;Customer (Last);Purchase Agreement Date;P. A. Date / Event Date;TS Order Entry;CO2 Output;Chassis Number 17;Fuel Type;Salesperson Number;Factory;Businesstype;Quota Month;Exp. Del. Wk.;Wholesale Invoice Document Date;Planned F2 Date;Corrected F2 Date;Retail Requested Production Week;Retail Counting Date;Retail Cancellation Date;AG Vehicle Hold;Planned Handover Wk.;Order Template ID;Sub. Notes;Quota PAK;PDI Done'.split(';');
const linha=o=>CAB.map(h=>o[h]==null?(h==='Dealer Number'?"'052895'":''):o[h]);
const L=[
  {'Production Number':'9000005','Chassis No.':'6N00005','Body Group':'KA1','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'N52','Options String':'20B 389 7A8','Order Status':'198','Timestamp Order Status':'03.07.2026','Processing Type':'CS','Actual Production Date':'28.01.2026','Conf F3 From':'01/07/2026','Conf.F3 To':'05/07/2026','Customer (Last)':'Gonçalves Simão','Salesperson Number':'GM','Chassis Number 17':'WB10M2100T6N00005','Exp. Del. Wk.':'20260727'},
  {'Salesperson Number':'cm0ggvc','Production Number':'9000004','Chassis No.':'','Body Group':'KA1','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'ND2','Options String':'389 413','Order Status':'111','Timestamp Order Status':'09.09.2026','Processing Type':'ST','Actual Production Date':'','Conf F3 From':'18/01/2027','Conf.F3 To':'24/01/2027','Customer (Last)':'','Chassis Number 17':'','Exp. Del. Wk.':'20270103'},
  {'Production Number':'9000003','Chassis No.':'6N00003','Body Group':'KA1','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'N52','Options String':'5AG 6AC','Order Status':'150','Timestamp Order Status':'12.10.2026','Processing Type':'DE','Actual Production Date':'04.11.2026','Conf F3 From':'16/11/2026','Conf.F3 To':'22/11/2026','Customer (Last)':'','Chassis Number 17':'WB10M2100V6N00003','Exp. Del. Wk.':'20261147'},
  {'Production Number':'9000002','Chassis No.':'6N00002','Body Group':'KA1','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'N52','Options String':'5AG','Order Status':'193','Timestamp Order Status':'01.09.2026','Processing Type':'US','Actual Production Date':'','Conf F3 From':'','Conf.F3 To':'','Customer (Last)':'','Chassis Number 17':'WB10M2100V6N00002','Exp. Del. Wk.':'20260936'},
  {'Production Number':'9000001','Chassis No.':'6N00001','Body Group':'KM9','Model Code':'0,00E+00','Model Description':'M 1000 XR','Color Code':'N3S','Options String':'18F 79A','Order Status':'198','Timestamp Order Status':'16.10.2026','Processing Type':'CS','Actual Production Date':'06.10.2026','Conf F3 From':'12/10/2026','Conf.F3 To':'18/10/2026','Customer (Last)':'Almeida Teste','Salesperson Number':'FG','Chassis Number 17':'WB10E9100V6N00001','Exp. Del. Wk.':'20261042'},
  {'Production Number':'9000006','Chassis No.':'','Body Group':'KD1','Model Code':'0R31','Model Description':'F 450 GS','Color Code':'N2L','Options String':'222 2T1','Order Status':'47','Timestamp Order Status':'17.08.2026','Processing Type':'ST','Actual Production Date':'','Conf F3 From':'','Conf.F3 To':'','Customer (Last)':'','Chassis Number 17':'','Exp. Del. Wk.':''},
];
const csvTxt='"{   ""from"" : 0    ""size"" : 200 }";;;;\n;;;;\n'+[CAB,...L.map(linha)].map(r=>r.join(';')).join('\n')+'\n';
const csvBuf=Buffer.from(csvTxt,'latin1'); // Windows-1252 para estes caracteres
// Excel: o mesmo, com o código 0E91 transformado em número 0 e datas como datas
const aoa=[['relatório'],[],CAB,...L.map(o=>{const r=linha(o);const i=CAB.indexOf('Model Code');if(o['Model Code']==='0,00E+00')r[i]=0;
  const iT=CAB.indexOf('Timestamp Order Status');const m=String(r[iT]).match(/(\d+)\.(\d+)\.(\d+)/);if(m)r[iT]=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return r;})];
const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa,{cellDates:true}),'Folha1');
const xlsxBuf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
const csvDe=(topo,linhas)=>Buffer.from(topo+'\n\n'+[CAB,...linhas.map(linha)].map(r=>r.join(';')).join('\n')+'\n','latin1');
const csvRede=csvDe('{ "stockTypes" : [ "Foreign Dealer Stock (22)" ] }',[
  {'Production Number':'7100001','Chassis No.':'6N71001','Model Code':'0K61','Model Description':'F 900 GS','Color Code':'ND2','Order Status':'198','Processing Type':'US','Dealer Number':"'030252'",'Dealer No.':'J&M Motos','Region':'Ce','Customer (Last)':'Paulo Cliente Doutro','Salesperson Number':'XX','Chassis Number 17':'WB10K6100T6N71001'},
  {'Production Number':'7100002','Chassis No.':'6N71002','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'N52','Order Status':'193','Processing Type':'US','Dealer Number':"'047020'",'Dealer No.':'BMcar Porto','Region':'No'}]);
const csvBMW=csvDe('{ "from" : 0 }',[
  {'Production Number':'7200001','Chassis No.':'6N72001','Model Code':'0R41','Model Description':'F 430 R','Color Code':'N5A','Order Status':'150','Processing Type':'US','Dealer Number':"'027947'",'Dealer No.':'BMW Portugal','Region':'--'}]);
const csvSemOrigem=csvDe('{ "from" : 0 }',[{'Production Number':'7300001','Model Code':'0K81','Model Description':'F 900 R','Order Status':'111','Processing Type':'US','Dealer Number':''}]);
const XLSX_JS=fs.readFileSync(path.join(__dirname,'node_modules/xlsx/dist/xlsx.full.min.js'));

const dias=n=>new Date(Date.now()-n*864e5).toISOString();
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const R={};
 async function abrir(role){
  const ctx=await b.newContext();const est={tabela:[],rpc:[],negocios:[],reservas:[],patches:[],posts:[]};
  await ctx.addInitScript((t)=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('u1'));
  await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('http://localhost'))return r.continue();
   if(u.includes('cdnjs.cloudflare.com/ajax/libs/xlsx'))return r.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:XLSX_JS});
   if(u.includes('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt('u1'),refresh_token:'rt2'})});
   if(u.includes('/rpc/encomendas_bmw_substituir')){const body=JSON.parse(r.request().postData());est.rpc.push(body);const o=body.p_origem||'aveiro';
     est.tabela=est.tabela.filter(x=>(x.origem||'aveiro')!==o).concat(body.linhas.map(l=>Object.assign({importado_em:new Date().toISOString(),origem:o},l)));return r.fulfill({status:200,contentType:'application/json',body:String(body.linhas.length)});}
   if(u.includes('/rpc/encomendas_reservas'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(est.reservas)});
   const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
   if(t==='baviera_control'&&r.request().method()==='PATCH'){const id=(u.match(/id=eq\.(\d+)/)||[])[1];const body=JSON.parse(r.request().postData());est.patches.push({id,body});
     if(body.enc==='9000003')return r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'A encomenda 9000003 já está a ser trabalhada por Gonçalo Mendes (Morno). Só o chefe de vendas a pode passar para outro negócio.'})});
     return r.fulfill({status:204,body:''});}
   if(t==='baviera_control'&&r.request().method()==='POST'){const body=JSON.parse(r.request().postData());est.posts.push(body);const novo=Object.assign({id:200+est.posts.length,updated_at:new Date().toISOString()},body);est.negocios.push(novo);return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify([novo])});}
   if(t==='baviera_control')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(est.negocios)});
   const body=t==='profiles'?[{id:'u1',nome:'Teste',role,linha:'motorrad',areas:[]},{id:'g1',nome:'Gonçalo Mendes',role:'vendedor',linha:'motorrad'},{id:'a1',nome:'António Felipe Gomes',role:'vendedor',linha:'motorrad'}]:t==='encomendas_bmw'?(u.includes('offset=0')?est.tabela:[]):t==='encomendas_chegadas'?(u.includes('offset=0')?(est.chegadas||[]):[]):[];
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
  const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
  return{ctx,p,est,erros,ir:async()=>{await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);}};}

 // ---------- 1) chefe: carrega CSV, pré-visualização, confirma ----------
 {const {ctx,p,est,erros,ir}=await abrir('admin');await ir();
  await p.evaluate(()=>{S.screen='dashboard';S.gppSec='encomendas';S.encLoaded=false;render();});await p.waitForTimeout(500);
  const temBotao=await p.$('#enc-file')!==null;
  await p.setInputFiles('#enc-file',{name:'encomendas.csv',mimeType:'text/csv',buffer:csvBuf});await p.waitForFunction(()=>S.encPrev||S.encErrImp,null,{timeout:5000}).catch(()=>{});
  const prev=await p.evaluate(()=>{const P=S.encPrev&&S.encPrev.ficheiros[0];return P&&{origem:P.origem,n:P.linhas.length,corr:P.corrigidos,susp:P.suspeitos.length,
    ordem:P.linhas.map(l=>l.model_code+':'+l.processing_type),cliente:P.linhas.find(l=>l.production_number==='9000005').customer_last,
    datas:P.linhas.find(l=>l.production_number==='9000005'),semJson:P.linhas.every(l=>!String(l.production_number).includes('{'))};});
  await p.click('[data-action="enc-confirmar"]');await p.waitForTimeout(600);
  const enviado=est.rpc[0]&&est.rpc[0].linhas;
  R.chefeCSV={temBotao,prev,rpcChamado:est.rpc.length,enviadoN:enviado&&enviado.length,camposExtra:enviado&&Object.keys(enviado[0]).filter(k=>k.startsWith('_')),
    msg:await p.evaluate(()=>S.encMsg),linhasTabela:await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length),grupos:await p.$$eval('.enc-grp',x=>x.length),erros};
  // ---- Excel com o mesmo conteúdo
  await p.setInputFiles('#enc-file',{name:'encomendas.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:xlsxBuf});await p.waitForFunction(()=>S.encPrev||S.encErrImp,null,{timeout:8000}).catch(()=>{});
  R.chefeXLSX=await p.evaluate(()=>{const P=S.encPrev&&S.encPrev.ficheiros[0];return P?{n:P.linhas.length,cod:P.linhas.find(l=>l.production_number==='9000001').model_code,
    data:P.linhas.find(l=>l.production_number==='9000005').ts_order_status,mudam:P.mudamEstado,entram:P.entram,saem:P.saem}:{erro:S.encErrImp};});
  // ---- ficheiro errado não estraga nada
  await p.click('[data-action="enc-cancelar"]');await p.waitForFunction(()=>!S.encPrev);await p.waitForTimeout(200);
  await p.setInputFiles('#enc-file',{name:'outro.csv',mimeType:'text/csv',buffer:Buffer.from('a;b;c\n1;2;3\n')});
  await p.waitForFunction(()=>S.encErrImp||S.encPrev,null,{timeout:5000}).catch(()=>{});
  R.ficheiroErrado={erro:await p.evaluate(()=>S.encErrImp),rpc:est.rpc.length};
  // ---- Rede + BMW de uma vez, e um ficheiro sem origem reconhecível
  await p.evaluate(()=>{S.encErrImp='';S.encPrev=null;render();});await p.waitForTimeout(200);
  await p.setInputFiles('#enc-file',[{name:'IVSLocatorFileExport_1.csv',mimeType:'text/csv',buffer:csvRede},{name:'Stock BMW.csv',mimeType:'text/csv',buffer:csvBMW},{name:'IVSLocatorFileExport_3.csv',mimeType:'text/csv',buffer:csvSemOrigem}]);
  await p.waitForFunction(()=>S.encPrev&&S.encPrev.ficheiros.length===3,null,{timeout:8000}).catch(()=>{});
  const tres=await p.evaluate(()=>({origens:S.encPrev.ficheiros.map(f=>f.origem),bloqueado:!!document.querySelector('[data-action="enc-confirmar"][disabled]')}));
  await p.click('[data-action="enc-cancelar"]');await p.waitForTimeout(200);
  await p.setInputFiles('#enc-file',[{name:'IVSLocatorFileExport_1.csv',mimeType:'text/csv',buffer:csvRede},{name:'Stock BMW.csv',mimeType:'text/csv',buffer:csvBMW}]);
  await p.waitForFunction(()=>S.encPrev&&S.encPrev.ficheiros.length===2,null,{timeout:8000}).catch(()=>{});
  const nAntes=est.rpc.length;await p.click('[data-action="enc-confirmar"]');await p.waitForTimeout(900);
  const chamadas=est.rpc.slice(nAntes).map(b=>({o:b.p_origem,n:b.linhas.length,cli:b.linhas.filter(l=>l.customer_last||l.salesperson).length}));
  const sep=await p.$$eval('.enc-or',x=>x.map(b=>b.querySelector('.enc-or-t').textContent+':'+b.querySelector('.enc-or-n').textContent));
  await p.click('[data-action="enc-origem"][data-o="rede"]');await p.waitForTimeout(200);
  const rede={cab:await p.$$eval('.enc-t th',x=>x.map(t=>t.textContent)),linhas:await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length),txt:await p.$eval('.enc-t tbody',x=>x.textContent)};
  await p.click('[data-action="enc-origem"][data-o="tudo"]');await p.waitForTimeout(200);
  const tudoN=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);const tudoOr=await p.$$eval('.enc-pn-or',x=>[...new Set(x.map(e=>e.textContent))].sort());
  await p.fill('#enc-q','porto');await p.waitForTimeout(200);const tudoPorto=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);await p.fill('#enc-q','');
  await p.click('[data-action="enc-origem"][data-o="aveiro"]');await p.waitForTimeout(200);
  const aveiroN=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  R.origens={tres,chamadas,sep,rede,tudoN,tudoOr,tudoPorto,aveiroN};
  await p.evaluate(()=>{S.encErrImp='';S.encPrev=null;S.screen='dashboard';S.gppSec='encomendas';render();});await p.waitForTimeout(200);
  await p.click('[data-action="enc-escolher"][data-pn="9000004"]');await p.waitForTimeout(200);
  const botoes=await p.$$eval('[data-action="enc-novo-negocio"]',x=>x.length);
  await p.click('[data-action="enc-novo-negocio"][data-v="g1"]');await p.waitForTimeout(300);
  await p.fill('input[data-field="id_cliente"]','Cliente do GM');await p.click('.qf [data-action="save-record"]');await p.waitForTimeout(800);
  const postGM=est.posts.slice(-1)[0]||null;
  await p.evaluate(()=>{const f=emptyForm();f.status='Frio';f.id_cliente='Outro';S.selected=null;S.form=f;S.formCompleto=false;S.screen='edit';render();});await p.waitForTimeout(200);
  await p.click('.qf [data-action="save-record"]');await p.waitForTimeout(800);
  R.chefeNovo={botoes,post:postGM,depois:(est.posts.slice(-1)[0]||{}).vendedor_id};
  await ctx.close();}

 // ---------- 2) vendedor: só lê, pesquisa, filtra por caixas ----------
 {const {ctx,p,est,erros,ir}=await abrir('vendedor');
  est.tabela=await (async()=>{const pp=await ctx.newPage();await pp.goto(`http://localhost:${PORTA}/`);await pp.waitForTimeout(800);
    const t=await pp.evaluate(b=>{const rows=encLerCSV(new TextDecoder('windows-1252').decode(new Uint8Array(b)));return encParse(rows).linhas;},[...csvBuf]);await pp.close();return t;})();
  est.negocios=[{id:101,vendedor_id:'u1',status:'Quente',id_cliente:'Cliente Q',model:'R 1300 GS',updated_at:dias(1)},
    {id:102,vendedor_id:'u1',status:'Carteira',id_cliente:'Cliente C',model:'F 900 R',type:'MN',enc:'1234567',mes1:'2027/01',updated_at:dias(1)},
    {id:103,vendedor_id:'u1',status:'Morno',id_cliente:'Cliente M',model:'S 1000 RR',enc:'9000002',updated_at:dias(10)}];
  est.reservas=[{enc:'9000003',negocio_id:900,vendedor_id:'g1',status:'Morno',atualizado:dias(10)},{enc:'9000002',negocio_id:103,vendedor_id:'u1',status:'Morno',atualizado:dias(10)}];
  est.chegadas=[{production_number:'9000005',data_193:'2026-06-20',data_198:'2026-07-03'}];
  await ir();
  const temMenu=await p.$('[data-action="go-vencomendas"]')!==null;
  await p.evaluate(()=>{document.querySelector('[data-action="go-vencomendas"]').click();});await p.waitForTimeout(600);
  const ecra=await p.evaluate(()=>S.screen);const temBotao=await p.$('#enc-file')!==null;
  const nTodos=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  await p.fill('#enc-q','gonçalves');await p.waitForTimeout(300);
  const nPesq=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  await p.fill('#enc-q','5ag 0m21');await p.waitForTimeout(300);
  const nPesq2=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  await p.fill('#enc-q','mendes');await p.waitForTimeout(300);
  const nPesqVend=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  await p.fill('#enc-q','');await p.waitForTimeout(300);
  const cab=await p.$$eval('.enc-t th',x=>x.map(t=>t.textContent));
  const vendCel=await p.evaluate(()=>{const ths=[...document.querySelectorAll('.enc-t th')].map(t=>t.textContent);const iV=ths.indexOf('Negociação'),iP=ths.indexOf('Produção');const o={};
    document.querySelectorAll('.enc-t tbody tr:not(.enc-grp)').forEach(tr=>{const td=tr.children;const s=td[iV].querySelector('.vtag');o[td[iP].textContent]=s?s.textContent+'|'+(s.title||''):'';});return o;});
  const diasSt=await p.evaluate(()=>{const ths=[...document.querySelectorAll('.enc-t th')].map(t=>t.textContent);const iD=ths.findIndex(t=>/^Data do estado/.test(t)),iP=ths.indexOf('Produção');const o={};
    document.querySelectorAll('.enc-t tbody tr:not(.enc-grp)').forEach(tr=>{const td=tr.children;const b=iD>=0?[...td[iD].querySelectorAll('.enc-ds')].map(e=>e.textContent.trim()).join(' | '):'';o[td[iP].textContent]=iD<0?'(sem coluna)':b;});return {o,resumo:((document.querySelector('.enc-stock')||{}).textContent||'').replace(/\s+/g,' ').trim()};});
  await p.click('[data-action="enc-ordem"]');await p.waitForTimeout(250);
  const porStock=await p.evaluate(()=>[...document.querySelectorAll('.enc-t tbody tr')].map(tr=>tr.classList.contains('enc-grp')?'#'+tr.textContent.replace(/\s+/g,' ').trim():tr.children[0].textContent));
  // sem a reserva do 103, a 9000002 fica livre
  const livre=await p.evaluate(()=>{const r=S.records.find(x=>x.id===103);const e=r.enc;const R0=S.encRes;r.enc='';S.encRes=(S.encRes||[]).filter(x=>x.enc!=='9000002');render();
    const o={resumo:((document.querySelector('.enc-stock')||{}).textContent||'').replace(/\s+/g,' ').trim(),linhas:[...document.querySelectorAll('.enc-t tbody tr')].slice(0,5).map(tr=>tr.classList.contains('enc-grp')?'#'+tr.textContent.replace(/\s+/g,' ').trim():tr.children[0].textContent)};
    r.enc=e;S.encRes=R0;render();return o;});
  await p.click('[data-action="enc-ordem"]');await p.waitForTimeout(200);
  const filtroVend=await p.evaluate(()=>[...new Set(S.enc.map(x=>encValor(x,'_vend')))].sort());
  await p.click('[data-action="enc-painel"]');await p.waitForTimeout(200);
  await p.uncheck('input[data-enc-g="processing_type"][value="ST"]');await p.waitForTimeout(300);
  const nSemST=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  await p.click('[data-action="enc-todos"][data-g="model_desc"][data-v="0"]');await p.waitForTimeout(300);
  const nNenhum=await p.$$('.enc-t tbody tr:not(.enc-grp)').then(x=>x.length);
  await p.click('[data-action="enc-todos"][data-g="model_desc"][data-v="1"]');await p.waitForTimeout(300);
  await p.uncheck('input[data-enc-col="options"]');await p.waitForTimeout(300);
  const colOpcionais=await p.$$eval('.enc-t th',x=>x.map(t=>t.textContent).includes('Opcionais'));
  const ordem=await p.evaluate(()=>encFiltrar(S.enc,S.encF||{}).map(x=>x.model_code+':'+x.processing_type));
  await p.setViewportSize({width:390,height:800});await p.waitForTimeout(300);
  const scrollPagina=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  await p.screenshot({path:path.join(__dirname,'encomendas.png')});
  // ---- negociação
  await p.setViewportSize({width:1600,height:900});await p.uncheck('input[data-enc-col="options"]').catch(()=>{});
  await p.evaluate(()=>{S.encF={q:'',ex:{}};S.encCols=[];S.encPainel=false;render();});await p.waitForTimeout(200);
  const negDe=()=>p.evaluate(()=>{const o={};const ths=[...document.querySelectorAll('.enc-t th')].map(t=>t.textContent);const iP=ths.indexOf('Produção'),iN=ths.indexOf('Negociação');
    document.querySelectorAll('.enc-t tbody tr:not(.enc-grp)').forEach(tr=>{const td=tr.children;o[td[iP].textContent]={txt:td[iN].textContent.replace(/\s+/g,' ').trim(),liv:!!td[iN].querySelector('[data-action="enc-libertar"]'),res:!!td[iN].querySelector('[data-action="enc-escolher"]')};});return o;});
  const neg1=await negDe();
  await p.click('[data-action="enc-escolher"][data-pn="9000004"]');await p.waitForTimeout(200);
  const modal=await p.$$eval('.enc-m-i',x=>x.map(b=>b.textContent.replace(/\s+/g,' ').trim()));
  await p.click('.enc-m-i[data-id="101"]');await p.waitForTimeout(600);
  const patch=est.patches.slice(-1)[0];const neg2=await negDe();const modalFechou=await p.$('.enc-modal')===null;
  const alertas=await p.evaluate(()=>calcAlerts(S.records).map(a=>a.id));
  // campo Encomenda no negócio
  await p.evaluate(()=>{S.selected=S.records.find(r=>r.id===101);S.form=recordToForm(S.selected);S.openGroups={Viatura:true};S.formCompleto=true;S.screen='edit';render();});await p.waitForTimeout(300);
  const opcoes=await p.$$eval('#enc-livres option',x=>x.map(o=>o.value));
  await p.fill('input[data-field="enc"]','9000003');await p.waitForTimeout(200);
  const dicaOcupada=await p.textContent('#enc-dica');
  await p.fill('input[data-field="enc"]','1111111');await p.waitForTimeout(200);
  const dicaFora=await p.textContent('#enc-dica');
  // ---- negócio novo a partir da encomenda
  await p.evaluate(()=>{S.screen='vencomendas';render();});await p.waitForTimeout(200);
  await p.click('[data-action="enc-escolher"][data-pn="9000006"]');await p.waitForTimeout(200);
  await p.click('[data-action="enc-novo-negocio"]');await p.waitForTimeout(300);
  const novoForm=await p.evaluate(()=>({ecra:S.screen,enc:S.form.enc,model:S.form.model,status:S.form.status,banner:(document.querySelector('.enc-novo-ban')||{}).textContent||''}));
  await p.fill('input[data-field="id_cliente"]','Cliente Novo');
  await p.click('.qf [data-action="save-record"]');await p.waitForTimeout(800);
  const novoPost=est.posts.slice(-1)[0]||null;
  R.neg={novoForm,novoPost,neg1,modal,patch,neg2,modalFechou,alertas,opcoes,dicaOcupada,dicaFora};
  R.vendedor={diasSt,porStock,livre,nPesqVend,cab,vendCel,filtroVend,temMenu,ecra,temBotao,nTodos,nPesq,nPesq2,nSemST,nNenhum,colOpcionais,ordem,scrollPagina,erros};
  await ctx.close();}

 console.log(JSON.stringify(R,null,1));
 const c=R.chefeCSV,x=R.chefeXLSX,v=R.vendedor;
 const ordemEsperada=['0E91:CS','0M21:CS','0M21:US','0M21:DE','0M21:ST','0R31:ST']; // estado 198,198,193,150,111,47
 const checks={
  'chefe tem botão de carregar':c.temBotao,
  'CSV: 6 encomendas, linha JSON ignorada, origem Aveiro':c.prev&&c.prev.n===6&&c.prev.semJson&&c.prev.origem==='aveiro',
  'CSV: acentos (Windows-1252) certos':c.prev&&c.prev.cliente==='Gonçalves Simão',
  'CSV: 0,00E+00 recuperado do chassis como 0E91':c.prev&&c.prev.corr.length===1&&c.prev.corr[0].para==='0E91'&&c.prev.susp===0,
  'CSV: ordem Estado (desc.) → Model Code → ST, US, DE, CS':c.prev&&JSON.stringify(c.prev.ordem)===JSON.stringify(ordemEsperada),
  'CSV: datas dd.mm.aaaa e dd/mm/aaaa lidas':c.prev&&c.prev.datas.ts_order_status==='2026-07-03'&&c.prev.datas.conf_f3_from==='2026-07-01'&&c.prev.datas.actual_prod_date==='2026-01-28',
  'grava tudo numa chamada, sem campos internos':c.rpcChamado===1&&c.enviadoN===6&&c.camposExtra.length===0,
  'tabela mostra 6 linhas em 5 grupos de estado':c.linhasTabela===6&&c.grupos===5,
  'Excel: lido, código 0 recuperado, datas certas':x.n===6&&x.cod==='0E91'&&x.data==='2026-07-03',
  'Excel: comparação com o mapa atual':x.entram===0&&x.saem===0&&x.mudam===0,
  'origens: Rede pelo critério do portal, BMW pelo nome, desconhecido pede escolha':JSON.stringify(R.origens.tres.origens)===JSON.stringify(['rede','bmw',null])&&R.origens.tres.bloqueado,
  'origens: grava cada origem à parte, sem cliente/vendedor da Rede':JSON.stringify(R.origens.chamadas)===JSON.stringify([{o:'rede',n:2,cli:0},{o:'bmw',n:1,cli:0}]),
  'origens: separadores com contagens e Aveiro intacto':JSON.stringify(R.origens.sep)===JSON.stringify(['Stock Aveiro:6','Stock Rede:2','Stock BMW:1','Tudo:9'])&&R.origens.aveiroN===6,
  'Stock Rede: mostra concessionário e zona, sem coluna Cliente':R.origens.rede.linhas===2&&R.origens.rede.cab.includes('Concessionário')&&R.origens.rede.cab.includes('Zona')&&!R.origens.rede.cab.includes('Cliente')&&/J&M Motos/.test(R.origens.rede.txt)&&/Norte/.test(R.origens.rede.txt)&&!/Paulo Cliente/.test(R.origens.rede.txt),
  'Tudo: as três origens, pesquisa por concessionário':R.origens.tudoN===9&&JSON.stringify(R.origens.tudoOr)===JSON.stringify(['Aveiro','BMW','Rede'])&&R.origens.tudoPorto===1,
  'ficheiro errado: erro claro e nada gravado':/cabeçalhos/.test(R.ficheiroErrado.erro)&&R.ficheiroErrado.rpc===1,
  'vendedor: tem o menu e abre o ecrã':v.temMenu&&v.ecra==='vencomendas',
  'vendedor: sem botão de carregar':!v.temBotao,
  'vendedor: vê as 6':v.nTodos===6,
  'pesquisa por cliente com acento':v.nPesq===1,
  'pesquisa com 2 palavras (opcional + código)':v.nPesq2===2,
  'caixa ST desmarcada tira as 2 ST':v.nSemST===4,
  '"Nenhum" num grupo esconde tudo':v.nNenhum===0,
  'coluna Opcionais escondida':!v.colOpcionais,
  'sem scroll horizontal da página no telemóvel':!v.scrollPagina,
  'ordem das colunas':JSON.stringify(v.cab)===JSON.stringify(['Produção','Chassis','Código','Modelo','Cor','Opcionais','Estado','Data do estadodias desde 193 / 198','Tipo','Produzida a','Semana de entrega','Entrega prevista de','Entrega prevista até','Cliente','Negociação']),
  'dias em stock: desde 193 e, se passou a 198, também desde 198 (datas guardadas)':v.diasSt.o['9000002']==='193 · '+diasDe('01.09.2026')+' d'&&v.diasSt.o['9000005']==='193 · '+diasDe('20.06.2026')+' d | 198 · '+diasDe('03.07.2026')+' d'&&v.diasSt.o['9000001']==='198 · '+diasDe('16.10.2026')+' d'&&v.diasSt.o['9000004']===''&&v.diasSt.o['9000003']===''&&v.diasSt.o['9000006']==='',
  'resumo: motas no stand; com cliente ou em negociação não contam como livres':v.diasSt.resumo==='3 no stand (193/198) · 0 livres'&&new RegExp('3 no stand \\(193/198\\) · 1 livre · média '+diasDe('01.09.2026')+' dias').test(v.livre.resumo)&&new RegExp('Mais antiga livre: R 1300 GS · cor N52 · '+diasDe('01.09.2026')+' dias · prod. 9000002').test(v.livre.resumo),
  'ordenar por tempo em stock: livres primeiro, depois as ocupadas, as mais antigas no topo':JSON.stringify(v.porStock.slice(0,5))===JSON.stringify(['#Em stock · vendidas ou em negociação 3 motas','9000005','9000002','9000001','#Ainda não chegaram ao stand 3 motas'])&&JSON.stringify(v.livre.linhas)===JSON.stringify(['#Em stock · livres para vender 1 mota','9000002','#Em stock · vendidas ou em negociação 2 motas','9000005','9000001']),
  'sem coluna Vendedor: sigla BMW (GM/FG) em Negociação, cm0… escondido':v.vendCel['9000005']==='GM|Gonçalo Mendes (sigla BMW)'&&v.vendCel['9000001']==='FG|António Felipe Gomes (sigla BMW)'&&v.vendCel['9000004']===''&&!v.cab.includes('Vendedor'),
  'filtro Vendedor junta negociação e sigla BMW':JSON.stringify(v.filtroVend)===JSON.stringify(['(ninguém)','FG · António Felipe Gomes','GM · Gonçalo Mendes','Teste']),
  'pesquisa pelo nome do vendedor (BMW e quem negoceia)':v.nPesqVend===2,
  'colega a negociar: aparece com dias parada, sem Libertar':/Em negociação/.test(R.neg.neg1['9000003'].txt)&&/parada há 10 dias/.test(R.neg.neg1['9000003'].txt)&&!R.neg.neg1['9000003'].liv,
  'a minha reserva: tem Libertar':R.neg.neg1['9000002'].liv,
  'mota livre: botão Estou a negociar':R.neg.neg1['9000004'].res,
  'encomenda de cliente BMW sem negócio':/Cliente BMW/.test(R.neg.neg1['9000005'].txt),
  'escolha lista Quente e Morno, mesmo modelo primeiro':R.neg.modal.length===2&&/Cliente Q/.test(R.neg.modal[0])&&/mesmo modelo/.test(R.neg.modal[0])&&/vai ser trocada/.test(R.neg.modal[1]),
  'reservar grava a Encomenda no negócio':R.neg.patch&&R.neg.patch.id==='101'&&R.neg.patch.body.enc==='9000004'&&R.neg.modalFechou&&/Em negociação/.test(R.neg.neg2['9000004'].txt)&&R.neg.neg2['9000004'].liv,
  'alertas: reserva parada e carteira fora do mapa':R.neg.alertas.includes('enc_parada')&&R.neg.alertas.includes('enc_fora_mapa'),
  'campo Encomenda sugere só motas livres (e a do próprio negócio)':R.neg.opcoes.includes('9000004')&&!R.neg.opcoes.includes('9000003')&&!R.neg.opcoes.includes('9000002')&&!R.neg.opcoes.includes('9000005'),
  'campo Encomenda avisa mota com colega':/Já está com Gonçalo Mendes/.test(R.neg.dicaOcupada),
  'campo Encomenda avisa número fora do mapa':/não está no mapa BMW/.test(R.neg.dicaFora),
  'vendedor: negócio novo a partir da encomenda abre já preenchido':R.neg.novoForm.ecra==='edit'&&R.neg.novoForm.enc==='9000006'&&R.neg.novoForm.model==='F 450 GS'&&R.neg.novoForm.status==='Quente'&&/9000006/.test(R.neg.novoForm.banner),
  'vendedor: gravar cria o negócio com a encomenda':R.neg.novoPost&&R.neg.novoPost.enc==='9000006'&&R.neg.novoPost.id_cliente==='Cliente Novo'&&R.neg.novoPost.status==='Quente',
  'chefe: negócio novo fica no vendedor escolhido':R.chefeNovo&&R.chefeNovo.botoes>=3&&R.chefeNovo.post&&R.chefeNovo.post.vendedor_id==='g1'&&R.chefeNovo.post.enc==='9000004',
  'chefe: negócio normal depois não herda o vendedor':R.chefeNovo&&R.chefeNovo.depois==='u1',
  'sem erros JS':!c.erros.length&&!v.erros.length,
 };
 let f=0;for(const [k,ok] of Object.entries(checks)){console.log((ok?'✓ ':'✗ ')+k);if(!ok)f++;}
 console.log(f?`FALHOU (${f})`:'Encomendas BMW corretas');await b.close();srv.close();process.exit(f?1:0);
})();
