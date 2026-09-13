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
function inspect(file, text) {
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.example')) {
    failures.push(file);
    return;
  }
  if (!/\.(?:ts|tsx|js|mjs|json|md|ya?ml|example|ps1|sql|pem|key)$/.test(file)) return;
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
// A clean working file does not mean its staged version is safe to commit.
const stagedFiles = execFileSync('git', ['ls-files', '-z', '--cached'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
for (const file of new Set(stagedFiles)) {
  try {
    inspect(
      file,
      execFileSync('git', ['show', `:${file}`], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
  } catch {
    failures.push(file);
  }
}
for (const file of new Set(files)) {
  try {
    inspect(file, readFileSync(file, 'utf8'));
  } catch (error) {
    // Staged deletions are absent from the working tree; other read failures fail closed.
    if (error.code !== 'ENOENT') failures.push(file);
  }
}
if (failures.length) {
  console.error(
    'Potential secret exposure in files (values hidden):',
    [...new Set(failures)].join(', '),
  );
  process.exitCode = 1;
} else console.info('Secret guard passed for staged and non-ignored working source files.');
