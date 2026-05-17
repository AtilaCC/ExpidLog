// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Frontend SDK
// sdk/dockcheck.js  (drop into your frontend)
// ══════════════════════════════════════════════════════
//
// Usage:
//   import DockCheck from './sdk/dockcheck.js';
//   const dc = new DockCheck('https://your-backend.railway.app');
//   await dc.login('admin@empresa.com', 'senha');
//   const docas = await dc.docas.listar();

class DockCheckSDK {
  constructor(baseURL) {
    this.baseURL      = baseURL.replace(/\/$/, '');
    this.accessToken  = localStorage.getItem('dc_access_token')  || null;
    this.refreshToken = localStorage.getItem('dc_refresh_token') || null;
    this.user         = JSON.parse(localStorage.getItem('dc_user') || 'null');
    this._socket      = null;
    this._listeners   = {};

    // Bind namespaced modules
    this.docas      = this._buildDocas();
    this.operacoes  = this._buildOperacoes();
    this.analytics  = this._buildAnalytics();
    this.users      = this._buildUsers();
    this.checklists = this._buildChecklists();
    this.fotos      = this._buildFotos();
    this.relatorios = this._buildRelatorios();
  }

  // ── Core fetch ──────────────────────────────────────
  async _fetch(path, options = {}, retry = true) {
    const url = `${this.baseURL}/api${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });

    // Token expired — try refresh once
    if (res.status === 401 && retry) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'TOKEN_EXPIRED' && this.refreshToken) {
        await this._refreshAccessToken();
        return this._fetch(path, options, false);
      }
      this._handleUnauthenticated();
      throw new Error(data.error || 'Unauthorized');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, data: err });
    }

    return res.json();
  }

  async _refreshAccessToken() {
    const res = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: this.refreshToken }),
    });
    if (!res.ok) { this._handleUnauthenticated(); return; }
    const data = await res.json();
    this.accessToken = data.access_token;
    localStorage.setItem('dc_access_token', this.accessToken);
  }

  _handleUnauthenticated() {
    this.accessToken = this.refreshToken = this.user = null;
    localStorage.removeItem('dc_access_token');
    localStorage.removeItem('dc_refresh_token');
    localStorage.removeItem('dc_user');
    this._emit('auth:logout');
  }

  // ── Auth ────────────────────────────────────────────
  async login(email, senha) {
    const data = await this._fetch('/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, senha }),
    }, false);

    this.accessToken  = data.access_token;
    this.refreshToken = data.refresh_token;
    this.user         = data.user;

    localStorage.setItem('dc_access_token',  this.accessToken);
    localStorage.setItem('dc_refresh_token', this.refreshToken);
    localStorage.setItem('dc_user',          JSON.stringify(this.user));

    this._emit('auth:login', data.user);
    return data;
  }

  async logout() {
    await this._fetch('/auth/logout', {
      method: 'POST',
      body:   JSON.stringify({ refresh_token: this.refreshToken }),
    }).catch(() => {});
    this._handleUnauthenticated();
    if (this._socket) { this._socket.disconnect(); this._socket = null; }
  }

  async me() {
    return this._fetch('/auth/me');
  }

  isLoggedIn() {
    return !!this.accessToken;
  }

  // ── Socket.IO ───────────────────────────────────────
  connectSocket(socketIOClient) {
    if (this._socket?.connected) return this._socket;

    this._socket = socketIOClient(this.baseURL, {
      auth:              { token: this.accessToken },
      transports:        ['websocket', 'polling'],
      reconnectionDelay: 2000,
    });

    this._socket.on('connect',    () => this._emit('socket:connected'));
    this._socket.on('disconnect', () => this._emit('socket:disconnected'));

    // Forward server events to SDK listeners
    const events = [
      'doca:created', 'doca:updated',
      'operacao:started', 'operacao:updated', 'operacao:finished', 'operacao:cancelled',
      'checklist:item_updated',
    ];
    for (const ev of events) {
      this._socket.on(ev, (data) => this._emit(ev, data));
    }

    return this._socket;
  }

  // ── Event emitter ───────────────────────────────────
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback); // returns unsub fn
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(fn => fn !== callback);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }

  // ── Resource builders ───────────────────────────────
  _buildDocas() {
    return {
      listar:          (params = {}) => this._fetch('/docas?' + new URLSearchParams(params)),
      obter:           (id)          => this._fetch(`/docas/${id}`),
      criar:           (data)        => this._fetch('/docas', { method: 'POST', body: JSON.stringify(data) }),
      atualizar:       (id, data)    => this._fetch(`/docas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      atualizarStatus: (id, status)  => this._fetch(`/docas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    };
  }

  _buildOperacoes() {
    return {
      listar:    (params = {}) => this._fetch('/operacoes?' + new URLSearchParams(params)),
      obter:     (id)          => this._fetch(`/operacoes/${id}`),
      iniciar:   (data)        => this._fetch('/operacoes', { method: 'POST', body: JSON.stringify(data) }),
      atualizar: (id, data)    => this._fetch(`/operacoes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      finalizar: (id, data)    => this._fetch(`/operacoes/${id}/finalizar`, { method: 'POST', body: JSON.stringify(data) }),
      cancelar:  (id, motivo)  => this._fetch(`/operacoes/${id}/cancelar`, { method: 'POST', body: JSON.stringify({ motivo }) }),
    };
  }

  _buildAnalytics() {
    return {
      dashboard:     ()           => this._fetch('/analytics/dashboard'),
      kpis:          ()           => this._fetch('/analytics/kpis'),
      docas:         ()           => this._fetch('/analytics/docas'),
      ranking:       (params)     => this._fetch('/analytics/ranking?' + new URLSearchParams(params)),
      producaoHora:  ()           => this._fetch('/analytics/producao-hora'),
      relatorioTempo:(params)     => this._fetch('/analytics/relatorio-tempo?' + new URLSearchParams(params)),
    };
  }

  _buildUsers() {
    return {
      listar:    ()         => this._fetch('/users'),
      obter:     (id)       => this._fetch(`/users/${id}`),
      criar:     (data)     => this._fetch('/users', { method: 'POST', body: JSON.stringify(data) }),
      atualizar: (id, data) => this._fetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    };
  }

  _buildChecklists() {
    return {
      listarPorOperacao: (opId)           => this._fetch(`/checklists/operacao/${opId}`),
      responderItem:     (itemId, status, observacao) =>
        this._fetch(`/checklists/itens/${itemId}`, { method: 'PATCH', body: JSON.stringify({ status, observacao }) }),
    };
  }

  _buildFotos() {
    return {
      listar: (params = {}) => this._fetch('/fotos?' + new URLSearchParams(params)),
      upload: async (file, extra = {}) => {
        const form = new FormData();
        form.append('foto', file);
        Object.entries(extra).forEach(([k, v]) => form.append(k, v));
        return this._fetch('/fotos/upload', {
          method:  'POST',
          body:    form,
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
      },
      deletar: (id) => this._fetch(`/fotos/${id}`, { method: 'DELETE' }),
    };
  }

  _buildRelatorios() {
    return {
      operacoes: (params = {}) => this._fetch('/relatorios/operacoes?' + new URLSearchParams(params)),
    };
  }
}

// Export for ES modules and CommonJS
if (typeof module !== 'undefined') module.exports = DockCheckSDK;
else window.DockCheckSDK = DockCheckSDK;
