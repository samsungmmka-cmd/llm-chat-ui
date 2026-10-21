import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import ModelSelect from './ModelSelect.jsx';

const Composer = forwardRef(function Composer(
  { value, onChange, onSubmit, onStop, busy, disabled, placeholder = 'Message the model…' },
  ref,
) {
  const taRef = useRef(null);
  useImperativeHandle(ref, () => ({ focus: () => taRef.current?.focus() }));

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 260) + 'px';
  }, [value]);

  const canSend = !busy && !disabled && value.trim().length > 0;

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <form
      className={`composer${busy ? ' is-busy' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <textarea
        ref={taRef}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Message"
        autoFocus
      />
      <div className="composer__bar">
        <ModelSelect placement="up" />
        <div className="composer__right">
          <span className="composer__hint">
            <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
          </span>
          {busy ? (
            <button type="button" className="send-btn send-btn--stop" onClick={onStop} title="Stop generating">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button type="submit" className="send-btn" disabled={!canSend} title="Send">
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
});

export default Composer;
