import { defineConfig } from 'vite';

export default defineConfig({
  base: '/browser-wellness-companion/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'esnext',
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
