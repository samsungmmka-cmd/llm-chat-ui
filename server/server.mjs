// Zero-dependency production server for the built app (no nginx needed in the image).
//  - serves ./dist with SPA fallback (/chat -> index.html)
//  - serves /config.js generated from environment variables
//  - OPTIONAL: proxies /api/* to LLM_UPSTREAM (skip it if your own nginx already does this)
//  - /healthz for container health checks
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(process.env.DIST_DIR || path.join(__dirname, '..', 'dist'));
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPSTREAM = (process.env.LLM_UPSTREAM || '').replace(/\/+$/, '');
const API_KEY = process.env.LLM_API_KEY || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

const runtimeConfig = `window.__APP_CONFIG__ = ${JSON.stringify({
  LLM_BASE_URL: process.env.LLM_BASE_URL || '/api',
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || '',
  APP_TITLE: process.env.APP_TITLE || 'Lumen',
})};\n`;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

function serveFile(res, filePath, method) {
  const ext = path.extname(filePath).toLowerCase();
  const isAsset = filePath.startsWith(path.join(DIST, 'assets') + path.sep);
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer'];

function proxy(req, res) {
  const target = new URL(UPSTREAM + req.url.replace(/^\/api/, ''));
  const client = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };
  HOP_BY_HOP.forEach((h) => delete headers[h]);
  delete headers.origin;
  delete headers.referer;
  if (!headers.authorization && API_KEY) headers.authorization = `Bearer ${API_KEY}`;

  const up = client.request(target, { method: req.method, headers }, (upRes) => {
    const out = { ...upRes.headers, 'x-accel-buffering': 'no', 'cache-control': 'no-cache' };
    HOP_BY_HOP.forEach((h) => delete out[h]);
    res.writeHead(upRes.statusCode || 502, out);
    res.flushHeaders?.();
    upRes.pipe(res);
  });
  up.setTimeout(10 * 60 * 1000, () => up.destroy(new Error('upstream timeout')));
  up.on('error', (e) => {
    const reason = e.code || e.message || (e.errors && e.errors[0]?.code) || 'unknown';
    console.error(`[proxy] ${req.method} ${req.url} -> ${target.href} failed: ${reason}`);
    if (!res.headersSent) {
      send(res, 502, JSON.stringify({ error: { message: `Upstream error: ${reason} (${target.href})` } }), {
        'Content-Type': 'application/json',
      });
    } else res.destroy();
  });
  res.on('close', () => up.destroy()); // user pressed Stop
  req.pipe(up);
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');

  if (pathname === '/healthz') return send(res, 200, 'ok\n', { 'Content-Type': 'text/plain' });

  if (pathname === '/config.js') {
    return send(res, 200, runtimeConfig, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    });
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    if (UPSTREAM) return proxy(req, res);
    return send(
      res,
      502,
      JSON.stringify({ error: { message: 'No LLM_UPSTREAM set: route /api to your LLM in your reverse proxy, or set LLM_UPSTREAM.' } }),
      { 'Content-Type': 'application/json' },
    );
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');

  let filePath;
  try {
    filePath = path.join(DIST, path.normalize(decodeURIComponent(pathname)));
  } catch {
    return send(res, 400, 'Bad Request');
  }
  if (!filePath.startsWith(DIST)) return send(res, 403, 'Forbidden');

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return serveFile(res, filePath, req.method);
  if (path.extname(pathname)) return send(res, 404, 'Not Found'); // missing asset
  return serveFile(res, path.join(DIST, 'index.html'), req.method); // SPA route
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`llm-chat-ui listening on :${PORT}  (dist: ${DIST})`);
  console.log(UPSTREAM ? `proxying /api -> ${UPSTREAM}` : '/api not proxied here (handled by your reverse proxy)');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
