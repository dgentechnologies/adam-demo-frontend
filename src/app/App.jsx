'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const MOCK_DELAY_MS = 400;
let mockFetchInstalled = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockFetchResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

async function mockFetch(url, options = {}) {
  await sleep(MOCK_DELAY_MS);

  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  if (method === 'POST' && url === '/api/auth/login') {
    if (body.email === 'wrong@test.com') {
      return createMockFetchResponse(401, { error: 'Invalid credentials' });
    }
    return createMockFetchResponse(200, { token: 'mock-token-abc', userId: 'usr_001' });
  }

  if (method === 'POST' && url === '/api/onboarding') {
    return createMockFetchResponse(200, { status: 'ok', profileId: 'prf_001' });
  }

  if (method === 'POST' && url === '/api/demo/start') {
    return createMockFetchResponse(200, { sessionId: 'sess_001', durationSeconds: 300 });
  }

  if (method === 'POST' && url === '/api/demo/end') {
    return createMockFetchResponse(200, { status: 'ended', sessionId: 'sess_001' });
  }

  if (method === 'POST' && url === '/api/waitlist') {
    return createMockFetchResponse(200, { status: 'joined', position: 47 });
  }

  return createMockFetchResponse(404, { error: 'Not found' });
}

function installMockFetch() {
  if (typeof globalThis === 'undefined' || mockFetchInstalled) {
    return;
  }

  const nativeFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api/')) {
      return mockFetch(url, init);
    }
    if (nativeFetch) {
      return nativeFetch(input, init);
    }
    return createMockFetchResponse(404, { error: 'Not found' });
  };

  mockFetchInstalled = true;
}

async function postJSON(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function apiAuthLogin(email, password) {
  return postJSON('/api/auth/login', { email, password });
}

async function apiOnboarding(payload) {
  return postJSON('/api/onboarding', payload);
}

async function apiDemoStart(payload) {
  return postJSON('/api/demo/start', payload);
}

async function apiDemoEnd(payload) {
  return postJSON('/api/demo/end', payload);
}

async function apiWaitlist(payload) {
  return postJSON('/api/waitlist', payload);
}

const AppContext = createContext(null);

function AppProvider({ children }) {
  const [authToken, setAuthToken] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    role: '',
    interest: '',
    referral: '',
  });

  const value = useMemo(
    () => ({
      authToken,
      setAuthToken,
      userId,
      setUserId,
      email,
      setEmail,
      onboardingData,
      setOnboardingData,
    }),
    [authToken, userId, email, onboardingData]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

function normalizeRoute(hashValue) {
  const raw = hashValue ? hashValue.replace(/^#/, '') : '/';
  return raw || '/';
}

function useHashRouter() {
  const [route, setRoute] = useState('/');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateRoute = () => setRoute(normalizeRoute(window.location.hash));
    updateRoute();
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  const push = (nextRoute) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.hash = nextRoute;
  };

  return { route, push };
}

function LoginPage({ push }) {
  const { setAuthToken, setUserId, setEmail } = useAppContext();
  const [emailValue, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = await apiAuthLogin(emailValue, password);
    if (!result.ok) {
      setError(result.data.error || 'Unable to sign in');
      setLoading(false);
      return;
    }

    setAuthToken(result.data.token);
    setUserId(result.data.userId);
    setEmail(emailValue);
    setLoading(false);
    push('/onboarding');
  };

  return (
    <main className="screen-center">
      <section className="card" style={{ maxWidth: 400 }}>
        <h1 className="logo">ADAM</h1>
        <p className="tagline">Autonomous Desktop AI Module · DGEN Technologies</p>

        <form onSubmit={handleSubmit} className="stack">
          <input
            className="field"
            type="email"
            placeholder="Email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Entering...' : 'Enter'}
          </button>
        </form>
      </section>
    </main>
  );
}

function OnboardingPage({ push }) {
  const { userId, onboardingData, setOnboardingData } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) {
      push('/');
    }
  }, [push, userId]);

  const updateField = (key, value) => {
    setOnboardingData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { name, role, interest, referral } = onboardingData;
    if (!name || !role || !interest || !referral) {
      setError('Please complete all fields.');
      return;
    }

    setError('');
    setLoading(true);
    const result = await apiOnboarding({ userId, name, role, interest, referral });
    setLoading(false);

    if (!result.ok) {
      setError('Unable to continue right now.');
      return;
    }

    push('/demo');
  };

  return (
    <main className="screen-center">
      <section className="card" style={{ maxWidth: 480 }}>
        <div className="step-row" aria-label="step indicator">
          <span className="dot active" />
          <span className="dot" />
          <span className="dot" />
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <label className="label" htmlFor="full-name">Full name</label>
          <input
            id="full-name"
            className="field"
            type="text"
            value={onboardingData.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
          />

          <label className="label" htmlFor="role">Role</label>
          <select
            id="role"
            className="field"
            value={onboardingData.role}
            onChange={(e) => updateField('role', e.target.value)}
            required
          >
            <option value="">Select</option>
            <option value="Developer">Developer</option>
            <option value="Researcher">Researcher</option>
            <option value="Creator">Creator</option>
            <option value="Business">Business</option>
            <option value="Other">Other</option>
          </select>

          <fieldset className="radio-group">
            <legend className="label">Primary interest</legend>
            {['Voice control', 'Smart home', 'Productivity', 'Just exploring'].map((option) => (
              <label className="radio-item" key={option}>
                <input
                  type="radio"
                  name="interest"
                  value={option}
                  checked={onboardingData.interest === option}
                  onChange={(e) => updateField('interest', e.target.value)}
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>

          <label className="label" htmlFor="referral">How did you hear about ADAM?</label>
          <select
            id="referral"
            className="field"
            value={onboardingData.referral}
            onChange={(e) => updateField('referral', e.target.value)}
            required
          >
            <option value="">Select</option>
            <option value="YouTube">YouTube</option>
            <option value="Twitter/X">Twitter/X</option>
            <option value="Friend">Friend</option>
            <option value="Other">Other</option>
          </select>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Continuing...' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  );
}

function formatRemaining(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function DemoPage({ push }) {
  const { userId, onboardingData } = useAppContext();
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [demoStarted, setDemoStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [endOpen, setEndOpen] = useState(false);
  const [query, setQuery] = useState('');
  const intervalRef = useRef(null);
  const didEndRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      push('/');
    }
  }, [push, userId]);

  useEffect(() => {
    if (!demoStarted || endOpen) {
      return undefined;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [demoStarted, endOpen]);

  useEffect(() => {
    if (timeLeft > 0 || didEndRef.current) {
      return;
    }

    didEndRef.current = true;
    clearInterval(intervalRef.current);
    setEndOpen(true);
    apiDemoEnd({ userId, endTime: Date.now() });
  }, [timeLeft, userId]);

  const startDemo = async () => {
    setWelcomeOpen(false);
    setDemoStarted(true);
    await apiDemoStart({ userId, startTime: Date.now() });
  };

  const timerColor = timeLeft <= 30 ? '#ff3b30' : timeLeft <= 60 ? '#ffb347' : '#ffffff';

  return (
    <main className="screen-full">
      <header className="top-bar">
        <p className="logo left">ADAM</p>
        <p className="timer" style={{ color: timerColor }}>
          {formatRemaining(timeLeft)}
        </p>
      </header>

      <section className={`demo-shell ${endOpen ? 'frozen' : ''}`}>
        <div className="face-placeholder">[ ADAM face output ]</div>

        <div className="input-row">
          <input
            className="field"
            type="text"
            placeholder="Type a message to ADAM"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={endOpen || !demoStarted}
          />
          <button className="btn" type="button" disabled={endOpen || !demoStarted}>
            Send
          </button>
        </div>

        <div className="chip-row">
          {['What can you do?', 'Tell me a joke', 'Control my lights'].map((chip) => (
            <button
              key={chip}
              className="chip"
              type="button"
              disabled={endOpen || !demoStarted}
              onClick={() => setQuery(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      <div className={`overlay ${welcomeOpen ? 'show' : ''}`} aria-hidden={!welcomeOpen}>
        <div className="overlay-card">
          <h2>Welcome, {onboardingData.name || 'there'}</h2>
          <p>
            You have 5 minutes with ADAM. Ask anything, explore freely. Your session begins when you click Start.
          </p>
          <button className="btn" type="button" onClick={startDemo}>
            Start demo
          </button>
        </div>
      </div>

      <div className={`overlay ${endOpen ? 'show' : ''}`} aria-hidden={!endOpen}>
        <div className="overlay-card">
          <h2>Your demo session has ended.</h2>
          <button className="btn" type="button" onClick={() => push('/waitlist')}>
            Join the waitlist -&gt;
          </button>
        </div>
      </div>
    </main>
  );
}

function WaitlistPage() {
  const { onboardingData, email } = useAppContext();
  const [name, setName] = useState(onboardingData.name || '');
  const [emailValue, setEmailValue] = useState(email || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await apiWaitlist({ name, email: emailValue, message });
    setLoading(false);

    if (!result.ok) {
      setError('Unable to join right now.');
      return;
    }

    setJoined(true);
  };

  return (
    <main className="screen-center">
      <section className="card" style={{ maxWidth: 440 }}>
        {!joined ? (
          <>
            <h2 className="title">Be the first to get ADAM.</h2>
            <p className="muted">Early access opens soon. Drop your email and we&apos;ll reach out.</p>

            <form onSubmit={handleSubmit} className="stack">
              <input
                className="field"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                className="field"
                type="email"
                placeholder="Email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                required
              />
              <textarea
                className="field"
                rows={4}
                placeholder="Anything you'd like us to know?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error ? <p className="error-text">{error}</p> : null}
              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Joining...' : 'Join waitlist'}
              </button>
            </form>
          </>
        ) : (
          <div className="joined-state">
            <div className="checkmark" aria-hidden="true">✓</div>
            <h2 className="title">You&apos;re on the list.</h2>
            <p className="muted">We&apos;ll be in touch soon. Follow @DGENTech for updates.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function RouterView() {
  const { route, push } = useHashRouter();
  const { authToken, userId } = useAppContext();

  if (!authToken && route !== '/') {
    return <LoginPage push={push} />;
  }

  if (route === '/onboarding') {
    return <OnboardingPage push={push} />;
  }

  if (route === '/demo') {
    if (!userId) {
      return <LoginPage push={push} />;
    }
    return <DemoPage push={push} />;
  }

  if (route === '/waitlist') {
    return <WaitlistPage />;
  }

  return <LoginPage push={push} />;
}

export default function App() {
  useEffect(() => {
    installMockFetch();
  }, []);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #000000;
          color: #ffffff;
          font-family: 'Courier New', Courier, monospace;
        }
        main {
          min-height: 100vh;
          width: 100%;
          background: #000000;
        }
        .screen-center {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .screen-full {
          min-height: 100vh;
          padding-top: 78px;
        }
        .card {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 24px;
        }
        .logo {
          margin: 0;
          font-size: 32px;
          letter-spacing: 0.3em;
          color: #ffffff;
          text-align: center;
        }
        .logo.left {
          text-align: left;
          font-size: 24px;
        }
        .tagline {
          margin: 12px 0 22px;
          color: rgba(255, 255, 255, 0.45);
          font-size: 12px;
          text-align: center;
        }
        .title {
          margin: 0 0 10px;
          font-size: 26px;
        }
        .muted {
          margin: 0 0 18px;
          color: rgba(255, 255, 255, 0.45);
        }
        .stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .label {
          color: #ffffff;
          font-size: 13px;
        }
        .field {
          width: 100%;
          background: transparent;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 10px 12px;
          font-family: 'Courier New', Courier, monospace;
          outline: none;
        }
        .field:focus {
          border-color: rgba(255, 255, 255, 0.6);
        }
        .field:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .btn {
          background: transparent;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 4px;
          padding: 10px 12px;
          font-family: 'Courier New', Courier, monospace;
          cursor: pointer;
        }
        .btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
        }
        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .error-text {
          margin: 0;
          color: #ffffff;
          font-size: 12px;
        }
        .step-row {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 20px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.25);
        }
        .dot.active {
          background: #ffffff;
        }
        .radio-group {
          border: 0;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .radio-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffffff;
          font-size: 14px;
        }
        .top-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 78px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          background: #000000;
          padding: 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
        }
        .timer {
          margin: 0;
          font-size: 20px;
        }
        .demo-shell {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }
        .demo-shell.frozen {
          pointer-events: none;
          opacity: 0.45;
        }
        .face-placeholder {
          width: 100%;
          max-width: 640px;
          aspect-ratio: 16 / 9;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.45);
          display: grid;
          place-items: center;
          text-align: center;
          padding: 16px;
        }
        .input-row {
          width: 100%;
          max-width: 640px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }
        .chip-row {
          width: 100%;
          max-width: 640px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 4px;
          color: #ffffff;
          padding: 8px 10px;
          font-family: 'Courier New', Courier, monospace;
          cursor: pointer;
        }
        .chip:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
        }
        .chip:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.84);
          backdrop-filter: blur(4px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 200ms ease;
          z-index: 4;
        }
        .overlay.show {
          opacity: 1;
          pointer-events: auto;
        }
        .overlay-card {
          width: calc(100% - 32px);
          max-width: 520px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: #000000;
          padding: 24px;
        }
        .overlay-card h2 {
          margin: 0 0 10px;
          font-size: 28px;
        }
        .overlay-card p {
          margin: 0 0 16px;
          color: rgba(255, 255, 255, 0.45);
          line-height: 1.5;
        }
        .joined-state {
          text-align: center;
          padding: 12px 4px;
        }
        .checkmark {
          font-size: 52px;
          margin-bottom: 10px;
        }
        @media (max-width: 700px) {
          .top-bar {
            height: 70px;
          }
          .screen-full {
            padding-top: 70px;
          }
          .logo.left {
            font-size: 20px;
          }
          .timer {
            font-size: 18px;
          }
          .input-row {
            grid-template-columns: 1fr;
          }
          .btn {
            width: 100%;
          }
        }
      `}</style>
      <AppProvider>
        <RouterView />
      </AppProvider>
    </>
  );
}
