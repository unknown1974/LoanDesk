import { mkdir, readFile, writeFile, cp, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from '../server/node_modules/dotenv/lib/main.js';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const build = path.join(root, 'build');
const release = path.join(build, 'catalyst-release');
await readFile(path.join(build, 'appsail', 'src', 'server.js'));
if (await realpath(build) !== build) throw new Error('Build directory must not be a link');
await mkdir(release, { recursive: true });
if (await realpath(release) !== release) throw new Error('Release directory must not be a link');
const secrets = dotenv.parse(await readFile(path.join(root, '.env.catalyst.local')));
for (const key of ['MONGODB_URI', 'JWT_SECRET', 'JOB_SECRET']) {
  if (!secrets[key]) throw new Error(`Missing private deployment setting: ${key}`);
}
const config = JSON.parse(await readFile(path.join(root, 'app-config.json')));
if (!process.env.CLIENT_ORIGIN) throw new Error('Set CLIENT_ORIGIN to the exact frontend HTTPS origin');
const origin = new URL(process.env.CLIENT_ORIGIN);
if (origin.protocol !== 'https:' || origin.origin !== process.env.CLIENT_ORIGIN) throw new Error('CLIENT_ORIGIN must be an HTTPS origin with no path');
config.env_variables.CLIENT_ORIGIN = origin.origin;
Object.assign(process.env, config.env_variables, secrets);
await import('../server/src/config/env.js'); // Apply the same production validation as the app.
config.build_path = '../appsail';
config.scripts = {}; // The reviewed build is already prepared; no secrets enter its directory.
config.env_variables = { ...config.env_variables, MONGODB_URI: secrets.MONGODB_URI, JWT_SECRET: secrets.JWT_SECRET, JOB_SECRET: secrets.JOB_SECRET };
await writeFile(path.join(release, 'app-config.json'), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
const catalyst = JSON.parse(await readFile(path.join(root, 'catalyst.json')));
// Web Client Hosting requires its files inside the project root; deploy it from
// the repository root. This private staging project is only for the backend.
delete catalyst.client;
await writeFile(path.join(release, 'catalyst.json'), JSON.stringify(catalyst, null, 2) + '\n');
for (const file of ['.catalystrc', '.catalystignore']) {
  await cp(path.join(root, file), path.join(release, file));
}
console.log('Private CLI release configuration prepared in build/catalyst-release. Nothing was deployed.');
