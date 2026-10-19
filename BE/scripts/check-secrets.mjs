import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: repositoryRoot, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const failures = [];
function shouldInspect(file) {
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.example')) {
    failures.push(file);
    return false;
  }
  // Filter before reading: large binary assets can overflow git show's output buffer.
  return /\.(?:ts|tsx|js|mjs|json|md|ya?ml|example|ps1|sql|pem|key)$/i.test(file);
}
function inspect(file, text) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) failures.push(file);
  if (
    /^\s*(?:DB_PASSWORD|REDIS_PASSWORD|PAYOS_API_KEY|PAYOS_CHECKSUM_KEY|JWT_ACCESS_SECRET|OTP_HMAC_KEY|TICKET_ENCRYPTION_KEY|ATTENDEE_PII_KEY|SMTP_PASSWORD|GOOGLE_CLIENT_SECRET|R[23]_ACCESS_KEY_ID|R[23]_SECRET_ACCESS_KEY)\s*=\s*(?!replace_me\s*$|GENERATE_ME\s*$|$)[^\s#]+/m.test(
      text,
    )
  )
    failures.push(file);
  if (
    /rediss?:\/\/[^\s'"@]+:[^\s'"@]+@/.test(text) &&
    !file.endsWith('.example') &&
    !text.includes('${')
  )
    failures.push(file);
  if (file.startsWith('Fe/') && /VITE_(?:DB_|.*(?:PASSWORD|SECRET|PRIVATE_KEY))/.test(text))
    failures.push(file);
}
// A clean working file does not mean its staged version is safe to commit.
const stagedFiles = execFileSync('git', ['ls-files', '-z', '--cached'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
for (const file of new Set(stagedFiles)) {
  if (!shouldInspect(file)) continue;
  try {
    inspect(
      file,
      execFileSync('git', ['show', `:${file}`], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
  } catch {
    failures.push(file);
  }
}
for (const file of new Set(files)) {
  if (!shouldInspect(file)) continue;
  try {
    inspect(file, readFileSync(join(repositoryRoot, file), 'utf8'));
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
