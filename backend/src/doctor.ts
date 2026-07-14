import { PrismaClient } from '@prisma/client';
import { config as loadDotEnv } from 'dotenv';
import { loadConfig } from './config/env.js';

loadDotEnv({ quiet: true });

async function diagnose(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('OK: ambiente válido e PostgreSQL acessível.');
    console.log(`OK: backend configurado para ${config.backendUrl}.`);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose().catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error(`FALHA: ${message}`);
  process.exit(1);
});
