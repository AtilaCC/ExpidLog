// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Push Notifications Routes (Fase 13)
// ══════════════════════════════════════════════════════
// Endpoints:
//   POST /api/push/subscribe      → registrar subscription
//   DELETE /api/push/unsubscribe  → remover subscription
//   POST /api/push/send           → enviar push (interno/superadmin)
//   POST /api/push/test           → teste de push para o próprio usuário

const express   = require('express');
const webpush   = require('web-push');
const { pool }  = require('../database/connection');
const { auth }  = require('../auth.middleware');
const logger    = require('../utils/logger');

const router = express.Router();

// ─── Configurar VAPID ─────────────────────────────────
// As chaves ficam nas variáveis de ambiente do Railway.
// Para gerar: npx web-push generate-vapid-keys
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@dockcheck.io'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ─────────────────────────────────────────────────────
// POST /api/push/subscribe
// Registra ou atualiza a subscription do device atual.
// Body: { endpoint, keys: { p256dh, auth } }
// ─────────────────────────────────────────────────────
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Subscription inválida.' });
    }

    const userAgent = req.headers['user-agent'] || null;

    await pool.query(`
      INSERT INTO push_subscriptions (user_id, empresa_id, endpoint, p256dh, auth, user_agent, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (user_id, endpoint) DO UPDATE SET
        p256dh     = EXCLUDED.p256dh,
        auth       = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        ativo      = true,
        updated_at = NOW()
    `, [req.user.id, req.user.empresa_id, endpoint, keys.p256dh, keys.auth, userAgent]);

    logger.info(`[Push] Subscription registrada — user: ${req.user.id}`);
    res.json({ ok: true, message: 'Notificações ativadas.' });

  } catch (err) {
    logger.error('[Push] Erro ao registrar subscription:', err);
    res.status(500).json({ error: 'Erro ao registrar notificação.' });
  }
});

// ─────────────────────────────────────────────────────
// DELETE /api/push/unsubscribe
// Remove a subscription do device atual.
// Body: { endpoint }
// ─────────────────────────────────────────────────────
router.delete('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint obrigatório.' });

    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.user.id, endpoint]
    );

    logger.info(`[Push] Subscription removida — user: ${req.user.id}`);
    res.json({ ok: true, message: 'Notificações desativadas.' });

  } catch (err) {
    logger.error('[Push] Erro ao remover subscription:', err);
    res.status(500).json({ error: 'Erro ao desativar notificação.' });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/push/test
// Envia push de teste para o próprio usuário logado.
// ─────────────────────────────────────────────────────
router.post('/test', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 AND ativo = true',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Nenhuma subscription ativa para este usuário.' });
    }

    const payload = JSON.stringify({
      title: '🧪 DockCheck PRO',
      body: 'Notificações funcionando corretamente!',
      tipo: 'teste',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'dockcheck-teste',
      data: { tab: 'dashboard' }
    });

    const results = await _enviarParaSubscriptions(rows, payload);
    res.json({ ok: true, enviados: results.ok, falhas: results.fail });

  } catch (err) {
    logger.error('[Push] Erro no teste:', err);
    res.status(500).json({ error: 'Erro ao enviar push de teste.' });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/push/send
// Envia push para todos os usuários da empresa (ou um específico).
// Uso interno — requer role admin ou superadmin.
// Body: { user_id?, title, body, tipo, data }
// ─────────────────────────────────────────────────────
router.post('/send', auth, async (req, res) => {
  try {
    // Apenas admin+ pode enviar push manualmente
    if (!['admin', 'superadmin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }

    const { user_id, title, body, tipo = 'alerta', data = {} } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title e body obrigatórios.' });

    // Busca subscriptions da empresa (ou de um usuário específico)
    const query = user_id
      ? 'SELECT * FROM push_subscriptions WHERE user_id = $1 AND ativo = true'
      : 'SELECT * FROM push_subscriptions WHERE empresa_id = $1 AND ativo = true';
    const param = user_id || req.user.empresa_id;

    const { rows } = await pool.query(query, [param]);
    if (!rows.length) return res.json({ ok: true, enviados: 0, falhas: 0, msg: 'Sem subscribers.' });

    const payload = JSON.stringify({
      title,
      body,
      tipo,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: `dockcheck-${tipo}`,
      requireInteraction: ['atraso', 'ocorrencia'].includes(tipo),
      data
    });

    const results = await _enviarParaSubscriptions(rows, payload);
    logger.info(`[Push] Enviado — empresa: ${req.user.empresa_id} | ok: ${results.ok} | fail: ${results.fail}`);
    res.json({ ok: true, enviados: results.ok, falhas: results.fail });

  } catch (err) {
    logger.error('[Push] Erro ao enviar:', err);
    res.status(500).json({ error: 'Erro ao enviar notificação.' });
  }
});

// ─────────────────────────────────────────────────────
// HELPER — envia push para lista de subscriptions
// Remove automaticamente subscriptions expiradas (410)
// ─────────────────────────────────────────────────────
async function _enviarParaSubscriptions(rows, payload) {
  let ok = 0, fail = 0;

  await Promise.allSettled(rows.map(async (row) => {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth }
    };

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 60 * 60 * 24, // 24h
        urgency: 'normal'
      });
      ok++;
    } catch (err) {
      // 410 Gone = subscription expirada → remove do banco
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query(
          'DELETE FROM push_subscriptions WHERE id = $1',
          [row.id]
        ).catch(() => {});
        logger.info(`[Push] Subscription expirada removida: ${row.id}`);
      } else {
        logger.warn(`[Push] Falha ao enviar para ${row.id}:`, err.message);
      }
      fail++;
    }
  }));

  return { ok, fail };
}

// ─────────────────────────────────────────────────────
// Exporta helper para uso interno (socket.js, etc.)
// Ex: const { sendPushToEmpresa } = require('./routes/push.routes');
// ─────────────────────────────────────────────────────
async function sendPushToEmpresa(empresa_id, payload) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM push_subscriptions WHERE empresa_id = $1 AND ativo = true',
      [empresa_id]
    );
    if (!rows.length) return { ok: 0, fail: 0 };
    return await _enviarParaSubscriptions(rows, JSON.stringify(payload));
  } catch (err) {
    logger.error('[Push] sendPushToEmpresa error:', err);
    return { ok: 0, fail: 0 };
  }
}

module.exports = router;
module.exports.sendPushToEmpresa = sendPushToEmpresa;
