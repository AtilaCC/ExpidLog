// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Superadmin Routes (Fase 12)
// ══════════════════════════════════════════════════════
// Dashboard global, analytics consolidados, auditoria
// Acesso exclusivo: role = 'superadmin'

const router = require('express').Router();
const { query } = require('../database/connection');
const { authenticate, isSuperAdmin } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

router.use(authenticate, isSuperAdmin);

// ─────────────────────────────────────────────────────
// GET /api/superadmin/dashboard — visão global da plataforma
// ─────────────────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const { periodo = '7d' } = req.query;
    const intervalMap = { '1d': '1 day', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[periodo] || '7 days';

    const [plataforma, topEmpresas, alertas, crescimento, slaGlobal] = await Promise.all([

      // Stats globais da plataforma
      query(`
        SELECT
          COUNT(DISTINCT e.id) FILTER (WHERE e.ativo = true AND e.slug != 'dockcheck-system') AS empresas_ativas,
          COUNT(DISTINCT u.id) FILTER (WHERE u.ativo = true)     AS usuarios_ativos,
          COUNT(DISTINCT cd.id) FILTER (WHERE cd.ativo = true)   AS cds_ativos,
          COUNT(DISTINCT d.id)  FILTER (WHERE d.ativo = true)    AS docas_ativas,
          COUNT(DISTINCT o.id)  FILTER (WHERE o.status = 'em_andamento') AS ops_agora,
          COUNT(DISTINCT o.id)  FILTER (WHERE o.created_at > NOW() - INTERVAL '${interval}') AS ops_periodo,
          COUNT(DISTINCT o.id)  FILTER (WHERE o.status = 'finalizada' AND o.created_at > NOW() - INTERVAL '${interval}') AS ops_finalizadas,
          SUM(o.volumes_conferidos) FILTER (WHERE o.created_at > NOW() - INTERVAL '${interval}') AS volumes_periodo,
          ROUND(AVG(
            EXTRACT(EPOCH FROM (o.fim_real - o.inicio_real)) / 60
          ) FILTER (WHERE o.fim_real IS NOT NULL AND o.inicio_real IS NOT NULL
                    AND o.created_at > NOW() - INTERVAL '${interval}'), 1) AS tempo_medio_min_global
        FROM empresas e
        LEFT JOIN users  u  ON u.empresa_id = e.id
        LEFT JOIN centros_distribuicao cd ON cd.empresa_id = e.id
        LEFT JOIN docas  d  ON d.empresa_id = e.id
        LEFT JOIN operacoes o ON o.empresa_id = e.id
        WHERE e.slug != 'dockcheck-system'
      `),

      // Top 10 empresas por operações
      query(`
        SELECT
          e.id, e.nome, e.slug, e.plano,
          COUNT(o.id) AS ops_periodo,
          COUNT(o.id) FILTER (WHERE o.status = 'finalizada') AS finalizadas,
          COUNT(DISTINCT cd.id) AS cds,
          ROUND(AVG(
            EXTRACT(EPOCH FROM (o.fim_real - o.inicio_real)) / 60
          ) FILTER (WHERE o.fim_real IS NOT NULL), 1) AS tempo_medio_min
        FROM empresas e
        LEFT JOIN operacoes o ON o.empresa_id = e.id AND o.created_at > NOW() - INTERVAL '${interval}'
        LEFT JOIN centros_distribuicao cd ON cd.empresa_id = e.id AND cd.ativo = true
        WHERE e.ativo = true AND e.slug != 'dockcheck-system'
        GROUP BY e.id
        ORDER BY ops_periodo DESC
        LIMIT 10
      `),

      // Alertas globais (empresas com problemas)
      query(`
        SELECT
          e.id AS empresa_id,
          e.nome AS empresa_nome,
          e.plano,
          'trial_expirando' AS tipo_alerta,
          e.trial_ends_at   AS detalhe
        FROM empresas e
        WHERE e.trial_ends_at IS NOT NULL
          AND e.trial_ends_at < NOW() + INTERVAL '3 days'
          AND e.trial_ends_at > NOW()
          AND e.slug != 'dockcheck-system'
        UNION ALL
        SELECT
          e.id,
          e.nome,
          e.plano,
          'sem_operacoes_7d',
          NULL
        FROM empresas e
        WHERE e.ativo = true
          AND e.slug != 'dockcheck-system'
          AND NOT EXISTS (
            SELECT 1 FROM operacoes o
            WHERE o.empresa_id = e.id AND o.created_at > NOW() - INTERVAL '7 days'
          )
        ORDER BY tipo_alerta, empresa_nome
        LIMIT 20
      `),

      // Crescimento diário de operações
      query(`
        SELECT
          DATE(o.created_at)  AS dia,
          COUNT(*)             AS total_ops,
          COUNT(DISTINCT o.empresa_id) AS empresas_ativas
        FROM operacoes o
        JOIN empresas e ON e.id = o.empresa_id
        WHERE o.created_at > NOW() - INTERVAL '${interval}'
          AND e.slug != 'dockcheck-system'
        GROUP BY dia
        ORDER BY dia ASC
      `),

      // SLA global por empresa
      query(`
        SELECT
          e.nome,
          e.plano,
          COUNT(o.id)   AS total,
          ROUND(
            100.0 * COUNT(o.id) FILTER (WHERE o.status = 'finalizada') /
            NULLIF(COUNT(o.id), 0), 1
          ) AS taxa_conclusao,
          ROUND(AVG(
            EXTRACT(EPOCH FROM (o.fim_real - o.inicio_real)) / 60
          ) FILTER (WHERE o.fim_real IS NOT NULL), 1) AS tempo_medio_min
        FROM empresas e
        LEFT JOIN operacoes o ON o.empresa_id = e.id
          AND o.created_at > NOW() - INTERVAL '${interval}'
        WHERE e.ativo = true AND e.slug != 'dockcheck-system'
        GROUP BY e.id
        HAVING COUNT(o.id) > 0
        ORDER BY taxa_conclusao DESC
        LIMIT 20
      `)
    ]);

    res.json({
      periodo,
      plataforma: plataforma.rows[0],
      top_empresas: topEmpresas.rows,
      alertas: alertas.rows,
      crescimento: crescimento.rows,
      sla_por_empresa: slaGlobal.rows
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /api/superadmin/comparativo-cds — ranking global de CDs
// ─────────────────────────────────────────────────────
router.get('/comparativo-cds', async (req, res, next) => {
  try {
    const { periodo = '7d' } = req.query;
    const intervalMap = { '1d': '1 day', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[periodo] || '7 days';

    const { rows } = await query(`
      SELECT
        cd.id,
        cd.nome                    AS cd_nome,
        cd.codigo                  AS cd_codigo,
        cd.cidade,
        cd.estado,
        e.nome                     AS empresa_nome,
        e.plano                    AS empresa_plano,
        COUNT(DISTINCT d.id) FILTER (WHERE d.ativo = true)            AS docas_ativas,
        COUNT(o.id)                                                    AS total_ops,
        COUNT(o.id) FILTER (WHERE o.status = 'finalizada')            AS ops_finalizadas,
        COUNT(o.id) FILTER (WHERE o.status = 'em_andamento')          AS ops_ativas,
        SUM(o.volumes_conferidos)                                      AS volumes_totais,
        ROUND(
          100.0 * COUNT(o.id) FILTER (WHERE o.status = 'finalizada') /
          NULLIF(COUNT(o.id), 0), 1
        )                                                              AS taxa_conclusao,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (o.fim_real - o.inicio_real)) / 60
        ) FILTER (WHERE o.fim_real IS NOT NULL AND o.inicio_real IS NOT NULL), 1) AS tempo_medio_min,
        -- Score composto 0-100
        ROUND(
          (
            COALESCE(
              100.0 * COUNT(o.id) FILTER (WHERE o.status = 'finalizada') /
              NULLIF(COUNT(o.id), 0), 0
            ) * 0.5 +
            LEAST(100, COALESCE(COUNT(o.id)::float / 5, 0)) * 0.3 +
            GREATEST(0, 100 - COALESCE(AVG(
              EXTRACT(EPOCH FROM (o.fim_real - o.inicio_real)) / 60
            ) FILTER (WHERE o.fim_real IS NOT NULL), 120) / 2) * 0.2
          ), 1
        )                                                              AS score_cd
      FROM centros_distribuicao cd
      JOIN empresas e ON e.id = cd.empresa_id
      LEFT JOIN docas d ON d.cd_id = cd.id
      LEFT JOIN operacoes o ON o.cd_id = cd.id
        AND o.created_at > NOW() - INTERVAL '${interval}'
      WHERE cd.ativo = true AND e.slug != 'dockcheck-system'
      GROUP BY cd.id, e.nome, e.plano
      ORDER BY score_cd DESC
    `);

    res.json({
      periodo,
      cds: rows,
      total: rows.length
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /api/superadmin/audit-logs — logs globais de auditoria
// ─────────────────────────────────────────────────────
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, empresa_id, acao } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT
        sal.*,
        u.nome  AS superadmin_nome,
        u.email AS superadmin_email,
        e.nome  AS empresa_nome
      FROM system_audit_logs sal
      LEFT JOIN users    u ON u.id = sal.superadmin_id
      LEFT JOIN empresas e ON e.id = sal.empresa_id
      WHERE 1=1
    `;
    const params = [];

    if (empresa_id) {
      params.push(empresa_id);
      sql += ` AND sal.empresa_id = $${params.length}`;
    }
    if (acao) {
      params.push(acao);
      sql += ` AND sal.acao = $${params.length}`;
    }

    sql += ` ORDER BY sal.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const { rows: logs } = await query(sql, params);
    res.json({ logs, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /api/superadmin/planos — listar planos disponíveis
// ─────────────────────────────────────────────────────
router.get('/planos', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        p.*,
        COUNT(e.id) FILTER (WHERE e.ativo = true) AS empresas_ativas
      FROM planos p
      LEFT JOIN empresas e ON e.plano = p.slug
      WHERE p.ativo = true
      GROUP BY p.id
      ORDER BY p.preco_mensal ASC
    `);
    res.json({ planos: rows });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /api/superadmin/empresas/:id/upgrade — upgrade de plano
// ─────────────────────────────────────────────────────
router.post('/empresas/:id/upgrade', async (req, res, next) => {
  try {
    const { plano } = req.body;
    if (!['basic', 'pro', 'enterprise'].includes(plano)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const { rows: [empresa] } = await query(`
      UPDATE empresas SET plano = $1, updated_at = NOW()
      WHERE id = $2 AND slug != 'dockcheck-system'
      RETURNING id, nome, plano
    `, [plano, req.params.id]);

    if (!empresa) return res.status(404).json({ error: 'Company not found' });

    await query(`
      INSERT INTO system_audit_logs (superadmin_id, empresa_id, acao, entidade, entidade_id, descricao, dados)
      VALUES ($1, $2, 'plano_alterado', 'empresa', $3, $4, $5)
    `, [req.user.id, req.params.id, req.params.id,
        `Plano alterado para ${plano}`, JSON.stringify({ plano_novo: plano })]);

    logger.info(`[SUPERADMIN] Plan upgraded: ${empresa.nome} → ${plano} by ${req.user.email}`);
    res.json({ empresa });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /api/superadmin/health — health completo da plataforma
// ─────────────────────────────────────────────────────
router.get('/health', async (req, res, next) => {
  try {
    const { rows: [db] } = await query(`
      SELECT
        COUNT(DISTINCT e.id)  AS empresas,
        COUNT(DISTINCT u.id)  AS usuarios,
        COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '1h') AS ops_ultima_hora,
        NOW() AS server_time
      FROM empresas e
      LEFT JOIN users u ON u.empresa_id = e.id
      LEFT JOIN operacoes o ON o.empresa_id = e.id
    `);

    res.json({
      status: 'healthy',
      database: db,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
