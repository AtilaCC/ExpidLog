/**
 * utils.js — DockCheck v2
 * Utilitários globais: formatação de tempo, toast, download, constantes.
 * Sem dependências de outros módulos.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTES
════════════════════════════════════════════════════════════ */

const TMPL_PAD = `Rota: [rota]
Transportadora: [transp]
OC: [oc]
Doca: [doca]
Pedidos: [pedidos]
Clientes: [clientes]
Tubos: [tubos]
Caixa d'água: [caixa]
Conferente: [conf]
Auxiliares: [aux1] e [aux2]
OBS: [obs]
Horário: [hora]
Data: [data]`;

const TABELA_TESTE = [
  {placa:'LRY9E56',oc:'119715',doca:'11',rota:'MACAÉ',                        pedidos:'11',clientes:'10',transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',oc:'119716',doca:'11',rota:'CAMPOS 1',                     pedidos:'12',clientes:'12',transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',oc:'119717',doca:'12',rota:'SÃO JOÃO DA BARRA',            pedidos:'6', clientes:'6', transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',oc:'119718',doca:'12',rota:'SÃO FRANCISCO DE ITABAPOANA',  pedidos:'9', clientes:'7', transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',oc:'119719',doca:'12',rota:'CAMPOS 2',                     pedidos:'7', clientes:'5', transportadora:'FG EXPRESS'},
  {placa:'RNT5I58',oc:'119720',doca:'10',rota:'NOROESTE',                     pedidos:'18',clientes:'17',transportadora:'EXPRESSO HJ'},
  {placa:'RNT5I58',oc:'119721',doca:'9', rota:'TRÊS RIOS',                    pedidos:'3', clientes:'3', transportadora:'EXPRESSO HJ'},
  {placa:'LRY9E56',oc:'119722',doca:'11',rota:'MACAÉ',                        pedidos:'12',clientes:'10',transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',oc:'119723',doca:'11',rota:'CAMPOS 1',                     pedidos:'16',clientes:'11',transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',oc:'119724',doca:'12',rota:'SÃO JOÃO DA BARRA',            pedidos:'2', clientes:'2', transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',oc:'119725',doca:'12',rota:'SÃO FRANCISCO DE ITABAPOANA',  pedidos:'7', clientes:'6', transportadora:'FG EXPRESS'},
  {placa:'RNT5I58',oc:'119726',doca:'10',rota:'NOROESTE',                     pedidos:'34',clientes:'29',transportadora:'EXPRESSO HJ'},
];

const EQUIPES_TESTE = [
  {id:'et1',conf:'Rafael',  aux1:'André',    aux2:'Maurício', docas:['20'],status:'ativa'},
  {id:'et2',conf:'Carlos',  aux1:'João',     aux2:'Pedro',    docas:['17'],status:'ativa'},
  {id:'et3',conf:'Marcos',  aux1:'Luis',     aux2:'Fábio',    docas:['22'],status:'ativa'},
  {id:'et4',conf:'Eduardo', aux1:'Robson',   aux2:'',         docas:['24'],status:'ativa'},
  {id:'et5',conf:'Diego',   aux1:'Alexandre',aux2:'Anderson', docas:['19'],status:'ativa'},
  {id:'et6',conf:'Thiago',  aux1:'Ricardo',  aux2:'',         docas:['21'],status:'ativa'},
  {id:'et7',conf:'Leandro', aux1:'Matheus',  aux2:'Igor',     docas:['23'],status:'ativa'},
  {id:'et8',conf:'Fernando',aux1:'Bruno',    aux2:'',         docas:['25'],status:'ativa'},
  {id:'et9',conf:'Sandro',  aux1:'Rogério',  aux2:'',         docas:['18'],status:'ativa'},
];

/* ════════════════════════════════════════════════════════════
   FORMATAÇÃO DE TEMPO
════════════════════════════════════════════════════════════ */

/**
 * Zero-pad de número para HH:MM.
 * @param {number} n
 * @returns {string}
 */
function _padTime(n) {
  return String(n).padStart(2, '0');
}

/**
 * Detecta o turno a partir de uma string HH:MM.
 * @param {string} horaStr
 * @returns {'manha'|'tarde'|'noite'|null}
 */
function _turnoDeHora(horaStr) {
  if (!horaStr) return null;
  const h = parseInt(horaStr.split(':')[0], 10);
  if (isNaN(h)) return null;
  if (h >= 6  && h < 14) return 'manha';
  if (h >= 14 && h < 22) return 'tarde';
  return 'noite';
}

/**
 * Calcula duração em minutos de um registro de conferência.
 * Prioriza duracaoSeg (cronômetro real) sobre cálculo por horário.
 * @param {Object} h — registro do histórico
 * @returns {number|null}
 */
function _duracaoMin(h) {
  if (h.duracaoSeg && h.duracaoSeg > 60) return Math.round(h.duracaoSeg / 60);
  if (!h.hora || !h.data) return null;
  const reg = new Date(h.data);
  const pts = h.hora.split(':');
  if (pts.length < 2) return null;
  const hh = parseInt(pts[0], 10), mm = parseInt(pts[1], 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  const ini = new Date(reg);
  ini.setHours(hh, mm, 0, 0);
  let diff = (reg - ini) / 60000;
  if (diff < 0) diff += 1440; // cruzou meia-noite
  if (diff < 1 || diff > 480) return null; // sanidade: <1min ou >8h
  return Math.round(diff);
}

/**
 * Formata minutos para string legível: "38min" ou "1h23".
 * @param {number|null} min
 * @returns {string}
 */
function _fmtMin(min) {
  if (min === null || min === undefined) return '—';
  if (min < 60) return min + 'min';
  return Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0');
}

/**
 * Formata segundos para string legível: "2min45s".
 * @param {number|null} sec
 * @returns {string}
 */
function _fmtSec(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + 'min' + (s > 0 ? s + 's' : '');
}

/* ════════════════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════════════════ */

let _toastTimer;

/**
 * Exibe uma notificação toast temporária.
 * @param {string} msg
 * @param {number} duration — ms (padrão 3200)
 */
function toast(msg, duration = 3200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.display = 'none'; }, duration);
}

/* ════════════════════════════════════════════════════════════
   DOWNLOAD
════════════════════════════════════════════════════════════ */

/**
 * Cria e dispara o download de um blob.
 * Revoga a URL de objeto após 1s para liberar memória.
 * @param {string|Uint8Array} content
 * @param {string} filename
 * @param {string} type — MIME type
 */
function _downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ════════════════════════════════════════════════════════════
   COMPARTILHAR TEXTO (Web Share API + fallback clipboard)
════════════════════════════════════════════════════════════ */

/**
 * Compartilha texto via Web Share API.
 * Fallback: copia para clipboard e abre WhatsApp.
 * @param {string} texto
 * @param {string} toastMsg — mensagem exibida no fallback
 */
async function _compartilharTexto(texto, toastMsg) {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // usuário cancelou
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast(toastMsg + ' Abrindo WhatsApp...');
    setTimeout(() => window.open('https://wa.me/', '_blank'), 800);
  } catch {
    toast('Erro ao copiar. Tente novamente.');
  }
}
