# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine

# nginx renders /etc/nginx/templates/*.template with env vars at start-up
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
# Writes /usr/share/nginx/html/config.js from env vars at start-up
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-app-config.sh

COPY --from=build /app/dist /usr/share/nginx/html

# ---- Runtime configuration (override with -e / compose) ----
# Where nginx forwards /api/* — your OpenAI-compatible server INCLUDING /v1, no trailing slash.
ENV LLM_UPSTREAM=http://host.docker.internal:8000/v1
# Optional key injected server-side (never sent to the browser)
ENV LLM_API_KEY=""
# What the browser calls. Keep /api to use the proxy above.
ENV LLM_BASE_URL=/api
ENV DEFAULT_MODEL=""
ENV APP_TITLE=Lumen

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
