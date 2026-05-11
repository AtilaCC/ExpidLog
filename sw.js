/* ════════════════════════════════════════════════════════════
   DOCKCHECK v2 — SERVICE WORKER · Fase 3
   Cache versionado + detecção de atualização + offline resiliente
════════════════════════════════════════════════════════════ */

'use strict';

/* ── Versão do cache ──────────────────────────────────────────
   INCREMENTAR ESTE NÚMERO a cada deploy no GitHub.
   O SW detecta a mudança e avisa o operador automaticamente.
─────────────────────────────────────────────────────────── */
const CACHE_VERSION = 5;
const CACHE_NAME    = `dockcheck-v${CACHE_VERSION}`;

/* ── Assets do app shell (todos devem existir no repositório) ─ */
const CACHE_STATIC = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/utils.js',
  './js/connectivity.js',
  './js/timer.js',
  './js/fila.js',
  './js/equipes.js',
  './js/historico.js',
  './js/conferencia.js',
  './js/ocr.js',
  './js/whatsapp.js',
  './js/relatorio.js',
  './js/ia.js',
  './js/app.js',
  './manifest.json',
];

/* ── Domínios que NUNCA devem ser cacheados ────────────────── */
const NEVER_CACHE = [
  'api.anthropic.com',   // API de IA — sempre network
];

/* ── Domínios que usam cache-first (estáticos externos) ─────── */
const CACHE_FIRST_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

/* ════════════════════════════════════════════════════════════
   INSTALL — pré-cache do app shell completo
════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Tenta cachear cada asset individualmente
        // Se um falhar, não bloqueia o install dos outros
        return Promise.allSettled(
          CACHE_STATIC.map(url =>
            cache.add(new Request(url, { cache: 'reload' }))
              .catch(err => console.warn('[SW] Cache falhou para:', url, err))
          )
        );
      })
      .then(() => {
        console.info(`[SW] Install concluído — cache ${CACHE_NAME}`);
        // Não chama skipWaiting() aqui — a atualização é controlada
        // pelo app via mensagem 'SKIP_WAITING' para não interromper
        // operações em andamento
      })
  );
});

/* ════════════════════════════════════════════════════════════
   ACTIVATE — limpa caches de versões anteriores
════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        const deletions = keys
          .filter(k => k.startsWith('dockcheck-') && k !== CACHE_NAME)
          .map(k => {
            console.info('[SW] Removendo cache antigo:', k);
            return caches.delete(k);
          });
        return Promise.all(deletions);
      })
      .then(() => {
        console.info('[SW] Activate — assumindo controle de todos os clientes.');
        return self.clients.claim();
      })
  );
});

/* ════════════════════════════════════════════════════════════
   FETCH — estratégias de cache por tipo de recurso
════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // ── Só intercepta GET ──
  if (req.method !== 'GET') return;

  // ── API Anthropic: sempre network, nunca cache ──
  if (NEVER_CACHE.some(h => url.hostname.includes(h))) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ error: { message: 'Sem conexão com a API.' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // ── Fontes Google: cache-first com atualização em background ──
  if (CACHE_FIRST_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(_cacheFirst(req));
    return;
  }

  // ── App shell e assets locais: stale-while-revalidate ──
  // Entrega do cache imediatamente (rápido para o operador),
  // atualiza cache em background silenciosamente.
  if (url.origin === self.location.origin) {
    event.respondWith(_staleWhileRevalidate(req));
    return;
  }

  // ── Demais requests: network com fallback de cache ──
  event.respondWith(_networkWithCacheFallback(req));
});

/* ════════════════════════════════════════════════════════════
   ESTRATÉGIAS DE CACHE
════════════════════════════════════════════════════════════ */

/**
 * Cache-First: entrega do cache, busca na rede só se não estiver cacheado.
 * Ideal para assets que mudam raramente (fontes, ícones).
 */
async function _cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const res   = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('Recurso offline indisponível.', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate: entrega cache imediatamente,
 * atualiza em background. Quando há nova versão, notifica o app.
 * Ideal para o app shell — operador não espera, mas recebe update.
 */
async function _staleWhileRevalidate(req) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  // Revalida em background independente de ter cache ou não
  const fetchPromise = fetch(req)
    .then(async res => {
      if (!res || res.status !== 200 || res.type === 'opaque') return res;

      // Verifica se o conteúdo mudou antes de cachear
      const oldRes = await cache.match(req);
      if (oldRes) {
        const oldText = await oldRes.clone().text().catch(() => '');
        const newText = await res.clone().text().catch(() => '');
        if (oldText !== newText) {
          // Conteúdo mudou — atualiza cache e notifica app
          await cache.put(req, res.clone());
          _notificarAtualizacao();
        }
      } else {
        await cache.put(req, res.clone());
      }

      return res;
    })
    .catch(() => null);

  // Se tiver cache, entrega imediatamente (não espera a rede)
  if (cached) return cached;

  // Sem cache — aguarda a rede (primeira visita)
  const fresh = await fetchPromise;
  return fresh || new Response('Conteúdo indisponível offline.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

/**
 * Network-First com fallback de cache.
 * Para recursos externos que devem ser frescos quando online.
 */
async function _networkWithCacheFallback(req) {
  try {
    const res   = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    if (res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('Sem conexão.', { status: 503 });
  }
}

/* ════════════════════════════════════════════════════════════
   NOTIFICAÇÃO DE ATUALIZAÇÃO DISPONÍVEL
   Avisa o app (app.js) que há nova versão no ar.
   O app exibe o banner "Atualizar" sem forçar reload.
════════════════════════════════════════════════════════════ */

let _atualizacaoNotificada = false;

async function _notificarAtualizacao() {
  if (_atualizacaoNotificada) return;
  _atualizacaoNotificada = true;

  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'SW_UPDATE_AVAILABLE', version: CACHE_VERSION });
  });
}

/* ════════════════════════════════════════════════════════════
   MENSAGENS DO APP → SERVICE WORKER
════════════════════════════════════════════════════════════ */
self.addEventListener('message', event => {
  const { type } = event.data || {};

  // App pediu para ativar nova versão imediatamente
  if (type === 'SKIP_WAITING') {
    console.info('[SW] SKIP_WAITING recebido — ativando nova versão.');
    self.skipWaiting();
  }

  // App pediu versão atual do cache
  if (type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
});
