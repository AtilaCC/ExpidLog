/**
 * desktop.js — DockCheck PRO · Fase 15
 * Torre de Controle Enterprise — Interatividade Desktop
 *
 * Funcionalidades:
 *  - Sidebar de navegação (1024px+) sincronizada com goTab()
 *  - Command Bar com status em tempo real
 *  - Modo TV com ticker operacional e rotação de painéis
 *  - Wrapper #app-root / #app-content injetado automaticamente
 *  - Sparklines nos KPI cards do dashboard
 *  - Atalhos de teclado (1-9 para abas, T para TV, ESC sai TV)
 *  - Detecção de breakpoint reativa (ResizeObserver)
 *
 * Posição no index.html: último <script> antes de app.js
 * NÃO altera nenhuma função existente — apenas adiciona camadas.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONFIGURAÇÃO
════════════════════════════════════════════════════════════ */

const DC_DESKTOP = {
  BREAKPOINT_TABLET:  768,
  BREAKPOINT_DESKTOP: 1024,
  BREAKPOINT_WIDE:    1440,
  BREAKPOINT_ULTRA:   1920,
  TV_ROTATE_MS:       25000,  // rotação automática de painéis no TV
  COMMAND_REFRESH_MS: 5000,   // atualização da command bar
};

/* Abas — configuração da sidebar */
const DC_TABS = [
  { id: 'dashboard',  icon: '🖥',  label: 'Dashboard',   group: 'operacional', key: '1' },
  { id: 'conferencia',icon: '📦',  label: 'Conferência', group: 'operacional', key: '2' },
  { id: 'cloud',      icon: '📷',  label: 'Ler Tabela',  group: 'operacional', key: '3' },
  { id: 'analytics',  icon: '📈',  label: 'Analytics',   group: 'inteligencia', key: '4' },
  { id: 'bi',         icon: '💼',  label: 'BI',          group: 'inteligencia', key: '5' },
  { id: 'ia',         icon: '🤖',  label: 'IA',          group: 'inteligencia', key: '6' },
  { id: 'ia-auto',    icon: '🧠',  label: 'IA Auto',     group: 'inteligencia', key: '7', badge: 'ia-auto-badge', extraFn: 'iaAutonoRender' },
  { id: 'automacao',  icon: '⚡',  label: 'Automação',   group: 'inteligencia', key: '8', badge: 'auto-badge', extraFn: 'automacaoRender' },
  { id: 'multicd',    icon: '🏢',  label: 'Multi-CD',    group: 'gestao' },
  { id: 'equipes',    icon: '👥',  label: 'Equipes',     group: 'gestao' },
  { id: 'historico',  icon: '🕐',  label: 'Histórico',   group: 'gestao' },
  { id: 'relatorio',  icon: '📊',  label: 'Relatório',   group: 'gestao' },
  { id: 'config',     icon: '⚙️',  label: 'Config',      group: 'sistema' },
];

const DC_GROUPS = {
  operacional:   '📡 Operacional',
  inteligencia:  '🧠 Inteligência',
  gestao:        '📁 Gestão',
  sistema:       '⚙️ Sistema',
};

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */

const _DC = {
  tabAtual:       'conferencia',
  tvAtivo:        false,
  tvRotateTimer:  null,
  tvRotateIdx:    0,
  tvPaineis:      ['dashboard', 'analytics', 'bi'],
  commandTimer:   null,
  isDesktop:      false,
  sparkData:      {},   // histórico para sparklines
};

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

function desktopInit() {
  _dcInjetarEstrutura();
  _dcCriarSidebar();
  _dcCriarCommandBar();
  _dcCriarTVTicker();
  _dcDetectarBreakpoint();
  _dcIniciarCommandBar();
  _dcRegistrarTeclado();
  _dcPatchGoTab();

  // ResizeObserver para reatividade
  if (window.ResizeObserver) {
    new ResizeObserver(_dcDetectarBreakpoint).observe(document.body);
  } else {
    window.addEventListener('resize', _dcDetectarBreakpoint);
  }

  // Sparklines após 3s (espera dados carregarem)
  setTimeout(_dcAtualizarSparklines, 3000);
  setInterval(_dcAtualizarSparklines, 30000);

  console.info('[Desktop] Torre de Controle iniciada.');
}

/* ════════════════════════════════════════════════════════════
   ESTRUTURA HTML — injeta #app-root / #app-content
════════════════════════════════════════════════════════════ */

function _dcInjetarEstrutura() {
  // Só injeta se ainda não existe
  if (document.getElementById('app-root')) return;

  const topbar   = document.querySelector('.topbar');
  const liveStrip = document.querySelector('.live-strip');
  const nav      = document.querySelector('.nav');

  // Encontra o primeiro elemento após a nav
  const tabsArea = document.querySelector('.tab')?.parentElement;
  if (!tabsArea) return;

  // Cria wrapper
  const root    = document.createElement('div');
  root.id       = 'app-root';

  const sidebar = document.createElement('div');
  sidebar.id    = 'dc-sidebar';
  sidebar.className = 'dc-sidebar';

  const content = document.createElement('div');
  content.id    = 'app-content';

  // Move todas as tabs para o content
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const toastEl = document.getElementById('toast');

  // Cria container para as tabs
  const tabsWrapper = document.createElement('div');
  tabsWrapper.id = 'tabs-wrapper';
  tabs.forEach(t => tabsWrapper.appendChild(t));

  content.appendChild(tabsWrapper);

  root.appendChild(sidebar);
  root.appendChild(content);

  // Insere após o nav
  if (nav && nav.nextSibling) {
    nav.parentNode.insertBefore(root, nav.nextSibling);
  } else {
    document.body.appendChild(root);
  }

  // Move o toast para fora do root
  if (toastEl) document.body.appendChild(toastEl);
}

/* ════════════════════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════════════════════ */

function _dcCriarSidebar() {
  const sidebar = document.getElementById('dc-sidebar');
  if (!sidebar) return;

  const grupos = {};
  DC_TABS.forEach(t => {
    if (!grupos[t.group]) grupos[t.group] = [];
    grupos[t.group].push(t);
  });

  let html = `
    <div class="dc-sidebar-logo">
      <div class="logo-badge" style="font-size:11px;padding:2px 7px">PRO</div>
      <div class="dc-sidebar-logo-txt">DOCK<em>CHECK</em></div>
    </div>
    <nav class="dc-sidebar-nav">
  `;

  Object.entries(grupos).forEach(([grupo, tabs]) => {
    html += `<div class="dc-sidebar-group">${DC_GROUPS[grupo] || grupo}</div>`;
    tabs.forEach(t => {
      const isOn = t.id === _DC.tabAtual ? ' on' : '';
      html += `
        <div class="dc-sidebar-item${isOn}" id="dc-sb-${t.id}"
          onclick="dcSidebarNav('${t.id}')"
          title="${t.label}${t.key ? ` (${t.key})` : ''}">
          <span class="dc-sidebar-icon">${t.icon}</span>
          <span class="dc-sidebar-label">${t.label}</span>
          ${t.badge ? `<span class="dc-sidebar-badge" id="dc-sb-badge-${t.id}" style="display:none">0</span>` : ''}
          ${t.key ? `<span style="font-size:9px;color:var(--mut);margin-left:auto;font-family:'Barlow Condensed',sans-serif">${t.key}</span>` : ''}
        </div>
      `;
    });
  });

  html += `
    </nav>
    <div class="dc-sidebar-footer">
      <div class="dc-sidebar-status">
        <div class="dc-sidebar-status-dot"></div>
        <span id="dc-sb-backend">Backend Online</span>
      </div>
      <div style="margin-top:6px">
        <button class="btn btn-ghost btn-sm btn-full" onclick="dcToggleTV()"
          style="font-size:11px;letter-spacing:.5px;margin-top:4px">
          📺 Modo TV
        </button>
      </div>
    </div>
  `;

  sidebar.innerHTML = html;
}

/* ── Navegar pela sidebar ── */
function dcSidebarNav(tabId) {
  const tab  = DC_TABS.find(t => t.id === tabId);
  if (!tab) return;

  // Chama goTab nativo
  const btn = document.querySelector(`.ntab[onclick*="'${tabId}'"]`);
  if (btn) {
    btn.click();
  } else {
    // fallback direto
    if (typeof goTab === 'function') {
      goTab(tabId, { classList: { add: () => {}, remove: () => {} } });
    }
  }

  // Extra fn (ia-auto, automacao)
  if (tab.extraFn && typeof window[tab.extraFn] === 'function') {
    window[tab.extraFn]();
  }

  _dcAtualizarSidebarAtivo(tabId);
}

/* ── Atualiza item ativo na sidebar ── */
function _dcAtualizarSidebarAtivo(tabId) {
  _DC.tabAtual = tabId;
  document.querySelectorAll('.dc-sidebar-item').forEach(el => el.classList.remove('on'));
  const item = document.getElementById(`dc-sb-${tabId}`);
  if (item) item.classList.add('on');
}

/* ── Sincroniza badges da sidebar com os badges da nav ── */
function _dcSincronizarBadges() {
  DC_TABS.filter(t => t.badge).forEach(t => {
    const srcBadge  = document.getElementById(t.badge);
    const destBadge = document.getElementById(`dc-sb-badge-${t.id}`);
    if (!srcBadge || !destBadge) return;
    const txt = srcBadge.textContent;
    const vis = srcBadge.style.display !== 'none' && txt !== '0' && txt !== '';
    destBadge.textContent   = txt;
    destBadge.style.display = vis ? 'inline-flex' : 'none';
  });
}

/* ════════════════════════════════════════════════════════════
   COMMAND BAR — barra de status desktop
════════════════════════════════════════════════════════════ */

function _dcCriarCommandBar() {
  if (document.getElementById('dc-command-bar')) return;

  const bar = document.createElement('div');
  bar.id        = 'dc-command-bar';
  bar.className = 'dc-command-bar';
  bar.innerHTML = `
    <div class="dc-command-item">
      <div class="dc-command-dot" style="background:var(--grn);box-shadow:0 0 6px rgba(16,185,129,.6)"></div>
      <span id="dc-cmd-backend">Backend Online</span>
    </div>
    <div class="dc-command-sep"></div>
    <div class="dc-command-item">
      <div class="dc-command-dot" style="background:var(--acc)"></div>
      <span id="dc-cmd-turno">Turno —</span>
    </div>
    <div class="dc-command-sep"></div>
    <div class="dc-command-item">
      <div class="dc-command-dot" style="background:var(--blue)"></div>
      <span id="dc-cmd-docas">— docas ativas</span>
    </div>
    <div class="dc-command-sep"></div>
    <div class="dc-command-item">
      <div class="dc-command-dot" style="background:var(--grn)"></div>
      <span id="dc-cmd-ocs">— OCs finalizadas</span>
    </div>
    <div class="dc-command-sep"></div>
    <div class="dc-command-item" id="dc-cmd-alerta-wrap" style="display:none">
      <div class="dc-command-dot" style="background:var(--red);animation:blink 1s infinite"></div>
      <span id="dc-cmd-alerta" style="color:var(--red)">— alertas</span>
    </div>
    <div class="dc-command-clock" id="dc-cmd-clock">--:--:--</div>
  `;

  // Insere após a live-strip (ou após a nav)
  const liveStrip = document.querySelector('.live-strip');
  const nav       = document.querySelector('.nav');
  const ref        = liveStrip || nav;
  if (ref && ref.nextSibling) {
    ref.parentNode.insertBefore(bar, ref.nextSibling);
  } else {
    document.body.insertBefore(bar, document.body.firstChild);
  }
}

function _dcIniciarCommandBar() {
  _dcAtualizarCommandBar();
  if (_DC.commandTimer) clearInterval(_DC.commandTimer);
  _DC.commandTimer = setInterval(_dcAtualizarCommandBar, DC_DESKTOP.COMMAND_REFRESH_MS);
}

function _dcAtualizarCommandBar() {
  // Clock
  const clk = document.getElementById('dc-cmd-clock');
  if (clk) clk.textContent = new Date().toLocaleTimeString('pt-BR');

  // Turno
  const tl = document.getElementById('dc-cmd-turno');
  if (tl) {
    const h = new Date().getHours();
    const turno = h >= 6 && h < 14 ? 'Manhã 6h–14h' : h >= 14 && h < 22 ? 'Tarde 14h–22h' : 'Noite 22h–6h';
    tl.textContent = `Turno ${turno}`;
  }

  // Docas ativas (lê do dashboard se disponível)
  const docasEl = document.getElementById('dash-docas-ativas');
  const cmdDocas = document.getElementById('dc-cmd-docas');
  if (docasEl && cmdDocas) {
    cmdDocas.textContent = `${docasEl.textContent} docas ativas`;
  }

  // OCs finalizadas
  const ocsEl    = document.getElementById('dash-ocs-ok');
  const cmdOcs   = document.getElementById('dc-cmd-ocs');
  if (ocsEl && cmdOcs) {
    cmdOcs.textContent = `${ocsEl.textContent} OCs finalizadas`;
  }

  // Alertas
  const alertasEl  = document.getElementById('dash-docas-atraso');
  const cmdAlerta  = document.getElementById('dc-cmd-alerta');
  const cmdAlWrap  = document.getElementById('dc-cmd-alerta-wrap');
  if (alertasEl && cmdAlerta && cmdAlWrap) {
    const n = parseInt(alertasEl.textContent) || 0;
    cmdAlWrap.style.display = n > 0 ? 'flex' : 'none';
    cmdAlerta.textContent   = `${n} alerta${n !== 1 ? 's' : ''}`;
  }

  // Backend status
  const backendEl  = document.getElementById('backend-status');
  const cmdBackend = document.getElementById('dc-cmd-backend');
  const sbBackend  = document.getElementById('dc-sb-backend');
  if (backendEl && cmdBackend) {
    const online = backendEl.style.display !== 'none' ||
      document.querySelector('.backend-online') !== null;
    cmdBackend.textContent = online ? 'Backend Online' : 'Modo Local';
    if (sbBackend) sbBackend.textContent = cmdBackend.textContent;
  }

  // Sincroniza badges
  _dcSincronizarBadges();
}

/* ════════════════════════════════════════════════════════════
   MODO TV
════════════════════════════════════════════════════════════ */

function dcToggleTV() {
  _DC.tvAtivo ? dcExitTV() : dcEntrarTV();
}

function dcEntrarTV() {
  _DC.tvAtivo = true;
  document.body.classList.add('tv-mode');

  // Navega para o dashboard
  dcSidebarNav('dashboard');

  // Inicia rotação automática
  _DC.tvRotateIdx   = 0;
  _DC.tvRotateTimer = setInterval(_dcTVRotate, DC_DESKTOP.TV_ROTATE_MS);

  // Ticker
  _dcAtualizarTicker();
  setInterval(_dcAtualizarTicker, 10000);

  toast('📺 Modo TV ativado — ESC para sair');
  console.info('[TV] Modo TV ativado');
}

function dcExitTV() {
  _DC.tvAtivo = false;
  document.body.classList.remove('tv-mode');
  if (_DC.tvRotateTimer) {
    clearInterval(_DC.tvRotateTimer);
    _DC.tvRotateTimer = null;
  }
  toast('📺 Modo TV desativado');
}

function _dcTVRotate() {
  if (!_DC.tvAtivo) return;
  _DC.tvRotateIdx = (_DC.tvRotateIdx + 1) % _DC.tvPaineis.length;
  const tab = _DC.tvPaineis[_DC.tvRotateIdx];
  dcSidebarNav(tab);
}

/* ════════════════════════════════════════════════════════════
   TV TICKER
════════════════════════════════════════════════════════════ */

function _dcCriarTVTicker() {
  if (document.getElementById('tv-ticker')) return;

  const ticker = document.createElement('div');
  ticker.id        = 'tv-ticker';
  ticker.className = 'tv-ticker';
  ticker.innerHTML = `<div class="tv-ticker-inner" id="tv-ticker-inner">
    <span class="tv-ticker-item">🏭 DOCKCHECK PRO · TORRE DE CONTROLE LOGÍSTICO</span>
    <span class="tv-ticker-item">⚡ Monitoramento em tempo real ativo</span>
    <span class="tv-ticker-item">📡 Backend conectado</span>
  </div>`;
  document.body.appendChild(ticker);
}

function _dcAtualizarTicker() {
  const inner = document.getElementById('tv-ticker-inner');
  if (!inner) return;

  const items = [];
  const agora = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

  items.push(`<span class="tv-ticker-item">🕐 ${agora} · TURNO ${_dcNomeTurno()}</span>`);

  // Docas ativas
  const docasN = document.getElementById('dash-docas-ativas')?.textContent || '—';
  items.push(`<span class="tv-ticker-item ok">🏭 ${docasN} DOCAS EM OPERAÇÃO</span>`);

  // OCs
  const ocsN = document.getElementById('dash-ocs-ok')?.textContent || '0';
  items.push(`<span class="tv-ticker-item ok">✅ ${ocsN} OCs FINALIZADAS NO TURNO</span>`);

  // Tempo médio
  const tempoN = document.getElementById('dash-tempo-med')?.textContent || '—';
  items.push(`<span class="tv-ticker-item">⏱ TEMPO MÉDIO: ${tempoN}</span>`);

  // Alertas
  const alertaN = parseInt(document.getElementById('dash-docas-atraso')?.textContent) || 0;
  if (alertaN > 0) {
    items.push(`<span class="tv-ticker-item alert">🚨 ${alertaN} ALERTA${alertaN > 1 ? 'S' : ''} ATIVO${alertaN > 1 ? 'S' : ''}</span>`);
  }

  // Adiciona separadores
  const html = [...items, ...items] // duplica para loop contínuo
    .map(i => i + '<span class="tv-ticker-item" style="opacity:.3">◆</span>')
    .join('');

  inner.innerHTML = html;
}

function _dcNomeTurno() {
  const h = new Date().getHours();
  return h >= 6 && h < 14 ? 'MANHÃ' : h >= 14 && h < 22 ? 'TARDE' : 'NOITE';
}

/* ════════════════════════════════════════════════════════════
   SPARKLINES — mini gráficos nos KPI cards
════════════════════════════════════════════════════════════ */

function _dcAtualizarSparklines() {
  if (typeof historico === 'undefined') return;

  const agora = new Date();
  const horas = [];
  for (let i = 5; i >= 0; i--) {
    const h = new Date(agora - i * 3600000);
    horas.push(h.getHours());
  }

  // Conta OCs por hora
  const porHora = {};
  historico
    .filter(h => h.tipo === 'conferencia')
    .forEach(h => {
      const hr = new Date(h.data).getHours();
      porHora[hr] = (porHora[hr] || 0) + 1;
    });

  const vals   = horas.map(h => porHora[h] || 0);
  const maxVal = Math.max(...vals, 1);

  _DC.sparkData = { horas, vals, maxVal };

  // Injeta sparklines nos KPI cards
  _dcInjetarSparkline('kpi-ocs', vals, maxVal, '#3b82f6');
  _dcInjetarSparkline('kpi-tempo', vals.map(v => maxVal - v), maxVal, '#f59e0b');
  _dcInjetarSparkline('kpi-ativas', vals, maxVal, '#10b981');
}

function _dcInjetarSparkline(cardId, vals, maxVal, cor) {
  const card = document.getElementById(cardId);
  if (!card) return;

  let spark = card.querySelector('.sparkline-wrap');
  if (!spark) {
    spark = document.createElement('div');
    spark.className = 'sparkline-wrap';
    card.appendChild(spark);
  }

  spark.innerHTML = vals.map(v => {
    const pct = Math.max(10, Math.round((v / maxVal) * 100));
    return `<div class="sparkline-bar" style="height:${pct}%;background:${cor}"></div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   DETECÇÃO DE BREAKPOINT
════════════════════════════════════════════════════════════ */

function _dcDetectarBreakpoint() {
  const w          = window.innerWidth;
  const wasDesktop = _DC.isDesktop;
  _DC.isDesktop    = w >= DC_DESKTOP.BREAKPOINT_DESKTOP;

  if (_DC.isDesktop && !wasDesktop) {
    // Entrou no modo desktop
    document.body.setAttribute('data-layout', 'desktop');
    _dcAtualizarSidebarAtivo(_DC.tabAtual);
  } else if (!_DC.isDesktop && wasDesktop) {
    // Voltou ao mobile
    document.body.setAttribute('data-layout', 'mobile');
    if (_DC.tvAtivo) dcExitTV();
  }

  // Atributo de tamanho para CSS
  const size =
    w >= DC_DESKTOP.BREAKPOINT_ULTRA  ? 'ultra' :
    w >= DC_DESKTOP.BREAKPOINT_WIDE   ? 'wide'  :
    w >= DC_DESKTOP.BREAKPOINT_DESKTOP? 'desktop':
    w >= DC_DESKTOP.BREAKPOINT_TABLET ? 'tablet' : 'mobile';

  document.body.setAttribute('data-screen', size);
}

/* ════════════════════════════════════════════════════════════
   PATCH NO goTab() — sincroniza sidebar ao navegar
════════════════════════════════════════════════════════════ */

function _dcPatchGoTab() {
  // Aguarda o app.js carregar e define goTab
  const _waitGoTab = setInterval(() => {
    if (typeof goTab !== 'function') return;
    clearInterval(_waitGoTab);

    const _originalGoTab = goTab;
    window.goTab = function(n, b) {
      _originalGoTab(n, b);
      _dcAtualizarSidebarAtivo(n);
      _dcAtualizarCommandBar();
    };
  }, 100);
}

/* ════════════════════════════════════════════════════════════
   ATALHOS DE TECLADO
════════════════════════════════════════════════════════════ */

function _dcRegistrarTeclado() {
  document.addEventListener('keydown', e => {
    // Ignora quando focado em input/textarea
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;

    // ESC — sai do TV
    if (e.key === 'Escape' && _DC.tvAtivo) {
      dcExitTV();
      return;
    }

    // T — toggle TV
    if (e.key === 't' || e.key === 'T') {
      dcToggleTV();
      return;
    }

    // 1-9 — navegar entre abas
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      const tab = DC_TABS.find(t => t.key === e.key);
      if (tab) {
        dcSidebarNav(tab.id);
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════
   BOOT — inicia após o DOM estar pronto
════════════════════════════════════════════════════════════ */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', desktopInit);
} else {
  // DOM já pronto
  setTimeout(desktopInit, 0);
}
