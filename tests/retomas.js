// Usadas › Retomas: registo dos valores de retoma que o chefe dá (dados fictícios).
// - separador «Retomas» nas Usadas; lista com margem = venda − retoma − preparação (e a mínima);
// - formulário na página: modelo e valor oferecido obrigatórios; números à portuguesa; venda mínima não passa a prevista;
// - vendedor obrigatório (lista: vendedores e o chefe) em vez do cliente; registos antigos mostram o cliente que tinham;
// - ao escrever a matrícula / modelo e ano, mostra os valores já dados (mesma mota, motas iguais);
// - Enter regista; o estado e as notas mudam na linha; os valores não (não há campos para isso);
// - «Novo valor» copia o registo para o formulário; apagar tem «Anular»; filtro por estado;
// - só o chefe (o vendedor nem pede os dados); exportação tem a folha; sem o SQL diz o que falta.
const {chromium}=require('playwright');const {ligarAvisos}=require('./_avisos');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8781;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}};
const R=(id,o)=>Object.assign({id,criado_por:'c1',cliente:null,matricula:null,modelo:'R 1250 GS',ano:2020,kms:40000,extras:null,valor_retoma:9000,preparacao:300,valor_venda:12500,venda_minima:11800,estado:'proposta',notas:null},o);
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const est={L:[R(3,{criado_em:'2026-10-20T10:00:00Z',vendedor_id:'v1',kms:52000,valor_retoma:8500,valor_venda:12000,venda_minima:null,preparacao:null,estado:'recusada'}),
   R(2,{criado_em:'2026-10-01T10:00:00Z',vendedor_id:'c1',modelo:'F 850 GS',ano:2019,kms:30000,valor_retoma:6500,preparacao:400,valor_venda:8900,venda_minima:8400,estado:'aceite'}),
   R(1,{criado_em:'2026-09-15T10:00:00Z',cliente:'Ana Ficticia',matricula:'11-AA-22',extras:'Malas <laterais>'})],
   posts:[],patches:[],deletes:[],gets:{c1:0,v1:0},semSql:false,semColuna:false,seq:10};
 const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='retomas_valores'){
    if(est.semSql)return json({code:'PGRST205',message:"Could not find the table 'public.retomas_valores' in the schema cache"},404);
    if(m==='GET'){est.gets[quem]++;return json(est.L);}
    if(m==='POST'&&est.semColuna)return json({code:'PGRST204',message:"Could not find the 'vendedor_id' column of 'retomas_valores' in the schema cache"},400);
    if(m==='POST'){const body=JSON.parse(r.request().postData());est.posts.push(body);const row=Object.assign({id:est.seq++,criado_em:new Date().toISOString(),criado_por:quem,estado:'proposta'},body);est.L.unshift(row);return json([row],201);}
    const id=+(u.match(/id=eq\.(\d+)/)||[])[1];
    if(m==='PATCH'){const body=JSON.parse(r.request().postData());est.patches.push([id,body]);const x=est.L.find(y=>y.id===id);if(x)Object.assign(x,body);return json(x?[x]:[]);}
    if(m==='DELETE'){est.deletes.push(id);est.L=est.L.filter(y=>y.id!==id);return r.fulfill({status:204,body:''});}}
  if(t==='profiles')return json(quem==='c1'?[PERFIS.c1,PERFIS.v1]:[PERFIS.v1,PERFIS.c1]);
  return json([]);};
 const erros=[];
 const abrir=async quem=>{const ctx=await b.newContext({viewport:{width:1400,height:1000}});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p._dlg=[];await ligarAvisos(p,p._dlg);p.on('pageerror',e=>erros.push(quem+': '+e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 const C1=await abrir('c1');const p=C1.p;
 const tx=s=>String(s||'').replace(/[\s  ]+/g,' ').trim();
 const ver=()=>p.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';
   return {linhas:[...document.querySelectorAll('.ret-tbl tbody tr[data-ret-id]')].map(r=>({id:r.dataset.retId,txt:t(r),margem:t(r.cells[6])})),
     erros:[...document.querySelectorAll('.ret-form .eotn-err input,.ret-form .eotn-err select')].map(e=>e.dataset.ret),cab:t(document.querySelector('.ret-tbl thead')),opcoes:[...document.querySelectorAll('#ret-vendedor_id option')].map(t),msgs:[...document.querySelectorAll('.ret-form .eotn-msg')].map(t),
     match:[...document.querySelectorAll('#ret-match .ret-m')].map(t),inputsTabela:[...document.querySelectorAll('.ret-tbl input,.ret-tbl select')].map(e=>e.dataset.retNotas?'notas':(e.dataset.retEstado?'estado':'outro')),
     filtro:t(document.querySelector('select[data-ret-filtro]')),erro:t(document.querySelector('.ret-form .error')),foco:document.activeElement&&document.activeElement.id};});
 // separador nas Usadas
 await p.evaluate(()=>{S.screen='dashboard';render();});await p.waitForTimeout(150);
 const tabs=await p.evaluate(()=>GRUPOS_SEC.usadas.tabs.map(t=>t[1]));
 await p.evaluate(()=>{const b=document.createElement('button');b.dataset.action='gpp-sec';b.dataset.s='retomas';document.getElementById('app').appendChild(b);b.click();});await p.waitForTimeout(500);
 const A=await ver();const gets0=est.gets.c1;
 await p.screenshot({path:path.join(__dirname,'retomas.png')});
 // vazio: diz o que falta
 await p.click('[data-action="ret-registar"]');await p.waitForTimeout(250);const B=await ver();const posts0=est.posts.length;
 // ao escrever: valores já dados (sem redesenhar a página)
 await p.fill('#ret-matricula','11 aa 22');await p.waitForTimeout(100);const M1=await ver();
 await p.selectOption('#ret-vendedor_id','v1');await p.fill('#ret-modelo','R 1250 GS');await p.fill('#ret-ano','2020');await p.waitForTimeout(100);const M2=await ver();
 await p.screenshot({path:path.join(__dirname,'retomas_ja_deste.png')});
 // venda mínima maior do que a prevista
 await p.fill('#ret-kms','41.000 km');await p.fill('#ret-extras','Malas e escape');await p.fill('#ret-valor_retoma','9 200');await p.fill('#ret-preparacao','300');
 await p.fill('#ret-valor_venda','12 500');await p.fill('#ret-venda_minima','13 000');await p.fill('#ret-notas','Quer R 1300 GS');
 await p.click('[data-action="ret-registar"]');await p.waitForTimeout(250);const C=await ver();const postsC=est.posts.length;
 await p.fill('#ret-venda_minima','11 900,50');await p.evaluate(()=>render());await p.waitForTimeout(100);
 const mantem=await p.evaluate(()=>['matricula','vendedor_id','kms','valor_retoma','venda_minima'].map(k=>document.getElementById('ret-'+k).value));
 await p.press('#ret-venda_minima','Enter');await p.waitForTimeout(600);
 const post=est.posts[0]||{};const D=await ver();const formLimpo=await p.evaluate(()=>!S.retForm&&!document.getElementById('ret-modelo').value);
 // estado e notas na linha
 await p.selectOption('select[data-ret-estado="1"]','aceite');await p.waitForTimeout(400);
 await p.fill('input[data-ret-notas="3"]','Achou pouco');await p.press('input[data-ret-notas="3"]','Tab');await p.waitForTimeout(400);
 await p.selectOption('select[data-ret-filtro]','aceite');await p.waitForTimeout(250);const E=await ver();
 await p.selectOption('select[data-ret-filtro]','');await p.waitForTimeout(200);
 // novo valor para a mota do Bruno
 await p.click('tr[data-ret-id="2"] [data-action="ret-novo"]');await p.waitForTimeout(300);
 const novo=await p.evaluate(()=>({v:['vendedor_id','modelo','ano','kms','valor_retoma','preparacao','valor_venda','venda_minima'].map(k=>document.getElementById('ret-'+k).value),foco:document.activeElement&&document.activeElement.id}));const F=await ver();
 await p.click('[data-action="ret-limpar"]');await p.waitForTimeout(200);const limpo=await p.evaluate(()=>!S.retForm);
 // apagar
 const n0=p._dlg.length;await p.click('tr[data-ret-id="3"] [data-action="ret-apagar"]');await p.waitForTimeout(80);
 const dlg=await p.evaluate(()=>{const t=document.getElementById('bm-toast');return(t?t.querySelector('.bm-toast-m').textContent:'')+' ['+(t&&t.querySelector('.bm-toast-b')?t.querySelector('.bm-toast-b').textContent:'')+']';});
 const delLogo=est.deletes.length,pergApagar=p._dlg.length-n0;await p.waitForTimeout(700);const G=await ver();
 const exporta=await p.evaluate(()=>EXPORT_FOLHAS().some(f=>f.nome==='Retomas (valores dados)'&&f.path.startsWith('/retomas_valores')));
 // sem o SQL do vendedor: diz qual falta
 await p.click('tr[data-ret-id="1"] [data-action="ret-novo"]');await p.waitForTimeout(200);await p.selectOption('#ret-vendedor_id','c1');est.semColuna=true;await p.click('[data-action="ret-registar"]');await p.waitForTimeout(400);const I=await ver();est.semColuna=false;
 // sem o SQL
 est.semSql=true;await p.evaluate(()=>{S.retomas=null;render();});await p.waitForTimeout(500);const H=await ver();
 await C1.ctx.close();
 // vendedor: nem pede os dados
 const V1=await abrir('v1');await V1.p.evaluate(()=>loadRetomas());await V1.p.waitForTimeout(200);const getsV=est.gets.v1;await V1.ctx.close();
 const Rs={I,tabs,A,gets0,B,posts0,postsC,M1,M2,C,mantem,post,D,formLimpo,patches:est.patches,E,novo,F,limpo,G,dlg,deletes:est.deletes,exporta,H,getsV,erros};
 console.log(JSON.stringify(Rs,null,1));
 const L1=A.linhas.find(l=>l.id==='1')||{};
 const ok={
  'separador «Retomas» nas Usadas; carrega a lista ao abrir':tabs.includes('Retomas')&&gets0>=1&&A.linhas.length===3&&A.linhas[0].id==='3',
  'coluna Vendedor (registo antigo mostra o cliente que tinha); lista com vendedores e o chefe':/Vendedor/.test(A.cab)&&!/Cliente/.test(A.cab)&&/Vendedor Um/.test((A.linhas.find(l=>l.id==='3')||{}).txt)&&/Chefe GPP/.test((A.linhas.find(l=>l.id==='2')||{}).txt)&&/Ana Ficticia/.test(L1.txt)&&JSON.stringify(A.opcoes)===JSON.stringify(['Escolhe…','Vendedor Um','Chefe GPP (chefe)']),
  'margem = venda − retoma − preparação, e a mínima':/^3\s?200 €\s?mín\. 2\s?500 €$/.test(L1.margem)&&/Malas <laterais>/.test(L1.txt),
  'vazio: diz o que falta (vendedor, modelo e valor oferecido) e não grava':JSON.stringify(B.erros)==='["vendedor_id","modelo","valor_retoma"]'&&posts0===0,
  'matrícula escrita de outra forma: mostra o valor já dado a esta mota':M1.match.length===1&&/Já deste valor a esta mota/.test(M1.match[0])&&/Ana Ficticia/.test(M1.match[0])&&/9\s?000 €/.test(M1.match[0]),
  'corrigir um campo tira o aviso desse campo (sem redesenhar)':JSON.stringify(M2.erros)==='["valor_retoma"]',
  'modelo/ano: não repete a mesma mota e mostra motas iguais (com o vendedor)':M2.match.length===2&&/mesma matrícula/.test(M2.match[0])&&/motas iguais/.test(M2.match[1])&&/Vendedor Um/.test(M2.match[1])&&!/F 850/.test(M2.match.join(' ')),
  'venda mínima maior do que a prevista não grava':JSON.stringify(C.erros)==='["venda_minima"]'&&/Maior do que a venda prevista/.test(C.msgs.join(' '))&&postsC===0,
  'o que se escreve sobrevive a redesenhar':JSON.stringify(mantem)===JSON.stringify(['11 aa 22','v1','41.000 km','9 200','11 900,50']),
  'Enter regista com os números certos e limpa o formulário':post.matricula==='11 AA 22'&&post.vendedor_id==='v1'&&!('cliente' in post)&&post.modelo==='R 1250 GS'&&post.ano===2020&&post.kms===41000&&post.valor_retoma===9200&&post.preparacao===300&&post.valor_venda===12500&&post.venda_minima===11900.5&&post.extras==='Malas e escape'&&post.notas==='Quer R 1300 GS'&&!('estado' in post)&&
    D.linhas.length===4&&D.linhas[0].id==='10'&&formLimpo,
  'estado e notas mudam na linha; os valores não têm campos':JSON.stringify(est.patches)==='[[1,{"estado":"aceite"}],[3,{"notas":"Achou pouco"}]]'&&D.inputsTabela.every(x=>x==='notas'||x==='estado')&&D.inputsTabela.length===8,
  'filtro por estado':E.linhas.length===2&&E.linhas.every(l=>['1','2'].includes(l.id))&&/Aceite \(2\)/.test(E.filtro),
  '«Novo valor» copia o registo para o formulário e mostra o valor anterior':JSON.stringify(novo.v)===JSON.stringify(['c1','F 850 GS','2019','30000','6500','400','8900','8400'])&&novo.foco==='ret-valor_retoma'&&F.match.some(m=>/motas iguais/.test(m)&&/Chefe GPP/.test(m)&&/6\s?500 €/.test(m))&&limpo,
  'apagar tira da lista com «Anular» (sem pergunta) e só apaga passado o tempo':/Registo de retoma apagado: R 1250 GS \[Anular\]/.test(dlg)&&pergApagar===0&&delLogo===0&&JSON.stringify(est.deletes)==='[3]'&&!G.linhas.some(l=>l.id==='3'),
  'exportação tem a folha das retomas':exporta,
  'sem o SQL do vendedor: diz qual SQL falta':/Falta correr o SQL "2026-11-04_retomas_vendedor"/.test(I.erro),
  'sem o SQL: diz que SQL falta':/Falta correr o SQL "2026-11-03_retomas_valores"/.test(H.erro),
  'vendedor: nem pede os dados':getsV===0,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Registo de retomas correto');await b.close();srv.close();process.exit(f?1:0);})();
