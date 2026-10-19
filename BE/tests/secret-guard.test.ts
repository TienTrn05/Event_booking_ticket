import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve('BE/tooling/check-secrets.mjs');
function inRepository(work: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'ticket-secret-test-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    work(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
function run(directory: string) {
  return spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
}

describe('secret guard commit boundary', () => {
  it('rejects secrets staged before the working file was cleaned', () => {
    inRepository((directory) => {
      const fixture = 'DO_NOT_COMMIT_TEST_VALUE';
      writeFileSync(join(directory, 'settings.example'), `DB_PASSWORD=${fixture}\n`);
      execFileSync('git', ['add', 'settings.example'], { cwd: directory });
      writeFileSync(join(directory, 'settings.example'), 'DB_PASSWORD=replace_me\n');
      const result = run(directory);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('settings.example');
      expect(result.stderr + result.stdout).not.toContain(fixture);
    });
  });

  it('rejects a tracked env even if Git ignores it later', () => {
    inRepository((directory) => {
      writeFileSync(join(directory, '.env'), '# private configuration\n');
      execFileSync('git', ['add', '.env'], { cwd: directory });
      writeFileSync(join(directory, '.gitignore'), '.env\n');
      expect(run(directory).status).toBe(1);
    });
  });

  it('allows the documented placeholders and ignored local env', () => {
    inRepository((directory) => {
      writeFileSync(join(directory, '.gitignore'), '.env\n');
      writeFileSync(join(directory, '.env'), 'DB_PASSWORD=local-fixture\n');
      writeFileSync(join(directory, '.env.example'), 'DB_PASSWORD=replace_me\n');
      expect(run(directory).status).toBe(0);
    });
  });

  it('skips large non-source assets in staged content checks', () => {
    inRepository((directory) => {
      mkdirSync(join(directory, 'Fe/public'), { recursive: true });
      writeFileSync(join(directory, 'Fe/public/logo.png'), Buffer.alloc(1_200_000, 1), {
        encoding: 'binary',
      });
      execFileSync('git', ['add', 'Fe/public/logo.png'], { cwd: directory });
      expect(run(directory).status).toBe(0);
    });
  });
});
