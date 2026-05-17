// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Analytics Service
// ══════════════════════════════════════════════════════

const { query } = require('../database/connection');

async function dashboard(empresaId) {
  const [kpis, docasStatus, operacoesRecentes, ranking, producaoHora] = await Promise.all([
    getKPIs(empresaId),
    getDocasStatus(empresaId),
    getOperacoesRecentes(empresaId),
    getRankingConferentes(empresaId),
    getProducaoPorHora(empresaId),
  ]);

  return { kpis, docasStatus, operacoesRecentes, ranking, producaoHora };
}

async function getKPIs(empresaId) {
  const { rows: [r] } = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'em_andamento')                       AS docas_em_operacao,
      COUNT(*) FILTER (WHERE status = 'livre')                              AS docas_livres,
      COUNT(*) FILTER (WHERE status IN ('bloqueada','manutencao'))          AS docas_paradas,

      (SELECT COUNT(*) FROM operacoes WHERE empresa_id = $1
        AND status = 'finalizada'
        AND DATE(fim_real) = CURRENT_DATE)                                  AS ocs_finalizadas_hoje,

      (SELECT COUNT(*) FROM operacoes WHERE empresa_id = $1
        AND status = 'em_andamento')                                        AS operacoes_ativas,

      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fim_real - inicio_real))/60), 1)
       FROM operacoes
       WHERE empresa_id = $1 AND status = 'finalizada'
         AND fim_real >= NOW() - INTERVAL '7 days')                        AS tempo_medio_minutos,

      (SELECT COUNT(*) FROM operacoes WHERE empresa_id = $1
        AND status = 'em_andamento'
        AND fim_previsto < NOW())                                           AS operacoes_atrasadas,

      (SELECT COUNT(*) FROM operacoes WHERE empresa_id = $1
        AND DATE(created_at) = CURRENT_DATE)                               AS operacoes_hoje

    FROM docas WHERE empresa_id = $1 AND ativo = true
  `, [empresaId]);

  return r;
}

async function getDocasStatus(empresaId) {
  const { rows } = await query(`
    SELECT
      d.id, d.numero, d.descricao, d.tipo, d.status,
      o.id         AS operacao_id,
      o.numero_oc,
      o.tipo_operacao,
      o.inicio_real,
      o.volumes_previstos,
      o.volumes_conferidos,
      CASE WHEN o.volumes_previstos > 0
           THEN ROUND(o.volumes_conferidos::numeric / o.volumes_previstos * 100, 1)
           ELSE 0 END AS progresso,
      EXTRACT(EPOCH FROM (NOW() - o.inicio_real))/60 AS tempo_decorrido_min,
      u.nome AS conferente_nome
    FROM docas d
    LEFT JOIN operacoes o ON o.doca_id = d.id AND o.status = 'em_andamento'
    LEFT JOIN users u ON u.id = o.conferente_id
    WHERE d.empresa_id = $1 AND d.ativo = true
    ORDER BY d.numero
  `, [empresaId]);
  return rows;
}

async function getOperacoesRecentes(empresaId, limit = 20) {
  const { rows } = await query(`
    SELECT
      o.id, o.numero_oc, o.status, o.tipo_operacao,
      o.transportadora, o.volumes_previstos, o.volumes_conferidos,
      o.inicio_real, o.fim_real, o.created_at,
      d.numero AS doca_numero,
      u.nome   AS conferente_nome
    FROM operacoes o
    JOIN  docas d ON d.id = o.doca_id
    LEFT JOIN users u ON u.id = o.conferente_id
    WHERE o.empresa_id = $1
    ORDER BY o.created_at DESC
    LIMIT $2
  `, [empresaId, limit]);
  return rows;
}

async function getRankingConferentes(empresaId, dias = 30) {
  const { rows } = await query(`
    SELECT
      u.id, u.nome,
      COUNT(o.id)                                             AS total_operacoes,
      COUNT(o.id) FILTER (WHERE o.status = 'finalizada')     AS finalizadas,
      SUM(o.volumes_conferidos)                               AS total_volumes,
      ROUND(AVG(EXTRACT(EPOCH FROM (o.fim_real - o.inicio_real))/60) FILTER (
        WHERE o.status = 'finalizada'), 1)                    AS tempo_medio_min
    FROM users u
    LEFT JOIN operacoes o ON o.conferente_id = u.id
      AND o.empresa_id = $1
      AND o.created_at >= NOW() - ($2 || ' days')::INTERVAL
    WHERE u.empresa_id = $1 AND u.role = 'conferente' AND u.ativo = true
    GROUP BY u.id, u.nome
    ORDER BY finalizadas DESC, total_volumes DESC
    LIMIT 10
  `, [empresaId, dias]);
  return rows;
}

async function getProducaoPorHora(empresaId) {
  const { rows } = await query(`
    SELECT
      DATE_TRUNC('hour', inicio_real) AS hora,
      COUNT(*)                         AS operacoes_iniciadas,
      SUM(volumes_conferidos)          AS volumes_conferidos
    FROM operacoes
    WHERE empresa_id = $1
      AND inicio_real >= NOW() - INTERVAL '24 hours'
    GROUP BY hora
    ORDER BY hora
  `, [empresaId]);
  return rows;
}

async function getRelatorioTempo(empresaId, filtros = {}) {
  const { data_inicio, data_fim, doca_id } = filtros;
  const conditions = ['o.empresa_id = $1'];
  const params = [empresaId];

  if (data_inicio) { params.push(data_inicio); conditions.push(`o.inicio_real >= $${params.length}`); }
  if (data_fim)    { params.push(data_fim);    conditions.push(`o.inicio_real <= $${params.length}`); }
  if (doca_id)     { params.push(doca_id);     conditions.push(`o.doca_id = $${params.length}`); }

  const { rows } = await query(`
    SELECT
      DATE(o.inicio_real)                                              AS data,
      COUNT(*)                                                         AS total,
      COUNT(*) FILTER (WHERE o.status = 'finalizada')                 AS finalizadas,
      COUNT(*) FILTER (WHERE o.status = 'cancelada')                  AS canceladas,
      ROUND(AVG(EXTRACT(EPOCH FROM (o.fim_real - o.inicio_real))/60)
        FILTER (WHERE o.status = 'finalizada'), 1)                     AS tempo_medio_min,
      SUM(o.volumes_conferidos)                                        AS volumes_totais
    FROM operacoes o
    WHERE ${conditions.join(' AND ')}
    GROUP BY DATE(o.inicio_real)
    ORDER BY data DESC
    LIMIT 30
  `, params);
  return rows;
}

module.exports = { dashboard, getKPIs, getDocasStatus, getOperacoesRecentes, getRankingConferentes, getRelatorioTempo };
