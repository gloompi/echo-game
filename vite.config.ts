import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true,
    proxy: { '/socket': { target: 'ws://127.0.0.1:3000', ws: true }, '/health': 'http://127.0.0.1:3000' },
  },
  build: { outDir: 'dist/client', emptyOutDir: false, chunkSizeWarningLimit: 1100 },
});
