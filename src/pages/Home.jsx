import { Link } from 'react-router-dom';
import { ArrowRight, Cpu, Gauge, Loader2, MessageSquareText, RefreshCw, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../AppContext.jsx';
import Logo from '../components/Logo.jsx';
import { APP_TITLE } from '../lib/config.js';

const QUICK = [
  { label: 'Summarize a long article', q: 'Summarize the following text in 5 bullet points:\n\n' },
  { label: 'Debug my code', q: 'Help me find the bug in this code:\n\n```\n\n```' },
  { label: 'Brainstorm names', q: 'Brainstorm 10 short, memorable names for ' },
  { label: 'Explain a concept', q: 'Explain like I am new to the topic: ' },
];

const FEATURES = [
  { icon: MessageSquareText, title: 'Streaming chat', text: 'Markdown, code highlighting and live token streaming.' },
  { icon: Cpu, title: 'Any model', text: 'Pick from every model your server exposes at /models.' },
  { icon: Gauge, title: 'Token usage', text: 'Input, output and total tokens plus speed for every reply.' },
  { icon: Trash2, title: 'Fresh start', text: 'Clear the conversation any time. Nothing is stored on a server.' },
];

function Status() {
  const { modelsStatus, models, refreshModels, setSettingsOpen, settings } = useApp();
  const { state, error } = modelsStatus;

  return (
    <div className={`status status--${state}`}>
      <span className="status__dot" />
      <div className="status__text">
        {state === 'loading' && <span>Connecting to model server…</span>}
        {state === 'ready' && (
          <span>
            Connected · <strong>{models.length}</strong> model{models.length === 1 ? '' : 's'} available
          </span>
        )}
        {state === 'error' && (
          <span title={error}>
            Can't reach <code>{settings.baseUrl}</code>
          </span>
        )}
        {state === 'idle' && <span>Not connected</span>}
      </div>
      <button type="button" className="icon-btn icon-btn--sm" onClick={refreshModels} title="Retry">
        {state === 'loading' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
      </button>
      <button type="button" className="icon-btn icon-btn--sm" onClick={() => setSettingsOpen(true)} title="Settings">
        <Settings2 size={14} />
      </button>
    </div>
  );
}

export default function Home() {
  const { setSettingsOpen, messages } = useApp();

  return (
    <div className="home">
      <header className="topbar topbar--home">
        <Link to="/" className="brand">
          <Logo size={22} />
          <span>{APP_TITLE}</span>
        </Link>
        <nav className="topbar__right">
          <Link to="/chat" className="btn btn--ghost btn--sm">
            Chat
          </Link>
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <Settings2 size={17} />
          </button>
        </nav>
      </header>

      <main className="home__main">
        <section className="hero">
          <div className="hero__orb" aria-hidden="true">
            <Logo size={64} />
          </div>
          <p className="eyebrow">
            <Sparkles size={14} /> Your private AI workspace
          </p>
          <h1 className="hero__title">
            Think it through with <em>{APP_TITLE}</em>
          </h1>
          <p className="hero__sub">
            A clean chat interface for your self-hosted language models. Fast, local, and nothing leaves your network.
          </p>

          <div className="hero__cta">
            <Link to="/chat" className="btn btn--primary btn--lg">
              {messages.length ? 'Continue chatting' : 'Start chatting'} <ArrowRight size={18} />
            </Link>
            <button type="button" className="btn btn--ghost btn--lg" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={17} /> Configure
            </button>
          </div>

          <Status />
        </section>

        <section className="quick">
          <h2 className="section-title">Jump in</h2>
          <div className="quick__grid">
            {QUICK.map((item) => (
              <Link key={item.label} to={`/chat?q=${encodeURIComponent(item.q)}`} className="quick__card">
                <span>{item.label}</span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </section>

        <section className="features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="feature">
              <div className="feature__icon">
                <Icon size={18} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="home__foot">OpenAI-compatible API · no database · runs in Docker</footer>
    </div>
  );
}
