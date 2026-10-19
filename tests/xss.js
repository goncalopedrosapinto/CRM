// Teste dinâmico de XSS: Supabase simulado devolve, em cada campo de texto, um marcador "'><xN>.
// Se algum elemento <xN> aparecer no DOM (página ou janelas de PDF), esse campo entrou sem proteção.
// Uso: node xss.js <index.html> [modo A|B] [cliques]
const {chromium}=require('playwright');
const SCHEMA=require('./schema.js');
const path=require('path');const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));const MODO=process.argv[3]||'A';const CLIQUES=+(process.argv[4]||250);
const now=new Date();const YM=now.getFullYear()+'/'+String(now.getMonth()+1).padStart(2,'0');const ISO=now.toISOString().slice(0,10);
const TEAM=[['00000000-0000-0000-0000-0000000000a1','admin'],['00000000-0000-0000-0000-0000000000b1','vendedor'],['00000000-0000-0000-0000-0000000000b2','vendedor'],
 ['00000000-0000-0000-0000-0000000000c1','secretario'],['00000000-0000-0000-0000-0000000000d1','assessor'],['00000000-0000-0000-0000-0000000000e1','financeiro']];
const TAGS=[];const tag=(nome)=>{let i=TAGS.indexOf(nome);if(i<0){TAGS.push(nome);i=TAGS.length-1;}return `"'><x${i}>`;};
const ENUM={status:['Retail','Carteira','Quente','Morno','Frio','Perdido'],de:['Quente','Carteira'],para:['Carteira','Retail'],status_antigo:['Quente'],status_novo:['Carteira'],
 type:['MN','MU','MD'],linha:['motorrad'],mes1:[YM],mes:[YM],fase:['Por contactar','Contactado','Proposta'],temperatura:['Quente','Morno','Frio'],
 estado:['Disponível','A negociar','Vendida','Matriculada','Encomendada'],tipo:['comentario','alteracao','criacao'],autor_role:['vendedor','admin'],
 funil:['Quente','Morno'],escopo:['vendedor','equipa'],qualidade:['Novo'],campo:['status','pvp']};
function linhas(tab,uid){
  const cols=SCHEMA[tab].split(',').map(c=>c.split(':'));const out=[];
  for(let k=0;k<6;k++){const r={};
    for(const [c,t] of cols){
      if(t==='n')r[c]=(c==='id'||c==='negocio_id'||c==='registo_id'||c==='evento_id'||c==='stock_id'||c==='parent')?k+1:(100+k*37);
      else if(t==='d')r[c]=ISO;else if(t==='ts')r[c]=new Date(Date.now()-k*3600e3).toISOString();
      else if(t==='u')r[c]=(c==='vendedor_id'||c==='responsavel_id')?(k%2?TEAM[1][0]:(uid||TEAM[2][0])):TEAM[k%TEAM.length][0];
      else if(t==='b')r[c]=k%2===0;
      else if(t==='j')r[c]=c==='motas'?[tag(tab+'.motas[0]'),tag(tab+'.motas[1]')]:(c==='docs'?{cc:true,[tag(tab+'.docs.key')]:true}:{cliente:tag(tab+'.dados.cliente'),obs:tag(tab+'.dados.obs')});
      else{ if(MODO==='A'&&ENUM[c])r[c]=ENUM[c][k%ENUM[c].length];
        else if(MODO==='A'&&tab==='profiles'&&c==='role')r[c]=TEAM[k][1];
        else r[c]=tag(tab+'.'+c);}
    }
    if(tab==='profiles'){r.id=TEAM[k][0];r.role=TEAM[k][1];r.linha='motorrad';}
    if(tab==='eot_contratos'){r.contrato=MODO==='A'?String(900+k):tag('eot_contratos.contrato')+k;}
    out.push(r);}
  return out;
}
function jwt(sub){const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');return b({alg:'HS256'})+'.'+b({sub,email:'t@caetano.pt',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.x';}
const PERIGO=/logout|sair|delete|apagar|remover|eliminar|reset|limpar|fechar-sess|import|colar-gravar|password|pw-/i;
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const achados=new Map();const erros=[];
  for(const [uid,role] of TEAM){
    const ctx=await b.newContext({viewport:{width:1440,height:900}});
    await ctx.addInitScript(()=>{try{localStorage.setItem('bc_session',JSON.stringify({refresh_token:'r'}));}catch(e){}
      window.__xssHits=[];window.open=((o)=>function(){const w=o.apply(this,arguments);return w;})(window.open);});
    await ctx.route('**/*',async r=>{const u=new URL(r.request().url());
      if(u.protocol==='file:')return r.continue();
      if(!u.host.includes('supabase.co'))return r.fulfill({status:204,body:''});
      if(u.pathname.startsWith('/auth/v1/token'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:jwt(uid),refresh_token:'r',user:{id:uid,email:'t@caetano.pt'}})});
      if(u.pathname.startsWith('/auth/v1/'))return r.fulfill({status:200,contentType:'application/json',body:'{}'});
      const m=u.pathname.match(/^\/rest\/v1\/([^/?]+)(?:\/([^/?]+))?/);
      if(!m)return r.fulfill({status:200,contentType:'application/json',body:'[]'});
      if(m[1]==='rpc'){const nm=m[2];let rows=[];if(nm==='inscricoes_ranking')rows=TEAM.slice(1,3).map(([id],k)=>({vendedor_id:id,nome:tag('rpc.ranking.nome'),total:3-k,acompanhantes:1}));
        return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});}
      const meth=r.request().method();
      if(meth!=='GET'){let body=[];try{const pb=JSON.parse(r.request().postData()||'[]');body=Array.isArray(pb)?pb:[Object.assign({id:1},pb)];}catch(e){}
        return r.fulfill({status:meth==='DELETE'?204:200,contentType:'application/json',body:meth==='DELETE'?'':JSON.stringify(body)});}
      const tab=m[1];if(!SCHEMA[tab])return r.fulfill({status:200,contentType:'application/json',body:'[]'});
      let rows=linhas(tab,role==='vendedor'||role==='assessor'?uid:null);
      if(tab==='profiles'&&u.searchParams.get('id')==='eq.'+uid)rows=rows.filter(x=>x.id===uid);
      if(tab==='profiles'&&u.searchParams.get('role'))rows=rows.filter(x=>'eq.'+x.role===u.searchParams.get('role'));
      return r.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-'+(rows.length-1)+'/'+rows.length},body:JSON.stringify(rows)});
    });
    const p=await ctx.newPage();p.on('pageerror',e=>erros.push(role+': '+e.message.slice(0,140)));
    p.on('dialog',d=>d.dismiss().catch(()=>{}));p.on('console',m=>{if(/Content Security Policy|Refused/.test(m.text()))erros.push(role+' CSP: '+m.text().slice(0,160));});
    const scan=async(pg,onde)=>{let hits=[];try{hits=await pg.evaluate(()=>[...document.querySelectorAll('*')].map(e=>e.tagName).filter(t=>/^X\d+$/.test(t)));}catch(e){}
      for(const h of new Set(hits)){const nome=TAGS[+h.slice(1)];const k=nome;if(!achados.has(k))achados.set(k,new Set());achados.get(k).add(role+' @ '+onde);}};
    ctx.on('page',async pop=>{if(pop===p)return;try{await pop.waitForLoadState('domcontentloaded',{timeout:3000});}catch(e){}await scan(pop,'janela/PDF');await pop.close().catch(()=>{});});
    await p.goto('file://'+FILE);await p.waitForTimeout(1500);
    const ecra=async()=>p.evaluate(()=>(typeof S!=="undefined"?S.screen+'/'+(S.gppSec||''):'?')).catch(()=>'?');
    console.error(role,'boot',await ecra(),'texto com marcador:',await p.evaluate(()=>(document.body.innerText.match(/<x\d+>/g)||[]).length));
    const pdf=await p.evaluate(async()=>{const caps=[];const o=window.open;window.open=function(){const d={_h:'',open(){},write(h){this._h+=h;},close(){caps.push(this._h);}};return {document:d,focus(){},print(){},close(){},addEventListener(){},onload:null};};
      const res={};for(const f of ['fmPDF','triPDF','exportNormaPDF','exportEscalaPDF','exportStockPDF']){try{const fn=eval(f);await fn();res[f]='ok';}catch(e){res[f]='erro '+String(e.message).slice(0,50);}}
      for(const q of ['vend','ass']){try{await exportComissoesPDF(q);res['com_'+q]='ok';}catch(e){res['com_'+q]='erro '+String(e.message).slice(0,50);}}
      window.open=o;const tags=[];for(const h of caps){const doc=new DOMParser().parseFromString(h,'text/html');doc.querySelectorAll('*').forEach(e=>{if(/^X\d+$/.test(e.tagName))tags.push(e.tagName);});
        tags.push('#marcadores_texto:'+((doc.body&&doc.body.textContent.match(/<x\d+>/g))||[]).length);}
      return {res,n:caps.length,tags};});
    console.error(role,'PDF',JSON.stringify(pdf.res),'janelas',pdf.n,pdf.tags.filter(t=>t[0]==='#').join(' '));
    for(const t of pdf.tags.filter(t=>t[0]!=='#')){const nome=TAGS[+t.slice(1)];if(!achados.has(nome))achados.set(nome,new Set());achados.get(nome).add(role+' @ PDF');}
    await scan(p,await ecra());
    // varrimento: cada ação visível uma vez a partir do ecrã inicial, depois passeio aleatório
    const inicio=await p.evaluate(()=>JSON.stringify({screen:S.screen,gppSec:S.gppSec}));
    const acoes=async()=>p.evaluate((perigo)=>{const re=new RegExp(perigo,'i');return [...document.querySelectorAll('[data-action]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!re.test(e.dataset.action);}).map((e,i)=>{e.setAttribute('data-xi',i);return {i,a:e.dataset.action,sig:e.dataset.action+'|'+(e.dataset.sec||e.dataset.s||e.dataset.tab||e.dataset.status||'')};});},PERIGO.source);
    const clicar=async(i)=>{try{await p.click(`[data-xi="${i}"]`,{timeout:800,force:true});}catch(e){}await p.waitForTimeout(120);await scan(p,await ecra());};
    const vistas=new Set();let lista=await acoes();
    for(const a of lista){if(vistas.has(a.sig))continue;vistas.add(a.sig);
      await p.evaluate(s=>{const o=JSON.parse(s);setState(Object.assign({eotModal:null,selected:null},o));},inicio).catch(()=>{});await p.waitForTimeout(60);
      const l2=await acoes();const alvo=l2.find(x=>x.sig===a.sig);if(alvo)await clicar(alvo.i);
      // um nível abaixo: cada ação nova do ecrã resultante
      const l3=await acoes();for(const c of l3){if(vistas.has('2:'+c.sig))continue;vistas.add('2:'+c.sig);
        const atual=await acoes();const t=atual.find(x=>x.sig===c.sig);if(t)await clicar(t.i);}
    }
    let seed=7;const rnd=n=>{seed=(seed*9301+49297)%233280;return Math.floor(seed/233280*n);};
    for(let k=0;k<CLIQUES;k++){const l=await acoes();if(!l.length){await p.evaluate(s=>setState(JSON.parse(s)),inicio).catch(()=>{});continue;}await clicar(l[rnd(l.length)].i);
      if(k%40===39)await p.evaluate(s=>setState(JSON.parse(s)),inicio).catch(()=>{});}
    console.error(role,'ações distintas',vistas.size);
    await ctx.close();
  }
  await b.close();
  const res=[...achados.entries()].map(([k,v])=>({campo:k,onde:[...v].slice(0,4)}));
  console.log(JSON.stringify({modo:MODO,campos_vulneraveis:res.length,res,erros:[...new Set(erros)].slice(0,15)},null,1));
  process.exit(res.length||erros.some(e=>/CSP/.test(e))?1:0);
})();
