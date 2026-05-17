// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Empresa Routes (Fase 12)
// ══════════════════════════════════════════════════════
// Rotas para gestão de empresas (multi-tenant)
// - Admin: pode ver/editar sua própria empresa
// - Superadmin: pode ver/criar/editar todas as empresas

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { query } = require('../database/connection');
const {
  authenticate,
  authorizeMin,
  isSuperAdmin,
  tenantScope
} = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

router.use(authenticate);

// ─────────────────────────────────────────────────────
// GET /api/empresas/me — dados da empresa atual
// ─────────────────────────────────────────────────────
router.get('/me', tenantScope, async (req, res, next) => {
  try {
    const { rows: [empresa] } = await query(`
      SELECT
        e.*,
        p.nome         AS plano_nome,
        p.max_usuarios,
        p.max_docas,
        p.max_cds,
        p.features     AS plano_features,
        COUNT(DISTINCT u.id)  FILTER (WHERE u.ativo = true)   AS usuarios_ativos,
        COUNT(DISTINCT d.id)  FILTER (WHERE d.ativo = true)   AS docas_ativas,
        COUNT(DISTINCT cd.id) FILTER (WHERE cd.ativo = true)  AS cds_ativos
      FROM empresas e
      LEFT JOIN planos p  ON p.slug = e.plano
      LEFT JOIN users  u  ON u.empresa_id = e.id
      LEFT JOIN docas  d  ON d.empresa_id = e.id
      LEFT JOIN centros_distribuicao cd ON cd.empresa_id = e.id
      WHERE e.id = $1
      GROUP BY e.id, p.nome, p.max_usuarios, p.max_docas, p.max_cds, p.features
    `, [req.empresaId]);

    if (!empresa) return res.status(404).json({ error: 'Company not found' });
    res.json({ empresa });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// PUT /api/empresas/me — atualizar dados da empresa (admin+)
// ─────────────────────────────────────────────────────
router.put('/me', tenantScope, authorizeMin('admin'), async (req, res, next) => {
  try {
    const { nome, cnpj, billing_email, config } = req.body;

    const { rows: [empresa] } = await query(`
      UPDATE empresas SET
        nome          = COALESCE($1, nome),
        cnpj          = COALESCE($2, cnpj),
        billing_email = COALESCE($3, billing_email),
        config        = COALESCE($4::jsonb, config),
        updated_at    = NOW()
      WHERE id = $5
      RETURNING id, nome, cnpj, slug, plano, ativo, billing_email, config
    `, [nome, cnpj, billing_email, config ? JSON.stringify(config) : null, req.empresaId]);

    res.json({ empresa });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════
// ROTAS SUPERADMIN — visão global
// ═════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────
// GET /api/empresas — listar todas as empresas (superadmin)
// ─────────────────────────────────────────────────────
router.get('/', isSuperAdmin, async (req, res, next) => {
  try {
    const { plano, ativo, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT
        e.id, e.nome, e.cnpj, e.slug, e.plano, e.ativo,
        e.billing_email, e.trial_ends_at, e.assinatura_ativa,
        e.created_at, e.updated_at,
        COUNT(DISTINCT u.id)   FILTER (WHERE u.ativo = true)  AS usuarios_ativos,
        COUNT(DISTINCT d.id)   FILTER (WHERE d.ativo = true)  AS docas_ativas,
        COUNT(DISTINCT cd.id)  FILTER (WHERE cd.ativo = true) AS cds_ativos,
        COUNT(DISTINCT o.id)   FILTER (WHERE o.created_at > NOW() - INTERVAL '30d') AS ops_30d
      FROM empresas e
      LEFT JOIN users  u  ON u.empresa_id = e.id
      LEFT JOIN docas  d  ON d.empresa_id = e.id
      LEFT JOIN centros_distribuicao cd ON cd.empresa_id = e.id
      LEFT JOIN operacoes o ON o.empresa_id = e.id
      WHERE e.slug != 'dockcheck-system'
    `;
    const params = [];

    if (plano) {
      params.push(plano);
      sql += ` AND e.plano = $${params.length}`;
    }
    if (ativo !== undefined) {
      params.push(ativo === 'true');
      sql += ` AND e.ativo = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (e.nome ILIKE $${params.length} OR e.cnpj ILIKE $${params.length} OR e.slug ILIKE $${params.length})`;
    }

    sql += ` GROUP BY e.id ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const { rows: empresas } = await query(sql, params);

    // total count
    const { rows: [{ count }] } = await query(`
      SELECT COUNT(*) FROM empresas WHERE slug != 'dockcheck-system'
    `);

    res.json({
      empresas,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(count) / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /api/empresas/global-stats — stats consolidadas (superadmin)
// ─────────────────────────────────────────────────────
router.get('/global-stats', isSuperAdmin, async (req, res, next) => {
  try {
    const [stats, porPlano, crescimento] = await Promise.all([
      // Stats globais
      query(`
        SELECT
          COUNT(DISTINCT e.id)                                           AS total_empresas,
          COUNT(DISTINCT e.id) FILTER (WHERE e.ativo = true)            AS empresas_ativas,
          COUNT(DISTINCT u.id) FILTER (WHERE u.ativo = true)            AS total_usuarios,
          COUNT(DISTINCT d.id) FILTER (WHERE d.ativo = true)            AS total_docas,
          COUNT(DISTINCT cd.id) FILTER (WHERE cd.ativo = true)          AS total_cds,
          COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '24h') AS ops_hoje,
          COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '30d') AS ops_30d,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'em_andamento') AS ops_ativas_agora
        FROM empresas e
        LEFT JOIN users  u  ON u.empresa_id = e.id
        LEFT JOIN docas  d  ON d.empresa_id = e.id
        LEFT JOIN centros_distribuicao cd ON cd.empresa_id = e.id
        LEFT JOIN operacoes o ON o.empresa_id = e.id
        WHERE e.slug != 'dockcheck-system'
      `),

      // Por plano
      query(`
        SELECT
          plano,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE ativo = true) AS ativas
        FROM empresas
        WHERE slug != 'dockcheck-system'
        GROUP BY plano
        ORDER BY plano
      `),

      // Crescimento últimos 30 dias
      query(`
        SELECT
          DATE(created_at) AS dia,
          COUNT(*)          AS novas_empresas
        FROM empresas
        WHERE created_at > NOW() - INTERVAL '30 days'
          AND slug != 'dockcheck-system'
        GROUP BY dia
        ORDER BY dia ASC
      `)
    ]);

    res.json({
      stats: stats.rows[0],
      por_plano: porPlano.rows,
      crescimento: crescimento.rows
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /api/empresas — criar nova empresa (superadmin)
// ─────────────────────────────────────────────────────
router.post('/', isSuperAdmin, async (req, res, next) => {
  try {
    const {
      nome, cnpj, slug, plano = 'basic',
      billing_email, trial_dias = 14,
      admin_nome, admin_email, admin_senha
    } = req.body;

    if (!nome || !slug || !admin_nome || !admin_email || !admin_senha) {
      return res.status(400).json({
        error: 'nome, slug, admin_nome, admin_email, admin_senha are required'
      });
    }

    // Transaction: empresa + admin user
    const client = await require('../database/connection').pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [empresa] } = await client.query(`
        INSERT INTO empresas (nome, cnpj, slug, plano, billing_email, trial_ends_at, assinatura_ativa)
        VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${parseInt(trial_dias)} days', true)
        RETURNING *
      `, [nome, cnpj || null, slug, plano, billing_email || null]);

      const senhaHash = await bcrypt.hash(admin_senha, 12);
      const { rows: [adminUser] } = await client.query(`
        INSERT INTO users (empresa_id, nome, email, senha_hash, role)
        VALUES ($1, $2, $3, $4, 'admin')
        RETURNING id, nome, email, role
      `, [empresa.id, admin_nome, admin_email, senhaHash]);

      await client.query('COMMIT');

      // Audit log
      await query(`
        INSERT INTO system_audit_logs (superadmin_id, empresa_id, acao, entidade, entidade_id, descricao, dados)
        VALUES ($1, $2, 'empresa_criada', 'empresa', $3, $4, $5)
      `, [
        req.user.id, empresa.id, empresa.id,
        `Empresa "${nome}" criada com plano ${plano}`,
        JSON.stringify({ empresa_id: empresa.id, admin_email })
      ]);

      logger.info(`[SUPERADMIN] Empresa created: ${slug} by ${req.user.email}`);
      res.status(201).json({ empresa, admin: adminUser });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug or CNPJ already exists' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// PUT /api/empresas/:id — editar empresa (superadmin)
// ─────────────────────────────────────────────────────
router.put('/:id', isSuperAdmin, async (req, res, next) => {
  try {
    const { nome, cnpj, plano, ativo, billing_email, assinatura_ativa, config } = req.body;

    const { rows: [empresa] } = await query(`
      UPDATE empresas SET
        nome              = COALESCE($1, nome),
        cnpj              = COALESCE($2, cnpj),
        plano             = COALESCE($3, plano),
        ativo             = COALESCE($4, ativo),
        billing_email     = COALESCE($5, billing_email),
        assinatura_ativa  = COALESCE($6, assinatura_ativa),
        config            = COALESCE($7::jsonb, config),
        updated_at        = NOW()
      WHERE id = $8 AND slug != 'dockcheck-system'
      RETURNING *
    `, [nome, cnpj, plano, ativo, billing_email, assinatura_ativa,
        config ? JSON.stringify(config) : null, req.params.id]);

    if (!empresa) return res.status(404).json({ error: 'Company not found' });

    await query(`
      INSERT INTO system_audit_logs (superadmin_id, empresa_id, acao, entidade, entidade_id, descricao, dados)
      VALUES ($1, $2, 'empresa_atualizada', 'empresa', $3, $4, $5)
    `, [req.user.id, req.params.id, req.params.id,
        `Empresa atualizada por superadmin`, JSON.stringify(req.body)]);

    res.json({ empresa });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /api/empresas/:id/overview — overview completo (superadmin)
// ─────────────────────────────────────────────────────
router.get('/:id/overview', isSuperAdmin, async (req, res, next) => {
  try {
    const [empresa, cds, usuarios, opsRecentes] = await Promise.all([
      query(`SELECT e.*, p.features AS plano_features
             FROM empresas e LEFT JOIN planos p ON p.slug = e.plano
             WHERE e.id = $1`, [req.params.id]),

      query(`SELECT * FROM centros_distribuicao WHERE empresa_id = $1 ORDER BY nome`, [req.params.id]),

      query(`SELECT id, nome, email, role, ativo, ultimo_login
             FROM users WHERE empresa_id = $1 ORDER BY role, nome`, [req.params.id]),

      query(`SELECT id, numero_oc, status, tipo_operacao, created_at
             FROM operacoes WHERE empresa_id = $1
             ORDER BY created_at DESC LIMIT 10`, [req.params.id])
    ]);

    if (!empresa.rows.length) return res.status(404).json({ error: 'Company not found' });

    res.json({
      empresa: empresa.rows[0],
      cds: cds.rows,
      usuarios: usuarios.rows,
      ops_recentes: opsRecentes.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
