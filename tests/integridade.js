// Teste de sequências aleatórias: escrever valores à portuguesa em vários campos, a velocidades aleatórias,
// a navegar com Tab ou rato, com o servidor lento e falhas de rede. Passa se o que ficou gravado = o que foi escrito.
const {chromium}=require('playwright');
const FILE=require('path').resolve(process.argv[2]||require('path').join(__dirname,'..','index.html')),RUNS=+(process.argv[3]||12),SCREENS=(process.argv[4]||'ficha,margens,stock').split(',');
function rng(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x>>>=0;x^=x>>17;x^=x<<5;x>>>=0;return x/4294967296;};}
function gerar(r){const int=Math.floor(r()*40000)+1,dec=Math.floor(r()*100);const d2=String(dec).padStart(2,'0');
  const t=Math.floor(r()*6);
  if(t===0)return [String(int),int];
  if(t===1)return [int+','+d2,+(int+'.'+d2)];
  if(t===2){const s=int.toLocaleString('de-DE');return [s+','+d2,+(int+'.'+d2)];} // 1.234,56
  if(t===3)return [int+'.'+d2,+(int+'.'+d2)];
  if(t===4){const k=Math.floor(r()*90)+10;return [k+'.'+'500',k*1000+500];} // 12.500 = doze mil e quinhentos
  return [String(Math.floor(r()*100))+','+String(Math.floor(r()*10)),null];}
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});let falhas=0,total=0;const detalhes=[];
for(const scr of SCREENS)for(let run=0;run<RUNS;run++){if(process.env.ONLY&&+process.env.ONLY!==run)continue;
  const r=rng(1000*SCREENS.indexOf(scr)+run+7);total++;
  const ctx=await b.newContext({viewport:{width:1440,height:900},locale:'pt-PT'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.dismiss());
  const srv={ver:'2026-10-01T10:00:00.000Z',ficha:null,margens:{},stock:{}};let abortar=scr==='ficha'&&r()<0.6?Math.floor(r()*6)+1:0,nEsc=0;const perdeResposta=r()<0.5; // metade das falhas: o servidor grava mas a resposta perde-se
  await p.route('**/*',async route=>{const q=route.request(),u=q.url();if(u.startsWith('file:'))return route.continue();
    const m=q.method();await new Promise(z=>setTimeout(z,50+Math.floor(r()*700)));
    if(m==='GET'){if(u.includes('/fichas_margem'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(srv.ficha?[{dados:srv.ficha,updated_at:srv.ver}]:[{dados:{natureza:'MN',iva:23,modo:'civa'},updated_at:srv.ver}])});return route.fulfill({status:200,contentType:'application/json',body:'[]'});}
    nEsc++;if(process.env.DBG)console.log('  req',nEsc,m,u.split('/rest/v1')[1].slice(0,70),(q.postData()||'').slice(0,160));if(abortar&&nEsc===abortar&&!perdeResposta){if(process.env.DBG)console.log('  ABORT');return route.abort('failed');}
    const _perder=abortar&&nEsc===abortar&&perdeResposta;
    let body={};try{body=JSON.parse(q.postData()||'{}');}catch(e){}
    if(u.includes('/fichas_margem')){const mv=u.match(/updated_at=eq\.([^&]+)/);if(mv&&decodeURIComponent(mv[1])!==srv.ver)return route.fulfill({status:200,contentType:'application/json',body:'[]'});
      srv.ficha=body.dados;srv.ver=body.updated_at;if(_perder)return route.abort('failed');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{negocio_id:5,updated_at:srv.ver}])});}
    if(u.includes('/margens')){const id=(u.match(/negocio_id=eq\.(\d+)/)||[])[1]||body.negocio_id;srv.margens[id]=body.margem;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{negocio_id:+id}])});}
    if(u.includes('/stock_usadas')){const id=(u.match(/id=eq\.(\d+)/)||[])[1];Object.keys(body).forEach(k=>{if(k!=='updated_at')srv.stock[id+'.'+k]=body[k];});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:+id}])});}
    route.fulfill({status:200,contentType:'application/json',body:'[]'});});
  await p.goto('file://'+FILE);await p.waitForTimeout(200);
  await p.evaluate(scr=>{S.config={url:'https://fyieckrmdrorjoevmrhm.supabase.co',key:'k'};S.token='t';S.me={id:'a',role:'admin',nome:'GPP'};S.team=[{id:'v1',role:'vendedor',nome:'Felipe'}];S.loading=false;
    const ym=curYM(),iso=new Date().toISOString().slice(0,10);
    S.records=Array.from({length:6},(_,i)=>({id:i+1,status:'Retail',vendedor_id:'v1',type:'MN',mat:'AA-0'+i,id_cliente:'Cliente '+i,model:'R 1300 GS',col_298:iso}));
    S.margens={};S.equip=[];S.comFecho={};S.assessores=[];
    if(scr==='ficha'){S.records.push({id:5,status:'Carteira'});S.fmNeg='5';S.fmGravado='2026-10-01T10:00:00.000Z';S.fm={natureza:'MN',iva:23,modo:'civa'};S.screen='ficha';}
    if(scr==='margens'){S.screen='dashboard';S.gppSec='comissoes';S.dashMes=ym;S.perTipo='mes';}
    if(scr==='stock'){S.stock=Array.from({length:4},(_,i)=>({id:i+1,categoria:'usada',modelo:'F 900 R',matricula:'XX-0'+i,estado:'Disponível',data_rececao:iso}));S.stockLoaded=true;S.screen='dashboard';S.gppSec='stock';}
    render();},scr);
  await p.waitForTimeout(150);
  const sel={ficha:'input[data-fm].stock-num',margens:'input[data-mrg-id]',stock:'input[data-stock-f="valor_min"],input[data-stock-f="valor_anunciado"],input[data-stock-f="valor_entrada"]'}[scr];
  const campos=await p.evaluate(sel=>[...document.querySelectorAll(sel)].map(e=>{const ks=Object.keys(e.dataset).filter(k=>k!=='num'&&k!=='label');return ks.map(k=>'[data-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+'="'+e.dataset[k]+'"]').join('');}),sel);
  const N=Math.min(campos.length,scr==='stock'?6:7);const esperado=[];
  // a navegação por Tab só é fiável entre campos seguidos; escolhe campos consecutivos
  const ini=0;
  await p.click(campos[ini]);
  for(let i=ini;i<ini+N;i++){
    let [txt,val]=gerar(r);if(val===null){txt=txt;val=+(txt.replace(',','.'));}
    await p.keyboard.press('Control+A');
    for(const ch of txt){await p.keyboard.type(ch);await p.waitForTimeout(Math.floor(r()*r()*350));}
    esperado.push([campos[i],val,txt]);
    if(i<ini+N-1){
      if(r()<0.25){await p.click(campos[i+1]);}else{
        // Tab até ao próximo campo da lista (pode haver outros campos pelo meio)
        let guard=0;await p.keyboard.press('Tab');
        while(guard++<6&&!(await p.evaluate(s=>document.activeElement&&document.activeElement.matches(s),campos[i+1]))){await p.keyboard.press('Tab');}
        if(!(await p.evaluate(s=>document.activeElement&&document.activeElement.matches(s),campos[i+1])))await p.click(campos[i+1]);
      }}
  }
  await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
  await p.waitForTimeout(1500);
  // espera até não haver gravações pendentes (máx. 20 s) — inclui as novas tentativas depois de falhas de rede
  for(let t=0;t<40;t++){const pend=await p.evaluate(()=>typeof escritasPendentes==='function'?escritasPendentes():false).catch(()=>false);if(!pend)break;await p.waitForTimeout(500);}
  await p.waitForTimeout(800);
  const gravado=await p.evaluate(()=>0).then(()=>srv);
  const res=esperado.map(([c,val,txt])=>{let got;
    if(scr==='ficha'){const k=c.match(/data-fm="([^"]+)"/)[1];got=srv.ficha?srv.ficha[k]:undefined;}
    if(scr==='margens'){const id=c.match(/data-mrg-id="(\d+)"/)[1];got=srv.margens[id];}
    if(scr==='stock'){const id=c.match(/data-stock-id="(\d+)"/)[1],f=c.match(/data-stock-f="([^"]+)"/)[1];got=srv.stock[id+'.'+f];}
    const ok=got!=null&&got!==''&&Math.abs(Number(got)-val)<1e-9;return {txt,val,got,ok};});
  if(process.env.DBG){console.log('  esperado',JSON.stringify(esperado.map(x=>x[0].replace(/\[data-fm="|"\]/g,'')+'='+x[1])));console.log('  estado',await p.evaluate(()=>S.fmEstado+' pend='+S.fmPendente+' conflito='+JSON.stringify(S.fmConflito)+' fm='+JSON.stringify(S.fm)));}
  const bad=res.filter(x=>!x.ok);if(bad.length||errs.length){falhas++;detalhes.push(scr+'#'+run+(abortar?' (falha de rede injetada)':'')+': '+bad.map(x=>`escrito "${x.txt}" → gravado ${JSON.stringify(x.got)}`).join('; ')+(errs.length?' ERROS JS: '+errs[0]:''));}
  await ctx.close();
}
console.log(FILE.split('/').pop()+': '+(total-falhas)+'/'+total+' sequências corretas');detalhes.slice(0,8).forEach(d=>console.log('  ✗ '+d));
await b.close();process.exit(falhas?1:0);})();
