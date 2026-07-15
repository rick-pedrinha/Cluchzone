import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const devDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(devDirectory, '..', '..');
const repositoryDirectory = path.resolve(backendDirectory, '..');
const publicDirectory = path.join(backendDirectory, 'dist', 'public');
const publicExtensions = new Set([
  '.html',
  '.css',
  '.js',
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
]);
const excludedFiles = new Set(['server.js']);

await rm(publicDirectory, { recursive: true, force: true });
await mkdir(publicDirectory, { recursive: true });

const entries = await readdir(repositoryDirectory, { withFileTypes: true });
await Promise.all(
  entries
    .filter(
      (entry) =>
        entry.isFile() &&
        publicExtensions.has(path.extname(entry.name).toLowerCase()) &&
        !excludedFiles.has(entry.name),
    )
    .map((entry) =>
      cp(path.join(repositoryDirectory, entry.name), path.join(publicDirectory, entry.name)),
    ),
);

await cp(path.join(repositoryDirectory, 'images'), path.join(publicDirectory, 'images'), {
  recursive: true,
});
console.log(`Frontend público copiado para ${publicDirectory}.`);
