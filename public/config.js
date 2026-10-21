// Development defaults. In Docker, server/server.mjs serves /config.js
// from environment variables (LLM_BASE_URL, DEFAULT_MODEL, APP_TITLE).
window.__APP_CONFIG__ = {
  LLM_BASE_URL: '/api',
  DEFAULT_MODEL: '',
  APP_TITLE: 'Lumen',
};
