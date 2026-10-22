// Home do chefe e Previsão do mês: as vendas a comerciante do mês de faturação (298) ficam identificadas
// por baixo da tabela e assinaladas na célula onde contam. Dados fictícios.
const {chromium}=require('playwright');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const p=await b.newPage({viewport:{width:1440,height:900}});const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await p.goto('file://'+FILE);await p.waitForTimeout(500);
 const R=await p.evaluate(()=>{
  S.token='t';S.me={id:'c1',role:'admin',nome:'Chefe'};S.team=[{id:'v1',nome:'Vendedor Um',role:'vendedor'}];
  S.records=[
   {id:1,vendedor_id:'v1',status:'Retail',type:'MU',id_cliente:'Cliente A',model:'R 1250 GS',col_298:'2026-07-10'},
   {id:2,vendedor_id:'v1',status:'Retail',type:'MU',id_cliente:'Motos <b>Lda</b>',model:'R 1200 GS',mat:'17-MQ-38',venda_direta:true,col_298:'2026-07-20'},
   {id:3,vendedor_id:'v1',status:'Retail',type:'MN',id_cliente:'Cliente B',model:'F 900 GS',col_298:'2026-07-05'},
   {id:4,vendedor_id:'v1',status:'Retail',type:'MU',id_cliente:'Outro Comércio',model:'K 1600',venda_direta:true,col_298:'2026-08-02'}];
  S.screen='dashboard';S.gppSec='home';S.dashMes='2026/07';S.perTipo='mes';render();
  const nota=document.querySelector('.gpp-com-nota');const subs=[...document.querySelectorAll('.gpp-num-sub')].map(x=>x.textContent);
  const home={nota:nota?nota.textContent.replace(/\s+/g,' ').trim():'',clicavel:!!(nota&&nota.querySelector('li[data-action="open-record-from-dash"][data-id="2"]')),subs,html:nota?nota.innerHTML:''};
  S.me={id:'j1',role:'secretario',nome:'João',areas:['previsao']};S.screen='previsao';S.prevMes='2026/07';render();
  const n2=document.querySelector('.gpp-com-nota');
  const prev={nota:n2?n2.textContent.replace(/\s+/g,' ').trim():'',clicavel:!!(n2&&n2.querySelector('[data-action]'))};
  S.prevMes='2026/09';render();prev.semComercio=!document.querySelector('.gpp-com-nota');
  return{home,prev};});
 console.log(JSON.stringify(R,null,1));
 const ok={
  'home: nota do mês com a mota para o comércio':/1 mota para o comércio/.test(R.home.nota)&&/R 1200 GS · 17-MQ-38/.test(R.home.nota)&&/Motos <b>Lda<\/b>/.test(R.home.nota),
  'home: só a do mês de faturação (julho, não agosto)':!/Outro Comércio/.test(R.home.nota),
  'home: nome do comerciante escapado':!/<b>Lda<\/b>/.test(R.home.html.replace(/&lt;b&gt;Lda&lt;\/b&gt;/,'')),
  'home: célula MU assinalada':JSON.stringify(R.home.subs)===JSON.stringify(['1 comércio']),
  'home: abre o negócio':R.home.clicavel,
  'previsão: mesma nota, sem abrir negócio':/1 mota para o comércio/.test(R.prev.nota)&&!R.prev.clicavel,
  'mês sem comércio: sem nota':R.prev.semComercio,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Comércio no Home correto');await b.close();process.exit(f?1:0);})();
