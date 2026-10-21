import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, X, XCircle } from 'lucide-react';
import { useApp } from '../AppContext.jsx';
import { DEFAULT_SETTINGS } from '../lib/config.js';
import { listModels } from '../lib/api.js';

export default function SettingsDialog() {
  const { settings, setSettings, settingsOpen, setSettingsOpen } = useApp();
  const [draft, setDraft] = useState(settings);
  const [test, setTest] = useState({ state: 'idle' });
  const dialogRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (settingsOpen) {
      setDraft(settings);
      setTest({ state: 'idle' });
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [settingsOpen, settings]);

  const set = (k) => (e) =>
    setDraft((d) => ({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const runTest = async () => {
    setTest({ state: 'loading' });
    try {
      const list = await listModels(draft);
      setTest({ state: 'ok', msg: `Connected — ${list.length} model${list.length === 1 ? '' : 's'} available` });
    } catch (e) {
      setTest({ state: 'error', msg: e.message });
    }
  };

  const save = (e) => {
    e.preventDefault();
    setSettings({ ...draft, baseUrl: draft.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl });
    setSettingsOpen(false);
  };

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      onClose={() => setSettingsOpen(false)}
      onClick={(e) => e.target === dialogRef.current && setSettingsOpen(false)}
    >
      <form className="dialog__inner" onSubmit={save}>
        <header className="dialog__head">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <section className="dialog__section">
          <h3>Connection</h3>
          <label className="field">
            <span>Base URL</span>
            <input
              value={draft.baseUrl}
              onChange={set('baseUrl')}
              placeholder="/api  or  http://localhost:8000/v1"
              spellCheck={false}
            />
            <small>
              Keep <code>/api</code> to go through the built-in proxy (set <code>LLM_UPSTREAM</code> on the
              container). A full URL calls the server directly from the browser and needs CORS enabled.
            </small>
          </label>
          <label className="field">
            <span>API key <em>(optional)</em></span>
            <input
              type="password"
              value={draft.apiKey}
              onChange={set('apiKey')}
              placeholder="Leave empty for local servers"
              autoComplete="off"
            />
            <small>Stored only in this browser. Prefer the container's <code>LLM_API_KEY</code> for shared setups.</small>
          </label>
          <div className="test-row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={runTest}>
              {test.state === 'loading' ? <Loader2 size={14} className="spin" /> : <PlugZap size={14} />}
              Test connection
            </button>
            {test.state === 'ok' && (
              <span className="test-ok">
                <CheckCircle2 size={14} /> {test.msg}
              </span>
            )}
            {test.state === 'error' && (
              <span className="test-err">
                <XCircle size={14} /> {test.msg}
              </span>
            )}
          </div>
        </section>

        <section className="dialog__section">
          <h3>Generation</h3>
          <label className="field">
            <span>System prompt</span>
            <textarea rows={3} value={draft.systemPrompt} onChange={set('systemPrompt')} placeholder="You are a helpful assistant." />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Temperature · {Number(draft.temperature).toFixed(2)}</span>
              <input type="range" min="0" max="2" step="0.05" value={draft.temperature} onChange={set('temperature')} />
            </label>
            <label className="field">
              <span>Max tokens</span>
              <input type="number" min="1" value={draft.maxTokens} onChange={set('maxTokens')} placeholder="Server default" />
            </label>
          </div>
          <label className="switch">
            <input type="checkbox" checked={draft.stream} onChange={set('stream')} />
            <span className="switch__track" />
            <span>Stream responses</span>
          </label>
        </section>

        <footer className="dialog__foot">
          <button type="button" className="btn btn--ghost" onClick={() => setDraft({ ...DEFAULT_SETTINGS })}>
            Reset to defaults
          </button>
          <div className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={() => setSettingsOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </footer>
      </form>
    </dialog>
  );
}
