import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, Home, Settings2, Sigma, Trash2 } from 'lucide-react';
import { useApp } from '../AppContext.jsx';
import Composer from '../components/Composer.jsx';
import Message from '../components/Message.jsx';
import Logo from '../components/Logo.jsx';
import { chatCompletion } from '../lib/api.js';
import { APP_TITLE } from '../lib/config.js';
import { estimateMessages, estimateTokens, fmt, fmtCompact, sumUsage } from '../lib/tokens.js';
import { answerOnly, splitThinking } from '../lib/thinking.js';

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const SUGGESTIONS = [
  'Explain how transformers use attention, simply',
  'Write a Python function to deduplicate a list, keeping order',
  'Draft a polite follow-up email after an interview',
  'Give me 5 ideas for a weekend side project',
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Chat() {
  const { settings, model, messages, setMessages, setSettingsOpen, modelsStatus } = useApp();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const composerRef = useRef(null);

  const totals = useMemo(() => sumUsage(messages), [messages]);
  const empty = messages.length === 0;

  // Prefill from ?q= (Home page suggestions)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setInput(q);
      setSearchParams({}, { replace: true });
      composerRef.current?.focus();
    }
  }, [searchParams, setSearchParams]);

  // Auto-scroll while streaming if the user is at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateMsg = useCallback(
    (id, fn) => setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m))),
    [setMessages],
  );

  const send = useCallback(
    async (text, baseHistory = messages) => {
      const content = text.trim();
      if (!content || busy) return;

      const userMsg = { id: uid(), role: 'user', content };
      const asstId = uid();
      const started = Date.now();
      const asstMsg = { id: asstId, role: 'assistant', content: '', reasoning: '', pending: true, model, startedAt: started };

      // History sent to the API: answers only (no thinking), skip failed/empty assistant turns
      const history = [...baseHistory, userMsg]
        .map((m) => (m.role === 'assistant' ? { ...m, content: answerOnly(m.content) } : m))
        .filter((m) => !(m.role === 'assistant' && !m.content));
      const apiMessages = [
        ...(settings.systemPrompt?.trim() ? [{ role: 'system', content: settings.systemPrompt.trim() }] : []),
        ...history.map(({ role, content }) => ({ role, content })),
      ];

      setMessages([...baseHistory, userMsg, asstMsg]);
      setInput('');
      setBusy(true);
      setAtBottom(true);

      if (!model) {
        updateMsg(asstId, (m) => ({
          ...m,
          pending: false,
          error: 'No model selected. Pick one from the model menu (or check your connection settings).',
        }));
        setBusy(false);
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let firstTokenAt = null;
      let accContent = '';
      let accReasoning = '';
      let thinkEndAt = null; // when the first answer text arrived after thinking

      const finish = (extra, content, reasoning) => {
        const end = Date.now();
        const { thinking } = splitThinking(content, reasoning);
        const thinkingMs = thinking && firstTokenAt ? (thinkEndAt || end) - firstTokenAt : null;
        let usage = extra.usage;
        let estimated = false;
        if (!usage && (content || reasoning)) {
          estimated = true;
          const p = estimateMessages(apiMessages);
          const c = estimateTokens(content) + estimateTokens(reasoning);
          usage = { prompt_tokens: p, completion_tokens: c, total_tokens: p + c };
        }
        return {
          usage,
          estimated,
          durationMs: end - started,
          firstTokenMs: firstTokenAt ? firstTokenAt - started : null,
          thinkingMs,
        };
      };

      try {
        const result = await chatCompletion(settings, {
          model,
          messages: apiMessages,
          signal: ctrl.signal,
          onDelta: ({ content: c, reasoning: r }) => {
            if (firstTokenAt == null) firstTokenAt = Date.now();
            accContent += c;
            accReasoning += r;
            if (thinkEndAt == null) {
              const s = splitThinking(accContent, accReasoning);
              if (s.thinking && s.answer && !s.inProgress) thinkEndAt = Date.now();
            }
            updateMsg(asstId, (m) => ({ ...m, content: m.content + c, reasoning: (m.reasoning || '') + r }));
          },
        });
        updateMsg(asstId, (m) => ({
          ...m,
          content: result.content || m.content,
          reasoning: result.reasoning || m.reasoning,
          model: result.model || m.model,
          finishReason: result.finishReason,
          pending: false,
          ...finish(result, result.content || m.content, result.reasoning || m.reasoning),
        }));
      } catch (e) {
        if (e.name === 'AbortError') {
          updateMsg(asstId, (m) => ({ ...m, pending: false, stopped: true, ...finish({}, m.content, m.reasoning) }));
        } else {
          const hint =
            e instanceof TypeError ? ' (network error — is the server reachable and CORS allowed?)' : '';
          updateMsg(asstId, (m) => ({ ...m, pending: false, error: (e.message || String(e)) + hint }));
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        composerRef.current?.focus();
      }
    },
    [busy, messages, model, settings, setMessages, updateMsg],
  );

  const stop = () => abortRef.current?.abort();

  const retry = () => {
    // Re-send the last user message, dropping everything after it
    const idx = messages.map((m) => m.role).lastIndexOf('user');
    if (idx < 0) return;
    send(messages[idx].content, messages.slice(0, idx));
  };

  const clearChat = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    abortRef.current?.abort();
    setMessages([]);
    setConfirmClear(false);
    composerRef.current?.focus();
  };

  const composer = (
    <Composer
      ref={composerRef}
      value={input}
      onChange={setInput}
      onSubmit={() => send(input)}
      onStop={stop}
      busy={busy}
      placeholder={empty ? 'How can I help you today?' : 'Reply…'}
    />
  );

  return (
    <div className="chat">
      <header className="topbar">
        <div className="topbar__left">
          <Link to="/" className="brand" title="Home">
            <Logo size={22} />
            <span>{APP_TITLE}</span>
          </Link>
        </div>

        <div className="topbar__right">
          {totals.replies > 0 && (
            <div
              className="token-pill"
              title={`Prompt ${fmt(totals.prompt)} · Completion ${fmt(totals.completion)} · Total ${fmt(totals.total)}${
                totals.estimated ? ' (some values estimated)' : ''
              }`}
            >
              <Sigma size={14} />
              <span className="token-pill__total">{fmtCompact(totals.total)}</span>
              <span className="token-pill__split">
                {fmtCompact(totals.prompt)} in · {fmtCompact(totals.completion)} out
              </span>
              {totals.estimated && <span className="usage__est">est.</span>}
            </div>
          )}
          <button
            type="button"
            className={`btn btn--ghost btn--sm${confirmClear ? ' btn--danger' : ''}`}
            onClick={clearChat}
            disabled={empty}
            title="Clear chat"
          >
            <Trash2 size={15} />
            <span className="hide-sm">{confirmClear ? 'Click to confirm' : 'Clear chat'}</span>
          </button>
          <Link to="/" className="icon-btn" title="Home">
            <Home size={17} />
          </Link>
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      {empty ? (
        <main className="chat__empty">
          <div className="chat__hello">
            <Logo size={36} />
            <h1>{greeting()}</h1>
          </div>
          {modelsStatus.state === 'error' && (
            <div className="banner">
              Can't reach the model server.{' '}
              <button type="button" className="link" onClick={() => setSettingsOpen(true)}>
                Open settings
              </button>
            </div>
          )}
          <div className="chat__composer-center">{composer}</div>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => setInput(s)}>
                {s}
              </button>
            ))}
          </div>
        </main>
      ) : (
        <>
          <main className="chat__scroll" ref={scrollRef} onScroll={onScroll}>
            <div className="chat__thread">
              {messages.map((m, i) => (
                <Message
                  key={m.id}
                  m={m}
                  isLast={i === messages.length - 1}
                  onRetry={!busy && m.role === 'assistant' ? retry : undefined}
                />
              ))}
            </div>
          </main>
          {!atBottom && (
            <button type="button" className="to-bottom" onClick={scrollToBottom} aria-label="Scroll to bottom">
              <ArrowDown size={16} />
            </button>
          )}
          <div className="chat__dock">
            {composer}
            <p className="disclaimer">Responses are generated by your local model and may be inaccurate.</p>
          </div>
        </>
      )}
    </div>
  );
}
