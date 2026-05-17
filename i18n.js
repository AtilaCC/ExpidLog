/* ════════════════════════════════════════════════════════════
   DOCKCHECK PRO — i18n · Sistema Multiidioma
   Fase 13 · Etapa Final

   Suporte: pt-BR (padrão), en-US, es
   Uso: t('chave') ou t('chave', { var: valor })
════════════════════════════════════════════════════════════ */

'use strict';

/* ── Idioma ativo ───────────────────────────────────────── */
let _lang = localStorage.getItem('dc_lang') || 'pt-BR';

/* ════════════════════════════════════════════════════════════
   TRADUÇÕES
════════════════════════════════════════════════════════════ */
const TRANSLATIONS = {

  /* ── Português Brasil ──────────────────────────────────── */
  'pt-BR': {
    // Nav
    nav_conferencia:  '📦 Conferência',
    nav_dashboard:    '🖥 Dashboard',
    nav_analytics:    '📈 Analytics',
    nav_cloud:        '📷 Ler Tabela',
    nav_equipes:      '👥 Equipes',
    nav_historico:    '🕐 Histórico',
    nav_relatorio:    '📊 Relatório',
    nav_bi:           '💼 BI',
    nav_ia:           '🤖 IA',
    nav_multicd:      '🏢 Multi-CD',
    nav_config:       '⚙️ Config',

    // Topbar / Geral
    btn_instalar:     'Instalar App',
    btn_salvar:       'Salvar',
    btn_cancelar:     'Cancelar',
    btn_confirmar:    'Confirmar',
    btn_fechar:       'Fechar',
    btn_editar:       'Editar',
    btn_excluir:      'Excluir',
    btn_novo:         'Novo',
    btn_exportar:     'Exportar',
    btn_atualizar:    'Atualizar',
    btn_limpar:       'Limpar',
    btn_iniciar:      'Iniciar',
    btn_pausar:       'Pausar',
    btn_finalizar:    'Finalizar',
    btn_registrar:    'Registrar',
    btn_conferir:     'Conferir',
    sem_dados:        'Nenhum dado encontrado',
    carregando:       'Carregando...',
    erro_generico:    'Ocorreu um erro. Tente novamente.',

    // Login
    login_titulo:     'Entrar no DockCheck PRO',
    login_email:      'E-mail',
    login_senha:      'Senha',
    login_btn:        'Entrar',
    login_erro:       'E-mail ou senha incorretos',
    login_bio:        'Entrar com biometria',
    login_saindo:     'Saindo...',
    logout:           'Sair',

    // Conferência
    conf_titulo:      'Conferência Operacional',
    conf_doca:        'Nº da Doca',
    conf_placa:       'Placa do Veículo',
    conf_transportadora: 'Transportadora',
    conf_tipo:        'Tipo de Operação',
    conf_obs:         'Observação',
    conf_iniciar:     'Iniciar Conferência',
    conf_finalizar:   'Finalizar Conferência',
    conf_em_andamento: 'Em andamento',
    conf_concluida:   'Concluída',
    conf_pendente:    'Pendente',

    // Fila
    fila_titulo:      'Fila de Veículos',
    fila_vazia:       'Nenhum veículo na fila',
    fila_entrada:     'Entrada',
    fila_saida:       'Saída',
    fila_aguardando:  'Aguardando',
    fila_posicao:     'Posição',

    // Dashboard
    dash_titulo:      'Dashboard Operacional',
    dash_docas_ativas: 'Docas Ativas',
    dash_veiculos:    'Veículos',
    dash_concluidas:  'Concluídas',
    dash_tempo_medio: 'Tempo Médio',
    dash_score:       'Score Operacional',
    dash_feed:        'Feed Operacional',
    dash_mapa:        'Mapa de Docas',
    dash_tv:          'Modo TV',

    // Analytics
    an_titulo:        'Analytics',
    an_periodo:       'Período',
    an_hoje:          'Hoje',
    an_semana:        'Semana',
    an_mes:           'Mês',
    an_insights:      'Insights',
    an_previsoes:     'Previsões',
    an_ranking_docas: 'Ranking de Docas',
    an_ranking_eq:    'Ranking de Equipes',
    an_gargalos:      'Gargalos',

    // Equipes
    eq_titulo:        'Gestão de Equipes',
    eq_nome:          'Nome da Equipe',
    eq_turno:         'Turno',
    eq_ativa:         'Ativa',
    eq_inativa:       'Inativa',
    eq_adicionar:     'Nova Equipe',

    // Histórico
    hist_titulo:      'Histórico',
    hist_busca:       'Buscar...',
    hist_filtro:      'Filtrar',
    hist_exportar:    'Exportar CSV',
    hist_vazio:       'Nenhum registro encontrado',

    // Relatório
    rel_titulo:       'Relatório',
    rel_gerar:        'Gerar Relatório',
    rel_periodo:      'Período',
    rel_tipo:         'Tipo',

    // IA
    ia_titulo:        'IA Operacional',
    ia_analisar:      'Analisar Operação',
    ia_pergunta:      'Faça uma pergunta...',
    ia_resposta:      'Resposta da IA',
    ia_processando:   'Processando...',

    // Config
    cfg_titulo:       'Configurações',
    cfg_preferencias: 'Preferências do Aplicativo',
    cfg_idioma:       '🌎 Idioma',
    cfg_tema:         '🎨 Tema',
    cfg_tema_escuro:  'Escuro',
    cfg_tema_claro:   'Claro',
    cfg_lang_pt:      'Português BR',
    cfg_lang_en:      'English',
    cfg_lang_es:      'Español',
    cfg_notificacoes: '🔔 Notificações Push',
    cfg_pwa:          '📱 Instalar App',
    cfg_dados:        '🗄 Dados',
    cfg_limpar_dados: 'Limpar Dados Locais',
    cfg_versao:       'Versão',
    cfg_salvo:        'Preferências salvas!',

    // Alertas / Toast
    toast_salvo:      'Salvo com sucesso!',
    toast_erro:       'Erro ao salvar.',
    toast_offline:    '📥 Salvo offline',
    toast_sync:       '✅ Sincronizado!',
    toast_copiado:    'Copiado!',

    // Status
    status_online:    'Online',
    status_offline:   'Offline',
    status_conectando: 'Conectando...',
    status_atualizado: 'Atualizado',
  },

  /* ── English ───────────────────────────────────────────── */
  'en-US': {
    nav_conferencia:  '📦 Check-in',
    nav_dashboard:    '🖥 Dashboard',
    nav_analytics:    '📈 Analytics',
    nav_cloud:        '📷 Scan Table',
    nav_equipes:      '👥 Teams',
    nav_historico:    '🕐 History',
    nav_relatorio:    '📊 Report',
    nav_bi:           '💼 BI',
    nav_ia:           '🤖 AI',
    nav_multicd:      '🏢 Multi-DC',
    nav_config:       '⚙️ Settings',

    btn_instalar:     'Install App',
    btn_salvar:       'Save',
    btn_cancelar:     'Cancel',
    btn_confirmar:    'Confirm',
    btn_fechar:       'Close',
    btn_editar:       'Edit',
    btn_excluir:      'Delete',
    btn_novo:         'New',
    btn_exportar:     'Export',
    btn_atualizar:    'Refresh',
    btn_limpar:       'Clear',
    btn_iniciar:      'Start',
    btn_pausar:       'Pause',
    btn_finalizar:    'Finish',
    btn_registrar:    'Register',
    btn_conferir:     'Check',
    sem_dados:        'No data found',
    carregando:       'Loading...',
    erro_generico:    'An error occurred. Please try again.',

    login_titulo:     'Sign in to DockCheck PRO',
    login_email:      'Email',
    login_senha:      'Password',
    login_btn:        'Sign In',
    login_erro:       'Incorrect email or password',
    login_bio:        'Sign in with biometrics',
    login_saindo:     'Signing out...',
    logout:           'Sign Out',

    conf_titulo:      'Dock Check-in',
    conf_doca:        'Dock Number',
    conf_placa:       'Vehicle Plate',
    conf_transportadora: 'Carrier',
    conf_tipo:        'Operation Type',
    conf_obs:         'Notes',
    conf_iniciar:     'Start Check-in',
    conf_finalizar:   'Finish Check-in',
    conf_em_andamento: 'In Progress',
    conf_concluida:   'Completed',
    conf_pendente:    'Pending',

    fila_titulo:      'Vehicle Queue',
    fila_vazia:       'No vehicles in queue',
    fila_entrada:     'Entry',
    fila_saida:       'Exit',
    fila_aguardando:  'Waiting',
    fila_posicao:     'Position',

    dash_titulo:      'Operational Dashboard',
    dash_docas_ativas: 'Active Docks',
    dash_veiculos:    'Vehicles',
    dash_concluidas:  'Completed',
    dash_tempo_medio: 'Avg. Time',
    dash_score:       'Operational Score',
    dash_feed:        'Operational Feed',
    dash_mapa:        'Dock Map',
    dash_tv:          'TV Mode',

    an_titulo:        'Analytics',
    an_periodo:       'Period',
    an_hoje:          'Today',
    an_semana:        'Week',
    an_mes:           'Month',
    an_insights:      'Insights',
    an_previsoes:     'Forecasts',
    an_ranking_docas: 'Dock Rankings',
    an_ranking_eq:    'Team Rankings',
    an_gargalos:      'Bottlenecks',

    eq_titulo:        'Team Management',
    eq_nome:          'Team Name',
    eq_turno:         'Shift',
    eq_ativa:         'Active',
    eq_inativa:       'Inactive',
    eq_adicionar:     'New Team',

    hist_titulo:      'History',
    hist_busca:       'Search...',
    hist_filtro:      'Filter',
    hist_exportar:    'Export CSV',
    hist_vazio:       'No records found',

    rel_titulo:       'Report',
    rel_gerar:        'Generate Report',
    rel_periodo:      'Period',
    rel_tipo:         'Type',

    ia_titulo:        'Operational AI',
    ia_analisar:      'Analyze Operation',
    ia_pergunta:      'Ask a question...',
    ia_resposta:      'AI Response',
    ia_processando:   'Processing...',

    cfg_titulo:       'Settings',
    cfg_preferencias: 'App Preferences',
    cfg_idioma:       '🌎 Language',
    cfg_tema:         '🎨 Theme',
    cfg_tema_escuro:  'Dark',
    cfg_tema_claro:   'Light',
    cfg_lang_pt:      'Português BR',
    cfg_lang_en:      'English',
    cfg_lang_es:      'Español',
    cfg_notificacoes: '🔔 Push Notifications',
    cfg_pwa:          '📱 Install App',
    cfg_dados:        '🗄 Data',
    cfg_limpar_dados: 'Clear Local Data',
    cfg_versao:       'Version',
    cfg_salvo:        'Preferences saved!',

    toast_salvo:      'Saved successfully!',
    toast_erro:       'Error saving.',
    toast_offline:    '📥 Saved offline',
    toast_sync:       '✅ Synced!',
    toast_copiado:    'Copied!',

    status_online:    'Online',
    status_offline:   'Offline',
    status_conectando: 'Connecting...',
    status_atualizado: 'Updated',
  },

  /* ── Español ───────────────────────────────────────────── */
  'es': {
    nav_conferencia:  '📦 Conferencia',
    nav_dashboard:    '🖥 Dashboard',
    nav_analytics:    '📈 Analítica',
    nav_cloud:        '📷 Escanear',
    nav_equipes:      '👥 Equipos',
    nav_historico:    '🕐 Historial',
    nav_relatorio:    '📊 Reporte',
    nav_bi:           '💼 BI',
    nav_ia:           '🤖 IA',
    nav_multicd:      '🏢 Multi-CD',
    nav_config:       '⚙️ Ajustes',

    btn_instalar:     'Instalar App',
    btn_salvar:       'Guardar',
    btn_cancelar:     'Cancelar',
    btn_confirmar:    'Confirmar',
    btn_fechar:       'Cerrar',
    btn_editar:       'Editar',
    btn_excluir:      'Eliminar',
    btn_novo:         'Nuevo',
    btn_exportar:     'Exportar',
    btn_atualizar:    'Actualizar',
    btn_limpar:       'Limpiar',
    btn_iniciar:      'Iniciar',
    btn_pausar:       'Pausar',
    btn_finalizar:    'Finalizar',
    btn_registrar:    'Registrar',
    btn_conferir:     'Verificar',
    sem_dados:        'No se encontraron datos',
    carregando:       'Cargando...',
    erro_generico:    'Ocurrió un error. Inténtelo de nuevo.',

    login_titulo:     'Iniciar sesión en DockCheck PRO',
    login_email:      'Correo electrónico',
    login_senha:      'Contraseña',
    login_btn:        'Entrar',
    login_erro:       'Correo o contraseña incorrectos',
    login_bio:        'Entrar con biometría',
    login_saindo:     'Cerrando sesión...',
    logout:           'Cerrar sesión',

    conf_titulo:      'Conferencia Operacional',
    conf_doca:        'Número de Muelle',
    conf_placa:       'Placa del Vehículo',
    conf_transportadora: 'Transportista',
    conf_tipo:        'Tipo de Operación',
    conf_obs:         'Observación',
    conf_iniciar:     'Iniciar Conferencia',
    conf_finalizar:   'Finalizar Conferencia',
    conf_em_andamento: 'En progreso',
    conf_concluida:   'Completada',
    conf_pendente:    'Pendiente',

    fila_titulo:      'Cola de Vehículos',
    fila_vazia:       'No hay vehículos en cola',
    fila_entrada:     'Entrada',
    fila_saida:       'Salida',
    fila_aguardando:  'Esperando',
    fila_posicao:     'Posición',

    dash_titulo:      'Panel Operacional',
    dash_docas_ativas: 'Muelles Activos',
    dash_veiculos:    'Vehículos',
    dash_concluidas:  'Completadas',
    dash_tempo_medio: 'Tiempo Promedio',
    dash_score:       'Puntuación Operacional',
    dash_feed:        'Feed Operacional',
    dash_mapa:        'Mapa de Muelles',
    dash_tv:          'Modo TV',

    an_titulo:        'Analítica',
    an_periodo:       'Período',
    an_hoje:          'Hoy',
    an_semana:        'Semana',
    an_mes:           'Mes',
    an_insights:      'Perspectivas',
    an_previsoes:     'Pronósticos',
    an_ranking_docas: 'Ranking de Muelles',
    an_ranking_eq:    'Ranking de Equipos',
    an_gargalos:      'Cuellos de Botella',

    eq_titulo:        'Gestión de Equipos',
    eq_nome:          'Nombre del Equipo',
    eq_turno:         'Turno',
    eq_ativa:         'Activo',
    eq_inativa:       'Inactivo',
    eq_adicionar:     'Nuevo Equipo',

    hist_titulo:      'Historial',
    hist_busca:       'Buscar...',
    hist_filtro:      'Filtrar',
    hist_exportar:    'Exportar CSV',
    hist_vazio:       'No se encontraron registros',

    rel_titulo:       'Reporte',
    rel_gerar:        'Generar Reporte',
    rel_periodo:      'Período',
    rel_tipo:         'Tipo',

    ia_titulo:        'IA Operacional',
    ia_analisar:      'Analizar Operación',
    ia_pergunta:      'Haga una pregunta...',
    ia_resposta:      'Respuesta de la IA',
    ia_processando:   'Procesando...',

    cfg_titulo:       'Ajustes',
    cfg_preferencias: 'Preferencias de la Aplicación',
    cfg_idioma:       '🌎 Idioma',
    cfg_tema:         '🎨 Tema',
    cfg_tema_escuro:  'Oscuro',
    cfg_tema_claro:   'Claro',
    cfg_lang_pt:      'Português BR',
    cfg_lang_en:      'English',
    cfg_lang_es:      'Español',
    cfg_notificacoes: '🔔 Notificaciones Push',
    cfg_pwa:          '📱 Instalar App',
    cfg_dados:        '🗄 Datos',
    cfg_limpar_dados: 'Limpiar Datos Locales',
    cfg_versao:       'Versión',
    cfg_salvo:        '¡Preferencias guardadas!',

    toast_salvo:      '¡Guardado correctamente!',
    toast_erro:       'Error al guardar.',
    toast_offline:    '📥 Guardado sin conexión',
    toast_sync:       '✅ ¡Sincronizado!',
    toast_copiado:    '¡Copiado!',

    status_online:    'En línea',
    status_offline:   'Sin conexión',
    status_conectando: 'Conectando...',
    status_atualizado: 'Actualizado',
  },
};

/* ════════════════════════════════════════════════════════════
   ENGINE DE TRADUÇÃO
════════════════════════════════════════════════════════════ */

/**
 * Traduz uma chave para o idioma ativo.
 * @param {string} key
 * @param {object} vars — substituições: t('ola_X', {X: 'mundo'}) → 'Olá mundo'
 * @returns {string}
 */
function t(key, vars) {
  const dict = TRANSLATIONS[_lang] || TRANSLATIONS['pt-BR'];
  let str = dict[key] || TRANSLATIONS['pt-BR'][key] || key;

  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`{${k}}`, 'g'), v);
    });
  }
  return str;
}

/**
 * Retorna o idioma ativo.
 */
function getLang() { return _lang; }

/**
 * Muda o idioma e atualiza a UI.
 * @param {string} lang — 'pt-BR' | 'en-US' | 'es'
 */
function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  _lang = lang;
  localStorage.setItem('dc_lang', lang);
  document.documentElement.lang = lang;
  _aplicarTraducoes();
  if (typeof toast === 'function') toast(t('cfg_salvo'));
}

/**
 * Aplica traduções em todos os elementos com data-i18n.
 * Suporte a: data-i18n="chave" (textContent)
 *            data-i18n-ph="chave" (placeholder)
 *            data-i18n-title="chave" (title)
 */
function _aplicarTraducoes() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });

  // Atualiza botões da nav
  const navMap = {
    'conferencia': 'nav_conferencia',
    'dashboard':   'nav_dashboard',
    'analytics':   'nav_analytics',
    'cloud':       'nav_cloud',
    'equipes':     'nav_equipes',
    'historico':   'nav_historico',
    'relatorio':   'nav_relatorio',
    'bi':          'nav_bi',
    'ia':          'nav_ia',
    'multicd':     'nav_multicd',
    'config':      'nav_config',
  };
  document.querySelectorAll('.ntab').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    const match   = onclick.match(/'([a-z]+)'/);
    if (match && navMap[match[1]]) {
      btn.textContent = t(navMap[match[1]]);
    }
  });
}

/* ── Auto-aplicar ao carregar ───────────────────────────── */
document.documentElement.lang = _lang;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _aplicarTraducoes);
} else {
  _aplicarTraducoes();
}

window.t       = t;
window.getLang = getLang;
window.setLang = setLang;
