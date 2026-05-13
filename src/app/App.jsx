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

async function apiDemoStart(payload) {
  return postJSON('/api/demo/start', payload);
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
          <div className="landing-left-glow" aria-hidden="true" />
          <div className="landing-left-content">
            <h1>Build the future of desktop intelligence.</h1>
            <p>
              Join the next generation of autonomous agents. Experience ADAM&apos;s precision in your daily workflow.
            </p>
            <div className="feature-list">
              <article className="feature-row">
                <span className="feature-icon" aria-hidden="true">⚡</span>
                <div>
                  <h3>Lightning Fast Execution</h3>
                  <p>Sub-second response times for complex task automation.</p>
                </div>
              </article>
              <article className="feature-row">
                <span className="feature-icon" aria-hidden="true">🛡</span>
                <div>
                  <h3>Enterprise-Grade Privacy</h3>
                  <p>Your data stays yours with local-first processing options.</p>
                </div>
              </article>
            </div>
          </div>
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

  const startDemo = async () => {
    setWelcomeOpen(false);
    setDemoStarted(true);
    await apiDemoStart({ userId, startTime: Date.now() });
  };

  const timerColor = timeLeft <= 30 ? '#dc2626' : timeLeft <= 60 ? '#d97706' : '#56e083';

  return (
    <main className="demo-root">
      <div className="premium-gradient-bg" aria-hidden="true" />

      <header className="demo-topbar">
        <div className="header-brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark-cut" />
          </span>
          <span className="brand-text">ADAM demo</span>
        </div>
        <p className="demo-timer" style={{ color: timerColor }}>{formatRemaining(timeLeft)}</p>
      </header>

      <section className={`demo-main ${endOpen ? 'frozen' : ''}`}>
        <div className="face-placeholder">[ ADAM face output ]</div>

        <div className="input-row">
          <input
            className="input-dark"
            type="text"
            placeholder="Type your query for ADAM"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={endOpen || !demoStarted}
          />
          <button className="btn-dark" type="button" disabled={endOpen || !demoStarted}>Send</button>
        </div>

        <div className="chip-row">
          {['What can you do?', 'Tell me a joke', 'Control my lights'].map((chip) => (
            <button
              key={chip}
              className="chip-dark"
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
        <div className="overlay-card-dark">
          <h2>Welcome, {onboardingData.name || 'there'}</h2>
          <p>
            You have 5 minutes with ADAM. Ask anything, explore freely. Your session begins when you click Start.
          </p>
          <button className="btn-dark" type="button" onClick={startDemo}>Start demo</button>
        </div>
      </div>

      <div className={`overlay ${endOpen ? 'show' : ''}`} aria-hidden={!endOpen}>
        <div className="overlay-card-dark">
          <h2>Your demo session has ended.</h2>
          <button className="btn-dark" type="button" onClick={() => push('/waitlist')}>Join the waitlist -&gt;</button>
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

        .landing-left-glow {
          position: absolute;
          top: -120px;
          right: -120px;
          width: 280px;
          height: 280px;
          border-radius: 999px;
          background: rgba(86, 224, 131, 0.15);
          filter: blur(48px);
        }

        .landing-left-content {
          max-width: 560px;
          margin: 0 auto;
          padding: 48px 48px;
          position: relative;
        }

        .landing-left-content h1 {
          margin: 0 0 16px;
          font-size: 38px;
          line-height: 46px;
          letter-spacing: -0.02em;
        }

        .landing-left-content > p {
          margin: 0 0 28px;
          font-size: 16px;
          line-height: 24px;
          color: rgba(19, 19, 19, 0.7);
        }

        .feature-list {
          display: grid;
          gap: 20px;
        }

        .feature-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .feature-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #ffffff;
          color: var(--green-strong);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        .feature-row h3 {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 700;
        }

        .feature-row p {
          margin: 0;
          font-size: 13px;
          color: rgba(19, 19, 19, 0.6);
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
