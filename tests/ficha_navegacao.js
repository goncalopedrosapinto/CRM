// Ficha de margem do negócio: continua no negócio depois de a página se atualizar sozinha;
// 'Voltar' regressa ao negócio; o menu lateral abre sempre a ficha solta.
const {chromium}=require('playwright');const path=require('path');const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(()=>{if(!localStorage.getItem('bc_session'))localStorage.setItem('bc_session',JSON.stringify({refresh_token:'r'}));});
const jwt=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'v1',exp:9999999999})).toString('base64url')+'.x';
const recs=[{id:5,status:'Carteira',type:'MN',vendedor_id:'v1',id_cliente:'Joel Teste',model:'S 1000 RR',mes1:'2026/10',neg:'2026-10-01'}];
const ficha=[{negocio_id:5,dados:{natureza:'MN',iva:23,modo:'civa',fv:2,pvb:'21858.99',preco_venda:'22990',cliente:'Joel Teste'},updated_at:'2026-10-20T10:00:00Z'}];
await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
 if(u.includes('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt,refresh_token:'r'})});
 const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];let body=[];
 if(t==='profiles')body=[{id:'v1',nome:'Felipe Gomes',role:'vendedor',linha:'motorrad'}];if(t==='baviera_control')body=recs;if(t==='fichas_margem')body=u.includes('negocio_id=eq.5')?ficha:[{negocio_id:5,updated_at:ficha[0].updated_at}];
 return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+FILE);await p.waitForTimeout(1200);
const est=()=>p.evaluate(()=>({ecra:S.screen,fmNeg:S.fmNeg,cliente:S.fm&&S.fm.cliente,menuFichaAceso:!!document.querySelector('[data-action="go-ficha"].on,[data-action="go-ficha"].active,[data-action="go-ficha"][aria-current]')}));
await p.evaluate(()=>{setState({screen:'detail',selected:S.records[0]});});await p.waitForTimeout(200);
await p.click('[data-action="fm-negocio"]');await p.waitForTimeout(500);const r1=await est();
// a página atualiza-se sozinha (nova versão): guarda o que está aberto e recarrega
await p.evaluate(()=>guardarRascunho());await p.reload();await p.waitForTimeout(1500);const r2=await est();
// voltar ao negócio
const temVoltar=await p.$('[data-action="fm-voltar"]');if(temVoltar)await p.click('[data-action="fm-voltar"]');await p.waitForTimeout(300);const r3=await est();
// menu lateral Ficha de margem -> solta
await p.evaluate(()=>fmAbrirNegocio('5'));await p.waitForTimeout(400);await p.click('[data-action="go-ficha"]');await p.waitForTimeout(300);const r4=await est();
const ok=r1.fmNeg==='5'&&r2.ecra==='ficha'&&r2.fmNeg==='5'&&!r2.menuFichaAceso&&r3.ecra==='detail'&&r4.ecra==='ficha'&&r4.fmNeg===null&&!errs.length;
console.log(JSON.stringify({abrirDoNegocio:r1,depoisDeRecarregar:r2,voltar:r3,menuLateral:r4,errs}));console.log(ok?'Navegação da ficha correta':'FALHOU');await b.close();process.exit(ok?0:1);})();
