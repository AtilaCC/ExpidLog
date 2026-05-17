// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Auth Service
// ══════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { query, withTransaction } = require('../database/connection');
const logger  = require('../utils/logger');

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub:        user.id,
      email:      user.email,
      role:       user.role,
      empresa_id: user.empresa_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

async function login(email, senha, ip, userAgent) {
  // Find user
  const { rows } = await query(
    `SELECT u.id, u.empresa_id, u.nome, u.email, u.senha_hash, u.role, u.ativo,
            e.nome AS empresa_nome, e.slug AS empresa_slug, e.plano
     FROM users u
     JOIN empresas e ON e.id = u.empresa_id
     WHERE u.email = $1`,
    [email.toLowerCase().trim()]
  );

  const user = rows[0];

  if (!user || !user.ativo) {
    // Use timing-safe comparison even for non-existent users
    await bcrypt.compare('dummy', '$2a$12$invalidhashfordummycompare000000000000');
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const valid = await bcrypt.compare(senha, user.senha_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const tokenHash    = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await withTransaction(async (client) => {
    // Store refresh token (hash only)
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, tokenHash]
    );
    // Update last login
    await client.query(
      'UPDATE users SET ultimo_login = NOW() WHERE id = $1',
      [user.id]
    );
    // Audit log
    await client.query(
      `INSERT INTO operacao_logs (empresa_id, user_id, acao, descricao, ip_address, user_agent)
       VALUES ($1, $2, 'auth.login', 'User login', $3, $4)`,
      [user.empresa_id, user.id, ip, userAgent]
    );
  });

  logger.info(`Login: ${user.email} [${user.role}]`);

  return {
    access_token:  accessToken,
    refresh_token: refreshToken,
    token_type:    'Bearer',
    expires_in:    28800,  // 8h in seconds
    user: {
      id:           user.id,
      nome:         user.nome,
      email:        user.email,
      role:         user.role,
      empresa_id:   user.empresa_id,
      empresa_nome: user.empresa_nome,
      empresa_slug: user.empresa_slug,
      plano:        user.plano,
    }
  };
}

async function refresh(refreshToken) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const { rows } = await query(
    `SELECT rt.user_id, rt.expires_at,
            u.id, u.empresa_id, u.nome, u.email, u.role, u.ativo
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  const row = rows[0];
  if (!row || new Date(row.expires_at) < new Date() || !row.ativo) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }

  const newAccessToken = generateAccessToken(row);
  return { access_token: newAccessToken, token_type: 'Bearer', expires_in: 28800 };
}

async function logout(userId, refreshToken) {
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  }
  // Clean expired tokens
  await query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  logger.info(`Logout: user ${userId}`);
}

async function changePassword(userId, senhaAtual, novaSenha) {
  const { rows } = await query('SELECT senha_hash FROM users WHERE id = $1', [userId]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 });

  const valid = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
  if (!valid) throw Object.assign(new Error('Current password incorrect'), { status: 400 });

  const hash = await bcrypt.hash(novaSenha, 12);
  await query('UPDATE users SET senha_hash = $1 WHERE id = $2', [hash, userId]);

  // Invalidate all refresh tokens
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

module.exports = { login, refresh, logout, changePassword };
