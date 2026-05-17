const router = require('express').Router();
const svc = require('../services/operacao.service');
const { authenticate, authorizeMin } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /api/operacoes
router.get('/', async (req, res, next) => {
  try {
    const result = await svc.listar(req.empresaId, req.query);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/operacoes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const op = await svc.obter(req.empresaId, req.params.id);
    res.json({ data: op });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// POST /api/operacoes — iniciar
router.post('/', authorizeMin('conferente'), async (req, res, next) => {
  try {
    if (!req.body.doca_id || !req.body.numero_oc) {
      return res.status(400).json({ error: 'doca_id and numero_oc required' });
    }
    const op = await svc.iniciar(req.empresaId, req.body, req.user.id);
    res.status(201).json({ data: op, message: 'Operação iniciada' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PATCH /api/operacoes/:id
router.patch('/:id', authorizeMin('conferente'), async (req, res, next) => {
  try {
    const op = await svc.atualizar(req.empresaId, req.params.id, req.body, req.user.id);
    res.json({ data: op, message: 'Operação atualizada' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/operacoes/:id/finalizar
router.post('/:id/finalizar', authorizeMin('conferente'), async (req, res, next) => {
  try {
    const op = await svc.finalizar(req.empresaId, req.params.id, req.body, req.user.id);
    res.json({ data: op, message: 'Operação finalizada' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/operacoes/:id/cancelar
router.post('/:id/cancelar', authorizeMin('supervisor'), async (req, res, next) => {
  try {
    const { motivo } = req.body;
    if (!motivo) return res.status(400).json({ error: 'motivo required' });
    const op = await svc.cancelar(req.empresaId, req.params.id, motivo, req.user.id);
    res.json({ data: op, message: 'Operação cancelada' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
