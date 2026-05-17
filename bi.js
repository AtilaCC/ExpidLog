/**
 * bi.js — DockCheck Pro · Fase 11
 * BI Executivo Enterprise: KPIs corporativos, comparativos inteligentes,
 * análise histórica, score corporativo, heatmap, previsões com IA.
 *
 * ✅ NÃO altera nenhum arquivo existente
 * ✅ Lê as mesmas variáveis globais: historico, ocrRows
 * ✅ Usa mesmas CSS vars: var(--acc), var(--bg), var(--bg2), var(--brd), var(--txt), var(--mut), var(--grn), var(--red)
 * ✅ Canvas puro — sem libs externas
 * ✅ IA via Anthropic API (mesmo padrão de ia.js)
 * ✅ Offline-first — funciona 100% sem backend
 *
 * Depende de: storage.js, utils.js (para _fmtMin, _duracaoMin, _downloadBlob, toast)
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   PALETA BI
════════════════════════════════════════════════════════════ */
const BI_COLORS = [
  '#f59e0b','#10b981','#3b82f6','#8b5cf6',
  '#ef4444','#06b6d4','#f97316','#ec4899',
  '#84cc16','#14b8a6'
];

/* ════════════════════════════════════════════════════════════
   ESTADO INTERNO
════════════════════════════════════════════════════════════ */
let _biIaRunning   = false;
let _biComparativo = 'turno'; // turno | equipe | doca | transportadora | periodo

/* ════════════════════════════════════════════════════════════
   PONTO DE ENTRADA PRINCIPAL
════════════════════════════════════════════════════════════ */

function renderBI() {
  const entries = _biEntries();
  _biScoreCorporativo(entries);
  _biKPIs(entries);
  _biGraficoHistorico(entries);
  _biHeatmap(entries);
  _biComparativoRender(entries);
  _biTopPerformers(entries);
  _biAlertas(entries);
  _biSubHeader(entries);
}

/* ════════════════════════════════════════════════════════════
   FILTRO DE PERÍODO
════════════════════════════════════════════════════════════ */

function _biEntries() {
  const periodo = document.getElementById('bi-filtro-periodo')?.value || '30dias';
  const agora   = new Date();
  const base    = (typeof historico !== 'undefined' ? historico : [])
    .filter(h => h.tipo === 'conferencia');

  if (periodo === 'tudo') return base;

  const diasMap = { '7dias':7, '30dias':30, '90dias':90 };
  const dias    = diasMap[periodo];
  if (dias) {
    const inicio = new Date(agora);
    inicio.setDate(inicio.getDate() - dias);
    inicio.setHours(0,0,0,0);
    return base.filter(h => new Date(h.data) >= inicio);
  }

  // hoje
  if (periodo === 'hoje') {
    const inicio = new Date(agora); inicio.setHours(0,0,0,0);
    return base.filter(h => new Date(h.data) >= inicio);
  }

  return base;
}

function _biSubHeader(entries) {
  const el = document.getElementById('bi-sub');
  if (!el) return;
  const periodo = document.getElementById('bi-filtro-periodo')?.value || '30dias';
  const nomes = { hoje:'Hoje', '7dias':'Últimos 7 dias', '30dias':'Últimos 30 dias', '90dias':'Últimos 90 dias', tudo:'Todo histórico' };
  el.textContent = `${nomes[periodo]||periodo} · ${entries.length} conferência${entries.length!==1?'s':''} analisadas`;
}

/* ════════════════════════════════════════════════════════════
   SCORE CORPORATIVO
════════════════════════════════════════════════════════════ */

function _biScoreCorporativo(entries) {
  const el = document.getElementById('bi-score-num');
  const el2 = document.getElementById('bi-score-label');
  const el3 = document.getElementById('bi-score-bar');
  const el4 = document.getElementById('bi-score-detalhe');

  if (!entries.length) {
    if (el) el.textContent = '—';
    if (el2) el2.textContent = 'Sem dados suficientes';
    return;
  }

  const duracoes   = entries.map(h => _duracaoMin(h)).filter(v => v>0 && v<480);
  const tempoMed   = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;
  const alertas    = entries.filter(h => (_duracaoMin(h)||0) > 90).length;
  const totalOCR   = (typeof ocrRows !== 'undefined' ? ocrRows.length : 0) || 1;
  const feitas     = new Set(entries.map(h=>h.oc?.trim()).filter(Boolean)).size;
  const efic       = Math.min(Math.round((feitas/totalOCR)*100), 100);
  const docasAtiv  = new Set(entries.map(h=>h.doca?.trim()).filter(Boolean)).size;
  const txAlerta   = entries.length ? Math.round((alertas/entries.length)*100) : 0;

  // Score 0–100 com 4 componentes
  const scoreEfic  = efic;                                      // 25%
  const scoreTempo = tempoMed ? Math.max(0, Math.min(100, Math.round(100 - (tempoMed - 30) * 1.2))) : 50; // 25%
  const scoreAlert = Math.max(0, 100 - txAlerta * 3);           // 25%
  const scoreVol   = Math.min(100, Math.round((entries.length / Math.max(totalOCR, 1)) * 100)); // 25%

  const score = Math.round((scoreEfic + scoreTempo + scoreAlert + scoreVol) / 4);

  let cls = 'bi-score-ok', label = 'EXCELENTE';
  if (score < 40)      { cls = 'bi-score-crit'; label = 'CRÍTICO'; }
  else if (score < 60) { cls = 'bi-score-warn'; label = 'ALERTA'; }
  else if (score < 80) { cls = 'bi-score-med';  label = 'BOM'; }

  if (el)  { el.textContent = score; el.className = `bi-score-num ${cls}`; }
  if (el2) { el2.textContent = label; el2.className = `bi-score-label ${cls}`; }
  if (el3) {
    const cor = score >= 80 ? 'var(--grn)' : score >= 60 ? 'var(--acc)' : score >= 40 ? '#f97316' : 'var(--red)';
    el3.innerHTML = `<div style="height:100%;width:${score}%;background:${cor};border-radius:4px;transition:width 1s ease"></div>`;
  }
  if (el4) {
    el4.innerHTML = `
      <div class="bi-score-comp"><span>Eficiência</span><b style="color:var(--acc)">${scoreEfic}</b></div>
      <div class="bi-score-comp"><span>Velocidade</span><b style="color:var(--grn)">${scoreTempo}</b></div>
      <div class="bi-score-comp"><span>Pontualidade</span><b style="color:#3b82f6">${scoreAlert}</b></div>
      <div class="bi-score-comp"><span>Volume</span><b style="color:#8b5cf6">${scoreVol}</b></div>
    `;
  }
}

/* ════════════════════════════════════════════════════════════
   KPIs CORPORATIVOS
════════════════════════════════════════════════════════════ */

function _biKPIs(entries) {
  if (!entries.length) {
    ['bi-kpi-sla','bi-kpi-tmedio','bi-kpi-efic','bi-kpi-vol','bi-kpi-atraso','bi-kpi-ocurr','bi-kpi-cap','bi-kpi-prod'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    return;
  }

  const duracoes   = entries.map(h => _duracaoMin(h)).filter(v => v>0 && v<480);
  const tempoMed   = duracoes.length ? Math.round(duracoes.reduce((a,b)=>a+b,0)/duracoes.length) : null;
  const alertas    = entries.filter(h => (_duracaoMin(h)||0) > 90).length;
  const totalOCR   = (typeof ocrRows !== 'undefined' ? ocrRows.length : entries.length) || 1;
  const feitas     = new Set(entries.map(h=>h.oc?.trim()).filter(Boolean)).size;
  const efic       = Math.min(Math.round((feitas/totalOCR)*100), 100);
  const totalPed   = entries.reduce((s,h)=>s+(parseInt(h.pedidos)||0),0);
  const txAtraso   = Math.round((alertas/entries.length)*100);
  const docasAtiv  = new Set(entries.map(h=>h.doca?.trim()).filter(Boolean)).size;
  const confsAtiv  = new Set(entries.map(h=>h.conf?.trim()).filter(Boolean)).size;

  // SLA: % dentro do limite de 90min
  const dentroSLA = entries.filter(h => {
    const d = _duracaoMin(h); return d !== null && d <= 90;
  }).length;
  const sla = Math.round((dentroSLA/entries.length)*100);

  // Produtividade: cargas/conferente
  const produtiv = confsAtiv ? Math.round(entries.length/confsAtiv) : 0;

  _biSetKPI('bi-kpi-sla',    sla+'%',              sla >= 80 ? 'ok' : sla >= 60 ? 'warn' : 'crit');
  _biSetKPI('bi-kpi-tmedio', tempoMed ? _fmtMin(tempoMed) : '—', tempoMed && tempoMed <= 60 ? 'ok' : 'warn');
  _biSetKPI('bi-kpi-efic',   efic+'%',             efic >= 80 ? 'ok' : efic >= 50 ? 'warn' : 'crit');
  _biSetKPI('bi-kpi-vol',    entries.length,        'info');
  _biSetKPI('bi-kpi-atraso', txAtraso+'%',          txAtraso <= 10 ? 'ok' : txAtraso <= 25 ? 'warn' : 'crit');
  _biSetKPI('bi-kpi-ocurr',  alertas,               alertas === 0 ? 'ok' : alertas <= 3 ? 'warn' : 'crit');
  _biSetKPI('bi-kpi-cap',    docasAtiv+' docas',    'info');
  _biSetKPI('bi-kpi-prod',   produtiv+'/conf',      produtiv >= 5 ? 'ok' : 'warn');
}

function _biSetKPI(id, val, status) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  const card = el.closest('.bi-kpi-card');
  if (card) {
    card.classList.remove('bi-kpi-ok','bi-kpi-warn','bi-kpi-crit','bi-kpi-info');
    card.classList.add(`bi-kpi-${status}`);
  }
}

/* ════════════════════════════════════════════════════════════
   GRÁFICO HISTÓRICO (linha — por dia)
════════════════════════════════════════════════════════════ */

function _biGraficoHistorico(entries) {
  const canvas = document.getElementById('bi-chart-hist');
  if (!canvas) return;

  const tipo = document.getElementById('bi-hist-tipo')?.value || 'volume';

  // Agrupa por dia
  const byDia = {};
  entries.forEach(h => {
    const dia = h.data ? h.data.slice(0,10) : null; if (!dia) return;
    if (!byDia[dia]) byDia[dia] = { count:0, durs:[], peds:0 };
    byDia[dia].count++;
    const d = _duracaoMin(h); if (d&&d>0&&d<480) byDia[dia].durs.push(d);
    byDia[dia].peds += parseInt(h.pedidos)||0;
  });

  const dias = Object.keys(byDia).sort();
  if (!dias.length) {
    _biCanvasEmpty(canvas, 'Sem dados históricos'); return;
  }

  let valores, titulo, cor;
  if (tipo === 'volume') {
    valores = dias.map(d => byDia[d].count);
    titulo  = 'Volume de Cargas/Dia';
    cor     = '#3b82f6';
  } else if (tipo === 'tempo') {
    valores = dias.map(d => {
      const durs = byDia[d].durs;
      return durs.length ? Math.round(durs.reduce((a,b)=>a+b,0)/durs.length) : null;
    });
    titulo  = 'Tempo Médio por Dia (min)';
    cor     = '#f59e0b';
  } else {
    valores = dias.map(d => byDia[d].peds);
    titulo  = 'Pedidos por Dia';
    cor     = '#10b981';
  }

  const labels = dias.map(d => d.slice(5)); // MM-DD
  _biDrawLine(canvas, labels, valores, cor, titulo);
}

/* ════════════════════════════════════════════════════════════
   HEATMAP OPERACIONAL (docas × turnos)
════════════════════════════════════════════════════════════ */

function _biHeatmap(entries) {
  const el = document.getElementById('bi-heatmap');
  if (!el) return;

  if (entries.length < 3) {
    el.innerHTML = '<div class="bi-empty"><div class="bi-empty-icon">🔥</div><div>Registre mais conferências para gerar o heatmap</div></div>';
    return;
  }

  // Agrupa: doca × turno → count
  const matrix = {}; // { doca: { manha:0, tarde:0, noite:0 } }
  entries.forEach(h => {
    const doca  = h.doca?.trim()||'?';
    const hora  = h.hora ? parseInt(h.hora.split(':')[0]) : new Date(h.data).getHours();
    const turno = hora >= 6 && hora < 14 ? 'M' : hora >= 14 && hora < 22 ? 'T' : 'N';
    if (!matrix[doca]) matrix[doca] = { M:0, T:0, N:0 };
    matrix[doca][turno]++;
  });

  const docas   = Object.keys(matrix).sort((a,b) => {
    const totA = matrix[a].M+matrix[a].T+matrix[a].N;
    const totB = matrix[b].M+matrix[b].T+matrix[b].N;
    return totB - totA;
  }).slice(0, 12);

  const maxVal = Math.max(...docas.flatMap(d => [matrix[d].M, matrix[d].T, matrix[d].N]), 1);

  const cellStyle = (val) => {
    const pct = val / maxVal;
    const alpha = Math.round(pct * 200 + 30);
    const r = Math.round(245 * pct + 59 * (1-pct));
    const g = Math.round(68 * pct + 130 * (1-pct));
    const b = Math.round(11 * pct + 246 * (1-pct));
    return val === 0
      ? 'background:rgba(255,255,255,.03);color:var(--mut)'
      : `background:rgba(${r},${g},${b},${(alpha/255).toFixed(2)});color:#fff;font-weight:700`;
  };

  el.innerHTML = `
    <div class="bi-hm-wrap">
      <table class="bi-hm-table">
        <thead>
          <tr>
            <th>Doca</th>
            <th title="Manhã 06h–14h">☀️ M</th>
            <th title="Tarde 14h–22h">🌆 T</th>
            <th title="Noite 22h–06h">🌙 N</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${docas.map(d => {
            const row = matrix[d];
            const tot = row.M + row.T + row.N;
            const pctBar = Math.round((tot / (maxVal*3)) * 100);
            return `
              <tr>
                <td class="bi-hm-doca">D${d}</td>
                <td style="${cellStyle(row.M)}">${row.M||'—'}</td>
                <td style="${cellStyle(row.T)}">${row.T||'—'}</td>
                <td style="${cellStyle(row.N)}">${row.N||'—'}</td>
                <td class="bi-hm-tot">
                  <span>${tot}</span>
                  <div class="bi-hm-bar-wrap"><div class="bi-hm-bar" style="width:${pctBar}%"></div></div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="bi-hm-legend">
      <span style="background:rgba(59,130,246,.3)">Baixo</span>
      <span style="background:rgba(245,158,11,.5)">Médio</span>
      <span style="background:rgba(239,68,68,.8)">Alto</span>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   COMPARATIVOS INTELIGENTES
════════════════════════════════════════════════════════════ */

function _biComparativoRender(entries) {
  const tipo = _biComparativo;
  const el   = document.getElementById('bi-comparativo-body');
  if (!el) return;

  if (entries.length < 2) {
    el.innerHTML = '<div class="bi-empty"><div class="bi-empty-icon">📊</div><div>Sem dados suficientes para comparativo</div></div>';
    return;
  }

  let grupos = {};
  entries.forEach(h => {
    let chave;
    if (tipo === 'turno') {
      const hora = h.hora ? parseInt(h.hora.split(':')[0]) : new Date(h.data).getHours();
      chave = hora >= 6 && hora < 14 ? '☀️ Manhã' : hora >= 14 && hora < 22 ? '🌆 Tarde' : '🌙 Noite';
    } else if (tipo === 'equipe') {
      chave = h.conf?.trim() || '(sem nome)';
    } else if (tipo === 'doca') {
      chave = `Doca ${h.doca?.trim()||'?'}`;
    } else if (tipo === 'transportadora') {
      chave = h.transportadora?.trim() || '(sem transp.)';
    } else { // periodo
      chave = h.data ? h.data.slice(0,7) : 'sem data'; // YYYY-MM
    }

    if (!grupos[chave]) grupos[chave] = { count:0, durs:[], peds:0, clis:0 };
    grupos[chave].count++;
    const d = _duracaoMin(h); if (d&&d>0&&d<480) grupos[chave].durs.push(d);
    grupos[chave].peds += parseInt(h.pedidos)||0;
    grupos[chave].clis += parseInt(h.clientes)||0;
  });

  const rank = Object.entries(grupos).map(([nome,v]) => ({
    nome,
    count: v.count,
    med:   v.durs.length ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length) : null,
    sla:   Math.round((v.durs.filter(d=>d<=90).length / Math.max(v.count,1))*100),
    peds:  v.peds,
    clis:  v.clis
  })).sort((a,b) => b.count - a.count);

  const maxCount = rank[0]?.count || 1;
  const medals   = ['🥇','🥈','🥉'];

  el.innerHTML = rank.map((r, i) => `
    <div class="bi-comp-card ${i < 3 ? 'bi-comp-top' : ''}">
      <div class="bi-comp-pos">${medals[i]||i+1}</div>
      <div class="bi-comp-info">
        <div class="bi-comp-nome">${r.nome}</div>
        <div class="bi-comp-bar-wrap">
          <div class="bi-comp-bar" style="width:${Math.round((r.count/maxCount)*100)}%"></div>
        </div>
        <div class="bi-comp-meta">
          ${r.med ? `⏱ ${_fmtMin(r.med)}` : ''}
          ${r.sla !== undefined ? ` · SLA ${r.sla}%` : ''}
          ${r.peds ? ` · ${r.peds} ped.` : ''}
        </div>
      </div>
      <div class="bi-comp-val">
        <div class="bi-comp-num">${r.count}</div>
        <div class="bi-comp-lbl">cargas</div>
      </div>
    </div>
  `).join('');
}

function biSetComparativo(tipo) {
  _biComparativo = tipo;
  document.querySelectorAll('.bi-comp-btn').forEach(b => b.classList.remove('on'));
  const btn = document.querySelector(`.bi-comp-btn[data-tipo="${tipo}"]`);
  if (btn) btn.classList.add('on');
  _biComparativoRender(_biEntries());
}

/* ════════════════════════════════════════════════════════════
   TOP PERFORMERS
════════════════════════════════════════════════════════════ */

function _biTopPerformers(entries) {
  const el = document.getElementById('bi-performers');
  if (!el) return;

  if (!entries.length) {
    el.innerHTML = '<div class="bi-empty"><div class="bi-empty-icon">🏆</div><div>Sem dados</div></div>';
    return;
  }

  const byConf = {};
  entries.forEach(h => {
    const c = h.conf?.trim()||'?';
    if (!byConf[c]) byConf[c] = { count:0, durs:[], peds:0 };
    byConf[c].count++;
    const d = _duracaoMin(h); if (d&&d>0&&d<480) byConf[c].durs.push(d);
    byConf[c].peds += parseInt(h.pedidos)||0;
  });

  // Score: combina volume + velocidade
  const rank = Object.entries(byConf).map(([nome,v]) => {
    const med = v.durs.length ? v.durs.reduce((a,b)=>a+b,0)/v.durs.length : null;
    const velScore  = med ? Math.max(0, 100 - (med - 20) * 1.5) : 50;
    const volScore  = Math.min(100, v.count * 5);
    const perfScore = Math.round((velScore + volScore) / 2);
    return { nome, count:v.count, med:med?Math.round(med):null, peds:v.peds, score:perfScore };
  }).sort((a,b) => b.score - a.score).slice(0,5);

  const icons = ['🥇','🥈','🥉','4️⃣','5️⃣'];

  el.innerHTML = rank.map((r,i) => `
    <div class="bi-perf-card">
      <div class="bi-perf-pos">${icons[i]||i+1}</div>
      <div class="bi-perf-info">
        <div class="bi-perf-nome">${r.nome}</div>
        <div class="bi-perf-sub">${r.count} cargas${r.med ? ` · ${_fmtMin(r.med)} médio` : ''}</div>
      </div>
      <div class="bi-perf-score" style="color:${i===0?'var(--acc)':i===1?'#94a3b8':'#cd7f32'}">${r.score}</div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   ALERTAS ESTRATÉGICOS
════════════════════════════════════════════════════════════ */

function _biAlertas(entries) {
  const el = document.getElementById('bi-alertas');
  if (!el) return;

  if (entries.length < 3) {
    el.innerHTML = '<div class="bi-empty"><div class="bi-empty-icon">🔔</div><div>Sem dados suficientes para alertas</div></div>';
    return;
  }

  const alertas = [];
  const duracoes = entries.map(h => _duracaoMin(h)).filter(v => v>0&&v<480);
  const medGlobal = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;

  // Tendência de piora (últimos 7 vs período todo)
  const recentes  = entries.slice(0, Math.min(Math.ceil(entries.length*0.3), 20));
  const dursRec   = recentes.map(h => _duracaoMin(h)).filter(v => v>0&&v<480);
  const medRec    = dursRec.length ? dursRec.reduce((a,b)=>a+b,0)/dursRec.length : null;
  if (medGlobal && medRec && medRec > medGlobal * 1.15) {
    const pct = Math.round(((medRec-medGlobal)/medGlobal)*100);
    alertas.push({ tipo:'crit', icon:'📈', titulo:'Tendência de piora detectada',
      desc:`Operações recentes estão ${pct}% mais lentas que a média histórica do período.` });
  }

  // SLA abaixo de 70%
  const dentroSLA = entries.filter(h => (_duracaoMin(h)||999) <= 90).length;
  const sla = Math.round((dentroSLA/entries.length)*100);
  if (sla < 70) {
    alertas.push({ tipo:'crit', icon:'🚨', titulo:`SLA em ${sla}% — abaixo do mínimo`,
      desc:`Apenas ${dentroSLA} de ${entries.length} operações concluídas dentro do limite de 90 min.` });
  }

  // Doca gargalo crônica
  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim()||'?';
    if (!byDoca[d]) byDoca[d] = [];
    const dur = _duracaoMin(h); if (dur&&dur>0&&dur<480) byDoca[d].push(dur);
  });
  const docaGarg = Object.entries(byDoca)
    .filter(([,v]) => v.length >= 3)
    .map(([d,v]) => ({ d, med: v.reduce((a,b)=>a+b,0)/v.length }))
    .filter(x => medGlobal && x.med > medGlobal * 1.4)
    .sort((a,b) => b.med - a.med)[0];
  if (docaGarg) {
    const pct = Math.round(((docaGarg.med - medGlobal)/medGlobal)*100);
    alertas.push({ tipo:'warn', icon:'⚠️', titulo:`Doca ${docaGarg.d} com gargalo crônico`,
      desc:`Tempo médio ${pct}% acima da média — padrão identificado em múltiplas operações.` });
  }

  // Concentração de volume em 1 transportadora > 60%
  const byTransp = {};
  entries.forEach(h => { const t=h.transportadora?.trim()||'?'; byTransp[t]=(byTransp[t]||0)+1; });
  const transpTop = Object.entries(byTransp).sort((a,b)=>b[1]-a[1])[0];
  if (transpTop && (transpTop[1]/entries.length) > 0.6) {
    const pct = Math.round((transpTop[1]/entries.length)*100);
    alertas.push({ tipo:'info', icon:'🚛', titulo:`Concentração em ${transpTop[0]}`,
      desc:`${pct}% das cargas do período são desta transportadora — risco de dependência operacional.` });
  }

  // Operação saudável
  if (!alertas.length) {
    alertas.push({ tipo:'ok', icon:'✅', titulo:'Operação saudável',
      desc:'Todos os indicadores estratégicos dentro dos parâmetros. Nenhum alerta ativo.' });
  }

  el.innerHTML = alertas.map(a => `
    <div class="bi-alerta ${a.tipo}">
      <div class="bi-alerta-icon">${a.icon}</div>
      <div class="bi-alerta-body">
        <div class="bi-alerta-titulo">${a.titulo}</div>
        <div class="bi-alerta-desc">${a.desc}</div>
      </div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   IA EXECUTIVA — ANÁLISE CORPORATIVA VIA ANTHROPIC
════════════════════════════════════════════════════════════ */

async function biGerarRelatorioIA() {
  if (_biIaRunning) return;

  const KEY = (typeof _getKey === 'function') ? _getKey() : localStorage.getItem('K_KEY');
  if (!KEY) { toast('Configure a API Key na aba ⚙️ Config.'); return; }

  const entries = _biEntries();
  if (entries.length < 3) { toast('Registre mais conferências para usar a IA.'); return; }

  _biIaRunning = true;
  const btn  = document.getElementById('bi-ia-btn');
  const area = document.getElementById('bi-ia-output');
  if (btn)  { btn.disabled = true; btn.textContent = '⏳ Analisando...'; }
  if (area) { area.style.display = 'block'; area.innerHTML = '<div class="bi-ia-loading">🤖 IA analisando dados corporativos...</div>'; }

  // Prepara sumário compacto para prompt
  const duracoes  = entries.map(h => _duracaoMin(h)).filter(v => v>0&&v<480);
  const tempoMed  = duracoes.length ? Math.round(duracoes.reduce((a,b)=>a+b,0)/duracoes.length) : null;
  const alertas   = entries.filter(h => (_duracaoMin(h)||0) > 90).length;
  const totalOCR  = (typeof ocrRows !== 'undefined' ? ocrRows.length : entries.length) || 1;
  const feitas    = new Set(entries.map(h=>h.oc?.trim()).filter(Boolean)).size;
  const efic      = Math.min(Math.round((feitas/totalOCR)*100), 100);
  const sla       = Math.round((entries.filter(h=>(_duracaoMin(h)||999)<=90).length/entries.length)*100);
  const totalPed  = entries.reduce((s,h)=>s+(parseInt(h.pedidos)||0),0);
  const docasSet  = new Set(entries.map(h=>h.doca?.trim()).filter(Boolean));
  const confsSet  = new Set(entries.map(h=>h.conf?.trim()).filter(Boolean));

  // Por turno
  const byTurno = { Manhã:0, Tarde:0, Noite:0 };
  entries.forEach(h => {
    const hora = h.hora ? parseInt(h.hora.split(':')[0]) : new Date(h.data).getHours();
    if (hora>=6&&hora<14) byTurno['Manhã']++; else if (hora>=14&&hora<22) byTurno['Tarde']++; else byTurno['Noite']++;
  });

  // Por doca
  const byDoca = {};
  entries.forEach(h => { const d=h.doca?.trim()||'?'; byDoca[d]=(byDoca[d]||0)+1; });
  const top3Docas = Object.entries(byDoca).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([d,n])=>`Doca ${d}: ${n}`).join(', ');

  const prompt = `Você é um analista de BI logístico corporativo sênior. Analise os dados abaixo e gere um RELATÓRIO EXECUTIVO em português brasileiro, profissional, direto e acionável.

DADOS DO PERÍODO:
- Total de conferências: ${entries.length}
- Docas ativas: ${docasSet.size}
- Conferentes: ${confsSet.size}
- Tempo médio por operação: ${tempoMed ? tempoMed + ' min' : 'N/A'}
- Eficiência (OCs concluídas): ${efic}%
- SLA (dentro de 90min): ${sla}%
- Total de pedidos processados: ${totalPed}
- Operações em atraso (>90min): ${alertas}
- Volume por turno: Manhã ${byTurno['Manhã']}, Tarde ${byTurno['Tarde']}, Noite ${byTurno['Noite']}
- Top 3 docas por volume: ${top3Docas}

Estruture o relatório com exatamente estas seções (use emojis e markdown):
1. **📋 DIAGNÓSTICO EXECUTIVO** (2-3 frases — estado geral da operação)
2. **💪 PONTOS FORTES** (2-3 bullet points)
3. **⚠️ PONTOS DE ATENÇÃO** (2-3 bullet points com riscos identificados)
4. **🎯 RECOMENDAÇÕES PRIORITÁRIAS** (3 ações concretas, numeradas, com impacto esperado)
5. **📈 TENDÊNCIA** (1 frase sobre a direção da operação)

Seja objetivo. Máximo 350 palavras.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role:'user', content: prompt }]
      })
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const texto = data.content?.map(c => c.text||'').join('') || 'Sem resposta.';

    // Renderiza markdown simples
    const html = texto
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/^(\d+\.\s)/gm,   '<span style="color:var(--acc);font-weight:700">$1</span>')
      .replace(/^[-•]\s/gm,      '<span style="color:var(--mut)">▸ </span>')
      .replace(/\n/g, '<br>');

    if (area) {
      area.innerHTML = `
        <div class="bi-ia-header">
          <span>🤖 RELATÓRIO IA — ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
          <button class="btn btn-ghost btn-sm" onclick="biCopiarIA()">📋 Copiar</button>
        </div>
        <div class="bi-ia-texto" id="bi-ia-texto">${html}</div>
      `;
      area.dataset.rawText = texto;
    }
  } catch (err) {
    if (area) area.innerHTML = `<div class="bi-ia-erro">❌ Erro: ${err.message}</div>`;
  } finally {
    _biIaRunning = false;
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Gerar Relatório IA'; }
  }
}

function biCopiarIA() {
  const area = document.getElementById('bi-ia-output');
  const texto = area?.dataset?.rawText || '';
  if (!texto) return;
  navigator.clipboard?.writeText(texto).then(() => toast('Relatório IA copiado!')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = texto; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast('Copiado!');
  });
}

/* ════════════════════════════════════════════════════════════
   EXPORTAR CSV EXECUTIVO
════════════════════════════════════════════════════════════ */

function biExportarCSV() {
  const entries = _biEntries();
  if (!entries.length) { toast('Sem dados para exportar.'); return; }

  const duracoes = entries.map(h => _duracaoMin(h)).filter(v => v>0&&v<480);
  const tempoMed = duracoes.length ? Math.round(duracoes.reduce((a,b)=>a+b,0)/duracoes.length) : 0;
  const sla      = Math.round((entries.filter(h=>(_duracaoMin(h)||999)<=90).length/entries.length)*100);
  const alertas  = entries.filter(h=>(_duracaoMin(h)||0)>90).length;
  const totalPed = entries.reduce((s,h)=>s+(parseInt(h.pedidos)||0),0);

  const linhas = [
    '=== RELATÓRIO BI EXECUTIVO — DOCKCHECK PRO ===',
    `Gerado em;${new Date().toLocaleString('pt-BR')}`,
    `Total de conferências;${entries.length}`,
    `SLA (dentro de 90min);${sla}%`,
    `Tempo médio;${tempoMed} min`,
    `Operações em atraso;${alertas}`,
    `Total de pedidos;${totalPed}`,
    '',
    '=== DETALHAMENTO ===',
    'Data;Hora;Turno;Doca;OC;Conferente;Transportadora;Pedidos;Clientes;Duração(min);SLA'
  ];

  entries.forEach(h => {
    const d   = new Date(h.data);
    const dur = _duracaoMin(h);
    const hora = h.hora ? parseInt(h.hora.split(':')[0]) : d.getHours();
    const turno = hora>=6&&hora<14 ? 'Manhã' : hora>=14&&hora<22 ? 'Tarde' : 'Noite';
    linhas.push([
      d.toLocaleDateString('pt-BR'),
      h.hora || d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
      turno,
      h.doca||'', h.oc||'', h.conf||'',
      h.transportadora||'',
      h.pedidos||'', h.clientes||'',
      dur !== null ? dur : '—',
      dur !== null ? (dur <= 90 ? 'OK' : 'ATRASO') : '—'
    ].join(';'));
  });

  const label = new Date().toISOString().slice(0,10);
  if (typeof _downloadBlob === 'function') {
    _downloadBlob('\uFEFF' + linhas.join('\n'), `bi_executivo_${label}.csv`, 'text/csv;charset=utf-8');
  }
  toast('📊 CSV exportado!');
}

/* ════════════════════════════════════════════════════════════
   CANVAS HELPERS
════════════════════════════════════════════════════════════ */

function _biCanvasEmpty(canvas, msg) {
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 300;
  canvas.width = W; canvas.height = 160;
  ctx.clearRect(0,0,W,160);
  ctx.fillStyle = '#4a5568'; ctx.font = '12px Barlow,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(msg, W/2, 80);
}

function _biDrawLine(canvas, labels, values, color, titulo) {
  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 340;
  canvas.width = W; canvas.height = 180;
  const H = 180;
  ctx.clearRect(0,0,W,H);

  const valid = values.filter(v => v !== null && v !== undefined);
  if (!valid.length) { _biCanvasEmpty(canvas, 'Sem dados'); return; }

  const PAD = { top:24, right:12, bottom:36, left:42 };
  const max = Math.max(...valid) || 1;
  const step = (W - PAD.left - PAD.right) / Math.max(labels.length - 1, 1);

  // Grade
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - i/4);
    ctx.strokeStyle = '#252c3d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle = '#4a5568'; ctx.font = '9px Barlow,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max * i/4), PAD.left - 4, y + 3);
  }

  // Pontos
  const pts = values.map((v, i) => ({
    x: PAD.left + i * step,
    y: v !== null ? PAD.top + (H - PAD.top - PAD.bottom) * (1 - v/max) : null
  })).filter(p => p.y !== null);

  if (pts.length > 1) {
    // Área
    const grad = ctx.createLinearGradient(0, PAD.top, 0, H - PAD.bottom);
    grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, H - PAD.bottom);
    ctx.lineTo(pts[0].x, H - PAD.bottom);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // Linha
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
  }

  // Círculos + labels X
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#0d1017'; ctx.lineWidth = 2; ctx.stroke();
  });

  labels.forEach((lbl, i) => {
    const x = PAD.left + i * step;
    const skip = labels.length > 15 && i % Math.ceil(labels.length/10) !== 0;
    if (skip) return;
    ctx.fillStyle = '#64748b'; ctx.font = '9px Barlow Condensed,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(lbl).slice(0,5), x, H - 4);
  });

  // Título
  if (titulo) {
    ctx.fillStyle = '#64748b'; ctx.font = '10px Barlow,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(titulo, PAD.left, 13);
  }
}

/* ════════════════════════════════════════════════════════════
   CSS INJETADO DINAMICAMENTE — não altera style.css
════════════════════════════════════════════════════════════ */

(function _injetarCSSBI() {
  if (document.getElementById('bi-styles')) return;
  const s = document.createElement('style');
  s.id = 'bi-styles';
  s.textContent = `

/* ── Wrapper geral ── */
#tab-bi { padding-bottom: 60px; }

/* ── Header ── */
.bi-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 10px; gap: 10px; flex-wrap: wrap;
}
.bi-header-left { display: flex; align-items: center; gap: 10px; }
.bi-header-icon { font-size: 26px; line-height: 1; }
.bi-header-title {
  font-family: 'Barlow Condensed', sans-serif; font-size: 20px;
  font-weight: 900; letter-spacing: 2px; color: var(--txt);
}
.bi-header-sub { font-size: 11px; color: var(--mut); margin-top: 1px; }
.bi-header-right { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.bi-select {
  background: var(--bg2); border: 1px solid var(--brd); color: var(--txt);
  font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
  border-radius: 7px; padding: 6px 10px; letter-spacing: .5px;
}

/* ── Section title ── */
.bi-section-title {
  font-family: 'Barlow Condensed', sans-serif; font-size: 13px;
  font-weight: 800; letter-spacing: 1.5px; color: var(--mut);
  text-transform: uppercase; padding: 16px 16px 8px;
  display: flex; align-items: center; gap: 8px;
}
.bi-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.bi-dot.acc { background: var(--acc); }
.bi-dot.grn { background: var(--grn); }
.bi-dot.red { background: var(--red); }
.bi-dot.blue { background: #3b82f6; }
.bi-dot.pur  { background: #8b5cf6; }
.bi-dot.blink { animation: biPulse 1.4s infinite; }
@keyframes biPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

/* ── Score corporativo ── */
.bi-score-wrap {
  margin: 0 16px 6px; background: var(--bg2);
  border: 1px solid var(--brd); border-radius: 14px; padding: 20px;
}
.bi-score-main { display: flex; align-items: center; gap: 20px; margin-bottom: 14px; }
.bi-score-num {
  font-family: 'Barlow Condensed', sans-serif; font-size: 68px;
  font-weight: 900; line-height: 1; letter-spacing: -2px;
}
.bi-score-num.bi-score-ok   { color: var(--grn); }
.bi-score-num.bi-score-med  { color: var(--acc); }
.bi-score-num.bi-score-warn { color: #f97316; }
.bi-score-num.bi-score-crit { color: var(--red); }
.bi-score-right { flex: 1; }
.bi-score-label {
  font-family: 'Barlow Condensed', sans-serif; font-size: 22px;
  font-weight: 900; letter-spacing: 2px;
}
.bi-score-label.bi-score-ok   { color: var(--grn); }
.bi-score-label.bi-score-med  { color: var(--acc); }
.bi-score-label.bi-score-warn { color: #f97316; }
.bi-score-label.bi-score-crit { color: var(--red); }
.bi-score-lbl-sub { font-size: 11px; color: var(--mut); margin-top: 2px; }
.bi-score-bar-wrap {
  height: 8px; background: var(--bg); border-radius: 4px; overflow: hidden;
  margin-top: 10px;
}
.bi-score-detalhe {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px;
}
.bi-score-comp {
  background: var(--bg); border-radius: 8px; padding: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  font-size: 11px; color: var(--mut);
}
.bi-score-comp b { font-size: 20px; font-family: 'Barlow Condensed', sans-serif; font-weight: 800; }

/* ── KPI Grid ── */
.bi-kpi-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
  padding: 0 16px;
}
.bi-kpi-card {
  background: var(--bg2); border: 1px solid var(--brd); border-radius: 12px;
  padding: 14px 12px; transition: border-color .3s;
}
.bi-kpi-card.bi-kpi-ok   { border-color: rgba(16,185,129,.25); }
.bi-kpi-card.bi-kpi-warn { border-color: rgba(245,158,11,.25); }
.bi-kpi-card.bi-kpi-crit { border-color: rgba(239,68,68,.25); }
.bi-kpi-card.bi-kpi-info { border-color: rgba(59,130,246,.15); }
.bi-kpi-icon { font-size: 18px; margin-bottom: 4px; }
.bi-kpi-val {
  font-family: 'Barlow Condensed', sans-serif; font-size: 26px;
  font-weight: 900; color: var(--txt); line-height: 1;
}
.bi-kpi-ok   .bi-kpi-val { color: var(--grn); }
.bi-kpi-warn .bi-kpi-val { color: var(--acc); }
.bi-kpi-crit .bi-kpi-val { color: var(--red); }
.bi-kpi-info .bi-kpi-val { color: #3b82f6; }
.bi-kpi-lbl { font-size: 10px; color: var(--mut); margin-top: 3px; text-transform: uppercase; letter-spacing: .5px; }

/* ── Chart card ── */
.bi-chart-card {
  margin: 0 16px; background: var(--bg2); border: 1px solid var(--brd);
  border-radius: 12px; padding: 12px; overflow: hidden;
}
.bi-chart-card canvas { width: 100% !important; display: block; }
.bi-chart-controls {
  display: flex; gap: 6px; padding: 0 16px 8px; flex-wrap: wrap;
}
.bi-chart-btn {
  font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
  letter-spacing: .5px; background: var(--bg2); border: 1px solid var(--brd);
  color: var(--mut); border-radius: 6px; padding: 5px 10px; cursor: pointer;
  transition: all .2s;
}
.bi-chart-btn.on { background: var(--acc); border-color: var(--acc); color: #000; }

/* ── Heatmap ── */
.bi-hm-wrap { overflow-x: auto; }
.bi-hm-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
.bi-hm-table th {
  font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
  letter-spacing: .5px; color: var(--mut); padding: 6px 8px; text-align: center;
  border-bottom: 1px solid var(--brd);
}
.bi-hm-table td {
  padding: 6px 8px; text-align: center; font-size: 13px;
  border-bottom: 1px solid rgba(255,255,255,.03); border-radius: 4px;
  transition: opacity .3s;
}
.bi-hm-doca {
  font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 800;
  color: var(--acc); text-align: left !important;
}
.bi-hm-tot { text-align: left !important; }
.bi-hm-tot span { font-weight: 700; color: var(--txt); font-size: 13px; }
.bi-hm-bar-wrap {
  height: 3px; background: var(--bg); border-radius: 2px; overflow: hidden; margin-top: 3px;
}
.bi-hm-bar { height: 100%; background: var(--acc); border-radius: 2px; transition: width .8s; }
.bi-hm-legend {
  display: flex; gap: 8px; padding: 10px 0 0; justify-content: center;
}
.bi-hm-legend span {
  font-size: 10px; color: #e2e8f0; padding: 2px 8px; border-radius: 4px;
  font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .5px;
}

/* ── Comparativos ── */
.bi-comp-btns {
  display: flex; gap: 6px; padding: 0 16px 8px; flex-wrap: wrap;
}
.bi-comp-btn {
  font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
  letter-spacing: .5px; background: var(--bg2); border: 1px solid var(--brd);
  color: var(--mut); border-radius: 6px; padding: 5px 10px; cursor: pointer;
  transition: all .2s;
}
.bi-comp-btn.on { background: rgba(245,158,11,.15); border-color: rgba(245,158,11,.5); color: var(--acc); }
.bi-comp-card {
  background: var(--bg2); border: 1px solid var(--brd); border-radius: 10px;
  margin: 0 16px 8px; padding: 12px 14px;
  display: flex; align-items: center; gap: 12px;
  transition: border-color .3s;
}
.bi-comp-card.bi-comp-top { border-color: rgba(245,158,11,.2); }
.bi-comp-pos { font-size: 20px; flex-shrink: 0; width: 28px; text-align: center; }
.bi-comp-info { flex: 1; min-width: 0; }
.bi-comp-nome { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 800; color: var(--txt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bi-comp-bar-wrap { height: 3px; background: var(--bg); border-radius: 2px; overflow: hidden; margin: 4px 0; }
.bi-comp-bar { height: 100%; background: var(--acc); border-radius: 2px; transition: width .8s; }
.bi-comp-meta { font-size: 11px; color: var(--mut); }
.bi-comp-val { text-align: right; flex-shrink: 0; }
.bi-comp-num { font-family: 'Barlow Condensed', sans-serif; font-size: 24px; font-weight: 900; color: var(--acc); }
.bi-comp-lbl { font-size: 10px; color: var(--mut); }

/* ── Top performers ── */
.bi-perf-card {
  background: var(--bg2); border: 1px solid var(--brd); border-radius: 10px;
  margin: 0 16px 8px; padding: 12px 14px;
  display: flex; align-items: center; gap: 12px;
}
.bi-perf-pos { font-size: 22px; flex-shrink: 0; width: 28px; text-align: center; }
.bi-perf-info { flex: 1; min-width: 0; }
.bi-perf-nome { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 800; color: var(--txt); }
.bi-perf-sub  { font-size: 11px; color: var(--mut); margin-top: 2px; }
.bi-perf-score {
  font-family: 'Barlow Condensed', sans-serif; font-size: 28px;
  font-weight: 900; flex-shrink: 0;
}

/* ── Alertas ── */
.bi-alerta {
  background: var(--bg2); border-left: 3px solid var(--brd); border-radius: 0 10px 10px 0;
  margin: 0 16px 8px; padding: 12px 14px;
  display: flex; align-items: flex-start; gap: 12px;
}
.bi-alerta.crit { border-left-color: var(--red); background: rgba(239,68,68,.05); }
.bi-alerta.warn { border-left-color: var(--acc); background: rgba(245,158,11,.05); }
.bi-alerta.info { border-left-color: #3b82f6;   background: rgba(59,130,246,.05); }
.bi-alerta.ok   { border-left-color: var(--grn); background: rgba(16,185,129,.05); }
.bi-alerta-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
.bi-alerta-titulo { font-size: 13px; font-weight: 700; color: var(--txt); }
.bi-alerta-desc   { font-size: 12px; color: var(--mut); margin-top: 3px; line-height: 1.5; }

/* ── IA Output ── */
.bi-ia-wrap { padding: 0 16px; }
.bi-ia-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
#bi-ia-output {
  display: none; margin-top: 12px; background: var(--bg2);
  border: 1px solid var(--brd); border-radius: 12px; overflow: hidden;
}
.bi-ia-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--brd);
  font-size: 11px; color: var(--acc); font-weight: 700; letter-spacing: .5px;
  font-family: 'Barlow Condensed', sans-serif;
}
.bi-ia-texto { padding: 14px; font-size: 13px; color: var(--txt); line-height: 1.7; }
.bi-ia-loading { padding: 24px; text-align: center; color: var(--mut); font-size: 13px; }
.bi-ia-erro    { padding: 14px; color: var(--red); font-size: 12px; }

/* ── Empty state ── */
.bi-empty {
  text-align: center; padding: 32px 16px; color: var(--mut); font-size: 13px;
}
.bi-empty-icon { font-size: 32px; margin-bottom: 8px; opacity: .5; }

/* ── Ações ── */
.bi-acoes { padding: 0 16px; display: flex; gap: 8px; flex-wrap: wrap; }
.bi-live-tag {
  font-size: 10px; color: var(--grn); font-weight: 700;
  letter-spacing: .5px; margin-left: auto;
}

  `;
  document.head.appendChild(s);
})();
