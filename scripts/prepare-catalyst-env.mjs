import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import dotenv from '../server/node_modules/dotenv/lib/main.js';

const destination = new URL('../.env.catalyst.local', import.meta.url);
const source = dotenv.parse(await readFile(new URL('../server/.env', import.meta.url)));
const mongoUri = process.env.MONGODB_URI || source.MONGODB_URI;
if (!mongoUri || /localhost|127\.0\.0\.1/.test(mongoUri)) throw new Error('A cloud-accessible MONGODB_URI is required');
const data = [
  '# PRIVATE: configure these in Catalyst at deployment time. Never commit or upload this file.',
  `MONGODB_URI=${JSON.stringify(mongoUri)}`,
  `JWT_SECRET=${randomBytes(48).toString('hex')}`,
  `JOB_SECRET=${randomBytes(48).toString('hex')}`,
  '',
].join('\n');
try {
  await writeFile(destination, data, { flag: 'wx', mode: 0o600 });
  console.log('Private deployment settings prepared in .env.catalyst.local. No values were printed and nothing was uploaded.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env.catalyst.local preserved; secrets were not rotated.');
}
