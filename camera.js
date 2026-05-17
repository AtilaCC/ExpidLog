/**
 * camera.js — DockCheck PRO · Fase 13 · Etapa 5
 * Câmera Nativa Otimizada para operação em campo
 *
 * Funcionalidades:
 *  - Câmera traseira como padrão (facingMode: environment)
 *  - Captura rápida com um toque + botão dedicado
 *  - Preview em tempo real antes de confirmar
 *  - Compressão automática (qualidade 0.8, max 1200px)
 *  - OCR integrado ao preview (alimenta ocr.js diretamente)
 *  - Flash/lanterna via torch constraint quando disponível
 *  - Feedback visual de captura (flash branco na tela)
 *  - Seletor de modo OCR integrado (tabela/placa/etiqueta/documento/avaria)
 *  - Botão "Alternar câmera" (frente ↔ traseira)
 *  - Zoom pinch-to-zoom nativo via constraint
 *  - Auto-foco ao tocar na tela
 *  - Libera stream ao fechar (não mantém câmera aberta desnecessariamente)
 *
 * Expõe globalmente:
 *  - cameraAbrir(modoOCR)   — abre o modal da câmera
 *  - cameraFechar()         — fecha e libera stream
 *  - cameraCapturar()       — captura o frame atual
 *
 * Integração automática com ocr.js:
 *  - Após confirmar, chama rodarOCRVisual() ou rodarOCR() conforme o modo
 *  - Define _fotoAtual e fotoTAB no escopo de ocr.js
 *
 * Depende de: ocr.js (compressImage, _fotoAtual, fotoTAB, rodarOCRVisual, rodarOCR)
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */

let _camStream       = null;   // MediaStream ativo
let _camFacing       = 'environment'; // 'environment' | 'user'
let _camTorchOn      = false;  // estado da lanterna
let _camTorchSupport = false;  // suporte a torch detectado
let _camZoom         = 1;      // zoom atual
let _camZoomMin      = 1;
let _camZoomMax      = 1;
let _camZoomSupport  = false;
let _camModoOCR      = 'tabela'; // modo ativo no momento da abertura
let _camCapturada    = null;   // base64 da foto capturada (antes de confirmar)
let _camPinchDist    = null;   // distância inicial do pinch

/* ════════════════════════════════════════════════════════════
   ABRIR CÂMERA
════════════════════════════════════════════════════════════ */

/**
 * Abre o modal da câmera.
 * @param {string} [modoOCR='tabela'] — modo OCR pré-selecionado
 */
async function cameraAbrir(modoOCR) {
  _camModoOCR   = modoOCR || _modoOCR || 'tabela';
  _camCapturada = null;

  _criarModalCamera();
  _atualizarModoUI(_camModoOCR);

  try {
    await _iniciarStream();
  } catch (e) {
    _camStatusMsg('❌ ' + _traduzirErroCamera(e), 'err');
    console.error('[Camera] Erro ao abrir:', e);
  }
}

/* ════════════════════════════════════════════════════════════
   FECHAR CÂMERA
════════════════════════════════════════════════════════════ */

function cameraFechar() {
  _pararStream();
  const modal = document.getElementById('cam-modal');
  if (modal) modal.remove();
  _camCapturada = null;
}

/* ════════════════════════════════════════════════════════════
   INICIAR / PARAR STREAM
════════════════════════════════════════════════════════════ */

async function _iniciarStream() {
  _pararStream();

  const video = document.getElementById('cam-video');
  if (!video) return;

  const constraints = {
    video: {
      facingMode: { ideal: _camFacing },
      width:      { ideal: 1920 },
      height:     { ideal: 1080 },
    },
    audio: false,
  };

  _camStatusMsg('📷 Acessando câmera...', 'run');

  _camStream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = _camStream;

  await new Promise((res, rej) => {
    video.onloadedmetadata = res;
    video.onerror          = rej;
  });

  await video.play();
  _camStatusMsg('', '');

  // Detecta capacidades da câmera
  _detectarCapacidades();

  // Oculta overlay de carregamento
  const overlay = document.getElementById('cam-loading');
  if (overlay) overlay.style.display = 'none';

  // Mostra controles
  const controls = document.getElementById('cam-controls');
  if (controls) controls.style.display = 'flex';
}

function _pararStream() {
  if (_camStream) {
    _camStream.getTracks().forEach(t => t.stop());
    _camStream = null;
  }
  _camTorchOn      = false;
  _camTorchSupport = false;
  _camZoomSupport  = false;
  _camZoom         = 1;
}

/* ════════════════════════════════════════════════════════════
   DETECTAR CAPACIDADES
════════════════════════════════════════════════════════════ */

function _detectarCapacidades() {
  if (!_camStream) return;
  const track = _camStream.getVideoTracks()[0];
  if (!track) return;

  const caps = track.getCapabilities ? track.getCapabilities() : {};

  // Torch
  _camTorchSupport = !!(caps.torch);
  const btnTorch = document.getElementById('cam-btn-torch');
  if (btnTorch) btnTorch.style.display = _camTorchSupport ? 'flex' : 'none';

  // Zoom
  if (caps.zoom) {
    _camZoomSupport = true;
    _camZoomMin     = caps.zoom.min || 1;
    _camZoomMax     = caps.zoom.max || 1;
    _camZoom        = caps.zoom.min || 1;
    const btnZoom = document.getElementById('cam-zoom-wrap');
    if (btnZoom) btnZoom.style.display = 'flex';
  }
}

/* ════════════════════════════════════════════════════════════
   CAPTURAR FOTO
════════════════════════════════════════════════════════════ */

/**
 * Captura o frame atual do vídeo.
 * Aplica compressão e exibe preview de confirmação.
 */
async function cameraCapturar() {
  const video = document.getElementById('cam-video');
  if (!video || !_camStream) return;

  haptic('medium');
  _flashBranco();

  // Render no canvas
  const canvas  = document.getElementById('cam-canvas');
  const ctx     = canvas.getContext('2d');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  const raw    = canvas.toDataURL('image/jpeg', 0.95);
  const b64    = await compressImage(raw, 1200, 0.8);
  _camCapturada = b64;

  _mostrarPreviewConfirmacao(b64);
}

/* ════════════════════════════════════════════════════════════
   FLASH BRANCO
════════════════════════════════════════════════════════════ */

function _flashBranco() {
  let flash = document.getElementById('cam-flash');
  if (!flash) {
    flash           = document.createElement('div');
    flash.id        = 'cam-flash';
    flash.style.cssText = `
      position:absolute;inset:0;background:#fff;opacity:0;
      pointer-events:none;z-index:10;border-radius:inherit;
      transition:opacity .05s ease;
    `;
    const wrap = document.getElementById('cam-video-wrap');
    if (wrap) wrap.appendChild(flash);
  }
  flash.style.opacity = '0.85';
  setTimeout(() => { flash.style.opacity = '0'; }, 120);
}

/* ════════════════════════════════════════════════════════════
   PREVIEW DE CONFIRMAÇÃO
════════════════════════════════════════════════════════════ */

function _mostrarPreviewConfirmacao(b64) {
  const preview = document.getElementById('cam-preview-wrap');
  const videoWr = document.getElementById('cam-video-wrap');
  const actions = document.getElementById('cam-preview-actions');

  if (preview) {
    preview.style.display = 'flex';
    const img = document.getElementById('cam-preview-img');
    if (img) img.src = b64;
  }
  if (videoWr) videoWr.style.display = 'none';
  if (actions) actions.style.display = 'flex';

  const controls = document.getElementById('cam-controls');
  if (controls) controls.style.display = 'none';
}

function _voltarParaCamera() {
  const preview = document.getElementById('cam-preview-wrap');
  const videoWr = document.getElementById('cam-video-wrap');
  const actions = document.getElementById('cam-preview-actions');
  const controls = document.getElementById('cam-controls');

  if (preview) preview.style.display = 'none';
  if (videoWr) videoWr.style.display = 'block';
  if (actions) actions.style.display = 'none';
  if (controls) controls.style.display = 'flex';

  _camCapturada = null;
}

/* ════════════════════════════════════════════════════════════
   CONFIRMAR — ENVIA PARA OCR
════════════════════════════════════════════════════════════ */

function _confirmarFoto() {
  if (!_camCapturada) return;

  haptic('success');

  // Injeta a foto no módulo OCR conforme o modo
  if (_camModoOCR === 'tabela') {
    // Compatibilidade com rodarOCR() — aba "Ler Tabela"
    fotoTAB = _camCapturada;

    // Atualiza UI da aba cloud
    const farea = document.getElementById('farea-tab');
    if (farea) farea.innerHTML =
      `<img src="${_camCapturada}" style="max-height:160px;border-radius:6px"><div class="fbadge">✓ Foto capturada</div>`;

    const btnOCR = document.getElementById('btn-ocr');
    if (btnOCR) btnOCR.disabled = false;

  } else {
    // Módulo visual multi-modal
    // eslint-disable-next-line no-undef
    _fotoAtual = _camCapturada;
    selecionarModoOCR(_camModoOCR);

    const preview = document.getElementById('visual-preview');
    if (preview) preview.innerHTML =
      `<img src="${_camCapturada}" style="max-width:100%;max-height:220px;border-radius:8px;object-fit:contain">`;

    const btnVisual = document.getElementById('btn-ocr-visual');
    if (btnVisual) btnVisual.disabled = false;
  }

  cameraFechar();

  // Navega para a aba correta e processa OCR automaticamente
  if (_camModoOCR === 'tabela') {
    goTab('cloud', null);
    toast('📷 Foto carregada — toque em "Ler com IA" para processar');
  } else {
    goTab('cloud', null);
    // Auto-roda OCR visual após um tick
    setTimeout(() => rodarOCRVisual(), 300);
  }
}

/* ════════════════════════════════════════════════════════════
   LANTERNA
════════════════════════════════════════════════════════════ */

async function _toggleTorch() {
  if (!_camStream || !_camTorchSupport) return;
  const track = _camStream.getVideoTracks()[0];
  if (!track) return;

  _camTorchOn = !_camTorchOn;

  try {
    await track.applyConstraints({ advanced: [{ torch: _camTorchOn }] });
    haptic('light');
    const btn = document.getElementById('cam-btn-torch');
    if (btn) btn.innerHTML = _camTorchOn ? '🔦' : '💡';
    const label = document.getElementById('cam-torch-label');
    if (label) label.textContent = _camTorchOn ? 'Torch On' : 'Flash';
  } catch (e) {
    console.warn('[Camera] Torch error:', e);
    _camTorchOn = false;
  }
}

/* ════════════════════════════════════════════════════════════
   ALTERNAR CÂMERA (frente ↔ traseira)
════════════════════════════════════════════════════════════ */

async function _alternarCamera() {
  _camFacing = _camFacing === 'environment' ? 'user' : 'environment';
  haptic('light');
  _camStatusMsg('🔄 Alternando câmera...', 'run');

  const loading = document.getElementById('cam-loading');
  if (loading) loading.style.display = 'flex';
  const controls = document.getElementById('cam-controls');
  if (controls) controls.style.display = 'none';

  try {
    await _iniciarStream();
  } catch (e) {
    _camFacing = _camFacing === 'environment' ? 'user' : 'environment'; // revert
    _camStatusMsg('❌ ' + _traduzirErroCamera(e), 'err');
  }
}

/* ════════════════════════════════════════════════════════════
   ZOOM
════════════════════════════════════════════════════════════ */

async function _aplicarZoom(val) {
  if (!_camStream || !_camZoomSupport) return;
  const track = _camStream.getVideoTracks()[0];
  if (!track) return;

  _camZoom = Math.max(_camZoomMin, Math.min(_camZoomMax, parseFloat(val)));
  try {
    await track.applyConstraints({ advanced: [{ zoom: _camZoom }] });
  } catch (e) {
    console.warn('[Camera] Zoom error:', e);
  }

  const label = document.getElementById('cam-zoom-label');
  if (label) label.textContent = `${_camZoom.toFixed(1)}×`;
}

/* ════════════════════════════════════════════════════════════
   AUTO-FOCO AO TOCAR
════════════════════════════════════════════════════════════ */

function _setupAutoFocus(videoEl) {
  videoEl.addEventListener('click', async (e) => {
    if (!_camStream) return;
    const track = _camStream.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.focusMode || !caps.focusMode.includes('manual')) return;

    const rect = videoEl.getBoundingClientRect();
    const x    = (e.clientX - rect.left) / rect.width;
    const y    = (e.clientY - rect.top)  / rect.height;

    try {
      await track.applyConstraints({
        advanced: [{
          focusMode:  'manual',
          pointsOfInterest: [{ x, y }],
        }],
      });
      _mostrarIndicadorFoco(e.clientX - rect.left, e.clientY - rect.top);
    } catch (_) { /* não suportado — silencioso */ }
  });
}

function _mostrarIndicadorFoco(x, y) {
  let el = document.getElementById('cam-focus-ring');
  if (!el) {
    el        = document.createElement('div');
    el.id     = 'cam-focus-ring';
    el.style.cssText = `
      position:absolute;width:56px;height:56px;border:2px solid var(--acc);
      border-radius:50%;pointer-events:none;transition:opacity .3s;z-index:5;
      transform:translate(-50%,-50%);
    `;
    document.getElementById('cam-video-wrap')?.appendChild(el);
  }
  el.style.left    = x + 'px';
  el.style.top     = y + 'px';
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 800);
}

/* ════════════════════════════════════════════════════════════
   PINCH TO ZOOM
════════════════════════════════════════════════════════════ */

function _setupPinchZoom(el) {
  el.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      _camPinchDist = _pinchDist(e.touches);
    }
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && _camPinchDist !== null) {
      const d    = _pinchDist(e.touches);
      const diff = d - _camPinchDist;
      if (Math.abs(diff) > 5) {
        const range    = _camZoomMax - _camZoomMin;
        const newZoom  = _camZoom + (diff / 300) * range;
        _aplicarZoom(newZoom);
        _camPinchDist = d;
      }
    }
  }, { passive: true });

  el.addEventListener('touchend', () => { _camPinchDist = null; });
}

function _pinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/* ════════════════════════════════════════════════════════════
   SELECTOR DE MODO OCR
════════════════════════════════════════════════════════════ */

function _atualizarModoUI(modo) {
  _camModoOCR = modo;
  document.querySelectorAll('.cam-modo-btn').forEach(b => {
    b.classList.toggle('cam-modo-on', b.dataset.modo === modo);
  });
  const label = document.getElementById('cam-modo-label');
  const modos = {
    tabela:    '📋 Tabela',
    placa:     '🚛 Placa',
    etiqueta:  '🏷️ Etiqueta',
    documento: '📄 Documento',
    avaria:    '⚠️ Avaria',
  };
  if (label) label.textContent = modos[modo] || modo;
}

/* ════════════════════════════════════════════════════════════
   STATUS MSG
════════════════════════════════════════════════════════════ */

function _camStatusMsg(msg, tipo) {
  const el = document.getElementById('cam-status-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
  el.style.color = tipo === 'err' ? 'var(--red)' : tipo === 'run' ? 'var(--acc)' : 'var(--txt)';
}

/* ════════════════════════════════════════════════════════════
   TRADUÇÃO DE ERROS
════════════════════════════════════════════════════════════ */

function _traduzirErroCamera(e) {
  const n = e.name || '';
  if (n === 'NotAllowedError')    return 'Permissão negada. Autorize o acesso à câmera.';
  if (n === 'NotFoundError')      return 'Câmera não encontrada neste dispositivo.';
  if (n === 'NotReadableError')   return 'Câmera em uso por outro app. Feche-o e tente novamente.';
  if (n === 'OverconstrainedError') return 'Câmera não suporta a configuração solicitada.';
  return e.message || 'Erro desconhecido.';
}

/* ════════════════════════════════════════════════════════════
   CRIAR MODAL DA CÂMERA
════════════════════════════════════════════════════════════ */

function _criarModalCamera() {
  // Remove modal anterior se existir
  const old = document.getElementById('cam-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'cam-modal';
  modal.innerHTML = `
    <!-- Overlay -->
    <div id="cam-modal-inner">

      <!-- Header -->
      <div id="cam-header">
        <button id="cam-btn-fechar" onclick="cameraFechar()" aria-label="Fechar câmera">✕</button>
        <span id="cam-modo-label">📋 Tabela</span>
        <button id="cam-btn-flip" onclick="_alternarCamera()" aria-label="Alternar câmera">🔄</button>
      </div>

      <!-- Seletor de modo -->
      <div id="cam-modos-wrap">
        <button class="cam-modo-btn" data-modo="tabela"    onclick="_atualizarModoUI('tabela')">📋</button>
        <button class="cam-modo-btn" data-modo="placa"     onclick="_atualizarModoUI('placa')">🚛</button>
        <button class="cam-modo-btn" data-modo="etiqueta"  onclick="_atualizarModoUI('etiqueta')">🏷️</button>
        <button class="cam-modo-btn" data-modo="documento" onclick="_atualizarModoUI('documento')">📄</button>
        <button class="cam-modo-btn" data-modo="avaria"    onclick="_atualizarModoUI('avaria')">⚠️</button>
      </div>

      <!-- Viewfinder -->
      <div id="cam-video-wrap">
        <!-- Loading overlay -->
        <div id="cam-loading">
          <div class="cam-spinner"></div>
          <div style="font-size:13px;color:var(--acc);margin-top:10px">Iniciando câmera...</div>
        </div>

        <!-- Vídeo -->
        <video id="cam-video" playsinline muted autoplay></video>

        <!-- Canvas (oculto) para captura -->
        <canvas id="cam-canvas" style="display:none"></canvas>

        <!-- Guia de enquadramento -->
        <div id="cam-guide">
          <div class="cam-corner cam-tl"></div>
          <div class="cam-corner cam-tr"></div>
          <div class="cam-corner cam-bl"></div>
          <div class="cam-corner cam-br"></div>
        </div>
      </div>

      <!-- Status -->
      <div id="cam-status-msg" style="display:none"></div>

      <!-- Preview de confirmação -->
      <div id="cam-preview-wrap" style="display:none">
        <img id="cam-preview-img" alt="Preview da captura">
        <div id="cam-preview-label">Confirma esta foto?</div>
      </div>

      <!-- Ações do preview -->
      <div id="cam-preview-actions" style="display:none">
        <button id="cam-btn-retirar" onclick="_voltarParaCamera()">
          🔄 Repetir
        </button>
        <button id="cam-btn-confirmar" onclick="_confirmarFoto()">
          ✅ Usar foto
        </button>
      </div>

      <!-- Controles principais -->
      <div id="cam-controls" style="display:none">

        <!-- Zoom (aparece se suportado) -->
        <div id="cam-zoom-wrap" style="display:none">
          <span style="font-size:11px;color:var(--mut)">Zoom</span>
          <input id="cam-zoom-range" type="range" min="1" max="10" step="0.1" value="1"
            oninput="_aplicarZoom(this.value)"
            style="flex:1;accent-color:var(--acc)">
          <span id="cam-zoom-label" style="font-size:11px;color:var(--txt);min-width:28px;text-align:right">1×</span>
        </div>

        <!-- Botão capturar -->
        <div id="cam-shutter-row">
          <button id="cam-btn-torch" style="display:none" onclick="_toggleTorch()" aria-label="Lanterna">
            💡
            <span id="cam-torch-label" style="font-size:10px;display:block">Flash</span>
          </button>

          <button id="cam-btn-shutter" onclick="cameraCapturar()" aria-label="Capturar foto">
            <div id="cam-shutter-ring"></div>
          </button>

          <div style="width:56px"></div><!-- placeholder para simetria -->
        </div>

        <div style="font-size:11px;color:var(--mut);text-align:center;margin-top:6px">
          Toque no botão ou na tela para focar
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  // Setup eventos após inserir no DOM
  const video = document.getElementById('cam-video');
  if (video) {
    _setupAutoFocus(video);
    _setupPinchZoom(video);

    // Toque rápido no vídeo = capturar (duplo-toque)
    let _lastTap = 0;
    video.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - _lastTap < 300) {
        cameraCapturar();
      }
      _lastTap = now;
    });
  }

  // Sincroniza range de zoom se disponível
  const range = document.getElementById('cam-zoom-range');
  if (range) {
    range.min = _camZoomMin;
    range.max = _camZoomMax;
    range.value = _camZoom;
  }
}

/* ════════════════════════════════════════════════════════════
   CSS INJETADO DINAMICAMENTE
════════════════════════════════════════════════════════════ */

(function _injetarCSSCamera() {
  if (document.getElementById('css-camera-fase13')) return;
  const style    = document.createElement('style');
  style.id       = 'css-camera-fase13';
  style.textContent = `

    /* ── Modal container ── */
    #cam-modal {
      position: fixed;
      inset: 0;
      z-index: 9000;
      background: #000;
      display: flex;
      flex-direction: column;
      /* safe-area para notch */
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    #cam-modal-inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 600px;
      margin: 0 auto;
      width: 100%;
    }

    /* ── Header ── */
    #cam-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: rgba(0,0,0,.6);
      color: #fff;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: .5px;
      flex-shrink: 0;
    }

    #cam-btn-fechar,
    #cam-btn-flip {
      background: rgba(255,255,255,.12);
      border: none;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-tap-highlight-color: transparent;
    }

    /* ── Seletor de modos ── */
    #cam-modos-wrap {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(0,0,0,.5);
      flex-shrink: 0;
    }

    .cam-modo-btn {
      background: rgba(255,255,255,.1);
      border: 1.5px solid transparent;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 18px;
      color: rgba(255,255,255,.7);
      cursor: pointer;
      transition: all .15s;
      min-width: 44px;
      min-height: 44px;
      -webkit-tap-highlight-color: transparent;
    }

    .cam-modo-btn.cam-modo-on {
      border-color: var(--acc, #ffc800);
      background: rgba(255,200,0,.15);
      color: #fff;
    }

    /* ── Viewfinder ── */
    #cam-video-wrap {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: #000;
    }

    #cam-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* ── Loading ── */
    #cam-loading {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.8);
      z-index: 8;
    }

    .cam-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(255,200,0,.3);
      border-top-color: var(--acc, #ffc800);
      border-radius: 50%;
      animation: cam-spin .8s linear infinite;
    }

    @keyframes cam-spin { to { transform: rotate(360deg); } }

    /* ── Guia de enquadramento ── */
    #cam-guide {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
    }

    .cam-corner {
      position: absolute;
      width: 22px;
      height: 22px;
      border-color: rgba(255,200,0,.8);
      border-style: solid;
    }

    .cam-tl { top: 18%; left:  8%; border-width: 2px 0 0 2px; }
    .cam-tr { top: 18%; right: 8%; border-width: 2px 2px 0 0; }
    .cam-bl { bottom: 18%; left:  8%; border-width: 0 0 2px 2px; }
    .cam-br { bottom: 18%; right: 8%; border-width: 0 2px 2px 0; }

    /* ── Status msg ── */
    #cam-status-msg {
      text-align: center;
      padding: 6px 12px;
      font-size: 12px;
      background: rgba(0,0,0,.6);
      flex-shrink: 0;
    }

    /* ── Preview ── */
    #cam-preview-wrap {
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #000;
      padding: 16px;
      gap: 10px;
    }

    #cam-preview-img {
      max-width: 100%;
      max-height: 55vh;
      border-radius: 8px;
      object-fit: contain;
    }

    #cam-preview-label {
      font-size: 14px;
      color: rgba(255,255,255,.7);
      font-family: 'Barlow Condensed', sans-serif;
      letter-spacing: .5px;
    }

    /* ── Preview actions ── */
    #cam-preview-actions {
      gap: 12px;
      padding: 14px 20px;
      background: rgba(0,0,0,.8);
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
    }

    #cam-btn-retirar {
      flex: 1;
      padding: 14px;
      background: rgba(255,255,255,.1);
      border: 1.5px solid rgba(255,255,255,.2);
      border-radius: 12px;
      color: #fff;
      font-size: 15px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    #cam-btn-confirmar {
      flex: 2;
      padding: 14px;
      background: var(--acc, #ffc800);
      border: none;
      border-radius: 12px;
      color: #000;
      font-size: 16px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      letter-spacing: .5px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    /* ── Controles ── */
    #cam-controls {
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px 16px;
      background: rgba(0,0,0,.8);
      flex-shrink: 0;
    }

    #cam-zoom-wrap {
      align-items: center;
      gap: 8px;
      padding: 0 4px;
    }

    /* ── Shutter row ── */
    #cam-shutter-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
    }

    #cam-btn-shutter {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(255,255,255,.15);
      border: 3px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform .1s, background .1s;
    }

    #cam-btn-shutter:active {
      transform: scale(.92);
      background: rgba(255,255,255,.35);
    }

    #cam-shutter-ring {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #fff;
    }

    #cam-btn-torch {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(255,255,255,.1);
      border: 1.5px solid rgba(255,255,255,.2);
      color: #fff;
      font-size: 22px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      -webkit-tap-highlight-color: transparent;
    }

  `;
  document.head.appendChild(style);
})();

/* ════════════════════════════════════════════════════════════
   BOTÃO "CÂMERA" NA ABA CLOUD — INJETA SE NÃO EXISTIR
════════════════════════════════════════════════════════════ */

/**
 * Chama essa função após o DOM estar pronto (via app.js ou DOMContentLoaded).
 * Injeta botão de câmera nas áreas de upload da aba "Ler Tabela".
 */
function cameraInjetarBotoes() {
  // Botão na área de upload da tabela (aba cloud)
  const farea = document.getElementById('farea-tab');
  if (farea && !document.getElementById('cam-btn-tabela')) {
    const btn = document.createElement('button');
    btn.id        = 'cam-btn-tabela';
    btn.className = 'btn btn-acc btn-sm';
    btn.style.cssText = 'margin-top:8px;display:flex;align-items:center;gap:6px;justify-content:center;width:100%';
    btn.innerHTML = '📷 Fotografar Tabela';
    btn.onclick   = () => cameraAbrir('tabela');
    farea.parentNode.insertBefore(btn, farea.nextSibling);
  }

  // Botão na área de upload visual multi-modal
  const vpreview = document.getElementById('visual-preview');
  if (vpreview && !document.getElementById('cam-btn-visual')) {
    const btn = document.createElement('button');
    btn.id        = 'cam-btn-visual';
    btn.className = 'btn btn-acc btn-sm';
    btn.style.cssText = 'margin-top:8px;display:flex;align-items:center;gap:6px;justify-content:center;width:100%';
    btn.innerHTML = '📷 Fotografar';
    btn.onclick   = () => cameraAbrir(_modoOCR || 'tabela');
    vpreview.parentNode.insertBefore(btn, vpreview.nextSibling);
  }
}

// Injeta botões assim que o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cameraInjetarBotoes);
} else {
  setTimeout(cameraInjetarBotoes, 500);
}
