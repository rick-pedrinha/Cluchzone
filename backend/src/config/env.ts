import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform(value => value === 'true');
const optionalSecretKey = z.preprocess(
  value => value === '' ? undefined : value,
  z.string().regex(/^[a-f\d]{64}$/i).optional(),
);
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().refine(value => /^postgres(ql)?:\/\//.test(value), 'must be PostgreSQL'),
  SESSION_SECRET: z.string().min(32),
  STEAM_API_KEY: z.string().min(1).optional(),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),
  CORS_ORIGINS: z.string().transform(value => value.split(',').map(item => item.trim()).filter(Boolean)),
  TRUST_PROXY: booleanString,
  CS2_SECRET_KEY: optionalSecretKey,
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  steamApiKey: string | undefined;
  frontendUrl: string;
  backendUrl: string;
  corsOrigins: string[];
  trustProxy: boolean;
  cs2SecretKey: string | undefined;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map(issue => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && new URL(env.BACKEND_URL).protocol !== 'https:') {
    throw new Error('BACKEND_URL must use HTTPS in production');
  }
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    sessionSecret: env.SESSION_SECRET,
    steamApiKey: env.STEAM_API_KEY,
    frontendUrl: env.FRONTEND_URL,
    backendUrl: env.BACKEND_URL,
    corsOrigins: [...new Set([...env.CORS_ORIGINS, new URL(env.FRONTEND_URL).origin])],
    trustProxy: env.TRUST_PROXY,
    cs2SecretKey: env.CS2_SECRET_KEY,
  };
}
