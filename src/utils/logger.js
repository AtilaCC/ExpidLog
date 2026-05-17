// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Logger (Winston)
// ══════════════════════════════════════════════════════

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

const transports = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      logFormat
    )
  })
];

// File transports only in production or when LOG_DIR is set
if (process.env.LOG_DIR || process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || './logs';

  transports.push(
    new DailyRotateFile({
      dirname:     logDir,
      filename:    'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles:    '14d',
      maxSize:     '50m',
      format:      combine(timestamp(), errors({ stack: true }), logFormat),
    }),
    new DailyRotateFile({
      dirname:     logDir,
      filename:    'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level:       'error',
      maxFiles:    '30d',
      format:      combine(timestamp(), errors({ stack: true }), logFormat),
    })
  );
}

const logger = winston.createLogger({
  level:      process.env.LOG_LEVEL || 'info',
  transports,
  exitOnError: false,
});

// Add http level for morgan
logger.http = (msg) => logger.log('http', msg);

module.exports = logger;
