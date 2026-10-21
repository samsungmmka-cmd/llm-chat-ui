import { memo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  Check,
  ChevronDown,
  Copy,
  Gauge,
  RotateCcw,
  Sigma,
  Timer,
} from 'lucide-react';
import Logo from './Logo.jsx';
import { fmt } from '../lib/tokens.js';
import { splitThinking } from '../lib/thinking.js';

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for http:// origins where clipboard API is blocked
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return [copied, copy];
}

function CodeBlock({ node, children, ...rest }) {
  const preRef = useRef(null);
  const [copied, copy] = useCopy();
  const codeEl = Array.isArray(children) ? children[0] : children;
  const lang = /language-([\w+-]+)/.exec(codeEl?.props?.className || '')?.[1];
  return (
    <div className="codeblock">
      <div className="codeblock__head">
        <span>{lang || 'code'}</span>
        <button type="button" onClick={() => copy(preRef.current?.innerText || '')}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={preRef} {...rest}>
        {children}
      </pre>
    </div>
  );
}

const mdComponents = {
  pre: CodeBlock,
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
  table: ({ node, ...props }) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
};

const Markdown = memo(function Markdown({ text }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
      {text}
    </ReactMarkdown>
  );
});

function UsageBar({ m }) {
  const u = m.usage;
  if (!u) return null;
  const genMs = m.durationMs && m.firstTokenMs != null ? m.durationMs - m.firstTokenMs : m.durationMs;
  const tps = genMs > 0 && u.completion_tokens ? u.completion_tokens / (genMs / 1000) : null;

  return (
    <div className="usage" title={m.estimated ? 'Server did not report usage — values are estimated' : 'Reported by server'}>
      <span className="usage__item" title="Prompt (input) tokens">
        <ArrowUpRight size={13} /> {fmt(u.prompt_tokens)} in
      </span>
      <span className="usage__item" title="Completion (output) tokens">
        <ArrowDownRight size={13} /> {fmt(u.completion_tokens)} out
      </span>
      <span className="usage__item usage__item--total" title="Total tokens">
        <Sigma size={13} /> {fmt(u.total_tokens)}
      </span>
      {m.durationMs != null && (
        <span className="usage__item" title="Total time (time to first token)">
          <Timer size={13} /> {(m.durationMs / 1000).toFixed(1)}s
          {m.firstTokenMs != null && <span className="muted"> ({(m.firstTokenMs / 1000).toFixed(2)}s TTFT)</span>}
        </span>
      )}
      {tps && (
        <span className="usage__item" title="Output tokens per second">
          <Gauge size={13} /> {tps.toFixed(1)} tok/s
        </span>
      )}
      {m.estimated && <span className="usage__est">est.</span>}
    </div>
  );
}

function formatSecs(ms) {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return `${s.toFixed(1)}s`;
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function ThinkingSection({ text, active, startedAt, thinkingMs }) {
  // null = follow the automatic behaviour (open while thinking, closed after)
  const [userOpen, setUserOpen] = useState(null);
  const [now, setNow] = useState(Date.now());
  const bodyRef = useRef(null);
  const open = userOpen ?? active;

  // Live timer while thinking
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);

  // Keep the newest thought in view while it streams
  useEffect(() => {
    const el = bodyRef.current;
    if (open && active && el) el.scrollTop = el.scrollHeight;
  }, [text, open, active]);

  let label;
  if (active) label = `Thinking${startedAt ? ` · ${formatSecs(now - startedAt)}` : '…'}`;
  else label = thinkingMs != null ? `Thought for ${formatSecs(thinkingMs)}` : 'Thought process';

  return (
    <div className={`thinking${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="thinking__head"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        title={open ? 'Hide thinking' : 'Show thinking'}
      >
        <Brain size={15} className="thinking__icon" />
        <span className="thinking__label">{label}</span>
        <span className="thinking__toggle">{open ? 'Hide' : 'Show'}</span>
        <ChevronDown size={15} className="thinking__chev" />
      </button>
      {open && (
        <div className="thinking__body" ref={bodyRef}>
          {text || <span className="muted">…</span>}
        </div>
      )}
    </div>
  );
}

function Message({ m, onRetry, isLast }) {
  const [copied, copy] = useCopy();

  if (m.role === 'user') {
    return (
      <div className="msg msg--user">
        <div className="msg__bubble">{m.content}</div>
      </div>
    );
  }

  const { thinking, answer, inProgress } = splitThinking(m.content, m.reasoning);
  const thinkingActive = !!m.pending && (inProgress || (!!thinking && !answer));
  const showDots = m.pending && !thinking && !answer && !inProgress;

  return (
    <div className={`msg msg--assistant${m.error ? ' msg--error' : ''}`}>
      <div className="msg__avatar">
        <Logo size={22} spinning={m.pending} />
      </div>
      <div className="msg__body">
        {(thinking || inProgress) && (
          <ThinkingSection
            text={thinking}
            active={thinkingActive}
            startedAt={m.startedAt}
            thinkingMs={m.thinkingMs}
          />
        )}

        {showDots && (
          <div className="typing" aria-label="Generating">
            <span />
            <span />
            <span />
          </div>
        )}

        {answer && (
          <div className={`md${m.pending ? ' is-streaming' : ''}`}>
            <Markdown text={answer} />
          </div>
        )}

        {m.error && (
          <div className="msg__error">
            <AlertCircle size={16} />
            <div>
              <strong>Request failed</strong>
              <div className="mono small">{m.error}</div>
            </div>
          </div>
        )}

        {!m.pending && (
          <div className="msg__footer">
            <div className="msg__actions">
              {answer && (
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => copy(answer)} title="Copy answer">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              )}
              {isLast && onRetry && (
                <button type="button" className="icon-btn icon-btn--sm" onClick={onRetry} title="Regenerate">
                  <RotateCcw size={14} />
                </button>
              )}
              {m.stopped && <span className="tag">stopped</span>}
              {m.finishReason === 'length' && <span className="tag">hit max tokens</span>}
              {m.model && <span className="msg__model">{m.model}</span>}
            </div>
            <UsageBar m={m} />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Message);
