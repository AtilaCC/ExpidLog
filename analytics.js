/**
 * analytics.js — DockCheck PRO · Fase 15
 * Analytics Enterprise IA Autônoma
 * Torre de Controle Logística
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   PALETA
════════════════════════════════════════════════════════════ */
const AN_COLORS = [
  '#f59e0b','#10b981','#3b82f6','#8b5cf6',
  '#ef4444','#06b6d4','#f97316','#ec4899',
  '#84cc16','#14b8a6'
];

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */
let _anRefreshTimer = null;
let _anFeedItems    = [];
let _anFeedTimer    = null;

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function _fmtMin(m) {
  if (m == null || isNaN(m)) return '—';
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}h${min > 0 ? min + 'm' : ''}` : `${min}m`;
}
function _duracaoMin(h) {
  const i = new Date(h.inicio || h.data || 0).getTime();
  const f = new Date(h.fim    || h.data || 0).getTime();
  const d = Math.round((f - i) / 60000);
  return d > 0 && d < 600 ? d : null;
}
function _setAnEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function _anCanvasEmpty(ctx, W, H, msg) {
  ctx.fillStyle = '#2a3348';
  ctx.font = '11px Barlow Condensed,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(msg, W / 2, H / 2);
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

  _anHeader(entries, periodo);
  _anKPIsEnterprise(entries);
  _anIAViva(entries);
  _anAlertas(entries);
  _anMapaDocs(entries);
  _anGraficos(entries);
  _anRankings(entries);
  _anFeedVivo(entries);
  _anPrevisao(entries);
  _anIniciarAutoRefresh();
}

/* ════════════════════════════════════════════════════════════
   1. HEADER ENTERPRISE
════════════════════════════════════════════════════════════ */
function _anHeader(entries, periodo) {
  const el = document.getElementById('an-header-enterprise');
  if (!el) return;

  const duracoes  = entries.map(h => _duracaoMin(h)).filter(v => v && v > 0 && v < 480);
  const tempoMed  = duracoes.length ? Math.round(duracoes.reduce((a,b) => a+b,0) / duracoes.length) : null;
  const emAtraso  = entries.filter(h => (_duracaoMin(h)||0) > 90).length;
  const sla       = entries.length ? Math.round((1 - emAtraso / entries.length) * 100) : 100;
  const docasSet  = new Set(entries.map(h => h.doca?.trim()).filter(Boolean));
  const hora      = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  const nomes     = { turno:'Turno Atual', hoje:'Hoje', '7dias':'7 Dias', tudo:'Histórico' };

  const slaColor = sla >= 85 ? '#10b981' : sla >= 70 ? '#f59e0b' : '#ef4444';
  const status   = sla >= 85 ? 'NORMAL' : sla >= 70 ? 'ALERTA' : 'CRÍTICO';
  const statusCor = sla >= 85 ? '#10b981' : sla >= 70 ? '#f59e0b' : '#ef4444';

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#0a0d14,rgba(245,158,11,.06),#0d1017);
      border:1px solid rgba(245,158,11,.2);border-radius:14px;padding:14px;
      position:relative;overflow:hidden;margin-bottom:10px">

      <!-- Glow de fundo -->
      <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;
        background:radial-gradient(circle,rgba(245,158,11,.12) 0%,transparent 70%);
        pointer-events:none"></div>

      <!-- Linha superior -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="position:relative">
            <span style="font-size:24px">🗼</span>
            <span style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;
              background:#10b981;border-radius:50%;animation:pulse-grn 2s infinite"></span>
          </div>
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;
              letter-spacing:2px;color:var(--txt)">TORRE DE CONTROLE LOGÍSTICO</div>
            <div style="font-size:10px;color:var(--mut);letter-spacing:.5px">
              DockCheck PRO · IA Autônoma Fase 15 · ${nomes[periodo]}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);
            border-radius:6px;padding:3px 9px;font-family:'Barlow Condensed',sans-serif;
            font-size:10px;font-weight:800;color:#10b981;letter-spacing:1px">
            ● IA ONLINE
          </div>
          <div style="background:rgba(${slaColor === '#10b981' ? '16,185,129' : slaColor === '#f59e0b' ? '245,158,11' : '239,68,68'},.1);
            border:1px solid rgba(${slaColor === '#10b981' ? '16,185,129' : slaColor === '#f59e0b' ? '245,158,11' : '239,68,68'},.3);
            border-radius:6px;padding:3px 9px;font-family:'Barlow Condensed',sans-serif;
            font-size:10px;font-weight:800;color:${statusCor};letter-spacing:1px">
            ${status}
          </div>
          <div style="background:var(--surf2);border:1px solid var(--bord);border-radius:6px;
            padding:3px 9px;font-family:'Barlow Condensed',sans-serif;font-size:10px;
            font-weight:800;color:var(--mut);letter-spacing:1px">
            🕐 ${hora}
          </div>
        </div>
      </div>

      <!-- Métricas rápidas -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${[
          { label:'Cargas', val: entries.length, cor:'#f59e0b' },
          { label:'Docas', val: docasSet.size, cor:'#8b5cf6' },
          { label:'SLA', val: sla+'%', cor: slaColor },
          { label:'Tempo Médio', val: tempoMed ? _fmtMin(tempoMed) : '—', cor:'#3b82f6' },
        ].map(m => `
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);
            border-radius:8px;padding:8px;text-align:center">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;
              font-weight:900;color:${m.cor};line-height:1">${m.val}</div>
            <div style="font-size:9px;color:var(--mut);text-transform:uppercase;
              letter-spacing:.5px;margin-top:2px">${m.label}</div>
          </div>
        `).join('')}
      </div>

      <!-- Filtro de período -->
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        ${['turno','hoje','7dias','tudo'].map((p,i) => {
          const lbls = ['Turno','Hoje','7 Dias','Tudo'];
          const ativo = (document.getElementById('an-filtro-periodo')?.value || 'turno') === p;
          return `<button onclick="document.getElementById('an-filtro-periodo').value='${p}';renderAnalytics()"
            style="background:${ativo ? 'var(--acc)' : 'var(--surf2)'};
              color:${ativo ? '#0d1017' : 'var(--mut)'};
              border:1px solid ${ativo ? 'var(--acc)' : 'var(--bord)'};
              border-radius:6px;padding:4px 12px;font-family:'Barlow Condensed',sans-serif;
              font-size:11px;font-weight:800;cursor:pointer;letter-spacing:.5px">
            ${lbls[i]}
          </button>`;
        }).join('')}
        <span style="margin-left:auto;font-size:10px;color:var(--mut);align-self:center">
          Atualizado: <span id="an-update-ts">${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
        </span>
      </div>
    </div>
    <input id="an-filtro-periodo" type="hidden" value="${periodo}">
  `;
}

/* ════════════════════════════════════════════════════════════
   2. KPIs ENTERPRISE
════════════════════════════════════════════════════════════ */
function _anKPIsEnterprise(entries) {
  const el = document.getElementById('an-kpi-grid');
  if (!el) return;

  const duracoes  = entries.map(h => _duracaoMin(h)).filter(v => v && v > 0 && v < 480);
  const tempoMed  = duracoes.length ? Math.round(duracoes.reduce((a,b)=>a+b,0)/duracoes.length) : null;
  const emAtraso  = entries.filter(h => (_duracaoMin(h)||0) > 90).length;
  const sla       = entries.length ? Math.round((1 - emAtraso / entries.length) * 100) : 100;
  const docasSet  = new Set(entries.map(h => h.doca?.trim()).filter(Boolean));
  const totalOCR  = (typeof ocrRows !== 'undefined') ? ocrRows.length : 0;
  const feitas    = new Set(entries.map(h => h.oc?.trim()).filter(Boolean)).size;
  const efic      = totalOCR ? Math.min(100, Math.round(feitas/totalOCR*100)) : (entries.length ? 100 : 0);
  const h1        = new Date(Date.now() - 3600000);
  const ritmo     = entries.filter(h => new Date(h.data) >= h1).length;
  const score     = Math.round(sla*0.4 + efic*0.35 + Math.min(100, docasSet.size*12)*0.25);
  const totalPed  = entries.reduce((s,h) => s + (parseInt(h.pedidos)||0), 0);

  const kpis = [
    { icon:'🎯', label:'SLA', val: sla+'%', cor: sla>=85?'#10b981':sla>=70?'#f59e0b':'#ef4444', pct: sla, sub: emAtraso+' atrasos' },
    { icon:'📦', label:'Volume', val: entries.length, cor:'#3b82f6', pct: Math.min(100,entries.length*5), sub: feitas+' OCs' },
    { icon:'⏱', label:'Tempo Médio', val: tempoMed?_fmtMin(tempoMed):'—', cor: tempoMed&&tempoMed<=60?'#10b981':tempoMed&&tempoMed<=90?'#f59e0b':'#ef4444', pct: tempoMed?Math.max(10,100-tempoMed):50, sub: 'por conferência' },
    { icon:'📊', label:'Eficiência', val: efic+'%', cor: efic>=80?'#10b981':efic>=60?'#f59e0b':'#ef4444', pct: efic, sub: feitas+'/'+totalOCR+' OCs' },
    { icon:'🏭', label:'Docas Ativas', val: docasSet.size, cor:'#8b5cf6', pct: Math.min(100,docasSet.size*10), sub: 'no período' },
    { icon:'⚡', label:'Ritmo /h', val: ritmo, cor:'#f59e0b', pct: Math.min(100,ritmo*15), sub: 'última hora' },
    { icon:'🗂', label:'Pedidos', val: totalPed||'—', cor:'#06b6d4', pct: 60, sub: 'conferidos' },
    { icon:'🏆', label:'Score', val: score, cor: score>=80?'#10b981':score>=60?'#f59e0b':'#ef4444', pct: score, sub: score>=80?'Excelente':score>=60?'Regular':'Crítico' },
  ];

  el.innerHTML = kpis.map(k => `
    <div style="background:linear-gradient(135deg,var(--surf),rgba(${k.cor==='#10b981'?'16,185,129':k.cor==='#ef4444'?'239,68,68':k.cor==='#3b82f6'?'59,130,246':k.cor==='#8b5cf6'?'139,92,246':k.cor==='#f59e0b'?'245,158,11':'6,182,212'},.06));
      border:1px solid rgba(${k.cor==='#10b981'?'16,185,129':k.cor==='#ef4444'?'239,68,68':k.cor==='#3b82f6'?'59,130,246':k.cor==='#8b5cf6'?'139,92,246':k.cor==='#f59e0b'?'245,158,11':'6,182,212'},.18);
      border-radius:12px;padding:12px;position:relative;overflow:hidden;cursor:default">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:18px">${k.icon}</span>
        <span style="font-size:10px;font-weight:800;color:${k.cor};letter-spacing:.5px;
          background:rgba(0,0,0,.2);border-radius:4px;padding:1px 6px">${k.sub}</span>
      </div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;
        color:${k.cor};line-height:1;margin-bottom:4px">${k.val}</div>
      <div style="font-size:9px;font-weight:800;color:var(--mut);text-transform:uppercase;
        letter-spacing:.6px;margin-bottom:8px">${k.label}</div>
      <div style="height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${k.pct}%;background:${k.cor};border-radius:2px;
          transition:width 1s;box-shadow:0 0 6px ${k.cor}60"></div>
      </div>
      <!-- glow -->
      <div style="position:absolute;bottom:-16px;right:-16px;width:60px;height:60px;
        background:radial-gradient(circle,${k.cor}30 0%,transparent 70%);pointer-events:none"></div>
    </div>
  `).join('');

  // Animação entrada
  requestAnimationFrame(() => {
    el.querySelectorAll('div[style*="border-radius:12px"]').forEach((c, i) => {
      c.style.opacity = '0'; c.style.transform = 'translateY(10px)';
      setTimeout(() => { c.style.transition = 'opacity .35s,transform .35s'; c.style.opacity = '1'; c.style.transform = 'translateY(0)'; }, i * 40);
    });
  });
}

/* ════════════════════════════════════════════════════════════
   3. IA VIVA
════════════════════════════════════════════════════════════ */
function _anIAViva(entries) {
  const el = document.getElementById('an-ia-viva');
  if (!el) return;

  const duracoes   = entries.map(h => _duracaoMin(h)).filter(v => v && v > 0 && v < 480);
  const medGlobal  = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;

  // Insights da IA
  const msgs = [];
  if (!entries.length) {
    msgs.push({ icon:'🧠', tipo:'info', txt:'IA monitorando fluxo operacional das docas', sub:'Aguardando movimentações para análise avançada' });
    msgs.push({ icon:'📡', tipo:'info', txt:'Sistema analisando padrões logísticos em tempo real', sub:'Os insights aparecerão assim que operações forem registradas' });
    msgs.push({ icon:'⚡', tipo:'info', txt:'Torre de controle ativa — monitoramento contínuo habilitado', sub:'IA pronta para detectar gargalos, atrasos e anomalias' });
  } else {
    // Docas por velocidade
    const byDoca = {};
    entries.forEach(h => {
      const d = h.doca?.trim() || '?';
      if (!byDoca[d]) byDoca[d] = { count:0, durs:[] };
      byDoca[d].count++;
      const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);
    });
    const docaStats = Object.entries(byDoca)
      .map(([doca, v]) => ({ doca, count: v.count, med: v.durs.length ? v.durs.reduce((a,b)=>a+b,0)/v.durs.length : null }))
      .filter(d => d.med !== null);

    const lenta = docaStats.sort((a,b) => b.med-a.med)[0];
    if (lenta && medGlobal && lenta.med > medGlobal * 1.2) {
      const pct = Math.round((lenta.med - medGlobal) / medGlobal * 100);
      msgs.push({ icon:'🚨', tipo:'crit', txt:`Doca ${lenta.doca} com ${pct}% acima do tempo médio`, sub:`Tempo atual: ${_fmtMin(Math.round(lenta.med))} · Média: ${_fmtMin(Math.round(medGlobal))} · Redistribuição recomendada` });
    }

    const rapida = [...docaStats].sort((a,b) => a.med-b.med)[0];
    if (rapida && medGlobal && rapida.med < medGlobal * 0.8) {
      msgs.push({ icon:'⚡', tipo:'good', txt:`Doca ${rapida.doca} operando ${Math.round((medGlobal-rapida.med)/medGlobal*100)}% abaixo da média`, sub:`Referência de performance — tempo médio: ${_fmtMin(Math.round(rapida.med))}` });
    }

    // Conferente destaque
    const byConf = {};
    entries.forEach(h => { const c = h.conf?.trim()||'?'; if (!byConf[c]) byConf[c]={count:0,durs:[]}; byConf[c].count++; const d=_duracaoMin(h); if(d) byConf[c].durs.push(d); });
    const confTop = Object.entries(byConf).map(([n,v]) => ({ n, count:v.count, med: v.durs.length?v.durs.reduce((a,b)=>a+b,0)/v.durs.length:null })).filter(c=>c.med).sort((a,b)=>a.med-b.med)[0];
    if (confTop) msgs.push({ icon:'🏆', tipo:'good', txt:`${confTop.n} — melhor produtividade do turno`, sub:`Tempo médio: ${_fmtMin(Math.round(confTop.med))} · ${confTop.count} conferências` });

    // Transportadora em destaque
    const byT = {};
    entries.forEach(h => { const t = h.transportadora?.trim()||'?'; byT[t]=(byT[t]||0)+1; });
    const tTop = Object.entries(byT).sort((a,b)=>b[1]-a[1])[0];
    if (tTop && tTop[0] !== '?') msgs.push({ icon:'🚛', tipo:'info', txt:`${tTop[0]} lidera volume com ${tTop[1]} carga${tTop[1]>1?'s':''}`, sub:`${Math.round(tTop[1]/entries.length*100)}% do total do período` });

    const emAtraso = entries.filter(h => (_duracaoMin(h)||0)>90).length;
    if (emAtraso > 0) msgs.push({ icon:'⚠️', tipo:'warn', txt:`${emAtraso} operação${emAtraso>1?'ões':''} acima do limite de 90 minutos`, sub:'Verificar disponibilidade de equipe e recursos nas docas afetadas' });
    else if (entries.length > 0) msgs.push({ icon:'✅', tipo:'good', txt:'Todas as operações dentro do SLA', sub:'Nenhuma conferência acima do limite — operação eficiente' });
  }

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,var(--surf),rgba(245,158,11,.05));
      border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="position:relative;width:36px;height:36px;background:linear-gradient(135deg,#f59e0b,#d97706);
          border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;
          box-shadow:0 0 16px rgba(245,158,11,.35);animation:pulse-acc 3s infinite;flex-shrink:0">
          🧠
        </div>
        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;
            letter-spacing:1px;color:var(--txt)">IA OPERACIONAL AUTÔNOMA</div>
          <div style="font-size:10px;color:var(--mut)">Análise contínua · ${entries.length} operações analisadas</div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:5px">
          <div style="width:6px;height:6px;border-radius:50%;background:#10b981;animation:pulse-grn 1.5s infinite"></div>
          <span style="font-size:10px;color:#10b981;font-weight:700">ATIVO</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${msgs.map(m => {
          const cores = {
            crit: { bg:'rgba(239,68,68,.08)', bord:'rgba(239,68,68,.3)', left:'#ef4444' },
            warn: { bg:'rgba(245,158,11,.08)', bord:'rgba(245,158,11,.3)', left:'#f59e0b' },
            good: { bg:'rgba(16,185,129,.08)', bord:'rgba(16,185,129,.3)', left:'#10b981' },
            info: { bg:'rgba(59,130,246,.08)', bord:'rgba(59,130,246,.3)', left:'#3b82f6' },
          };
          const c = cores[m.tipo] || cores.info;
          return `
            <div style="background:${c.bg};border:1px solid ${c.bord};border-left:3px solid ${c.left};
              border-radius:8px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:18px;flex-shrink:0">${m.icon}</span>
              <div>
                <div style="font-size:12px;font-weight:700;color:var(--txt);line-height:1.4">${m.txt}</div>
                <div style="font-size:10px;color:var(--mut);margin-top:3px;line-height:1.4">${m.sub}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   4. ALERTAS OPERACIONAIS
════════════════════════════════════════════════════════════ */
function _anAlertas(entries) {
  const el = document.getElementById('an-alertas');
  if (!el) return;

  const alertas = [];
  const duracoes = entries.map(h => _duracaoMin(h)).filter(v => v && v > 0 && v < 480);
  const medGlobal = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;

  // Docas críticas
  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim()||'?';
    if (!byDoca[d]) byDoca[d] = { count:0, durs:[] };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);
  });

  Object.entries(byDoca).forEach(([doca, v]) => {
    const med = v.durs.length ? v.durs.reduce((a,b)=>a+b,0)/v.durs.length : null;
    if (med && medGlobal && med > medGlobal * 1.5) {
      alertas.push({ nivel:'crit', icon:'🚨', titulo:`Doca ${doca} — risco crítico`, desc:`${Math.round(med)}min médio vs ${Math.round(medGlobal)}min geral · ${v.count} operações` });
    } else if (med && medGlobal && med > medGlobal * 1.2) {
      alertas.push({ nivel:'warn', icon:'⚠️', titulo:`Doca ${doca} — atenção`, desc:`Tempo acima da média — ${Math.round(med)}min` });
    }
  });

  // Sem atividade
  if (!entries.length) {
    alertas.push({ nivel:'info', icon:'📡', titulo:'Monitoramento ativo', desc:'Nenhuma conferência registrada no período · IA em standby' });
  }

  if (!alertas.length) {
    alertas.push({ nivel:'ok', icon:'✅', titulo:'Operação sem alertas', desc:'Todas as métricas dentro dos parâmetros normais' });
  }

  const cores = {
    crit: { bg:'rgba(239,68,68,.08)', bord:'#ef4444', badge:'#ef4444' },
    warn: { bg:'rgba(245,158,11,.08)', bord:'#f59e0b', badge:'#f59e0b' },
    info: { bg:'rgba(59,130,246,.08)', bord:'#3b82f6', badge:'#3b82f6' },
    ok:   { bg:'rgba(16,185,129,.08)', bord:'#10b981', badge:'#10b981' },
  };

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${alertas.map(a => {
        const c = cores[a.nivel];
        return `
          <div style="background:${c.bg};border:1px solid ${c.bord}40;border-left:3px solid ${c.bord};
            border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px">
            <span style="font-size:20px;flex-shrink:0">${a.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;color:var(--txt)">${a.titulo}</div>
              <div style="font-size:10px;color:var(--mut);margin-top:2px">${a.desc}</div>
            </div>
            <span style="background:${c.badge}20;color:${c.badge};border:1px solid ${c.badge}40;
              border-radius:4px;font-size:9px;font-weight:800;padding:2px 7px;letter-spacing:.5px;
              flex-shrink:0;font-family:'Barlow Condensed',sans-serif">${a.nivel.toUpperCase()}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   5. MAPA DE DOCAS (HEATMAP)
════════════════════════════════════════════════════════════ */
function _anMapaDocs(entries) {
  const el = document.getElementById('an-mapa-docas');
  if (!el) return;

  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim()||'?';
    if (!byDoca[d]) byDoca[d] = { count:0, durs:[] };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);
  });

  const docas = Object.entries(byDoca)
    .map(([doca, v]) => ({
      doca,
      count: v.count,
      med: v.durs.length ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length) : null
    }))
    .sort((a,b) => parseInt(a.doca) - parseInt(b.doca));

  const maxCount = Math.max(...docas.map(d => d.count), 1);

  // Docas ativas no live strip
  const docasLive = new Set();
  document.querySelectorAll('.live-chip.ativa, .live-chip.conf').forEach(chip => {
    const m = chip.textContent?.match(/(\d+)/);
    if (m) docasLive.add(m[1]);
  });

  el.innerHTML = docas.length ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:5px">
      ${docas.map(d => {
        const intensidade = d.count / maxCount;
        const isLive = docasLive.has(d.doca);
        const cor = isLive ? '#10b981' : intensidade > 0.7 ? '#ef4444' : intensidade > 0.4 ? '#f59e0b' : '#3b82f6';
        return `
          <div style="background:rgba(${cor==='#10b981'?'16,185,129':cor==='#ef4444'?'239,68,68':cor==='#f59e0b'?'245,158,11':'59,130,246'},${0.08 + intensidade * 0.15});
            border:1px solid ${cor}50;border-radius:8px;padding:8px 4px;text-align:center;
            position:relative;${isLive ? `box-shadow:0 0 10px ${cor}40;` : ''}">
            ${isLive ? `<div style="position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:${cor};animation:pulse-grn 1.5s infinite"></div>` : ''}
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:15px;color:var(--txt)">D${d.doca}</div>
            <div style="font-size:9px;color:${cor};font-weight:700;margin-top:1px">${d.count} OC${d.count>1?'s':''}</div>
            ${d.med ? `<div style="font-size:8px;color:var(--mut);margin-top:1px">${_fmtMin(d.med)}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
      ${[['#10b981','● Ativa agora'],['#3b82f6','● Baixo volume'],['#f59e0b','● Médio volume'],['#ef4444','● Alto volume']].map(([c,l])=>`<span style="font-size:9px;color:${c};font-weight:700">${l}</span>`).join('')}
    </div>
  ` : `<div style="text-align:center;color:var(--mut);font-size:12px;padding:20px">Nenhuma doca com dados no período</div>`;
}

/* ════════════════════════════════════════════════════════════
   6. GRÁFICOS
════════════════════════════════════════════════════════════ */
function _anGraficos(entries) {
  _anGraficoLinhaHora(entries);
  _anGraficoTempoDocas(entries);
  _anHeatmapDocas(entries);
  _anGraficoTransp(entries);
}

function _anGraficoLinhaHora(entries) {
  const canvas = document.getElementById('an-chart-hora');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 320;
  canvas.width = W; canvas.height = 140;
  const H = 140;
  ctx.clearRect(0, 0, W, H);

  if (!entries.length) { _anCanvasEmpty(ctx, W, H, 'Sem dados'); return; }

  const porHora = {};
  entries.forEach(h => { const hr = new Date(h.data).getHours(); porHora[hr] = (porHora[hr]||0)+1; });
  const horas  = Object.keys(porHora).map(Number).sort((a,b)=>a-b);
  const vals   = horas.map(h => porHora[h]);
  const max    = Math.max(...vals, 1);
  const PAD    = {top:16,right:10,bottom:26,left:28};
  const step   = (W-PAD.left-PAD.right) / Math.max(horas.length-1, 1);

  // Grid
  for (let i = 0; i <= 3; i++) {
    const y = PAD.top + (H-PAD.top-PAD.bottom) * (1-i/3);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W-PAD.right, y); ctx.stroke();
    ctx.fillStyle = '#4a5568'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max*i/3), PAD.left-3, y+3);
  }

  const pts = horas.map((h,i) => ({ x: PAD.left+i*step, y: PAD.top+(H-PAD.top-PAD.bottom)*(1-porHora[h]/max) }));

  // Gradiente área
  const grad = ctx.createLinearGradient(0, PAD.top, 0, H-PAD.bottom);
  grad.addColorStop(0, '#8b5cf666'); grad.addColorStop(1, '#8b5cf600');
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i=1;i<pts.length;i++) { const cp={x:(pts[i-1].x+pts[i].x)/2,y:(pts[i-1].y+pts[i].y)/2}; ctx.quadraticCurveTo(pts[i-1].x,pts[i-1].y,cp.x,cp.y); }
  ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y); ctx.lineTo(pts[pts.length-1].x,H-PAD.bottom); ctx.lineTo(pts[0].x,H-PAD.bottom); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Linha
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for (let i=1;i<pts.length;i++) { const cp={x:(pts[i-1].x+pts[i].x)/2,y:(pts[i-1].y+pts[i].y)/2}; ctx.quadraticCurveTo(pts[i-1].x,pts[i-1].y,cp.x,cp.y); }
  ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);
  ctx.strokeStyle='#8b5cf6'; ctx.lineWidth=2.5; ctx.stroke();

  // Pontos + labels
  pts.forEach((p,i) => {
    ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fillStyle='#8b5cf6'; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x,p.y,2,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
    ctx.fillStyle='#f59e0b'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
    ctx.fillText(vals[i], p.x, p.y-8);
    ctx.fillStyle='#4a5568'; ctx.font='9px sans-serif';
    ctx.fillText(horas[i]+'h', p.x, H-PAD.bottom+14);
  });
}

function _anGraficoTempoDocas(entries) {
  const canvas = document.getElementById('an-chart-tempo-docas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 280;
  canvas.width = W; canvas.height = 140;
  const H = 140;
  ctx.clearRect(0, 0, W, H);

  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim()||'?';
    if (!byDoca[d]) byDoca[d] = [];
    const dur = _duracaoMin(h); if (dur) byDoca[d].push(dur);
  });

  const data = Object.entries(byDoca)
    .map(([d, durs]) => ({ d, med: durs.length ? Math.round(durs.reduce((a,b)=>a+b,0)/durs.length) : 0 }))
    .filter(x => x.med > 0).sort((a,b) => b.med-a.med).slice(0, 7);

  if (!data.length) { _anCanvasEmpty(ctx, W, H, 'Sem dados'); return; }

  const max = Math.max(...data.map(d => d.med), 1);
  const bW  = (W - 40) / data.length - 6;
  const PAD = { top:16, bottom:24 };

  data.forEach((d, i) => {
    const bH  = (H - PAD.top - PAD.bottom) * (d.med / max);
    const x   = 20 + i * ((W-40)/data.length);
    const y   = H - PAD.bottom - bH;
    const cor = d.med > 90 ? '#ef4444' : d.med > 60 ? '#f59e0b' : '#10b981';

    const g = ctx.createLinearGradient(0, y, 0, H-PAD.bottom);
    g.addColorStop(0, cor+'cc'); g.addColorStop(1, cor+'22');
    ctx.fillStyle = g;
    const r = Math.min(4, bW/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+bW-r, y);
    ctx.quadraticCurveTo(x+bW, y, x+bW, y+r);
    ctx.lineTo(x+bW, H-PAD.bottom); ctx.lineTo(x, H-PAD.bottom); ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y); ctx.fill();

    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(_fmtMin(d.med), x+bW/2, y-4);
    ctx.fillStyle = '#4a5568'; ctx.font = '9px sans-serif';
    ctx.fillText('D'+d.d, x+bW/2, H-PAD.bottom+12);
  });
}

function _anHeatmapDocas(entries) {
  const canvas = document.getElementById('an-chart-heatmap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 320;
  canvas.width = W; canvas.height = 120;
  ctx.clearRect(0, 0, W, 120);

  const byDocaHora = {};
  entries.forEach(h => {
    const d  = h.doca?.trim()||'?';
    const hr = new Date(h.data).getHours();
    if (!byDocaHora[d]) byDocaHora[d] = {};
    byDocaHora[d][hr] = (byDocaHora[d][hr]||0) + 1;
  });

  const docas = Object.keys(byDocaHora).slice(0, 6);
  const horas = Array.from({length:12}, (_,i) => i*2);
  if (!docas.length) { _anCanvasEmpty(ctx, W, 120, 'Sem dados'); return; }

  const cW = (W - 40) / horas.length;
  const cH = (120 - 20) / docas.length;
  const maxVal = Math.max(...docas.flatMap(d => horas.map(h => byDocaHora[d]?.[h]||0)), 1);

  docas.forEach((doca, di) => {
    ctx.fillStyle = '#64748b'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('D'+doca, 36, 20 + di * cH + cH/2 + 3);
    horas.forEach((h, hi) => {
      const val = byDocaHora[doca]?.[h] || 0;
      const int = val / maxVal;
      ctx.fillStyle = `rgba(245,158,11,${0.05 + int * 0.85})`;
      ctx.fillRect(40 + hi * cW + 1, 20 + di * cH + 1, cW - 2, cH - 2);
      if (val > 0) { ctx.fillStyle='#fff'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.fillText(val, 40+hi*cW+cW/2, 20+di*cH+cH/2+3); }
    });
  });
  horas.forEach((h, hi) => {
    ctx.fillStyle='#4a5568'; ctx.font='8px sans-serif'; ctx.textAlign='center';
    ctx.fillText(h+'h', 40+hi*cW+cW/2, 16);
  });
}

function _anGraficoTransp(entries) {
  const canvas = document.getElementById('an-chart-transp');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = Math.min(canvas.offsetWidth||140, 140);
  canvas.width = S; canvas.height = S;
  ctx.clearRect(0, 0, S, S);

  const byT = {};
  entries.forEach(h => { const t=h.transportadora?.trim()||'Outros'; byT[t]=(byT[t]||0)+1; });
  const data = Object.entries(byT).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if (!data.length) { _anCanvasEmpty(ctx, S, S, 'Sem dados'); return; }

  const total = data.reduce((s,[,v])=>s+v,0);
  let angle = -Math.PI/2;
  const cx=S/2, cy=S/2, r=S*0.42, rIn=S*0.24;

  data.forEach(([,v],i) => {
    const slice = (v/total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,angle,angle+slice); ctx.closePath();
    ctx.fillStyle = AN_COLORS[i % AN_COLORS.length]; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=1; ctx.stroke();
    angle += slice;
  });

  // Buraco central
  ctx.beginPath(); ctx.arc(cx,cy,rIn,0,Math.PI*2);
  ctx.fillStyle='var(--surf)'; ctx.fill();
  ctx.fillStyle='#94a3b8'; ctx.font='bold 9px Barlow,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(total+' OCs', cx, cy);
}

/* ════════════════════════════════════════════════════════════
   7. RANKINGS
════════════════════════════════════════════════════════════ */
function _anRankings(entries) {
  _anRankingDocas(entries);
  _anRankingTransp(entries);
  _anRankingConferentes(entries);
}

function _anRankingDocas(entries) {
  const el = document.getElementById('an-rank-docas');
  if (!el) return;

  const byDoca = {};
  entries.forEach(h => {
    const d = h.doca?.trim()||'?';
    if (!byDoca[d]) byDoca[d] = { count:0, durs:[] };
    byDoca[d].count++;
    const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);
  });

  const data = Object.entries(byDoca)
    .map(([d,v]) => ({ d, count:v.count, med: v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null }))
    .sort((a,b) => b.count-a.count).slice(0, 5);

  const maxCount = Math.max(...data.map(d=>d.count), 1);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];

  el.innerHTML = data.length ? data.map((d,i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bord)">
      <span style="font-size:16px;width:22px;text-align:center;flex-shrink:0">${medals[i]}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:12px;color:var(--txt)">Doca ${d.d}</div>
        <div style="height:3px;background:var(--bord);border-radius:2px;margin-top:4px;overflow:hidden">
          <div style="height:100%;width:${d.count/maxCount*100}%;background:${AN_COLORS[i]};border-radius:2px;transition:width .7s"></div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:${AN_COLORS[i]}">${d.count}</div>
        ${d.med ? `<div style="font-size:9px;color:var(--mut)">${_fmtMin(d.med)}</div>` : ''}
      </div>
    </div>
  `).join('') : '<div style="color:var(--mut);font-size:12px;padding:12px 0">Sem dados</div>';
}

function _anRankingTransp(entries) {
  const el = document.getElementById('an-rank-transp');
  if (!el) return;

  const byT = {};
  entries.forEach(h => { const t=h.transportadora?.trim()||'?'; if (!byT[t]) byT[t]={count:0,durs:[]}; byT[t].count++; const d=_duracaoMin(h); if(d) byT[t].durs.push(d); });
  const data = Object.entries(byT).filter(([k])=>k!=='?').map(([n,v])=>({ n, count:v.count, med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null })).sort((a,b)=>b.count-a.count).slice(0,5);
  const maxCount = Math.max(...data.map(d=>d.count),1);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];

  el.innerHTML = data.length ? data.map((d,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bord)">
      <span style="font-size:16px;width:22px;text-align:center;flex-shrink:0">${medals[i]}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:11px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.n}</div>
        <div style="height:3px;background:var(--bord);border-radius:2px;margin-top:4px;overflow:hidden">
          <div style="height:100%;width:${d.count/maxCount*100}%;background:${AN_COLORS[i]};border-radius:2px;transition:width .7s"></div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:${AN_COLORS[i]}">${d.count}</div>
        ${d.med?`<div style="font-size:9px;color:var(--mut)">${_fmtMin(d.med)}</div>`:''}
      </div>
    </div>
  `).join('') : '<div style="color:var(--mut);font-size:12px;padding:12px 0">Sem dados</div>';
}

function _anRankingConferentes(entries) {
  const el = document.getElementById('an-equipes');
  if (!el) return;

  const byConf = {};
  entries.forEach(h => { const c=h.conf?.trim()||'?'; if(!byConf[c]) byConf[c]={count:0,durs:[]}; byConf[c].count++; const d=_duracaoMin(h); if(d) byConf[c].durs.push(d); });
  const data = Object.entries(byConf).filter(([k])=>k!=='?').map(([n,v])=>({ n, count:v.count, med:v.durs.length?Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length):null })).sort((a,b)=>b.count-a.count).slice(0,5);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];

  el.innerHTML = data.length ? data.map((d,i)=>`
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;
      background:var(--surf2);border:1px solid ${i===0?'rgba(245,158,11,.3)':'var(--bord)'};
      border-radius:10px;margin-bottom:6px;
      ${i===0?'box-shadow:0 2px 12px rgba(245,158,11,.08)':''}">
      <span style="font-size:22px;flex-shrink:0">${medals[i]}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:var(--txt)">${d.n}</div>
        <div style="font-size:11px;color:var(--mut);margin-top:1px">${d.count} conferências${d.med?` · ${_fmtMin(d.med)} médio`:''}</div>
        <div style="height:3px;background:var(--bord);border-radius:2px;margin-top:6px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100,d.count*10)}%;background:${AN_COLORS[i]};border-radius:2px"></div>
        </div>
      </div>
      <div style="text-align:center;flex-shrink:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:${AN_COLORS[i]};line-height:1">${d.count}</div>
        <div style="font-size:9px;color:var(--mut)">OCs</div>
      </div>
    </div>
  `).join('') : '<div style="color:var(--mut);font-size:12px;padding:16px">Nenhum conferente com dados no período</div>';
}

/* ════════════════════════════════════════════════════════════
   8. FEED OPERACIONAL AO VIVO
════════════════════════════════════════════════════════════ */
function _anFeedVivo(entries) {
  const el = document.getElementById('an-feed-vivo');
  if (!el) return;

  // Coleta eventos dos últimos registros
  const recentes = [...entries].sort((a,b) => new Date(b.data)-new Date(a.data)).slice(0, 15);

  if (!recentes.length) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;color:var(--mut);font-size:12px;padding:10px">
        <div style="width:6px;height:6px;border-radius:50%;background:var(--mut);animation:pulse-grn 2s infinite"></div>
        Monitorando operação em tempo real — sem movimentações recentes
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
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bord)">
        <div style="width:6px;height:6px;border-radius:50%;background:${cor};flex-shrink:0;animation:pulse-grn 3s infinite"></div>
        <span style="font-size:10px;color:var(--mut);flex-shrink:0;min-width:36px">${hora}</span>
        <span style="font-size:14px;flex-shrink:0">${icon}</span>
        <div style="flex:1;min-width:0;font-size:11px;color:var(--txt)">
          <span style="font-weight:700">D${h.doca||'?'}</span>
          ${h.transportadora ? ` · ${h.transportadora}` : ''}
          ${h.oc ? ` · OC ${h.oc}` : ''}
          ${h.conf ? ` · ${h.conf}` : ''}
        </div>
        ${dur ? `<span style="font-size:10px;color:${cor};font-weight:700;flex-shrink:0">${_fmtMin(dur)}</span>` : ''}
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   9. PREVISÃO IA
════════════════════════════════════════════════════════════ */
function _anPrevisao(entries) {
  const el = document.getElementById('an-previsao');
  if (!el) return;

  const previsoes = [];
  const duracoes  = entries.map(h => _duracaoMin(h)).filter(v => v && v > 0 && v < 480);
  const medGlobal = duracoes.length ? duracoes.reduce((a,b)=>a+b,0)/duracoes.length : null;
  const hora      = new Date().getHours();

  if (!entries.length) {
    previsoes.push({ icon:'📡', nivel:'info', titulo:'IA em modo de aprendizado', desc:'Registre mais operações para ativar previsões avançadas', val:'' });
    previsoes.push({ icon:'🧠', nivel:'info', titulo:'Monitoramento ativo', desc:'Sistema analisando padrões logísticos e histórico operacional', val:'' });
  } else {
    // Congestionamento
    const byDoca = {};
    entries.forEach(h => { const d=h.doca?.trim()||'?'; if(!byDoca[d]) byDoca[d]={count:0,durs:[]}; byDoca[d].count++; const dur=_duracaoMin(h); if(dur) byDoca[d].durs.push(dur); });
    const docaCong = Object.entries(byDoca).map(([d,v])=>({ d, count:v.count, med:v.durs.length?v.durs.reduce((a,b)=>a+b,0)/v.durs.length:null })).filter(x=>x.med&&medGlobal&&x.med>medGlobal*1.3).sort((a,b)=>b.med-a.med)[0];
    if (docaCong) previsoes.push({ icon:'🚨', nivel:'crit', titulo:`Risco de congestionamento — Doca ${docaCong.d}`, desc:`Tendência de atraso detectada · tempo médio ${Math.round(docaCong.med)}min vs ${Math.round(medGlobal)}min geral`, val:'ALTO' });

    // Transportadora problema
    const byT = {};
    entries.forEach(h => { const t=h.transportadora?.trim()||'?'; if(!byT[t]) byT[t]={durs:[]}; const d=_duracaoMin(h); if(d) byT[t].durs.push(d); });
    const transpProb = Object.entries(byT).filter(([k])=>k!=='?').map(([n,v])=>({ n, med:v.durs.length?v.durs.reduce((a,b)=>a+b,0)/v.durs.length:null })).filter(x=>x.med&&medGlobal&&x.med>medGlobal*1.3).sort((a,b)=>b.med-a.med)[0];
    if (transpProb) previsoes.push({ icon:'⚠️', nivel:'warn', titulo:`${transpProb.n} — tendência de atraso`, desc:`Tempo médio histórico ${Math.round(transpProb.med)}min · acima da média operacional`, val:_fmtMin(Math.round(transpProb.med)) });

    // Próxima hora
    const proxima = (hora+1)%24;
    const ricoHorario = entries.filter(h => new Date(h.data).getHours() === proxima).length;
    if (ricoHorario > 2) previsoes.push({ icon:'📈', nivel:'warn', titulo:`Pico esperado às ${proxima}h`, desc:`Baseado no histórico: ${ricoHorario} operações registradas neste horário`, val:ricoHorario+' OCs' });
    else previsoes.push({ icon:'📊', nivel:'info', titulo:'Próxima hora dentro do normal', desc:`Previsão de atividade moderada para as ${proxima}h`, val:'' });
  }

  const cores = { crit:'#ef4444', warn:'#f59e0b', info:'#3b82f6', ok:'#10b981' };
  el.innerHTML = previsoes.map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;
      background:var(--surf2);border:1px solid var(--bord);
      border-left:3px solid ${cores[p.nivel]||'#3b82f6'};
      border-radius:0 10px 10px 0;margin-bottom:6px">
      <span style="font-size:22px;flex-shrink:0">${p.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:12px;color:var(--txt)">${p.titulo}</div>
        <div style="font-size:10px;color:var(--mut);margin-top:3px;line-height:1.4">${p.desc}</div>
      </div>
      ${p.val ? `<div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:${cores[p.nivel]};flex-shrink:0;text-align:right">${p.val}</div>` : ''}
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   AUTO-REFRESH
════════════════════════════════════════════════════════════ */
function _anIniciarAutoRefresh() {
  if (_anRefreshTimer) clearInterval(_anRefreshTimer);
  _anRefreshTimer = setInterval(() => {
    const tabEl = document.getElementById('tab-analytics');
    if (tabEl && tabEl.style.display !== 'none') renderAnalytics();
  }, 60000);
}

/* ════════════════════════════════════════════════════════════
   CSS ENTERPRISE INJETADO
════════════════════════════════════════════════════════════ */
(function _anCSS() {
  if (document.getElementById('an-css-f15')) return;
  const s = document.createElement('style');
  s.id = 'an-css-f15';
  s.textContent = `
    /* KPI Grid */
    #an-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    @media (max-width: 640px) {
      #an-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }

    /* Charts duo */
    .an-charts-duo {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }
    @media (max-width: 540px) { .an-charts-duo { grid-template-columns: 1fr; } }

    /* Rankings duo */
    .an-rankings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }
    @media (max-width: 540px) { .an-rankings-grid { grid-template-columns: 1fr; } }

    /* Chart card */
    .an-chart-card {
      background: var(--surf);
      border: 1px solid var(--bord);
      border-radius: 12px;
      padding: 12px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .an-chart-card canvas { width: 100% !important; display: block; }
    .an-chart-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 800;
      color: var(--mut);
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    /* Seções */
    .an-section-card {
      background: var(--surf);
      border: 1px solid var(--bord);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .an-section-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 12px;
      font-weight: 900;
      color: var(--mut);
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Animações */
    @keyframes pulse-acc {
      0%, 100% { box-shadow: 0 0 16px rgba(245,158,11,.35); }
      50%       { box-shadow: 0 0 28px rgba(245,158,11,.6); }
    }
    @keyframes pulse-grn {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: .6; transform: scale(1.2); }
    }
    @keyframes fadeUp {
      from { opacity:0; transform:translateY(8px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .an-section-card, .an-chart-card { animation: fadeUp .35s ease; }

    /* Feed */
    #an-feed-vivo { max-height: 240px; overflow-y: auto; }
    #an-feed-vivo::-webkit-scrollbar { width: 3px; }
    #an-feed-vivo::-webkit-scrollbar-track { background: transparent; }
    #an-feed-vivo::-webkit-scrollbar-thumb { background: var(--bord2); border-radius: 2px; }
  `;
  document.head.appendChild(s);
})();
