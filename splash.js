/* ════════════════════════════════════════════════════════════
   DOCKCHECK PRO — SPLASH SCREEN · Fase 13
   Splash nativa injetada antes do app carregar.
   Adicionar <script src="splash.js"></script> como
   PRIMEIRO script no <head> do index.html.
════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Só exibe splash se for PWA instalada (standalone) ────── */
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  /* ── Exibe em todas as situações (remova o if para sempre mostrar) */
  // if (!isStandalone) return;

  /* ── Cria o elemento splash ──────────────────────────────── */
  const splash = document.createElement('div');
  splash.id = 'dc-splash';

  splash.innerHTML = `
    <div class="dc-splash-inner">
      <div class="dc-splash-logo">
        <div class="dc-splash-icon">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Ícone dock/container estilizado -->
            <rect x="8" y="28" width="64" height="36" rx="4" fill="#f59e0b" opacity="0.15"/>
            <rect x="8" y="28" width="64" height="36" rx="4" stroke="#f59e0b" stroke-width="2"/>
            <!-- Docas -->
            <rect x="16" y="38" width="12" height="18" rx="2" fill="#f59e0b" opacity="0.7"/>
            <rect x="34" y="34" width="12" height="22" rx="2" fill="#f59e0b"/>
            <rect x="52" y="40" width="12" height="16" rx="2" fill="#f59e0b" opacity="0.5"/>
            <!-- Topo / telhado -->
            <path d="M4 28 L40 10 L76 28" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Ponto de status -->
            <circle cx="64" cy="18" r="6" fill="#10b981"/>
            <circle cx="64" cy="18" r="3" fill="white"/>
          </svg>
        </div>
        <div class="dc-splash-wordmark">
          <span class="dc-splash-name">DockCheck</span>
          <span class="dc-splash-badge">PRO</span>
        </div>
        <div class="dc-splash-tagline">Gestão logística enterprise</div>
      </div>

      <div class="dc-splash-loader">
        <div class="dc-splash-bar">
          <div class="dc-splash-bar-fill" id="dc-splash-bar-fill"></div>
        </div>
        <div class="dc-splash-status" id="dc-splash-status">Iniciando...</div>
      </div>

      <div class="dc-splash-version">v13.0</div>
    </div>
  `;

  /* ── Estilos inline (zero dependência de CSS externo) ──── */
  const style = document.createElement('style');
  style.textContent = `
    #dc-splash {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #0d1017;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, 'Segoe UI', sans-serif;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    #dc-splash::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 60% 40% at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 70%),
        radial-gradient(ellipse 40% 60% at 100% 100%, rgba(245,158,11,0.04) 0%, transparent 60%);
      pointer-events: none;
    }

    .dc-splash-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 48px;
      width: 100%;
      max-width: 320px;
      padding: 0 32px;
      position: relative;
    }

    .dc-splash-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .dc-splash-icon {
      width: 80px;
      height: 80px;
      animation: dc-splash-pulse 2s ease-in-out infinite;
    }

    .dc-splash-icon svg {
      width: 100%;
      height: 100%;
    }

    @keyframes dc-splash-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.9; }
    }

    .dc-splash-wordmark {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dc-splash-name {
      font-size: 28px;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: -0.5px;
    }

    .dc-splash-badge {
      font-size: 11px;
      font-weight: 800;
      color: #0d1017;
      background: #f59e0b;
      padding: 3px 7px;
      border-radius: 4px;
      letter-spacing: 1px;
      margin-top: -2px;
    }

    .dc-splash-tagline {
      font-size: 13px;
      color: #64748b;
      letter-spacing: 0.3px;
    }

    .dc-splash-loader {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
    }

    .dc-splash-bar {
      width: 100%;
      height: 3px;
      background: rgba(255,255,255,0.06);
      border-radius: 2px;
      overflow: hidden;
    }

    .dc-splash-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #d97706, #f59e0b, #fbbf24);
      border-radius: 2px;
      transition: width 0.4s ease;
      position: relative;
    }

    .dc-splash-bar-fill::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 40px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4));
      animation: dc-splash-shimmer 1.2s ease-in-out infinite;
    }

    @keyframes dc-splash-shimmer {
      0% { opacity: 0; }
      50% { opacity: 1; }
      100% { opacity: 0; }
    }

    .dc-splash-status {
      font-size: 12px;
      color: #475569;
      letter-spacing: 0.5px;
      min-height: 16px;
      transition: opacity 0.3s;
    }

    .dc-splash-version {
      position: absolute;
      bottom: -80px;
      font-size: 11px;
      color: #1e293b;
      letter-spacing: 1px;
    }

    /* Animação de saída */
    #dc-splash.dc-splash-exit {
      animation: dc-splash-fade-out 0.5s ease forwards;
    }

    @keyframes dc-splash-fade-out {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.02); pointer-events: none; }
    }

    /* Entrada suave */
    #dc-splash.dc-splash-enter {
      animation: dc-splash-fade-in 0.4s ease forwards;
    }

    @keyframes dc-splash-fade-in {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
  `;

  /* ── Injeta no DOM antes de qualquer coisa ──────────────── */
  document.head.appendChild(style);
  document.documentElement.appendChild(splash);
  splash.classList.add('dc-splash-enter');

  /* ── Sequência de loading com mensagens ─────────────────── */
  const statusEl = document.getElementById('dc-splash-status');
  const barEl    = document.getElementById('dc-splash-bar-fill');

  const steps = [
    { pct: 15, msg: 'Verificando conexão...' },
    { pct: 35, msg: 'Carregando módulos...' },
    { pct: 60, msg: 'Conectando ao servidor...' },
    { pct: 80, msg: 'Sincronizando dados...' },
    { pct: 95, msg: 'Quase lá...' },
  ];

  let stepIdx = 0;
  const interval = setInterval(() => {
    if (stepIdx >= steps.length) {
      clearInterval(interval);
      return;
    }
    const step = steps[stepIdx++];
    if (barEl) barEl.style.width = step.pct + '%';
    if (statusEl) statusEl.textContent = step.msg;
  }, 300);

  /* ── Exporta função para fechar o splash ────────────────── */
  window.dcSplashClose = function (callback) {
    clearInterval(interval);
    if (barEl) barEl.style.width = '100%';
    if (statusEl) statusEl.textContent = 'Pronto!';

    setTimeout(() => {
      splash.classList.add('dc-splash-exit');
      setTimeout(() => {
        splash.remove();
        style.remove();
        if (typeof callback === 'function') callback();
      }, 500);
    }, 200);
  };

  /* ── Timeout de segurança: fecha após 6s mesmo sem chamar ─ */
  setTimeout(() => {
    if (document.getElementById('dc-splash')) {
      window.dcSplashClose();
    }
  }, 6000);

})();
