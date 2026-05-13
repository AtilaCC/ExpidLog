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
Placa: [placa]
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
  {placa:'KZP7F35',               oc:'119783',doca:'13',rota:'NITEROI 1 E 2',                      pedidos:'20',clientes:'19',transportadora:'MP 2'},
  {placa:'OMC5I06',               oc:'119795',doca:'15',rota:'NOVA IGUACU 1 E 2',                  pedidos:'12',clientes:'8', transportadora:'DMD'},
  {placa:'GSVB572',               oc:'119796',doca:'18',rota:'ZONA OESTE 1 E 4',                   pedidos:'23',clientes:'20',transportadora:'CARGO'},
  {placa:'TUM0F96/ANDERSON PIRES',oc:'119798',doca:'20',rota:'Arraruama/Saquarema',                pedidos:'19',clientes:'17',transportadora:'KING'},
  {placa:'TUE3F22/FABIO ANDRADE', oc:'119799',doca:'22',rota:'Arraial / Cabo Frio',               pedidos:'26',clientes:'16',transportadora:'KING'},
  {placa:'TTG2B18/MADISON',       oc:'119800',doca:'24',rota:'São Pedro da Aldeia / Iguaba',      pedidos:'28',clientes:'21',transportadora:'KING'},
  {placa:'HOE2037',               oc:'119804',doca:'17',rota:'SUL FLU 1 E 2',                     pedidos:'14',clientes:'13',transportadora:'PM&F'},
  {placa:'LQB8802',               oc:'119808',doca:'14',rota:'VALENÇA',                            pedidos:'20',clientes:'12',transportadora:'DMD'},
  {placa:'KWR3C29',               oc:'119809',doca:'16',rota:'SUL FLUMINENSE 2',                   pedidos:'30',clientes:'21',transportadora:'PM&F'},
  {placa:'TTF4A69',               oc:'119810',doca:'19',rota:'SUL FLUMINENSE 1 / BARRA MANSA',    pedidos:'20',clientes:'15',transportadora:'MP'},
  {placa:'TTE4H81',               oc:'119811',doca:'21',rota:'COSTA VERDE 1',                     pedidos:'13',clientes:'12',transportadora:'MP'},
  {placa:'TTF1D24',               oc:'119812',doca:'23',rota:'COSTA VERDE 1',                     pedidos:'21',clientes:'19',transportadora:'MP'},
  {placa:'LUD8B91',               oc:'119813',doca:'25',rota:'MARICA 1',                          pedidos:'22',clientes:'16',transportadora:'JSR'},
  {placa:'TTF3J59',               oc:'119817',doca:'15',rota:'PETROPOLIS',                        pedidos:'20',clientes:'14',transportadora:'MP'},
  {placa:'KWY3F64',               oc:'119819',doca:'18',rota:'NITEROI 1 E 2',                     pedidos:'12',clientes:'12',transportadora:'MP'},
  {placa:'NTO3E48',               oc:'119820',doca:'20',rota:'NITEROI 1',                         pedidos:'21',clientes:'15',transportadora:'MP 2'},
  {placa:'TTJ4D66',               oc:'119821',doca:'22',rota:'NITEROI 2',                         pedidos:'24',clientes:'19',transportadora:'MP'},
  {placa:'TTH4H56',               oc:'119822',doca:'24',rota:'NITEROI 3',                         pedidos:'19',clientes:'18',transportadora:'MP'},
  {placa:'TUP3E06/ADRIANO MORAES',oc:'119827',doca:'19',rota:'NOVA IGUACU 2',                    pedidos:'19',clientes:'15',transportadora:'KING'},
  {placa:'GWW7542',               oc:'119828',doca:'16',rota:'ZONA OESTE 4',                     pedidos:'20',clientes:'16',transportadora:'CARGO'},
  {placa:'LCR4D42',               oc:'119829',doca:'21',rota:'ZONA OESTE 5 / JPA',               pedidos:'18',clientes:'14',transportadora:'CARGO'},
  {placa:'APL7A16',               oc:'119830',doca:'23',rota:'ZONA IGUACU 2',                    pedidos:'22',clientes:'15',transportadora:'CARGO'},
  {placa:'TTS0G20/DENIMAR',       oc:'119831',doca:'25',rota:'NOVA IGUACU 3',                    pedidos:'19',clientes:'17',transportadora:'KING'},
  {placa:'LBZ6E56',               oc:'119836',doca:'13',rota:'ZONA OESTE 6',                     pedidos:'26',clientes:'16',transportadora:'CARGO'},
  {placa:'TUE3F28/ALEXANDRE',     oc:'119837',doca:'15',rota:'CAIXAS 2',                         pedidos:'22',clientes:'16',transportadora:'KING'},
  {placa:'TUD3G65/CRISTIANO',     oc:'119838',doca:'18',rota:'CAIXAS 3',                         pedidos:'20',clientes:'16',transportadora:'KING'},
  {placa:'APH1427',               oc:'119839',doca:'20',rota:'CAIXAS 1 E 3',                     pedidos:'26',clientes:'19',transportadora:'JSR'},
  {placa:'ACO6D80',               oc:'119841',doca:'22',rota:'ZONA NORTE',                       pedidos:'18',clientes:'16',transportadora:'JSR'},
  {placa:'ANW8E45',               oc:'119842',doca:'24',rota:'ZONA NORTE 2',                     pedidos:'27',clientes:'23',transportadora:'JSR'},
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
