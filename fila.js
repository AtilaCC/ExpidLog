/**
 * fila.js — DockCheck v2
 * Sistema de fila automática de OCs por doca.
 * Detecta OCs pendentes, avança automaticamente após cada conferência.
 * Depende de: storage.js, utils.js
 */

'use strict';

/**
 * Estado da fila por doca.
 * Estrutura: { [doca]: { ocs: string[], indiceAtual: number } }
 */
let filaDocas = {};

/**
 * Constrói ou atualiza a fila de OCs para uma doca.
 * Consulta ocrRows (tabela carregada) e historico (já conferidas hoje).
 * @param {string} doca
 * @returns {{ linhas: Object[], feitas: Set<string>, proxima: Object|null }}
 */
function construirFilaDoca(doca) {
  const hoje  = new Date().toISOString().slice(0, 10);
  const linhas = ocrRows.filter(r => r.doca?.trim() === doca);

  // OCs já conferidas hoje nesta doca
  const feitas = new Set(
    historico
      .filter(h =>
        h.tipo === 'conferencia' &&
        h.doca?.trim() === doca &&
        h.data?.slice(0, 10) === hoje
      )
      .map(h => h.oc?.trim())
  );

  // Inicializa ou atualiza estrutura da fila
  if (!filaDocas[doca]) {
    filaDocas[doca] = { ocs: linhas.map(r => r.oc?.trim()), indiceAtual: 0 };
  } else {
    filaDocas[doca].ocs = linhas.map(r => r.oc?.trim());
  }

  // Avança para a primeira OC não conferida
  const idxProxima = linhas.findIndex(r => !feitas.has(r.oc?.trim()));
  filaDocas[doca].indiceAtual = idxProxima >= 0 ? idxProxima : linhas.length;

  return {
    linhas,
    feitas,
    proxima: idxProxima >= 0 ? linhas[idxProxima] : null
  };
}

/**
 * Atualiza o painel de status da fila na aba Conferência.
 * Exibe progresso de OCs (pontinhos) e contagem pendente/total.
 * @param {string} doca
 * @param {Object[]} linhas — todas as OCs da doca
 * @param {Set<string>} feitas — OCs já conferidas
 */
function atualizarFilaStatus(doca, linhas, feitas) {
  const el    = document.getElementById('fila-status');
  const prog  = document.getElementById('oc-progress');
  const label = document.getElementById('fila-label');

  if (!linhas.length) {
    if (el) el.style.display = 'none';
    return;
  }

  if (el) el.style.display = 'flex';

  const pendentes = linhas.length - feitas.size;

  if (label) {
    label.textContent =
      `${feitas.size}/${linhas.length} OC${linhas.length > 1 ? 's' : ''} ` +
      `conferida${feitas.size !== 1 ? 's' : ''} • ` +
      `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
  }

  // Pontinhos de progresso — verde=feita, laranja=ativa, cinza=pendente
  if (prog) {
    const idxAtual = filaDocas[doca]?.indiceAtual ?? 0;
    prog.innerHTML = linhas.map((r, i) => {
      const feita = feitas.has(r.oc?.trim());
      const ativa = !feita && i === idxAtual;
      const cls   = feita ? 'done' : ativa ? 'active' : 'pending';
      return `<div class="oc-pip ${cls}" title="OC ${r.oc || '?'}"></div>`;
    }).join('');
  }
}
