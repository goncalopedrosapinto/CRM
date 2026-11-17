// Polimento sem animação (pedido do chefe, 17/11/2026):
// 1. hover só em ecrãs com rato: a linha da ficha por baixo do rato fica marcada (régua de leitura); no telemóvel nada fica
//    pintado depois de tocar, e todas as regras de hover das linhas estão dentro de @media(hover:hover);
// 2. no PC/tablet deitado, o título da secção da ficha fica preso por baixo da faixa de números enquanto se rola;
//    no telemóvel não (já há cabeçalho, números e barra de baixo);
// 3. tabelas que deslizam para o lado têm sombra na borda onde ainda há colunas (CSS puro: capas «local» e sombras «scroll»).
const {chromium}=require('playwright');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const FM={natureza:'MN',iva:23,modo:'civa',fv:2,isv:'0',sgpu:'0',pvb:'10000',mg_fixa_pct:'6',mg_var_pct:'3,5',protocolo_pct:'5',apoio_demo_pct:'6',apoio_adic_pct:'10,5',preco_venda:'7100',compart_conc:'81.30',modelo:'R 1300 GS'};
async function abrir(b,opt){const ctx=await b.newContext(opt);const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await p.goto('file://'+FILE);await p.waitForTimeout(300);
  await p.evaluate(fm=>{S.me={id:'u',role:'vendedor',nome:'T'};try{localStorage.setItem('bm_fm_esf','0');}catch(e){}S.fm=fm;S.screen='ficha';S.fmNeg=null;S.sidebarOpen=false;render();},FM);
  await p.waitForTimeout(200);return {ctx,p,erros};}
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const R={};
  // ---------- PC ----------
  const D=await abrir(b,{viewport:{width:1280,height:900}});const p=D.p;
  R.cssom=await p.evaluate(()=>{const fora=[];const ver=(rules,dentroHover)=>{for(const r of rules){
      if(r.cssRules&&r.conditionText!==undefined){ver(r.cssRules,dentroHover||/hover:\s*hover/.test(r.conditionText));continue;}
      if(r.selectorText&&/(tr|\.fun-atr):hover/.test(r.selectorText)&&!dentroHover&&!/background:\s*transparent/.test(r.cssText))fora.push(r.selectorText);}};
    for(const sh of document.styleSheets){try{ver(sh.cssRules,false);}catch(e){}}return fora;});
  // 1. régua de leitura
  const linha='.fm-tbl tbody tr:not(.fm-h):not(.fm-sep):not(.fm-dest)';
  const bg=async()=>p.evaluate(s=>{const t=[...document.querySelectorAll(s)][4].querySelector('td');return getComputedStyle(t).backgroundColor;},linha);
  const antes=await bg();const alvo=(await p.$$(linha))[4];await alvo.scrollIntoViewIfNeeded();await alvo.hover();await p.waitForTimeout(80);
  R.hover={antes,depois:await bg(),rato:await p.evaluate(()=>matchMedia('(hover:hover) and (pointer:fine)').matches)};
  await p.mouse.move(5,5);
  // 2. título preso: com a ficha rolada, um título de secção fica logo abaixo da faixa de números
  R.sticky=await p.evaluate(()=>{const k=document.querySelector('.fm-kpis'),td=document.querySelector('.fm-tbl tr.fm-sep>td'),c=document.querySelector('.content');
    const st=getComputedStyle(td);const fim=document.querySelector('.fm-tbl').getBoundingClientRect();c.scrollTop+=Math.max(0,fim.top-c.getBoundingClientRect().top)+420;
    const kb=k.getBoundingClientRect().bottom;const presos=[...document.querySelectorAll('.fm-tbl tr.fm-sep>td')].filter(t=>Math.abs(t.getBoundingClientRect().top-kb)<=1.5);
    // vários ficam no mesmo sítio; o que se vê é o da secção onde se está (o último a chegar)
    const r=presos.length?presos[presos.length-1].getBoundingClientRect():null;const visto=r?document.elementFromPoint(r.left+20,r.top+r.height/2):null;
    return {pos:st.position,top:st.top,kh:k.offsetHeight+'px',presos:presos.length,ultimoVisivel:!!(visto&&presos.length&&presos[presos.length-1].contains(visto)),overflow:getComputedStyle(document.querySelector('.fm-card')).overflowX};});
  await p.screenshot({path:path.join(__dirname,'polimento_pc.png')});
  // ---------- telemóvel ----------
  const M=await abrir(b,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const q=M.p;
  R.tel=await q.evaluate(()=>({rato:matchMedia('(hover:hover) and (pointer:fine)').matches,pos:getComputedStyle(document.querySelector('.fm-tbl tr.fm-sep>td')).position}));
  const tantes=await q.evaluate(s=>getComputedStyle([...document.querySelectorAll(s)][4].querySelector('td')).backgroundColor,linha);
  await q.evaluate(s=>[...document.querySelectorAll(s)][4].scrollIntoView({block:'center'}),linha);await (await q.$$(linha))[4].tap();await q.waitForTimeout(80);
  R.tel.toque=[tantes,await q.evaluate(s=>getComputedStyle([...document.querySelectorAll(s)][4].querySelector('td')).backgroundColor,linha)];
  // 3. sombra na borda: tabela larga num cartão que desliza para o lado
  R.borda=await q.evaluate(()=>{S.screen='list';render();const d=document.createElement('div');d.className='gpp-card';d.id='t-largo';d.setAttribute('style','margin:12px;overflow-x:auto');
    d.innerHTML='<table class="gpp-ltable"><thead><tr>'+Array.from({length:9},(_,i)=>'<th>Coluna '+(i+1)+'</th>').join('')+'</tr></thead><tbody>'+Array.from({length:4},()=>'<tr>'+Array.from({length:9},(_,i)=>'<td>Valor '+(i+1)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    const alvo=document.querySelector('.content')||document.body;alvo.prepend(d);d.scrollIntoView({block:'center'});const cs=getComputedStyle(d);
    return {att:cs.backgroundAttachment,img:(cs.backgroundImage.match(/gradient/g)||[]).length,largo:d.scrollWidth>d.clientWidth};});
  const el=await q.$('#t-largo');await el.screenshot({path:path.join(__dirname,'polimento_borda_inicio.png')});
  await q.evaluate(()=>{const d=document.getElementById('t-largo');d.scrollLeft=d.scrollWidth;});await q.waitForTimeout(50);await el.screenshot({path:path.join(__dirname,'polimento_borda_fim.png')});
  R.borda.escuro=await q.evaluate(()=>{document.documentElement.setAttribute('data-theme','dark');const v=getComputedStyle(document.documentElement).getPropertyValue('--borda-sombra').trim();document.documentElement.removeAttribute('data-theme');return v;});
  R.erros=D.erros.concat(M.erros);
  console.log(JSON.stringify(R,null,1));
  const C={
    'todas as regras de hover das linhas só valem com rato':R.cssom.length===0,
    'PC: a linha por baixo do rato fica marcada':R.hover.rato&&R.hover.antes!==R.hover.depois,
    'PC: título da secção preso logo abaixo da faixa de números':R.sticky.pos==='sticky'&&R.sticky.top===R.sticky.kh&&R.sticky.presos>=1&&R.sticky.ultimoVisivel&&R.sticky.overflow==='clip',
    'telemóvel: sem hover (a linha tocada não fica pintada) e sem título preso':!R.tel.rato&&R.tel.toque[0]===R.tel.toque[1]&&R.tel.pos!=='sticky',
    'tabela larga: capas que andam com o conteúdo e sombras fixas nas bordas; no escuro, esbatido claro':R.borda.largo&&R.borda.img===4&&/local, local, scroll, scroll/.test(R.borda.att)&&/148/.test(R.borda.escuro),
    'sem erros JS':!R.erros.length};
  let ok=true;for(const [n,v] of Object.entries(C)){console.log((v?'✓ ':'✗ ')+n);if(!v)ok=false;}
  console.log(ok?'Polimento correto':'FALHOU');await b.close();process.exit(ok?0:1);
})();
