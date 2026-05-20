/**
 * relatorio.js — DockCheck PRO · Fase 15
 * Relatório Executivo Enterprise
 *
 * COMPATIBILIDADE TOTAL com relatorio.js v2:
 *  - Mantém: renderRelatorio(), exportRelatorio(), waRelatorioResumo(), waRelatorioCompleto()
 *  - Mantém: _drawBarChart(), _drawLineChart(), _drawPieChart()
 *  - Mantém: todos os IDs existentes no index.html
 *  - Mantém: CHART_COLORS, _relPodioDocas, _relTabelaDocas, _relTabelaConf, etc.
 *
 * NOVIDADES Fase 15:
 *  - Performance de Docas Enterprise (cards com score, SLA, gauge, eficiência)
 *  - Analytics de Rotas RJ (ranking regional, heatmap, análise estratégica)
 *  - IA Executiva (Anthropic API → insights + conclusão estratégica)
 *  - Gráfico de barras horizontal moderno
 *  - Score operacional geral com gauge animado
 *  - Export Excel via CSV multi-sheet
 *  - CSS enterprise injetado dinamicamente
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   PALETA (mantida)
════════════════════════════════════════════════════════════ */
const CHART_COLORS = [
  '#f59e0b','#10b981','#3b82f6','#ef4444',
  '#8b5cf6','#06b6d4','#f97316','#ec4899',
  '#84cc16','#14b8a6'
];

/* ════════════════════════════════════════════════════════════
   REGIÕES DO RJ — Mapeamento por rota/palavra-chave
════════════════════════════════════════════════════════════ */
const RJ_REGIOES = {
  'Capital':           ['capital','centro','tijuca','ipanema','copacabana','leblon','barra','jacarepaguá','santa cruz','campo grande','bangu','realengo','madureira','méier','ilha do governador','ramos','penha','anchieta','cosme velho','botafogo','flamengo','leme','catete','glória','santa teresa','urca','são cristóvão','praça da bandeira','abolição','cavalcanti','irajá','vigário','cordovil','parada de lucas','sepetiba','guaratiba','pedra de guaratiba'],
  'Baixada Fluminense':['nova iguaçu','duque de caxias','belford roxo','são joão de meriti','nilópolis','mesquita','queimados','japeri','baixada','seropédica','itaguaí','mangaratiba','paracambi'],
  'Niterói/São Gonçalo':['niterói','são gonçalo','maricá','itaboraí','tanguá','rio bonito','silva jardim','araruama','saquarema','iguaba','arraial','búzios','cabo frio','armação'],
  'Região Serrana':    ['petrópolis','teresópolis','nova friburgo','serrana','sumidouro','bom jardim','cantagalo','cordeiro','duas barras','macuco','santa maria madalena','são sebastião','trajano','carmo','sapucaia'],
  'Interior RJ':       ['campos','macaé','rio das ostras','casimiro','bom jesus','italva','cardoso moreira','são fidélis','cambuci','miracema','laje do muriaé','porciúncula','natividade','varre sai','bom jesus do itabapoana','itaperuna','santo antônio de pádua','muriaé','cataguases','resende','volta redonda','barra mansa','angra','paraty','rio claro','pinheiral','piraí','barra do piraí','valença','vassouras','três rios','paraíba do sul','petró'],
  'Costa Verde':       ['angra dos reis','paraty','mangaratiba','costa verde','ilha grande'],
  'Zona Norte RJ':     ['zona norte','méier','tijuca','madureira','penha','irajá','ramos','olaria','bonsucesso','manguinhos','jacarezinho','benfica','são cristóvão','praça da bandeira','lins','engenho'],
  'Zona Oeste RJ':     ['zona oeste','campo grande','santa cruz','guaratiba','pedra','sepetiba','realengo','bangu','magalhães bastos','padre miguel','senador camará','cosmos','inhoaíba','santíssimo','paciência','santa cruz'],
};

function _detectarRegiao(rota) {
  if (!rota) return 'Outras';
  const r = rota.toLowerCase();
  for (const [regiao, palavras] of Object.entries(RJ_REGIOES)) {
    if (palavras.some(p => r.includes(p))) return regiao;
  }
  return 'Outras';
}

/* ════════════════════════════════════════════════════════════
   GRÁFICOS — CANVAS PURO (mantidos + melhorados)
════════════════════════════════════════════════════════════ */

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
    ctx.fillStyle = '#4a5568'; ctx.font = '13px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Sem dados', W/2, H/2); return;
  }

  const PAD = { top:16, right:10, bottom:40, left:38 };
  const max = Math.max(...values) || 1;
  const bw  = (W - PAD.left - PAD.right) / labels.length;

  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - i/4);
    ctx.strokeStyle = '#252c3d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle = '#4a5568'; ctx.font = '10px Barlow,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max * i/4), PAD.left - 4, y + 3);
  }

  labels.forEach((lbl, i) => {
    const x  = PAD.left + i * bw;
    const bh = (values[i] / max) * (H - PAD.top - PAD.bottom);
    const by = PAD.top + (H - PAD.top - PAD.bottom) - bh;

    const grad = ctx.createLinearGradient(0, by, 0, by + bh);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '88');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x + bw*.1, by, bw*.8, bh, [4,4,0,0]);
    else ctx.rect(x + bw*.1, by, bw*.8, bh);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 10px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(values[i], x + bw/2, by - 4);

    ctx.fillStyle = '#64748b'; ctx.font = '10px Barlow Condensed,sans-serif';
    const short = String(lbl).length > 5 ? String(lbl).slice(0,5)+'…' : lbl;
    ctx.fillText(short, x + bw/2, H - 4);
  });
}

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
    ctx.fillStyle = '#4a5568'; ctx.font = '13px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Sem dados de tempo', W/2, H/2); return;
  }

  const PAD  = { top:20, right:12, bottom:40, left:40 };
  const max  = Math.max(...valid) || 1;
  const step = (W - PAD.left - PAD.right) / Math.max(labels.length - 1, 1);

  for (let i = 0; i <= 3; i++) {
    const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - i/3);
    ctx.strokeStyle = '#252c3d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle = '#4a5568'; ctx.font = '10px Barlow,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(_fmtMin(Math.round(max * i/3)), PAD.left - 4, y + 3);
  }

  const pts = values.map((v, i) => ({
    x: PAD.left + i * step,
    y: v !== null ? PAD.top + (H - PAD.top - PAD.bottom) * (1 - v/max) : null
  })).filter(p => p.y !== null);

  if (pts.length > 1) {
    const grad = ctx.createLinearGradient(0, PAD.top, 0, H - PAD.bottom);
    grad.addColorStop(0, color + '44'); grad.addColorStop(1, color + '00');
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, H - PAD.bottom);
    ctx.lineTo(pts[0].x, H - PAD.bottom);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  }

  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
  });

  labels.forEach((lbl, i) => {
    ctx.fillStyle = '#64748b'; ctx.font = '10px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(lbl).slice(0,5), PAD.left + i * step, H - 4);
  });
}

function _drawPieChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) {
    ctx.fillStyle = '#4a5568'; ctx.font = '12px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Sem dados', canvas.width/2, canvas.height/2); return;
  }

  const cx = canvas.width/2, cy = canvas.height/2;
  const r  = Math.min(cx, cy) - 8, ri = r * 0.5;
  let angle = -Math.PI / 2;

  data.forEach(d => {
    const slice = (d.value / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath(); ctx.fillStyle = d.color; ctx.fill();
    ctx.strokeStyle = '#0d1017'; ctx.lineWidth = 2; ctx.stroke();
    angle += slice;
  });

  // Donut hole
  ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI*2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0d1017';
  ctx.fill();

  ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 14px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy+2);
  ctx.fillStyle = '#64748b'; ctx.font = '9px Barlow,sans-serif';
  ctx.fillText('cargas', cx, cy+13);

  const leg = document.getElementById('transp-legend');
  if (leg) {
    leg.innerHTML = data.map((d, i) => `
      <div style="display:flex;align-items:center;gap:6px;padding:3px 0">
        <div style="width:8px;height:8px;border-radius:50%;background:${d.color};flex-shrink:0"></div>
        <span style="color:var(--mut);font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.label}</span>
        <span style="color:var(--acc);font-weight:700;font-size:11px">${d.value}</span>
      </div>
    `).join('');
  }
}

/* ════════════════════════════════════════════════════════════
   PONTO DE ENTRADA (mantido)
════════════════════════════════════════════════════════════ */
function renderRelatorio() {
  const filtroData  = document.getElementById('rel-data')?.value  || '';
  const filtroTurno = document.getElementById('rel-turno')?.value || '';

  let entries = (typeof historico !== 'undefined' ? historico : []).filter(h => h.tipo === 'conferencia');
  if (filtroData)  entries = entries.filter(h => h.data?.slice(0,10) === filtroData);
  if (filtroTurno) entries = entries.filter(h => _turnoDeHora(h.hora) === filtroTurno);

  const docasSet = new Set(entries.map(h => h.doca).filter(Boolean));
  const confsSet = new Set(entries.map(h => h.conf).filter(Boolean));
  const duracoes = entries.map(h => _duracaoMin(h)).filter(v => v !== null);
  const tempoMed = duracoes.length ? Math.round(duracoes.reduce((a,b) => a+b,0) / duracoes.length) : null;
  const totalPed = entries.reduce((s, h) => s + (parseInt(h.pedidos) || 0), 0);
  const totalCli = entries.reduce((s, h) => s + (parseInt(h.clientes) || 0), 0);

  // IDs básicos mantidos
  const _s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  _s('rel-stat-cargas',   entries.length);
  _s('rel-stat-docas',    docasSet.size);
  _s('rel-stat-confs',    confsSet.size);
  _s('rel-stat-tempo',    _fmtMin(tempoMed));
  _s('rel-stat-pedidos',  totalPed || '—');
  _s('rel-stat-clientes', totalCli || '—');

  const nomeTurno = { manha:'Manhã (06h–14h)', tarde:'Tarde (14h–22h)', noite:'Noite (22h–06h)' };
  const partes = [];
  if (filtroData)  partes.push(new Date(filtroData + 'T12:00:00').toLocaleDateString('pt-BR'));
  if (filtroTurno) partes.push(nomeTurno[filtroTurno]);
  _s('rel-summary', partes.length
    ? partes.join(' · ') + ` — ${entries.length} conferência(s)`
    : `Total: ${entries.length} conferência(s)`);

  // ── Por doca ──
  const byDoca = {};
  entries.forEach(h => {
    const k = h.doca?.trim() || '?';
    if (!byDoca[k]) byDoca[k] = { cargas:0, durs:[], confs:new Set(), peds:0, clis:0 };
    byDoca[k].cargas++;
    byDoca[k].peds += parseInt(h.pedidos) || 0;
    byDoca[k].clis += parseInt(h.clientes) || 0;
    const d = _duracaoMin(h); if (d && d > 0 && d < 480) byDoca[k].durs.push(d);
    if (h.conf) byDoca[k].confs.add(h.conf.trim());
  });

  const docaList = Object.entries(byDoca).map(([doca, v]) => {
    const med    = v.durs.length ? Math.round(v.durs.reduce((a,b) => a+b,0) / v.durs.length) : null;
    const emAtr  = v.durs.filter(d => d > 90).length;
    const sla    = v.durs.length ? Math.round((1 - emAtr / v.durs.length) * 100) : 100;
    const efic   = v.cargas > 0 ? Math.min(100, Math.round((v.durs.length / v.cargas) * 100)) : 0;
    const score  = Math.round(sla * 0.5 + efic * 0.3 + Math.min(100, v.cargas * 8) * 0.2);
    return {
      doca, cargas: v.cargas, med, peds: v.peds, clis: v.clis,
      min:   v.durs.length ? Math.min(...v.durs) : null,
      max:   v.durs.length ? Math.max(...v.durs) : null,
      confs: [...v.confs], durs: v.durs, emAtr, sla, efic, score
    };
  });

  const porCargas   = [...docaList].sort((a,b) => b.cargas - a.cargas);
  const comTempo    = docaList.filter(d => d.med !== null);
  const maisRapidas = [...comTempo].sort((a,b) => a.med - b.med).slice(0, 3);
  const maisLentas  = [...comTempo].sort((a,b) => b.med - a.med).slice(0, 3);

  // IDs mantidos
  _relPodioDocas('rel-podio-rapidas', maisRapidas, true);
  _relPodioDocas('rel-podio-lentas',  maisLentas,  false);
  _relTop3Tempo('rel-top3-tempo', [...comTempo].sort((a,b) => a.med - b.med).slice(0, 3));
  _relTabelaDocas('rel-tbody-docas', porCargas, comTempo);

  _drawBarChart('chart-docas', porCargas.slice(0,12).map(d => d.doca), porCargas.slice(0,12).map(d => d.cargas), '#f59e0b');
  _drawLineChart('chart-tempo', comTempo.slice(0,12).map(d => d.doca), comTempo.slice(0,12).map(d => d.med), '#10b981');

  // ── Performance enterprise das docas (NOVO) ──
  _relDocasEnterprise(porCargas);

  // ── Por conferente (mantido) ──
  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim() || '(sem nome)';
    if (!byConf[c]) byConf[c] = { count:0, ped:0, cli:0 };
    byConf[c].count++;
    byConf[c].ped += parseInt(h.pedidos) || 0;
    byConf[c].cli += parseInt(h.clientes) || 0;
  });
  const confRank = Object.entries(byConf).sort((a,b) => b[1].count - a[1].count);
  _relPodio('rel-podio-conf', confRank.map(([n,v]) => [n, v.count]), 'conferência');
  _relTabelaConf('rel-tbody-conf', confRank);

  // ── Por auxiliar (NOVO Fase 15) ──
  const byAux = {};
  entries.forEach(h => {
    [h.aux1, h.aux2].forEach(aux => {
      if (!aux?.trim()) return;
      const a = aux.trim();
      if (!byAux[a]) byAux[a] = { carros:0, docas:new Set(), confs:new Set(), peds:0, clis:0 };
      byAux[a].carros++;
      if (h.doca) byAux[a].docas.add(h.doca.trim());
      if (h.conf) byAux[a].confs.add(h.conf.trim());
      byAux[a].peds += parseInt(h.pedidos) || 0;
      byAux[a].clis += parseInt(h.clientes) || 0;
    });
  });
  _relAuxiliares('rel-auxiliares', byAux);

  // ── Por transportadora (mantido) ──
  const byTransp = {};
  entries.forEach(h => {
    const t = h.transportadora?.trim() || '(sem nome)';
    if (!byTransp[t]) byTransp[t] = { cargas:0, durs:[] };
    byTransp[t].cargas++;
    const d = _duracaoMin(h); if (d) byTransp[t].durs.push(d);
  });
  const transpRank = Object.entries(byTransp).sort((a,b) => b[1].cargas - a[1].cargas);
  _relTabelaTransp('rel-tbody-transp', transpRank);
  _drawPieChart('chart-transp', transpRank.slice(0,8).map(([lbl,v], i) => ({
    label: lbl, value: v.cargas, color: CHART_COLORS[i % CHART_COLORS.length]
  })));

  // ── Por dia (mantido) ──
  const byDia = {};
  entries.forEach(h => {
    const dia = h.data ? h.data.slice(0,10) : 'sem data';
    if (!byDia[dia]) byDia[dia] = { count:0, confs:new Set(), docas:new Set() };
    byDia[dia].count++;
    if (h.conf) byDia[dia].confs.add(h.conf.trim());
    if (h.doca) byDia[dia].docas.add(h.doca.trim());
  });
  const diasRank = Object.entries(byDia).sort((a,b) => b[0].localeCompare(a[0]));
  _relDias('rel-tbody-dias', diasRank);
  const diasOrd = [...diasRank].reverse().slice(-14);
  _drawLineChart('chart-dias', diasOrd.map(([d]) => d.slice(5)), diasOrd.map(([,v]) => v.count), '#3b82f6');

  // ── Analytics de Rotas RJ (NOVO) ──
  _relRotasRJ(entries);

  // ── Score geral (NOVO) ──
  _relScoreGeral(entries, tempoMed);
}

function limparFiltros() {
  const rd = document.getElementById('rel-data');
  const rt = document.getElementById('rel-turno');
  if (rd) rd.value = '';
  if (rt) rt.value = '';
  renderRelatorio();
}

/* ════════════════════════════════════════════════════════════
   PERFORMANCE DE DOCAS ENTERPRISE (NOVO)
════════════════════════════════════════════════════════════ */
function _relDocasEnterprise(docaList) {
  const el = document.getElementById('rel-docas-enterprise');
  if (!el) return;

  if (!docaList.length) {
    el.innerHTML = '<div class="rel-empty">Sem dados de docas neste período</div>';
    return;
  }

  const maxCargas = Math.max(...docaList.map(d => d.cargas), 1);
  const medals    = ['🥇','🥈','🥉'];

  el.innerHTML = docaList.slice(0, 12).map((d, i) => {
    const scoreCor = d.score >= 80 ? '#10b981' : d.score >= 60 ? '#f59e0b' : '#ef4444';
    const slaCor   = d.sla  >= 85 ? '#10b981' : d.sla  >= 70 ? '#f59e0b' : '#ef4444';
    const tempoCor = d.med && d.med <= 60 ? '#10b981' : d.med && d.med <= 90 ? '#f59e0b' : '#ef4444';
    const barPct   = Math.round((d.cargas / maxCargas) * 100);

    return `
      <div class="rel-doca-card${i < 3 ? ' destaque' : ''}">
        <div class="rel-doca-header">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:${i < 3 ? '20' : '14'}px">${medals[i] || i+1}</span>
            <div>
              <div class="rel-doca-nome">Doca ${d.doca}</div>
              <div class="rel-doca-confs">${d.confs.join(', ') || '—'}</div>
            </div>
          </div>
          <div class="rel-doca-score" style="color:${scoreCor}">
            <div style="font-size:22px;font-weight:900;font-family:'Barlow Condensed',sans-serif;line-height:1">${d.score}</div>
            <div style="font-size:9px;color:var(--mut)">SCORE</div>
          </div>
        </div>

        <!-- Barra de volume -->
        <div style="margin:8px 0">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--mut);margin-bottom:3px">
            <span>Volume</span><span style="color:var(--acc);font-weight:700">${d.cargas} carga${d.cargas !== 1 ? 's' : ''}</span>
          </div>
          <div style="height:5px;background:var(--brd);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${barPct}%;background:var(--acc);border-radius:3px;transition:width .8s"></div>
          </div>
        </div>

        <!-- KPIs da doca -->
        <div class="rel-doca-kpis">
          <div class="rel-doca-kpi">
            <div style="color:${tempoCor};font-weight:900;font-size:15px;font-family:'Barlow Condensed',sans-serif">${d.med ? _fmtMin(d.med) : '—'}</div>
            <div style="font-size:9px;color:var(--mut)">T. Médio</div>
          </div>
          <div class="rel-doca-kpi">
            <div style="color:${slaCor};font-weight:900;font-size:15px;font-family:'Barlow Condensed',sans-serif">${d.sla}%</div>
            <div style="font-size:9px;color:var(--mut)">SLA</div>
          </div>
          <div class="rel-doca-kpi">
            <div style="color:#3b82f6;font-weight:900;font-size:15px;font-family:'Barlow Condensed',sans-serif">${d.efic}%</div>
            <div style="font-size:9px;color:var(--mut)">Efic.</div>
          </div>
          <div class="rel-doca-kpi">
            <div style="color:var(--mut);font-weight:900;font-size:15px;font-family:'Barlow Condensed',sans-serif">${d.emAtr}</div>
            <div style="font-size:9px;color:var(--mut)">Atrasos</div>
          </div>
        </div>

        <!-- Barra SLA -->
        <div style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--mut);margin-bottom:3px">
            <span>SLA</span><span style="color:${slaCor};font-weight:700">${d.sla}%</span>
          </div>
          <div style="height:4px;background:var(--brd);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${d.sla}%;background:${slaCor};border-radius:2px;transition:width .8s"></div>
          </div>
        </div>

        ${d.min && d.max ? `
        <div style="display:flex;gap:8px;margin-top:8px;font-size:10px">
          <span style="color:var(--grn)">↓ ${_fmtMin(d.min)}</span>
          <span style="color:var(--mut)">min/max</span>
          <span style="color:var(--red)">↑ ${_fmtMin(d.max)}</span>
          ${d.peds ? `<span style="color:var(--mut);margin-left:auto">${d.peds} ped.</span>` : ''}
        </div>` : ''}
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   ANALYTICS DE ROTAS RJ (NOVO)
════════════════════════════════════════════════════════════ */
function _relRotasRJ(entries) {
  const el = document.getElementById('rel-rotas-rj');
  if (!el) return;

  const byRegiao = {};
  entries.forEach(h => {
    const reg = _detectarRegiao(h.rota || h.transportadora || '');
    if (!byRegiao[reg]) byRegiao[reg] = { count:0, peds:0, clis:0, rotas:new Set(), durs:[] };
    byRegiao[reg].count++;
    byRegiao[reg].peds += parseInt(h.pedidos) || 0;
    byRegiao[reg].clis += parseInt(h.clientes) || 0;
    if (h.rota) byRegiao[reg].rotas.add(h.rota.trim());
    const d = _duracaoMin(h); if (d && d > 0 && d < 480) byRegiao[reg].durs.push(d);
  });

  const regioes = Object.entries(byRegiao)
    .filter(([,v]) => v.count > 0)
    .map(([reg, v]) => ({
      reg, count: v.count, peds: v.peds, clis: v.clis,
      rotas: [...v.rotas].length,
      med:   v.durs.length ? Math.round(v.durs.reduce((a,b) => a+b,0) / v.durs.length) : null,
    }))
    .sort((a,b) => b.count - a.count);

  if (!regioes.length) {
    el.innerHTML = '<div class="rel-empty">Sem dados de rotas neste período. Preencha o campo "Rota" nas conferências.</div>';
    return;
  }

  const maxCount = regioes[0]?.count || 1;
  const medals   = ['🥇','🥈','🥉'];
  const coresMap = {
    'Capital':             '#f59e0b',
    'Baixada Fluminense':  '#10b981',
    'Niterói/São Gonçalo': '#3b82f6',
    'Região Serrana':      '#8b5cf6',
    'Interior RJ':         '#f97316',
    'Costa Verde':         '#06b6d4',
    'Zona Norte RJ':       '#ec4899',
    'Zona Oeste RJ':       '#84cc16',
    'Outras':              '#64748b',
  };

  el.innerHTML = regioes.map((r, i) => {
    const cor    = coresMap[r.reg] || CHART_COLORS[i % CHART_COLORS.length];
    const barPct = Math.round((r.count / maxCount) * 100);

    return `
      <div class="rel-rota-card">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:${i < 3 ? '18' : '13'}px">${medals[i] || (i+1)}</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px;color:${cor}">${r.reg}</div>
            <div style="font-size:10px;color:var(--mut)">${r.rotas} rota${r.rotas !== 1 ? 's' : ''} distintas</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:900;font-family:'Barlow Condensed',sans-serif;color:${cor}">${r.count}</div>
            <div style="font-size:9px;color:var(--mut)">cargas</div>
          </div>
        </div>

        <div style="height:5px;background:var(--brd);border-radius:3px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${barPct}%;background:${cor};border-radius:3px;transition:width .8s"></div>
        </div>

        <div style="display:flex;gap:12px;font-size:11px">
          ${r.peds ? `<span>📦 ${r.peds} pedidos</span>` : ''}
          ${r.clis ? `<span>👤 ${r.clis} clientes</span>` : ''}
          ${r.med  ? `<span>⏱ ${_fmtMin(r.med)} médio</span>` : ''}
          <span style="margin-left:auto;color:${cor};font-weight:700">${Math.round((r.count/entries.length)*100)}%</span>
        </div>
      </div>
    `;
  }).join('');

  // Heatmap canvas das regiões
  _relHeatmapRegioes('rel-heatmap-regioes', regioes, coresMap);
}

function _relHeatmapRegioes(canvasId, regioes, coresMap) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !regioes.length) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 320;
  canvas.width = W; canvas.height = 100;
  const H = 100;
  ctx.clearRect(0, 0, W, H);

  const total  = regioes.reduce((s, r) => s + r.count, 0);
  const PAD    = { top:12, right:8, bottom:30, left:8 };
  const areaW  = W - PAD.left - PAD.right;
  let x = PAD.left;

  regioes.forEach((r, i) => {
    const w   = Math.round((r.count / total) * areaW);
    const cor = coresMap[r.reg] || CHART_COLORS[i % CHART_COLORS.length];
    const intens = r.count / regioes[0].count;

    ctx.fillStyle = cor + Math.round(intens * 255).toString(16).padStart(2,'0');
    ctx.fillRect(x + 1, PAD.top, w - 2, H - PAD.top - PAD.bottom);

    if (w > 28) {
      ctx.fillStyle   = '#fff'; ctx.font = 'bold 9px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(r.count, x + w/2, PAD.top + (H - PAD.top - PAD.bottom)/2 + 3);
    }

    ctx.fillStyle   = '#64748b'; ctx.font = '8px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(r.reg.split('/')[0].split(' ')[0], x + w/2, H - 4);
    x += w;
  });
}

/* ════════════════════════════════════════════════════════════
   SCORE GERAL COM GAUGE (NOVO)
════════════════════════════════════════════════════════════ */
function _relScoreGeral(entries, tempoMed) {
  const canvas = document.getElementById('rel-score-gauge');
  if (!canvas) return;

  const emAtr  = entries.filter(h => (_duracaoMin(h) || 0) > 90).length;
  const sla    = entries.length ? Math.round((1 - emAtr / entries.length) * 100) : 100;
  const totalOCR = (typeof ocrRows !== 'undefined') ? ocrRows.length : 0;
  const feitas = new Set(entries.map(h => h.oc?.trim()).filter(Boolean)).size;
  const efic   = totalOCR ? Math.min(100, Math.round((feitas/totalOCR)*100)) : (entries.length ? 100 : 0);
  const score  = Math.round(sla * 0.4 + efic * 0.35 + Math.min(100, entries.length * 5) * 0.25);

  const ctx    = canvas.getContext('2d');
  const W = canvas.offsetWidth || 180; const H = 100;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  const cx = W/2, cy = H - 16, r = Math.min(W/2, H) - 12;
  const ang = (score / 100) * Math.PI;

  // Fundo
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.strokeStyle = '#1e2533'; ctx.lineWidth = 12; ctx.stroke();

  // Preenchimento
  const cor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0, '#ef444488'); grad.addColorStop(0.5, '#f59e0b88'); grad.addColorStop(1, '#10b98188');
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + ang); ctx.strokeStyle = cor; ctx.lineWidth = 12; ctx.stroke();

  // Agulha
  const nx = cx + Math.cos(Math.PI + ang) * (r - 8);
  const ny = cy + Math.sin(Math.PI + ang) * (r - 8);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();

  // Score
  ctx.fillStyle = cor; ctx.font = 'bold 22px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(score, cx, cy - 12);
  ctx.fillStyle = '#64748b'; ctx.font = '9px Barlow,sans-serif';
  ctx.fillText('SCORE OPERACIONAL', cx, cy - 1);

  // Atualiza labels se existirem
  const _s = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  _s('rel-score-val',  score);
  _s('rel-score-sla',  sla + '%');
  _s('rel-score-efic', efic + '%');
}

/* ════════════════════════════════════════════════════════════
   IA EXECUTIVA (NOVO — Anthropic API)
════════════════════════════════════════════════════════════ */
async function relGerarIAExecutiva() {
  const apiKey = (typeof storage !== 'undefined') ? storage.get(K_KEY, '') : '';
  if (!apiKey) { if (typeof toast === 'function') toast('Configure a API Key em ⚙️ Config!'); return; }

  const filtroData  = document.getElementById('rel-data')?.value  || '';
  const filtroTurno = document.getElementById('rel-turno')?.value || '';
  let entries = (typeof historico !== 'undefined' ? historico : []).filter(h => h.tipo === 'conferencia');
  if (filtroData)  entries = entries.filter(h => h.data?.slice(0,10) === filtroData);
  if (filtroTurno) entries = entries.filter(h => _turnoDeHora(h.hora) === filtroTurno);

  if (entries.length < 3) { if (typeof toast === 'function') toast('Registre pelo menos 3 conferências para análise da IA.'); return; }

  const el = document.getElementById('rel-ia-executiva');
  if (el) el.innerHTML = '<div class="rel-ia-loading"><div class="spin" style="display:inline-block;width:18px;height:18px;border:2px solid var(--acc);border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></div> IA Executiva analisando operação...</div>';

  // Prepara contexto
  const duracoes  = entries.map(h => _duracaoMin(h)).filter(v => v !== null && v > 0 && v < 480);
  const tempoMed  = duracoes.length ? Math.round(duracoes.reduce((a,b) => a+b,0) / duracoes.length) : null;
  const emAtr     = entries.filter(h => (_duracaoMin(h) || 0) > 90).length;
  const sla       = entries.length ? Math.round((1 - emAtr / entries.length) * 100) : 100;

  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim() || '?';
    if (!byDoca[d]) byDoca[d] = { count:0, durs:[] };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur && dur > 0 && dur < 480) byDoca[d].durs.push(dur);
  });
  const topDoca = Object.entries(byDoca).sort((a,b) => b[1].count - a[1].count)[0];

  const byConf = {};
  entries.forEach(h => { const c = h.conf?.trim() || '?'; byConf[c] = (byConf[c] || 0) + 1; });
  const topConf = Object.entries(byConf).sort((a,b) => b[1]-a[1])[0];

  const byTransp = {};
  entries.forEach(h => { const t = h.transportadora?.trim() || '?'; byTransp[t] = (byTransp[t] || 0) + 1; });
  const topTransp = Object.entries(byTransp).sort((a,b) => b[1]-a[1])[0];

  const byRegiao = {};
  entries.forEach(h => {
    const r = _detectarRegiao(h.rota || '');
    byRegiao[r] = (byRegiao[r] || 0) + 1;
  });
  const topRegiao = Object.entries(byRegiao).sort((a,b) => b[1]-a[1])[0];

  const prompt = `Você é um analista executivo de BI logístico especialista em centros de distribuição brasileiros do Rio de Janeiro.
Analise os dados operacionais e gere um relatório executivo estratégico em português brasileiro.

DADOS DA OPERAÇÃO:
- Total de conferências: ${entries.length}
- SLA operacional: ${sla}%
- Tempo médio por OC: ${tempoMed ? tempoMed + 'min' : 'N/A'}
- Operações em atraso: ${emAtr}
- Doca com maior volume: ${topDoca ? `Doca ${topDoca[0]} (${topDoca[1].count} cargas)` : 'N/A'}
- Conferente destaque: ${topConf ? `${topConf[0]} (${topConf[1]} conf.)` : 'N/A'}
- Transportadora principal: ${topTransp ? `${topTransp[0]} (${topTransp[1]} cargas)` : 'N/A'}
- Região RJ mais ativa: ${topRegiao ? `${topRegiao[0]} (${topRegiao[1]} cargas)` : 'N/A'}

Retorne SOMENTE JSON válido sem markdown:
{
  "insights": [
    {"tipo":"destaque|alerta|tendencia|recomendacao","texto":"frase objetiva e profissional","impacto":"alto|medio|baixo"},
    ...
  ],
  "conclusao_executiva": "parágrafo executivo de 2-3 linhas para a diretoria",
  "nivel_operacional": "excelente|bom|regular|critico",
  "score_narrativa": "frase curta sobre a saúde operacional"
}

Gere 4 a 6 insights específicos e relevantes. Use nomes reais dos dados. Seja direto e executivo.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role:'user', content: prompt }],
      }),
    });

    const data   = await res.json();
    if (data.error) throw new Error(data.error.message);
    const txt    = data.content.find(b => b.type === 'text')?.text || '';
    const parsed = JSON.parse(txt.replace(/```json|```/g,'').trim());
    _relRenderIAExecutiva(parsed);
  } catch (e) {
    if (el) el.innerHTML = `<div class="rel-empty">❌ Erro: ${e.message}</div>`;
  }
}

function _relRenderIAExecutiva(parsed) {
  const el = document.getElementById('rel-ia-executiva');
  if (!el) return;

  const icones = { destaque:'⚡', alerta:'🚨', tendencia:'📈', recomendacao:'💡' };
  const cores  = { destaque:'#10b981', alerta:'#ef4444', tendencia:'#3b82f6', recomendacao:'#f59e0b' };
  const nivelCor = { excelente:'#10b981', bom:'#f59e0b', regular:'#f97316', critico:'#ef4444' };

  const cor = nivelCor[parsed.nivel_operacional] || '#f59e0b';

  el.innerHTML = `
    <div class="rel-ia-header">
      <div class="rel-ia-pulse"></div>
      <div>
        <div style="font-weight:800;font-size:13px">IA EXECUTIVA ONLINE</div>
        <div style="font-size:11px;color:${cor};font-weight:700">${parsed.nivel_operacional?.toUpperCase()} · ${parsed.score_narrativa}</div>
      </div>
    </div>

    <div style="margin:12px 0;padding:12px;background:var(--bg);border-left:3px solid ${cor};border-radius:0 8px 8px 0;font-size:13px;line-height:1.5;color:var(--txt2)">
      ${parsed.conclusao_executiva}
    </div>

    ${(parsed.insights || []).map(ins => `
      <div class="rel-ia-insight" style="border-left:3px solid ${cores[ins.tipo] || '#f59e0b'}">
        <span style="font-size:16px">${icones[ins.tipo] || '📊'}</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${ins.texto}</div>
        </div>
        <span style="font-size:10px;font-weight:700;color:${cores[ins.tipo]};padding:2px 6px;border:1px solid currentColor;border-radius:10px;white-space:nowrap">${ins.impacto?.toUpperCase()}</span>
      </div>
    `).join('')}
  `;
}

/* ════════════════════════════════════════════════════════════
   HELPERS DE RENDER — mantidos
════════════════════════════════════════════════════════════ */

function _relPodioDocas(elId, list, rapida) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!list.length) { el.innerHTML = '<p class="hint">Sem dados de tempo suficientes neste período.</p>'; return; }
  const medals = ['🥇','🥈','🥉'];
  const bordas = rapida
    ? ['var(--grn)','rgba(16,185,129,.35)','rgba(16,185,129,.15)']
    : ['var(--red)', 'rgba(239,68,68,.35)', 'rgba(239,68,68,.15)'];
  const cores  = rapida
    ? ['var(--grn)','#6ee7b7','#a7f3d0']
    : ['var(--red)', '#fca5a5', '#fecaca'];
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
  if (!el) return;
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
  if (!el) return;
  if (!rank.length) { el.innerHTML = '<p class="hint">Sem dados para este período.</p>'; return; }
  const medals = ['🥇','🥈','🥉'];
  const bordas = ['var(--acc)','rgba(148,163,184,.4)','rgba(205,127,50,.4)'];
  const cores  = ['var(--acc)','#94a3b8','#cd7f32'];
  el.innerHTML = rank.slice(0,3).map(([nome,cnt], i) => `
    <div class="podio-card" style="border-color:${bordas[i]}">
      <div style="font-size:26px;margin-bottom:4px">${medals[i]}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;color:${cores[i]};word-break:break-word">${nome}</div>
      <div style="font-size:12px;color:var(--mut);margin-top:3px">${cnt} ${label}${cnt > 1 ? 's' : ''}</div>
    </div>`).join('');
}

function _relTabelaDocas(elId, list, comTempo) {
  const tb = document.getElementById(elId);
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--mut);padding:18px">Sem dados.</td></tr>';
    return;
  }
  const rankVel = {};
  if (comTempo?.length) {
    [...comTempo].sort((a,b) => a.med - b.med).forEach((d,i) => { rankVel[d.doca] = i+1; });
  }
  tb.innerHTML = list.map((d, i) => {
    const rv     = rankVel[d.doca];
    const rvBadge = rv ? `<span class="badge b-ok" style="margin-left:5px">#${rv}⚡</span>` : '';
    const total  = d.durs?.length ? d.durs.reduce((a,b) => a+b,0) : null;
    return `<tr>
      <td style="text-align:center;font-size:13px;font-weight:700;color:var(--mut)">${i+1}</td>
      <td><b style="font-family:'Barlow Condensed',sans-serif;font-size:18px;color:var(--acc)">Doca ${d.doca}</b>${rvBadge}</td>
      <td><b style="color:var(--acc)">${d.cargas}</b></td>
      <td style="font-size:12px;color:var(--mut)">${_fmtMin(total)}</td>
      <td><b>${_fmtMin(d.med)}</b></td>
      <td style="color:var(--grn);font-size:12px">${_fmtMin(d.min)}</td>
      <td style="color:var(--red);font-size:12px">${_fmtMin(d.max)}</td>
      <td style="font-size:11px;color:var(--mut)">${d.confs?.join(', ') || '—'}</td>
    </tr>`;
  }).join('');
}

function _relTabelaConf(elId, rank) {
  const tb = document.getElementById(elId);
  if (!tb) return;
  if (!rank.length) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--mut);padding:18px">Sem dados.</td></tr>';
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  tb.innerHTML = rank.map(([nome,v], i) => `<tr>
    <td style="text-align:center;font-size:${i<3?'16':'13'}px">${i<3?medals[i]:i+1}</td>
    <td><b>${nome}</b></td>
    <td><b style="color:var(--acc)">${v.count}</b></td>
    <td style="color:var(--grn)">${v.ped || '—'}</td>
    <td style="color:var(--blue)">${v.cli || '—'}</td>
  </tr>`).join('');
}

function _relTabelaTransp(elId, rank) {
  const tb = document.getElementById(elId);
  if (!tb) return;
  if (!rank.length) {
    tb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--mut);padding:18px">Sem dados.</td></tr>';
    return;
  }
  tb.innerHTML = rank.map(([nome,v], i) => {
    const med = v.durs.length ? Math.round(v.durs.reduce((a,b) => a+b,0) / v.durs.length) : null;
    return `<tr>
      <td style="text-align:center;font-size:13px;font-weight:700;color:var(--mut)">${i+1}</td>
      <td><b>${nome}</b></td>
      <td><b style="color:var(--acc)">${v.cargas}</b></td>
      <td style="color:var(--mut)">${_fmtMin(med)}</td>
    </tr>`;
  }).join('');
}

function _relDias(elId, dias) {
  const tb = document.getElementById(elId);
  if (!tb) return;
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
   PERFORMANCE DOS AUXILIARES (NOVO Fase 15)
════════════════════════════════════════════════════════════ */
function _relAuxiliares(elId, byAux) {
  const el = document.getElementById(elId);
  if (!el) return;

  const rank = Object.entries(byAux)
    .map(([nome, v]) => ({
      nome,
      carros:  v.carros,
      docas:   [...v.docas].join(', '),
      confs:   [...v.confs].join(', '),
      peds:    v.peds,
      clis:    v.clis,
    }))
    .sort((a, b) => b.carros - a.carros);

  if (!rank.length) {
    el.innerHTML = '<div class="rel-empty">Sem dados de auxiliares neste período.<br><small>Os auxiliares são registrados via cadastro de equipes.</small></div>';
    return;
  }

  const medals  = ['🥇','🥈','🥉'];
  const maxCar  = rank[0]?.carros || 1;
  const medGeral = rank.reduce((s, r) => s + r.carros, 0) / rank.length;

  el.innerHTML = rank.map((r, i) => {
    const barPct  = Math.round((r.carros / maxCar) * 100);
    const acimaMed = r.carros > medGeral;
    const cor     = i === 0 ? 'var(--acc)' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--mut)';
    const pct     = medGeral ? Math.round(((r.carros - medGeral) / medGeral) * 100) : 0;

    return `
      <div class="rel-aux-card">
        <div class="rel-aux-header">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:${i < 3 ? '20' : '14'}px">${medals[i] || (i+1)}</span>
            <div>
              <div class="rel-aux-nome" style="color:${cor}">${r.nome}</div>
              <div class="rel-aux-sub">Com: ${r.confs || '—'}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:26px;font-weight:900;font-family:'Barlow Condensed',sans-serif;color:${cor};line-height:1">${r.carros}</div>
            <div style="font-size:9px;color:var(--mut)">CARROS</div>
          </div>
        </div>

        <div style="margin:8px 0">
          <div style="height:6px;background:var(--brd);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${barPct}%;background:${cor};border-radius:3px;transition:width .8s"></div>
          </div>
        </div>

        <div style="display:flex;gap:12px;font-size:11px;flex-wrap:wrap">
          <span>🏭 Docas: ${r.docas || '—'}</span>
          ${r.peds ? `<span>📦 ${r.peds} ped.</span>` : ''}
          ${r.clis ? `<span>👤 ${r.clis} cli.</span>` : ''}
          <span style="margin-left:auto;color:${acimaMed ? '#10b981' : '#ef4444'};font-weight:700">
            ${pct >= 0 ? '+' : ''}${pct}% vs média
          </span>
        </div>
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   EXPORTAR CSV (mantido)
════════════════════════════════════════════════════════════ */
function exportRelatorio() {
  const filtroData  = document.getElementById('rel-data')?.value  || '';
  const filtroTurno = document.getElementById('rel-turno')?.value || '';
  const nomeTurno   = { manha:'Manhã', tarde:'Tarde', noite:'Noite' };

  let entries = (typeof historico !== 'undefined' ? historico : []).filter(h => h.tipo === 'conferencia');
  if (filtroData)  entries = entries.filter(h => h.data?.slice(0,10) === filtroData);
  if (filtroTurno) entries = entries.filter(h => _turnoDeHora(h.hora) === filtroTurno);

  const linhas = [
    '=== CONFERÊNCIAS ===',
    'Data;Hora;Turno;Doca;OC;Rota;Conferente;Transportadora;Pedidos;Clientes;Duração(min);Região RJ'
  ];

  entries.forEach(h => {
    const d   = new Date(h.data);
    const dur = _duracaoMin(h);
    const reg = _detectarRegiao(h.rota || '');
    linhas.push([
      d.toLocaleDateString('pt-BR'),
      h.hora || d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
      nomeTurno[_turnoDeHora(h.hora)] || '—',
      h.doca || '', h.oc || '', h.rota || '', h.conf || '',
      h.transportadora || '', h.pedidos || '', h.clientes || '',
      dur !== null ? dur : '—', reg
    ].join(';'));
  });

  const label = filtroData || new Date().toISOString().slice(0,10);
  _downloadBlob('\uFEFF' + linhas.join('\n'), `relatorio_dockcheck_${label}.csv`, 'text/csv;charset=utf-8');
  if (typeof toast === 'function') toast('Relatório exportado com coluna Região RJ!');
}

/* ════════════════════════════════════════════════════════════
   WHATSAPP (mantidos)
════════════════════════════════════════════════════════════ */
function _dadosRelatorioWA() {
  const filtroData  = document.getElementById('rel-data')?.value  || '';
  const filtroTurno = document.getElementById('rel-turno')?.value || '';
  const nomeTurno   = { manha:'Manhã (06h–14h)', tarde:'Tarde (14h–22h)', noite:'Noite (22h–06h)' };

  let entries = (typeof historico !== 'undefined' ? historico : []).filter(h => h.tipo === 'conferencia');
  if (filtroData)  entries = entries.filter(h => h.data?.slice(0,10) === filtroData);
  if (filtroTurno) entries = entries.filter(h => _turnoDeHora(h.hora) === filtroTurno);

  const docasSet = new Set(entries.map(h => h.doca).filter(Boolean));
  const confsSet = new Set(entries.map(h => h.conf).filter(Boolean));
  const duracoes = entries.map(h => _duracaoMin(h)).filter(v => v !== null);
  const tempoMed = duracoes.length ? Math.round(duracoes.reduce((a,b) => a+b,0) / duracoes.length) : null;
  const totalPed = entries.reduce((s, h) => s + (parseInt(h.pedidos) || 0), 0);
  const totalCli = entries.reduce((s, h) => s + (parseInt(h.clientes) || 0), 0);

  const byDoca = {};
  entries.forEach(h => {
    const k = h.doca?.trim() || '?';
    if (!byDoca[k]) byDoca[k] = { cargas:0, durs:[], confs:new Set() };
    byDoca[k].cargas++;
    const d = _duracaoMin(h); if (d) byDoca[k].durs.push(d);
    if (h.conf) byDoca[k].confs.add(h.conf.trim());
  });
  const docaList = Object.entries(byDoca).map(([doca, v]) => {
    const med = v.durs.length ? Math.round(v.durs.reduce((a,b) => a+b,0) / v.durs.length) : null;
    return { doca, cargas: v.cargas, med };
  });
  const comTempo  = docaList.filter(d => d.med !== null).sort((a,b) => a.med - b.med);
  const porCargas = [...docaList].sort((a,b) => b.cargas - a.cargas);

  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim() || '(sem nome)';
    if (!byConf[c]) byConf[c] = { count:0, ped:0, cli:0 };
    byConf[c].count++;
    byConf[c].ped += parseInt(h.pedidos) || 0;
    byConf[c].cli += parseInt(h.clientes) || 0;
  });
  const confRank = Object.entries(byConf).sort((a,b) => b[1].count - a[1].count);

  const byTransp = {};
  entries.forEach(h => {
    const t = h.transportadora?.trim() || '(sem nome)';
    if (!byTransp[t]) byTransp[t] = { cargas:0, durs:[] };
    byTransp[t].cargas++;
    const d = _duracaoMin(h); if (d) byTransp[t].durs.push(d);
  });
  const transpRank = Object.entries(byTransp).sort((a,b) => b[1].cargas - a[1].cargas);

  const hoje = new Date().toLocaleDateString('pt-BR');
  let periodo = filtroData ? new Date(filtroData+'T12:00:00').toLocaleDateString('pt-BR') : hoje;
  if (filtroTurno) periodo += ' · ' + nomeTurno[filtroTurno];

  // Top região
  const byReg = {};
  entries.forEach(h => { const r = _detectarRegiao(h.rota||''); byReg[r] = (byReg[r]||0)+1; });
  const topRegiao = Object.entries(byReg).sort((a,b) => b[1]-a[1])[0];

  return {
    entries, periodo, docasSet, confsSet, tempoMed, totalPed, totalCli,
    maisRapida: comTempo[0] || null,
    maisLenta:  comTempo[comTempo.length-1] || null,
    porCargas, comTempo, confRank, transpRank, topRegiao
  };
}

function waRelatorioResumo() {
  const d = _dadosRelatorioWA();
  if (!d.entries.length) { if (typeof toast === 'function') toast('Sem dados para o período selecionado.'); return; }

  const topConf   = d.confRank[0];
  const topTransp = d.transpRank[0];

  let msg = `📊 *RELATÓRIO DOCKCHECK PRO*\n📅 ${d.periodo}\n${'─'.repeat(28)}\n\n`;
  msg += `✅ *Cargas conferidas:* ${d.entries.length}\n`;
  msg += `🏭 *Docas ativas:* ${d.docasSet.size}\n`;
  msg += `👷 *Conferentes:* ${d.confsSet.size}\n`;
  if (d.tempoMed) msg += `⏱ *Tempo médio:* ${_fmtMin(d.tempoMed)}\n`;
  if (d.totalPed) msg += `📦 *Total pedidos:* ${d.totalPed}\n`;
  if (d.totalCli) msg += `👤 *Total clientes:* ${d.totalCli}\n\n`;
  if (d.maisRapida) msg += `⚡ *Mais rápida:* Doca ${d.maisRapida.doca} (${_fmtMin(d.maisRapida.med)})\n`;
  if (d.maisLenta && d.maisLenta.doca !== d.maisRapida?.doca)
    msg += `🐢 *Mais lenta:* Doca ${d.maisLenta.doca} (${_fmtMin(d.maisLenta.med)})\n`;
  if (topConf)    msg += `\n🏆 *Top conferente:* ${topConf[0]} (${topConf[1].count} cargas)\n`;
  if (topTransp)  msg += `🚛 *Principal transp.:* ${topTransp[0]} (${topTransp[1].cargas} cargas)\n`;
  if (d.topRegiao && d.topRegiao[0] !== 'Outras')
    msg += `🗺 *Região mais ativa:* ${d.topRegiao[0]} (${d.topRegiao[1]} cargas)\n`;
  msg += `\n_Enviado via DockCheck PRO_`;

  _compartilharTexto(msg, 'Resumo copiado!');
}

function waRelatorioCompleto() {
  const d = _dadosRelatorioWA();
  if (!d.entries.length) { if (typeof toast === 'function') toast('Sem dados para o período selecionado.'); return; }

  let msg = `📊 *RELATÓRIO COMPLETO DOCKCHECK PRO*\n📅 ${d.periodo}\n${'═'.repeat(28)}\n\n`;
  msg += `*📈 RESUMO GERAL*\n• Cargas: *${d.entries.length}* · Docas: *${d.docasSet.size}* · Conferentes: *${d.confsSet.size}*\n`;
  if (d.tempoMed) msg += `• Tempo médio: *${_fmtMin(d.tempoMed)}*\n`;
  if (d.totalPed) msg += `• Pedidos: *${d.totalPed}* · Clientes: *${d.totalCli}*\n\n`;

  msg += `*🏭 RANKING DOCAS*\n`;
  d.porCargas.forEach((doc, i) => {
    msg += `${['🥇','🥈','🥉'][i]||`${i+1}.`} Doca ${doc.doca} — ${doc.cargas} carga${doc.cargas>1?'s':''}`;
    if (doc.med) msg += ` · ⏱ ${_fmtMin(doc.med)}`;
    msg += '\n';
  });

  if (d.comTempo.length) {
    msg += `\n*⚡ MAIS RÁPIDAS*\n`;
    d.comTempo.slice(0,3).forEach((doc,i) => { msg += `${['🥇','🥈','🥉'][i]||(i+1)+'.'} Doca ${doc.doca} — ${_fmtMin(doc.med)}\n`; });
    msg += `\n*🐢 MAIS LENTAS*\n`;
    [...d.comTempo].reverse().slice(0,3).forEach((doc,i) => { msg += `${['🥇','🥈','🥉'][i]||(i+1)+'.'} Doca ${doc.doca} — ${_fmtMin(doc.med)}\n`; });
  }

  msg += `\n*👷 CONFERENTES*\n`;
  d.confRank.forEach(([nome,v],i) => {
    msg += `${['🥇','🥈','🥉'][i]||`${i+1}.`} ${nome} — ${v.count} conf.`;
    if (v.ped) msg += ` · ${v.ped} ped.`;
    msg += '\n';
  });

  msg += `\n*🚛 TRANSPORTADORAS*\n`;
  d.transpRank.forEach(([nome,v],i) => {
    const med = v.durs.length ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length) : null;
    msg += `${i+1}. ${nome} — ${v.cargas} carga${v.cargas>1?'s':''}`;
    if (med) msg += ` · ⏱ ${_fmtMin(med)}`;
    msg += '\n';
  });

  if (d.topRegiao && d.topRegiao[0] !== 'Outras') {
    msg += `\n*🗺 REGIÃO MAIS ATIVA*\n${d.topRegiao[0]}: ${d.topRegiao[1]} cargas\n`;
  }

  msg += `\n_Enviado via DockCheck PRO_`;
  _compartilharTexto(msg, 'Relatório completo copiado!');
}

/* ════════════════════════════════════════════════════════════
   CSS ENTERPRISE INJETADO
════════════════════════════════════════════════════════════ */
(function _injetarCSSRelatorio() {
  if (document.getElementById('css-relatorio-enterprise')) return;
  const s = document.createElement('style');
  s.id = 'css-relatorio-enterprise';
  s.textContent = `
    /* ── Cards de Doca Enterprise ── */
    #rel-docas-enterprise { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }

    .rel-doca-card {
      background: var(--bg2); border: 1px solid var(--brd); border-radius: 10px; padding: 14px;
      transition: border-color .2s, transform .2s;
    }
    .rel-doca-card:hover { transform: translateY(-1px); border-color: rgba(245,158,11,.3); }
    .rel-doca-card.destaque { border-color: rgba(245,158,11,.25); background: linear-gradient(135deg, var(--bg2) 0%, rgba(245,158,11,.03) 100%); }

    .rel-doca-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .rel-doca-nome   { font-size: 15px; font-weight: 800; font-family: 'Barlow Condensed', sans-serif; color: var(--acc); }
    .rel-doca-confs  { font-size: 10px; color: var(--mut); margin-top: 1px; }
    .rel-doca-score  { text-align: center; }

    .rel-doca-kpis   { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; }
    .rel-doca-kpi    { background: var(--bg); border: 1px solid var(--brd); border-radius: 6px; padding: 6px; text-align: center; }

    /* ── Rotas RJ ── */
    #rel-rotas-rj { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }

    .rel-rota-card {
      background: var(--bg2); border: 1px solid var(--brd); border-radius: 10px; padding: 12px;
      transition: border-color .2s;
    }
    .rel-rota-card:hover { border-color: rgba(245,158,11,.3); }

    /* ── IA Executiva ── */
    .rel-ia-header { display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(245,158,11,.06); border: 1px solid rgba(245,158,11,.2); border-radius: 8px; margin-bottom: 10px; }
    .rel-ia-pulse  { width: 8px; height: 8px; border-radius: 50%; background: var(--acc); animation: pulse 2s infinite; flex-shrink: 0; }
    .rel-ia-loading { display: flex; align-items: center; gap: 10px; padding: 16px; color: var(--mut); font-size: 13px; }
    .rel-ia-insight { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; margin-bottom: 8px; background: var(--bg2); }

    /* ── Score gauge ── */
    #rel-score-gauge { display: block; width: 100%; max-width: 200px; margin: 0 auto; }

    /* ── Empty ── */
    .rel-empty { text-align: center; color: var(--mut); font-size: 12px; padding: 20px; }

    /* ── Auxiliares ── */
    #rel-auxiliares { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }

    .rel-aux-card {
      background: var(--bg2); border: 1px solid var(--brd); border-radius: 10px; padding: 14px;
      transition: border-color .2s, transform .2s;
    }
    .rel-aux-card:hover { transform: translateY(-1px); border-color: rgba(245,158,11,.3); }
    .rel-aux-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
    .rel-aux-nome   { font-size: 15px; font-weight: 800; font-family: 'Barlow Condensed', sans-serif; }
    .rel-aux-sub    { font-size: 10px; color: var(--mut); margin-top: 2px; }

    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
    @keyframes spin   { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(s);
})();
