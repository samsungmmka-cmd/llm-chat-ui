// Runtime configuration.
// Priority: user settings (localStorage) > /config.js (container env) > build-time defaults.

const runtime = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};

export const APP_TITLE = runtime.APP_TITLE || 'Lumen';

export const DEFAULT_SETTINGS = {
  // '/api' goes through the nginx (or Vite dev) proxy -> your LLM server.
  // You can also put a full URL here, e.g. http://localhost:8000/v1 (server must allow CORS).
  baseUrl: runtime.LLM_BASE_URL || '/api',
  apiKey: '',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: '',
  stream: true,
};

export const DEFAULT_MODEL = runtime.DEFAULT_MODEL || '';

const SETTINGS_KEY = 'lumen.settings.v1';
const MODEL_KEY = 'lumen.model.v1';

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

export function loadModel() {
  try {
    return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function saveModel(model) {
  try {
    localStorage.setItem(MODEL_KEY, model);
  } catch {
    /* storage unavailable */
  }
}
