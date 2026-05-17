/* ════════════════════════════════════════════════════════════
   DOCKCHECK PRO — OFFLINE ENTERPRISE · Fase 13 · Etapa 3

   Responsabilidades:
   1. Cache operacional no IndexedDB (OCs, docas, status)
   2. Fila de ações offline (conferências sem conexão)
   3. Sincronização automática ao reconectar
   4. Indicador visual de modo offline no header
   5. Recuperação automática sem perda de dados
════════════════════════════════════════════════════════════ */

'use strict';

/* ── Constantes ─────────────────────────────────────────── */
const OFFLINE_DB_NAME    = 'dockcheck-offline';
const OFFLINE_DB_VERSION = 1;
const STORE_FILA         = 'fila_offline';
const STORE_CACHE_OPS    = 'cache_operacional';

/* ── Estado ─────────────────────────────────────────────── */
let _offlineDB   = null;
let _syncando    = false;
let _filaCount   = 0;

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO DO INDEXEDDB OFFLINE
════════════════════════════════════════════════════════════ */
async function offlineInit() {
  try {
    _offlineDB = await _abrirOfflineDB();
    _filaCount = await _contarFila();
    _atualizarBadgeFila();
    console.info('[Offline] IndexedDB offline inicializado.');

    // Se reconectou com itens na fila, sincroniza
    if (navigator.onLine && _filaCount > 0) {
      await offlineSync();
    }
  } catch (err) {
    console.warn('[Offline] Falha ao inicializar DB offline:', err);
  }
}

function _abrirOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      // Store de fila de ações pendentes
      if (!db.objectStoreNames.contains(STORE_FILA)) {
        const store = db.createObjectStore(STORE_FILA, {
          keyPath: 'id', autoIncrement: true
        });
        store.createIndex('tipo',      'tipo',      { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store de cache operacional
      if (!db.objectStoreNames.contains(STORE_CACHE_OPS)) {
        db.createObjectStore(STORE_CACHE_OPS, { keyPath: 'chave' });
      }
    };

    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

/* ════════════════════════════════════════════════════════════
   FILA OFFLINE — adicionar ação
   Chamado por conferencia.js, fila.js etc. quando offline.
════════════════════════════════════════════════════════════ */

/**
 * Enfileira uma ação para sincronização posterior.
 * @param {string} tipo  — 'conferencia' | 'fila_entrada' | 'fila_saida' | 'ocorrencia'
 * @param {string} endpoint — ex: '/api/conferencias'
 * @param {string} method   — 'POST' | 'PUT' | 'DELETE'
 * @param {object} payload  — dados da ação
 */
async function offlineEnfileirar(tipo, endpoint, method, payload) {
  if (!_offlineDB) return;

  const acao = {
    tipo,
    endpoint,
    method,
    payload,
    timestamp: Date.now(),
    tentativas: 0,
  };

  await _dbAdd(STORE_FILA, acao);
  _filaCount++;
  _atualizarBadgeFila();

  if (typeof toast === 'function') {
    toast(`📥 Salvo offline — será sincronizado ao reconectar`);
  }

  console.info('[Offline] Ação enfileirada:', tipo, endpoint);
}

/* ════════════════════════════════════════════════════════════
   SINCRONIZAÇÃO — processa fila ao reconectar
════════════════════════════════════════════════════════════ */
async function offlineSync() {
  if (_syncando || !_offlineDB) return;
  if (!navigator.onLine) return;

  const itens = await _dbGetAll(STORE_FILA);
  if (!itens.length) return;

  _syncando = true;
  _mostrarBannerSync(itens.length);

  const token = localStorage.getItem('dc_access_token');
  let  ok = 0, falha = 0;

  for (const item of itens) {
    try {
      const res = await fetch(
        `https://expidlog-production.up.railway.app${item.endpoint}`,
        {
          method:  item.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: item.method !== 'DELETE' ? JSON.stringify(item.payload) : undefined,
        }
      );

      if (res.ok) {
        await _dbDelete(STORE_FILA, item.id);
        ok++;
      } else {
        // Incrementa tentativas — remove após 5 falhas
        item.tentativas = (item.tentativas || 0) + 1;
        if (item.tentativas >= 5) {
          await _dbDelete(STORE_FILA, item.id);
          console.warn('[Offline] Ação removida após 5 falhas:', item);
        } else {
          await _dbPut(STORE_FILA, item);
        }
        falha++;
      }
    } catch (err) {
      falha++;
      console.warn('[Offline] Falha ao sincronizar item:', err);
    }
  }

  _filaCount = await _contarFila();
  _atualizarBadgeFila();
  _syncando = false;

  _ocultarBannerSync();

  if (ok > 0 && typeof toast === 'function') {
    toast(`✅ ${ok} ação(ões) sincronizada(s) com sucesso!`);
  }
  if (falha > 0 && typeof toast === 'function') {
    toast(`⚠️ ${falha} ação(ões) não puderam ser sincronizadas.`);
  }

  console.info(`[Offline] Sync concluído — ok: ${ok}, falha: ${falha}`);
}

/* ════════════════════════════════════════════════════════════
   CACHE OPERACIONAL
   Salva dados do backend localmente para uso offline.
════════════════════════════════════════════════════════════ */

/**
 * Salva dados no cache operacional.
 * @param {string} chave  — ex: 'docas', 'ocrRows', 'equipes_backend'
 * @param {*}      valor  — qualquer dado serializável
 */
async function offlineCacheSalvar(chave, valor) {
  if (!_offlineDB) return;
  await _dbPut(STORE_CACHE_OPS, {
    chave,
    valor,
    savedAt: Date.now()
  });
}

/**
 * Recupera dados do cache operacional.
 * @param {string} chave
 * @param {*} fallback — valor padrão se não encontrado
 * @returns {*}
 */
async function offlineCacheGet(chave, fallback = null) {
  if (!_offlineDB) return fallback;
  const item = await _dbGet(STORE_CACHE_OPS, chave);
  return item ? item.valor : fallback;
}

/* ════════════════════════════════════════════════════════════
   UI — INDICADOR OFFLINE NO HEADER
════════════════════════════════════════════════════════════ */

function _atualizarBadgeFila() {
  const badge = document.getElementById('offline-fila-badge');
  if (!badge) return;

  if (_filaCount > 0) {
    badge.textContent = `${_filaCount}`;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function _mostrarBannerSync(total) {
  let banner = document.getElementById('offline-sync-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-sync-banner';
    banner.style.cssText = `
      background: linear-gradient(135deg,#1a1f2e,rgba(59,130,246,.15));
      border-bottom: 1px solid rgba(59,130,246,.4);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      color: #60a5fa;
      animation: fadeUp .3s ease;
    `;
    const topbar = document.querySelector('.topbar');
    if (topbar) topbar.after(banner);
  }
  banner.innerHTML = `
    <div class="spin" style="width:14px;height:14px;border-width:2px;border-color:rgba(96,165,250,.3);border-top-color:#60a5fa;flex-shrink:0"></div>
    Sincronizando ${total} ação(ões) offline...
  `;
  banner.style.display = 'flex';
}

function _ocultarBannerSync() {
  const banner = document.getElementById('offline-sync-banner');
  if (banner) {
    banner.style.opacity = '0';
    banner.style.transition = 'opacity .5s';
    setTimeout(() => banner.remove(), 500);
  }
}

/* ════════════════════════════════════════════════════════════
   HELPERS INDEXEDDB
════════════════════════════════════════════════════════════ */

function _dbAdd(store, data) {
  return new Promise((resolve, reject) => {
    const tx  = _offlineDB.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function _dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const tx  = _offlineDB.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function _dbGet(store, key) {
  return new Promise((resolve, reject) => {
    const tx  = _offlineDB.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function _dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx  = _offlineDB.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

function _dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const tx  = _offlineDB.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function _contarFila() {
  const itens = await _dbGetAll(STORE_FILA);
  return itens.length;
}

/* ════════════════════════════════════════════════════════════
   EVENTOS DE CONECTIVIDADE
════════════════════════════════════════════════════════════ */

window.addEventListener('online', async () => {
  console.info('[Offline] Reconectado — iniciando sync...');
  // Pequeno delay para garantir conexão estável
  setTimeout(offlineSync, 1500);
});

window.addEventListener('offline', () => {
  console.info('[Offline] Conexão perdida — modo offline ativo.');
});

/* ════════════════════════════════════════════════════════════
   INJETAR BADGE NA TOPBAR
   Chamado automaticamente quando o DOM estiver pronto.
════════════════════════════════════════════════════════════ */
function _injetarBadgeOffline() {
  if (document.getElementById('offline-fila-badge')) return;

  const badge = document.createElement('div');
  badge.id = 'offline-fila-badge';
  badge.title = 'Ações pendentes para sincronizar';
  badge.style.cssText = `
    display: none;
    align-items: center;
    justify-content: center;
    background: var(--acc);
    color: #111;
    font-size: 10px;
    font-weight: 800;
    font-family: 'Barlow Condensed', sans-serif;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    cursor: pointer;
    letter-spacing: 0.5px;
  `;
  badge.onclick = offlineSync;

  const target = document.querySelector('.topbar-right');
  if (target) target.prepend(badge);
}

/* ── Auto-init ───────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    _injetarBadgeOffline();
    offlineInit();
  });
} else {
  _injetarBadgeOffline();
  offlineInit();
}
