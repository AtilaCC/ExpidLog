const router = require('express').Router();
const docaService = require('../services/doca.service');
const { authenticate, authorizeMin, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /api/docas
router.get('/', async (req, res, next) => {
  try {
    const docas = await docaService.listar(req.empresaId, req.query);
    res.json({ data: docas, total: docas.length });
  } catch (err) { next(err); }
});

// GET /api/docas/:id
router.get('/:id', async (req, res, next) => {
  try {
    const doca = await docaService.obter(req.empresaId, req.params.id);
    res.json({ data: doca });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// POST /api/docas
router.post('/', authorizeMin('supervisor'), async (req, res, next) => {
  try {
    const doca = await docaService.criar(req.empresaId, req.body, req.user.id);
    res.status(201).json({ data: doca, message: 'Doca criada com sucesso' });
  } catch (err) { next(err); }
});

// PUT /api/docas/:id
router.put('/:id', authorizeMin('supervisor'), async (req, res, next) => {
  try {
    const doca = await docaService.atualizar(req.empresaId, req.params.id, req.body, req.user.id);
    res.json({ data: doca, message: 'Doca atualizada' });
  } catch (err) {
    if (err.status === 404 || err.status === 400) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PATCH /api/docas/:id/status
router.patch('/:id/status', authorizeMin('conferente'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['livre', 'em_operacao', 'bloqueada', 'manutencao'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', valid });
    }
    const doca = await docaService.atualizarStatus(req.empresaId, req.params.id, status, req.user.id);
    res.json({ data: doca, message: 'Status atualizado' });
  } catch (err) { next(err); }
});

module.exports = router;
