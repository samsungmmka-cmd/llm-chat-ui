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

The browser calls **`/api`**. A proxy forwards `/api/*` to your LLM server:

```
browser ──► /api/chat/completions ──► nginx (container) ──► ${LLM_UPSTREAM}/chat/completions
```

This avoids CORS entirely and keeps an API key on the server. You only set **`LLM_UPSTREAM`**.

> Alternatively, put a full URL (e.g. `http://192.168.1.20:8000/v1`) in **Settings → Base URL** and the
> browser calls the server directly — that server must then allow CORS.

## Run with Docker

Edit `LLM_UPSTREAM` in `docker-compose.yml`, then:

```bash
docker compose up -d --build
# open http://localhost:3000
```

Or plain Docker:

```bash
docker build -t llm-chat-ui .
docker run -d --name llm-chat-ui -p 3000:80 \
  --add-host=host.docker.internal:host-gateway \
  -e LLM_UPSTREAM=http://host.docker.internal:8000/v1 \
  llm-chat-ui
```

### Environment variables

| Variable        | Default                                  | Purpose |
|-----------------|------------------------------------------|---------|
| `LLM_UPSTREAM`  | `http://host.docker.internal:8000/v1`    | Your OpenAI-compatible server **including `/v1`, no trailing slash**. |
| `LLM_API_KEY`   | *(empty)*                                | Sent as `Authorization: Bearer …` by nginx. Never exposed to the browser. |
| `DEFAULT_MODEL` | *(empty → first model)*                  | Model pre-selected on first visit. |
| `LLM_BASE_URL`  | `/api`                                   | What the browser calls. Leave as `/api` unless you bypass the proxy. |
| `APP_TITLE`     | `Lumen`                                  | Name shown in the UI. |

All of these are read **at container start** — change them and restart, no rebuild needed.

### "localhost" inside Docker

Inside the container, `localhost` is the container itself. Use:

- **LLM on the host machine** → `http://host.docker.internal:<port>/v1` (keep the `extra_hosts` / `--add-host` line on Linux)
- **LLM in another container** → put both on the same Docker network and use its service name, e.g. `http://vllm:8000/v1`
- Make sure the LLM server listens on `0.0.0.0`, not only `127.0.0.1`

Common upstreams: vLLM `:8000/v1`, llama.cpp `:8080/v1`, Ollama `:11434/v1`, LM Studio `:1234/v1`.

Note: nginx resolves the upstream hostname at start-up, so the container won't start if that host can't be resolved.

## Local development

```bash
cp .env.example .env.local     # set LLM_UPSTREAM
npm install
npm run dev                    # http://localhost:5173 (Vite proxies /api like nginx does)
```

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
nginx/default.conf.template  SPA + /api proxy (SSE-friendly)
docker/40-app-config.sh      writes /config.js from env at start-up
```
