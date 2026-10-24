// Financeiros nas EOTs: visto "tratado" dado à mão (como o seguro das demos), que cai sozinho quando há novidade.
// Coluna ✓ (dar/tirar o visto sem abrir o contrato) + coluna "Indicações": ✓ Tratado (visto válido) · 🔔 Pergunta/Resposta
// (vendedor/chefe escreveu depois do visto, ou sem visto) · ↻ Reaberto (adenda com fim novo depois do visto/indicação) ·
// Em curso (há indicação vossa mas falta o visto) · Novo (último mapa) · Por tratar. Separadores "Precisa de vocês /
// Já tratados / Todos". Submeter uma indicação NÃO dá o visto. Sem o SQL do visto, volta à regra antiga com um aviso.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8774;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const ha=h=>new Date(Date.now()-h*3600e3).toISOString();const dia=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const dPT=iso=>iso.slice(0,10).split('-').reverse().join('/');
const imp=ha(2),antigo=ha(24*20);
const E=(c,cli,fim,fase,extra)=>Object.assign({contrato:c,cliente:cli,modelo:'R 1250 GS',data_fim:dia(fim),fase,responsavel_id:'v1',no_mapa:true,residual:5000,criado_em:antigo,ultima_import:imp,fin_visto_em:null,fin_visto_por:null,fin_visto_nome:null},extra||{});
const VB=h=>({fin_visto_em:ha(h),fin_visto_por:'f2',fin_visto_nome:'Beatriz Amaral'});
const db={seq:50,patches:[],eot:[E('E1','Cliente Por Tratar',10,'Por contactar'),E('E2','Cliente Novo',20,'Por contactar',{criado_em:ha(2.2)}),
  E('E3','Cliente Em Curso',30,'Por contactar'),E('E4','Cliente Resposta',40,'Contactado'),E('E5','Cliente Pergunta',50,'Por contactar'),
  E('E6','Cliente Fechado',60,'Renovado'),E('E7','Cliente Visto',70,'Por contactar',VB(10)),E('E8','Cliente Reaberto',80,'Por contactar',{adenda_em:dia(0)}),
  E('E9','Cliente Visto Caiu',90,'Contactado',VB(20)),E('E10','Cliente Visto Depois',100,'Por contactar',VB(10))],
  hist:[]};
const F=(c,h,t)=>({contrato:c,tipo:'comentario',autor_id:'f2',autor_nome:'Beatriz Amaral',autor_role:'financeiro',criado_em:ha(h),texto:t});
const V=(c,h,t)=>({contrato:c,tipo:'comentario',autor_id:'v1',autor_nome:'Felipe Gomes',autor_role:'vendedor',criado_em:ha(h),texto:t});
[F('E3',30,'Pedir simulação ao banco'),F('E4',20,'Residual alto: propor adenda'),V('E4',3,'Cliente aceita, e agora?'),V('E5',5,'Que valor dou?'),
 F('E7',30,'Propor novo contrato'),F('E8',24*30,'Fazer adenda de 12 meses'),F('E9',40,'Enviar proposta'),V('E9',2,'O cliente quer outro prazo'),
 V('E10',30,'Já liguei'),F('E10',12,'Ok, fica assim')].forEach((h,i)=>db.hist.push(Object.assign({id:i+1},h)));
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});
 await ctx.addInitScript(t=>{localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));localStorage.removeItem('bm_fin_tab');},jwt('f1'));
 await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt('f1'),refresh_token:'x'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];const q=k=>(u.match(new RegExp('[?&]'+k+'=eq\\.([^&]+)'))||[])[1];
  if(t==='profiles'){const id=q('id');const P=[{id:'f1',nome:'Francisco Dias',role:'financeiro',linha:'motorrad'},{id:'v1',nome:'Felipe Gomes',role:'vendedor',linha:'motorrad'}];return json(id?P.filter(p=>p.id===id):P);}
  if(t==='eot_contratos'){if(m==='PATCH'){const body=JSON.parse(r.request().postData());db.patches.push(body);const x=db.eot.find(e=>e.contrato===q('contrato'));
      // como o servidor: hora e autor reais
      if('fin_visto_em' in body)Object.assign(x,body.fin_visto_em?{fin_visto_em:new Date().toISOString(),fin_visto_por:'f1',fin_visto_nome:'Francisco Dias'}:{fin_visto_em:null,fin_visto_por:null,fin_visto_nome:null});
      return json([x]);}
    return json(db.eot);}
  if(t==='eot_historico'){if(m==='POST'){const body=JSON.parse(r.request().postData());db.hist.push(Object.assign({id:db.seq++,criado_em:new Date().toISOString(),autor_id:'f1',autor_nome:'Francisco Dias',autor_role:'financeiro'},body));return r.fulfill({status:201,body:''});}
    let L=db.hist.slice();const c=q('contrato');if(c)L=L.filter(h=>h.contrato===c);L.sort((a,b2)=>b2.id-a.id);if(/select=id(&|$)/.test(u))L=L.slice(0,1).map(h=>({id:h.id}));return json(L);}
  if(t==='eot_notif_lidas')return json([]);
  return json([]);});
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));p.on('dialog',d=>{erros.push('dialog: '+d.message());d.accept();});
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1800);
 await p.evaluate(()=>{setState({screen:'financeiro'});});await p.waitForTimeout(400);
 const ver=()=>p.evaluate(()=>({tabs:[...document.querySelectorAll('.fin-tabs .vchip')].map(b=>b.textContent.replace(/\s+/g,' ').trim()+(b.classList.contains('on')?' *':'')),
   linhas:[...document.querySelectorAll('.fin-tbl tbody tr')].map(tr=>{const td=tr.querySelector('.fin-ind-td');const v=tr.querySelector('.fin-visto');
     return (v?(v.classList.contains('on')?'[✓] ':'[ ] '):'')+tr.querySelector('td b').textContent+' | '+(td?td.innerText.replace(/\s+/g,' ').trim():'');}),
   aviso:!!document.querySelector('.sec-wrap .mg-aviso'),colVisto:!!document.querySelector('.fin-visto-th'),
   vazio:((document.querySelector('.bm-vazio')||{}).textContent||'').replace(/\s+/g,' ').trim()}));
 const tab=async t=>{await p.click(`.fin-tabs [data-t="${t}"]`);await p.waitForTimeout(250);};
 const visto=async c=>{await p.click(`.fin-visto[data-c="${c}"]`);await p.waitForTimeout(500);};
 const L=(R,nome)=>(R.linhas.find(l=>l.includes(nome+' |'))||'');
 const R={};
 R.precisa=await ver();
 await tab('tratados');R.tratados=await ver();
 await tab('todos');R.todos=await ver();
 // 1) visto na lista, sem abrir o contrato: "Em curso" passa a "Já tratados" com o carimbo do servidor
 await tab('precisa');await visto('E3');R.aposVisto=await ver();R.patch1=db.patches.slice(-1)[0];R.abriu1=await p.evaluate(()=>!!S.eotAberto);
 await tab('tratados');R.tratadosDepois=await ver();
 // 2) submeter uma indicação não dá o visto: fica "Em curso" em "Precisa de vocês"
 await tab('precisa');
 await p.evaluate(()=>eotAbrir('E1'));await p.waitForTimeout(600);
 R.modalSemVisto=await p.evaluate(()=>(document.querySelector('.eotm .fin-visto-linha')||{}).innerText||'');
 await p.fill('#eotm-com','Propor renovação com entrada');await p.click('[data-action="eotm-comentar"]');await p.waitForTimeout(900);
 R.aposIndicacao=await ver();
 // 3) dar o visto dentro do contrato
 await p.click('.eotm .fin-visto-linha [data-action="fin-visto"]');await p.waitForTimeout(500);
 R.modalComVisto=await p.evaluate(()=>(document.querySelector('.eotm .fin-visto-linha')||{}).innerText.replace(/\s+/g,' ')||'');
 await p.evaluate(()=>eotFechar());await p.waitForTimeout(400);
 R.aposModal=await ver();
 // 4) tirar o visto (enganei-me): volta a "Precisa de vocês"
 await tab('tratados');await visto('E7');R.aposTirar=await ver();R.patch4=db.patches.slice(-1)[0];
 await tab('precisa');R.precisaAposTirar=await ver();
 // 5) teclado: Enter no visto dá o visto e não abre o contrato
 await p.focus('.fin-visto[data-c="E5"]');await p.keyboard.press('Enter');await p.waitForTimeout(500);
 R.teclado={abriu:await p.evaluate(()=>!!S.eotAberto),e5:await p.evaluate(()=>finVistoValido(S.eot.find(x=>x.contrato==='E5')))};
 await p.screenshot({path:path.join(__dirname,'eot_financeiro.png')});
 // 6) tudo com visto: separador vazio com mensagem útil
 for(let i=0;i<10;i++){const c=await p.evaluate(()=>{const b=document.querySelector('.fin-visto:not(.on)');return b&&b.dataset.c;});if(!c)break;await visto(c);}
 R.vazio=await ver();
 // 7) histórico: o visto aparece com nome legível e data/hora
 R.hist=await p.evaluate(()=>({lb:EOT_CAMPOS.fin_visto_em,v:eotHistValor('fin_visto_em','2026-10-24T18:40:00.000Z'),vazio:eotHistValor('fin_visto_em',null)}));
 // 8) sem o SQL do visto (colunas inexistentes): aviso e regra antiga, sem coluna ✓
 await p.evaluate(()=>{S.eot=S.eot.map(x=>{const y=Object.assign({},x);delete y.fin_visto_em;delete y.fin_visto_por;delete y.fin_visto_nome;return y;});render();});await p.waitForTimeout(300);
 await tab('todos');R.semSQL=await ver();
 R.erros=erros;console.log(JSON.stringify(R,null,1));
 const ok={
  '"Precisa de vocês" por omissão: tudo o que não tem visto válido (pela data de fim)':JSON.stringify(R.precisa.tabs)==='["Precisa de vocês 7 *","Já tratados 2","Todos 10"]'&&JSON.stringify(R.precisa.linhas.map(l=>l.split(' | ')[0]))==='["[ ] Cliente Por Tratar","[ ] Cliente Novo","[ ] Cliente Em Curso","[ ] Cliente Resposta","[ ] Cliente Pergunta","[ ] Cliente Reaberto","[ ] Cliente Visto Caiu"]',
  'estado de cada uma na coluna Indicações':/Por tratar sem indicação vossa$/.test(L(R.precisa,'Cliente Por Tratar'))&&/Novo entrou no mapa a/.test(L(R.precisa,'Cliente Novo'))&&
    /Em curso indicação de Beatriz · \d\d\/\d\d\/\d{4} · falta o visto$/.test(L(R.precisa,'Cliente Em Curso'))&&/🔔 Resposta Felipe · há 3 h$/.test(L(R.precisa,'Cliente Resposta'))&&
    /🔔 Pergunta Felipe · há 5 h$/.test(L(R.precisa,'Cliente Pergunta'))&&/↻ Reaberto adenda · novo fim/.test(L(R.precisa,'Cliente Reaberto')),
  'o visto cai quando o vendedor escreve depois dele':/^\[ \] Cliente Visto Caiu \| 🔔 Resposta Felipe · há 2 h · o visto caiu$/.test(L(R.precisa,'Cliente Visto Caiu')),
  '"Já tratados": visto válido (mensagens anteriores ao visto não o fazem cair)':JSON.stringify(R.tratados.linhas)===JSON.stringify(['[✓] Cliente Visto | ✓ Tratado Beatriz · '+dPT(ha(10)),'[✓] Cliente Visto Depois | ✓ Tratado Beatriz · '+dPT(ha(10))]),
  '"Todos" inclui a fechada sem visto':R.todos.linhas.length===10&&/Cliente Fechado \| fechado/.test(L(R.todos,'Cliente Fechado')),
  'visto na lista sem abrir o contrato; quem fica é o do servidor':!R.abriu1&&R.patch1&&typeof R.patch1.fin_visto_em==='string'&&Object.keys(R.patch1).length===1&&
    JSON.stringify(R.aposVisto.tabs)==='["Precisa de vocês 6 *","Já tratados 3","Todos 10"]'&&/^\[✓\] Cliente Em Curso \| ✓ Tratado Francisco · /.test(L(R.tratadosDepois,'Cliente Em Curso')),
  'submeter uma indicação não dá o visto (fica "Em curso")':/Dar como tratado/.test(R.modalSemVisto)&&/^\[ \] Cliente Por Tratar \| Em curso indicação de Francisco · .* · falta o visto$/.test(L(R.aposIndicacao,'Cliente Por Tratar'))&&R.aposIndicacao.tabs[0]==='Precisa de vocês 6 *',
  'dar o visto dentro do contrato':/✓ Tratado por Francisco Dias · \d\d\/\d\d\/\d{4} \d\d:\d\d Tirar o visto/.test(R.modalComVisto)&&JSON.stringify(R.aposModal.tabs)==='["Precisa de vocês 5 *","Já tratados 4","Todos 10"]',
  'tirar o visto volta a pô-la em "Precisa de vocês"':R.patch4&&R.patch4.fin_visto_em===null&&JSON.stringify(R.aposTirar.tabs)==='["Precisa de vocês 6","Já tratados 3 *","Todos 10"]'&&/^\[ \] Cliente Visto \| Em curso indicação de Beatriz/.test(L(R.precisaAposTirar,'Cliente Visto')),
  'Enter no visto dá o visto e não abre o contrato':!R.teclado.abriu&&R.teclado.e5===true,
  'tudo com visto: "Nada à vossa espera"':JSON.stringify(R.vazio.tabs)==='["Precisa de vocês 0 *","Já tratados 9","Todos 10"]'&&/Nada à vossa espera.*têm o vosso visto/.test(R.vazio.vazio),
  'histórico mostra o visto legível':R.hist.lb==='Tratado (visto dos financeiros)'&&/^\d\d\/10\/2026 \d\d:40$/.test(R.hist.v)&&R.hist.vazio==='(vazio)',
  'sem o SQL: aviso, sem coluna ✓ e regra antiga (indicação vossa = tratado)':R.semSQL.aviso&&!R.semSQL.colVisto&&JSON.stringify(R.semSQL.tabs)==='["Precisa de vocês 5","Já tratados 4","Todos 10 *"]'&&/Cliente Por Tratar \| ✓ Tratado Francisco/.test(L(R.semSQL,'Cliente Por Tratar')),
  'sem erros JS nem alertas':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Visto dos financeiros correto');await b.close();srv.close();process.exit(f?1:0);})();
