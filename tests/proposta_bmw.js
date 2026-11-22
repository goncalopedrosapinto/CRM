// Ler a proposta BMW (o PDF «A SUA PROPOSTA.» que a plataforma gera) para preencher a ficha de margem (pedido do chefe, 22/11/2026).
// As propostas de teste são inventadas e geradas aqui (nenhum PDF de cliente no repositório), com a mesma estrutura da plataforma.
// - lê modelo, opcionais, serviço & garantia, acessórios, EcoValor, IUC, transporte, PAC (linhas negativas dos diversos), ISV, SGPU, IVA,
//   PVP da plataforma (preço total antes do desconto) e valor a pagar; nº da proposta, datas, código, cor e opcionais;
// - mostra tudo antes de preencher; modelo, cliente, nº e valor proposto só substituem o que já está escrito se o vendedor quiser;
// - avisa linhas que não reconhece, contas que não batem e propostas fora de validade; a margem fixa e a variável não vêm na proposta;
// - os campos preenchidos ficam marcados até serem mudados; o PDF é lido no browser (PDF.js alojado no site), sem pedidos para fora;
// - o NIF e o telemóvel do cliente não ficam guardados na ficha.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const RAIZ=path.resolve(path.dirname(process.argv[2]||path.join(__dirname,'..','index.html')));
const PORTA=8789;
const TIPOS={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.pdf':'application/pdf'};
const srv=http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const f=path.join(RAIZ,path.normalize(u));
  if(!f.startsWith(RAIZ)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
  s.writeHead(200,{'content-type':TIPOS[path.extname(f)]||'application/octet-stream'});s.end(fs.readFileSync(f));}).listen(PORTA);
const B=`http://localhost:${PORTA}/`;
// proposta inventada com a estrutura da plataforma (linhas com o valor à direita)
const lin=(a,v,ind)=>`<div class="l"${ind?' style="padding-left:12mm"':''}><span>${a}</span><span>${v==null?'':v}</span></div>`;
const cab='<div>Concessionário Motorrad</div>';
function proposta(o){return`<html><head><style>body{font-family:Arial;font-size:11px;margin:0}.pg{page-break-after:always;padding:10mm 15mm}.l{display:flex;justify-content:space-between;margin:3mm 0}.h{font-weight:bold;margin:6mm 0 2mm}</style></head><body>
<div class="pg">${cab}<div style="margin-top:8mm">${o.cliente}</div><div>Rua Inventada 1</div><div>Portugal</div>${lin('Nº Tlm. (Proprietário)','910000000')}${lin('Nº Contribuinte','999999990')}
<div class="l"><span class="h">A SUA PROPOSTA.</span><span>Data de impressão ${o.data}</span></div><div>Vendedor(a)</div><div>Vendedor Teste</div>${lin('','NºProposta '+o.n)}${lin('','Data de validade '+o.val)}</div>
<div class="pg">${cab}<div>NºProposta ${o.n}</div><div>Data de impressão ${o.data}</div><div class="h">RESUMO GERAL.</div><div>BMW ${o.modelo} (${o.cod}, ${o.data})</div>${lin('','Preço (IVA incl.) EUR')}
${o.resumo.map(x=>lin(x[0],x[1],x[2])).join('')}</div>
<div class="pg">${cab}<div>NºProposta ${o.n}</div><div class="h">MODELO.</div>${lin('Preço (IVA incl.) EUR','')}${lin(o.cod+' BMW '+o.modelo,o.resumo[0][1])}<div class="h">YOUR DESIGN.</div>${lin(o.cor,'0,00')}
<div class="h">PACKS &amp; EQUIPAMENTO.</div>${o.opc.map(x=>lin(x[0],x[1])).join('')}${lin('Total',o.resumo[1][1])}
<div class="h">SERVIÇO &amp; GARANTIA.</div>${o.serv.map(x=>lin(x[0],x[1])).join('')}<div class="h">DIVERSOS - OUTRAS DESPESAS.</div>${o.div.map(x=>lin(x[0],x[1])).join('')}<div>Página 4 de 6</div></div>
<div class="pg">${cab}<div class="h">DADOS TÉCNICOS.</div>${lin('Cilindrada','999 cm³')}</div></body></html>`;}
const A={cliente:'Cliente Ficticio',n:'9001',data:'01.11.2026',val:'31.12.2099',modelo:'M 1000 XR',cod:'0E91',cor:'P0N3H Light white/M Motorsport',
  resumo:[['Modelo','27.549,04'],['Equipamento opcional','-509,99'],['Desconto veículo',null],['Desconto','-1.624,40',1],['Serviço &amp; Garantia','1.590,00'],['Diversos - Outras Despesas','-155,60'],
    ['Preço total (impostos incl.)','26.850,00'],['ISV (1,18 %)','245,14',1],['SGPU','0,78',1],['IVA (23,00 %)','5.020,73',1],['Valor a pagar','26.850,00']],
  opc:[['S0ZA8 Oferta 5 Anos Garantia','-509,99']],serv:[['S07A2 Serviço manutenção 3/30','1.080,00'],['S07A8 5 anos garantia','509,99']],
  div:[['Oferta BMSI','-1.080,00'],['ECO EcoValor','1,90'],['TRA Transporte','922,50']]};
const Bp={cliente:'Outro Cliente',n:'9002',data:'02.01.2020',val:'01.02.2020',modelo:'R 1300 GS',cod:'0M21',cor:'P0ABC Triple Black',
  resumo:[['Modelo','21.359,04'],['Equipamento opcional','3.481,01'],['Serviço &amp; Garantia','240,00'],['Acessórios Originais','1.000,00'],['Retoma','-5.000,00'],['Diversos - Outras Despesas','1.062,55'],
    ['Preço total (impostos incl.)','22.143,56'],['ISV (1,18 %)','245,14',1],['SGPU','0,78',1],['IVA (23,00 %)','4.140,67',1],['Valor a pagar','22.143,56']],
  opc:[['S0AAA Pack Conforto','1.500,00'],['S0BBB Pack Touring','1.981,01']],serv:[['S07A2 Serviço manutenção 3/30','240,00']],
  div:[['ECO EcoValor','1,90'],['IUC Imposto Único de Circulação','138,15'],['TRA Transporte','922,50']]};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const g=await b.newPage();const pdfDe=async h=>{await g.setContent(h);return g.pdf({format:'A4',printBackground:true});};
  const pdfA=await pdfDe(proposta(A)),pdfB=await pdfDe(proposta(Bp)),pdfX=await pdfDe('<html><body><h1>Fatura qualquer</h1><p>Total 100,00</p></body></html>');
  const ctx=await b.newContext({viewport:{width:1280,height:1000}});const p=await ctx.newPage();
  const erros=[],fora=[],avisos=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith(B))return r.continue();fora.push(u);return r.fulfill({status:200,contentType:'application/json',body:'[]'});});
  await p.goto(B);await p.waitForTimeout(600);
  await p.evaluate(()=>{S.me={id:'v1',role:'vendedor',nome:'Vendedor Teste'};S.fm={natureza:'MN',iva:23,modo:'civa',fv:2,mg_fixa_pct:'6',mg_var_pct:'3.5',compart_conc:'275.12'};S.screen='ficha';S.fmNeg=null;render();});
  const ler=async(buf,nome)=>{await p.setInputFiles('#fm-prop-inp',{name:nome,mimeType:'application/pdf',buffer:buf});
    await p.waitForFunction(()=>S.fmProp||(!S.fmPropA&&document.querySelector('#bm-toast.show')),null,{timeout:20000});await p.waitForTimeout(150);};
  const tx=s=>String(s||'').replace(/[  ]/g,' ').replace(/\s+/g,' ').trim();
  const painel=()=>p.evaluate(()=>{const e=document.getElementById('fm-prop');return e?{h:e.querySelector('h2').textContent,linhas:[...e.querySelectorAll('tbody tr')].map(t=>t.textContent.replace(/[  ]/g,' ').replace(/\s+/g,' ').trim()),
    av:[...e.querySelectorAll('.fm-prop-av li')].map(l=>l.textContent),ops:[...e.querySelectorAll('[data-prop-op]')].map(i=>i.dataset.propOp+':'+i.checked),falta:!!e.querySelector('.fm-prop-falta'),foco:document.activeElement===e.querySelector('h2')}:null;});
  // 1. proposta A numa ficha vazia
  await ler(pdfA,'M_1000XR.pdf');const PA=await painel();await p.screenshot({path:path.join(__dirname,'proposta_bmw.png')});
  const antes=await p.evaluate(()=>S.fm.pvb||'');
  await p.click('[data-action="fm-prop-aplicar"]');await p.waitForTimeout(300);
  const FA=await p.evaluate(()=>{const c=fmCalc();return{fm:S.fm,dif:c.difPlat,marcas:[...document.querySelectorAll('.stock-inp.fm-pdf')].map(i=>i.dataset.fm),toast:(document.querySelector('#bm-toast .bm-toast-m')||{}).textContent,painel:!!document.getElementById('fm-prop')};});
  await p.screenshot({path:path.join(__dirname,'proposta_bmw_ficha.png')});
  await p.evaluate(()=>fmSet('pvb','27600'));await p.waitForTimeout(100);const marcaPvb=await p.evaluate(()=>!!document.querySelector('.stock-inp.fm-pdf[data-fm="pvb"]'));
  // 2. proposta B com a ficha já preenchida: valor proposto escrito não é substituído sem querer; linhas que não conhece; fora de validade
  await p.evaluate(()=>{S.fm=Object.assign({},S.fm,{preco_venda:'21000',modelo:'R 1300 GS Triple Black'});render();});
  await ler(pdfB,'R1300GS.pdf');const PB=await painel();
  await p.click('[data-action="fm-prop-aplicar"]');await p.waitForTimeout(300);const FB=await p.evaluate(()=>S.fm);
  // 3. cancelar e um PDF que não é proposta
  await ler(pdfA,'M_1000XR.pdf');await p.click('[data-action="fm-prop-cancelar"]');await p.waitForTimeout(100);const cancel=await p.evaluate(()=>({painel:!!document.getElementById('fm-prop'),pvb:S.fm.pvb}));
  await ler(pdfX,'fatura.pdf');const naoE=await p.evaluate(()=>({painel:!!S.fmProp,toast:(document.querySelector('#bm-toast .bm-toast-m')||{}).textContent}));
  // 4. telemóvel: o painel cabe sem scroll lateral
  await p.setViewportSize({width:390,height:844});await ler(pdfA,'M_1000XR.pdf');await p.evaluate(()=>{S.sidebarOpen=false;render();});
  const tel=await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);await p.screenshot({path:path.join(__dirname,'proposta_bmw_telemovel.png')});
  const R={PA,antes,FA:{dif:FA.dif,marcas:FA.marcas,toast:FA.toast,painel:FA.painel,fm:FA.fm},marcaPvb,PB,FB,cancel,naoE,tel,fora,erros};console.log(JSON.stringify(R,null,1));
  const f=FA.fm,pb=f.proposta_bmw||{};
  const ok={
   'mostra a proposta antes de preencher, com o foco no título':PA&&/Proposta 9001: M 1000 XR/.test(PA.h)&&PA.foco&&antes===''&&PA.av.length===0&&PA.falta===false,
   'lê o resumo como na plataforma':PA&&/^Modelo \(com IVA, inclui ISV\)M 1000 XR \(0E91\)—27 549,04 €$/.test(PA.linhas[0])&&/^Equipamento opcionalOferta 5 Anos Garantia—−509,99 €$/.test(PA.linhas[1])&&/^PACOferta BMSI—1 080,00 €$/.test(PA.linhas.find(l=>/^PAC/.test(l))||'')&&/^PVP da plataforma.*—28 474,40 €$/.test(PA.linhas[PA.linhas.length-1]),
   'ficha vazia: modelo, cliente, nº e valor proposto vêm marcados':PA&&JSON.stringify(PA.ops)===JSON.stringify(['modelo:true','cliente:true','proposta:true','preco_venda:true']),
   'preenche a ficha e o PVP bate com a plataforma':f.pvb==='27549.04'&&f.opc==='-509.99'&&f.bsi==='1590'&&f.ecovalor==='1.9'&&f.transporte==='922.5'&&f.pac==='1080'&&f.isv==='245.14'&&f.sgpu==='0.78'&&f.iva===23&&f.pvp_plat==='28474.4'&&f.preco_venda==='26850'&&Math.abs(FA.dif)<=0.05&&/o PVP bate com a plataforma/.test(FA.toast)&&!FA.painel,
   'texto da proposta na ficha; margens não mexem; nada do cliente além do nome':f.modelo==='M 1000 XR'&&f.cliente==='Cliente Ficticio'&&f.proposta==='9001'&&f.mg_fixa_pct==='6'&&f.mg_var_pct==='3.5'&&f.compart_conc==='275.12'&&!JSON.stringify(f).includes('999999990')&&!JSON.stringify(f).includes('910000000'),
   'guarda código, cor e opcionais da proposta':pb.n==='9001'&&pb.codigo==='0E91'&&pb.data==='2026-11-01'&&pb.validade==='2099-12-31'&&/Light white/.test(pb.cor)&&pb.opcionais.length===1&&pb.opcionais[0].c==='S0ZA8'&&pb.servico.length===2,
   'campos preenchidos marcados até serem mudados':['pvb','opc','bsi','ecovalor','transporte','pac','isv','sgpu','pvp_plat','preco_venda'].every(k=>FA.marcas.includes(k))&&!FA.marcas.includes('mg_fixa_pct')&&!marcaPvb,
   'ficha já escrita: valor proposto e modelo não são substituídos sem querer':PB&&PB.ops.includes('preco_venda:false')&&PB.ops.includes('modelo:false')&&FB.preco_venda==='21000'&&FB.modelo==='R 1300 GS Triple Black',
   'acessórios e IUC lidos; PAC limpo quando a proposta não tem':FB.acess_marca==='1000'&&FB.iuc_s==='138.15'&&FB.pac===''&&FB.pvb==='21359.04'&&FB.proposta_bmw.codigo==='0M21',
   'avisa linha desconhecida, contas que não batem e proposta fora de validade':PB&&PB.av.some(a=>/Retoma/.test(a))&&PB.av.some(a=>/não somam o preço total/.test(a))&&PB.av.some(a=>/fora de validade desde 01\/02\/2020/.test(a)),
   'cancelar não mexe na ficha':!cancel.painel&&cancel.pvb===FB.pvb,
   'um PDF que não é proposta é recusado':!naoE.painel&&/Não parece uma proposta/.test(naoE.toast||''),
   'telemóvel sem scroll lateral':tel,
   'lido no browser: o PDF não vai para fora (só a letra da app e a base de dados da app)':fora.filter(u=>!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)&&!/^https:\/\/fyieckrmdrorjoevmrhm\.supabase\.co\/rest\/v1\//.test(u)).length===0,
   'sem erros JS':!erros.length};
  let n=0;for(const [k,v] of Object.entries(ok)){console.log((v?'✓ ':'✗ ')+k);if(!v)n++;}
  console.log(n?`FALHOU (${n})`:'Proposta BMW correta');await b.close();srv.close();process.exit(n?1:0);})();
