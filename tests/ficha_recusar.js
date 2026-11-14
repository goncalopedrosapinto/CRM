// Fichas de margem: o chefe aprova OU não aprova. "Não aprovar" abre o motivo na própria linha (sem janela), com
// sugestões de um toque; sem motivo não grava; Enter confirma e Escape fecha. A ficha sai da lista e fica em
// "Não aprovadas, à espera do vendedor" (fechada por omissão); o vendedor vê o motivo nos comentários do negócio e
// na ficha; quando muda a ficha, a recusa cai e volta ao chefe. Aprovar mesmo assim limpa a recusa.
// Também na própria ficha (chefe) e no PDF. Sem o SQL novo: a lista continua a funcionar e o aviso diz o que falta.
// Dados fictícios.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8779;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Felipe Gomes',role:'vendedor',linha:'motorrad'}};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 // margem negativa: precisa de aprovação
 const dados={natureza:'MN',iva:23,modo:'civa',fv:2,modelo:'R 1300 GS',pvb:'24500',preco_venda:'21000',mg_fixa_pct:'6',mg_var_pct:'3.5'};
 const db={fichas:[{id:21,negocio_id:5,estado:'ativa',criado_em:'2026-10-30T10:00:00Z',updated_at:'2026-10-30T10:00:00Z',dados,aprovada_em:null,aprovada_por:null,recusada_em:null,recusada_por:null,recusa_motivo:null}],
   hist:[],seq:1,log:[],semSql:false};
 const recs=[{id:5,status:'Quente',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Ficticio',model:'R 1300 GS',updated_at:new Date().toISOString()}];
 const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  if(u.includes('/rpc/ficha_recusar')){const q=JSON.parse(r.request().postData());db.log.push('recusar '+q.p_id+' «'+q.p_motivo+'»');
   if(db.semSql)return json({code:'PGRST202',message:'Could not find the function public.ficha_recusar(p_id, p_motivo) in the schema cache'},404);
   if(!String(q.p_motivo||'').trim())return json({code:'22023',message:'Escreve o motivo: o vendedor precisa de saber o que mudar'},400);
   const f=db.fichas.find(x=>x.id===q.p_id);Object.assign(f,{recusada_em:new Date().toISOString(),recusada_por:quem,recusa_motivo:String(q.p_motivo).trim(),aprovada_em:null,aprovada_por:null});
   db.hist.push({id:900+db.seq++,negocio_id:f.negocio_id,autor_id:quem,autor_nome:PERFIS[quem].nome,autor_role:'admin',tipo:'comentario',texto:'Ficha de margem ('+f.dados.modelo+') não aprovada: '+f.recusa_motivo,criado_em:new Date().toISOString()});
   return json(f.recusada_em);}
  if(u.includes('/rpc/ficha_aprovar')){const q=JSON.parse(r.request().postData());db.log.push('aprovar '+q.p_id+' '+q.p_aprovar);const f=db.fichas.find(x=>x.id===q.p_id);
   Object.assign(f,{aprovada_em:q.p_aprovar?new Date().toISOString():null,aprovada_por:q.p_aprovar?quem:null},q.p_aprovar?{recusada_em:null,recusada_por:null,recusa_motivo:null}:{});return json(f.aprovada_em);}
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='fichas_margem'){
   if(db.semSql&&/recusa/.test(u))return json({code:'42703',message:'column fichas_margem.recusada_em does not exist'},400);
   const porId=(u.match(/[?&]id=eq\.(\d+)/)||[])[1],porNeg=(u.match(/negocio_id=eq\.(\d+)/)||[])[1];
   const sel=db.fichas.filter(x=>(!porId||x.id===+porId)&&(!porNeg||x.negocio_id===+porNeg));
   const semRec=x=>{if(!db.semSql)return x;const y=Object.assign({},x);delete y.recusada_em;delete y.recusada_por;delete y.recusa_motivo;return y;};
   if(m==='GET')return json(sel.map(semRec));
   if(m==='PATCH'){const body=JSON.parse(r.request().postData());sel.forEach(x=>{if(body.dados&&JSON.stringify(body.dados)!==JSON.stringify(x.dados))Object.assign(x,{aprovada_em:null,aprovada_por:null,recusada_em:null,recusada_por:null,recusa_motivo:null});Object.assign(x,body);});
    db.log.push('patch '+sel.map(x=>x.id).join(','));return json(sel.map(semRec));}
   return json([]);}
  if(t==='negocio_historico'){const neg=(u.match(/negocio_id=eq\.(\d+)/)||[])[1],nao=(u.match(/autor_id=neq\.([a-z0-9]+)/)||[])[1];
   return json(db.hist.filter(h=>(!neg||h.negocio_id===+neg)&&(!nao||h.autor_id!==nao)));}
  if(t==='profiles')return json(quem==='c1'?[PERFIS.c1,PERFIS.v1]:[PERFIS.v1,PERFIS.c1]);
  if(t==='baviera_control')return json(recs);
  return json([]);};
 const abrir=async quem=>{const ctx=await b.newContext({viewport:{width:1300,height:900}});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p._dialogos=[];await ligarAvisos(p,p._dialogos,{erros:false});
  p.on('pageerror',e=>erros.push(quem+': '+e.message));await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1800);return {ctx,p};};
 const erros=[];
 const toastTxt=p=>p.evaluate(()=>{const t=document.getElementById('bm-toast');return t?t.textContent:'';});
 const home=async p=>{await p.evaluate(()=>{S.screen='dashboard';S.gppSec='home';S.homeTratar=true;render();});await p.waitForTimeout(250);};
 const caixa=p=>p.evaluate(()=>{const tx=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';const box=document.querySelector('.fa-box');
   return {existe:!!box,soRec:!!document.querySelector('.fa-so-recs'),pend:[...document.querySelectorAll('.fa-box > .mr-row')].map(tx),
     botoes:[...document.querySelectorAll('.fa-box > .mr-row .mr-acts button')].map(tx),resumo:tx(document.querySelector('.fa-recs>summary')),
     recs:[...document.querySelectorAll('.fa-recs .mr-row')].map(tx),recsAberto:!!(document.querySelector('.fa-recs')||{}).open,
     painel:!!document.querySelector('.fa-rec'),foco:document.activeElement&&document.activeElement.id,conta:fichasAprovarLista().length};});

 // ---------- chefe: lista com Aprovar e Não aprovar ----------
 const C=await abrir('c1');const q=C.p;
 await home(q);const A=await caixa(q);await q.screenshot({path:path.join(__dirname,'ficha_recusar.png')});
 await q.click('.fa-box [data-action="fa-recusar"]');await q.waitForTimeout(250);
 const B=await caixa(q);const chips=await q.$$eval('.fa-rec .qf-chip',x=>x.map(e=>e.textContent.trim()));
 await q.screenshot({path:path.join(__dirname,'ficha_recusar_motivo.png')});
 // sem motivo não grava
 await q.click('[data-action="fa-recusar-ok"]');await q.waitForTimeout(300);const semMotivo={toast:await toastTxt(q),log:db.log.filter(l=>l.startsWith('recusar')).length,painel:(await caixa(q)).painel};
 // Escape fecha; reabrir; Cancelar fecha
 await q.press('#fa-motivo','Escape');await q.waitForTimeout(200);const esc1=(await caixa(q)).painel;
 await q.click('.fa-box [data-action="fa-recusar"]');await q.waitForTimeout(200);await q.click('[data-action="fa-recusar-cancel"]');await q.waitForTimeout(200);const canc=(await caixa(q)).painel;
 // sugestão + texto + Enter
 await q.click('.fa-box [data-action="fa-recusar"]');await q.waitForTimeout(200);
 await q.click('.fa-rec .qf-chip');await q.waitForTimeout(100);const aposChip=await q.$eval('#fa-motivo',x=>x.value);
 await q.type('#fa-motivo',' (baixar 300 €)');await q.evaluate(()=>render());await q.waitForTimeout(150);const aposRender=await q.$eval('#fa-motivo',x=>x.value).catch(()=>'');
 await q.press('#fa-motivo','Enter');await q.waitForTimeout(600);
 const D=await caixa(q);const toastRec=await toastTxt(q);
 await q.click('.fa-recs>summary');await q.waitForTimeout(150);await q.evaluate(()=>render());await q.waitForTimeout(150);const E=await caixa(q);
 await q.screenshot({path:path.join(__dirname,'ficha_recusar_lista.png')});
 // na ficha (chefe) e no PDF
 await q.evaluate(()=>fmAbrirNegocio('5','21'));await q.waitForTimeout(700);
 const bannerChefe=await q.$eval('.fm-aprov',x=>x.textContent.replace(/\s+/g,' ').trim()).catch(()=>'');
 const pdf=await q.evaluate(()=>{let h='';const o=window.open;window.open=()=>({document:{open(){},write:x=>{h+=x;},close(){}},focus(){},print(){}});try{fmPDF();}catch(e){}window.open=o;
   const m=h.match(/<div class="aprov[^"]*">([^<]*)<\/div>/);return m?m[1]:'';});

 // ---------- vendedor: comentário e ficha ----------
 const V=await abrir('v1');const p=V.p;
 const comVend=await p.evaluate(()=>{render();const t=document.querySelector('#app').textContent.replace(/\s+/g,' ');const i=t.indexOf('Comentários novos nos teus negócios');return i<0?'':t.slice(i,i+220);});
 await p.evaluate(()=>{setState({screen:'detail',selected:S.records[0]});});await p.waitForTimeout(200);
 await p.click('[data-action="fm-negocio"]');await p.waitForTimeout(700);
 const bannerVend=await p.$eval('.fm-aprov',x=>x.textContent.replace(/\s+/g,' ').trim()).catch(()=>'');
 const botoesVend=await p.$$eval('.fm-aprov button',x=>x.length).catch(()=>-1);
 await p.screenshot({path:path.join(__dirname,'ficha_recusar_vendedor.png')});
 // muda a ficha: a recusa cai e volta ao chefe
 await p.evaluate(()=>fmSet('preco_venda','21500'));await p.waitForTimeout(1200);
 const bannerVend2=await p.$eval('.fm-aprov',x=>x.textContent.replace(/\s+/g,' ').trim()).catch(()=>'');
 await q.evaluate(()=>loadFichasAprovar().then(()=>{S.fmNeg=null;S.screen='dashboard';S.gppSec='home';S.homeTratar=true;render();}));await q.waitForTimeout(400);
 const F=await caixa(q);

 // ---------- chefe: não aprovar dentro da ficha; depois aprovar mesmo assim ----------
 await q.evaluate(()=>fmAbrirNegocio('5','21'));await q.waitForTimeout(700);
 await q.click('.fm-aprov [data-action="fa-recusar"]');await q.waitForTimeout(200);
 const painelFicha=await q.$('.fm-aprov .fa-rec').then(Boolean);
 await q.fill('#fa-motivo','Rever o valor da retoma');await q.click('.fm-aprov [data-action="fa-recusar-ok"]');await q.waitForTimeout(700);
 const bannerFicha=await q.$eval('.fm-aprov',x=>x.textContent.replace(/\s+/g,' ').trim()).catch(()=>'');
 await q.screenshot({path:path.join(__dirname,'ficha_recusar_ficha.png')});
 await home(q);const continuaAberta=await q.evaluate(()=>{const d=document.querySelector('.fa-recs');return !!(d&&d.open);}); // ficou aberta da última vez
 if(!continuaAberta)await q.click('.fa-recs>summary');await q.waitForTimeout(150);
 const dlg0=q._dialogos.length;await q.click('.fa-recs [data-action="fa-aprovar"]');await q.waitForTimeout(600);
 const G=await caixa(q);const confirmTxt=q._dialogos.slice(dlg0).join(' | ');const fichaFinal=Object.assign({},db.fichas[0]);
 // "Não aprovar" e "Cancelar" não abrem janelas do browser (só o Aprovar pede confirmação)
 const dialogosRec=q._dialogos.filter(d=>!/^Aprovar a ficha/.test(d));

 // ---------- sem o SQL novo ----------
 db.semSql=true;db.fichas[0]=Object.assign(db.fichas[0],{aprovada_em:null,aprovada_por:null,recusada_em:null,recusada_por:null,recusa_motivo:null});
 await q.evaluate(()=>loadFichasAprovar().then(()=>{S.screen='dashboard';S.gppSec='home';S.homeTratar=true;render();}));await q.waitForTimeout(400);
 const H=await caixa(q);
 await q.click('.fa-box [data-action="fa-recusar"]');await q.waitForTimeout(200);await q.fill('#fa-motivo','Teste');await q.click('[data-action="fa-recusar-ok"]');await q.waitForTimeout(500);
 const semSqlToast=await toastTxt(q);const semSqlPainel=(await caixa(q)).painel;

 await C.ctx.close();await V.ctx.close();
 const R={A,B,chips,semMotivo,esc1,canc,aposChip,aposRender,D,toastRec,E,bannerChefe,pdf,comVend,bannerVend,botoesVend,bannerVend2,F,painelFicha,bannerFicha,G,confirmTxt,fichaFinal,dialogosRec,H,semSqlToast,semSqlPainel,log:db.log,erros};
 console.log(JSON.stringify(R,null,1));
 const motivo='Margem negativa: rever o preço de venda (baixar 300 €)';
 const ok={
  'lista do chefe: Abrir ficha · Não aprovar · Aprovar':A.pend.length===1&&/Cliente Ficticio/.test(A.pend[0])&&JSON.stringify(A.botoes)==='["Abrir ficha","Não aprovar","Aprovar"]'&&A.conta===1&&!A.painel,
  'Não aprovar abre o motivo na linha (sem janela), com o cursor no campo':B.painel&&B.foco==='fa-motivo'&&dialogosRec.length===0,
  'sugestões conforme a ficha (margem negativa e esforço acima da variável, retoma, falta informação)':JSON.stringify(chips)===JSON.stringify(['Margem negativa: rever o preço de venda','Esforço acima da margem variável: rever o desconto','Rever o valor da retoma','Falta informação na ficha']),
  'sem motivo não grava e diz porquê':/Escreve o motivo/.test(semMotivo.toast)&&semMotivo.log===0&&semMotivo.painel,
  'Escape e Cancelar fecham sem gravar':esc1===false&&canc===false&&!db.log.some(l=>l.startsWith('recusar')&&!/«Margem|«Rever|«Teste/.test(l)),
  'sugestão preenche o motivo e o texto sobrevive a redesenhar':aposChip==='Margem negativa: rever o preço de venda'&&aposRender===motivo,
  'Enter grava: quem, motivo; sai da lista e não conta nos pendentes':db.log.includes('recusar 21 «'+motivo+'»')&&D.pend.length===0&&D.conta===0&&D.soRec&&/Não aprovadas, à espera do vendedor · 1/.test(D.resumo)&&!D.recsAberto&&/não aprovada/i.test(toastRec)&&/comentários do negócio/.test(toastRec),
  'lista das não aprovadas mostra o motivo e fica aberta depois de redesenhar':E.recsAberto&&E.recs.length===1&&E.recs[0].includes('«'+motivo+'»')&&/Aprovar mesmo assim/.test(E.recs[0]),
  'na ficha do chefe e no PDF aparece quem não aprovou e porquê':/Não aprovada por Chefe GPP/.test(bannerChefe)&&bannerChefe.includes('«'+motivo+'»')&&/Aprovar mesmo assim/.test(bannerChefe)&&/^NÃO APROVADO PELA CHEFIA \(Chefe GPP\)/.test(pdf)&&pdf.includes(motivo),
  'vendedor recebe o motivo em Comentários novos':/Cliente Ficticio — Ficha de margem \(R 1300 GS\) não aprovada: Margem negativa/.test(comVend),
  'vendedor vê na ficha quem não aprovou, porquê e o que fazer (sem botões do chefe)':/Não aprovada por Chefe GPP/.test(bannerVend)&&bannerVend.includes('«'+motivo+'»')&&/Quando mudares a ficha, volta a ir ao chefe/.test(bannerVend)&&botoesVend===0,
  'vendedor muda a ficha: a recusa cai e volta ao chefe':/Necessário aprovação da chefia/.test(bannerVend2)&&/Já aparece ao chefe/.test(bannerVend2)&&F.pend.length===1&&F.conta===1&&!F.resumo,
  'não aprovar dentro da ficha (chefe)':painelFicha&&/Não aprovada por Chefe GPP/.test(bannerFicha)&&/«Rever o valor da retoma»/.test(bannerFicha)&&db.log.includes('recusar 21 «Rever o valor da retoma»'),
  'aprovar mesmo assim: pede confirmação com o motivo anterior e limpa a recusa':db.log.includes('aprovar 21 true')&&/Tinhas não aprovado: «Rever o valor da retoma»/.test(confirmTxt)&&!G.existe&&fichaFinal.aprovada_em&&!fichaFinal.recusada_em&&!fichaFinal.recusa_motivo,
  'sem o SQL novo: a lista continua e o aviso diz que SQL falta':H.pend.length===1&&/falta correr o SQL "2026-11-02_fichas_recusar"/.test(semSqlToast)&&semSqlPainel,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Aprovar / não aprovar fichas correto');await b.close();srv.close();process.exit(f?1:0);})();
