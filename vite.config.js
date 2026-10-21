import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development, requests to /api/* are proxied to your LLM server, like your
// production reverse proxy does. Set LLM_UPSTREAM in .env.local, e.g.
//   LLM_UPSTREAM=http://192.168.1.20/llm/v1
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const upstream = (env.LLM_UPSTREAM || 'http://localhost:8000/v1').replace(/\/+$/, '');

  const proxy = {
    '/api': {
      target: upstream,
      changeOrigin: true,
      // /api/chat/completions -> {LLM_UPSTREAM}/chat/completions
      // (the upstream path, e.g. /llm/v1, is prepended automatically)
      rewrite: (path) => path.replace(/^\/api/, ''),
      configure: (p) => {
        p.on('error', (err, req, res) => {
          const reason = err.code || err.message || 'connection failed';
          console.error(`\n  [llm proxy] ${req.url} -> ${upstream}: ${reason}`);
          console.error('  Check LLM_UPSTREAM in .env.local (then restart `npm run dev`).\n');
          if (res && !res.headersSent && typeof res.writeHead === 'function') {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: `Can't reach ${upstream} (${reason}). Set LLM_UPSTREAM in .env.local.` } }));
          }
        });
      },
    },
  };

  return {
    plugins: [
      react(),
      {
        name: 'log-llm-upstream',
        configureServer() {
          console.log(`  LLM proxy: /api -> ${upstream}${env.LLM_UPSTREAM ? '' : '  (default — set LLM_UPSTREAM in .env.local)'}`);
        },
      },
    ],
    server: { port: 5173, host: true, proxy },
    preview: { port: 4173, host: true, proxy },
    build: { chunkSizeWarningLimit: 900 },
  };
});
