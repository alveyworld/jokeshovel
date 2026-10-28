/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The Worker runs on :8787 under `wrangler dev`.
    proxy: { '/api': 'http://localhost:8787' },
  },
  // supabase-js is most of the bundle (~170 KB gzipped in total); split later if it grows.
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
