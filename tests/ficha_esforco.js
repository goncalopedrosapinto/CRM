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
      ['9,5 % + subvenção 77 € s/IVA (igual à comparticipação)',{preco_venda:'9050',subv_conc:'77'},4.447,-77],
      ['9,5 % + comparticipação 77 € + subvenção 77 €',{preco_venda:'9050',compart_conc:'77',subv_conc:'77'},5.394,-154],
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
  // O PAC entra nos Diversos da plataforma (o PVP da plataforma já vem sem ele); protocolo e apoio adicional ficam fora.
  // PAC 200 € + protocolo 2 % + apoio adicional 1 %: PVP da plataforma = PVP (c/ impostos) − PAC = 9 800 €.
  const apoios=await p.evaluate(()=>{S.fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'0',sgpu:'0',pvb:'10000',mg_fixa_pct:'6',mg_var_pct:'3.5',pac:'200',protocolo_pct:'2',apoio_adic_pct:'1',pvp_plat:'9800',preco_venda:'9000'};
    const c=fmCalc();return {plat:+c.pvpPlat.toFixed(2),dif:+c.difPlat.toFixed(2),desc:+(c.descCliPct*100).toFixed(3),descEsperado:+((9800-9000)/1.23/(10000/1.23)*100).toFixed(3),descEsf:+(c.descEsfPct*100).toFixed(3),esf:+(c.esforcoPct*100).toFixed(3),ident:+Math.max(0,3.5-c.margem/c.base*100).toFixed(3)};});
  casos.push({n:'PAC nos Diversos da plataforma; protocolo e apoio adicional fora (PVP plataforma '+apoios.plat+', dif. '+apoios.dif+', desconto '+apoios.desc+' %, p/ esforço '+apoios.descEsf+' %)',esf:apoios.esf,esperado:apoios.ident,
    ok:apoios.plat===9800&&Math.abs(apoios.dif)<=0.05&&apoios.desc===apoios.descEsperado&&apoios.desc>apoios.descEsf&&Math.abs(apoios.esf-apoios.ident)<0.001});
  // Caso real (M 1000 XR, 03/11/2026): PAC 1 080 € nos Diversos da plataforma. A plataforma mostra PVP 28 474,40 € e
  // desconto 7,39 % (1 606,42 € s/IVA) com 26 498,50 €. Antes a ficha media contra o PVP sem o PAC e dava 11,42 %.
  const xr=await p.evaluate(()=>{const fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'245.14',sgpu:'0.78',pvb:'27549.04',opc:'-509.99',bsi:'1590',ecovalor:'1.9',transporte:'922.5',
      pac:'1080',mg_fixa_pct:'6',mg_var_pct:'3.5',compart_conc:'275.12',pvp_plat:'28474.4'};
    S.fm=Object.assign({},fm,{preco_venda:'26498.50'});const a=fmCalc();S.fm=Object.assign({},fm,{preco_venda:'26500'});const c=fmCalc();
    S.screen='ficha';S.fmNeg=null;render();const tx=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
    const linha=lb=>tx([...document.querySelectorAll('.fm-tbl tr')].find(t=>t.querySelector('.fm-l')&&t.querySelector('.fm-l').textContent.startsWith(lb)));
    let cap='';const o=window.open;window.open=()=>({document:{open(){},write(h){cap+=h},close(){}},focus(){},print(){}});fmPDF();window.open=o;
    return {plat:+a.pvpPlat.toFixed(2),dif:+a.difPlat.toFixed(2),descA:+a.descCli.toFixed(2),pctA:+(a.descCliPct*100).toFixed(2),pctC:+(c.descCliPct*100).toFixed(2),
      margem:+c.margem.toFixed(2),esf:+(c.esforcoPct*100).toFixed(2),kpi:tx(document.querySelector('.fm-kpis .kpi-c')),linhaPlat:linha('PVP na plataforma'),ver:tx(document.querySelector('.fm-ver')),
      desc:linha('Desconto ao cliente'),pdfPvp:/PVP<\/div><div class="rv">28\s474\s€/.test(cap.replace(/[\u00a0\u202f]/g,' '))&&/já sem o PAC/.test(cap),pdfDesc:/Desconto ao cliente[\s\S]{0,200}?7,38\s?%/.test(cap.replace(/[\u00a0\u202f]/g,' '))};});
  casos.push({n:'M 1000 XR: desconto igual à plataforma (PVP '+xr.plat+', '+xr.pctA+' % = '+xr.descA+' € com 26 498,50 €; '+xr.pctC+' % com 26 500 €; KPI «'+xr.kpi+'»)',esf:xr.esf,esperado:2.65,
    ok:Math.abs(xr.plat-28474.4)<=0.02&&Math.abs(xr.dif)<=0.05&&xr.pctA===7.39&&Math.abs(xr.descA-1606.42)<=0.02&&xr.pctC===7.38&&xr.margem===184.76&&xr.esf===2.65&&
      /28\s474 €/.test(xr.kpi.replace(/[\u00a0\u202f]/g,' '))&&/já sem o PAC/.test(xr.kpi)&&/28\s474,4\d €/.test(xr.linhaPlat.replace(/[\u00a0\u202f]/g,' '))&&/bate com a plataforma/.test(xr.ver)&&/7,38 %/.test(xr.desc)&&/já sem o PAC/.test(xr.desc)&&xr.pdfPvp&&xr.pdfDesc});
  // Engano a escrever o PVP da plataforma (+10 €): o desconto ao cliente não muda, só aparece a diferença (caso F 900 R de 22/10)
  const engano=await p.evaluate(()=>{const fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'0',sgpu:'0',pvb:'10000',mg_fixa_pct:'6',mg_var_pct:'3.5',preco_venda:'9300'};
    S.fm=Object.assign({},fm);const a=fmCalc();S.fm=Object.assign({},fm,{pvp_plat:(a.pvpPlat+10).toFixed(2)});const c=fmCalc();
    return {sem:+a.descCli.toFixed(2),com:+c.descCli.toFixed(2),pct:+(c.descCliPct*100).toFixed(3),pctSem:+(a.descCliPct*100).toFixed(3),dif:+c.difPlat.toFixed(2),venda:+(a.pvpPlat-a.descCli*a.k).toFixed(2)};});
  casos.push({n:'engano de +10 € no PVP da plataforma não muda o desconto (desconto '+engano.com+' €, dif. '+engano.dif+')',esf:engano.pct,esperado:engano.pctSem,
    ok:engano.sem===engano.com&&engano.pct===engano.pctSem&&Math.abs(engano.dif-10)<0.01&&Math.abs(engano.venda-9300)<0.01});
  // Comparticipação em % do preço de custo (os dois com IVA), mostrada ao lado do campo e no PDF
  const cpc=await p.evaluate(()=>{S.fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'0',sgpu:'0',pvb:'12300',mg_fixa_pct:'6',mg_var_pct:'3.5',compart_conc:'255.55',preco_venda:'11800'};
    const c=fmCalc();S.screen='ficha';render();const el=document.querySelector('.fm-cpc');
    return {pct:c.compartCustoPct,esperado:255.55*c.k/c.custo,txt:el?el.textContent:''};});
  casos.push({n:'comparticipação = '+(cpc.pct*100).toFixed(2)+' % do preço de custo ('+cpc.txt+')',esf:+(cpc.pct*100).toFixed(2),esperado:+(cpc.esperado*100).toFixed(2),
    ok:Math.abs(cpc.pct-cpc.esperado)<1e-9&&cpc.txt.includes((cpc.esperado*100).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2}))&&/do preço de custo/.test(cpc.txt)});
  // Subvenção: sem IVA em qualquer modo (mudar c/IVA ↔ s/IVA não lhe mexe), % do preço de custo ao lado e no PDF
  const subv=await p.evaluate(()=>{S.fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'0',sgpu:'0',pvb:'12300',mg_fixa_pct:'6',mg_var_pct:'3.5',compart_conc:'255.55',subv_conc:'100',preco_venda:'11800'};
    const c=fmCalc();S.screen='ficha';render();
    const linha=lb=>{const tr=[...document.querySelectorAll('tr')].find(t=>t.textContent.includes(lb));return tr?{tag:(tr.querySelector('.fm-tag,[class*="tag"]')||{}).textContent||'',pct:(tr.querySelector('.fm-cpc')||{}).textContent||'',inp:!!tr.querySelector('input[data-fm="subv_conc"]'),nota:tr.textContent}:null;};
    const L=linha('Subvenção Concessionário');
    fmSetModo('siva');const emSiva=S.fm.subv_conc;fmSetModo('civa');const deVolta=S.fm.subv_conc;
    let cap='';const o=window.open;window.open=()=>({document:{open(){},write(h){cap+=h},close(){}},focus(){},print(){}});fmPDF();window.open=o;
    const pdfLinha=(cap.match(/Subven[^<]*Concession[^<]*<span[^>]*>s\/IVA<\/span><\/td><td[^>]*>([^<]*)</)||[])[1]||'';
    return {pct:c.subvCustoPct,esperado:100*c.k/c.custo,custoInclui:Math.abs(c.custo-((12300/1.23-0)*1.23*1+(255.55+100)*1.23-c.desc*c.k))<0.01,L,emSiva,deVolta,pdfLinha,ajuda:/Comparticipação e a Subvenção Concessionário são sem IVA/.test(document.body.textContent)};});
  const pctTxt=(subv.esperado*100).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  casos.push({n:'subvenção = '+(subv.pct*100).toFixed(2)+' % do preço de custo, s/IVA, no ecrã e no PDF ('+(subv.L&&subv.L.pct)+' · PDF '+subv.pdfLinha+')',esf:+(subv.pct*100).toFixed(2),esperado:+(subv.esperado*100).toFixed(2),
    ok:Math.abs(subv.pct-subv.esperado)<1e-9&&subv.custoInclui&&!!subv.L&&subv.L.inp&&subv.L.pct.includes(pctTxt)&&/escreve-se sem IVA/.test(subv.L.nota)&&!/a única/.test(subv.L.nota)&&
      subv.emSiva==='100'&&subv.deVolta==='100'&&subv.pdfLinha.includes(pctTxt.replace('.',','))&&subv.ajuda});
  // Taxa de esforço explicada (pedido do chefe, 16/11/2026): MG. FIXA 6 % + apoios BMW 5 % + 6 % + 10,5 % = 27,5 % de desconto sem esforço.
  // Acima disso é esforço; a comparticipação conta pelo peso que tem na mota. O bloco mostra as contas e os dois preços-limite.
  const tx=await p.evaluate(()=>{const fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'0',sgpu:'0',pvb:'10000',mg_fixa_pct:'6',mg_var_pct:'3,5',protocolo_pct:'5',apoio_demo_pct:'6',apoio_adic_pct:'10,5'};
    const ver=x=>{S.fm=Object.assign({},fm,x);const c=fmCalc(),P=fmEsforcoPassos(c);S.screen='ficha';S.fmNeg=null;render();const el=document.querySelector('.fm-esf');
      return {esf:c.esforcoPct==null?null:+(c.esforcoPct*100).toFixed(3),sem:P?+(P.semEsfPct*100).toFixed(3):null,p0:P&&P.precoSemEsf,p1:P&&P.precoLimite,aprov:c.aprovEsforco,
        txt:el?el.textContent.replace(/[  ]/g,' ').replace(/\s+/g,' ').trim():'',linhas:[...document.querySelectorAll('.fm-esf-t tr')].map(t=>t.textContent.replace(/[  ]/g,' ').replace(/\s+/g,' ').trim()),neg:!!document.querySelector('.fm-esf-t td.neg'),
        larg:document.documentElement.scrollWidth<=document.documentElement.clientWidth};};
    return {semPreco:ver({}),noLimite:ver({preco_venda:'7250'}),abaixo:ver({preco_venda:'8000'}),esf15:ver({preco_venda:'7100'}),chefia:ver({preco_venda:'6800'}),
      compart:ver({preco_venda:'7250',compart_conc:'81.30'}),semFixa:ver({mg_fixa_pct:'',preco_venda:'7250'})};});
  await p.setViewportSize({width:1100,height:900});await p.evaluate(()=>{S.fm=Object.assign({},S.fm,{mg_fixa_pct:'6',preco_venda:'7100',compart_conc:'81.30'});render();const e=document.querySelector('.fm-esf');if(e)e.scrollIntoView({block:'center'});});
  await p.screenshot({path:path.join(__dirname,'ficha_esforco.png')});
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{S.sidebarOpen=false;render();const e=document.querySelector('.fm-esf');if(e)e.scrollIntoView({block:'start'});});
  const telLarg=await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);await p.screenshot({path:path.join(__dirname,'ficha_esforco_telemovel.png')});
  const T=tx;if(process.env.DBG)console.log(JSON.stringify([T.noLimite,T.semPreco,T.semFixa,telLarg],null,1));
  casos.push({n:'taxa de esforço: 6 % fixa + apoios 5 + 6 + 10,5 = 27,5 % sem esforço (preço '+T.noLimite.p0+' €; chefia abaixo de '+T.noLimite.p1+' €)',esf:T.noLimite.esf,esperado:0,
    ok:T.noLimite.esf===0&&T.noLimite.sem===27.5&&T.noLimite.p0===7250&&T.noLimite.p1===6900&&/usou 6,0 % dos 6,0 % da MG\. FIXA/.test(T.noLimite.txt)&&
      /Apoios da BMW.*Protocolo 5,0 % · Apoio demo 6,0 % · Apoio adicional 10,5 %.*− 21,5 %/.test(T.noLimite.linhas[1]||'')&&/Desconto ao cliente.*27,5 %/.test(T.noLimite.linhas[0]||'')&&/sem esforço: 7 ?250 €/.test(T.noLimite.txt)&&/pelo esforço: 6 ?900 €/.test(T.noLimite.txt)});
  casos.push({n:'taxa de esforço: desconto abaixo do teto mostra quanto da MG. FIXA foi usada',esf:T.abaixo.esf,esperado:0,ok:T.abaixo.esf===0&&!T.abaixo.aprov&&/sem esforço: usou 0,0 % dos 6,0 %/.test(T.abaixo.txt)&&!T.abaixo.neg});
  casos.push({n:'taxa de esforço: 29 % de desconto = 1,5 % de esforço, dentro da variável',esf:T.esf15.esf,esperado:1.5,ok:T.esf15.esf===1.5&&!T.esf15.aprov&&/Esforço.*dentro da MG\. VARIÁVEL de 3,5 %.*1,5 %/.test(T.esf15.linhas.slice(-1)[0]||'')&&!T.esf15.neg});
  casos.push({n:'taxa de esforço: 32 % de desconto passa a variável e vai à chefia (a vermelho)',esf:T.chefia.esf,esperado:4.5,ok:T.chefia.esf===4.5&&T.chefia.aprov&&T.chefia.neg&&/precisa de aprovação da chefia/.test(T.chefia.txt)});
  casos.push({n:'taxa de esforço: comparticipação de 1 % da mota baixa o teto para 26,5 % (preço '+T.compart.p0+' €)',esf:T.compart.esf,esperado:1,
    ok:T.compart.esf===1&&T.compart.sem===26.5&&T.compart.p0===7350&&/Custos do concessionário.*Comparticipação 1,0 %.*\+ 1,0 %/.test(T.compart.linhas[2]||'')&&/Sai da margem do concessionário.*7,0 %/.test(T.compart.linhas[3]||'')});
  casos.push({n:'taxa de esforço: sem preço mostra só a regra e os preços-limite; sem MG. FIXA não aparece; cabe no telemóvel',esf:0,esperado:0,
    ok:T.semPreco.linhas.length===0&&/acima da MG\. FIXA \(6,0 %\)/.test(T.semPreco.txt)&&/sem esforço: 7 ?250 €/.test(T.semPreco.txt)&&T.semFixa.txt===''&&telLarg});
  casos.forEach(c=>console.log((c.ok?'✓ ':'✗ ')+c.n+': esforço '+c.esf+' % (esperado '+c.esperado+' %)'));
  const ok=casos.every(c=>c.ok);console.log(ok?'Esforço correto':'FALHOU');await b.close();process.exit(ok?0:1);
})();
