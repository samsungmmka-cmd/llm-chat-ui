#!/bin/sh
# Generates the browser runtime config from container environment variables.
# (LLM_API_KEY is deliberately NOT written here — nginx injects it server-side.)
set -e

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  LLM_BASE_URL: "$(json_escape "${LLM_BASE_URL:-/api}")",
  DEFAULT_MODEL: "$(json_escape "${DEFAULT_MODEL:-}")",
  APP_TITLE: "$(json_escape "${APP_TITLE:-Lumen}")"
};
EOF

echo "40-app-config.sh: browser -> ${LLM_BASE_URL:-/api}, proxy /api -> ${LLM_UPSTREAM}"
