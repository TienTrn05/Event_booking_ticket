import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const webRoot = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  plugins: [react()],
  envDir: webRoot,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
    fs: {
      strict: true,
      allow: [webRoot, fileURLToPath(new URL('../node_modules', import.meta.url))],
      deny: [
        '**/.env',
        '**/.env.*',
        '**/*.pem',
        '**/*.key',
        '**/.git/**',
        '**/node_modules/@event-ticketing/api/**',
      ],
    },
  },
  build: { sourcemap: false },
});
