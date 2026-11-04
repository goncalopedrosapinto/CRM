// Folha de Negócio das motas novas e demos: botão no negócio (só MN/MD, vendedor do negócio ou chefe), painel com o que vem
// do negócio, o que vem por omissão (ficha de margem, encomenda, perfil, financiamento) e os campos só da folha (guardados
// sozinhos), e o PDF preenchido «Folha de Negócio CLIENTE.pdf». O PDF descarregado é lido de volta. Dados fictícios.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const RAIZ=path.resolve(__dirname,'..');const FILE=path.resolve(process.argv[2]||path.join(RAIZ,'index.html'));
const PDFLib=require(path.join(RAIZ,'vendor','pdf-lib.min.js'));
const PORTA=8783;
const TIPOS={'.pdf':'application/pdf','.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8'};
const srv=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=u==='/'||u==='/index.html'?FILE:path.join(RAIZ,u.replace(/^\/+/,''));
  if(!f.startsWith(RAIZ)||!fs.existsSync(f)){s.writeHead(404);return s.end('');}s.writeHead(200,{'content-type':TIPOS[path.extname(f)]||'application/octet-stream'});s.end(fs.readFileSync(f));}).listen(PORTA);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=sub=>b64({alg:'ES256'})+'.'+b64({sub,exp:Math.floor(Date.now()/1000)+3600})+'.x';
const PERFIS={c1:{id:'c1',nome:'Chefe GPP',role:'admin',linha:'motorrad'},v1:{id:'v1',nome:'Vendedor Um',role:'vendedor',linha:'motorrad'},v2:{id:'v2',nome:'Vendedor Dois',role:'vendedor',linha:'motorrad'}};
const hoje=new Date();const hojePT=String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear();
// nomes com acentos: o Chromium precisa de um locale UTF-8 para os manter no ficheiro descarregado (como no Windows/Mac)
(async()=>{const b=await chromium.launch(Object.assign({env:Object.assign({},process.env,{LANG:'C.UTF-8',LC_ALL:'C.UTF-8'})},process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}));
 const recs=[{id:21,vendedor_id:'v1',status:'Carteira',type:'MN',id_cliente:'Cliente Nova Ficticia',nif:'234567890',contacto:'913 000 111',email:'nova@exemplo.pt',
     model:'R 1300 GS',version:'Trophy',enc:'9100007',pvp:'24500',profile:'Particular',origin:'Recom.',fin:'Fext',flag_rgpd:true,flag_seguro:true,retoma:'Sim',retoma_modelo:'F 800 GS',retoma_mat:'11-zz-22',
     obs:'NOTA INTERNA que não pode ir para a folha',updated_at:new Date().toISOString()},
   {id:22,vendedor_id:'v1',status:'Quente',type:'MD',id_cliente:'Empresa Demo Lda',model:'R 18',profile:'Empresa',updated_at:new Date().toISOString()},
   {id:23,vendedor_id:'v1',status:'Quente',type:'MU',id_cliente:'Cliente Usada',model:'R 1250 GS',updated_at:new Date().toISOString()}];
 const est={acordos:{},escritas:[]};
 const rota=quem=>async r=>{const u=decodeURIComponent(r.request().url());const m=r.request().method();if(u.startsWith('http://localhost'))return r.continue();
  const json=(x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return json({access_token:jwt(quem),refresh_token:'rt2'});
  const t=(u.match(/rest\/v1\/([a-z_]+)/)||[])[1];
  if(t==='acordos_venda'){const id=+(u.match(/negocio_id=eq\.(\d+)/)||[])[1];
    if(m==='GET')return json(est.acordos[id]?[{dados:est.acordos[id],updated_at:new Date().toISOString()}]:[]);
    const body=JSON.parse(r.request().postData());est.escritas.push([m,body.negocio_id||id,JSON.parse(JSON.stringify(body.dados))]);
    if(m==='PATCH'){if(!est.acordos[id])return json([]);est.acordos[id]=body.dados;return json([{negocio_id:id,dados:body.dados}]);}
    if(m==='POST'){est.acordos[body.negocio_id]=body.dados;return json([body],201);}}
  if(t==='fichas_margem')return json(u.includes('negocio_id=eq.21')?[{estado:'arquivada',dados:{preco_venda:'25000',pac:'900'},updated_at:'2026-10-01'},{estado:'vendida',dados:{preco_venda:'23 900',pac:'750'},updated_at:'2026-09-01'}]:[]);
  if(t==='encomendas_bmw')return json(u.includes('production_number=eq.9100007')?[{model_code:'0M21'}]:[]);
  if(t==='profiles')return json([PERFIS[quem]].concat(Object.values(PERFIS).filter(p=>p.id!==quem)));
  if(t==='baviera_control')return json(recs);
  return json([]);};
 const erros=[];
 const abrir=async(quem,vp)=>{const ctx=await b.newContext({viewport:vp||{width:1280,height:1000},acceptDownloads:true});
  await ctx.addInitScript(t=>localStorage.setItem('bc_session',JSON.stringify({refresh_token:'rt',access_token:t,exp:Date.now()+3600e3})),jwt(quem));
  await ctx.route('**/*',rota(quem));const p=await ctx.newPage();p.on('pageerror',e=>erros.push(quem+': '+e.message));
  await p.goto(`http://localhost:${PORTA}/`);await p.waitForTimeout(1500);return {ctx,p};};
 const negocio=async(p,id)=>{await p.evaluate(id=>{S.folhaAberta=null;S.acordoAberto=null;setState({screen:'detail',selected:S.records.find(r=>r.id===id)});},id);await p.waitForTimeout(250);};
 const painel=p=>p.evaluate(()=>{const t=e=>e?e.textContent.replace(/[\s  ]+/g,' ').trim():'';const box=document.getElementById('fn-box');
   const v={};document.querySelectorAll('#fn-box [data-ac]').forEach(e=>{v[e.dataset.ac]=e.type==='checkbox'?e.checked:e.value;});
   return {botao:t(document.querySelector('[data-action="folha-abrir"]')),acordo:!!document.querySelector('[data-action="acordo-abrir"]'),aberto:!!box,neg:t(box&&box.querySelector('.ac-neg')),
     faltas:t(box&&box.querySelector('.ac-faltas')),nome:t(box&&box.querySelector('.ac-nome')),estado:t(document.getElementById('ac-est')),v,retoma:!!document.getElementById('ac-fn_retoma_valor')};});
 const lerPDF=async f=>{const doc=await PDFLib.PDFDocument.load(fs.readFileSync(f));const form=doc.getForm();const o={};
   form.getFields().forEach(x=>{const n=x.getName();o[n]=x instanceof PDFLib.PDFCheckBox?x.isChecked():String(x.getText()||'').replace(/[\s  ]+/g,' ');});return o;};
 // ---------- vendedor do negócio ----------
 const V1=await abrir('v1');const p=V1.p;
 await negocio(p,23);const usada=await painel(p);
 await negocio(p,21);const A=await painel(p);
 await p.click('[data-action="folha-abrir"]');await p.waitForTimeout(700);const B=await painel(p);
 const escrever=async(k,v)=>{await p.fill('#ac-'+k,v);};
 await escrever('fn_proposta','P-2026-118');await escrever('fn_sinal','1 000');await escrever('fn_n_stock','ST-55');await escrever('fn_frota','0');
 await escrever('fn_retoma_ano','2017');await escrever('fn_retoma_kms','48 000');await escrever('fn_retoma_valor','6 000');await escrever('fn_retoma_bps','5 500');
 await escrever('fn_observacoes','Entrega com malas.');await p.check('#ac-fn_fin_gap');await p.uncheck('#ac-fn_fin_seguro_auto');
 await p.selectOption('#ac-fn_origem','Lead Internet');
 await p.waitForTimeout(1200);const C=await painel(p);const escritas1=est.escritas.slice();
 await p.evaluate(()=>document.getElementById('fn-box').scrollIntoView({block:'end'}));await p.screenshot({path:path.join(__dirname,'folha_negocio.png')});
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.click('[data-action="folha-pdf"]')]);
 const nomeFicheiro=dl.suggestedFilename();const destino=path.join(__dirname,'folha_negocio_teste.pdf');await dl.saveAs(destino);await p.waitForTimeout(500);
 const pdf=await lerPDF(destino);const guardado=est.acordos[21]||{};
 // demo de empresa sem dados: por omissão Demo, Empresa; diz o que falta
 await negocio(p,22);await p.click('[data-action="folha-abrir"]');await p.waitForTimeout(600);const D=await painel(p);
 await V1.ctx.close();
 const C1=await abrir('c1');await negocio(C1.p,21);const chefe=await painel(C1.p);await C1.ctx.close();
 const V2=await abrir('v2',{width:390,height:844});await negocio(V2.p,21);const outro=await painel(V2.p);await V2.ctx.close();
 const V1b=await abrir('v1',{width:390,height:844});await negocio(V1b.p,21);await V1b.p.click('[data-action="folha-abrir"]');await V1b.p.waitForTimeout(600);
 const larg=await V1b.p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);await V1b.ctx.close();
 const R={usada,A,B,C,escritas1,nomeFicheiro,pdf,guardado,D,chefe,outro,larg,erros};
 console.log(JSON.stringify(R,null,1));
 const ultima=escritas1[escritas1.length-1]||[];
 const ok={
  'só nos negócios de novas e demos (a usada tem o acordo, não a folha)':!usada.botao&&usada.acordo&&/Folha de Negócio/.test(A.botao)&&!A.acordo&&!A.aberto,
  'abre com o que vem do negócio, sem faltas e sem a nota interna':B.aberto&&/Cliente Nova Ficticia/.test(B.neg)&&/234567890/.test(B.neg)&&/9100007/.test(B.neg)&&/F 800 GS · 11-ZZ-22/.test(B.neg)&&!B.faltas&&!/NOTA INTERNA/.test(B.neg),
  'por omissão: data, utilizador, RGPD, Novo, origem, código do modelo, preço e PAC da ficha vendida, faturação, financiamento':
    B.v.fn_data===`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`&&B.v.fn_utilizador==='Cliente Nova Ficticia'&&!B.v.fn_empresa&&B.v.fn_rgpd==='Sim'&&
    B.v.fn_tipo_venda==='Novo'&&B.v.fn_origem==='Recomendação'&&B.v.fn_codigo_modelo==='0M21'&&B.v.fn_valor_fatura==='23900'&&B.v.fn_pac==='750'&&B.v.fn_faturacao==='Particular'&&
    B.v.fn_fin_outro_banco===true&&B.v.fn_fin_seguro_auto===true&&B.v.fn_fin_pp===false&&B.retoma,
  'grava sozinho o que se escreve (no negócio certo)':ultima[1]===21&&ultima[2].fn_proposta==='P-2026-118'&&ultima[2].fn_fin_gap===true&&ultima[2].fn_fin_seguro_auto===false&&ultima[2].fn_origem==='Lead Internet'&&/guardado/.test(C.estado),
  'nome do ficheiro: Folha de Negócio + cliente':nomeFicheiro==='Folha de Negócio Cliente Nova Ficticia.pdf'&&/Folha de Negócio Cliente Nova Ficticia\.pdf/.test(B.nome),
  'PDF: negócio e cliente':pdf.vendedor==='Vendedor Um'&&pdf.n_proposta==='P-2026-118'&&pdf.data===hojePT&&pdf.cliente_utilizador==='Cliente Nova Ficticia'&&!pdf.cliente_empresa&&pdf.cliente_nif==='234567890'&&
    pdf.cliente_contacto==='913 000 111'&&pdf.cliente_email==='nova@exemplo.pt'&&pdf.rgpd_sim===true&&pdf.rgpd_nao===false,
  'PDF: tipo de venda e origem (uma caixa cada)':pdf.tv_novo===true&&['tv_stock_tatico','tv_km0','tv_demo','tv_cortesia','tv_servico','tv_usado','tv_pt'].every(k=>pdf[k]===false)&&
    pdf.or_lead_internet===true&&['or_stand','or_recomendacao','or_lead_bmw','or_csc','or_angariacao','or_apv','or_eventos','or_cliente_atual'].every(k=>pdf[k]===false)&&pdf.codigo_modelo==='0M21',
  'PDF: informações de negócio e financiamento':pdf.modelo==='R 1300 GS Trophy'&&pdf.valor_fatura==='23 900,00'&&pdf.sinal==='1 000,00'&&pdf.encomenda==='9100007'&&pdf.n_stock==='ST-55'&&pdf.valor_pac==='750,00'&&pdf.valor_frota==='0,00'&&
    pdf.fat_particular===true&&pdf.fat_empresa===false&&pdf.fin_outro_banco===true&&pdf.fin_gap===true&&pdf.fin_seguro_auto===false&&pdf.fin_pp===false,
  'PDF: retoma e observações':pdf.retoma_modelo==='F 800 GS'&&pdf.retoma_matricula==='11-ZZ-22'&&pdf.retoma_ano==='2017'&&pdf.retoma_kms==='48 000'&&pdf.retoma_valor==='6 000,00'&&pdf.retoma_valor_bps==='5 500,00'&&pdf.observacoes==='Entrega com malas.',
  'a nota interna do negócio não vai para o PDF':!Object.values(pdf).some(v=>/NOTA INTERNA/.test(String(v))),
  'ao descarregar fica guardado tal como saiu (data e preço da ficha incluídos)':!!guardado.fn_data&&guardado.fn_valor_fatura==='23900'&&guardado.fn_codigo_modelo==='0M21',
  'demo de empresa: Demo, Empresa e diz o que falta':D.v.fn_tipo_venda==='Demo'&&D.v.fn_empresa==='Empresa Demo Lda'&&!D.v.fn_utilizador&&D.v.fn_faturacao==='Empresa'&&/Falta no negócio: NIF, Contacto, E-mail/.test(D.faltas)&&!D.retoma,
  'chefe tem o botão; outro vendedor não':/Folha de Negócio/.test(chefe.botao)&&!outro.botao,
  'telemóvel sem scroll de lado':larg,
  'sem erros JS':!erros.length};
 let f=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)f++;}
 if(!process.env.MANTER_PDF)try{fs.unlinkSync(path.join(__dirname,'folha_negocio_teste.pdf'));}catch(e){}
 console.log(f?`FALHOU (${f})`:'Folha de Negócio correta');await b.close();srv.close();process.exit(f?1:0);})();
