/**
 * conferencia.js — DockCheck v2
 * Lógica central da aba de conferência:
 * busca de equipe por doca, preenchimento de campos,
 * compressão e gestão de fotos, geração de mensagem.
 * Depende de: storage.js, utils.js, timer.js, fila.js, equipes.js
 */

'use strict';

/* ── Estado de fotos ── */
let fotosCAM = []; // array de base64 comprimidas (WEBP)

/* ════════════════════════════════════════════════════════════
   INPUT DA DOCA — entry point principal
════════════════════════════════════════════════════════════ */

let _docaDebounce = null;

/**
 * Handler do input do campo de doca.
 * Debounce de 200ms para evitar buscas a cada tecla.
 * @param {string} val
 */
function onDocaInput(val) {
  clearTimeout(_docaDebounce);
  _docaDebounce = setTimeout(() => buscarEquipe(val), 200);
}

/**
 * Busca equipe e OCs para a doca digitada.
 * Atualiza equipe, fila de OC, seletores e inicia cronômetro.
 * @param {string} doca
 */
function buscarEquipe(doca) {
  const d = doca.trim();
  if (!d) { limparTudo(); pararTimer(); return; }

  // ── Equipes ──
  const ativas = equipes.filter(
    e => e.status === 'ativa' && e.docas.map(x => x.trim()).includes(d)
  );
  const msel = document.getElementById('multi-sel');

  if (!ativas.length) {
    limparEquipe();
    msel.style.display = 'none';
  } else if (ativas.length === 1) {
    preencherEquipe(ativas[0]);
    msel.style.display = 'none';
  } else {
    // Múltiplas equipes — exibe seletor
    msel.style.display = 'block';
    const sel = document.getElementById('sel-eq');
    sel.innerHTML    = ativas.map((e, i) => `<option value="${i}">${e.conf}</option>`).join('');
    sel.dataset.eq   = JSON.stringify(ativas);
    preencherEquipe(ativas[0]);
  }

  // ── Fila de OC ──
  const { linhas, feitas, proxima } = construirFilaDoca(d);
  atualizarFilaStatus(d, linhas, feitas);

  const moc = document.getElementById('multi-oc');

  if (!linhas.length) {
    moc.style.display = 'none';
  } else if (linhas.length === 1) {
    preencherCarga(linhas[0]);
    moc.style.display = 'none';
    if (feitas.has(linhas[0].oc?.trim())) {
      toast(`⚠️ Doca ${d}: OC ${linhas[0].oc} já conferida hoje`);
    }
  } else {
    // Múltiplas OCs — seleciona a próxima pendente automaticamente
    const alvo = proxima || linhas[0];
    preencherCarga(alvo);
    moc.style.display = 'block';

    const sel = document.getElementById('sel-oc');
    sel.innerHTML = linhas.map((r, i) => {
      const feita = feitas.has(r.oc?.trim());
      return `<option value="${i}" ${r === alvo ? 'selected' : ''} ${feita ? 'style="color:var(--mut)"' : ''}>
        ${feita ? '✅ ' : ''}OC ${r.oc || '?'} — ${r.rota || 'sem rota'} (${r.placa || '—'})
      </option>`;
    }).join('');
    sel.dataset.linhas = JSON.stringify(linhas);

    const pend = linhas.length - feitas.size;
    if (pend > 0) toast(`Doca ${d}: OC ${alvo.oc} selecionada (${pend} pendente${pend > 1 ? 's' : ''})`);
    else          toast(`⚠️ Doca ${d}: todas as OCs já foram conferidas hoje`);
  }

  // ── Cronômetro ── inicia se houver OC pendente
  if (linhas.length && (linhas.length - feitas.size) > 0) {
    iniciarTimer(d);
  }
}

/* ── Handlers dos seletores ── */

function escolherEquipe() {
  const sel = document.getElementById('sel-eq');
  preencherEquipe(JSON.parse(sel.dataset.eq || '[]')[parseInt(sel.value)]);
}

function escolherOC() {
  const sel = document.getElementById('sel-oc');
  preencherCarga(JSON.parse(sel.dataset.linhas || '[]')[parseInt(sel.value)]);
}

/* ── Preencher campos ── */

/**
 * Preenche os campos de equipe (conferente, aux1, aux2).
 * @param {Object} eq
 */
function preencherEquipe(eq) {
  if (!eq) return;
  document.getElementById('f-conf').value = eq.conf || '';
  document.getElementById('f-aux1').value = eq.aux1 || '';
  document.getElementById('f-aux2').value = eq.aux2 || '';
}

/**
 * Preenche os campos de carga (OC, placa, rota, transportadora, pedidos, clientes).
 * @param {Object} r — linha da tabela OCR
 */
function preencherCarga(r) {
  if (!r) return;
  if (r.oc)             document.getElementById('f-oc').value      = r.oc;
  if (r.placa)          document.getElementById('f-placa').value   = r.placa;
  if (r.rota)           document.getElementById('f-rota').value    = r.rota;
  if (r.transportadora) document.getElementById('f-transp').value  = r.transportadora;
  if (r.pedidos)        document.getElementById('f-pedidos').value = r.pedidos;
  if (r.clientes)       document.getElementById('f-clientes').value = r.clientes;
}

/**
 * Limpa apenas os campos de equipe.
 */
function limparEquipe() {
  ['f-conf','f-aux1','f-aux2'].forEach(id => document.getElementById(id).value = '');
}

/**
 * Limpa todos os campos da conferência (equipe + carga + seletores).
 */
function limparTudo() {
  limparEquipe();
  ['f-oc','f-placa','f-rota','f-transp','f-pedidos','f-clientes']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('multi-sel').style.display    = 'none';
  document.getElementById('multi-oc').style.display     = 'none';
  document.getElementById('fila-status').style.display  = 'none';
}

/**
 * Alterna status de tubos ou caixa d'água.
 * @param {'tubos'|'caixa'} tipo
 * @param {string} val
 */
function setSt(tipo, val) {
  if (tipo === 'tubos') {
    document.getElementById('f-tubos').value = val;
    const m = { Conferidos:'tb-conf', Ausentes:'tb-aus', Parcial:'tb-par', 'Não tem':'tb-nt' };
    document.querySelectorAll('[id^="tb-"]').forEach(b => b.classList.remove('on'));
    document.getElementById(m[val])?.classList.add('on');
  } else {
    document.getElementById('f-caixa').value = val;
    const m = { Conferida:'cb-conf', Ausente:'cb-aus', Parcial:'cb-par', 'Não tem':'cb-nt' };
    document.querySelectorAll('[id^="cb-"]').forEach(b => b.classList.remove('on'));
    document.getElementById(m[val])?.classList.add('on');
  }
}

/* ════════════════════════════════════════════════════════════
   FOTOS — COMPRESSÃO WEBP AUTOMÁTICA
════════════════════════════════════════════════════════════ */

/**
 * Comprime uma imagem para WEBP com max 900px e qualidade 0.75.
 * Fallback para JPEG se WEBP não for suportado.
 * Não bloqueia a main thread (usa Promise).
 * @param {string} dataUrl
 * @returns {Promise<string>} data URL comprimida
 */
function compressImage(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 900;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const webp = canvas.toDataURL('image/webp', 0.75);
      // Verifica suporte real a WEBP
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.80));
    };
    img.src = dataUrl;
  });
}

/**
 * Estima o tamanho em KB de um base64.
 * @param {string} b64
 * @returns {number}
 */
function _sizeKB(b64) {
  return Math.round((b64.length * 3 / 4) / 1024);
}

/**
 * Lê um File como base64 data URL.
 * @param {File} file
 * @returns {Promise<string>}
 */
function _fileToBase64(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsDataURL(file);
  });
}

/**
 * Adiciona fotos ao array fotosCAM com compressão automática.
 * Suporta múltiplos arquivos.
 * @param {Event} ev
 */
async function addFoto(ev) {
  const files = Array.from(ev.target.files);
  if (!files.length) return;
  toast('⏳ Comprimindo foto(s)...');
  for (const file of files) {
    const raw        = await _fileToBase64(file);
    const compressed = await compressImage(raw);
    fotosCAM.push(compressed);
  }
  renderFotosGrid();
  ev.target.value = ''; // permite selecionar o mesmo arquivo novamente
  toast(`✅ ${files.length} foto${files.length > 1 ? 's' : ''} adicionada${files.length > 1 ? 's' : ''}`);
}

/**
 * Renderiza a grade de miniaturas das fotos adicionadas.
 */
function renderFotosGrid() {
  const grid     = document.getElementById('fotos-grid');
  const count    = document.getElementById('fotos-count');
  const addArea  = document.getElementById('farea-add');
  const sizeInfo = document.getElementById('fotos-size-info');

  if (!fotosCAM.length) {
    grid.innerHTML    = '';
    count.textContent = 'Nenhuma foto adicionada';
    addArea.style.minHeight = '80px';
    sizeInfo.textContent = 'Compressão automática ativa (WEBP)';
    return;
  }

  const totalKB = fotosCAM.reduce((s, f) => s + _sizeKB(f), 0);
  count.textContent    = `${fotosCAM.length} foto${fotosCAM.length > 1 ? 's' : ''} adicionada${fotosCAM.length > 1 ? 's' : ''}`;
  sizeInfo.textContent = `Tamanho total: ~${totalKB}KB (comprimidas)`;
  addArea.style.minHeight = '60px';

  grid.innerHTML = fotosCAM.map((b64, i) => `
    <div class="foto-thumb">
      <img src="${b64}" loading="lazy">
      <button class="foto-del" onclick="removerFoto(${i})">✕</button>
      <div class="foto-num">${i + 1}</div>
      <div class="foto-size">${_sizeKB(b64)}KB</div>
    </div>
  `).join('');
}

function removerFoto(i) { fotosCAM.splice(i, 1); renderFotosGrid(); }
function clearFotos()   { fotosCAM = []; renderFotosGrid(); }

/**
 * Usa uma linha da tabela OCR preenchendo a aba Conferência.
 * Navega para a aba e preenche todos os campos.
 * @param {number} i — índice em ocrRows
 */
function usarLinha(i) {
  const r = ocrRows[i];
  if (!r) return;
  goTab('conferencia', document.querySelector('.ntab'));
  setTimeout(() => {
    if (r.doca) { document.getElementById('f-doca').value = r.doca; buscarEquipe(r.doca); }
    if (r.oc)             document.getElementById('f-oc').value      = r.oc;
    if (r.placa)          document.getElementById('f-placa').value   = r.placa;
    if (r.rota)           document.getElementById('f-rota').value    = r.rota;
    if (r.transportadora) document.getElementById('f-transp').value  = r.transportadora;
    if (r.pedidos)        document.getElementById('f-pedidos').value = r.pedidos;
    if (r.clientes)       document.getElementById('f-clientes').value = r.clientes;
    gerarMsg();
    toast('✅ Dados importados! Tire a foto do caminhão.');
  }, 100);
}
