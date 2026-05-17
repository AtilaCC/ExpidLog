// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Analytics Routes
// ══════════════════════════════════════════════════════

const router = require('express').Router();
const analytics = require('../services/analytics.service');
const { authenticate, authorizeMin } = require('../middleware/auth.middleware');

router.use(authenticate, authorizeMin('visualizacao'));

// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    res.json({ data: await analytics.dashboard(req.empresaId) });
  } catch (err) { next(err); }
});

// GET /api/analytics/kpis
router.get('/kpis', async (req, res, next) => {
  try {
    res.json({ data: await analytics.getKPIs(req.empresaId) });
  } catch (err) { next(err); }
});

// GET /api/analytics/docas
router.get('/docas', async (req, res, next) => {
  try {
    res.json({ data: await analytics.getDocasStatus(req.empresaId) });
  } catch (err) { next(err); }
});

// GET /api/analytics/ranking?dias=30
router.get('/ranking', async (req, res, next) => {
  try {
    res.json({ data: await analytics.getRankingConferentes(req.empresaId, req.query.dias) });
  } catch (err) { next(err); }
});

// GET /api/analytics/producao-hora
router.get('/producao-hora', async (req, res, next) => {
  try {
    res.json({ data: await analytics.getProducaoPorHora(req.empresaId) });
  } catch (err) { next(err); }
});

// GET /api/analytics/relatorio-tempo?data_inicio=&data_fim=
router.get('/relatorio-tempo', async (req, res, next) => {
  try {
    res.json({ data: await analytics.getRelatorioTempo(req.empresaId, req.query) });
  } catch (err) { next(err); }
});

module.exports = router;
