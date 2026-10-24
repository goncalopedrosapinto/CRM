// Stock Equipamento: pesquisa por referência com ou sem espaços; referência noutra loja/separador avisa e "Ver todas";
// referência que não está no mapa vai ao site (lifestyle.caetano.pt) e a "Venda fora do stock" aproveita o resultado;
// filtros de antiguidade (meses sem vender, "nunca vendeu") e de desconto mínimo; ordenar por mais tempo sem vender.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8772;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const ha=meses=>{const d=new Date();d.setDate(d.getDate()-Math.round(meses*30.44));return d.toISOString().slice(0,10);};
const L=(id,ref,loja,desc,cat,qual,ant,ult,dmax)=>({id,lote:'L1',ponto_venda:loja,ref,descricao:desc,categoria:cat,qualidade:qual,antig_saida:ant,ult_saida:ult,qtd:1,custo_unit:50,desc_max:dmax,importado_em:new Date().toISOString()});
const stock=[L(1,'76228526108','Caetano Aveiro','Botas Pillon Air','botas','Morto','Sem Movimento de Saída',null,0.5),
  L(2,'76318399001','Caetano Aveiro','Casaco Tour','casacos','Vivo','Últ. Saída até 3 meses',ha(0.7),0.1),
  L(3,'76318399002','Caetano Aveiro','Casaco Tour','casacos','Moribundo','Últ. Saída de 1 a 2 anos',ha(15),0.3),
  L(4,'77777777777','Caetano Porto','Capacete X','capacetes','Vivo','Últ. Saída de 6 meses a 1 ano',ha(8),0.2),
  L(5,'76555555555','Caetano Aveiro','Luvas Novas','luvas','Vivo','Sem Movimento de Saída',null,0.1)];
const SITE={'76999999999':{sku:'76999999999',name:'Casaco Site Teste',type:'variation',variation:'Tamanho: L',prices:{regular_price:'25000',price:'20000',currency_minor_unit:2},permalink:'https://lifestyle.caetano.pt/p/casaco',is_in_stock:true,parent:5,categories:[{slug:'casacos'}]}};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const ctx=await b.newContext({viewport:{width:1400,height:900}});const site=[];
 await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('v1'));
 await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());if(u.startsWith('http://localhost'))return r.continue();
  const json=x=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('lifestyle.caetano.pt')){site.push(u);if(u.includes('/products/categories'))return json([]);const m=u.match(/sku=([^&]+)/);if(m)return json(m[1].split(',').map(k=>SITE[k]).filter(Boolean));return json([]);}
  if(u.includes('/auth/v1/token'))return json({access_token:jwt('v1'),refresh_token:'x'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='profiles')return json([{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}]);
  if(t==='stock_equip')return json(u.includes('offset=0')?stock:[]);
  return json([]);});
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
 await p.evaluate(()=>{setState({screen:'vstockeq'});});await p.waitForTimeout(800);
 const nomes=()=>p.$$eval('.seq-item .seq-desc',x=>x.map(e=>e.textContent.trim()));
 const procurar=async q=>{await p.fill('#seq-q',q);await p.waitForTimeout(250);};
 const R={};
 await procurar('76 22 8526 108');R.comEspacos=await nomes();
 await procurar('77777777777');R.noutraLoja={nomes:await nomes(),aviso:await p.evaluate(()=>((document.querySelector('.seq-noutros')||{}).textContent||'').replace(/\s+/g,' ').trim())};
 await p.click('[data-action="seq-ver-tudo"]');await p.waitForTimeout(300);R.verTodas=await nomes();
 await p.evaluate(()=>{S.seqF=Object.assign({},S.seqF,{loja:null});render();});await p.waitForTimeout(200);
 await procurar('76999999999');await p.waitForTimeout(1200);
 R.site=await p.evaluate(()=>((document.querySelector('.seq-siteres')||{}).textContent||'').replace(/\s+/g,' ').trim());R.pedidosSite=site.length;
 await p.click('.seq-siteres [data-action="seqf-abrir"]');await p.waitForTimeout(400);
 R.fora=await p.evaluate(()=>({ref:S.seqFora&&S.seqFora.ref,desc:S.seqFora&&S.seqFora.descricao,pvp:S.seqFora&&S.seqFora.pvp,site:S.seqFora&&S.seqFora._site}));R.pedidosSite2=site.length;
 await p.evaluate(()=>{S.seqFora=null;render();});
 await procurar('76000000000');await p.waitForTimeout(1200);
 R.naoSite=await p.evaluate(()=>((document.querySelector('.seq-siteres')||{}).textContent||'').replace(/\s+/g,' ').trim());
 await procurar('botas pillon');await p.waitForTimeout(900);R.textoNaoVaiAoSite=await p.evaluate(()=>!document.querySelector('.seq-siteres'));
 await procurar('');
 const filtro=async(k,v)=>{await p.selectOption(`select[data-seq-f="${k}"]`,v);await p.waitForTimeout(250);return nomes();};
 R.ant12=await filtro('ant','12');R.antNunca=await filtro('ant','nunca');await filtro('ant','');
 R.desc30=await filtro('dmin','0.3');await filtro('dmin','');
 R.parado=await filtro('ord','parado');
 await filtro('dmin','0.3');R.limparBotao=!!(await p.$('[data-action="seq-limpar"]'));await p.click('[data-action="seq-limpar"]');await p.waitForTimeout(250);
 R.depoisLimpar=await p.evaluate(()=>({ant:S.seqF.ant,dmin:S.seqF.dmin,q:S.seqF.q,n:document.querySelectorAll('.seq-item').length}));
 R.estadoGrupo=await p.evaluate(()=>{const it=[...document.querySelectorAll('.seq-item')].find(x=>/Casaco Tour/.test(x.textContent));return it?it.querySelector('.seq-est').textContent.replace(/\s+/g,' ').trim():'';});
 R.titulo=await p.evaluate(()=>{const e=[...document.querySelectorAll('.seq-e')].find(x=>/última venda a/.test(x.title));return e?e.title:'';});
 await p.screenshot({path:path.join(__dirname,'stock_equip.png')});
 R.erros=erros;console.log(JSON.stringify(R,null,1));
 const ok={
  'referência com espaços encontra o artigo':JSON.stringify(R.comEspacos)==='["Botas Pillon Air"]',
  'referência noutra loja: avisa onde está e "Ver todas" mostra':R.noutraLoja.nomes.length===0&&/1 referência em (Caetano )?Porto/.test(R.noutraLoja.aviso)&&JSON.stringify(R.verTodas)==='["Capacete X"]',
  'referência fora do mapa: vai ao site e mostra nome, preços, stock online e link':/não está no mapa de stock/.test(R.site)&&/Casaco Site Teste · Tamanho L/.test(R.site)&&/PVP 250,00 €/.test(R.site)&&/Venda no site 200,00 € −20%/.test(R.site)&&/em stock online/.test(R.site)&&/Ver no site/.test(R.site)&&R.pedidosSite>0,
  '"Vender fora do stock" já vem preenchido sem voltar ao site':R.fora.ref==='76999999999'&&R.fora.desc==='Casaco Site Teste'&&R.fora.pvp==='250'&&R.fora.site==='ok'&&R.pedidosSite2===R.pedidosSite,
  'não está no site: diz claramente':/Também não aparece no site/.test(R.naoSite),
  'pesquisa por texto não vai ao site':R.textoNaoVaiAoSite,
  'antiguidade: sem vender há +1 ano (nunca vendeu e Morto conta como antigo)':JSON.stringify(R.ant12)==='["Botas Pillon Air","Casaco Tour"]',
  'antiguidade: nunca vendeu':JSON.stringify(R.antNunca)==='["Botas Pillon Air","Luvas Novas"]',
  'desconto máximo ≥ 30%':JSON.stringify(R.desc30)==='["Botas Pillon Air","Casaco Tour"]',
  'ordenar por mais tempo sem vender (novo nunca vendido fica no fim)':JSON.stringify(R.parado)==='["Botas Pillon Air","Casaco Tour","Luvas Novas"]',
  'limpar filtros':R.limparBotao&&R.depoisLimpar.ant===''&&R.depoisLimpar.dmin===''&&R.depoisLimpar.n===3,
  'artigo com vários tamanhos mostra o estado do mais parado':/MORIBUNDO|Moribundo/.test(R.estadoGrupo)&&/1 a 2 anos/.test(R.estadoGrupo),
  'data exata da última venda no estado':/última venda a \d\d\/\d\d\/\d{4}/.test(R.titulo),
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Stock Equipamento correto');await b.close();srv.close();process.exit(f?1:0);})();
