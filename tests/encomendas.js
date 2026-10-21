// Encomendas BMW: o ficheiro do portal (CSV em Windows-1252 com uma linha JSON por cima, ou Excel) é lido pelo formato fixo,
// o código de modelo estragado pelo Excel ("0,00E+00") é recuperado do chassis, a ordem é Model Code e depois ST, US, DE, CS,
// o vendedor só lê (sem botão de carregar), a pesquisa e as caixas de verificação filtram, e o chefe grava tudo de uma vez.
// Dados 100% fictícios (o repositório é público: nunca pôr aqui um ficheiro real, tem apelidos de clientes).
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');const XLSX=require('xlsx');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8766;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=(sub)=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';

// ---------- ficheiro fictício no formato do portal ----------
const CAB='Production Number;Chassis No.;Body Group;Brand;Model Code;Model Description;Model Series;Color Code;Upholstery Code;Options String;Order Template ID;Wholesaler;Dealer Number;Dealer No.;Region;District;Act. Location;Dest. Loc.;Order Status;Timestamp Order Status;Processing Type;Sales Channel;Port Location;Confirmed Production Week;Subsidiary Requested Production Week;Actual Production Date;Conf F3 From;Conf.F3 To;AG Inv. Date;Wholesale Invoice Ind;Retail System Date (GMT);New vehicle retail;Current Release Date;Holds;Customer;Customer (Last);Purchase Agreement Date;P. A. Date / Event Date;TS Order Entry;CO2 Output;Chassis Number 17;Fuel Type;Salesperson Number;Factory;Businesstype;Quota Month;Exp. Del. Wk.;Wholesale Invoice Document Date;Planned F2 Date;Corrected F2 Date;Retail Requested Production Week;Retail Counting Date;Retail Cancellation Date;AG Vehicle Hold;Planned Handover Wk.;Order Template ID;Sub. Notes;Quota PAK;PDI Done'.split(';');
const linha=o=>CAB.map(h=>o[h]==null?'':o[h]);
const L=[
  {'Production Number':'9000005','Chassis No.':'6N00005','Body Group':'KA1','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'N52','Options String':'20B 389 7A8','Order Status':'198','Timestamp Order Status':'03.07.2026','Processing Type':'CS','Actual Production Date':'28.01.2026','Conf F3 From':'01/07/2026','Conf.F3 To':'05/07/2026','Customer (Last)':'Gonçalves Simão','Chassis Number 17':'WB10M2100T6N00005','Exp. Del. Wk.':'20260727'},
  {'Production Number':'9000004','Chassis No.':'','Body Group':'KA1','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'ND2','Options String':'389 413','Order Status':'111','Timestamp Order Status':'09.09.2026','Processing Type':'ST','Actual Production Date':'','Conf F3 From':'18/01/2027','Conf.F3 To':'24/01/2027','Customer (Last)':'','Chassis Number 17':'','Exp. Del. Wk.':'20270103'},
  {'Production Number':'9000003','Chassis No.':'6N00003','Body Group':'KA1','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'N52','Options String':'5AG 6AC','Order Status':'150','Timestamp Order Status':'12.10.2026','Processing Type':'DE','Actual Production Date':'04.11.2026','Conf F3 From':'16/11/2026','Conf.F3 To':'22/11/2026','Customer (Last)':'','Chassis Number 17':'WB10M2100V6N00003','Exp. Del. Wk.':'20261147'},
  {'Production Number':'9000002','Chassis No.':'6N00002','Body Group':'KA1','Model Code':'0M21','Model Description':'R 1300 GS','Color Code':'N52','Options String':'5AG','Order Status':'193','Timestamp Order Status':'01.09.2026','Processing Type':'US','Actual Production Date':'','Conf F3 From':'','Conf.F3 To':'','Customer (Last)':'','Chassis Number 17':'WB10M2100V6N00002','Exp. Del. Wk.':'20260936'},
  {'Production Number':'9000001','Chassis No.':'6N00001','Body Group':'KM9','Model Code':'0,00E+00','Model Description':'M 1000 XR','Color Code':'N3S','Options String':'18F 79A','Order Status':'198','Timestamp Order Status':'16.10.2026','Processing Type':'CS','Actual Production Date':'06.10.2026','Conf F3 From':'12/10/2026','Conf.F3 To':'18/10/2026','Customer (Last)':'Almeida Teste','Chassis Number 17':'WB10E9100V6N00001','Exp. Del. Wk.':'20261042'},
  {'Production Number':'9000006','Chassis No.':'','Body Group':'KD1','Model Code':'0R31','Model Description':'F 450 GS','Color Code':'N2L','Options String':'222 2T1','Order Status':'47','Timestamp Order Status':'17.08.2026','Processing Type':'ST','Actual Production Date':'','Conf F3 From':'','Conf.F3 To':'','Customer (Last)':'','Chassis Number 17':'','Exp. Del. Wk.':''},
];
const csvTxt='"{   ""from"" : 0    ""size"" : 200 }";;;;\n;;;;\n'+[CAB,...L.map(linha)].map(r=>r.join(';')).join('\n')+'\n';
const csvBuf=Buffer.from(csvTxt,'latin1'); // Windows-1252 para estes caracteres
// Excel: o mesmo, com o código 0E91 transformado em número 0 e datas como datas
const aoa=[['relatório'],[],CAB,...L.map(o=>{const r=linha(o);const i=CAB.indexOf('Model Code');if(o['Model Code']==='0,00E+00')r[i]=0;
  const iT=CAB.indexOf('Timestamp Order Status');const m=String(r[iT]).match(/(\d+)\.(\d+)\.(\d+)/);if(m)r[iT]=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return r;})];
const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa,{cellDates:true}),'Folha1');
const xlsxBuf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
const XLSX_JS=fs.readFileSync(path.join(__dirname,'node_modules/xlsx/dist/xlsx.full.min.js'));

(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const R={};
 async function abrir(role){
  const ctx=await b.newContext();const est={tabela:[],rpc:[]};
  await ctx.addInitScript((t)=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('u1'));
  await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('http://localhost'))return r.continue();
   if(u.includes('cdnjs.cloudflare.com/ajax/libs/xlsx'))return r.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:XLSX_JS});
   if(u.includes('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt('u1'),refresh_token:'rt2'})});
   if(u.includes('/rpc/encomendas_bmw_substituir')){const body=JSON.parse(r.request().postData());est.rpc.push(body);
     est.tabela=body.linhas.map(l=>Object.assign({importado_em:new Date().toISOString()},l));return r.fulfill({status:200,contentType:'application/json',body:String(est.tabela.length)});}
   const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
   const body=t==='profiles'?[{id:'u1',nome:'Teste',role,linha:'motorrad',areas:[]}]:t==='encomendas_bmw'?(u.includes('offset=0')?est.tabela:[]):[];
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
  const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return{ctx,p,est,erros};}

 // ---------- 1) chefe: carrega CSV, pré-visualização, confirma ----------
 {const {ctx,p,est,erros}=await abrir('admin');
  await p.evaluate(()=>{S.screen='dashboard';S.gppSec='encomendas';S.encLoaded=false;render();});await p.waitForTimeout(500);
  const temBotao=await p.$('#enc-file')!==null;
  await p.setInputFiles('#enc-file',{name:'encomendas.csv',mimeType:'text/csv',buffer:csvBuf});await p.waitForFunction(()=>S.encPrev||S.encErrImp,null,{timeout:5000}).catch(()=>{});
  const prev=await p.evaluate(()=>{const P=S.encPrev;return P&&{n:P.linhas.length,corr:P.corrigidos,susp:P.suspeitos.length,
    ordem:P.linhas.map(l=>l.model_code+':'+l.processing_type),cliente:P.linhas.find(l=>l.production_number==='9000005').customer_last,
    datas:P.linhas.find(l=>l.production_number==='9000005'),semJson:P.linhas.every(l=>!String(l.production_number).includes('{'))};});
  await p.click('[data-action="enc-confirmar"]');await p.waitForTimeout(600);
  const enviado=est.rpc[0]&&est.rpc[0].linhas;
  R.chefeCSV={temBotao,prev,rpcChamado:est.rpc.length,enviadoN:enviado&&enviado.length,camposExtra:enviado&&Object.keys(enviado[0]).filter(k=>k.startsWith('_')),
    msg:await p.evaluate(()=>S.encMsg),linhasTabela:await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length),grupos:await p.$$eval('.enc-grp',x=>x.length),erros};
  // ---- Excel com o mesmo conteúdo
  await p.setInputFiles('#enc-file',{name:'encomendas.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:xlsxBuf});await p.waitForFunction(()=>S.encPrev||S.encErrImp,null,{timeout:8000}).catch(()=>{});
  R.chefeXLSX=await p.evaluate(()=>{const P=S.encPrev;return P?{n:P.linhas.length,cod:P.linhas.find(l=>l.production_number==='9000001').model_code,
    data:P.linhas.find(l=>l.production_number==='9000005').ts_order_status,mudam:P.mudamEstado,entram:P.entram,saem:P.saem}:{erro:S.encErrImp};});
  // ---- ficheiro errado não estraga nada
  await p.click('[data-action="enc-cancelar"]');await p.waitForFunction(()=>!S.encPrev);await p.waitForTimeout(200);
  await p.setInputFiles('#enc-file',{name:'outro.csv',mimeType:'text/csv',buffer:Buffer.from('a;b;c\n1;2;3\n')});
  await p.waitForFunction(()=>S.encErrImp||S.encPrev,null,{timeout:5000}).catch(()=>{});
  R.ficheiroErrado={erro:await p.evaluate(()=>S.encErrImp),rpc:est.rpc.length};
  await ctx.close();}

 // ---------- 2) vendedor: só lê, pesquisa, filtra por caixas ----------
 {const {ctx,p,est,erros}=await abrir('vendedor');
  est.tabela=await (async()=>{const pp=await ctx.newPage();await pp.goto(`http://localhost:${PORTA}/`);await pp.waitForTimeout(800);
    const t=await pp.evaluate(b=>{const rows=encLerCSV(new TextDecoder('windows-1252').decode(new Uint8Array(b)));return encParse(rows).linhas;},[...csvBuf]);await pp.close();return t;})();
  const temMenu=await p.$('[data-action="go-vencomendas"]')!==null;
  await p.evaluate(()=>{document.querySelector('[data-action="go-vencomendas"]').click();});await p.waitForTimeout(600);
  const ecra=await p.evaluate(()=>S.screen);const temBotao=await p.$('#enc-file')!==null;
  const nTodos=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  await p.fill('#enc-q','gonçalves');await p.waitForTimeout(300);
  const nPesq=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  await p.fill('#enc-q','5ag 0m21');await p.waitForTimeout(300);
  const nPesq2=await p.$$eval('.enc-t tbody tr:not(.enc-grp)',x=>x.length);
  await p.fill('#enc-q','');await p.waitForTimeout(300);
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
  R.vendedor={temMenu,ecra,temBotao,nTodos,nPesq,nPesq2,nSemST,nNenhum,colOpcionais,ordem,scrollPagina,erros};
  await ctx.close();}

 console.log(JSON.stringify(R,null,1));
 const c=R.chefeCSV,x=R.chefeXLSX,v=R.vendedor;
 const ordemEsperada=['0E91:CS','0M21:ST','0M21:US','0M21:DE','0M21:CS','0R31:ST'];
 const checks={
  'chefe tem botão de carregar':c.temBotao,
  'CSV: 6 encomendas, linha JSON ignorada':c.prev&&c.prev.n===6&&c.prev.semJson,
  'CSV: acentos (Windows-1252) certos':c.prev&&c.prev.cliente==='Gonçalves Simão',
  'CSV: 0,00E+00 recuperado do chassis como 0E91':c.prev&&c.prev.corr.length===1&&c.prev.corr[0].para==='0E91'&&c.prev.susp===0,
  'CSV: ordem Model Code → ST, US, DE, CS':c.prev&&JSON.stringify(c.prev.ordem)===JSON.stringify(ordemEsperada),
  'CSV: datas dd.mm.aaaa e dd/mm/aaaa lidas':c.prev&&c.prev.datas.ts_order_status==='2026-07-03'&&c.prev.datas.conf_f3_from==='2026-07-01'&&c.prev.datas.actual_prod_date==='2026-01-28',
  'grava tudo numa chamada, sem campos internos':c.rpcChamado===1&&c.enviadoN===6&&c.camposExtra.length===0,
  'tabela mostra 6 linhas em 3 grupos':c.linhasTabela===6&&c.grupos===3,
  'Excel: lido, código 0 recuperado, datas certas':x.n===6&&x.cod==='0E91'&&x.data==='2026-07-03',
  'Excel: comparação com o mapa atual':x.entram===0&&x.saem===0&&x.mudam===0,
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
  'sem erros JS':!c.erros.length&&!v.erros.length,
 };
 let f=0;for(const [k,ok] of Object.entries(checks)){console.log((ok?'✓ ':'✗ ')+k);if(!ok)f++;}
 console.log(f?`FALHOU (${f})`:'Encomendas BMW corretas');await b.close();srv.close();process.exit(f?1:0);
})();
