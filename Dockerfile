# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

# ---------- Runtime stage (no nginx — put your own reverse proxy in front) ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    LLM_BASE_URL=/api \
    DEFAULT_MODEL="" \
    APP_TITLE=Lumen
# Optional: let this container proxy /api itself instead of your nginx
#   LLM_UPSTREAM=http://host.docker.internal:8000/v1
#   LLM_API_KEY=...

COPY --from=build /app/dist ./dist
COPY server/server.mjs ./server/server.mjs

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server/server.mjs"]
