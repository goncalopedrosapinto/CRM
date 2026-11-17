// PDF da ficha de margem: cartões no topo, taxa de esforço (barra e conta), detalhe em duas colunas e assinaturas no fundo de uma única folha A4,
// com os números certos (sinal de menos, milhares agrupados, espaço fino antes de € e %, 1 casa nos cartões), letra Inter, nada abaixo de 7 pt,
// um só fundo vermelho (o aviso), c/IVA só nas exceções e as linhas a zero marcadas;
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
  const tem=await q.evaluate(()=>({subvencao:/Subvenção Concessionário/.test(document.body.textContent),resumo:document.querySelectorAll('.kp .k').length,colunas:document.querySelectorAll('.cols .col').length,blocos:[...document.querySelectorAll('.bt')].map(e=>e.firstChild.textContent).join('|'),largura:document.documentElement.scrollWidth<=document.documentElement.clientWidth,dentro:[...document.querySelectorAll('.kp,.esf,.cols,.ass,table.r')].every(e=>e.getBoundingClientRect().right<=document.body.getBoundingClientRect().right+0.5),esforco:/Esforço/.test(document.body.textContent),taxa:[...document.querySelectorAll('.esf .ek')].map(e=>e.textContent).join('|'),tipo:(()=>{const T=sel=>[...document.querySelectorAll(sel)].map(e=>e.textContent.replace(/⁠/g,'')).join(' | ');
      const nums=T('.kp .rv')+' | '+T('.kp .rs')+' | '+T('.esf .ev')+' | '+T('table.r td.num');
      const vis=[...document.querySelectorAll('body *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));
      const rgb=c=>(c.match(/\d+(\.\d+)?/g)||[]).map(Number);
      const vermelhos=[...document.querySelectorAll('body *')].filter(e=>!e.matches('.sg,.sw')).filter(e=>{const [r,g,b2,a]=rgb(getComputedStyle(e).backgroundColor);return (a===undefined||a>0)&&r>200&&r-g>10&&r-b2>10;}).map(e=>e.className);
      return {hifen:/-\d/.test(nums),quatro:/\d{4}/.test(nums.replace(/\d+\/\d+\/\d+/g,'')),unidade:!/[^ ][€%]/.test(nums),kp1:(T('.kp .rv').match(/\d,\d+ %/g)||[]).every(x=>/^\d,\d %$/.test(x.slice(-5))),
        fonte:/@font-face\{font-family:"Inter PDF"/.test(document.head.innerHTML),minimo:Math.min(...vis.map(e=>parseFloat(getComputedStyle(e).fontSize))),vermelhos,
        fundo:Math.round(document.body.getBoundingClientRect().height-document.querySelector('.ass').getBoundingClientRect().bottom),altura:document.body.getBoundingClientRect().height,
        iva:document.querySelectorAll('.iva').length,zeros:document.querySelectorAll('tr.z').length,cab:document.querySelector('.mh h1').textContent};})(),barra:document.querySelectorAll('.esf .bar .sg').length,marca:document.querySelectorAll('.esf .mk').length,assinatura:document.querySelectorAll('.ass .ln').length,zoom:document.body.style.zoom||'1'}));
  const pdf=await q.pdf({preferCSSPageSize:true,printBackground:true});
  const paginas=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  console.log(JSON.stringify(Object.assign({paginas},tem)));
  const T=tem.tipo;const tipoOk=!T.hifen&&!T.quatro&&T.unidade&&T.kp1&&T.fonte&&T.minimo>=9.33&&JSON.stringify(T.vermelhos)==='["aprov"]'&&Math.abs(T.fundo)<=1&&T.altura>=1040&&T.iva===3&&T.zeros>0&&/^R 1300 GS Adventure/.test(T.cab);
  if(!tipoOk)console.log('tipografia: '+JSON.stringify(T));
  const ok=tipoOk&&paginas===1&&tem.resumo===5&&tem.esforco&&tem.taxa.startsWith('Desconto ao cliente|Custos do concessionário|Margem fixa|Esforço|Apoios|Margem variável')&&tem.barra>=2&&tem.marca===1&&tem.colunas===2&&tem.blocos==='Como na plataforma|Impostos|Custos do concessionário|Descontos e apoios|Venda'&&tem.dentro&&tem.assinatura===3&&tem.subvencao;
  console.log(ok?'PDF da ficha numa folha':'FALHOU');await b.close();process.exit(ok?0:1);
})();
