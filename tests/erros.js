// Registo de erros do browser: um erro não apanhado chega à tabela erros_cliente, sem duplicados, no máximo 15,
// e nada é enviado sem sessão. Supabase simulado.
const {chromium}=require('playwright');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const p=await b.newPage();const enviados=[];
  await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
    if(u.includes('/rest/v1/erros_cliente')){enviados.push(JSON.parse(r.request().postData()||'{}'));return r.fulfill({status:201,body:''});}
    return r.fulfill({status:200,contentType:'application/json',body:'[]'});});
  await p.goto('file://'+FILE);await p.waitForTimeout(500);
  const disparar=async(msg,n)=>{for(let i=0;i<n;i++)await p.evaluate(m=>setTimeout(()=>{throw new Error(m)},0),msg);await p.waitForTimeout(300);};
  await disparar('sem sessão',1);const semSessao=enviados.length;
  await p.evaluate(()=>{S.token='t';S.me={role:'vendedor'};S.screen='list';});
  await disparar('erro A',3);await disparar('erro B',1);
  await p.evaluate(()=>{Promise.reject(new Error('promessa C'));});await p.waitForTimeout(300);
  for(let i=0;i<25;i++)await disparar('erro em série '+i,1);
  const r={semSessao,total:enviados.length,erroA:enviados.filter(e=>e.mensagem&&e.mensagem.includes('erro A')).length,
    promessa:enviados.some(e=>e.tipo==='promessa'),temVersao:enviados.every(e=>e.versao&&e.ecra),
    semDadosDoUtilizador:enviados.every(e=>!('user_id' in e))};
  console.log(JSON.stringify(r));
  const ok=r.semSessao===0&&r.total===15&&r.erroA===1&&r.promessa&&r.temVersao&&r.semDadosDoUtilizador;
  console.log(ok?'Registo de erros correto':'FALHOU');await b.close();process.exit(ok?0:1);
})();
