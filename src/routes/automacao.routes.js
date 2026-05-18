// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Automação Routes (Fase 14)
// ══════════════════════════════════════════════════════
// POST /api/automacao/regras        → salvar regra
// GET  /api/automacao/regras        → listar regras
// DELETE /api/automacao/regras/:id  → remover regra
// POST /api/automacao/executar      → executar ação manualmente
// GET  /api/automacao/log           → histórico de execuções

const express  = require('express');
const { pool } = require('../database/connection');
const { auth } = require('../auth.middleware');
const logger   = require('../utils/logger');

const router = express.Router();

// ─────────────────────────────────────────────────────
// GET /api/automacao/regras
// Lista regras da empresa do usuário logado
// ─────────────────────────────────────────────────────
router.get('/regras', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM automacao_regras
       WHERE empresa_id = $1
       ORDER BY created_at DESC`,
      [req.user.empresa_id]
    );
    res.json({ ok: true, regras: rows });
  } catch (err) {
    logger.error('[Automação] GET regras:', err);
    res.status(500).json({ error: 'Erro ao buscar regras.' });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/automacao/regras
// Salva ou atualiza uma regra
// ─────────────────────────────────────────────────────
router.post('/regras', auth, async (req, res) => {
  try {
    if (!['admin', 'superadmin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }

    const { id, nome, gatilho, condicao, acao, params, ativo } = req.body;
    if (!nome || !gatilho || !acao) {
      return res.status(400).json({ error: 'nome, gatilho e acao são obrigatórios.' });
    }

    let row;
    if (id) {
      // Atualiza existente
      const r = await pool.query(
        `UPDATE automacao_regras SET
          nome=$1, gatilho=$2, condicao=$3, acao=$4, params=$5, ativo=$6, updated_at=NOW()
         WHERE id=$7 AND empresa_id=$8
         RETURNING *`,
        [nome, gatilho, JSON.stringify(condicao), acao, JSON.stringify(params), ativo !== false, id, req.user.empresa_id]
      );
      row = r.rows[0];
    } else {
      // Insere nova
      const r = await pool.query(
        `INSERT INTO automacao_regras (empresa_id, user_id, nome, gatilho, condicao, acao, params, ativo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [req.user.empresa_id, req.user.id, nome, gatilho, JSON.stringify(condicao), acao, JSON.stringify(params), ativo !== false]
      );
      row = r.rows[0];
    }

    res.json({ ok: true, regra: row });
  } catch (err) {
    logger.error('[Automação] POST regras:', err);
    res.status(500).json({ error: 'Erro ao salvar regra.' });
  }
});

// ─────────────────────────────────────────────────────
// DELETE /api/automacao/regras/:id
// ─────────────────────────────────────────────────────
router.delete('/regras/:id', auth, async (req, res) => {
  try {
    if (!['admin', 'superadmin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }

    await pool.query(
      'DELETE FROM automacao_regras WHERE id=$1 AND empresa_id=$2',
      [req.params.id, req.user.empresa_id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error('[Automação] DELETE regra:', err);
    res.status(500).json({ error: 'Erro ao remover regra.' });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/automacao/executar
// Executa uma ação manualmente (teste ou disparo admin)
// Body: { acao, params }
// ─────────────────────────────────────────────────────
router.post('/executar', auth, async (req, res) => {
  try {
    if (!['admin', 'superadmin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }

    const { acao, params = {} } = req.body;

    // Registra no log
    await pool.query(
      `INSERT INTO automacao_log (empresa_id, user_id, regra_nome, acao, params, resultado)
       VALUES ($1,$2,$3,$4,$5,'manual')`,
      [req.user.empresa_id, req.user.id, 'Execução Manual', acao, JSON.stringify(params)]
    ).catch(() => {});

    // Se ação é push — usa o helper do push.routes
    if (acao === 'push_notification' && params.msg) {
      try {
        const { sendPushToEmpresa } = require('./push.routes');
        await sendPushToEmpresa(req.user.empresa_id, {
          title: 'DockCheck PRO — Automação',
          body: params.msg,
          tipo: 'alerta',
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          tag: 'dockcheck-auto',
          data: { tab: 'automacao' }
        });
      } catch (e) {
        logger.warn('[Automação] Push falhou:', e.message);
      }
    }

    res.json({ ok: true, acao, msg: 'Ação executada.' });
  } catch (err) {
    logger.error('[Automação] POST executar:', err);
    res.status(500).json({ error: 'Erro ao executar ação.' });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/automacao/log
// Histórico de execuções da empresa
// ─────────────────────────────────────────────────────
router.get('/log', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100'), 500);
    const { rows } = await pool.query(
      `SELECT * FROM automacao_log
       WHERE empresa_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.empresa_id, limit]
    );
    res.json({ ok: true, log: rows });
  } catch (err) {
    logger.error('[Automação] GET log:', err);
    res.status(500).json({ error: 'Erro ao buscar log.' });
  }
});

module.exports = router;
