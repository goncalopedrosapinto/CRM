// Ficha de margem: esforço = (desconto % + custos internos %) acima da MG. FIXA, tudo sobre Model and Options s/IVA.
// Tem de bater certo com a margem: esforço = MG. VARIÁVEL − margem/base (quando positivo).
const {chromium}=require('playwright');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const p=await b.newPage();
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await p.goto('file://'+FILE);await p.waitForTimeout(300);
  const casos=await p.evaluate(()=>{S.me={id:'u',role:'vendedor',nome:'T'};
    const base={natureza:'MN',iva:23,modo:'civa',fv:2,pvb:'10000',isv:'0',sgpu:'0',mg_fixa_pct:'6',mg_var_pct:'3,5'};
    const pv=d=>String(10000-d*(10000/1.23)*1.23);
    const C=[['9,5 % sem custos',{preco_venda:'9050'},3.5,0],['9,5 % + comparticipação 77 € s/IVA',{preco_venda:'9050',compart_conc:'77'},4.447,-77],
      ['9,5 % + preparação 123 € c/IVA',{preco_venda:'9050',recondicionamento:'123'},4.73,-100],['5 % sem custos',{preco_venda:pv(0.05)},0,null],
      ['5 % + comparticipação 77 €',{preco_venda:pv(0.05),compart_conc:'77'},0,null],['5 % + comparticipação 500 €',{preco_venda:pv(0.05),compart_conc:'500'},5.15,null],
      ['6 % exatos',{preco_venda:pv(0.06)},0,null],
      ['S 1000 RR real: apoio demo 6 % (da BMW) + comparticipação 275,12 €',{pvb:'21858.99',opc:'2890.99',isv:'245.14',sgpu:'0.78',bsi:'333',ecovalor:'1.9',iuc_s:'138.15',transporte:'925',apoio_demo_pct:'6',pvp_plat:'26148.99',compart_conc:'275.12',preco_venda:'22990'},2.305,237.5]];
    return C.map(([n,x,esf,marg])=>{S.fm=Object.assign({},base,x);const c=fmCalc();const e=c.esforcoPct*100;const ident=Math.max(0,3.5-c.margem/c.base*100);
      return {n,esf:+e.toFixed(3),esperado:esf,ok:Math.abs(e-esf)<0.01&&Math.abs(e-ident)<0.001&&(marg==null||Math.abs(c.margem-marg)<0.01)};});});
  // Caso real (demo S 1000 RR): a plataforma mostra o PVP sem o apoio demo; o apoio demo não conta para o esforço.
  const real=await p.evaluate(()=>{S.fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'245.14',sgpu:'0.78',pvb:'21858.99',opc:'2890.99',bsi:'333',ecovalor:'1.9',iuc_s:'138.15',transporte:'925',
      mg_fixa_pct:'6',mg_var_pct:'3.5',apoio_demo_pct:'6',compart_conc:'275.12',preco_venda:'22990',pvp_plat:'26148.99'};const c=fmCalc();
    return {pvp:+c.pvpDesc.toFixed(2),pvpPlat:+c.pvpPlat.toFixed(2),difPlat:+c.difPlat.toFixed(2),margem:+c.margem.toFixed(2),esf:+(c.esforcoPct*100).toFixed(2),desc:+(c.descCliPct*100).toFixed(2)};});
  const realOk=Math.abs(real.pvp-24682.08)<0.02&&Math.abs(real.difPlat)<=0.05&&Math.abs(real.margem-237.5)<0.05&&Math.abs(real.esf-2.31)<0.01;
  casos.push({n:'demo S 1000 RR (PVP plataforma '+real.pvpPlat+', dif. '+real.difPlat+', margem '+real.margem+')',esf:real.esf,esperado:2.31,ok:realOk});
  casos.forEach(c=>console.log((c.ok?'✓ ':'✗ ')+c.n+': esforço '+c.esf+' % (esperado '+c.esperado+' %)'));
  const ok=casos.every(c=>c.ok);console.log(ok?'Esforço correto':'FALHOU');await b.close();process.exit(ok?0:1);
})();
