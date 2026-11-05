// Acordo de venda das motas usadas: botão no negócio (só MU, vendedor do negócio ou chefe), painel com o que vem do negócio
// e os campos só do acordo (guardados sozinhos), e o PDF oficial preenchido, com o nome «Acordo de venda MATRÍCULA.pdf».
// O PDF descarregado é lido de volta e cada campo é conferido. Dados fictícios.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const RAIZ=path.resolve(__dirname,'..');const FILE=path.resolve(process.argv[2]||path.join(RAIZ,'index.html'));
const PDFLib=require(path.join(RAIZ,'vendor','pdf-lib.min.js'));
const PORTA=8782;
const TIPOS={'.pdf':'application/pdf','.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8'};
const srv=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=u==='/'||u==='/index.html'?FILE:path.join(RAIZ,u.replace(/^\/+/,''));
  if(!f.startsWith(RAIZ)||!fs.existsSync(f)){s.writeHead(404);return s.end('');}s.writeHead(200,{'content-type':TIPOS[path.extname(f)]||'application/octet-stream'});s.end(fs.readFileSync(f));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'},v2:{id:'v2',nome:'Vendedor Dois',role:'vendedor',linha:'motorrad'}};
const hoje=new Date();const hojePT=String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear();
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const recs=[{id:7,vendedor_id:'v1',status:'Carteira',type:'MU',id_cliente:'Cliente Usada Ficticio',nif:'123456789',morada:'Rua das Flores 10, Esgueira, Aveiro',local:'3800-100',cc:'12345678 9ZZ1',
     contacto:'912 345 678',email:'cliente@exemplo.pt',model:'R 1250 GS',version:'Adventure',mat:'aa-11-bb',pvp:'12500',retoma:'Sim',retoma_modelo:'Honda Africa Twin',retoma_mat:'22-cc-33',retoma_kms:35000,retoma_cor:'Vermelho',retoma_data_matricula:'2019-05-20',retoma_valor:6500,sinal:1500,sinal_forma:'Transferência',fin:'PP',dmat:'2021-03-15',stock_id:31,
     obs:'NOTA INTERNA que não pode ir para o cliente',updated_at:new Date().toISOString()},
   {id:8,vendedor_id:'v1',status:'Quente',type:'MN',id_cliente:'Cliente Nova',model:'R 1300 GS',updated_at:new Date().toISOString()},
   {id:9,vendedor_id:'v1',status:'Quente',type:'MU',id_cliente:'Cliente Sem Dados',updated_at:new Date().toISOString()}];
 const est={acordos:{},escritas:[],semSql:false,docs:{},reg:[]};
 const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='acordos_venda'){if(est.semSql)return json({code:'PGRST205',message:"Could not find the table 'public.acordos_venda' in the schema cache"},404);
    const id=+(u.match(/negocio_id=eq\.(\d+)/)||[])[1];
    if(m==='GET')return json(est.acordos[id]?[{dados:est.acordos[id],updated_at:new Date().toISOString()}]:[]);
    const body=JSON.parse(r.request().postData());est.escritas.push([m,body.negocio_id||id,JSON.parse(JSON.stringify(body.dados))]);
    if(m==='PATCH'){if(!est.acordos[id])return json([]);est.acordos[id]=body.dados;return json([{negocio_id:id,dados:body.dados}]);}
    if(m==='POST'){est.acordos[body.negocio_id]=body.dados;return json([body],201);}}
  if(u.includes('/storage/v1/object/')){const k=u.split(/negocio-documentos\//)[1];if(est.semSql)return json({statusCode:'404',error:'Bucket not found',message:'Bucket not found'},400);
    if(m==='POST'){est.docs[k]=r.request().postDataBuffer();return json({Key:k});}if(est.docs[k])return r.fulfill({status:200,contentType:'application/pdf',body:est.docs[k]});return json({message:'not found'},404);}
  if(t==='documentos_emitidos'){if(est.semSql)return json({code:'PGRST205',message:"Could not find the table 'public.documentos_emitidos' in the schema cache"},404);
    if(m==='POST'){const bd=JSON.parse(r.request().postData());est.reg.push(Object.assign({id:est.reg.length+1,criado_em:new Date().toISOString(),criado_por:quem},bd));return json([est.reg[est.reg.length-1]],201);}
    const id=+(u.match(/negocio_id=eq\.(\d+)/)||[])[1];return json(est.reg.filter(x=>x.negocio_id===id));}
  if(t==='stock_usadas_publico'||t==='stock_usadas')return json([{id:31,modelo:'R 1250 GS Adventure',matricula:'AA-11-BB',kms:41000,ano:2021,categoria:'usada',estado:'A negociar'}]);
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control')return json(recs);
  return json([]);};
 const erros=[];
 // «Gerar PDF» abre logo um separador com o PDF (blob); o teste lê o PDF que a página criou
 const gerar=async(pg,sel,destino)=>{const [pop]=await Promise.all([pg.context().waitForEvent('page',{timeout:15000}),pg.click(sel)]);
   for(let i=0;i<150;i++){if(await pg.evaluate(()=>!!window.__ultimoPdf))break;await pg.waitForTimeout(100);}
   const b64=await pg.evaluate(async()=>{const a=new Uint8Array(await window.__ultimoPdf.arrayBuffer());window.__ultimoPdf=null;let s='';for(let i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s);});
   fs.writeFileSync(destino,Buffer.from(b64,'base64'));await pg.waitForTimeout(300);const url=pop.url();await pop.close().catch(()=>{});return url;};
 const abrir=async(quem,vp)=>{const ctx=await b.newContext({viewport:vp||{width:1280,height:1000},acceptDownloads:true});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.addInitScript(()=>{const o=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b&&b.type==='application/pdf')window.__ultimoPdf=b;return o(b);};});
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 const negocio=async(p,id)=>{await p.evaluate(id=>{S.acordoAberto=null;setState({screen:'detail',selected:S.records.find(r=>r.id===id)});},id);await p.waitForTimeout(250);};
 const painel=p=>p.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';const box=document.getElementById('ac-box');
   const v={};document.querySelectorAll('#ac-box [data-ac]').forEach(e=>{v[e.dataset.ac]=e.type==='checkbox'?e.checked:e.value;});
   return {botao:t(document.querySelector('[data-action="acordo-abrir"]')),aberto:!!box,neg:t(box&&box.querySelector('.ac-neg')),faltas:t(box&&box.querySelector('.ac-faltas')),vals:t(document.getElementById('ac-vals')),
     nome:t(box&&box.querySelector('.ac-nome')),aviso:t(box&&box.querySelector('.mg-aviso')),estado:t(document.getElementById('ac-est')),v,retoma:!!document.getElementById('ac-retoma_marca')};});
 const lerPDF=async f=>{const doc=await PDFLib.PDFDocument.load(fs.readFileSync(f));const form=doc.getForm();const o={};
   form.getFields().forEach(x=>{const n=x.getName();o[n]=x instanceof PDFLib.PDFCheckBox?x.isChecked():String(x.getText()||'').replace(/[\s  ]+/g,' ');});return o;};
 // ---------- vendedor do negócio ----------
 const V1=await abrir('v1');const p=V1.p;
 await negocio(p,8);const nova=await painel(p);const folhaNaNova=await p.evaluate(()=>!!document.querySelector('[data-action="folha-abrir"]'));
 await negocio(p,7);const A=await painel(p);
 await p.click('[data-action="acordo-abrir"]');await p.waitForTimeout(600);const B=await painel(p);
 // escrever o que é do acordo (grava sozinho)
 const escrever=async(k,v)=>{await p.fill('#ac-'+k,v);};
 await escrever('viatura_cor','Cinzento Racing');
 await escrever('observacoes','Inclui malas laterais e revisão dos 40 000 km.');await p.check('#ac-bmw_fs');
 const caixa=await p.evaluate(()=>{const c=document.getElementById('ac-bmw_fs');const cs=getComputedStyle(c);const r=c.getBoundingClientRect();return {borda:parseFloat(cs.borderTopWidth),fundo:cs.backgroundColor,img:cs.backgroundImage!=='none',w:r.width,h:r.height};});
 await p.waitForTimeout(1200);const C=await painel(p);const escritas1=est.escritas.slice();
 await p.evaluate(()=>render());await p.waitForTimeout(150);const D=await painel(p);
 await p.evaluate(()=>document.getElementById('ac-vals').scrollIntoView({block:'end'}));await p.screenshot({path:path.join(__dirname,'acordo_venda.png'),fullPage:false});
 // descarregar
 const destino=path.join(__dirname,'acordo_venda_teste.pdf');const urlPop=await gerar(p,'[data-action="acordo-pdf"]',destino);await p.waitForTimeout(500);
 const nomeFicheiro=(est.reg[0]||{}).nome;
 const pdf=await lerPDF(destino);const guardadoNoFim=est.acordos[7]||{};
 await p.waitForTimeout(300);const emit=await p.evaluate(()=>[...document.querySelectorAll('#ac-box .doc-lista li')].map(li=>li.textContent.replace(/\s+/g,' ').trim()));
 const destino3=path.join(__dirname,'acordo_venda_teste2.pdf');const urlAbrir=await gerar(p,'#ac-box [data-action="doc-abrir"]',destino3);const nomeAbrir=(est.reg[0]||{}).nome;const pdfGuardado=await lerPDF(destino3);try{fs.unlinkSync(destino3);}catch(e){}
 // negócio usado sem dados: diz o que falta, nome sem matrícula
 await negocio(p,9);await p.click('[data-action="acordo-abrir"]');await p.waitForTimeout(500);const E=await painel(p);
 await V1.ctx.close();
 // ---------- chefe vê o botão em negócios usados de qualquer vendedor; outro vendedor não ----------
 const C1=await abrir('c1');await negocio(C1.p,7);const chefe=await painel(C1.p);await C1.ctx.close();
 const V2=await abrir('v2');await negocio(V2.p,7);const outro=await painel(V2.p);await V2.ctx.close();
 // ---------- sem o SQL: avisa e o PDF sai na mesma ----------
 est.semSql=true;const V1b=await abrir('v1',{width:390,height:844});const q=V1b.p;await negocio(q,7);await q.click('[data-action="acordo-abrir"]');await q.waitForTimeout(500);const F=await painel(q);
 await q.screenshot({path:path.join(__dirname,'acordo_venda_telemovel.png'),fullPage:false});
 await q.evaluate(()=>{window.open=()=>null;});const [dl2]=await Promise.all([q.waitForEvent('download',{timeout:15000}),q.click('[data-action="acordo-pdf"]')]);const nome2=dl2.suggestedFilename();
 const larg=await q.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
 await V1b.ctx.close();
 const R={urlPop,urlAbrir,emit,nomeAbrir,reg:est.reg.map(x=>({negocio_id:x.negocio_id,tipo:x.tipo,caminho:x.caminho,nome:x.nome})),nova,A,B,C,caixa,escritas1,D,nomeFicheiro,pdf,guardadoNoFim,E,chefe,outro,F,nome2,larg,erros};
 console.log(JSON.stringify(R,null,1));
 const ultima=escritas1[escritas1.length-1]||[];
 const ok={
  'só nos negócios de usadas (o de mota nova tem a Folha de Negócio, não o acordo)':!nova.botao&&folhaNaNova&&/Acordo de venda/.test(A.botao)&&!A.aberto,
  'abre na página com o que vem do negócio e sem faltas':B.aberto&&/Cliente Usada Ficticio/.test(B.neg)&&/123456789/.test(B.neg)&&/3800-100/.test(B.neg)&&/AA-11-BB/.test(B.neg)&&/Honda Africa Twin · 22-CC-33/.test(B.neg)&&!B.faltas&&!/NOTA INTERNA/.test(B.neg),
  'valores por omissão: data de hoje, marca, km do stock, data da matrícula, retoma Honda, pronto pagamento':B.v.data_acordo===hoje.toISOString().slice(0,10)||B.v.data_acordo===`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`,
  'por omissão (resto)':B.v.viatura_marca==='BMW'&&B.v.viatura_kms==='41000'&&B.v.viatura_data_matricula==='2021-03-15'&&B.v.retoma_marca==='Honda'&&B.v.forma_pagamento==='Pronto pagamento'&&B.retoma,
  'grava sozinho o que se escreve (no negócio certo)':ultima[1]===7&&ultima[2].viatura_cor==='Cinzento Racing'&&ultima[2].observacoes&&ultima[2].bmw_fs===true&&/guardado/.test(C.estado),
  'valores do acordo: sinal, retoma e valor a liquidar':/Sinal ?1 500,00 €/.test(C.vals)&&/Retoma ?6 500,00 €/.test(C.vals)&&/Valor a liquidar ?4 500,00 €/.test(C.vals)&&/Valor de venda ?12 500,00 €/.test(C.vals),
  'a caixa da BMW FS vê-se (borda) e mostra o visto quando marcada':caixa.borda>=1&&caixa.w>=16&&caixa.h>=16&&caixa.img&&caixa.fundo!=='rgba(0, 0, 0, 0)',
  'o que se escreveu sobrevive a redesenhar':D.v.viatura_cor==='Cinzento Racing'&&!!D.v.observacoes&&D.v.bmw_fs===true,
  'nome do ficheiro: Acordo de venda + matrícula':nomeFicheiro==='Acordo de venda AA-11-BB.pdf'&&/Acordo de venda AA-11-BB\.pdf/.test(B.nome),
  'PDF: dados do negócio e do cliente':pdf.vendedor==='Vendedor Um'&&pdf.ponto_venda==='Caetano Baviera · Aveiro'&&pdf.data_acordo===hojePT&&pdf.cliente_nome==='Cliente Usada Ficticio'&&pdf.cliente_nif==='123456789'&&
    pdf.cliente_morada==='Rua das Flores 10, Esgueira, Aveiro'&&pdf.cliente_cp==='3800-100'&&pdf.cliente_cc==='12345678 9ZZ1'&&pdf.cliente_telemovel==='912 345 678'&&pdf.cliente_email==='cliente@exemplo.pt'&&!pdf.empresa_nome,
  'PDF: mota vendida':pdf.viatura_marca==='BMW'&&pdf.viatura_modelo==='R 1250 GS Adventure'&&pdf.viatura_matricula==='AA-11-BB'&&pdf.viatura_cor==='Cinzento Racing'&&!('viatura_estofos' in pdf)&&pdf.viatura_kms==='41 000'&&pdf.viatura_data_matricula==='15/03/2021',
  'PDF: retoma':pdf.retoma_marca==='Honda'&&pdf.retoma_modelo==='Honda Africa Twin'&&pdf.retoma_matricula==='22-CC-33'&&pdf.retoma_kms==='35 000'&&pdf.retoma_cor==='Vermelho'&&pdf.retoma_data_matricula==='20/05/2019'&&pdf.retoma_valor==='6 500,00',
  'PDF: sinal, pagamento, valores, observações e BMW FS':!pdf.sinal_numerario&&pdf.sinal_transferencia==='1 500,00'&&!pdf.sinal_cheque&&!pdf.sinal_mb&&pdf.forma_pagamento==='Pronto pagamento'&&
    pdf.valor_venda==='12 500,00'&&pdf.valor_sinal==='1 500,00'&&pdf.valor_retoma==='6 500,00'&&pdf.valor_liquidar==='4 500,00'&&pdf.observacoes==='Inclui malas laterais e revisão dos 40 000 km.'&&pdf.bmw_fs_conhecimento===true,
  'fica guardado no negócio tal como saiu e abre-se em «Emitidos»':est.reg.length===1&&est.reg[0].negocio_id===7&&est.reg[0].tipo==='acordo_venda'&&/^7\/acordo_venda-\d{8}-\d{6}-\w+\.pdf$/.test(est.reg[0].caminho)&&
    est.reg[0].dados.campos.cliente_nome==='Cliente Usada Ficticio'&&emit.length===1&&/Vendedor Um/.test(emit[0])&&nomeAbrir==='Acordo de venda AA-11-BB.pdf'&&pdfGuardado.valor_liquidar==='4 500,00',
  'a nota interna do negócio não vai para o PDF':!Object.values(pdf).some(v=>/NOTA INTERNA/.test(String(v))),
  'ao descarregar fica guardado tal como saiu (data incluída)':guardadoNoFim.data_acordo&&guardadoNoFim.viatura_kms==='41000'&&guardadoNoFim.viatura_cor==='Cinzento Racing',
  'negócio usado sem dados: diz o que falta e o nome sai sem matrícula':/Falta no negócio: NIF, Morada, Código postal, C\.C\., Telemóvel, E-mail, Modelo, Matrícula, Valor de venda \(PVP\)/.test(E.faltas)&&E.nome==='Acordo de venda.pdf'&&!E.retoma,
  'chefe tem o botão; outro vendedor não':/Acordo de venda/.test(chefe.botao)&&!outro.botao,
  'sem o SQL: avisa e o PDF sai na mesma; separador bloqueado → descarrega (telemóvel sem scroll de lado)':/Falta correr o SQL "2026-11-04_acordos_venda"/.test(F.aviso)&&nome2==='Acordo de venda AA-11-BB.pdf'&&larg,
  '«Gerar PDF» abre logo o PDF num separador (e «Abrir» também)':/^blob:/.test(urlPop||'')&&/^blob:/.test(urlAbrir||''),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 try{fs.unlinkSync(path.join(__dirname,'acordo_venda_teste.pdf'));}catch(e){}
 console.log(f?`FALHOU (${f})`:'Acordo de venda correto');await b.close();srv.close();process.exit(f?1:0);})();
