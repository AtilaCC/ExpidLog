// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Auth Routes
// ══════════════════════════════════════════════════════

const router = require('express').Router();
const authService  = require('../services/auth.service');
const { authenticate } = require('../middleware/auth.middleware');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'email and senha are required' });
    }
    const data = await authService.login(
      email, senha,
      req.ip,
      req.get('user-agent')
    );
    res.json(data);
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token required' });
    }
    const data = await authService.refresh(refresh_token);
    res.json(data);
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    await authService.logout(req.user.id, refresh_token);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const { senha_hash, ...user } = req.user;
  res.json({ user: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    if (!senha_atual || !nova_senha) {
      return res.status(400).json({ error: 'senha_atual and nova_senha required' });
    }
    if (nova_senha.length < 8) {
      return res.status(400).json({ error: 'nova_senha must be at least 8 characters' });
    }
    await authService.changePassword(req.user.id, senha_atual, nova_senha);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
