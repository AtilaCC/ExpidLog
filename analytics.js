/**
 * analytics.js — DockCheck PRO · Fase 13
 * Central de Inteligência Operacional Enterprise
 *
 * COMPATIBILIDADE TOTAL:
 *  - Mantém todos os IDs existentes no index.html
 *  - Mantém renderAnalytics() como ponto de entrada
 *  - Mantém _fmtMin(), _duracaoMin(), _setAnEl() e AN_COLORS
 *  - NÃO altera backend, dashboard, IA, OCR ou qualquer outro módulo
 *
 * NOVIDADES vs Fase 5:
 *  - KPIs realtime animados (SLA, docas ativas, produtividade, score)
 *  - Gráfico de linha com gradiente (produtividade por hora)
 *  - Heatmap docas × hora em canvas puro
 *  - Gráfico radar de performance por equipe
 *  - Comparativo turno atual vs turno anterior
 *  - Sparklines inline nos cards KPI
 *  - Visual Power BI / Control Tower
 *  - Light/Dark mode via variáveis CSS existentes
 *  - Auto-refresh a cada 60s se a aba estiver aberta
 *  - CSS injetado dinamicamente (não altera style.css)
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   PALETA (mantida + expandida)
════════════════════════════════════════════════════════════ */
const AN_COLORS = [
  '#f59e0b','#10b981','#3b82f6','#8b5cf6',
  '#ef4444','#06b6d4','#f97316','#ec4899',
  '#84cc16','#14b8a6'
];

/* ════════════════════════════════════════════════════════════
   AUTO-REFRESH
════════════════════════════════════════════════════════════ */
let _anAutoRefreshTimer = null;

function _anIniciarAutoRefresh() {
  if (_anAutoRefreshTimer) clearInterval(_anAutoRefreshTimer);
  _anAutoRefreshTimer = setInterval(() => {
    const tabEl = document.getElementById('tab-analytics');
    if (tabEl && tabEl.style.display !== 'none') renderAnalytics();
  }, 60000);
}

/* ════════════════════════════════════════════════════════════
   FILTRO DE PERÍODO
════════════════════════════════════════════════════════════ */
function _anEntries() {
  const periodo = document.getElementById('an-filtro-periodo')?.value || 'turno';
  const agora   = new Date();
  const base    = (typeof historico !== 'undefined' ? historico : [])
    .filter(h => h.tipo === 'conferencia');

  if (periodo === 'tudo') return base;

  if (periodo === 'hoje') {
    const ini = new Date(agora); ini.setHours(0,0,0,0);
    return base.filter(h => new Date(h.data) >= ini);
  }

  if (periodo === '7dias') {
    const ini = new Date(agora); ini.setDate(ini.getDate()-7); ini.setHours(0,0,0,0);
    return base.filter(h => new Date(h.data) >= ini);
  }

  // Turno atual
  const hh = agora.getHours();
  let ini;
  if      (hh >= 6  && hh < 14) { ini = new Date(agora); ini.setHours(6,0,0,0); }
  else if (hh >= 14 && hh < 22) { ini = new Date(agora); ini.setHours(14,0,0,0); }
  else if (hh >= 22)             { ini = new Date(agora); ini.setHours(22,0,0,0); }
  else                           { ini = new Date(agora); ini.setDate(ini.getDate()-1); ini.setHours(22,0,0,0); }

  return base.filter(h => new Date(h.data) >= ini);
}

/* ════════════════════════════════════════════════════════════
   PONTO DE ENTRADA
════════════════════════════════════════════════════════════ */
function renderAnalytics() {
  const entries = _anEntries();
  const periodo = document.getElementById('an-filtro-periodo')?.value || 'turno';
  const nomes   = { turno:'Turno atual', hoje:'Hoje', '7dias':'Últimos 7 dias', tudo:'Todo histórico' };

  const sub = document.getElementById('an-sub');
  if (sub) sub.textContent = `${nomes[periodo]} · ${entries.length} conferência${entries.length !== 1 ? 's' : ''} analisadas`;

  // Timestamp de atualização
  const ts = document.getElementById('an-update-ts');
  if (ts) ts.textContent = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

  _anKPIsEnterprise(entries);
  _anResumoExecutivo(entries, periodo);
  _anInsights(entries);
  _anGraficoLinhaHora(entries);
  _anGraficoTempoDocas(entries);
  _anHeatmapDocas(entries);
  _anRankingDocas(entries);
  _anGraficoTransp(entries);
  _anEquipes(entries);
  _anRadarEquipes(entries);
  _anComparativo(entries);
  _anPrevisao(entries);
  _anGargalos(entries);
  _anIniciarAutoRefresh();
}

/* ════════════════════════════════════════════════════════════
   KPIs ENTERPRISE REALTIME
════════════════════════════════════════════════════════════ */
function _anKPIsEnterprise(entries) {
  const el = document.getElementById('an-kpi-grid');
  if (!el) return;

  const duracoes   = entries.map(h => _duracaoMin(h)).filter(v => v !== null && v > 0 && v < 480);
  const tempoMed   = duracoes.length ? Math.round(duracoes.reduce((a,b) => a+b, 0) / duracoes.length) : null;
  const emAtraso   = entries.filter(h => (_duracaoMin(h) || 0) > 90).length;
  const sla        = entries.length ? Math.round((1 - emAtraso / entries.length) * 100) : 100;
  const docasAtiv  = new Set(entries.map(h => h.doca?.trim()).filter(Boolean)).size;
  const totalOCR   = (typeof ocrRows !== 'undefined') ? ocrRows.length : 0;
  const feitas     = new Set(entries.map(h => h.oc?.trim()).filter(Boolean)).size;
  const efic       = totalOCR ? Math.min(100, Math.round((feitas / totalOCR) * 100)) : (entries.length ? 100 : 0);
  const totalPed   = entries.reduce((s, h) => s + (parseInt(h.pedidos) || 0), 0);

  // Score operacional simples
  const score = Math.round(sla * 0.4 + efic * 0.35 + Math.min(100, docasAtiv * 12) * 0.25);

  // Ritmo: OCs na última hora
  const h1 = new Date(Date.now() - 3600000);
  const ritmo = entries.filter(h => new Date(h.data) >= h1).length;

  const kpis = [
    {
      id:'kpi-sla', icon:'🎯', label:'SLA Operacional',
      val: sla + '%',
      cor: sla >= 85 ? '#10b981' : sla >= 70 ? '#f59e0b' : '#ef4444',
      trend: sla >= 85 ? '↑' : sla >= 70 ? '→' : '↓',
      sub: `${emAtraso} em atraso`,
    },
    {
      id:'kpi-vol', icon:'📦', label:'Volume',
      val: entries.length,
      cor: '#3b82f6',
      trend: entries.length > 5 ? '↑' : '→',
      sub: `${feitas} OCs concluídas`,
    },
    {
      id:'kpi-tempo', icon:'⏱', label:'Tempo Médio',
      val: tempoMed ? _fmtMin(tempoMed) : '—',
      cor: tempoMed && tempoMed <= 60 ? '#10b981' : tempoMed && tempoMed <= 90 ? '#f59e0b' : '#ef4444',
      trend: tempoMed && tempoMed <= 60 ? '↑' : '→',
      sub: 'por OC conferida',
    },
    {
      id:'kpi-efic', icon:'📊', label:'Eficiência',
      val: efic + '%',
      cor: efic >= 80 ? '#10b981' : efic >= 60 ? '#f59e0b' : '#ef4444',
      trend: efic >= 80 ? '↑' : '→',
      sub: `${feitas}/${totalOCR} OCs`,
    },
    {
      id:'kpi-docas', icon:'🏭', label:'Docas Ativas',
      val: docasAtiv,
      cor: '#8b5cf6',
      trend: '→',
      sub: 'no período',
    },
    {
      id:'kpi-ritmo', icon:'⚡', label:'Ritmo Atual',
      val: ritmo + '/h',
      cor: '#f59e0b',
      trend: ritmo > 3 ? '↑' : '→',
      sub: 'última hora',
    },
    {
      id:'kpi-pedidos', icon:'🗂', label:'Pedidos',
      val: totalPed || '—',
      cor: '#06b6d4',
      trend: '→',
      sub: 'conferidos',
    },
    {
      id:'kpi-score', icon:'🏆', label:'Score',
      val: score,
      cor: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444',
      trend: score >= 80 ? '↑' : score >= 60 ? '→' : '↓',
      sub: score >= 80 ? 'Excelente' : score >= 60 ? 'Regular' : 'Crítico',
    },
  ];

  el.innerHTML = kpis.map(k => `
    <div class="an-kpi-card" id="${k.id}">
      <div class="an-kpi-top">
        <span class="an-kpi-icon">${k.icon}</span>
        <span class="an-kpi-trend" style="color:${k.cor}">${k.trend}</span>
      </div>
      <div class="an-kpi-val" style="color:${k.cor}">${k.val}</div>
      <div class="an-kpi-label">${k.label}</div>
      <div class="an-kpi-sub">${k.sub}</div>
      <div class="an-kpi-bar-wrap">
        <div class="an-kpi-bar" style="background:${k.cor}20;width:100%;height:2px;border-radius:1px;margin-top:6px">
          <div style="height:100%;width:${typeof k.val === 'string' && k.val.includes('%') ? k.val : '100%'};background:${k.cor};border-radius:1px;transition:width .8s"></div>
        </div>
      </div>
    </div>
  `).join('');

  // Anima entrada dos cards
  requestAnimationFrame(() => {
    el.querySelectorAll('.an-kpi-card').forEach((c, i) => {
      c.style.opacity = '0';
      c.style.transform = 'translateY(12px)';
      setTimeout(() => {
        c.style.transition = 'opacity .3s, transform .3s';
        c.style.opacity    = '1';
        c.style.transform  = 'translateY(0)';
      }, i * 50);
    });
  });
}

/* ════════════════════════════════════════════════════════════
   RESUMO EXECUTIVO
════════════════════════════════════════════════════════════ */
function _anResumoExecutivo(entries, periodo) {
  const duracoes   = entries.map(h => _duracaoMin(h)).filter(v => v !== null && v > 0 && v < 480);
  const tempoMed   = duracoes.length ? Math.round(duracoes.reduce((a,b) => a+b,0) / duracoes.length) : null;
  const totalPed   = entries.reduce((s, h) => s + (parseInt(h.pedidos) || 0), 0);
  const totalCli   = entries.reduce((s, h) => s + (parseInt(h.clientes) || 0), 0);
  const totalDocas = new Set(entries.map(h => h.doca?.trim()).filter(Boolean)).size;
  const alertas    = entries.filter(h => _duracaoMin(h) > 90).length;
  const totalOCR   = (typeof ocrRows !== 'undefined') ? ocrRows.length : 0;
  const feitas     = new Set(entries.map(h => h.oc?.trim())).size;
  const efic       = totalOCR ? Math.min(Math.round((feitas / totalOCR) * 100), 100) : 100;

  let statusCls = 'ok', statusLbl = '✅ OPERAÇÃO NORMAL';
  if (alertas > 2 || efic < 40)    { statusCls = 'crit'; statusLbl = '🚨 ATENÇÃO NECESSÁRIA'; }
  else if (alertas > 0 || efic < 70) { statusCls = 'warn'; statusLbl = '⚠️ MONITORANDO'; }

  const titulos = { turno:'Turno Atual', hoje:'Relatório do Dia', '7dias':'Semana Operacional', tudo:'Histórico Completo' };

  _setAnEl('an-exec-titulo',  titulos[periodo] || 'Relatório');
  _setAnEl('an-exec-cargas',  entries.length);
  _setAnEl('an-exec-tempo',   tempoMed ? _fmtMin(tempoMed) : '—');
  _setAnEl('an-exec-efic',    efic + '%');
  _setAnEl('an-exec-alertas', alertas);

  const statusEl = document.getElementById('an-exec-status');
  if (statusEl) { statusEl.textContent = statusLbl; statusEl.className = `an-exec-status ${statusCls}`; }

  const resumoEl = document.getElementById('an-exec-resumo');
  if (resumoEl && entries.length) {
    const confTop = _topConf(entries);
    resumoEl.textContent =
      `${entries.length} conferência${entries.length !== 1 ? 's' : ''} registradas em ${totalDocas} doca${totalDocas !== 1 ? 's' : ''}.` +
      (totalPed ? ` ${totalPed} pedidos e ${totalCli} clientes atendidos.` : '') +
      (tempoMed ? ` Tempo médio: ${_fmtMin(tempoMed)}.` : '') +
      (confTop ? ` Destaque: ${confTop}.` : '') +
      (alertas ? ` ${alertas} operação${alertas > 1 ? 'ões' : ''} acima do limite.` : ' Sem atrasos registrados.');
  } else if (resumoEl) {
    resumoEl.textContent = 'Nenhuma conferência registrada neste período.';
  }
}

function _topConf(entries) {
  const cnt = {};
  entries.forEach(h => { const c = h.conf?.trim(); if (c) cnt[c] = (cnt[c] || 0) + 1; });
  const top = Object.entries(cnt).sort((a,b) => b[1]-a[1])[0];
  return top ? `${top[0]} (${top[1]} conf.)` : null;
}

function _topDoca(entries) {
  const cnt = {};
  entries.forEach(h => { const d = h.doca?.trim(); if (d) cnt[d] = (cnt[d] || 0) + 1; });
  const top = Object.entries(cnt).sort((a,b) => b[1]-a[1])[0];
  return top ? `Doca ${top[0]}` : null;
}

/* ════════════════════════════════════════════════════════════
   INSIGHTS AUTOMÁTICOS
════════════════════════════════════════════════════════════ */
function _anInsights(entries) {
  const el = document.getElementById('an-insights');
  if (!el) return;

  if (entries.length < 2) {
    el.innerHTML = '<div class="an-empty"><span class="an-empty-icon">🧠</span><div>Registre pelo menos 2 conferências para gerar insights</div></div>';
    return;
  }

  const insights  = [];
  const duracoes  = entries.map(h => _duracaoMin(h)).filter(v => v !== null && v > 0 && v < 480);
  const medGlobal = duracoes.length ? duracoes.reduce((a,b) => a+b, 0) / duracoes.length : null;

  // Por doca
  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim() || '?';
    if (!byDoca[d]) byDoca[d] = { count:0, durs:[] };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);
  });

  const docaStats = Object.entries(byDoca).map(([doca, v]) => ({
    doca, count: v.count,
    med: v.durs.length ? v.durs.reduce((a,b) => a+b,0) / v.durs.length : null
  })).filter(d => d.med !== null);

  const maisLenta = docaStats.sort((a,b) => b.med - a.med)[0];
  if (maisLenta && medGlobal && maisLenta.med > medGlobal * 1.2) {
    const pct = Math.round(((maisLenta.med - medGlobal) / medGlobal) * 100);
    insights.push({ tipo:'crit', icon:'🚨', txt:`Doca ${maisLenta.doca} está ${pct}% acima do tempo médio geral`, sub:`Tempo: ${_fmtMin(Math.round(maisLenta.med))} · Média: ${_fmtMin(Math.round(medGlobal))}` });
  }

  const maisRapida = [...docaStats].sort((a,b) => a.med - b.med)[0];
  if (maisRapida && medGlobal && maisRapida.med < medGlobal * 0.8) {
    const pct = Math.round(((medGlobal - maisRapida.med) / medGlobal) * 100);
    insights.push({ tipo:'good', icon:'⚡', txt:`Doca ${maisRapida.doca} ${pct}% abaixo do tempo médio — destaque`, sub:`Tempo médio: ${_fmtMin(Math.round(maisRapida.med))}` });
  }

  // Melhor conferente
  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim() || '?';
    if (!byConf[c]) byConf[c] = { count:0, durs:[] };
    byConf[c].count++;
    const d = _duracaoMin(h); if (d) byConf[c].durs.push(d);
  });
  const confRank = Object.entries(byConf)
    .map(([nome, v]) => ({ nome, count: v.count, med: v.durs.length ? v.durs.reduce((a,b) => a+b,0) / v.durs.length : null }))
    .filter(c => c.med !== null).sort((a,b) => a.med - b.med);
  if (confRank.length) {
    const top = confRank[0];
    insights.push({ tipo:'good', icon:'🏆', txt:`${top.nome} com melhor produtividade do turno`, sub:`Tempo médio: ${_fmtMin(Math.round(top.med))} · ${top.count} conf.` });
  }

  // Transportadora maior volume
  const byTransp = {};
  entries.forEach(h => { const t = h.transportadora?.trim() || '?'; byTransp[t] = (byTransp[t] || 0) + 1; });
  const transpTop = Object.entries(byTransp).sort((a,b) => b[1]-a[1])[0];
  if (transpTop && transpTop[0] !== '?') {
    insights.push({ tipo:'info', icon:'🚛', txt:`${transpTop[0]} com maior volume — ${transpTop[1]} carga${transpTop[1] > 1 ? 's' : ''}`, sub:`${Math.round((transpTop[1] / entries.length) * 100)}% do total` });
  }

  // Eficiência
  const totalOCR = (typeof ocrRows !== 'undefined') ? ocrRows.length : 0;
  const feitas   = new Set(entries.map(h => h.oc?.trim())).size;
  const efic     = totalOCR ? Math.round((feitas / totalOCR) * 100) : 100;
  if (efic < 50 && totalOCR > 0) {
    insights.push({ tipo:'warn', icon:'⚠️', txt:`Eficiência em ${efic}% — mais da metade das OCs pendentes`, sub:`${feitas} finalizadas de ${totalOCR} previstas` });
  } else if (efic >= 90 && totalOCR > 0) {
    insights.push({ tipo:'good', icon:'✅', txt:`Excelente eficiência — ${efic}% das OCs concluídas`, sub:`${feitas} de ${totalOCR} OCs finalizadas` });
  }

  if (!insights.length) {
    insights.push({ tipo:'info', icon:'ℹ️', txt:'Operação dentro dos parâmetros normais', sub:'Sem anomalias detectadas neste período' });
  }

  el.innerHTML = insights.map(ins => `
    <div class="an-insight ${ins.tipo}">
      <div class="an-insight-icon">${ins.icon}</div>
      <div class="an-insight-body">
        <div class="an-insight-txt">${ins.txt}</div>
        <div class="an-insight-sub">${ins.sub}</div>
      </div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   GRÁFICO LINHA COM GRADIENTE — Produtividade por Hora
════════════════════════════════════════════════════════════ */
function _anGraficoLinhaHora(entries) {
  const canvas = document.getElementById('an-chart-hora');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 320;
  canvas.width = W; canvas.height = 160;
  const H = 160;
  ctx.clearRect(0, 0, W, H);

  if (!entries.length) { _anCanvasEmpty(ctx, W, H, 'Sem dados no período'); return; }

  const porHora = {};
  entries.forEach(h => {
    const hr = new Date(h.data).getHours();
    porHora[hr] = (porHora[hr] || 0) + 1;
  });

  const horas  = Object.keys(porHora).map(Number).sort((a,b) => a-b);
  const valores = horas.map(h => porHora[h]);
  const max     = Math.max(...valores, 1);

  const PAD = { top:20, right:12, bottom:30, left:32 };
  const step = (W - PAD.left - PAD.right) / Math.max(horas.length - 1, 1);

  // Grid
  for (let i = 0; i <= 3; i++) {
    const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - i/3);
    ctx.strokeStyle = '#1e2533'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle = '#4a5568'; ctx.font = '9px Barlow,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max * i/3), PAD.left - 3, y + 3);
  }

  const pts = horas.map((h, i) => ({
    x: PAD.left + i * step,
    y: PAD.top + (H - PAD.top - PAD.bottom) * (1 - porHora[h] / max),
  }));

  // Área gradiente
  const grad = ctx.createLinearGradient(0, PAD.top, 0, H - PAD.bottom);
  grad.addColorStop(0, '#8b5cf688');
  grad.addColorStop(1, '#8b5cf600');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cp = { x: (pts[i-1].x + pts[i].x) / 2, y: (pts[i-1].y + pts[i].y) / 2 };
    ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, cp.x, cp.y);
  }
  ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  ctx.lineTo(pts[pts.length-1].x, H - PAD.bottom);
  ctx.lineTo(pts[0].x, H - PAD.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Linha
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cp = { x: (pts[i-1].x + pts[i].x) / 2, y: (pts[i-1].y + pts[i].y) / 2 };
    ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, cp.x, cp.y);
  }
  ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2.5; ctx.stroke();

  // Pontos
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#8b5cf6'; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();

    // Valor
    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 9px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(valores[i], p.x, p.y - 8);

    // Label hora
    ctx.fillStyle = '#64748b'; ctx.font = '9px Barlow Condensed,sans-serif';
    ctx.fillText(`${horas[i]}h`, p.x, H - 4);
  });
}

/* ════════════════════════════════════════════════════════════
   GRÁFICO BARRAS — Tempo Médio por Doca
════════════════════════════════════════════════════════════ */
function _anGraficoTempoDocas(entries) {
  const canvas = document.getElementById('an-chart-doca-tempo');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 320;
  canvas.width = W; canvas.height = 160;
  const H = 160;
  ctx.clearRect(0, 0, W, H);

  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim() || '?';
    if (!byDoca[d]) byDoca[d] = [];
    const dur = _duracaoMin(h); if (dur && dur > 0 && dur < 480) byDoca[d].push(dur);
  });

  const docas = Object.entries(byDoca)
    .filter(([,v]) => v.length > 0)
    .map(([doca, durs]) => ({ doca, med: Math.round(durs.reduce((a,b) => a+b,0) / durs.length) }))
    .sort((a,b) => b.med - a.med)
    .slice(0, 10);

  if (!docas.length) { _anCanvasEmpty(ctx, W, H, 'Sem dados de tempo'); return; }

  const max    = Math.max(...docas.map(d => d.med), 1);
  const labels = docas.map(d => `D${d.doca}`);
  const values = docas.map(d => d.med);
  const colors = docas.map(d => d.med > 90 ? '#ef4444' : d.med < 45 ? '#10b981' : '#f59e0b');

  _anDrawBar(ctx, W, H, labels, values, max, '#f59e0b', colors);
}

/* ════════════════════════════════════════════════════════════
   HEATMAP OPERACIONAL — Docas × Hora
════════════════════════════════════════════════════════════ */
function _anHeatmapDocas(entries) {
  const canvas = document.getElementById('an-heatmap');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 320;
  canvas.width = W; canvas.height = 180;
  const H = 180;
  ctx.clearRect(0, 0, W, H);

  if (entries.length < 3) {
    _anCanvasEmpty(ctx, W, H, 'Registre mais conferências para o heatmap'); return;
  }

  const docas  = [...new Set(entries.map(h => h.doca?.trim()).filter(Boolean))].sort().slice(0, 8);
  const matrix = {};
  docas.forEach(d => { matrix[d] = {}; });
  entries.forEach(h => {
    const d  = h.doca?.trim();
    const hr = new Date(h.data).getHours();
    if (d && matrix[d]) matrix[d][hr] = (matrix[d][hr] || 0) + 1;
  });

  const horasAtivas = Array.from({ length: 24 }, (_, i) => i)
    .filter(hr => docas.some(d => matrix[d][hr]));

  if (!horasAtivas.length) { _anCanvasEmpty(ctx, W, H, 'Sem atividade detectada'); return; }

  const maxVal = Math.max(...docas.flatMap(d => horasAtivas.map(h => matrix[d][h] || 0)), 1);
  const PAD    = { top: 8, left: 40, bottom: 20, right: 8 };
  const cellW  = (W - PAD.left - PAD.right) / horasAtivas.length;
  const cellH  = (H - PAD.top - PAD.bottom) / docas.length;

  docas.forEach((doca, di) => {
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 9px Barlow Condensed,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('D' + doca, PAD.left - 4, PAD.top + di * cellH + cellH/2 + 3);

    horasAtivas.forEach((hr, hi) => {
      const val    = matrix[doca][hr] || 0;
      const intens = val / maxVal;
      const x = PAD.left + hi * cellW;
      const y = PAD.top  + di * cellH;

      const r = Math.round(245 * intens);
      const g = Math.round(intens > 0.5 ? 158 * (1 - intens) : 158);
      const b = Math.round(11 * intens);
      ctx.fillStyle = val ? `rgba(${r},${g},${b},${0.2 + intens * 0.8})` : 'rgba(30,37,51,.4)';
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

      if (val > 0) {
        ctx.fillStyle  = intens > 0.5 ? '#fff' : '#e2e8f0';
        ctx.font       = 'bold 8px Barlow,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(val, x + cellW/2, y + cellH/2 + 3);
      }
    });
  });

  horasAtivas.forEach((hr, hi) => {
    ctx.fillStyle = '#64748b'; ctx.font = '8px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${hr}h`, PAD.left + hi * cellW + cellW/2, H - 4);
  });
}

/* ════════════════════════════════════════════════════════════
   RANKING DE DOCAS (mantido)
════════════════════════════════════════════════════════════ */
function _anRankingDocas(entries) {
  const elR = document.getElementById('an-rank-rapidas');
  const elL = document.getElementById('an-rank-lentas');

  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim() || '?';
    if (!byDoca[d]) byDoca[d] = { count:0, durs:[] };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur && dur > 0 && dur < 480) byDoca[d].durs.push(dur);
  });

  const docas = Object.entries(byDoca)
    .filter(([,v]) => v.durs.length > 0)
    .map(([doca, v]) => ({ doca, count: v.count, med: Math.round(v.durs.reduce((a,b) => a+b,0) / v.durs.length) }));

  if (!docas.length) {
    const empty = '<div class="an-empty" style="padding:16px"><span style="font-size:20px">—</span></div>';
    if (elR) elR.innerHTML = empty;
    if (elL) elL.innerHTML = empty;
    return;
  }

  const rapidas = [...docas].sort((a,b) => a.med - b.med).slice(0, 4);
  const lentas  = [...docas].sort((a,b) => b.med - a.med).slice(0, 4);
  const maxMed  = Math.max(...docas.map(d => d.med), 1);
  const medals  = ['🥇','🥈','🥉','4️⃣'];

  const renderList = (list, cor, el) => {
    if (!el) return;
    el.innerHTML = list.map((d, i) => `
      <div class="an-rank-item">
        <div class="an-rank-pos" style="color:${cor}">${medals[i] || i+1}</div>
        <div class="an-rank-info">
          <div class="an-rank-name" style="color:${cor}">Doca ${d.doca}</div>
          <div class="an-rank-bar-wrap">
            <div class="an-rank-bar" style="width:${(d.med/maxMed)*100}%;background:${cor}"></div>
          </div>
        </div>
        <div class="an-rank-val" style="color:${cor}">${_fmtMin(d.med)}</div>
      </div>
    `).join('');
  };

  renderList(rapidas, 'var(--grn)', elR);
  renderList(lentas,  'var(--red)', elL);
}

/* ════════════════════════════════════════════════════════════
   GRÁFICO PIZZA — Transportadoras (mantido + melhorado)
════════════════════════════════════════════════════════════ */
function _anGraficoTransp(entries) {
  const canvas = document.getElementById('an-chart-transp');
  const legEl  = document.getElementById('an-transp-legend');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.width  || 140;
  const H   = canvas.height || 140;
  ctx.clearRect(0, 0, W, H);

  const byTransp = {};
  entries.forEach(h => {
    const t = h.transportadora?.trim() || '(sem nome)';
    byTransp[t] = (byTransp[t] || 0) + 1;
  });

  const data  = Object.entries(byTransp).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const total = data.reduce((s,[,v]) => s+v, 0);

  if (!total) {
    ctx.fillStyle = '#4a5568'; ctx.font = '11px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Sem dados', W/2, H/2);
    return;
  }

  const cx = W/2, cy = H/2, r = Math.min(cx, cy) - 6, ri = r * 0.5;
  let angle = -Math.PI / 2;

  data.forEach(([lbl, val], i) => {
    const slice = (val/total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = AN_COLORS[i % AN_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#0d1017'; ctx.lineWidth = 2; ctx.stroke();
    angle += slice;
  });

  // Buraco central (donut)
  ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0d1017';
  ctx.fillStyle = bg; ctx.fill();

  // Texto central
  ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 14px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy + 2);
  ctx.fillStyle = '#64748b'; ctx.font = '9px Barlow,sans-serif';
  ctx.fillText('cargas', cx, cy + 13);

  if (legEl) {
    legEl.innerHTML = data.map(([lbl, val], i) => `
      <div style="display:flex;align-items:center;gap:6px;padding:3px 0">
        <div style="width:8px;height:8px;border-radius:50%;background:${AN_COLORS[i % AN_COLORS.length]};flex-shrink:0"></div>
        <span style="color:var(--mut);font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lbl}</span>
        <span style="color:var(--acc);font-weight:700;font-size:11px">${val}</span>
      </div>
    `).join('');
  }
}

/* ════════════════════════════════════════════════════════════
   ANÁLISE DE EQUIPES (mantida + melhorada)
════════════════════════════════════════════════════════════ */
function _anEquipes(entries) {
  const el = document.getElementById('an-equipes-rank');
  if (!el) return;

  if (!entries.length) {
    el.innerHTML = '<div class="an-empty"><span class="an-empty-icon">👥</span><div>Sem dados de equipe</div></div>';
    return;
  }

  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim() || '(sem nome)';
    if (!byConf[c]) byConf[c] = { count:0, durs:[], ped:0, cli:0, aux1:'', aux2:'' };
    byConf[c].count++;
    byConf[c].ped += parseInt(h.pedidos) || 0;
    byConf[c].cli += parseInt(h.clientes) || 0;
    const dur = _duracaoMin(h); if (dur && dur > 0 && dur < 480) byConf[c].durs.push(dur);
    if (h.aux1) byConf[c].aux1 = h.aux1;
    if (h.aux2) byConf[c].aux2 = h.aux2;
  });

  const rank = Object.entries(byConf)
    .map(([nome, v]) => ({
      nome, count: v.count, ped: v.ped, cli: v.cli,
      med: v.durs.length ? Math.round(v.durs.reduce((a,b) => a+b,0) / v.durs.length) : null,
      aux: [v.aux1, v.aux2].filter(Boolean).join(' · ')
    }))
    .sort((a,b) => b.count - a.count || (a.med||999) - (b.med||999));

  const medals   = ['🥇','🥈','🥉'];
  const cores    = ['var(--acc)','#94a3b8','#cd7f32'];
  const maxCount = rank[0]?.count || 1;

  el.innerHTML = rank.map((r, i) => `
    <div class="an-eq-card${i === 0 ? ' destaque' : ''}">
      <div class="an-eq-pos" style="color:${cores[i] || 'var(--mut)'}">${medals[i] || i+1}</div>
      <div style="flex:1;min-width:0">
        <div class="an-eq-name">${r.nome}</div>
        <div class="an-eq-sub">${r.aux || 'Sem auxiliares'} · ${r.med ? _fmtMin(r.med) : '—'}/OC</div>
        <div class="an-eq-bar-wrap">
          <div class="an-eq-bar" style="width:${(r.count/maxCount)*100}%;background:${cores[i]||'var(--mut)'}"></div>
        </div>
      </div>
      <div class="an-eq-metrics">
        <div class="an-eq-val">${r.count}</div>
        <div class="an-eq-lbl">conf.</div>
        ${r.ped ? `<div style="font-size:10px;color:var(--mut);margin-top:2px">${r.ped} ped.</div>` : ''}
      </div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   RADAR DE EQUIPES (NOVO)
════════════════════════════════════════════════════════════ */
function _anRadarEquipes(entries) {
  const canvas = document.getElementById('an-chart-radar');
  if (!canvas || entries.length < 2) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 200;
  canvas.width = W; canvas.height = W;
  const H   = W;
  ctx.clearRect(0, 0, W, H);

  const cx  = W/2, cy = H/2, r = Math.min(cx, cy) - 24;
  const eixos = ['Volume', 'Velocidade', 'Pedidos', 'Clientes', 'Docas'];
  const n   = eixos.length;

  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim() || '(sem nome)';
    if (!byConf[c]) byConf[c] = { count:0, durs:[], ped:0, cli:0, docas:new Set() };
    byConf[c].count++;
    byConf[c].ped += parseInt(h.pedidos) || 0;
    byConf[c].cli += parseInt(h.clientes) || 0;
    if (h.doca) byConf[c].docas.add(h.doca.trim());
    const dur = _duracaoMin(h); if (dur && dur > 0 && dur < 480) byConf[c].durs.push(dur);
  });

  const top3 = Object.entries(byConf).sort((a,b) => b[1].count - a[1].count).slice(0, 3);
  const maxCount = Math.max(...top3.map(([,v]) => v.count), 1);
  const maxPed   = Math.max(...top3.map(([,v]) => v.ped), 1);
  const maxCli   = Math.max(...top3.map(([,v]) => v.cli), 1);
  const maxDur   = Math.max(...top3.flatMap(([,v]) => v.durs), 1);

  // Tela de aranha
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a  = (i / n) * Math.PI * 2 - Math.PI/2;
      const px = cx + Math.cos(a) * r * frac;
      const py = cy + Math.sin(a) * r * frac;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = '#1e2533'; ctx.lineWidth = 1; ctx.stroke();
  });

  // Eixos
  for (let i = 0; i < n; i++) {
    const a  = (i / n) * Math.PI * 2 - Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.strokeStyle = '#1e2533'; ctx.lineWidth = 1; ctx.stroke();

    // Labels
    const lx = cx + Math.cos(a) * (r + 14);
    const ly = cy + Math.sin(a) * (r + 14);
    ctx.fillStyle = '#64748b'; ctx.font = '8px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(eixos[i], lx, ly + 3);
  }

  // Polígono por conferente
  top3.forEach(([nome, v], idx) => {
    const medDur = v.durs.length ? v.durs.reduce((a,b) => a+b,0) / v.durs.length : maxDur;
    const vals   = [
      v.count / maxCount,
      1 - Math.min(medDur / maxDur, 1),
      v.ped / maxPed,
      v.cli / maxCli,
      v.docas.size / 8,
    ];

    ctx.beginPath();
    vals.forEach((val, i) => {
      const a  = (i / n) * Math.PI * 2 - Math.PI/2;
      const px = cx + Math.cos(a) * r * val;
      const py = cy + Math.sin(a) * r * val;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    const cor = AN_COLORS[idx];
    ctx.fillStyle   = cor + '33';
    ctx.strokeStyle = cor;
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
  });
}

/* ════════════════════════════════════════════════════════════
   COMPARATIVO — Turno atual vs anterior
════════════════════════════════════════════════════════════ */
function _anComparativo(entries) {
  const el = document.getElementById('an-comparativo');
  if (!el) return;

  const todos = (typeof historico !== 'undefined' ? historico : []).filter(h => h.tipo === 'conferencia');
  if (todos.length < 2) {
    el.innerHTML = '<div class="an-empty"><span class="an-empty-icon">📊</span><div>Sem dados suficientes para comparação</div></div>';
    return;
  }

  const agora = new Date();
  const hh    = agora.getHours();

  // Define turno atual e anterior
  let iniAtual, fimAtual, iniAnterior;
  if      (hh >= 6  && hh < 14) { iniAtual = new Date(agora); iniAtual.setHours(6,0,0,0);   iniAnterior = new Date(iniAtual); iniAnterior.setDate(iniAnterior.getDate()-1); iniAnterior.setHours(22,0,0,0); fimAtual = new Date(agora); }
  else if (hh >= 14 && hh < 22) { iniAtual = new Date(agora); iniAtual.setHours(14,0,0,0);  iniAnterior = new Date(agora);  iniAnterior.setHours(6,0,0,0);  fimAtual = new Date(agora); }
  else if (hh >= 22)             { iniAtual = new Date(agora); iniAtual.setHours(22,0,0,0);  iniAnterior = new Date(agora);  iniAnterior.setHours(14,0,0,0); fimAtual = new Date(agora); }
  else                           { iniAtual = new Date(agora); iniAtual.setDate(iniAtual.getDate()-1); iniAtual.setHours(22,0,0,0); iniAnterior = new Date(iniAtual); iniAnterior.setHours(14,0,0,0); fimAtual = new Date(agora); }

  const atual    = todos.filter(h => new Date(h.data) >= iniAtual);
  const anterior = todos.filter(h => new Date(h.data) >= iniAnterior && new Date(h.data) < iniAtual);

  const stat = (arr) => {
    const durs   = arr.map(h => _duracaoMin(h)).filter(v => v !== null && v > 0 && v < 480);
    const med    = durs.length ? Math.round(durs.reduce((a,b) => a+b,0) / durs.length) : null;
    const atras  = arr.filter(h => (_duracaoMin(h) || 0) > 90).length;
    const sla    = arr.length ? Math.round((1 - atras / arr.length) * 100) : 100;
    return { count: arr.length, med, sla };
  };

  const sa = stat(atual);
  const sb = stat(anterior);

  const delta = (a, b, maior_melhor = true) => {
    if (!b) return { txt: '—', cor: 'var(--mut)' };
    const d   = a - b;
    const pct = b ? Math.round((d / b) * 100) : 0;
    const bom = maior_melhor ? d > 0 : d < 0;
    return {
      txt: `${d > 0 ? '+' : ''}${pct}%`,
      cor: d === 0 ? 'var(--mut)' : bom ? '#10b981' : '#ef4444',
    };
  };

  const dVol  = delta(sa.count, sb.count, true);
  const dSLA  = delta(sa.sla,   sb.sla,   true);
  const dTmp  = delta(sa.med || 0, sb.med || 0, false);

  el.innerHTML = `
    <div class="an-comp-grid">
      <div class="an-comp-col">
        <div class="an-comp-header">Turno Atual</div>
        <div class="an-comp-val" style="color:var(--acc)">${sa.count}</div>
        <div class="an-comp-lbl">conferências</div>
        <div class="an-comp-val2">${sa.sla}% SLA</div>
        <div class="an-comp-val2">${sa.med ? _fmtMin(sa.med) : '—'} médio</div>
      </div>
      <div class="an-comp-divider">
        <div class="an-comp-delta" style="color:${dVol.cor}">${dVol.txt}</div>
        <div class="an-comp-delta" style="color:${dSLA.cor}">${dSLA.txt} SLA</div>
        <div class="an-comp-delta" style="color:${dTmp.cor}">${dTmp.txt} tempo</div>
      </div>
      <div class="an-comp-col">
        <div class="an-comp-header">Turno Anterior</div>
        <div class="an-comp-val" style="color:var(--mut)">${sb.count}</div>
        <div class="an-comp-lbl">conferências</div>
        <div class="an-comp-val2">${sb.sla}% SLA</div>
        <div class="an-comp-val2">${sb.med ? _fmtMin(sb.med) : '—'} médio</div>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   PREVISÃO OPERACIONAL (mantida)
════════════════════════════════════════════════════════════ */
function _anPrevisao(entries) {
  const el = document.getElementById('an-previsao');
  if (!el) return;

  if (entries.length < 3) {
    el.innerHTML = '<div class="an-empty"><span class="an-empty-icon">🔮</span><div>Registre mais conferências para previsões</div></div>';
    return;
  }

  const previsoes  = [];
  const feitas     = new Set(entries.map(h => h.oc?.trim())).size;
  const totalOCR   = (typeof ocrRows !== 'undefined') ? ocrRows.length : 0;
  const pendentes  = totalOCR - feitas;
  const duracoes   = entries.map(h => _duracaoMin(h)).filter(v => v !== null && v > 0 && v < 480);
  const tempoMed   = duracoes.length ? duracoes.reduce((a,b) => a+b,0) / duracoes.length : null;

  if (pendentes > 0 && tempoMed) {
    const minRest      = Math.round(pendentes * tempoMed);
    const conclusaoEst = new Date(Date.now() + minRest * 60000);
    previsoes.push({
      icon:'🏁', titulo:'Previsão de conclusão',
      desc:`${pendentes} OCs restantes · ritmo: ${_fmtMin(Math.round(tempoMed))}/OC`,
      val: conclusaoEst.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
      cor: 'var(--blue, #3b82f6)'
    });
  }

  const ultimas3 = entries.slice(0, 3).map(h => _duracaoMin(h)).filter(v => v !== null && v > 0);
  if (ultimas3.length === 3 && tempoMed) {
    const medUlt  = ultimas3.reduce((a,b) => a+b,0) / ultimas3.length;
    const tend    = medUlt - tempoMed;
    if (tend > 10) {
      previsoes.push({ icon:'📈', titulo:'Tendência de piora', desc:`Últimas 3 OCs acima da média — risco de atrasos`, val:'+'+Math.round(tend)+'min', cor:'var(--red)' });
    } else if (tend < -10) {
      previsoes.push({ icon:'📉', titulo:'Tendência de melhora', desc:`Equipe acelerando nas últimas OCs`, val:_fmtMin(Math.round(medUlt)), cor:'var(--grn)' });
    }
  }

  if (!previsoes.length) {
    el.innerHTML = '<div class="an-empty"><span class="an-empty-icon">✅</span><div>Sem riscos operacionais detectados</div></div>';
    return;
  }

  el.innerHTML = previsoes.map(p => `
    <div class="an-prev-card">
      <div class="an-prev-icon">${p.icon}</div>
      <div class="an-prev-body">
        <div class="an-prev-titulo" style="color:${p.cor}">${p.titulo}</div>
        <div class="an-prev-desc">${p.desc}</div>
      </div>
      <div class="an-prev-val" style="color:${p.cor}">${p.val}</div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   GARGALOS (mantido)
════════════════════════════════════════════════════════════ */
function _anGargalos(entries) {
  const el = document.getElementById('an-gargalos');
  if (!el) return;

  if (entries.length < 2) {
    el.innerHTML = '<div class="an-empty"><span class="an-empty-icon">🔍</span><div>Dados insuficientes para detecção</div></div>';
    return;
  }

  const gargalos   = [];
  const duracoes   = entries.map(h => _duracaoMin(h)).filter(v => v !== null && v > 0 && v < 480);
  const medGlobal  = duracoes.length ? duracoes.reduce((a,b) => a+b,0) / duracoes.length : null;

  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim() || '?';
    if (!byDoca[d]) byDoca[d] = { durs:[], count:0 };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur && dur > 0 && dur < 480) byDoca[d].durs.push(dur);
  });

  Object.entries(byDoca).forEach(([doca, v]) => {
    if (v.durs.length < 2 || !medGlobal) return;
    const med = v.durs.reduce((a,b) => a+b,0) / v.durs.length;
    if (med > medGlobal * 1.35) {
      const pct = Math.round(((med - medGlobal) / medGlobal) * 100);
      gargalos.push({ titulo:`Gargalo — Doca ${doca}`, desc:`${_fmtMin(Math.round(med))} médio · ${pct}% acima da média geral · ${v.durs.length} operações`, sug:'Verificar equipe, layout da carga ou processo de conferência nesta doca.' });
    }
  });

  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim() || '?';
    if (!byConf[c]) byConf[c] = [];
    const dur = _duracaoMin(h); if (dur && dur > 0 && dur < 480) byConf[c].push(dur);
  });
  Object.entries(byConf).forEach(([conf, durs]) => {
    if (durs.length < 2 || !medGlobal) return;
    const med = durs.reduce((a,b) => a+b,0) / durs.length;
    if (med > medGlobal * 1.4) {
      const pct = Math.round(((med - medGlobal) / medGlobal) * 100);
      gargalos.push({ titulo:`Gargalo — Conferente ${conf}`, desc:`${_fmtMin(Math.round(med))} médio · ${pct}% acima · ${durs.length} operações`, sug:'Avaliar suporte adicional ou redistribuição de docas.' });
    }
  });

  const byTransp = {};
  entries.forEach(h => {
    const t = h.transportadora?.trim() || '?';
    if (!byTransp[t]) byTransp[t] = [];
    const dur = _duracaoMin(h); if (dur && dur > 0 && dur < 480) byTransp[t].push(dur);
  });
  Object.entries(byTransp).forEach(([transp, durs]) => {
    if (durs.length < 2 || transp === '?' || !medGlobal) return;
    const med = durs.reduce((a,b) => a+b,0) / durs.length;
    if (med > medGlobal * 1.4) {
      const pct = Math.round(((med - medGlobal) / medGlobal) * 100);
      gargalos.push({ titulo:`Gargalo — ${transp}`, desc:`${_fmtMin(Math.round(med))} médio · ${pct}% acima da média geral`, sug:'Verificar organização das cargas desta transportadora na origem.' });
    }
  });

  if (!gargalos.length) {
    el.innerHTML = '<div class="an-empty"><span class="an-empty-icon">✅</span><div>Nenhum gargalo detectado — operação dentro dos padrões</div></div>';
    return;
  }

  el.innerHTML = gargalos.map(g => `
    <div class="an-garg-card">
      <div class="an-garg-titulo">⚠️ ${g.titulo}</div>
      <div class="an-garg-desc">${g.desc}</div>
      <div class="an-garg-sug">💡 ${g.sug}</div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   HELPERS CANVAS
════════════════════════════════════════════════════════════ */
function _anCanvasEmpty(ctx, W, H, msg) {
  ctx.fillStyle = '#4a5568'; ctx.font = '12px Barlow,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(msg, W/2, H/2);
}

function _anDrawBar(ctx, W, H, labels, values, max, defaultColor, colors) {
  const PAD = { top:20, right:10, bottom:34, left:36 };
  const bw  = (W - PAD.left - PAD.right) / Math.max(labels.length, 1);

  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - i/4);
    ctx.strokeStyle = '#252c3d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle = '#4a5568'; ctx.font = '9px Barlow,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max * i/4), PAD.left - 4, y + 3);
  }

  labels.forEach((lbl, i) => {
    const x   = PAD.left + i * bw;
    const bh  = (values[i] / max) * (H - PAD.top - PAD.bottom);
    const by  = PAD.top + (H - PAD.top - PAD.bottom) - bh;
    const cor = (colors && colors[i]) || defaultColor;

    // Gradiente na barra
    const grad = ctx.createLinearGradient(0, by, 0, by + bh);
    grad.addColorStop(0, cor);
    grad.addColorStop(1, cor + '88');

    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x + bw*.1, by, bw*.8, bh, [3, 3, 0, 0]);
    else ctx.rect(x + bw*.1, by, bw*.8, bh);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 9px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(values[i], x + bw/2, Math.max(by - 3, 12));

    ctx.fillStyle = '#64748b'; ctx.font = '9px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
    const short = String(lbl).length > 5 ? String(lbl).slice(0, 5) + '…' : lbl;
    ctx.fillText(short, x + bw/2, H - 4);
  });
}

/* ════════════════════════════════════════════════════════════
   HELPER setEl
════════════════════════════════════════════════════════════ */
function _setAnEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ════════════════════════════════════════════════════════════
   CSS ENTERPRISE INJETADO
════════════════════════════════════════════════════════════ */
(function _injetarCSSAnalytics() {
  if (document.getElementById('css-analytics-enterprise')) return;
  const s = document.createElement('style');
  s.id = 'css-analytics-enterprise';
  s.textContent = `
    /* ── KPI Grid ── */
    #an-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    @media (max-width: 480px) { #an-kpi-grid { grid-template-columns: repeat(2, 1fr); } }

    .an-kpi-card {
      background: var(--bg2, #131929);
      border: 1px solid var(--brd, #1e2d45);
      border-radius: 10px;
      padding: 12px 10px;
      transition: transform .2s, box-shadow .2s;
      cursor: default;
    }
    .an-kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,.3);
    }
    .an-kpi-top     { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .an-kpi-icon    { font-size: 18px; }
    .an-kpi-trend   { font-size: 14px; font-weight: 900; }
    .an-kpi-val     { font-size: 22px; font-weight: 900; font-family: 'Barlow Condensed', sans-serif; line-height: 1; }
    .an-kpi-label   { font-size: 10px; font-weight: 700; color: var(--mut, #4a5568); text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }
    .an-kpi-sub     { font-size: 10px; color: var(--mut, #4a5568); margin-top: 1px; }

    /* ── Equipes ── */
    .an-eq-card { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg2); border: 1px solid var(--brd); border-radius: 10px; margin-bottom: 8px; transition: border-color .2s; }
    .an-eq-card.destaque { border-color: rgba(245,158,11,.3); background: linear-gradient(135deg, var(--bg2) 0%, rgba(245,158,11,.04) 100%); }
    .an-eq-pos      { font-size: 20px; width: 28px; text-align: center; flex-shrink: 0; }
    .an-eq-name     { font-weight: 700; font-size: 13px; }
    .an-eq-sub      { font-size: 11px; color: var(--mut); margin-top: 2px; }
    .an-eq-bar-wrap { height: 3px; background: var(--brd); border-radius: 2px; margin-top: 6px; overflow: hidden; }
    .an-eq-bar      { height: 100%; border-radius: 2px; transition: width .8s; }
    .an-eq-metrics  { text-align: center; flex-shrink: 0; }
    .an-eq-val      { font-size: 20px; font-weight: 900; font-family: 'Barlow Condensed', sans-serif; color: var(--acc); }
    .an-eq-lbl      { font-size: 10px; color: var(--mut); }

    /* ── Comparativo ── */
    .an-comp-grid    { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; }
    .an-comp-col     { text-align: center; }
    .an-comp-header  { font-size: 11px; font-weight: 700; color: var(--mut); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
    .an-comp-val     { font-size: 28px; font-weight: 900; font-family: 'Barlow Condensed', sans-serif; }
    .an-comp-lbl     { font-size: 10px; color: var(--mut); }
    .an-comp-val2    { font-size: 12px; color: var(--mut); margin-top: 4px; }
    .an-comp-divider { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .an-comp-delta   { font-size: 12px; font-weight: 700; font-family: 'Barlow Condensed', sans-serif; }

    /* ── Timestamp ── */
    #an-update-ts { font-size: 10px; color: var(--mut); }

    /* ── Empty ── */
    .an-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; color: var(--mut); font-size: 12px; text-align: center; }
    .an-empty-icon { font-size: 24px; }

    /* ── Prev cards ── */
    .an-prev-card { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg2); border: 1px solid var(--brd); border-radius: 8px; margin-bottom: 8px; }
    .an-prev-icon  { font-size: 22px; flex-shrink: 0; }
    .an-prev-body  { flex: 1; min-width: 0; }
    .an-prev-titulo { font-weight: 700; font-size: 12px; }
    .an-prev-desc   { font-size: 11px; color: var(--mut); margin-top: 2px; }
    .an-prev-val    { font-size: 16px; font-weight: 900; font-family: 'Barlow Condensed', sans-serif; flex-shrink: 0; }

    /* ── Gargalo ── */
    .an-garg-card  { background: var(--bg2); border: 1px solid rgba(239,68,68,.2); border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .an-garg-titulo { font-weight: 700; font-size: 13px; color: var(--red, #ef4444); margin-bottom: 4px; }
    .an-garg-desc   { font-size: 12px; color: var(--txt2, #94a3b8); margin-bottom: 6px; }
    .an-garg-sug    { font-size: 11px; color: var(--mut); }

    /* ── Rank ── */
    .an-rank-item     { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--brd); }
    .an-rank-pos      { font-size: 16px; width: 24px; text-align: center; flex-shrink: 0; }
    .an-rank-info     { flex: 1; min-width: 0; }
    .an-rank-name     { font-weight: 700; font-size: 12px; }
    .an-rank-bar-wrap { height: 3px; background: var(--brd); border-radius: 2px; margin-top: 4px; overflow: hidden; }
    .an-rank-bar      { height: 100%; border-radius: 2px; transition: width .6s; }
    .an-rank-val      { font-size: 13px; font-weight: 700; font-family: 'Barlow Condensed', sans-serif; flex-shrink: 0; }

    /* ── Insights ── */
    .an-insight { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid transparent; }
    .an-insight.good { background: rgba(16,185,129,.08); border-color: rgba(16,185,129,.2); }
    .an-insight.warn { background: rgba(245,158,11,.08); border-color: rgba(245,158,11,.2); }
    .an-insight.crit { background: rgba(239,68,68,.08);  border-color: rgba(239,68,68,.2); }
    .an-insight.info { background: rgba(59,130,246,.08); border-color: rgba(59,130,246,.2); }
    .an-insight-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
    .an-insight-txt  { font-size: 12px; font-weight: 700; }
    .an-insight-sub  { font-size: 11px; color: var(--mut); margin-top: 2px; }
  `;
  document.head.appendChild(s);
})();
