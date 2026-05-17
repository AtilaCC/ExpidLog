/* ════════════════════════════════════════════════════════════
   DOCKCHECK PRO — PUSH NOTIFICATIONS · Fase 13
   Solicita permissão, registra subscription no backend,
   e fornece UI para ativar/desativar notificações.

   Adicionar no index.html (antes do app.js):
     <script src="push.js"></script>

   A UI é injetada automaticamente na aba Config.
════════════════════════════════════════════════════════════ */

'use strict';

/* ── Chave pública VAPID — copiar do Railway após gerar ────
   Gerar com: npx web-push generate-vapid-keys
   Colocar a PUBLIC KEY aqui e as duas no Railway env vars.
─────────────────────────────────────────────────────────── */
const VAPID_PUBLIC_KEY = 'COLE_SUA_VAPID_PUBLIC_KEY_AQUI';

/* ── URL base do backend ────────────────────────────────── */
const PUSH_API = 'https://expidlog-production.up.railway.app/api/push';

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */
let _subscription = null;     // subscription atual do device
let _permissao    = 'default'; // 'default' | 'granted' | 'denied'

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   Chamada automaticamente quando o DOM estiver pronto.
   Injeta o bloco de notificações na aba Config.
════════════════════════════════════════════════════════════ */
async function pushInit() {
  // Verifica suporte
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.info('[Push] Não suportado neste browser/dispositivo.');
    _injetarUIConfig(false);
    return;
  }

  _permissao = Notification.permission;
  _injetarUIConfig(true);

  // Se já tem permissão, tenta recuperar subscription existente
  if (_permissao === 'granted') {
    await _recuperarSubscription();
  }

  _atualizarUIConfig();
}

/* ════════════════════════════════════════════════════════════
   SOLICITAR PERMISSÃO + REGISTRAR
════════════════════════════════════════════════════════════ */
async function pushAtivar() {
  const btn = document.getElementById('push-btn-ativar');
  if (btn) { btn.disabled = true; btn.textContent = 'Aguardando...'; }

  try {
    // 1. Pedir permissão
    const result = await Notification.requestPermission();
    _permissao = result;

    if (result !== 'granted') {
      _atualizarUIConfig();
      _pushToast('Permissão negada. Ative nas configurações do navegador.', 'err');
      return;
    }

    // 2. Registrar subscription no SW
    const sw = await navigator.serviceWorker.ready;
    _subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // 3. Enviar para o backend
    await _registrarNoBackend(_subscription);
    _atualizarUIConfig();
    _pushToast('🔔 Notificações ativadas!', 'ok');

  } catch (err) {
    console.error('[Push] Erro ao ativar:', err);
    _pushToast('Erro ao ativar notificações.', 'err');
  } finally {
    _atualizarUIConfig();
  }
}

/* ════════════════════════════════════════════════════════════
   DESATIVAR / REMOVER SUBSCRIPTION
════════════════════════════════════════════════════════════ */
async function pushDesativar() {
  try {
    if (_subscription) {
      // Remove do backend primeiro
      await _removerDoBackend(_subscription);
      // Cancela subscription no browser
      await _subscription.unsubscribe();
      _subscription = null;
    }
    _atualizarUIConfig();
    _pushToast('Notificações desativadas.', 'ok');
  } catch (err) {
    console.error('[Push] Erro ao desativar:', err);
    _pushToast('Erro ao desativar notificações.', 'err');
  }
}

/* ════════════════════════════════════════════════════════════
   PUSH DE TESTE
════════════════════════════════════════════════════════════ */
async function pushTestar() {
  const btn = document.getElementById('push-btn-testar');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const token = localStorage.getItem('dc_access_token');
    if (!token) { _pushToast('Faça login para testar.', 'err'); return; }

    const res = await fetch(`${PUSH_API}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok) {
      _pushToast('📬 Push enviado! Verifique sua notificação.', 'ok');
    } else {
      _pushToast(data.error || 'Erro ao enviar.', 'err');
    }
  } catch (err) {
    _pushToast('Sem conexão com o servidor.', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📬 Enviar Push de Teste'; }
  }
}

/* ════════════════════════════════════════════════════════════
   COMUNICAÇÃO COM BACKEND
════════════════════════════════════════════════════════════ */
async function _registrarNoBackend(subscription) {
  const token = localStorage.getItem('dc_access_token');
  if (!token) return;

  const sub = subscription.toJSON();
  const res = await fetch(`${PUSH_API}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
    })
  });

  if (!res.ok) throw new Error('Falha ao registrar no backend.');
}

async function _removerDoBackend(subscription) {
  const token = localStorage.getItem('dc_access_token');
  if (!token) return;

  await fetch(`${PUSH_API}/unsubscribe`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  }).catch(() => {});
}

async function _recuperarSubscription() {
  try {
    const sw = await navigator.serviceWorker.ready;
    _subscription = await sw.pushManager.getSubscription();
  } catch (err) {
    console.warn('[Push] Erro ao recuperar subscription:', err);
  }
}

/* ════════════════════════════════════════════════════════════
   UI — INJEÇÃO NA ABA CONFIG
════════════════════════════════════════════════════════════ */
function _injetarUIConfig(suportado) {
  // Procura um container na aba config para injetar
  const config = document.getElementById('tab-config');
  if (!config) return;
  if (document.getElementById('push-config-bloco')) return; // já injetado

  // Encontra o último elemento da config para inserir antes do padding final
  const bloco = document.createElement('div');
  bloco.id = 'push-config-bloco';
  bloco.style.cssText = 'margin-top:8px';

  if (!suportado) {
    bloco.innerHTML = `
      <div class="cfg-section-title">🔔 Notificações Push</div>
      <div class="hint" style="color:var(--mut);padding:10px 0">
        Notificações push não são suportadas neste dispositivo ou navegador.
      </div>
    `;
  } else {
    bloco.innerHTML = `
      <div class="cfg-section-title">🔔 Notificações Push</div>
      <div id="push-status-bar" style="
        background:var(--card);border:1px solid var(--bord);border-radius:8px;
        padding:12px 14px;margin-bottom:10px;font-size:13px;
        display:flex;align-items:center;gap:10px
      ">
        <span id="push-status-dot" style="width:8px;height:8px;border-radius:50%;background:var(--mut);flex-shrink:0"></span>
        <span id="push-status-txt" style="color:var(--mut)">Verificando...</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="push-btn-ativar" class="btn btn-acc btn-sm" onclick="pushAtivar()"
          style="display:none;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.5px">
          🔔 Ativar Notificações
        </button>
        <button id="push-btn-desativar" class="btn btn-ghost btn-sm" onclick="pushDesativar()"
          style="display:none;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.5px">
          🔕 Desativar Notificações
        </button>
        <button id="push-btn-testar" class="btn btn-ghost btn-sm" onclick="pushTestar()"
          style="display:none;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.5px">
          📬 Enviar Push de Teste
        </button>
      </div>

      <div id="push-toast" style="display:none;margin-top:8px;font-size:12px;padding:8px 12px;border-radius:6px"></div>
    `;
  }

  // Insere no final da aba config, antes do último padding
  const lastChild = config.lastElementChild;
  config.insertBefore(bloco, lastChild);
}

function _atualizarUIConfig() {
  const dot    = document.getElementById('push-status-dot');
  const txt    = document.getElementById('push-status-txt');
  const btnAt  = document.getElementById('push-btn-ativar');
  const btnDes = document.getElementById('push-btn-desativar');
  const btnTst = document.getElementById('push-btn-testar');

  if (!dot) return;

  const ativo = _permissao === 'granted' && !!_subscription;
  const negado = _permissao === 'denied';

  // Status dot
  dot.style.background = ativo ? 'var(--grn)' : negado ? 'var(--red)' : 'var(--mut)';

  // Status text
  if (ativo) {
    txt.style.color = 'var(--grn)';
    txt.textContent = '✅ Notificações ativas neste dispositivo';
  } else if (negado) {
    txt.style.color = 'var(--red)';
    txt.textContent = '🚫 Permissão negada — ative nas configurações do navegador';
  } else {
    txt.style.color = 'var(--mut)';
    txt.textContent = 'Notificações desativadas';
  }

  // Botões
  if (btnAt)  btnAt.style.display  = (!ativo && !negado) ? 'block' : 'none';
  if (btnDes) btnDes.style.display = ativo ? 'block' : 'none';
  if (btnTst) btnTst.style.display = ativo ? 'block' : 'none';
  if (btnAt)  btnAt.disabled       = false;
  if (btnAt)  btnAt.textContent    = '🔔 Ativar Notificações';
}

function _pushToast(msg, tipo) {
  const el = document.getElementById('push-toast');
  if (!el) return;
  el.textContent  = msg;
  el.style.display = 'block';
  el.style.background = tipo === 'ok' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)';
  el.style.color      = tipo === 'ok' ? 'var(--grn)' : 'var(--red)';
  el.style.border     = `1px solid ${tipo === 'ok' ? 'var(--grn)' : 'var(--red)'}`;
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

/* ════════════════════════════════════════════════════════════
   HELPER — converte chave VAPID base64 para Uint8Array
════════════════════════════════════════════════════════════ */
function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/* ════════════════════════════════════════════════════════════
   AUTO-INIT quando o DOM estiver pronto
════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pushInit);
} else {
  // DOM já pronto — aguarda o SW estar registrado
  setTimeout(pushInit, 1000);
}
