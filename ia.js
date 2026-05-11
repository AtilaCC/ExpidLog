/**
 * ia.js — DockCheck v2
 * Análise operacional via Anthropic API.
 * Gera insights automáticos sobre gargalos, docas lentas, equipes.
 * Depende de: storage.js, utils.js
 */

'use strict';

/**
 * Executa a análise IA sobre o histórico de conferências.
 * Compila resumo estatístico e envia para Claude Sonnet.
 * Renderiza insights categorizados na aba IA.
 */
async function rodarAnaliseIA() {
  const apiKey = storage.get(K_KEY, '');
  if (!apiKey) { toast('Configure a API Key em ⚙️ Config!'); return; }

  const entries = historico.filter(h => h.tipo === 'conferencia');
  if (entries.length < 2) { toast('Registre pelo menos 2 conferências para análise.'); return; }

  // ── UI: estado de carregamento ──
  const statusCard = document.getElementById('ia-status-card');
  const statusEl   = document.getElementById('ia-status');
  statusCard.style.display = 'block';
  statusEl.innerHTML = `<div class="obar run"><div class="spin"></div>🤖 Analisando operação...</div>`;
  document.getElementById('ia-insights').innerHTML =
    `<div class="ia-thinking"><span></span><span></span><span></span></div>`;
  document.getElementById('ia-full-response').style.display = 'none';

  // ── Compila estatísticas ──
  const byDoca = {}, byConf = {}, byTransp = {};

  entries.forEach(h => {
    // Docas
    const d = h.doca?.trim() || '?';
    if (!byDoca[d]) byDoca[d] = { cargas: 0, durs: [] };
    byDoca[d].cargas++;
    const dur = _duracaoMin(h); if (dur) byDoca[d].durs.push(dur);

    // Conferentes
    const c = h.conf?.trim() || '?';
    if (!byConf[c]) byConf[c] = { cargas: 0 };
    byConf[c].cargas++;

    // Transportadoras
    const t = h.transportadora?.trim() || '?';
    if (!byTransp[t]) byTransp[t] = { cargas: 0, durs: [] };
    byTransp[t].cargas++;
    if (dur) byTransp[t].durs.push(dur);
  });

  const docaStats = Object.entries(byDoca).map(([d, v]) => {
    const med = v.durs.length
      ? Math.round(v.durs.reduce((a, b) => a + b, 0) / v.durs.length)
      : null;
    return `Doca ${d}: ${v.cargas} cargas, tempo médio ${med ? med + 'min' : 'N/A'}`;
  }).join('\n');

  const confStats = Object.entries(byConf)
    .sort((a, b) => b[1].cargas - a[1].cargas)
    .map(([n, v]) => `${n}: ${v.cargas} conferências`)
    .join('\n');

  const transpStats = Object.entries(byTransp)
    .sort((a, b) => b[1].cargas - a[1].cargas)
    .map(([t, v]) => {
      const med = v.durs.length
        ? Math.round(v.durs.reduce((a, b) => a + b, 0) / v.durs.length)
        : null;
      return `${t}: ${v.cargas} cargas, tempo médio ${med ? med + 'min' : 'N/A'}`;
    }).join('\n');

  const totalPed = entries.reduce((s, h) => s + (parseInt(h.pedidos) || 0), 0);
  const totalCli = entries.reduce((s, h) => s + (parseInt(h.clientes) || 0), 0);

  const prompt = `Você é um analista de logística especialista em operações de centro de distribuição.
Analise os dados operacionais abaixo e gere insights em português brasileiro.

DADOS DO PERÍODO:
- Total de conferências: ${entries.length}
- Total de pedidos conferidos: ${totalPed}
- Total de clientes atendidos: ${totalCli}

PERFORMANCE POR DOCA:
${docaStats}

RANKING DE CONFERENTES:
${confStats}

TRANSPORTADORAS:
${transpStats}

Gere:
1. 3-5 insights principais (identifique gargalos, padrões, destaques positivos e negativos)
2. Indique a doca mais lenta e a mais rápida com percentual de diferença
3. Identifique o conferente mais produtivo
4. Aponte a transportadora com maior tempo médio
5. Dê 2 recomendações operacionais práticas

Formato de saída: JSON puro sem markdown:
{
  "resumo": "frase de resumo executivo em 1 linha",
  "insights": [{"tipo":"warn|crit|good|info","texto":"..."}],
  "detalhado": "análise detalhada em texto livre"
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':                              'application/json',
        'x-api-key':                                 apiKey,
        'anthropic-version':                         '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const txt    = data.content.find(b => b.type === 'text')?.text || '';
    const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());

    // ── Renderiza insights ──
    document.getElementById('ia-insights').innerHTML = `
      <p style="font-size:14px;color:var(--txt2);margin-bottom:12px;font-style:italic">
        "${parsed.resumo || ''}"
      </p>
      ${(parsed.insights || []).map(i => `
        <div class="insight-item ${i.tipo || 'info'}">
          ${i.tipo === 'crit' ? '🚨' : i.tipo === 'warn' ? '⚠️' : i.tipo === 'good' ? '✅' : 'ℹ️'}
          ${i.texto}
        </div>
      `).join('')}
    `;

    if (parsed.detalhado) {
      document.getElementById('ia-detail').textContent = parsed.detalhado;
      document.getElementById('ia-full-response').style.display = 'block';
    }

    statusEl.innerHTML = `<div class="obar ok">✅ Análise concluída</div>`;
    toast('Análise IA concluída!');

  } catch (e) {
    statusEl.innerHTML = `<div class="obar err">❌ Erro: ${e.message}</div>`;
    document.getElementById('ia-insights').innerHTML =
      '<p class="hint">Erro ao gerar análise. Verifique a API Key.</p>';
    toast('Erro na análise IA.');
  }
}
