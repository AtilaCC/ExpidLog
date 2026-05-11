/**
 * ocr.js — DockCheck v2
 * Integração com Anthropic API para leitura de tabela logística via imagem.
 * Compressão de foto antes do envio, exportação CSV.
 * Depende de: storage.js, utils.js, conferencia.js (usarLinha)
 */

'use strict';

/* ── Estado ── */
let fotoTAB = null; // base64 da foto da tabela (comprimida)

/* ════════════════════════════════════════════════════════════
   CARREGAMENTO DA FOTO DA TABELA
════════════════════════════════════════════════════════════ */

/**
 * Carrega a foto da tabela, comprime para WEBP e habilita botão OCR.
 * @param {Event} ev — evento change do input file
 */
function loadTab(ev) {
  const file = ev.target.files[0];
  if (!file) return;

  const r = new FileReader();
  r.onload = async e => {
    // Comprime antes de enviar para a API (reduz tokens e latência)
    fotoTAB = await compressImage(e.target.result);
    document.getElementById('farea-tab').innerHTML =
      `<img src="${fotoTAB}"><div class="fbadge">✓ Carregada</div>`;
    document.getElementById('btn-ocr').disabled = false;
  };
  r.readAsDataURL(file);
}

/**
 * Limpa a foto da tabela e reseta a UI.
 */
function clearTab() {
  fotoTAB = null;
  document.getElementById('farea-tab').innerHTML =
    '<div class="ficon">📄</div><div class="fhint">Tire foto ou selecione a tabela impressa</div>';
  document.getElementById('inp-tab').value    = '';
  document.getElementById('btn-ocr').disabled = true;
  document.getElementById('ocr-res').style.display    = 'none';
  document.getElementById('ocr-status').style.display = 'none';
}

/* ════════════════════════════════════════════════════════════
   OCR — EXTRAÇÃO VIA IA
════════════════════════════════════════════════════════════ */

/**
 * Envia a foto da tabela para a API Anthropic e extrai as linhas.
 * Exige API Key configurada em ⚙️ Config.
 * Resultado armazenado em `ocrRows` (estado global em app.js).
 */
async function rodarOCR() {
  if (!fotoTAB) { toast('Carregue a foto primeiro!'); return; }

  const apiKey = storage.get(K_KEY, '');
  if (!apiKey) { toast('Configure a API Key em ⚙️ Config!'); return; }

  setOcrSt('run', '🤖 Lendo tabela com IA...');

  const b64   = fotoTAB.split(',')[1];
  const mtype = fotoTAB.split(';')[0].split(':')[1];

  const prompt = `Você é um sistema OCR especializado em tabelas de logística brasileiras.
A imagem contém uma tabela com colunas: PLACAS, VEÍCULO, OC, DOCA, ROTAS, PEDIDOS, CLIENTES, STATUS, TRANSPORTADORA.
Extraia TODAS as linhas. Retorne SOMENTE JSON válido sem markdown:
{"linhas":[{"placa":"","oc":"","doca":"","rota":"","pedidos":"","clientes":"","transportadora":"","status":""}]}
Use null se não conseguir ler. Não invente dados. Seja rigoroso com números de OC e doca.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':                          'application/json',
        'x-api-key':                             apiKey,
        'anthropic-version':                     '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mtype, data: b64 } },
            { type: 'text',  text: prompt }
          ]
        }]
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const txt    = data.content.find(b => b.type === 'text')?.text || '';
    const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());

    ocrRows = parsed.linhas || [];
    renderOCR(ocrRows);
    updateLiveStrip();
    setOcrSt('ok', `✅ ${ocrRows.length} linhas extraídas!`);
    document.getElementById('ocr-res').style.display = 'block';
    toast('Extração concluída!');

  } catch (e) {
    setOcrSt('err', '❌ Erro: ' + e.message);
    toast('Erro na extração. Verifique a API Key.');
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER DA TABELA OCR
════════════════════════════════════════════════════════════ */

/**
 * Atualiza o status visual do processo OCR.
 * @param {'run'|'ok'|'err'} tipo
 * @param {string} msg
 */
function setOcrSt(tipo, msg) {
  const el = document.getElementById('ocr-status');
  el.style.display = 'block';
  el.innerHTML = `<div class="obar ${tipo}">
    ${tipo === 'run' ? '<div class="spin"></div>' : ''}${msg}
  </div>`;
}

/**
 * Renderiza as linhas extraídas pelo OCR na tabela de resultados.
 * @param {Object[]} rows
 */
function renderOCR(rows) {
  const tb = document.getElementById('tbody-res');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--mut);padding:20px">Nenhuma linha.</td></tr>';
    return;
  }
  const p = v => v ? v : `<span class="badge b-pend">—</span>`;
  tb.innerHTML = rows.map((r, i) => `<tr>
    <td style="font-size:11px">${p(r.placa)}</td>
    <td><b>${p(r.oc)}</b></td>
    <td><b style="color:var(--acc)">${p(r.doca)}</b></td>
    <td style="font-size:11px">${p(r.rota)}</td>
    <td>${p(r.pedidos)}</td>
    <td>${p(r.clientes)}</td>
    <td>${p(r.transportadora)}</td>
    <td><button class="btn btn-acc btn-sm" onclick="usarLinha(${i})">↗ Usar</button></td>
  </tr>`).join('');
}

/* ════════════════════════════════════════════════════════════
   EXPORTAÇÃO E HISTÓRICO
════════════════════════════════════════════════════════════ */

/**
 * Exporta as linhas OCR como arquivo CSV.
 */
function exportCSV() {
  if (!ocrRows.length) { toast('Nada para exportar.'); return; }
  const cols = ['placa','oc','doca','rota','pedidos','clientes','transportadora','status'];
  const csv  = [
    cols.join(';'),
    ...ocrRows.map(r => cols.map(c => r[c] || '').join(';'))
  ].join('\n');
  _downloadBlob('\uFEFF' + csv, `tabela_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  toast('CSV exportado!');
}

/**
 * Salva o resultado da leitura OCR no histórico.
 */
function salvarTabela() {
  historico.unshift({
    id:       crypto.randomUUID(),
    tipo:     'tabela',
    data:     new Date().toISOString(),
    rows:     ocrRows,
    foto:     null,
    mensagem: null
  });
  saveHist();
  toast('Salvo no histórico!');
}

/**
 * Restaura a tabela de teste (desenvolvimento/demonstração).
 */
function resetTabTeste() {
  ocrRows = TABELA_TESTE;
  renderOCR(ocrRows);
  updateLiveStrip();
  document.getElementById('ocr-res').style.display    = 'block';
  document.getElementById('ocr-status').style.display = 'block';
  document.getElementById('ocr-status').innerHTML =
    `<div class="obar ok">✅ ${ocrRows.length} linhas carregadas!</div>`;
  goTab('cloud', document.querySelectorAll('.ntab')[1]);
  toast('Tabela restaurada!');
}
