# Lumen — Chat UI for your local LLM

A Claude-style React chat interface for any **OpenAI-compatible** server
(vLLM, llama.cpp `server`, Ollama, LM Studio, LiteLLM, TGI, LocalAI …).

- Home screen with connection status and quick-start links
- Streaming chat with Markdown, tables and syntax-highlighted code (copy buttons)
- Model dropdown populated from `GET /models`
- Token usage on every reply (input / output / total, time-to-first-token, tok/s) and a running total for the chat
- Clear chat, stop generation, regenerate last reply
- Settings: base URL, optional API key, system prompt, temperature, max tokens, streaming on/off
- No database — the chat lives in browser memory (sessionStorage), settings in localStorage
- Dark & light theme (follows the OS), responsive down to phones

## Endpoints used

| UI feature        | Request                                                                 |
|-------------------|-------------------------------------------------------------------------|
| Model dropdown    | `GET  {base}/models`                                                     |
| Chat              | `POST {base}/chat/completions` with `stream: true`                       |
| Token usage       | `usage` from the response (`stream_options.include_usage` when streaming) |

If your server doesn't return `usage`, the UI falls back to a ~4 chars/token estimate and marks it **est.**
If it rejects `stream_options`, the request is retried once without it.

## How the base URL works

The container has **no nginx** — it runs a tiny dependency-free Node server (`server/server.mjs`) that serves
the built app and `/config.js`. Your own nginx sits in front and routes `/api/` to the LLM server:

```
browser ─► your nginx ─┬─ /api/*  ─► LLM server  (http://<llm-host>:8000/v1/*)
                       └─ /*      ─► llm-chat-ui container :3000
```

### nginx config for your existing server

```nginx
# Static app
location / {
    proxy_pass http://127.0.0.1:3000;      # or http://llm-chat-ui:3000 on a Docker network
    proxy_set_header Host $host;
}

# OpenAI-compatible API — note the trailing slashes: /api/models -> /v1/models
location /api/ {
    proxy_pass http://127.0.0.1:8000/v1/;  # your LLM server
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    # proxy_set_header Authorization "Bearer YOUR_KEY";   # if the LLM needs a key

    # Required for token streaming (SSE)
    proxy_buffering off;
    proxy_cache off;
    gzip off;
    proxy_read_timeout 600s;
}
```

Other options:
- **Let the container proxy `/api` itself:** set `LLM_UPSTREAM` (and optionally `LLM_API_KEY`); then nginx only
  needs `location / { proxy_pass http://127.0.0.1:3000; proxy_buffering off; }`.
- **Call the LLM directly from the browser:** set `LLM_BASE_URL` (or *Settings → Base URL*) to a full URL like
  `http://192.168.1.20:8000/v1` — the LLM server must then allow CORS.

## Run with Docker

```bash
docker compose up -d --build     # app on http://<host>:3000
```

Or plain Docker:

```bash
docker build -t llm-chat-ui .
docker run -d --name llm-chat-ui -p 3000:3000 llm-chat-ui
```

### Environment variables

| Variable        | Default                  | Purpose |
|-----------------|--------------------------|---------|
| `LLM_BASE_URL`  | `/api`                   | What the browser calls. Keep `/api` when nginx routes it. |
| `DEFAULT_MODEL` | *(empty → first model)*  | Model pre-selected on first visit. |
| `APP_TITLE`     | `Lumen`                  | Name shown in the UI. |
| `PORT`          | `3000`                   | Port the container listens on. |
| `LLM_UPSTREAM`  | *(unset)*                | Optional. If set, the container proxies `/api/*` here itself (include `/v1`). |
| `LLM_API_KEY`   | *(unset)*                | Optional, with `LLM_UPSTREAM`. Added server-side, never sent to the browser. |

All are read **at container start** — change and restart, no rebuild needed.

### "localhost" inside Docker

If you use `LLM_UPSTREAM`, remember `localhost` inside the container is the container itself. Use
`http://host.docker.internal:<port>/v1` (plus `--add-host=host.docker.internal:host-gateway` on Linux) or the LLM
container's service name on a shared Docker network. The LLM server must listen on `0.0.0.0`.

Common ports: vLLM `:8000/v1`, llama.cpp `:8080/v1`, Ollama `:11434/v1`, LM Studio `:1234/v1`.

## Local development

```bash
cp .env.example .env.local     # set LLM_UPSTREAM, e.g. http://192.168.1.20/llm/v1
npm install
npm run dev                    # http://localhost:5173 (Vite proxies /api to LLM_UPSTREAM)
```

The dev server prints `LLM proxy: /api -> …` on start so you can confirm the target.
After changing `.env.local`, restart `npm run dev`.

## Project structure

```
src/
  pages/Home.jsx            landing page + connection status
  pages/Chat.jsx            chat screen, send/stop/retry/clear, usage totals
  components/Composer.jsx   auto-growing input with model picker + send/stop
  components/ModelSelect.jsx
  components/Message.jsx    markdown, code blocks, per-reply token usage
  components/SettingsDialog.jsx
  lib/api.js                OpenAI-compatible client (models, streaming SSE)
  lib/tokens.js             usage totals, formatting, fallback estimate
  lib/config.js             runtime config + localStorage settings
server/server.mjs           production server: static files, /config.js, optional /api proxy
```
