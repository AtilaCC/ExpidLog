// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — IA Operacional Enterprise (Fase 9)
// src/services/ia.service.js
// ══════════════════════════════════════════════════════

'use strict';

const logger = require('../utils/logger');

// ─── Constantes ───────────────────────────────────────
const TEMPO_ALVO_PADRAO   = 45;  // minutos
const LIMIAR_LENTO        = 1.30; // 30% acima da média = lento
const LIMIAR_CRITICO      = 1.60; // 60% acima = crítico
const LIMIAR_FILA_ALTA    = 4;    // OCs em fila
const JANELA_RECENTE_MIN  = 120;  // 2h para análise recente

// ──────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────

function duracaoMin(op) {
  if (!op.inicio || !op.fim) return null;
  return Math.round((new Date(op.fim) - new Date(op.inicio)) / 60000);
}

function mediaArray(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function desvPadrao(arr) {
  if (arr.length < 2) return 0;
  const m = mediaArray(arr);
  const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function agoraMin() {
  return new Date();
}

function minutosAtras(min) {
  return new Date(Date.now() - min * 60000);
}

function turno(dataISO) {
  const h = new Date(dataISO).getHours();
  if (h >= 6  && h < 14) return 'Manhã';
  if (h >= 14 && h < 22) return 'Tarde';
  return 'Noite';
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ──────────────────────────────────────────────────────
// 1. SCORE OPERACIONAL
// ──────────────────────────────────────────────────────

/**
 * Calcula score 0-100 baseado em eficiência, velocidade,
 * pontualidade, volume e estabilidade.
 */
function calcularScore(operacoes) {
  const concluidas = operacoes.filter(o => o.status === 'concluida' && duracaoMin(o) !== null);
  if (!concluidas.length) return { score: 0, componentes: {}, classificacao: 'Sem dados' };

  const tempoAlvo = TEMPO_ALVO_PADRAO;
  const tempos    = concluidas.map(duracaoMin);
  const media     = mediaArray(tempos);
  const dp        = desvPadrao(tempos);

  // Eficiência: proporção dentro do tempo alvo
  const dentroAlvo   = concluidas.filter(o => duracaoMin(o) <= tempoAlvo).length;
  const eficiencia   = Math.round((dentroAlvo / concluidas.length) * 100);

  // Velocidade: quão rápido vs alvo (clamped)
  const velocidade   = clamp(Math.round((tempoAlvo / Math.max(media, 1)) * 100), 0, 150);

  // Volume: normalizado por hora de operação
  const horasOp      = concluidas.length > 0
    ? (new Date() - new Date(concluidas[0].inicio)) / 3600000 || 1
    : 1;
  const volPorHora   = concluidas.length / horasOp;
  const volumeScore  = clamp(Math.round((volPorHora / 3) * 100), 0, 100); // meta: 3/h

  // Estabilidade: penaliza alto desvio padrão
  const estabilidade = clamp(Math.round(100 - (dp / Math.max(media, 1)) * 100), 0, 100);

  // Pontualidade: sem atrasos críticos
  const criticas     = concluidas.filter(o => duracaoMin(o) > tempoAlvo * LIMIAR_CRITICO).length;
  const pontualidade = clamp(Math.round(100 - (criticas / concluidas.length) * 100), 0, 100);

  // Score ponderado
  const score = Math.round(
    eficiencia   * 0.30 +
    velocidade   * 0.20 +
    volumeScore  * 0.20 +
    pontualidade * 0.20 +
    estabilidade * 0.10
  );

  let classificacao;
  if      (score >= 90) classificacao = 'Excelente';
  else if (score >= 75) classificacao = 'Bom';
  else if (score >= 60) classificacao = 'Regular';
  else if (score >= 45) classificacao = 'Atenção';
  else                  classificacao = 'Crítico';

  return {
    score: clamp(score, 0, 100),
    classificacao,
    componentes: { eficiencia, velocidade, volumeScore, pontualidade, estabilidade },
    total:       concluidas.length,
    mediaMinutos: Math.round(media),
    dpMinutos:   Math.round(dp)
  };
}

// ──────────────────────────────────────────────────────
// 2. DETECÇÃO DE GARGALOS
// ──────────────────────────────────────────────────────

function detectarGargalos(operacoes) {
  const gargalos = [];
  const concluidas = operacoes.filter(o => o.status === 'concluida' && duracaoMin(o) !== null);
  const mediaTodas = mediaArray(concluidas.map(duracaoMin)) || TEMPO_ALVO_PADRAO;

  // — Docas lentas —
  const porDoca = agrupar(concluidas, o => o.doca_numero || o.doca_id);
  for (const [doca, ops] of Object.entries(porDoca)) {
    const media = mediaArray(ops.map(duracaoMin));
    if (media > mediaTodas * LIMIAR_LENTO) {
      gargalos.push({
        tipo:      'doca_lenta',
        severidade: media > mediaTodas * LIMIAR_CRITICO ? 'critica' : 'alta',
        entidade:  `Doca ${doca}`,
        detalhe:   `Tempo médio ${Math.round(media)}min (${Math.round((media/mediaTodas - 1)*100)}% acima da média)`,
        valor:     Math.round(media),
        referencia: Math.round(mediaTodas)
      });
    }
  }

  // — Equipes lentas —
  const porEquipe = agrupar(concluidas, o => o.conferente || o.equipe_id);
  for (const [eq, ops] of Object.entries(porEquipe)) {
    if (ops.length < 2) continue;
    const media = mediaArray(ops.map(duracaoMin));
    if (media > mediaTodas * LIMIAR_LENTO) {
      gargalos.push({
        tipo:      'equipe_lenta',
        severidade: media > mediaTodas * LIMIAR_CRITICO ? 'critica' : 'media',
        entidade:  `Equipe ${eq}`,
        detalhe:   `Tempo médio ${Math.round(media)}min (${Math.round((media/mediaTodas - 1)*100)}% acima da média)`,
        valor:     Math.round(media),
        referencia: Math.round(mediaTodas)
      });
    }
  }

  // — Transportadoras problemáticas —
  const porTransp = agrupar(concluidas, o => o.transportadora);
  for (const [tr, ops] of Object.entries(porTransp)) {
    if (!tr || tr === 'null' || ops.length < 2) continue;
    const media = mediaArray(ops.map(duracaoMin));
    if (media > mediaTodas * LIMIAR_LENTO) {
      gargalos.push({
        tipo:      'transportadora_lenta',
        severidade: 'media',
        entidade:  `Transportadora ${tr}`,
        detalhe:   `Média ${Math.round(media)}min em ${ops.length} operações`,
        valor:     Math.round(media),
        referencia: Math.round(mediaTodas)
      });
    }
  }

  // — Operações em andamento há muito tempo —
  const emAndamento = operacoes.filter(o => o.status === 'em_andamento' && o.inicio);
  for (const op of emAndamento) {
    const elapsed = Math.round((Date.now() - new Date(op.inicio)) / 60000);
    if (elapsed > TEMPO_ALVO_PADRAO * LIMIAR_CRITICO) {
      gargalos.push({
        tipo:      'operacao_critica',
        severidade: 'critica',
        entidade:  `Doca ${op.doca_numero || op.doca_id}`,
        detalhe:   `Operação em andamento há ${elapsed}min (${Math.round(elapsed / TEMPO_ALVO_PADRAO * 100 - 100)}% acima do alvo)`,
        valor:     elapsed,
        referencia: TEMPO_ALVO_PADRAO
      });
    }
  }

  // Ordenar por severidade
  const ordem = { critica: 0, alta: 1, media: 2, baixa: 3 };
  return gargalos.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}

// ──────────────────────────────────────────────────────
// 3. INSIGHTS AUTOMÁTICOS
// ──────────────────────────────────────────────────────

function gerarInsights(operacoes) {
  const insights = [];
  const concluidas = operacoes.filter(o => o.status === 'concluida' && duracaoMin(o) !== null);
  if (!concluidas.length) return insights;

  const mediaTodas = mediaArray(concluidas.map(duracaoMin));

  // — Insight por doca —
  const porDoca = agrupar(concluidas, o => o.doca_numero || o.doca_id);
  for (const [doca, ops] of Object.entries(porDoca)) {
    const media = mediaArray(ops.map(duracaoMin));
    const pct   = Math.round((media / mediaTodas - 1) * 100);
    if (Math.abs(pct) >= 15) {
      insights.push({
        tipo:  pct > 0 ? 'alerta' : 'positivo',
        icone: pct > 0 ? '⚠️' : '🚀',
        texto: pct > 0
          ? `Doca ${doca} está ${pct}% acima do tempo médio (${Math.round(media)}min)`
          : `Doca ${doca} está ${Math.abs(pct)}% abaixo do tempo médio (${Math.round(media)}min)`,
        valor: pct
      });
    }
  }

  // — Insight por equipe —
  const porEquipe = agrupar(concluidas, o => o.conferente || o.equipe_id);
  for (const [eq, ops] of Object.entries(porEquipe)) {
    if (ops.length < 2 || !eq || eq === 'null') continue;
    const media = mediaArray(ops.map(duracaoMin));
    const pct   = Math.round((media / mediaTodas - 1) * 100);
    if (Math.abs(pct) >= 20) {
      insights.push({
        tipo:  pct > 0 ? 'alerta' : 'positivo',
        icone: pct > 0 ? '🐢' : '⚡',
        texto: pct > 0
          ? `Equipe ${eq} está ${pct}% mais lenta que a média hoje`
          : `Equipe ${eq} está ${Math.abs(pct)}% mais rápida que a média hoje`,
        valor: pct
      });
    }
  }

  // — Insight por transportadora —
  const porTransp = agrupar(concluidas, o => o.transportadora);
  let piorTransp = null; let piorMedia = 0;
  for (const [tr, ops] of Object.entries(porTransp)) {
    if (!tr || tr === 'null' || ops.length < 2) continue;
    const m = mediaArray(ops.map(duracaoMin));
    if (m > piorMedia) { piorMedia = m; piorTransp = tr; }
  }
  if (piorTransp && piorMedia > mediaTodas * 1.25) {
    insights.push({
      tipo:  'alerta',
      icone: '🚛',
      texto: `Transportadora ${piorTransp} possui o maior índice de tempo operacional (${Math.round(piorMedia)}min)`,
      valor: Math.round(piorMedia)
    });
  }

  // — Insight por turno —
  const porTurno = agrupar(concluidas, o => turno(o.inicio));
  const turnos   = Object.entries(porTurno).map(([t, ops]) => ({
    turno: t, media: mediaArray(ops.map(duracaoMin)), total: ops.length
  })).filter(t => t.total >= 2);

  if (turnos.length >= 2) {
    turnos.sort((a, b) => a.media - b.media);
    const melhor = turnos[0];
    insights.push({
      tipo:  'positivo',
      icone: '🌟',
      texto: `Turno ${melhor.turno} está mais eficiente (média ${Math.round(melhor.media)}min em ${melhor.total} operações)`,
      valor: Math.round(melhor.media)
    });
  }

  // — Volume geral —
  const hoje = new Date().toISOString().slice(0, 10);
  const hoje_ops = concluidas.filter(o => o.inicio?.slice(0, 10) === hoje);
  if (hoje_ops.length > 0) {
    insights.push({
      tipo:  'info',
      icone: '📦',
      texto: `${hoje_ops.length} operações concluídas hoje com tempo médio de ${Math.round(mediaArray(hoje_ops.map(duracaoMin)))}min`,
      valor: hoje_ops.length
    });
  }

  return insights.slice(0, 10); // máx 10 insights
}

// ──────────────────────────────────────────────────────
// 4. RANKINGS
// ──────────────────────────────────────────────────────

function calcularRankings(operacoes) {
  const concluidas = operacoes.filter(o => o.status === 'concluida' && duracaoMin(o) !== null);

  const rankPor = (chave) => {
    const agrupado = agrupar(concluidas, o => o[chave]);
    return Object.entries(agrupado)
      .filter(([k]) => k && k !== 'null' && k !== 'undefined')
      .map(([entidade, ops]) => ({
        entidade,
        total:      ops.length,
        mediaMin:   Math.round(mediaArray(ops.map(duracaoMin))),
        score:      calcularScore(ops).score
      }))
      .filter(r => r.total >= 1)
      .sort((a, b) => a.mediaMin - b.mediaMin);
  };

  return {
    equipes:         rankPor('conferente').slice(0, 5),
    docas:           rankPor('doca_numero').slice(0, 5),
    transportadoras: rankPor('transportadora').slice(0, 5),
    turnos: Object.entries(agrupar(concluidas, o => turno(o.inicio)))
      .map(([t, ops]) => ({
        entidade: t,
        total: ops.length,
        mediaMin: Math.round(mediaArray(ops.map(duracaoMin))),
        score: calcularScore(ops).score
      }))
      .sort((a, b) => a.mediaMin - b.mediaMin)
  };
}

// ──────────────────────────────────────────────────────
// 5. PREVISÃO DE ATRASO
// ──────────────────────────────────────────────────────

function preverAtraso(operacoes, { doca, conferente, transportadora } = {}) {
  const concluidas = operacoes.filter(o => o.status === 'concluida' && duracaoMin(o) !== null);

  // Base: média geral
  let mediaBase = mediaArray(concluidas.map(duracaoMin)) || TEMPO_ALVO_PADRAO;
  let fatorDoca = 1, fatorEquipe = 1, fatorTransp = 1, fatorHora = 1;
  const razoes  = [];

  // Fator doca
  if (doca) {
    const opsDoc = concluidas.filter(o => String(o.doca_numero) === String(doca) || String(o.doca_id) === String(doca));
    if (opsDoc.length >= 2) {
      const m  = mediaArray(opsDoc.map(duracaoMin));
      fatorDoca = m / mediaBase;
      if (fatorDoca > 1.2) razoes.push(`Doca ${doca} historicamente mais lenta (+${Math.round((fatorDoca-1)*100)}%)`);
    }
  }

  // Fator equipe
  if (conferente) {
    const opsEq = concluidas.filter(o => o.conferente === conferente);
    if (opsEq.length >= 2) {
      const m   = mediaArray(opsEq.map(duracaoMin));
      fatorEquipe = m / mediaBase;
      if (fatorEquipe > 1.2) razoes.push(`Equipe com tempo acima da média (+${Math.round((fatorEquipe-1)*100)}%)`);
      if (fatorEquipe < 0.8) razoes.push(`Equipe com tempo abaixo da média (-${Math.round((1-fatorEquipe)*100)}%)`);
    }
  }

  // Fator transportadora
  if (transportadora) {
    const opsTr = concluidas.filter(o => o.transportadora === transportadora);
    if (opsTr.length >= 2) {
      const m    = mediaArray(opsTr.map(duracaoMin));
      fatorTransp = m / mediaBase;
      if (fatorTransp > 1.2) razoes.push(`Transportadora com histórico lento (+${Math.round((fatorTransp-1)*100)}%)`);
    }
  }

  // Fator hora do dia
  const h = new Date().getHours();
  if (h >= 11 && h <= 13) { fatorHora = 1.15; razoes.push('Horário de pico (almoço)'); }
  if (h >= 17 && h <= 19) { fatorHora = 1.10; razoes.push('Horário de pico (saída)'); }

  const previsao   = Math.round(mediaBase * fatorDoca * fatorEquipe * fatorTransp * fatorHora);
  const probabilidade = clamp(Math.round(((previsao / TEMPO_ALVO_PADRAO) - 1) * 100), 0, 100);
  const risco      = probabilidade > 60 ? 'alto' : probabilidade > 30 ? 'medio' : 'baixo';

  return {
    previsaoMin: previsao,
    probabilidadeAtraso: probabilidade,
    risco,
    tempoAlvo: TEMPO_ALVO_PADRAO,
    razoes,
    fatorDoca:   Math.round(fatorDoca * 100),
    fatorEquipe: Math.round(fatorEquipe * 100),
    fatorTransp: Math.round(fatorTransp * 100)
  };
}

// ──────────────────────────────────────────────────────
// 6. ALERTAS AUTOMÁTICOS
// ──────────────────────────────────────────────────────

function gerarAlertas(operacoes) {
  const alertas = [];
  const agora   = Date.now();

  // — Operações críticas (em andamento por muito tempo) —
  operacoes
    .filter(o => o.status === 'em_andamento' && o.inicio)
    .forEach(op => {
      const elapsed = Math.round((agora - new Date(op.inicio)) / 60000);
      if (elapsed > TEMPO_ALVO_PADRAO * LIMIAR_CRITICO) {
        alertas.push({
          nivel:   'critico',
          codigo:  'OP_CRITICA',
          titulo:  'Operação Crítica',
          msg:     `Doca ${op.doca_numero || op.doca_id} com ${elapsed}min sem conclusão`,
          doca:    op.doca_numero || op.doca_id,
          ts:      new Date().toISOString()
        });
      } else if (elapsed > TEMPO_ALVO_PADRAO) {
        alertas.push({
          nivel:   'alto',
          codigo:  'OP_LENTA',
          titulo:  'Operação Acima do Prazo',
          msg:     `Doca ${op.doca_numero || op.doca_id} com ${elapsed}min (alvo: ${TEMPO_ALVO_PADRAO}min)`,
          doca:    op.doca_numero || op.doca_id,
          ts:      new Date().toISOString()
        });
      }
    });

  // — Score crítico —
  const score = calcularScore(operacoes);
  if (score.score > 0 && score.score < 45) {
    alertas.push({
      nivel:  'alto',
      codigo: 'SCORE_BAIXO',
      titulo: 'Produtividade Baixa',
      msg:    `Score operacional em ${score.score}/100 (${score.classificacao})`,
      ts:     new Date().toISOString()
    });
  }

  // — Gargalos críticos —
  const gargalos = detectarGargalos(operacoes);
  gargalos.filter(g => g.severidade === 'critica').forEach(g => {
    alertas.push({
      nivel:  'critico',
      codigo: 'GARGALO_' + g.tipo.toUpperCase(),
      titulo: 'Gargalo Crítico Detectado',
      msg:    `${g.entidade}: ${g.detalhe}`,
      ts:     new Date().toISOString()
    });
  });

  const ordem = { critico: 0, alto: 1, medio: 2, info: 3 };
  return alertas
    .sort((a, b) => ordem[a.nivel] - ordem[b.nivel])
    .slice(0, 20);
}

// ──────────────────────────────────────────────────────
// 7. RESUMO EXECUTIVO
// ──────────────────────────────────────────────────────

function gerarResumoExecutivo(operacoes) {
  const concluidas = operacoes.filter(o => o.status === 'concluida' && duracaoMin(o) !== null);
  const emAndamento = operacoes.filter(o => o.status === 'em_andamento');
  const score      = calcularScore(operacoes);
  const gargalos   = detectarGargalos(operacoes);
  const rankings   = calcularRankings(operacoes);
  const insights   = gerarInsights(operacoes);
  const alertas    = gerarAlertas(operacoes);

  const turnoAtual = turno(new Date().toISOString());
  const opsTurno   = concluidas.filter(o => turno(o.inicio) === turnoAtual);

  return {
    geradoEm:    new Date().toISOString(),
    turnoAtual,
    resumo: {
      totalConcluidas:   concluidas.length,
      emAndamento:       emAndamento.length,
      mediaMinutos:      score.mediaMinutos || 0,
      scoreOperacional:  score.score,
      classificacao:     score.classificacao,
      concluidas_turno:  opsTurno.length
    },
    score,
    gargalosCriticos: gargalos.filter(g => g.severidade === 'critica').length,
    alertasCriticos:  alertas.filter(a => a.nivel === 'critico').length,
    melhorEquipe:     rankings.equipes[0]?.entidade || '—',
    melhorDoca:       rankings.docas[0]?.entidade   || '—',
    topInsights:      insights.slice(0, 5),
    topAlertas:       alertas.slice(0, 5),
    rankings,
    gargalos:         gargalos.slice(0, 5)
  };
}

// ──────────────────────────────────────────────────────
// 8. TENDÊNCIAS HISTÓRICAS
// ──────────────────────────────────────────────────────

function analisarTendencias(operacoes) {
  const concluidas = operacoes.filter(o => o.status === 'concluida' && duracaoMin(o) !== null);

  // — Evolução diária (últimos 7 dias) —
  const porDia = {};
  concluidas.forEach(op => {
    const dia = op.inicio?.slice(0, 10);
    if (!dia) return;
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(duracaoMin(op));
  });

  const evolucaoDiaria = Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([dia, tempos]) => ({
      data:    dia,
      total:   tempos.length,
      mediaMin: Math.round(mediaArray(tempos)),
      score:   calcularScore(concluidas.filter(o => o.inicio?.slice(0, 10) === dia)).score
    }));

  // — Por turno (acumulado) —
  const porTurno = agrupar(concluidas, o => turno(o.inicio));
  const evolucaoTurno = Object.entries(porTurno).map(([t, ops]) => ({
    turno:   t,
    total:   ops.length,
    mediaMin: Math.round(mediaArray(ops.map(duracaoMin))),
    score:   calcularScore(ops).score
  }));

  // — Tendência (subindo/descendo) —
  let tendencia = 'estavel';
  if (evolucaoDiaria.length >= 3) {
    const ultimos3 = evolucaoDiaria.slice(-3).map(d => d.mediaMin);
    if (ultimos3[2] < ultimos3[0] * 0.9) tendencia = 'melhorando';
    if (ultimos3[2] > ultimos3[0] * 1.1) tendencia = 'piorando';
  }

  return { evolucaoDiaria, evolucaoTurno, tendencia };
}

// ──────────────────────────────────────────────────────
// HELPER: agrupar array por chave
// ──────────────────────────────────────────────────────

function agrupar(arr, fn) {
  return arr.reduce((acc, item) => {
    const k = String(fn(item) ?? 'desconhecido');
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

// ──────────────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────────────

module.exports = {
  calcularScore,
  detectarGargalos,
  gerarInsights,
  calcularRankings,
  preverAtraso,
  gerarAlertas,
  gerarResumoExecutivo,
  analisarTendencias
};
