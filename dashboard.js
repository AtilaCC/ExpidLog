/**
 * dashboard.js — DockCheck v2 · v3 Densidade Máxima
 * Central de monitoramento logístico premium.
 * Micro métricas, fila visual de OCs, equipe por doca, tempo médio corrigido.
 */

'use strict';

const DASH_LIMITE_ATRASO_MIN = 90;
const DASH_REFRESH_MS        = 30000;

let _dashInterval = null;
let _dashAtivo    = false;

/* ════════════════════════════════════════════════════════════
   LIFECYCLE
════════════════════════════════════════════════════════════ */

function dashboardAtivo() {
  _dashAtivo = true;
  renderDashboard();
  _dashInterval = setInterval(() => { if (_dashAtivo) renderDashboard(); }, DASH_REFRESH_MS);
}

function dashboardInativo() {
  _dashAtivo = false;
  clearInterval(_dashInterval);
  _dashInterval = null;
}

/* ════════════════════════════════════════════════════════════
   TURNO
════════════════════════════════════════════════════════════ */

function _turnoAtual() {
  const now  = new Date();
  const h    = now.getHours();
  const hoje = new Date(now);
  let inicio, fim, nome;

  if (h >= 6 && h < 14) {
    nome = 'MANHÃ';
    inicio = new Date(hoje); inicio.setHours(6,0,0,0);
    fim    = new Date(hoje); fim.setHours(14,0,0,0);
  } else if (h >= 14 && h < 22) {
    nome = 'TARDE';
    inicio = new Date(hoje); inicio.setHours(14,0,0,0);
    fim    = new Date(hoje); fim.setHours(22,0,0,0);
  } else {
    nome = 'NOITE';
    if (h >= 22) {
      inicio = new Date(hoje); inicio.setHours(22,0,0,0);
      fim    = new Date(hoje); fim.setDate(fim.getDate()+1); fim.setHours(6,0,0,0);
    } else {
      inicio = new Date(hoje); inicio.setDate(inicio.getDate()-1); inicio.setHours(22,0,0,0);
      fim    = new Date(hoje); fim.setHours(6,0,0,0);
    }
  }
  return { inicio, fim, nome };
}

function _histTurno() {
  const { inicio, fim } = _turnoAtual();
  return historico.filter(h => {
    if (h.tipo !== 'conferencia') return false;
    const d = new Date(h.data);
    return d >= inicio && d <= fim;
  });
}

function _docasAtivas(conf) {
  const feitas = new Set(conf.map(h => h.oc?.trim()));
  const ativas = new Set();
  ocrRows.forEach(r => { if (!feitas.has(r.oc?.trim())) ativas.add(r.doca?.trim()); });
  return ativas;
}

function _minDesdeUltimaConf(doca, conf) {
  const docaConf = conf.filter(h => h.doca?.trim() === doca);
  if (!docaConf.length) return 0;
  return Math.floor((Date.now() - new Date(docaConf[0].data).getTime()) / 60000);
}

/* ════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════════════════════ */

function renderDashboard() {
  const conf  = _histTurno();
  const turno = _turnoAtual();
  const agora = new Date();

  // Clock
  const cl = document.getElementById('dash-sys-time');
  if (cl) cl.textContent = agora.toLocaleTimeString('pt-BR');

  // Turno label
  const tl = document.getElementById('dash-turno-label');
  if (tl) {
    const fmt = d => d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    tl.textContent = `Turno ${turno.nome} · ${fmt(turno.inicio)} – ${fmt(turno.fim)}`;
  }

  // Métricas base
  const feitas      = new Set(conf.map(h => h.oc?.trim()));
  const docasAtivas = _docasAtivas(conf);
  const totalOCR    = ocrRows.length || 1;
  const totalDocas  = new Set(ocrRows.map(r => r.doca?.trim()).filter(Boolean)).size || 1;

  // ── TEMPO MÉDIO — cálculo direto e robusto ──
  // Usa duracaoSeg (cronômetro real) se disponível, senão calcula por horário
  const duracoes = conf
    .map(h => {
      if (h.duracaoSeg && h.duracaoSeg > 60) return Math.round(h.duracaoSeg / 60);
      return _duracaoMin(h);
    })
    .filter(v => v !== null && v > 0 && v < 480); // sanidade: entre 1min e 8h

  const tempoMed = duracoes.length
    ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
    : null;

  // Docas com atraso
  const docasAtraso = [];
  docasAtivas.forEach(doca => {
    const min = _minDesdeUltimaConf(doca, conf);
    if (min >= DASH_LIMITE_ATRASO_MIN) docasAtraso.push({ doca, min });
  });

  // OCs pendentes totais
  const totalPendentes = ocrRows.filter(r => !feitas.has(r.oc?.trim())).length;
  const eficiencia     = ocrRows.length > 0
    ? Math.round((feitas.size / ocrRows.length) * 100)
    : 0;

  // ── KPI principais ──
  _setEl('dash-docas-ativas', docasAtivas.size);
  _setEl('dash-ocs-ok',       conf.length);
  _setEl('dash-docas-atraso', docasAtraso.length);
  _setEl('dash-tempo-med',    tempoMed !== null ? _fmtMin(tempoMed) : '—');

  // ── Micro métricas ──
  _setEl('kpi-micro-pendentes', totalPendentes > 0 ? totalPendentes : '0');
  _setEl('kpi-micro-efic',      eficiencia + '%');
  _setEl('kpi-micro-meta',      `meta ${DASH_LIMITE_ATRASO_MIN}min`);

  // Micro de tempo: compara com meta
  const microTempoEl = document.getElementById('kpi-micro-meta');
  if (microTempoEl && tempoMed !== null) {
    const diff = tempoMed - DASH_LIMITE_ATRASO_MIN;
    if (diff > 0) {
      microTempoEl.innerHTML = `<span style="color:var(--red)">+${diff}min acima</span>`;
    } else if (diff < 0) {
      microTempoEl.innerHTML = `<span style="color:var(--grn)">${Math.abs(diff)}min abaixo</span>`;
    } else {
      microTempoEl.textContent = 'no limite';
    }
  }

  // ── Barras KPI ──
  _setBar('dash-bar-ativas', (docasAtivas.size / totalDocas) * 100);
  _setBar('dash-bar-ok',     (conf.length / totalOCR) * 100);
  _setBar('dash-bar-atraso', (docasAtraso.length / totalDocas) * 100);
  _setBar('dash-bar-tempo',  tempoMed ? Math.min((tempoMed / DASH_LIMITE_ATRASO_MIN) * 100, 100) : 0);

  // KPI atraso visual
  const kpiAtraso = document.getElementById('kpi-atraso');
  if (kpiAtraso) kpiAtraso.classList.toggle('sem-atraso', docasAtraso.length === 0);

  // ── Mini KPI strip ──
  const totalPed  = conf.reduce((s,h) => s+(parseInt(h.pedidos)||0), 0);
  const totalCli  = conf.reduce((s,h) => s+(parseInt(h.clientes)||0), 0);
  const transpSet = new Set(conf.map(h=>h.transportadora?.trim()).filter(Boolean));
  const confSet   = new Set(conf.map(h=>h.conf?.trim()).filter(Boolean));
  _setEl('dash-total-ped',    totalPed   || '—');
  _setEl('dash-total-cli',    totalCli   || '—');
  _setEl('dash-total-transp', transpSet.size || '—');
  _setEl('dash-total-conf',   confSet.size   || '—');

  // ── Count label ──
  const countLbl = document.getElementById('dash-docas-count-label');
  if (countLbl) countLbl.textContent = docasAtivas.size > 0 ? `${docasAtivas.size} ativas` : '';

  // ── Renders ──
  _renderAlertas(docasAtraso);
  _renderMapaDocas(docasAtivas, docasAtraso, conf);
  _renderIndicadores(conf, docasAtivas, docasAtraso, tempoMed);
  _renderFeed(conf, docasAtraso);
  _renderDocasAtivas(docasAtivas, conf);
  _renderRankingEquipes(conf);
  _renderRankingDocas(conf);
}

/* ════════════════════════════════════════════════════════════
   ALERTAS
════════════════════════════════════════════════════════════ */

function _renderAlertas(docasAtraso) {
  const wrap = document.getElementById('dash-alertas-wrap');
  const el   = document.getElementById('dash-alertas');
  if (!wrap || !el) return;

  if (!docasAtraso.length) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'block';
  el.innerHTML = docasAtraso
    .sort((a,b) => b.min - a.min) // mais crítica primeiro
    .map(({ doca, min }) => `
      <div class="dh-alerta">
        <div class="dh-alerta-icon">🚨</div>
        <div class="dh-alerta-body">
          <b>DOCA ${doca} — SEM ATIVIDADE</b>
          <small>Limite: ${DASH_LIMITE_ATRASO_MIN}min · Excedido em ${min - DASH_LIMITE_ATRASO_MIN}min</small>
        </div>
        <div class="dh-alerta-time">${min}min</div>
      </div>
    `).join('');
}

/* ════════════════════════════════════════════════════════════
   DOCAS ATIVAS — CARD DENSO v3
════════════════════════════════════════════════════════════ */

function _renderDocasAtivas(docasAtivas, conf) {
  const el = document.getElementById('dash-docas-painel');
  if (!el) return;

  if (!docasAtivas.size) {
    el.innerHTML = `<div class="dh-empty"><div class="dh-empty-icon">🏭</div><div>Nenhuma doca em operação no momento</div></div>`;
    return;
  }

  const alvoMin = storage.get(K_ALVO, 45) || 45;

  const cards = [...docasAtivas]
    .sort((a,b) => Number(a)-Number(b))
    .map(doca => {
      const docaConf  = conf.filter(h => h.doca?.trim() === doca);
      const feitas    = new Set(docaConf.map(h => h.oc?.trim()));
      const ocsPend   = ocrRows.filter(r => r.doca?.trim() === doca && !feitas.has(r.oc?.trim()));
      const ocsTotal  = ocrRows.filter(r => r.doca?.trim() === doca);
      const proxOC    = ocsPend[0];

      // Timer
      const minDesde  = _minDesdeUltimaConf(doca, conf);
      const pct       = Math.min((minDesde / alvoMin) * 100, 100);
      const timerCls  = pct >= 100 ? 'crit' : pct >= 75 ? 'warn' : 'ok';
      const cardCls   = pct >= 100 ? 'at' : pct >= 75 ? 'av' : 'op';
      const progClr   = pct >= 100 ? 'var(--red)' : pct >= 75 ? 'var(--acc)' : 'var(--grn)';
      const statusLbl = pct >= 100 ? 'ATRASADA' : pct >= 75 ? 'ATENÇÃO' : 'OPERANDO';

      // Dados da carga
      const rota   = proxOC?.rota    || ocsTotal[0]?.rota    || '—';
      const transp = proxOC?.transportadora || ocsTotal[0]?.transportadora || '—';
      const placa  = proxOC?.placa   || ocsTotal[0]?.placa   || '—';
      const ocLbl  = proxOC ? `OC ${proxOC.oc}` : 'Concluída';

      // Equipe da última conferência nesta doca
      const ultConf  = docaConf[0];
      const confNome = ultConf?.conf || null;
      const aux1     = ultConf?.aux1 || null;
      const equipeStr = confNome
        ? [confNome, aux1].filter(Boolean).join(' · ')
        : null;

      // Fila visual de OCs (máx 8 pontinhos)
      const maxPips  = Math.min(ocsTotal.length, 8);
      const feitasN  = feitas.size;
      const pipsHTML = Array.from({ length: maxPips }, (_, i) =>
        `<div class="dh-fila-pip ${i < feitasN ? 'done' : 'pend'}"></div>`
      ).join('');
      const filaLabel = `${feitasN}/${ocsTotal.length}`;

      return `
        <div class="dh-doca-card ${cardCls}">
          <div class="dh-doca-num-wrap">
            <div class="dh-doca-num">${doca}</div>
            <div class="dh-doca-num-lbl">DOCA</div>
          </div>
          <div class="dh-doca-body">
            <div class="dh-doca-rota">${rota}</div>
            ${equipeStr ? `<div class="dh-doca-equipe"><div class="dh-doca-equipe-dot"></div>${equipeStr}</div>` : ''}
            <div class="dh-doca-tags">
              <span class="dh-doca-tag">${transp}</span>
              <span class="dh-doca-tag">${placa}</span>
              <span class="dh-doca-tag">${ocLbl}</span>
            </div>
            <div class="dh-doca-fila">
              ${pipsHTML}
              <span class="dh-fila-label">${filaLabel} OC${ocsTotal.length > 1 ? 's' : ''}</span>
            </div>
            <div class="dh-doca-prog-wrap">
              <div class="dh-doca-prog" style="width:${pct}%;background:${progClr}"></div>
            </div>
          </div>
          <div class="dh-doca-right">
            <div class="dh-doca-timer ${timerCls}">${minDesde > 0 ? minDesde : '0'}</div>
            <div class="dh-doca-timer-lbl">MIN</div>
            <div class="dh-status-pill ${cardCls}">${statusLbl}</div>
          </div>
        </div>
      `;
    });

  el.innerHTML = cards.join('');
}

/* ════════════════════════════════════════════════════════════
   RANKING EQUIPES
════════════════════════════════════════════════════════════ */

function _renderRankingEquipes(conf) {
  const el = document.getElementById('dash-ranking-eq');
  if (!el) return;

  if (!conf.length) {
    el.innerHTML = `<div class="dh-empty"><div class="dh-empty-icon">👥</div><div>Nenhuma operação registrada ainda</div></div>`;
    return;
  }

  const byConf = {};
  conf.forEach(h => {
    const c = h.conf?.trim() || '(sem nome)';
    if (!byConf[c]) byConf[c] = { count:0, durs:[], aux1:'', aux2:'' };
    byConf[c].count++;
    const d = _duracaoMin(h); if (d) byConf[c].durs.push(d);
    if (h.aux1) byConf[c].aux1 = h.aux1;
    if (h.aux2) byConf[c].aux2 = h.aux2;
  });

  const rank = Object.entries(byConf)
    .map(([nome,v]) => ({
      nome, count:v.count,
      med: v.durs.length ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length) : null,
      aux: [v.aux1,v.aux2].filter(Boolean).join(' · ')
    }))
    .sort((a,b) => b.count - a.count || (a.med||999)-(b.med||999));

  const medals = ['🥇','🥈','🥉'];
  const maxCount = rank[0]?.count || 1;

  el.innerHTML = rank.map((r,i) => `
    <div class="dh-rank-card">
      <div class="dh-rank-pos">${medals[i] || (i+1)}</div>
      <div>
        <div class="dh-rank-name">${r.nome}</div>
        <div class="dh-rank-sub">${r.aux || 'Sem auxiliares'} · ${r.med ? _fmtMin(r.med) : '—'}/OC</div>
        <div class="dh-rank-prog-wrap">
          <div class="dh-rank-prog" style="width:${(r.count/maxCount)*100}%;background:${i===0?'var(--acc)':i===1?'#94a3b8':'#cd7f32'}"></div>
        </div>
      </div>
      <div class="dh-rank-val">${r.count}<small> conf.</small></div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   RANKING DOCAS
════════════════════════════════════════════════════════════ */

function _renderRankingDocas(conf) {
  const el = document.getElementById('dash-ranking-docas');
  if (!el) return;

  if (!conf.length) {
    el.innerHTML = `<div class="dh-empty"><div class="dh-empty-icon">📊</div><div>Nenhuma operação registrada ainda</div></div>`;
    return;
  }

  const byDoca = {};
  conf.forEach(h => {
    const d = h.doca?.trim() || '?';
    if (!byDoca[d]) byDoca[d] = { count:0, durs:[] };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);
  });

  const rank = Object.entries(byDoca)
    .map(([doca,v]) => ({
      doca, count:v.count,
      med: v.durs.length ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length) : null
    }))
    .sort((a,b) => b.count - a.count);

  const maxCount = rank[0]?.count || 1;

  el.innerHTML = rank.map((r,i) => {
    const isFirst = i===0;
    const isLast  = i===rank.length-1 && rank.length>1;
    const cor     = isFirst ? 'var(--grn)' : isLast ? 'var(--red)' : 'var(--acc)';
    const badge   = isFirst ? ' ⚡' : isLast ? ' 🐢' : '';
    return `
      <div class="dh-rank-card">
        <div class="dh-rank-pos" style="color:${cor};font-size:${i<3?'22':'15'}px">${i+1}º</div>
        <div>
          <div class="dh-rank-name" style="color:${cor}">DOCA ${r.doca}${badge}</div>
          <div class="dh-rank-sub">T.médio: ${r.med ? _fmtMin(r.med) : '—'}</div>
          <div class="dh-rank-prog-wrap">
            <div class="dh-rank-prog" style="width:${(r.count/maxCount)*100}%;background:${cor}"></div>
          </div>
        </div>
        <div class="dh-rank-val" style="color:${cor}">${r.count}<small> OCs</small></div>
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
  if (el) el.style.width = Math.min(Math.max(pct||0,0),100) + '%';
}

/* ════════════════════════════════════════════════════════════
   v4 — MAPA DE DOCAS
════════════════════════════════════════════════════════════ */

function _renderMapaDocas(docasAtivas, docasAtraso, conf) {
  const el = document.getElementById('dash-mapa-docas');
  if (!el) return;

  // Todas as docas da tabela + históricas
  const todasDocas = new Set([
    ...ocrRows.map(r => r.doca?.trim()),
    ...conf.map(h => h.doca?.trim())
  ].filter(Boolean));

  if (!todasDocas.size) {
    el.innerHTML = '<div class="dh-empty"><div class="dh-empty-icon">🗺</div><div>Sem docas na tabela</div></div>';
    return;
  }

  const feitas       = new Set(conf.map(h => h.oc?.trim()));
  const docasAtrasSet = new Set(docasAtraso.map(d => d.doca));
  const alvoMin      = storage.get(K_ALVO, 45) || 45;

  const chips = [...todasDocas].sort((a,b) => Number(a)-Number(b)).map(doca => {
    const min      = _minDesdeUltimaConf(doca, conf);
    const pct      = alvoMin > 0 ? (min / alvoMin) * 100 : 0;
    const ocsTotal = ocrRows.filter(r => r.doca?.trim() === doca);
    const pendentes = ocsTotal.filter(r => !feitas.has(r.oc?.trim())).length;
    const ativa    = docasAtivas.has(doca);

    let cls, statusLbl;
    if (docasAtrasSet.has(doca))    { cls = 'at'; statusLbl = 'ATRASADA'; }
    else if (ativa && pct >= 75)    { cls = 'av'; statusLbl = 'ATENÇÃO'; }
    else if (ativa)                 { cls = 'op'; statusLbl = 'OP'; }
    else if (pendentes === 0 && ocsTotal.length > 0) { cls = 'ok'; statusLbl = 'CONCLUÍDA'; }
    else                            { cls = 'idle'; statusLbl = '—'; }

    return `
      <div class="dh-mapa-doca ${cls}" onclick="dashMapaClick('${doca}')" title="Doca ${doca} — ${statusLbl}">
        <div class="dh-mapa-dot"></div>
        <div class="dh-mapa-num">${doca}</div>
        <div class="dh-mapa-status">${statusLbl}</div>
      </div>
    `;
  });

  el.innerHTML = chips.join('');
}

/**
 * Clique no mapa: rola até o card da doca no painel ou navega para conferência.
 */
function dashMapaClick(doca) {
  // Tenta rolar até o card da doca no painel de docas ativas
  const cards = document.querySelectorAll('#dash-docas-painel .dh-doca-card');
  let found = false;
  cards.forEach(card => {
    if (card.querySelector('.dh-doca-num')?.textContent?.trim() === doca) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.outline = '2px solid var(--acc)';
      setTimeout(() => card.style.outline = '', 1500);
      found = true;
    }
  });
  // Se não achou card ativo, vai para conferência com doca selecionada
  if (!found) {
    goTab('conferencia', document.querySelector('.ntab'));
    setTimeout(() => {
      document.getElementById('f-doca').value = doca;
      onDocaInput(doca);
    }, 100);
  }
}

/* ════════════════════════════════════════════════════════════
   v4 — INDICADORES AVANÇADOS
════════════════════════════════════════════════════════════ */

function _renderIndicadores(conf, docasAtivas, docasAtraso, tempoMed) {
  const totalOCR   = ocrRows.length || 1;
  const feitas     = new Set(conf.map(h => h.oc?.trim()));
  const totalDocas = new Set(ocrRows.map(r => r.doca?.trim()).filter(Boolean)).size || 1;

  // Taxa de conclusão
  const taxaConclusao = Math.round((feitas.size / totalOCR) * 100);
  const el1 = document.getElementById('ind-taxa-conclusao');
  if (el1) el1.textContent = taxaConclusao + '%';
  _setBarEl('ind-bar-conclusao', taxaConclusao);

  // Produtividade por hora
  // Calcula há quantas horas o turno começou
  const { inicio } = _turnoAtual();
  const horasDecorridas = Math.max((Date.now() - inicio.getTime()) / 3600000, 0.1);
  const prodHora = (conf.length / horasDecorridas).toFixed(1);
  const el2 = document.getElementById('ind-prod-hora');
  if (el2) el2.textContent = prodHora + '/h';
  _setBarEl('ind-bar-prod', Math.min((parseFloat(prodHora) / 5) * 100, 100)); // referência: 5 OC/h

  // % Docas em atraso
  const pctAtraso = totalDocas > 0 ? Math.round((docasAtraso.length / totalDocas) * 100) : 0;
  const el3 = document.getElementById('ind-pct-atraso');
  if (el3) {
    el3.textContent = pctAtraso + '%';
    el3.style.color = pctAtraso >= 30 ? 'var(--red)' : pctAtraso >= 15 ? 'var(--acc)' : 'var(--grn)';
  }
  _setBarEl('ind-bar-atraso', pctAtraso);

  // Eficiência do turno (inverso de atraso + taxa conclusão)
  const eficiencia = Math.round(((taxaConclusao + (100 - pctAtraso)) / 2));
  const el4 = document.getElementById('ind-efic-turno');
  if (el4) {
    el4.textContent = eficiencia + '%';
    el4.style.color = eficiencia >= 70 ? 'var(--grn)' : eficiencia >= 40 ? 'var(--acc)' : 'var(--red)';
  }
  _setBarEl('ind-bar-efic', eficiencia);
}

function _setBarEl(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(Math.max(pct||0,0),100) + '%';
}

/* ════════════════════════════════════════════════════════════
   v4 — FEED OPERACIONAL AO VIVO
════════════════════════════════════════════════════════════ */

// Cache do feed — mantém histórico de eventos
let _feedEventos = [];
let _feedUltimoHistLen = 0;

function _renderFeed(conf, docasAtraso) {
  const el = document.getElementById('dash-feed');
  if (!el) return;

  // Detecta novos eventos comparando com estado anterior
  if (conf.length > _feedUltimoHistLen) {
    const novos = conf.slice(0, conf.length - _feedUltimoHistLen);
    novos.forEach(h => {
      _feedEventos.unshift({
        icon: '✅',
        txt: `OC ${h.oc || '?'} finalizada — Doca ${h.doca || '?'}${h.conf ? ` · ${h.conf}` : ''}`,
        badge: 'ok',
        badgeLbl: 'FINALIZADO',
        time: new Date(h.data)
      });
    });
    _feedUltimoHistLen = conf.length;
  }

  // Eventos de atraso
  docasAtraso.forEach(({ doca, min }) => {
    const jaExiste = _feedEventos.some(e =>
      e.txt.includes(`Doca ${doca}`) && e.badge === 'crit' && (Date.now() - e.time) < 120000
    );
    if (!jaExiste) {
      _feedEventos.unshift({
        icon: '🚨',
        txt: `Doca ${doca} entrou em atraso — ${min}min sem atividade`,
        badge: 'crit',
        badgeLbl: 'ALERTA',
        time: new Date()
      });
    }
  });

  // Limita feed a 20 eventos
  _feedEventos = _feedEventos.slice(0, 20);

  if (!_feedEventos.length) {
    el.innerHTML = '<div class="dh-empty"><div class="dh-empty-icon">📡</div><div>Aguardando eventos operacionais...</div></div>';
    return;
  }

  el.innerHTML = _feedEventos.map(ev => `
    <div class="dh-feed-item">
      <div class="dh-feed-icon">${ev.icon}</div>
      <div class="dh-feed-body">
        <div class="dh-feed-txt">${ev.txt}</div>
        <div class="dh-feed-time">${_fmtHora(ev.time)}</div>
      </div>
      <div class="dh-feed-badge ${ev.badge}">${ev.badgeLbl}</div>
    </div>
  `).join('');
}

function _fmtHora(date) {
  if (!date) return '—';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ════════════════════════════════════════════════════════════
   v4 — MODO TV / FULLSCREEN
════════════════════════════════════════════════════════════ */

let _tvMode = false;

function dashboardFullscreen() {
  const tab = document.getElementById('tab-dashboard');
  if (!tab) return;

  if (!_tvMode) {
    _tvMode = true;
    tab.classList.add('dh-tv-mode');

    // Botão sair
    const btn = document.createElement('button');
    btn.className = 'dh-tv-exit';
    btn.textContent = '✕ Sair do modo TV';
    btn.onclick = dashboardFullscreen;
    document.body.appendChild(btn);

    // Tenta fullscreen nativo
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    tab.scrollTop = 0;
  } else {
    _tvMode = false;
    tab.classList.remove('dh-tv-mode');
    document.querySelector('.dh-tv-exit')?.remove();
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
}

// Sai do modo TV com ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _tvMode) dashboardFullscreen();
});
