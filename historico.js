/**
 * historico.js — DockCheck v2
 * Persistência, renderização e ações do histórico de conferências.
 * Depende de: storage.js, utils.js
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   PERSISTÊNCIA
════════════════════════════════════════════════════════════ */

/**
 * Salva o array `historico` no storage.
 * Chamado sempre que o histórico é modificado.
 */
function saveHist() {
  storage.set(K_HIST, historico);
}

/**
 * Limpa todo o histórico após confirmação do operador.
 */
function limparHist() {
  if (!confirm('Limpar todo o histórico?')) return;
  historico = [];
  saveHist();
  renderHist();
  updateLiveStrip();
}

/* ════════════════════════════════════════════════════════════
   RENDERIZAÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Renderiza a lista de registros do histórico.
 * Suporta tanto registros de conferência quanto de importação de tabela.
 * Compatível com formato antigo (foto singular) e novo (fotos plural).
 */
function renderHist() {
  const el = document.getElementById('lista-hist');
  if (!el) return;

  if (!historico.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><p>Nenhum registro.</p></div>';
    return;
  }

  el.innerHTML = historico.map(h => {
    const d      = new Date(h.data);
    const ds     = d.toLocaleDateString('pt-BR') + ' ' +
                   d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Compatibilidade: registros antigos usavam h.foto (singular)
    const fotos  = h.fotos || (h.foto ? [h.foto] : []);
    const thumb  = fotos.length
      ? `<img src="${fotos[0]}">`
      : `<span>${h.tipo === 'tabela' ? '📄' : '📦'}</span>`;
    const qtd    = fotos.length > 1
      ? `<span class="badge b-ok" style="margin-left:4px">+${fotos.length} fotos</span>`
      : '';

    // Duração: prefere cronômetro real, fallback para horário
    const dur    = h.duracaoSeg
      ? ` · ⏱ ${_fmtSec(h.duracaoSeg)}`
      : (h.hora ? ` · ${h.hora}` : '');

    return `<div class="hitem">
      <div class="hthumb">${thumb}</div>
      <div class="hbody">
        <div class="hmeta">${ds}${dur} · ${h.tipo === 'tabela' ? 'Importação' : 'Conferência'}</div>
        <div class="htitle">
          ${h.tipo === 'tabela'
            ? `Tabela — ${h.rows?.length || 0} linhas`
            : `Doca ${h.doca || '?'} · OC ${h.oc || '?'} · ${h.conf || '?'}`
          }${qtd}
        </div>
        ${h.rota ? `<div style="font-size:12px;color:var(--mut)">${h.rota}${h.transportadora ? ' · ' + h.transportadora : ''}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          ${h.mensagem ? `<button class="btn btn-ghost btn-sm" onclick="copiarHist('${h.id}')">📋 Copiar</button>` : ''}
          ${fotos.length ? `<button class="btn btn-ghost btn-sm" onclick="verFotos('${h.id}')">📷 Ver fotos</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   AÇÕES
════════════════════════════════════════════════════════════ */

/**
 * Copia a mensagem de um registro do histórico para o clipboard.
 * @param {string} id
 */
function copiarHist(id) {
  const h = historico.find(x => x.id === id);
  if (h?.mensagem) {
    navigator.clipboard.writeText(h.mensagem).then(() => toast('Copiado!'));
  }
}

/**
 * Abre uma nova aba com todas as fotos de um registro.
 * @param {string} id
 */
function verFotos(id) {
  const h     = historico.find(x => x.id === id);
  const fotos = h?.fotos || (h?.foto ? [h.foto] : []);
  if (!fotos.length) return;

  const w = window.open('');
  w.document.write(`
    <html><body style="background:#111;margin:0;padding:10px;display:flex;flex-direction:column;gap:10px">
      ${fotos.map((f, i) => `
        <div style="color:#aaa;font-size:12px;margin-bottom:2px">Foto ${i + 1}</div>
        <img src="${f}" style="max-width:100%;border-radius:8px">
      `).join('')}
    </body></html>
  `);
}
