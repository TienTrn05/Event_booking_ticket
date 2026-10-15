import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url)),
  directory = join(root, '.local', 'https');
if (!existsSync(join(directory, 'localhost.crt')) || !existsSync(join(directory, 'localhost.key')))
  throw new Error('Run npm run https:setup first.');
const child = spawn(
  process.execPath,
  [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'watch', join(root, 'src', 'server.ts')],
  {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      PORT: '3443',
      HTTPS_CERT_FILE: join(directory, 'localhost.crt'),
      HTTPS_KEY_FILE: join(directory, 'localhost.key'),
    },
  },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
process.once('SIGINT', () => child.kill('SIGINT'));
process.once('SIGTERM', () => child.kill('SIGTERM'));
