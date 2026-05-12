/**
 * dashboard.js — DockCheck v2
 * Central de monitoramento logístico em tempo real.
 * Lê o histórico do turno atual e renderiza indicadores operacionais.
 * Atualização automática a cada 30s quando a aba está ativa.
 * Depende de: storage.js, utils.js
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */

const DASH_LIMITE_ATRASO_MIN = 90;  // minutos para considerar doca atrasada
const DASH_REFRESH_MS        = 30000; // atualização automática a cada 30s

let _dashInterval = null;
let _dashAtivo    = false;

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Ativa o dashboard: inicia auto-refresh e renderiza.
 * Chamado quando o operador entra na aba.
 */
function dashboardAtivo() {
  _dashAtivo = true;
  renderDashboard();
  _dashInterval = setInterval(() => {
    if (_dashAtivo) renderDashboard();
  }, DASH_REFRESH_MS);
}

/**
 * Pausa o dashboard: para o auto-refresh.
 * Chamado quando o operador sai da aba.
 */
function dashboardInativo() {
  _dashAtivo = false;
  clearInterval(_dashInterval);
  _dashInterval = null;
}

/* ════════════════════════════════════════════════════════════
   DADOS DO TURNO ATUAL
════════════════════════════════════════════════════════════ */

/**
 * Detecta o turno atual baseado na hora do sistema.
 * @returns {{ inicio: Date, fim: Date, nome: string }}
 */
function _turnoAtual() {
  const now  = new Date();
  const h    = now.getHours();
  const hoje = new Date(now); hoje.setSeconds(0); hoje.setMilliseconds(0);

  let inicio, fim, nome;

  if (h >= 6 && h < 14) {
    nome   = 'Manhã';
    inicio = new Date(hoje); inicio.setHours(6, 0, 0, 0);
    fim    = new Date(hoje); fim.setHours(14, 0, 0, 0);
  } else if (h >= 14 && h < 22) {
    nome   = 'Tarde';
    inicio = new Date(hoje); inicio.setHours(14, 0, 0, 0);
    fim    = new Date(hoje); fim.setHours(22, 0, 0, 0);
  } else {
    nome = 'Noite';
    if (h >= 22) {
      inicio = new Date(hoje); inicio.setHours(22, 0, 0, 0);
      fim    = new Date(hoje); fim.setHours(22, 0, 0, 0);
      fim.setDate(fim.getDate() + 1);
    } else {
      // 00h–06h: turno iniciou ontem às 22h
      inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 1);
      inicio.setHours(22, 0, 0, 0);
      fim    = new Date(hoje); fim.setHours(6, 0, 0, 0);
    }
  }

  return { inicio, fim, nome };
}

/**
 * Filtra histórico do turno atual.
 * @returns {Object[]}
 */
function _histTurno() {
  const { inicio, fim } = _turnoAtual();
  return historico.filter(h => {
    if (h.tipo !== 'conferencia') return false;
    const d = new Date(h.data);
    return d >= inicio && d <= fim;
  });
}

/**
 * Retorna docas da tabela que ainda têm OCs pendentes no turno.
 * @param {Object[]} conf — conferências do turno
 * @returns {Set<string>}
 */
function _docasAtivas(conf) {
  const feitas = new Set(conf.map(h => h.oc?.trim()));
  const ativas = new Set();
  ocrRows.forEach(r => {
    if (!feitas.has(r.oc?.trim())) ativas.add(r.doca?.trim());
  });
  return ativas;
}

/**
 * Para uma doca ativa, retorna o tempo decorrido desde a última conferência.
 * Aproximação: usa o timestamp da última conf. registrada na doca.
 * @param {string} doca
 * @param {Object[]} conf
 * @returns {number} minutos desde última atividade
 */
function _minDesdeUltimaConf(doca, conf) {
  const docaConf = conf.filter(h => h.doca?.trim() === doca);
  if (!docaConf.length) return 0;
  const ultima = new Date(docaConf[0].data); // já ordenado desc
  return Math.floor((Date.now() - ultima.getTime()) / 60000);
}

/* ════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════════════════════ */

/**
 * Ponto de entrada — renderiza todo o dashboard.
 * Chamado automaticamente e ao entrar na aba.
 */
function renderDashboard() {
  const conf   = _histTurno();
  const turno  = _turnoAtual();
  const agora  = new Date();

  // ── System bar ──
  const sysTime = document.getElementById('dash-sys-time');
  if (sysTime) sysTime.textContent = agora.toLocaleTimeString('pt-BR');

  // ── Calcular métricas ──
  const docasComOC    = new Set(ocrRows.map(r => r.doca?.trim()).filter(Boolean));
  const feitas        = new Set(conf.map(h => h.oc?.trim()));
  const docasAtivas   = _docasAtivas(conf);
  const ocsFinalizadas = conf.length;
  const duracoes      = conf.map(h => _duracaoMin(h)).filter(v => v !== null);
  const tempoMed      = duracoes.length
    ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
    : null;

  // Docas em atraso: ativas há mais de DASH_LIMITE_ATRASO_MIN sem nova conf
  const docasAtraso = [];
  docasAtivas.forEach(doca => {
    const min = _minDesdeUltimaConf(doca, conf);
    if (min >= DASH_LIMITE_ATRASO_MIN) docasAtraso.push({ doca, min });
  });

  // ── Cards principais ──
  _setEl('dash-docas-ativas', docasAtivas.size);
  _setEl('dash-ocs-ok',       ocsFinalizadas);
  _setEl('dash-docas-atraso', docasAtraso.length);
  _setEl('dash-tempo-med',    tempoMed ? _fmtMin(tempoMed) : '—');

  // Barras de progresso dos cards
  const totalDocas = docasComOC.size || 1;
  _setBar('dash-bar-ativas',  (docasAtivas.size / totalDocas) * 100);
  _setBar('dash-bar-ok',      ocsFinalizadas > 0 ? Math.min((ocsFinalizadas / (ocrRows.length || 1)) * 100, 100) : 0);
  _setBar('dash-bar-atraso',  (docasAtraso.length / totalDocas) * 100);
  _setBar('dash-bar-tempo',   tempoMed ? Math.min((tempoMed / DASH_LIMITE_ATRASO_MIN) * 100, 100) : 0);

  // ── Painel operacional — docas ativas ──
  _renderDocasAtivas(docasAtivas, conf);

  // ── Alertas ──
  _renderAlertas(docasAtraso);

  // ── Rankings ──
  _renderRankingEquipes(conf);
  _renderRankingDocas(conf);

  // ── Resumo do turno ──
  const totalPed   = conf.reduce((s, h) => s + (parseInt(h.pedidos) || 0), 0);
  const totalCli   = conf.reduce((s, h) => s + (parseInt(h.clientes) || 0), 0);
  const transpSet  = new Set(conf.map(h => h.transportadora?.trim()).filter(Boolean));
  const confSet    = new Set(conf.map(h => h.conf?.trim()).filter(Boolean));

  _setEl('dash-total-ped',    totalPed || '—');
  _setEl('dash-total-cli',    totalCli || '—');
  _setEl('dash-total-transp', transpSet.size || '—');
  _setEl('dash-total-conf',   confSet.size   || '—');
}

/* ════════════════════════════════════════════════════════════
   RENDER — PAINEL DE DOCAS ATIVAS
════════════════════════════════════════════════════════════ */

function _renderDocasAtivas(docasAtivas, conf) {
  const el = document.getElementById('dash-docas-painel');
  if (!el) return;

  if (!docasAtivas.size) {
    el.innerHTML = '<div class="dash-empty">Nenhuma doca em operação no momento.</div>';
    return;
  }

  const alvoMin = storage.get(K_ALVO, 45) || 45;

  const cards = [];
  [...docasAtivas].sort((a, b) => Number(a) - Number(b)).forEach(doca => {
    // OCs pendentes desta doca
    const feitas     = new Set(conf.filter(h => h.doca?.trim() === doca).map(h => h.oc?.trim()));
    const ocsPend    = ocrRows.filter(r => r.doca?.trim() === doca && !feitas.has(r.oc?.trim()));
    const ocsTotal   = ocrRows.filter(r => r.doca?.trim() === doca);
    const proxOC     = ocsPend[0];

    // Tempo desde última atividade
    const minDesde   = _minDesdeUltimaConf(doca, conf);
    const pct        = Math.min((minDesde / alvoMin) * 100, 100);
    const timerCls   = pct >= 100 ? 'crit' : pct >= 75 ? 'warn' : 'ok';
    const cardCls    = pct >= 100 ? 'atrasada' : pct >= 75 ? 'atencao' : 'operando';
    const progColor  = pct >= 100 ? 'var(--red)' : pct >= 75 ? 'var(--acc)' : 'var(--grn)';

    const statusLabel = pct >= 100 ? 'ATRASADA' : pct >= 75 ? 'ATENÇÃO' : 'OPERANDO';
    const statusCls   = pct >= 100 ? 'at' : pct >= 75 ? 'av' : 'op';

    const rota        = proxOC?.rota || ocsTotal[0]?.rota || '—';
    const transp      = proxOC?.transportadora || ocsTotal[0]?.transportadora || '—';
    const placa       = proxOC?.placa || ocsTotal[0]?.placa || '—';
    const ocLabel     = proxOC ? `OC ${proxOC.oc}` : `${feitas.size}/${ocsTotal.length} concluídas`;

    cards.push(`
      <div class="dash-doca-card ${cardCls}">
        <div class="dash-doca-num">
          ${doca}
          <small>DOCA</small>
        </div>
        <div class="dash-doca-info">
          <div class="dash-doca-rota">${rota}</div>
          <div class="dash-doca-meta">${transp} · ${placa} · ${ocLabel}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span class="dash-status ${statusCls}">${statusLabel}</span>
            <span style="font-size:10px;color:var(--mut)">${ocsTotal.length - feitas.size} OC${ocsTotal.length - feitas.size !== 1 ? 's' : ''} pendente${ocsTotal.length - feitas.size !== 1 ? 's' : ''}</span>
          </div>
          <div class="dash-prog-wrap" style="margin-top:8px">
            <div class="dash-prog" style="width:${pct}%;background:${progColor}"></div>
          </div>
        </div>
        <div class="dash-doca-timer ${timerCls}">
          ${minDesde > 0 ? minDesde + '<br><small>min</small>' : '<small>agora</small>'}
        </div>
      </div>
    `);
  });

  el.innerHTML = cards.join('');
}

/* ════════════════════════════════════════════════════════════
   RENDER — ALERTAS
════════════════════════════════════════════════════════════ */

function _renderAlertas(docasAtraso) {
  const wrap = document.getElementById('dash-alertas-wrap');
  const el   = document.getElementById('dash-alertas');
  if (!wrap || !el) return;

  if (!docasAtraso.length) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  el.innerHTML = docasAtraso.map(({ doca, min }) => `
    <div class="dash-alerta">
      <div class="dash-alerta-icon">🚨</div>
      <div>
        <b>Doca ${doca}</b> — ${min} minutos sem nova conferência
        <div style="font-size:11px;color:var(--mut);margin-top:2px">Limite: ${DASH_LIMITE_ATRASO_MIN}min · Excedido em ${min - DASH_LIMITE_ATRASO_MIN}min</div>
      </div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   RENDER — RANKING EQUIPES
════════════════════════════════════════════════════════════ */

function _renderRankingEquipes(conf) {
  const el = document.getElementById('dash-ranking-eq');
  if (!el) return;

  if (!conf.length) {
    el.innerHTML = '<div class="dash-empty">Nenhuma operação registrada ainda.</div>';
    return;
  }

  // Agrupa por conferente
  const byConf = {};
  conf.forEach(h => {
    const c = h.conf?.trim() || '(sem nome)';
    if (!byConf[c]) byConf[c] = { count: 0, durs: [], aux1: h.aux1 || '', aux2: h.aux2 || '' };
    byConf[c].count++;
    const d = _duracaoMin(h); if (d) byConf[c].durs.push(d);
    if (h.aux1) byConf[c].aux1 = h.aux1;
    if (h.aux2) byConf[c].aux2 = h.aux2;
  });

  const rank = Object.entries(byConf)
    .map(([nome, v]) => ({
      nome,
      count: v.count,
      med: v.durs.length ? Math.round(v.durs.reduce((a, b) => a + b, 0) / v.durs.length) : null,
      aux: [v.aux1, v.aux2].filter(Boolean).join(', ')
    }))
    .sort((a, b) => {
      // Ordena: mais conferências primeiro; em empate, menor tempo médio vence
      if (b.count !== a.count) return b.count - a.count;
      return (a.med || 999) - (b.med || 999);
    });

  const medals = ['🥇','🥈','🥉'];
  const cores  = ['var(--acc)','#94a3b8','#cd7f32'];

  el.innerHTML = rank.map((r, i) => `
    <div class="dash-rank-item">
      <div class="dash-rank-pos" style="color:${cores[i] || 'var(--mut)'}">${medals[i] || (i + 1)}</div>
      <div class="dash-rank-info">
        <div class="dash-rank-name">${r.nome}</div>
        <div class="dash-rank-sub">${r.aux || 'Sem auxiliares'} · T.médio: ${r.med ? _fmtMin(r.med) : '—'}</div>
      </div>
      <div class="dash-rank-val">${r.count}<span style="font-size:12px;color:var(--mut);font-weight:400"> conf.</span></div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   RENDER — RANKING DOCAS
════════════════════════════════════════════════════════════ */

function _renderRankingDocas(conf) {
  const el = document.getElementById('dash-ranking-docas');
  if (!el) return;

  if (!conf.length) {
    el.innerHTML = '<div class="dash-empty">Nenhuma operação registrada ainda.</div>';
    return;
  }

  const byDoca = {};
  conf.forEach(h => {
    const d = h.doca?.trim() || '?';
    if (!byDoca[d]) byDoca[d] = { count: 0, durs: [] };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);
  });

  const rank = Object.entries(byDoca)
    .map(([doca, v]) => ({
      doca,
      count: v.count,
      med: v.durs.length ? Math.round(v.durs.reduce((a, b) => a + b, 0) / v.durs.length) : null
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = rank[0]?.count || 1;

  el.innerHTML = rank.map((r, i) => {
    const pct   = (r.count / maxCount) * 100;
    const cor   = i === 0 ? 'var(--grn)' : i === rank.length - 1 ? 'var(--red)' : 'var(--acc)';
    const label = i === 0 ? '⚡ Melhor' : i === rank.length - 1 && rank.length > 1 ? '🐢 Mais lenta' : '';
    return `
      <div class="dash-rank-item">
        <div class="dash-rank-pos" style="color:var(--mut);font-size:16px">${i + 1}</div>
        <div class="dash-rank-info">
          <div class="dash-rank-name" style="color:${cor}">Doca ${r.doca} ${label}</div>
          <div class="dash-prog-wrap" style="margin-top:6px">
            <div class="dash-prog" style="width:${pct}%;background:${cor}"></div>
          </div>
          <div class="dash-rank-sub" style="margin-top:4px">T.médio: ${r.med ? _fmtMin(r.med) : '—'}</div>
        </div>
        <div class="dash-rank-val" style="color:${cor}">${r.count}<span style="font-size:12px;color:var(--mut);font-weight:400"> OCs</span></div>
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

function _setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(Math.max(pct, 0), 100) + '%';
}
