// Imagens nos comentários das EOTs: colar um print (Ctrl+V) junta a imagem ao comentário, reduzida no browser;
// Comentar envia para o Storage privado (pasta do contrato) e grava o comentário com o caminho; o histórico mostra a imagem
// carregada com a sessão (blob:, sem links públicos); colar noutros campos não é apanhado; Escape fecha primeiro a imagem.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8767;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const ctx=await b.newContext({viewport:{width:1400,height:900}});const est={uploads:[],hist:[],gets:[],posts:[]};
 await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('c1'));
 await ctx.route('**/*',async r=>{const u=r.request().url();const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  if(u.includes('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt('c1'),refresh_token:'rt2'})});
  if(u.includes('/storage/v1/object/')){
   if(m==='POST'){const buf=r.request().postDataBuffer();est.uploads.push({url:u,tipo:r.request().headers()['content-type'],tam:buf.length,buf,auth:!!r.request().headers()['authorization']});return r.fulfill({status:200,contentType:'application/json',body:'{"Key":"x"}'});}
   if(m==='GET'){est.gets.push(u);const up=est.uploads.find(x=>u.endsWith(x.url.split('/storage/v1/object/')[1].replace(/^eot-imagens\//,'')));
     return r.fulfill({status:200,contentType:up?up.tipo:'image/png',body:up?up.buf:Buffer.alloc(0)});}
   return r.fulfill({status:200,body:'{}'});}
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='eot_historico'&&m==='POST'){const body=JSON.parse(r.request().postData());est.posts.push(body);est.hist.unshift(Object.assign({id:est.hist.length+1,criado_em:new Date().toISOString(),autor_nome:'Chefe',autor_role:'admin'},body));return r.fulfill({status:201,body:''});}
  if(t==='eot_historico')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(est.hist)});
  if(t==='eot_contratos')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{contrato:'ABC123',cliente:'Cliente EOT',modelo:'R 1250 GS',data_fim:'2026-12-01',fase:'Por contactar'}])});
  if(t==='profiles')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'c1',nome:'Chefe',role:'admin',linha:'motorrad'}])});
  return r.fulfill({status:200,contentType:'application/json',body:'[]'});});
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
 await p.evaluate(()=>{loadEot().then(()=>eotAbrir('ABC123'));});await p.waitForTimeout(600);
 // um "print" de 2400x1200 em PNG, colado no comentário
 const colar=async alvo=>p.evaluate(async sel=>{const c=document.createElement('canvas');c.width=2400;c.height=1200;const g=c.getContext('2d');
   for(let i=0;i<60;i++){g.fillStyle=`hsl(${i*6},70%,50%)`;g.fillRect(i*40,0,40,1200);}g.fillStyle='#000';g.font='80px sans-serif';g.fillText('print do contrato',200,600);
   const blob=await new Promise(r=>c.toBlob(r,'image/png'));const f=new File([blob],'image.png',{type:'image/png'});
   const dt=new DataTransfer();dt.items.add(f);const el=document.querySelector(sel);el.focus();
   el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return blob.size;},alvo);
 const adenda=await p.evaluate(()=>{const o=[...document.querySelectorAll('select[data-eotm="fase"] option')].map(x=>x.textContent);const x={fase:'Adenda',no_mapa:true,data_fim:'2026-11-01'};
   return {opcao:o.includes('Adenda'),fecha:EOT_FECHO.includes('Adenda'),semAcao:!eotPrecisaAcao(x),verde:/atag-ok/.test(eotFaseHTML(x)),ganho:eotGanho(x)};});
 const rotulos=await p.evaluate(()=>({botao:(document.querySelector('[data-action="eotm-comentar"]')||{}).textContent||'',sec:[...document.querySelectorAll('.eotm-sec')].map(x=>x.textContent).join('|')}));
 const tamOriginal=await colar('#eotm-com');await p.waitForTimeout(800);
 const pend=await p.$$eval('.eot-pend-i',x=>x.length);
 // colar uma imagem num campo de texto da EOT (notas) não junta nada ao comentário
 const temNotas=await p.$('[data-eotm="notas"],[data-eotm="proxima_acao"],textarea[data-eotm]');
 let pendNotas=null;if(temNotas){await colar('textarea[data-eotm],input[data-eotm]');await p.waitForTimeout(500);pendNotas=await p.$$eval('.eot-pend-i',x=>x.length);}
 await p.fill('#eotm-com','Cliente mandou print da proposta');
 await p.click('[data-action="eotm-comentar"]');await p.waitForTimeout(1200);
 const up=est.uploads[0]||{};const post=est.posts[0]||{};
 const depois={pend:await p.$$eval('.eot-pend-i',x=>x.length),thumbs:await p.$$eval('.eoth-img img',x=>x.map(i=>(i.getAttribute('src')||'').slice(0,5))),texto:await p.textContent('.eoth')};
 // histórico aberto noutro computador: a imagem vem do Storage com a sessão
 await p.evaluate(()=>{S.eotHist={};});await p.evaluate(()=>{_eotImgUrl.clear();loadEotHist('ABC123');});await p.waitForTimeout(800);
 const outro={gets:est.gets.length,src:await p.$$eval('.eoth-img img',x=>x.map(i=>(i.getAttribute('src')||'').slice(0,5)))};
 await colar('#eotm-com');await p.waitForTimeout(600);await p.screenshot({path:path.join(__dirname,'eot_imagens.png')});
 await p.click('.eoth-img');await p.waitForTimeout(400);const lb=await p.$('.eot-lb img')!==null;
 // a imagem em grande cabe toda no ecrã (não fica presa/cortada dentro da janela da EOT) e dá para ver em tamanho real
 const medir=()=>p.evaluate(()=>{const i=document.querySelector('.eot-lb img');if(!i)return null;const r=i.getBoundingClientRect();
   return {dentroJanela:!!i.closest('.eotm'),l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),w:Math.round(r.width),nat:i.naturalWidth,vw:innerWidth,vh:innerHeight,zoom:!!document.querySelector('.eot-lb.zoom')};});
 const ajust=await medir();await p.click('.eot-lb img');await p.waitForTimeout(250);const real=await medir();
 await p.screenshot({path:path.join(__dirname,'eot_imagens_grande.png')});await p.click('.eot-lb img');await p.waitForTimeout(200);const deVolta=await medir();
 await p.keyboard.press('Escape');await p.waitForTimeout(250);
 const aposEsc={lb:await p.$('.eot-lb')!==null,modal:await p.$('.eotm')!==null};
 await p.evaluate(()=>{eotImgLimpar();render();});
 const R={ajust,real,deVolta,rotulos,adenda,tamOriginal,pend,pendNotas,up:{url:up.url,tipo:up.tipo,tam:up.tam,auth:up.auth},post,depois,outro,lb,aposEsc,erros};
 console.log(JSON.stringify(R,null,1));
 const ok={
  'Ctrl+V de um print junta a imagem ao comentário':pend===1,
  'colar noutro campo da EOT não junta imagem':pendNotas===null||pendNotas===1,
  'envia para a pasta do contrato, com sessão, em WebP reduzido':/\/storage\/v1\/object\/eot-imagens\/ABC123\/[^/]+\.webp$/.test(up.url||'')&&up.tipo==='image/webp'&&up.auth&&up.tam>0&&up.tam<tamOriginal,
  'comentário gravado com texto e caminho da imagem':post.texto==='Cliente mandou print da proposta'&&Array.isArray(post.imagens)&&post.imagens.length===1&&post.imagens[0].startsWith('ABC123/'),
  'depois de enviar: sem pendentes e imagem no histórico':depois.pend===0&&depois.thumbs.length===1&&depois.thumbs[0]==='blob:'&&/Cliente mandou print/.test(depois.texto),
  'noutro computador: imagem pedida com sessão e mostrada como blob':outro.gets>=1&&outro.src[0]==='blob:',
  'abre a imagem em grande':lb,
  'imagem em grande inteira no ecrã (fora da janela da EOT)':!!ajust&&!ajust.dentroJanela&&ajust.l>=0&&ajust.t>=0&&ajust.r<=ajust.vw&&ajust.b<=ajust.vh&&ajust.w>900,
  'clicar na imagem mostra em tamanho real e volta a ajustar':!!real&&real.zoom&&real.w===real.nat&&!!deVolta&&!deVolta.zoom&&deVolta.w===ajust.w,
  'Escape fecha a imagem e não a EOT':!aposEsc.lb&&aposEsc.modal,
  'fase Adenda: escolhe-se no contrato, fecha a EOT e conta como renovado':adenda.opcao&&adenda.fecha&&adenda.semAcao&&adenda.verde&&adenda.ganho,
  'EOT: botão "Submeter" e secção de indicações (não "comentar")':rotulos.botao.trim()==='Submeter'&&/Indicações e histórico/.test(rotulos.sec)&&!/Coment/.test(rotulos.sec),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Imagens nas EOTs corretas');await b.close();srv.close();process.exit(f?1:0);})();
