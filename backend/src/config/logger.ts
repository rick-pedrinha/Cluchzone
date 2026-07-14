import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.query.openid.sig', 'steamApiKey', 'sessionSecret'],
    censor: '[REDACTED]',
  },
});
