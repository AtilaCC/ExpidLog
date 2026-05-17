// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Centros de Distribuição Routes (Fase 12)
// ══════════════════════════════════════════════════════

const router = require('express').Router();
const { query } = require('../database/connection');
const { authenticate, authorizeMin, tenantScope } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// Todos os endpoints exigem auth + tenant
router.use(authenticate, tenantScope);

// ─────────────────────────────────────────────────────
// GET /api/cds — listar CDs da empresa
// ─────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { ativo } = req.query;

    let sql = `
      SELECT
        cd.*,
        COUNT(DISTINCT d.id)  FILTER (WHERE d.ativo = true)          AS total_docas,
        COUNT(DISTINCT d.id)  FILTER (WHERE d.status = 'em_operacao') AS docas_em_operacao,
        COUNT(DISTINCT o.id)  FILTER (WHERE o.status = 'em_andamento') AS operacoes_ativas,
        COUNT(DISTINCT u.id)  FILTER (WHERE u.ativo = true)           AS total_usuarios
      FROM centros_distribuicao cd
      LEFT JOIN docas d    ON d.cd_id = cd.id
      LEFT JOIN operacoes o ON o.cd_id = cd.id AND o.created_at > NOW() - INTERVAL '24h'
      LEFT JOIN users u    ON u.empresa_id = cd.empresa_id
      WHERE cd.empresa_id = $1
    `;
    const params = [req.empresaId];

    if (ativo !== undefined) {
      sql += ` AND cd.ativo = $${params.length + 1}`;
      params.push(ativo === 'true');
    }

    sql += ' GROUP BY cd.id ORDER BY cd.nome ASC';

    const { rows } = await query(sql, params);
    res.json({ cds: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /api/cds/:id — detalhe de um CD
// ─────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        cd.*,
        json_agg(
          json_build_object(
            'id', d.id, 'numero', d.numero, 'descricao', d.descricao,
            'tipo', d.tipo, 'status', d.status, 'ativo', d.ativo
          ) ORDER BY d.numero
        ) FILTER (WHERE d.id IS NOT NULL) AS docas
      FROM centros_distribuicao cd
      LEFT JOIN docas d ON d.cd_id = cd.id
      WHERE cd.id = $1 AND cd.empresa_id = $2
      GROUP BY cd.id
    `, [req.params.id, req.empresaId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'CD not found' });
    }
    res.json({ cd: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /api/cds — criar CD (admin+)
// ─────────────────────────────────────────────────────
router.post('/', authorizeMin('admin'), async (req, res, next) => {
  try {
    const {
      nome, codigo, cidade, estado, pais = 'BRA',
      endereco, cep, responsavel, telefone,
      timezone = 'America/Sao_Paulo',
      capacidade_docas = 10, config = {}
    } = req.body;

    if (!nome || !codigo) {
      return res.status(400).json({ error: 'nome and codigo are required' });
    }

    // Verificar limite de CDs do plano
    const { rows: [empresa] } = await query(
      `SELECT e.*, p.max_cds
       FROM empresas e
       LEFT JOIN planos p ON p.slug = e.plano
       WHERE e.id = $1`,
      [req.empresaId]
    );

    if (empresa.max_cds !== -1) {
      const { rows: [{ count }] } = await query(
        `SELECT COUNT(*) FROM centros_distribuicao WHERE empresa_id = $1 AND ativo = true`,
        [req.empresaId]
      );
      if (parseInt(count) >= empresa.max_cds) {
        return res.status(403).json({
          error: `Plan limit reached. Max CDs for plan "${empresa.plano}": ${empresa.max_cds}`,
          code: 'PLAN_LIMIT_REACHED'
        });
      }
    }

    const { rows: [cd] } = await query(`
      INSERT INTO centros_distribuicao
        (empresa_id, nome, codigo, cidade, estado, pais, endereco, cep,
         responsavel, telefone, timezone, capacidade_docas, config)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      req.empresaId, nome, codigo.toUpperCase(), cidade, estado, pais,
      endereco, cep, responsavel, telefone, timezone, capacidade_docas,
      JSON.stringify(config)
    ]);

    logger.info(`CD created: ${cd.codigo} by user ${req.user.id}`);
    res.status(201).json({ cd });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'CD code already exists for this company' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// PUT /api/cds/:id — atualizar CD (admin+)
// ─────────────────────────────────────────────────────
router.put('/:id', authorizeMin('admin'), async (req, res, next) => {
  try {
    const {
      nome, cidade, estado, pais, endereco, cep,
      responsavel, telefone, timezone, capacidade_docas, ativo, config
    } = req.body;

    const { rows: [cd] } = await query(`
      UPDATE centros_distribuicao SET
        nome             = COALESCE($1, nome),
        cidade           = COALESCE($2, cidade),
        estado           = COALESCE($3, estado),
        pais             = COALESCE($4, pais),
        endereco         = COALESCE($5, endereco),
        cep              = COALESCE($6, cep),
        responsavel      = COALESCE($7, responsavel),
        telefone         = COALESCE($8, telefone),
        timezone         = COALESCE($9, timezone),
        capacidade_docas = COALESCE($10, capacidade_docas),
        ativo            = COALESCE($11, ativo),
        config           = COALESCE($12::jsonb, config),
        updated_at       = NOW()
      WHERE id = $13 AND empresa_id = $14
      RETURNING *
    `, [
      nome, cidade, estado, pais, endereco, cep,
      responsavel, telefone, timezone, capacidade_docas, ativo,
      config ? JSON.stringify(config) : null,
      req.params.id, req.empresaId
    ]);

    if (!cd) return res.status(404).json({ error: 'CD not found' });
    res.json({ cd });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// DELETE /api/cds/:id — desativar CD (admin+)
// ─────────────────────────────────────────────────────
router.delete('/:id', authorizeMin('admin'), async (req, res, next) => {
  try {
    // Verificar se há operações ativas
    const { rows: [{ count }] } = await query(`
      SELECT COUNT(*) FROM operacoes
      WHERE cd_id = $1 AND status IN ('em_andamento', 'aguardando')
    `, [req.params.id]);

    if (parseInt(count) > 0) {
      return res.status(409).json({
        error: `Cannot deactivate CD with ${count} active operations`
      });
    }

    const { rows: [cd] } = await query(`
      UPDATE centros_distribuicao
      SET ativo = false, updated_at = NOW()
      WHERE id = $1 AND empresa_id = $2
      RETURNING id, nome, codigo
    `, [req.params.id, req.empresaId]);

    if (!cd) return res.status(404).json({ error: 'CD not found' });
    res.json({ message: 'CD deactivated', cd });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /api/cds/:id/analytics — KPIs do CD
// ─────────────────────────────────────────────────────
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const { periodo = '7d' } = req.query;
    const intervalMap = { '1d': '1 day', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[periodo] || '7 days';

    // Verifica ownership
    const { rows: [cd] } = await query(
      `SELECT * FROM centros_distribuicao WHERE id = $1 AND empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!cd) return res.status(404).json({ error: 'CD not found' });

    // KPIs consolidados
    const { rows: [kpis] } = await query(`
      SELECT
        COUNT(*)                                                     AS total_operacoes,
        COUNT(*) FILTER (WHERE status = 'finalizada')               AS finalizadas,
        COUNT(*) FILTER (WHERE status = 'em_andamento')             AS em_andamento,
        COUNT(*) FILTER (WHERE status = 'cancelada')                AS canceladas,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (fim_real - inicio_real)) / 60
        ) FILTER (WHERE fim_real IS NOT NULL AND inicio_real IS NOT NULL), 1) AS tempo_medio_min,
        SUM(volumes_conferidos)                                      AS total_volumes,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE status = 'finalizada') /
          NULLIF(COUNT(*) FILTER (WHERE status IN ('finalizada','cancelada')), 0), 1
        )                                                            AS taxa_conclusao
      FROM operacoes
      WHERE cd_id = $1
        AND created_at > NOW() - INTERVAL '${interval}'
    `, [req.params.id]);

    // Operações por dia (histórico)
    const { rows: historico } = await query(`
      SELECT
        DATE(created_at AT TIME ZONE $2)  AS dia,
        COUNT(*)                           AS total,
        COUNT(*) FILTER (WHERE status = 'finalizada') AS finalizadas,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (fim_real - inicio_real)) / 60
        ) FILTER (WHERE fim_real IS NOT NULL), 1) AS tempo_medio_min
      FROM operacoes
      WHERE cd_id = $1
        AND created_at > NOW() - INTERVAL '${interval}'
      GROUP BY dia
      ORDER BY dia ASC
    `, [req.params.id, cd.timezone]);

    // Docas do CD
    const { rows: docas } = await query(`
      SELECT
        d.numero, d.status, d.tipo,
        COUNT(o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '${interval}') AS ops_periodo
      FROM docas d
      LEFT JOIN operacoes o ON o.doca_id = d.id
      WHERE d.cd_id = $1
      GROUP BY d.id
      ORDER BY d.numero
    `, [req.params.id]);

    res.json({
      cd: { id: cd.id, nome: cd.nome, codigo: cd.codigo },
      periodo,
      kpis,
      historico,
      docas
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /api/cds/:id/docas/:doca_id/vincular — vincular doca ao CD
// ─────────────────────────────────────────────────────
router.post('/:id/docas/:doca_id/vincular', authorizeMin('admin'), async (req, res, next) => {
  try {
    // Verificar ownership do CD
    const { rows: [cd] } = await query(
      `SELECT id FROM centros_distribuicao WHERE id = $1 AND empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!cd) return res.status(404).json({ error: 'CD not found' });

    const { rows: [doca] } = await query(`
      UPDATE docas SET cd_id = $1, updated_at = NOW()
      WHERE id = $2 AND empresa_id = $3
      RETURNING id, numero, descricao
    `, [req.params.id, req.params.doca_id, req.empresaId]);

    if (!doca) return res.status(404).json({ error: 'Doca not found' });
    res.json({ message: 'Doca linked to CD', doca });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
