// Os meus prémios (chefe de vendas): esquema mensal em % de um valor de referência, como o Simulador do Excel. Regras e dados fictícios.
// - sem regras: diz o que fazer; importar um Excel com outro formato dá um erro claro e não grava;
// - importar o Esquema Base (+ parâmetros do Simulador): pré-visualiza e só grava ao confirmar, na linha «esquema» de premios_mes;
// - os números do CRM aparecem a cinzento e só contam com «Usar estes números» (só preenche o que está vazio);
// - prémios em degraus, VN e VO em separado, margem com acerto no fim do trimestre, Bónus Marcas, média de vendas;
// - penalizações/bonificações; Sim/Não gravado como texto; total do mês com vencimento;
// - ano: meses, acumulado, média e projeção; em dezembro, fecho do ano devolve penalizações; o nome do ficheiro não corre como código.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8792;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}};
const R=(id,type,d)=>({id,vendedor_id:'v1',status:'Retail',type,mat:'AA-0'+id+'-AA',id_cliente:'Cliente '+id,model:'Modelo',version:'',col_298:d,neg:d,updated_at:new Date().toISOString()});
const recs=[...Array(11)].map((_,i)=>R(i+1,'MN','2026-09-1'+(i%9)))
  .concat([R(20,'MU','2026-09-05'),R(21,'MU','2026-09-06'),R(22,'MN','2026-08-03')]);
// Excel fictício com o formato do Esquema Base (valores inventados, não são os da marca)
const c=v=>({v});
const EB={C2:c(400),B5:c('Realização do Orçamento'),C5:c(0.9),D5:c(1),E5:c(1.1),B7:c('Faturas VN'),C7:c(0.05),D7:c(0.08),E7:c(0.11),B8:c('Faturas VO'),C8:c(0.03),D8:c(0.05),E8:c(0.07),
  C12:c('% Orç. -1pp'),B14:c('% Margem Comercial VN'),C14:c(0.04),D14:c(0.06),E14:c(0.08),B15:c('% Margem Comercial VO'),C15:c(0.02),D15:c(0.03),E15:c(0.04),
  C19:c(0.9),D19:c(1),E19:c(1.1),B21:c('Receita Financeira VN'),C21:c(0.04),D21:c(0.06),E21:c(0.08),B22:c('Receita Financeira VO'),C22:c(0.02),D22:c(0.03),E22:c(0.04),
  C26:c(0.9),D26:c(1),E26:c(1.1),B28:c('Objetivo Vendas'),C28:c(0.1),D28:c(0.2),E28:c(0.3),B32:c('Programa de Demonstração'),C32:c(0),D32:c(0.1),
  B36:c('Gestão de Encomendas'),C36:c(0),D36:c(0.05),E36:c(0.15),C39:c(5),D39:c(6),E39:c(7),B41:c('Média Vendas'),C41:c(0.04),D41:c(0.08),E41:c(0.12),
  B51:c('CCGO'),C51:c('< 1 cartão por vendedor showroom => -10%'),C52:c('> 2 cartão por vendedor showroom => +10%'),G51:c(-0.1),G52:c(0.1),
  B55:c('Stock VN + KM0 (Contrato)'),C55:c(-0.05),D55:c(0.05),C57:c('Penetração < 20%'),D57:c('Penetração > 50%'),B58:c('Consentimentos'),C58:c(-0.1),D58:c(0.1),
  B62:c('VOC Marca'),C62:c(-0.1),D62:c(0.1),C64:c('< 10,0%'),D64:c('>= 12,0%'),B65:c('Conversão de Leads'),C65:c(-0.1),D65:c(0.1),C67:c('<28%'),B68:c('Taxa de Retenção'),C68:c(-0.1),D68:c(0.1),
  A70:c('Condições fictícias de teste.')};
const SIM={C3:c(400),C4:c(1000),C92:c('Sim'),C93:c('Não'),C100:c(0.01),C101:c(1),C102:c(2),C103:c(0.2),C104:c(0.5),C105:c(0.1),C106:c(0.12),C107:c(0.28)};
const WB={SheetNames:['Esquema Base','Simulador'],Sheets:{'Esquema Base':EB,'Simulador':SIM}};
const WB_MAU={SheetNames:['Folha1'],Sheets:{'Folha1':{A1:c('outra coisa')}}};
const est={pm:{'2026/07':{mvn_o:5,mvn_r:4.5},'2026/08':{mvn_o:5,mvn_r:5}},escritas:[]};
const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control')return json(recs);
  if(t==='objetivos_equipa')return json([{mes:'2026-09-01',tipo:'novas',objetivo:10}]);
  if(t==='premios_mes'){if(m==='GET')return json(Object.entries(est.pm).map(([mes,dados])=>({mes,dados})));
    const b=JSON.parse(r.request().postData());const mes=(u.match(/mes=eq\.([^&]+)/)||[])[1]||b.mes;est.escritas.push([m,mes,JSON.parse(JSON.stringify(b.dados))]);
    if(m==='PATCH'){if(!est.pm[mes])return json([]);est.pm[mes]=b.dados;return json([{mes,dados:b.dados}]);}
    est.pm[mes]=b.dados;return json([{mes,dados:b.dados}],201);}
  return json([]);};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const erros=[];const alertas=[];
 const ctx=await b.newContext({viewport:{width:1500,height:1100}});
 await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('c1'));
 await ctx.route('**/*',rota('c1'));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));await ligarAvisos(p,alertas);
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
 const t=sel=>p.evaluate(sel=>{const e=document.querySelector(sel);return e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';},sel);
 await p.evaluate(()=>{S.dashMes='2026/09';const x=document.createElement('button');x.dataset.action='gpp-sec';x.dataset.s='premios';document.getElementById('app').appendChild(x);x.click();x.remove();});await p.waitForTimeout(900);
 const vazio=await t('.pe-vazio-c');
 const importar=async(wb,nome)=>{await p.evaluate(async([wb,nome])=>{window.XLSX={read:()=>wb};await peImportar({name:nome,arrayBuffer:async()=>new ArrayBuffer(8)});},[wb,nome]);await p.waitForTimeout(300);};
 await importar(WB_MAU,'outro.xlsx');const erroMau=await t('.error');const escr0=est.escritas.length;
 await importar(WB,'<img src=x onerror="window.__x=1">.xlsx');
 const prev=await p.evaluate(()=>({titulo:(document.querySelector('.pe-prev .vd-form-t')||{}).innerHTML||'',txt:(document.querySelector('.pe-prev')||{}).textContent||'',xss:!!window.__x||!!document.querySelector('img[src="x"]')}));
 const escr1=est.escritas.length;
 await p.click('[data-action="pe-confirmar"]');await p.waitForTimeout(500);
 const esq=est.pm.esquema||{};
 // números do CRM: a cinzento até carregar em «Usar estes números»
 const antesCrm=await p.evaluate(()=>({ph:(document.querySelector('[data-pm-k="fvn_r"]')||{}).placeholder,val:(document.querySelector('[data-pm-k="fvn_r"]')||{}).value,botao:!!document.querySelector('[data-action="pe-crm"]')}));
 await p.click('[data-action="pe-crm"]');await p.waitForTimeout(400);
 const set=async(k,v)=>{await p.fill(`[data-pm-k="${k}"]`,String(v));await p.press(`[data-pm-k="${k}"]`,'Tab');await p.waitForTimeout(150);};
 await set('fvo_o',2);await set('mvn_o',5);await set('mvn_r',3.5);await set('mvn_to',5);await set('mvn_tr',6);
 await p.selectOption('select[data-pm-k="bm_norma"]','Sim');await p.waitForTimeout(150);await set('bm_obj',105);
 await p.selectOption('select[data-pm-k="bm_demo"]','Sim');await p.waitForTimeout(150);await p.selectOption('select[data-pm-k="bm_enc"]','Sim');await p.waitForTimeout(150);
 await set('media',6.5);await set('ccgo',0.5);await set('consent',60);
 await p.waitForTimeout(300);
 const set09=est.pm['2026/09']||{};
 const mes=await p.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';const C=peCalcMes(peEsq(),'2026/09',S.premiosMes);
   const lin=k=>t([...document.querySelectorAll('.pe-tbl tr')].find(tr=>tr.querySelector(`[data-pm-k="${k}"]`)));
   return {com:C.com,base:C.base,ajE:C.ajE,total:C.total,acerto:(C.L.find(l=>l.k==='mvn_t')||{}).p,topo:t(document.querySelector('.pm-total')),lado:t(document.querySelector('.pe-fecho')),
     linFvn:lin('fvn_r'),linTri:lin('mvn_tr'),acesas:[...document.querySelectorAll('.pe-tbl .pm-t.on')].length,ano:t(document.querySelector('.pe-ano'))};});
 await p.evaluate(()=>{document.activeElement&&document.activeElement.blur();document.querySelectorAll('.content,.main-panel').forEach(e=>e.scrollTop=0);window.scrollTo(0,0);});await p.waitForTimeout(150);
 await p.screenshot({path:path.join(__dirname,'premios_mes.png'),fullPage:true});
 // dezembro: fecho do ano
 await p.evaluate(()=>setState({dashMes:'2026/12'}));await p.waitForTimeout(400);
 const temFecho=await p.evaluate(()=>!!document.querySelector('.pe-fe'));
 await set('fe_ccgo',1.5);await p.waitForTimeout(300);
 const fecho=await p.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';return {linha:t([...document.querySelectorAll('.pe-fe tr')].find(tr=>/CCGO/.test(tr.textContent))),total:t(document.querySelector('.pe-fe tfoot'))};});
 await p.screenshot({path:path.join(__dirname,'premios_fecho.png'),fullPage:true});
 await ctx.close();
 const R0={vazio,erroMau,escr0,prev:{xss:prev.xss,titulo:prev.titulo.slice(0,120)},escr1,esq:{ref:esq.ref,base:esq.base,passo:esq.marg&&esq.marg.passo,ccgo:esq.pen&&esq.pen.ccgo,consent:esq.pen&&esq.pen.consent,leads:esq.pen&&esq.pen.leads},antesCrm,set09,mes,temFecho,fecho,alertas,erros};
 console.log(JSON.stringify(R0,null,1));
 const ok={
  'sem regras: diz como importar':/Ainda não há regras do esquema/.test(vazio)&&/Importa o Excel do Esquema Base/.test(vazio),
  'Excel com outro formato: erro claro e nada gravado':/Não encontrei a folha «Esquema Base»/.test(erroMau)&&escr0===0,
  'pré-visualiza antes de gravar; nome do ficheiro não corre como código':escr1===0&&!prev.xss&&/&lt;img/.test(prev.titulo),
  'grava as regras na linha «esquema» (referência, vencimento, limiares do Simulador)':esq.ref===400&&esq.base===1000&&esq.marg.passo===0.01&&esq.pen.ccgo.abaixo===1&&esq.pen.ccgo.apartir===2&&esq.pen.consent.acima===0.5&&esq.pen.leads.apartir===0.12&&esq.subFerias===true&&esq.subNatal===false,
  'números do CRM a cinzento até «Usar estes números»':antesCrm.ph==='11'&&antesCrm.val===''&&antesCrm.botao&&set09.fvn_o===10&&set09.fvn_r===11&&set09.fvo_r===2,
  'Sim/Não gravado como texto':set09.bm_norma==='Sim'&&set09.bm_demo==='Sim'&&set09.bm_enc==='Sim',
  'margem: acerto do trimestre paga a diferença dos 3 meses':Math.abs(mes.acerto-0.14)<1e-9&&/acerto do trimestre/.test(mes.linTri)&&/56,00 €/.test(mes.linTri),
  'prémios do mês: 73 % de 400 € = 292 €; ajustes 0; total com vencimento 1292 €':mes.base===292&&mes.ajE===0&&mes.com===292&&mes.total===1292&&/292,00 €/.test(mes.topo)&&/1292,00 €|1 292,00 €/.test(mes.lado),
  'faturas VN: 110 % acende o 3.º escalão (+11 % = 44 €)':/110,0 %/.test(mes.linFvn)&&/44,00 €/.test(mes.linFvn),
  'ano: julho e agosto sem faturas VN não contam para a média; projeção = média × 12':/Jul.*sem faturas VN/.test(mes.ano)&&/Comissão acumulada\s*332,00 €/.test(mes.ano)&&/Média mensal \(1 mês com faturas VN\)\s*292,00 €/.test(mes.ano)&&/recuperação\)\s*3\s?504,00 €/.test(mes.ano),
  'dezembro: fecho do ano devolve a penalização do CCGO (zona neutra)':temFecho&&/zona neutra: devolvida só a penalização de 1 mês/.test(fecho.linha)&&/40,00 €/.test(fecho.linha)&&/40,00 €/.test(fecho.total),
  'sem erros na página':erros.length===0,
 };
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'TUDO OK');srv.close();await b.close();process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
