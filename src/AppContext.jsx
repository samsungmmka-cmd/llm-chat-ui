import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { listModels } from './lib/api.js';
import { DEFAULT_MODEL, loadModel, loadSettings, saveModel, saveSettings } from './lib/config.js';

const AppContext = createContext(null);
const CHAT_KEY = 'lumen.chat.v1';

function loadChat() {
  try {
    const msgs = JSON.parse(sessionStorage.getItem(CHAT_KEY) || '[]');
    // Never restore a half-finished stream
    return msgs.map((m) => (m.pending ? { ...m, pending: false, stopped: true } : m));
  } catch {
    return [];
  }
}

export function AppProvider({ children }) {
  const [settings, setSettingsState] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [models, setModels] = useState([]);
  const [modelsStatus, setModelsStatus] = useState({ state: 'idle', error: null });
  const [model, setModelState] = useState(loadModel);

  // Chat lives in memory (+ sessionStorage so a refresh doesn't wipe it). No database.
  const [messages, setMessages] = useState(loadChat);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch {
      /* ignore quota errors */
    }
  }, [messages]);

  const setSettings = useCallback((next) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  const setModel = useCallback((id) => {
    setModelState(id);
    saveModel(id);
  }, []);

  const abortRef = useRef(null);
  const refreshModels = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setModelsStatus({ state: 'loading', error: null });
    try {
      const list = await listModels(settings, ctrl.signal);
      setModels(list);
      setModelsStatus({ state: 'ready', error: null });
      setModelState((current) => {
        if (list.some((m) => m.id === current)) return current;
        const preferred = list.find((m) => m.id === DEFAULT_MODEL)?.id || list[0]?.id || '';
        if (preferred) saveModel(preferred);
        return preferred;
      });
    } catch (e) {
      if (e.name === 'AbortError') return;
      setModels([]);
      setModelsStatus({ state: 'error', error: e.message || String(e) });
    }
  }, [settings]);

  useEffect(() => {
    refreshModels();
    return () => abortRef.current?.abort();
  }, [refreshModels]);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      settingsOpen,
      setSettingsOpen,
      models,
      modelsStatus,
      refreshModels,
      model,
      setModel,
      messages,
      setMessages,
    }),
    [settings, setSettings, settingsOpen, models, modelsStatus, refreshModels, model, setModel, messages],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
