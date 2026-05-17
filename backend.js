/**
 * backend.js — DockCheck v2 · Fase 6
 * Integração com o backend Railway (Node.js + PostgreSQL + Socket.IO).
 * Gerencia: autenticação JWT, conexão Socket.IO realtime, sync de operações.
 *
 * FLUXO:
 *   1. Usuário faz login → recebe JWT
 *   2. JWT é usado para conectar ao Socket.IO
 *   3. Conferências são salvas no backend E no IndexedDB (offline-first)
 *   4. Quando volta online, fila de pendentes é sincronizada
 *
 * NÃO altera nenhuma lógica existente — funciona como camada adicional.
 * Se o backend estiver offline, o sistema continua funcionando localmente.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONFIGURAÇÃO
════════════════════════════════════════════════════════════ */

const BACKEND_URL = 'https://expidlog-production.up.railway.app';
const API_URL     = `${BACKEND_URL}/api`;

// Chaves de armazenamento local para auth
const K_TOKEN         = 'dc_access_token';
const K_REFRESH_TOKEN = 'dc_refresh_token';
const K_USER          = 'dc_user';
const K_SYNC_QUEUE    = 'dc_sync_queue';

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */

let _socket        = null;
let _socketConectado = false;
let _refreshTimer  = null;
let _syncEmAndamento = false;

/* ════════════════════════════════════════════════════════════
   AUTH — UTILITÁRIOS
════════════════════════════════════════════════════════════ */

/**
 * Retorna o access token salvo.
 * @returns {string|null}
 */
function getToken() {
  return localStorage.getItem(K_TOKEN);
}

/**
 * Retorna o usuário logado salvo.
 * @returns {Object|null}
 */
function getUser() {
  try {
    const raw = localStorage.getItem(K_USER);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Retorna true se há um usuário autenticado.
 * @returns {boolean}
 */
function isAuthenticated() {
  return !!getToken() && !!getUser();
}

/**
 * Salva tokens e usuário após login bem-sucedido.
 */
function _salvarAuth(data) {
  localStorage.setItem(K_TOKEN,         data.access_token);
  localStorage.setItem(K_REFRESH_TOKEN, data.refresh_token);
  localStorage.setItem(K_USER,          JSON.stringify(data.user));
}

/**
 * Remove todos os dados de autenticação.
 */
function _limparAuth() {
  localStorage.removeItem(K_TOKEN);
  localStorage.removeItem(K_REFRESH_TOKEN);
  localStorage.removeItem(K_USER);
  if (_refreshTimer) clearInterval(_refreshTimer);
}

/* ════════════════════════════════════════════════════════════
   AUTH — LOGIN / LOGOUT
════════════════════════════════════════════════════════════ */

/**
 * Faz login no backend.
 * @param {string} email
 * @param {string} senha
 * @returns {Promise<{user: Object, access_token: string}>}
 */
async function backendLogin(email, senha) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, senha })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');

  _salvarAuth(data);
  _iniciarRefreshAutomatico();
  _conectarSocket();

  return data;
}

/**
 * Faz logout no backend e limpa dados locais.
 */
async function backendLogout() {
  const token        = getToken();
  const refreshToken = localStorage.getItem(K_REFRESH_TOKEN);

  try {
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
    }
  } catch { /* silencioso — limpa local de qualquer forma */ }

  _desconectarSocket();
  _limparAuth();
}

/**
 * Renova o access token usando o refresh token.
 * Chamado automaticamente a cada 14 minutos.
 */
async function _refreshToken() {
  const refreshToken = localStorage.getItem(K_REFRESH_TOKEN);
  if (!refreshToken) return;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken })
    });

    if (!res.ok) { _limparAuth(); _mostrarTelaLogin(); return; }

    const data = await res.json();
    _salvarAuth(data);
    console.info('[Backend] Token renovado.');
  } catch (e) {
    console.warn('[Backend] Erro ao renovar token:', e.message);
  }
}

/**
 * Inicia o timer de refresh automático (a cada 14 minutos).
 */
function _iniciarRefreshAutomatico() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(_refreshToken, 14 * 60 * 1000);
}

/* ════════════════════════════════════════════════════════════
   SOCKET.IO — CONEXÃO REALTIME
════════════════════════════════════════════════════════════ */

/**
 * Conecta ao Socket.IO do Railway usando o JWT.
 * Requer que socket.io.min.js esteja carregado.
 */
function _conectarSocket() {
  const token = getToken();
  if (!token || _socket) return;

  // Socket.IO client precisa estar carregado via CDN no index.html
  if (typeof io === 'undefined') {
    console.warn('[Backend] Socket.IO client não carregado.');
    return;
  }

  _socket = io(BACKEND_URL, {
    auth:              { token },
    transports:        ['websocket', 'polling'],
    reconnection:      true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });

  _socket.on('connect', () => {
    _socketConectado = true;
    console.info('[Backend] Socket.IO conectado:', _socket.id);
    _atualizarIndicadorSocket(true);
    // Processa fila de operações pendentes
    _sincronizarFila();
  });

  _socket.on('connected', (data) => {
    console.info('[Backend] Autenticado como:', data.user?.nome);
  });

  _socket.on('disconnect', (reason) => {
    _socketConectado = false;
    console.warn('[Backend] Socket desconectado:', reason);
    _atualizarIndicadorSocket(false);
  });

  _socket.on('connect_error', (err) => {
    console.warn('[Backend] Erro de conexão:', err.message);
    _socketConectado = false;
    _atualizarIndicadorSocket(false);
  });

  // ── Eventos de operação em tempo real ──
  _socket.on('operacao:nova', (data) => {
    console.info('[Realtime] Nova operação:', data);
    _onOperacaoNova(data);
  });

  _socket.on('operacao:atualizada', (data) => {
    _onOperacaoAtualizada(data);
  });

  _socket.on('checklist:item_updated', (data) => {
    console.info('[Realtime] Checklist atualizado por:', data.updatedBy);
  });

  _socket.on('pong', (data) => {
    const latencia = Date.now() - data.timestamp;
    console.info(`[Backend] Latência: ${latencia}ms`);
  });
}

function getSyncSocket() { return _socket; }

function _desconectarSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
    _socketConectado = false;
  }
}

/**
 * Atualiza o indicador visual de conexão com o backend.
 * @param {boolean} conectado
 */
function _atualizarIndicadorSocket(conectado) {
  const el = document.getElementById('backend-status');
  if (!el) return;
  el.style.display = 'flex';
  if (conectado) {
    el.innerHTML = '<span style="color:var(--grn);font-size:10px;font-weight:700">⬡ BACKEND ONLINE</span>';
  } else {
    el.innerHTML = '<span style="color:var(--mut);font-size:10px;font-weight:700">⬡ BACKEND OFFLINE</span>';
  }
}

/* ════════════════════════════════════════════════════════════
   OPERAÇÕES — SINCRONIZAÇÃO COM BACKEND
════════════════════════════════════════════════════════════ */

/**
 * Salva uma conferência no backend.
 * Se offline ou falhar, coloca na fila para sync posterior.
 * @param {Object} conferencia — registro do histórico local
 * @returns {Promise<boolean>} sucesso
 */
async function backendSalvarConferencia(conferencia) {
  const token = getToken();
  if (!token) return false; // não autenticado, só local

  const payload = {
    doca:           conferencia.doca,
    oc:             conferencia.oc,
    rota:           conferencia.rota,
    transportadora: conferencia.transportadora,
    placa:          conferencia.placa || '',
    conferente:     conferencia.conf,
    aux1:           conferencia.aux1 || '',
    aux2:           conferencia.aux2 || '',
    pedidos:        parseInt(conferencia.pedidos) || 0,
    clientes:       parseInt(conferencia.clientes) || 0,
    tubos:          conferencia.tubos || 'Conferidos',
    caixa:          conferencia.caixa || 'Conferida',
    observacao:     conferencia.obs || '',
    hora_inicio:    conferencia.hora || '',
    duracao_seg:    conferencia.duracaoSeg || null,
    carga_estado:   conferencia.cargaEstado || '',
    carga_problemas:conferencia.cargaProblemas || '',
    data:           conferencia.data,
    local_id:       conferencia.id, // ID local para deduplicação
  };

  try {
    const res = await fetch(`${API_URL}/operacoes`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.info('[Backend] Conferência salva:', conferencia.oc);
      return true;
    }

    // Se 409 (já existe), considera sucesso
    if (res.status === 409) return true;

    // Outros erros — coloca na fila
    _adicionarFila(conferencia);
    return false;

  } catch (e) {
    // Offline — coloca na fila
    console.warn('[Backend] Offline, enfileirando:', e.message);
    _adicionarFila(conferencia);
    return false;
  }
}

/**
 * Busca operações do backend para o turno atual.
 * @returns {Promise<Object[]>}
 */
async function backendBuscarOperacoes() {
  const token = getToken();
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/operacoes?turno=atual`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.operacoes || data || [];
  } catch {
    return [];
  }
}

/* ════════════════════════════════════════════════════════════
   FILA DE SINCRONIZAÇÃO OFFLINE
════════════════════════════════════════════════════════════ */

/**
 * Adiciona uma conferência à fila de sync offline.
 * @param {Object} conferencia
 */
function _adicionarFila(conferencia) {
  try {
    const fila = JSON.parse(localStorage.getItem(K_SYNC_QUEUE) || '[]');
    // Evita duplicatas pelo ID local
    if (!fila.find(f => f.id === conferencia.id)) {
      fila.push(conferencia);
      localStorage.setItem(K_SYNC_QUEUE, JSON.stringify(fila));
      _atualizarBadgeFila(fila.length);
    }
  } catch (e) {
    console.warn('[Backend] Erro ao enfileirar:', e);
  }
}

/**
 * Tenta sincronizar a fila de pendentes com o backend.
 * Chamado quando o socket reconecta.
 */
async function _sincronizarFila() {
  if (_syncEmAndamento) return;
  const fila = JSON.parse(localStorage.getItem(K_SYNC_QUEUE) || '[]');
  if (!fila.length) return;

  _syncEmAndamento = true;
  console.info(`[Backend] Sincronizando ${fila.length} item(s) da fila...`);

  const pendentes = [...fila];
  const sucesso   = [];

  for (const item of pendentes) {
    const ok = await backendSalvarConferencia(item);
    if (ok) sucesso.push(item.id);
  }

  // Remove os que foram sincronizados
  const restantes = fila.filter(f => !sucesso.includes(f.id));
  localStorage.setItem(K_SYNC_QUEUE, JSON.stringify(restantes));
  _atualizarBadgeFila(restantes.length);

  _syncEmAndamento = false;

  if (sucesso.length) {
    toast(`☁️ ${sucesso.length} conferência${sucesso.length > 1 ? 's' : ''} sincronizada${sucesso.length > 1 ? 's' : ''} com o servidor`);
    console.info(`[Backend] ${sucesso.length} sincronizados, ${restantes.length} pendentes.`);
  }
}

/**
 * Atualiza o badge de itens pendentes na fila.
 * @param {number} count
 */
function _atualizarBadgeFila(count) {
  const el = document.getElementById('sync-queue-badge');
  if (!el) return;
  if (count > 0) {
    el.style.display  = 'inline-flex';
    el.textContent    = `⏳ ${count} pendente${count > 1 ? 's' : ''}`;
  } else {
    el.style.display  = 'none';
  }
}

/* ════════════════════════════════════════════════════════════
   EVENTOS REALTIME — HANDLERS
════════════════════════════════════════════════════════════ */

/**
 * Chamado quando outro dispositivo registra uma nova operação.
 * Atualiza o histórico local e o dashboard em tempo real.
 * @param {Object} data — dados da operação do backend
 */
function _onOperacaoNova(data) {
  // Converte formato do backend para formato local
  const registro = {
    id:             data.local_id || data.id,
    tipo:           'conferencia',
    data:           data.data || data.created_at,
    doca:           data.doca,
    rota:           data.rota,
    conf:           data.conferente,
    oc:             data.oc,
    hora:           data.hora_inicio,
    pedidos:        String(data.pedidos || ''),
    clientes:       String(data.clientes || ''),
    transportadora: data.transportadora,
    duracaoSeg:     data.duracao_seg,
    mensagem:       null,
    fotos:          [],
    _fromBackend:   true, // marca para não re-enviar
  };

  // Adiciona ao histórico local se não existir
  const jaExiste = historico.some(h => h.id === registro.id || h.oc === registro.oc);
  if (!jaExiste) {
    historico.unshift(registro);
    storage.set(K_HIST, historico);
    updateLiveStrip();

    // Se o dashboard estiver aberto, atualiza
    if (document.getElementById('tab-dashboard')?.classList.contains('on')) {
      renderDashboard();
    }

    toast(`📡 ${data.conferente || 'Operador'} registrou Doca ${data.doca} — OC ${data.oc}`);
  }
}

function _onOperacaoAtualizada(data) {
  console.info('[Realtime] Operação atualizada:', data.id);
  // Atualiza dashboard se estiver aberto
  if (document.getElementById('tab-dashboard')?.classList.contains('on')) {
    renderDashboard();
  }
}

/* ════════════════════════════════════════════════════════════
   TELA DE LOGIN
════════════════════════════════════════════════════════════ */

/**
 * Exibe o overlay de login.
 */
function _mostrarTelaLogin() {
  const el = document.getElementById('ov-login');
  if (el) el.classList.add('on');
}

/**
 * Oculta o overlay de login.
 */
function _fecharTelaLogin() {
  const el = document.getElementById('ov-login');
  if (el) el.classList.remove('on');
}

/**
 * Handler do formulário de login.
 * Chamado pelo botão no HTML.
 */
async function loginSubmit() {
  const email = document.getElementById('login-email')?.value?.trim();
  const senha  = document.getElementById('login-senha')?.value;
  const btn    = document.getElementById('login-btn');
  const errEl  = document.getElementById('login-erro');

  if (!email || !senha) {
    if (errEl) errEl.textContent = 'Preencha email e senha.';
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Entrando...'; }
  if (errEl) errEl.textContent = '';

  try {
    const data = await backendLogin(email, senha);
    _fecharTelaLogin();
    _atualizarHeaderUsuario(data.user);
    toast(`✅ Bem-vindo, ${data.user.nome}!`);
    // Carrega preferências (tema/idioma) do servidor
    if (typeof i18nCarregarPreferencias === 'function') i18nCarregarPreferencias();
    // Tenta sincronizar fila após login
    setTimeout(_sincronizarFila, 1000);
  } catch (e) {
    if (errEl) errEl.textContent = e.message || 'Email ou senha incorretos.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔑 Entrar'; }
  }
}

/**
 * Atualiza o header com o nome do usuário logado.
 * @param {Object} user
 */
function _atualizarHeaderUsuario(user) {
  const el = document.getElementById('header-user');
  if (!el || !user) return;
  el.style.display = 'flex';
  el.innerHTML = `
    <span style="font-size:11px;color:var(--mut);font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.5px">
      ${user.nome?.split(' ')[0] || user.email}
    </span>
    <button onclick="backendLogout().then(()=>location.reload())"
      style="background:none;border:none;color:var(--mut);font-size:12px;cursor:pointer;padding:0 4px"
      title="Sair">⏏</button>
  `;
}

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Inicializa a integração com o backend.
 * Chamado pelo app.js após o init() principal.
 */
function backendInit() {
  // Se já autenticado, reconecta o socket e atualiza UI
  if (isAuthenticated()) {
    const user = getUser();
    _iniciarRefreshAutomatico();
    _conectarSocket();
    _atualizarHeaderUsuario(user);
    console.info('[Backend] Sessão restaurada:', user?.nome);
  } else {
    // Exibe login apenas se houver backend URL configurada
    if (BACKEND_URL) _mostrarTelaLogin();
  }

  // Iniciar sync mobile — Etapa 9
  if (typeof syncInit === 'function') syncInit();

  // Badge de fila pendente
  const fila = JSON.parse(localStorage.getItem(K_SYNC_QUEUE) || '[]');
  if (fila.length) _atualizarBadgeFila(fila.length);

  // Quando voltar online, tenta sincronizar
  window.addEventListener('online', () => {
    if (isAuthenticated() && !_socketConectado) {
      _conectarSocket();
    }
    setTimeout(_sincronizarFila, 2000);
  });
}
