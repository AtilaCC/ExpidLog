/* ════════════════════════════════════════════════════════════
   DOCKCHECK PRO — MOBILE JS · Fase 13 · Etapa 4

   Funcionalidades:
   1. Bottom Navigation Bar (5 tabs principais + menu "Mais")
   2. Swipe entre abas (gesture horizontal)
   3. Pull-to-Refresh
   4. Haptic feedback nas ações críticas
════════════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════════
   HAPTIC FEEDBACK — definido primeiro para estar disponível
════════════════════════════════════════════════════════════ */
function haptic(tipo = 'light') {
  if (!navigator.vibrate) return;
  switch (tipo) {
    case 'light':   navigator.vibrate(10);           break;
    case 'medium':  navigator.vibrate(25);           break;
    case 'heavy':   navigator.vibrate(50);           break;
    case 'success': navigator.vibrate([10, 50, 10]); break;
    case 'error':   navigator.vibrate([50, 30, 50]); break;
  }
}
window.haptic = haptic;

/* ── Só roda em mobile ──────────────────────────────────── */
if (window.innerWidth <= 768) {
  // Aguarda DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initMobile);
  } else {
    _initMobile();
  }
}

window.addEventListener('resize', () => {
  if (window.innerWidth <= 768 && !window._mobileInited) {
    _initMobile();
  }
});

/* ════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DAS ABAS
════════════════════════════════════════════════════════════ */

// Abas principais — aparecem na bottom nav
const TABS_PRINCIPAIS = [
  { id: 'conferencia', icon: '📦', label: 'Conf.' },
  { id: 'dashboard',   icon: '🖥',  label: 'Dash'  },
  { id: 'cloud',       icon: '📷',  label: 'OCR'   },
  { id: 'historico',   icon: '🕐',  label: 'Hist.' },
  { id: 'mais',        icon: '⋯',   label: 'Mais'  },
];

// Abas secundárias — aparecem no menu "Mais"
const TABS_SECUNDARIAS = [
  { id: 'analytics', icon: '📈', label: 'Analytics' },
  { id: 'equipes',   icon: '👥', label: 'Equipes'   },
  { id: 'relatorio', icon: '📊', label: 'Relatório' },
  { id: 'bi',        icon: '💼', label: 'BI'        },
  { id: 'ia',        icon: '🤖', label: 'IA'        },
  { id: 'multicd',   icon: '🏢', label: 'Multi-CD'  },
  { id: 'config',    icon: '⚙️', label: 'Config'    },
];

// Ordem de todas as abas para swipe
const TODAS_ABAS = [
  'conferencia', 'dashboard', 'cloud', 'historico',
  'analytics', 'equipes', 'relatorio', 'bi', 'ia', 'multicd', 'config'
];

let _abaAtual = 'conferencia';

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */
function _initMobile() {
  window._mobileInited = true;
  _criarBottomNav();
  _criarPTRIndicator();
  _initSwipe();
  _initPullToRefresh();
  console.info('[Mobile] Inicializado — bottom nav, swipe, PTR.');
}

/* ════════════════════════════════════════════════════════════
   BOTTOM NAVIGATION BAR
════════════════════════════════════════════════════════════ */
function _criarBottomNav() {
  if (document.getElementById('mobile-bottom-nav')) return;

  // Container principal
  const nav = document.createElement('div');
  nav.id = 'mobile-bottom-nav';

  TABS_PRINCIPAIS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'mbnav-btn';
    btn.dataset.tab = tab.id;
    btn.innerHTML = `
      <span class="mbnav-icon">${tab.icon}</span>
      <span class="mbnav-label">${tab.label}</span>
    `;

    if (tab.id === 'mais') {
      btn.onclick = _toggleMenuMais;
    } else {
      btn.onclick = () => {
        _fecharMenuMais();
        _navegarMobile(tab.id, btn);
      };
    }

    nav.appendChild(btn);
  });

  document.body.appendChild(nav);

  // Menu "Mais"
  const menu = document.createElement('div');
  menu.id = 'mbnav-mais-menu';

  TABS_SECUNDARIAS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'mbnav-extra-btn';
    btn.innerHTML = `
      <span class="mbnav-extra-icon">${tab.icon}</span>
      <span class="mbnav-extra-label">${tab.label}</span>
    `;
    btn.onclick = () => {
      _fecharMenuMais();
      _navegarMobile(tab.id, null);
      // Multi-CD precisa de init especial
      if (tab.id === 'multicd' && !window._mcInited) {
        window._mcInited = true;
        if (typeof multiCDInit === 'function') multiCDInit();
      }
    };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'mbnav-overlay';
  overlay.onclick = _fecharMenuMais;
  document.body.appendChild(overlay);

  // Marca a aba inicial como ativa
  _atualizarBottomNav('conferencia');
}

function _navegarMobile(tabId, btnClicado) {
  haptic('light');
  _abaAtual = tabId;

  // Chama o goTab original do app.js
  // Precisa encontrar o botão da nav original para manter compatibilidade
  const navBtns = document.querySelectorAll('.nav .ntab');
  let btnOriginal = null;
  navBtns.forEach(b => {
    if (b.getAttribute('onclick')?.includes(`'${tabId}'`)) {
      btnOriginal = b;
    }
  });

  if (typeof goTab === 'function' && btnOriginal) {
    goTab(tabId, btnOriginal);
  }

  _atualizarBottomNav(tabId);

  // Animação de slide
  const tabEl = document.getElementById('tab-' + tabId);
  if (tabEl) {
    tabEl.classList.remove('tab-slide-in-right', 'tab-slide-in-left');
    void tabEl.offsetWidth; // reflow
    tabEl.classList.add('tab-slide-in-right');
  }
}

function _atualizarBottomNav(tabId) {
  document.querySelectorAll('.mbnav-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.tab === tabId);
  });
}

function _toggleMenuMais() {
  const menu    = document.getElementById('mbnav-mais-menu');
  const overlay = document.getElementById('mbnav-overlay');
  const isOpen  = menu?.classList.contains('open');

  if (isOpen) {
    _fecharMenuMais();
  } else {
    menu?.classList.add('open');
    overlay?.classList.add('open');
    haptic('light');
  }
}

function _fecharMenuMais() {
  document.getElementById('mbnav-mais-menu')?.classList.remove('open');
  document.getElementById('mbnav-overlay')?.classList.remove('open');
}

/* ════════════════════════════════════════════════════════════
   SWIPE ENTRE ABAS
════════════════════════════════════════════════════════════ */
let _swipeStartX  = 0;
let _swipeStartY  = 0;
let _swipeAtivo   = false;

function _initSwipe() {
  document.addEventListener('touchstart', e => {
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
    _swipeAtivo  = true;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!_swipeAtivo) return;
    _swipeAtivo = false;

    const dx = e.changedTouches[0].clientX - _swipeStartX;
    const dy = e.changedTouches[0].clientY - _swipeStartY;

    // Só processa swipe horizontal significativo (> 60px) e mais horizontal que vertical
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;

    // Não fazer swipe se menu mais estiver aberto
    if (document.getElementById('mbnav-mais-menu')?.classList.contains('open')) return;

    const idx = TODAS_ABAS.indexOf(_abaAtual);
    if (dx < 0 && idx < TODAS_ABAS.length - 1) {
      // Swipe esquerda → próxima aba
      _navegarMobile(TODAS_ABAS[idx + 1], null);
    } else if (dx > 0 && idx > 0) {
      // Swipe direita → aba anterior
      _navegarMobile(TODAS_ABAS[idx - 1], null);
    }
  }, { passive: true });
}

/* ════════════════════════════════════════════════════════════
   PULL-TO-REFRESH
════════════════════════════════════════════════════════════ */
let _ptrStartY   = 0;
let _ptrPuxando  = false;
let _ptrAtivado  = false;
const PTR_THRESHOLD = 80; // px necessários para ativar

function _criarPTRIndicator() {
  if (document.getElementById('ptr-indicator')) return;
  const el = document.createElement('div');
  el.id = 'ptr-indicator';
  el.innerHTML = `<span class="ptr-arrow">↓</span> <span id="ptr-txt">Puxe para atualizar</span>`;
  document.body.insertBefore(el, document.body.firstChild.nextSibling);
}

function _initPullToRefresh() {
  document.addEventListener('touchstart', e => {
    // Só ativa se estiver no topo da página
    if (window.scrollY === 0) {
      _ptrStartY  = e.touches[0].clientY;
      _ptrPuxando = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!_ptrPuxando) return;
    const dy = e.touches[0].clientY - _ptrStartY;
    if (dy < 0) { _ptrPuxando = false; return; }

    const indicator = document.getElementById('ptr-indicator');
    if (dy > 20) {
      indicator?.classList.add('visible');
      const txt = document.getElementById('ptr-txt');
      if (dy > PTR_THRESHOLD) {
        _ptrAtivado = true;
        if (txt) txt.textContent = 'Solte para atualizar';
        indicator?.classList.add('refreshing');
      } else {
        _ptrAtivado = false;
        if (txt) txt.textContent = 'Puxe para atualizar';
        indicator?.classList.remove('refreshing');
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!_ptrPuxando) return;
    _ptrPuxando = false;

    if (_ptrAtivado) {
      _ptrAtivado = false;
      haptic('medium');
      _executarRefresh();
    } else {
      document.getElementById('ptr-indicator')?.classList.remove('visible', 'refreshing');
    }
  }, { passive: true });
}

function _executarRefresh() {
  const txt = document.getElementById('ptr-txt');
  if (txt) txt.textContent = 'Atualizando...';

  // Chama a função de refresh da aba atual
  try {
    switch (_abaAtual) {
      case 'dashboard':  if (typeof renderDashboard === 'function')  renderDashboard();  break;
      case 'conferencia': if (typeof updateLiveStrip === 'function') updateLiveStrip();  break;
      case 'historico':  if (typeof renderHist === 'function')       renderHist();       break;
      case 'analytics':  if (typeof renderAnalytics === 'function')  renderAnalytics();  break;
      case 'relatorio':  if (typeof renderRelatorio === 'function')  renderRelatorio();  break;
      default: break;
    }
    if (typeof toast === 'function') toast('🔄 Dados atualizados');
  } catch (e) {
    console.warn('[PTR] Erro ao atualizar:', e);
  }

  setTimeout(() => {
    document.getElementById('ptr-indicator')?.classList.remove('visible', 'refreshing');
  }, 800);
}

// Expõe globalmente para uso em outros módulos (já definido no início)
// window.haptic = haptic;
