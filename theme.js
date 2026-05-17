/* ════════════════════════════════════════════════════════════
   DOCKCHECK PRO — THEME MANAGER · Fase 13 · Etapa Final
   Dark Mode / Light Mode com persistência e troca instantânea
════════════════════════════════════════════════════════════ */

'use strict';

/* ── Tema ativo ─────────────────────────────────────────── */
let _theme = localStorage.getItem('dc_theme') || 'dark';

/* ════════════════════════════════════════════════════════════
   VARIÁVEIS CSS — Light Mode
   Sobrescreve as variáveis do :root quando tema = claro.
════════════════════════════════════════════════════════════ */
const LIGHT_VARS = `
  --bg:    #f1f5f9;
  --surf:  #ffffff;
  --surf2: #f8fafc;
  --surf3: #f1f5f9;
  --bord:  #e2e8f0;
  --bord2: #cbd5e1;
  --txt:   #0f172a;
  --txt2:  #475569;
  --mut:   #94a3b8;
  --shadow: 0 4px 24px rgba(0,0,0,.08);
  --glow-acc: 0 0 20px rgba(245,158,11,.15);
`;

const DARK_VARS = `
  --bg:    #0d1017;
  --surf:  #13171f;
  --surf2: #1a1f2e;
  --surf3: #202535;
  --bord:  #252c3d;
  --bord2: #2e3650;
  --txt:   #e2e8f0;
  --txt2:  #94a3b8;
  --mut:   #4a5568;
  --shadow: 0 4px 24px rgba(0,0,0,.4);
  --glow-acc: 0 0 20px rgba(245,158,11,.2);
`;

/* ════════════════════════════════════════════════════════════
   APLICAR TEMA
════════════════════════════════════════════════════════════ */

function _aplicarTema(tema) {
  // Remove style antigo
  const old = document.getElementById('dc-theme-vars');
  if (old) old.remove();

  const style = document.createElement('style');
  style.id = 'dc-theme-vars';

  if (tema === 'light') {
    style.textContent = `:root { ${LIGHT_VARS} }`;
    document.documentElement.setAttribute('data-theme', 'light');
    // Atualiza theme-color da meta tag
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = '#f1f5f9';
    document.body.style.colorScheme = 'light';
  } else {
    style.textContent = `:root { ${DARK_VARS} }`;
    document.documentElement.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = '#111318';
    document.body.style.colorScheme = 'dark';
  }

  document.head.appendChild(style);

  // Atualiza botões de seleção no config
  _atualizarUI();
}

/* ════════════════════════════════════════════════════════════
   API PÚBLICA
════════════════════════════════════════════════════════════ */

/**
 * Retorna o tema ativo: 'dark' | 'light'
 */
function getTheme() { return _theme; }

/**
 * Define o tema e persiste.
 * @param {'dark'|'light'} tema
 */
function setTheme(tema) {
  _theme = tema;
  localStorage.setItem('dc_theme', tema);

  // Animação suave de transição
  document.body.style.transition = 'background .3s, color .3s';
  _aplicarTema(tema);
  setTimeout(() => { document.body.style.transition = ''; }, 400);

  if (typeof toast === 'function') {
    const msg = tema === 'light' ? '☀️ Tema claro ativado' : '🌙 Tema escuro ativado';
    toast(msg);
  }
}

/**
 * Alterna entre dark e light.
 */
function toggleTheme() {
  setTheme(_theme === 'dark' ? 'light' : 'dark');
}

/* ════════════════════════════════════════════════════════════
   ATUALIZAR UI DO SELETOR NO CONFIG
════════════════════════════════════════════════════════════ */
function _atualizarUI() {
  const btnDark  = document.getElementById('theme-btn-dark');
  const btnLight = document.getElementById('theme-btn-light');
  if (!btnDark || !btnLight) return;

  btnDark.classList.toggle('theme-btn-active',  _theme === 'dark');
  btnLight.classList.toggle('theme-btn-active', _theme === 'light');
}

/* ════════════════════════════════════════════════════════════
   ESTILOS DO SELETOR (injetado inline para evitar dependência)
════════════════════════════════════════════════════════════ */
function _injetarEstilosSeletor() {
  if (document.getElementById('dc-theme-select-style')) return;
  const s = document.createElement('style');
  s.id = 'dc-theme-select-style';
  s.textContent = `
    .theme-selector {
      display: flex;
      gap: 8px;
    }
    .theme-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1.5px solid var(--bord);
      background: var(--surf2);
      color: var(--txt2);
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: .3px;
      cursor: pointer;
      transition: all .2s;
    }
    .theme-btn:hover {
      border-color: var(--acc);
      color: var(--txt);
    }
    .theme-btn-active {
      border-color: var(--acc) !important;
      background: var(--acc-dim) !important;
      color: var(--acc) !important;
    }

    /* Light mode — ajustes específicos */
    [data-theme="light"] .topbar,
    [data-theme="light"] .nav,
    [data-theme="light"] .live-strip {
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    [data-theme="light"] .card {
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    [data-theme="light"] .fg input,
    [data-theme="light"] .fg select,
    [data-theme="light"] .fg textarea {
      background: #fff;
      border-color: var(--bord2);
      color: var(--txt);
    }
    [data-theme="light"] .fg select option {
      background: #fff;
      color: #0f172a;
    }
    [data-theme="light"] .btn-ghost {
      background: #fff;
    }
    [data-theme="light"] .an-select option,
    [data-theme="light"] .an-select {
      background: #fff;
      color: #0f172a;
    }
    [data-theme="light"] #mobile-bottom-nav {
      background: #ffffff;
      border-top: 1px solid var(--bord);
    }
    [data-theme="light"] #mbnav-mais-menu {
      background: #f8fafc;
      border-color: var(--bord);
    }
    [data-theme="light"] .mbnav-extra-btn {
      background: rgba(0,0,0,.03);
      border-color: var(--bord);
    }
  `;
  document.head.appendChild(s);
}

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO — aplica tema salvo imediatamente
   (chamado antes do DOMContentLoaded para evitar flash)
════════════════════════════════════════════════════════════ */
_injetarEstilosSeletor();
_aplicarTema(_theme);

window.getTheme    = getTheme;
window.setTheme    = setTheme;
window.toggleTheme = toggleTheme;
