// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Multi-CD + Multiempresa Enterprise
// Fase 12 — multicd.js
// ══════════════════════════════════════════════════════
// Módulo de visão consolidada multi-CD para:
//   - Admin: vê todos os CDs da sua empresa
//   - Superadmin: vê todas as empresas + todos os CDs
//
// Deps: backend.js (API_URL, _fetchAuth), utils.js (toast)
// CSS: injetado via _injetarCSSMultiCD() — style.css intocado
// ══════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── Estado do módulo ───────────────────────────────
  const _state = {
    cds: [],
    empresas: [],
    dashboardData: null,
    comparativoData: null,
    cdSelecionado: null,
    empresaSelecionada: null,
    periodo: '7d',
    modoSuperadmin: false,
    loadingCDs: false,
    loadingComparativo: false,
    charts: {},
  };

  // ─── CSS injetado dinamicamente ─────────────────────
  function _injetarCSSMultiCD() {
    if (document.getElementById('multicd-css')) return;
    const style = document.createElement('style');
    style.id = 'multicd-css';
    style.textContent = `
      /* ═══ MULTI-CD — Fase 12 ═══════════════════════ */
      #tab-multicd {
        display: none;
        padding: 0 0 60px 0;
        animation: mcFadeIn .3s ease;
      }
      #tab-multicd.active { display: block; }

      @keyframes mcFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* ─── Header ─────────────────────────────────── */
      .mc-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 16px 10px;
        border-bottom: 1px solid var(--brd);
        gap: 12px;
        flex-wrap: wrap;
      }
      .mc-header-left { display: flex; align-items: center; gap: 12px; }
      .mc-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--txt);
        letter-spacing: .5px;
      }
      .mc-badge-plano {
        font-size: .65rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .mc-badge-plano.enterprise { background: var(--acc); color: #000; }
      .mc-badge-plano.pro  { background: var(--grn); color: #000; }
      .mc-badge-plano.basic { background: var(--brd); color: var(--mut); }
      .mc-badge-plano.superadmin { background: #7c3aed; color: #fff; }

      .mc-controls { display: flex; gap: 8px; flex-wrap: wrap; }
      .mc-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: 6px; border: 1px solid var(--brd);
        background: var(--bg2); color: var(--txt);
        font-size: .8rem; font-weight: 600; cursor: pointer;
        transition: all .2s;
      }
      .mc-btn:hover { border-color: var(--acc); color: var(--acc); }
      .mc-btn.primary { background: var(--acc); color: #000; border-color: var(--acc); }
      .mc-btn.primary:hover { opacity: .85; }
      .mc-btn.active { border-color: var(--acc); color: var(--acc); }

      /* ─── Filtros de período ─────────────────────── */
      .mc-periodo-bar {
        display: flex; gap: 4px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--brd);
      }
      .mc-periodo-btn {
        padding: 4px 12px; border-radius: 4px; border: 1px solid var(--brd);
        background: var(--bg2); color: var(--mut);
        font-size: .75rem; font-weight: 600; cursor: pointer;
        transition: all .15s;
      }
      .mc-periodo-btn.active {
        background: var(--acc); color: #000; border-color: var(--acc);
      }

      /* ─── KPI Cards ──────────────────────────────── */
      .mc-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
        padding: 14px 16px;
      }
      .mc-kpi {
        background: var(--bg2);
        border: 1px solid var(--brd);
        border-radius: 8px;
        padding: 12px 14px;
        position: relative;
        overflow: hidden;
        transition: border-color .2s;
      }
      .mc-kpi:hover { border-color: var(--acc); }
      .mc-kpi::before {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; height: 2px;
        background: var(--acc);
      }
      .mc-kpi.verde::before { background: var(--grn); }
      .mc-kpi.vermelho::before { background: var(--red); }
      .mc-kpi-label {
        font-size: .68rem; color: var(--mut);
        text-transform: uppercase; letter-spacing: .5px;
        margin-bottom: 6px;
      }
      .mc-kpi-valor {
        font-size: 1.6rem; font-weight: 800;
        color: var(--txt); line-height: 1;
      }
      .mc-kpi-sub {
        font-size: .7rem; color: var(--mut); margin-top: 4px;
      }

      /* ─── Seção ──────────────────────────────────── */
      .mc-section {
        padding: 0 16px 16px;
      }
      .mc-section-title {
        font-size: .75rem; font-weight: 700;
        color: var(--mut); text-transform: uppercase;
        letter-spacing: 1px;
        margin: 14px 0 8px;
        display: flex; align-items: center; gap: 8px;
      }
      .mc-section-title::after {
        content: ''; flex: 1; height: 1px; background: var(--brd);
      }

      /* ─── Cards de CD ────────────────────────────── */
      .mc-cd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 10px;
      }
      .mc-cd-card {
        background: var(--bg2);
        border: 1px solid var(--brd);
        border-radius: 10px;
        padding: 14px;
        cursor: pointer;
        transition: all .2s;
        position: relative;
      }
      .mc-cd-card:hover {
        border-color: var(--acc);
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0,0,0,.3);
      }
      .mc-cd-card.selecionado {
        border-color: var(--acc);
        background: color-mix(in srgb, var(--acc) 8%, var(--bg2));
      }
      .mc-cd-card-header {
        display: flex; align-items: flex-start;
        justify-content: space-between; gap: 8px;
        margin-bottom: 10px;
      }
      .mc-cd-codigo {
        font-size: .65rem; font-weight: 700;
        color: var(--acc); letter-spacing: 1px;
        text-transform: uppercase;
      }
      .mc-cd-nome {
        font-size: .9rem; font-weight: 700; color: var(--txt);
        margin-top: 2px;
      }
      .mc-cd-local {
        font-size: .72rem; color: var(--mut); margin-top: 2px;
      }
      .mc-cd-status {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: .65rem; font-weight: 700;
        padding: 3px 8px; border-radius: 20px;
        white-space: nowrap;
      }
      .mc-cd-status.ativo   { background: rgba(0,200,100,.15); color: var(--grn); }
      .mc-cd-status.inativo { background: rgba(255,60,60,.1);  color: var(--red); }
      .mc-cd-metrics {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 6px; margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--brd);
      }
      .mc-cd-metric { text-align: center; }
      .mc-cd-metric-val {
        font-size: 1.1rem; font-weight: 800; color: var(--txt);
      }
      .mc-cd-metric-lbl {
        font-size: .6rem; color: var(--mut); margin-top: 2px;
      }
      .mc-cd-score {
        position: absolute; top: 14px; right: 14px;
        width: 36px; height: 36px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: .75rem; font-weight: 800;
        border: 2px solid;
      }
      .mc-cd-score.alto   { border-color: var(--grn); color: var(--grn); background: rgba(0,200,100,.1); }
      .mc-cd-score.medio  { border-color: var(--acc); color: var(--acc); background: rgba(255,180,0,.1); }
      .mc-cd-score.baixo  { border-color: var(--red); color: var(--red); background: rgba(255,60,60,.1); }

      /* ─── Ranking comparativo ────────────────────── */
      .mc-ranking-table {
        width: 100%;
        border-collapse: collapse;
        font-size: .8rem;
      }
      .mc-ranking-table th {
        text-align: left; padding: 8px 10px;
        font-size: .65rem; font-weight: 700;
        color: var(--mut); text-transform: uppercase; letter-spacing: .5px;
        border-bottom: 1px solid var(--brd);
      }
      .mc-ranking-table td {
        padding: 9px 10px;
        border-bottom: 1px solid color-mix(in srgb, var(--brd) 50%, transparent);
        color: var(--txt);
        vertical-align: middle;
      }
      .mc-ranking-table tr:hover td { background: color-mix(in srgb, var(--acc) 5%, transparent); }
      .mc-pos {
        font-size: .7rem; font-weight: 800;
        color: var(--mut); width: 28px;
      }
      .mc-pos.gold   { color: #ffd700; }
      .mc-pos.silver { color: #c0c0c0; }
      .mc-pos.bronze { color: #cd7f32; }
      .mc-score-bar-wrap {
        display: flex; align-items: center; gap: 8px;
      }
      .mc-score-bar {
        flex: 1; height: 4px; background: var(--brd); border-radius: 2px; overflow: hidden;
      }
      .mc-score-bar-fill {
        height: 100%; border-radius: 2px;
        background: linear-gradient(90deg, var(--acc), var(--grn));
        transition: width .6s ease;
      }

      /* ─── Painel detalhe CD ──────────────────────── */
      .mc-detalhe-panel {
        background: var(--bg2);
        border: 1px solid var(--brd);
        border-radius: 10px;
        padding: 16px;
        margin-top: 0;
        animation: mcFadeIn .25s ease;
      }
      .mc-detalhe-header {
        display: flex; justify-content: space-between; align-items: flex-start;
        margin-bottom: 14px; gap: 12px;
      }
      .mc-detalhe-close {
        background: none; border: 1px solid var(--brd);
        color: var(--mut); border-radius: 4px;
        width: 28px; height: 28px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 1rem; flex-shrink: 0;
        transition: all .15s;
      }
      .mc-detalhe-close:hover { border-color: var(--red); color: var(--red); }

      /* ─── Canvas chart ───────────────────────────── */
      .mc-chart-wrap {
        position: relative; height: 140px;
        background: var(--bg);
        border-radius: 6px;
        border: 1px solid var(--brd);
        padding: 8px;
        margin-top: 6px;
      }
      .mc-chart-wrap canvas { width: 100% !important; height: 100% !important; }

      /* ─── Superadmin — painel de empresas ────────── */
      .mc-empresa-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--brd);
        border-radius: 8px;
        background: var(--bg2);
        cursor: pointer;
        transition: all .15s;
        margin-bottom: 6px;
      }
      .mc-empresa-item:hover { border-color: var(--acc); }
      .mc-empresa-item.selecionada { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 6%, var(--bg2)); }
      .mc-empresa-avatar {
        width: 36px; height: 36px; border-radius: 8px;
        background: var(--acc); color: #000;
        display: flex; align-items: center; justify-content: center;
        font-size: .85rem; font-weight: 800; flex-shrink: 0;
      }
      .mc-empresa-nome { font-size: .85rem; font-weight: 700; color: var(--txt); }
      .mc-empresa-meta { font-size: .7rem; color: var(--mut); margin-top: 1px; }
      .mc-empresa-ops  {
        margin-left: auto; text-align: right;
        font-size: .8rem; font-weight: 700; color: var(--acc);
      }

      /* ─── Alertas ────────────────────────────────── */
      .mc-alerta {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid;
        margin-bottom: 6px;
        font-size: .8rem;
      }
      .mc-alerta.warn { border-color: rgba(255,180,0,.4); background: rgba(255,180,0,.08); color: var(--acc); }
      .mc-alerta.info { border-color: rgba(60,120,255,.3); background: rgba(60,120,255,.08); color: #6699ff; }
      .mc-alerta-icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
      .mc-alerta-txt  { flex: 1; }
      .mc-alerta-title { font-weight: 700; margin-bottom: 2px; }
      .mc-alerta-sub   { color: var(--mut); font-size: .72rem; }

      /* ─── Empty state ────────────────────────────── */
      .mc-empty {
        text-align: center;
        padding: 40px 20px;
        color: var(--mut);
      }
      .mc-empty-icon { font-size: 2.5rem; margin-bottom: 10px; }
      .mc-empty-title { font-size: .9rem; font-weight: 700; color: var(--txt); margin-bottom: 6px; }
      .mc-empty-sub   { font-size: .8rem; }

      /* ─── Loading ────────────────────────────────── */
      .mc-loading {
        display: flex; align-items: center; justify-content: center;
        gap: 8px; padding: 30px;
        color: var(--mut); font-size: .85rem;
      }
      .mc-spinner {
        width: 18px; height: 18px;
        border: 2px solid var(--brd);
        border-top-color: var(--acc);
        border-radius: 50%;
        animation: mcSpin .7s linear infinite;
      }
      @keyframes mcSpin { to { transform: rotate(360deg); } }

      /* ─── Tabs internas ──────────────────────────── */
      .mc-tabs {
        display: flex; gap: 0;
        border-bottom: 1px solid var(--brd);
        padding: 0 16px;
        margin-bottom: 0;
      }
      .mc-tab {
        padding: 10px 16px;
        font-size: .78rem; font-weight: 600;
        color: var(--mut); cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: all .15s;
      }
      .mc-tab.active { color: var(--acc); border-bottom-color: var(--acc); }
      .mc-tab-panel  { display: none; }
      .mc-tab-panel.active { display: block; }

      /* ─── Modal criar CD ─────────────────────────── */
      .mc-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.7);
        z-index: 9000;
        display: flex; align-items: flex-end; justify-content: center;
        animation: mcFadeIn .2s ease;
      }
      .mc-modal {
        background: var(--bg2);
        border: 1px solid var(--brd);
        border-radius: 16px 16px 0 0;
        padding: 20px 16px 32px;
        width: 100%; max-width: 480px;
        max-height: 90vh; overflow-y: auto;
      }
      .mc-modal-title {
        font-size: 1rem; font-weight: 700; color: var(--txt);
        margin-bottom: 16px;
        display: flex; justify-content: space-between;
      }
      .mc-form-group { margin-bottom: 12px; }
      .mc-form-label {
        display: block;
        font-size: .72rem; font-weight: 600; color: var(--mut);
        text-transform: uppercase; letter-spacing: .5px;
        margin-bottom: 5px;
      }
      .mc-form-input {
        width: 100%; padding: 9px 12px;
        background: var(--bg); border: 1px solid var(--brd);
        border-radius: 6px; color: var(--txt);
        font-size: .85rem;
        transition: border-color .15s;
        box-sizing: border-box;
      }
      .mc-form-input:focus { outline: none; border-color: var(--acc); }
      .mc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    `;
    document.head.appendChild(style);
  }

  // ─── HTML da aba principal ──────────────────────────
  function _buildHTML() {
    return `
      <div class="mc-header">
        <div class="mc-header-left">
          <span class="mc-title">🏢 Multi-CD</span>
          <span class="mc-badge-plano" id="mc-badge-plano">—</span>
        </div>
        <div class="mc-controls">
          <button class="mc-btn" id="mc-btn-refresh" onclick="multiCDRefresh()">⟳ Atualizar</button>
          <button class="mc-btn primary" id="mc-btn-novo-cd" onclick="multiCDNovoCD()" style="display:none">
            + Novo CD
          </button>
        </div>
      </div>

      <div class="mc-periodo-bar">
        ${['1d','7d','30d','90d'].map(p => `
          <button class="mc-periodo-btn${p==='7d'?' active':''}"
            onclick="multiCDSetPeriodo('${p}')">${p}</button>
        `).join('')}
      </div>

      <!-- Tabs internas -->
      <div class="mc-tabs">
        <div class="mc-tab active" onclick="multiCDSetTab('visao-geral')">📊 Visão Geral</div>
        <div class="mc-tab" onclick="multiCDSetTab('comparativo')">🏆 Comparativo</div>
        <div class="mc-tab" onclick="multiCDSetTab('alertas')">🔔 Alertas</div>
        <div class="mc-tab mc-tab-sa" onclick="multiCDSetTab('empresas')" style="display:none">🌐 Empresas</div>
      </div>

      <!-- Tab: Visão Geral -->
      <div class="mc-tab-panel active" id="mct-visao-geral">
        <div class="mc-kpi-grid" id="mc-kpis">
          <div class="mc-loading"><div class="mc-spinner"></div> Carregando...</div>
        </div>
        <div class="mc-section">
          <div class="mc-section-title">Centros de Distribuição</div>
          <div id="mc-cd-grid" class="mc-cd-grid">
            <div class="mc-loading"><div class="mc-spinner"></div></div>
          </div>
          <div id="mc-detalhe-cd"></div>
        </div>
      </div>

      <!-- Tab: Comparativo -->
      <div class="mc-tab-panel" id="mct-comparativo">
        <div class="mc-section">
          <div class="mc-section-title">Ranking de CDs</div>
          <div id="mc-ranking"></div>
        </div>
      </div>

      <!-- Tab: Alertas -->
      <div class="mc-tab-panel" id="mct-alertas">
        <div class="mc-section">
          <div class="mc-section-title">Alertas</div>
          <div id="mc-alertas-list"></div>
        </div>
      </div>

      <!-- Tab: Empresas (superadmin) -->
      <div class="mc-tab-panel" id="mct-empresas">
        <div class="mc-section">
          <div class="mc-section-title">Todas as Empresas</div>
          <div id="mc-empresas-list"></div>
        </div>
      </div>
    `;
  }

  // ─── Init ───────────────────────────────────────────
  function _init() {
    _injetarCSSMultiCD();

    // Criar tab no DOM se não existir
    if (!document.getElementById('tab-multicd')) {
      const tab = document.createElement('div');
      tab.id = 'tab-multicd';
      tab.className = 'tab-content';
      tab.innerHTML = _buildHTML();
      document.querySelector('.tab-contents, #app-tabs, .tabs-wrapper, main, body')?.appendChild(tab)
        || document.body.appendChild(tab);
    }

    // Detectar usuário
    const userStr = localStorage.getItem('dc_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        _state.modoSuperadmin = user.role === 'superadmin';
        const badge = document.getElementById('mc-badge-plano');
        if (badge) {
          badge.textContent = _state.modoSuperadmin ? 'SUPERADMIN' : (user.plano || 'enterprise').toUpperCase();
          badge.className = 'mc-badge-plano ' + (_state.modoSuperadmin ? 'superadmin' : (user.plano || 'enterprise'));
        }
        if (_state.modoSuperadmin) {
          document.querySelectorAll('.mc-tab-sa').forEach(el => el.style.display = '');
        }
      } catch {}
    }
  }

  // ─── Carregar dados ─────────────────────────────────
  async function _loadDashboard() {
    _state.loadingCDs = true;
    _renderKPIsLoading();
    _renderCDsLoading();

    try {
      if (_state.modoSuperadmin) {
        await _loadDashboardSuperadmin();
      } else {
        await _loadDashboardEmpresa();
      }
    } catch (err) {
      console.error('[MultiCD] Load error:', err);
      _renderErro('mc-kpis', 'Erro ao carregar dados');
      _renderErro('mc-cd-grid', '');
    } finally {
      _state.loadingCDs = false;
    }
  }

  async function _loadDashboardEmpresa() {
    const [cdsRes, saRes] = await Promise.all([
      _api(`/cds?ativo=true`),
      _api(`/superadmin/dashboard?periodo=${_state.periodo}`).catch(() => null)
    ]);

    _state.cds = cdsRes?.cds || [];

    // KPIs consolidados locais
    const kpis = {
      total_cds: _state.cds.length,
      docas_ativas: _state.cds.reduce((a, c) => a + parseInt(c.total_docas || 0), 0),
      ops_ativas: _state.cds.reduce((a, c) => a + parseInt(c.operacoes_ativas || 0), 0),
      docas_em_op: _state.cds.reduce((a, c) => a + parseInt(c.docas_em_operacao || 0), 0),
    };

    _renderKPIs([
      { label: 'CDs Ativos', valor: kpis.total_cds, icon: '🏭' },
      { label: 'Docas Totais', valor: kpis.docas_ativas, icon: '🚪' },
      { label: 'Em Operação', valor: kpis.docas_em_op, icon: '⚡', classe: kpis.docas_em_op > 0 ? 'verde' : '' },
      { label: 'Ops Ativas', valor: kpis.ops_ativas, icon: '📦', classe: kpis.ops_ativas > 0 ? 'verde' : '' },
    ]);

    _renderCDs(_state.cds);
    await _loadComparativo();
    _renderAlertas([]);
  }

  async function _loadDashboardSuperadmin() {
    const [dashboard, empresas] = await Promise.all([
      _api(`/superadmin/dashboard?periodo=${_state.periodo}`),
      _api(`/empresas?limit=50`)
    ]);

    _state.dashboardData = dashboard;
    _state.empresas = empresas?.empresas || [];

    const p = dashboard.plataforma;
    _renderKPIs([
      { label: 'Empresas Ativas', valor: p.empresas_ativas, icon: '🏢' },
      { label: 'Usuários', valor: p.usuarios_ativos, icon: '👥' },
      { label: 'CDs Ativos', valor: p.cds_ativos, icon: '🏭' },
      { label: 'Ops Agora', valor: p.ops_agora, icon: '⚡', classe: p.ops_agora > 0 ? 'verde' : '' },
      { label: `Ops (${_state.periodo})`, valor: p.ops_periodo, icon: '📦' },
      { label: 'Volumes', valor: _fmt(p.volumes_periodo), icon: '📊', classe: 'verde' },
    ]);

    // Mostrar top empresas como "CDs"
    const topCards = (dashboard.top_empresas || []).slice(0, 12).map(e => ({
      id: e.id,
      nome: e.nome,
      codigo: e.plano?.toUpperCase() || 'BASIC',
      cidade: `${e.ops_periodo} ops · ${e.cds} CDs`,
      estado: '',
      ativo: true,
      total_docas: e.cds,
      operacoes_ativas: e.ops_periodo,
      docas_em_operacao: 0,
      _isEmpresa: true,
      _score: Math.min(100, Math.round((e.ops_periodo || 0) / 2)),
    }));
    _renderCDs(topCards);

    // Empresas tab
    _renderEmpresas(_state.empresas, dashboard.alertas);
    _renderAlertas(dashboard.alertas || []);

    await _loadComparativo();
  }

  async function _loadComparativo() {
    _state.loadingComparativo = true;
    const el = document.getElementById('mc-ranking');
    if (el) el.innerHTML = '<div class="mc-loading"><div class="mc-spinner"></div> Carregando ranking...</div>';

    try {
      const endpoint = _state.modoSuperadmin
        ? `/superadmin/comparativo-cds?periodo=${_state.periodo}`
        : null;

      if (endpoint) {
        const data = await _api(endpoint);
        _renderRanking(data.cds || []);
      } else {
        // Para empresa normal: buscar analytics de cada CD
        const promises = _state.cds.map(cd =>
          _api(`/cds/${cd.id}/analytics?periodo=${_state.periodo}`)
            .then(r => ({ ...r, cd_nome: cd.nome, cd_codigo: cd.codigo }))
            .catch(() => null)
        );
        const resultados = (await Promise.all(promises)).filter(Boolean);

        const ranking = resultados.map(r => ({
          cd_nome: r.cd?.nome || r.cd_nome,
          cd_codigo: r.cd?.codigo || r.cd_codigo,
          empresa_nome: '',
          total_ops: parseInt(r.kpis?.total_operacoes || 0),
          ops_finalizadas: parseInt(r.kpis?.finalizadas || 0),
          taxa_conclusao: parseFloat(r.kpis?.taxa_conclusao || 0),
          tempo_medio_min: parseFloat(r.kpis?.tempo_medio_min || 0),
          score_cd: Math.round(
            (parseFloat(r.kpis?.taxa_conclusao || 0)) * 0.6 +
            Math.min(40, parseInt(r.kpis?.total_operacoes || 0) / 2)
          )
        })).sort((a, b) => b.score_cd - a.score_cd);

        _renderRanking(ranking);
      }
    } catch {}
    _state.loadingComparativo = false;
  }

  // ─── Renders ─────────────────────────────────────────
  function _renderKPIsLoading() {
    const el = document.getElementById('mc-kpis');
    if (el) el.innerHTML = '<div class="mc-loading"><div class="mc-spinner"></div> Carregando...</div>';
  }
  function _renderCDsLoading() {
    const el = document.getElementById('mc-cd-grid');
    if (el) el.innerHTML = '<div class="mc-loading"><div class="mc-spinner"></div></div>';
  }
  function _renderErro(id, msg) {
    const el = document.getElementById(id);
    if (el && msg) el.innerHTML = `<div class="mc-empty"><div class="mc-empty-icon">⚠️</div><div>${msg}</div></div>`;
  }

  function _renderKPIs(kpis) {
    const el = document.getElementById('mc-kpis');
    if (!el) return;
    el.innerHTML = kpis.map(k => `
      <div class="mc-kpi ${k.classe || ''}">
        <div class="mc-kpi-label">${k.icon} ${k.label}</div>
        <div class="mc-kpi-valor">${k.valor ?? '—'}</div>
      </div>
    `).join('');
  }

  function _renderCDs(cds) {
    const el = document.getElementById('mc-cd-grid');
    if (!el) return;

    // Mostrar botão novo CD para admin+
    const userStr = localStorage.getItem('dc_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const podeGerenciar = user && ['admin','superadmin'].includes(user.role);
    const btnNovo = document.getElementById('mc-btn-novo-cd');
    if (btnNovo && podeGerenciar && !_state.modoSuperadmin) btnNovo.style.display = '';

    if (!cds.length) {
      el.innerHTML = `
        <div class="mc-empty" style="grid-column:1/-1">
          <div class="mc-empty-icon">🏭</div>
          <div class="mc-empty-title">Nenhum CD cadastrado</div>
          <div class="mc-empty-sub">Clique em "+ Novo CD" para começar.</div>
        </div>`;
      return;
    }

    el.innerHTML = cds.map(cd => {
      const score = cd.score_cd !== undefined ? Math.round(cd.score_cd) : null;
      const scoreClass = score !== null ? (score >= 70 ? 'alto' : score >= 40 ? 'medio' : 'baixo') : '';
      const localStr = [cd.cidade, cd.estado].filter(Boolean).join(' · ') || cd._isEmpresa ? cd.cidade : '—';

      return `
        <div class="mc-cd-card" onclick="multiCDSelectCD('${cd.id}')">
          ${score !== null ? `<div class="mc-cd-score ${scoreClass}">${score}</div>` : ''}
          <div class="mc-cd-card-header">
            <div>
              <div class="mc-cd-codigo">${cd.codigo || '—'}</div>
              <div class="mc-cd-nome">${cd.nome}</div>
              <div class="mc-cd-local">${localStr || '—'}</div>
            </div>
          </div>
          <span class="mc-cd-status ${cd.ativo ? 'ativo' : 'inativo'}">
            ${cd.ativo ? '● Ativo' : '○ Inativo'}
          </span>
          <div class="mc-cd-metrics">
            <div class="mc-cd-metric">
              <div class="mc-cd-metric-val">${cd.total_docas ?? '—'}</div>
              <div class="mc-cd-metric-lbl">Docas</div>
            </div>
            <div class="mc-cd-metric">
              <div class="mc-cd-metric-val">${cd.docas_em_operacao ?? 0}</div>
              <div class="mc-cd-metric-lbl">Em op.</div>
            </div>
            <div class="mc-cd-metric">
              <div class="mc-cd-metric-val">${cd.operacoes_ativas ?? '—'}</div>
              <div class="mc-cd-metric-lbl">Ops ativas</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _renderRanking(cds) {
    const el = document.getElementById('mc-ranking');
    if (!el) return;

    if (!cds.length) {
      el.innerHTML = '<div class="mc-empty"><div class="mc-empty-icon">📊</div><div>Sem dados suficientes.</div></div>';
      return;
    }

    const posClass = ['gold', 'silver', 'bronze'];

    el.innerHTML = `
      <table class="mc-ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>CD</th>
            ${_state.modoSuperadmin ? '<th>Empresa</th>' : ''}
            <th>Ops</th>
            <th>Conclusão</th>
            <th>T. Médio</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          ${cds.map((cd, i) => `
            <tr>
              <td class="mc-pos ${posClass[i] || ''}">${i + 1}</td>
              <td>
                <div style="font-weight:700;font-size:.82rem">${cd.cd_nome}</div>
                <div style="font-size:.68rem;color:var(--mut)">${cd.cd_codigo || ''}</div>
              </td>
              ${_state.modoSuperadmin ? `<td style="font-size:.75rem;color:var(--mut)">${cd.empresa_nome || ''}</td>` : ''}
              <td>${cd.total_ops || 0}</td>
              <td>${cd.taxa_conclusao != null ? cd.taxa_conclusao + '%' : '—'}</td>
              <td>${cd.tempo_medio_min ? cd.tempo_medio_min + 'min' : '—'}</td>
              <td>
                <div class="mc-score-bar-wrap">
                  <div class="mc-score-bar">
                    <div class="mc-score-bar-fill" style="width:${cd.score_cd || 0}%"></div>
                  </div>
                  <span style="font-size:.75rem;font-weight:700;color:var(--txt);min-width:28px">
                    ${Math.round(cd.score_cd || 0)}
                  </span>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function _renderAlertas(alertas) {
    const el = document.getElementById('mc-alertas-list');
    if (!el) return;

    if (!alertas.length) {
      el.innerHTML = '<div class="mc-empty"><div class="mc-empty-icon">✅</div><div class="mc-empty-title">Sem alertas ativos</div></div>';
      return;
    }

    el.innerHTML = alertas.map(a => {
      const isWarn = a.tipo_alerta === 'trial_expirando';
      const msgs = {
        trial_expirando: { icon: '⏰', title: 'Trial expirando', sub: `Empresa "${a.empresa_nome}" — trial encerra em breve` },
        sem_operacoes_7d: { icon: '😴', title: 'Empresa inativa', sub: `"${a.empresa_nome}" sem operações nos últimos 7 dias` },
      };
      const m = msgs[a.tipo_alerta] || { icon: '⚠️', title: a.tipo_alerta, sub: a.empresa_nome };
      return `
        <div class="mc-alerta ${isWarn ? 'warn' : 'info'}">
          <div class="mc-alerta-icon">${m.icon}</div>
          <div class="mc-alerta-txt">
            <div class="mc-alerta-title">${m.title}</div>
            <div class="mc-alerta-sub">${m.sub}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _renderEmpresas(empresas, alertas = []) {
    const el = document.getElementById('mc-empresas-list');
    if (!el) return;

    const alertaIds = new Set((alertas || []).map(a => a.empresa_id));

    el.innerHTML = empresas.map(e => {
      const inicial = (e.nome || 'E').charAt(0).toUpperCase();
      return `
        <div class="mc-empresa-item${_state.empresaSelecionada?.id === e.id ? ' selecionada' : ''}"
          onclick="multiCDSelectEmpresa('${e.id}')">
          <div class="mc-empresa-avatar">${inicial}</div>
          <div>
            <div class="mc-empresa-nome">${e.nome} ${alertaIds.has(e.id) ? '⚠️' : ''}</div>
            <div class="mc-empresa-meta">${e.plano} · ${e.cds_ativos || 0} CDs · ${e.usuarios_ativos || 0} usuários</div>
          </div>
          <div class="mc-empresa-ops">${e.ops_30d || 0}<br><span style="font-size:.65rem;color:var(--mut)">30d</span></div>
        </div>
      `;
    }).join('') || '<div class="mc-empty"><div>Nenhuma empresa encontrada.</div></div>';
  }

  async function _renderDetalheCd(cdId) {
    const el = document.getElementById('mc-detalhe-cd');
    if (!el) return;

    el.innerHTML = '<div class="mc-loading"><div class="mc-spinner"></div> Carregando analytics...</div>';

    try {
      const data = await _api(`/cds/${cdId}/analytics?periodo=${_state.periodo}`);
      const k = data.kpis;

      el.innerHTML = `
        <div class="mc-detalhe-panel">
          <div class="mc-detalhe-header">
            <div>
              <div class="mc-cd-codigo">${data.cd?.codigo || ''}</div>
              <div class="mc-cd-nome">${data.cd?.nome || ''}</div>
              <div class="mc-cd-local">Período: ${_state.periodo}</div>
            </div>
            <button class="mc-detalhe-close" onclick="multiCDCloseDetalhe()">✕</button>
          </div>

          <div class="mc-kpi-grid" style="padding:0 0 12px">
            ${[
              { label: 'Total Ops', valor: k.total_operacoes ?? '—' },
              { label: 'Finalizadas', valor: k.finalizadas ?? '—', classe: 'verde' },
              { label: 'Conclusão', valor: k.taxa_conclusao != null ? k.taxa_conclusao + '%' : '—' },
              { label: 'T. Médio', valor: k.tempo_medio_min ? k.tempo_medio_min + 'min' : '—' },
              { label: 'Volumes', valor: k.total_volumes ?? '—', classe: 'verde' },
              { label: 'Em Andamento', valor: k.em_andamento ?? '—' },
            ].map(kp => `
              <div class="mc-kpi ${kp.classe || ''}">
                <div class="mc-kpi-label">${kp.label}</div>
                <div class="mc-kpi-valor" style="font-size:1.2rem">${kp.valor}</div>
              </div>
            `).join('')}
          </div>

          ${data.historico?.length ? `
            <div class="mc-section-title" style="margin-top:0">Histórico de Operações</div>
            <div class="mc-chart-wrap">
              <canvas id="mc-chart-historico"></canvas>
            </div>
          ` : ''}

          ${data.docas?.length ? `
            <div class="mc-section-title">Docas</div>
            ${data.docas.map(d => `
              <div style="display:flex;align-items:center;justify-content:space-between;
                padding:7px 10px;border-radius:6px;border:1px solid var(--brd);
                background:var(--bg);margin-bottom:5px;font-size:.8rem">
                <span style="font-weight:700">${d.numero}</span>
                <span style="color:var(--mut)">${d.tipo}</span>
                <span class="mc-cd-status ${d.status === 'em_operacao' ? 'ativo' : ''}">
                  ${d.status?.replace(/_/g,' ')}
                </span>
                <span style="color:var(--acc);font-weight:700">${d.ops_periodo || 0} ops</span>
              </div>
            `).join('')}
          ` : ''}
        </div>
      `;

      // Desenhar gráfico
      if (data.historico?.length) {
        _drawHistoricoChart('mc-chart-historico', data.historico);
      }
    } catch (err) {
      el.innerHTML = `<div class="mc-empty"><div>Erro ao carregar analytics do CD.</div></div>`;
    }
  }

  function _drawHistoricoChart(canvasId, historico) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 300;
    const H = canvas.offsetHeight || 120;
    canvas.width = W;
    canvas.height = H;

    const vals = historico.map(h => parseInt(h.total || 0));
    const max = Math.max(...vals, 1);
    const pad = { t: 10, r: 10, b: 24, l: 30 };
    const W2 = W - pad.l - pad.r;
    const H2 = H - pad.t - pad.b;
    const step = W2 / Math.max(vals.length - 1, 1);

    // Linha de gradiente
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, 'rgba(255,180,0,.4)');
    grad.addColorStop(1, 'rgba(255,180,0,.02)');

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (H2 / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    }

    // Area
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = pad.l + i * step;
      const y = pad.t + H2 - (v / max) * H2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.l + (vals.length - 1) * step, pad.t + H2);
    ctx.lineTo(pad.l, pad.t + H2);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Linha
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = pad.l + i * step;
      const y = pad.t + H2 - (v / max) * H2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'var(--acc, #ffb400)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels X
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    const step2 = Math.max(1, Math.floor(vals.length / 5));
    historico.forEach((h, i) => {
      if (i % step2 === 0) {
        const x = pad.l + i * step;
        ctx.fillText(String(h.dia || '').slice(5), x, H - 4);
      }
    });
  }

  // ─── Modal Criar CD ──────────────────────────────────
  function _abrirModalNovoCD() {
    const overlay = document.createElement('div');
    overlay.className = 'mc-modal-overlay';
    overlay.id = 'mc-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) _fecharModal(); };
    overlay.innerHTML = `
      <div class="mc-modal">
        <div class="mc-modal-title">
          <span>🏭 Novo Centro de Distribuição</span>
          <button class="mc-detalhe-close" onclick="multiCDCloseModal()">✕</button>
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">Nome *</label>
          <input class="mc-form-input" id="mc-f-nome" placeholder="Ex: CD São Paulo Norte">
        </div>
        <div class="mc-form-row">
          <div class="mc-form-group">
            <label class="mc-form-label">Código *</label>
            <input class="mc-form-input" id="mc-f-codigo" placeholder="Ex: SP-NORTE" maxlength="20">
          </div>
          <div class="mc-form-group">
            <label class="mc-form-label">Cap. Docas</label>
            <input class="mc-form-input" id="mc-f-cap" type="number" value="10" min="1">
          </div>
        </div>
        <div class="mc-form-row">
          <div class="mc-form-group">
            <label class="mc-form-label">Cidade</label>
            <input class="mc-form-input" id="mc-f-cidade" placeholder="São Paulo">
          </div>
          <div class="mc-form-group">
            <label class="mc-form-label">Estado</label>
            <input class="mc-form-input" id="mc-f-estado" placeholder="SP" maxlength="2">
          </div>
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">Responsável</label>
          <input class="mc-form-input" id="mc-f-resp" placeholder="Nome do gerente">
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">Endereço</label>
          <input class="mc-form-input" id="mc-f-end" placeholder="Rua, número...">
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="mc-btn" style="flex:1" onclick="multiCDCloseModal()">Cancelar</button>
          <button class="mc-btn primary" style="flex:2" onclick="multiCDSalvarCD()">✓ Criar CD</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function _fecharModal() {
    document.getElementById('mc-modal-overlay')?.remove();
  }

  async function _salvarCD() {
    const nome      = document.getElementById('mc-f-nome')?.value?.trim();
    const codigo    = document.getElementById('mc-f-codigo')?.value?.trim();
    const cidade    = document.getElementById('mc-f-cidade')?.value?.trim();
    const estado    = document.getElementById('mc-f-estado')?.value?.trim()?.toUpperCase();
    const responsavel = document.getElementById('mc-f-resp')?.value?.trim();
    const endereco  = document.getElementById('mc-f-end')?.value?.trim();
    const cap       = parseInt(document.getElementById('mc-f-cap')?.value) || 10;

    if (!nome || !codigo) {
      if (typeof toast === 'function') toast('Nome e código são obrigatórios', 'error');
      return;
    }

    try {
      const res = await _api('/cds', 'POST', { nome, codigo, cidade, estado, responsavel, endereco, capacidade_docas: cap });
      if (typeof toast === 'function') toast(`CD "${res.cd.nome}" criado!`, 'success');
      _fecharModal();
      _loadDashboard();
    } catch (err) {
      const msg = err.message || 'Erro ao criar CD';
      if (typeof toast === 'function') toast(msg, 'error');
    }
  }

  // ─── API Helper ──────────────────────────────────────
  async function _api(path, method = 'GET', body = null) {
    // Usa _fetchAuth de backend.js se disponível
    if (typeof _fetchAuth === 'function') {
      return _fetchAuth(path, { method, body: body ? JSON.stringify(body) : undefined,
        headers: body ? { 'Content-Type': 'application/json' } : undefined });
    }

    const BACKEND_URL = 'https://expidlog-production.up.railway.app';
    const token = localStorage.getItem('dc_access_token');
    const r = await fetch(BACKEND_URL + '/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || r.statusText);
    }
    return r.json();
  }

  // ─── Formato numérico ────────────────────────────────
  function _fmt(n) {
    if (n == null) return '—';
    const num = parseInt(n);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000)    return (num / 1000).toFixed(1) + 'k';
    return String(num);
  }

  // ─── Tab switcher ────────────────────────────────────
  function _setTab(tab) {
    document.querySelectorAll('#tab-multicd .mc-tab').forEach((el, i) => {
      const tabs = ['visao-geral', 'comparativo', 'alertas', 'empresas'];
      el.classList.toggle('active', tabs[i] === tab);
    });
    document.querySelectorAll('#tab-multicd .mc-tab-panel').forEach(el => {
      el.classList.remove('active');
    });
    const panel = document.getElementById(`mct-${tab}`);
    if (panel) panel.classList.add('active');
  }

  // ═════════════════════════════════════════════════════
  // API PÚBLICA — chamada pelo HTML
  // ═════════════════════════════════════════════════════

  window.multiCDInit = function () {
    _init();
    _loadDashboard();
  };

  window.multiCDRefresh = function () {
    _loadDashboard();
    if (typeof toast === 'function') toast('Atualizando...', 'info');
  };

  window.multiCDSetPeriodo = function (p) {
    _state.periodo = p;
    document.querySelectorAll('.mc-periodo-btn').forEach(el => {
      el.classList.toggle('active', el.textContent === p);
    });
    _loadDashboard();
  };

  window.multiCDSetTab = function (tab) {
    _setTab(tab);
    if (tab === 'comparativo' && !_state.comparativoData) _loadComparativo();
  };

  window.multiCDSelectCD = function (cdId) {
    if (_state.cdSelecionado === cdId) {
      _state.cdSelecionado = null;
      document.getElementById('mc-detalhe-cd').innerHTML = '';
      document.querySelectorAll('.mc-cd-card').forEach(el => el.classList.remove('selecionado'));
      return;
    }
    _state.cdSelecionado = cdId;
    document.querySelectorAll('.mc-cd-card').forEach(el => el.classList.remove('selecionado'));
    event?.currentTarget?.classList?.add('selecionado');
    _renderDetalheCd(cdId);
  };

  window.multiCDCloseDetalhe = function () {
    _state.cdSelecionado = null;
    document.getElementById('mc-detalhe-cd').innerHTML = '';
    document.querySelectorAll('.mc-cd-card').forEach(el => el.classList.remove('selecionado'));
  };

  window.multiCDSelectEmpresa = async function (empresaId) {
    _state.empresaSelecionada = { id: empresaId };
    _renderEmpresas(_state.empresas, _state.dashboardData?.alertas || []);
    // Focar na visão geral com os CDs dessa empresa
    _setTab('visao-geral');
    if (typeof toast === 'function') toast('Carregando empresa...', 'info');
  };

  window.multiCDNovoCD = function () { _abrirModalNovoCD(); };
  window.multiCDCloseModal = function () { _fecharModal(); };
  window.multiCDSalvarCD = function () { _salvarCD(); };

  // ─── Auto-init quando a aba for aberta ───────────────
  // Compatível com o sistema de tabs existente do DockCheck
  document.addEventListener('DOMContentLoaded', () => {
    _injetarCSSMultiCD();

    // Observa mudança de aba ativa
    const observer = new MutationObserver(() => {
      const tab = document.getElementById('tab-multicd');
      if (tab && (tab.classList.contains('active') || tab.style.display === 'block')) {
        if (!_state.dashboardData && !_state.loadingCDs) {
          multiCDInit();
        }
      }
    });

    const container = document.querySelector('.tab-contents, #app-tabs, main');
    if (container) observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
  });

})();
