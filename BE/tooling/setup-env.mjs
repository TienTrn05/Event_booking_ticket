import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
for (const app of ['BE', 'Fe']) {
  const example = new URL(`${app}/.env.example`, root);
  const destination = new URL(`${app}/.env`, root);
  const content = (await readFile(example, 'utf8')).replaceAll('GENERATE_ME', () =>
    randomBytes(32).toString('hex'),
  );
  try {
    await writeFile(destination, content, { flag: 'wx', mode: 0o600 });
    console.info(`Created ${app}/.env. Configure locally; never commit it.`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.info(`Kept existing ${app}/.env.`);
  }
}
if (process.platform === 'win32') {
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-File', fileURLToPath(new URL('./protect-env.ps1', import.meta.url))],
    { stdio: 'inherit' },
  );
}
