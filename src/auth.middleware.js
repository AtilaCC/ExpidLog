// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Auth Middleware v2 (Fase 12)
// ══════════════════════════════════════════════════════

const jwt    = require('jsonwebtoken');
const { query } = require('../database/connection');

// ─── Verify JWT and attach user to req ────────────────
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify user still exists and is active
    const { rows } = await query(
      `SELECT id, empresa_id, nome, email, role, ativo
       FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (!rows.length || !rows[0].ativo) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user      = rows[0];
    req.empresaId = rows[0].empresa_id;

    // Superadmins can act on any tenant via header X-Empresa-Id
    if (rows[0].role === 'superadmin' && req.headers['x-empresa-id']) {
      req.empresaId = req.headers['x-empresa-id'];
      req.superadminImpersonating = true;
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ─── Role-based authorization ─────────────────────────
// superadmin > admin > supervisor > conferente > visualizacao
const ROLE_HIERARCHY = ['visualizacao', 'conferente', 'supervisor', 'admin', 'superadmin'];

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    // superadmin sempre passa
    if (req.user.role === 'superadmin') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }
    next();
  };
}

// Authorize: user's role must be >= minRole in hierarchy
function authorizeMin(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userLevel = ROLE_HIERARCHY.indexOf(req.user.role);
    const minLevel  = ROLE_HIERARCHY.indexOf(minRole);
    if (userLevel < minLevel) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: `>= ${minRole}`,
        current: req.user.role
      });
    }
    next();
  };
}

// ─── Superadmin only ──────────────────────────────────
function isSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
}

// ─── Tenant isolation: inject empresa_id filter ───────
function tenantScope(req, res, next) {
  if (!req.empresaId) {
    return res.status(400).json({ error: 'Tenant context missing' });
  }
  next();
}

// ─── CD scope: verifica se cd_id pertence à empresa ───
async function cdScope(req, res, next) {
  try {
    const cdId = req.params.cd_id || req.body.cd_id || req.query.cd_id;
    if (!cdId) return next();

    const { rows } = await query(
      `SELECT id FROM centros_distribuicao
       WHERE id = $1 AND empresa_id = $2 AND ativo = true`,
      [cdId, req.empresaId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'CD not found or access denied' });
    }
    req.cdId = cdId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  authenticate,
  authorize,
  authorizeMin,
  isSuperAdmin,
  tenantScope,
  cdScope
};
