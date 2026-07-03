import React, { useState } from 'react';

interface TemplateOption {
  id: string;
  name: string;
  desc: string;
  tag: string;
  recommended?: boolean;
  /** Framework for `jorvel adapter add <fw>` — only the adapters the CLI ships. */
  adapterFlag?: 'vue' | 'svelte' | 'solid';
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'jorvel',
    name: 'Jorvel + React',
    desc: 'The official way to build microfrontend applications with Jorvel (React).',
    tag: 'Recommended',
    recommended: true,
  },
  {
    id: 'vue',
    name: 'Jorvel + Vue',
    desc: 'Add a Vue microfrontend with `jorvel adapter add vue`.',
    tag: 'Vue',
    adapterFlag: 'vue',
  },
  {
    id: 'svelte',
    name: 'Jorvel + Svelte',
    desc: 'Add a Svelte microfrontend with `jorvel adapter add svelte`.',
    tag: 'Svelte',
    adapterFlag: 'svelte',
  },
  {
    id: 'solid',
    name: 'Jorvel + Solid',
    desc: 'Add a Solid microfrontend with `jorvel adapter add solid`.',
    tag: 'Solid',
    adapterFlag: 'solid',
  },
  {
    id: 'blank',
    name: 'Custom (Blank)',
    desc: 'Start with a minimal Jorvel setup and add what you need.',
    tag: 'Vanilla',
  },
];

export interface WelcomeProps {
  defaultProjectName?: string;
}

export function Welcome({ defaultProjectName = 'my-jorvel-app' }: WelcomeProps) {
  const [selected, setSelected] = useState<string>('jorvel');
  const [projectName, setProjectName] = useState<string>(defaultProjectName);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [tailwind, setTailwind] = useState<boolean>(true);
  const [ssr, setSsr] = useState<boolean>(true);
  const [ci, setCi] = useState<boolean>(false);
  const [exampleRemote, setExampleRemote] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const tpl = TEMPLATES.find((t) => t.id === selected) ?? TEMPLATES[0];
  const safeName = (projectName || 'my-jorvel-app').trim().replace(/\s+/g, '-');

  // `jorvel init` only accepts `<name>` and `--tailwind` (plus -y / --no-git).
  // The other toggles below map to FOLLOW-UP commands, not init flags — emitting
  // `--template/--ssr/--ci/--with-remote` would error.
  const flags: string[] = [];
  if (tailwind) flags.push('--tailwind');
  const cmd = `npx jorvel@latest init ${safeName}${flags.length ? ' ' + flags.join(' ') : ''}`;

  // Real next-step commands derived from the toggles.
  const followUps: string[] = [`cd ${safeName}`];
  if (tpl.adapterFlag) followUps.push(`jorvel adapter add ${tpl.adapterFlag} --name ${tpl.adapterFlag}-app`);
  followUps.push('jorvel generate host shell');
  if (exampleRemote) followUps.push('jorvel generate remote dashboard');
  followUps.push('jorvel federation', 'jorvel dev');

  function copyCmd() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cmd).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mox-welcome">
      <style>{CSS}</style>

      <header className="mw-top">
        <a className="mw-brand" href="/" aria-label="jorvel home">
          <Logo size={32} />
          <span className="mw-brand-word">
            jorvel<span className="mw-brand-accent">js</span>
          </span>
        </a>
        <a
          className="mw-doc"
          href="https://jorveljs.vercel.app/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          Documentation
          <span aria-hidden> ↗</span>
        </a>
      </header>

      <main className="mw-main">
        <span className="mw-pill" role="status">
          <SparkleIcon />
          Project created successfully
        </span>
        <h1 className="mw-title">
          Welcome to <span className="mw-title-accent">jorvel</span>
        </h1>
        <p className="mw-subtitle">Let&apos;s build something amazing.</p>

        <section className="mw-section">
          <h2 className="mw-section-title">What do you want to build?</h2>
          <p className="mw-section-sub">
            Choose a starter template to get started with your new project.
          </p>

          <div className="mw-grid" role="radiogroup" aria-label="Starter templates">
            {TEMPLATES.map((t) => {
              const active = selected === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`mw-card${active ? ' mw-card-active' : ''}`}
                  onClick={() => setSelected(t.id)}
                >
                  <div className="mw-card-head">
                    <span className="mw-card-icon" aria-hidden>
                      <TemplateIcon id={t.id} />
                    </span>
                    {active && (
                      <span className="mw-check" aria-hidden>
                        <CheckIcon />
                      </span>
                    )}
                  </div>
                  <h3 className="mw-card-title">{t.name}</h3>
                  <p className="mw-card-desc">{t.desc}</p>
                  <span className={`mw-tag mw-tag-${t.id}`}>{t.tag}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mw-form">
          <label className="mw-label" htmlFor="mw-proj-name">
            Project name
          </label>
          <div className="mw-input-wrap">
            <span className="mw-input-icon" aria-hidden>
              <FolderIcon />
            </span>
            <input
              id="mw-proj-name"
              className="mw-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-jorvel-app"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <button
            type="button"
            className="mw-advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <span>Advanced options</span>
            <span className={`mw-chev${advancedOpen ? ' mw-chev-open' : ''}`} aria-hidden>
              <ChevDown />
            </span>
          </button>
          {advancedOpen && (
            <div className="mw-advanced-body">
              <label className="mw-row">
                <input
                  type="checkbox"
                  checked={tailwind}
                  onChange={(e) => setTailwind(e.target.checked)}
                />
                <span>Enable Tailwind CSS</span>
              </label>
              <label className="mw-row">
                <input
                  type="checkbox"
                  checked={ssr}
                  onChange={(e) => setSsr(e.target.checked)}
                />
                <span>Enable SSR (server-side rendering)</span>
              </label>
              <label className="mw-row">
                <input
                  type="checkbox"
                  checked={ci}
                  onChange={(e) => setCi(e.target.checked)}
                />
                <span>Configure CI workflow (GitHub Actions)</span>
              </label>
              <label className="mw-row">
                <input
                  type="checkbox"
                  checked={exampleRemote}
                  onChange={(e) => setExampleRemote(e.target.checked)}
                />
                <span>Add an example remote module</span>
              </label>
            </div>
          )}

          <div className="mw-start">
            <p className="mw-start-title">Start your project</p>
            <p className="mw-start-sub">Run the following command in your terminal</p>
            <div className="mw-cmd-wrap">
              <code className="mw-cmd">
                <span className="mw-cmd-tok mw-cmd-prog">npx</span>{' '}
                <span className="mw-cmd-tok mw-cmd-pkg">jorvel@latest</span>{' '}
                <span className="mw-cmd-tok mw-cmd-sub">init</span>{' '}
                <span className="mw-cmd-tok mw-cmd-arg">{safeName}</span>
                {flags.length > 0 && (
                  <span className="mw-cmd-tok mw-cmd-flags"> {flags.join(' ')}</span>
                )}
              </code>
              <button
                type="button"
                className="mw-copy"
                onClick={copyCmd}
                aria-live="polite"
              >
                <CopyIcon />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="mw-start-sub">Then, inside the new workspace:</p>
            <div className="mw-cmd-wrap">
              <code className="mw-cmd">
                {followUps.map((line, i) => (
                  <span key={i} className="mw-cmd-tok mw-cmd-prog" style={{ display: 'block' }}>
                    {line}
                  </span>
                ))}
              </code>
            </div>
            <div className="mw-divider" aria-hidden>
              <span />
              <span>or</span>
              <span />
            </div>
            <button
              type="button"
              className="mw-cta"
              onClick={() => {
                window.open('https://jorveljs.vercel.app/docs/getting-started', '_blank', 'noopener');
              }}
            >
              Let&apos;s build! <span aria-hidden>🚀</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="mw-footer">
        <span className="mw-foot-left">
          Made with <span className="mw-heart" aria-hidden>♥</span> by{' '}
          <a href="https://github.com/ravikisha" target="_blank" rel="noopener noreferrer">
            Ravi Kishan
          </a>
        </span>
        <div className="mw-foot-links">
          <a href="https://github.com/Ravikisha/JorvelJS" target="_blank" rel="noopener noreferrer">
            <GitHubIcon /> GitHub
          </a>
          <a href="https://jorveljs.vercel.app/docs" target="_blank" rel="noopener noreferrer">
            <BookIcon /> Docs
          </a>
          <a href="https://jorveljs.vercel.app/" target="_blank" rel="noopener noreferrer">
            <DiscordIcon /> Live site
          </a>
        </div>
      </footer>
    </div>
  );
}

export default Welcome;

/* ────────────────────────────────────────────────────────────────────────── */
/* Icons                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="40 70 240 190"
      width={size}
      height={size * 0.8}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="mw-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <g stroke="url(#mw-logo-grad)" strokeWidth={14} strokeLinecap="round">
        <line x1="70" y1="240" x2="70" y2="90" />
        <line x1="70" y1="90" x2="160" y2="200" />
        <line x1="160" y1="200" x2="250" y2="90" />
        <line x1="250" y1="90" x2="250" y2="240" />
      </g>
      <g fill="url(#mw-logo-grad)">
        <circle cx="70" cy="90" r="16" />
        <circle cx="250" cy="90" r="16" />
        <circle cx="70" cy="240" r="16" />
        <circle cx="250" cy="240" r="16" />
        <circle cx="160" cy="200" r="22" />
      </g>
    </svg>
  );
}

function TemplateIcon({ id }: { id: string }) {
  if (id === 'jorvel') return <Logo size={42} />;
  if (id === 'react')
    return (
      <svg viewBox="-12 -12 24 24" width={42} height={42} fill="none" aria-hidden>
        <circle r="2.5" fill="#61dafb" />
        <g stroke="#61dafb" strokeWidth="1" fill="none">
          <ellipse rx="11" ry="4.2" />
          <ellipse rx="11" ry="4.2" transform="rotate(60)" />
          <ellipse rx="11" ry="4.2" transform="rotate(120)" />
        </g>
      </svg>
    );
  if (id === 'vue')
    return (
      <svg viewBox="0 0 48 48" width={42} height={42} aria-hidden>
        <polygon points="24,40 4,8 14,8 24,24 34,8 44,8" fill="#42b883" />
        <polygon points="24,40 14,8 20,8 24,16 28,8 34,8" fill="#35495e" />
      </svg>
    );
  if (id === 'svelte')
    return (
      <svg viewBox="0 0 48 48" width={42} height={42} aria-hidden>
        <path
          d="M40 12c-3-7-12-9-19-4l-12 9c-5 4-6 11-3 16 0 1 1 2 2 3-1 3 0 7 2 10 4 7 12 9 19 4l12-9c5-4 6-11 3-16-1-1-1-2-2-3 1-3 0-7-2-10z"
          fill="#ff3e00"
        />
        <path
          d="M21 38c-3 1-7 0-9-3-1-2-1-5 0-7l1-1 5 4c2 1 4 1 6 0l8-6c1-1 2-2 1-4 0-1-1-3-2-3-3-2-7-1-9 1l-3 2-1-3c0-1 0-1 1-2l8-5c3-1 7 0 9 3 1 2 1 5 0 7l-1 1-5-4c-2-1-4-1-6 0l-8 6c-1 1-2 2-1 4 0 1 1 3 2 3 3 2 7 1 9-1l3-2 1 3c0 1 0 1-1 2l-8 5z"
          fill="#fff"
        />
      </svg>
    );
  if (id === 'angular')
    return (
      <svg viewBox="0 0 48 48" width={42} height={42} aria-hidden>
        <polygon points="24,4 44,12 41,38 24,46 7,38 4,12" fill="#dd0031" />
        <polygon points="24,4 44,12 41,38 24,46" fill="#c3002f" />
        <path d="M24 10 13 36h4l2-6h10l2 6h4L24 10zm0 7 4 11h-8l4-11z" fill="#fff" />
      </svg>
    );
  return (
    <svg viewBox="0 0 48 48" width={42} height={42} fill="none" aria-hidden>
      <rect x="6" y="10" width="36" height="28" rx="4" stroke="#94a3b8" strokeWidth="2" />
      <path d="M14 22l4 4-4 4M22 30h10" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function ChevDown() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
      <path d="M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3z" fill="#fbbf24" />
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.7 1.2 3.4.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 3-.4 1 0 2.1.1 3 .4 2.2-1.5 3.2-1.2 3.2-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.5 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z"/>
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path d="M4 4h7v16H4zM13 4h7v16h-7z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden>
      <path d="M19.3 5.3A17 17 0 0 0 15.2 4l-.2.4c1.5.3 2.2.8 3 1.4-1.4-.6-2.7-1-4-1A17 17 0 0 0 4.7 5.3C2 9.3 1.3 13.2 1.6 17a17 17 0 0 0 5 2.5l1-1.4a11 11 0 0 1-2-1l.4-.2a12 12 0 0 0 11.8 0l.4.2-2 1 1 1.4a17 17 0 0 0 5-2.5c.4-4.7-.7-8.6-3-11.7zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Styles                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const CSS = `
.mox-welcome {
  --mw-bg: #0a0814;
  --mw-bg-grad: radial-gradient(60% 50% at 50% 20%, rgba(124,58,237,0.18) 0%, rgba(10,8,20,0) 65%), #0a0814;
  --mw-fg: #f1f5f9;
  --mw-muted: #94a3b8;
  --mw-border: rgba(148,163,184,0.14);
  --mw-border-strong: rgba(148,163,184,0.28);
  --mw-card: rgba(20,17,33,0.65);
  --mw-card-hover: rgba(30,26,47,0.75);
  --mw-accent: #8b5cf6;
  --mw-accent-2: #a78bfa;
  --mw-accent-soft: rgba(139,92,246,0.16);
  --mw-cta-grad: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);

  min-height: 100vh;
  background: var(--mw-bg-grad);
  color: var(--mw-fg);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;
}
.mox-welcome *, .mox-welcome *::before, .mox-welcome *::after { box-sizing: border-box; }
.mox-welcome button { font: inherit; cursor: pointer; }
.mox-welcome a { color: inherit; text-decoration: none; }

.mw-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px 36px;
}
.mw-brand { display: inline-flex; align-items: center; gap: 10px; }
.mw-brand-word { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
.mw-brand-accent { color: var(--mw-accent-2); }
.mw-doc {
  display: inline-flex; align-items: center; gap: 4px;
  border: 1px solid var(--mw-border); border-radius: 10px;
  padding: 8px 14px; font-size: 13px; font-weight: 500;
  background: rgba(255,255,255,0.02);
  transition: background 0.15s, border-color 0.15s;
}
.mw-doc:hover { background: rgba(255,255,255,0.06); border-color: var(--mw-border-strong); }

.mw-main {
  flex: 1; width: 100%; max-width: 960px; margin: 0 auto;
  padding: 20px 24px 60px; display: flex; flex-direction: column; align-items: center;
}
.mw-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 999px;
  border: 1px solid var(--mw-accent); background: var(--mw-accent-soft);
  color: var(--mw-accent-2); font-size: 13px; font-weight: 500;
}
.mw-title {
  margin: 22px 0 8px; font-size: 56px; font-weight: 800; letter-spacing: -1.5px; text-align: center;
}
.mw-title-accent {
  background: linear-gradient(135deg, #a78bfa, #6366f1 60%, #ec4899);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.mw-subtitle { color: var(--mw-muted); font-size: 17px; margin: 0 0 12px; }

.mw-section { width: 100%; margin-top: 64px; }
.mw-section-title { font-size: 18px; font-weight: 600; text-align: center; margin: 0 0 6px; }
.mw-section-sub { color: var(--mw-muted); text-align: center; font-size: 14px; margin: 0 0 28px; }

.mw-grid {
  display: grid; gap: 18px;
  grid-template-columns: repeat(3, minmax(0,1fr));
}
@media (max-width: 880px) { .mw-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 560px) { .mw-grid { grid-template-columns: 1fr; } }

.mw-card {
  position: relative; text-align: left;
  background: var(--mw-card); border: 1px solid var(--mw-border);
  border-radius: 14px; padding: 22px;
  display: flex; flex-direction: column; gap: 10px; min-height: 220px;
  transition: background 0.18s, border-color 0.18s, transform 0.18s;
  color: var(--mw-fg);
}
.mw-card:hover { background: var(--mw-card-hover); border-color: var(--mw-border-strong); transform: translateY(-1px); }
.mw-card-active {
  border-color: var(--mw-accent); background: linear-gradient(180deg, rgba(139,92,246,0.10), rgba(139,92,246,0.02));
  box-shadow: 0 0 0 1px var(--mw-accent) inset, 0 8px 32px -16px rgba(139,92,246,0.45);
}
.mw-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.mw-card-icon { display: inline-flex; }
.mw-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 999px;
  background: var(--mw-accent); color: white;
}
.mw-card-title { font-size: 17px; font-weight: 600; margin: 4px 0 0; }
.mw-card-desc { font-size: 13px; color: var(--mw-muted); margin: 0; line-height: 1.5; flex: 1; }

.mw-tag {
  align-self: flex-start;
  font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--mw-border);
  color: var(--mw-muted);
}
.mw-tag-jorvel { background: rgba(139,92,246,0.18); border-color: rgba(139,92,246,0.35); color: #c4b5fd; }
.mw-tag-react { background: rgba(34,211,238,0.12); border-color: rgba(34,211,238,0.32); color: #67e8f9; }
.mw-tag-vue { background: rgba(66,184,131,0.12); border-color: rgba(66,184,131,0.30); color: #6ee7b7; }
.mw-tag-svelte { background: rgba(255,62,0,0.12); border-color: rgba(255,62,0,0.30); color: #fdba74; }
.mw-tag-angular { background: rgba(221,0,49,0.12); border-color: rgba(221,0,49,0.30); color: #fca5a5; }
.mw-tag-blank { background: rgba(148,163,184,0.10); border-color: var(--mw-border); color: var(--mw-muted); }

.mw-form { width: 100%; margin-top: 44px; display: flex; flex-direction: column; gap: 16px; }
.mw-label { font-size: 14px; font-weight: 500; }
.mw-input-wrap {
  position: relative; display: flex; align-items: center;
  background: var(--mw-card); border: 1px solid var(--mw-accent);
  border-radius: 10px; padding: 0 14px;
  box-shadow: 0 0 0 3px rgba(139,92,246,0.08);
}
.mw-input-icon { color: var(--mw-muted); margin-right: 10px; display: inline-flex; }
.mw-input {
  flex: 1; height: 46px; background: transparent; border: 0; outline: 0;
  color: var(--mw-fg); font-size: 15px;
}
.mw-input::placeholder { color: var(--mw-muted); }

.mw-advanced-toggle {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--mw-card); border: 1px solid var(--mw-border);
  border-radius: 10px; padding: 14px 18px; color: var(--mw-fg);
  width: 100%; font-size: 14px; font-weight: 500;
  transition: background 0.15s, border-color 0.15s;
}
.mw-advanced-toggle:hover { background: var(--mw-card-hover); border-color: var(--mw-border-strong); }
.mw-chev { color: var(--mw-muted); transition: transform 0.18s; display: inline-flex; }
.mw-chev-open { transform: rotate(180deg); }
.mw-advanced-body {
  display: flex; flex-direction: column; gap: 10px;
  background: var(--mw-card); border: 1px solid var(--mw-border);
  border-radius: 10px; padding: 18px;
}
.mw-row { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--mw-fg); }
.mw-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--mw-accent); }

.mw-start {
  margin-top: 8px;
  background: var(--mw-card); border: 1px solid var(--mw-border);
  border-radius: 14px; padding: 24px;
}
.mw-start-title { font-size: 16px; font-weight: 600; margin: 0; }
.mw-start-sub { color: var(--mw-muted); font-size: 13px; margin: 4px 0 16px; }

.mw-cmd-wrap {
  display: flex; align-items: center; gap: 12px;
  background: rgba(0,0,0,0.4); border: 1px solid var(--mw-border);
  border-radius: 10px; padding: 12px 14px;
}
.mw-cmd {
  flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap;
  font-family: ui-monospace, "JetBrains Mono", "Fira Code", Menlo, monospace;
  font-size: 13px; color: var(--mw-fg);
}
.mw-cmd-tok { display: inline; }
.mw-cmd-prog { color: var(--mw-muted); }
.mw-cmd-pkg { color: #f0abfc; }
.mw-cmd-sub { color: #67e8f9; }
.mw-cmd-arg { color: #fbbf24; }
.mw-cmd-flags { color: var(--mw-muted); }
.mw-copy {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--mw-border);
  color: var(--mw-fg); border-radius: 8px; padding: 7px 12px; font-size: 13px;
  transition: background 0.15s, border-color 0.15s;
}
.mw-copy:hover { background: rgba(255,255,255,0.10); border-color: var(--mw-border-strong); }

.mw-divider {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 14px;
  color: var(--mw-muted); font-size: 12px; margin: 22px 0;
}
.mw-divider > span:nth-child(1), .mw-divider > span:nth-child(3) { height: 1px; background: var(--mw-border); }

.mw-cta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; background: var(--mw-cta-grad); color: white;
  border: 0; border-radius: 10px; padding: 14px;
  font-size: 15px; font-weight: 600;
  box-shadow: 0 10px 28px -10px rgba(139,92,246,0.65);
  transition: transform 0.12s, box-shadow 0.12s, filter 0.12s;
}
.mw-cta:hover { transform: translateY(-1px); filter: brightness(1.05); }
.mw-cta:active { transform: translateY(0); }

.mw-footer {
  border-top: 1px solid var(--mw-border);
  padding: 18px 36px;
  display: flex; align-items: center; justify-content: space-between;
  color: var(--mw-muted); font-size: 13px; flex-wrap: wrap; gap: 12px;
}
.mw-heart { color: #ec4899; }
.mw-foot-links { display: flex; gap: 20px; }
.mw-foot-links a { display: inline-flex; align-items: center; gap: 6px; }
.mw-foot-links a:hover { color: var(--mw-fg); }

@media (max-width: 560px) {
  .mw-top { padding: 16px 18px; }
  .mw-main { padding: 12px 16px 40px; }
  .mw-title { font-size: 38px; }
  .mw-footer { padding: 14px 18px; }
}
`;
