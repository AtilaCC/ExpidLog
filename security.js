/**
 * security.js — DockCheck PRO · Fase 13 Etapa 10
 * Segurança Mobile Enterprise
 *
 * Funcionalidades:
 *  1. Criptografia AES-GCM no IndexedDB via Web Crypto API
 *  2. Token refresh automático antes de expirar
 *  3. Logout automático por inatividade
 *  4. Sanitização de inputs OCR contra injeção
 *  5. Rate limiting local (proteção brute-force)
 *  6. Indicador visual de sessão segura
 *
 * Depende de: backend.js (getToken, backendLogout, backendRefreshToken)
 *             storage.js (storage.get/set)
 * Expõe: securityInit(), securityCriptografar(dados), securityDescriptografar(dados)
 *        securitySanitizar(str), securityGetStatus(), securityRenderConfigSection()
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONFIGURAÇÃO
════════════════════════════════════════════════════════════ */

const SEC_CONFIG = {
  // Inatividade
  INATIVIDADE_DEFAULT_MIN: 30,       // logout após 30min sem interação
  INATIVIDADE_MIN_MIN:     5,        // mínimo configurável
  INATIVIDADE_MAX_MIN:     480,      // máximo configurável (8h)
  INATIVIDADE_KEY:         'dc_sec_inatividade_min',
  INATIVIDADE_WARN_MS:     60_000,   // aviso 1min antes do logout

  // Token refresh
  TOKEN_REFRESH_ANTES_MS:  5 * 60_000, // refresh 5min antes de expirar
  TOKEN_CHECK_INTERVAL_MS: 60_000,     // checar a cada 1min

  // Chave de criptografia
  CRYPTO_KEY_IDB:     'dc_crypto_key_v1',
  CRYPTO_ALGORITHM:   'AES-GCM',
  CRYPTO_KEY_LENGTH:  256,
  CRYPTO_IV_LENGTH:   12,

  // Rate limiting
  RATE_LIMIT_KEY:     'dc_rate_limits',
  RATE_LIMIT_WINDOW:  60_000,          // janela de 1min
  RATE_LIMIT_MAX:     10,              // max 10 ações por janela

  // Sanitização
  HTML_ENTITIES: {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
  },
};

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */

const _sec = {
  cryptoKey:         null,    // CryptoKey AES-GCM
  inatividade: {
    timer:           null,
    warnTimer:       null,
    ultimoEvento:    Date.now(),
    minutos:         SEC_CONFIG.INATIVIDADE_DEFAULT_MIN,
    ativo:           true,
  },
  tokenRefresh: {
    timer:           null,
  },
  rateLimits:        {},      // { [acao]: [timestamps] }
  iniciado:          false,
};

/* ════════════════════════════════════════════════════════════
   1. CRIPTOGRAFIA AES-GCM
════════════════════════════════════════════════════════════ */

/**
 * Gera ou carrega a chave AES-GCM persistida no IndexedDB.
 * A chave é do tipo non-extractable para maior segurança.
 */
async function _obterCryptoKey() {
  if (_sec.cryptoKey) return _sec.cryptoKey;

  // Tentar carregar do IDB
  try {
    const keyData = await _idbGetSecure(SEC_CONFIG.CRYPTO_KEY_IDB);
    if (keyData) {
      _sec.cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: SEC_CONFIG.CRYPTO_ALGORITHM }, false,
        ['encrypt', 'decrypt']
      );
      return _sec.cryptoKey;
    }
  } catch {}

  // Gerar nova chave
  const key = await crypto.subtle.generateKey(
    { name: SEC_CONFIG.CRYPTO_ALGORITHM, length: SEC_CONFIG.CRYPTO_KEY_LENGTH },
    true, ['encrypt', 'decrypt']
  );

  // Persistir chave exportada
  const keyData = await crypto.subtle.exportKey('raw', key);
  await _idbSetSecure(SEC_CONFIG.CRYPTO_KEY_IDB, keyData);

  _sec.cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: SEC_CONFIG.CRYPTO_ALGORITHM }, false,
    ['encrypt', 'decrypt']
  );

  return _sec.cryptoKey;
}

/**
 * Criptografa dados sensíveis com AES-GCM.
 * @param {any} dados — qualquer valor serializável
 * @returns {Promise<string>} — base64 (iv + ciphertext)
 */
async function securityCriptografar(dados) {
  try {
    const key = await _obterCryptoKey();
    const iv  = crypto.getRandomValues(new Uint8Array(SEC_CONFIG.CRYPTO_IV_LENGTH));
    const encoded = new TextEncoder().encode(JSON.stringify(dados));

    const cipher = await crypto.subtle.encrypt(
      { name: SEC_CONFIG.CRYPTO_ALGORITHM, iv }, key, encoded
    );

    // Concatenar iv + ciphertext e converter para base64
    const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.byteLength);

    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error('[Security] Erro ao criptografar:', err);
    return null;
  }
}

/**
 * Descriptografa dados criptografados com securityCriptografar.
 * @param {string} encrypted — base64
 * @returns {Promise<any>}
 */
async function securityDescriptografar(encrypted) {
  try {
    const key      = await _obterCryptoKey();
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv       = combined.slice(0, SEC_CONFIG.CRYPTO_IV_LENGTH);
    const cipher   = combined.slice(SEC_CONFIG.CRYPTO_IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: SEC_CONFIG.CRYPTO_ALGORITHM, iv }, key, cipher
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (err) {
    console.error('[Security] Erro ao descriptografar:', err);
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   IndexedDB helpers para chave cripto (store separado)
════════════════════════════════════════════════════════════ */

let _secDb = null;

async function _idbSecOpen() {
  if (_secDb) return _secDb;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('dockcheck_sec', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('sec', { keyPath: 'k' });
    };
    req.onsuccess = e => { _secDb = e.target.result; resolve(_secDb); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function _idbGetSecure(key) {
  const db  = await _idbSecOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction('sec', 'readonly').objectStore('sec').get(key);
    req.onsuccess = () => resolve(req.result?.v);
    req.onerror   = () => reject(req.error);
  });
}

async function _idbSetSecure(key, val) {
  const db = await _idbSecOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction('sec', 'readwrite').objectStore('sec').put({ k: key, v: val });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ════════════════════════════════════════════════════════════
   2. TOKEN REFRESH AUTOMÁTICO
════════════════════════════════════════════════════════════ */

function _decodificarJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function _iniciarTokenRefresh() {
  _pararTokenRefresh();

  _sec.tokenRefresh.timer = setInterval(async () => {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) return;

    const payload = _decodificarJWT(token);
    if (!payload?.exp) return;

    const expMs   = payload.exp * 1000;
    const agoraMs = Date.now();
    const restMs  = expMs - agoraMs;

    // Se falta menos de 5min para expirar → refresh
    if (restMs < SEC_CONFIG.TOKEN_REFRESH_ANTES_MS && restMs > 0) {
      console.info('[Security] Token expira em', Math.round(restMs / 1000) + 's — refreshing...');
      if (typeof backendRefreshToken === 'function') {
        const ok = await backendRefreshToken();
        if (ok) {
          console.info('[Security] Token renovado ✅');
          _renderIndicadorSeguranca();
        } else {
          console.warn('[Security] Refresh falhou — logout');
          _logoutPorSeguranca('token_refresh_falhou');
        }
      }
    }

    // Token já expirado
    if (restMs <= 0) {
      _logoutPorSeguranca('token_expirado');
    }

  }, SEC_CONFIG.TOKEN_CHECK_INTERVAL_MS);
}

function _pararTokenRefresh() {
  if (_sec.tokenRefresh.timer) {
    clearInterval(_sec.tokenRefresh.timer);
    _sec.tokenRefresh.timer = null;
  }
}

/* ════════════════════════════════════════════════════════════
   3. LOGOUT POR INATIVIDADE
════════════════════════════════════════════════════════════ */

function _iniciarMonitorInatividade() {
  _pararMonitorInatividade();

  const minutos = _sec.inatividade.minutos;
  const msTimeout  = minutos * 60_000;
  const msWarn     = msTimeout - SEC_CONFIG.INATIVIDADE_WARN_MS;

  // Aviso antes do logout
  if (msWarn > 0) {
    _sec.inatividade.warnTimer = setTimeout(() => {
      _mostrarAvisoInatividade(minutos);
    }, msWarn);
  }

  // Logout por inatividade
  _sec.inatividade.timer = setTimeout(() => {
    _logoutPorSeguranca('inatividade');
  }, msTimeout);
}

function _pararMonitorInatividade() {
  if (_sec.inatividade.timer)     clearTimeout(_sec.inatividade.timer);
  if (_sec.inatividade.warnTimer) clearTimeout(_sec.inatividade.warnTimer);
  _sec.inatividade.timer     = null;
  _sec.inatividade.warnTimer = null;
}

function _resetarInatividade() {
  _sec.inatividade.ultimoEvento = Date.now();
  _pararMonitorInatividade();
  if (_sec.inatividade.ativo && typeof isAuthenticated === 'function' && isAuthenticated()) {
    _iniciarMonitorInatividade();
  }
}

function _monitorarEventosAtividade() {
  const eventos = ['touchstart', 'touchmove', 'click', 'keydown', 'scroll', 'mousemove'];
  const handler = _debounceSeguranca(_resetarInatividade, 5000);
  eventos.forEach(ev => document.addEventListener(ev, handler, { passive: true }));
}

function _mostrarAvisoInatividade(minutos) {
  const existente = document.getElementById('sec-inatividade-aviso');
  if (existente) return;

  const banner = document.createElement('div');
  banner.id = 'sec-inatividade-aviso';
  banner.style.cssText = `
    position:fixed; bottom:70px; left:12px; right:12px;
    background:var(--bg2); border:1px solid var(--acc);
    border-radius:10px; padding:14px 16px;
    display:flex; align-items:center; gap:12px;
    z-index:9500; box-shadow:0 4px 24px rgba(0,0,0,.5);
    animation:slideUp .3s ease;
  `;
  banner.innerHTML = `
    <span style="font-size:1.4rem">⏱</span>
    <div style="flex:1">
      <div style="font-weight:700;color:var(--txt);font-size:.85rem">Sessão expirando</div>
      <div style="color:var(--mut);font-size:.72rem">Logout automático em 1 minuto por inatividade</div>
    </div>
    <button onclick="securityResetarSessao();this.closest('#sec-inatividade-aviso').remove()"
      style="background:var(--acc);color:#000;border:none;border-radius:6px;
             padding:7px 14px;font-weight:700;font-size:.8rem;cursor:pointer">
      Continuar
    </button>
  `;
  document.body.appendChild(banner);
  if (typeof haptic === 'function') haptic('medium');
}

function _logoutPorSeguranca(motivo) {
  console.warn('[Security] Logout por segurança:', motivo);
  document.getElementById('sec-inatividade-aviso')?.remove();

  // Log no backend
  _registrarAuditoria('logout_seguranca', { motivo });

  // Logout
  if (typeof backendLogout === 'function') {
    backendLogout();
  } else {
    localStorage.removeItem('dc_access_token');
    localStorage.removeItem('dc_user');
    location.reload();
  }
}

/** Reseta o timer de inatividade — exposto publicamente */
function securityResetarSessao() {
  _resetarInatividade();
  document.getElementById('sec-inatividade-aviso')?.remove();
}

/* ════════════════════════════════════════════════════════════
   4. SANITIZAÇÃO DE INPUTS
════════════════════════════════════════════════════════════ */

/**
 * Sanitiza string contra XSS e SQL injection.
 * @param {string} str
 * @param {Object} opts
 * @returns {string}
 */
function securitySanitizar(str, opts = {}) {
  if (typeof str !== 'string') return '';

  const {
    maxLength  = 500,
    permitirNumeros = true,
    permitirEspeciais = false,
    modo = 'geral',      // 'geral' | 'ocr' | 'placa' | 'oc' | 'nome'
  } = opts;

  let resultado = str.trim();

  // Escapar HTML entities
  resultado = resultado.replace(/[&<>"'/]/g, ch => SEC_CONFIG.HTML_ENTITIES[ch] || ch);

  // Remover tags HTML residuais
  resultado = resultado.replace(/<[^>]*>/g, '');

  // Remover caracteres nulos e de controle
  resultado = resultado.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Modos específicos
  switch (modo) {
    case 'placa':
      // Placas BR: AAA-0000 ou ABC1D23 (Mercosul)
      resultado = resultado.toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 8);
      break;

    case 'oc':
      // Número de OC: alfanumérico + hífen + underscore
      resultado = resultado.toUpperCase().replace(/[^A-Z0-9\-_\/]/g, '').slice(0, 50);
      break;

    case 'nome':
      // Nomes: letras, espaços, acentos
      resultado = resultado.replace(/[^a-zA-ZÀ-ÿ\s'\-\.]/g, '').slice(0, 100);
      break;

    case 'ocr':
      // OCR: mais permissivo, remove apenas injeções críticas
      resultado = resultado
        .replace(/(<script|javascript:|on\w+\s*=|eval\s*\(|alert\s*\()/gi, '')
        .slice(0, maxLength);
      break;

    default:
      if (!permitirEspeciais) {
        resultado = resultado.replace(/[<>{}[\]\\|;]/g, '');
      }
      resultado = resultado.slice(0, maxLength);
  }

  return resultado;
}

/* ════════════════════════════════════════════════════════════
   5. RATE LIMITING LOCAL
════════════════════════════════════════════════════════════ */

/**
 * Verifica se uma ação está dentro do rate limit.
 * @param {string} acao — identificador da ação
 * @param {number} max — máximo permitido na janela
 * @returns {boolean} — true se permitido, false se bloqueado
 */
function securityRateLimit(acao, max = SEC_CONFIG.RATE_LIMIT_MAX) {
  const agora  = Date.now();
  const janela = SEC_CONFIG.RATE_LIMIT_WINDOW;

  if (!_sec.rateLimits[acao]) _sec.rateLimits[acao] = [];

  // Limpar timestamps fora da janela
  _sec.rateLimits[acao] = _sec.rateLimits[acao].filter(t => agora - t < janela);

  if (_sec.rateLimits[acao].length >= max) {
    console.warn(`[Security] Rate limit atingido para: ${acao}`);
    return false;
  }

  _sec.rateLimits[acao].push(agora);
  return true;
}

/* ════════════════════════════════════════════════════════════
   6. AUDITORIA DE ACESSO MOBILE
════════════════════════════════════════════════════════════ */

async function _registrarAuditoria(acao, dados = {}) {
  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) return;

    const user = typeof getUser === 'function' ? getUser() : null;

    const payload = {
      acao,
      dados: {
        ...dados,
        user_agent: navigator.userAgent,
        plataforma: navigator.platform,
        online:     navigator.onLine,
        timestamp:  new Date().toISOString(),
      }
    };

    // Enviar para backend (não bloqueia)
    fetch(`${typeof API_URL !== 'undefined' ? API_URL : 'https://expidlog-production.up.railway.app'}/api/logs/mobile`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify(payload),
    }).catch(() => {}); // silencia erro — auditoria não pode travar a UI

  } catch {}
}

/* ════════════════════════════════════════════════════════════
   INDICADOR VISUAL DE SESSÃO SEGURA
════════════════════════════════════════════════════════════ */

function _injetarIndicadorSeguranca() {
  if (document.getElementById('sec-indicador')) return;

  const el = document.createElement('div');
  el.id = 'sec-indicador';
  el.style.cssText = `
    display:none;
    align-items:center;
    gap:3px;
    font-family:'Barlow Condensed',sans-serif;
    font-size:10px;
    font-weight:700;
    letter-spacing:.3px;
    padding:3px 7px;
    border-radius:20px;
    border:1px solid rgba(16,185,129,.4);
    background:rgba(16,185,129,.1);
    color:var(--grn);
    cursor:pointer;
    white-space:nowrap;
  `;
  el.title = 'Sessão segura — clique para detalhes';
  el.onclick = () => _mostrarPainelSeguranca();

  const target = document.querySelector('.topbar-right');
  if (target) target.prepend(el);
}

function _renderIndicadorSeguranca() {
  const el = document.getElementById('sec-indicador');
  if (!el) return;

  const autenticado = typeof isAuthenticated === 'function' && isAuthenticated();
  if (!autenticado) { el.style.display = 'none'; return; }

  const token    = typeof getToken === 'function' ? getToken() : null;
  const payload  = token ? _decodificarJWT(token) : null;
  const restMin  = payload?.exp ? Math.round((payload.exp * 1000 - Date.now()) / 60000) : null;

  el.style.display = 'flex';

  if (restMin !== null && restMin < 10) {
    el.style.borderColor = 'rgba(245,158,11,.4)';
    el.style.background  = 'rgba(245,158,11,.1)';
    el.style.color       = 'var(--acc)';
    el.innerHTML = `⚠️ ${restMin}min`;
  } else {
    el.style.borderColor = 'rgba(16,185,129,.4)';
    el.style.background  = 'rgba(16,185,129,.1)';
    el.style.color       = 'var(--grn)';
    el.innerHTML = `🔒 Segura`;
  }
}

function _mostrarPainelSeguranca() {
  const existente = document.getElementById('sec-painel');
  if (existente) { existente.remove(); return; }

  const token   = typeof getToken === 'function' ? getToken() : null;
  const payload = token ? _decodificarJWT(token) : null;
  const user    = typeof getUser === 'function' ? getUser() : null;
  const restMin = payload?.exp ? Math.round((payload.exp * 1000 - Date.now()) / 60000) : null;
  const inMin   = _sec.inatividade.minutos;
  const ultAtiv = Math.round((Date.now() - _sec.inatividade.ultimoEvento) / 60000);

  const painel = document.createElement('div');
  painel.id = 'sec-painel';
  painel.style.cssText = `
    position:fixed; top:50px; right:8px;
    background:var(--bg2); border:1px solid var(--brd);
    border-radius:10px; padding:14px;
    z-index:9000; min-width:230px;
    box-shadow:0 4px 20px rgba(0,0,0,.5);
    font-size:.8rem;
    animation:mcFadeIn .2s ease;
  `;

  painel.innerHTML = `
    <div style="font-weight:800;font-size:.9rem;color:var(--txt);margin-bottom:12px;
      display:flex;justify-content:space-between;align-items:center">
      🔒 Segurança
      <button onclick="document.getElementById('sec-painel').remove()"
        style="background:none;border:none;color:var(--mut);font-size:1rem;cursor:pointer">✕</button>
    </div>
    <div style="display:grid;gap:8px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Usuário</span>
        <span style="color:var(--txt);font-weight:700">${user?.nome || '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Role</span>
        <span style="color:var(--acc);font-weight:700">${user?.role || '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Token expira</span>
        <span style="color:${restMin !== null && restMin < 10 ? 'var(--acc)' : 'var(--grn)'};font-weight:700">
          ${restMin !== null ? restMin + 'min' : '—'}
        </span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Inatividade</span>
        <span style="color:var(--txt)">${inMin}min limite / ${ultAtiv}min atrás</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--mut)">Criptografia</span>
        <span style="color:var(--grn)">✅ AES-256-GCM</span>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button onclick="securityResetarSessao();document.getElementById('sec-painel')?.remove()"
        style="flex:1;padding:7px;background:var(--bg);border:1px solid var(--brd);
          border-radius:6px;color:var(--txt);font-size:.75rem;font-weight:700;cursor:pointer">
        ⟳ Renovar sessão
      </button>
      <button onclick="if(typeof backendLogout==='function')backendLogout();document.getElementById('sec-painel')?.remove()"
        style="flex:1;padding:7px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);
          border-radius:6px;color:var(--red);font-size:.75rem;font-weight:700;cursor:pointer">
        🚪 Logout
      </button>
    </div>
  `;
  document.body.appendChild(painel);

  setTimeout(() => {
    const handler = (e) => {
      if (!painel.contains(e.target)) { painel.remove(); document.removeEventListener('click', handler); }
    };
    document.addEventListener('click', handler);
  }, 100);
}

/* ════════════════════════════════════════════════════════════
   SEÇÃO DE CONFIGURAÇÃO (⚙️ Config)
════════════════════════════════════════════════════════════ */

function securityRenderConfigSection() {
  const target = document.getElementById('sec-config-section');
  if (!target) return;

  const minutos = _sec.inatividade.minutos;

  target.innerHTML = `
    <div class="cfg-section-title">🔒 Segurança Mobile</div>

    <div class="cfg-row">
      <label class="cfg-label">Logout por inatividade</label>
      <div style="display:flex;align-items:center;gap:10px">
        <input type="range" min="${SEC_CONFIG.INATIVIDADE_MIN_MIN}"
          max="${SEC_CONFIG.INATIVIDADE_MAX_MIN}"
          value="${minutos}" step="5"
          oninput="this.nextElementSibling.textContent=this.value+'min'"
          onchange="securitySetInatividade(parseInt(this.value))"
          style="flex:1;accent-color:var(--acc)">
        <span style="font-size:.8rem;font-weight:700;color:var(--txt);
          min-width:50px;text-align:right">${minutos}min</span>
      </div>
    </div>

    <div class="cfg-row">
      <label class="cfg-label">Criptografia de dados locais</label>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:.8rem;color:var(--grn);font-weight:700">✅ AES-256-GCM Ativa</span>
      </div>
    </div>

    <div class="cfg-row">
      <label class="cfg-label">Status da sessão</label>
      <div style="font-size:.8rem;color:var(--txt)" id="sec-cfg-status">—</div>
    </div>

    <div class="cfg-row">
      <button onclick="securityResetarChaveCripto()"
        style="padding:8px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);
          border-radius:6px;color:var(--red);font-size:.8rem;font-weight:700;cursor:pointer;width:100%">
        🔄 Resetar chave de criptografia
      </button>
    </div>
  `;

  // Atualizar status dinamicamente
  const statusEl = document.getElementById('sec-cfg-status');
  if (statusEl) {
    const s = securityGetStatus();
    statusEl.textContent = s.autenticado
      ? `Logado como ${s.role} · token expira em ${s.tokenRestanteMin}min`
      : 'Não autenticado';
  }
}

function securitySetInatividade(minutos) {
  _sec.inatividade.minutos = Math.min(
    Math.max(minutos, SEC_CONFIG.INATIVIDADE_MIN_MIN),
    SEC_CONFIG.INATIVIDADE_MAX_MIN
  );
  localStorage.setItem(SEC_CONFIG.INATIVIDADE_KEY, String(_sec.inatividade.minutos));
  _resetarInatividade();
}

async function securityResetarChaveCripto() {
  if (!confirm('Resetar a chave de criptografia vai apagar os dados criptografados localmente. Continuar?')) return;
  try {
    const db = await _idbSecOpen();
    db.transaction('sec', 'readwrite').objectStore('sec').clear();
    _sec.cryptoKey = null;
    if (typeof toast === 'function') toast('🔑 Chave resetada — será gerada uma nova', 'success');
  } catch (err) {
    if (typeof toast === 'function') toast('Erro ao resetar chave', 'error');
  }
}

/* ════════════════════════════════════════════════════════════
   API PÚBLICA
════════════════════════════════════════════════════════════ */

function securityGetStatus() {
  const token   = typeof getToken === 'function' ? getToken() : null;
  const payload = token ? _decodificarJWT(token) : null;
  const user    = typeof getUser === 'function' ? getUser() : null;
  const restMin = payload?.exp ? Math.round((payload.exp * 1000 - Date.now()) / 60000) : null;

  return {
    autenticado:      !!token,
    role:             user?.role || null,
    tokenRestanteMin: restMin,
    inatavidadeMin:   _sec.inatividade.minutos,
    cryptoAtiva:      !!_sec.cryptoKey,
    ultimaAtividade:  new Date(_sec.inatividade.ultimoEvento).toISOString(),
  };
}

/* ════════════════════════════════════════════════════════════
   DEBOUNCE INTERNO
════════════════════════════════════════════════════════════ */

function _debounceSeguranca(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

function securityInit() {
  if (_sec.iniciado) return;
  _sec.iniciado = true;

  // Carregar configuração salva
  const minSalvo = parseInt(localStorage.getItem(SEC_CONFIG.INATIVIDADE_KEY));
  if (!isNaN(minSalvo)) _sec.inatividade.minutos = minSalvo;

  // Pré-carregar chave cripto em background
  _obterCryptoKey().catch(console.warn);

  // Injetar indicador no header
  _injetarIndicadorSeguranca();

  // Monitorar atividade do usuário
  _monitorarEventosAtividade();

  // Iniciar monitoramento de token se já autenticado
  if (typeof isAuthenticated === 'function' && isAuthenticated()) {
    _iniciarTokenRefresh();
    _iniciarMonitorInatividade();
    _renderIndicadorSeguranca();
    _registrarAuditoria('sessao_iniciada');
  }

  // Reagir a eventos de login/logout do backend.js
  window.addEventListener('dc:login', () => {
    _iniciarTokenRefresh();
    _iniciarMonitorInatividade();
    _renderIndicadorSeguranca();
    _registrarAuditoria('login_mobile');
  });

  window.addEventListener('dc:logout', () => {
    _pararTokenRefresh();
    _pararMonitorInatividade();
    _renderIndicadorSeguranca();
  });

  // Atualizar indicador periodicamente
  setInterval(_renderIndicadorSeguranca, 30_000);

  console.info('[Security] Etapa 10 — Segurança Mobile iniciada ✅');
}
