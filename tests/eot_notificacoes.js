// Notificações das EOTs: a última indicação de cada conversa espera pelo outro lado. Indicação de vendedor/chefe →
// todos os financeiros; indicação de financeiro → o responsável da EOT (e o chefe, se escreveu na conversa ou não há
// responsável). «Lido» tira só a quem carrega; responder tira a todo o lado e passa a notificação para o outro.
// O chefe vê as conversas penduradas. Novas indicações chegam sozinhas (a cada minuto) e, com a página em segundo
// plano e autorização, aparecem como aviso do computador. Sem o SQL, as notificações funcionam e o «Lido» avisa.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8770;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const P={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Felipe Gomes',role:'vendedor',linha:'motorrad'},
  f1:{id:'f1',nome:'Beatriz Amaral',role:'financeiro',linha:'motorrad'},f2:{id:'f2',nome:'Francisco Dias',role:'financeiro',linha:'motorrad'}};
const ha=min=>new Date(Date.now()-min*60e3).toISOString();
const db={seq:5,semTabela:false,
  eot:[{contrato:'E1',cliente:'Cliente Um',modelo:'R 1300 GS',data_fim:'2027-03-01',fase:'Contactado',responsavel_id:'v1',no_mapa:true},
       {contrato:'E2',cliente:'Cliente Dois',modelo:'F 900 R',data_fim:'2027-04-01',fase:'Proposta',responsavel_id:'v1',no_mapa:true},
       {contrato:'E3',cliente:'Cliente Três',modelo:'S 1000 R',data_fim:'2027-05-01',fase:'Por contactar',responsavel_id:null,no_mapa:true}],
  hist:[{id:1,contrato:'E1',tipo:'comentario',autor_id:'v1',autor_nome:'Felipe Gomes',autor_role:'vendedor',criado_em:ha(60),texto:'Preciso dos valores de refinanciamento'},
        {id:2,contrato:'E2',tipo:'comentario',autor_id:'v1',autor_nome:'Felipe Gomes',autor_role:'vendedor',criado_em:ha(50),texto:'Cliente quer adenda'},
        {id:3,contrato:'E2',tipo:'comentario',autor_id:'f1',autor_nome:'Beatriz Amaral',autor_role:'financeiro',criado_em:ha(40),texto:'Adenda aprovada, avança',imagens:['E2/a.webp']},
        {id:4,contrato:'E3',tipo:'comentario',autor_id:'c1',autor_nome:'Chefe GPP',autor_role:'admin',criado_em:ha(1500),texto:'Vejam este contrato'}],
  lidas:[],posts:[]};
const visivel=(u,c)=>u==='v1'?(db.eot.find(x=>x.contrato===c)||{}).responsavel_id==='v1':true;
async function abrir(b,uid){
  const ctx=await b.newContext({viewport:{width:1300,height:900}});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(uid));
  await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
    const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return json({access_token:jwt(uid),refresh_token:'rt2'});
    const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];const q=k=>(u.match(new RegExp('[?&]'+k+'=eq\\.([^&]+)'))||[])[1];
    if(t==='profiles'){const id=q('id');return json(id?[P[id]].filter(Boolean):Object.values(P));}
    if(t==='eot_contratos')return json(db.eot.filter(x=>visivel(uid,x.contrato)));
    if(t==='eot_historico'){
      if(m==='POST'){const body=JSON.parse(r.request().postData());const h=Object.assign({id:db.seq++,criado_em:new Date().toISOString(),autor_id:uid,autor_nome:P[uid].nome,autor_role:P[uid].role},body);db.hist.push(h);db.posts.push({uid,body});return r.fulfill({status:201,body:''});}
      let L=db.hist.filter(h=>visivel(uid,h.contrato));const c=q('contrato');if(c)L=L.filter(h=>h.contrato===c);if(q('tipo'))L=L.filter(h=>h.tipo===q('tipo'));
      L=L.slice().sort((a,b2)=>b2.id-a.id);const lim=(u.match(/limit=(\d+)/)||[])[1];if(lim)L=L.slice(0,+lim);
      if(/select=id(&|$)/.test(u))L=L.map(h=>({id:h.id}));return json(L);}
    if(t==='eot_notif_lidas'){
      if(db.semTabela)return json({code:'PGRST205',message:"Could not find the table 'public.eot_notif_lidas' in the schema cache"},404);
      if(m==='GET'){const id=q('user_id');return json(db.lidas.filter(l=>uid==='c1'?(!id||l.user_id===id):l.user_id===uid));}
      if(m==='PATCH'){const body=JSON.parse(r.request().postData());const al=db.lidas.filter(l=>l.user_id===q('user_id')&&l.contrato===q('contrato'));al.forEach(l=>Object.assign(l,body));return json(al);}
      if(m==='POST'){const body=JSON.parse(r.request().postData());if(body.user_id!==uid)return json({message:'row-level security'},403);db.lidas.push(body);return json([body],201);}}
    return json([]);});
  const p=await ctx.newPage();p._erros=[];p.on('pageerror',e=>p._erros.push(uid+': '+e.message));p.on('dialog',d=>d.accept());
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1600);return p;}
const lista=p=>p.evaluate(()=>notifLista().map(x=>x.contrato));
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const fran=await abrir(b,'f2');
 const r={};
 r.franInicio=await lista(fran);
 r.franTitulo=await fran.title();
 r.franTab=await fran.evaluate(()=>{const t=[...document.querySelectorAll('.top-tab')].find(x=>/Notificações/.test(x.textContent));return t?t.textContent.replace(/\s+/g,' ').trim():'';});
 r.franBanner=await fran.evaluate(()=>!!document.querySelector('.nt-banner'));
 r.franMarca=await fran.evaluate(()=>document.querySelectorAll('.nt-dot').length);
 await fran.click('.top-tab[data-s="notificacoes"]');await fran.waitForTimeout(500);
 r.franLinhas=await fran.$$eval('.nt-row',x=>x.map(e=>e.textContent.replace(/\s+/g,' ').trim()));
 await fran.click('.nt-row:nth-child(2) [data-action="nt-lido"]');await fran.waitForTimeout(500);
 r.franDepoisLido=await lista(fran);r.lidas=JSON.parse(JSON.stringify(db.lidas));
 const bea=await abrir(b,'f1');r.beaInicio=await lista(bea);
 const fel=await abrir(b,'v1');r.felInicio=await lista(fel);
 r.felHoje=await fel.evaluate(()=>[...document.querySelectorAll('.vh-row')].map(x=>x.textContent.replace(/\s+/g,' ').trim()));
 r.felMenu=await fel.evaluate(()=>{const n=[...document.querySelectorAll('.vnav-item')].find(x=>/EOTs/.test(x.textContent));return n?n.textContent.replace(/\s+/g,' ').trim():'';});
 const chefe=await abrir(b,'c1');r.chefeInicio=await lista(chefe);
 await chefe.evaluate(()=>{S.screen='dashboard';S.gppSec='notificacoes';render();});await chefe.waitForTimeout(300);
 r.chefeEquipa=await chefe.$$eval('.nt-eqr',x=>x.map(e=>({t:e.textContent.replace(/\s+/g,' ').trim(),tarde:e.classList.contains('tarde')})));
 // Beatriz responde na EOT E3 a partir da notificação
 await bea.evaluate(()=>{S.screen='notificacoes';render();});await bea.waitForTimeout(300);
 await bea.click('.nt-row [data-action="nt-abrir"][data-c="E3"]');await bea.waitForTimeout(700);
 r.beaModal=await bea.evaluate(()=>({aberto:S.eotAberto,banner:(document.querySelector('.nt-modal')||{}).textContent||''}));
 await bea.fill('#eotm-com','Já vi, falta o residual atualizado');await bea.click('[data-action="eotm-comentar"]');await bea.waitForTimeout(900);
 r.beaDepois=await lista(bea);
 // um minuto depois: o Francisco perde a E3; o chefe (com a página em segundo plano) recebe aviso do computador
 await fran.evaluate(()=>notifPoll());await fran.waitForTimeout(600);r.franPoll=await lista(fran);
 await chefe.evaluate(()=>{window.__avisos=[];window.Notification=class{constructor(t,o){window.__avisos.push({t,body:o&&o.body});}close(){}};window.Notification.permission='granted';
   Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});});
 await chefe.evaluate(()=>notifPoll());await chefe.waitForTimeout(700);
 r.chefePoll=await lista(chefe);r.chefeAvisos=await chefe.evaluate(()=>window.__avisos);
 await chefe.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});render();});await chefe.waitForTimeout(200);
 r.chefeEquipa2=await chefe.$$eval('.nt-eqr',x=>x.map(e=>e.textContent.replace(/\s+/g,' ').trim()));
 r.chefeTab=await chefe.evaluate(()=>{const t=[...document.querySelectorAll('.sec-tab')].find(x=>/Notificações/.test(x.textContent));return t?t.textContent.replace(/\s+/g,' ').trim():'';});
 await chefe.screenshot({path:path.join(__dirname,'eot_notificacoes.png')});
 // sem o SQL: as notificações aparecem, o «Lido» explica o que falta
 db.semTabela=true;const bea2=await abrir(b,'f1');await bea2.evaluate(()=>{S.screen='notificacoes';render();});await bea2.waitForTimeout(300);
 r.semSql={lista:await lista(bea2),aviso:await bea2.evaluate(()=>/falta correr o SQL "2026-10-23_eot_notificacoes"/.test(document.body.textContent))};
 const erros=[fran,bea,fel,chefe,bea2].flatMap(p=>p._erros);r.erros=erros;
 console.log(JSON.stringify(r,null,1));
 const ok={
  'financeiro: recebe as indicações de vendedor e chefe, não a resposta da colega':JSON.stringify(r.franInicio)==='["E3","E1"]',
  'número no separador "Notificações", no título da página e marca 🔔 na lista de EOTs':/Notificações.*\s2$/.test(r.franTab)&&/^\(2\) /.test(r.franTitulo)&&r.franBanner&&r.franMarca===2,
  'lista mostra quem, EOT, cliente e texto':r.franLinhas.length===2&&/Chefe GPP/.test(r.franLinhas[0])&&/EOT E3 · Cliente Três/.test(r.franLinhas[0])&&/Felipe Gomes/.test(r.franLinhas[1])&&/Preciso dos valores/.test(r.franLinhas[1]),
  '«Lido» tira só a quem carrega (fica gravado)':JSON.stringify(r.franDepoisLido)==='["E3"]'&&r.lidas.length===1&&r.lidas[0].user_id==='f2'&&r.lidas[0].contrato==='E1'&&r.lidas[0].hist_id===1&&JSON.stringify(r.beaInicio)==='["E3","E1"]',
  'vendedor: recebe a resposta da financeira, no "A tratar" e no menu':JSON.stringify(r.felInicio)==='["E2"]'&&r.felHoje.some(t=>/EOTs: 1 indicação dos financeiros por ler/.test(t))&&/^EOTs\s*1$/.test(r.felMenu),
  'chefe: sem notificações próprias; vê as conversas penduradas (a lida pelo Francisco não)':r.chefeInicio.length===0&&r.chefeEquipa.length===2&&/Cliente Dois.*à espera de Felipe Gomes/.test(r.chefeEquipa[0].t)&&/Cliente Três.*à espera de financeiros/.test(r.chefeEquipa[1].t)&&r.chefeEquipa[1].tarde&&!r.chefeEquipa[0].tarde,
  'abrir a partir da notificação mostra o aviso na EOT':r.beaModal.aberto==='E3'&&/Por responder: indicação de Chefe GPP/.test(r.beaModal.banner),
  'responder tira a notificação a quem respondeu':JSON.stringify(r.beaDepois)==='["E1"]',
  'um minuto depois sai também para o outro financeiro':JSON.stringify(r.franPoll)==='[]',
  'a resposta passa para o chefe (escreveu na conversa), com aviso do computador':JSON.stringify(r.chefePoll)==='["E3"]'&&r.chefeAvisos.length===1&&/EOT E3 · Cliente Três/.test(r.chefeAvisos[0].t)&&/Beatriz Amaral: Já vi/.test(r.chefeAvisos[0].body),
  'chefe: separador com número e a conversa passa a esperar por ele':/Notificações EOT 1/.test(r.chefeTab)&&r.chefeEquipa2.some(t=>/Cliente Três.*à espera de chefe de vendas/.test(t)),
  'sem o SQL: notificações funcionam e o «Lido» avisa':JSON.stringify(r.semSql.lista)==='["E1"]'&&r.semSql.aviso,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Notificações das EOTs corretas');await b.close();srv.close();process.exit(f?1:0);})();
