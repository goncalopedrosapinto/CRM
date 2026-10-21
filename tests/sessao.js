// Sessão: dois separadores + token expirado + pedidos em paralelo não podem gastar o mesmo refresh token duas vezes
// (o Supabase revoga a sessão); servidor pendurado mostra aviso e não apaga a sessão; GET pendurado tem limite de tempo.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(8765);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=(exp)=>b64({alg:'ES256'})+'.'+b64({sub:'v1',exp})+'.x';
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const R={};
// ---------- 1) 2 separadores + token expirado + 8 pedidos paralelos em cada: só pode haver 1 renovação de cada vez com o mesmo refresh token
{const ctx=await b.newContext();let refreshes=[],rtAtual='rt0',usados=new Set(),abuso=0,n=0;
 await ctx.addInitScript(()=>{if(!localStorage.getItem('bc_session'))localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt0'}));});
 await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('http://localhost'))return r.continue();
  if(u.includes('/auth/v1/token')){const rt=JSON.parse(r.request().postData()).refresh_token;refreshes.push(rt);await new Promise(z=>setTimeout(z,400));
    if(usados.has(rt)){abuso++;return r.fulfill({status:400,contentType:'application/json',body:'{"error_code":"refresh_token_already_used"}'});}
    usados.add(rt);n++;rtAtual='rt'+n;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt(Math.floor(Date.now()/1000)+3600),refresh_token:rtAtual})});}
  const auth=r.request().headers()['authorization']||'';const exp=(()=>{try{return JSON.parse(Buffer.from(auth.split(' ')[1].split('.')[1],'base64url')).exp}catch(e){return 0}})();
  if(exp*1000<Date.now())return r.fulfill({status:401,body:'{"message":"JWT expired"}'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];const body=t==='profiles'?[{id:'v1',nome:'V',role:'vendedor',linha:'motorrad'}]:[];
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
 const p1=await ctx.newPage(),p2=await ctx.newPage();
 await Promise.all([p1.goto('http://localhost:8765/'),p2.goto('http://localhost:8765/')]);await p1.waitForTimeout(2500);
 const boot={p1:await p1.evaluate(()=>S.screen),p2:await p2.evaluate(()=>S.screen)};
 // os dois separadores ficam com o token expirado e disparam 8 pedidos cada ao mesmo tempo
 const expirado=jwt(Math.floor(Date.now()/1000)-10);
 await Promise.all([p1,p2].map(p=>p.evaluate((t)=>{S.token=t;return Promise.all([1,2,3,4,5,6,7,8].map(i=>supabaseApi('GET','/profiles?select=*').then(()=> 'ok',e=>'erro:'+e.message)));},expirado)));
 const depois={p1:await p1.evaluate(()=>S.screen),p2:await p2.evaluate(()=>S.screen),sessao:await p1.evaluate(()=>!!localStorage.getItem('bc_session'))};
 R.concorrencia={boot,refreshes:refreshes.length,abuso,depois};await ctx.close();}
// ---------- 2) servidor de autenticação pendurado: aviso aos 15 s, ecrã "sem resposta" e a sessão NÃO é apagada
{const ctx=await b.newContext();await ctx.addInitScript(()=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rtX'})));
 await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('http://localhost'))return r.continue();if(u.includes('/auth/v1/token')){return;/* nunca responde */}return r.fulfill({status:200,body:'[]'});});
 const p=await ctx.newPage();await p.goto('http://localhost:8765/');await p.waitForTimeout(16000);
 const aos16={ecra:await p.evaluate(()=>S.screen),aviso:await p.evaluate(()=>!!document.querySelector('[data-action="recarregar"]'))};
 await p.waitForTimeout(11000);
 R.pendurado={aos16,aos27:{ecra:await p.evaluate(()=>S.screen),sessaoGuardada:await p.evaluate(()=>!!localStorage.getItem('bc_session'))}};await p.screenshot({path:'semrede.png'});await ctx.close();}
// ---------- 3) um GET pendurado não bloqueia para sempre
{const ctx=await b.newContext();await ctx.addInitScript(()=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rtY'})));let tentativas=0;
 await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('http://localhost'))return r.continue();
  if(u.includes('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt(Math.floor(Date.now()/1000)+3600),refresh_token:'rtY2'})});
  if(u.includes('/rest/v1/eot_contratos')){tentativas++;if(tentativas===1)return;/* 1.ª vez pendura */}
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(t==='profiles'?[{id:'v1',nome:'V',role:'vendedor',linha:'motorrad'}]:[])});});
 const p=await ctx.newPage();const t0=Date.now();await p.goto('http://localhost:8765/');
 await p.waitForFunction(()=>S.screen!=='loading',null,{timeout:60000}).catch(()=>{});
 R.getPendurado={ecra:await p.evaluate(()=>S.screen),segundos:Math.round((Date.now()-t0)/1000),tentativasEOT:tentativas};await ctx.close();}
const c=R.concorrencia,h=R.pendurado,g=R.getPendurado;
const ok=c.abuso===0&&c.depois.sessao&&c.boot.p1==='list'&&c.boot.p2==='list'&&h.aos16.aviso&&h.aos27.ecra==='semrede'&&h.aos27.sessaoGuardada&&g.ecra==='list'&&g.segundos<40;
console.log(JSON.stringify(R));console.log(ok?'Sessão robusta':'FALHOU');await b.close();srv.close();process.exit(ok?0:1);})();
