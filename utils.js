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
  {placa:'KUT3F21',              oc:'118629',doca:'17',rota:'NITEROI 1 E 2',            pedidos:'17',clientes:'16',transportadora:'MP'},
  {placa:'TTF1D24',              oc:'118632',doca:'20',rota:'Arraial / CABO FRIO',       pedidos:'23',clientes:'13',transportadora:'MP'},
  {placa:'TUE3F22/FABIO ANDRADE',oc:'118633',doca:'22',rota:'Arraial / CABO FRIO',      pedidos:'20',clientes:'13',transportadora:'KING'},
  {placa:'TTG2B18/MADSON',       oc:'118634',doca:'24',rota:'São Pedro da Aldeia',       pedidos:'17',clientes:'12',transportadora:'KING'},
  {placa:'TTF4C12',              oc:'118638',doca:'22',rota:'MACAE 1',                   pedidos:'16',clientes:'13',transportadora:'MP'},
  {placa:'LTL4H19',              oc:'118644',doca:'19',rota:'SUL FLUMINENSE 1',          pedidos:'23',clientes:'17',transportadora:'PM&F'},
  {placa:'TTJ4D66',              oc:'118645',doca:'21',rota:'SUL FLUMINENSE 2',          pedidos:'21',clientes:'17',transportadora:'MP'},
  {placa:'TTE4H91',              oc:'118647',doca:'23',rota:'TERESOPOLIS 1 E 2',         pedidos:'36',clientes:'21',transportadora:'MP'},
  {placa:'TTF1D23',              oc:'118649',doca:'25',rota:'COSTA VERDE 1 E 2 + PISA',  pedidos:'18',clientes:'15',transportadora:'MP'},
  {placa:'NTO9E48',              oc:'118657',doca:'18',rota:'NITEROI 1',                 pedidos:'22',clientes:'17',transportadora:'MP 2'},
  {placa:'TTF4A69',              oc:'118658',doca:'20',rota:'NITEROI 2',                 pedidos:'20',clientes:'15',transportadora:'MP'},
  {placa:'TTH4H56',              oc:'118659',doca:'22',rota:'NITEROI 3',                 pedidos:'23',clientes:'18',transportadora:'MP'},
  {placa:'TTO0I44',              oc:'118660',doca:'24',rota:'ROCINHA',                   pedidos:'12',clientes:'11',transportadora:'MP'},
  {placa:'TUD3G65/ANDERSON',     oc:'118666',doca:'19',rota:'NOVA IGUAÇU 1 E 2',        pedidos:'29',clientes:'20',transportadora:'KING'},
  {placa:'ANW8E45',              oc:'118667',doca:'23',rota:'JACAREPAGUA 1 E 2',         pedidos:'27',clientes:'22',transportadora:'JSR'},
  {placa:'LBU4E92',              oc:'118668',doca:'21',rota:'ZONA OESTE 1',              pedidos:'34',clientes:'24',transportadora:'CARGO'},
  {placa:'LKK2D13',              oc:'118669',doca:'23',rota:'ZONA OESTE 3 E 6',          pedidos:'22',clientes:'17',transportadora:'CARGO'},
  {placa:'LBZ6E56',              oc:'118670',doca:'25',rota:'ZONA OESTE 6',              pedidos:'23',clientes:'18',transportadora:'CARGO'},
  {placa:'TUE3F28/ALEXANDRE',    oc:'118676',doca:'18',rota:'CAXIAS 2',                  pedidos:'21',clientes:'19',transportadora:'KING'},
  {placa:'DPC8B91',              oc:'118677',doca:'20',rota:'NOVA IGUAÇU 4',             pedidos:'28',clientes:'21',transportadora:'JSR'},
  {placa:'LUD3B91',              oc:'118679',doca:'24',rota:'ZONA NORTE 2',              pedidos:'21',clientes:'18',transportadora:'JSR'},
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
