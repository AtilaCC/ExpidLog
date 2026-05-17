// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Checklist Routes
// ══════════════════════════════════════════════════════

const router = require('express').Router();
const { query } = require('../database/connection');
const { authenticate, authorizeMin } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /api/checklists/operacao/:operacaoId
router.get('/operacao/:operacaoId', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT c.*, json_agg(ci ORDER BY ci.ordem) AS itens
      FROM checklists c
      JOIN checklist_itens ci ON ci.checklist_id = c.id
      JOIN operacoes o ON o.id = c.operacao_id
      WHERE c.operacao_id = $1 AND o.empresa_id = $2
      GROUP BY c.id
    `, [req.params.operacaoId, req.empresaId]);

    res.json({ data: rows });
  } catch (err) { next(err); }
});

// PATCH /api/checklists/itens/:itemId — responder item
router.patch('/itens/:itemId', authorizeMin('conferente'), async (req, res, next) => {
  try {
    const { status, observacao } = req.body;
    const valid = ['pendente', 'ok', 'nao_ok', 'na'];

    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', valid });
    }

    const { rows: [item] } = await query(`
      UPDATE checklist_itens
      SET status=$1, observacao=$2, respondido_em=NOW()
      WHERE id=$3
      RETURNING *
    `, [status, observacao || null, req.params.itemId]);

    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ data: item });
  } catch (err) { next(err); }
});

module.exports = router;
