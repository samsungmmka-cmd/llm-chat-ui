import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development, requests to /api/* are proxied to your local LLM server,
// exactly like nginx does in the Docker image. Set LLM_UPSTREAM in .env.local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const upstream = (env.LLM_UPSTREAM || 'http://localhost:8000/v1').replace(/\/+$/, '');

  const proxy = {
    '/api': {
      target: upstream,
      changeOrigin: true,
      // /api/chat/completions -> {LLM_UPSTREAM}/chat/completions
      // (the upstream path, e.g. /v1, is prepended automatically)
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  };

  return {
    plugins: [react()],
    server: { port: 5173, host: true, proxy },
    preview: { port: 4173, host: true, proxy },
    build: { chunkSizeWarningLimit: 900 },
  };
});
