/* ════════════════════════════════════════════════════════════
   DOCKCHECK PRO — IA AUTÔNOMA OPERACIONAL · Fase 15

   Funcionalidades:
   1. Monitoramento contínuo e aprendizado de padrões
   2. Previsão de congestionamentos e gargalos
   3. Auto-otimização de docas
   4. Torre de controle em tempo real
   5. Assistente IA conversacional com contexto operacional
   6. Decisões automáticas inteligentes
   7. Analytics enterprise com insights preditivos
════════════════════════════════════════════════════════════ */

'use strict';

/* ── Constantes ─────────────────────────────────────────── */
const IA_AUTO_TICK_MS  = 60_000;   // Análise a cada 1 min
const IA_LEARN_KEY     = 'dc_ia_aprendizado_v1';
const IA_INSIGHTS_KEY  = 'dc_ia_insights_v1';
const IA_MAX_INSIGHTS  = 50;

/* ── Estado ─────────────────────────────────────────────── */
let _iaInited      = false;
let _iaTick        = null;
let _aprendizado   = {};   // padrões aprendidos
let _insights      = [];   // insights gerados
let _torreAtiva    = false;
let _chatHistorico = [];   // histórico do assistente

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */
function iaAutonoInit() {
  if (_iaInited) return;
  _iaInited = true;

  _carregarAprendizado();
  _carregarInsights();
  _iniciarMonitoramento();

  console.info('[IA Autônoma] Iniciada — aprendizado carregado.');
}

/* ════════════════════════════════════════════════════════════
   MONITORAMENTO CONTÍNUO
════════════════════════════════════════════════════════════ */
function _iniciarMonitoramento() {
  if (_iaTick) clearInterval(_iaTick);
  _iaTick = setInterval(_cicloAprendizado, IA_AUTO_TICK_MS);
  setTimeout(_cicloAprendizado, 3000);
}

async function _cicloAprendizado() {
  const ctx = _coletarContextoCompleto();
  _aprenderPadroes(ctx);
  _gerarPrevisoes(ctx);
  _detectarAnomalias(ctx);
  _atualizarTorre();
}

/* ════════════════════════════════════════════════════════════
   COLETA DE CONTEXTO COMPLETO
════════════════════════════════════════════════════════════ */
function _coletarContextoCompleto() {
  const ctx = {
    timestamp:    Date.now(),
    hora:         new Date().getHours(),
    diaSemana:    new Date().getDay(),
    docas:        [],
    fila:         [],
    historico_hoje: [],
    historico_semana: [],
    transportadoras: {},
    conferentes:    {},
    tempo_medio_geral: 0,
  };

  try {
    // Docas ativas
    document.querySelectorAll('.live-chip').forEach(chip => {
      const txt   = chip.textContent || '';
      const doca  = txt.match(/(\d+)/)?.[1] || '?';
      const ativa = chip.classList.contains('ativa') || chip.classList.contains('conf');
      const tempo = _extrairTempo(chip);
      ctx.docas.push({ doca, ativa, tempo, txt });
    });

    // Histórico
    if (typeof historico !== 'undefined' && Array.isArray(historico)) {
      const hoje    = new Date().toDateString();
      const semana  = Date.now() - 7 * 86400000;

      ctx.historico_hoje   = historico.filter(h =>
        new Date(h.timestamp || h.data || 0).toDateString() === hoje
      );
      ctx.historico_semana = historico.filter(h =>
        (h.timestamp || 0) > semana
      );

      // Estatísticas por transportadora e conferente
      ctx.historico_semana.forEach(h => {
        if (h.transportadora) {
          if (!ctx.transportadoras[h.transportadora])
            ctx.transportadoras[h.transportadora] = { cargas: 0, durs: [], atrasos: 0 };
          ctx.transportadoras[h.transportadora].cargas++;
          const dur = _duracaoMin(h);
          if (dur) {
            ctx.transportadoras[h.transportadora].durs.push(dur);
            if (dur > 60) ctx.transportadoras[h.transportadora].atrasos++;
          }
        }
        if (h.conf) {
          if (!ctx.conferentes[h.conf])
            ctx.conferentes[h.conf] = { cargas: 0, durs: [] };
          ctx.conferentes[h.conf].cargas++;
          const dur = _duracaoMin(h);
          if (dur) ctx.conferentes[h.conf].durs.push(dur);
        }
      });

      // Tempo médio geral
      const durs = ctx.historico_semana
        .map(h => _duracaoMin(h))
        .filter(Boolean);
      ctx.tempo_medio_geral = durs.length
        ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length)
        : 0;
    }
  } catch (e) {
    console.warn('[IA Auto] Erro coleta:', e);
  }

  return ctx;
}

function _extrairTempo(chip) {
  const inicio = chip.dataset?.inicio;
  if (inicio) return Math.floor((Date.now() - Number(inicio)) / 60000);
  const txt = chip.textContent || '';
  const m = txt.match(/(\d+)\s*min/);
  return m ? parseInt(m[1]) : 0;
}

function _duracaoMin(h) {
  if (!h.inicio && !h.fim) return null;
  const i = new Date(h.inicio || h.timestamp || 0).getTime();
  const f = new Date(h.fim || h.timestamp || 0).getTime();
  const d = Math.round((f - i) / 60000);
  return d > 0 && d < 600 ? d : null;
}

/* ════════════════════════════════════════════════════════════
   APRENDIZADO DE PADRÕES
════════════════════════════════════════════════════════════ */
function _aprenderPadroes(ctx) {
  const hora = ctx.hora;

  if (!_aprendizado.por_hora) _aprendizado.por_hora = {};
  if (!_aprendizado.por_hora[hora]) _aprendizado.por_hora[hora] = { amostras: 0, docas_ativas: 0, fila_media: 0 };

  const h = _aprendizado.por_hora[hora];
  h.amostras++;
  h.docas_ativas = Math.round((h.docas_ativas * (h.amostras - 1) + ctx.docas.filter(d => d.ativa).length) / h.amostras);
  h.fila_media   = Math.round((h.fila_media * (h.amostras - 1) + ctx.fila.length) / h.amostras);

  // Aprende padrões de transportadoras
  if (!_aprendizado.transportadoras) _aprendizado.transportadoras = {};
  Object.entries(ctx.transportadoras).forEach(([nome, dados]) => {
    if (!_aprendizado.transportadoras[nome]) _aprendizado.transportadoras[nome] = { tempo_medio: 0, amostras: 0 };
    const t = _aprendizado.transportadoras[nome];
    const med = dados.durs.length ? dados.durs.reduce((a, b) => a + b, 0) / dados.durs.length : 0;
    if (med > 0) {
      t.amostras++;
      t.tempo_medio = Math.round((t.tempo_medio * (t.amostras - 1) + med) / t.amostras);
    }
  });

  _salvarAprendizado();
}

/* ════════════════════════════════════════════════════════════
   PREVISÕES OPERACIONAIS
════════════════════════════════════════════════════════════ */
function _gerarPrevisoes(ctx) {
  const previsoes = [];
  const horaAtual = ctx.hora;
  const proximaHora = (horaAtual + 1) % 24;

  // Previsão de pico baseada no aprendizado
  const dadosProxHora = _aprendizado.por_hora?.[proximaHora];
  if (dadosProxHora && dadosProxHora.amostras >= 3) {
    if (dadosProxHora.docas_ativas > (ctx.docas.filter(d => d.ativa).length * 1.3)) {
      previsoes.push({
        tipo: 'pico',
        nivel: 'warn',
        msg: `📈 Previsão: aumento de atividade às ${proximaHora}h baseado em histórico`,
        confianca: Math.min(95, dadosProxHora.amostras * 10),
      });
    }
  }

  // Previsão de congestionamento por doca lenta
  ctx.docas.filter(d => d.ativa && d.tempo > (ctx.tempo_medio_geral || 60) * 1.5).forEach(d => {
    previsoes.push({
      tipo: 'congestionamento',
      nivel: 'crit',
      msg: `🚨 Doca ${d.doca} com risco de congestionamento — ${d.tempo}min acima da média`,
      confianca: 85,
    });
  });

  // Previsão por transportadora com histórico de atraso
  Object.entries(_aprendizado.transportadoras || {}).forEach(([nome, dados]) => {
    if (dados.tempo_medio > (ctx.tempo_medio_geral || 60) * 1.4 && dados.amostras >= 3) {
      const docaTransp = ctx.docas.find(d => d.txt?.includes(nome));
      if (docaTransp) {
        previsoes.push({
          tipo: 'transportadora',
          nivel: 'warn',
          msg: `⚠️ ${nome} apresenta tendência de atraso (média histórica: ${dados.tempo_medio}min)`,
          confianca: Math.min(90, dados.amostras * 8),
        });
      }
    }
  });

  if (previsoes.length) _adicionarInsights(previsoes, 'previsao');
}

/* ════════════════════════════════════════════════════════════
   DETECÇÃO DE ANOMALIAS
════════════════════════════════════════════════════════════ */
function _detectarAnomalias(ctx) {
  const anomalias = [];

  // Doca muito acima da média
  const limiteAnom = (ctx.tempo_medio_geral || 60) * 2;
  ctx.docas.filter(d => d.ativa && d.tempo > limiteAnom).forEach(d => {
    anomalias.push({
      tipo: 'anomalia_tempo',
      nivel: 'crit',
      msg: `🔴 Anomalia detectada: Doca ${d.doca} com ${d.tempo}min — ${Math.round(d.tempo / (ctx.tempo_medio_geral || 60) * 100)}% acima da média`,
      confianca: 92,
    });
  });

  // Queda de produtividade (menos conferências que o esperado)
  const horaAtual = ctx.hora;
  const esperado  = _aprendizado.por_hora?.[horaAtual]?.docas_ativas || 0;
  const atual     = ctx.docas.filter(d => d.ativa).length;
  if (esperado > 2 && atual < esperado * 0.5) {
    anomalias.push({
      tipo: 'queda_prod',
      nivel: 'warn',
      msg: `📉 Queda de produtividade detectada — ${atual} docas ativas (esperado: ~${esperado})`,
      confianca: 78,
    });
  }

  if (anomalias.length) _adicionarInsights(anomalias, 'anomalia');
}

/* ════════════════════════════════════════════════════════════
   INSIGHTS
════════════════════════════════════════════════════════════ */
function _adicionarInsights(novos, tipo) {
  novos.forEach(insight => {
    _insights.unshift({ ...insight, tipo, timestamp: new Date().toISOString() });
  });
  _insights = _insights.slice(0, IA_MAX_INSIGHTS);
  _salvarInsights();
  _atualizarTorre();

  // Badge na aba IA
  const badge = document.getElementById('ia-auto-badge');
  if (badge) {
    const count = parseInt(badge.textContent || '0') + novos.length;
    badge.textContent = count;
    badge.style.display = 'flex';
  }
}

/* ════════════════════════════════════════════════════════════
   TORRE DE CONTROLE
════════════════════════════════════════════════════════════ */
function _atualizarTorre() {
  const torre = document.getElementById('ia-torre-feed');
  if (!torre) return;

  const recentes = _insights.slice(0, 10);
  if (!recentes.length) return;

  torre.innerHTML = recentes.map(ins => {
    const cores = {
      crit: { bg: 'rgba(239,68,68,.1)', bord: '#ef4444', icon: '🔴' },
      warn: { bg: 'rgba(245,158,11,.1)', bord: '#f59e0b', icon: '⚠️' },
      info: { bg: 'rgba(59,130,246,.1)', bord: '#3b82f6', icon: 'ℹ️' },
      ok:   { bg: 'rgba(16,185,129,.1)', bord: '#10b981', icon: '✅' },
    };
    const c    = cores[ins.nivel] || cores.info;
    const hora = new Date(ins.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `
      <div style="background:${c.bg};border:1px solid ${c.bord};border-left:3px solid ${c.bord};
        border-radius:8px;padding:10px 12px;margin-bottom:6px;animation:fadeUp .3s ease">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <span style="flex-shrink:0;font-size:14px">${c.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--txt);line-height:1.4">${ins.msg}</div>
            <div style="font-size:10px;color:var(--mut);margin-top:3px;display:flex;gap:8px">
              <span>${hora}</span>
              ${ins.confianca ? `<span>Confiança: ${ins.confianca}%</span>` : ''}
              <span style="text-transform:capitalize">${ins.tipo}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   ASSISTENTE IA CONVERSACIONAL
════════════════════════════════════════════════════════════ */
async function iaAssistentePerguntar(pergunta) {
  if (!pergunta?.trim()) return;

  const apiKey = (typeof storage !== 'undefined' && storage.get)
    ? storage.get('K_KEY', '') || storage.get('dc_api_key', '')
    : localStorage.getItem('dc_api_key') || '';

  const chatEl  = document.getElementById('ia-auto-chat');
  const inputEl = document.getElementById('ia-auto-input');
  if (inputEl) inputEl.value = '';

  // Adiciona mensagem do usuário
  _adicionarMensagemChat('user', pergunta, chatEl);

  // Mostra thinking
  const thinkId = 'think_' + Date.now();
  if (chatEl) {
    chatEl.insertAdjacentHTML('beforeend', `
      <div id="${thinkId}" style="display:flex;gap:8px;margin-bottom:10px;justify-content:flex-start">
        <div style="background:var(--surf2);border:1px solid var(--bord);border-radius:12px 12px 12px 2px;padding:10px 14px">
          <div class="ia-thinking"><span></span><span></span><span></span></div>
        </div>
      </div>
    `);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  // Monta contexto operacional
  const ctx = _coletarContextoCompleto();
  const ctxStr = _montarContextoStr(ctx);

  try {
    let resposta = '';

    if (apiKey) {
      // Usa Anthropic API
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          system: `Você é a IA operacional do DockCheck PRO, um sistema logístico enterprise.
Responda de forma direta, objetiva e profissional em português.
Use dados reais da operação fornecidos no contexto.
Foque em insights práticos e acionáveis.
Contexto atual da operação:
${ctxStr}`,
          messages: [
            ..._chatHistorico.slice(-6),
            { role: 'user', content: pergunta }
          ]
        })
      });
      const data = await res.json();
      resposta = data.content?.[0]?.text || 'Não foi possível obter resposta.';
    } else {
      // Resposta local inteligente sem API
      resposta = _respostaLocal(pergunta, ctx);
    }

    _chatHistorico.push({ role: 'user', content: pergunta });
    _chatHistorico.push({ role: 'assistant', content: resposta });
    if (_chatHistorico.length > 20) _chatHistorico = _chatHistorico.slice(-20);

    document.getElementById(thinkId)?.remove();
    _adicionarMensagemChat('assistant', resposta, chatEl);

  } catch (err) {
    document.getElementById(thinkId)?.remove();
    _adicionarMensagemChat('assistant', '⚠️ Erro ao consultar IA. Verifique sua conexão.', chatEl);
  }
}

function _adicionarMensagemChat(role, texto, chatEl) {
  if (!chatEl) return;
  const isUser = role === 'user';
  chatEl.insertAdjacentHTML('beforeend', `
    <div style="display:flex;gap:8px;margin-bottom:10px;justify-content:${isUser ? 'flex-end' : 'flex-start'}">
      ${!isUser ? `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">🤖</div>` : ''}
      <div style="max-width:80%;background:${isUser ? 'var(--acc)' : 'var(--surf2)'};color:${isUser ? '#0d1017' : 'var(--txt)'};
        border:1px solid ${isUser ? 'transparent' : 'var(--bord)'};
        border-radius:${isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};
        padding:10px 14px;font-size:13px;line-height:1.5">
        ${texto.replace(/\n/g, '<br>')}
      </div>
      ${isUser ? `<div style="width:28px;height:28px;border-radius:50%;background:var(--surf3);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">👤</div>` : ''}
    </div>
  `);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function _montarContextoStr(ctx) {
  const docasAtivas = ctx.docas.filter(d => d.ativa);
  const transpTop = Object.entries(ctx.transportadoras)
    .sort((a, b) => b[1].cargas - a[1].cargas)
    .slice(0, 5)
    .map(([n, v]) => `${n}: ${v.cargas} cargas, ${v.durs.length ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length) : '?'}min médio`)
    .join('; ');

  return `Hora atual: ${ctx.hora}h | Docas ativas: ${docasAtivas.length} | ` +
    `Conferências hoje: ${ctx.historico_hoje.length} | ` +
    `Tempo médio (semana): ${ctx.tempo_medio_geral}min | ` +
    `Transportadoras (top): ${transpTop || 'sem dados'} | ` +
    `Insights recentes: ${_insights.slice(0,3).map(i=>i.msg).join(' | ')}`;
}

function _respostaLocal(pergunta, ctx) {
  const p = pergunta.toLowerCase();
  const docasAtivas = ctx.docas.filter(d => d.ativa);

  if (p.includes('mais lenta') || p.includes('lenta')) {
    const lenta = ctx.docas.filter(d => d.ativa).sort((a,b) => b.tempo - a.tempo)[0];
    return lenta
      ? `A doca mais lenta no momento é a **Doca ${lenta.doca}** com ${lenta.tempo} minutos em operação.`
      : 'Não há docas ativas no momento.';
  }
  if (p.includes('fila') || p.includes('veículo')) {
    return `Atualmente há ${ctx.fila.length} veículos na fila de espera.`;
  }
  if (p.includes('transportadora') || p.includes('atraso')) {
    const transp = Object.entries(ctx.transportadoras)
      .map(([n, v]) => ({ nome: n, med: v.durs.length ? v.durs.reduce((a,b)=>a+b,0)/v.durs.length : 0 }))
      .sort((a,b) => b.med - a.med)[0];
    return transp
      ? `A transportadora com maior tempo médio esta semana é **${transp.nome}** com ${Math.round(transp.med)} minutos.`
      : 'Sem dados suficientes de transportadoras esta semana.';
  }
  if (p.includes('produtividade') || p.includes('operador')) {
    const melhor = Object.entries(ctx.conferentes)
      .map(([n, v]) => ({ nome: n, cargas: v.cargas }))
      .sort((a,b) => b.cargas - a.cargas)[0];
    return melhor
      ? `O conferente com maior produtividade esta semana é **${melhor.nome}** com ${melhor.cargas} cargas.`
      : 'Sem dados de conferentes esta semana.';
  }
  if (p.includes('ativas') || p.includes('quantas docas')) {
    return `Há ${docasAtivas.length} doca(s) ativa(s) no momento. ${ctx.tempo_medio_geral ? `Tempo médio desta semana: ${ctx.tempo_medio_geral} minutos.` : ''}`;
  }
  if (p.includes('risco') || p.includes('crítico')) {
    const criticas = _insights.filter(i => i.nivel === 'crit').slice(0, 3);
    return criticas.length
      ? `Situações críticas detectadas:\n${criticas.map(i => '• ' + i.msg).join('\n')}`
      : 'Nenhuma situação crítica detectada no momento. Operação estável.';
  }

  return `Com base nos dados atuais: ${docasAtivas.length} docas ativas, ` +
    `${ctx.historico_hoje.length} conferências hoje, ` +
    `tempo médio de ${ctx.tempo_medio_geral || '?'} minutos. ` +
    `Configure sua API Key Anthropic nas configurações para respostas mais detalhadas.`;
}

/* ════════════════════════════════════════════════════════════
   RENDER DA ABA IA AUTÔNOMA
════════════════════════════════════════════════════════════ */
function iaAutonoRender() {
  const tab = document.getElementById('tab-ia-auto');
  if (!tab) return;

  const ctx = _coletarContextoCompleto();
  const docasAtivas = ctx.docas.filter(d => d.ativa);

  // KPIs de aprendizado
  const horasAprendidas = Object.keys(_aprendizado.por_hora || {}).length;
  const transpAprendidas = Object.keys(_aprendizado.transportadoras || {}).length;

  tab.innerHTML = `

    <!-- HEADER TORRE DE CONTROLE -->
    <div style="background:linear-gradient(135deg,#0d1017,rgba(245,158,11,.08));border:1px solid rgba(245,158,11,.25);border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:26px">🧠</span>
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;letter-spacing:2px;color:var(--acc)">IA AUTÔNOMA OPERACIONAL</div>
            <div style="font-size:10px;color:var(--mut);letter-spacing:1px">FASE 15 · TORRE DE CONTROLE · APRENDIZADO ATIVO</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:6px;padding:4px 10px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;color:var(--grn);letter-spacing:1px">● MONITORANDO</div>
          <div style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:6px;padding:4px 10px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;color:#60a5fa;letter-spacing:1px">🎓 ${horasAprendidas}h APRENDIDAS</div>
        </div>
      </div>
    </div>

    <!-- KPIs INTELIGENTES -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
      <div class="card" style="text-align:center;padding:12px 8px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:var(--acc)">${docasAtivas.length}</div>
        <div style="font-size:9px;color:var(--mut);text-transform:uppercase;letter-spacing:.3px">Docas Ativas</div>
      </div>
      <div class="card" style="text-align:center;padding:12px 8px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:var(--blue)">${ctx.historico_hoje.length}</div>
        <div style="font-size:9px;color:var(--mut);text-transform:uppercase;letter-spacing:.3px">Hoje</div>
      </div>
      <div class="card" style="text-align:center;padding:12px 8px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:var(--grn)">${ctx.tempo_medio_geral || '—'}</div>
        <div style="font-size:9px;color:var(--mut);text-transform:uppercase;letter-spacing:.3px">Min Médio</div>
      </div>
      <div class="card" style="text-align:center;padding:12px 8px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:var(--red)">${_insights.filter(i=>i.nivel==='crit').length}</div>
        <div style="font-size:9px;color:var(--mut);text-transform:uppercase;letter-spacing:.3px">Críticos</div>
      </div>
    </div>

    <!-- TORRE DE CONTROLE — FEED -->
    <div class="card" style="margin-bottom:12px">
      <div class="ctitle">🗼 Torre de Controle
        <span style="margin-left:auto;font-size:10px;color:var(--mut);font-weight:400">Atualiza automaticamente</span>
      </div>
      <div id="ia-torre-feed" style="min-height:60px">
        ${_insights.length ? '' : '<div style="text-align:center;color:var(--mut);font-size:12px;padding:20px">Monitorando operação — insights aparecerão aqui...</div>'}
      </div>
    </div>

    <!-- MAPA DE DOCAS -->
    <div class="card" style="margin-bottom:12px">
      <div class="ctitle">🗺 Mapa Operacional em Tempo Real</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px">
        ${ctx.docas.length ? ctx.docas.map(d => {
          const over  = d.tempo > (ctx.tempo_medio_geral || 60) * 1.5;
          const critico = d.tempo > (ctx.tempo_medio_geral || 60) * 2;
          const cor   = !d.ativa ? 'var(--surf2)' : critico ? 'rgba(239,68,68,.15)' : over ? 'rgba(245,158,11,.15)' : 'rgba(16,185,129,.15)';
          const bord  = !d.ativa ? 'var(--bord)' : critico ? '#ef4444' : over ? '#f59e0b' : '#10b981';
          return `
            <div style="background:${cor};border:1px solid ${bord};border-radius:8px;padding:8px 4px;text-align:center">
              <div style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:16px;color:var(--txt)">D${d.doca}</div>
              <div style="font-size:9px;color:${bord};font-weight:700">${d.ativa ? (d.tempo ? d.tempo+'min' : 'ATIVA') : 'LIVRE'}</div>
            </div>
          `;
        }).join('') : '<div style="color:var(--mut);font-size:12px;padding:12px">Nenhuma doca monitorada</div>'}
      </div>
    </div>

    <!-- RANKING DE TRANSPORTADORAS -->
    <div class="card" style="margin-bottom:12px">
      <div class="ctitle">🚛 Ranking de Transportadoras (Semana)</div>
      ${Object.entries(ctx.transportadoras).length ? `
        <div style="display:flex;flex-direction:column;gap:6px">
          ${Object.entries(ctx.transportadoras)
            .map(([nome, v]) => {
              const med = v.durs.length ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length) : 0;
              const efic = ctx.tempo_medio_geral ? Math.round((ctx.tempo_medio_geral / (med||1)) * 100) : 100;
              const cor = efic >= 100 ? 'var(--grn)' : efic >= 80 ? 'var(--acc)' : 'var(--red)';
              return `
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="font-size:12px;font-weight:700;color:var(--txt);min-width:80px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div>
                  <div style="flex:1;background:var(--surf2);border-radius:4px;height:6px;overflow:hidden">
                    <div style="background:${cor};height:100%;width:${Math.min(100,efic)}%;border-radius:4px;transition:width .5s"></div>
                  </div>
                  <div style="font-size:11px;color:${cor};font-weight:700;min-width:40px;text-align:right">${efic}%</div>
                  <div style="font-size:10px;color:var(--mut);min-width:60px">${v.cargas} cargas</div>
                </div>
              `;
            }).join('')}
        </div>
      ` : '<div style="color:var(--mut);font-size:12px">Sem dados de transportadoras esta semana.</div>'}
    </div>

    <!-- ASSISTENTE IA -->
    <div class="card" style="margin-bottom:12px">
      <div class="ctitle">💬 Assistente IA Operacional
        <span style="margin-left:auto;font-size:10px;color:var(--mut);font-weight:400">Pergunte sobre a operação</span>
      </div>

      <!-- Sugestões rápidas -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${['Qual doca está mais lenta?','Qual transportadora tem mais atraso?','Quantas docas ativas?','Qual operador mais produtivo?','Há riscos críticos?'].map(q =>
          `<button class="btn btn-ghost btn-xs" onclick="iaAssistentePerguntar('${q}')" style="font-size:11px">${q}</button>`
        ).join('')}
      </div>

      <!-- Chat -->
      <div id="ia-auto-chat" style="min-height:120px;max-height:300px;overflow-y:auto;background:var(--surf2);border:1px solid var(--bord);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;gap:8px;margin-bottom:10px;justify-content:flex-start">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">🤖</div>
          <div style="background:var(--surf);border:1px solid var(--bord);border-radius:12px 12px 12px 2px;padding:10px 14px;font-size:13px;color:var(--txt);max-width:80%">
            Olá! Sou a IA Autônoma do DockCheck PRO. Estou monitorando a operação em tempo real.
            Pode me perguntar sobre docas, transportadoras, produtividade ou qualquer situação operacional.
          </div>
        </div>
      </div>

      <!-- Input -->
      <div style="display:flex;gap:8px">
        <input id="ia-auto-input" type="text" placeholder="Faça uma pergunta operacional..."
          style="flex:1" onkeydown="if(event.key==='Enter')iaAssistentePerguntar(this.value)">
        <button class="btn btn-acc" onclick="iaAssistentePerguntar(document.getElementById('ia-auto-input').value)">
          Enviar
        </button>
      </div>
    </div>

    <!-- APRENDIZADO -->
    <div class="card">
      <div class="ctitle">🎓 Status do Aprendizado</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--surf2);border:1px solid var(--bord);border-radius:8px;padding:10px">
          <div style="font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Horas Mapeadas</div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:var(--acc)">${horasAprendidas}/24</div>
          <div style="background:var(--surf3);border-radius:3px;height:4px;margin-top:6px;overflow:hidden">
            <div style="background:var(--acc);height:100%;width:${Math.round(horasAprendidas/24*100)}%;border-radius:3px"></div>
          </div>
        </div>
        <div style="background:var(--surf2);border:1px solid var(--bord);border-radius:8px;padding:10px">
          <div style="font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Transportadoras</div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:var(--blue)">${transpAprendidas}</div>
          <div style="font-size:10px;color:var(--mut);margin-top:4px">padrões aprendidos</div>
        </div>
      </div>
      <div style="margin-top:8px;padding:8px;background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);border-radius:8px;font-size:11px;color:var(--mut)">
        💡 A IA aprende continuamente com o uso do sistema. Quanto mais operações registradas, mais precisas ficam as previsões.
      </div>
    </div>
  `;

  _atualizarTorre();
}

/* ════════════════════════════════════════════════════════════
   PERSISTÊNCIA
════════════════════════════════════════════════════════════ */
function _salvarAprendizado() {
  try { localStorage.setItem(IA_LEARN_KEY, JSON.stringify(_aprendizado)); } catch {}
}
function _carregarAprendizado() {
  try { _aprendizado = JSON.parse(localStorage.getItem(IA_LEARN_KEY) || '{}'); } catch { _aprendizado = {}; }
}
function _salvarInsights() {
  try { localStorage.setItem(IA_INSIGHTS_KEY, JSON.stringify(_insights.slice(0, 30))); } catch {}
}
function _carregarInsights() {
  try { _insights = JSON.parse(localStorage.getItem(IA_INSIGHTS_KEY) || '[]'); } catch { _insights = []; }
}

/* ── Expõe globalmente ───────────────────────────────────── */
window.iaAutonoInit          = iaAutonoInit;
window.iaAutonoRender        = iaAutonoRender;
window.iaAssistentePerguntar = iaAssistentePerguntar;
