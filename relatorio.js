/**
 * relatorio.js — DockCheck v2
 * Relatório completo: gráficos canvas puros, rankings, tabelas,
 * exportação CSV e envio para WhatsApp (resumo + completo).
 * Sem dependências de bibliotecas externas.
 * Depende de: storage.js, utils.js
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   PALETA DE CORES DOS GRÁFICOS
════════════════════════════════════════════════════════════ */

const CHART_COLORS = [
  '#f59e0b','#10b981','#3b82f6','#ef4444',
  '#8b5cf6','#06b6d4','#f97316','#ec4899',
  '#84cc16','#14b8a6'
];

/* ════════════════════════════════════════════════════════════
   GRÁFICOS — CANVAS PURO (sem libs)
════════════════════════════════════════════════════════════ */

/**
 * Desenha um gráfico de barras em um <canvas>.
 * @param {string} canvasId
 * @param {string[]} labels
 * @param {number[]} values
 * @param {string} color — hex
 */
function _drawBarChart(canvasId, labels, values, color = '#f59e0b') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 300;
  canvas.width  = W;
  canvas.height = parseInt(canvas.getAttribute('height') || 180);
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!values.length) {
    ctx.fillStyle = '#4a5568';
    ctx.font      = '13px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados', W / 2, H / 2);
    return;
  }

  const PAD = { top: 16, right: 10, bottom: 40, left: 38 };
  const max = Math.max(...values) || 1;
  const bw  = (W - PAD.left - PAD.right) / labels.length;

  // Linhas de grade horizontais
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - i / 4);
    ctx.strokeStyle = '#252c3d';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle   = '#4a5568';
    ctx.font        = '10px Barlow, sans-serif';
    ctx.textAlign   = 'right';
    ctx.fillText(Math.round(max * i / 4), PAD.left - 4, y + 3);
  }

  labels.forEach((lbl, i) => {
    const x  = PAD.left + i * bw;
    const bh = (values[i] / max) * (H - PAD.top - PAD.bottom);
    const by = PAD.top + (H - PAD.top - PAD.bottom) - bh;

    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x + bw * 0.1, by, bw * 0.8, bh, [4, 4, 0, 0]);
    else               ctx.rect(x + bw * 0.1, by, bw * 0.8, bh);
    ctx.fill();

    // Valor no topo da barra
    ctx.fillStyle = '#e2e8f0';
    ctx.font      = 'bold 10px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(values[i], x + bw / 2, by - 4);

    // Label abaixo
    ctx.fillStyle = '#64748b';
    ctx.font      = '10px Barlow Condensed, sans-serif';
    const short   = String(lbl).length > 5 ? String(lbl).slice(0, 5) + '…' : lbl;
    ctx.fillText(short, x + bw / 2, H - 4);
  });
}

/**
 * Desenha um gráfico de linha com área preenchida.
 * @param {string} canvasId
 * @param {string[]} labels
 * @param {number[]} values — null para dados ausentes
 * @param {string} color — hex
 */
function _drawLineChart(canvasId, labels, values, color = '#10b981') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 300;
  canvas.width  = W;
  canvas.height = parseInt(canvas.getAttribute('height') || 140);
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const valid = values.filter(v => v !== null);
  if (!valid.length) {
    ctx.fillStyle = '#4a5568';
    ctx.font      = '13px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados de tempo', W / 2, H / 2);
    return;
  }

  const PAD = { top: 20, right: 12, bottom: 40, left: 40 };
  const max = Math.max(...valid) || 1;
  const step = (W - PAD.left - PAD.right) / Math.max(labels.length - 1, 1);

  // Linhas de grade
  for (let i = 0; i <= 3; i++) {
    const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - i / 3);
    ctx.strokeStyle = '#252c3d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle   = '#4a5568';
    ctx.font        = '10px Barlow, sans-serif';
    ctx.textAlign   = 'right';
    ctx.fillText(_fmtMin(Math.round(max * i / 3)), PAD.left - 4, y + 3);
  }

  // Pontos válidos
  const pts = values
    .map((v, i) => ({
      x: PAD.left + i * step,
      y: v !== null ? PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / max) : null
    }))
    .filter(p => p.y !== null);

  if (pts.length > 1) {
    // Área gradiente
    const grad = ctx.createLinearGradient(0, PAD.top, 0, H - PAD.bottom);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, color + '00');
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H - PAD.bottom);
    ctx.lineTo(pts[0].x, H - PAD.bottom);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Linha
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  }

  // Pontos circulares
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  });

  // Labels eixo X
  labels.forEach((lbl, i) => {
    ctx.fillStyle = '#64748b';
    ctx.font      = '10px Barlow Condensed, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(lbl).slice(0, 5), PAD.left + i * step, H - 4);
  });
}

/**
 * Desenha um gráfico de pizza.
 * Atualiza também a legenda textual (#transp-legend).
 * @param {string} canvasId
 * @param {{label:string, value:number, color:string}[]} data
 */
function _drawPieChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) {
    ctx.fillStyle = '#4a5568'; ctx.font = '12px Barlow, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Sem dados', canvas.width / 2, canvas.height / 2);
    return;
  }

  const cx = canvas.width / 2, cy = canvas.height / 2;
  const r  = Math.min(cx, cy) - 8;
  let angle = -Math.PI / 2;

  data.forEach(d => {
    const slice = (d.value / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle   = d.color; ctx.fill();
    ctx.strokeStyle = '#0d1017'; ctx.lineWidth = 2; ctx.stroke();
    angle += slice;
  });

  // Legenda
  const leg = document.getElementById('transp-legend');
  if (leg) {
    leg.innerHTML = data.map(d => `
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:10px;height:10px;border-radius:50%;background:${d.color};flex-shrink:0"></div>
        <span style="color:#94a3b8">${d.label}</span>
        <span style="color:#f59e0b;font-weight:700;margin-left:auto">${d.value}</span>
      </div>
    `).join('');
  }
}

/* ════════════════════════════════════════════════════════════
   RELATÓRIO COMPLETO
════════════════════════════════════════════════════════════ */

/**
 * Ponto de entrada do relatório.
 * Lê filtros, calcula estatísticas e atualiza toda a aba.
 */
function renderRelatorio() {
  const filtroData  = document.getElementById('rel-data').value;
  const filtroTurno = document.getElementById('rel-turno').value;

  let entries = historico.filter(h => h.tipo === 'conferencia');
  if (filtroData)  entries = entries.filter(h => h.data?.slice(0, 10) === filtroData);
  if (filtroTurno) entries = entries.filter(h => _turnoDeHora(h.hora) === filtroTurno);

  // ── Resumo geral ──
  const docasSet = new Set(entries.map(h => h.doca).filter(Boolean));
  const confsSet = new Set(entries.map(h => h.conf).filter(Boolean));
  const duracoes = entries.map(h => _duracaoMin(h)).filter(v => v !== null);
  const tempoMed = duracoes.length
    ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
    : null;
  const totalPed = entries.reduce((s, h) => s + (parseInt(h.pedidos) || 0), 0);
  const totalCli = entries.reduce((s, h) => s + (parseInt(h.clientes) || 0), 0);

  document.getElementById('rel-stat-cargas').textContent   = entries.length;
  document.getElementById('rel-stat-docas').textContent    = docasSet.size;
  document.getElementById('rel-stat-confs').textContent    = confsSet.size;
  document.getElementById('rel-stat-tempo').textContent    = _fmtMin(tempoMed);
  document.getElementById('rel-stat-pedidos').textContent  = totalPed || '—';
  document.getElementById('rel-stat-clientes').textContent = totalCli || '—';

  // Texto de resumo dos filtros ativos
  const nomeTurno = { manha:'Manhã (06h–14h)', tarde:'Tarde (14h–22h)', noite:'Noite (22h–06h)' };
  const partes = [];
  if (filtroData)  partes.push(new Date(filtroData + 'T12:00:00').toLocaleDateString('pt-BR'));
  if (filtroTurno) partes.push(nomeTurno[filtroTurno]);
  document.getElementById('rel-summary').textContent =
    partes.length
      ? partes.join(' · ') + ` — ${entries.length} conferência(s)`
      : `Total: ${entries.length} conferência(s)`;

  // ── Por doca ──
  const byDoca = {};
  entries.forEach(h => {
    const k = h.doca?.trim() || '?';
    if (!byDoca[k]) byDoca[k] = { cargas: 0, durs: [], confs: new Set() };
    byDoca[k].cargas++;
    const d = _duracaoMin(h); if (d) byDoca[k].durs.push(d);
    if (h.conf) byDoca[k].confs.add(h.conf.trim());
  });

  const docaList = Object.entries(byDoca).map(([doca, v]) => {
    const med = v.durs.length ? Math.round(v.durs.reduce((a, b) => a + b, 0) / v.durs.length) : null;
    return {
      doca, cargas: v.cargas, med,
      min:   v.durs.length ? Math.min(...v.durs) : null,
      max:   v.durs.length ? Math.max(...v.durs) : null,
      confs: [...v.confs],
      durs:  v.durs
    };
  });

  const porCargas   = [...docaList].sort((a, b) => b.cargas - a.cargas);
  const comTempo    = docaList.filter(d => d.med !== null);
  const maisRapidas = [...comTempo].sort((a, b) => a.med - b.med).slice(0, 3);
  const maisLentas  = [...comTempo].sort((a, b) => b.med - a.med).slice(0, 3);

  _relPodioDocas('rel-podio-rapidas', maisRapidas, true);
  _relPodioDocas('rel-podio-lentas',  maisLentas,  false);
  _relTop3Tempo('rel-top3-tempo', [...comTempo].sort((a, b) => a.med - b.med).slice(0, 3));
  _relTabelaDocas('rel-tbody-docas', porCargas, comTempo);

  // ── Gráficos de docas ──
  const docasSorted = porCargas.slice(0, 12);
  _drawBarChart('chart-docas', docasSorted.map(d => d.doca), docasSorted.map(d => d.cargas), '#f59e0b');
  _drawLineChart('chart-tempo', comTempo.slice(0, 12).map(d => d.doca), comTempo.slice(0, 12).map(d => d.med), '#10b981');

  // ── Por conferente ──
  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim() || '(sem nome)';
    if (!byConf[c]) byConf[c] = { count: 0, ped: 0, cli: 0 };
    byConf[c].count++;
    byConf[c].ped += parseInt(h.pedidos) || 0;
    byConf[c].cli += parseInt(h.clientes) || 0;
  });
  const confRank = Object.entries(byConf).sort((a, b) => b[1].count - a[1].count);
  _relPodio('rel-podio-conf', confRank.map(([n, v]) => [n, v.count]), 'conferência');
  _relTabelaConf('rel-tbody-conf', confRank);

  // ── Por transportadora ──
  const byTransp = {};
  entries.forEach(h => {
    const t = h.transportadora?.trim() || '(sem nome)';
    if (!byTransp[t]) byTransp[t] = { cargas: 0, durs: [] };
    byTransp[t].cargas++;
    const d = _duracaoMin(h); if (d) byTransp[t].durs.push(d);
  });
  const transpRank = Object.entries(byTransp).sort((a, b) => b[1].cargas - a[1].cargas);
  _relTabelaTransp('rel-tbody-transp', transpRank);
  _drawPieChart('chart-transp', transpRank.slice(0, 8).map(([lbl, v], i) => ({
    label: lbl, value: v.cargas, color: CHART_COLORS[i % CHART_COLORS.length]
  })));

  // ── Por dia ──
  const byDia = {};
  entries.forEach(h => {
    const dia = h.data ? h.data.slice(0, 10) : 'sem data';
    if (!byDia[dia]) byDia[dia] = { count: 0, confs: new Set(), docas: new Set() };
    byDia[dia].count++;
    if (h.conf) byDia[dia].confs.add(h.conf.trim());
    if (h.doca) byDia[dia].docas.add(h.doca.trim());
  });
  const diasRank = Object.entries(byDia).sort((a, b) => b[0].localeCompare(a[0]));
  _relDias('rel-tbody-dias', diasRank);

  const diasOrdenados = [...diasRank].reverse().slice(-14);
  _drawLineChart(
    'chart-dias',
    diasOrdenados.map(([d]) => d.slice(5)),
    diasOrdenados.map(([, v]) => v.count),
    '#3b82f6'
  );
}

function limparFiltros() {
  document.getElementById('rel-data').value  = '';
  document.getElementById('rel-turno').value = '';
  renderRelatorio();
}

/* ════════════════════════════════════════════════════════════
   HELPERS DE RENDER — PÓDIOS E TABELAS
════════════════════════════════════════════════════════════ */

function _relPodioDocas(elId, list, rapida) {
  const el = document.getElementById(elId);
  if (!list.length) { el.innerHTML = '<p class="hint">Sem dados de tempo suficientes neste período.</p>'; return; }
  const medals = ['🥇','🥈','🥉'];
  const bordas = rapida
    ? ['var(--grn)','rgba(16,185,129,.35)','rgba(16,185,129,.15)']
    : ['var(--red)','rgba(239,68,68,.35)','rgba(239,68,68,.15)'];
  const cores = rapida
    ? ['var(--grn)','#6ee7b7','#a7f3d0']
    : ['var(--red)','#fca5a5','#fecaca'];
  el.innerHTML = list.map((d, i) => `
    <div class="podio-card" style="border-color:${bordas[i] || 'var(--bord)'}">
      <div style="font-size:24px;margin-bottom:2px">${medals[i] || ''}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:${cores[i] || 'var(--txt)'}">Doca ${d.doca}</div>
      <div style="font-size:22px;font-weight:800;color:${cores[i] || 'var(--txt)'};margin:2px 0">${_fmtMin(d.med)}</div>
      <div style="font-size:11px;color:var(--mut)">${d.cargas} carga${d.cargas > 1 ? 's' : ''}</div>
    </div>`).join('');
}

function _relTop3Tempo(elId, list) {
  const el = document.getElementById(elId);
  if (!list.length) { el.innerHTML = '<p class="hint">Sem dados de tempo suficientes neste período.</p>'; return; }
  const medals = ['🥇','🥈','🥉'], labels = ['1º lugar','2º lugar','3º lugar'];
  const bordas = ['rgba(245,158,11,.7)','rgba(245,158,11,.35)','rgba(245,158,11,.15)'];
  const cores  = ['var(--acc)','#fbbf24','#fde68a'];
  el.innerHTML = list.map((d, i) => `
    <div class="podio-card" style="border-width:2px;border-color:${bordas[i] || 'var(--bord)'}">
      <div style="font-size:26px;margin-bottom:4px">${medals[i] || ''}</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--mut);text-transform:uppercase;margin-bottom:4px">${labels[i]}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:${cores[i] || 'var(--txt)'}">Doca ${d.doca}</div>
      <div style="font-size:26px;font-weight:800;color:${cores[i] || 'var(--txt)'};margin:4px 0">${_fmtMin(d.med)}</div>
      <div style="font-size:11px;color:var(--mut)">${d.cargas} carga${d.cargas > 1 ? 's' : ''} · T.médio</div>
    </div>`).join('');
}

function _relPodio(elId, rank, label) {
  const el = document.getElementById(elId);
  if (!rank.length) { el.innerHTML = '<p class="hint">Sem dados para este período.</p>'; return; }
  const medals = ['🥇','🥈','🥉'];
  const bordas = ['var(--acc)','rgba(148,163,184,.4)','rgba(205,127,50,.4)'];
  const cores  = ['var(--acc)','#94a3b8','#cd7f32'];
  el.innerHTML = rank.slice(0, 3).map(([nome, cnt], i) => `
    <div class="podio-card" style="border-color:${bordas[i]}">
      <div style="font-size:26px;margin-bottom:4px">${medals[i]}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;color:${cores[i]};word-break:break-word">${nome}</div>
      <div style="font-size:12px;color:var(--mut);margin-top:3px">${cnt} ${label}${cnt > 1 ? 's' : ''}</div>
    </div>`).join('');
}

function _relTabelaDocas(elId, list, comTempo) {
  const tb = document.getElementById(elId);
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--mut);padding:18px">Sem dados.</td></tr>';
    return;
  }
  const rankVel = {};
  if (comTempo?.length) {
    [...comTempo].sort((a, b) => a.med - b.med).forEach((d, i) => { rankVel[d.doca] = i + 1; });
  }
  tb.innerHTML = list.map((d, i) => {
    const rv     = rankVel[d.doca];
    const rvBadge = rv ? `<span class="badge b-ok" style="margin-left:5px">#${rv}⚡</span>` : '';
    const total  = d.durs?.length ? d.durs.reduce((a, b) => a + b, 0) : null;
    return `<tr>
      <td style="text-align:center;font-size:13px;font-weight:700;color:var(--mut)">${i + 1}</td>
      <td><b style="font-family:'Barlow Condensed',sans-serif;font-size:18px;color:var(--acc)">Doca ${d.doca}</b>${rvBadge}</td>
      <td><b style="color:var(--acc)">${d.cargas}</b></td>
      <td style="font-size:12px;color:var(--mut)">${_fmtMin(total)}</td>
      <td><b>${_fmtMin(d.med)}</b></td>
      <td style="color:var(--grn);font-size:12px">${_fmtMin(d.min)}</td>
      <td style="color:var(--red);font-size:12px">${_fmtMin(d.max)}</td>
      <td style="font-size:11px;color:var(--mut)">${d.confs.join(', ') || '—'}</td>
    </tr>`;
  }).join('');
}

function _relTabelaConf(elId, rank) {
  const tb = document.getElementById(elId);
  if (!rank.length) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--mut);padding:18px">Sem dados.</td></tr>';
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  tb.innerHTML = rank.map(([nome, v], i) => `<tr>
    <td style="text-align:center;font-size:${i < 3 ? '16' : '13'}px">${i < 3 ? medals[i] : i + 1}</td>
    <td><b>${nome}</b></td>
    <td><b style="color:var(--acc)">${v.count}</b></td>
    <td style="color:var(--grn)">${v.ped || '—'}</td>
    <td style="color:var(--blue)">${v.cli || '—'}</td>
  </tr>`).join('');
}

function _relTabelaTransp(elId, rank) {
  const tb = document.getElementById(elId);
  if (!rank.length) {
    tb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--mut);padding:18px">Sem dados.</td></tr>';
    return;
  }
  tb.innerHTML = rank.map(([nome, v], i) => {
    const med = v.durs.length
      ? Math.round(v.durs.reduce((a, b) => a + b, 0) / v.durs.length)
      : null;
    return `<tr>
      <td style="text-align:center;font-size:13px;font-weight:700;color:var(--mut)">${i + 1}</td>
      <td><b>${nome}</b></td>
      <td><b style="color:var(--acc)">${v.cargas}</b></td>
      <td style="color:var(--mut)">${_fmtMin(med)}</td>
    </tr>`;
  }).join('');
}

function _relDias(elId, dias) {
  const tb = document.getElementById(elId);
  if (!dias.length) {
    tb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--mut);padding:18px">Sem dados.</td></tr>';
    return;
  }
  tb.innerHTML = dias.map(([dia, v]) => {
    const d = new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR');
    return `<tr>
      <td><b>${d}</b></td>
      <td><b style="color:var(--acc)">${v.count}</b></td>
      <td style="font-size:12px;color:var(--mut)">${[...v.confs].join(', ')}</td>
      <td style="font-size:12px;color:var(--mut)">${[...v.docas].join(', ')}</td>
    </tr>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   EXPORTAR CSV
════════════════════════════════════════════════════════════ */

function exportRelatorio() {
  const filtroData  = document.getElementById('rel-data').value;
  const filtroTurno = document.getElementById('rel-turno').value;
  const nomeTurno   = { manha:'Manhã', tarde:'Tarde', noite:'Noite' };

  let entries = historico.filter(h => h.tipo === 'conferencia');
  if (filtroData)  entries = entries.filter(h => h.data?.slice(0, 10) === filtroData);
  if (filtroTurno) entries = entries.filter(h => _turnoDeHora(h.hora) === filtroTurno);
  if (!entries.length) { toast('Sem dados para exportar.'); return; }

  const linhas = [
    '=== CONFERÊNCIAS ===',
    'Data;Hora;Turno;Doca;OC;Rota;Conferente;Transportadora;Pedidos;Clientes;Duração(min)'
  ];

  entries.forEach(h => {
    const d   = new Date(h.data);
    const dur = _duracaoMin(h);
    linhas.push([
      d.toLocaleDateString('pt-BR'),
      h.hora || d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
      nomeTurno[_turnoDeHora(h.hora)] || '—',
      h.doca || '', h.oc || '', h.rota || '', h.conf || '',
      h.transportadora || '', h.pedidos || '', h.clientes || '',
      dur !== null ? dur : '—'
    ].join(';'));
  });

  const label = filtroData || new Date().toISOString().slice(0, 10);
  _downloadBlob(
    '\uFEFF' + linhas.join('\n'),
    `relatorio_dockcheck_${label}.csv`,
    'text/csv;charset=utf-8'
  );
  toast('Relatório exportado!');
}

/* ════════════════════════════════════════════════════════════
   WHATSAPP — RESUMO E COMPLETO
════════════════════════════════════════════════════════════ */

/**
 * Coleta e calcula todos os dados do relatório com filtros aplicados.
 * Usado por ambas as funções de WhatsApp.
 * @returns {Object}
 */
function _dadosRelatorioWA() {
  const filtroData  = document.getElementById('rel-data').value;
  const filtroTurno = document.getElementById('rel-turno').value;
  const nomeTurno   = { manha:'Manhã (06h–14h)', tarde:'Tarde (14h–22h)', noite:'Noite (22h–06h)' };

  let entries = historico.filter(h => h.tipo === 'conferencia');
  if (filtroData)  entries = entries.filter(h => h.data?.slice(0, 10) === filtroData);
  if (filtroTurno) entries = entries.filter(h => _turnoDeHora(h.hora) === filtroTurno);

  const docasSet = new Set(entries.map(h => h.doca).filter(Boolean));
  const confsSet = new Set(entries.map(h => h.conf).filter(Boolean));
  const duracoes = entries.map(h => _duracaoMin(h)).filter(v => v !== null);
  const tempoMed = duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : null;
  const totalPed = entries.reduce((s, h) => s + (parseInt(h.pedidos) || 0), 0);
  const totalCli = entries.reduce((s, h) => s + (parseInt(h.clientes) || 0), 0);

  const byDoca = {};
  entries.forEach(h => {
    const k = h.doca?.trim() || '?';
    if (!byDoca[k]) byDoca[k] = { cargas: 0, durs: [], confs: new Set() };
    byDoca[k].cargas++;
    const d = _duracaoMin(h); if (d) byDoca[k].durs.push(d);
    if (h.conf) byDoca[k].confs.add(h.conf.trim());
  });
  const docaList = Object.entries(byDoca).map(([doca, v]) => {
    const med = v.durs.length ? Math.round(v.durs.reduce((a, b) => a + b, 0) / v.durs.length) : null;
    return { doca, cargas: v.cargas, med };
  });
  const comTempo   = docaList.filter(d => d.med !== null).sort((a, b) => a.med - b.med);
  const porCargas  = [...docaList].sort((a, b) => b.cargas - a.cargas);

  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim() || '(sem nome)';
    if (!byConf[c]) byConf[c] = { count: 0, ped: 0, cli: 0 };
    byConf[c].count++;
    byConf[c].ped += parseInt(h.pedidos) || 0;
    byConf[c].cli += parseInt(h.clientes) || 0;
  });
  const confRank = Object.entries(byConf).sort((a, b) => b[1].count - a[1].count);

  const byTransp = {};
  entries.forEach(h => {
    const t = h.transportadora?.trim() || '(sem nome)';
    if (!byTransp[t]) byTransp[t] = { cargas: 0, durs: [] };
    byTransp[t].cargas++;
    const d = _duracaoMin(h); if (d) byTransp[t].durs.push(d);
  });
  const transpRank = Object.entries(byTransp).sort((a, b) => b[1].cargas - a[1].cargas);

  const hoje = new Date().toLocaleDateString('pt-BR');
  let periodo = filtroData
    ? new Date(filtroData + 'T12:00:00').toLocaleDateString('pt-BR')
    : hoje;
  if (filtroTurno) periodo += ' · ' + nomeTurno[filtroTurno];

  return {
    entries, periodo, docasSet, confsSet, tempoMed, totalPed, totalCli,
    maisRapida: comTempo[0] || null,
    maisLenta:  comTempo[comTempo.length - 1] || null,
    porCargas, comTempo, confRank, transpRank
  };
}

/**
 * Gera e compartilha o RESUMO RÁPIDO do relatório.
 */
function waRelatorioResumo() {
  const d = _dadosRelatorioWA();
  if (!d.entries.length) { toast('Sem dados para o período selecionado.'); return; }

  const topConf   = d.confRank[0];
  const topTransp = d.transpRank[0];

  let msg = `📊 *RELATÓRIO DOCKCHECK*\n📅 ${d.periodo}\n${'─'.repeat(28)}\n\n`;
  msg += `✅ *Cargas conferidas:* ${d.entries.length}\n`;
  msg += `🏭 *Docas ativas:* ${d.docasSet.size}\n`;
  msg += `👷 *Conferentes:* ${d.confsSet.size}\n`;
  if (d.tempoMed) msg += `⏱ *Tempo médio:* ${_fmtMin(d.tempoMed)}\n`;
  if (d.totalPed) msg += `📦 *Total pedidos:* ${d.totalPed}\n`;
  if (d.totalCli) msg += `👤 *Total clientes:* ${d.totalCli}\n\n`;

  if (d.maisRapida) msg += `⚡ *Mais rápida:* Doca ${d.maisRapida.doca} (${_fmtMin(d.maisRapida.med)})\n`;
  if (d.maisLenta && d.maisLenta.doca !== d.maisRapida?.doca)
    msg += `🐢 *Mais lenta:* Doca ${d.maisLenta.doca} (${_fmtMin(d.maisLenta.med)})\n`;
  if (topConf)   msg += `\n🏆 *Top conferente:* ${topConf[0]} (${topConf[1].count} cargas)\n`;
  if (topTransp) msg += `🚛 *Principal transp.:* ${topTransp[0]} (${topTransp[1].cargas} cargas)\n`;
  msg += `\n_Enviado via DockCheck v2_`;

  _compartilharTexto(msg, 'Resumo copiado!');
}

/**
 * Gera e compartilha o RELATÓRIO COMPLETO.
 */
function waRelatorioCompleto() {
  const d = _dadosRelatorioWA();
  if (!d.entries.length) { toast('Sem dados para o período selecionado.'); return; }

  let msg = `📊 *RELATÓRIO COMPLETO DOCKCHECK*\n📅 ${d.periodo}\n${'═'.repeat(28)}\n\n`;

  msg += `*📈 RESUMO GERAL*\n`;
  msg += `• Cargas conferidas: *${d.entries.length}*\n`;
  msg += `• Docas ativas: *${d.docasSet.size}*\n`;
  msg += `• Conferentes: *${d.confsSet.size}*\n`;
  if (d.tempoMed) msg += `• Tempo médio: *${_fmtMin(d.tempoMed)}*\n`;
  if (d.totalPed) msg += `• Total pedidos: *${d.totalPed}*\n`;
  if (d.totalCli) msg += `• Total clientes: *${d.totalCli}*\n\n`;

  msg += `*🏭 RANKING DOCAS*\n`;
  d.porCargas.forEach((doc, i) => {
    const medal = ['🥇','🥈','🥉'][i] || `${i + 1}.`;
    msg += `${medal} Doca ${doc.doca} — ${doc.cargas} carga${doc.cargas > 1 ? 's' : ''}`;
    if (doc.med) msg += ` · ⏱ ${_fmtMin(doc.med)}`;
    msg += '\n';
  });
  msg += '\n';

  if (d.comTempo.length) {
    msg += `*⚡ MAIS RÁPIDAS*\n`;
    d.comTempo.slice(0, 3).forEach((doc, i) => {
      msg += `${['🥇','🥈','🥉'][i] || (i+1)+'.'} Doca ${doc.doca} — ${_fmtMin(doc.med)}\n`;
    });
    msg += `\n*🐢 MAIS LENTAS*\n`;
    [...d.comTempo].reverse().slice(0, 3).forEach((doc, i) => {
      msg += `${['🥇','🥈','🥉'][i] || (i+1)+'.'} Doca ${doc.doca} — ${_fmtMin(doc.med)}\n`;
    });
    msg += '\n';
  }

  msg += `*👷 CONFERENTES*\n`;
  d.confRank.forEach(([nome, v], i) => {
    const medal = ['🥇','🥈','🥉'][i] || `${i + 1}.`;
    msg += `${medal} ${nome} — ${v.count} conferência${v.count > 1 ? 's' : ''}`;
    if (v.ped) msg += ` · ${v.ped} ped.`;
    msg += '\n';
  });
  msg += '\n';

  msg += `*🚛 TRANSPORTADORAS*\n`;
  d.transpRank.forEach(([nome, v], i) => {
    const med = v.durs.length
      ? Math.round(v.durs.reduce((a, b) => a + b, 0) / v.durs.length)
      : null;
    msg += `${i + 1}. ${nome} — ${v.cargas} carga${v.cargas > 1 ? 's' : ''}`;
    if (med) msg += ` · ⏱ ${_fmtMin(med)}`;
    msg += '\n';
  });

  msg += `\n_Enviado via DockCheck v2_`;
  _compartilharTexto(msg, 'Relatório completo copiado!');
}
