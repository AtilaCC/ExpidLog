// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Database Connection (PostgreSQL / pg)
// ══════════════════════════════════════════════════════

const { Pool } = require('pg');
const logger   = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL required on Railway/Render/Supabase
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err);
});

async function connectDB() {
  const client = await pool.connect();
  await client.query('SELECT NOW()');
  client.release();
}

// Convenience wrapper: run a query with the pool
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query detected', { duration, text });
    }
    return result;
  } catch (err) {
    logger.error('DB query error:', { text, params, message: err.message });
    throw err;
  }
}

// Transaction helper
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, connectDB, withTransaction };
