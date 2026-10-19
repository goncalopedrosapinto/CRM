const {chromium}=require('playwright');const fs=require('fs');
const path=require('path');const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const XL=fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'));
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const p=await b.newPage();const log=[];
p.on('console',m=>log.push(m.text().slice(0,140)));
await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
 if(u.includes('cdnjs.cloudflare.com'))return r.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:XL});
 return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});});
await p.goto('file://'+FILE);await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{const o={};
 try{await fetch('https://exemplo-atacante.com/x?t=1');o.fetch_externo='passou';}catch(e){o.fetch_externo='bloqueado';}
 try{await fetch('https://fyieckrmdrorjoevmrhm.supabase.co/rest/v1/x');o.fetch_supabase='passou';}catch(e){o.fetch_supabase='bloqueado';}
 try{const X=await eotCarregarXLSX();o.xlsx=X&&X.utils?'carregou (SRI ok)':'falhou';}catch(e){o.xlsx='erro '+e.message;}
 return o;});
console.log(JSON.stringify(r));const ok=r.fetch_externo==='bloqueado'&&r.fetch_supabase==='passou'&&/SRI ok/.test(r.xlsx);console.log(ok?'CSP e SRI corretos':'FALHOU');process.exitCode=ok?0:1;console.log(log.filter(l=>/Content Security|integrity/i.test(l)).join('\n'));await b.close();})();
