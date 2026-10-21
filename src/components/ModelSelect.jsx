import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Cpu, RefreshCw, AlertTriangle } from 'lucide-react';
import { useApp } from '../AppContext.jsx';

export default function ModelSelect({ placement = 'up' }) {
  const { models, model, setModel, modelsStatus, refreshModels, setSettingsOpen } = useApp();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setFilter('');
  }, [open]);

  const loading = modelsStatus.state === 'loading';
  const error = modelsStatus.state === 'error';
  const visible = models.filter((m) => m.id.toLowerCase().includes(filter.toLowerCase()));

  let label = model || 'Select model';
  if (loading && !model) label = 'Loading models…';
  if (error && !model) label = 'No connection';

  return (
    <div className={`model-select model-select--${placement}`} ref={rootRef}>
      <button
        type="button"
        className={`model-select__trigger${error ? ' is-error' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={model || 'Choose a model'}
      >
        {error ? <AlertTriangle size={14} /> : <Cpu size={14} />}
        <span className="model-select__label">{label}</span>
        <ChevronDown size={14} className="model-select__chev" />
      </button>

      {open && (
        <div className="model-select__menu" role="listbox">
          <div className="model-select__head">
            <span>Models</span>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={refreshModels}
              title="Refresh model list"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>

          {models.length > 6 && (
            <input
              className="model-select__filter"
              placeholder="Filter models…"
              value={filter}
              autoFocus
              onChange={(e) => setFilter(e.target.value)}
            />
          )}

          <div className="model-select__list">
            {error && (
              <div className="model-select__empty">
                <p>Couldn't load models.</p>
                <p className="muted small mono">{modelsStatus.error}</p>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  Check connection settings
                </button>
              </div>
            )}
            {!error && loading && models.length === 0 && (
              <div className="model-select__empty muted">Loading…</div>
            )}
            {!error && !loading && models.length === 0 && (
              <div className="model-select__empty muted">The server returned no models.</div>
            )}
            {visible.map((m) => (
              <button
                type="button"
                role="option"
                aria-selected={m.id === model}
                key={m.id}
                className={`model-select__item${m.id === model ? ' is-active' : ''}`}
                onClick={() => {
                  setModel(m.id);
                  setOpen(false);
                }}
              >
                <span className="model-select__item-main">
                  <span className="model-select__item-name">{m.id}</span>
                  {(m.ownedBy || m.contextLength) && (
                    <span className="model-select__item-meta">
                      {[m.ownedBy, m.contextLength && `${Math.round(m.contextLength / 1024)}k ctx`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </span>
                {m.id === model && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
