// Os meus prémios · conferir o cálculo da empresa (Excel «Comissão» + «Política»). Regras e números fictícios.
// - lê os valores de base e os resultados de cada mês; recalcula com o teu esquema e diz onde não bate;
// - deteta no ficheiro: gestão de encomendas sem o escalão máximo e leads com «<=»; valores escritos à mão;
// - método das penalizações: sobre a comissão do mês (como a empresa) ou sobre a referência (como o simulador);
// - «Usar estes dados nos meus meses» só preenche o que está vazio; ficheiro com outro formato dá erro claro.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8796;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
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
// ficheiro da empresa (formato «Comissões CV Baviera», números inventados)
const POL={C13:c(0.01),D13:c(0.035),E13:c(0.045),D19:c(0.05),C38:c(0.1),D38:c(0.12)};
const COM={B2:c(400),B8:c(2026)};
const lbl={11:'Realização Faturas VN',16:'Realização Faturas VU',21:'Margem Comercial VN',26:'Margem Comercial VU',31:'Receita Finance VN',36:'Receita Finance VU',41:'Objetivo Vendas',
  51:'Programa de Demonstração',54:'Gestão de Encomendas',63:'Média por Vendedor',67:'Cartão de Crédito Caetano Go',71:'Stock VN + KM0 (Contrato)',79:'Consentimentos',84:'VOC Marca',88:'Conversão de Leads',93:'Taxa de Retenção'};
Object.entries(lbl).forEach(([r,t])=>{COM['A'+r]=c(t);});
['Janeiro','Fevereiro','Março','1º Trimestre','Abril','Maio','Junho','2º Trimestre','Julho','Agosto','Setembro','3º Trimestre','Outubro','Novembro','Dezembro','4º Trimestre'].forEach((t,i)=>{COM[String.fromCharCode(67+i)+'10']=c(t);});
const mes=(L,o)=>Object.entries(o).forEach(([r,v])=>{COM[L+r]=v&&typeof v==='object'?v:c(v);});
// janeiro: faturas VO pagas a 0 à mão; objetivo no escalão máximo com encomendas a 5 %; leads exatamente nos 12 % sem bonificação
mes('C',{11:10,12:10,14:0.08,15:32,16:4,17:4,19:0.05,20:0,21:0.05,22:0.1,24:0,25:0,26:0.01,27:0.04,29:0,30:0,31:0,32:1000,34:0,35:0,36:0,37:1000,39:0,40:0,
  43:0.045,44:0.3,45:120,51:'Sim',52:0.1,53:40,54:'Sim',55:{v:0.05,f:'IF(C54="",0,IF(C54="Sim",Política!$D$19,0))'},56:20,63:3,64:0,65:0,66:212,
  67:2,68:2,69:0,70:0,71:2,72:0,73:0,74:0,79:0,80:0,82:0,83:0,84:1,85:0.9,86:0.1,87:21.2,88:25,89:3,90:0.12,
  91:{v:0,f:'IF(C90="",0,IF(C90<Política!$C$38,Política!$C$39,IF(C90<=Política!$D$38,0,Política!$D$39)))'},92:0,93:0.3,95:0.1,96:21.2,101:0.2,102:42.4,103:254.4});
// fevereiro: tudo bate (com o método da empresa)
mes('D',{11:9,12:10,14:0.05,15:20,16:0,17:4,19:0,20:0,21:0.05,22:0.1,24:0,25:0,26:0.01,27:0.04,29:0,30:0,31:0,32:1000,34:0,35:0,36:0,37:1000,39:0,40:0,
  44:0,45:0,52:0,53:0,55:0,56:0,63:3,64:0,65:0,66:20,67:2,68:2,69:0,70:0,71:2,72:0,73:0,74:0,79:0,82:0,83:0,84:1,85:0.9,86:0.1,87:2,88:0,91:0,92:0,93:0.3,95:0.1,96:2,101:0.2,102:4,103:24});
const CV={SheetNames:['Política','Comissão'],Sheets:{'Política':POL,'Comissão':COM}};
const MAU={SheetNames:['Comissão','Política'],Sheets:{'Comissão':{A11:c('outra coisa')},'Política':{}}};
const est={pm:{'2026/01':{fvn_r:11}},escritas:[]};
const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'}]);
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
 est.pm.esquema=await p.evaluate(wb=>peLerExcel(wb),WB);
 await p.evaluate(wb=>{S.dashMes='2026/01';
   const x=document.createElement('button');x.dataset.action='gpp-sec';x.dataset.s='premios';document.getElementById('app').appendChild(x);x.click();x.remove();},WB);await p.waitForTimeout(700);
 const antes=await t('.pe-emp');
 const carregar=async wb=>{await p.evaluate(async wb=>{window.XLSX={read:()=>wb};await peEmpImportar({name:'comissoes.xlsx',arrayBuffer:async()=>new ArrayBuffer(8)});},wb);await p.waitForTimeout(300);};
 await carregar(MAU);const erroMau=await t('.pe-emp .error');
 await carregar(CV);
 const linhas=()=>p.evaluate(()=>[...document.querySelectorAll('.pe-emp-t>tbody>tr:not(.pe-emp-det)')].map(x=>x.textContent.replace(/[\s  ]+/g,' ').trim()));
 const L1=await linhas();const pontos=await t('.pe-emp-pontos');
 await p.click('[data-action="pe-emp-mes"][data-m="2026/01"]');await p.waitForTimeout(200);
 const jan=await p.evaluate(()=>[...document.querySelectorAll('.pe-emp-t2 tr.pe-emp-erro')].map(x=>x.textContent.replace(/[\s  ]+/g,' ').trim()));
 await p.screenshot({path:path.join(__dirname,'premios_empresa.png'),fullPage:true});
 const botoesPdf=await p.evaluate(()=>[...document.querySelectorAll('[data-action="pe-emp-pdf"]')].map(x=>x.dataset.m));
 const [pop]=await Promise.all([ctx.waitForEvent('page'),p.click('[data-action="pe-emp-pdf"][data-m="2026/01"]')]);await pop.waitForLoadState();
 const pdf=await pop.evaluate(()=>({titulo:document.title,txt:document.body.innerText.replace(/[\s  ]+/g,' '),erros:document.querySelectorAll('tr.erro').length}));
 await pop.screenshot({path:path.join(__dirname,'premios_empresa_pdf.png'),fullPage:true});await pop.close();
 await p.click('[data-action="pe-emp-metodo"][data-v="esquema"]');await p.waitForTimeout(200);
 const L2=await linhas();
 await p.click('[data-action="pe-emp-usar"]');await p.waitForTimeout(800);
 const jan2=est.pm['2026/01']||{},fev2=est.pm['2026/02']||{};
 await ctx.close();
 const R0={antes,erroMau,L1,pontos,jan,L2,jan2,fev2,pdf,botoesPdf,alertas,erros};console.log(JSON.stringify(R0,null,1));
 const ok={
  'sem ficheiro: explica e pede o Excel da empresa':/2 · Conferir o cálculo da empresa/.test(antes)&&/Carregar o ficheiro da empresa/.test(antes),
  'ficheiro com outro formato: erro claro':/não tem o formato esperado/.test(erroMau),
  'deteta encomendas sem o escalão máximo e leads com «<=»':/Gestão de encomendas: a folha «Política» só tem o escalão de 5 %/.test(pontos)&&/Conversão de leads: a fórmula da linha 91 só bonifica acima de 12 %/.test(pontos),
  'deteta valor escrito à mão':/escritos à mão.*Jan · Faturas VO \(\+20,00/.test(pontos),
  'diz quanto vale o método das penalizações':/sobre a comissão do mês; o teu simulador sobre a referência de 400,00.*\+114,40/.test(pontos),
  'janeiro: +99,20 € com o método da empresa (3 erros)':/^Jan\s*254,40\s*€\s*353,60\s*€\s*\+99,20\s*€\s*3 erros/.test(L1[0]),
  'fevereiro bate; março sem dados':/^Fev\s*24,00\s*€\s*24,00\s*€\s*bate\s*Ver/.test(L1[1])&&/^Mar\s*sem dados no ficheiro/.test(L1[2]),
  'erros de janeiro com o porquê':jan.length===3&&jan.some(x=>/Faturas VO.*escrito à mão/.test(x))&&jan.some(x=>/Gestão de encomendas.*Falta o escalão de 15 %/.test(x))&&jan.some(x=>/Conversão de leads.*exatamente nos 12 %/.test(x)),
  'método do simulador: fevereiro difere só pelo método':/^Fev\s*24,00\s*€\s*100,00\s*€\s*\+76,00\s*€\s*só método/.test(L2[1])&&/^Jan\s*254,40\s*€\s*392,00\s*€/.test(L2[0]),
  'PDF só nos meses com erros':JSON.stringify(botoesPdf)==='["2026/01"]',
  'PDF de janeiro: totais, rubricas com o porquê, sem «teu»':pdf.titulo==='Conferência da comissão · Janeiro 2026'&&pdf.erros===3&&/Ficheiro da empresa 254,40 €/i.test(pdf.txt)&&/Segundo o esquema 353,60 €/i.test(pdf.txt)
    &&/Faturas VO.*escrito à mão/.test(pdf.txt)&&/Falta o escalão de 15 %/.test(pdf.txt)&&/Gestão de encomendas: a folha «Política»/.test(pdf.txt)&&!/\bteu\b/i.test(pdf.txt)&&/comissoes\.xlsx/.test(pdf.txt),
  'usar os dados: só preenche o que está vazio':jan2.fvn_r===11&&jan2.fvn_o===10&&jan2.fvo_r===4&&jan2.bm_enc==='Sim'&&jan2.bm_obj===110&&jan2.leads===12&&fev2.fvn_r===9&&fev2.voc===1&&!est.escritas.some(x=>x[1]==='2026/03'),
  'sem erros na página':erros.length===0,
 };
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'TUDO OK');srv.close();await b.close();process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
