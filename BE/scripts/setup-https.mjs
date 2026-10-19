import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url)),
  directory = join(root, '.local', 'https');
const cert = join(directory, 'localhost.crt'),
  key = join(directory, 'localhost.key');
const openssl =
  process.env.OPENSSL_BIN ??
  (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
mkdirSync(directory, { recursive: true, mode: 0o700 });
if (existsSync(cert) && existsSync(key)) {
  console.log('Local HTTPS files already exist; no keys changed.');
} else {
  if (existsSync(cert) || existsSync(key))
    throw new Error('Partial HTTPS files exist; resolve them before generating new keys.');
  const result = spawnSync(
    openssl,
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-sha256',
      '-nodes',
      '-days',
      '365',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-addext',
      'basicConstraints=critical,CA:FALSE',
      '-addext',
      'extendedKeyUsage=serverAuth',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  if (result.status !== 0)
    throw new Error(
      'OpenSSL could not generate local HTTPS files. Set OPENSSL_BIN to its executable.',
    );
  if (process.platform !== 'win32') chmodSync(key, 0o600);
  console.log('Created development-only localhost certificate; OS trust store unchanged.');
}
