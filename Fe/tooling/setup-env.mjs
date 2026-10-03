import { copyFile } from 'node:fs/promises';

const appRoot = new URL('../', import.meta.url);
try {
  await copyFile(new URL('.env.example', appRoot), new URL('.env', appRoot), 1);
  console.info('Created Fe/.env. VITE_* values are public configuration.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.info('Kept existing Fe/.env.');
}
