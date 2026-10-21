import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development, requests to /api/* are proxied to your LLM server, like your
// production reverse proxy does. Set LLM_UPSTREAM (and LLM_API_KEY) in .env.local, e.g.
//   LLM_UPSTREAM=https://api.openai.com/v1
//   LLM_API_KEY=sk-...

// Fallback reader for .env files Vite can't parse — mainly files written by
// Windows PowerShell `echo ... > .env.local`, which saves them as UTF-16.
function readEnvFallback(root, key) {
  for (const name of ['.env.local', '.env', '.env.local.txt', '.env.txt']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    let text;
    if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString('utf16le');
    else if (buf[0] === 0xfe && buf[1] === 0xff) text = Buffer.from(buf).swap16().toString('utf16le');
    else text = buf.toString('utf8');
    const re = new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n#]+?)["']?\\s*$`, 'm');
    const m = text.replace(/^﻿/, '').match(re);
    if (m) return { value: m[1].trim(), file: name };
  }
  return null;
}

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const env = loadEnv(mode, root, '');
  let source = env.LLM_UPSTREAM ? 'env' : null;
  let raw = env.LLM_UPSTREAM;
  if (!raw) {
    const fb = readEnvFallback(root, 'LLM_UPSTREAM');
    if (fb) {
      raw = fb.value;
      source = fb.file;
    }
  }
  const upstream = (raw || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  // Added server-side by the proxy, so the key never reaches the browser.
  const apiKey = (env.LLM_API_KEY || readEnvFallback(root, 'LLM_API_KEY')?.value || '').trim();

  const proxy = {
    '/api': {
      target: upstream,
      changeOrigin: true,
      // /api/chat/completions -> {LLM_UPSTREAM}/chat/completions
      // (the upstream path, e.g. /llm/v1, is prepended automatically)
      rewrite: (path) => path.replace(/^\/api/, ''),
      configure: (p) => {
        p.on('proxyReq', (proxyReq, req) => {
          if (apiKey && !req.headers.authorization) proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
        });
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
          if (!source) {
            console.log(`\n  LLM proxy: /api -> ${upstream}  (DEFAULT — LLM_UPSTREAM not found)`);
            console.log(`  Create ${path.join(root, '.env.local')} containing:  LLM_UPSTREAM=https://api.openai.com/v1\n`);
          } else {
            const note = source === 'env' ? '' : `  (read from ${source}${source.endsWith('.txt') ? ' — rename it to .env.local' : ''})`;
            console.log(`\n  LLM proxy: /api -> ${upstream}${note}\n`);
          }
        },
      },
    ],
    server: { port: 5173, host: true, proxy },
    preview: { port: 4173, host: true, proxy },
    build: { chunkSizeWarningLimit: 900 },
  };
});
