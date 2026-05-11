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
 * Gera a mensagem de conferência.
 * Suporta dois modos: padrão (template configurável) e SIREN PRO.
 * Inclui estado da carga e problemas identificados.
 * @returns {string} mensagem gerada
 */
function gerarMsg() {
  const now = new Date();

  // ── Valores base ──
  const estado    = document.getElementById('f-carga-estado').value || '';
  const problemas = document.getElementById('f-carga-problemas').value || '';
  const estadoInfo = estado ? _cargaEstadoInfo(estado) : null;

  const vals = {
    rota:     document.getElementById('f-rota').value     || '—',
    transp:   document.getElementById('f-transp').value   || '—',
    oc:       document.getElementById('f-oc').value       || '—',
    doca:     document.getElementById('f-doca').value     || '—',
    tubos:    document.getElementById('f-tubos').value    || 'Conferidos',
    caixa:    document.getElementById('f-caixa').value    || 'Conferida',
    conf:     document.getElementById('f-conf').value     || '—',
    aux1:     document.getElementById('f-aux1').value     || '—',
    aux2:     document.getElementById('f-aux2').value     || '—',
    obs:      document.getElementById('f-obs').value      || 'Nenhuma',
    hora:     document.getElementById('f-hora').value     || now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
    data:     now.toLocaleDateString('pt-BR'),
    pedidos:  document.getElementById('f-pedidos').value  || '—',
    clientes: document.getElementById('f-clientes').value || '—',
    // Campos de avaliação de carga
    carga_estado:       estadoInfo ? estadoInfo.label : 'NÃO AVALIADA',
    carga_estado_emoji: estadoInfo ? estadoInfo.emoji : '📦',
    carga_problemas_linha: problemas
      ? `• Problemas: ${problemas}`
      : '',
  };

  let msg = '';

  if (_tmplMode === 'siren') {
    // ── Template SIREN PRO ──
    msg = TMPL_SIREN;
  } else {
    // ── Template padrão (configurável) ──
    msg = storage.get(K_TMPL, '') || TMPL_PAD;

    // Adiciona bloco de carga ao template padrão se avaliado
    if (estado) {
      const cargaBloco = `\nEstado da carga: ${estadoInfo.emoji} ${estadoInfo.label}` +
        (problemas ? `\nProblemas: ${problemas}` : '');
      // Insere antes de OBS se existir, senão no final
      if (msg.includes('[obs]')) {
        msg = msg.replace('[obs]', `[obs]${cargaBloco}`);
      } else {
        msg += cargaBloco;
      }
    }
  }

  // ── Substitui todos os placeholders ──
  for (const [k, v] of Object.entries(vals)) {
    msg = msg.replaceAll(`[${k}]`, v);
  }

  // Remove linha vazia se carga_problemas_linha for vazio
  msg = msg.replace(/\n\n+/g, '\n\n').trim();

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
    cargaEstado:    document.getElementById('f-carga-estado').value || '',
    cargaProblemas: document.getElementById('f-carga-problemas').value || '',
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

  // Limpa avaliação de carga
  document.getElementById('f-carga-estado').value   = '';
  document.getElementById('f-carga-problemas').value = '';
  ['cg-ok','cg-irr','cg-risc'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  document.querySelectorAll('.stbtn-multi').forEach(b => b.classList.remove('on'));
  document.getElementById('carga-problemas-wrap').style.display = 'none';
  _problemasSet.clear();

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

/* ════════════════════════════════════════════════════════════
   AVALIAÇÃO DE CARGA
════════════════════════════════════════════════════════════ */

/** Conjunto de problemas selecionados */
let _problemasSet = new Set();

/**
 * Define o estado geral da carga e exibe/oculta painel de problemas.
 * @param {'OK'|'IRR'|'RISC'} estado
 */
function setCargaEstado(estado) {
  document.getElementById('f-carga-estado').value = estado;

  // Reset visual dos botões de estado
  ['cg-ok','cg-irr','cg-risc'].forEach(id =>
    document.getElementById(id)?.classList.remove('on')
  );
  const map = { OK:'cg-ok', IRR:'cg-irr', RISC:'cg-risc' };
  document.getElementById(map[estado])?.classList.add('on');

  // Mostra painel de problemas se irregular ou risco
  const wrap = document.getElementById('carga-problemas-wrap');
  if (wrap) {
    wrap.style.display = (estado === 'IRR' || estado === 'RISC') ? 'block' : 'none';
  }

  // Limpa problemas se voltou para OK
  if (estado === 'OK') {
    _problemasSet.clear();
    document.querySelectorAll('.stbtn-multi').forEach(b => b.classList.remove('on'));
    document.getElementById('f-carga-problemas').value = '';
  }
}

/**
 * Alterna seleção de um problema específico.
 * @param {string} problema
 */
function toggleProblema(problema) {
  if (_problemasSet.has(problema)) {
    _problemasSet.delete(problema);
  } else {
    _problemasSet.add(problema);
  }

  // Atualiza visual — encontra o botão pelo texto
  document.querySelectorAll('.stbtn-multi').forEach(btn => {
    const txt = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (txt === problema) btn.classList.toggle('on', _problemasSet.has(problema));
  });

  document.getElementById('f-carga-problemas').value = [..._problemasSet].join(', ');
}

/**
 * Retorna label e emoji do estado da carga.
 * @param {string} estado
 * @returns {{label:string, emoji:string, cls:string}}
 */
function _cargaEstadoInfo(estado) {
  const map = {
    OK:   { label: 'BEM ARRUMADA',    emoji: '✅', cls: 'carga-ok'   },
    IRR:  { label: 'IRREGULAR',       emoji: '⚠️', cls: 'carga-irr'  },
    RISC: { label: 'RISCO DE AVARIA', emoji: '🚨', cls: 'carga-risc' },
  };
  return map[estado] || { label: estado, emoji: '📦', cls: 'carga-ok' };
}

/* ════════════════════════════════════════════════════════════
   SELETOR DE TEMPLATE
════════════════════════════════════════════════════════════ */

let _tmplMode = 'padrao'; // 'padrao' ou 'siren'

/**
 * Alterna entre template padrão e SIREN PRO.
 * @param {'padrao'|'siren'} modo
 */
function setTmplMode(modo) {
  _tmplMode = modo;
  document.getElementById('tmpl-pad-btn')?.classList.toggle('on', modo === 'padrao');
  document.getElementById('tmpl-siren-btn')?.classList.toggle('on', modo === 'siren');
  gerarMsg(); // atualiza preview imediatamente
}

/* ════════════════════════════════════════════════════════════
   TEMPLATE SIREN PRO
════════════════════════════════════════════════════════════ */

const TMPL_SIREN = `══════════════════
📦 STATUS DE EXPEDIÇÃO

🚚 ROTA: [rota]
🏢 TRANS.: [transp]
📄 OC: [oc]
🚪 DOCA: [doca]

📊 OPERAÇÃO
• PED.: [pedidos]
• CLI.: [clientes]

✅ CHECKLIST
• Tubos: [tubos]
• CX D'ÁGUA: [caixa]

📦 ESTADO DA CARGA
• [carga_estado_emoji] [carga_estado]
[carga_problemas_linha]

👥 EQUIPE
• CONF.: [conf]
• AUX.: [aux1] / [aux2]

📝 OCORRÊNCIA
• [obs]

⏰ FINALIZAÇÃO
• Hora: [hora]
• Data: [data]
══════════════════`;
