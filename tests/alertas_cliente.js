// Alertas aos vendedores: declaração de circulação (mota nova vendida, 90 dias depois da matrícula; resposta rápida no
// negócio, "Por atualizar" mantém o aviso, "Atualizada" tira-o) e aniversário dos clientes (um aviso por cliente,
// hoje e, à segunda, o fim de semana; 29/02 a 28/02 nos anos comuns; o RGPD do negócio não entra). Sem o SQL, os campos novos
// não aparecem e gravar o
// negócio não manda as colunas novas.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const PORTA=8769;
const srv=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'text/html; charset=utf-8'});s.end(fs.readFileSync(FILE));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const ha=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-n);return iso(d);};
const hoje=new Date();const mmdd=iso(hoje).slice(5);const amanha=new Date();amanha.setDate(amanha.getDate()+1);
const recs=[
  {id:1,status:'Retail',type:'MN',vendedor_id:'v1',id_cliente:'Cliente 95 dias',dmat:ha(95),decl_circ:null,data_nascimento:null},
  {id:2,status:'Retail',type:'MN',vendedor_id:'v1',id_cliente:'Cliente 30 dias',dmat:ha(30),decl_circ:null,data_nascimento:null},
  {id:3,status:'Retail',type:'MU',vendedor_id:'v1',id_cliente:'Cliente Usada',dmat:'2019-06-23',decl_circ:null,data_nascimento:null},
  {id:4,status:'Retail',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Já Tratado',dmat:ha(200),decl_circ:'Atualizada',data_nascimento:null},
  {id:5,status:'Carteira',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Por Atualizar',dmat:ha(400),decl_circ:'Por atualizar',decl_circ_em:'2026-01-10T10:00:00Z',data_nascimento:null},
  {id:6,status:'Retail',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Antigo',dmat:ha(400),decl_circ:null,data_nascimento:null},
  {id:7,status:'Frio',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Anos',nif:'123456789',contacto:'912 345 678',data_nascimento:'1985-'+mmdd,flag_rgpd:false,decl_circ:null,updated_at:'2026-10-01T10:00:00Z'},
  {id:8,status:'Perdido',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Anos',nif:'123 456 789',data_nascimento:'1985-'+mmdd,flag_rgpd:false,decl_circ:null,updated_at:'2026-10-05T10:00:00Z'},
  {id:9,status:'Retail',type:'MN',vendedor_id:'v1',id_cliente:'Cliente Amanhã',data_nascimento:'1990-'+iso(amanha).slice(5),flag_rgpd:true,decl_circ:null},
  {id:10,status:'Perdido',type:'MN',vendedor_id:'v1',id_cliente:'Perdido 95 dias',dmat:ha(95),decl_circ:null,data_nascimento:null}];
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const ctx=await b.newContext({viewport:{width:1300,height:900}});const log=[];
 await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt('v1'));
 await ctx.route('**/*',async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt('v1'),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='baviera_control'&&m==='PATCH'){const id=+(u.match(/id=eq\.(\d+)/)||[])[1];const body=JSON.parse(r.request().postData());log.push({id,body:Object.assign({},body)});
    const x=recs.find(y=>y.id===id);if('decl_circ' in body&&body.decl_circ!==x.decl_circ)body.decl_circ_em=body.decl_circ?new Date().toISOString():null;Object.assign(x,body);return json([x]);}
  if(t==='baviera_control')return json(recs);
  if(t==='profiles')return json([{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'}]);
  return json([]);});
 const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);
 const tratar=()=>p.evaluate(()=>[...document.querySelectorAll('.vh-row')].map(x=>({t:x.textContent.replace(/\s+/g,' ').trim(),ids:x.dataset.ids||'',al:x.dataset.alert||''})));
 await p.evaluate(()=>{S.screen='list';S.statusFilter='_hoje';S.alertFilter=null;render();});await p.waitForTimeout(300);
 const casa=await tratar();
 const decl0=casa.find(x=>x.al==='decl_circ')||{},aniv0=casa.find(x=>x.al==='aniv')||{};
 // abrir o negócio a partir do alerta
 await p.click('.vh-row[data-alert="decl_circ"]');await p.waitForTimeout(250);
 const filtrado=await p.evaluate(()=>({f:S.alertFilter,ids:S.alertIds}));
 await p.evaluate(()=>setState({screen:'detail',selected:S.records.find(x=>x.id===1)}));await p.waitForTimeout(200);
 const det1=await p.textContent('.neg-aviso.decl').catch(()=>'');
 await p.click('[data-action="decl-circ"][data-v="Por atualizar"]');await p.waitForTimeout(500);
 const det2=await p.textContent('.neg-aviso.decl').catch(()=>'');const log1=log[log.length-1]||{};
 const alerta2=await p.evaluate(()=>(calcAlerts(recsInContext()).find(a=>a.id==='decl_circ')||{}).label||'');
 await p.click('[data-action="decl-circ"][data-v="Atualizada"]');await p.waitForTimeout(500);
 const det3=await p.$('.neg-aviso.decl');const alerta3=await p.evaluate(()=>(calcAlerts(recsInContext()).find(a=>a.id==='decl_circ')||{}).label||'');
 // aniversário no detalhe
 await p.evaluate(()=>setState({screen:'detail',selected:S.records.find(x=>x.id===7)}));await p.waitForTimeout(200);
 const anivDet=await p.textContent('.neg-aviso.aniv').catch(()=>'');
 // formulário: data de nascimento sempre; declaração só nas novas com matrícula
 const campos=async id=>{await p.evaluate(i=>{setState({selected:S.records.find(x=>x.id===i)});setState({form:recordToForm(S.selected),screen:'edit',openGroups:{INFO:true,'Identificação':true,Datas:true}});},id);await p.waitForTimeout(250);
   return p.evaluate(()=>({nasc:!!document.querySelector('[data-field="data_nascimento"]'),decl:!!document.querySelector('[data-field="decl_circ"]')}));};
 const fMN=await campos(1),fMU=await campos(3);
 const fSemSql=await p.evaluate(()=>{const R=S.records;S.records=R.map(r=>{const c=Object.assign({},r);delete c.data_nascimento;delete c.decl_circ;return c;});setState({selected:S.records[0]});setState({form:recordToForm(S.selected),screen:'edit',openGroups:{INFO:true,'Identificação':true,Datas:true}});
   const o={nasc:!!document.querySelector('[data-field="data_nascimento"]'),decl:!!document.querySelector('[data-field="decl_circ"]')};S.records=R;return o;});
 // regras de datas
 const datas=await p.evaluate(()=>({f28:anivCai('1992-02-29',new Date(2027,1,28)),f28bis:anivCai('1992-02-29',new Date(2028,1,28)),f29bis:anivCai('1992-02-29',new Date(2028,1,29)),
   seg:anivDatas(new Date(2026,9,26)).map(d=>d.getDate()),sex:anivDatas(new Date(2026,9,23)).map(d=>d.getDate())}));
 // sem o SQL: não manda as colunas novas; com o SQL manda (vazias como null)
 const semSql=await p.evaluate(()=>{const R=S.records;S.records=[{id:1,status:'Frio'}];const b=negColunasNovas({data_nascimento:null,decl_circ:null,x:1});S.records=R;const c=negColunasNovas({data_nascimento:null,decl_circ:null,x:1});return {sem:Object.keys(b),com:Object.keys(c)};});
 await p.evaluate(()=>{S.screen='list';S.statusFilter='_hoje';S.alertFilter=null;render();});await p.waitForTimeout(250);await p.screenshot({path:path.join(__dirname,'alertas_cliente.png')});
 const R={decl0,aniv0,filtrado,det1,det2,log1,alerta2,det3:!!det3,alerta3,anivDet,fMN,fMU,fSemSql,datas,semSql,erros};console.log(JSON.stringify(R,null,1));
 const ok={
  'declaração: só motas novas vendidas com +90 dias (sem resposta até 1 ano) ou por atualizar':decl0.ids==='1,5'&&/1 declaração de circulação a verificar \(matrícula há \+90 dias\) · 1 por atualizar/.test(decl0.t),
  'clicar no alerta filtra esses negócios':filtrado.f==='decl_circ'&&JSON.stringify(filtrado.ids)==='[1,5]',
  'no negócio pergunta se está atualizada':/Matriculada há 95 dias: a declaração de circulação está atualizada\?/.test(det1),
  '"Não": grava Por atualizar e o aviso continua':log1.id===1&&log1.body.decl_circ==='Por atualizar'&&Object.keys(log1.body).length===1&&/por atualizar desde/i.test(det2)&&/2 declarações de circulação por atualizar/.test(alerta2),
  '"Atualizada": o aviso sai':!R.det3&&!/a verificar/.test(alerta3)&&/1 declaração de circulação por atualizar/.test(alerta3),
  'aniversário: um aviso por cliente (mesmo NIF em dois negócios), sem falar de RGPD':aniv0.ids==='7'&&/^Aniversário ?1 cliente faz anos (hoje|\(hoje e no fim de semana\))$/.test(aniv0.t),
  'aniversário no negócio, com telefone':/Cliente Anos faz anos hoje/.test(anivDet)&&/912 345 678/.test(anivDet)&&!/RGPD/.test(anivDet),
  'antes do SQL os campos novos não aparecem (não se perde o que se escreve)':!fSemSql.nasc&&!fSemSql.decl,
  'formulário: data de nascimento sempre, declaração só nas novas matriculadas':fMN.nasc&&fMN.decl&&fMU.nasc&&!fMU.decl,
  '29/02 faz anos a 28/02 nos anos comuns':datas.f28&&!datas.f28bis&&datas.f29bis,
  'à segunda-feira avisa também os do fim de semana':JSON.stringify(datas.seg)==='[26,25,24]'&&JSON.stringify(datas.sex)==='[23]',
  'sem o SQL o negócio grava sem as colunas novas':JSON.stringify(semSql.sem)==='["x"]'&&semSql.com.length===3,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 console.log(f?`FALHOU (${f})`:'Alertas de declaração e aniversário corretos');await b.close();srv.close();process.exit(f?1:0);})();
