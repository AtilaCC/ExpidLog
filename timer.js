/**
 * timer.js — DockCheck v2
 * Cronômetro automático por doca.
 * Inicia ao selecionar uma doca com OC pendente.
 * Mostra barra de progresso, alerta de carga demorada.
 * Depende de: utils.js, storage.js
 */

'use strict';

/* ── Estado do cronômetro ── */
let timerInterval  = null;
let timerStartMs   = null;
let timerPausado   = false;
let timerDocaAtual = null;

/**
 * Inicia o cronômetro para uma doca.
 * Para o cronômetro anterior se houver um ativo.
 * @param {string} doca
 */
function iniciarTimer(doca) {
  pararTimer();
  timerDocaAtual = doca;
  timerStartMs   = Date.now();
  timerPausado   = false;
  document.getElementById('timer-bar').classList.add('ativo');
  timerInterval = setInterval(tickTimer, 1000);
  tickTimer(); // atualiza imediatamente sem esperar 1s
}

/**
 * Para e reseta o cronômetro.
 */
function pararTimer() {
  clearInterval(timerInterval);
  timerInterval  = null;
  timerStartMs   = null;
  timerDocaAtual = null;
  const bar = document.getElementById('timer-bar');
  if (bar) bar.classList.remove('ativo');
  const disp = document.getElementById('timer-display');
  if (disp) disp.textContent = '00:00';
  const prog = document.getElementById('timer-prog');
  if (prog) { prog.style.width = '0%'; prog.style.background = 'var(--grn)'; }
}

/**
 * Alterna pausa/retomada do cronômetro.
 */
function pausarTimer() {
  if (!timerStartMs) return;
  timerPausado = !timerPausado;
  const btn = document.querySelector('#timer-bar button');
  if (btn) btn.textContent = timerPausado ? '▶ Retomar' : '⏸ Pausar';
}

/**
 * Tick de 1 segundo — atualiza display e barra de progresso.
 * Usa tempo alvo salvo em config ou 45min como padrão.
 */
function tickTimer() {
  if (timerPausado || !timerStartMs) return;

  const elapsed = Math.floor((Date.now() - timerStartMs) / 1000);
  const min     = Math.floor(elapsed / 60);
  const sec     = elapsed % 60;
  const alvoMin = storage.get(K_ALVO, 45) || 45;
  const alvoSeg = alvoMin * 60;
  const pct     = Math.min((elapsed / alvoSeg) * 100, 100);

  // Atualiza display
  const display = document.getElementById('timer-display');
  if (display) {
    display.textContent  = _padTime(min) + ':' + _padTime(sec);
    display.className    = 'timer-display' +
      (pct >= 100 ? ' critico' : pct >= 80 ? ' alerta' : '');
  }

  // Atualiza barra de progresso
  const prog = document.getElementById('timer-prog');
  if (prog) {
    prog.style.width      = pct + '%';
    prog.style.background = pct < 70 ? 'var(--grn)' : pct < 100 ? 'var(--acc)' : 'var(--red)';
  }

  // Atualiza meta (tempo médio da doca ou meta configurada)
  const metaEl = document.getElementById('timer-meta');
  if (metaEl) {
    const med = _tempoMedioDoca(timerDocaAtual);
    metaEl.textContent = med
      ? `Média desta doca: ${_fmtMin(med)}`
      : `Meta: ${_fmtMin(alvoMin)}`;
  }
}

/**
 * Calcula o tempo médio histórico de uma doca específica.
 * @param {string|null} doca
 * @returns {number|null} minutos
 */
function _tempoMedioDoca(doca) {
  if (!doca) return null;
  const conf = historico.filter(h => h.tipo === 'conferencia' && h.doca?.trim() === doca);
  const durs = conf.map(h => _duracaoMin(h)).filter(v => v !== null);
  return durs.length
    ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length)
    : null;
}

/**
 * Retorna a duração atual do cronômetro em segundos.
 * Usado ao registrar a conferência.
 * @returns {number|null}
 */
function timerGetDuracaoSeg() {
  if (!timerStartMs || timerPausado) return null;
  return Math.floor((Date.now() - timerStartMs) / 1000);
}
