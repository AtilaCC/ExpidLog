// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Socket.IO Realtime Engine
// ══════════════════════════════════════════════════════

const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');
const { query }   = require('./database/connection');
const logger      = require('./utils/logger');

let io;

// ── empresaId → Set<socket.id> map ───────────────────
const empresaRooms = new Map();

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:5500',
        /\.vercel\.app$/,
      ],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout:  20000,
  });

  // ── Auth middleware ──────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      const { rows } = await query(
        'SELECT id, empresa_id, nome, role FROM users WHERE id = $1 AND ativo = true',
        [payload.sub]
      );
      if (!rows.length) return next(new Error('User not found'));

      socket.user      = rows[0];
      socket.empresaId = rows[0].empresa_id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────
  io.on('connection', (socket) => {
    const { empresaId } = socket;
    const room = `empresa:${empresaId}`;

    socket.join(room);
    logger.info(`Socket connected: ${socket.user.nome} [${socket.user.role}] — ${socket.id}`);

    // Confirm connection to client
    socket.emit('connected', {
      socketId:  socket.id,
      user:      socket.user,
      timestamp: new Date().toISOString(),
    });

    // ── Client subscribes to a specific operacao ───────
    socket.on('subscribe:operacao', (operacaoId) => {
      socket.join(`operacao:${operacaoId}`);
    });
    socket.on('unsubscribe:operacao', (operacaoId) => {
      socket.leave(`operacao:${operacaoId}`);
    });

    // ── Ping/pong for latency check ────────────────────
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // ── Checklist item update (collaborative) ──────────
    socket.on('checklist:item_update', (data) => {
      // Broadcast to others in same empresa (they see live updates)
      socket.to(room).emit('checklist:item_updated', {
        ...data,
        updatedBy: socket.user.nome,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Disconnect ─────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.user.nome} — ${reason}`);
    });
  });

  logger.info('✅ Socket.IO ready');
  return io;
}

// ── Broadcast to all sockets of an empresa ──────────
function emitToEmpresa(empresaId, event, data) {
  if (!io) return;
  io.to(`empresa:${empresaId}`).emit(event, {
    ...data,
    _ts: new Date().toISOString(),
  });
}

// ── Broadcast to a specific operacao room ───────────
function emitToOperacao(operacaoId, event, data) {
  if (!io) return;
  io.to(`operacao:${operacaoId}`).emit(event, {
    ...data,
    _ts: new Date().toISOString(),
  });
}

module.exports = { initSocket, emitToEmpresa, emitToOperacao };
