// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Express App v2 (Fase 12)
// ══════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');

// ─── Routes ───────────────────────────────────────────
const authRoutes       = require('./routes/auth.routes');
const userRoutes       = require('./routes/user.routes');
const docaRoutes       = require('./routes/doca.routes');
const operacaoRoutes   = require('./routes/operacao.routes');
const checklistRoutes  = require('./routes/checklist.routes');
const fotoRoutes       = require('./routes/foto.routes');
const relatorioRoutes  = require('./routes/relatorio.routes');
const analyticsRoutes  = require('./routes/analytics.routes');
const logRoutes        = require('./routes/log.routes');
// ─── Fase 12: Multi-CD + Multiempresa ─────────────────
const cdRoutes         = require('./routes/cd.routes');
const empresaRoutes    = require('./routes/empresa.routes');
const superadminRoutes = require('./routes/superadmin.routes');
const pushRoutes       = require('./routes/push.routes');
// ─── Fase 14: Automação Operacional ───────────────────
const automacaoRoutes  = require('./routes/automacao.routes');
// ─── Fase 15: IA Autônoma Enterprise ──────────────────
const iaRoutes         = require('./routes/ia.routes');

const app = express();

// ─── Trust Proxy (Railway usa proxy reverso) ──────────
app.set('trust proxy', 1);

// ─── Security ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ─── CORS ─────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5500',
    /\.vercel\.app$/,
    /\.github\.io$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Empresa-Id']
}));

// ─── Rate Limiting ────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  message:  { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts.' }
});
app.use('/api/auth/', authLimiter);

// Superadmin tem rate limit mais alto (uso legítimo intenso)
const superadminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many superadmin requests.' }
});
app.use('/api/superadmin/', superadminLimiter);

// ─── Body Parsing ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ──────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) }
  }));
}

// ─── Health Check ─────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'dockcheck-pro-backend',
    version: '5.0.0',
    fase: 15,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ─── API Routes (base) ────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/docas',      docaRoutes);
app.use('/api/operacoes',  operacaoRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/fotos',      fotoRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/logs',       logRoutes);

// ─── API Routes (Fase 12 — Multi-CD + Multiempresa) ───
app.use('/api/cds',        cdRoutes);
app.use('/api/empresas',   empresaRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/push',       pushRoutes);

// ─── API Routes (Fase 14 — Automação) ─────────────────
app.use('/api/automacao',  automacaoRoutes);

// ─── API Routes (Fase 15 — IA Autônoma) ───────────────
app.use('/api/ia',         iaRoutes);

// ─── 404 Handler ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// ─── Global Error Handler ─────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

module.exports = app;
