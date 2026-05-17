/**
 * performance.js — DockCheck PRO · Fase 13 · Etapa 8
 * Performance Mobile Enterprise
 *
 * O QUE ESTE MÓDULO FAZ:
 *  1. Lazy loading — módulos pesados (BI, Analytics, IA) só executam ao abrir a aba
 *  2. Virtualização de listas longas — histórico renderiza só o visível
 *  3. Debounce em inputs de busca/filtro
 *  4. Throttle em polling para economizar bateria
 *  5. Monitoramento de performance (FPS, memória, tempo de render)
 *  6. Painel Lighthouse-like interno (acessível em ⚙️ Config)
 *  7. Modo bateria fraca — reduz updates quando < 20%
 *
 * NÃO ALTERA: app.js, analytics.js, bi.js, sw.js, ou qualquer outro arquivo.
 * Intercepta de forma não-invasiva via monkey-patch e event listeners.
 *
 * DEPENDÊNCIAS: carregado ANTES de app.js (veja instruções no final).
 * INTEGRAÇÃO: app.js chama perfInit() caso exista — já previsto.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */

const _perf = {
  renderTimes:    {},   // { nomeAba: [ms, ms, ms] } — últimas 5 renders
  lazyReady:      {},   // { nomeAba: true } — módulo já teve primeiro render
  listVirtOffset: {},   // { listId: scrollTop } — posição de scroll das listas virtuais
  throttleTimers: {},   // { chave: timeoutId }
  debounceTimers: {},   // { chave: timeoutId }
  bateria:        null, // BatteryManager
  fpsFrames:      [],   // timestamps dos últimos 60 frames
  fpsRaf:         null, // requestAnimationFrame id
  modoEconomia:   false,
  iniciado:       false,
};

/* ════════════════════════════════════════════════════════════
   1. LAZY LOADING — só executa render ao abrir a aba
════════════════════════════════════════════════════════════ */

/**
 * Tabela de módulos pesados com seus renders reais.
 * Quando o usuário nunca abriu a aba, não executa nada.
 * Na primeira abertura, executa e marca como pronto.
 */
const LAZY_MODULOS = {
  analytics: () => typeof renderAnalytics === 'function' && renderAnalytics(),
  bi:        () => typeof renderBI        === 'function' && renderBI(),
  ia:        () => typeof renderIA        === 'function' && renderIA(),
  relatorio: () => typeof renderRelatorio === 'function' && renderRelatorio(),
};

/**
 * Intercepta goTab para adicionar lazy loading e medição de tempo.
 * Chamado pelo perfInit() — wrapper não-invasivo.
 */
function _perfPatchGoTab() {
  if (typeof goTab !== 'function') return;

  const _goTabOriginal = goTab;

  window.goTab = function(n, b) {
    const t0 = performance.now();

    _goTabOriginal(n, b);

    // Lazy: se é módulo pesado e ainda não foi renderizado nesta sessão
    if (LAZY_MODULOS[n] && !_perf.lazyReady[n]) {
      _perf.lazyReady[n] = true;
      requestAnimationFrame(() => {
        const tLazy = performance.now();
        LAZY_MODULOS[n]();
        _perfRegistrarRender(n, performance.now() - tLazy);
      });
    }

    // Mede tempo de render da aba
    requestAnimationFrame(() => {
      _perfRegistrarRender(n, performance.now() - t0);
    });
  };
}

function _perfRegistrarRender(aba, ms) {
  if (!_perf.renderTimes[aba]) _perf.renderTimes[aba] = [];
  _perf.renderTimes[aba].push(Math.round(ms));
  if (_perf.renderTimes[aba].length > 5) _perf.renderTimes[aba].shift();

  if (ms > 200) {
    console.warn(`[PERF] Render lento: aba "${aba}" levou ${Math.round(ms)}ms`);
  }
}

/* ════════════════════════════════════════════════════════════
   2. VIRTUALIZAÇÃO DE LISTAS LONGAS
════════════════════════════════════════════════════════════ */

const VIRTUAL_ITEM_HEIGHT = 56;  // px estimado por item do histórico
const VIRTUAL_VISIBLE_BUFFER = 5; // itens extras acima e abaixo

/**
 * Virtualiza uma lista longa: só renderiza o que está visível + buffer.
 * Substitui o innerHTML direto por um container virtual.
 *
 * @param {string}   containerId — ID do elemento pai scrollable
 * @param {any[]}    items       — array completo de itens
 * @param {Function} renderItem  — (item, index) => HTML string
 * @param {number}   [itemH]     — altura estimada por item em px
 */
function perfVirtualizar(containerId, items, renderItem, itemH = VIRTUAL_ITEM_HEIGHT) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (items.length <= 30) {
    // Lista curta: render direto, sem overhead
    container.innerHTML = items.map((item, i) => renderItem(item, i)).join('');
    return;
  }

  const totalH = items.length * itemH;

  // Cria estrutura virtual se ainda não existe
  if (!container.dataset.virtual) {
    container.dataset.virtual = '1';
    container.style.overflowY  = 'auto';
    container.style.position   = 'relative';
    container.innerHTML        = `
      <div id="${containerId}-spacer" style="height:${totalH}px;pointer-events:none"></div>
      <div id="${containerId}-viewport" style="position:absolute;top:0;left:0;right:0"></div>`;

    container.addEventListener('scroll', () => _perfRenderViewport(containerId, items, renderItem, itemH), { passive: true });
  } else {
    // Atualiza spacer
    const spacer = document.getElementById(`${containerId}-spacer`);
    if (spacer) spacer.style.height = totalH + 'px';
  }

  _perfRenderViewport(containerId, items, renderItem, itemH);
}

function _perfRenderViewport(containerId, items, renderItem, itemH) {
  const container  = document.getElementById(containerId);
  const viewport   = document.getElementById(`${containerId}-viewport`);
  if (!container || !viewport) return;

  const scrollTop  = container.scrollTop;
  const clientH    = container.clientHeight || 400;

  const startIdx   = Math.max(0, Math.floor(scrollTop / itemH) - VIRTUAL_VISIBLE_BUFFER);
  const endIdx     = Math.min(items.length - 1, Math.ceil((scrollTop + clientH) / itemH) + VIRTUAL_VISIBLE_BUFFER);

  viewport.style.top = (startIdx * itemH) + 'px';
  viewport.innerHTML = items.slice(startIdx, endIdx + 1)
    .map((item, i) => renderItem(item, startIdx + i)).join('');
}

/* ════════════════════════════════════════════════════════════
   3. DEBOUNCE EM INPUTS
════════════════════════════════════════════════════════════ */

/**
 * Aplica debounce a inputs de busca existentes no sistema.
 * Procura por IDs comuns de busca/filtro.
 */
function _perfAplicarDebounce() {
  const seletores = [
    '#hist-busca',
    '#rel-busca',
    '#conf-busca',
    '#bi-busca',
    'input[placeholder*="buscar"]',
    'input[placeholder*="Buscar"]',
    'input[placeholder*="filtrar"]',
    'input[type="search"]',
  ];

  seletores.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (el.dataset.perfDebounce) return; // já aplicado
      el.dataset.perfDebounce = '1';

      const handler = el.oninput || el.onkeyup || null;
      const evtType = el.oninput ? 'input' : 'keyup';

      if (handler) {
        el.oninput  = null;
        el.onkeyup  = null;
        el.addEventListener(evtType, perfDebounce(() => handler.call(el), 300));
      }
    });
  });
}

/**
 * Função debounce reutilizável — exposta globalmente.
 * @param {Function} fn
 * @param {number} delay — ms
 * @returns {Function}
 */
function perfDebounce(fn, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle simples — limita execuções a 1 por intervalo.
 * @param {Function} fn
 * @param {number} interval — ms
 * @returns {Function}
 */
function perfThrottle(fn, interval = 1000) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last < interval) return;
    last = now;
    return fn.apply(this, args);
  };
}

/* ════════════════════════════════════════════════════════════
   4. THROTTLE EM POLLING — economiza bateria
════════════════════════════════════════════════════════════ */

/**
 * Reduz frequência de atualizações quando em modo economia.
 * Intercepta setInterval para intervalos muito curtos.
 */
function _perfPatchSetInterval() {
  const _siOriginal = window.setInterval;
  window.setInterval = function(fn, delay, ...args) {
    // Só ajusta intervalos muito curtos (< 5s) em modo economia
    if (_perf.modoEconomia && delay > 0 && delay < 5000) {
      const novoDelay = Math.max(delay * 3, 5000);
      console.info(`[PERF] Modo economia: setInterval ${delay}ms → ${novoDelay}ms`);
      return _siOriginal(fn, novoDelay, ...args);
    }
    return _siOriginal(fn, delay, ...args);
  };
}

/* ════════════════════════════════════════════════════════════
   5. MONITOR DE FPS + MEMÓRIA
════════════════════════════════════════════════════════════ */

function _perfIniciarMonitorFPS() {
  let frame = 0;

  const tick = (ts) => {
    _perf.fpsFrames.push(ts);
    // Mantém só o último segundo
    const limite = ts - 1000;
    while (_perf.fpsFrames.length && _perf.fpsFrames[0] < limite) {
      _perf.fpsFrames.shift();
    }
    frame++;
    _perf.fpsRaf = requestAnimationFrame(tick);
  };

  _perf.fpsRaf = requestAnimationFrame(tick);
}

function _perfGetFPS() {
  return _perf.fpsFrames.length;
}

function _perfGetMemoria() {
  if (!performance.memory) return null;
  const m = performance.memory;
  return {
    usada:  Math.round(m.usedJSHeapSize  / 1048576),
    total:  Math.round(m.totalJSHeapSize / 1048576),
    limite: Math.round(m.jsHeapSizeLimit / 1048576),
    pct:    Math.round((m.usedJSHeapSize / m.jsHeapSizeLimit) * 100),
  };
}

/* ════════════════════════════════════════════════════════════
   6. MONITOR DE BATERIA
════════════════════════════════════════════════════════════ */

async function _perfIniciarBateria() {
  if (!navigator.getBattery) return;
  try {
    _perf.bateria = await navigator.getBattery();
    _perfChecarBateria();
    _perf.bateria.addEventListener('levelchange',      _perfChecarBateria);
    _perf.bateria.addEventListener('chargingchange',   _perfChecarBateria);
  } catch (e) {
    console.info('[PERF] Battery API não disponível.');
  }
}

function _perfChecarBateria() {
  const b = _perf.bateria;
  if (!b) return;

  const nivel     = Math.round(b.level * 100);
  const carregando = b.charging;

  // Modo economia: bateria < 20% e não carregando
  const deveEconomizar = nivel < 20 && !carregando;

  if (deveEconomizar !== _perf.modoEconomia) {
    _perf.modoEconomia = deveEconomizar;

    if (deveEconomizar) {
      console.info('[PERF] Modo economia ativado — bateria em', nivel + '%');
      if (typeof toast === 'function') toast('⚡ Modo economia ativado — bateria fraca');
      document.body.classList.add('perf-economia');
    } else {
      document.body.classList.remove('perf-economia');
    }
  }

  // Atualiza badge de bateria no painel
  _perfAtualizarPainelBateria(nivel, carregando);
}

function _perfAtualizarPainelBateria(nivel, carregando) {
  const el = document.getElementById('perf-bateria-val');
  if (!el) return;
  const icone = carregando ? '🔌' : nivel > 50 ? '🔋' : nivel > 20 ? '🪫' : '⚠️';
  el.textContent = `${icone} ${nivel}%${carregando ? ' (carregando)' : ''}`;
  el.style.color = nivel < 20 && !carregando ? '#ef4444' : 'var(--grn)';
}

/* ════════════════════════════════════════════════════════════
   7. PAINEL DE PERFORMANCE (Config)
════════════════════════════════════════════════════════════ */

/**
 * Renderiza o painel de performance na aba Config.
 * Injetado em <div id="perf-config-section"> se existir.
 */
function perfRenderConfigSection() {
  const el = document.getElementById('perf-config-section');
  if (!el) return;

  const fps   = _perfGetFPS();
  const mem   = _perfGetMemoria();
  const bat   = _perf.bateria;
  const nivel = bat ? Math.round(bat.level * 100) : null;

  // Render times médios por aba
  const renderInfo = Object.entries(_perf.renderTimes).map(([aba, times]) => {
    const med = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const cor = med > 200 ? '#ef4444' : med > 100 ? '#f59e0b' : '#10b981';
    return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid var(--brd)">
      <span style="color:var(--mut)">${aba}</span>
      <span style="font-weight:700;color:${cor}">${med}ms</span>
    </div>`;
  }).join('') || '<div style="color:var(--mut);font-size:12px;padding:8px 0">Nenhuma aba visitada ainda.</div>';

  // Score de performance
  const score = _perfCalcularScore(fps, mem);
  const scoreCor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLbl = score >= 80 ? 'ÓTIMO' : score >= 60 ? 'REGULAR' : 'LENTO';

  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:10px;padding:14px;margin-bottom:12px">

      <!-- Score geral -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div style="text-align:center">
          <div style="font-size:36px;font-weight:900;font-family:'Barlow Condensed',sans-serif;color:${scoreCor}">${score}</div>
          <div style="font-size:10px;color:${scoreCor};font-weight:700">${scoreLbl}</div>
        </div>
        <div style="flex:1">
          <div style="height:6px;background:var(--bg);border-radius:3px">
            <div style="height:100%;width:${score}%;background:${scoreCor};border-radius:3px;transition:width .6s"></div>
          </div>
          <div style="font-size:11px;color:var(--mut);margin-top:6px">Score de Performance Mobile</div>
        </div>
      </div>

      <!-- Métricas -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:var(--bg);border:1px solid var(--brd);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:900;color:${fps >= 50 ? '#10b981' : fps >= 30 ? '#f59e0b' : '#ef4444'}">${fps}</div>
          <div style="font-size:10px;color:var(--mut)">FPS</div>
        </div>
        <div style="background:var(--bg);border:1px solid var(--brd);border-radius:8px;padding:10px;text-align:center">
          <div id="perf-bateria-val" style="font-size:14px;font-weight:700">${nivel !== null ? nivel + '%' : '—'}</div>
          <div style="font-size:10px;color:var(--mut)">Bateria</div>
        </div>
        ${mem ? `
        <div style="background:var(--bg);border:1px solid var(--brd);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:900;color:${mem.pct > 80 ? '#ef4444' : '#10b981'}">${mem.usada}MB</div>
          <div style="font-size:10px;color:var(--mut)">Memória JS</div>
        </div>
        <div style="background:var(--bg);border:1px solid var(--brd);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:900;color:var(--acc)">${mem.pct}%</div>
          <div style="font-size:10px;color:var(--mut)">Heap usado</div>
        </div>` : ''}
      </div>

      <!-- Modo economia -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;
                  background:var(--bg);border:1px solid var(--brd);border-radius:8px;margin-bottom:12px">
        <div>
          <div style="font-size:13px;font-weight:700">⚡ Modo Economia</div>
          <div style="font-size:11px;color:var(--mut)">Reduz updates para economizar bateria</div>
        </div>
        <button onclick="perfToggleEconomia()"
          style="padding:6px 14px;border-radius:20px;border:1px solid var(--brd);
                 background:${_perf.modoEconomia ? '#f59e0b' : 'var(--bg2)'};
                 color:${_perf.modoEconomia ? '#000' : 'var(--txt)'};
                 font-size:12px;font-weight:700;cursor:pointer" id="perf-btn-economia">
          ${_perf.modoEconomia ? 'ON' : 'OFF'}
        </button>
      </div>

      <!-- Tempos de render por aba -->
      <div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">
        ⏱ Tempo de render por aba
      </div>
      ${renderInfo}

      <!-- Ações -->
      <div style="display:flex;gap:8px;margin-top:12px">
        <button onclick="perfRenderConfigSection()"
          style="flex:1;padding:8px;font-size:12px;background:var(--bg2);border:1px solid var(--brd);
                 border-radius:8px;color:var(--txt);cursor:pointer">
          🔄 Atualizar
        </button>
        <button onclick="perfLimparLazy()"
          style="flex:1;padding:8px;font-size:12px;background:var(--bg2);border:1px solid var(--brd);
                 border-radius:8px;color:var(--txt);cursor:pointer">
          🗑 Limpar cache lazy
        </button>
      </div>
    </div>
  `;
}

function _perfCalcularScore(fps, mem) {
  let score = 100;
  if (fps < 60) score -= Math.round((60 - fps) * 0.5);
  if (fps < 30) score -= 20;
  if (mem) {
    if (mem.pct > 80) score -= 20;
    else if (mem.pct > 60) score -= 10;
  }
  if (_perf.modoEconomia) score -= 10;

  // Penaliza renders lentos
  const renders = Object.values(_perf.renderTimes).flat();
  if (renders.length) {
    const medRender = renders.reduce((a, b) => a + b, 0) / renders.length;
    if (medRender > 300) score -= 20;
    else if (medRender > 150) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Liga/desliga modo economia manualmente.
 */
function perfToggleEconomia() {
  _perf.modoEconomia = !_perf.modoEconomia;
  document.body.classList.toggle('perf-economia', _perf.modoEconomia);
  if (typeof toast === 'function') {
    toast(_perf.modoEconomia ? '⚡ Modo economia ativado' : '⚡ Modo economia desativado');
  }
  perfRenderConfigSection();
}

/**
 * Reseta o cache lazy — próxima visita à aba re-renderiza.
 */
function perfLimparLazy() {
  _perf.lazyReady   = {};
  _perf.renderTimes = {};
  if (typeof toast === 'function') toast('Cache lazy limpo!');
  perfRenderConfigSection();
}

/* ════════════════════════════════════════════════════════════
   8. INTERSECTION OBSERVER — render ao entrar na tela
════════════════════════════════════════════════════════════ */

/**
 * Aplica IntersectionObserver em seções pesadas (gráficos canvas).
 * Só renderiza o canvas quando entra no viewport.
 */
function _perfObservarCanvas() {
  if (!('IntersectionObserver' in window)) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const canvas = entry.target;
      const fn     = canvas.dataset.perfRender;
      if (fn && typeof window[fn] === 'function') {
        window[fn]();
        obs.unobserve(canvas); // só uma vez
      }
    });
  }, { threshold: 0.1 });

  // Observa todos os canvas com data-perf-render
  document.querySelectorAll('canvas[data-perf-render]').forEach(c => obs.observe(c));
}

/* ════════════════════════════════════════════════════════════
   9. CSS — modo economia + animações reduzidas
════════════════════════════════════════════════════════════ */

(function _injetarCSSPerf() {
  if (document.getElementById('css-perf-fase13')) return;
  const s = document.createElement('style');
  s.id = 'css-perf-fase13';
  s.textContent = `
    /* Modo economia: remove animações não essenciais */
    .perf-economia *,
    .perf-economia *::before,
    .perf-economia *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }

    /* Mantém animações críticas mesmo em modo economia */
    .perf-economia .spin,
    .perf-economia .dh-live-dot,
    .perf-economia .dh-pulse-ring {
      animation-duration: 1s !important;
    }

    /* Itens virtualizados */
    [data-virtual="1"] { position: relative; }

    /* Reduz sombras em modo economia */
    .perf-economia .modal,
    .perf-economia .an-exec-card,
    .perf-economia .dh-kpi {
      box-shadow: none !important;
    }

    /* Indicador de modo economia no header */
    .perf-economia-badge {
      font-size: 10px;
      color: #f59e0b;
      font-weight: 700;
      padding: 2px 6px;
      border: 1px solid #f59e0b;
      border-radius: 10px;
      margin-left: 6px;
      display: none;
    }
    .perf-economia .perf-economia-badge {
      display: inline-block;
    }
  `;
  document.head.appendChild(s);
})();

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Inicializa todos os módulos de performance.
 * Chamado automaticamente no DOMContentLoaded.
 * app.js pode chamar perfInit() explicitamente — idempotente.
 */
function perfInit() {
  if (_perf.iniciado) return;
  _perf.iniciado = true;

  // Patch de goTab (lazy loading + medição)
  // Usa setTimeout para garantir que goTab já foi definido pelo app.js
  setTimeout(_perfPatchGoTab, 0);

  // Debounce em inputs de busca
  _perfAplicarDebounce();

  // Monitor de FPS
  _perfIniciarMonitorFPS();

  // Monitor de bateria (async)
  _perfIniciarBateria();

  // Observa canvas (defer render)
  _perfObservarCanvas();

  // Injeta badge de economia no header
  const topRight = document.querySelector('.topbar-right');
  if (topRight && !document.querySelector('.perf-economia-badge')) {
    const badge = document.createElement('span');
    badge.className   = 'perf-economia-badge';
    badge.textContent = '⚡ Economia';
    topRight.prepend(badge);
  }

  // Atualiza painel a cada 5s (só se aberto)
  setInterval(() => {
    const secEl = document.getElementById('perf-config-section');
    if (secEl && secEl.innerHTML.trim()) {
      perfRenderConfigSection();
    }
  }, 5000);

  // Reaplica debounce quando novas abas abrirem (30s)
  setInterval(_perfAplicarDebounce, 30000);

  console.info('[PERF] Etapa 8 iniciada — Performance Mobile Enterprise');
}

// Auto-init após DOM pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', perfInit);
} else {
  // DOM já pronto (script carregado no final do body)
  setTimeout(perfInit, 0);
}
