import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(process.env.PORT || env.PORT || 3000);
  return {
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/socket': { target: `ws://127.0.0.1:${port}`, ws: true },
        '/health': `http://127.0.0.1:${port}`,
        '/api/config': `http://127.0.0.1:${port}`,
      },
    },
    build: { outDir: 'dist/client', emptyOutDir: true, chunkSizeWarningLimit: 1100 },
  };
});
