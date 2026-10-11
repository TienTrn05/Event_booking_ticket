import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  envDir: false, // Tests use explicit fixtures, never developer credentials.
  root: fileURLToPath(new URL('./', import.meta.url)),
  test: {
    environment: 'node',
    setupFiles: ['tests/fixtures/environment.ts'],
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
