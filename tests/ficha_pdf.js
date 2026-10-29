// PDF da ficha de margem: resumo no topo, ficha completa e assinaturas numa única folha A4,
// mesmo com todas as alíneas preenchidas, nomes longos e aviso de aprovação.
const {chromium}=require('playwright');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const p=await b.newPage();
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await p.goto('file://'+FILE);await p.waitForTimeout(300);
  const html=await p.evaluate(()=>{S.me={id:'u',role:'vendedor',nome:'Nome Comprido de Vendedor'};
    S.fm={natureza:'MN',iva:23,modo:'civa',fv:2,pvb:'10000',isv:'0',sgpu:'0',mg_fixa_pct:'6',mg_var_pct:'3.5',preco_venda:'9050',compart_conc:'77',subv_conc:'60',pvp_plat:'10000',
      cliente:'Maria Antónia Fernandes de Albuquerque e Castro Sobrinho',modelo:'R 1300 GS Adventure Option 719 Triple Black com pack conforto',proposta:'PRP-2026-000123',
      pagamento:'BMW Financial Services',tipo:'Empresa',recondicionamento:'123',ofertas:'50',protocolo_pct:'2',apoio_demo_pct:'1',apoio_adic_pct:'0.5',depreciacoes:'100',
      apoio:'50',pac:'200',bsi:'300',acess_marca:'150',acess_conc:'80',ecovalor:'5',iuc_s:'20',transporte:'150'};
    let cap='';const o=window.open;window.open=()=>({document:{open(){},write(h){cap+=h},close(){}},focus(){},print(){}});fmPDF();window.open=o;return cap;});
  const q=await b.newPage();await q.setContent(html);await q.waitForTimeout(200);
  const tem=await q.evaluate(()=>({subvencao:/Subvenção Concessionário/.test(document.body.textContent),resumo:document.querySelectorAll('table.res td').length,esforco:/Esforço/.test(document.body.textContent),assinatura:document.querySelectorAll('.ass .ln').length,zoom:document.body.style.zoom||'1'}));
  const pdf=await q.pdf({preferCSSPageSize:true,printBackground:true});
  const paginas=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  console.log(JSON.stringify(Object.assign({paginas},tem)));
  const ok=paginas===1&&tem.resumo===5&&tem.esforco&&tem.assinatura===3&&tem.subvencao;
  console.log(ok?'PDF da ficha numa folha':'FALHOU');await b.close();process.exit(ok?0:1);
})();
