// Ecrãs ligados às regras de segurança: o vendedor só vê "Apagar" em negócios que pode mesmo apagar,
// e uma conta nova ("pendente") vê a mensagem de espera. Supabase simulado.
const {chromium}=require('playwright');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const p=await b.newPage();
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await p.goto('file://'+FILE);await p.waitForTimeout(400);
  const apagarVisivel=async(reg,extra)=>p.evaluate(([reg,extra])=>{S.me={id:'v1',role:'vendedor',nome:'V'};S.records=[reg];S.margens=extra.margens||{};S.fichasIdx=extra.fichas||{};
    setState({screen:'detail',selected:reg,confirmDelete:false});return !!document.querySelector('[data-action="ask-delete"]');},[reg,extra||{}]);
  const r={
    retail:await apagarVisivel({id:1,status:'Retail',vendedor_id:'v1'}),
    carteira:await apagarVisivel({id:2,status:'Carteira',vendedor_id:'v1'}),
    frioComMargem:await apagarVisivel({id:3,status:'Frio',vendedor_id:'v1'},{margens:{'3':{margem:1}}}),
    quenteComFicha:await apagarVisivel({id:4,status:'Quente',vendedor_id:'v1'},{fichas:{'4':true}}),
    frioLimpo:await apagarVisivel({id:5,status:'Frio',vendedor_id:'v1'}),
  };
  r.chefeRetail=await p.evaluate(()=>{S.me={id:'a',role:'admin',nome:'C'};const reg={id:1,status:'Retail',vendedor_id:'v1'};setState({screen:'detail',selected:reg,confirmDelete:false});return !!document.querySelector('[data-action="ask-delete"]');});
  r.pendente=await p.evaluate(()=>{S.me={id:'n',role:'pendente',nome:'Novo'};setState({screen:ecraInicial()});return document.body.innerText.includes('À espera de aprovação');});
  console.log(JSON.stringify(r));
  const ok=!r.retail&&!r.carteira&&!r.frioComMargem&&!r.quenteComFicha&&r.frioLimpo&&r.chefeRetail&&r.pendente;
  console.log(ok?'Ecrãs de segurança corretos':'FALHOU');await b.close();process.exit(ok?0:1);
})();
