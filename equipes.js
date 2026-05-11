/**
 * equipes.js — DockCheck v2
 * Gerenciamento de equipes: CRUD, renderização, modal.
 * Depende de: storage.js, utils.js
 */

'use strict';

/* ── Persistência ── */
function saveEq() {
  storage.set(K_EQ, equipes);
}

/* ── Modal ── */

/**
 * Abre o modal de criação/edição de equipe.
 * @param {string} [id] — se informado, carrega equipe existente para edição
 */
function abrirModalEq(id) {
  const eq = id ? equipes.find(e => e.id === id) : {};
  document.getElementById('eq-titulo').textContent = id ? 'Editar Equipe' : 'Nova Equipe';
  document.getElementById('eq-id').value           = id || '';
  document.getElementById('eq-conf').value          = eq?.conf || '';
  document.getElementById('eq-aux1').value          = eq?.aux1 || '';
  document.getElementById('eq-aux2').value          = eq?.aux2 || '';
  document.getElementById('eq-docas').value         = (eq?.docas || []).join(', ');
  document.getElementById('eq-status').value        = eq?.status || 'ativa';
  document.getElementById('ov-eq').classList.add('on');
}

function fecharModalEq() {
  document.getElementById('ov-eq').classList.remove('on');
}

/* ── CRUD ── */

/**
 * Salva ou atualiza uma equipe a partir dos dados do modal.
 * Valida campos obrigatórios antes de salvar.
 */
function salvarEquipe() {
  const conf = document.getElementById('eq-conf').value.trim();
  const ds   = document.getElementById('eq-docas').value.trim();

  if (!conf || !ds) {
    toast('Preencha conferente e docas!');
    return;
  }

  const id = document.getElementById('eq-id').value || crypto.randomUUID();
  const eq = {
    id,
    conf,
    aux1:   document.getElementById('eq-aux1').value.trim(),
    aux2:   document.getElementById('eq-aux2').value.trim(),
    docas:  ds.split(',').map(d => d.trim()).filter(Boolean),
    status: document.getElementById('eq-status').value
  };

  const idx = equipes.findIndex(e => e.id === id);
  if (idx >= 0) equipes[idx] = eq;
  else          equipes.push(eq);

  saveEq();
  renderEquipes();
  fecharModalEq();
  toast('Equipe salva!');
}

/**
 * Remove uma equipe após confirmação.
 * @param {string} id
 */
function delEq(id) {
  if (!confirm('Remover esta equipe?')) return;
  equipes = equipes.filter(e => e.id !== id);
  saveEq();
  renderEquipes();
  toast('Removida.');
}

/* ── Render ── */

/**
 * Renderiza a lista de equipes na aba Equipes.
 */
function renderEquipes() {
  const el = document.getElementById('lista-eq');
  if (!el) return;

  if (!equipes.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">👥</div><p>Nenhuma equipe.</p></div>';
    return;
  }

  el.innerHTML = equipes.map(eq => `
    <div class="eqcard">
      <div>
        <h4>
          ${eq.conf}
          <span class="badge ${eq.status === 'ativa' ? 'b-ok' : 'b-err'}">${eq.status}</span>
        </h4>
        <p>${[eq.aux1, eq.aux2].filter(Boolean).join(' · ') || 'Sem auxiliares'}</p>
        <div class="dtags">
          ${eq.docas.map(d => `<span class="dtag">${d}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="abrirModalEq('${eq.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="delEq('${eq.id}')">🗑</button>
      </div>
    </div>`).join('');
}

/* ── Dados de teste ── */

/**
 * Restaura as equipes de teste (desenvolvimento/demonstração).
 */
function resetEqTeste() {
  equipes = EQUIPES_TESTE;
  storage.set(K_EQ, equipes);
  renderEquipes();
  toast('Equipes restauradas!');
}
