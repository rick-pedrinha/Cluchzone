import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RconClient } from './rcon-client.js';

export type DockerCs2ProviderConfig = {
  publicHost: string;
  image: string;
  secretDirectory: string;
  gamePort: number;
  rconPort: number;
  gslt: string;
};

export type ProvisionInput = {
  allocationId: string;
  matchId: string;
  map: string;
  password: string;
  rconPassword: string;
};

export type ProvisionResult = {
  providerServerId: string;
  publicHost: string;
  gamePort: number;
  rconPort: number;
  secretRef: string;
};

async function runDocker(args: string[], timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: string[] = [];
    const stderr: string[] = [];
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Docker command timed out.'));
    }, timeoutMs);
    child.stdout.on('data', (chunk: string) => stdout.push(chunk));
    child.stderr.on('data', (chunk: string) => stderr.push(chunk));
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.join('').trim());
      else reject(new Error(`Docker command failed (${code ?? 'unknown'}): ${stderr.join('').trim()}`));
    });
  });
}

function containerName(allocationId: string): string {
  return `clutchzone-cs2-${allocationId}`;
}

export class DockerCs2Provider {
  private readonly rcon = new RconClient();

  constructor(private readonly config: DockerCs2ProviderConfig) {}

  async provision(input: ProvisionInput): Promise<ProvisionResult> {
    const name = containerName(input.allocationId);
    const secretRef = path.join(this.config.secretDirectory, input.allocationId);
    await mkdir(secretRef, { recursive: true, mode: 0o700 });
    await Promise.all([
      writeFile(path.join(secretRef, 'gslt'), this.config.gslt, { encoding: 'utf8', mode: 0o600 }),
      writeFile(path.join(secretRef, 'server_password'), input.password, { encoding: 'utf8', mode: 0o600 }),
      writeFile(path.join(secretRef, 'rcon_password'), input.rconPassword, { encoding: 'utf8', mode: 0o600 }),
      writeFile(path.join(secretRef, 'start_map'), input.map, { encoding: 'utf8', mode: 0o600 }),
    ]);

    await runDocker([
      'run', '-d', '--name', name,
      '--label', `com.clutchzone.allocation=${input.allocationId}`,
      '--label', `com.clutchzone.match=${input.matchId}`,
      '--restart', 'no',
      '--mount', 'type=volume,src=clutchzone-cs2-data,dst=/opt/cs2',
      '--mount', `type=bind,src=${secretRef},dst=/run/secrets/clutchzone,readonly`,
      '-p', `${this.config.gamePort}:27015/udp`,
      '-p', `${this.config.rconPort}:27015/tcp`,
      this.config.image,
    ]);
    return {
      providerServerId: name,
      publicHost: this.config.publicHost,
      gamePort: this.config.gamePort,
      rconPort: this.config.rconPort,
      secretRef,
    };
  }

  async isRunning(providerServerId: string): Promise<boolean> {
    try {
      return (await runDocker(['inspect', '--format', '{{.State.Running}}', providerServerId], 10_000)) === 'true';
    } catch {
      return false;
    }
  }

  async sendRcon(rconPassword: string, command: string): Promise<string> {
    return this.rcon.send('127.0.0.1', this.config.rconPort, rconPassword, command);
  }

  async release(providerServerId: string, secretRef: string | null): Promise<void> {
    try {
      await runDocker(['rm', '--force', providerServerId], 30_000);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('No such container')) throw error;
    }
    if (secretRef) await this.removeSecretDirectory(secretRef);
  }

  async cleanupFailedProvision(allocationId: string): Promise<void> {
    await this.release(containerName(allocationId), path.join(this.config.secretDirectory, allocationId));
  }

  private async removeSecretDirectory(secretRef: string): Promise<void> {
    const root = path.resolve(this.config.secretDirectory);
    const target = path.resolve(secretRef);
    if (target === root || !target.startsWith(`${root}${path.sep}`)) {
      throw new Error('Refusing to remove a CS2 secret path outside the configured directory.');
    }
    await rm(target, { recursive: true, force: true });
  }
}
