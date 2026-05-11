/**
 * connectivity.js — DockCheck v2 · Fase 3
 *
 * Responsabilidades:
 *  1. Detectar estado de conexão (online/offline) em tempo real
 *  2. Exibir indicador visual no topo do app
 *  3. Receber mensagem do SW quando há nova versão disponível
 *  4. Exibir banner "Atualizar" e aplicar update sem perder dados
 *
 * Não depende de outros módulos (carregado antes de app.js).
 * Expõe: isOnline() para uso por outros módulos.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   ESTADO DE CONECTIVIDADE
════════════════════════════════════════════════════════════ */

let _online = navigator.onLine;

/**
 * Retorna true se o dispositivo está online.
 * Usado por whatsapp.js e ocr.js para feedback ao operador.
 * @returns {boolean}
 */
function isOnline() { return _online; }

/* ════════════════════════════════════════════════════════════
   INDICADOR VISUAL DE CONECTIVIDADE
════════════════════════════════════════════════════════════ */

/**
 * Injeta o elemento de indicador de conectividade na topbar.
 * Chamado uma vez no init.
 */
function _injetarIndicador() {
  // Evita duplicar se já existir
  if (document.getElementById('conn-indicator')) return;

  const el = document.createElement('div');
  el.id = 'conn-indicator';
  el.style.cssText = `
    display:none;
    align-items:center;
    gap:5px;
    font-family:'Barlow Condensed',sans-serif;
    font-size:12px;
    font-weight:700;
    letter-spacing:.5px;
    padding:4px 10px;
    border-radius:20px;
    border:1px solid;
    white-space:nowrap;
    transition:all .3s;
  `;

  // Insere na topbar-right, antes do relógio
  const target = document.querySelector('.topbar-right');
  if (target) target.prepend(el);
}

/**
 * Atualiza o indicador visual com o estado atual.
 * @param {boolean} online
 */
function _atualizarIndicador(online) {
  const el = document.getElementById('conn-indicator');
  if (!el) return;

  if (online) {
    // Mostra "online" por 3s depois some (estado normal)
    el.style.display      = 'flex';
    el.style.color        = 'var(--grn)';
    el.style.borderColor  = 'rgba(16,185,129,.4)';
    el.style.background   = 'rgba(16,185,129,.1)';
    el.innerHTML          = '📶 Online';
    setTimeout(() => { if (_online) el.style.display = 'none'; }, 3000);
  } else {
    // Offline — fica visível até reconectar
    el.style.display      = 'flex';
    el.style.color        = 'var(--acc)';
    el.style.borderColor  = 'rgba(245,158,11,.4)';
    el.style.background   = 'rgba(245,158,11,.1)';
    el.innerHTML          = '📵 Offline';
  }
}

/* ════════════════════════════════════════════════════════════
   BANNER DE ATUALIZAÇÃO DISPONÍVEL
════════════════════════════════════════════════════════════ */

/**
 * Exibe banner no topo informando nova versão disponível.
 * O operador decide quando atualizar — não interrompe operação.
 * @param {number} version — nova versão do SW
 */
function _exibirBannerAtualizacao(version) {
  // Evita duplicar
  if (document.getElementById('update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = `
    background:linear-gradient(135deg,#1a1f2e,rgba(245,158,11,.15));
    border-bottom:1px solid rgba(245,158,11,.4);
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding:10px 16px;
    font-size:13px;
    font-weight:600;
    color:var(--acc);
    flex-wrap:wrap;
    animation:fadeUp .3s ease;
  `;
  banner.innerHTML = `
    <span>🆕 Nova versão disponível (v${version})</span>
    <div style="display:flex;gap:8px">
      <button
        onclick="aplicarAtualizacao()"
        style="background:var(--acc);color:#111;border:none;border-radius:6px;
               padding:6px 14px;font-family:'Barlow Condensed',sans-serif;
               font-size:14px;font-weight:700;cursor:pointer;">
        ↻ Atualizar agora
      </button>
      <button
        onclick="document.getElementById('update-banner').remove()"
        style="background:none;border:1px solid rgba(245,158,11,.3);color:var(--mut);
               border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;">
        Depois
      </button>
    </div>
  `;

  // Insere após a topbar
  const topbar = document.querySelector('.topbar');
  if (topbar) topbar.after(banner);
}

/**
 * Envia SKIP_WAITING para o SW e recarrega a página.
 * Chamado quando o operador toca em "Atualizar agora".
 * O reload preserva todos os dados (estão no IndexedDB).
 */
function aplicarAtualizacao() {
  if (!navigator.serviceWorker.controller) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  // Aguarda o SW ativar e recarrega
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  }, { once: true });
}

/* ════════════════════════════════════════════════════════════
   COMUNICAÇÃO COM O SERVICE WORKER
════════════════════════════════════════════════════════════ */

/**
 * Registra listener para mensagens do SW.
 * O SW envia SW_UPDATE_AVAILABLE quando detecta novo conteúdo.
 */
function _escutarSW() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', event => {
    const { type, version } = event.data || {};

    if (type === 'SW_UPDATE_AVAILABLE') {
      console.info('[Connectivity] Nova versão disponível:', version);
      _exibirBannerAtualizacao(version);
    }

    if (type === 'SW_VERSION') {
      console.info('[Connectivity] SW versão atual:', version);
    }
  });

  // Detecta quando um novo SW assume o controle (após SKIP_WAITING)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.info('[Connectivity] Novo SW assumiu o controle.');
  });
}

/**
 * Verifica se há uma atualização do SW esperando para ser ativada.
 * Chamado após o registro do SW em app.js.
 */
async function verificarAtualizacaoSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('./sw.js');
    if (reg?.waiting) {
      // Já há um SW aguardando — pode ter sido instalado antes
      _exibirBannerAtualizacao('nova');
    }
  } catch (e) {
    console.warn('[Connectivity] Erro ao verificar SW:', e);
  }
}

/* ════════════════════════════════════════════════════════════
   EVENTOS DE CONECTIVIDADE
════════════════════════════════════════════════════════════ */

window.addEventListener('online', () => {
  _online = true;
  _atualizarIndicador(true);
  toast('📶 Conexão restaurada');
  console.info('[Connectivity] Online.');
});

window.addEventListener('offline', () => {
  _online = false;
  _atualizarIndicador(false);
  toast('📵 Sem conexão — operação offline ativa');
  console.info('[Connectivity] Offline.');
});

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   Chamada automaticamente ao carregar o script.
   Não depende de init() do app.js.
════════════════════════════════════════════════════════════ */

(function _initConnectivity() {
  // Injeta indicador assim que o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      _injetarIndicador();
      // Mostra estado offline imediatamente se já estiver sem conexão
      if (!_online) _atualizarIndicador(false);
    });
  } else {
    _injetarIndicador();
    if (!_online) _atualizarIndicador(false);
  }

  // Começa a escutar mensagens do SW
  _escutarSW();
})();
