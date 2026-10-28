import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'www');
const directories = ['assets', 'china-navigation', 'geoapify-navigation', 'vendor', 'data', 'local-voice'];
const extensions = new Set(['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp3']);
const excludedFiles = new Set(['package.json', 'package-lock.json', 'capacitor.config.json']);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isDirectory()) continue;
  if (excludedFiles.has(entry.name) || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
  await cp(path.join(root, entry.name), path.join(output, entry.name));
}

for (const directory of directories) {
  await cp(path.join(root, directory), path.join(output, directory), { recursive: true });
}

console.log(`Let's Go Pipi web bundle created at ${output}`);

