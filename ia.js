/**
 * ia.js — DockCheck PRO · Fase 15
 * IA Operacional Autônoma Enterprise
 * Torre de Controle Logística Inteligente
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTES
════════════════════════════════════════════════════════════ */
const IA_REFRESH_MS  = 45_000;   // atualiza a cada 45s
const IA_FEED_MAX    = 30;

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */
let _iaRefreshTimer  = null;
let _iaFeedItems     = [];
let _iaUltimaAnalise = null;
let _iaScore         = 0;
let _iaAtivo         = false;

/* ════════════════════════════════════════════════════════════
   HELPERS (compatíveis com analytics.js)
════════════════════════════════════════════════════════════ */
function _duracaoMin(h) {
  const i = new Date(h.inicio || h.data || 0).getTime();
  const f = new Date(h.fim    || h.data || 0).getTime();
  const d = Math.round((f - i) / 60000);
  return d > 0 && d < 600 ? d : null;
}

function _fmtMin(m) {
  if (!m || isNaN(m)) return '—';
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}h${min > 0 ? min + 'm' : ''}` : `${min}m`;
}

/* ════════════════════════════════════════════════════════════
   ENGINE IA — ia-engine.js compatibility shim
════════════════════════════════════════════════════════════ */
const iaEngine = {
  refresh: () => _iaRenderAll(),
  init:    () => _iaInit(),
};

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */
function _iaInit() {
  if (_iaAtivo) return;
  _iaAtivo = true;
  _iaRenderAll();
  _iaIniciarAutoRefresh();
  console.info('[IA] Operacional Autônoma Fase 15 inicializada.');
}

/* ════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════════════════════ */
function _iaRenderAll() {
  const entries = _iaEntries();

  _iaRenderHeader(entries);
  _iaRenderScore(entries);
  _iaRenderInsights(entries);
  _iaRenderAlertas(entries);
  _iaRenderGargalos(entries);
  _iaRenderFeed(entries);
  _iaRenderRankings(entries);

  _iaUltimaAnalise = new Date();
  const el = document.getElementById('ia-last-update');
  if (el) el.textContent = `Última análise: ${_iaUltimaAnalise.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;
}

function _iaEntries() {
  return (typeof historico !== 'undefined' ? historico : []).filter(h => h.tipo === 'conferencia');
}

/* ════════════════════════════════════════════════════════════
   1. HEADER IA ENTERPRISE
════════════════════════════════════════════════════════════ */
function _iaRenderHeader(entries) {
  const el = document.getElementById('ia-header-enterprise');
  if (!el) return;

  const duracoes   = entries.map(h => _duracaoMin(h)).filter(v => v && v > 0);
  const medGlobal  = duracoes.length ? Math.round(duracoes.reduce((a,b)=>a+b,0)/duracoes.length) : null;
  const emAtraso   = entries.filter(h => (_duracaoMin(h)||0) > 90).length;
  const sla        = entries.length ? Math.round((1 - emAtraso/entries.length)*100) : 100;
  const hora       = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const docasAtiv  = new Set(entries.map(h=>h.doca?.trim()).filter(Boolean)).size;

  const nivelIA    = sla >= 90 ? 'ÓTIMO' : sla >= 75 ? 'NORMAL' : sla >= 60 ? 'ALERTA' : 'CRÍTICO';
  const nivelCor   = sla >= 90 ? '#10b981' : sla >= 75 ? '#3b82f6' : sla >= 60 ? '#f59e0b' : '#ef4444';
  const confianca  = Math.min(98, 70 + Math.floor(entries.length * 0.5));

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#07090f,rgba(245,158,11,.07),#0a0d14);
      border:1px solid rgba(245,158,11,.22);border-radius:14px;padding:14px;
      position:relative;overflow:hidden;margin-bottom:10px">

      <!-- Glow de fundo -->
      <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;
        background:radial-gradient(circle,rgba(245,158,11,.1) 0%,transparent 70%);pointer-events:none"></div>
      <div style="position:absolute;bottom:-30px;left:-30px;width:100px;height:100px;
        background:radial-gradient(circle,rgba(59,130,246,.07) 0%,transparent 70%);pointer-events:none"></div>

      <!-- Linha de status -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:42px;height:42px;border-radius:50%;
            background:linear-gradient(135deg,#f59e0b,#d97706);
            display:flex;align-items:center;justify-content:center;font-size:22px;
            box-shadow:0 0 20px rgba(245,158,11,.4);animation:ia-pulse 3s infinite;flex-shrink:0">🧠</div>
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;
              letter-spacing:2px;color:var(--txt)">IA AUTÔNOMA OPERACIONAL</div>
            <div style="font-size:10px;color:var(--mut);letter-spacing:.5px">
              DockCheck PRO · Fase 15 · Torre de Controle
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);
            border-radius:6px;padding:3px 10px;font-family:'Barlow Condensed',sans-serif;
            font-size:10px;font-weight:800;color:#10b981;letter-spacing:1px">
            ● ONLINE
          </div>
          <div style="background:rgba(${nivelCor==='#10b981'?'16,185,129':nivelCor==='#3b82f6'?'59,130,246':nivelCor==='#f59e0b'?'245,158,11':'239,68,68'},.1);
            border:1px solid ${nivelCor}50;border-radius:6px;padding:3px 10px;
            font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:800;
            color:${nivelCor};letter-spacing:1px">${nivelIA}</div>
          <div style="background:var(--surf2);border:1px solid var(--bord);border-radius:6px;
            padding:3px 10px;font-family:'Barlow Condensed',sans-serif;font-size:10px;
            font-weight:800;color:var(--mut);letter-spacing:1px">🕐 ${hora}</div>
        </div>
      </div>

      <!-- Métricas rápidas -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
        ${[
          {l:'Operações',v:entries.length,c:'#f59e0b'},
          {l:'Docas',v:docasAtiv,c:'#8b5cf6'},
          {l:'SLA',v:sla+'%',c:nivelCor},
          {l:'Confiança IA',v:confianca+'%',c:'#10b981'},
        ].map(m=>`
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);
            border-radius:8px;padding:8px;text-align:center">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;
              color:${m.c};line-height:1">${m.v}</div>
            <div style="font-size:8px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">${m.l}</div>
          </div>
        `).join('')}
      </div>

      <!-- Barra de saúde do sistema -->
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:10px;color:var(--mut);flex-shrink:0">Saúde do Sistema</div>
        <div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${sla}%;background:linear-gradient(90deg,${nivelCor},${nivelCor}cc);
            border-radius:2px;transition:width 1s;box-shadow:0 0 8px ${nivelCor}60"></div>
        </div>
        <div style="font-size:10px;font-weight:700;color:${nivelCor};flex-shrink:0">${sla}%</div>
      </div>

      <!-- Botão de análise IA com API -->
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.05);
        display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-acc btn-sm" onclick="rodarAnaliseIA()" style="font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:.5px">
          🤖 Análise IA Profunda (API)
        </button>
        <button class="btn btn-ghost btn-sm" onclick="iaEngine.refresh()" style="font-family:'Barlow Condensed',sans-serif;font-weight:800">
          ↻ Atualizar
        </button>
        <span style="font-size:10px;color:var(--mut);margin-left:auto" id="ia-last-update">—</span>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   2. SCORE OPERACIONAL — GAUGE PREMIUM
════════════════════════════════════════════════════════════ */
function _iaRenderScore(entries) {
  const el = document.getElementById('ia-score-gauge');
  if (!el) return;

  const duracoes  = entries.map(h => _duracaoMin(h)).filter(v => v && v > 0 && v < 480);
  const medGlobal = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;
  const emAtraso  = entries.filter(h => (_duracaoMin(h)||0) > 90).length;
  const sla       = entries.length ? Math.round((1 - emAtraso/entries.length)*100) : 100;
  const docasSet  = new Set(entries.map(h=>h.doca?.trim()).filter(Boolean));
  const totalOCR  = (typeof ocrRows !== 'undefined') ? ocrRows.length : 0;
  const feitas    = new Set(entries.map(h=>h.oc?.trim()).filter(Boolean)).size;
  const efic      = totalOCR ? Math.min(100,Math.round(feitas/totalOCR*100)) : (entries.length?100:0);

  _iaScore = Math.round(sla*0.4 + efic*0.35 + Math.min(100,docasSet.size*12)*0.25);
  const score = _iaScore;
  const cor   = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'EXCELENTE' : score >= 70 ? 'BOM' : score >= 60 ? 'REGULAR' : 'CRÍTICO';

  // Gauge SVG
  const R = 54, CX = 70, CY = 70;
  const circum = 2 * Math.PI * R;
  const arc    = circum * 0.75;
  const fill   = arc * (score / 100);
  const offset = circum * 0.125;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <!-- Gauge -->
      <div style="position:relative;flex-shrink:0">
        <svg width="140" height="140" style="transform:rotate(-225deg)">
          <!-- Track -->
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
            stroke="rgba(255,255,255,.06)" stroke-width="10"
            stroke-dasharray="${arc} ${circum - arc}"
            stroke-dashoffset="-${offset}" stroke-linecap="round"/>
          <!-- Fill animado -->
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
            stroke="${cor}" stroke-width="10"
            stroke-dasharray="${fill} ${circum - fill}"
            stroke-dashoffset="-${offset}" stroke-linecap="round"
            style="filter:drop-shadow(0 0 6px ${cor}80);transition:stroke-dasharray 1.2s ease"/>
        </svg>
        <!-- Número central -->
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:900;
            color:${cor};line-height:1">${score}</div>
          <div style="font-size:9px;font-weight:800;color:${cor};letter-spacing:1px">${label}</div>
        </div>
      </div>

      <!-- Detalhes do score -->
      <div style="flex:1;min-width:140px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;
          color:var(--txt);letter-spacing:.5px;margin-bottom:12px">COMPOSIÇÃO DO SCORE</div>
        ${[
          {label:'SLA Operacional', val:sla, cor:'#3b82f6', peso:'40%'},
          {label:'Eficiência OCs',  val:efic, cor:'#10b981', peso:'35%'},
          {label:'Cobertura Docas', val:Math.min(100,docasSet.size*12), cor:'#8b5cf6', peso:'25%'},
        ].map(m=>`
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:10px;color:var(--mut)">${m.label}</span>
              <span style="font-size:10px;font-weight:700;color:${m.cor}">${m.val}% <span style="color:var(--mut);font-weight:400">(${m.peso})</span></span>
            </div>
            <div style="height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${m.val}%;background:${m.cor};border-radius:2px;transition:width 1s;box-shadow:0 0 4px ${m.cor}60"></div>
            </div>
          </div>
        `).join('')}

        <!-- Resumo -->
        <div style="margin-top:8px;padding:8px;background:rgba(${cor==='#10b981'?'16,185,129':cor==='#f59e0b'?'245,158,11':'239,68,68'},.08);
          border:1px solid ${cor}30;border-radius:8px;font-size:11px;color:var(--txt2);line-height:1.5">
          ${score >= 80 ? '✅ Operação eficiente. Manter ritmo atual.' :
            score >= 60 ? '⚠️ Oportunidade de melhoria identificada. Monitorar docas lentas.' :
            '🚨 Ação necessária. Revisar alocação de recursos.'}
        </div>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   3. INSIGHTS AUTÔNOMOS
════════════════════════════════════════════════════════════ */
function _iaRenderInsights(entries) {
  const el = document.getElementById('ia-insights');
  if (!el) return;

  const insights = [];
  const duracoes  = entries.map(h => _duracaoMin(h)).filter(v => v && v > 0 && v < 480);
  const medGlobal = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;

  if (!entries.length) {
    insights.push({ tipo:'info', icon:'🧠', txt:'IA monitorando fluxo operacional das docas', sub:'Registre conferências para ativar insights avançados e previsões em tempo real' });
    insights.push({ tipo:'info', icon:'📡', txt:'Sistema analisando padrões logísticos', sub:'Quanto mais operações registradas, mais precisos ficam os insights da IA' });
    insights.push({ tipo:'info', icon:'⚡', txt:'Torre de controle ativa — monitoramento contínuo em operação', sub:'IA pronta para detectar gargalos, atrasos e oportunidades de otimização' });
  } else {
    // Stats por doca
    const byDoca = {};
    entries.forEach(h => {
      const d = h.doca?.trim()||'?';
      if (!byDoca[d]) byDoca[d] = {count:0,durs:[]};
      byDoca[d].count++;
      const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);
    });
    const docaStats = Object.entries(byDoca).map(([d,v]) => ({
      d, count:v.count, med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null
    })).filter(x=>x.med);

    const lenta  = [...docaStats].sort((a,b)=>b.med-a.med)[0];
    const rapida = [...docaStats].sort((a,b)=>a.med-b.med)[0];

    if (lenta && medGlobal && lenta.med > medGlobal * 1.2) {
      const pct = Math.round((lenta.med-medGlobal)/medGlobal*100);
      insights.push({ tipo:'crit', icon:'🚨', txt:`Doca ${lenta.d} apresenta ${pct}% acima do tempo médio`, sub:`Tempo atual: ${_fmtMin(lenta.med)} · Média geral: ${_fmtMin(Math.round(medGlobal))} · Redistribuição recomendada` });
    }

    if (rapida && medGlobal && rapida.med < medGlobal * 0.8 && rapida.d !== lenta?.d) {
      const pct = Math.round((medGlobal-rapida.med)/medGlobal*100);
      insights.push({ tipo:'good', icon:'⚡', txt:`Doca ${rapida.d} opera ${pct}% abaixo da média — referência de performance`, sub:`Tempo médio: ${_fmtMin(rapida.med)} · Modelo operacional para as demais docas` });
    }

    // Conferente destaque
    const byConf = {};
    entries.forEach(h => { const c=h.conf?.trim()||'?'; if(!byConf[c]) byConf[c]={count:0,durs:[]}; byConf[c].count++; const d=_duracaoMin(h); if(d) byConf[c].durs.push(d); });
    const confTop = Object.entries(byConf).filter(([k])=>k!=='?').map(([n,v])=>({n,count:v.count,med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null})).filter(x=>x.med).sort((a,b)=>a.med-b.med)[0];
    if (confTop) insights.push({ tipo:'good', icon:'🏆', txt:`${confTop.n} — melhor produtividade do período`, sub:`Tempo médio: ${_fmtMin(confTop.med)} · ${confTop.count} conferências realizadas` });

    // Transportadora
    const byT = {};
    entries.forEach(h => { const t=h.transportadora?.trim()||'?'; if(!byT[t]) byT[t]={count:0,durs:[]}; byT[t].count++; const d=_duracaoMin(h); if(d) byT[t].durs.push(d); });
    const tLenta = Object.entries(byT).filter(([k])=>k!=='?').map(([n,v])=>({n,count:v.count,med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null})).filter(x=>x.med&&medGlobal&&x.med>medGlobal*1.3).sort((a,b)=>b.med-a.med)[0];
    if (tLenta) insights.push({ tipo:'warn', icon:'⚠️', txt:`${tLenta.n} possui tendência de atraso`, sub:`Tempo médio histórico: ${_fmtMin(tLenta.med)} · ${tLenta.count} cargas analisadas` });

    const tTop = Object.entries(byT).filter(([k])=>k!=='?').sort((a,b)=>b[1].count-a[1].count)[0];
    if (tTop) insights.push({ tipo:'info', icon:'🚛', txt:`${tTop[0]} lidera volume com ${tTop[1].count} carga${tTop[1].count>1?'s':''}`, sub:`${Math.round(tTop[1].count/entries.length*100)}% do total de operações no período` });

    const emAtraso = entries.filter(h=>(_duracaoMin(h)||0)>90).length;
    if (!emAtraso) insights.push({ tipo:'good', icon:'✅', txt:'Todas as operações dentro do SLA — eficiência operacional confirmada', sub:'Nenhuma conferência acima do limite de 90 minutos no período analisado' });

    // Eficiência geral
    const h1    = new Date(Date.now()-3600000);
    const ritmo = entries.filter(h=>new Date(h.data)>=h1).length;
    if (ritmo > 5) insights.push({ tipo:'good', icon:'📈', txt:`Ritmo elevado — ${ritmo} operações na última hora`, sub:'Produtividade acima do normal detectada · manter ritmo atual' });
    else if (ritmo === 0 && entries.length > 0) insights.push({ tipo:'warn', icon:'📉', txt:'Sem atividade na última hora', sub:'Queda de produtividade detectada · verificar disponibilidade de equipe e recursos' });
  }

  const cores = {
    crit: {bg:'rgba(239,68,68,.08)',bord:'rgba(239,68,68,.3)',left:'#ef4444'},
    warn: {bg:'rgba(245,158,11,.08)',bord:'rgba(245,158,11,.3)',left:'#f59e0b'},
    good: {bg:'rgba(16,185,129,.08)',bord:'rgba(16,185,129,.3)',left:'#10b981'},
    info: {bg:'rgba(59,130,246,.08)',bord:'rgba(59,130,246,.3)',left:'#3b82f6'},
  };

  el.innerHTML = insights.map(ins => {
    const c = cores[ins.tipo]||cores.info;
    return `
      <div style="background:${c.bg};border:1px solid ${c.bord};border-left:3px solid ${c.left};
        border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;gap:10px;
        align-items:flex-start;animation:fadeUp .3s ease">
        <span style="font-size:20px;flex-shrink:0">${ins.icon}</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--txt);line-height:1.4">${ins.txt}</div>
          <div style="font-size:10px;color:var(--mut);margin-top:3px;line-height:1.4">${ins.sub}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   4. ALERTAS INTELIGENTES
════════════════════════════════════════════════════════════ */
function _iaRenderAlertas(entries) {
  const el    = document.getElementById('ia-alertas');
  const badge = document.getElementById('ia-badge');
  if (!el) return;

  const alertas = [];
  const duracoes  = entries.map(h=>_duracaoMin(h)).filter(v=>v&&v>0&&v<480);
  const medGlobal = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;

  // Docas críticas (ao vivo)
  document.querySelectorAll('.live-chip').forEach(chip => {
    const txt  = chip.textContent||'';
    const doca = txt.match(/(\d+)/)?.[1];
    const ativa = chip.classList.contains('ativa')||chip.classList.contains('conf');
    if (!doca || !ativa) return;
    const tempoEl = chip.querySelector('[data-tempo]');
    const tempo   = parseInt(chip.dataset?.tempo || tempoEl?.textContent || '0') || 0;
    if (tempo > 90) alertas.push({ nivel:'crit', icon:'🚨', titulo:`Doca ${doca} — Tempo crítico`, desc:`${tempo}min em operação — limite de SLA excedido` });
    else if (tempo > 60) alertas.push({ nivel:'warn', icon:'⚠️', titulo:`Doca ${doca} — Atenção`, desc:`${tempo}min — aproximando do limite operacional` });
  });

  // Operações acima da média
  if (medGlobal) {
    const byDoca = {};
    entries.forEach(h => { const d=h.doca?.trim()||'?'; if(!byDoca[d]) byDoca[d]=[]; const dur=_duracaoMin(h); if(dur) byDoca[d].push(dur); });
    Object.entries(byDoca).forEach(([doca, durs]) => {
      const med = durs.length ? durs.reduce((a,b)=>a+b,0)/durs.length : null;
      if (med && med > medGlobal * 1.5 && durs.length >= 2) {
        alertas.push({ nivel:'crit', icon:'🔴', titulo:`Doca ${doca} — Gargalo histórico`, desc:`Tempo médio ${Math.round(med)}min vs média ${Math.round(medGlobal)}min · ${Math.round((med-medGlobal)/medGlobal*100)}% acima` });
      }
    });
  }

  if (!alertas.length) {
    alertas.push({ nivel:'ok', icon:'✅', titulo:'Nenhum alerta crítico', desc:'Operação dentro dos parâmetros normais · IA monitorando continuamente' });
  }

  if (badge) {
    const criticos = alertas.filter(a=>a.nivel==='crit').length;
    if (criticos > 0) { badge.textContent = criticos; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  }

  const cores = { crit:'#ef4444', warn:'#f59e0b', ok:'#10b981', info:'#3b82f6' };
  el.innerHTML = alertas.map(a => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
      background:rgba(${a.nivel==='crit'?'239,68,68':a.nivel==='warn'?'245,158,11':a.nivel==='ok'?'16,185,129':'59,130,246'},.07);
      border:1px solid ${cores[a.nivel]||'#3b82f6'}40;
      border-left:3px solid ${cores[a.nivel]||'#3b82f6'};
      border-radius:8px;margin-bottom:6px">
      <span style="font-size:20px;flex-shrink:0">${a.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--txt)">${a.titulo}</div>
        <div style="font-size:10px;color:var(--mut);margin-top:2px">${a.desc}</div>
      </div>
      <span style="background:${cores[a.nivel]||'#3b82f6'}20;color:${cores[a.nivel]||'#3b82f6'};
        border:1px solid ${cores[a.nivel]||'#3b82f6'}40;border-radius:4px;
        font-size:9px;font-weight:800;padding:2px 7px;flex-shrink:0;letter-spacing:.5px;
        font-family:'Barlow Condensed',sans-serif">${a.nivel.toUpperCase()}</span>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   5. GARGALOS E PREVISÕES
════════════════════════════════════════════════════════════ */
function _iaRenderGargalos(entries) {
  const el = document.getElementById('ia-gargalos');
  if (!el) return;

  const gargalos = [];
  const duracoes  = entries.map(h=>_duracaoMin(h)).filter(v=>v&&v>0&&v<480);
  const medGlobal = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;
  const hora      = new Date().getHours();

  if (!entries.length) {
    gargalos.push({ icon:'📡', nivel:'info', titulo:'IA aguardando dados operacionais', desc:'Registre conferências para ativar detecção de gargalos e previsões avançadas', val:'' });
    gargalos.push({ icon:'🧠', nivel:'info', titulo:'Sistema de previsão em standby', desc:'Algoritmos de detecção prontos — aguardando movimentações para calibração', val:'' });
  } else {
    const byDoca = {};
    entries.forEach(h => { const d=h.doca?.trim()||'?'; if(!byDoca[d]) byDoca[d]={count:0,durs:[]}; byDoca[d].count++; const dur=_duracaoMin(h); if(dur) byDoca[d].durs.push(dur); });

    const docaStats = Object.entries(byDoca).map(([d,v])=>({d,count:v.count,med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null})).filter(x=>x.med).sort((a,b)=>b.med-a.med);

    // Gargalo principal
    const gargalo = docaStats[0];
    if (gargalo && medGlobal && gargalo.med > medGlobal * 1.3) {
      const risco = gargalo.med > medGlobal * 2 ? 'CRÍTICO' : 'MODERADO';
      gargalos.push({ icon:'🚨', nivel:'crit', titulo:`Gargalo detectado — Doca ${gargalo.d}`, desc:`Tempo médio ${_fmtMin(gargalo.med)} · ${Math.round((gargalo.med-medGlobal)/medGlobal*100)}% acima da média · Risco ${risco}`, val:_fmtMin(gargalo.med) });
    }

    // Previsão de congestionamento
    const proxHora = (hora+1)%24;
    const naProx   = entries.filter(h=>new Date(h.data).getHours()===proxHora).length;
    if (naProx > 3) {
      gargalos.push({ icon:'📈', nivel:'warn', titulo:`Pico previsto para as ${proxHora}h`, desc:`Histórico indica ${naProx} operações neste horário · Preparar equipe adicional`, val:naProx+' OCs' });
    }

    // Transportadora problema
    const byT = {};
    entries.forEach(h=>{const t=h.transportadora?.trim()||'?';if(!byT[t])byT[t]={durs:[]};const d=_duracaoMin(h);if(d)byT[t].durs.push(d);});
    const tProb = Object.entries(byT).filter(([k])=>k!=='?').map(([n,v])=>({n,med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null})).filter(x=>x.med&&medGlobal&&x.med>medGlobal*1.3).sort((a,b)=>b.med-a.med)[0];
    if (tProb) gargalos.push({ icon:'⚠️', nivel:'warn', titulo:`${tProb.n} — tendência de atraso confirmada`, desc:`Tempo médio ${_fmtMin(tProb.med)} · Padrão histórico identificado pelo algoritmo`, val:_fmtMin(tProb.med) });

    if (!gargalos.length) {
      gargalos.push({ icon:'✅', nivel:'ok', titulo:'Nenhum gargalo crítico detectado', desc:'Fluxo operacional estável · IA monitorando continuamente', val:'' });
    }
  }

  const cores = { crit:'#ef4444', warn:'#f59e0b', ok:'#10b981', info:'#3b82f6' };
  el.innerHTML = gargalos.map(g=>`
    <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;
      background:var(--surf2);border:1px solid var(--bord);
      border-left:3px solid ${cores[g.nivel]||'#3b82f6'};
      border-radius:0 10px 10px 0;margin-bottom:6px">
      <span style="font-size:22px;flex-shrink:0">${g.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--txt)">${g.titulo}</div>
        <div style="font-size:10px;color:var(--mut);margin-top:3px;line-height:1.4">${g.desc}</div>
      </div>
      ${g.val?`<div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:${cores[g.nivel]};flex-shrink:0">${g.val}</div>`:''}
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   6. FEED OPERACIONAL AO VIVO
════════════════════════════════════════════════════════════ */
function _iaRenderFeed(entries) {
  const el = document.getElementById('ia-feed-operacional');
  if (!el) return;

  const recentes = [...entries].sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,12);

  if (!recentes.length) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:10px;color:var(--mut);font-size:12px">
        <div style="width:6px;height:6px;border-radius:50%;background:var(--mut);animation:ia-pulse 2s infinite;flex-shrink:0"></div>
        IA monitorando operação em tempo real — sem movimentações recentes
      </div>
    `;
    return;
  }

  el.innerHTML = recentes.map(h => {
    const hora = new Date(h.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const dur  = _duracaoMin(h);
    const cor  = dur && dur > 90 ? '#ef4444' : dur && dur > 60 ? '#f59e0b' : '#10b981';
    const icon = dur && dur > 90 ? '🚨' : dur && dur > 60 ? '⚠️' : '✅';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;
        border-bottom:1px solid var(--bord)">
        <div style="width:5px;height:5px;border-radius:50%;background:${cor};flex-shrink:0;animation:ia-pulse 3s infinite"></div>
        <span style="font-size:10px;color:var(--mut);flex-shrink:0;min-width:34px">${hora}</span>
        <span style="font-size:13px;flex-shrink:0">${icon}</span>
        <div style="flex:1;min-width:0;font-size:11px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          <strong>D${h.doca||'?'}</strong>
          ${h.transportadora?` · ${h.transportadora}`:''}
          ${h.oc?` · OC ${h.oc}`:''}
          ${h.conf?` · ${h.conf}`:''}
        </div>
        ${dur?`<span style="font-size:10px;color:${cor};font-weight:700;flex-shrink:0">${_fmtMin(dur)}</span>`:''}
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   7. RANKINGS ENTERPRISE
════════════════════════════════════════════════════════════ */
function _iaRenderRankings(entries) {
  _iaRenderRankEquipes(entries);
  _iaRenderRankDocas(entries);
  _iaRenderRankTransp(entries);
  _iaRenderRankTurnos(entries);
}

function _iaRenderRankEquipes(entries) {
  const el = document.getElementById('ia-rank-equipes');
  if (!el) return;

  const byConf = {};
  entries.forEach(h=>{const c=h.conf?.trim()||'?';if(!byConf[c])byConf[c]={count:0,durs:[]};byConf[c].count++;const d=_duracaoMin(h);if(d)byConf[c].durs.push(d);});
  const data = Object.entries(byConf).filter(([k])=>k!=='?').map(([n,v])=>({n,count:v.count,med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null})).sort((a,b)=>b.count-a.count).slice(0,5);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  const maxC = Math.max(...data.map(d=>d.count),1);

  el.innerHTML = data.length ? data.map((d,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
      background:var(--surf2);border:1px solid ${i===0?'rgba(245,158,11,.3)':'var(--bord)'};
      border-radius:10px;margin-bottom:6px;
      ${i===0?'box-shadow:0 2px 12px rgba(245,158,11,.08)':''}">
      <span style="font-size:20px;flex-shrink:0">${medals[i]}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:var(--txt)">${d.n}</div>
        <div style="font-size:10px;color:var(--mut);margin-top:1px">${d.count} conferências${d.med?` · ${_fmtMin(d.med)} médio`:''}</div>
        <div style="height:3px;background:var(--bord);border-radius:2px;margin-top:5px;overflow:hidden">
          <div style="height:100%;width:${d.count/maxC*100}%;background:#f59e0b;border-radius:2px;transition:width .8s"></div>
        </div>
      </div>
      <div style="text-align:center;flex-shrink:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:#f59e0b;line-height:1">${d.count}</div>
        <div style="font-size:9px;color:var(--mut)">OCs</div>
      </div>
    </div>
  `).join('') : '<div style="color:var(--mut);font-size:12px;padding:12px">Sem dados de conferentes no período</div>';
}

function _iaRenderRankDocas(entries) {
  const el = document.getElementById('ia-rank-docas');
  if (!el) return;

  const byDoca = {};
  entries.forEach(h=>{const d=h.doca?.trim()||'?';if(!byDoca[d])byDoca[d]={count:0,durs:[]};byDoca[d].count++;const dur=_duracaoMin(h);if(dur)byDoca[d].durs.push(dur);});
  const data = Object.entries(byDoca).map(([d,v])=>({d,count:v.count,med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null})).sort((a,b)=>b.count-a.count).slice(0,6);
  const medals=['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'];
  const maxC=Math.max(...data.map(d=>d.count),1);
  const medG=data.filter(d=>d.med).map(d=>d.med);
  const medGlobal=medG.length?Math.round(medG.reduce((a,b)=>a+b,0)/medG.length):null;

  el.innerHTML = data.length ? data.map((d,i)=>{
    const efic = d.med && medGlobal ? Math.round(medGlobal/d.med*100) : null;
    const cor = efic ? (efic>=100?'#10b981':efic>=80?'#f59e0b':'#ef4444') : '#3b82f6';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bord)">
        <span style="font-size:16px;width:22px;text-align:center;flex-shrink:0">${medals[i]}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--txt)">Doca ${d.d}</div>
          <div style="height:3px;background:var(--bord);border-radius:2px;margin-top:4px;overflow:hidden">
            <div style="height:100%;width:${d.count/maxC*100}%;background:${cor};border-radius:2px;transition:width .7s"></div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;min-width:50px">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:${cor}">${d.count}</div>
          ${d.med?`<div style="font-size:9px;color:var(--mut)">${_fmtMin(d.med)}</div>`:''}
        </div>
      </div>
    `;
  }).join('') : '<div style="color:var(--mut);font-size:12px;padding:12px">Sem dados de docas no período</div>';
}

function _iaRenderRankTransp(entries) {
  const el = document.getElementById('ia-rank-transportadoras');
  if (!el) return;

  const byT = {};
  entries.forEach(h=>{const t=h.transportadora?.trim()||'?';if(!byT[t])byT[t]={count:0,durs:[]};byT[t].count++;const d=_duracaoMin(h);if(d)byT[t].durs.push(d);});
  const data = Object.entries(byT).filter(([k])=>k!=='?').map(([n,v])=>({n,count:v.count,med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null})).sort((a,b)=>b.count-a.count).slice(0,5);
  const medals=['🥇','🥈','🥉','4️⃣','5️⃣'];
  const maxC=Math.max(...data.map(d=>d.count),1);

  el.innerHTML = data.length ? data.map((d,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bord)">
      <span style="font-size:16px;width:22px;text-align:center;flex-shrink:0">${medals[i]}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:700;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.n}</div>
        <div style="height:3px;background:var(--bord);border-radius:2px;margin-top:4px;overflow:hidden">
          <div style="height:100%;width:${d.count/maxC*100}%;background:#3b82f6;border-radius:2px;transition:width .7s"></div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:#3b82f6">${d.count}</div>
        ${d.med?`<div style="font-size:9px;color:var(--mut)">${_fmtMin(d.med)}</div>`:''}
      </div>
    </div>
  `).join('') : '<div style="color:var(--mut);font-size:12px;padding:12px">Sem dados de transportadoras</div>';
}

function _iaRenderRankTurnos(entries) {
  const el = document.getElementById('ia-rank-turnos');
  if (!el) return;

  const turnos = { '🌅 Manhã (6h-14h)':{count:0,durs:[]}, '🌤 Tarde (14h-22h)':{count:0,durs:[]}, '🌙 Noite (22h-6h)':{count:0,durs:[]} };
  entries.forEach(h => {
    const hr  = new Date(h.data).getHours();
    const key = hr >= 6 && hr < 14 ? '🌅 Manhã (6h-14h)' : hr >= 14 && hr < 22 ? '🌤 Tarde (14h-22h)' : '🌙 Noite (22h-6h)';
    turnos[key].count++;
    const d = _duracaoMin(h); if (d) turnos[key].durs.push(d);
  });

  const data = Object.entries(turnos).map(([n,v])=>({n,count:v.count,med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null}));
  const maxC = Math.max(...data.map(d=>d.count),1);
  const cores = ['#f59e0b','#3b82f6','#8b5cf6'];

  el.innerHTML = data.map((d,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bord)">
      <div style="font-size:12px;font-weight:700;color:var(--txt);min-width:110px;flex-shrink:0">${d.n}</div>
      <div style="flex:1;height:6px;background:var(--bord);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${d.count/maxC*100}%;background:${cores[i]};border-radius:3px;transition:width .8s;box-shadow:0 0 6px ${cores[i]}60"></div>
      </div>
      <div style="text-align:right;flex-shrink:0;min-width:50px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:${cores[i]}">${d.count}</div>
        ${d.med?`<div style="font-size:9px;color:var(--mut)">${_fmtMin(d.med)}</div>`:''}
      </div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   AUTO-REFRESH
════════════════════════════════════════════════════════════ */
function _iaIniciarAutoRefresh() {
  if (_iaRefreshTimer) clearInterval(_iaRefreshTimer);
  _iaRefreshTimer = setInterval(() => {
    const tabEl = document.getElementById('tab-ia');
    if (tabEl && tabEl.style.display !== 'none') _iaRenderAll();
  }, IA_REFRESH_MS);
}

/* ════════════════════════════════════════════════════════════
   ANÁLISE IA PROFUNDA (Anthropic API)
════════════════════════════════════════════════════════════ */
async function rodarAnaliseIA() {
  const apiKey = (typeof storage !== 'undefined' && storage.get)
    ? storage.get('K_KEY', '') || storage.get('dc_api_key', '')
    : localStorage.getItem('dc_api_key') || '';

  if (!apiKey) { if(typeof toast==='function') toast('Configure a API Key em ⚙️ Config!'); return; }

  const entries = _iaEntries();
  if (entries.length < 2) { if(typeof toast==='function') toast('Registre pelo menos 2 conferências.'); return; }

  const btn = document.querySelector('[onclick="rodarAnaliseIA()"]');
  if (btn) { btn.disabled = true; btn.textContent = '🤖 Analisando...'; }

  const byDoca={},byConf={},byTransp={};
  entries.forEach(h=>{
    const d=h.doca?.trim()||'?'; if(!byDoca[d]) byDoca[d]={cargas:0,durs:[]}; byDoca[d].cargas++; const dur=_duracaoMin(h); if(dur) byDoca[d].durs.push(dur);
    const c=h.conf?.trim()||'?'; if(!byConf[c]) byConf[c]={cargas:0}; byConf[c].cargas++;
    const t=h.transportadora?.trim()||'?'; if(!byTransp[t]) byTransp[t]={cargas:0,durs:[]}; byTransp[t].cargas++; if(dur) byTransp[t].durs.push(dur);
  });

  const docaStats = Object.entries(byDoca).map(([d,v])=>{ const med=v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null; return `Doca ${d}: ${v.cargas} cargas, tempo médio ${med?med+'min':'N/A'}`; }).join('\n');
  const confStats = Object.entries(byConf).sort((a,b)=>b[1].cargas-a[1].cargas).map(([n,v])=>`${n}: ${v.cargas} conferências`).join('\n');
  const transpStats = Object.entries(byTransp).sort((a,b)=>b[1].cargas-a[1].cargas).map(([t,v])=>{ const med=v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null; return `${t}: ${v.cargas} cargas, tempo médio ${med?med+'min':'N/A'}`; }).join('\n');

  const prompt = `Você é um analista de logística especialista em operações de centro de distribuição.
Analise os dados operacionais abaixo e gere insights precisos em português.

DADOS:
- Total de conferências: ${entries.length}
- Docas: ${docaStats}
- Conferentes: ${confStats}
- Transportadoras: ${transpStats}

Retorne JSON puro sem markdown:
{"resumo":"frase executiva em 1 linha","insights":[{"tipo":"warn|crit|good|info","texto":"..."}],"detalhado":"análise detalhada"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1200, messages:[{role:'user',content:prompt}] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const txt    = data.content.find(b=>b.type==='text')?.text||'';
    const parsed = JSON.parse(txt.replace(/```json|```/g,'').trim());

    // Injeta resultado da análise API nos insights existentes
    const el = document.getElementById('ia-insights');
    if (el && parsed.insights) {
      const cores = {crit:{bg:'rgba(239,68,68,.08)',bord:'rgba(239,68,68,.3)',left:'#ef4444'},warn:{bg:'rgba(245,158,11,.08)',bord:'rgba(245,158,11,.3)',left:'#f59e0b'},good:{bg:'rgba(16,185,129,.08)',bord:'rgba(16,185,129,.3)',left:'#10b981'},info:{bg:'rgba(59,130,246,.08)',bord:'rgba(59,130,246,.3)',left:'#3b82f6'}};
      el.innerHTML = `
        <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:12px;color:var(--txt2);font-style:italic">
          🧠 "${parsed.resumo||''}"
        </div>
        ${(parsed.insights||[]).map(i=>{const c=cores[i.tipo]||cores.info;return`<div style="background:${c.bg};border:1px solid ${c.bord};border-left:3px solid ${c.left};border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;gap:10px;align-items:flex-start"><span style="font-size:18px;flex-shrink:0">${i.tipo==='crit'?'🚨':i.tipo==='warn'?'⚠️':i.tipo==='good'?'✅':'ℹ️'}</span><div style="font-size:12px;font-weight:600;color:var(--txt)">${i.texto}</div></div>`;}).join('')}
      `;
    }

    if(typeof toast==='function') toast('✅ Análise IA profunda concluída!');
  } catch(e) {
    if(typeof toast==='function') toast('❌ Erro: '+e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Análise IA Profunda (API)'; }
  }
}

/* ════════════════════════════════════════════════════════════
   CSS ENTERPRISE
════════════════════════════════════════════════════════════ */
(function _iaCSS() {
  if (document.getElementById('ia-css-f15')) return;
  const s = document.createElement('style');
  s.id = 'ia-css-f15';
  s.textContent = `
    @keyframes ia-pulse {
      0%,100% { box-shadow:0 0 20px rgba(245,158,11,.4); opacity:1; }
      50%      { box-shadow:0 0 35px rgba(245,158,11,.7); opacity:.9; }
    }
    @keyframes fadeUp {
      from { opacity:0; transform:translateY(8px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .ia-section { margin-bottom:10px; }
    .ia-section-title {
      font-family:'Barlow Condensed',sans-serif;
      font-size:11px;font-weight:900;
      color:var(--mut);letter-spacing:1.2px;
      text-transform:uppercase;
      margin-bottom:8px;
      display:flex;align-items:center;gap:6px;
    }
    .ia-last-update { font-size:10px;color:var(--mut);margin-bottom:10px; }
    .ia-section-card {
      background:var(--surf);border:1px solid var(--bord);
      border-radius:12px;padding:12px;margin-bottom:10px;
      animation:fadeUp .35s ease;
    }
    #ia-feed-operacional { max-height:220px;overflow-y:auto; }
    #ia-feed-operacional::-webkit-scrollbar { width:3px; }
    #ia-feed-operacional::-webkit-scrollbar-thumb { background:var(--bord2);border-radius:2px; }
    .ia-empty { color:var(--mut);font-size:12px;padding:12px;text-align:center; }
  `;
  document.head.appendChild(s);
})();

/* ── Auto-init quando o iaEngine for chamado ── */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_iaInit, 800);
});
