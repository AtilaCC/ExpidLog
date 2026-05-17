// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Relatório Routes
// ══════════════════════════════════════════════════════

const router = require('express').Router();
const { query } = require('../database/connection');
const { authenticate, authorizeMin } = require('../middleware/auth.middleware');

router.use(authenticate, authorizeMin('supervisor'));

// GET /api/relatorios/operacoes?status=&doca_id=&data_inicio=&data_fim=
router.get('/operacoes', async (req, res, next) => {
  try {
    const { data_inicio, data_fim, status, doca_id } = req.query;

    const conds = ['o.empresa_id = $1'];
    const params = [req.empresaId];

    if (status)      { params.push(status);      conds.push(`o.status = $${params.length}`); }
    if (doca_id)     { params.push(doca_id);     conds.push(`o.doca_id = $${params.length}`); }
    if (data_inicio) { params.push(data_inicio); conds.push(`o.created_at >= $${params.length}`); }
    if (data_fim)    { params.push(data_fim);    conds.push(`o.created_at <= $${params.length}`); }

    const { rows } = await query(`
      SELECT
        o.*,
        d.numero   AS doca_numero,
        u.nome     AS conferente_nome,
        EXTRACT(EPOCH FROM (o.fim_real - o.inicio_real))/60 AS duracao_minutos
      FROM operacoes o
      JOIN docas d      ON d.id = o.doca_id
      LEFT JOIN users u ON u.id = o.conferente_id
      WHERE ${conds.join(' AND ')}
      ORDER BY o.created_at DESC
      LIMIT 500
    `, params);

    res.json({ data: rows, total: rows.length });
  } catch (err) { next(err); }
});

module.exports = router;
