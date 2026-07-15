import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const devDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(devDirectory, '..', '..');
const repositoryDirectory = path.resolve(backendDirectory, '..');
const prismaCli = path.join(backendDirectory, 'node_modules', 'prisma', 'build', 'index.js');

function run(label: string, command: string, args: string[], cwd: string): void {
  console.log(`[dev] ${label}`);
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw new Error(`${label} Falha ao executar ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} O comando terminou com código ${result.status ?? 'desconhecido'}.`);
  }
}

try {
  run('Regenerando o Prisma Client local...', process.execPath, [prismaCli, 'generate'], backendDirectory);
  run(
    'Iniciando o PostgreSQL persistente e aguardando o healthcheck...',
    'docker',
    ['compose', '-f', 'docker-compose.yml', 'up', '-d', '--wait', 'postgres'],
    repositoryDirectory,
  );
  run(
    'Aplicando migrations pendentes sem apagar dados...',
    process.execPath,
    [prismaCli, 'migrate', 'deploy'],
    backendDirectory,
  );
  console.log('[dev] Banco pronto. Iniciando o backend...');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dev] Não foi possível preparar o ambiente: ${message}`);
  console.error('[dev] Confirme que o Docker Desktop está aberto e tente npm run dev novamente.');
  process.exit(1);
}
