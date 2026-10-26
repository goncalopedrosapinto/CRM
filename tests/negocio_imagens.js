// Imagens nos comentários dos negócios (como nas EOTs): colar um print (Ctrl+V) com o negócio aberto junta a imagem ao
// comentário, reduzida no browser; Comentar envia para o Storage privado (pasta do negócio) e grava o comentário com o
// caminho; o histórico mostra a imagem carregada com a sessão (blob:, sem links públicos). Comentário só com imagem;
// as imagens por enviar ficam no seu negócio; erros de permissão/SQL em falta dizem o que fazer; imagem em grande.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8777;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const R=(id,o)=>Object.assign({id,vendedor_id:'v1',created_at:'2026-10-01T10:00:00Z',updated_at:'2026-10-20T10:00:00Z',status_updated_at:'2026-10-20T10:00:00Z',type:'MN'},o);
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const est={uploads:[],gets:[],dels:[],posts:[],hist:[],falhaUpload:null,recentes:[]};const erros=[],dialogos=[];
 const recs=[R(5,{status:'Quente',id_cliente:'Pedro Almeida',model:'R 1300 GS Adventure',contacto:'912 345 678'}),R(7,{status:'Morno',id_cliente:'Tiago Fernandes',model:'F 900 GS'})];
 const contexto=async vp=>{const ctx=await b.newContext({viewport:vp});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('v1'));
  await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
   const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
   if(u.includes('/auth/v1/token'))return json({access_token:jwt('v1'),refresh_token:'rt2'});
   if(u.includes('/storage/v1/object/')){
    if(m==='POST'){if(est.falhaUpload==='rls')return json({statusCode:'403',error:'Unauthorized',message:'new row violates row-level security policy'},403);
      if(est.falhaUpload==='bucket')return json({statusCode:'404',error:'Bucket not found',message:'Bucket not found'},400);
      const buf=r.request().postDataBuffer();est.uploads.push({url:u,tipo:r.request().headers()['content-type'],tam:buf.length,buf,auth:!!r.request().headers()['authorization']});return json({Key:u.split('/object/')[1]});}
    if(m==='GET'){est.gets.push(u);const up=est.uploads.find(x=>u.endsWith(x.url.split('/storage/v1/object/')[1]));
      return r.fulfill({status:200,contentType:up?up.tipo:'image/png',body:up?up.buf:Buffer.alloc(0)});}
    if(m==='DELETE'){est.dels.push(u);return json({});}
    return json({});}
   const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
   if(t==='profiles')return json([{id:'v1',nome:'Felipe Gomes',role:'vendedor',linha:'motorrad'},{id:'c1',nome:'Gonçalo Pinto',role:'admin',linha:'motorrad'}]);
   if(t==='baviera_control')return json(m==='GET'?recs:[]);
   if(t==='negocio_historico'){
    if(m==='POST'){const body=JSON.parse(r.request().postData());est.posts.push(body);const row=Object.assign({id:100+est.hist.length,criado_em:new Date().toISOString(),autor_id:'v1',autor_nome:'Felipe Gomes',autor_role:'vendedor'},body);est.hist.unshift(row);return json([row],201);}
    if(/autor_id=neq/.test(u))return json(est.recentes);
    const neg=(u.match(/negocio_id=eq\.(\d+)/)||[])[1];return json(est.hist.filter(h=>String(h.negocio_id)===String(neg)));}
   return json([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));p.on('dialog',d=>{dialogos.push(d.message());d.accept();});
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
  return {ctx,p};};
 const {ctx,p}=await contexto({width:1400,height:900});
 const abrir=async id=>{await p.evaluate(id=>{setState({screen:'detail',selected:S.records.find(r=>r.id===id)});},id);await p.waitForTimeout(500);};
 // um "print" de 2400x1200 em PNG, colado no comentário (ou noutro elemento)
 const colar=async alvo=>p.evaluate(async sel=>{const c=document.createElement('canvas');c.width=2400;c.height=1200;const g=c.getContext('2d');
   for(let i=0;i<60;i++){g.fillStyle=`hsl(${i*6},70%,50%)`;g.fillRect(i*40,0,40,1200);}g.fillStyle='#000';g.font='80px sans-serif';g.fillText('print da proposta',200,600);
   const blob=await new Promise(r=>c.toBlob(r,'image/png'));const f=new File([blob],'image.png',{type:'image/png'});
   const dt=new DataTransfer();dt.items.add(f);const el=document.querySelector(sel)||document.body;el.focus&&el.focus();
   el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return blob.size;},alvo);
 const nPend=()=>p.$$eval('.neg-hist .eot-pend-i',x=>x.length);
 const toastTxt=async()=>{await p.waitForTimeout(700);return p.evaluate(()=>((document.getElementById('bm-toast')||{}).textContent||'').trim());};
 await abrir(5);
 const rotulos=await p.evaluate(()=>({ph:document.getElementById('neg-com').placeholder,anexo:!!document.querySelector('.neg-hist label.eot-anexo input#neg-img-file'),botao:(document.querySelector('[data-action="neg-comentar"]')||{}).textContent}));
 const tamOriginal=await colar('#neg-com');await p.waitForTimeout(800);
 const pend1=await nPend();
 // colar noutro campo de texto da página não junta nada ao comentário
 await p.evaluate(()=>{const i=document.createElement('input');i.id='tmp-campo';document.querySelector('.neg-hist').prepend(i);});
 await colar('#tmp-campo');await p.waitForTimeout(500);const pendCampo=await nPend();
 await p.fill('#neg-com','Cliente mandou print da proposta da concorrência');
 await p.click('[data-action="neg-comentar"]');await p.waitForTimeout(1200);
 const up=est.uploads[0]||{};const post=est.posts[0]||{};
 const depois={pend:await nPend(),thumbs:await p.$$eval('.neg-hist .eoth-img img',x=>x.map(i=>(i.getAttribute('src')||'').slice(0,5))),texto:await p.textContent('.neg-hist .eoth'),campo:await p.inputValue('#neg-com')};
 // histórico aberto noutro computador: a imagem vem do Storage com a sessão
 await p.evaluate(()=>{_negImgUrl.clear();S.negHist={};S.negHistReq=null;render();});await p.waitForTimeout(900);
 const outro={gets:est.gets.filter(g=>/authenticated\/negocio-imagens\/5\//.test(g)).length,src:await p.$$eval('.neg-hist .eoth-img img',x=>x.map(i=>(i.getAttribute('src')||'').slice(0,5)))};
 // comentário só com imagem (sem texto)
 await colar('#neg-com');await p.waitForTimeout(700);await p.click('[data-action="neg-comentar"]');await p.waitForTimeout(1200);
 const soImg=est.posts[1]||{};
 // imagem em grande: cabe no ecrã, clica para tamanho real, Esc fecha só a imagem
 await p.click('.neg-hist .eoth-img');await p.waitForTimeout(400);
 const medir=()=>p.evaluate(()=>{const i=document.querySelector('.eot-lb img');if(!i)return null;const r=i.getBoundingClientRect();
   return {l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),w:Math.round(r.width),nat:i.naturalWidth,vw:innerWidth,vh:innerHeight,zoom:!!document.querySelector('.eot-lb.zoom'),src:(i.getAttribute('src')||'').slice(0,5)};});
 const ajust=await medir();await p.click('.eot-lb img');await p.waitForTimeout(250);const real=await medir();
 await p.screenshot({path:path.join(__dirname,'negocio_imagens_grande.png')});
 await p.click('.eot-lb img');await p.waitForTimeout(200);const deVolta=await medir();
 await p.keyboard.press('Escape');await p.waitForTimeout(250);
 const aposEsc={lb:await p.$('.eot-lb')!==null,ecra:await p.evaluate(()=>S.screen)};
 // as imagens por enviar ficam no seu negócio
 await colar('#neg-com');await p.waitForTimeout(700);const naoEnviada=await nPend();
 await p.screenshot({path:path.join(__dirname,'negocio_imagens.png')});
 await abrir(7);const noOutro=await nPend();
 await abrir(5);const deVolta5=await nPend();
 await abrir(7);await colar('#neg-com');const aviso=await toastTxt();const no7=await nPend();
 await abrir(5);const em5=await nPend();
 // anexar pelo botão «Imagem»
 await abrir(7);await p.setInputFiles('#neg-img-file',{name:'foto.png',mimeType:'image/png',buffer:est.uploads[0].buf});await p.waitForTimeout(800);const anexo=await nPend();
 await p.click('[data-action="neg-img-tirar"]');await p.waitForTimeout(300);const tirada=await nPend();
 // sem permissão no Storage: avisa, não grava o comentário e a imagem fica por enviar
 const nPosts=est.posts.length;est.falhaUpload='rls';
 await p.click('[data-action="neg-comentar"]');await p.waitForTimeout(1500);
 const semPerm={dialogo:dialogos.slice(-1)[0]||'',posts:est.posts.length-nPosts,pend:await nPend()};
 est.falhaUpload='bucket';await p.click('[data-action="neg-comentar"]');await p.waitForTimeout(1200);
 const semSql={dialogo:dialogos.slice(-1)[0]||'',posts:est.posts.length-nPosts};est.falhaUpload=null;
 // comentário só com imagem, de outra pessoa, nos «Comentários novos» do Hoje
 est.recentes=[{id:999,negocio_id:5,autor_nome:'Gonçalo Pinto',autor_role:'admin',texto:null,criado_em:new Date().toISOString()}];
 await p.evaluate(async()=>{await loadComsRecentes();setState({screen:'list',statusFilter:'_hoje'});});await p.waitForTimeout(500);
 const recentes=await p.evaluate(()=>[...document.querySelectorAll('.vh-row .vh-txt')].map(x=>x.textContent).join(' | '));
 await ctx.close();
 // telemóvel: com imagens por enviar não há scroll lateral
 const t=await contexto({width:390,height:844});
 await t.p.evaluate(()=>{setState({screen:'detail',selected:S.records.find(r=>r.id===5)});});await t.p.waitForTimeout(500);
 await t.p.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'a.png',{type:'image/png'}));
   document.getElementById('neg-com').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});await t.p.waitForTimeout(700);
 const tel={pend:await t.p.$$eval('.neg-hist .eot-pend-i',x=>x.length),largura:await t.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)};
 await t.ctx.close();
 const Rz={rotulos,tamOriginal,pend1,pendCampo,up:{url:up.url,tipo:up.tipo,tam:up.tam,auth:up.auth},post,depois,outro,soImg,ajust,real,deVolta,aposEsc,naoEnviada,noOutro,deVolta5,aviso,no7,em5,anexo,tirada,semPerm,semSql,recentes,tel,erros,dialogos};
 console.log(JSON.stringify(Rz,null,1));
 const ok={
  'caixa de comentário: diz que se pode colar um print e tem botão Imagem':/cola um print \(Ctrl\+V\)/.test(rotulos.ph)&&rotulos.anexo&&rotulos.botao.trim()==='Comentar',
  'Ctrl+V de um print junta a imagem ao comentário':pend1===1,
  'colar noutro campo da página não junta imagem':pendCampo===1,
  'envia para a pasta do negócio, com sessão, em WebP reduzido':/\/storage\/v1\/object\/negocio-imagens\/5\/[^/]+\.webp$/.test(up.url||'')&&up.tipo==='image/webp'&&up.auth&&up.tam>0&&up.tam<tamOriginal,
  'comentário gravado com texto e caminho da imagem':post.negocio_id===5&&post.tipo==='comentario'&&post.texto==='Cliente mandou print da proposta da concorrência'&&Array.isArray(post.imagens)&&post.imagens.length===1&&post.imagens[0].startsWith('5/'),
  'depois de enviar: sem pendentes, campo limpo e imagem no histórico':depois.pend===0&&depois.campo===''&&depois.thumbs.length===1&&depois.thumbs[0]==='blob:'&&/Cliente mandou print/.test(depois.texto),
  'noutro computador: imagem pedida com sessão e mostrada como blob':outro.gets>=1&&outro.src[0]==='blob:',
  'comentário só com imagem (sem texto)':soImg.texto===null&&Array.isArray(soImg.imagens)&&soImg.imagens.length===1&&soImg.imagens[0].startsWith('5/'),
  'imagem em grande inteira no ecrã e em tamanho real ao clicar':!!ajust&&ajust.src==='blob:'&&ajust.l>=0&&ajust.t>=0&&ajust.r<=ajust.vw&&ajust.b<=ajust.vh&&!!real&&real.zoom&&real.w===real.nat&&!!deVolta&&!deVolta.zoom&&deVolta.w===ajust.w,
  'Escape fecha a imagem e fica no negócio':!aposEsc.lb&&aposEsc.ecra==='detail',
  'imagens por enviar ficam no seu negócio (não passam para outro)':naoEnviada===1&&noOutro===0&&deVolta5===1,
  'colar noutro negócio põe de lado as do anterior e avisa':/postas de lado/.test(aviso)&&no7===1&&em5===0,
  'anexar pelo botão Imagem e tirar antes de enviar':anexo===2&&tirada===1,
  'sem permissão no Storage: diz porquê, não grava e a imagem fica para tentar outra vez':/Não tens permissão para imagens deste negócio/.test(semPerm.dialogo)&&semPerm.posts===0&&semPerm.pend===1,
  'antes do SQL: diz qual SQL falta':/falta correr o SQL "2026-10-26_negocio_imagens"/.test(semSql.dialogo)&&semSql.posts===0,
  'Comentários novos: comentário só com imagem aparece como «enviou uma imagem»':/Pedro Almeida — enviou uma imagem/.test(recentes),
  'telemóvel: imagem por enviar sem scroll lateral':tel.pend===1&&tel.largura,
  'sem erros JS; só os dois avisos de erro esperados':!erros.length&&dialogos.length===2};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Imagens nos negócios corretas');await b.close();srv.close();process.exit(f?1:0);})();
