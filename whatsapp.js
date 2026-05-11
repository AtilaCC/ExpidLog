/**
 * whatsapp.js — DockCheck v2
 * Geração de mensagem de conferência, modal de envio,
 * compartilhamento via Web Share API, registro no histórico.
 * Depende de: storage.js, utils.js, timer.js, conferencia.js, historico.js
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   GERAÇÃO DE MENSAGEM
════════════════════════════════════════════════════════════ */

/**
 * Gera a mensagem de conferência a partir do template configurado.
 * Substitui todos os placeholders pelos valores dos campos.
 * @returns {string} mensagem gerada
 */
function gerarMsg() {
  const tmpl = storage.get(K_TMPL, '') || TMPL_PAD;
  const now  = new Date();

  const vals = {
    rota:     document.getElementById('f-rota').value    || '—',
    transp:   document.getElementById('f-transp').value  || '—',
    oc:       document.getElementById('f-oc').value      || '—',
    doca:     document.getElementById('f-doca').value    || '—',
    tubos:    document.getElementById('f-tubos').value   || 'Conferidos',
    caixa:    document.getElementById('f-caixa').value   || 'Conferida',
    conf:     document.getElementById('f-conf').value    || '—',
    aux1:     document.getElementById('f-aux1').value    || '—',
    aux2:     document.getElementById('f-aux2').value    || '—',
    obs:      document.getElementById('f-obs').value     || 'Nenhuma',
    hora:     document.getElementById('f-hora').value    || now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
    data:     now.toLocaleDateString('pt-BR'),
    pedidos:  document.getElementById('f-pedidos').value || '—',
    clientes: document.getElementById('f-clientes').value || '—',
  };

  let msg = tmpl;
  for (const [k, v] of Object.entries(vals)) {
    msg = msg.replaceAll(`[${k}]`, v);
  }

  document.getElementById('msgbox').textContent = msg;
  return msg;
}

function editarMsg() {
  const el = document.getElementById('msgbox');
  el.contentEditable = el.contentEditable === 'true' ? 'false' : 'true';
  if (el.contentEditable === 'true') el.focus();
}

function copiarMsg() {
  navigator.clipboard
    .writeText(document.getElementById('msgbox').textContent)
    .then(() => toast('Mensagem copiada!'));
}

/* ════════════════════════════════════════════════════════════
   MODAL DE ENVIO
════════════════════════════════════════════════════════════ */

/**
 * Abre o modal de envio para WhatsApp.
 * Pré-preenche mensagem e preview das fotos.
 */
function abrirEnvio() {
  const msg = gerarMsg();
  document.getElementById('env-msg').textContent = msg;

  const tem = fotosCAM.length > 0;
  document.getElementById('env-foto-ok').style.display    = tem ? 'block' : 'none';
  document.getElementById('env-foto-vazia').style.display = tem ? 'none'  : 'block';

  if (tem) {
    document.getElementById('env-fotos-label').textContent =
      `${fotosCAM.length} foto${fotosCAM.length > 1 ? 's' : ''} serão enviadas`;
    document.getElementById('env-fotos-preview').innerHTML = fotosCAM.map(b64 =>
      `<img src="${b64}" style="height:80px;width:80px;object-fit:cover;border-radius:8px;flex-shrink:0">`
    ).join('');
  }

  document.getElementById('share-fallback').style.display = 'none';
  document.getElementById('ov-envio').classList.add('on');
}

function fecharEnvio() {
  document.getElementById('ov-envio').classList.remove('on');
}

/* ════════════════════════════════════════════════════════════
   COMPARTILHAR (Web Share API + fallbacks)
════════════════════════════════════════════════════════════ */

/**
 * Compartilha fotos + texto via Web Share API.
 * Fallback 1: share só texto.
 * Fallback 2: copia texto + abre WhatsApp.
 */
async function compartilharTudo() {
  const msg = document.getElementById('env-msg').textContent;

  // Tenta compartilhar com arquivos (fotos + texto)
  if (fotosCAM.length > 0 && navigator.canShare) {
    try {
      const files = await Promise.all(fotosCAM.map(async (b64, i) => {
        const res  = await fetch(b64);
        const blob = await res.blob();
        const ext  = blob.type.includes('webp') ? 'webp' : 'jpg';
        return new File(
          [blob],
          `carga_doca${document.getElementById('f-doca').value}_${i + 1}.${ext}`,
          { type: blob.type }
        );
      }));
      if (navigator.canShare({ files, text: msg })) {
        await navigator.share({ files, text: msg });
        registrarEnvio();
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return; // usuário cancelou
    }
  }

  // Fallback: share só texto
  if (navigator.share) {
    try {
      await navigator.share({ text: msg });
      registrarEnvio();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Último fallback: copia + abre WhatsApp
  document.getElementById('share-fallback').style.display = 'block';
  navigator.clipboard.writeText(msg).then(() => {
    toast('Texto copiado! Abrindo WhatsApp...');
    setTimeout(() => window.open('https://wa.me/', '_blank'), 700);
  });
}

function soCopiar() {
  navigator.clipboard
    .writeText(document.getElementById('env-msg').textContent)
    .then(() => toast('Texto copiado!'));
}

/* ════════════════════════════════════════════════════════════
   REGISTRO DE ENVIO
════════════════════════════════════════════════════════════ */

/**
 * Registra a conferência no histórico e avança para a próxima OC.
 * Captura duração real do cronômetro.
 * Limpa campos de carga mas mantém doca e equipe para agilizar.
 */
function registrarEnvio() {
  const msg      = document.getElementById('env-msg').textContent;
  const docaVal  = document.getElementById('f-doca').value;
  const duracaoSeg = timerGetDuracaoSeg();

  historico.unshift({
    id:             crypto.randomUUID(),
    tipo:           'conferencia',
    data:           new Date().toISOString(),
    doca:           docaVal,
    rota:           document.getElementById('f-rota').value,
    conf:           document.getElementById('f-conf').value,
    oc:             document.getElementById('f-oc').value,
    hora:           document.getElementById('f-hora').value,
    pedidos:        document.getElementById('f-pedidos').value,
    clientes:       document.getElementById('f-clientes').value,
    transportadora: document.getElementById('f-transp').value,
    duracaoSeg,
    mensagem:       msg,
    fotos:          [...fotosCAM]
  });

  saveHist();
  fecharEnvio();
  pararTimer();

  // Limpa campos de carga — mantém doca e equipe
  ['f-oc','f-placa','f-rota','f-transp','f-pedidos','f-clientes']
    .forEach(id => document.getElementById(id).value = '');
  fotosCAM = [];
  renderFotosGrid();
  document.getElementById('f-obs').value = '';

  // Reset horário para agora
  const now = new Date();
  document.getElementById('f-hora').value =
    _padTime(now.getHours()) + ':' + _padTime(now.getMinutes());
  document.getElementById('msgbox').textContent =
    'Preencha os dados acima para gerar a mensagem...';

  updateLiveStrip();

  // Avança para próxima OC da mesma doca automaticamente
  if (docaVal) buscarEquipe(docaVal);
  toast('✅ Conferência registrada! Próxima OC carregada.');
}
