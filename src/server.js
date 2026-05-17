// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Enterprise Backend Server
// ══════════════════════════════════════════════════════

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');
const { connectDB } = require('./database/connection');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    // Connect to PostgreSQL
    await connectDB();
    logger.info('✅ PostgreSQL connected');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    initSocket(server);
    logger.info('✅ Socket.IO initialized');

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 DOCKCHECK PRO Backend running on port ${PORT}`);
      logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT',  () => gracefulShutdown(server));

  } catch (err) {
    logger.error('❌ Bootstrap failed:', err);
    process.exit(1);
  }
}

function gracefulShutdown(server) {
  logger.info('⚠️  Shutting down gracefully...');
  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
}

bootstrap();
