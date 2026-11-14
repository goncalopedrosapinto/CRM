// Avisos dentro da página (desde 2026-11-14 a Bimby já não usa alert/confirm do browser).
// ligarAvisos(p, lista, {aceitar, anularMs}) faz, para os testes, o papel do antigo p.on('dialog'):
//  - cada pergunta (#cf-msg) e cada aviso de erro (toast com role=alert) entra em `lista`
//    (as perguntas com o prefixo «?» se opt.marcar);
//  - as perguntas são aceites (aceitar:true, por omissão) ou recusadas (aceitar:false) sozinhas;
//  - erros:false deixa de fora os avisos de erro (só as perguntas contam);
//  - o tempo do «Anular» ao apagar desce para anularMs (300 ms por omissão), para o teste não esperar 5 s.
// Tem de ser chamado antes do p.goto.
module.exports.ligarAvisos = async function (p, lista, opt) {
  opt = Object.assign({ aceitar: true, anularMs: 300, marcar: false, erros: true }, opt || {});
  await p.exposeFunction('__avisoTeste', (tipo, msg) => { if (tipo === 'erro' && !opt.erros) return; if (lista) lista.push((opt.marcar && tipo === 'pergunta' ? '?' : '') + msg); });
  await p.addInitScript(o => {
    let ultimo = '';
    const ver = () => {
      const m = document.getElementById('cf-msg');
      if (m && !m.dataset.visto) {
        m.dataset.visto = '1'; window.__avisoTeste('pergunta', m.innerText);
        if (o.aceitar !== null) { const b = document.getElementById(o.aceitar ? 'cf-ok' : 'cf-nao'); if (b) setTimeout(() => b.click(), 0); }
      }
      const t = document.getElementById('bm-toast');
      if (t && t.getAttribute('role') === 'alert' && /\bshow\b/.test(t.className)) {
        const x = (t.querySelector('.bm-toast-m') || t).innerText;
        if (x !== ultimo) { ultimo = x; window.__avisoTeste('erro', x); }
      } else ultimo = '';
    };
    const arranca = () => {
      try { ANULAR_MS = o.anularMs; } catch (e) {}
      new MutationObserver(ver).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'role'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arranca); else arranca();
  }, { aceitar: opt.aceitar, anularMs: opt.anularMs });
};
