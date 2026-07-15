import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().refine(value => /^postgres(ql)?:\/\//.test(value), 'must be PostgreSQL'),
  CS2_SECRET_KEY: z.string().regex(/^[a-f\d]{64}$/i),
  CS2_GSLT: z.string().min(20),
  CS2_PUBLIC_HOST: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9.:-]+$/),
  CS2_SERVER_IMAGE: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9./:_-]+$/),
  CS2_SECRET_DIR: z.string().trim().min(1),
  CS2_GAME_PORT: z.coerce.number().int().min(1024).max(65535).default(27015),
  CS2_RCON_PORT: z.coerce.number().int().min(1024).max(65535).default(27015),
  CS2_WORKER_POLL_MS: z.coerce.number().int().min(500).max(60_000).default(2_000),
  CS2_PROVISION_TIMEOUT_MS: z.coerce.number().int().min(60_000).max(3_600_000).default(2_700_000),
});

export type Cs2WorkerConfig = {
  databaseUrl: string;
  secretKey: string;
  gslt: string;
  publicHost: string;
  image: string;
  secretDirectory: string;
  gamePort: number;
  rconPort: number;
  pollMs: number;
  provisionTimeoutMs: number;
};

export function loadCs2WorkerConfig(source: NodeJS.ProcessEnv = process.env): Cs2WorkerConfig {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = result.error.issues.map(issue => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing CS2 worker environment variables: ${names}`);
  }
  const value = result.data;
  return {
    databaseUrl: value.DATABASE_URL,
    secretKey: value.CS2_SECRET_KEY,
    gslt: value.CS2_GSLT,
    publicHost: value.CS2_PUBLIC_HOST,
    image: value.CS2_SERVER_IMAGE,
    secretDirectory: value.CS2_SECRET_DIR,
    gamePort: value.CS2_GAME_PORT,
    rconPort: value.CS2_RCON_PORT,
    pollMs: value.CS2_WORKER_POLL_MS,
    provisionTimeoutMs: value.CS2_PROVISION_TIMEOUT_MS,
  };
}
