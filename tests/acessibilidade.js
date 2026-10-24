// Auditoria de acessibilidade (axe-core, WCAG 2.2 AA) aos ecrãs principais de cada perfil, com dados fictícios.
// Falha se houver alguma violação real (contraste medido incluído). Uso: node acessibilidade.js ../index.html
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));const OUT=null;const CAP=null;
const AXE=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const PORTA=8773;const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const hoje=new Date();const d=n=>{const x=new Date(hoje);x.setDate(x.getDate()-n);return x.toISOString().slice(0,10);};const ym=hoje.getFullYear()+'/'+String(hoje.getMonth()+1).padStart(2,'0');
const P={c1:{id:'c1',nome:'Chefe Teste',role:'admin',linha:'motorrad',areas:[]},v1:{id:'v1',nome:'Vera Vendas',role:'vendedor',linha:'motorrad',areas:[]},v2:{id:'v2',nome:'Victor Valente',role:'vendedor',linha:'motorrad',areas:[]},
  s1:{id:'s1',nome:'Sofia Secretaria',role:'secretario',linha:'motorrad',areas:[],financeiro:false},f1:{id:'f1',nome:'Filipa Financeira',role:'financeiro',linha:'motorrad',areas:[]},a1:{id:'a1',nome:'Artur Assessor',role:'assessor',linha:'motorrad',areas:[]}};
const R=(id,v,status,extra)=>Object.assign({id,vendedor_id:v,status,id_cliente:'Cliente '+id,model:'R 1300 GS',version:'Trophy',type:'MN',neg:d(id*3),mes1:ym,pvp:24500,contacto:'912 000 00'+id,updated_at:new Date().toISOString(),status_updated_at:d(id)},extra||{});
const recs=[R(1,'v1','Quente'),R(2,'v1','Morno',{alert_date:d(2)}),R(3,'v1','Frio'),R(4,'v1','Carteira',{enc:'9100001'}),R(5,'v1','Retail',{col_298:d(5),dmat:d(100)}),R(6,'v2','Quente'),R(7,'v2','Carteira'),R(8,'v2','Retail',{col_298:d(9)}),R(9,'v1','Perdido',{motivo_perda:'Preço'}),R(10,'v2','Retail',{type:'MU',col_298:d(2)})];
const eot=[{contrato:'E1',cliente:'Cliente EOT Um',modelo:'F 900 GS',matricula:'AA-11-BB',data_fim:d(-60),fase:'Contactado',responsavel_id:'v1',no_mapa:true,residual:4500,prestacao:120,total:4800,fin_visto_em:null},
  {contrato:'E2',cliente:'Cliente EOT Dois',modelo:'R 1250 RT',data_fim:d(-150),fase:'Por contactar',responsavel_id:null,no_mapa:true,residual:7000,fin_visto_em:null},
  {contrato:'E3',cliente:'Cliente EOT Três',modelo:'R 1300 GS',data_fim:d(-200),fase:'Por contactar',responsavel_id:'v1',no_mapa:true,residual:9000,fin_visto_em:new Date(Date.now()-3600e3).toISOString(),fin_visto_por:'f1',fin_visto_nome:'Filipa Financeira'}];
const hist=[{id:1,contrato:'E1',tipo:'comentario',autor_id:'v1',autor_nome:'Vera Vendas',autor_role:'vendedor',criado_em:new Date(Date.now()-3600e3).toISOString(),texto:'Cliente quer saber o valor para refinanciar'}];
const enc=[1,2,3,4].map(i=>({origem:'aveiro',production_number:String(9100000+i),chassis:'6N1000'+i,model_code:'0M21',model_desc:'R 1300 GS',color_code:'N52',options:'20B 389 7A8 413 5AG',order_status:i<3?'198':'150',ts_order_status:d(i*40),processing_type:['ST','US','DE','CS'][i-1],conf_f3_from:d(-10),conf_f3_to:d(-17),customer_last:i===4?'Apelido':'',importado_em:new Date().toISOString()}));
const seq=[1,2,3].map(i=>({id:i,lote:'L1',ponto_venda:'Caetano Aveiro',ref:'7622852610'+i,descricao:'Botas Teste '+i,categoria:'botas',qualidade:['Vivo','Moribundo','Morto'][i-1],antig_saida:['Últ. Saída até 3 meses','Últ. Saída de 1 a 2 anos','Sem Movimento de Saída'][i-1],ult_saida:i<3?d(i*200):null,qtd:i,custo_unit:80,desc_max:i/10,importado_em:new Date().toISOString()}));
async function contexto(b,uid,vp,tema){
  const ctx=await b.newContext({viewport:vp,bypassCSP:true,colorScheme:tema==='escuro'?'dark':'light'});
  await ctx.addInitScript(([t,tm,uid])=>{try{if(uid)localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3}));localStorage.setItem('bm_tema',tm);}catch(e){}},[jwt(uid||'x'),tema,uid]);
  await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
    const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return json({access_token:jwt(uid),refresh_token:'x'});
    const t=(u.match(/rest\/v1\/(rpc\/)?([a-z_]+)/)||[])[2];const id=(u.match(/[?&]id=eq\.([^&]+)/)||[])[1];
    if(m!=='GET')return json([]);
    if(t==='profiles')return json(id?[P[id]].filter(Boolean):Object.values(P));
    if(t==='baviera_control'||t==='negocios_secretaria')return json(uid==='v1'?recs.filter(x=>x.vendedor_id==='v1'):recs);
    if(t==='eot_contratos')return json(uid==='v1'?eot.filter(x=>x.responsavel_id==='v1'):eot);
    if(t==='eot_historico')return json(hist);
    if(t==='encomendas_bmw')return json(u.includes('offset=0')?enc:[]);
    if(t==='stock_equip')return json(u.includes('offset=0')?seq:[]);
    return json([]);});
  return ctx;}
const ECRAS={
  c1:[['Home','()=>{S.screen="dashboard";S.gppSec="home";render();}'],['A tratar','()=>{S.screen="dashboard";S.gppSec="pendentes";render();}'],['Notificações EOT','()=>{S.screen="dashboard";S.gppSec="notificacoes";render();}'],
      ['Funil','()=>{S.screen="dashboard";S.gppSec="funil";render();}'],['Carteira','()=>{S.screen="dashboard";S.gppSec="carteira";render();}'],['Retail','()=>{S.screen="dashboard";S.gppSec="retail";render();}'],
      ['EOTs','()=>{S.screen="dashboard";S.gppSec="eots";render();}'],['Stock BMW Novas','()=>{S.screen="dashboard";S.gppSec="encomendas";S.encOrigem="aveiro";render();}'],['Stock Equipamento','()=>{S.screen="dashboard";S.gppSec="stockeq";render();}'],
      ['Ficha de Margem','()=>{S.screen="dashboard";S.gppSec="ficha";render();}'],['Comissões','()=>{S.screen="dashboard";S.gppSec="comissoes";render();}'],['Escala','()=>{S.screen="dashboard";S.gppSec="escala";render();}'],
      ['Negócio (detalhe)','()=>{setState({screen:"detail",selected:S.records.find(r=>r.id===5),openGroups:{INFO:true}});}'],['Negócio (editar)','()=>{const r=S.records.find(x=>x.id===1);setState({selected:r,form:recordToForm(r),screen:"edit",openGroups:{INFO:true,"Identificação":true,"Negócio":true}});}'],
      ['Janela EOT','()=>{S.screen="dashboard";S.gppSec="eots";render();eotAbrir("E1");}'],
      ['Leads','()=>{S.screen="dashboard";S.gppSec="leads";render();}'],['Perdidos','()=>{S.screen="dashboard";S.gppSec="perdidos";render();}'],['Demos','()=>{S.screen="dashboard";S.gppSec="demos";render();}'],
      ['Stock Usadas','()=>{S.screen="dashboard";S.gppSec="stock";render();}'],['Exportar','()=>{S.screen="dashboard";S.gppSec="exportar";render();}'],['Saúde da equipa','()=>{S.screen="dashboard";S.gppSec="saude";render();}'],
      ['Trimestre','()=>{S.screen="dashboard";S.gppSec="trimestre";render();}'],['Evento','()=>{S.screen="dashboard";S.gppSec="evento";render();}'],['Escolher negócio (stock)','()=>{S.screen="dashboard";S.gppSec="encomendas";S.encOrigem="aveiro";render();setState({encEscolher:"9100003"});}']],
  v1:[['Hoje','()=>{S.screen="list";S.statusFilter="_hoje";S.alertFilter=null;render();}'],['Funil','()=>{S.screen="list";S.statusFilter="Funil";render();}'],['Carteira','()=>{S.screen="list";S.statusFilter="Carteira";render();}'],
      ['Negócio (detalhe)','()=>{setState({screen:"detail",selected:S.records.find(r=>r.id===5),openGroups:{INFO:true}});}'],['Negócio (editar)','()=>{const r=S.records.find(x=>x.id===1);setState({selected:r,form:recordToForm(r),screen:"edit",openGroups:{INFO:true,"Identificação":true}});}'],
      ['EOTs','()=>{setState({screen:"veot"});}'],['Notificações','()=>{setState({screen:"vnotif"});}'],['Stock BMW Novas','()=>{setState({screen:"vencomendas",encOrigem:"aveiro"});}'],['Stock Equipamento','()=>{setState({screen:"vstockeq"});}'],
      ['Ficha de Margem','()=>{setState({screen:"ficha"});}'],['Comissões','()=>{setState({screen:"vcom"});}'],['Janela EOT','()=>{setState({screen:"veot"});eotAbrir("E1");}'],
      ['Stock usadas/demos','()=>{setState({screen:"stockvend"});}'],['Escala','()=>{setState({screen:"escala"});}'],['Menu aberto','()=>{setState({screen:"list",statusFilter:"_hoje",sidebarOpen:true});}'],['Alterar password','()=>{setState({screen:"password"});}']],
  s1:[['Secretaria','()=>{setState({screen:"secretaria"});}']],
  f1:[['EOTs','()=>{setState({screen:"financeiro",finTab:"todos"});}'],['Notificações','()=>{setState({screen:"notificacoes"});}'],['Janela EOT','()=>{setState({screen:"financeiro"});eotAbrir("E1");}']],
  a1:[['Assessor','()=>{setState({screen:"assessor"});}']],
  '':[['Entrada (login)','()=>{}']]};
const PERFIL={c1:'Chefe',v1:'Vendedor',s1:'Secretário',f1:'Financeiro',a1:'Assessor','':'Sem sessão'};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const res=[];
 for(const [vpN,vp] of [['computador',{width:1440,height:900}],['telemovel',{width:390,height:844}]])for(const tema of ['claro','escuro'])for(const uid of Object.keys(ECRAS)){
  const ctx=await contexto(b,uid,vp,tema);const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(uid?1600:900);
  for(const [nome,fn] of ECRAS[uid]){
    try{await p.evaluate(`(${fn})()`);}catch(e){erros.push(nome+': '+e.message);}
    await p.waitForTimeout(500);
    if(await p.evaluate(()=>typeof axe==='undefined'))await p.evaluate(AXE);
    const r=await p.evaluate(async()=>{document.getAnimations().forEach(a=>{try{a.finish();}catch(e){}}); /* avisos a meio da animação (ex.: "Gravado") medem-se no estado final */const x=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']},resultTypes:['violations','incomplete']});
      const mp=(L,inc)=>L.map(v=>({id:(inc?'?':'')+v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({t:n.target.join(' '),h:n.html.slice(0,160),d:(n.any[0]||n.all[0]||{}).data||null}))}));return mp(x.violations).concat(mp(x.incomplete.filter(v=>v.id==='color-contrast'),true));});

    const med=await p.evaluate((sels)=>{
      const parse=c=>{const m=String(c).match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1};};
      const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
      const mix=(top,bot)=>({r:top.r*top.a+bot.r*(1-top.a),g:top.g*top.a+bot.g*(1-top.a),b:top.b*top.a+bot.b*(1-top.a),a:1});
      const bgDe=el=>{const L=[];let e=el;while(e&&e.nodeType===1){const c=parse(getComputedStyle(e).backgroundColor);if(c&&c.a>0)L.push(c);if(c&&c.a>=1)break;e=e.parentElement;}
        let base={r:255,g:255,b:255,a:1};const root=parse(getComputedStyle(document.body).backgroundColor);if(root&&root.a>=1)base=root;
        for(let i=L.length-1;i>=0;i--)base=mix(L[i],base);return base;};
      const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
      const out=[];
      const testar=(el,fgCss,rotulo)=>{const cs=getComputedStyle(el);let fg=parse(fgCss||cs.color);if(!fg)return;const bg=bgDe(el);if(fg.a<1)fg=mix(fg,bg);
        const px=parseFloat(cs.fontSize),w=parseInt(cs.fontWeight)||400;const grande=px>=24||(px>=18.66&&w>=700);const r=ratio(fg,bg);const min=grande?3:4.5;
        if(r<min-0.01&&el.getClientRects().length&&cs.visibility!=='hidden'&&parseFloat(cs.opacity)>0)out.push({t:rotulo,r:Math.round(r*100)/100,min,fg:fgCss||cs.color,bg:'rgb('+[bg.r,bg.g,bg.b].map(Math.round).join(',')+')',px,w,txt:(el.textContent||el.placeholder||'').trim().slice(0,30),cls:el.className&&el.className.baseVal===undefined?String(el.className).slice(0,40):''});};
      sels.forEach(s=>{try{document.querySelectorAll(s).forEach(el=>{if(el.namespaceURI==='http://www.w3.org/2000/svg')return;testar(el,null,s);});}catch(e){}});
      document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{if(!el.value&&el.getClientRects().length)testar(el,getComputedStyle(el,'::placeholder').color,'placeholder '+(el.id||el.className));});
      return out;},(r.find(v=>v.id==='?color-contrast')||{nodes:[]}).nodes.map(n=>n.t));
    if(med.length)r.push({id:'contraste-medido',impact:'serious',help:'Contraste medido à mão (casos que o axe não decide)',nodes:med.map(m=>({t:m.t,h:m.txt+' · '+m.cls,d:{fgColor:m.fg,bgColor:m.bg,contrastRatio:m.r,fontSize:m.px+'px',fontWeight:m.w}}))});
    const ecra=await p.evaluate(()=>S.screen+(S.gppSec?'/'+S.gppSec:''));
    res.push({perfil:PERFIL[uid],ecra:nome,real:ecra,vp:vpN,tema,v:r});
    if(CAP){await p.screenshot({path:path.join(CAP,`${vpN}-${tema}-${PERFIL[uid]}-${nome}`.replace(/[^a-z0-9\-]+/gi,'_')+'.png')});}
    await p.evaluate(()=>{if(S.eotAberto){S.eotAberto=null;render();}});
  }
  if(erros.length)res.push({perfil:PERFIL[uid],ecra:'(erros JS)',vp:vpN,tema,erros});
  await ctx.close();}
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));
 // resumo por regra
 const porRegra={};res.forEach(x=>(x.v||[]).forEach(v=>{const k=v.id;porRegra[k]=porRegra[k]||{impact:v.impact,help:v.help,nos:0,ecras:new Set(),ex:new Map()};porRegra[k].nos+=v.nodes.length;porRegra[k].ecras.add(x.perfil+'·'+x.ecra+'·'+x.vp+'·'+x.tema);v.nodes.forEach(n=>{const key=n.t.replace(/:nth-child\(\d+\)/g,'');if(!porRegra[k].ex.has(key))porRegra[k].ex.set(key,{h:n.h,d:n.d});});}));
 for(const [k,v] of Object.entries(porRegra).filter(([k])=>!k.startsWith('?')).sort((a,b)=>b[1].nos-a[1].nos)){console.log(`\n## ${k} [${v.impact}] ${v.help} — ${v.nos} nós em ${v.ecras.size} ecrãs`);
   console.log('  em: '+[...v.ecras].slice(0,6).join(' ; '));
   [...v.ex.entries()].slice(0,25).forEach(([t,e])=>console.log('  · '+t.slice(0,110)+' | '+(e.d&&e.d.contrastRatio?`${e.d.fgColor} sobre ${e.d.bgColor} = ${e.d.contrastRatio} (${e.d.fontSize},${e.d.fontWeight})`:'')+' | '+e.h.slice(0,90)));}
 const errs=res.filter(x=>x.erros);if(errs.length)console.log('\nERROS JS:',JSON.stringify(errs).slice(0,800));
 console.log('\nIncompletos do axe (medidos à mão acima): '+Object.entries(porRegra).filter(([k])=>k.startsWith('?')).reduce((a,[,v])=>a+v.nos,0)+' nós; '+res.filter(x=>x.v).length+' medições');
 const reais=Object.entries(porRegra).filter(([k])=>!k.startsWith('?')).reduce((a,[,v])=>a+v.nos,0);const errJS=res.filter(x=>x.erros).length;
 console.log(reais||errJS?'FALHOU ('+reais+' violações, '+errJS+' ecrãs com erros JS)':'Acessibilidade correta: 0 violações WCAG 2.2 AA em '+res.length+' medições');
 await b.close();srv.close();process.exit(reais||errJS?1:0);})();
