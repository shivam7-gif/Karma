import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'password',
      'token',
      'key',
      'secret',
      '*.apiKey',
      '*.encrypted_value',
      'DATABASE_URL',
      'DATABASE_URL_UNPOOLED',
      'GROQ_API_KEY',
      'SECRETS_MASTER_KEY',
      'OPENROUTER_FALLBACK_KEY',
      'NEO4J_PASSWORD',
      'GITHUB_CLIENT_SECRET',
      'GOOGLE_CLIENT_SECRET',
      'SERPAPI_KEY',
      'MANUS_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
