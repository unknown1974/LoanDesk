import { cp, mkdir, readFile, realpath, rm, lstat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const build = path.join(root, 'build');
const backend = !process.argv.includes('--frontend');
const frontend = !process.argv.includes('--backend');
function run(args, cwd, extraEnv = {}) {
  if (!process.env.npm_execpath) throw new Error('Run this builder through npm run build:catalyst');
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv },
  });
  if (result.error || result.status !== 0) throw new Error(`npm ${args.join(' ')} failed`, { cause: result.error });
}

async function clean(name) {
  await mkdir(build, { recursive: true });
  if (await realpath(build) !== build) throw new Error('Build directory must not be a link');
  const output = path.join(build, name);
  const info = await lstat(output).catch((e) => { if (e.code !== 'ENOENT') throw e; });
  if (info?.isSymbolicLink()) throw new Error('Build output must not be a link');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  return output;
}

async function verify(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, item.name);
    if (item.name === '.env' || item.name.startsWith('.env.') || item.name.endsWith('.node')) {
      throw new Error(`Unsafe or platform-specific file in bundle: ${path.relative(build, name)}`);
    }
    if (item.isDirectory()) await verify(name);
  }
}
if (frontend) {
  const api = new URL(process.env.VITE_API_URL || 'invalid');
  if (api.protocol !== 'https:' || api.origin !== process.env.VITE_API_URL) throw new Error('VITE_API_URL must be the HTTPS backend origin with no path');
  run(['ci', '--no-audit', '--no-fund'], path.join(root, 'client'));
  run(['run', 'build'], path.join(root, 'client'), { VITE_ROUTER_MODE: 'hash', VITE_API_URL: api.origin });
  const output = await clean('frontend');
  await cp(path.join(root, 'client', 'dist'), output, { recursive: true });
  await cp(path.join(root, 'client', 'client-package.json'), path.join(output, 'client-package.json'));
  await readFile(path.join(output, 'index.html'));
  await verify(output);
  console.log('Frontend ready: build/frontend (static files only).');
}
if (backend) {
  const output = await clean('appsail');
  for (const entry of ['src', 'package.json', 'package-lock.json']) {
    await cp(path.join(root, 'server', entry), path.join(output, entry), { recursive: true });
  }
  run(['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], output);
  await verify(output);
  console.log('Backend ready: build/appsail (API + production dependencies only; no website or secrets).');
}
