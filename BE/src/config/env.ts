import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { parseEnv } from './env.schema.js';
// Stable path in both src/config and dist/config. Deployment environment wins.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
export const env = parseEnv(process.env);
