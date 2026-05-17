/**
 * i18n.js — DockCheck PRO · Fase 13 Etapa Final
 * Sistema multiidioma: pt-BR, en-US, es
 *
 * Uso nos elementos HTML:
 *   data-i18n="chave"             → traduz textContent
 *   data-i18n-placeholder="chave" → traduz placeholder
 *   data-i18n-title="chave"       → traduz title
 *
 * API pública:
 *   i18n.init()          → carrega idioma salvo e aplica
 *   i18n.set('en')       → muda idioma e persiste
 *   i18n.t('chave')      → retorna tradução
 *   i18n.lang            → idioma atual
 */

'use strict';

const I18N_KEY = 'cc3_lang';

/* ════════════════════════════════════════════════════════════
   DICIONÁRIO DE TRADUÇÕES
════════════════════════════════════════════════════════════ */

const TRANSLATIONS = {

  /* ── Português Brasil ── */
  'pt-BR': {
    // Navegação
    'nav.conferencia': '📦 Conferência',
    'nav.dashboard':   '🖥 Dashboard',
    'nav.tabela':      '📷 Ler Tabela',
    'nav.equipes':     '👥 Equipes',
    'nav.historico':   '🕐 Histórico',
    'nav.relatorio':   '📊 Relatório',
    'nav.ia':          '🤖 IA',
    'nav.config':      '⚙️ Config',

    // Conferência
    'conf.titulo':     'Nova Conferência',
    'conf.doca':       '🏭 Doca',
    'conf.equipe':     '👷 Equipe',
    'conf.carga':      '🚛 Dados da Carga',
    'conf.fotos':      '📷 Fotos do Caminhão',
    'conf.estado':     '🔍 Estado da Carga',
    'conf.msg':        '💬 Mensagem',
    'conf.tabela':     '📄 Foto da Tabela Diária',
    'conf.registrar':  '✅ Registrar Conferência',

    // Dashboard
    'dash.titulo':     'Central Operacional',
    'dash.hoje':       'Hoje',
    'dash.semana':     'Semana',
    'dash.turno':      'Turno',
    'dash.sem-dados':  'Sem dados hoje',

    // Equipes
    'eq.titulo':       'Equipes',
    'eq.nova':         '+ Nova Equipe',
    'eq.conf-label':   'Conferente *',
    'eq.aux1':         'Auxiliar 1',
    'eq.aux2':         'Auxiliar 2',
    'eq.docas':        'Docas (separadas por vírgula) *',
    'eq.status':       'Status',
    'eq.ativa':        'Ativa',
    'eq.inativa':      'Inativa',

    // Histórico
    'hist.titulo':     'Histórico',
    'hist.limpar':     '🗑 Limpar',
    'hist.vazio':      'Nenhum registro.',
    'hist.copiar':     '📋 Copiar',
    'hist.fotos':      '📷 Ver fotos',

    // Relatório
    'rel.titulo':      'Relatório',
    'rel.filtros':     '🔍 Filtros',
    'rel.resumo':      '📊 Resumo geral',
    'rel.doca':        '📊 Cargas por doca',
    'rel.tempo':       '⏱ Tempo médio por doca (min)',
    'rel.transp':      '🚛 Cargas por transportadora',
    'rel.atividade':   '📈 Atividade por dia',
    'rel.top-rap':     '⚡ Docas mais rápidas — Top 3',
    'rel.top-len':     '🐢 Docas mais lentas — Top 3',
    'rel.ranking-c':   '🏅 Top 3 por tempo médio',
    'rel.comp':        '🏭 Relatório completo por doca',
    'rel.rank-conf':   '🏆 Ranking de conferentes',
    'rel.rank-transp': '🚚 Ranking transportadoras',
    'rel.por-dia':     '📆 Atividade por dia',
    'rel.whatsapp':    '💬 Enviar relatório via WhatsApp',
    'rel.resumo-btn':  '📤 Resumo rápido',
    'rel.comp-btn':    '📋 Relatório completo',
    'rel.exportar':    '📥 Exportar CSV',

    // IA
    'ia.titulo':       '🤖 Análise IA',
    'ia.insights':     'Insights Operacionais',
    'ia.analisar':     '▶ Analisar operação',
    'ia.hint':         'Clique em "Analisar operação" para gerar insights automáticos baseados no histórico.',
    'ia.detalhe':      '📊 Análise detalhada',

    // Config
    'cfg.apikey':      '🔑 API Key Anthropic (OCR + IA)',
    'cfg.apikey.hint': 'Necessária para extrair tabelas e análise IA. Salva só neste navegador.',
    'cfg.tempo':       '⏱ Tempo médio alvo (minutos)',
    'cfg.tempo.hint':  'Usado pelo cronômetro para alertas de carga acima do tempo.',
    'cfg.tmpl':        '✏️ Template da Mensagem',
    'cfg.teste':       '🧪 Dados de Teste',
    'cfg.teste.hint':  'Tabela real com 20 linhas + equipes de teste.',
    'cfg.storage':     '🗄️ Storage — Diagnóstico',
    'cfg.storage.hint':'IndexedDB ativo desde a Fase 2. Dados migrados automaticamente do localStorage.',
    'cfg.pref':        '🌐 Preferências do Aplicativo',
    'cfg.pref.lang':   'Idioma',
    'cfg.pref.tema':   'Tema',

    // Botões
    'btn.salvar':      '💾 Salvar',
    'btn.cancelar':    'Cancelar',
    'btn.padrao':      '↩ Padrão',
    'btn.verificar':   '🔍 Verificar storage',
    'btn.backup':      '💾 Backup JSON',
    'btn.exportar':    '📥 Exportar CSV',
    'btn.instalar':    '📲 Instalar App',
    'btn.eq-teste':    '↩ Equipes de teste',
    'btn.tab-teste':   '↩ Tabela de teste',
    'btn.nova-eq':     '+ Nova Equipe',

    // Modal equipe
    'modal.eq.nova':   'Nova Equipe',
    'modal.eq.editar': 'Editar Equipe',

    // Modal envio
    'modal.envio.titulo': '📤 Enviar para WhatsApp',
    'modal.envio.enviar': '📤 Enviar foto + texto juntos',
    'modal.envio.copiar': '📋 Só copiar texto',
    'modal.envio.registrar': '✅ Registrar',

    // Fila
    'fila.titulo':     'Fila de OCs',

    // Diag
    'diag.click':      'Clique em Verificar para carregar...',

    // Geral
    'geral.ativo':     'Ativo',
    'geral.inativo':   'Inativo',
    'geral.minutos':   'Minutos',
    'geral.sem-aux':   'Sem auxiliares',
  },

  /* ── English ── */
  'en': {
    'nav.conferencia': '📦 Check-in',
    'nav.dashboard':   '🖥 Dashboard',
    'nav.tabela':      '📷 Read Table',
    'nav.equipes':     '👥 Teams',
    'nav.historico':   '🕐 History',
    'nav.relatorio':   '📊 Report',
    'nav.ia':          '🤖 AI',
    'nav.config':      '⚙️ Settings',

    'conf.titulo':     'New Check-in',
    'conf.doca':       '🏭 Dock',
    'conf.equipe':     '👷 Team',
    'conf.carga':      '🚛 Cargo Data',
    'conf.fotos':      '📷 Truck Photos',
    'conf.estado':     '🔍 Cargo Status',
    'conf.msg':        '💬 Message',
    'conf.tabela':     '📄 Daily Table Photo',
    'conf.registrar':  '✅ Register Check-in',

    'dash.titulo':     'Operations Center',
    'dash.hoje':       'Today',
    'dash.semana':     'Week',
    'dash.turno':      'Shift',
    'dash.sem-dados':  'No data today',

    'eq.titulo':       'Teams',
    'eq.nova':         '+ New Team',
    'eq.conf-label':   'Inspector *',
    'eq.aux1':         'Assistant 1',
    'eq.aux2':         'Assistant 2',
    'eq.docas':        'Docks (comma separated) *',
    'eq.status':       'Status',
    'eq.ativa':        'Active',
    'eq.inativa':      'Inactive',

    'hist.titulo':     'History',
    'hist.limpar':     '🗑 Clear',
    'hist.vazio':      'No records.',
    'hist.copiar':     '📋 Copy',
    'hist.fotos':      '📷 View photos',

    'rel.titulo':      'Report',
    'rel.filtros':     '🔍 Filters',
    'rel.resumo':      '📊 General Summary',
    'rel.doca':        '📊 Loads by dock',
    'rel.tempo':       '⏱ Avg time by dock (min)',
    'rel.transp':      '🚛 Loads by carrier',
    'rel.atividade':   '📈 Activity by day',
    'rel.top-rap':     '⚡ Fastest docks — Top 3',
    'rel.top-len':     '🐢 Slowest docks — Top 3',
    'rel.ranking-c':   '🏅 Top 3 by avg loading time',
    'rel.comp':        '🏭 Full report by dock',
    'rel.rank-conf':   '🏆 Inspector ranking',
    'rel.rank-transp': '🚚 Carrier ranking',
    'rel.por-dia':     '📆 Activity by day',
    'rel.whatsapp':    '💬 Send report via WhatsApp',
    'rel.resumo-btn':  '📤 Quick summary',
    'rel.comp-btn':    '📋 Full report',
    'rel.exportar':    '📥 Export CSV',

    'ia.titulo':       '🤖 AI Analysis',
    'ia.insights':     'Operational Insights',
    'ia.analisar':     '▶ Analyze operation',
    'ia.hint':         'Click "Analyze operation" to generate automatic insights from history.',
    'ia.detalhe':      '📊 Detailed analysis',

    'cfg.apikey':      '🔑 Anthropic API Key (OCR + AI)',
    'cfg.apikey.hint': 'Required for table extraction and AI analysis. Saved only in this browser.',
    'cfg.tempo':       '⏱ Target average time (minutes)',
    'cfg.tempo.hint':  'Used by the timer for overdue cargo alerts.',
    'cfg.tmpl':        '✏️ Message Template',
    'cfg.teste':       '🧪 Test Data',
    'cfg.teste.hint':  'Real table with 20 rows + test teams.',
    'cfg.storage':     '🗄️ Storage — Diagnostics',
    'cfg.storage.hint':'IndexedDB active since Phase 2. Data automatically migrated from localStorage.',
    'cfg.pref':        '🌐 App Preferences',
    'cfg.pref.lang':   'Language',
    'cfg.pref.tema':   'Theme',

    'btn.salvar':      '💾 Save',
    'btn.cancelar':    'Cancel',
    'btn.padrao':      '↩ Default',
    'btn.verificar':   '🔍 Check storage',
    'btn.backup':      '💾 JSON Backup',
    'btn.exportar':    '📥 Export CSV',
    'btn.instalar':    '📲 Install App',
    'btn.eq-teste':    '↩ Test Teams',
    'btn.tab-teste':   '↩ Test Table',
    'btn.nova-eq':     '+ New Team',

    'modal.eq.nova':   'New Team',
    'modal.eq.editar': 'Edit Team',
    'modal.envio.titulo': '📤 Send via WhatsApp',
    'modal.envio.enviar': '📤 Send photo + text',
    'modal.envio.copiar': '📋 Copy text only',
    'modal.envio.registrar': '✅ Register',

    'fila.titulo':     'Orders Queue',
    'diag.click':      'Click Check to load...',
    'geral.ativo':     'Active',
    'geral.inativo':   'Inactive',
    'geral.minutos':   'Minutes',
    'geral.sem-aux':   'No assistants',
  },

  /* ── Español ── */
  'es': {
    'nav.conferencia': '📦 Conferencia',
    'nav.dashboard':   '🖥 Panel',
    'nav.tabela':      '📷 Leer Tabla',
    'nav.equipes':     '👥 Equipos',
    'nav.historico':   '🕐 Historial',
    'nav.relatorio':   '📊 Reporte',
    'nav.ia':          '🤖 IA',
    'nav.config':      '⚙️ Ajustes',

    'conf.titulo':     'Nueva Conferencia',
    'conf.doca':       '🏭 Muelle',
    'conf.equipe':     '👷 Equipo',
    'conf.carga':      '🚛 Datos de Carga',
    'conf.fotos':      '📷 Fotos del Camión',
    'conf.estado':     '🔍 Estado de Carga',
    'conf.msg':        '💬 Mensaje',
    'conf.tabela':     '📄 Foto de Tabla Diaria',
    'conf.registrar':  '✅ Registrar Conferencia',

    'dash.titulo':     'Centro Operacional',
    'dash.hoje':       'Hoy',
    'dash.semana':     'Semana',
    'dash.turno':      'Turno',
    'dash.sem-dados':  'Sin datos hoy',

    'eq.titulo':       'Equipos',
    'eq.nova':         '+ Nuevo Equipo',
    'eq.conf-label':   'Inspector *',
    'eq.aux1':         'Auxiliar 1',
    'eq.aux2':         'Auxiliar 2',
    'eq.docas':        'Muelles (separados por coma) *',
    'eq.status':       'Estado',
    'eq.ativa':        'Activo',
    'eq.inativa':      'Inactivo',

    'hist.titulo':     'Historial',
    'hist.limpar':     '🗑 Limpiar',
    'hist.vazio':      'Sin registros.',
    'hist.copiar':     '📋 Copiar',
    'hist.fotos':      '📷 Ver fotos',

    'rel.titulo':      'Reporte',
    'rel.filtros':     '🔍 Filtros',
    'rel.resumo':      '📊 Resumen general',
    'rel.doca':        '📊 Cargas por muelle',
    'rel.tempo':       '⏱ Tiempo promedio por muelle (min)',
    'rel.transp':      '🚛 Cargas por transportista',
    'rel.atividade':   '📈 Actividad por día',
    'rel.top-rap':     '⚡ Muelles más rápidos — Top 3',
    'rel.top-len':     '🐢 Muelles más lentos — Top 3',
    'rel.ranking-c':   '🏅 Top 3 por tiempo promedio',
    'rel.comp':        '🏭 Reporte completo por muelle',
    'rel.rank-conf':   '🏆 Ranking de inspectores',
    'rel.rank-transp': '🚚 Ranking de transportistas',
    'rel.por-dia':     '📆 Actividad por día',
    'rel.whatsapp':    '💬 Enviar reporte por WhatsApp',
    'rel.resumo-btn':  '📤 Resumen rápido',
    'rel.comp-btn':    '📋 Reporte completo',
    'rel.exportar':    '📥 Exportar CSV',

    'ia.titulo':       '🤖 Análisis IA',
    'ia.insights':     'Insights Operacionales',
    'ia.analisar':     '▶ Analizar operación',
    'ia.hint':         'Haga clic en "Analizar operación" para generar insights automáticos del historial.',
    'ia.detalhe':      '📊 Análisis detallado',

    'cfg.apikey':      '🔑 API Key Anthropic (OCR + IA)',
    'cfg.apikey.hint': 'Necesaria para extracción de tablas y análisis IA. Solo en este navegador.',
    'cfg.tempo':       '⏱ Tiempo promedio objetivo (minutos)',
    'cfg.tempo.hint':  'Usado por el cronómetro para alertas de carga demorada.',
    'cfg.tmpl':        '✏️ Plantilla del Mensaje',
    'cfg.teste':       '🧪 Datos de Prueba',
    'cfg.teste.hint':  'Tabla real con 20 filas + equipos de prueba.',
    'cfg.storage':     '🗄️ Almacenamiento — Diagnóstico',
    'cfg.storage.hint':'IndexedDB activo desde la Fase 2. Datos migrados automáticamente.',
    'cfg.pref':        '🌐 Preferencias de la App',
    'cfg.pref.lang':   'Idioma',
    'cfg.pref.tema':   'Tema',

    'btn.salvar':      '💾 Guardar',
    'btn.cancelar':    'Cancelar',
    'btn.padrao':      '↩ Por defecto',
    'btn.verificar':   '🔍 Verificar almacenamiento',
    'btn.backup':      '💾 Respaldo JSON',
    'btn.exportar':    '📥 Exportar CSV',
    'btn.instalar':    '📲 Instalar App',
    'btn.eq-teste':    '↩ Equipos de prueba',
    'btn.tab-teste':   '↩ Tabla de prueba',
    'btn.nova-eq':     '+ Nuevo Equipo',

    'modal.eq.nova':   'Nuevo Equipo',
    'modal.eq.editar': 'Editar Equipo',
    'modal.envio.titulo': '📤 Enviar por WhatsApp',
    'modal.envio.enviar': '📤 Enviar foto + texto',
    'modal.envio.copiar': '📋 Solo copiar texto',
    'modal.envio.registrar': '✅ Registrar',

    'fila.titulo':     'Cola de OCs',
    'diag.click':      'Haga clic en Verificar para cargar...',
    'geral.ativo':     'Activo',
    'geral.inativo':   'Inactivo',
    'geral.minutos':   'Minutos',
    'geral.sem-aux':   'Sin auxiliares',
  },
};

/* ════════════════════════════════════════════════════════════
   MOTOR I18N
════════════════════════════════════════════════════════════ */

let _currentLang = 'pt-BR';

const i18n = {

  /**
   * Inicializa: detecta idioma salvo ou do navegador, aplica.
   */
  init() {
    const saved = localStorage.getItem(I18N_KEY);
    if (saved && TRANSLATIONS[saved]) {
      _currentLang = saved;
    } else {
      const nav = (navigator.language || '').toLowerCase();
      if (nav.startsWith('en'))      _currentLang = 'en';
      else if (nav.startsWith('es')) _currentLang = 'es';
      else                           _currentLang = 'pt-BR';
    }
    this._applyDOM();
  },

  /**
   * Retorna tradução de uma chave.
   * @param {string} key
   * @param {string} [fallback]
   * @returns {string}
   */
  t(key, fallback) {
    const dict = TRANSLATIONS[_currentLang] || TRANSLATIONS['pt-BR'];
    return dict[key] ?? TRANSLATIONS['pt-BR'][key] ?? fallback ?? key;
  },

  /**
   * Muda o idioma, persiste e re-aplica o DOM.
   * @param {string} lang — 'pt-BR' | 'en' | 'es'
   */
  set(lang) {
    if (!TRANSLATIONS[lang]) return;
    _currentLang = lang;
    localStorage.setItem(I18N_KEY, lang);
    this._applyDOM();
    const labels = { 'pt-BR': '🇧🇷 Português BR', 'en': '🇺🇸 English', 'es': '🇪🇸 Español' };
    if (typeof toast === 'function') toast(labels[lang] || lang);
  },

  /** Idioma atual */
  get lang() { return _currentLang; },

  /**
   * Aplica traduções em todos os elementos [data-i18n*].
   */
  _applyDOM() {
    // textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const val = this.t(el.getAttribute('data-i18n'));
      if (val) el.textContent = val;
    });
    // placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const val = this.t(el.getAttribute('data-i18n-placeholder'));
      if (val) el.placeholder = val;
    });
    // title (tooltip)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const val = this.t(el.getAttribute('data-i18n-title'));
      if (val) el.title = val;
    });

    // Atributo lang do HTML (acessibilidade + SEO)
    document.documentElement.lang = _currentLang;

    // Sincroniza o seletor de idioma
    const sel = document.getElementById('pref-lang');
    if (sel) sel.value = _currentLang;
  },
};
