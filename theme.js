/**
 * theme.js — DockCheck PRO · Fase 13 Etapa Final
 * Gerenciador de tema: dark (padrão) e light mode.
 *
 * Funciona via atributo [data-theme="light"] no <html>.
 * As variáveis CSS do light mode estão em style.css.
 *
 * API pública:
 *   themeManager.init()        → aplica tema salvo
 *   themeManager.set('light')  → muda e persiste
 *   themeManager.toggle()      → alterna dark ↔ light
 *   themeManager.current       → 'dark' | 'light'
 */

'use strict';

const THEME_KEY = 'cc3_theme';

const themeManager = {
  _current: 'dark',

  /**
   * Inicializa: aplica tema salvo no localStorage.
   * Deve ser chamado o mais cedo possível para evitar flash.
   */
  init() {
    this._current = localStorage.getItem(THEME_KEY) || 'dark';
    this._applyDOM(false); // sem toast no init
  },

  /**
   * Define o tema e persiste.
   * @param {'dark'|'light'} theme
   */
  set(theme) {
    if (theme !== 'dark' && theme !== 'light') return;
    this._current = theme;
    localStorage.setItem(THEME_KEY, theme);
    this._applyDOM(true);
  },

  /** Alterna entre dark e light. */
  toggle() {
    this.set(this._current === 'dark' ? 'light' : 'dark');
  },

  /** Tema atual */
  get current() { return this._current; },

  /**
   * Aplica o tema ao DOM.
   * @param {boolean} showToast
   */
  _applyDOM(showToast) {
    const html = document.documentElement;

    if (this._current === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }

    // Adiciona classe de transição suave (só após init)
    if (showToast) {
      html.classList.add('theme-transition');
      setTimeout(() => html.classList.remove('theme-transition'), 400);

      // Toast com label traduzida
      const label = this._current === 'light'
        ? (typeof i18n !== 'undefined' ? i18n.t('cfg.pref.tema') + ' ☀️' : '☀️ Claro')
        : (typeof i18n !== 'undefined' ? i18n.t('cfg.pref.tema') + ' 🌙' : '🌙 Escuro');
      if (typeof toast === 'function') {
        const labels = { dark: '🌙 Tema escuro', light: '☀️ Tema claro' };
        toast(labels[this._current]);
      }
    }

    // Sincroniza seletor de tema
    const sel = document.getElementById('pref-tema');
    if (sel) sel.value = this._current;
  },
};

/* ════════════════════════════════════════════════════════════
   APLICAÇÃO ANTECIPADA — evita flash de tema errado
   Roda imediatamente ao carregar o script, antes do DOMContentLoaded.
════════════════════════════════════════════════════════════ */

(function applyThemeEarly() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
