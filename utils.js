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
  {placa:'LRY9E56',               oc:'119717',doca:'12',rota:'SÃO JOÃO DA BARRA',                  pedidos:'6', clientes:'6', transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',               oc:'119718',doca:'12',rota:'SÃO FRANCISCO DE ITABAPOANA',        pedidos:'9', clientes:'7', transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',               oc:'119719',doca:'12',rota:'CAMPOS 2',                           pedidos:'7', clientes:'5', transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',               oc:'119724',doca:'12',rota:'SÃO JOÃO DA BARRA',                  pedidos:'2', clientes:'2', transportadora:'FG EXPRESS'},
  {placa:'LRY9E56',               oc:'119725',doca:'12',rota:'SÃO FRANCISCO DE ITABAPOANA',        pedidos:'7', clientes:'6', transportadora:'FG EXPRESS'},
  {placa:'GSV8572',               oc:'119727',doca:'13',rota:'ZONA OESTE 1',                       pedidos:'18',clientes:'17',transportadora:'CARGO'},
  {placa:'KZP7F35',               oc:'119728',doca:'15',rota:'NITEROI 1 E 2',                      pedidos:'21',clientes:'18',transportadora:'MP 2'},
  {placa:'AQK8432',               oc:'119729',doca:'18',rota:'NOVA IGUAÇU 4',                      pedidos:'9', clientes:'7', transportadora:'MP'},
  {placa:'TUM0F96/ANDERSON PIRES',oc:'119730',doca:'20',rota:'Araruama/Saquarema',                 pedidos:'23',clientes:'16',transportadora:'KING'},
  {placa:'TUE3F22/FABIO ANDRADE', oc:'119731',doca:'22',rota:'Arraial / Cabo Frio + PISAS',        pedidos:'21',clientes:'15',transportadora:'KING'},
  {placa:'TTG2B18/MADSON',        oc:'119732',doca:'24',rota:'São Pedro da Aldeia /Iguaba',        pedidos:'16',clientes:'14',transportadora:'KING'},
  {placa:'LQB8B02',               oc:'119739',doca:'14',rota:'VALENÇA / BARRA DO PIRAI',           pedidos:'26',clientes:'19',transportadora:'DMD'},
  {placa:'KWR3C29',               oc:'119741',doca:'16',rota:'SUL FLUMINENSE 2',                   pedidos:'20',clientes:'17',transportadora:'PM&F'},
  {placa:'ANF9580',               oc:'119742',doca:'19',rota:'SUL FLUMINENSE 1 + PISA',            pedidos:'16',clientes:'16',transportadora:'MP 2'},
  {placa:'TTF1D24',               oc:'119743',doca:'21',rota:'TERESOPOLIS 1 E 2',                  pedidos:'19',clientes:'15',transportadora:'MP'},
  {placa:'TTE4H91',               oc:'119745',doca:'23',rota:'COSTA VERDE 1 E 2',                  pedidos:'23',clientes:'20',transportadora:'MP'},
  {placa:'TTF3I59',               oc:'119751',doca:'25',rota:'PETRÓPOLIS',                         pedidos:'38',clientes:'25',transportadora:'MP'},
  {placa:'NTO9E48',               oc:'119752',doca:'15',rota:'NITEROI 1 + PISA',                   pedidos:'27',clientes:'18',transportadora:'MP 2'},
  {placa:'TTJ4D66',               oc:'119753',doca:'18',rota:'NITEROI 2',                          pedidos:'28',clientes:'20',transportadora:'MP'},
  {placa:'TTH4H56',               oc:'119754',doca:'20',rota:'NITEROI 3',                          pedidos:'21',clientes:'15',transportadora:'MP'},
  {placa:'TTO0I44',               oc:'119755',doca:'17',rota:'ROCINHA',                            pedidos:'22',clientes:'19',transportadora:'MP'},
  {placa:'KVM2B95',               oc:'119756',doca:'22',rota:'CENTRO Z/SUL',                       pedidos:'22',clientes:'20',transportadora:'JSR'},
  {placa:'TUX3F23/MARCELLUS',     oc:'119758',doca:'24',rota:'NOVA IGUAÇU 4',                      pedidos:'20',clientes:'15',transportadora:'KING'},
  {placa:'TTS0G20/DENIMAR',       oc:'119764',doca:'16',rota:'NOVA IGUAÇU 3',                      pedidos:'19',clientes:'16',transportadora:'KING'},
  {placa:'OMC5106',               oc:'119765',doca:'19',rota:'NOVA IGUAÇU 1',                      pedidos:'16',clientes:'15',transportadora:'DMD'},
  {placa:'LBU4E92',               oc:'119766',doca:'21',rota:'JACAREPAGUA / MADUREIRA / CASCADURA',pedidos:'20',clientes:'15',transportadora:'CARGO'},
  {placa:'KVR1338',               oc:'119767',doca:'23',rota:'ZONA NORTE 5',                       pedidos:'15',clientes:'15',transportadora:'JSR'},
  {placa:'APH1487',               oc:'119768',doca:'25',rota:'ZONA NORTE 4',                       pedidos:'24',clientes:'16',transportadora:'JSR'},
  {placa:'KQS9B82',               oc:'119772',doca:'13',rota:'CAXIAS 3 + PISA',                    pedidos:'18',clientes:'13',transportadora:'JSR'},
  {placa:'AQO0D80',               oc:'119774',doca:'15',rota:'ZONA NORTE',                         pedidos:'20',clientes:'16',transportadora:'JSR'},
  {placa:'ANW8E45',               oc:'119775',doca:'18',rota:'ZONA NORTE 2',                       pedidos:'24',clientes:'18',transportadora:'JSR'},
  {placa:'DPC8B91',               oc:'119776',doca:'20',rota:'ZONA NORTE 3',                       pedidos:'23',clientes:'15',transportadora:'JSR'},
  {placa:'KWT7121',               oc:'119777',doca:'22',rota:'ZONA OESTE 1',                       pedidos:'32',clientes:'20',transportadora:'CARGO'},
  {placa:'LKK2D13',               oc:'119778',doca:'24',rota:'ZONA OESTE 3',                       pedidos:'26',clientes:'21',transportadora:'CARGO'},
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
