/* ════════════════════════════════════════════════════════════
   DOCKCHECK PRO — ENGINE DE AUTOMAÇÃO · Fase 14

   Funcionalidades:
   1. Engine de regras configuráveis por supervisores
   2. Gatilhos operacionais automáticos
   3. Ações automáticas (alertas, notificações, status)
   4. Fila inteligente com priorização automática
   5. Workflows operacionais (entrada→conferência→finalização)
   6. Central de alertas inteligentes
   7. Relatórios automáticos programados
════════════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTES
════════════════════════════════════════════════════════════ */
const AUTO_TICK_MS    = 30_000;  // Verifica regras a cada 30s
const AUTO_STORE_KEY  = 'dc_automacoes_v1';
const AUTO_LOG_KEY    = 'dc_auto_log_v1';
const AUTO_MAX_LOG    = 200;

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */
let _regras       = [];      // regras configuradas
let _autoLog      = [];      // histórico de execuções
let _tickInterval = null;
let _autoInited   = false;

/* ════════════════════════════════════════════════════════════
   REGRAS PADRÃO DO SISTEMA
   São aplicadas sempre, independente das regras do usuário.
════════════════════════════════════════════════════════════ */
const REGRAS_SISTEMA = [
  {
    id: 'sys_doca_parada',
    nome: 'Doca parada',
    gatilho: 'doca_tempo_ativa',
    condicao: { operador: '>', valor: 60 },  // minutos
    acao: 'alerta',
    params: { nivel: 'warn', msg: 'Doca {doca} está parada há {tempo} min' },
    ativo: true,
    sistema: true,
  },
  {
    id: 'sys_doca_critica',
    nome: 'Doca crítica',
    gatilho: 'doca_tempo_ativa',
    condicao: { operador: '>', valor: 120 },
    acao: 'alerta',
    params: { nivel: 'crit', msg: '🚨 Doca {doca} CRÍTICA — {tempo} min sem finalizar' },
    ativo: true,
    sistema: true,
  },
  {
    id: 'sys_fila_alta',
    nome: 'Fila excessiva',
    gatilho: 'fila_tamanho',
    condicao: { operador: '>', valor: 5 },
    acao: 'alerta',
    params: { nivel: 'warn', msg: 'Fila com {valor} veículos aguardando' },
    ativo: true,
    sistema: true,
  },
  {
    id: 'sys_fila_critica',
    nome: 'Fila crítica',
    gatilho: 'fila_tamanho',
    condicao: { operador: '>', valor: 10 },
    acao: 'push_notification',
    params: { nivel: 'crit', msg: '🚨 Fila CRÍTICA: {valor} veículos' },
    ativo: true,
    sistema: true,
  },
  {
    id: 'sys_sem_atividade',
    nome: 'Sem atividade',
    gatilho: 'docas_ativas',
    condicao: { operador: '==', valor: 0 },
    acao: 'alerta',
    params: { nivel: 'info', msg: '⚡ Nenhuma doca ativa no momento' },
    ativo: true,
    sistema: true,
  },
];

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */
function automacaoInit() {
  if (_autoInited) return;
  _autoInited = true;

  _carregarRegras();
  _carregarLog();
  _iniciarTick();

  console.info('[Automação] Engine iniciada —', _regras.length, 'regras carregadas.');
}

/* ════════════════════════════════════════════════════════════
   TICK — verifica todas as regras periodicamente
════════════════════════════════════════════════════════════ */
function _iniciarTick() {
  if (_tickInterval) clearInterval(_tickInterval);
  _tickInterval = setInterval(_avaliarRegras, AUTO_TICK_MS);
  // Primeira avaliação após 5s (aguarda app carregar)
  setTimeout(_avaliarRegras, 5000);
}

async function _avaliarRegras() {
  const ctx = await _coletarContexto();
  const todasRegras = [...REGRAS_SISTEMA, ..._regras].filter(r => r.ativo);

  for (const regra of todasRegras) {
    try {
      const valor = _extrairValor(ctx, regra.gatilho, regra.params);
      if (valor === null) continue;

      const disparou = _avaliarCondicao(valor, regra.condicao);
      if (disparou) {
        await _executarAcao(regra, valor, ctx);
      }
    } catch (err) {
      console.warn('[Automação] Erro na regra', regra.id, err);
    }
  }
}

/* ════════════════════════════════════════════════════════════
   COLETA DE CONTEXTO OPERACIONAL
════════════════════════════════════════════════════════════ */
async function _coletarContexto() {
  const ctx = {
    timestamp:   Date.now(),
    docas_ativas: 0,
    docas:        [],
    fila_tamanho: 0,
    historico_hoje: 0,
    tempo_medio:  0,
  };

  try {
    // Docas ativas (do live strip)
    const chips = document.querySelectorAll('.live-chip.ativa');
    ctx.docas_ativas = chips.length;

    // Dados de doca com tempo
    chips.forEach(chip => {
      const txt  = chip.textContent || '';
      const doca = txt.match(/\d+/)?.[0] || '?';
      // Tenta extrair tempo do chip
      const tempo = _extrairTempoChip(chip);
      ctx.docas.push({ doca, tempo });
    });

    // Fila (do estado global)
    if (typeof window.filaVeiculos !== 'undefined') {
      ctx.fila_tamanho = window.filaVeiculos?.length || 0;
    } else {
      const filaEl = document.querySelectorAll('.fila-item, .oc-item');
      ctx.fila_tamanho = filaEl.length;
    }

    // Histórico de hoje
    if (typeof historico !== 'undefined' && Array.isArray(historico)) {
      const hoje = new Date().toDateString();
      ctx.historico_hoje = historico.filter(r =>
        new Date(r.timestamp || r.data || Date.now()).toDateString() === hoje
      ).length;
    }

  } catch (err) {
    console.warn('[Automação] Erro ao coletar contexto:', err);
  }

  return ctx;
}

function _extrairTempoChip(chip) {
  // Tenta ler o atributo data-inicio ou texto de tempo do chip
  const inicio = chip.dataset?.inicio;
  if (inicio) return Math.floor((Date.now() - Number(inicio)) / 60000);
  const txt = chip.textContent || '';
  const match = txt.match(/(\d+)\s*min/);
  return match ? parseInt(match[1]) : 0;
}

/* ════════════════════════════════════════════════════════════
   EXTRAÇÃO DE VALOR DO CONTEXTO
════════════════════════════════════════════════════════════ */
function _extrairValor(ctx, gatilho, params) {
  switch (gatilho) {
    case 'docas_ativas':
      return ctx.docas_ativas;
    case 'fila_tamanho':
      return ctx.fila_tamanho;
    case 'historico_hoje':
      return ctx.historico_hoje;
    case 'doca_tempo_ativa':
      // Retorna o maior tempo entre as docas ativas
      if (!ctx.docas.length) return null;
      return Math.max(...ctx.docas.map(d => d.tempo || 0));
    default:
      return null;
  }
}

/* ════════════════════════════════════════════════════════════
   AVALIAÇÃO DE CONDIÇÃO
════════════════════════════════════════════════════════════ */
function _avaliarCondicao(valor, condicao) {
  switch (condicao.operador) {
    case '>':  return valor > condicao.valor;
    case '>=': return valor >= condicao.valor;
    case '<':  return valor < condicao.valor;
    case '<=': return valor <= condicao.valor;
    case '==': return valor == condicao.valor;
    case '!=': return valor != condicao.valor;
    default:   return false;
  }
}

/* ════════════════════════════════════════════════════════════
   EXECUÇÃO DE AÇÕES
════════════════════════════════════════════════════════════ */

// Controle anti-spam: não repete o mesmo alerta em < 5 min
const _ultimaExecucao = {};

async function _executarAcao(regra, valor, ctx) {
  const agora = Date.now();
  const ultima = _ultimaExecucao[regra.id] || 0;
  if (agora - ultima < 5 * 60 * 1000) return; // 5 min cooldown
  _ultimaExecucao[regra.id] = agora;

  // Monta mensagem com substituições
  const doca  = ctx.docas?.[0]?.doca || '?';
  const tempo  = ctx.docas?.length ? Math.max(...ctx.docas.map(d => d.tempo || 0)) : 0;
  const msg   = (regra.params.msg || '')
    .replace('{doca}',  doca)
    .replace('{tempo}', tempo)
    .replace('{valor}', valor);

  switch (regra.acao) {
    case 'alerta':
      _dispararAlerta(msg, regra.params.nivel || 'warn', regra);
      break;
    case 'push_notification':
      _dispararPush(msg, regra.params.nivel || 'warn');
      break;
    case 'toast':
      if (typeof toast === 'function') toast(msg);
      break;
    case 'ocorrencia':
      _gerarOcorrencia(msg, regra);
      break;
    case 'relatorio':
      _gerarRelatorioAutomatico(regra);
      break;
  }

  _registrarLog(regra, valor, msg);
}

/* ── Alerta no feed de automação ────────────────────────── */
function _dispararAlerta(msg, nivel, regra) {
  const feed = document.getElementById('auto-feed');
  if (!feed) return;

  const cores = {
    info: { bg: 'var(--blue-dim)', bord: 'var(--blue)', icon: 'ℹ️' },
    warn: { bg: 'var(--acc-dim)',  bord: 'var(--acc)',  icon: '⚠️' },
    crit: { bg: 'var(--red-dim)',  bord: 'var(--red)',  icon: '🚨' },
    ok:   { bg: 'var(--grn-dim)', bord: 'var(--grn)',  icon: '✅' },
  };
  const c = cores[nivel] || cores.warn;
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const item = document.createElement('div');
  item.className = 'auto-feed-item';
  item.style.cssText = `
    background:${c.bg};border:1px solid ${c.bord};border-left:3px solid ${c.bord};
    border-radius:8px;padding:10px 12px;margin-bottom:6px;
    display:flex;align-items:flex-start;gap:10px;
    animation:fadeUp .3s ease;
  `;
  item.innerHTML = `
    <span style="font-size:16px;flex-shrink:0">${c.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--txt);line-height:1.4">${msg}</div>
      <div style="font-size:10px;color:var(--mut);margin-top:3px">${regra.nome} · ${hora}</div>
    </div>
  `;

  feed.insertBefore(item, feed.firstChild);

  // Limita a 50 itens no feed
  while (feed.children.length > 50) feed.removeChild(feed.lastChild);

  // Atualiza badge
  _atualizarBadgeAuto();
}

/* ── Push notification via SW ───────────────────────────── */
function _dispararPush(msg, nivel) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(sw => {
      sw.showNotification('DockCheck PRO — Automação', {
        body: msg,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'dockcheck-auto',
        vibrate: nivel === 'crit' ? [200, 100, 200] : [100],
      });
    });
  }
}

/* ── Gerar ocorrência automática ─────────────────────────── */
function _gerarOcorrencia(msg, regra) {
  if (typeof toast === 'function') toast('📋 Ocorrência gerada automaticamente: ' + msg);
  // Integra com o módulo de histórico se disponível
  if (typeof historico !== 'undefined' && Array.isArray(historico)) {
    historico.unshift({
      id: 'AUTO_' + Date.now(),
      tipo: 'OCORRENCIA_AUTO',
      msg,
      regra: regra.nome,
      timestamp: new Date().toISOString(),
      automatico: true,
    });
    if (typeof salvarHistorico === 'function') salvarHistorico();
  }
}

/* ── Relatório automático ───────────────────────────────── */
function _gerarRelatorioAutomatico(regra) {
  if (typeof gerarRelatorio === 'function') {
    gerarRelatorio('auto');
    if (typeof toast === 'function') toast('📊 Relatório automático gerado!');
  }
}

/* ════════════════════════════════════════════════════════════
   BADGE DE ALERTAS
════════════════════════════════════════════════════════════ */
let _badgeCount = 0;

function _atualizarBadgeAuto() {
  _badgeCount++;
  const badge = document.getElementById('auto-badge');
  if (badge) {
    badge.textContent = _badgeCount;
    badge.style.display = 'flex';
  }
  // Pulsa o botão da aba
  const btn = document.querySelector('[onclick*="automacao"]');
  if (btn) btn.style.animation = 'pulse-warn .5s ease';
}

function automacaoLerAlertas() {
  _badgeCount = 0;
  const badge = document.getElementById('auto-badge');
  if (badge) badge.style.display = 'none';
}

/* ════════════════════════════════════════════════════════════
   GERENCIAMENTO DE REGRAS
════════════════════════════════════════════════════════════ */

function automacaoGetRegras() {
  return _regras;
}

function automacaoSalvarRegra(regra) {
  if (!regra.id) regra.id = 'rule_' + Date.now();
  if (!regra.criadoEm) regra.criadoEm = new Date().toISOString();
  regra.ativo = regra.ativo !== false;

  const idx = _regras.findIndex(r => r.id === regra.id);
  if (idx >= 0) {
    _regras[idx] = regra;
  } else {
    _regras.push(regra);
  }
  _salvarRegras();
  if (typeof toast === 'function') toast('✅ Regra salva!');
  automacaoRenderRegras();
}

function automacaoRemoverRegra(id) {
  _regras = _regras.filter(r => r.id !== id);
  _salvarRegras();
  automacaoRenderRegras();
  if (typeof toast === 'function') toast('Regra removida.');
}

function automacaoToggleRegra(id) {
  const regra = _regras.find(r => r.id === id);
  if (regra) {
    regra.ativo = !regra.ativo;
    _salvarRegras();
    automacaoRenderRegras();
  }
}

/* ════════════════════════════════════════════════════════════
   PERSISTÊNCIA
════════════════════════════════════════════════════════════ */
function _salvarRegras() {
  try { localStorage.setItem(AUTO_STORE_KEY, JSON.stringify(_regras)); } catch {}
}

function _carregarRegras() {
  try {
    const raw = localStorage.getItem(AUTO_STORE_KEY);
    _regras = raw ? JSON.parse(raw) : _regrasPadraoUsuario();
  } catch {
    _regras = _regrasPadraoUsuario();
  }
}

function _regrasPadraoUsuario() {
  return [
    {
      id: 'user_atraso_40',
      nome: 'Atraso > 40 min',
      gatilho: 'doca_tempo_ativa',
      condicao: { operador: '>', valor: 40 },
      acao: 'alerta',
      params: { nivel: 'warn', msg: '⏱ Doca {doca} com {tempo} min — acima da média' },
      ativo: true,
      sistema: false,
    },
  ];
}

function _registrarLog(regra, valor, msg) {
  _autoLog.unshift({
    timestamp: new Date().toISOString(),
    regra: regra.nome,
    valor,
    msg,
    acao: regra.acao,
  });
  if (_autoLog.length > AUTO_MAX_LOG) _autoLog = _autoLog.slice(0, AUTO_MAX_LOG);
  try { localStorage.setItem(AUTO_LOG_KEY, JSON.stringify(_autoLog)); } catch {}
}

function _carregarLog() {
  try {
    const raw = localStorage.getItem(AUTO_LOG_KEY);
    _autoLog = raw ? JSON.parse(raw) : [];
  } catch { _autoLog = []; }
}

/* ════════════════════════════════════════════════════════════
   RENDER DA ABA AUTOMAÇÃO
════════════════════════════════════════════════════════════ */
function automacaoRender() {
  const tab = document.getElementById('tab-automacao');
  if (!tab) return;

  automacaoLerAlertas();

  tab.innerHTML = `
    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,var(--surf),rgba(245,158,11,.06));border:1px solid rgba(245,158,11,.2);border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:24px">⚡</span>
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;letter-spacing:2px;color:var(--txt)">ENGINE DE AUTOMAÇÃO</div>
            <div style="font-size:10px;color:var(--mut);letter-spacing:.5px">FASE 14 · ATIVO</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div style="background:var(--grn-dim);border:1px solid rgba(16,185,129,.3);border-radius:6px;padding:4px 10px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;color:var(--grn);letter-spacing:1px">
            ● MONITORANDO
          </div>
          <button class="btn btn-acc btn-sm" onclick="automacaoAbrirNovaRegra()">+ Nova Regra</button>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
      <div class="card" style="text-align:center;padding:12px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--acc)">${REGRAS_SISTEMA.length + _regras.filter(r=>r.ativo).length}</div>
        <div style="font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px">Regras Ativas</div>
      </div>
      <div class="card" style="text-align:center;padding:12px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--blue)">${_autoLog.length}</div>
        <div style="font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px">Execuções</div>
      </div>
      <div class="card" style="text-align:center;padding:12px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--grn)">${_autoLog.filter(l=>l.timestamp > new Date(Date.now()-86400000).toISOString()).length}</div>
        <div style="font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px">Hoje</div>
      </div>
    </div>

    <!-- FEED DE ALERTAS -->
    <div class="card" style="margin-bottom:12px">
      <div class="ctitle">🔔 Feed de Automação <span style="margin-left:auto;font-size:10px;color:var(--mut);font-weight:400">Atualiza a cada 30s</span></div>
      <div id="auto-feed" style="min-height:60px">
        <div style="text-align:center;color:var(--mut);font-size:12px;padding:20px">
          Nenhum alerta ainda — monitorando operação...
        </div>
      </div>
    </div>

    <!-- REGRAS DO SISTEMA -->
    <div class="card" style="margin-bottom:12px">
      <div class="ctitle">🔒 Regras do Sistema</div>
      ${REGRAS_SISTEMA.map(r => _htmlRegra(r, true)).join('')}
    </div>

    <!-- REGRAS DO USUÁRIO -->
    <div class="card" style="margin-bottom:12px">
      <div class="ctitle" style="display:flex;align-items:center">
        ⚙️ Minhas Regras
        <button class="btn btn-ghost btn-xs" style="margin-left:auto" onclick="automacaoAbrirNovaRegra()">+ Adicionar</button>
      </div>
      <div id="auto-regras-usuario">
        ${_regras.length ? _regras.map(r => _htmlRegra(r, false)).join('') : `
          <div style="text-align:center;color:var(--mut);font-size:12px;padding:20px">
            Nenhuma regra personalizada. Clique em "+ Adicionar" para criar.
          </div>
        `}
      </div>
    </div>

    <!-- MODAL NOVA REGRA -->
    <div id="auto-modal" style="display:none;position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.7);align-items:center;justify-content:center;padding:16px">
      <div style="background:var(--surf);border:1px solid var(--bord2);border-radius:16px;padding:20px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;letter-spacing:1px;margin-bottom:16px">⚡ Nova Regra de Automação</div>

        <div class="row"><div class="fg">
          <label>Nome da Regra</label>
          <input id="auto-nome" type="text" placeholder="Ex: Atraso crítico">
        </div></div>

        <div class="row">
          <div class="fg"><label>Gatilho</label>
            <select id="auto-gatilho">
              <option value="doca_tempo_ativa">Tempo de doca ativa (min)</option>
              <option value="fila_tamanho">Tamanho da fila (veículos)</option>
              <option value="docas_ativas">Docas ativas</option>
              <option value="historico_hoje">Conferências hoje</option>
            </select>
          </div>
          <div class="fg"><label>Condição</label>
            <select id="auto-operador">
              <option value=">">maior que</option>
              <option value=">=">maior ou igual</option>
              <option value="<">menor que</option>
              <option value="==">igual a</option>
            </select>
          </div>
          <div class="fg" style="max-width:80px"><label>Valor</label>
            <input id="auto-valor" type="number" value="30" min="0">
          </div>
        </div>

        <div class="row">
          <div class="fg"><label>Ação</label>
            <select id="auto-acao">
              <option value="alerta">Gerar alerta no feed</option>
              <option value="push_notification">Enviar notificação push</option>
              <option value="toast">Exibir toast</option>
              <option value="ocorrencia">Gerar ocorrência</option>
            </select>
          </div>
          <div class="fg"><label>Nível</label>
            <select id="auto-nivel">
              <option value="info">ℹ️ Info</option>
              <option value="warn">⚠️ Aviso</option>
              <option value="crit">🚨 Crítico</option>
            </select>
          </div>
        </div>

        <div class="row"><div class="fg">
          <label>Mensagem</label>
          <input id="auto-msg" type="text" placeholder="Use {doca}, {tempo}, {valor}">
        </div></div>

        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-acc btn-full" onclick="automacaoSalvarNovaRegra()">Salvar Regra</button>
          <button class="btn btn-ghost" onclick="automacaoFecharModal()">Cancelar</button>
        </div>
      </div>
    </div>

    <!-- LOG -->
    <div class="card">
      <div class="ctitle">📋 Log de Execuções <span style="margin-left:auto;font-size:10px;font-weight:400;color:var(--mut)">${_autoLog.length} registros</span></div>
      <div style="max-height:200px;overflow-y:auto">
        ${_autoLog.slice(0, 30).map(l => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bord);font-size:12px">
            <span style="color:var(--mut);white-space:nowrap;flex-shrink:0">${new Date(l.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
            <span style="color:var(--txt2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.msg}</span>
            <span style="background:var(--surf2);border:1px solid var(--bord);border-radius:4px;padding:1px 6px;font-size:10px;color:var(--mut);flex-shrink:0">${l.regra}</span>
          </div>
        `).join('') || '<div style="text-align:center;color:var(--mut);font-size:12px;padding:16px">Nenhuma execução registrada</div>'}
      </div>
    </div>
  `;
}

function _htmlRegra(regra, sistema) {
  const gatilhoLabel = {
    doca_tempo_ativa: 'Tempo doca ativa',
    fila_tamanho: 'Tamanho da fila',
    docas_ativas: 'Docas ativas',
    historico_hoje: 'Conferências hoje',
  };
  const acaoLabel = {
    alerta: '🔔 Alerta',
    push_notification: '📲 Push',
    toast: '💬 Toast',
    ocorrencia: '📋 Ocorrência',
  };

  return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bord)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--txt)">${regra.nome}</div>
        <div style="font-size:11px;color:var(--mut);margin-top:2px">
          Se <b style="color:var(--txt2)">${gatilhoLabel[regra.gatilho]||regra.gatilho}</b>
          ${regra.condicao.operador} ${regra.condicao.valor}
          → ${acaoLabel[regra.acao]||regra.acao}
        </div>
      </div>
      ${sistema ? `
        <span style="font-size:10px;color:var(--mut);background:var(--surf2);border:1px solid var(--bord);border-radius:4px;padding:2px 6px;flex-shrink:0">SISTEMA</span>
        <div style="width:8px;height:8px;border-radius:50%;background:var(--grn);flex-shrink:0"></div>
      ` : `
        <button class="btn btn-xs btn-ghost" onclick="automacaoToggleRegra('${regra.id}')" style="flex-shrink:0">
          ${regra.ativo ? '⏸' : '▶'}
        </button>
        <button class="btn btn-xs btn-ghost" onclick="automacaoRemoverRegra('${regra.id}')" style="flex-shrink:0;color:var(--red)">✕</button>
        <div style="width:8px;height:8px;border-radius:50%;background:${regra.ativo?'var(--grn)':'var(--mut)'};flex-shrink:0"></div>
      `}
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   MODAL NOVA REGRA
════════════════════════════════════════════════════════════ */
function automacaoAbrirNovaRegra() {
  const modal = document.getElementById('auto-modal');
  if (modal) modal.style.display = 'flex';
}

function automacaoFecharModal() {
  const modal = document.getElementById('auto-modal');
  if (modal) modal.style.display = 'none';
}

function automacaoSalvarNovaRegra() {
  const nome     = document.getElementById('auto-nome')?.value?.trim();
  const gatilho  = document.getElementById('auto-gatilho')?.value;
  const operador = document.getElementById('auto-operador')?.value;
  const valor    = parseInt(document.getElementById('auto-valor')?.value || '0');
  const acao     = document.getElementById('auto-acao')?.value;
  const nivel    = document.getElementById('auto-nivel')?.value;
  const msg      = document.getElementById('auto-msg')?.value?.trim();

  if (!nome) { if (typeof toast==='function') toast('Digite o nome da regra.'); return; }
  if (!msg)  { if (typeof toast==='function') toast('Digite a mensagem.'); return; }

  automacaoSalvarRegra({ nome, gatilho, condicao: { operador, valor }, acao, params: { nivel, msg } });
  automacaoFecharModal();
}

function automacaoRenderRegras() {
  const el = document.getElementById('auto-regras-usuario');
  if (!el) return;
  el.innerHTML = _regras.length
    ? _regras.map(r => _htmlRegra(r, false)).join('')
    : '<div style="text-align:center;color:var(--mut);font-size:12px;padding:20px">Nenhuma regra personalizada.</div>';
}

/* ── Expõe globalmente ───────────────────────────────────── */
window.automacaoInit          = automacaoInit;
window.automacaoRender        = automacaoRender;
window.automacaoRenderRegras  = automacaoRenderRegras;
window.automacaoAbrirNovaRegra = automacaoAbrirNovaRegra;
window.automacaoFecharModal   = automacaoFecharModal;
window.automacaoSalvarNovaRegra = automacaoSalvarNovaRegra;
window.automacaoToggleRegra   = automacaoToggleRegra;
window.automacaoRemoverRegra  = automacaoRemoverRegra;
window.automacaoLerAlertas    = automacaoLerAlertas;
