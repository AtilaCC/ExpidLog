// ═══════════════════════════════════════════════════════════════
//  CARGO CHECK — Análise de arrumação de carga via IA (Claude Vision)
//  DockCheck v2 — Módulo: cargo-check.js
//  Adicione ao index.html ANTES de app.js:
//  <script src="cargo-check.js"></script>
// ═══════════════════════════════════════════════════════════════

// ─── Prompt de análise calibrado para a operação real ─────────
const CARGO_CHECK_PROMPT = `Você é um especialista em logística e segurança de carga de caminhões, com foco em materiais de construção e hidráulica (caixas, tubos PVC, conexões, rolos de mangueira, barras metálicas, pallets, sacos de itens soltos, etc).

Analise esta foto do interior do caminhão e classifique a arrumação da carga segundo os critérios abaixo.

CRITÉRIOS DE AVALIAÇÃO:
1. Tubos/barras sem apoio ou fixação lateral (risco de rolar)
2. Sacos ou itens soltos sobre caixas empilhadas (risco de queda)
3. Itens frágeis ou leves embaixo de pesados (amassamento)
4. Mistura desorganizada de tamanhos e pesos sem separação
5. Caixas inclinadas, mal encaixadas ou com risco de tombamento
6. Falta de stretch film, cintas ou amarração visível em pallets
7. Espaços vazios grandes que permitem deslocamento da carga durante o transporte
8. Itens soltos no chão sem organização ou agrupamento

RESPONDA APENAS em JSON válido, sem texto fora do JSON, neste formato exato:
{
  "status": "OK" | "ALERTA" | "REPROVADO",
  "nota": 0-10,
  "problemas": ["lista de problemas encontrados, máximo 5, em português"],
  "pontos_positivos": ["lista de pontos positivos, máximo 3, em português"],
  "recomendacao": "texto curto com recomendação principal (máximo 2 frases)"
}

Critério para status:
- OK: nota 7-10, sem riscos sérios de segurança
- ALERTA: nota 4-6, problemas presentes mas não críticos
- REPROVADO: nota 0-3, riscos sérios de segurança ou danos

Seja objetivo e direto. Foque em problemas reais visíveis na foto.`;

// ─── Estado do módulo ─────────────────────────────────────────
window.cargoCheckResult = null;

// ─── Função principal de análise ─────────────────────────────
async function analisarArrumacao() {
  const fotos = fotosCAM || [];

  if (!fotos || fotos.length === 0) {
    toast('📷 Adicione pelo menos uma foto do caminhão para analisar.');
    return;
  }

  const apiKey = storage.get(K_KEY, '');
  if (!apiKey) {
    toast('🔑 Configure a API Key Anthropic na aba ⚙️ Config.');
    return;
  }

  // Mostra estado de carregando
  renderCargoCheckLoading();

  // Usa primeira foto (ou a de melhor resolução disponível)
  const fotoBase64 = fotos[0];

  // Remove prefixo data URL se presente
  const base64Data = fotoBase64.includes(',')
    ? fotoBase64.split(',')[1]
    : fotoBase64;

  // Detecta media type
  const mediaType = fotoBase64.startsWith('data:image/png') ? 'image/png'
    : fotoBase64.startsWith('data:image/webp') ? 'image/webp'
    : 'image/jpeg';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: CARGO_CHECK_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.map(b => b.text || '').join('').trim();

    // Parse JSON — remove possíveis backticks
    const clean = rawText.replace(/```json|```/gi, '').trim();
    const result = JSON.parse(clean);

    window.cargoCheckResult = result;
    renderCargoCheckResult(result);

    // Auto-preenche OBS se há problemas
    if (result.problemas && result.problemas.length > 0 && result.status !== 'OK') {
      const obsEl = document.getElementById('f-obs');
      if (obsEl && !obsEl.value) {
        obsEl.value = `⚠️ Carga: ${result.problemas.slice(0, 2).join('; ')}.`;
      }
    }

    // Gera mensagem atualizada automaticamente
    if (typeof gerarMsg === 'function') gerarMsg();

  } catch (err) {
    console.error('[CargoCheck]', err);
    renderCargoCheckError(err.message);
  }
}

// ─── Renderização: estado carregando ─────────────────────────
function renderCargoCheckLoading() {
  const box = document.getElementById('cargo-check-box');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <div class="cc-loading">
      <div class="cc-spinner"></div>
      <span>Analisando arrumação da carga...</span>
    </div>
  `;
}

// ─── Renderização: resultado ─────────────────────────────────
function renderCargoCheckResult(r) {
  const box = document.getElementById('cargo-check-box');
  if (!box) return;

  const statusConfig = {
    OK:        { emoji: '✅', label: 'Bem arrumada',   cls: 'cc-ok'       },
    ALERTA:    { emoji: '⚠️', label: 'Atenção',        cls: 'cc-alerta'   },
    REPROVADO: { emoji: '❌', label: 'Mal arrumada',   cls: 'cc-reprovado'},
  };
  const s = statusConfig[r.status] || statusConfig['ALERTA'];

  const problemas = (r.problemas || []).map(p =>
    `<li class="cc-problema">⚠ ${p}</li>`).join('');
  const positivos = (r.pontos_positivos || []).map(p =>
    `<li class="cc-positivo">✓ ${p}</li>`).join('');

  // Barra de nota (0–10 → 0–100%)
  const notaPct = Math.max(0, Math.min(100, (r.nota || 0) * 10));
  const notaCor = r.nota >= 7 ? 'var(--grn)' : r.nota >= 4 ? 'var(--acc)' : 'var(--red, #ef4444)';

  box.style.display = 'block';
  box.innerHTML = `
    <div class="cc-result ${s.cls}">
      <div class="cc-header">
        <span class="cc-badge">${s.emoji} ${s.label}</span>
        <span class="cc-nota-label">Nota: <strong style="color:${notaCor}">${r.nota}/10</strong></span>
      </div>

      <div class="cc-nota-bar-wrap">
        <div class="cc-nota-bar" style="width:${notaPct}%;background:${notaCor}"></div>
      </div>

      ${problemas ? `
      <div class="cc-section">
        <div class="cc-section-title">Problemas detectados</div>
        <ul class="cc-list">${problemas}</ul>
      </div>` : ''}

      ${positivos ? `
      <div class="cc-section">
        <div class="cc-section-title">Pontos positivos</div>
        <ul class="cc-list">${positivos}</ul>
      </div>` : ''}

      ${r.recomendacao ? `
      <div class="cc-rec">
        💡 ${r.recomendacao}
      </div>` : ''}

      <button class="btn btn-ghost btn-xs" style="margin-top:10px;width:100%" onclick="analisarArrumacao()">
        🔄 Reanalisar
      </button>
    </div>
  `;
}

// ─── Renderização: erro ───────────────────────────────────────
function renderCargoCheckError(msg) {
  const box = document.getElementById('cargo-check-box');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <div class="cc-result cc-alerta" style="padding:12px">
      <span style="color:var(--acc)">⚠️ Erro na análise:</span>
      <span style="font-size:12px;color:var(--mut);display:block;margin-top:4px">${msg}</span>
      <button class="btn btn-ghost btn-xs" style="margin-top:10px;width:100%" onclick="analisarArrumacao()">
        🔄 Tentar novamente
      </button>
    </div>
  `;
}

// ─── Injeção dinâmica de HTML e CSS no index.html ─────────────
//  Adiciona o bloco de CargoCheck dentro do card de Fotos,
//  após o botão de limpar.
document.addEventListener('DOMContentLoaded', () => {
  injetarCargoCheckUI();
  injetarCargoCheckCSS();
});

function injetarCargoCheckUI() {
  // Encontra o card de fotos pelo ctitle
  const cards = document.querySelectorAll('.card');
  let fotoCard = null;
  for (const c of cards) {
    const title = c.querySelector('.ctitle');
    if (title && title.textContent.includes('Fotos do Caminhão')) {
      fotoCard = c;
      break;
    }
  }
  if (!fotoCard) return;

  // Cria container de análise
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="sep" style="margin:14px 0 10px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:11px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.5px">
        Verificação de Arrumação
      </span>
    </div>
    <button
      class="btn btn-ghost btn-sm btn-full"
      id="btn-cargo-check"
      onclick="analisarArrumacao()"
      style="border-color:rgba(245,158,11,.4);color:var(--acc)"
    >
      🤖 Analisar Arrumação da Carga
    </button>
    <div id="cargo-check-box" style="display:none;margin-top:10px"></div>
  `;

  fotoCard.appendChild(div);
}

function injetarCargoCheckCSS() {
  const style = document.createElement('style');
  style.textContent = `
    /* ── CARGO CHECK ── */
    .cc-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      font-size: 13px;
      color: var(--mut);
      background: var(--surf2);
      border-radius: 8px;
    }
    .cc-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid var(--bord);
      border-top-color: var(--acc);
      border-radius: 50%;
      animation: cc-spin .7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes cc-spin { to { transform: rotate(360deg); } }

    .cc-result {
      border-radius: 10px;
      padding: 14px;
      border: 1.5px solid var(--bord);
      background: var(--surf2);
    }
    .cc-ok       { border-color: rgba(16,185,129,.45); background: rgba(16,185,129,.05); }
    .cc-alerta   { border-color: rgba(245,158,11,.45); background: rgba(245,158,11,.05); }
    .cc-reprovado{ border-color: rgba(239,68,68,.45);  background: rgba(239,68,68,.05);  }

    .cc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .cc-badge {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: .3px;
    }
    .cc-nota-label {
      font-size: 13px;
      color: var(--mut);
    }
    .cc-nota-bar-wrap {
      height: 5px;
      background: var(--bord);
      border-radius: 99px;
      overflow: hidden;
      margin-bottom: 14px;
    }
    .cc-nota-bar {
      height: 100%;
      border-radius: 99px;
      transition: width .5s ease;
    }

    .cc-section { margin-bottom: 10px; }
    .cc-section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: var(--mut);
      margin-bottom: 5px;
    }
    .cc-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .cc-problema {
      font-size: 13px;
      color: var(--txt);
      padding: 5px 8px;
      background: rgba(239,68,68,.08);
      border-left: 2.5px solid rgba(239,68,68,.5);
      border-radius: 0 6px 6px 0;
    }
    .cc-positivo {
      font-size: 13px;
      color: var(--txt);
      padding: 5px 8px;
      background: rgba(16,185,129,.07);
      border-left: 2.5px solid rgba(16,185,129,.5);
      border-radius: 0 6px 6px 0;
    }
    .cc-rec {
      font-size: 12px;
      color: var(--mut);
      background: var(--surf);
      border-radius: 7px;
      padding: 9px 10px;
      line-height: 1.6;
      margin-top: 6px;
    }
  `;
  document.head.appendChild(style);
}

// ─── Expõe resultado para uso na mensagem gerada ──────────────
//  Em conferencia.js / utils.js, use:
//  window.cargoCheckResult?.status  → 'OK' | 'ALERTA' | 'REPROVADO'
//  window.cargoCheckResult?.nota    → número 0-10
//  window.cargoCheckResult?.recomendacao → string
