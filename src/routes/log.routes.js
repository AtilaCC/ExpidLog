// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Log Routes
// ══════════════════════════════════════════════════════

const router = require('express').Router();
const { query } = require('../database/connection');
const { authenticate, authorizeMin } = require('../middleware/auth.middleware');

router.use(authenticate, authorizeMin('supervisor'));

// GET /api/logs?operacao_id=&acao=&limit=&offset=
router.get('/', async (req, res, next) => {
  try {
    const { operacao_id, acao, limit = 50, offset = 0 } = req.query;

    const conds = ['l.empresa_id = $1'];
    const params = [req.empresaId];

    if (operacao_id) {
      params.push(operacao_id);
      conds.push(`l.operacao_id = $${params.length}`);
    }
    if (acao) {
      params.push(`%${acao}%`);
      conds.push(`l.acao ILIKE $${params.length}`);
    }

    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(`
      SELECT l.*, u.nome AS user_nome
      FROM operacao_logs l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE ${conds.join(' AND ')}
      ORDER BY l.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, total: rows.length });
  } catch (err) { next(err); }
});

module.exports = router;
