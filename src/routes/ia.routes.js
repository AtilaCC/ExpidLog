// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — IA Routes (Fase 9)
// src/routes/ia.routes.js
// ══════════════════════════════════════════════════════

'use strict';

const router  = require('express').Router();
const { Pool } = require('pg');
const auth    = require('../middleware/auth.middleware');
const ia      = require('../services/ia.service');
const logger  = require('../utils/logger');

// ─── Pool PostgreSQL ──────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ─── Helper: busca operações ──────────────────────────

async function buscarOperacoes(empresa_id, { dias = 30, doca_id, turno } = {}) {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  let query = `
    SELECT
      o.id, o.doca_id, d.numero AS doca_numero,
      o.conferente, o.auxiliar1, o.auxiliar2,
      o.transportadora, o.placa, o.rota,
      o.status, o.inicio, o.fim,
      o.volume_total, o.created_at
    FROM operacoes o
    LEFT JOIN docas d ON d.id = o.doca_id
    WHERE o.empresa_id = $1
      AND o.inicio >= $2
  `;
  const params = [empresa_id, desde.toISOString()];

  if (doca_id) {
    params.push(doca_id);
    query += ` AND o.doca_id = $${params.length}`;
  }

  query += ' ORDER BY o.inicio DESC LIMIT 1000';

  const { rows } = await pool.query(query, params);
  return rows;
}

// ──────────────────────────────────────────────────────
// GET /api/ia/score
// Score operacional do turno/dia
// ──────────────────────────────────────────────────────
router.get('/score', auth, async (req, res) => {
  try {
    const ops    = await buscarOperacoes(req.user.empresa_id, { dias: 1 });
    const result = ia.calcularScore(ops);
    res.json({ ok: true, data: result });
  } catch (e) {
    logger.error('[IA] score:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/ia/gargalos
// Gargalos detectados automaticamente
// ──────────────────────────────────────────────────────
router.get('/gargalos', auth, async (req, res) => {
  try {
    const ops    = await buscarOperacoes(req.user.empresa_id, { dias: 7 });
    const result = ia.detectarGargalos(ops);
    res.json({ ok: true, data: result, total: result.length });
  } catch (e) {
    logger.error('[IA] gargalos:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/ia/insights
// Insights automáticos gerados por IA
// ──────────────────────────────────────────────────────
router.get('/insights', auth, async (req, res) => {
  try {
    const dias   = parseInt(req.query.dias) || 7;
    const ops    = await buscarOperacoes(req.user.empresa_id, { dias });
    const result = ia.gerarInsights(ops);
    res.json({ ok: true, data: result, total: result.length });
  } catch (e) {
    logger.error('[IA] insights:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/ia/rankings
// Rankings de equipes, docas, transportadoras, turnos
// ──────────────────────────────────────────────────────
router.get('/rankings', auth, async (req, res) => {
  try {
    const dias   = parseInt(req.query.dias) || 30;
    const ops    = await buscarOperacoes(req.user.empresa_id, { dias });
    const result = ia.calcularRankings(ops);
    res.json({ ok: true, data: result });
  } catch (e) {
    logger.error('[IA] rankings:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/ia/alertas
// Alertas automáticos ativos
// ──────────────────────────────────────────────────────
router.get('/alertas', auth, async (req, res) => {
  try {
    const ops    = await buscarOperacoes(req.user.empresa_id, { dias: 1 });
    const result = ia.gerarAlertas(ops);
    res.json({ ok: true, data: result, total: result.length, criticos: result.filter(a => a.nivel === 'critico').length });
  } catch (e) {
    logger.error('[IA] alertas:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/ia/previsao
// Previsão de atraso para uma operação
// ──────────────────────────────────────────────────────
router.get('/previsao', auth, async (req, res) => {
  try {
    const { doca, conferente, transportadora } = req.query;
    const ops    = await buscarOperacoes(req.user.empresa_id, { dias: 30 });
    const result = ia.preverAtraso(ops, { doca, conferente, transportadora });
    res.json({ ok: true, data: result });
  } catch (e) {
    logger.error('[IA] previsao:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/ia/resumo-executivo
// Resumo executivo completo do turno
// ──────────────────────────────────────────────────────
router.get('/resumo-executivo', auth, async (req, res) => {
  try {
    const ops    = await buscarOperacoes(req.user.empresa_id, { dias: 1 });
    const result = ia.gerarResumoExecutivo(ops);
    res.json({ ok: true, data: result });
  } catch (e) {
    logger.error('[IA] resumo-executivo:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/ia/tendencias
// Tendências históricas (diária, turno, evolução)
// ──────────────────────────────────────────────────────
router.get('/tendencias', auth, async (req, res) => {
  try {
    const dias   = parseInt(req.query.dias) || 30;
    const ops    = await buscarOperacoes(req.user.empresa_id, { dias });
    const result = ia.analisarTendencias(ops);
    res.json({ ok: true, data: result });
  } catch (e) {
    logger.error('[IA] tendencias:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/ia/painel
// Todos os dados da IA em uma única chamada (dashboard)
// ──────────────────────────────────────────────────────
router.get('/painel', auth, async (req, res) => {
  try {
    const [ops7, ops30, ops1] = await Promise.all([
      buscarOperacoes(req.user.empresa_id, { dias: 7 }),
      buscarOperacoes(req.user.empresa_id, { dias: 30 }),
      buscarOperacoes(req.user.empresa_id, { dias: 1 }),
    ]);

    const [score, gargalos, insights, alertas, rankings, tendencias] = await Promise.all([
      ia.calcularScore(ops1),
      ia.detectarGargalos(ops7),
      ia.gerarInsights(ops7),
      ia.gerarAlertas(ops1),
      ia.calcularRankings(ops30),
      ia.analisarTendencias(ops30),
    ]);

    res.json({
      ok: true,
      data: {
        geradoEm: new Date().toISOString(),
        score,
        gargalos:  gargalos.slice(0, 8),
        insights:  insights.slice(0, 8),
        alertas:   alertas.slice(0, 10),
        rankings,
        tendencias,
        resumo: {
          totalHoje:        ops1.length,
          concluidasHoje:   ops1.filter(o => o.status === 'concluida').length,
          emAndamento:      ops1.filter(o => o.status === 'em_andamento').length,
          alertasCriticos:  alertas.filter(a => a.nivel === 'critico').length,
          gargalosCriticos: gargalos.filter(g => g.severidade === 'critica').length,
        }
      }
    });
  } catch (e) {
    logger.error('[IA] painel:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
