/**
 * sync.js — DockCheck PRO · Fase 13 Etapa 9
 * Sincronização Realtime Mobile Enterprise
 *
 * Funcionalidades:
 *  1. Reconexão inteligente com backoff exponencial
 *  2. Detecção de mudança de rede (WiFi → 4G → offline)
 *  3. Heartbeat para manter conexão ativa
 *  4. Fila de mensagens perdidas durante desconexão
 *  5. Indicador de latência no header
 *  6. Modo de baixa largura de banda
 *
 * Depende de: backend.js (getToken, _socket via getSyncSocket())
 * Expõe: syncInit(), syncGetLatencia(), syncGetStatus(), syncGetModo()
 *        syncSetModoBaixaBanda(bool), syncForcarReconexao()
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONFIGURAÇÃO
════════════════════════════════════════════════════════════ */

const SYNC_CONFIG = {
  // Heartbeat
  HEARTBEAT_INTERVAL_MS:    30_000,   // ping a cada 30s
  HEARTBEAT_TIMEOUT_MS:     8_000,    // se não responder em 8s → reconectar

  // Backoff exponencial
  BACKOFF_BASE_MS:          1_000,    // início: 1s
  BACKOFF_MAX_MS:           60_000,   // máximo: 60s
  BACKOFF_FACTOR:           2,        // dobra a cada tentativa
  BACKOFF_JITTER_MS:        500,      // ±500ms de jitter

  // Fila de mensagens
  MSG_QUEUE_MAX:            100,      // máximo de mensagens na fila
  MSG_QUEUE_KEY:            'dc_msg_queue',

  // Baixa largura de banda
  BAIXA_BANDA_THRESHOLD_MS: 2_000,   // latência > 2s → sugerir baixa banda
  BAIXA_BANDA_KEY:          'dc_baixa_banda',

  // Latência
  LATENCIA_SAMPLES:         5,        // média móvel de 5 amostras
};

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */

const _sync = {
  socket:            null,
  conectado:         false,
  tentativas:        0,
  backoffMs:         SYNC_CONFIG.BACKOFF_BASE_MS,
  heartbeatTimer:    null,
  heartbeatTimeout:  null,
  reconnectTimer:    null,
  latencias:         [],          // amostras de latência
  latenciaMedia:     0,
  msgQueue:          [],          // fila de mensagens pendentes
  modoBaixaBanda:    false,
  tipoRede:          'unknown',   // '4g' | 'wifi' | 'unknown'
  iniciado:          false,
};

/* ════════════════════════════════════════════════════════════
   API PÚBLICA
════════════════════════════════════════════════════════════ */

/** Retorna latência média atual em ms */
function syncGetLatencia() { return Math.round(_sync.latenciaMedia); }

/** Retorna status atual da conexão */
function syncGetStatus() {
  return {
    conectado:     _sync.conectado,
    tentativas:    _sync.tentativas,
    latencia:      syncGetLatencia(),
    tipoRede:      _sync.tipoRede,
    baixaBanda:    _sync.modoBaixaBanda,
    msgPendentes:  _sync.msgQueue.length,
  };
}

/** Retorna modo atual */
function syncGetModo() {
  if (!_sync.conectado) return 'offline';
  if (_sync.modoBaixaBanda) return 'baixa-banda';
  return 'normal';
}

/** Ativa/desativa modo de baixa largura de banda manualmente */
function syncSetModoBaixaBanda(ativo) {
  _sync.modoBaixaBanda = ativo;
  localStorage.setItem(SYNC_CONFIG.BAIXA_BANDA_KEY, ativo ? '1' : '0');
  _atualizarIndicador();
  _renderIndicadorLatencia();
  if (ativo) {
    toast('📶 Modo baixa banda ativo — atualizações reduzidas');
    _aplicarModoBaixaBanda();
  } else {
    toast('📶 Modo normal restaurado');
    _removerModoBaixaBanda();
  }
}

/** Força reconexão imediata */
function syncForcarReconexao() {
  _sync.tentativas = 0;
  _sync.backoffMs  = SYNC_CONFIG.BACKOFF_BASE_MS;
  if (_sync.reconnectTimer) clearTimeout(_sync.reconnectTimer);
  _reconectar();
}

/* ════════════════════════════════════════════════════════════
   DETECÇÃO DE TIPO DE REDE
════════════════════════════════════════════════════════════ */

function _detectarTipoRede() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'unknown';

  const tipo = conn.effectiveType || conn.type || 'unknown';
  // Mapear para categorias simples
  if (['wifi', 'ethernet'].includes(tipo)) return 'wifi';
  if (['4g', '3g'].includes(tipo)) return '4g';
  if (['2g', 'slow-2g'].includes(tipo)) return '2g';
  return tipo;
}

function _monitorarRede() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return;

  conn.addEventListener('change', () => {
    const novoTipo = _detectarTipoRede();
    const tipoAnterior = _sync.tipoRede;
    _sync.tipoRede = novoTipo;

    console.info(`[Sync] Rede mudou: ${tipoAnterior} → ${novoTipo}`);

    // Ao mudar de rede, força reconexão (IP pode ter mudado)
    if (tipoAnterior !== novoTipo && navigator.onLine) {
      setTimeout(() => {
        if (!_sync.conectado) syncForcarReconexao();
      }, 1000);
    }

    // 2G → sugerir modo baixa banda
    if (novoTipo === '2g' && !_sync.modoBaixaBanda) {
      _sugerirBaixaBanda();
    }

    _renderIndicadorLatencia();
  });
}

/* ════════════════════════════════════════════════════════════
   HEARTBEAT
════════════════════════════════════════════════════════════ */

function _iniciarHeartbeat() {
  _pararHeartbeat();
  _sync.heartbeatTimer = setInterval(_ping, SYNC_CONFIG.HEARTBEAT_INTERVAL_MS);
}

function _pararHeartbeat() {
  if (_sync.heartbeatTimer)   clearInterval(_sync.heartbeatTimer);
  if (_sync.heartbeatTimeout) clearTimeout(_sync.heartbeatTimeout);
  _sync.heartbeatTimer   = null;
  _sync.heartbeatTimeout = null;
}

function _ping() {
  const socket = _getSocket();
  if (!socket || !_sync.conectado) return;

  const t0 = Date.now();
  socket.emit('ping', { timestamp: t0 });

  // Timeout — se não pingar de volta, reconecta
  _sync.heartbeatTimeout = setTimeout(() => {
    console.warn('[Sync] Heartbeat timeout — reconectando...');
    _onDesconectado('heartbeat_timeout');
    syncForcarReconexao();
  }, SYNC_CONFIG.HEARTBEAT_TIMEOUT_MS);
}

function _onPong(data) {
  if (_sync.heartbeatTimeout) {
    clearTimeout(_sync.heartbeatTimeout);
    _sync.heartbeatTimeout = null;
  }

  const latencia = Date.now() - (data?.timestamp || Date.now());
  _registrarLatencia(latencia);
}

/* ════════════════════════════════════════════════════════════
   LATÊNCIA
════════════════════════════════════════════════════════════ */

function _registrarLatencia(ms) {
  _sync.latencias.push(ms);
  if (_sync.latencias.length > SYNC_CONFIG.LATENCIA_SAMPLES) {
    _sync.latencias.shift();
  }
  _sync.latenciaMedia = _sync.latencias.reduce((a, b) => a + b, 0) / _sync.latencias.length;

  _renderIndicadorLatencia();

  // Alta latência → sugerir baixa banda
  if (_sync.latenciaMedia > SYNC_CONFIG.BAIXA_BANDA_THRESHOLD_MS && !_sync.modoBaixaBanda) {
    _sugerirBaixaBanda();
  }
}

/* ════════════════════════════════════════════════════════════
   BACKOFF EXPONENCIAL
════════════════════════════════════════════════════════════ */

function _calcularBackoff() {
  const jitter = Math.random() * SYNC_CONFIG.BACKOFF_JITTER_MS * 2 - SYNC_CONFIG.BACKOFF_JITTER_MS;
  const delay  = Math.min(_sync.backoffMs + jitter, SYNC_CONFIG.BACKOFF_MAX_MS);
  _sync.backoffMs = Math.min(_sync.backoffMs * SYNC_CONFIG.BACKOFF_FACTOR, SYNC_CONFIG.BACKOFF_MAX_MS);
  return Math.max(delay, 0);
}

function _resetarBackoff() {
  _sync.backoffMs  = SYNC_CONFIG.BACKOFF_BASE_MS;
  _sync.tentativas = 0;
}

/* ════════════════════════════════════════════════════════════
   FILA DE MENSAGENS PERDIDAS
════════════════════════════════════════════════════════════ */

function _enfileirarMensagem(evento, dados) {
  if (_sync.msgQueue.length >= SYNC_CONFIG.MSG_QUEUE_MAX) {
    _sync.msgQueue.shift(); // descarta mais antiga
  }
  _sync.msgQueue.push({ evento, dados, ts: Date.now() });
  _persistirFila();
}

function _processarFilaMensagens() {
  if (!_sync.msgQueue.length) return;
  const socket = _getSocket();
  if (!socket || !_sync.conectado) return;

  console.info(`[Sync] Processando ${_sync.msgQueue.length} mensagem(ns) da fila...`);
  const copia = [..._sync.msgQueue];
  _sync.msgQueue = [];
  _persistirFila();

  copia.forEach(({ evento, dados }) => {
    try { socket.emit(evento, dados); } catch (e) {
      console.warn('[Sync] Erro ao reenviar mensagem:', e);
      _enfileirarMensagem(evento, dados); // volta para fila
    }
  });
}

function _persistirFila() {
  try {
    localStorage.setItem(SYNC_CONFIG.MSG_QUEUE_KEY, JSON.stringify(_sync.msgQueue));
  } catch {}
}

function _carregarFila() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG.MSG_QUEUE_KEY);
    _sync.msgQueue = raw ? JSON.parse(raw) : [];
    // Descartar mensagens com mais de 1 hora
    const limite = Date.now() - 3_600_000;
    _sync.msgQueue = _sync.msgQueue.filter(m => m.ts > limite);
    _persistirFila();
  } catch { _sync.msgQueue = []; }
}

/* ════════════════════════════════════════════════════════════
   MODO BAIXA BANDA
════════════════════════════════════════════════════════════ */

function _aplicarModoBaixaBanda() {
  // Reduz frequência de heartbeat
  _pararHeartbeat();
  if (_sync.conectado) {
    _sync.heartbeatTimer = setInterval(_ping, SYNC_CONFIG.HEARTBEAT_INTERVAL_MS * 3);
  }

  // Desativa animações pesadas
  document.documentElement.classList.add('baixa-banda');
  _injetarCSSBaixaBanda();
}

function _removerModoBaixaBanda() {
  _pararHeartbeat();
  if (_sync.conectado) _iniciarHeartbeat();
  document.documentElement.classList.remove('baixa-banda');
}

function _injetarCSSBaixaBanda() {
  if (document.getElementById('sync-baixa-banda-css')) return;
  const style = document.createElement('style');
  style.id = 'sync-baixa-banda-css';
  style.textContent = `
    html.baixa-banda * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
    html.baixa-banda .blink,
    html.baixa-banda .blink-badge,
    html.baixa-banda .dh-pulse-ring { animation: none !important; }
  `;
  document.head.appendChild(style);
}

function _sugerirBaixaBanda() {
  // Mostrar banner apenas uma vez por sessão
  if (sessionStorage.getItem('dc_baixabanda_sugerido')) return;
  sessionStorage.setItem('dc_baixabanda_sugerido', '1');

  const banner = document.createElement('div');
  banner.id = 'sync-baixabanda-banner';
  banner.style.cssText = `
    position:fixed; bottom:70px; left:12px; right:12px;
    background:var(--bg2); border:1px solid var(--brd);
    border-radius:10px; padding:12px 14px;
    display:flex; align-items:center; gap:10px;
    z-index:8000; box-shadow:0 4px 20px rgba(0,0,0,.4);
    animation:slideUp .3s ease;
    font-size:.8rem;
  `;
  banner.innerHTML = `
    <span style="font-size:1.2rem">📶</span>
    <div style="flex:1">
      <div style="font-weight:700;color:var(--txt)">Conexão lenta detectada</div>
      <div style="color:var(--mut);font-size:.72rem">Latência: ${syncGetLatencia()}ms</div>
    </div>
    <button onclick="syncSetModoBaixaBanda(true);this.closest('#sync-baixabanda-banner').remove()"
      style="background:var(--acc);color:#000;border:none;border-radius:6px;
             padding:6px 12px;font-weight:700;font-size:.75rem;cursor:pointer;white-space:nowrap">
      Ativar
    </button>
    <button onclick="this.closest('#sync-baixabanda-banner').remove()"
      style="background:none;border:1px solid var(--brd);color:var(--mut);
             border-radius:6px;padding:6px 10px;font-size:.75rem;cursor:pointer">
      ✕
    </button>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 10_000);
}

/* ════════════════════════════════════════════════════════════
   INDICADOR DE LATÊNCIA E STATUS
════════════════════════════════════════════════════════════ */

function _injetarIndicadorLatencia() {
  if (document.getElementById('sync-latencia')) return;

  const el = document.createElement('div');
  el.id = 'sync-latencia';
  el.style.cssText = `
    display:none;
    align-items:center;
    gap:4px;
    font-family:'Barlow Condensed',sans-serif;
    font-size:10px;
    font-weight:700;
    letter-spacing:.3px;
    padding:3px 8px;
    border-radius:20px;
    border:1px solid;
    cursor:pointer;
    white-space:nowrap;
    transition:all .3s;
  `;
  el.title = 'Status da conexão realtime';
  el.onclick = () => _mostrarPainelSync();

  const target = document.querySelector('.topbar-right');
  if (target) target.prepend(el);
}

function _renderIndicadorLatencia() {
  const el = document.getElementById('sync-latencia');
  if (!el) return;

  if (!_sync.conectado) {
    el.style.display     = 'flex';
    el.style.color       = 'var(--red)';
    el.style.borderColor = 'rgba(239,68,68,.4)';
    el.style.background  = 'rgba(239,68,68,.1)';
    el.innerHTML = `📡 OFFLINE`;
    return;
  }

  const lat  = syncGetLatencia();
  const rede = _sync.tipoRede;
  const icone = rede === 'wifi' ? '📶' : rede === '4g' ? '📱' : '🌐';

  // Cor por latência
  let cor = 'var(--grn)';
  let bg  = 'rgba(16,185,129,.1)';
  let brd = 'rgba(16,185,129,.4)';
  if (lat > 500) { cor = 'var(--acc)'; bg = 'rgba(245,158,11,.1)'; brd = 'rgba(245,158,11,.4)'; }
  if (lat > 1500) { cor = 'var(--red)'; bg = 'rgba(239,68,68,.1)'; brd = 'rgba(239,68,68,.4)'; }

  el.style.display     = 'flex';
  el.style.color       = cor;
  el.style.borderColor = brd;
  el.style.background  = bg;

  const latStr = lat > 0 ? `${lat}ms` : '···';
  const banda  = _sync.modoBaixaBanda ? ' · ↓' : '';
  el.innerHTML = `${icone} ${latStr}${banda}`;
}

function _atualizarIndicador() {
  _renderIndicadorLatencia();
}

/* ════════════════════════════════════════════════════════════
   PAINEL DE STATUS SYNC
════════════════════════════════════════════════════════════ */

function _mostrarPainelSync() {
  const existente = document.getElementById('sync-painel');
  if (existente) { existente.remove(); return; }

  const status = syncGetStatus();
  const painel = document.createElement('div');
  painel.id = 'sync-painel';
  painel.style.cssText = `
    position:fixed; top:50px; right:8px;
    background:var(--bg2); border:1px solid var(--brd);
    border-radius:10px; padding:14px;
    z-index:9000; min-width:220px;
    box-shadow:0 4px 20px rgba(0,0,0,.5);
    font-size:.8rem;
    animation:mcFadeIn .2s ease;
  `;

  const statusColor = status.conectado ? 'var(--grn)' : 'var(--red)';
  const modoStr = status.baixaBanda ? '⬇ Baixa banda' : status.conectado ? '✅ Normal' : '❌ Offline';
  const redeStr = { wifi: '📶 WiFi', '4g': '📱 4G/5G', '2g': '🐌 2G', unknown: '🌐 Desconhecida' }[status.tipoRede] || status.tipoRede;

  painel.innerHTML = `
    <div style="font-weight:800;font-size:.9rem;color:var(--txt);margin-bottom:12px;
      display:flex;justify-content:space-between;align-items:center">
      📡 Sincronização
      <button onclick="document.getElementById('sync-painel').remove()"
        style="background:none;border:none;color:var(--mut);font-size:1rem;cursor:pointer">✕</button>
    </div>
    <div style="display:grid;gap:8px">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Status</span>
        <span style="color:${statusColor};font-weight:700">${status.conectado ? '● Conectado' : '○ Offline'}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Latência</span>
        <span style="color:var(--txt);font-weight:700">${status.latencia > 0 ? status.latencia + 'ms' : '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Rede</span>
        <span style="color:var(--txt)">${redeStr}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Modo</span>
        <span style="color:var(--txt)">${modoStr}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Tentativas</span>
        <span style="color:var(--txt)">${status.tentativas}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Msgs pendentes</span>
        <span style="color:${status.msgPendentes > 0 ? 'var(--acc)' : 'var(--txt)'};font-weight:700">
          ${status.msgPendentes}
        </span>
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
      <button onclick="syncForcarReconexao();document.getElementById('sync-painel')?.remove()"
        style="flex:1;padding:7px;background:var(--bg);border:1px solid var(--brd);
          border-radius:6px;color:var(--txt);font-size:.75rem;font-weight:700;cursor:pointer">
        ⟳ Reconectar
      </button>
      <button onclick="syncSetModoBaixaBanda(${!status.baixaBanda});document.getElementById('sync-painel')?.remove()"
        style="flex:1;padding:7px;background:var(--bg);border:1px solid var(--brd);
          border-radius:6px;color:var(--txt);font-size:.75rem;font-weight:700;cursor:pointer">
        ${status.baixaBanda ? '📶 Normal' : '⬇ Baixa banda'}
      </button>
    </div>
  `;
  document.body.appendChild(painel);

  // Fecha ao clicar fora
  setTimeout(() => {
    const handler = (e) => {
      if (!painel.contains(e.target)) { painel.remove(); document.removeEventListener('click', handler); }
    };
    document.addEventListener('click', handler);
  }, 100);
}

/* ════════════════════════════════════════════════════════════
   SOCKET — ACESSO E RECONEXÃO
════════════════════════════════════════════════════════════ */

/** Tenta pegar o socket ativo do backend.js */
function _getSocket() {
  // backend.js expõe _socket via getSyncSocket() se disponível
  if (typeof getSyncSocket === 'function') return getSyncSocket();
  return _sync.socket;
}

function _onConectado() {
  _sync.conectado = true;
  _sync.tentativas = 0;
  _resetarBackoff();
  _iniciarHeartbeat();
  _processarFilaMensagens();
  _renderIndicadorLatencia();
  console.info('[Sync] Conectado ✅');
}

function _onDesconectado(motivo) {
  _sync.conectado = false;
  _pararHeartbeat();
  _renderIndicadorLatencia();
  console.warn('[Sync] Desconectado:', motivo);
}

function _reconectar() {
  if (!navigator.onLine) {
    console.info('[Sync] Offline — aguardando conexão...');
    return;
  }

  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;

  _sync.tentativas++;
  const delay = _calcularBackoff();
  console.info(`[Sync] Tentativa ${_sync.tentativas} em ${Math.round(delay)}ms...`);

  _sync.reconnectTimer = setTimeout(() => {
    // Tenta via backend.js
    if (typeof _conectarSocket === 'function') {
      _conectarSocket();
    }
  }, delay);
}

/* ════════════════════════════════════════════════════════════
   INTEGRAÇÃO COM backend.js
   Monkey-patches nos eventos do socket após backendInit()
════════════════════════════════════════════════════════════ */

function _hookSocket() {
  const socket = _getSocket();
  if (!socket) return;

  // Já hookado
  if (socket._syncHooked) return;
  socket._syncHooked = true;

  // Sobrescreve handlers existentes
  socket.on('connect', () => _onConectado());
  socket.on('disconnect', (reason) => _onDesconectado(reason));
  socket.on('connect_error', (err) => _onDesconectado(err.message));
  socket.on('pong', (data) => _onPong(data));

  // Detecta se já está conectado
  if (socket.connected) _onConectado();

  console.info('[Sync] Hooks instalados no socket ✅');
}

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

function syncInit() {
  if (_sync.iniciado) return;
  _sync.iniciado = true;

  // Carregar configuração salva
  _sync.modoBaixaBanda = localStorage.getItem(SYNC_CONFIG.BAIXA_BANDA_KEY) === '1';
  _carregarFila();
  _sync.tipoRede = _detectarTipoRede();

  // Injetar UI
  _injetarIndicadorLatencia();

  // Monitorar mudanças de rede
  _monitorarRede();

  // Eventos online/offline
  window.addEventListener('online', () => {
    console.info('[Sync] Voltou online');
    syncForcarReconexao();
  });

  window.addEventListener('offline', () => {
    _onDesconectado('browser_offline');
  });

  // Tentar hookar o socket após backendInit() (que é chamado depois)
  // Polling leve até o socket estar disponível
  let tentativasHook = 0;
  const hookInterval = setInterval(() => {
    tentativasHook++;
    const socket = _getSocket();
    if (socket) {
      _hookSocket();
      clearInterval(hookInterval);
    }
    if (tentativasHook > 30) clearInterval(hookInterval); // desiste após 30s
  }, 1000);

  // Modo baixa banda inicial
  if (_sync.modoBaixaBanda) _aplicarModoBaixaBanda();

  // Atualizar indicador periodicamente
  setInterval(_renderIndicadorLatencia, 5000);

  console.info('[Sync] Etapa 9 — Sincronização Realtime Mobile iniciada ✅');
}

// ─── Função auxiliar para backend.js expor o socket ───────
// Adicione isso ao backend.js:
//   function getSyncSocket() { return _socket; }
// Ou o sync.js funciona via eventos do socket.io diretamente.
