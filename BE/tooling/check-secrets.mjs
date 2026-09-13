import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const failures = [];
for (const file of new Set(files)) {
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.example')) {
    failures.push(file);
    continue;
  }
  if (!/\.(?:ts|tsx|js|mjs|json|md|ya?ml|example)$/.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) failures.push(file);
  if (
    /^\s*(?:DB_PASSWORD|JWT_ACCESS_SECRET|OTP_HMAC_KEY|TICKET_ENCRYPTION_KEY)\s*=\s*(?!replace_me\s*$|GENERATE_ME\s*$|$)[^\s#]+/m.test(
      text,
    )
  )
    failures.push(file);
  if (file.startsWith('Fe/') && /VITE_(?:DB_|.*(?:PASSWORD|SECRET|PRIVATE_KEY))/.test(text))
    failures.push(file);
}
if (failures.length) {
  console.error(
    'Potential secret exposure in files (values hidden):',
    [...new Set(failures)].join(', '),
  );
  process.exitCode = 1;
} else console.info('Secret guard passed for tracked and non-ignored source files.');
