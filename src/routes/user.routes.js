// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — User Routes
// ══════════════════════════════════════════════════════

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../database/connection');
const { authenticate, authorizeMin } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /api/users
router.get('/', authorizeMin('supervisor'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, email, role, ativo, ultimo_login, created_at
       FROM users WHERE empresa_id = $1 ORDER BY nome`,
      [req.empresaId]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', authorizeMin('supervisor'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, email, role, ativo, ultimo_login, config, created_at
       FROM users WHERE id = $1 AND empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/users
router.post('/', authorizeMin('admin'), async (req, res, next) => {
  try {
    const { nome, email, senha, role } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'nome, email, senha required' });
    }
    const hash = await bcrypt.hash(senha, 12);
    const { rows: [user] } = await query(
      `INSERT INTO users (empresa_id, nome, email, senha_hash, role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, nome, email, role, ativo, created_at`,
      [req.empresaId, nome, email.toLowerCase(), hash, role || 'conferente']
    );
    res.status(201).json({ data: user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    next(err);
  }
});

// PUT /api/users/:id
router.put('/:id', authorizeMin('admin'), async (req, res, next) => {
  try {
    const { nome, role, ativo } = req.body;
    const { rows: [user] } = await query(
      `UPDATE users SET nome=COALESCE($1,nome), role=COALESCE($2,role), ativo=COALESCE($3,ativo)
       WHERE id=$4 AND empresa_id=$5
       RETURNING id, nome, email, role, ativo`,
      [nome, role, ativo, req.params.id, req.empresaId]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ data: user });
  } catch (err) { next(err); }
});

module.exports = router;
