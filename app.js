/**
 * app.js — DockCheck PRO
 * Ponto de entrada principal.
 * Gerencia: estado global, inicialização, navegação,
 * live strip, relógio, config e instalação PWA.
 *
 * ORDEM DE CARREGAMENTO (no index.html):
 *   storage.js → utils.js → timer.js → fila.js →
 *   equipes.js → historico.js → conferencia.js →
 *   ocr.js → whatsapp.js → relatorio.js → ia.js → app.js
 *
 * app.js é sempre o ÚLTIMO a ser carregado.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   ESTADO GLOBAL
   Acessível por todos os módulos via escopo global (window).
════════════════════════════════════════════════════════════ */

let equipes   = [];   // array de equipes ativas/inativas
let historico = [];   // array de registros (conferências + tabelas)
let ocrRows   = [];   // linhas extraídas da tabela diária (OCR ou teste)

/* ════════════════════════════════════════════════════════════
   PWA — INSTALL PROMPT
════════════════════════════════════════════════════════════ */

let pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  pwaInstallPrompt = e;
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.style.display = 'inline-flex';
});

function installPWA() {
  if (!pwaInstallPrompt) return;
  pwaInstallPrompt.prompt();
  pwaInstallPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') toast('App instalado!');
    pwaInstallPrompt = null;
    const btn = document.getElementById('btn-pwa-install');
    if (btn) btn.style.display = 'none';
  });
}

/* ════════════════════════════════════════════════════════════
   RELÓGIO
════════════════════════════════════════════════════════════ */

function tickClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR');
}

/* ════════════════════════════════════════════════════════════
   NAVEGAÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Muda a aba ativa.
 * @param {string} n — id da aba (sem prefixo 'tab-')
 * @param {HTMLElement} b — botão clicado
 */
function goTab(n, b) {
  // Pausa dashboard se sair da aba
  if (document.getElementById('tab-dashboard')?.classList.contains('on')) {
    if (typeof dashboardInativo === 'function') dashboardInativo();
  }

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.ntab').forEach(x => x.classList.remove('on'));
  document.getElementById('tab-' + n).classList.add('on');
  b.classList.add('on');

  // Render lazy ao entrar na aba
  if (n === 'dashboard')  dashboardAtivo();
  if (n === 'analytics')  renderAnalytics();
  if (n === 'historico')  renderHist();
  if (n === 'equipes')    renderEquipes();
  if (n === 'relatorio')  renderRelatorio();

  // Fase 13 Etapa 7: atualiza seção geo ao entrar em Config
  if (n === 'config') {
    if (typeof geoRenderConfigSection  === 'function') geoRenderConfigSection();
    if (typeof bioRenderConfigSection  === 'function') bioRenderConfigSection();
    if (typeof perfRenderConfigSection === 'function') perfRenderConfigSection();
  }
}

/* ════════════════════════════════════════════════════════════
   LIVE STRIP — barra de docas ativas no topo
════════════════════════════════════════════════════════════ */

/**
 * Atualiza a barra de chips de docas ativas.
 * Chamada após cada conferência registrada e no init.
 */
function updateLiveStrip() {
  const hoje = new Date().toISOString().slice(0, 10);
  const conf = historico.filter(h => h.tipo === 'conferencia' && h.data?.slice(0, 10) === hoje);

  // Docas com OC na tabela carregada
  const docasOCR = new Set(ocrRows.map(r => r.doca?.trim()).filter(Boolean));

  // Docas com conferência hoje
  const docasConf = new Map();
  conf.forEach(h => {
    const d = h.doca?.trim();
    if (d) docasConf.set(d, (docasConf.get(d) || 0) + 1);
  });

  const el = document.getElementById('live-strip');
  if (!el) return;

  const todas = new Set([...docasOCR, ...docasConf.keys()]);
  if (!todas.size) {
    el.innerHTML = '<div class="live-chip" style="color:var(--mut);border-color:transparent">⬡ Sem docas na tabela</div>';
    return;
  }

  const chips = [];
  [...todas].sort((a, b) => Number(a) - Number(b)).forEach(doca => {
    const ocsNaDoca = ocrRows.filter(r => r.doca?.trim() === doca);
    const feitas    = new Set(conf.filter(h => h.doca?.trim() === doca).map(h => h.oc?.trim()));
    const pendentes = ocsNaDoca.filter(r => !feitas.has(r.oc?.trim())).length;
    const total     = ocsNaDoca.length;
    const cls       = pendentes === 0 && total > 0 ? 'concluida' : total > 0 ? 'ativa' : 'concluida';

    chips.push(`
      <div class="live-chip ${cls}" onclick="quickSelectDoca('${doca}')">
        <div class="live-chip-dot"></div>
        Doca ${doca}${total > 0 ? ` (${total - pendentes}/${total})` : ''}
      </div>
    `);
  });

  el.innerHTML = chips.join('');
}

/**
 * Toque rápido em um chip → navega para Conferência e seleciona a doca.
 * @param {string} doca
 */
function quickSelectDoca(doca) {
  goTab('conferencia', document.querySelector('.ntab'));
  const input = document.getElementById('f-doca');
  if (input) { input.value = doca; onDocaInput(doca); }
}

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */

function salvarKey() {
  storage.set(K_KEY, document.getElementById('cfg-key').value.trim());
  toast('API Key salva!');
}

function salvarTempoAlvo() {
  storage.set(K_ALVO, Number(document.getElementById('cfg-tempo-alvo').value) || 45);
  toast('Tempo alvo salvo!');
}

function salvarTmpl() {
  storage.set(K_TMPL, document.getElementById('cfg-tmpl').value);
  toast('Template salvo!');
}

function resetTmpl() {
  document.getElementById('cfg-tmpl').value = TMPL_PAD;
  storage.remove(K_TMPL);
  toast('Template restaurado.');
}

/* ════════════════════════════════════════════════════════════
   DIAGNÓSTICO E BACKUP
════════════════════════════════════════════════════════════ */

/**
 * Exibe diagnóstico do storage na aba Config.
 */
async function verDiagnostico() {
  const el = document.getElementById('diag-output');
  el.textContent = 'Carregando...';
  try {
    const d = await storage.diagnostico();

    // Info do Service Worker
    let swInfo = 'Não registrado';
    let swVersao = '—';
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('./sw.js').catch(() => null);
      if (reg) {
        swInfo = reg.active ? '✅ Ativo' : reg.installing ? '⏳ Instalando' : '⚠️ Aguardando';
        swVersao = reg.waiting ? 'Nova versão aguardando!' : 'Atual';
      }
    }

    // Info de GPS
    const gpsUltima = typeof geoGetUltima === 'function' ? geoGetUltima() : null;
    const gpsInfo   = gpsUltima
      ? `📍 ${gpsUltima.lat.toFixed(5)}, ${gpsUltima.lng.toFixed(5)} (±${gpsUltima.acc}m)`
      : '📡 Sem posição recente';

    el.innerHTML = `
      <b style="color:var(--grn)">✅ IndexedDB ativo</b><br>
      Histórico: <b style="color:var(--acc)">${d.idb.historico}</b> registros<br>
      Equipes: <b style="color:var(--acc)">${d.idb.equipes}</b> cadastradas<br>
      Migração: <b style="color:var(--${d.localStorage.migrado ? 'grn' : 'acc'})">${d.localStorage.migrado ? 'concluída ✅' : 'pendente ⏳'}</b><br>
      localStorage: <b>${d.localStorage.sizeKB}KB</b> (só config)<br>
      <br>
      <b style="color:var(--blue)">Service Worker (Fase 3)</b><br>
      Status: <b>${swInfo}</b><br>
      Cache: <b>${swVersao}</b><br>
      Conexão: <b style="color:var(--${isOnline() ? 'grn' : 'acc'})">${isOnline() ? '📶 Online' : '📵 Offline'}</b><br>
      <br>
      <b style="color:var(--acc)">📍 GPS (Fase 13)</b><br>
      ${gpsInfo}
    `;
  } catch (e) {
    el.textContent = '❌ Erro: ' + e.message;
  }
}

/**
 * Exporta backup completo do histórico e equipes como JSON.
 * Permite restaurar dados manualmente se necessário.
 */
function exportarBackup() {
  const backup = {
    versao:    'dockcheck_v2',
    exportado: new Date().toISOString(),
    historico,
    equipes
  };
  _downloadBlob(
    JSON.stringify(backup, null, 2),
    `dockcheck_backup_${new Date().toISOString().slice(0, 10)}.json`,
    'application/json'
  );
  toast('Backup exportado!');
}

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Inicializa o sistema (assíncrono desde a Fase 2):
 * 1. Abre IndexedDB e migra dados do localStorage se necessário
 * 2. Carrega dados para o cache em memória
 * 3. Carrega equipes de teste se não houver nenhuma
 * 4. Preenche campos de config
 * 5. Renderiza equipes e histórico
 * 6. Inicia relógio
 * 7. Registra Service Worker
 * 8. Inicia biometria/PIN (Fase 13 Etapa 6)
 * 9. Inicia geolocalização (Fase 13 Etapa 7)
 */
async function init() {
  // ── Skeleton loading enquanto o IDB abre ──
  _setLoadingUI(true);

  // ── Fase 2: abre IDB, migra e preenche cache ──
  // DEVE ser aguardado antes de qualquer storage.get()
  await storage.load();

  // ── Dados ──
  equipes   = storage.get(K_EQ, null);
  historico = storage.get(K_HIST, []);

  if (!equipes || !equipes.length) {
    equipes = EQUIPES_TESTE;
    storage.set(K_EQ, equipes);
  }

  // Tabela de teste sempre disponível no OCR
  ocrRows = TABELA_TESTE;

  // ── Config ──
  const key = storage.get(K_KEY, '');
  if (key) document.getElementById('cfg-key').value = key;
  document.getElementById('cfg-tmpl').value         = storage.get(K_TMPL, '') || TMPL_PAD;
  document.getElementById('cfg-tempo-alvo').value   = storage.get(K_ALVO, 45);

  // ── Horário inicial ──
  const now = new Date();
  document.getElementById('f-hora').value =
    _padTime(now.getHours()) + ':' + _padTime(now.getMinutes());

  // ── Render inicial ──
  _setLoadingUI(false);
  renderEquipes();
  renderHist();
  renderOCR(ocrRows);
  updateLiveStrip();

  // Mostra tabela de teste no OCR
  document.getElementById('ocr-res').style.display    = 'block';
  document.getElementById('ocr-status').style.display = 'block';
  document.getElementById('ocr-status').innerHTML     =
    `<div class="obar ok">✅ ${ocrRows.length} linhas da tabela carregadas para teste!</div>`;

  // ── Relógio ──
  tickClock();
  setInterval(tickClock, 1000);

  // ── Service Worker — Fase 3 ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.info('[SW] Registrado:', reg.scope);

        // Verifica se há update esperando (ex: usuário abriu o app offline
        // e depois voltou online com nova versão já baixada)
        if (reg.waiting) {
          _exibirBannerAtualizacaoInline();
        }

        // Detecta novo SW instalando em background
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // Novo SW instalado, aguardando ativação
              _exibirBannerAtualizacaoInline();
            }
          });
        });

        // Verifica atualizações via connectivity.js
        verificarAtualizacaoSW();
      })
      .catch(err => console.warn('[SW] Registro falhou:', err));
  }

  // Diagnóstico no console (apenas dev)
  storage.diagnostico().then(d =>
    console.info('[DockCheck PRO] Iniciado.', d)
  );

  // ── Fase 13: escuta mensagens do Service Worker (push navigate) ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'PUSH_NAVIGATE' && e.data.tab) {
        const btn = [...document.querySelectorAll('.ntab')]
          .find(b => b.getAttribute('onclick')?.includes(`'${e.data.tab}'`));
        if (btn) btn.click();
      }
    });
  }

  // ── Fase 6: conecta ao backend Railway ──
  if (typeof backendInit === 'function') backendInit();

  // ── Fase 13 Etapa 6: inicia Biometria / PIN ──
  if (typeof bioInit === 'function') bioInit();

  // ── Fase 13 Etapa 7: inicia Geolocalização ──
  if (typeof geoInit === 'function') geoInit();

  // ── Fase 13: fecha splash screen ──
  setTimeout(() => {
    if (typeof window.dcSplashClose === 'function') {
      window.dcSplashClose();
    }
  }, 400);

  // ── Fase 13 Final: atualiza UI de idioma e tema ──
  setTimeout(() => {
    // Marca botão de idioma ativo
    const lang = typeof getLang === 'function' ? getLang() : 'pt-BR';
    const langMap = { 'pt-BR': 'pt', 'en-US': 'en', 'es': 'es' };
    const suffix = langMap[lang] || 'pt';
    document.querySelectorAll('[id^="lang-btn-"]').forEach(b => {
      b.classList.toggle('btn-acc', b.id === `lang-btn-${suffix}`);
      b.classList.toggle('btn-ghost', b.id !== `lang-btn-${suffix}`);
    });
    // Atualiza seletor de tema
    if (typeof getTheme === 'function') {
      const tema = getTheme();
      const btnD = document.getElementById('theme-btn-dark');
      const btnL = document.getElementById('theme-btn-light');
      if (btnD) btnD.classList.toggle('theme-btn-active', tema === 'dark');
      if (btnL) btnL.classList.toggle('theme-btn-active', tema === 'light');
    }
  }, 500);

  // ── Fase 13: navegação via URL (shortcuts do PWA) ──
  // ex: index.html?tab=conferencia
  const urlTab = new URLSearchParams(location.search).get('tab');
  if (urlTab) {
    const btn = [...document.querySelectorAll('.ntab')]
      .find(b => b.getAttribute('onclick')?.includes(`'${urlTab}'`));
    if (btn) btn.click();
  }
}

/**
 * Exibe/oculta indicador de carregamento no live-strip
 * enquanto o IndexedDB está abrindo.
 * @param {boolean} on
 */
function _setLoadingUI(on) {
  const strip = document.getElementById('live-strip');
  if (!strip) return;
  strip.innerHTML = on
    ? '<div class="live-chip" style="color:var(--mut)"><div class="spin" style="width:12px;height:12px;border-width:1.5px"></div> Carregando...</div>'
    : '';
}

/**
 * Wrapper local para chamar o banner de atualização do connectivity.js.
 * Usado pelo registro do SW quando detecta waiting state.
 */
function _exibirBannerAtualizacaoInline() {
  if (typeof _exibirBannerAtualizacao === 'function') {
    _exibirBannerAtualizacao('nova');
  }
}

// ── Ponto de entrada ──
init();
