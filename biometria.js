/**
 * biometria.js — DockCheck PRO · Fase 13 · Etapa 6
 * Biometria / PIN Operacional
 *
 * Funcionalidades:
 *  - Web Authentication API (biometria nativa — digital / face ID)
 *  - PIN de 4 dígitos como fallback
 *  - Sessão protegida — após X minutos inativo pede PIN/bio
 *  - Botão "Entrar com biometria" no modal de login existente
 *  - Timeout configurável (5 / 15 / 30 min) via Config
 *  - Armazenamento seguro do PIN (SHA-256 via Web Crypto API)
 *  - Blur na tela quando app vai para background (integrado aqui)
 *  - Registro de credencial biométrica vinculada ao usuário logado
 *  - Sem dependência de lib externa
 *
 * Expõe globalmente:
 *  - bioInit()                   — inicia o módulo (chamado pelo app.js)
 *  - bioRegistrarCredencial()    — registra biometria do usuário atual
 *  - bioAutenticar()             — abre tela de auth (PIN ou bio)
 *  - bioConfigurarTimeout(min)   — define timeout de inatividade
 *  - bioRenderConfigSection()    — renderiza seção na aba Config
 *
 * Integração com backend.js:
 *  - Intercepta loginSubmit() — após login bem-sucedido oferece cadastrar bio
 *  - backendLogout() → limpa estado de sessão bio
 *
 * Depende de: backend.js (isAuthenticated, getUser, backendLogout), storage.js
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTES
════════════════════════════════════════════════════════════ */

const BIO_KEY_CRED_ID  = 'dc_bio_cred_id';    // ID da credencial WebAuthn
const BIO_KEY_PIN_HASH = 'dc_bio_pin_hash';   // hash SHA-256 do PIN
const BIO_KEY_TIMEOUT  = 'dc_bio_timeout';    // timeout em minutos
const BIO_KEY_ENABLED  = 'dc_bio_enabled';    // biometria habilitada
const BIO_KEY_PIN_SET  = 'dc_bio_pin_set';    // PIN cadastrado
const BIO_RP_ID        = location.hostname;   // Relying Party ID
const BIO_RP_NAME      = 'DockCheck PRO';

/* ════════════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════════════ */

let _bioSessaoAtiva   = false;   // sessão desbloqueada
let _bioInactTimer    = null;    // timer de inatividade
let _bioTimeoutMin    = 15;      // padrão: 15 min
let _bioBlurAtivo     = false;   // blur de background ativo
let _bioSuportado     = false;   // WebAuthn disponível
let _bioTelaAberta    = false;   // tela de auth aberta

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

function bioInit() {
  // Detecta suporte a WebAuthn
  _bioSuportado = !!(
    window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );

  // Carrega timeout salvo
  const t = parseInt(localStorage.getItem(BIO_KEY_TIMEOUT));
  if (t && [5, 15, 30].includes(t)) _bioTimeoutMin = t;

  // Se não há credencial nem PIN cadastrado, não bloqueia
  if (!_bioTemCredencial() && !_bioTemPIN()) {
    _bioSessaoAtiva = true;
    _bioIniciarTimerInatividade();
    _setupBlurBackground();
    _injetarBotaoBioNoLogin();
    return;
  }

  // Verifica se o app já estava autenticado (sessão restaurada)
  if (isAuthenticated()) {
    // Pede verificação ao iniciar
    _bioSessaoAtiva = false;
    setTimeout(() => bioAutenticar(), 600);
  }

  _bioIniciarTimerInatividade();
  _setupBlurBackground();
  _injetarBotaoBioNoLogin();

  console.info('[Bio] Módulo iniciado. Suporte WebAuthn:', _bioSuportado);
}

/* ════════════════════════════════════════════════════════════
   VERIFICAÇÕES
════════════════════════════════════════════════════════════ */

function _bioTemCredencial() {
  return !!(
    localStorage.getItem(BIO_KEY_ENABLED) === 'true' &&
    localStorage.getItem(BIO_KEY_CRED_ID)
  );
}

function _bioTemPIN() {
  return !!(
    localStorage.getItem(BIO_KEY_PIN_SET) === 'true' &&
    localStorage.getItem(BIO_KEY_PIN_HASH)
  );
}

/* ════════════════════════════════════════════════════════════
   REGISTRAR CREDENCIAL BIOMÉTRICA (WebAuthn)
════════════════════════════════════════════════════════════ */

/**
 * Registra a credencial biométrica do usuário logado.
 * Requer que isAuthenticated() seja true.
 */
async function bioRegistrarCredencial() {
  if (!_bioSuportado) {
    toast('⚠️ Biometria não suportada neste dispositivo. Use o PIN.');
    return false;
  }

  const user = getUser();
  if (!user) { toast('Faça login primeiro.'); return false; }

  // Verifica se a plataforma tem autenticador disponível
  const disponivel = await PublicKeyCredential
    .isUserVerifyingPlatformAuthenticatorAvailable()
    .catch(() => false);

  if (!disponivel) {
    toast('⚠️ Autenticador biométrico não disponível. Use o PIN.');
    return false;
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId    = new TextEncoder().encode(String(user.id || user.email));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp:   { id: BIO_RP_ID, name: BIO_RP_NAME },
        user: {
          id:          userId,
          name:        user.email,
          displayName: user.nome || user.email,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7  },  // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification:        'required',
          residentKey:             'preferred',
        },
        timeout: 60000,
      },
    });

    if (!credential) throw new Error('Credencial não criada.');

    // Salva ID da credencial (base64url)
    const credId = _bufToBase64(credential.rawId);
    localStorage.setItem(BIO_KEY_CRED_ID, credId);
    localStorage.setItem(BIO_KEY_ENABLED, 'true');

    haptic('success');
    toast('✅ Biometria cadastrada com sucesso!');
    _bioSessaoAtiva = true;
    _renderBioConfig();
    return true;

  } catch (e) {
    if (e.name === 'NotAllowedError') {
      toast('Operação cancelada pelo usuário.');
    } else {
      toast('❌ Erro ao registrar biometria: ' + e.message);
    }
    console.error('[Bio] Erro registro:', e);
    return false;
  }
}

/* ════════════════════════════════════════════════════════════
   AUTENTICAR COM BIOMETRIA (WebAuthn)
════════════════════════════════════════════════════════════ */

async function _autenticarBio() {
  const credId = localStorage.getItem(BIO_KEY_CRED_ID);
  if (!credId) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId:            BIO_RP_ID,
        userVerification: 'required',
        allowCredentials: [{
          type: 'public-key',
          id:   _base64ToBuf(credId),
        }],
        timeout: 60000,
      },
    });

    return !!assertion;

  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      console.warn('[Bio] Erro autenticação bio:', e.message);
    }
    return false;
  }
}

/* ════════════════════════════════════════════════════════════
   PIN — CADASTRO
════════════════════════════════════════════════════════════ */

/**
 * Abre tela para cadastrar PIN de 4 dígitos.
 */
function bioCadastrarPIN() {
  _criarTelaPin('cadastro');
}

async function _confirmarCadastroPIN(pin1, pin2) {
  if (pin1.length !== 4 || !/^\d{4}$/.test(pin1)) {
    return { ok: false, msg: 'PIN deve ter 4 números.' };
  }
  if (pin1 !== pin2) {
    return { ok: false, msg: 'PINs não conferem.' };
  }

  const hash = await _hashPIN(pin1);
  localStorage.setItem(BIO_KEY_PIN_HASH, hash);
  localStorage.setItem(BIO_KEY_PIN_SET, 'true');

  haptic('success');
  _bioSessaoAtiva = true;
  _renderBioConfig();
  return { ok: true };
}

/* ════════════════════════════════════════════════════════════
   PIN — VERIFICAÇÃO
════════════════════════════════════════════════════════════ */

async function _verificarPIN(pin) {
  const hashSalvo = localStorage.getItem(BIO_KEY_PIN_HASH);
  if (!hashSalvo) return false;
  const hash = await _hashPIN(pin);
  return hash === hashSalvo;
}

async function _hashPIN(pin) {
  const encoded = new TextEncoder().encode(pin + BIO_RP_ID); // salt com domínio
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ════════════════════════════════════════════════════════════
   TELA DE AUTENTICAÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Exibe a tela de autenticação (bio ou PIN).
 * Bloqueia a UI até autenticação bem-sucedida.
 */
async function bioAutenticar() {
  if (_bioTelaAberta) return;
  if (!_bioTemCredencial() && !_bioTemPIN()) {
    _bioSessaoAtiva = true;
    return;
  }

  _bioTelaAberta  = true;
  _bioSessaoAtiva = false;

  // Se tem bio disponível, tenta direto
  if (_bioTemCredencial() && _bioSuportado) {
    _criarTelaAuth('bio');
  } else if (_bioTemPIN()) {
    _criarTelaAuth('pin');
  }
}

function _criarTelaAuth(modo) {
  const old = document.getElementById('bio-auth-modal');
  if (old) old.remove();

  const user = getUser();
  const nome = user?.nome?.split(' ')[0] || 'Operador';

  const modal = document.createElement('div');
  modal.id = 'bio-auth-modal';
  modal.innerHTML = `
    <div id="bio-auth-inner">
      <div id="bio-auth-logo">
        DOCK<span>CHECK</span><span class="bio-badge">PRO</span>
      </div>
      <div id="bio-auth-subtitle">Verificação de identidade</div>
      <div id="bio-auth-user">👤 ${nome}</div>

      ${modo === 'bio' ? `
        <div id="bio-auth-icon">🔐</div>
        <div id="bio-auth-msg">Use sua biometria para desbloquear</div>
        <button id="bio-btn-auth" onclick="_tentarAutoBio()">
          <span id="bio-btn-icon">👆</span>
          <span id="bio-btn-label">Usar Biometria</span>
        </button>
        ${_bioTemPIN() ? `
          <button id="bio-btn-pin-fallback" onclick="_criarTelaAuth('pin')">
            🔢 Usar PIN
          </button>
        ` : ''}
      ` : `
        <div id="bio-auth-icon">🔢</div>
        <div id="bio-auth-msg">Digite seu PIN de 4 dígitos</div>
        <div id="bio-pin-display">
          <span class="bio-pin-dot" id="pd0"></span>
          <span class="bio-pin-dot" id="pd1"></span>
          <span class="bio-pin-dot" id="pd2"></span>
          <span class="bio-pin-dot" id="pd3"></span>
        </div>
        <div id="bio-pin-error"></div>
        <div id="bio-numpad">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
            <button class="bio-numpad-btn" ${k==='' ? 'disabled style="visibility:hidden"' : ''}
              onclick="_numpadPress('${k}')">
              ${k}
            </button>
          `).join('')}
        </div>
        ${_bioTemCredencial() && _bioSuportado ? `
          <button id="bio-btn-bio-fallback" onclick="_criarTelaAuth('bio')">
            🔐 Usar Biometria
          </button>
        ` : ''}
      `}

      <button id="bio-btn-logout" onclick="_bioLogout()">
        Sair da conta
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // Auto-dispara bio
  if (modo === 'bio') {
    setTimeout(_tentarAutoBio, 400);
  }

  // Setup do numpad
  if (modo === 'pin') {
    window._bioPinAtual = '';
  }
}

/* ════════════════════════════════════════════════════════════
   BIO — TENTATIVA AUTO
════════════════════════════════════════════════════════════ */

async function _tentarAutoBio() {
  const btn = document.getElementById('bio-btn-auth');
  const msg = document.getElementById('bio-auth-msg');
  const icon = document.getElementById('bio-btn-icon');

  if (btn) btn.disabled = true;
  if (msg) msg.textContent = 'Aguardando biometria...';
  if (icon) icon.textContent = '⏳';

  const ok = await _autenticarBio();

  if (ok) {
    _bioDesbloqueado();
  } else {
    if (btn) btn.disabled = false;
    if (msg) msg.textContent = 'Tente novamente ou use o PIN';
    if (icon) icon.textContent = '👆';
    haptic('error');
  }
}

/* ════════════════════════════════════════════════════════════
   NUMPAD PIN
════════════════════════════════════════════════════════════ */

async function _numpadPress(key) {
  haptic('light');

  if (key === '⌫') {
    window._bioPinAtual = (window._bioPinAtual || '').slice(0, -1);
  } else if (typeof key === 'string' && /\d/.test(key)) {
    if ((window._bioPinAtual || '').length < 4) {
      window._bioPinAtual = (window._bioPinAtual || '') + key;
    }
  }

  // Atualiza dots visuais
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pd${i}`);
    if (dot) dot.classList.toggle('filled', i < (window._bioPinAtual || '').length);
  }

  // Verifica quando atingir 4 dígitos
  if ((window._bioPinAtual || '').length === 4) {
    await _verificarPINInput(window._bioPinAtual);
  }
}

async function _verificarPINInput(pin) {
  const btns    = document.querySelectorAll('.bio-numpad-btn');
  const errEl   = document.getElementById('bio-pin-error');
  btns.forEach(b => b.disabled = true);

  const ok = await _verificarPIN(pin);

  if (ok) {
    _bioDesbloqueado();
  } else {
    haptic('error');
    if (errEl) {
      errEl.textContent = 'PIN incorreto. Tente novamente.';
      errEl.style.color = 'var(--red)';
    }
    // Shake nos dots
    const display = document.getElementById('bio-pin-display');
    if (display) {
      display.style.animation = 'bio-shake .4s ease';
      setTimeout(() => { display.style.animation = ''; }, 400);
    }
    // Limpa após erro
    setTimeout(() => {
      window._bioPinAtual = '';
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById(`pd${i}`);
        if (dot) dot.classList.remove('filled');
      }
      if (errEl) errEl.textContent = '';
      btns.forEach(b => b.disabled = false);
    }, 700);
  }
}

/* ════════════════════════════════════════════════════════════
   TELA DE CADASTRO DE PIN
════════════════════════════════════════════════════════════ */

function _criarTelaPin(etapa, pin1) {
  const old = document.getElementById('bio-pin-cadastro-modal');
  if (old) old.remove();

  const isPrimeiro = etapa === 'cadastro';
  const titulo     = isPrimeiro ? 'Criar PIN' : 'Confirmar PIN';
  const subtitulo  = isPrimeiro ? 'Digite um PIN de 4 dígitos' : 'Digite o PIN novamente';

  const modal = document.createElement('div');
  modal.id    = 'bio-pin-cadastro-modal';
  modal.innerHTML = `
    <div id="bio-auth-inner">
      <div id="bio-auth-logo">DOCK<span>CHECK</span><span class="bio-badge">PRO</span></div>
      <div id="bio-auth-subtitle">${titulo}</div>
      <div id="bio-auth-msg">${subtitulo}</div>
      <div id="bio-pin-display">
        <span class="bio-pin-dot" id="cpd0"></span>
        <span class="bio-pin-dot" id="cpd1"></span>
        <span class="bio-pin-dot" id="cpd2"></span>
        <span class="bio-pin-dot" id="cpd3"></span>
      </div>
      <div id="bio-pin-error"></div>
      <div id="bio-numpad">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
          <button class="bio-numpad-btn" ${k==='' ? 'disabled style="visibility:hidden"' : ''}
            onclick="_numpadCadastro('${k}', ${isPrimeiro ? 'null' : `'${pin1}'`})">
            ${k}
          </button>
        `).join('')}
      </div>
      <button id="bio-btn-cancelar" onclick="document.getElementById('bio-pin-cadastro-modal').remove()">
        Cancelar
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  window._bioPinCadastro = '';
}

async function _numpadCadastro(key, pin1) {
  haptic('light');

  if (key === '⌫') {
    window._bioPinCadastro = (window._bioPinCadastro || '').slice(0, -1);
  } else if (/\d/.test(key)) {
    if ((window._bioPinCadastro || '').length < 4) {
      window._bioPinCadastro = (window._bioPinCadastro || '') + key;
    }
  }

  // Atualiza dots
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`cpd${i}`);
    if (dot) dot.classList.toggle('filled', i < (window._bioPinCadastro || '').length);
  }

  if ((window._bioPinCadastro || '').length === 4) {
    const pAtual = window._bioPinCadastro;
    window._bioPinCadastro = '';

    if (!pin1) {
      // Primeira entrada — pede confirmação
      const modal = document.getElementById('bio-pin-cadastro-modal');
      if (modal) modal.remove();
      setTimeout(() => _criarTelaPin('confirmacao', pAtual), 200);
    } else {
      // Segunda entrada — compara e salva
      const resultado = await _confirmarCadastroPIN(pin1, pAtual);
      const errEl = document.getElementById('bio-pin-error');
      if (resultado.ok) {
        document.getElementById('bio-pin-cadastro-modal')?.remove();
        toast('✅ PIN cadastrado com sucesso!');
      } else {
        if (errEl) { errEl.textContent = resultado.msg; errEl.style.color = 'var(--red)'; }
        setTimeout(() => {
          for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`cpd${i}`);
            if (dot) dot.classList.remove('filled');
          }
          if (errEl) errEl.textContent = '';
        }, 700);
      }
    }
  }
}

/* ════════════════════════════════════════════════════════════
   DESBLOQUEADO
════════════════════════════════════════════════════════════ */

function _bioDesbloqueado() {
  _bioSessaoAtiva = true;
  _bioTelaAberta  = false;
  haptic('success');

  const modal = document.getElementById('bio-auth-modal');
  if (modal) {
    modal.style.opacity = '0';
    modal.style.transition = 'opacity .2s';
    setTimeout(() => modal.remove(), 200);
  }

  _bioIniciarTimerInatividade();
  _bioRemoverBlur();
  console.info('[Bio] Sessão desbloqueada.');
}

/* ════════════════════════════════════════════════════════════
   LOGOUT
════════════════════════════════════════════════════════════ */

function _bioLogout() {
  const modal = document.getElementById('bio-auth-modal');
  if (modal) modal.remove();
  _bioTelaAberta  = false;
  _bioSessaoAtiva = false;
  backendLogout().then(() => location.reload());
}

/* ════════════════════════════════════════════════════════════
   TIMER DE INATIVIDADE
════════════════════════════════════════════════════════════ */

function _bioIniciarTimerInatividade() {
  _bioCancelarTimer();
  if (!_bioTemCredencial() && !_bioTemPIN()) return;

  const ms = _bioTimeoutMin * 60 * 1000;
  _bioInactTimer = setTimeout(() => {
    if (isAuthenticated()) {
      _bioSessaoAtiva = false;
      bioAutenticar();
    }
  }, ms);
}

function _bioCancelarTimer() {
  if (_bioInactTimer) { clearTimeout(_bioInactTimer); _bioInactTimer = null; }
}

function _bioResetarTimer() {
  if (_bioSessaoAtiva) _bioIniciarTimerInatividade();
}

// Reseta timer em qualquer interação do usuário
['touchstart', 'mousedown', 'keydown', 'scroll'].forEach(ev => {
  document.addEventListener(ev, _bioResetarTimer, { passive: true });
});

function bioConfigurarTimeout(min) {
  _bioTimeoutMin = min;
  localStorage.setItem(BIO_KEY_TIMEOUT, String(min));
  _bioIniciarTimerInatividade();
  toast(`⏱ Bloqueio automático: ${min} minutos`);
}

/* ════════════════════════════════════════════════════════════
   BLUR DE BACKGROUND
════════════════════════════════════════════════════════════ */

function _setupBlurBackground() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _bioAplicarBlur();
    } else {
      // Ao voltar, se sessão expirou pede auth
      setTimeout(() => {
        _bioRemoverBlur();
        if (!_bioSessaoAtiva && isAuthenticated() && (_bioTemCredencial() || _bioTemPIN())) {
          bioAutenticar();
        }
      }, 300);
    }
  });
}

function _bioAplicarBlur() {
  if (_bioBlurAtivo) return;
  _bioBlurAtivo = true;
  let el = document.getElementById('bio-blur-overlay');
  if (!el) {
    el           = document.createElement('div');
    el.id        = 'bio-blur-overlay';
    el.style.cssText = `
      position:fixed;inset:0;z-index:8500;
      backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      background:rgba(10,12,18,.6);
      display:flex;align-items:center;justify-content:center;
    `;
    el.innerHTML = `
      <div style="text-align:center;color:rgba(255,255,255,.6)">
        <div style="font-size:40px">🔒</div>
        <div style="font-size:13px;margin-top:8px;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px">
          DOCKCHECK PRO
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
}

function _bioRemoverBlur() {
  _bioBlurAtivo = false;
  const el = document.getElementById('bio-blur-overlay');
  if (el) el.style.display = 'none';
}

/* ════════════════════════════════════════════════════════════
   BOTÃO BIO NO MODAL DE LOGIN
════════════════════════════════════════════════════════════ */

function _injetarBotaoBioNoLogin() {
  // Aguarda o DOM estar pronto
  const injetar = () => {
    const loginModal = document.getElementById('ov-login');
    if (!loginModal || document.getElementById('bio-login-btn')) return;

    if (!_bioTemCredencial() && !_bioTemPIN()) return;

    const btn = document.createElement('button');
    btn.id        = 'bio-login-btn';
    btn.className = 'btn btn-ghost btn-full';
    btn.style.cssText = 'margin-top:8px;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px';
    btn.innerHTML = _bioTemCredencial() ? '🔐 Entrar com Biometria' : '🔢 Entrar com PIN';
    btn.onclick   = () => {
      loginModal.classList.remove('on');
      bioAutenticar();
    };

    const continueBtn = loginModal.querySelector('button.btn-ghost');
    if (continueBtn) {
      continueBtn.parentNode.insertBefore(btn, continueBtn);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injetar);
  } else {
    setTimeout(injetar, 600);
  }
}

/* ════════════════════════════════════════════════════════════
   SEÇÃO DE CONFIGURAÇÃO (aba Config)
════════════════════════════════════════════════════════════ */

/**
 * Renderiza a seção de biometria na aba Config.
 * Chame dentro do HTML da aba Config ou via JS.
 */
function bioRenderConfigSection() {
  const container = document.getElementById('bio-config-section');
  if (!container) return;
  _renderBioConfig();
}

function _renderBioConfig() {
  const container = document.getElementById('bio-config-section');
  if (!container) return;

  const temBio    = _bioTemCredencial();
  const temPIN    = _bioTemPIN();
  const timeout   = _bioTimeoutMin;

  container.innerHTML = `
    <div class="cfg-section-title" style="margin-top:20px">🔐 Segurança Mobile</div>

    <div class="cfg-card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-weight:700;font-size:13px">Biometria</div>
          <div style="font-size:11px;color:var(--mut)">
            ${_bioSuportado ? (temBio ? '✅ Cadastrada' : 'Não cadastrada') : '⚠️ Não suportada neste dispositivo'}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          ${_bioSuportado ? `
            <button class="btn btn-acc btn-sm" onclick="bioRegistrarCredencial()">
              ${temBio ? '🔄 Recadastrar' : '➕ Cadastrar'}
            </button>
          ` : ''}
          ${temBio ? `
            <button class="btn btn-ghost btn-sm" onclick="_bioRemoverCredencial()">🗑</button>
          ` : ''}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-weight:700;font-size:13px">PIN de 4 dígitos</div>
          <div style="font-size:11px;color:var(--mut)">${temPIN ? '✅ Cadastrado' : 'Não cadastrado'}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-acc btn-sm" onclick="bioCadastrarPIN()">
            ${temPIN ? '🔄 Alterar PIN' : '➕ Criar PIN'}
          </button>
          ${temPIN ? `
            <button class="btn btn-ghost btn-sm" onclick="_bioRemoverPIN()">🗑</button>
          ` : ''}
        </div>
      </div>

      <div>
        <div style="font-weight:700;font-size:13px;margin-bottom:8px">⏱ Bloqueio automático</div>
        <div style="display:flex;gap:8px">
          ${[5, 15, 30].map(m => `
            <button class="btn ${timeout === m ? 'btn-acc' : 'btn-ghost'} btn-sm"
              style="flex:1" onclick="bioConfigurarTimeout(${m});_renderBioConfig()">
              ${m} min
            </button>
          `).join('')}
        </div>
        <div style="font-size:11px;color:var(--mut);margin-top:6px">
          App bloqueia após ${timeout} min sem uso
        </div>
      </div>
    </div>
  `;
}

function _bioRemoverCredencial() {
  localStorage.removeItem(BIO_KEY_CRED_ID);
  localStorage.removeItem(BIO_KEY_ENABLED);
  toast('Biometria removida.');
  _renderBioConfig();
}

function _bioRemoverPIN() {
  localStorage.removeItem(BIO_KEY_PIN_HASH);
  localStorage.removeItem(BIO_KEY_PIN_SET);
  toast('PIN removido.');
  _renderBioConfig();
}

/* ════════════════════════════════════════════════════════════
   UTILITÁRIOS CRYPTO
════════════════════════════════════════════════════════════ */

function _bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function _base64ToBuf(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

/* ════════════════════════════════════════════════════════════
   CSS INJETADO DINAMICAMENTE
════════════════════════════════════════════════════════════ */

(function _injetarCSSBio() {
  if (document.getElementById('css-bio-fase13')) return;
  const style = document.createElement('style');
  style.id    = 'css-bio-fase13';
  style.textContent = `

    /* ── Modal de auth ── */
    #bio-auth-modal,
    #bio-pin-cadastro-modal {
      position: fixed;
      inset: 0;
      z-index: 9100;
      background: var(--bg, #111318);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      padding-top: env(safe-area-inset-top, 24px);
      padding-bottom: env(safe-area-inset-bottom, 24px);
    }

    #bio-auth-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      width: 100%;
      max-width: 320px;
      text-align: center;
    }

    #bio-auth-logo {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 3px;
      color: var(--txt, #e8eaf0);
    }

    #bio-auth-logo span:first-child { color: var(--acc, #ffc800); }

    .bio-badge {
      font-size: 10px;
      background: var(--acc, #ffc800);
      color: #000;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 4px;
      vertical-align: middle;
      font-weight: 800;
    }

    #bio-auth-subtitle {
      font-size: 11px;
      color: var(--mut, #555);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    #bio-auth-user {
      font-size: 13px;
      color: var(--txt, #e8eaf0);
      font-weight: 600;
    }

    #bio-auth-icon {
      font-size: 56px;
      line-height: 1;
    }

    #bio-auth-msg {
      font-size: 13px;
      color: var(--mut, #555);
      max-width: 240px;
    }

    /* ── Botão principal bio ── */
    #bio-btn-auth {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 18px 32px;
      background: var(--acc, #ffc800);
      border: none;
      border-radius: 14px;
      color: #000;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: .5px;
      cursor: pointer;
      width: 100%;
      -webkit-tap-highlight-color: transparent;
      transition: opacity .15s;
    }

    #bio-btn-auth:disabled { opacity: .5; }
    #bio-btn-icon { font-size: 28px; }

    /* ── Fallbacks ── */
    #bio-btn-pin-fallback,
    #bio-btn-bio-fallback {
      background: none;
      border: 1.5px solid var(--bord, #2a2d38);
      border-radius: 10px;
      color: var(--mut, #555);
      font-size: 13px;
      padding: 10px 20px;
      cursor: pointer;
      width: 100%;
      -webkit-tap-highlight-color: transparent;
    }

    #bio-btn-logout {
      background: none;
      border: none;
      color: var(--mut, #555);
      font-size: 12px;
      cursor: pointer;
      text-decoration: underline;
      margin-top: 4px;
    }

    /* ── PIN dots ── */
    #bio-pin-display {
      display: flex;
      gap: 16px;
      justify-content: center;
      align-items: center;
      height: 32px;
    }

    .bio-pin-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid var(--mut, #555);
      background: transparent;
      transition: background .1s, border-color .1s;
      display: block;
    }

    .bio-pin-dot.filled {
      background: var(--acc, #ffc800);
      border-color: var(--acc, #ffc800);
    }

    #bio-pin-error {
      font-size: 12px;
      min-height: 16px;
      color: var(--red, #e05260);
    }

    /* ── Numpad ── */
    #bio-numpad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 280px;
    }

    .bio-numpad-btn {
      height: 62px;
      border-radius: 12px;
      background: var(--bg2, #1a1d26);
      border: 1.5px solid var(--bord, #2a2d38);
      color: var(--txt, #e8eaf0);
      font-size: 22px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background .1s;
    }

    .bio-numpad-btn:active {
      background: var(--bg3, #22263a);
    }

    .bio-numpad-btn:disabled { opacity: .4; }

    /* ── Cancelar ── */
    #bio-btn-cancelar {
      background: none;
      border: none;
      color: var(--mut, #555);
      font-size: 12px;
      cursor: pointer;
      text-decoration: underline;
    }

    /* ── Shake animation ── */
    @keyframes bio-shake {
      0%,100% { transform: translateX(0); }
      20%      { transform: translateX(-8px); }
      40%      { transform: translateX(8px); }
      60%      { transform: translateX(-5px); }
      80%      { transform: translateX(5px); }
    }

  `;
  document.head.appendChild(style);
})();
