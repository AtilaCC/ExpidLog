/**
 * geo.js — DockCheck PRO · Fase 13 · Etapa 7
 * Geolocalização operacional enterprise.
 *
 * Funcionalidades:
 *  - Captura lat/lng ao registrar conferência
 *  - Validação de área do CD (alerta se fora do perímetro)
 *  - Histórico de localização por turno
 *  - Badge de status GPS no header
 *  - Seção de config gerada em #geo-config-section
 *
 * Funções globais expostas:
 *   geoInit()                    — inicia o módulo
 *   geoCapturar()                — captura posição atual → Promise<{lat,lng,acc}>
 *   geoValidar(lat, lng)         — verifica se está dentro do CD → {ok, distancia}
 *   geoGetUltima()               — retorna última posição capturada
 *   geoRenderConfigSection()     — renderiza seção na aba Config
 *   geoRenderHistorico()         — renderiza histórico de localizações
 *
 * Depende de: app.js (após init)
 * Posição no index.html: após biometria.js, antes de bi.js
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   ESTADO INTERNO
════════════════════════════════════════════════════════════ */

const _GEO = {
  suportado:     'geolocation' in navigator,
  permissao:     null,     // 'granted' | 'denied' | 'prompt' | null
  ultima:        null,     // { lat, lng, acc, ts }
  historico:     [],       // [{ lat, lng, acc, ts, doca, oc }]
  cdCentro:      null,     // { lat, lng } — centro do CD configurado
  cdRaio:        500,      // metros — raio do CD (padrão 500m)
  watchId:       null,     // ID do watchPosition
  ativo:         false,
};

/* ════════════════════════════════════════════════════════════
   STORAGE KEYS
════════════════════════════════════════════════════════════ */

const GEO_K_CENTRO  = 'geo_cd_centro';
const GEO_K_RAIO    = 'geo_cd_raio';
const GEO_K_HIST    = 'geo_historico';
const GEO_K_ATIVO   = 'geo_ativo';

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Inicia o módulo de geolocalização.
 * Deve ser chamado no app.js após backendInit() e bioInit().
 */
function geoInit() {
  if (!_GEO.suportado) {
    console.warn('[GEO] Geolocalização não suportada neste dispositivo.');
    _geoRenderBadge('unsupported');
    return;
  }

  // Carrega config salva
  const centro = _geoStorageGet(GEO_K_CENTRO, null);
  const raio   = _geoStorageGet(GEO_K_RAIO, 500);
  const hist   = _geoStorageGet(GEO_K_HIST, []);
  const ativo  = _geoStorageGet(GEO_K_ATIVO, true);

  if (centro) _GEO.cdCentro = centro;
  _GEO.cdRaio    = raio;
  _GEO.historico = hist;
  _GEO.ativo     = ativo;

  // Verifica permissão
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      _GEO.permissao = result.state;
      _geoRenderBadge(result.state);
      result.addEventListener('change', () => {
        _GEO.permissao = result.state;
        _geoRenderBadge(result.state);
      });
    });
  }

  // Inicia watch passivo (baixa frequência, apenas para status)
  if (_GEO.ativo) _geoStartWatch();

  console.info('[GEO] Módulo iniciado. CD:', _GEO.cdCentro, 'Raio:', _GEO.cdRaio + 'm');
}

/* ════════════════════════════════════════════════════════════
   CAPTURA DE POSIÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Captura a posição atual com alta precisão.
 * @returns {Promise<{lat, lng, acc, ts}>}
 */
function geoCapturar() {
  return new Promise((resolve, reject) => {
    if (!_GEO.suportado || !_GEO.ativo) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const geo = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy),
          ts:  new Date().toISOString(),
        };
        _GEO.ultima = geo;
        _geoRenderBadge('granted');
        resolve(geo);
      },
      err => {
        console.warn('[GEO] Erro ao capturar posição:', err.message);
        _geoRenderBadge('denied');
        resolve(null); // resolve null em vez de rejeitar — não bloqueia a conferência
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

/**
 * Retorna a última posição capturada (pode ser null).
 * @returns {{lat, lng, acc, ts}|null}
 */
function geoGetUltima() {
  return _GEO.ultima;
}

/* ════════════════════════════════════════════════════════════
   VALIDAÇÃO DE ÁREA
════════════════════════════════════════════════════════════ */

/**
 * Verifica se uma coordenada está dentro do raio do CD.
 * @param {number} lat
 * @param {number} lng
 * @returns {{ ok: boolean, distancia: number|null }}
 */
function geoValidar(lat, lng) {
  if (!_GEO.cdCentro) return { ok: true, distancia: null }; // sem CD configurado → sempre ok

  const dist = _geoDistancia(_GEO.cdCentro.lat, _GEO.cdCentro.lng, lat, lng);
  return {
    ok:        dist <= _GEO.cdRaio,
    distancia: Math.round(dist),
  };
}

/**
 * Captura posição e valida — use em conferencia.js antes de registrar.
 * Exibe alerta se fora do CD mas NÃO bloqueia o registro.
 * @param {string} doca
 * @param {string} oc
 * @returns {Promise<{lat,lng,acc,ts}|null>}
 */
async function geoCapturarEValidar(doca, oc) {
  const pos = await geoCapturar();
  if (!pos) return null;

  // Salva no histórico
  const entrada = { ...pos, doca, oc };
  _GEO.historico.unshift(entrada);
  if (_GEO.historico.length > 200) _GEO.historico.pop();
  _geoStorageSet(GEO_K_HIST, _GEO.historico);

  // Valida área
  const { ok, distancia } = geoValidar(pos.lat, pos.lng);
  if (!ok && distancia !== null) {
    const dist = distancia >= 1000
      ? (distancia / 1000).toFixed(1) + 'km'
      : distancia + 'm';

    // Alerta visual não-bloqueante
    _geoAlerta(
      `⚠️ Fora do CD — ${dist} do perímetro`,
      'A operação foi registrada mas a localização está fora da área configurada.'
    );

    if (typeof haptic === 'function') haptic('heavy');
  }

  return pos;
}

/* ════════════════════════════════════════════════════════════
   WATCH PASSIVO (status GPS)
════════════════════════════════════════════════════════════ */

function _geoStartWatch() {
  if (_GEO.watchId !== null) return;
  _GEO.watchId = navigator.geolocation.watchPosition(
    pos => {
      _GEO.ultima = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        acc: Math.round(pos.coords.accuracy),
        ts:  new Date().toISOString(),
      };
      _geoRenderBadge('granted');
    },
    () => { _geoRenderBadge('denied'); },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
  );
}

function _geoStopWatch() {
  if (_GEO.watchId !== null) {
    navigator.geolocation.clearWatch(_GEO.watchId);
    _GEO.watchId = null;
  }
}

/* ════════════════════════════════════════════════════════════
   BADGE DE STATUS NO HEADER
════════════════════════════════════════════════════════════ */

function _geoRenderBadge(estado) {
  let el = document.getElementById('geo-status-badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'geo-status-badge';
    el.style.cssText = [
      'display:inline-flex', 'align-items:center', 'gap:3px',
      'font-size:10px', 'font-weight:700',
      'font-family:"Barlow Condensed",sans-serif',
      'letter-spacing:.3px', 'cursor:pointer',
      'padding:2px 6px', 'border-radius:4px',
      'border:1px solid transparent',
    ].join(';');
    el.title = 'Status GPS';
    el.onclick = () => { goTab('config', document.querySelector('.ntab[onclick*="config"]')); };

    // Insere ao lado do clock
    const topRight = document.querySelector('.topbar-right');
    if (topRight) topRight.insertBefore(el, document.getElementById('clock'));
  }

  const MAP = {
    granted:     { icon: '📍', cor: '#4caf50', label: 'GPS',     bord: '#4caf5040' },
    denied:      { icon: '🚫', cor: '#f44336', label: 'GPS OFF', bord: '#f4433640' },
    prompt:      { icon: '📡', cor: '#ff9800', label: 'GPS?',    bord: '#ff980040' },
    unsupported: { icon: '📡', cor: '#666',    label: 'Sem GPS', bord: '#66666640' },
  };

  const cfg = MAP[estado] || MAP.prompt;
  el.innerHTML      = `<span>${cfg.icon}</span><span style="color:${cfg.cor}">${cfg.label}</span>`;
  el.style.borderColor = cfg.bord;
}

/* ════════════════════════════════════════════════════════════
   ALERTA FORA DO CD
════════════════════════════════════════════════════════════ */

function _geoAlerta(titulo, mensagem) {
  let el = document.getElementById('geo-alerta');
  if (!el) {
    el = document.createElement('div');
    el.id = 'geo-alerta';
    el.style.cssText = [
      'position:fixed', 'top:60px', 'left:50%', 'transform:translateX(-50%)',
      'background:#f44336', 'color:#fff',
      'font-family:"Barlow Condensed",sans-serif',
      'font-size:13px', 'font-weight:700',
      'padding:10px 16px', 'border-radius:8px',
      'z-index:9999', 'max-width:320px', 'text-align:center',
      'box-shadow:0 4px 20px #0006',
      'transition:opacity .3s',
    ].join(';');
    document.body.appendChild(el);
  }

  el.innerHTML  = `<div>${titulo}</div><div style="font-size:11px;font-weight:400;margin-top:2px;opacity:.9">${mensagem}</div>`;
  el.style.display  = 'block';
  el.style.opacity  = '1';

  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }, 5000);
}

/* ════════════════════════════════════════════════════════════
   SEÇÃO DE CONFIG
════════════════════════════════════════════════════════════ */

/**
 * Renderiza a seção de configuração de geo na aba Config.
 * Deve existir um <div id="geo-config-section"> no index.html.
 */
function geoRenderConfigSection() {
  const el = document.getElementById('geo-config-section');
  if (!el) return;

  const centro = _GEO.cdCentro;
  const raio   = _GEO.cdRaio;
  const ativo  = _GEO.ativo;

  el.innerHTML = `
    <div class="cfg-section" style="margin-top:16px">
      <div class="cfg-title" style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;letter-spacing:1px;color:var(--acc);margin-bottom:12px">
        📍 GEOLOCALIZAÇÃO
      </div>

      <!-- Toggle ativo -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:13px;color:var(--txt)">Geolocalização ativa</span>
        <label style="position:relative;display:inline-block;width:44px;height:24px">
          <input type="checkbox" id="geo-toggle-ativo" ${ativo ? 'checked' : ''}
            onchange="geoToggleAtivo(this.checked)"
            style="opacity:0;width:0;height:0">
          <span style="
            position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
            background:${ativo ? 'var(--acc)' : 'var(--bord)'};
            border-radius:24px;transition:.3s;
          "></span>
          <span style="
            position:absolute;content:'';height:18px;width:18px;
            left:${ativo ? '23px' : '3px'};bottom:3px;
            background:#fff;border-radius:50%;transition:.3s;
          "></span>
        </label>
      </div>

      <!-- Status atual -->
      <div id="geo-cfg-status" style="font-size:12px;color:var(--mut);margin-bottom:12px">
        ${_GEO.ultima
          ? `📍 Última posição: ${_GEO.ultima.lat.toFixed(5)}, ${_GEO.ultima.lng.toFixed(5)} (±${_GEO.ultima.acc}m)`
          : '📡 Nenhuma posição capturada ainda'}
      </div>

      <!-- Configurar centro do CD -->
      <div style="font-size:12px;color:var(--mut);margin-bottom:6px">Centro do CD (lat, lng)</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input id="geo-lat" type="number" step="0.00001" placeholder="Latitude"
          value="${centro ? centro.lat : ''}"
          style="flex:1;background:var(--bg2);border:1px solid var(--bord);color:var(--txt);padding:8px;border-radius:6px;font-size:13px">
        <input id="geo-lng" type="number" step="0.00001" placeholder="Longitude"
          value="${centro ? centro.lng : ''}"
          style="flex:1;background:var(--bg2);border:1px solid var(--bord);color:var(--txt);padding:8px;border-radius:6px;font-size:13px">
      </div>

      <!-- Raio -->
      <div style="font-size:12px;color:var(--mut);margin-bottom:6px">Raio de operação: <b id="geo-raio-label">${raio}m</b></div>
      <input type="range" id="geo-raio" min="50" max="2000" step="50" value="${raio}"
        oninput="document.getElementById('geo-raio-label').textContent=this.value+'m'"
        style="width:100%;margin-bottom:12px;accent-color:var(--acc)">

      <!-- Botões -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-acc btn-sm" onclick="geoSalvarConfig()"
          style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:.5px">
          💾 Salvar
        </button>
        <button class="btn btn-ghost btn-sm" onclick="geoUsarPosicaoAtual()"
          style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700">
          📍 Usar minha posição
        </button>
        <button class="btn btn-ghost btn-sm" onclick="geoRenderHistorico()"
          style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700">
          📋 Ver histórico
        </button>
      </div>

      <!-- Histórico de localizações -->
      <div id="geo-hist-output" style="margin-top:14px"></div>
    </div>
  `;
}

/* ── Ações da seção Config ── */

function geoToggleAtivo(on) {
  _GEO.ativo = on;
  _geoStorageSet(GEO_K_ATIVO, on);
  if (on) { _geoStartWatch(); }
  else    { _geoStopWatch(); _geoRenderBadge('unsupported'); }
  if (typeof toast === 'function') toast(on ? '📍 Geolocalização ativada' : '📡 Geolocalização desativada');
  geoRenderConfigSection(); // re-renderiza para atualizar toggle visual
}

function geoSalvarConfig() {
  const lat  = parseFloat(document.getElementById('geo-lat')?.value);
  const lng  = parseFloat(document.getElementById('geo-lng')?.value);
  const raio = parseInt(document.getElementById('geo-raio')?.value) || 500;

  if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
    _GEO.cdCentro = { lat, lng };
    _geoStorageSet(GEO_K_CENTRO, { lat, lng });
  }
  _GEO.cdRaio = raio;
  _geoStorageSet(GEO_K_RAIO, raio);
  if (typeof toast === 'function') toast('✅ Configuração de geo salva!');
  if (typeof haptic === 'function') haptic('success');
}

async function geoUsarPosicaoAtual() {
  if (typeof toast === 'function') toast('📡 Capturando posição...');
  const pos = await geoCapturar();
  if (!pos) {
    if (typeof toast === 'function') toast('❌ Não foi possível obter a posição');
    return;
  }
  const latEl = document.getElementById('geo-lat');
  const lngEl = document.getElementById('geo-lng');
  if (latEl) latEl.value = pos.lat.toFixed(6);
  if (lngEl) lngEl.value = pos.lng.toFixed(6);
  if (typeof toast === 'function') toast(`📍 Posição capturada! (±${pos.acc}m)`);
  if (typeof haptic === 'function') haptic('success');
}

/**
 * Renderiza histórico de localizações na seção Config.
 */
function geoRenderHistorico() {
  const el = document.getElementById('geo-hist-output');
  if (!el) return;

  const hist = _GEO.historico.slice(0, 20);
  if (!hist.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--mut);margin-top:8px">Nenhuma localização registrada.</div>';
    return;
  }

  el.innerHTML = `
    <div style="font-size:12px;color:var(--mut);margin-bottom:6px;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.5px">
      ÚLTIMAS ${hist.length} LOCALIZAÇÕES
    </div>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${hist.map(h => {
        const valido = geoValidar(h.lat, h.lng);
        const cor    = valido.ok ? 'var(--grn)' : '#f44336';
        const icone  = valido.ok ? '✅' : '⚠️';
        const hora   = h.ts ? new Date(h.ts).toLocaleTimeString('pt-BR') : '—';
        const dist   = valido.distancia !== null
          ? ` · ${valido.distancia >= 1000 ? (valido.distancia/1000).toFixed(1)+'km' : valido.distancia+'m'} do CD`
          : '';
        return `
          <div style="
            background:var(--bg2);border:1px solid var(--bord);
            border-radius:6px;padding:7px 10px;
            display:flex;justify-content:space-between;align-items:center
          ">
            <div>
              <span style="font-size:12px;font-weight:700;color:var(--txt)">
                ${icone} Doca ${h.doca || '—'} · OC ${h.oc || '—'}
              </span>
              <div style="font-size:10px;color:var(--mut)">${hora}${dist}</div>
            </div>
            <div style="font-size:10px;color:${cor};text-align:right">
              ${h.lat?.toFixed(4)}<br>${h.lng?.toFixed(4)}<br>±${h.acc}m
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   UTILITÁRIOS
════════════════════════════════════════════════════════════ */

/**
 * Distância entre dois pontos em metros (fórmula de Haversine).
 */
function _geoDistancia(lat1, lng1, lat2, lng2) {
  const R  = 6371000; // raio da Terra em metros
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dl  = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(dL/2) * Math.sin(dL/2) +
             Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
             Math.sin(dl/2) * Math.sin(dl/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _geoStorageGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function _geoStorageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
