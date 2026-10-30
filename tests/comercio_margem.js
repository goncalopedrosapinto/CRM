// Vendas › Comerciante: margem de cada venda a comerciante (saída − entrada, menos oficina e legalização já gastas se a mota
// estiver no stock; sem garantia nem comissão), total no topo, quantas a perder dinheiro e sem valor de entrada; a entrada
// escreve-se na própria linha (grava no negócio). Usadas › Margem passa a mostrar as vendas a comerciante com a mesma conta
// e não muda nas vendas normais. Dados fictícios.
const {chromium}=require('playwright');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const p=await b.newPage({viewport:{width:1440,height:900}});const erros=[];p.on('pageerror',e=>erros.push(e.message));
 const patches=[];
 await p.route('**/*',r=>{const u=decodeURIComponent(r.request().url());if(u.startsWith('file:'))return r.continue();
   if(r.request().method()==='PATCH'&&/baviera_control/.test(u)){patches.push([(u.match(/id=eq\.(\d+)/)||[])[1],JSON.parse(r.request().postData()||'{}')]);
     return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:Number((u.match(/id=eq\.(\d+)/)||[])[1])}])});}
   return r.fulfill({status:200,contentType:'application/json',body:'[]'});});
 await p.goto('file://'+FILE);await p.waitForTimeout(500);
 const vd=(id,o)=>Object.assign({id,vendedor_id:'v1',status:'Retail',type:'MU',venda_direta:true,origin:'Comerciante',neg:'2026-10-20'},o);
 const montar=()=>p.evaluate(recs=>{S.token='t';S.me={id:'c1',role:'admin',nome:'Chefe'};S.team=[{id:'v1',nome:'Felipe Gomes',role:'vendedor'}];
   S.records=recs;S.stockLoaded=true;
   S.stock=[{id:31,modelo:'R 1200 GS',matricula:'AA-11-BB',valor_entrada:7000,prep_oficina:300,prep_legalizacao:100,prep_garantia:250,dep_manual:0,estado:'Vendida',categoria:'usada',data_rececao:'2026-09-01'},
     {id:32,modelo:'F 850 GS',matricula:'CC-22-DD',valor_entrada:9000,prep_oficina:300,prep_legalizacao:100,prep_garantia:250,dep_manual:0,estado:'Vendida',categoria:'usada',data_rececao:'2026-08-01'}];},
   [vd(1,{id_cliente:'Motos Alfa Lda',model:'QJMotor SRT 700 X',mat:'BP46MG',pvp:'4700.00',valor_entrada:'4500',col_298:'2026-10-29'}),
    vd(2,{id_cliente:'Motos Alfa Lda',model:'MT 09 SP',mat:'CH71PQ',pvp:'10000.00',valor_entrada:'10000',col_298:'2026-10-26'}),
    vd(3,{id_cliente:'Comércio Beta',model:'Honda Africa Twin',mat:'42RH73',pvp:'6000.00',valor_entrada:'6500',col_298:'2026-10-26'}),
    vd(4,{id_cliente:'Comércio Beta',model:'R 1200 GS',mat:'aa 11 bb',pvp:'8000.00',col_298:'2026-10-15'}),          // ligada ao stock pela matrícula
    vd(5,{id_cliente:'Comércio <b>Gama</b>',model:'Can-Am',mat:'BU69JV',pvp:'5000.00',col_298:'2026-10-10'}),        // sem valor de entrada
    {id:9,vendedor_id:'v1',status:'Retail',type:'MU',id_cliente:'Cliente final',model:'F 850 GS',mat:'CC-22-DD',stock_id:32,pvp:'11000',neg:'2026-10-12',col_298:'2026-10-14'}]);
 await montar();
 const ver=()=>p.evaluate(()=>{const t=document.querySelector('.com-tbl');const tx=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   return {topo:tx(document.querySelector('.gpp-tot-head')),cab:[...t.querySelectorAll('thead th')].map(tx),
     linhas:[...t.querySelectorAll('tbody tr')].map(r=>({id:r.dataset.id,ent:(r.querySelector('input[data-mg-f="valor_entrada"]')||{}).value,ph:(r.querySelector('input[data-mg-f="valor_entrada"]')||{}).placeholder,
       saida:tx(r.cells[7]),margem:tx(r.cells[8]),cor:(r.querySelector('.com-mg b')||{style:{}}).style.color||'',tit:(r.querySelector('.com-mg')||{}).title||''})),
     nomeHtml:t.querySelector('tbody').innerHTML.includes('&lt;b&gt;Gama&lt;/b&gt;'),nota:tx(document.querySelector('.gpp-pend-desc'))};});
 await p.evaluate(()=>{S.screen='dashboard';S.gppSec='comercio';render();});await p.waitForTimeout(200);
 const A=await ver();await p.screenshot({path:path.join(__dirname,'comercio_margem.png')});
 // escrever a entrada que faltava, na própria linha (número à portuguesa)
 await p.fill('tr[data-id="5"] input[data-mg-f="valor_entrada"]','4 800');await p.press('tr[data-id="5"] input[data-mg-f="valor_entrada"]','Tab');await p.waitForTimeout(500);
 const B=await ver();
 // clicar no campo não abre o negócio; clicar no resto da linha abre
 await p.click('tr[data-id="2"] input[data-mg-f="valor_entrada"]');await p.waitForTimeout(150);const naoAbriu=await p.evaluate(()=>S.screen);
 await p.click('tr[data-id="3"] td.com-mg');await p.waitForTimeout(300);const abriu=await p.evaluate(()=>({ecra:S.screen,id:S.selected&&S.selected.id}));
 // Usadas › Margem: vendas a comerciante com a mesma conta; venda normal igual a antes (com garantia e comissão)
 const U=await p.evaluate(()=>{S.screen='dashboard';S.gppSec='margem';S.dashMes='2026/10';S.perTipo='mes';render();
   const tx=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   const lin=[...document.querySelectorAll('tr.gpp-lrow2')].map(r=>({cli:tx(r.cells[1]),margem:tx(r.cells[r.cells.length-1]),prep:tx(r.cells[7])}));
   const cm=comissaoUsada(9650,11000).valor;return {lin,esperadoNormal:11000-(9000+650+cm),cm};});
 await p.screenshot({path:path.join(__dirname,'comercio_margem_usadas.png')});
 console.log(JSON.stringify({A,B,naoAbriu,abriu,patches,U,erros},null,1));
 const L=(X,id)=>X.linhas.find(l=>l.id===String(id))||{};const eur=n=>n.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
 const fmt=n=>(n>0?'+':(n<0?'−':''))+Math.abs(n).toLocaleString('pt-PT',{maximumFractionDigits:0})+' €';
 const ok={
  'colunas: Entrada, Saída e Margem':JSON.stringify(A.cab.slice(-3))==='["Entrada","Saída","Margem"]',
  'topo: margem total, a perder dinheiro e sem valor de entrada':/5 motas · 33 700 € · margem \+300 € · 1 a perder dinheiro · 1 sem valor de entrada/.test(A.topo),
  'ganhou: +200 € (4,3 % da saída), a verde':/^\+200 € ?4,3 %$/.test(L(A,1).margem)&&/green/.test(L(A,1).cor)&&L(A,1).ent==='4500',
  'empate: 0 €':/^0 €/.test(L(A,2).margem),
  'perdeu: −500 €, a vermelho':/^−500 € ?−8,3 %$/.test(L(A,3).margem)&&/red/.test(L(A,3).cor),
  'ligada ao stock pela matrícula: entrada do stock, desconta oficina e legalização (sem garantia)':/^\+600 €/.test(L(A,4).margem)&&L(A,4).ph==='7000 · stock'&&/oficina\/legalização 400 €/.test(L(A,4).tit),
  'sem valor de entrada: diz o que falta e nome do comerciante escapado':L(A,5).margem==='sem valor de entrada'&&A.nomeHtml,
  'nota explica a conta':/Margem = saída − entrada/.test(A.nota)&&/sem garantia nem comissão/.test(A.nota),
  'escrever a entrada na linha grava no negócio e atualiza a margem':JSON.stringify(patches.map(x=>[x[0],x[1].valor_entrada]))==='[["5",4800]]'&&/^\+200 €/.test(L(B,5).margem)&&/margem \+500 €/.test(B.topo)&&!/sem valor de entrada/.test(B.topo),
  'clicar no campo não abre o negócio; o resto da linha abre':naoAbriu==='dashboard'&&abriu.ecra==='detail'&&abriu.id===3,
  'Usadas › Margem: vendas a comerciante com a mesma conta':/\+?200,00 €|200,00 €/.test((U.lin.find(l=>/Motos Alfa/.test(l.cli)&&/200/.test(l.margem))||{}).margem||'')&&
    !!U.lin.find(l=>/Comércio Beta/.test(l.cli)&&l.margem===eur(600)&&l.prep===eur(400))&&!!U.lin.find(l=>/Comércio Beta/.test(l.cli)&&l.margem===eur(-500)),
  'Usadas › Margem: venda normal igual a antes (garantia e comissão contam)':!!U.lin.find(l=>/Cliente final/.test(l.cli)&&l.margem===eur(U.esperadoNormal)),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Margem das vendas a comerciante correta');await b.close();process.exit(f?1:0);})();
