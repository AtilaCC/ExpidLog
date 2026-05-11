/**
 * storage.js — DockCheck v2 · Fase 2
 *
 * ARQUITETURA DUAL:
 *   IndexedDB  → dados operacionais grandes (historico, equipes)
 *   localStorage → configurações leves (apiKey, template, tempo-alvo)
 *
 * MIGRAÇÃO AUTOMÁTICA:
 *   Na primeira abertura após a atualização, dados existentes no
 *   localStorage são copiados para o IndexedDB automaticamente.
 *   O operador não percebe nada.
 *
 * INTERFACE PÚBLICA idêntica à Fase 1 — nenhum outro módulo muda.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CHAVES
════════════════════════════════════════════════════════════ */

const K_EQ   = 'cc3_equipes';
const K_HIST = 'cc3_hist';
const K_TMPL = 'cc3_tmpl';
const K_KEY  = 'cc3_key';
const K_ALVO = 'cc3_tempo_alvo';

// Chaves que ficam no localStorage (pequenas, sem fotos)
const LS_KEYS = new Set([K_TMPL, K_KEY, K_ALVO]);

/* ════════════════════════════════════════════════════════════
   INDEXEDDB — SETUP
════════════════════════════════════════════════════════════ */

const DB_NAME    = 'dockcheck_db';
const DB_VERSION = 1;
let _db = null;

function _idbOpen() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'k' });
      }

      if (!db.objectStoreNames.contains('historico')) {
        const hs = db.createObjectStore('historico', { keyPath: 'id' });
        hs.createIndex('data', 'data', { unique: false });
        hs.createIndex('doca', 'doca', { unique: false });
        hs.createIndex('tipo', 'tipo', { unique: false });
      }
    };

    req.onsuccess = e => {
      _db = e.target.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };

    req.onerror   = e => reject(e.target.error);
    req.onblocked = () => console.warn('[IDB] Abertura bloqueada.');
  });
}

/* ════════════════════════════════════════════════════════════
   HELPERS IDB — store kv
════════════════════════════════════════════════════════════ */

function _idbGet(key) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction('kv', 'readonly').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.v : undefined);
    req.onerror   = () => reject(req.error);
  });
}

function _idbSet(key, val) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction('kv', 'readwrite').objectStore('kv').put({ k: key, v: val });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function _idbDel(key) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction('kv', 'readwrite').objectStore('kv').delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ════════════════════════════════════════════════════════════
   HELPERS IDB — store historico (com índices)
════════════════════════════════════════════════════════════ */

function _idbHistGetAll() {
  return new Promise((resolve, reject) => {
    const req = _db.transaction('historico', 'readonly').objectStore('historico').getAll();
    req.onsuccess = () => {
      const sorted = (req.result || []).sort((a, b) => new Date(b.data) - new Date(a.data));
      resolve(sorted);
    };
    req.onerror = () => reject(req.error);
  });
}

function _idbHistPut(record) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction('historico', 'readwrite').objectStore('historico').put(record);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function _idbHistPutMany(records) {
  return new Promise((resolve, reject) => {
    const tx    = _db.transaction('historico', 'readwrite');
    const store = tx.objectStore('historico');
    records.forEach(r => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

function _idbHistClear() {
  return new Promise((resolve, reject) => {
    const req = _db.transaction('historico', 'readwrite').objectStore('historico').clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ════════════════════════════════════════════════════════════
   MIGRAÇÃO AUTOMÁTICA localStorage → IndexedDB
════════════════════════════════════════════════════════════ */

const MIGRATION_FLAG = 'dc_idb_migrated_v1';

async function _migrarSeNecessario() {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  console.info('[IDB] Migrando dados do localStorage...');
  try {
    // Migra equipes
    const eqRaw = localStorage.getItem(K_EQ);
    if (eqRaw) await _idbSet(K_EQ, JSON.parse(eqRaw));

    // Migra histórico para store dedicado
    const histRaw = localStorage.getItem(K_HIST);
    if (histRaw) {
      const hist = JSON.parse(histRaw);
      if (Array.isArray(hist) && hist.length) {
        const sanitized = hist.map(h => ({ ...h, id: h.id || crypto.randomUUID() }));
        await _idbHistPutMany(sanitized);
      }
    }

    // Marca conclusão e libera espaço
    localStorage.setItem(MIGRATION_FLAG, '1');
    localStorage.removeItem(K_EQ);
    localStorage.removeItem(K_HIST);
    console.info('[IDB] Migração concluída.');
  } catch (err) {
    // Não marca flag — tenta novamente na próxima abertura
    console.error('[IDB] Erro na migração:', err);
  }
}

/* ════════════════════════════════════════════════════════════
   CACHE EM MEMÓRIA
   Permite que storage.get() continue síncrono.
   Preenchido por storage.load() no init().
════════════════════════════════════════════════════════════ */

const _cache = {};

/* ════════════════════════════════════════════════════════════
   INTERFACE PÚBLICA — idêntica à Fase 1
════════════════════════════════════════════════════════════ */

const storage = {

  /**
   * Lê um valor. Síncrono — usa cache em memória para dados IDB.
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  get(key, fallback = null) {
    if (LS_KEYS.has(key)) {
      try {
        const v = localStorage.getItem(key);
        return v !== null ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    }
    return key in _cache ? _cache[key] : fallback;
  },

  /**
   * Grava um valor. Atualiza cache imediatamente, persiste IDB async.
   * @param {string} key
   * @param {*} val
   * @returns {boolean}
   */
  set(key, val) {
    if (LS_KEYS.has(key)) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; }
      catch (e) { console.warn('[storage] LS.set falhou:', key, e); return false; }
    }

    // Cache imediato — UI não espera o disco
    _cache[key] = val;

    // Persiste async no IDB
    if (key === K_HIST) {
      _idbHistClear()
        .then(() => _idbHistPutMany(Array.isArray(val) ? val : []))
        .catch(e => console.error('[IDB] Erro ao salvar historico:', e));
    } else {
      _idbSet(key, val).catch(e => console.error('[IDB] Erro ao salvar', key, ':', e));
    }

    return true;
  },

  /**
   * Remove uma chave.
   * @param {string} key
   */
  remove(key) {
    if (LS_KEYS.has(key)) {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    delete _cache[key];
    _idbDel(key).catch(e => console.error('[IDB] Erro ao remover', key, ':', e));
  },

  /**
   * Abre o IDB, migra dados e preenche o cache.
   * Deve ser chamado e AGUARDADO no init() antes de qualquer get/set.
   * @returns {Promise<void>}
   */
  async load() {
    try {
      await _idbOpen();
      await _migrarSeNecessario();

      const [eq, hist] = await Promise.all([
        _idbGet(K_EQ),
        _idbHistGetAll()
      ]);

      if (eq   !== undefined) _cache[K_EQ]   = eq;
      if (hist !== undefined) _cache[K_HIST]  = hist;

    } catch (err) {
      // Fallback para localStorage se IDB falhar (modo privado, iOS antigo)
      console.warn('[storage] IDB indisponível, usando localStorage como fallback:', err);
      try {
        const eq   = localStorage.getItem(K_EQ);
        const hist = localStorage.getItem(K_HIST);
        if (eq)   _cache[K_EQ]   = JSON.parse(eq);
        if (hist) _cache[K_HIST] = JSON.parse(hist);
      } catch {}
    }
  },

  /**
   * Tamanho estimado do localStorage em KB.
   * @returns {number}
   */
  sizeKB() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += (k.length + (localStorage.getItem(k) || '').length) * 2;
    }
    return Math.round(total / 1024);
  },

  /**
   * Diagnóstico completo para debug/config.
   * @returns {Promise<Object>}
   */
  async diagnostico() {
    const hist = _db ? await _idbHistGetAll() : [];
    const eq   = _db ? await _idbGet(K_EQ) : null;
    return {
      idb: {
        disponivel: !!_db,
        historico:  hist.length,
        equipes:    (eq || []).length,
        db:         DB_NAME,
        version:    DB_VERSION
      },
      localStorage: {
        sizeKB:   this.sizeKB(),
        migrado:  !!localStorage.getItem(MIGRATION_FLAG)
      },
      cache: Object.keys(_cache)
    };
  }
};
