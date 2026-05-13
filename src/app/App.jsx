'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getClientAuth, getClientDb, googleProvider, isFirebaseConfigured } from '@/lib/firebase';

const MOCK_DELAY_MS = 400;
let mockFetchInstalled = false;
const FIREBASE_ENABLED = isFirebaseConfigured();

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

  return createMockFetchResponse(404, { error: 'Not found' });
}

function installMockFetch() {
  if (typeof globalThis === 'undefined' || mockFetchInstalled) {
    return;
  }

  const nativeFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
  const mockedApiPaths = new Set(['/api/auth/login', '/api/onboarding', '/api/demo/start', '/api/demo/end']);

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (mockedApiPaths.has(url)) {
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

async function apiDemoEnd(payload) {
  return postJSON('/api/demo/end', payload);
}

async function apiWaitlist(payload) {
  try {
    return await postJSON('/api/waitlist', payload);
  } catch (_error) {
    return { ok: true, status: 200, data: { success: true, mocked: true } };
  }
}

async function getOnboardingRecord(uid) {
  try {
    const snapshot = await getDoc(doc(getClientDb(), 'onboarding', uid));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (_error) {
    return null;
  }
}

const AppContext = createContext(null);

function AppProvider({ children }) {
  const [authToken, setAuthToken] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [authReady, setAuthReady] = useState(!FIREBASE_ENABLED);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    role: '',
    interest: '',
    referral: '',
    profession: '',
    dob: '',
  });

  useEffect(() => {
    if (!FIREBASE_ENABLED) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(getClientAuth(), async (user) => {
      if (!user) {
        setAuthToken('');
        setUserId('');
        setEmail('');
        setOnboardingComplete(false);
        setAuthReady(true);
        return;
      }

      const token = await user.getIdToken().catch(() => '');
      const onboardingRecord = await getOnboardingRecord(user.uid);

      setAuthToken(token);
      setUserId(user.uid);
      setEmail(user.email || '');
      setOnboardingComplete(Boolean(onboardingRecord?.completed));
      setOnboardingData((previous) => ({
        ...previous,
        name: user.displayName || previous.name,
        referral: onboardingRecord?.where_heard || previous.referral,
        profession: onboardingRecord?.job_title || previous.profession,
        dob: onboardingRecord?.dob || previous.dob,
      }));
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      authToken,
      setAuthToken,
      userId,
      setUserId,
      email,
      setEmail,
      authReady,
      onboardingComplete,
      setOnboardingComplete,
      onboardingData,
      setOnboardingData,
    }),
    [authToken, userId, email, authReady, onboardingComplete, onboardingData]
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

function HeaderBar() {
  return (
    <header className="header-shell">
      <div className="header-brand">
        <img src="/images/logo.png" alt="DGEN Technologies" className="brand-logo" />
      </div>
    </header>
  );
}

function FooterBar() {
  return (
    <footer className="footer-shell">
      <span>© 2024 DGEN Technologies. All rights reserved.</span>
      <div className="footer-links">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
        <a href="#">Contact Support</a>
      </div>
    </footer>
  );
}

function LoginPage({ push }) {
  const { setAuthToken, setUserId, setEmail, setOnboardingData, setOnboardingComplete } = useAppContext();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!termsAccepted) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    if (FIREBASE_ENABLED) {
      try {
        const credential = await createUserWithEmailAndPassword(getClientAuth(), emailValue, password);
        const fullName = `${firstName} ${lastName}`.trim();

        if (fullName) {
          await updateProfile(credential.user, { displayName: fullName });
        }

        setAuthToken(await credential.user.getIdToken());
        setUserId(credential.user.uid);
        setEmail(credential.user.email || emailValue);
        setOnboardingComplete(false);
        setOnboardingData((prev) => ({ ...prev, name: fullName }));
        setLoading(false);
        push('/onboarding');
        return;
      } catch (authError) {
        const code = authError?.code || '';
        if (code === 'auth/email-already-in-use') {
          setError('Account already exists. Continue with Google or use a different email.');
        } else if (code === 'auth/weak-password') {
          setError('Password must be at least 6 characters.');
        } else if (code === 'auth/invalid-email') {
          setError('Enter a valid email address.');
        } else {
          setError('Authentication failed. Please try again.');
        }
        setLoading(false);
        return;
      }
    }

    const result = await apiAuthLogin(emailValue, password);

    if (!result.ok) {
      setError(result.data.error || 'Unable to sign in');
      setLoading(false);
      return;
    }

    setAuthToken(result.data.token);
    setUserId(result.data.userId);
    setEmail(emailValue);
    setOnboardingComplete(false);
    setOnboardingData((prev) => ({ ...prev, name: `${firstName} ${lastName}`.trim() }));
    setLoading(false);
    push('/onboarding');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    if (FIREBASE_ENABLED) {
      try {
        const credential = await signInWithPopup(getClientAuth(), googleProvider);
        const onboardingRecord = await getOnboardingRecord(credential.user.uid);

        setAuthToken(await credential.user.getIdToken());
        setUserId(credential.user.uid);
        setEmail(credential.user.email || '');
        setOnboardingComplete(Boolean(onboardingRecord?.completed));
        setOnboardingData((prev) => ({
          ...prev,
          name: credential.user.displayName || prev.name,
          referral: onboardingRecord?.where_heard || prev.referral,
          profession: onboardingRecord?.job_title || prev.profession,
          dob: onboardingRecord?.dob || prev.dob,
        }));
        setLoading(false);
        push(onboardingRecord?.completed ? '/demo' : '/onboarding');
        return;
      } catch (_authError) {
        setError('Google sign-in failed. Please try again.');
        setLoading(false);
        return;
      }
    }

    setAuthToken('mock-google-token');
    setUserId('usr_google_001');
    setEmail(emailValue || 'google.user@example.com');
    setOnboardingComplete(false);
    setLoading(false);
    push('/onboarding');
  };

  return (
    <main className="site-root">
      <div className="premium-gradient-bg" aria-hidden="true" />
      <HeaderBar />

      <section className="landing-main">
        <aside className="landing-left">
          <img
            src="/images/login-image.png"
            alt="ADAM robot"
            className="landing-left-image"
          />
        </aside>

        <section className="landing-right">
          <div className="form-card">
            <div className="form-heading">
              <h2>Create an Account</h2>
              <p>Start your journey with DGEN today.</p>
            </div>

            <form className="stack-lg" onSubmit={handleSubmit}>
              <div className="grid-two">
                <div className="stack-sm">
                  <label htmlFor="first-name">FIRST NAME</label>
                  <input
                    id="first-name"
                    className="input-light"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="stack-sm">
                  <label htmlFor="last-name">LAST NAME</label>
                  <input
                    id="last-name"
                    className="input-light"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="stack-sm">
                <label htmlFor="email">EMAIL ADDRESS</label>
                <input
                  id="email"
                  className="input-light"
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  required
                />
              </div>

              <div className="stack-sm">
                <label htmlFor="password">PASSWORD</label>
                <input
                  id="password"
                  className="input-light"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="stack-sm">
                <label htmlFor="confirm-password">CONFIRM PASSWORD</label>
                <input
                  id="confirm-password"
                  className="input-light"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <label className="terms-row">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                <span>
                  I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
                </span>
              </label>

              {error ? <p className="error-text dark">{error}</p> : null}

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Signing Up...' : 'Sign Up'}
              </button>

              <div className="or-divider">
                <span>or continue with</span>
              </div>

              <button type="button" className="btn-google" onClick={handleGoogleSignIn} disabled={loading}>
                <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}

function OnboardingPage({ push }) {
  const { userId, email, onboardingData, setOnboardingData, setOnboardingComplete } = useAppContext();
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
    const { name, referral, profession, dob } = onboardingData;

    if (!referral || !profession || !dob) {
      setError('Please complete all onboarding fields.');
      return;
    }

    setLoading(true);
    setError('');
    if (FIREBASE_ENABLED && userId) {
      try {
        const authUser = getClientAuth().currentUser;
        const providerIds = authUser?.providerData
          .map((provider) => provider?.providerId)
          .filter(Boolean) || [];
        const primaryProvider = providerIds[0] || 'unknown';

        await setDoc(doc(getClientDb(), 'onboarding', userId), {
          uid: userId,
          email,
          display_name: authUser?.displayName || name || '',
          where_heard: referral,
          job_title: profession,
          dob,
          use_case: '',
          completed: true,
          completed_at: new Date().toISOString(),
        });

        await setDoc(doc(getClientDb(), 'adamUsers', userId), {
          uid: userId,
          email: email || authUser?.email || '',
          name: authUser?.displayName || name || '',
          displayName: authUser?.displayName || name || '',
          photoURL: authUser?.photoURL || '',
          phoneNumber: authUser?.phoneNumber || '',
          emailVerified: Boolean(authUser?.emailVerified),
          providerIds,
          primaryProvider,
          authSource: 'firebase_client',
          whereHeard: referral,
          jobTitle: profession,
          dob,
          useCase: '',
          onboardingCompleted: true,
          onboardingCompletedAt: serverTimestamp(),
          accountCreatedAtRaw: authUser?.metadata.creationTime || null,
          lastSignInAtRaw: authUser?.metadata.lastSignInTime || null,
          lastSeenAt: serverTimestamp(),
        }, { merge: true });

        setOnboardingComplete(true);
        setLoading(false);
        push('/demo');
        return;
      } catch (firestoreError) {
        console.error('[onboarding] Firestore write failed:', firestoreError);
        setError('Unable to save onboarding right now.');
        setLoading(false);
        return;
      }
    }

    const result = await apiOnboarding({
      userId,
      name,
      source: referral,
      profession,
      dob,
    });
    setLoading(false);

    if (!result.ok) {
      setError('Unable to continue right now.');
      return;
    }

    setOnboardingComplete(true);
    push('/demo');
  };

  return (
    <main className="onboarding-page">
      <section className="onboarding-shell">
        <div className="onboarding-progress">
          <div className="onboarding-progress-row">
            <span>Onboarding Progress</span>
            <strong>33% Complete</strong>
          </div>
          <div className="onboarding-progress-bar">
            <div className="onboarding-progress-fill" />
          </div>
        </div>

        <header className="onboarding-header">
          <h2>Welcome to ADAM</h2>
          <p>Tell us a little about yourself to initialize your profile.</p>
        </header>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="stack-sm">
            <label htmlFor="onb-referral">How did you hear about ADAM?</label>
            <select
              id="onb-referral"
              className="input-light onboarding-input"
              value={onboardingData.referral}
              onChange={(e) => updateField('referral', e.target.value)}
              required
            >
              <option value="">Select an option</option>
              <option value="Social Media">Social Media</option>
              <option value="Professional Referral">Professional Referral</option>
              <option value="Search Engine">Search Engine</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="stack-sm">
            <label htmlFor="onb-profession">Profession</label>
            <input
              id="onb-profession"
              className="input-light onboarding-input"
              type="text"
              placeholder="e.g. Software Engineer"
              value={onboardingData.profession}
              onChange={(e) => updateField('profession', e.target.value)}
              required
            />
          </div>

          <div className="stack-sm">
            <label htmlFor="onb-dob">Date of Birth</label>
            <input
              id="onb-dob"
              className="input-light onboarding-input"
              type="date"
              value={onboardingData.dob}
              onChange={(e) => updateField('dob', e.target.value)}
              required
            />
          </div>

          {error ? <p className="error-text dark">{error}</p> : null}

          <div className="onboarding-actions">
            <button className="onboarding-back" type="button" onClick={() => push('/')}>
              Back
            </button>
            <button className="btn-primary onboarding-next" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Next'}
            </button>
          </div>
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
      setTimeLeft((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => clearInterval(intervalRef.current);
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

  const beginSession = async () => {
    setWelcomeOpen(false);
    setDemoStarted(true);
    await apiDemoStart({ userId, startTime: Date.now() });
  };

  const timerColor = timeLeft <= 30 ? '#dc2626' : timeLeft <= 60 ? '#d97706' : '#56e083';
  const telemetryItems = [
    { label: 'Microphone', value: 'Active', icon: 'mic' },
    { label: 'Low-Latency Link', value: '12ms', icon: 'wifi' },
    { label: 'Vision Feed', value: 'Standby', icon: 'videocam', muted: true },
  ];
  const transcript = [
    {
      speaker: 'ADAM',
      time: '14:02',
      text: 'Hello! I\'ve completed the analysis of the quarterly data. Would you like me to walk you through the key performance indicators first, or should we jump straight to the forecasting models?',
      tone: 'adam',
    },
    {
      speaker: 'YOU',
      time: '14:03',
      text: 'Let\'s start with the KPIs. Focus specifically on the retention rates in the enterprise sector.',
      tone: 'user',
    },
    {
      speaker: 'ADAM',
      time: '14:03',
      text: 'Understood. Fetching the retention metrics for Enterprise accounts...',
      tone: 'adam-active',
    },
  ];

  return (
    <main className="demo-console-page">
      <div className="demo-console-bg" aria-hidden="true" />
      <div className="demo-console-overlay" aria-hidden="true" />

      <header className="demo-console-topbar">
        <div className="header-brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark-cut" />
          </span>
          <span className="brand-text">ADAM | Live Dashboard</span>
        </div>
        <p className="demo-timer mono-timer" style={{ color: timerColor }}>{formatRemaining(timeLeft)}</p>
      </header>

      <main className={`demo-console-shell ${welcomeOpen ? 'blurred' : ''}`}>
        <aside className="demo-console-sidebar">
          <section className="glass-panel console-card console-card-tight">
            <span className="console-eyebrow">AI Module Status</span>
            <div className="console-card-head">
              <h2>Core Intelligence</h2>
              <span className="status-dot" />
            </div>
            <div className="console-metric">
              <div className="console-metric-row">
                <span>Neural Load</span>
                <span>24%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: '24%' }} />
              </div>
            </div>
            <div className="console-footnote">
              <span className="material-symbols-outlined console-footnote-icon">memory</span>
              <span>LMM-V4 Optimized Engine</span>
            </div>
          </section>

          <section className="glass-panel console-card console-card-tight console-card-flex">
            <span className="console-eyebrow">System Status</span>
            <div className="console-status-list">
              {telemetryItems.map((item) => (
                <div key={item.label} className="console-status-row">
                  <div className="console-status-icon">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <div>
                    <div className={`console-status-label ${item.muted ? 'muted' : ''}`}>{item.label}</div>
                    <div className={`console-status-value ${item.muted ? 'muted' : ''}`}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="console-secure">
              <div className="console-secure-head">
                <span className="material-symbols-outlined console-footnote-icon">shield_with_heart</span>
                <span>Secure Session</span>
              </div>
              <p>Transcription encrypted in real-time.</p>
            </div>
          </section>
        </aside>

        <section className="demo-console-center">
          <div className="demo-hero-panel glass-panel">
            <div className="demo-hero-image-wrap">
              <img src="/images/bg.png" alt="ADAM live console visual" className="demo-hero-image" />
            </div>
            <div className="demo-hero-bottom-bar">
              <div>
                <div className="demo-hero-label">Session</div>
                <div className="demo-hero-value">{onboardingData.name || 'Guest'} · {demoStarted ? 'Active' : 'Paused'}</div>
              </div>
              <div className="demo-hero-waveform" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="demo-input-card glass-panel">
            <input
              className="console-input"
              type="text"
              placeholder="Type your query for ADAM"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={endOpen || !demoStarted}
            />
            <button className="console-send-btn" type="button" disabled={endOpen || !demoStarted}>
              Send
            </button>
          </div>

          <div className="console-chip-row">
            {['What can you do?', 'Tell me a joke', 'Control my lights'].map((chip) => (
              <button
                key={chip}
                className="console-chip"
                type="button"
                disabled={endOpen || !demoStarted}
                onClick={() => setQuery(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        <aside className="demo-console-chat">
          <section className="glass-panel console-chat-panel">
            <div className="console-chat-head">
              <div className="header-brand chat-brand">
                <span className="chat-icon material-symbols-outlined">chat_bubble</span>
                <div>
                  <h3>Live Conversation</h3>
                  <p>Real-time transcript</p>
                </div>
              </div>
            </div>

            <div className="console-chat-stream scroll-hide">
              {transcript.map((message) => (
                <div
                  key={`${message.speaker}-${message.time}-${message.text.slice(0, 12)}`}
                  className={`console-message ${message.tone}`}
                >
                  <div className="console-message-meta">
                    <span className={`console-message-speaker ${message.tone}`}>{message.speaker}</span>
                    <span>{message.time}</span>
                  </div>
                  <div className={`console-message-bubble ${message.tone}`}>
                    {message.text}
                    {message.tone === 'adam-active' ? (
                      <div className="console-thinking-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>

      <div className={`demo-welcome-overlay ${welcomeOpen ? 'show' : ''}`} aria-hidden={!welcomeOpen}>
        <div className="glass-panel demo-welcome-card">
          <h1>Welcome to the ADAM Experience</h1>
          <p>Your session is ready. ADAM is online and awaiting your first command.</p>
          <button className="demo-welcome-button" type="button" onClick={beginSession}>
            Begin Session
          </button>
        </div>
      </div>

      {endOpen ? (
        <div className="demo-end-banner" role="status" aria-live="polite">
          <div>
            <h2>Your demo session has ended.</h2>
            <p>Join the waitlist to get early access.</p>
          </div>
          <button className="btn-dark" type="button" onClick={() => push('/waitlist')}>Join the waitlist -&gt;</button>
        </div>
      ) : null}
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

    const result = await apiWaitlist({
      name,
      email: emailValue,
      company: '',
      use_case: message,
      referral: onboardingData.referral,
    });
    setLoading(false);

    if (!result.ok && !result.data?.success) {
      setError('Unable to join right now.');
      return;
    }

    setJoined(true);
  };

  return (
    <main className="flow-page">
      <section className="flow-card">
        {!joined ? (
          <>
            <h2 className="flow-title">Be the first to get ADAM.</h2>
            <p className="flow-subtitle">Early access opens soon. Drop your email and we&apos;ll reach out.</p>

            <form className="stack-lg" onSubmit={handleSubmit}>
              <div className="stack-sm">
                <label htmlFor="wl-name">Full name</label>
                <input
                  id="wl-name"
                  className="input-dark"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="stack-sm">
                <label htmlFor="wl-email">Email</label>
                <input
                  id="wl-email"
                  className="input-dark"
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  required
                />
              </div>

              <div className="stack-sm">
                <label htmlFor="wl-message">Anything you&apos;d like us to know?</label>
                <textarea
                  id="wl-message"
                  className="input-dark"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {error ? <p className="error-text">{error}</p> : null}

              <button className="btn-dark" type="submit" disabled={loading}>
                {loading ? 'Joining...' : 'Join waitlist'}
              </button>
            </form>
          </>
        ) : (
          <div className="joined-state-dark">
            <div className="checkmark">✓</div>
            <h2 className="flow-title">You&apos;re on the list.</h2>
            <p className="flow-subtitle">We&apos;ll be in touch soon. Follow @DGENTech for updates.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function RouterView() {
  const { route, push } = useHashRouter();
  const { authToken, userId, authReady, onboardingComplete } = useAppContext();

  useEffect(() => {
    if (!authReady || !authToken || route !== '/') {
      return;
    }

    push(onboardingComplete ? '/demo' : '/onboarding');
  }, [authReady, authToken, onboardingComplete, push, route]);

  if (!authReady) {
    return null;
  }

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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        :root {
          --green-main: #56e083;
          --green-strong: #19b35c;
          --text-charcoal: #131313;
          --surface: #ffffff;
          --surface-container: #f5f5f5;
          --surface-variant: #f0f2f0;
          --border-soft: rgba(19, 19, 19, 0.1);
          --dark-bg: #131313;
          --dark-surface: #1f1f1f;
          --dark-border: #353535;
          --dark-text: #e2e2e2;
          --dark-muted: #a8a8a8;
        }

        * { box-sizing: border-box; }

        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
          font-family: 'Inter', sans-serif;
          color: var(--text-charcoal);
          background: var(--surface);
        }

        h1, h2, h3, .brand-text {
          font-family: 'Space Grotesk', sans-serif;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .site-root {
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: var(--surface);
          position: relative;
        }

        .premium-gradient-bg {
          background: linear-gradient(-45deg, #19b35c, #ffffff, #ccff00, #ffffff);
          background-size: 400% 400%;
          animation: gradientAnimation 15s ease infinite;
          position: fixed;
          inset: 0;
          z-index: 0;
          opacity: 0.15;
          pointer-events: none;
        }

        @keyframes gradientAnimation {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .header-shell {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 48px;
          border-bottom: 1px solid var(--border-soft);
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(12px);
          z-index: 20;
        }

        .brand-logo {
          height: 38px;
          width: auto;
          display: block;
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-mark {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: var(--green-main);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .brand-mark-cut {
          width: 16px;
          height: 16px;
          border-radius: 0 0 0 999px;
          background: #ffffff;
          display: block;
        }

        .brand-text {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
          text-transform: lowercase;
        }

        .header-link {
          border: 0;
          background: transparent;
          color: var(--text-charcoal);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .landing-main {
          flex: 1;
          display: flex;
          padding-top: 62px;
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        .landing-left {
          width: 50%;
          background: var(--surface-container);
          position: relative;
          overflow: hidden;
          display: none;
        }

        .landing-left-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
        }

        .landing-right {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px 16px;
          overflow-y: auto;
        }

        .form-card {
          width: 100%;
          max-width: 500px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 12px;
          padding: 22px 24px;
          backdrop-filter: blur(12px);
        }

        .form-heading {
          margin-bottom: 16px;
        }

        .form-heading h2 {
          margin: 0 0 4px;
          font-size: 24px;
          line-height: 30px;
          letter-spacing: -0.01em;
        }

        .form-heading p {
          margin: 0;
          color: rgba(19, 19, 19, 0.6);
          font-size: 13px;
        }

        .stack-lg {
          display: grid;
          gap: 10px;
        }

        .stack-sm {
          display: grid;
          gap: 4px;
        }

        .grid-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .stack-sm label,
        .radio-group-dark legend {
          font-size: 10px;
          letter-spacing: 0.08em;
          font-weight: 700;
          color: rgba(19, 19, 19, 0.55);
          text-transform: uppercase;
        }

        .input-light {
          width: 100%;
          border: 1px solid transparent;
          border-radius: 8px;
          background: var(--surface-variant);
          color: var(--text-charcoal);
          padding: 8px 12px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 200ms ease, background-color 200ms ease;
        }

        .input-light:focus {
          border-color: var(--green-main);
          background: #ffffff;
        }

        .terms-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(19, 19, 19, 0.6);
        }

        .terms-row a {
          color: var(--green-strong);
        }

        .btn-primary {
          width: 100%;
          border: 0;
          border-radius: 8px;
          padding: 11px 14px;
          background: var(--green-main);
          color: #003918;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .or-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin: 0;
        }

        .or-divider::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          border-top: 1px solid var(--border-soft);
        }

        .or-divider span {
          position: relative;
          z-index: 1;
          padding: 0 10px;
          background: rgba(255, 255, 255, 0.95);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.08em;
          color: rgba(19, 19, 19, 0.45);
        }

        .btn-google {
          width: 100%;
          border: 1px solid rgba(19,19,19,0.13);
          border-radius: 8px;
          background: #ffffff;
          color: var(--text-charcoal);
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 180ms ease, box-shadow 180ms ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.01em;
        }

        .btn-google:hover {
          background: #f8f8f8;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        .google-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .footer-shell {
          width: 100%;
          border-top: 1px solid var(--border-soft);
          background: #ffffff;
          color: rgba(19, 19, 19, 0.45);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 12px 48px;
          font-size: 11px;
          position: relative;
          z-index: 10;
          flex-shrink: 0;
        }

        .footer-links {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .onboarding-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px 16px;
          background: #ffffff;
          background-image: radial-gradient(circle at 50% 40%, #f9f9f9 0%, #f9f9f9 42%, rgba(204, 255, 0, 0.15) 72%, rgba(19, 19, 19, 0.05) 100%);
          background-size: 200% 200%;
          animation: gradientAnimation 15s ease infinite;
          color: var(--text-charcoal);
          position: relative;
          overflow: hidden;
        }

        .onboarding-shell {
          width: 100%;
          max-width: 540px;
          position: relative;
          z-index: 1;
          padding: 8px 0;
          pointer-events: auto;
        }

        .onboarding-progress {
          margin-bottom: 36px;
        }

        .onboarding-progress-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          gap: 12px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(19, 19, 19, 0.55);
        }

        .onboarding-progress-row strong {
          color: var(--green-strong);
          font-weight: 700;
        }

        .onboarding-progress-bar {
          width: 100%;
          height: 4px;
          border-radius: 999px;
          background: #ececec;
          overflow: hidden;
        }

        .onboarding-progress-fill {
          width: 33%;
          height: 100%;
          border-radius: 999px;
          background: var(--green-main);
          box-shadow: 0 0 8px rgba(86, 224, 131, 0.35);
        }

        .onboarding-header {
          margin-bottom: 28px;
        }

        .onboarding-header h2 {
          margin: 0 0 8px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 22px;
          line-height: 30px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .onboarding-header p {
          margin: 0;
          font-size: 14px;
          line-height: 22px;
          color: rgba(19, 19, 19, 0.58);
        }

        .onboarding-form {
          display: grid;
          gap: 24px;
        }

        .onboarding-input {
          min-height: 52px;
          border-radius: 10px;
          background: #f4f4f4;
          border-color: transparent;
          padding: 14px 16px;
          font-size: 14px;
          box-shadow: none;
        }

        .onboarding-input:focus {
          border-color: var(--green-main);
          box-shadow: 0 0 0 2px rgba(86, 224, 131, 0.2);
          background: #ffffff;
        }

        .onboarding-actions {
          padding-top: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .onboarding-back {
          border: 0;
          background: transparent;
          color: rgba(19, 19, 19, 0.38);
          font-family: 'Space Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.03em;
          cursor: pointer;
          padding: 8px 0;
        }

        .onboarding-next {
          width: auto;
          min-width: 132px;
          padding: 12px 24px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          box-shadow: 0 12px 24px rgba(86, 224, 131, 0.22);
        }

        .flow-page {
          min-height: 100vh;
          background: var(--dark-bg);
          color: var(--dark-text);
          display: grid;
          place-items: center;
          padding: 24px 16px;
        }

        .flow-card {
          width: 100%;
          max-width: 560px;
          border: 1px solid var(--dark-border);
          border-radius: 16px;
          background: var(--dark-surface);
          padding: 28px;
        }

        .flow-title {
          margin: 0 0 10px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 28px;
          line-height: 36px;
        }

        .flow-subtitle {
          margin: 0 0 18px;
          color: var(--dark-muted);
        }

        .step-row {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 18px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #3d4a3e;
        }

        .dot.active {
          background: var(--green-main);
        }

        .input-dark {
          width: 100%;
          border: 1px solid #3d4a3e;
          border-radius: 8px;
          background: #131313;
          color: var(--dark-text);
          padding: 12px 14px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 200ms ease;
        }

        .input-dark:focus {
          border-color: var(--green-main);
        }

        .radio-group-dark {
          margin: 0;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 12px;
          display: grid;
          gap: 8px;
        }

        .radio-group-dark label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--dark-text);
        }

        .btn-dark {
          border: 1px solid var(--green-strong);
          background: var(--green-strong);
          color: #00210b;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
        }

        .btn-dark:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .demo-root {
          min-height: 100vh;
          background: var(--dark-bg);
          color: var(--dark-text);
          position: relative;
        }

        .demo-console-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          color: #181c1e;
          background: #d7dadd;
          background-image: url('/images/bg.png');
          background-size: cover;
          background-position: center center;
          background-attachment: fixed;
        }

        .demo-console-overlay {
          position: fixed;
          inset: 0;
          background: rgba(215, 218, 221, 0.36);
          backdrop-filter: blur(1px);
          pointer-events: none;
          z-index: 0;
        }

        .demo-console-bg {
          position: fixed;
          inset: 0;
          background: linear-gradient(180deg, rgba(215, 218, 221, 0.18), rgba(215, 218, 221, 0.45));
          pointer-events: none;
          z-index: 0;
        }

        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(18, 20, 16, 0.08);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.16);
        }

        .scroll-hide::-webkit-scrollbar { display: none; }
        .scroll-hide { -ms-overflow-style: none; scrollbar-width: none; }

        .mono-timer {
          font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }

        .demo-console-topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 20;
          height: 64px;
          border-bottom: 1px solid rgba(124, 130, 96, 0.18);
          background: rgba(255, 255, 255, 0.42);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
        }

        .demo-console-shell {
          position: relative;
          z-index: 1;
          height: 100vh;
          padding: 80px 24px 24px;
          display: grid;
          grid-template-columns: 256px minmax(0, 1fr) 400px;
          gap: 24px;
          overflow: hidden;
        }

        .demo-console-shell.blurred {
          filter: blur(14px);
          transform: scale(1.01);
        }

        .demo-console-sidebar,
        .demo-console-chat {
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-height: 0;
        }

        .console-card {
          border-radius: 18px;
          padding: 16px;
        }

        .console-card-tight {
          min-height: 220px;
        }

        .console-card-flex {
          flex: 1;
          justify-content: space-between;
        }

        .console-eyebrow {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(24, 28, 30, 0.56);
          margin-bottom: 8px;
        }

        .console-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .console-card-head h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--primary);
          box-shadow: 0 0 8px rgba(25, 179, 92, 0.6);
          margin-top: 6px;
          flex-shrink: 0;
        }

        .console-metric-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 11px;
          font-weight: 800;
          color: rgba(24, 28, 30, 0.48);
        }

        .progress-track {
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: rgba(235, 238, 241, 1);
          overflow: hidden;
          margin-top: 8px;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: var(--primary);
        }

        .console-footnote {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(116, 122, 96, 0.12);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: rgba(24, 28, 30, 0.62);
          font-weight: 600;
        }

        .console-footnote-icon {
          font-size: 18px;
          color: var(--primary);
        }

        .console-status-list {
          display: grid;
          gap: 16px;
        }

        .console-status-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .console-status-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(241, 244, 247, 0.92);
          display: grid;
          place-items: center;
          color: var(--primary);
          flex-shrink: 0;
        }

        .console-status-icon .material-symbols-outlined {
          font-size: 20px;
        }

        .console-status-label {
          font-size: 14px;
          font-weight: 800;
          color: #181c1e;
        }

        .console-status-value {
          font-size: 11px;
          font-weight: 800;
          color: var(--primary);
        }

        .console-status-label.muted,
        .console-status-value.muted {
          color: rgba(68, 73, 51, 0.6);
        }

        .console-secure {
          margin-top: auto;
          border-radius: 14px;
          padding: 14px;
          background: rgba(25, 179, 92, 0.05);
          border: 1px solid rgba(25, 179, 92, 0.1);
        }

        .console-secure-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          font-size: 11px;
          font-weight: 800;
        }

        .console-secure p {
          margin: 0;
          font-size: 10px;
          color: rgba(68, 73, 51, 0.72);
          line-height: 1.35;
        }

        .demo-console-center {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          min-height: 0;
        }

        .demo-hero-panel {
          border-radius: 18px;
          overflow: hidden;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .demo-hero-image-wrap {
          flex: 1;
          min-height: 0;
          position: relative;
          overflow: hidden;
        }

        .demo-hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
        }

        .demo-hero-image-wrap::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.06));
          pointer-events: none;
        }

        .demo-hero-bottom-bar {
          padding: 14px 18px;
          border-top: 1px solid rgba(18, 20, 16, 0.08);
          background: rgba(255, 255, 255, 0.42);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .demo-hero-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(68, 73, 51, 0.58);
          margin-bottom: 4px;
        }

        .demo-hero-value {
          font-size: 14px;
          font-weight: 800;
          color: #181c1e;
        }

        .demo-hero-waveform {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 72px;
          justify-content: flex-end;
        }

        .demo-hero-waveform span {
          width: 3px;
          height: 4px;
          border-radius: 999px;
          background: var(--primary);
          animation: wave 1.2s infinite ease-in-out;
        }

        .demo-hero-waveform span:nth-child(2) { animation-delay: 0.08s; }
        .demo-hero-waveform span:nth-child(3) { animation-delay: 0.16s; }
        .demo-hero-waveform span:nth-child(4) { animation-delay: 0.24s; }
        .demo-hero-waveform span:nth-child(5) { animation-delay: 0.32s; }
        .demo-hero-waveform span:nth-child(6) { animation-delay: 0.4s; }

        .demo-input-card {
          border-radius: 16px;
          padding: 10px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }

        .console-input {
          min-width: 0;
          height: 48px;
          border: 1px solid rgba(18, 20, 16, 0.08);
          border-radius: 12px;
          background: rgba(255,255,255,0.92);
          padding: 0 14px;
          color: #181c1e;
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          outline: none;
        }

        .console-input:focus {
          border-color: rgba(25, 179, 92, 0.5);
          box-shadow: 0 0 0 3px rgba(25, 179, 92, 0.12);
        }

        .console-send-btn {
          height: 48px;
          border: 0;
          border-radius: 12px;
          background: var(--primary);
          color: #ffffff;
          padding: 0 20px;
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(25, 179, 92, 0.22);
        }

        .console-send-btn:disabled,
        .console-chip:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .console-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .console-chip {
          border: 1px solid rgba(18, 20, 16, 0.08);
          border-radius: 999px;
          background: rgba(255,255,255,0.62);
          color: #181c1e;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .demo-console-chat {
          min-height: 0;
        }

        .console-chat-panel {
          height: 100%;
          min-height: 0;
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .console-chat-head {
          padding: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.15);
        }

        .chat-brand {
          align-items: center;
          gap: 12px;
        }

        .chat-icon {
          color: var(--primary);
        }

        .chat-brand h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
        }

        .chat-brand p {
          margin: 2px 0 0;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(68, 73, 51, 0.48);
        }

        .console-chat-stream {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 18px 16px;
          display: grid;
          gap: 20px;
          align-content: start;
          background: transparent;
        }

        .console-message {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-width: 90%;
        }

        .console-message.user {
          margin-left: auto;
          align-items: flex-end;
        }

        .console-message-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-weight: 800;
          color: rgba(68, 73, 51, 0.4);
        }

        .console-message-speaker {
          color: var(--primary);
        }

        .console-message-speaker.user {
          color: #181c1e;
        }

        .console-message-bubble {
          border-radius: 16px;
          padding: 14px;
          font-size: 13px;
          line-height: 1.55;
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }

        .console-message-bubble.adam,
        .console-message-bubble.adam-active {
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(18, 20, 16, 0.08);
          border-top-left-radius: 4px;
        }

        .console-message-bubble.user {
          background: rgba(25, 179, 92, 0.14);
          border: 1px solid rgba(25, 179, 92, 0.18);
          border-top-right-radius: 4px;
        }

        .console-thinking-dots {
          display: flex;
          gap: 4px;
          margin-top: 12px;
        }

        .console-thinking-dots span {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--primary);
          animation: wave 1.2s infinite ease-in-out;
        }

        .console-thinking-dots span:nth-child(2) { animation-delay: 0.1s; }
        .console-thinking-dots span:nth-child(3) { animation-delay: 0.2s; }

        .demo-welcome-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(16px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 180ms ease;
        }

        .demo-welcome-overlay.show {
          opacity: 1;
          pointer-events: auto;
        }

        .demo-welcome-card {
          width: 100%;
          max-width: 340px;
          border-radius: 14px;
          padding: 20px;
          text-align: center;
          display: grid;
          gap: 10px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
        }

        .demo-welcome-card h1 {
          margin: 0;
          font-size: 18px;
          line-height: 1.3;
          font-weight: 800;
          color: #181c1e;
        }

        .demo-welcome-card p {
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
          color: rgba(68, 73, 51, 0.72);
        }

        .demo-welcome-button {
          width: 100%;
          border: 0;
          border-radius: 10px;
          padding: 12px 16px;
          background: var(--primary);
          color: #ffffff;
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(25, 179, 92, 0.25);
        }

        .demo-welcome-button:hover {
          filter: brightness(0.98);
        }

        @keyframes wave {
          0%, 100% { transform: scaleY(0.7); opacity: 0.7; }
          50% { transform: scaleY(1.8); opacity: 1; }
        }

        @media (min-width: 1180px) {
          .demo-console-shell {
            grid-template-columns: 256px minmax(0, 1fr) 400px;
          }
        }

        @media (max-width: 1179px) {
          .demo-console-shell {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 100vh;
            overflow: auto;
          }

          .demo-console-sidebar,
          .demo-console-chat {
            order: 1;
          }

          .demo-console-center {
            order: 0;
            min-height: 560px;
          }

          .demo-console-chat {
            min-height: 420px;
          }

          .demo-console-sidebar {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .demo-console-shell {
            padding-bottom: 24px;
          }
        }

        @media (max-width: 760px) {
          .demo-console-topbar {
            padding: 0 16px;
          }

          .demo-console-shell {
            padding: 76px 16px 20px;
            gap: 16px;
          }

          .demo-console-sidebar {
            grid-template-columns: 1fr;
          }

          .demo-input-card {
            grid-template-columns: 1fr;
          }

          .demo-hero-bottom-bar {
            flex-direction: column;
            align-items: flex-start;
          }

          .demo-hero-waveform {
            justify-content: flex-start;
          }
        }

        .demo-topbar {
          height: 78px;
          border-bottom: 1px solid #2a2a2a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          position: sticky;
          top: 0;
          z-index: 8;
          background: rgba(19, 19, 19, 0.85);
          backdrop-filter: blur(10px);
        }

        .demo-main {
          max-width: 900px;
          margin: 0 auto;
          padding: 22px 16px 30px;
          display: grid;
          gap: 14px;
        }

        .demo-main.frozen {
          pointer-events: none;
          opacity: 0.45;
        }

        .demo-timer {
          margin: 0;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 24px;
          font-weight: 700;
        }

        .face-placeholder {
          width: 100%;
          max-width: 640px;
          justify-self: center;
          aspect-ratio: 16 / 9;
          border: 1px solid #353535;
          border-radius: 12px;
          background: #1f1f1f;
          color: #bccabb;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 12px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }

        .input-row {
          width: 100%;
          max-width: 640px;
          justify-self: center;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }

        .chip-row {
          width: 100%;
          max-width: 640px;
          justify-self: center;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chip-dark {
          border: 1px solid #3d4a3e;
          background: #1b1b1b;
          color: #bccabb;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          cursor: pointer;
        }

        .chip-dark:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(8px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 200ms ease;
          z-index: 30;
          padding: 16px;
        }

        .overlay.show {
          opacity: 1;
          pointer-events: auto;
        }

        .overlay-card-dark {
          width: 100%;
          max-width: 560px;
          border: 1px solid #3d4a3e;
          border-radius: 12px;
          background: #131313;
          color: var(--dark-text);
          padding: 24px;
        }

        .overlay-card-dark h2 {
          margin: 0 0 10px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 30px;
          line-height: 38px;
        }

        .overlay-card-dark p {
          margin: 0 0 16px;
          color: #bccabb;
          line-height: 1.5;
        }

        .demo-end-banner {
          position: fixed;
          left: 24px;
          right: 24px;
          bottom: 24px;
          z-index: 40;
          border-radius: 18px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(18, 20, 16, 0.08);
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
        }

        .demo-end-banner h2 {
          margin: 0 0 6px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 20px;
          line-height: 1.2;
        }

        .demo-end-banner p {
          margin: 0;
          font-size: 13px;
          color: rgba(24, 28, 30, 0.68);
        }

        .joined-state-dark {
          text-align: center;
        }

        .checkmark {
          font-size: 54px;
          margin-bottom: 10px;
          color: var(--green-main);
        }

        .error-text {
          margin: 0;
          color: #ffb4ab;
          font-size: 13px;
        }

        .error-text.dark {
          color: #93000a;
          background: #ffdad6;
          border: 1px solid #ffb4ab;
          border-radius: 8px;
          padding: 10px;
        }

        @media (min-width: 1024px) {
          .landing-left {
            display: block;
          }

          .landing-right {
            width: 50%;
            padding: 64px;
          }
        }

        @media (max-width: 900px) {
          .header-shell,
          .footer-shell {
            padding-left: 12px;
            padding-right: 12px;
          }

          .footer-shell {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 640px) {
          .grid-two {
            grid-template-columns: 1fr;
          }

          .form-card {
            padding: 20px;
          }

          .form-heading h2 {
            font-size: 28px;
            line-height: 34px;
          }

          .input-row {
            grid-template-columns: 1fr;
          }

          .onboarding-page {
            padding: 20px 16px;
          }

          .onboarding-progress {
            margin-bottom: 28px;
          }

          .onboarding-header {
            margin-bottom: 22px;
          }

          .onboarding-form {
            gap: 18px;
          }

          .onboarding-actions {
            padding-top: 8px;
          }
        }
      `}</style>
      <AppProvider>
        <RouterView />
      </AppProvider>
    </>
  );
}
