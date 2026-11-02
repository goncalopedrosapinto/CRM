// Importar um mapa novo das EOTs sem perder nada do que já estava (dados fictícios):
// - contratos que já existiam: diz quantos estão iguais e o que muda (antes → depois), sem tocar no trabalho da equipa;
// - campo vazio no ficheiro não apaga o que já estava; correção feita à mão depois da última importação fica;
// - contrato repetido dentro do ficheiro: fica a linha com a data de fim mais recente e os vazios vêm da outra;
// - o mesmo contrato escrito de outra forma (zero à esquerda) junta-se ao que existe; os que saem não são apagados;
// - aviso quando muitos contratos saem (pode ser um mapa antigo).
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8778;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const IMP='2026-10-06T10:39:10Z';
const C=(contrato,o)=>Object.assign({contrato,tipo:'Leasing',cliente:'Cliente '+contrato,contacto_nome:null,telefone:null,telemovel:null,data_fim:'2027-01-10',prazo:48,prestacao:150,kms:'40000',
  matricula:'AA-00-AA',modelo:'R 1250 GS',seguro:null,manutencao:null,residual:5000,despesas:0,total:5600,concessionario:'Caetano Baviera Aveiro',conc_resp:'Caetano Baviera Aveiro',vendedor_origem:'Vendedor X',
  no_mapa:true,ultima_import:IMP,fase:'Por contactar',responsavel_id:'v1',temperatura:null,proxima_acao:null,proxima_data:null,notas:null},o);
const base=()=>[C('100001',{cliente:'Cliente Um',telemovel:'911111111',seguro:'Sim',fase:'Contactado',notas:'Quer renovar',temperatura:'Quente',proxima_acao:'Ligar',proxima_data:'2026-11-05'}),
  C('100002',{cliente:'Cliente Dois',telemovel:'922222222'}),C('100003',{cliente:'Cliente Três'}),C('100004',{cliente:'Cliente Quatro'}),C('100005',{cliente:'Cliente Cinco'})];
const CAB=['Concessionário','Vendedor','Tipo','Contrato','Cliente','Contacto','Telefone','Telemóvel','Data Fim','Prazo','Prestação','Kms Contratados','Matrícula','Marca','Modelo','Seguro','Manutenção','Manutenção','Valor Residual a Refinanciar','Despesas Finais','Valor Total a Pagar','Concessionário Responsável'];
const L=o=>{const x=Object.assign({conc:'Caetano Baviera Aveiro',vend:'Vendedor X',tipo:'Leasing',cliente:'',contacto:null,tel:null,tlm:null,fim:'10/01/2027',prazo:48,prest:150,kms:'40000',mat:'AA-00-AA',marca:'BMW Motorrad',modelo:'R 1250 GS',seg:null,m1:null,m2:null,resid:5000,desp:0,total:5600,resp:'Caetano Baviera Aveiro'},o);
  return [x.conc,x.vend,x.tipo,x.ct,x.cliente,x.contacto,x.tel,x.tlm,x.fim,x.prazo,x.prest,x.kms,x.mat,x.marca,x.modelo,x.seg,x.m1,x.m2,x.resid,x.desp,x.total,x.resp];};
const MAPA=[['Mapa de contratos a terminar'],[],CAB,
  L({ct:'100001',cliente:'Cliente Um',tlm:'911111111',resid:4800,seg:null}),          // residual muda; seguro vazio no ficheiro
  L({ct:'100002',cliente:'Cliente Dois',tlm:'920000000'}),                            // o banco ainda tem o número antigo; a equipa corrigiu
  L({ct:'100003',cliente:'Cliente Três'}),                                             // igual
  L({ct:'0100005',cliente:'Cliente Cinco'}),                                           // mesmo contrato com zero à esquerda
  L({ct:'100006',cliente:'Cliente Seis',tlm:'966000000',fim:'01/05/2027',resid:6900}), // novo, repetido no ficheiro…
  L({ct:'100006',cliente:'Cliente Seis',tlm:null,fim:'01/06/2027',resid:7000}),        // …esta linha é mais recente
  L({ct:'200001',cliente:'Outra marca',marca:'BMW'})];
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const est={eot:base(),upserts:[],patches:[],hist:[{contrato:'100002',campo:'telemovel',criado_em:'2026-10-20T10:00:00Z'},{contrato:'100003',campo:'cliente',criado_em:'2026-09-01T10:00:00Z'}]};
 const ctx=await b.newContext({viewport:{width:1400,height:1000}});
 await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('c1'));
 await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt('c1'),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='eot_contratos'&&m==='POST'){const lote=JSON.parse(r.request().postData());est.upserts.push(...lote);
    for(const l of lote){const e=est.eot.find(x=>x.contrato===l.contrato);if(e)Object.assign(e,l);else est.eot.push(Object.assign({fase:'Por contactar'},l));}return r.fulfill({status:201,body:''});}
  if(t==='eot_contratos'&&m==='PATCH'){const body=JSON.parse(r.request().postData());est.patches.push({u,body});
    const ids=((u.match(/contrato=in\.\(([^)]*)\)/)||[])[1]||'').split(',').map(x=>x.replace(/"/g,''));const alvo=est.eot.filter(x=>ids.includes(x.contrato));alvo.forEach(x=>Object.assign(x,body));return json(alvo);}
  if(t==='eot_contratos')return json(est.eot);
  if(t==='eot_historico'&&/tipo=eq\.alteracao/.test(u))return json(est.hist);
  if(t==='profiles')return json([{id:'c1',nome:'Chefe',role:'admin',linha:'motorrad'},{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}]);
  return json([]);});
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
 // o mesmo caminho do botão "Carregar mapa": leitor de Excel substituído por uma folha já lida
 const importar=async rows=>{await p.evaluate(async rows=>{window.XLSX={read:()=>({SheetNames:['f'],Sheets:{f:{}}}),utils:{sheet_to_json:()=>rows}};
   await loadEot();S.screen='dashboard';S.gppSec='eots';render();await eotFicheiro({name:'mapa_novembro.xlsx',arrayBuffer:async()=>new ArrayBuffer(8)});},rows);await p.waitForTimeout(400);};
 await importar(MAPA);
 const prev=await p.evaluate(()=>{const c=document.querySelector('.eot-prev');const tx=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   const det=[...c.querySelectorAll('details.eot-prev-det')].map(d=>({t:tx(d.querySelector('summary')),itens:[...d.querySelectorAll('li')].map(tx)}));
   const P=S.eotPrev;return {txt:tx(c),det,novos:P.novos.map(x=>x.contrato),saem:P.saem.map(x=>x.contrato),iguais:P.iguais,vazios:P.vazios,mudam:P.mudam.length,mantidos:P.mantidos.length,repetidos:P.repetidos.length,formato:P.formato.length,erro:S.eotErrImp||''};});
 await p.screenshot({path:path.join(__dirname,'eot_importacao.png')});
 await p.click('[data-action="eot-confirmar"]');await p.waitForTimeout(900);
 const U=c=>est.upserts.find(x=>x.contrato===c)||{};const E=c=>est.eot.find(x=>x.contrato===c)||{};
 const depois={msg:await p.evaluate(()=>S.eotMsg||S.eotErrImp||''),chaves:Object.keys(U('100001')).sort(),u1:U('100001'),u2:U('100002'),u5:U('100005'),u6:U('100006'),zero:est.upserts.some(x=>x.contrato==='0100005'),
   n:est.upserts.length,e1:E('100001'),e4:E('100004'),total:est.eot.length,saiu:est.patches.find(x=>/100004/.test(x.u))};
 // mapa antigo por engano: quase todos saem → aviso antes de confirmar
 await importar([['x'],CAB,L({ct:'100001',cliente:'Cliente Um',tlm:'911111111',resid:4800})]);
 const antigo=await p.evaluate(()=>(document.querySelector('.eot-prev')||{}).textContent.replace(/[\s  ]+/g,' '));
 await p.click('[data-action="eot-cancelar"]');await p.waitForTimeout(200);
 console.log(JSON.stringify({prev,depois,antigo,erros},null,1));
 const D=t=>(prev.det.find(d=>d.t.startsWith(t))||{itens:[]}).itens.join(' | ');
 const PROIBIDAS=['fase','responsavel_id','temperatura','proxima_acao','proxima_data','notas','fin_visto_em','negocio_id','adenda_em'];
 const ok={
  'pré-visualização: novos, já existiam (iguais e com dados novos) e os que saem':JSON.stringify(prev.novos)==='["100006"]'&&JSON.stringify(prev.saem)==='["100004"]'&&prev.iguais===3&&prev.mudam===1&&/4 já existiam: 3 sem alterações · 1 com dados novos do banco/.test(prev.txt),
  'o que muda: antes → depois, por contrato':/Cliente Um 100001: Valor residual 5\s?000,00 € → 4\s?800,00 €/.test(D('O que muda')),
  'vazio no ficheiro não apaga (seguro do Cliente Um fica)':prev.vazios>=1&&/campos? vazios? no ficheiro: fica o valor que já estava/.test(prev.txt),
  'correção da equipa depois da última importação fica (e diz o que o mapa traz)':prev.mantidos===1&&/Cliente Dois 100002: Telemóvel fica 922222222 \(corrigido a 20\/10\/2026; o mapa traz 920000000\)/.test(D('Correções da equipa')),
  'repetido no ficheiro: avisa e diz em que diferem':prev.repetidos===1&&/1 contrato repetido dentro do ficheiro/.test(prev.txt)&&/Cliente Seis 100006: 2 linhas · diferem em Telemóvel, Data de fim, Valor residual/.test(D('Repetidos')),
  'mesmo contrato com zero à esquerda: junta ao que existe':prev.formato===1&&/1 com o número escrito de outra forma/.test(prev.txt),
  'trabalho da equipa: diz que não é tocado':/Fase, responsável, temperatura, próxima ação, notas, indicações e visto dos financeiros não são tocados/.test(prev.txt),
  'ao gravar: só dados do banco (nada da equipa vai no envio)':depois.n===5&&!PROIBIDAS.some(k=>depois.chaves.includes(k))&&depois.chaves.includes('no_mapa'),
  'ao gravar: residual novo, seguro mantido, telemóvel corrigido mantido':Number(depois.u1.residual)===4800&&depois.u1.seguro==='Sim'&&depois.u2.telemovel==='922222222',
  'ao gravar: contrato com zero à esquerda grava no número que já existia':depois.u5.contrato==='100005'&&!depois.zero&&depois.total===6,
  'ao gravar: do repetido fica a data mais recente e o telemóvel da outra linha':depois.u6.data_fim==='2027-06-01'&&depois.u6.telemovel==='966000000'&&Number(depois.u6.residual)===7000,
  'trabalho da equipa intacto e o que saiu não é apagado':depois.e1.fase==='Contactado'&&depois.e1.notas==='Quer renovar'&&depois.e1.responsavel_id==='v1'&&depois.e1.proxima_acao==='Ligar'&&depois.e4.no_mapa===false&&!!depois.saiu,
  'mensagem: quantos já existiam e onde ficam os valores antigos':/1 novos · 4 já existiam \(1 com dados novos do banco; os valores antigos ficam no histórico de cada contrato\)/.test(depois.msg)&&/1 saíram do mapa/.test(depois.msg),
  'mapa antigo por engano: avisa quando quase todos saem':/4 de 5 contratos saem do mapa: confirma que este é o ficheiro mais recente/.test(antigo),
  'sem erros JS':!erros.length&&!prev.erro};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Importação das EOTs sem perder registos');await b.close();srv.close();process.exit(f?1:0);})();
