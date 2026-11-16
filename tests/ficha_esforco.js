// Ficha de margem: esforço = (desconto ao cliente % + custos do concessionário %) acima da MG. FIXA, tudo sobre Model and Options s/IVA.
// Só a MG. FIXA não é esforço (regra do chefe, 16/11/2026): os apoios da BMW também são esforço e cobrem a sua parte (esfApoiosPct);
// o resto sai da MG. VARIÁVEL (esfConcPct) e é essa parte que vai à chefia quando passa a variável.
// A parte da variável tem de bater certo com a margem: esfConc = MG. VARIÁVEL − margem/base (quando positivo).
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
    return C.map(([n,x,esf,marg])=>{S.fm=Object.assign({},base,x);const c=fmCalc();const e=c.esfConcPct*100;const ident=Math.max(0,3.5-c.margem/c.base*100);
      const soma=Math.abs(c.esforcoPct-c.esfApoiosPct-c.esfConcPct)<1e-12&&Math.abs(c.esforcoPct-Math.max(0,c.descCliPct+c.internosPct-c.margFixaPct))<1e-12&&(x.apoio_demo_pct?Math.abs(c.esforcoPct*100-8.305)<0.01&&Math.abs(c.esfApoiosPct-0.06)<1e-9:c.esfApoiosPct===0);
      return {n,esf:+e.toFixed(3),esperado:esf,ok:soma&&Math.abs(e-esf)<0.01&&Math.abs(e-ident)<0.001&&(marg==null||Math.abs(c.margem-marg)<0.01)};});});
  // Caso real (demo S 1000 RR): a plataforma mostra o PVP sem o apoio demo; o apoio demo não conta para o esforço.
  const real=await p.evaluate(()=>{S.fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'245.14',sgpu:'0.78',pvb:'21858.99',opc:'2890.99',bsi:'333',ecovalor:'1.9',iuc_s:'138.15',transporte:'925',
      mg_fixa_pct:'6',mg_var_pct:'3.5',apoio_demo_pct:'6',compart_conc:'275.12',preco_venda:'22990',pvp_plat:'26148.99'};const c=fmCalc();
    return {pvp:+c.pvpDesc.toFixed(2),pvpPlat:+c.pvpPlat.toFixed(2),difPlat:+c.difPlat.toFixed(2),margem:+c.margem.toFixed(2),esf:+(c.esfConcPct*100).toFixed(2),tot:+(c.esforcoPct*100).toFixed(2),ap:+(c.esfApoiosPct*100).toFixed(2),desc:+(c.descCliPct*100).toFixed(2)};});
  const realOk=Math.abs(real.pvp-24682.08)<0.02&&Math.abs(real.difPlat)<=0.05&&Math.abs(real.margem-237.5)<0.05&&Math.abs(real.esf-2.31)<0.01&&Math.abs(real.tot-8.31)<0.01&&real.ap===6;
  casos.push({n:'demo S 1000 RR: esforço '+real.tot+' %, apoio demo cobre '+real.ap+' %, variável (PVP plataforma '+real.pvpPlat+', dif. '+real.difPlat+', margem '+real.margem+')',esf:real.esf,esperado:2.31,ok:realOk});
  // O PAC entra nos Diversos da plataforma (o PVP da plataforma já vem sem ele); protocolo e apoio adicional ficam fora.
  // PAC 200 € + protocolo 2 % + apoio adicional 1 %: PVP da plataforma = PVP (c/ impostos) − PAC = 9 800 €.
  const apoios=await p.evaluate(()=>{S.fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'0',sgpu:'0',pvb:'10000',mg_fixa_pct:'6',mg_var_pct:'3.5',pac:'200',protocolo_pct:'2',apoio_adic_pct:'1',pvp_plat:'9800',preco_venda:'9000'};
    const c=fmCalc();return {plat:+c.pvpPlat.toFixed(2),dif:+c.difPlat.toFixed(2),desc:+(c.descCliPct*100).toFixed(3),descEsperado:+((9800-9000)/1.23/(10000/1.23)*100).toFixed(3),descEsf:+(c.descEsfPct*100).toFixed(3),esf:+(c.esfConcPct*100).toFixed(3),tot:+(c.esforcoPct*100).toFixed(3),ap:+(c.esfApoiosPct*100).toFixed(3),apDisp:+(c.apoiosEsfPct*100).toFixed(3),ident:+Math.max(0,3.5-c.margem/c.base*100).toFixed(3)};});
  casos.push({n:'PAC nos Diversos da plataforma; protocolo e apoio adicional fora (PVP plataforma '+apoios.plat+', dif. '+apoios.dif+', desconto '+apoios.desc+' %, p/ esforço '+apoios.descEsf+' %)',esf:apoios.esf,esperado:apoios.ident,
    ok:apoios.plat===9800&&Math.abs(apoios.dif)<=0.05&&apoios.desc===apoios.descEsperado&&apoios.desc>apoios.descEsf&&Math.abs(apoios.esf-apoios.ident)<0.001&&apoios.tot===2&&apoios.ap===2&&apoios.apDisp===3});
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
  // Taxa de esforço (regra do chefe, 16/11/2026): MG. FIXA 6 % + apoios 5 % + 6 % + 10,5 % = 27,5 % de desconto → esforço 21,5 %
  // (tudo acima da fixa), coberto pelos apoios. Acima disso sai da variável; passando a variável vai à chefia.
  // O cartão mostra o número, a barra e a legenda; a explicação (como se chega ao esforço, quem o paga, preços-limite) é retrátil.
  const T=await p.evaluate(()=>{try{localStorage.removeItem('bm_fm_esf');}catch(e){}
    const fm={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'0',sgpu:'0',pvb:'10000',mg_fixa_pct:'6',mg_var_pct:'3,5',protocolo_pct:'5',apoio_demo_pct:'6',apoio_adic_pct:'10,5'};
    const lim=e=>e?e.textContent.replace(/[  ]/g,' ').replace(/\s+/g,' ').trim():'';const r3=n=>n==null?null:+(n*100).toFixed(3);
    const ver=x=>{S.fm=Object.assign({},fm,x);const c=fmCalc(),P=fmEsforcoPassos(c);S.screen='ficha';S.fmNeg=null;render();const el=document.querySelector('.fm-esf');
      return {esf:r3(c.esforcoPct),ap:r3(c.esfApoiosPct),conc:r3(c.esfConcPct),aprov:c.aprovEsforco,p0:P&&P.precoSemEsf,p1:P&&P.precoLimite,
        n:lim(document.querySelector('.fm-esf-n')),neg:!!document.querySelector('.fm-esf-n.neg'),sub:lim(document.querySelector('.fm-esf-sub')),leg:[...document.querySelectorAll('.fm-esf-lg')].map(lim),
        seg:[...document.querySelectorAll('.fm-esf-sg')].map(e=>e.className.replace('fm-esf-sg ','')+':'+parseFloat(e.style.width).toFixed(1)),
        linhas:[...document.querySelectorAll('.fm-esf-li')].map(lim),grupos:[...document.querySelectorAll('.fm-esf-gt')].map(lim),fechado:!!(document.querySelector('.fm-esf-b')||{}).hidden,
        kpi:lim([...document.querySelectorAll('.fm-kpis .kpi-c')].pop()),aviso:lim(document.querySelector('.fm-aprov')),txt:lim(el)};};
    const R={semPreco:ver({}),noLimite:ver({preco_venda:'7250'}),abaixoFixa:ver({preco_venda:'9500'}),meio:ver({preco_venda:'8000'}),esf15:ver({preco_venda:'7100'}),chefia:ver({preco_venda:'6800'}),
      compart:ver({preco_venda:'7250',compart_conc:'81.30'}),semApoios:ver({protocolo_pct:'',apoio_demo_pct:'',apoio_adic_pct:'',preco_venda:'9050'}),semFixa:ver({mg_fixa_pct:'',preco_venda:'7250'})};
    // retrátil: abre com o botão, fica aberto ao voltar a desenhar e ao recarregar (guardado no browser); o foco não sai do botão
    ver({preco_venda:'7100',compart_conc:'81.30'});const bt=document.querySelector('[data-action="fm-esf-toggle"]');const a0=bt.getAttribute('aria-expanded');bt.focus();bt.click();
    const a1=bt.getAttribute('aria-expanded'),vis1=!document.querySelector('.fm-esf-b').hidden,foco=document.activeElement===bt;render();
    R.retratil={a0,a1,vis1,foco,aposRender:!document.querySelector('.fm-esf-b').hidden&&document.querySelector('[data-action="fm-esf-toggle"]').getAttribute('aria-expanded')==='true',guardado:localStorage.getItem('bm_fm_esf')};
    return R;});
  await p.setViewportSize({width:1100,height:900});await p.evaluate(()=>{render();const e=document.querySelector('.fm-esf');if(e)e.scrollIntoView({block:'center'});});
  await p.screenshot({path:path.join(__dirname,'ficha_esforco.png')});
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{S.sidebarOpen=false;render();window.scrollTo(0,0);const e=document.querySelector('.fm-esf');if(e)e.scrollIntoView({block:'start'});const m=document.querySelector('.main,main');});
  const telLarg=await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);await p.screenshot({path:path.join(__dirname,'ficha_esforco_telemovel.png'),fullPage:false});
  await p.evaluate(()=>{document.querySelector('[data-action="fm-esf-toggle"]').click();render();const e=document.querySelector('.fm-esf');if(e)e.scrollIntoView({block:'start'});});await p.screenshot({path:path.join(__dirname,'ficha_esforco_fechado.png')});
  await p.emulateMedia({colorScheme:'dark'});await p.evaluate(()=>{document.documentElement.setAttribute('data-theme','dark');document.querySelector('[data-action="fm-esf-toggle"]').click();});await p.screenshot({path:path.join(__dirname,'ficha_esforco_escuro.png')});
  await p.evaluate(()=>{document.documentElement.removeAttribute('data-theme');});
  if(process.env.DBG)console.log(JSON.stringify(T,null,1));
  const L=T.noLimite;
  casos.push({n:'regra nova: fixa 6 % + apoios 21,5 % = 27,5 % de desconto → esforço 21,5 %, todo coberto pelos apoios, sem ir à chefia',esf:L.esf,esperado:21.5,
    ok:L.esf===21.5&&L.ap===21.5&&L.conc===0&&!L.aprov&&L.n==='21,5 %'&&!L.neg&&/dentro dos apoios e da margem variável/.test(L.sub)&&L.aviso===''&&
      JSON.stringify(L.leg)===JSON.stringify(['Margem fixa 6,0 %','Apoios 21,5 %','Margem variável 0,0 % de 3,5 %'])&&L.seg.length===2&&/^fx:19\.[34]$/.test(L.seg[0])&&/^ap:69\.[34]$/.test(L.seg[1])&&/apoios 21,5 % · variável 0,0 % de 3,5 %/.test(L.kpi)});
  casos.push({n:'explicação separa Desconto ao cliente, Custos do concessionário, Margem fixa e Apoios; começa fechada',esf:L.esf,esperado:21.5,
    ok:L.fechado&&JSON.stringify(L.grupos)===JSON.stringify(['Como se chega ao esforço','Quem paga o esforço','Preços-limite'])&&/^Desconto ao cliente.*SA3\.27,5 %$/.test(L.linhas[0])&&/^Custos do concessionário.*\+ 0,0 %$/.test(L.linhas[1])&&
      /^Margem fixa.*− 6,0 %$/.test(L.linhas[2])&&/^Esforço.*21,5 %$/.test(L.linhas[3])&&/^Apoios.*Protocolo 5,0 % · Apoio demo 6,0 % · Apoio adicional 10,5 %.*pagos pela BMW\.21,5 %$/.test(L.linhas[4])&&/^Margem variável.*Acima de 3,5 % vai à chefia\.0,0 %de 3,5 %$/.test(L.linhas[5])});
  casos.push({n:'preços-limite: sem esforço '+L.p0+' € (só a fixa); sem ir à chefia '+L.p1+' € (fixa + apoios + variável)',esf:L.p0,esperado:9400,ok:L.p0===9400&&L.p1===6900&&/^Sem esforço.*9 ?400 €$/.test(L.linhas[6])&&/^Sem ir à chefia pelo esforço.*31,0 %.*6 ?900 €$/.test(L.linhas[7])});
  casos.push({n:'desconto de 5 % (abaixo da fixa): sem esforço, diz quanto da fixa foi usada',esf:T.abaixoFixa.esf,esperado:0,ok:T.abaixoFixa.esf===0&&T.abaixoFixa.conc===0&&/sem esforço: usou 5,0 % dos 6,0 % da margem fixa/.test(T.abaixoFixa.sub)&&T.abaixoFixa.leg[0]==='Margem fixa 5,0 % de 6,0 %'});
  casos.push({n:'desconto de 20 %: esforço 14 %, os apoios cobrem 14 % dos 21,5 %',esf:T.meio.esf,esperado:14,ok:T.meio.esf===14&&T.meio.ap===14&&T.meio.conc===0&&T.meio.leg[1]==='Apoios 14,0 % de 21,5 %'});
  casos.push({n:'desconto de 29 %: esforço 23 %, 1,5 % sai da variável, não vai à chefia',esf:T.esf15.esf,esperado:23,ok:T.esf15.esf===23&&T.esf15.conc===1.5&&!T.esf15.aprov&&!T.esf15.neg&&T.esf15.leg[2]==='Margem variável 1,5 % de 3,5 %'&&T.esf15.aviso===''});
  casos.push({n:'desconto de 32 %: esforço 26 %, 4,5 % fora dos apoios passa a variável → chefia, a vermelho',esf:T.chefia.esf,esperado:26,
    ok:T.chefia.esf===26&&T.chefia.conc===4.5&&T.chefia.aprov&&T.chefia.neg&&/passa a margem variável em 1,0 % — precisa de aprovação da chefia/.test(T.chefia.sub)&&T.chefia.leg[3]==='Acima da variável 1,0 %'&&
      /esforço de 26,0 % \(4,5 % fora dos apoios\), acima da margem variável de 3,5 %/.test(T.chefia.aviso)});
  casos.push({n:'comparticipação de 1 % da mota conta: esforço 22,5 %, 1 % sai da variável; sem esforço só até '+T.compart.p0+' €',esf:T.compart.esf,esperado:22.5,
    ok:T.compart.esf===22.5&&T.compart.conc===1&&T.compart.p0===9500&&T.compart.p1===7000&&/^Custos do concessionário.*Comparticipação 1,0 %\..*\+ 1,0 %$/.test(T.compart.linhas[1])});
  casos.push({n:'sem apoios: o aviso da chefia fica como era; sem preço mostra só os preços-limite; sem MG. FIXA não aparece; cabe no telemóvel',esf:T.semApoios.esf,esperado:3.5,
    ok:T.semApoios.esf===3.5&&T.semApoios.ap===0&&T.semApoios.leg.length===2&&T.semPreco.n==='—'&&T.semPreco.seg.length===0&&T.semPreco.linhas.length===2&&/escreve o valor proposto/.test(T.semPreco.sub)&&T.semFixa.txt===''&&telLarg});
  casos.push({n:'explicação retrátil: abre com o botão, mantém-se ao redesenhar e fica guardada; o foco não sai do botão',esf:0,esperado:0,
    ok:T.retratil.a0==='false'&&T.retratil.a1==='true'&&T.retratil.vis1&&T.retratil.foco&&T.retratil.aposRender&&T.retratil.guardado==='1'});
  casos.forEach(c=>console.log((c.ok?'✓ ':'✗ ')+c.n+': esforço '+c.esf+' % (esperado '+c.esperado+' %)'));
  const ok=casos.every(c=>c.ok);console.log(ok?'Esforço correto':'FALHOU');await b.close();process.exit(ok?0:1);
})();
