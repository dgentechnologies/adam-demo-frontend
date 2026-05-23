'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Mail, MessageCircle, User, X } from 'lucide-react';
import { createUserWithEmailAndPassword, isSignInWithEmailLink, onAuthStateChanged, sendEmailVerification, sendSignInLinkToEmail, signInWithEmailLink, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getClientAuth, getClientDb, googleProvider, isFirebaseConfigured } from '@/lib/firebase';

const MOCK_DELAY_MS = 400;
let mockFetchInstalled = false;
const FIREBASE_ENABLED = isFirebaseConfigured();
const PENDING_EMAIL_KEY = 'adam:pending-email';
const EMAIL_LINK_MODE = 'verify-email';

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

  if (method === 'POST' && url === '/api/account-status') {
    return createMockFetchResponse(200, {
      emailVerified: true,
      demoUsed: false,
      waitlistFilled: false,
      tester: false,
      onboardingComplete: false,
    });
  }

  if (method === 'POST' && url === '/api/email-link/send') {
    return createMockFetchResponse(200, { success: true });
  }

  return createMockFetchResponse(404, { error: 'Not found' });
}

function installMockFetch() {
  if (typeof globalThis === 'undefined' || mockFetchInstalled) {
    return;
  }

  const nativeFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
  const mockedApiPaths = new Set(['/api/auth/login', '/api/onboarding', '/api/demo/start', '/api/demo/end', '/api/account-status', '/api/email-link/send']);

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

async function apiAccountStatus(payload) {
  try {
    return await postJSON('/api/account-status', payload);
  } catch (_error) {
    return {
      ok: true,
      status: 200,
      data: {
        emailVerified: true,
        demoUsed: false,
        waitlistFilled: false,
        tester: false,
        onboardingComplete: false,
      },
    };
  }
}

async function apiSendEmailLink(payload) {
  try {
    return await postJSON('/api/email-link/send', payload);
  } catch (_error) {
    return { ok: true, status: 200, data: { success: true } };
  }
}

function readPendingEmail() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(PENDING_EMAIL_KEY) || '';
}

function savePendingEmail(email) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PENDING_EMAIL_KEY, email);
}

function clearPendingEmail() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(PENDING_EMAIL_KEY);
}

function buildEmailActionUrl() {
  if (typeof window === 'undefined') {
    return '/';
  }

  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `#/${EMAIL_LINK_MODE}`;
  return url.toString();
}

async function getOnboardingRecord(uid) {
  try {
    const snapshot = await getDoc(doc(getClientDb(), 'onboarding', uid));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (_error) {
    return null;
  }
}

function roundCoordinate(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10000) / 10000;
}

async function getClientLocationSnapshot() {
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (_error) {
      return '';
    }
  })();

  const locale = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  const base = {
    timezone,
    locale,
    capturedAt: Date.now(),
  };

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { ...base, permission: 'unsupported' };
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({ ...base, ...payload });
    };

    const timeoutId = window.setTimeout(() => {
      finish({ permission: 'timeout' });
    }, 5500);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        finish({
          permission: 'granted',
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null,
        });
      },
      (error) => {
        window.clearTimeout(timeoutId);
        finish({
          permission: error?.code === 1 ? 'denied' : 'unavailable',
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000,
      },
    );
  });
}

const AppContext = createContext(null);

function AppProvider({ children }) {
  const [authToken, setAuthToken] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmailState] = useState(() => readPendingEmail());
  const [authReady, setAuthReady] = useState(!FIREBASE_ENABLED);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [accountStatus, setAccountStatus] = useState({
    loaded: !FIREBASE_ENABLED,
    emailVerified: false,
    demoUsed: false,
    waitlistFilled: false,
    tester: false,
    onboardingComplete: false,
  });
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    role: '',
    interest: '',
    referral: '',
    profession: '',
    dob: '',
    phone: '',
    countryCode: '+91',
    intent: '',
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
        setPendingEmailState(readPendingEmail());
        setOnboardingComplete(false);
        setAccountStatus({
          loaded: true,
          emailVerified: false,
          demoUsed: false,
          waitlistFilled: false,
          tester: false,
          onboardingComplete: false,
        });
        setAuthReady(true);
        return;
      }

      const token = await user.getIdToken().catch(() => '');
      const [onboardingRecord, accountStatusResp] = await Promise.all([
        getOnboardingRecord(user.uid),
        apiAccountStatus({ idToken: token }),
      ]);

      const nextAccountStatus = accountStatusResp.ok ? accountStatusResp.data : {};

      setAuthToken(token);
      setUserId(user.uid);
      setEmail(user.email || '');
      setPendingEmailState(user.email || readPendingEmail());
      setOnboardingComplete(Boolean(onboardingRecord?.completed) || Boolean(nextAccountStatus.onboardingComplete));
      setAccountStatus({
        loaded: true,
        emailVerified: Boolean(nextAccountStatus.emailVerified || user.emailVerified),
        demoUsed: Boolean(nextAccountStatus.demoUsed),
        waitlistFilled: Boolean(nextAccountStatus.waitlistFilled),
        tester: Boolean(nextAccountStatus.tester),
        onboardingComplete: Boolean(onboardingRecord?.completed) || Boolean(nextAccountStatus.onboardingComplete),
      });
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
      pendingEmail,
      setPendingEmail: setPendingEmailState,
      authReady,
      onboardingComplete,
      setOnboardingComplete,
      accountStatus,
      setAccountStatus,
      onboardingData,
      setOnboardingData,
    }),
    [authToken, userId, email, pendingEmail, authReady, onboardingComplete, accountStatus, onboardingData]
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
        <img src="/images/logo.png" alt="Dgen Technologies" className="brand-logo" />
      </div>
    </header>
  );
}

function FooterBar() {
  return (
    <footer className="footer-shell">
      <span>© 2024 Dgen Technologies. All rights reserved.</span>
      <div className="footer-links">
        <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        <a href="#">Contact Support</a>
      </div>
    </footer>
  );
}

function LoginPage({ push }) {
  const { setAuthToken, setUserId, setEmail, setPendingEmail, setOnboardingData, setOnboardingComplete, setAccountStatus } = useAppContext();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

        await sendEmailVerification(credential.user, {
          url: buildEmailActionUrl(),
        });

        savePendingEmail(emailValue);
        setPendingEmail(emailValue);

        setAuthToken(await credential.user.getIdToken());
        setUserId(credential.user.uid);
        setEmail(credential.user.email || emailValue);
        setOnboardingComplete(false);
        setAccountStatus({
          loaded: true,
          emailVerified: false,
          demoUsed: false,
          waitlistFilled: false,
          tester: false,
          onboardingComplete: false,
        });
        setOnboardingData((prev) => ({ ...prev, name: fullName }));
        setLoading(false);
        push('/verify-email');
        return;
      } catch (authError) {
        const code = authError?.code || '';
        if (code === 'auth/email-already-in-use') {
          setError('Account already exists. Continue with Google or use a different email.');
        } else if (code === 'auth/weak-password') {
          setError('Password must be at least 6 characters.');
        } else if (code === 'auth/invalid-email') {
          setError('Enter a valid email address.');
        } else if (code === 'auth/too-many-requests') {
          setError('Too many attempts. Please wait a minute and try again.');
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

      <section className="landing-main login-hero-shell">
        <div className="login-hero-overlay" aria-hidden="true" />
        <div className="form-card">
          <div className="form-heading">
            <h2>Create an Account</h2>
            <p>Start your journey with Dgen today.</p>
          </div>

          <div className="form-scroll-body">
            <form className="stack-lg" onSubmit={handleSubmit}>
              <button type="button" className="btn-google" onClick={handleGoogleSignIn} disabled={loading}>
                <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="or-divider">
                <span>or continue with</span>
              </div>

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
                <div className="input-password-wrap">
                  <input
                    id="password"
                    className="input-light"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="stack-sm">
                <label htmlFor="confirm-password">CONFIRM PASSWORD</label>
                <div className="input-password-wrap">
                  <input
                    id="confirm-password"
                    className="input-light"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <label className="terms-row">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                <span>
                  I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                </span>
              </label>

              {error ? <p className="error-text dark">{error}</p> : null}

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Signing Up...' : 'Sign Up'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function VerifyEmailPage({ push }) {
  const {
    authToken,
    pendingEmail,
    email,
    setPendingEmail,
    setAuthToken,
    setUserId,
    setEmail,
    setOnboardingComplete,
    setAccountStatus,
  } = useAppContext();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const [pollStatus, setPollStatus] = useState('waiting'); // 'waiting' | 'verified' | 'error'
  const intervalRef = useRef(null);

  const activeEmail = email || pendingEmail || '';

  const resolveNextRoute = (status) => {
    if (status.demoUsed && !status.tester) return '/waitlist';
    if (status.onboardingComplete) return '/demo';
    return '/onboarding';
  };

  const finalizeVerification = async (user) => {
    try {
      const token = await user.getIdToken(true);
      const accountStatusResp = await apiAccountStatus({ idToken: token });
      const nextStatus = {
        loaded: true,
        emailVerified: true,
        demoUsed: Boolean(accountStatusResp.data?.demoUsed),
        waitlistFilled: Boolean(accountStatusResp.data?.waitlistFilled),
        tester: Boolean(accountStatusResp.data?.tester),
        onboardingComplete: Boolean(accountStatusResp.data?.onboardingComplete),
      };
      clearPendingEmail();
      setPendingEmail('');
      setAuthToken(token);
      setUserId(user.uid);
      setEmail(user.email || activeEmail);
      setOnboardingComplete(nextStatus.onboardingComplete);
      setAccountStatus(nextStatus);
      setPollStatus('verified');
      setTimeout(() => push(resolveNextRoute(nextStatus)), 900);
    } catch (_err) {
      setError('Verified but could not load account. Please refresh.');
    }
  };

  // Auto-poll every 3 seconds
  useEffect(() => {
    if (!FIREBASE_ENABLED) {
      // Mock: auto-verify after 2s so devs can test the UI
      const t = setTimeout(async () => {
        const statusResp = await apiAccountStatus({ email: activeEmail || 'mock@example.com', token: authToken || 'mock' });
        const nextStatus = {
          loaded: true, emailVerified: true,
          demoUsed: Boolean(statusResp.data?.demoUsed),
          waitlistFilled: Boolean(statusResp.data?.waitlistFilled),
          tester: Boolean(statusResp.data?.tester),
          onboardingComplete: Boolean(statusResp.data?.onboardingComplete),
        };
        clearPendingEmail();
        setPendingEmail('');
        setAccountStatus(nextStatus);
        setOnboardingComplete(nextStatus.onboardingComplete);
        setPollStatus('verified');
        setTimeout(() => push(resolveNextRoute(nextStatus)), 900);
      }, 2000);
      return () => clearTimeout(t);
    }

    const poll = async () => {
      try {
        const auth = getClientAuth();
        const user = auth.currentUser;
        if (!user) return;
        await user.reload();
        if (user.emailVerified) {
          clearInterval(intervalRef.current);
          await finalizeVerification(user);
        }
      } catch (_err) {
        // silently ignore transient errors — keep polling
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    poll(); // first check immediately

    return () => clearInterval(intervalRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resendVerificationEmail = async () => {
    setError('');
    setResending(true);
    setResent(false);

    if (FIREBASE_ENABLED) {
      try {
        const user = getClientAuth().currentUser;
        if (!user) {
          setError('Session expired. Please sign in again.');
          setResending(false);
          return;
        }
        await sendEmailVerification(user, { url: buildEmailActionUrl() });
        setResent(true);
        setResending(false);
        return;
      } catch (_err) {
        setError('Could not resend — please wait a minute and try again.');
        setResending(false);
        return;
      }
    }

    await apiSendEmailLink({ email: activeEmail });
    setResent(true);
    setResending(false);
  };

  const isVerified = pollStatus === 'verified';

  return (
    <main className="site-root">
      <div className="premium-gradient-bg" aria-hidden="true" />
      <HeaderBar />

      <section className="verify-page-root">
        <article className="verify-card">
          {/* Animated envelope icon */}
          <div className="verify-icon-wrap" aria-hidden="true">
            <svg className={`verify-envelope${isVerified ? ' verified' : ''}`} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="14" width="56" height="36" rx="6" stroke="currentColor" strokeWidth="2.5" />
              <path d="M4 20l28 20 28-20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              {isVerified && (
                <path className="verify-checkmark" d="M22 33l8 8 14-14" stroke="#56e083" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
            {!isVerified && (
              <span className="verify-pulse-ring" aria-hidden="true" />
            )}
          </div>

          <p className="verify-kicker">
            {isVerified ? 'Email Verified ✓' : 'Email Verification Required'}
          </p>
          <h2>{isVerified ? 'All set! Redirecting you now…' : 'Check your inbox'}</h2>
          {!isVerified && (
            <p className="verify-sub">
              We sent a verification link to{' '}
              <strong className="verify-email-highlight">{activeEmail || 'your email address'}</strong>.
              Open it and click the link — this page will update automatically.
            </p>
          )}

          <div className={`verify-status-card${isVerified ? ' verified' : ''}`} role="status" aria-live="polite">
            <span className={`verify-status-dot${isVerified ? ' verified' : ' verifying'}`} aria-hidden="true" />
            <span>
              {isVerified
                ? 'Email verified — redirecting…'
                : 'Waiting for verification… (checking automatically)'}
            </span>
          </div>

          {error ? <p className="error-text dark">{error}</p> : null}
          {resent && !error ? (
            <p className="verify-resent-notice">Email resent — check your inbox and spam folder.</p>
          ) : null}

          {!isVerified && (
            <div className="verify-actions">
              <button
                className="verify-ghost-button"
                type="button"
                disabled={resending}
                onClick={resendVerificationEmail}
              >
                {resending ? 'Sending…' : 'Resend Email'}
              </button>
              <button
                className="verify-ghost-button verify-back-button"
                type="button"
                onClick={() => push('/')}
              >
                ← Back to Sign In
              </button>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

const REFERRAL_OPTIONS = [
  { value: 'Instagram', label: 'Instagram' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'YouTube', label: 'YouTube' },
  { value: 'Twitter / X', label: 'X (formerly Twitter)' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Google Search', label: 'Google Search' },
  { value: 'A Friend / Colleague', label: 'Friend or Colleague' },
  { value: 'Tech Blog or Article', label: 'Tech Blog or Article' },
  { value: 'Product Hunt', label: 'Product Hunt' },
  { value: 'Hackathon / Event', label: 'Hackathon or Event' },
  { value: 'College / University', label: 'College or University' },
  { value: 'Other', label: 'Other' },
];

const PROFESSION_OPTIONS = [
  { value: 'Software Engineer / Developer', label: 'Software Engineer or Developer' },
  { value: 'Product Manager', label: 'Product Manager' },
  { value: 'Data Scientist / ML Engineer', label: 'Data Scientist or ML Engineer' },
  { value: 'Student', label: 'Student' },
  { value: 'Entrepreneur / Founder', label: 'Entrepreneur or Founder' },
  { value: 'Designer (UI/UX / Graphic)', label: 'Designer (UI, UX, or Graphic)' },
  { value: 'Marketing / Sales Professional', label: 'Marketing or Sales Professional' },
  { value: 'Researcher / Academic', label: 'Researcher or Academic' },
  { value: 'Business Analyst', label: 'Business Analyst' },
  { value: 'Hardware / Embedded Engineer', label: 'Hardware or Embedded Engineer' },
  { value: 'Finance / Banking Professional', label: 'Finance or Banking Professional' },
  { value: 'Healthcare Professional', label: 'Healthcare Professional' },
  { value: 'Content Creator', label: 'Content Creator' },
  { value: 'Operations / Logistics', label: 'Operations or Logistics' },
  { value: 'Other', label: 'Other' },
];

const INTENT_OPTIONS = [
  { value: 'Personal Assistant', label: 'Personal Assistant' },
  { value: 'Research & Learning', label: 'Research & Learning' },
  { value: 'Business / Work Automation', label: 'Business or Workflow Automation' },
  { value: 'Customer Support Demo', label: 'Customer Support Demo' },
  { value: 'Development / Testing', label: 'Development or Testing' },
  { value: 'Entertainment / Fun', label: 'Entertainment or Personal Use' },
  { value: 'Home Automation Research', label: 'Home Automation Research' },
  { value: 'Academic Project', label: 'Academic Project' },
  { value: 'Investor / Press Demo', label: 'Investor or Press Demo' },
  { value: 'Just exploring', label: 'Exploring ADAM' },
];

function CustomSelect({ id, value, onChange, options, placeholder, required, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [menuStyle, setMenuStyle] = useState(null);
  const [openUpward, setOpenUpward] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const btnRef = useRef(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      const clickedTrigger = wrapRef.current?.contains(e.target);
      const clickedList = listRef.current?.contains(e.target);
      if (!clickedTrigger && !clickedList) {
        setOpen(false);
        setFocusedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      setOpenUpward(false);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = btnRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const viewportPadding = 12;
      const triggerGap = 6;
      const estimatedHeight = Math.min(260, Math.max(160, options.length * 44 + 12));
      const spaceBelow = viewportHeight - triggerRect.bottom - viewportPadding;
      const spaceAbove = triggerRect.top - viewportPadding;
      const shouldOpenUpward = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow;
      const availableHeight = shouldOpenUpward ? spaceAbove - triggerGap : spaceBelow - triggerGap;
      const nextMaxHeight = Math.max(120, Math.min(260, availableHeight));
      const nextLeft = Math.min(
        Math.max(viewportPadding, triggerRect.left),
        Math.max(viewportPadding, viewportWidth - triggerRect.width - viewportPadding),
      );

      setOpenUpward(shouldOpenUpward);
      setMenuStyle({
        left: nextLeft,
        width: triggerRect.width,
        maxHeight: nextMaxHeight,
        top: shouldOpenUpward ? 'auto' : triggerRect.bottom + triggerGap,
        bottom: shouldOpenUpward ? viewportHeight - triggerRect.top + triggerGap : 'auto',
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open || focusedIdx < 0) return;
    const items = listRef.current?.querySelectorAll('[role="option"]');
    items?.[focusedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx, open]);

  const handleOpen = () => {
    const idx = options.findIndex((o) => o.value === value);
    setFocusedIdx(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const handleSelect = (optValue) => {
    onChange({ target: { value: optValue } });
    setOpen(false);
    setFocusedIdx(-1);
    btnRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIdx >= 0) handleSelect(options[focusedIdx].value);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      setFocusedIdx(-1);
    }
  };

  return (
    <div className="csel-wrap" ref={wrapRef}>
      <button
        id={id}
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        aria-label={ariaLabel || placeholder}
        aria-required={required}
        className={`csel-trigger${!value ? ' placeholder' : ''}`}
        onClick={() => (open ? setOpen(false) : handleOpen())}
        onKeyDown={handleKeyDown}
      >
        <span className="csel-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="csel-arrow" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && menuStyle
        ? createPortal(
          <ul
            id={`${id}-list`}
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel || placeholder}
            className={`csel-list${openUpward ? ' open-upward' : ''}`}
            style={menuStyle}
          >
            {options.map((opt, idx) => (
              <li
                key={opt.value}
                id={`${id}-option-${idx}`}
                role="option"
                aria-selected={value === opt.value}
                className={`csel-item${value === opt.value ? ' selected' : ''}${focusedIdx === idx ? ' focused' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value); }}
                onMouseEnter={() => setFocusedIdx(idx)}
              >
                {value === opt.value && (
                  <span className="csel-check" aria-hidden="true">✓</span>
                )}
                {opt.label}
              </li>
            ))}
          </ul>,
          document.body,
        )
        : null}
    </div>
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
    const { name, referral, profession, dob, phone, countryCode, intent } = onboardingData;

    if (!referral || !profession || !dob) {
      setError('Please complete all required fields.');
      return;
    }

    const fullPhone = phone ? `${countryCode || '+91'}${phone}` : '';

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
          phone_number: fullPhone,
          intent: intent || '',
          use_case: intent || '',
          completed: true,
          completed_at: new Date().toISOString(),
        });

        await setDoc(doc(getClientDb(), 'adamUsers', userId), {
          uid: userId,
          email: email || authUser?.email || '',
          name: authUser?.displayName || name || '',
          displayName: authUser?.displayName || name || '',
          photoURL: authUser?.photoURL || '',
          phoneNumber: fullPhone || authUser?.phoneNumber || '',
          emailVerified: Boolean(authUser?.emailVerified),
          providerIds,
          primaryProvider,
          authSource: 'firebase_client',
          whereHeard: referral,
          jobTitle: profession,
          dob,
          phone_number: fullPhone,
          intent: intent || '',
          useCase: intent || '',
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
      phone_number: fullPhone,
      intent: intent || '',
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
      <div className="onboarding-bg-grid" aria-hidden="true" />
      <section className="onboarding-shell">

        <div className="onboarding-card">
          <div className="onboarding-progress">
            <div className="onboarding-progress-row">
              <span>Profile Setup</span>
              <strong>Step 2 of 3</strong>
            </div>
            <div className="onboarding-progress-bar">
              <div className="onboarding-progress-fill" />
            </div>
          </div>

          <header className="onboarding-header">
            <div className="onboarding-header-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Initialize Profile
            </div>
            <h2>Tell us about yourself</h2>
            <p>This helps ADAM personalize your experience from the first interaction.</p>
          </header>

          <form className="onboarding-form" onSubmit={handleSubmit}>

            {/* ── Discovery ── */}
            <div className="onb-field-group">
              <label className="onb-label" htmlFor="onb-referral">
                <span className="onb-label-dot" aria-hidden="true" />
                How did you hear about ADAM?
                <span className="onb-required">*</span>
              </label>
              <CustomSelect
                id="onb-referral"
                value={onboardingData.referral}
                onChange={(e) => updateField('referral', e.target.value)}
                placeholder="Select a source"
                options={REFERRAL_OPTIONS}
                required
              />
            </div>

            {/* ── Profession ── */}
            <div className="onb-field-group">
              <label className="onb-label" htmlFor="onb-profession">
                <span className="onb-label-dot" aria-hidden="true" />
                Profession
                <span className="onb-required">*</span>
              </label>
              <CustomSelect
                id="onb-profession"
                value={onboardingData.profession}
                onChange={(e) => updateField('profession', e.target.value)}
                placeholder="Select your profession"
                options={PROFESSION_OPTIONS}
                required
              />
            </div>

            {/* ── Date of Birth ── */}
            <div className="onb-field-group">
              <label className="onb-label" htmlFor="onb-dob">
                <span className="onb-label-dot" aria-hidden="true" />
                Date of Birth
                <span className="onb-required">*</span>
              </label>
              <input
                id="onb-dob"
                className="onboarding-input"
                type="date"
                value={onboardingData.dob}
                onChange={(e) => updateField('dob', e.target.value)}
                required
              />
            </div>

            {/* ── Section Divider ── */}
            <div className="onb-separator">
              <span>Contact Details</span>
            </div>

            {/* ── Phone ── */}
            <div className="onb-field-group">
              <label className="onb-label" htmlFor="onb-phone">
                <span className="onb-label-dot" aria-hidden="true" />
                Phone Number
                <span className="onb-optional">(optional)</span>
              </label>
              <div className="onb-phone-row">
                <div className="onb-select-wrap onb-country-wrap">
                  <select
                    className="onboarding-input onboarding-select onb-country-select"
                    value={onboardingData.countryCode}
                    onChange={(e) => updateField('countryCode', e.target.value)}
                    aria-label="Country code"
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+65">🇸🇬 +65</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+81">🇯🇵 +81</option>
                    <option value="+86">🇨🇳 +86</option>
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+52">🇲🇽 +52</option>
                    <option value="+7">🇷🇺 +7</option>
                  </select>
                  <span className="onb-chevron" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </span>
                </div>
                <input
                  id="onb-phone"
                  className="onboarding-input onb-phone-input"
                  type="tel"
                  placeholder="Phone number"
                  value={onboardingData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  inputMode="tel"
                  autoComplete="tel-national"
                />
              </div>
            </div>

            {/* ── Intent ── */}
            <div className="onb-field-group">
              <label className="onb-label" htmlFor="onb-intent">
                <span className="onb-label-dot" aria-hidden="true" />
                What will you use ADAM for?
              </label>
              <CustomSelect
                id="onb-intent"
                value={onboardingData.intent}
                onChange={(e) => updateField('intent', e.target.value)}
                placeholder="Select your primary use"
                options={INTENT_OPTIONS}
              />
            </div>

            {error ? <p className="error-text dark">{error}</p> : null}

            <div className="onboarding-actions">
              <button className="onboarding-back" type="button" onClick={() => push('/')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button className="btn-primary onboarding-next" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="onb-spinner" aria-hidden="true" />
                    Initializing…
                  </>
                ) : (
                  <>
                    Initialize Profile
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function formatRemaining(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const BG2_FACE_RECT = {
  x: 580 / 1672,
  y: 254 / 940,
  w: 177 / 1672,
  h: 128 / 940,
};

const BG2_NATIVE = {
  width: 1672,
  height: 940,
};

function mapRelayEmotionToFileName(value) {
  const emotion = String(value || '').trim().toLowerCase();

  switch (emotion) {
    case 'angry':
    case 'confused':
    case 'happy':
    case 'ideal':
    case 'love':
    case 'panic':
    case 'reconnecting':
    case 'rizz':
    case 'sad':
    case 'search-thinking':
    case 'shy':
    case 'sleep':
    case 'speeking':
    case 'surprised':
      return emotion;
    case 'thinking':
      return 'search-thinking';
    case 'smug':
      return 'rizz';
    case 'blush':
      return 'shy';
    case 'excited':
      return 'happy';
    case 'idle':
    case 'default':
    case 'listening':
    case 'none':
      return 'ideal';
    case 'speaking':
      return 'speeking';
    default:
      return 'ideal';
  }
}

function pcm16ToBase64(float32Samples) {
  const pcm16 = new Int16Array(float32Samples.length);
  for (let i = 0; i < float32Samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Samples[i]));
    pcm16[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToFloat32(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const out = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i += 1) {
    out[i] = pcm16[i] / 32768;
  }
  return out;
}

function DemoPage({ push }) {
  const { userId, authToken, onboardingData } = useAppContext();
  const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || '';
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [isMobileConversationView, setIsMobileConversationView] = useState(false);
  const [sessionState, setSessionState] = useState('idle');
  const [timeLeft, setTimeLeft] = useState(300);
  const [endOpen, setEndOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [turnCount, setTurnCount] = useState(0);
  const [turnsAllowed, setTurnsAllowed] = useState(20);
  const [sessionDurationMs, setSessionDurationMs] = useState(300000);
  const [startedAt, setStartedAt] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [micPermission, setMicPermission] = useState('requesting');
  const [adamSpeaking, setAdamSpeaking] = useState(false);
  const [mouthSyncActive, setMouthSyncActive] = useState(false);
  const [baseEmotion, setBaseEmotion] = useState('ideal');
  const [emotionLayerStyle, setEmotionLayerStyle] = useState({
    left: '34.69%',
    top: '27.02%',
    width: '10.59%',
    height: '13.62%',
  });
  const [isRecording, setIsRecording] = useState(false);
  const [connectingStatus, setConnectingStatus] = useState('');

  const wsRef = useRef(null);
  const transcriptRef = useRef(null);
  const intervalRef = useRef(null);
  const didEndRef = useRef(false);
  const sessionStateRef = useRef('idle');
  const timeLeftRef = useRef(300);
  const micPermissionRef = useRef('requesting');
  const adamSpeakingRef = useRef(false);
  const micStreamRef = useRef(null);
  const micAudioCtxRef = useRef(null);
  const micSourceRef = useRef(null);
  const micProcessorRef = useRef(null);
  const speakerCtxRef = useRef(null);
  const nextSpeakerStartRef = useRef(0);
  const speechEndTimerRef = useRef(null);
  const mouthSyncTimerRef = useRef(null);
  const faceAreaRef = useRef(null);
  const emotionIframeRef = useRef(null);
  const introShownRef = useRef(false);
  const pendingTurnCompleteRef = useRef(false);

  const visibleEmotion = adamSpeaking && baseEmotion === 'ideal' ? 'speeking' : baseEmotion;

  const cleanupMicCapture = () => {
    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close();
      micAudioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    setIsRecording(false);
  };

  const cleanupSpeaker = () => {
    if (speechEndTimerRef.current) {
      clearTimeout(speechEndTimerRef.current);
      speechEndTimerRef.current = null;
    }
    if (speakerCtxRef.current) {
      speakerCtxRef.current.close();
      speakerCtxRef.current = null;
    }
    nextSpeakerStartRef.current = 0;
    setAdamSpeaking(false);
  };

  const clearMouthSyncTimer = () => {
    if (!mouthSyncTimerRef.current) {
      return;
    }
    clearTimeout(mouthSyncTimerRef.current);
    mouthSyncTimerRef.current = null;
  };

  const isSpeakerPlaybackActive = () => {
    const ctx = speakerCtxRef.current;
    if (!ctx) {
      return false;
    }
    return nextSpeakerStartRef.current > ctx.currentTime + 0.03;
  };

  const finishAdamSpeaking = () => {
    setAdamSpeaking(false);
    clearMouthSyncTimer();
    setMouthSyncActive(false);
  };

  const updateEmotionLayerPosition = () => {
    const container = faceAreaRef.current;
    if (!container) {
      return;
    }

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const nw = BG2_NATIVE.width;
    const nh = BG2_NATIVE.height;

    // Keep overlay locked to bg2.png face location under object-fit: cover.
    const scale = Math.max(cw / nw, ch / nh);
    const renderW = nw * scale;
    const renderH = nh * scale;
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;

    const left = offsetX + BG2_FACE_RECT.x * renderW;
    const top = offsetY + BG2_FACE_RECT.y * renderH;
    const width = BG2_FACE_RECT.w * renderW;
    const height = BG2_FACE_RECT.h * renderH;

    setEmotionLayerStyle({
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  };

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    micPermissionRef.current = micPermission;
  }, [micPermission]);

  useEffect(() => {
    adamSpeakingRef.current = adamSpeaking;
  }, [adamSpeaking]);

  useEffect(() => {
    const iframe = emotionIframeRef.current;
    if (!iframe) {
      return undefined;
    }

    const handleIframeLoad = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          return;
        }

        const style = iframeDoc.createElement('style');
        style.textContent = `
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000 !important;
}

body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

svg {
  width: 100% !important;
  height: 100% !important;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) !important;
}

.label {
  display: none !important;
}

::-webkit-scrollbar {
  display: none;
}
`;
        iframeDoc.head.appendChild(style);
      } catch (_error) {
        // Ignore sandbox/cross-origin edge cases.
      }
    };

    iframe.addEventListener('load', handleIframeLoad);
    return () => iframe.removeEventListener('load', handleIframeLoad);
  }, [visibleEmotion]);

  useEffect(() => {
    const container = faceAreaRef.current;
    if (!container) {
      return undefined;
    }

    updateEmotionLayerPosition();
    window.addEventListener('resize', updateEmotionLayerPosition);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateEmotionLayerPosition());
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', updateEmotionLayerPosition);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  const stopRealtimeResources = () => {
    clearMouthSyncTimer();
    setMouthSyncActive(false);
    setBaseEmotion('ideal');
    cleanupMicCapture();
    cleanupSpeaker();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_error) {
        // ignore close failures
      }
      wsRef.current = null;
    }
  };

  const pushSystemTranscript = (text, tone = 'adam') => {
    setTranscript((prev) => [
      ...prev,
      {
        speaker: 'ADAM',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text,
        tone,
      },
    ]);
  };

  const playSpeakerChunk = async (base64Pcm24k) => {
    const ctx = speakerCtxRef.current || new AudioContext({ sampleRate: 24000 });
    speakerCtxRef.current = ctx;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const floatSamples = base64ToFloat32(base64Pcm24k);
    const buffer = ctx.createBuffer(1, floatSamples.length, 24000);
    buffer.copyToChannel(floatSamples, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.01, nextSpeakerStartRef.current);
    source.start(startAt);
    nextSpeakerStartRef.current = startAt + buffer.duration;

    setAdamSpeaking(true);
    setIsRecording(false);

    if (speechEndTimerRef.current) {
      clearTimeout(speechEndTimerRef.current);
    }

    const untilEndMs = Math.max(0, (nextSpeakerStartRef.current - ctx.currentTime) * 1000) + 360;
    speechEndTimerRef.current = setTimeout(() => {
      finishAdamSpeaking();
      pendingTurnCompleteRef.current = false;
      if (sessionStateRef.current === 'active' && micPermissionRef.current === 'granted') {
        setIsRecording(true);
      }
    }, untilEndMs);
  };

  const sendWsMessage = (message) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(JSON.stringify(message));
  };

  const closeSession = async (reason, shouldNotifyBackend = true) => {
    if (didEndRef.current) {
      return;
    }

    didEndRef.current = true;
    setSessionState('ended');
    setEndOpen(true);
    setIsRecording(false);

    clearInterval(intervalRef.current);
    stopRealtimeResources();

    if (shouldNotifyBackend && authToken) {
      try {
        await apiDemoEnd({
          userId,
          idToken: authToken,
          sessionId,
          reason,
          endTime: Date.now(),
        });
      } catch (_error) {
        // backend errors should not block UI end-state
      }
    }

    if (['timeout', 'user_disconnect', 'cap_reached', 'server_restart', 'connection_closed'].includes(reason)) {
      push('/waitlist');
    }
  };

  const endConversation = async () => {
    sendWsMessage({ type: 'disconnect' });
    await closeSession('user_disconnect', true);
  };

  const setupMicCapture = async () => {
    try {
      setMicPermission('requesting');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });

      micStreamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      micAudioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const source = audioCtx.createMediaStreamSource(stream);
      micSourceRef.current = source;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (
          sessionStateRef.current !== 'active' ||
          adamSpeakingRef.current ||
          micPermissionRef.current !== 'granted'
        ) {
          return;
        }

        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const samples = event.inputBuffer.getChannelData(0);
        const payload = pcm16ToBase64(samples);
        ws.send(JSON.stringify({ type: 'audio', data: payload }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setMicPermission('granted');
      if (sessionState === 'active' && !adamSpeaking) {
        setIsRecording(true);
      }
    } catch (_error) {
      setMicPermission('denied');
      setIsRecording(false);
      setErrorMsg('Microphone permission denied. Please allow mic access to continue.');
    }
  };

  useEffect(() => {
    if (!userId) {
      push('/');
    }
  }, [push, userId]);

  useEffect(() => {
    if (sessionState !== 'active' || !startedAt || endOpen) {
      return undefined;
    }

    intervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const remainingSeconds = Math.max(0, Math.ceil((sessionDurationMs - elapsedMs) / 1000));
      setTimeLeft(remainingSeconds);
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [sessionState, startedAt, sessionDurationMs, endOpen]);

  useEffect(() => {
    if (timeLeft > 0 || didEndRef.current) {
      return;
    }

    sendWsMessage({ type: 'disconnect' });
    closeSession('timeout', true);
  }, [timeLeft]);

  useEffect(() => {
    if (sessionState === 'active' && micPermission === 'requesting' && !micStreamRef.current) {
      setupMicCapture();
    }
    if (sessionState === 'active' && micPermission === 'granted' && !adamSpeaking) {
      setIsRecording(true);
    }
    if (adamSpeaking) {
      setIsRecording(false);
    }
  }, [sessionState, micPermission, adamSpeaking]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript, conversationOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const syncConversationLayout = (event) => {
      const mobile = event.matches;
      setIsMobileConversationView(mobile);
      if (!mobile) {
        setConversationOpen(false);
      }
    };

    syncConversationLayout(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncConversationLayout);
      return () => mediaQuery.removeEventListener('change', syncConversationLayout);
    }

    mediaQuery.addListener(syncConversationLayout);
    return () => mediaQuery.removeListener(syncConversationLayout);
  }, []);

  useEffect(() => () => clearMouthSyncTimer(), []);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!didEndRef.current && sessionStateRef.current === 'active') {
        sendWsMessage({ type: 'disconnect' });
        closeSession('user_disconnect', true);
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (!didEndRef.current && sessionStateRef.current === 'active') {
        sendWsMessage({ type: 'disconnect' });
        closeSession('user_disconnect', true);
      }
    };
  }, []);

  const beginSession = async () => {
    setWelcomeOpen(false);
    setSessionState('connecting');
    setConnectingStatus('Requesting microphone access…');
    setErrorMsg('');
    setBaseEmotion('ideal');
    setMouthSyncActive(false);
    clearMouthSyncTimer();
    introShownRef.current = false;

    // Fire mic permission dialog immediately — runs in parallel with API calls
    if (!micStreamRef.current) {
      setupMicCapture();
    }

    if (!RELAY_URL) {
      setErrorMsg('Relay URL is not configured.');
      setSessionState('error');
      return;
    }

    try {
      setConnectingStatus('Getting your location…');
      const clientLocation = await getClientLocationSnapshot();

      setConnectingStatus('Initializing session…');
      const startResp = await apiDemoStart({
        userId,
        idToken: authToken,
        startTime: Date.now(),
        location: clientLocation,
      });
      if (!startResp.ok) {
        setErrorMsg(startResp.data?.error || 'Unable to start session.');
        setSessionState('error');
        return;
      }

      const nextSessionId = startResp.data?.sessionId || '';
      setSessionId(nextSessionId);

      setConnectingStatus('Authenticating relay…');
      const tokenResp = await fetch('/api/relay-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: authToken, location: clientLocation }),
      });

      const tokenJson = await tokenResp.json().catch(() => ({}));
      if (!tokenResp.ok || !tokenJson.token) {
        setErrorMsg(tokenJson?.error || 'Unable to authenticate relay connection.');
        setSessionState('error');
        return;
      }

      setConnectingStatus('Connecting to ADAM…');
      const ws = new WebSocket(RELAY_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token: tokenJson.token }));
      };

      ws.onmessage = async (event) => {
        let incoming;
        try {
          incoming = JSON.parse(event.data);
        } catch (_error) {
          return;
        }

        if (incoming.type === 'session_ready') {
          const duration = Number(incoming.durationMs || 300000);
          setTurnsAllowed(Number(incoming.turnsAllowed || 20));
          setSessionDurationMs(duration);
          setTimeLeft(Math.ceil(duration / 1000));
          setStartedAt(Date.now());
          setSessionState('active');
          setIsRecording(micPermission === 'granted');
          if (!introShownRef.current) {
            pushSystemTranscript('Systems aligned. ADAM online.', 'adam');
            introShownRef.current = true;
          }
          return;
        }

        if (incoming.type === 'audio' && incoming.data) {
          await playSpeakerChunk(incoming.data);
          return;
        }

        if (incoming.type === 'transcript') {
          const isAdam = incoming.role === 'adam';
          const textChunk = incoming.text || '';

          if (isAdam) {
            setTranscript((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'ADAM' && last.inProgress) {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    text: `${last.text}${textChunk}`,
                    inProgress: true,
                    typing: true,
                  },
                ];
              }

              return [
                ...prev,
                {
                  speaker: 'ADAM',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  text: textChunk,
                  tone: 'adam',
                  inProgress: true,
                  typing: true,
                },
              ];
            });
          } else {
            setTranscript((prev) => [
              ...prev,
              {
                speaker: 'YOU',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: textChunk,
                tone: 'user',
              },
            ]);
            setTurnCount((prev) => prev + 1);
          }
          return;
        }

        if (incoming.type === 'emotion') {
          setBaseEmotion(mapRelayEmotionToFileName(incoming.emotion));
          return;
        }

        if (incoming.type === 'mouth_sync') {
          const intensity = String(incoming.intensity || 'closed').toLowerCase();
          if (intensity === 'closed') {
            clearMouthSyncTimer();
            setMouthSyncActive(false);
            return;
          }

          setMouthSyncActive(true);
          clearMouthSyncTimer();
          mouthSyncTimerRef.current = setTimeout(() => {
            setMouthSyncActive(false);
            mouthSyncTimerRef.current = null;
          }, 260);
          return;
        }

        if (incoming.type === 'face_state') {
          const speaking = incoming.state === 'speaking';
          if (speaking) {
            setAdamSpeaking(true);
            pendingTurnCompleteRef.current = false;
            return;
          }

          if (adamSpeakingRef.current || isSpeakerPlaybackActive()) {
            return;
          }

          finishAdamSpeaking();
          pendingTurnCompleteRef.current = false;
          if (sessionStateRef.current === 'active' && micPermissionRef.current === 'granted') {
            setIsRecording(true);
          }
          return;
        }

        if (incoming.type === 'turn_complete') {
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.speaker !== 'ADAM' || !last.inProgress) {
              return prev;
            }

            return [
              ...prev.slice(0, -1),
              {
                ...last,
                inProgress: false,
                typing: false,
              },
            ];
          });

          if (adamSpeakingRef.current || isSpeakerPlaybackActive()) {
            pendingTurnCompleteRef.current = true;
            return;
          }

          finishAdamSpeaking();
          pendingTurnCompleteRef.current = false;
          if (sessionStateRef.current === 'active' && micPermissionRef.current === 'granted') {
            setIsRecording(true);
          }
          return;
        }

        if (incoming.type === 'session_end') {
          pendingTurnCompleteRef.current = false;
          clearMouthSyncTimer();
          setMouthSyncActive(false);
          closeSession(incoming.reason || 'cap_reached', false);
          return;
        }

        if (incoming.type === 'error') {
          const code = incoming.code || 'relay_error';
          const message = incoming.message || 'Unknown relay error';
          const isLateAuthRace =
            code === 'auth_failed' &&
            String(message).toLowerCase().includes('not authenticated') &&
            (didEndRef.current || sessionStateRef.current !== 'active' || timeLeftRef.current <= 1);

          // Ignore the relay's transient auth race while the session is already ending.
          if (isLateAuthRace) {
            closeSession('timeout', false);
            return;
          }

          setErrorMsg(`${code}: ${message}`);
          if (code === 'auth_failed' || code === 'cap_exceeded') {
            closeSession(code, false);
          }
        }
      };

      ws.onerror = () => {
        setErrorMsg('WebSocket relay connection failed.');
        setSessionState('error');
      };

      ws.onclose = () => {
        if (didEndRef.current || sessionStateRef.current === 'ended') {
          return;
        }

        if (sessionStateRef.current === 'active') {
          if (timeLeftRef.current <= 1) {
            closeSession('timeout', false);
          } else {
            closeSession('connection_closed', true);
          }
          return;
        }

        setErrorMsg('Relay connection closed before the demo could start.');
        setSessionState('error');
        setWelcomeOpen(true);
      };
    } catch (_error) {
      setErrorMsg('Unable to start live session. Please retry.');
      setSessionState('error');
    }
  };

  const timerColor = timeLeft <= 30 ? '#dc2626' : timeLeft <= 60 ? '#d97706' : '#56e083';

  return (
    <main className="demo-console-page">
      <div ref={faceAreaRef} className="demo-console-bg" aria-hidden="true">
        <div className="demo-face-emotion-layer" style={emotionLayerStyle}>
          <iframe
            ref={emotionIframeRef}
            key={visibleEmotion}
            src={`/emotions/${visibleEmotion}.html`}
            className="demo-face-emotion-iframe"
            title={`${visibleEmotion} emotion`}
            scrolling="no"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
      <div className="demo-console-overlay" aria-hidden="true" />

      <header className="demo-console-topbar">
        <div className="header-brand">
          <img src="/images/logo.png" alt="Dgen Technologies" className="demo-brand-logo" />
        </div>
        <div className="demo-topbar-actions">
          <p className="demo-timer mono-timer" style={{ color: timerColor }}>
            {formatRemaining(timeLeft)}
          </p>
          <button
            className="demo-end-inline"
            type="button"
            onClick={endConversation}
            disabled={sessionState !== 'active' && sessionState !== 'connecting'}
          >
            End conversation
          </button>
        </div>
      </header>

      <main className={`demo-console-shell ${welcomeOpen ? 'blurred' : ''}`}>
      </main>

      {isMobileConversationView ? (
        <button
          type="button"
          className="demo-conversation-toggle"
          aria-expanded={conversationOpen}
          aria-controls="demo-conversation-drawer"
          onClick={() => setConversationOpen((previous) => !previous)}
        >
          {conversationOpen ? 'Hide conversation' : 'Show conversation'}
        </button>
      ) : null}

      <aside
        id="demo-conversation-drawer"
        className={`demo-conversation-drawer ${!isMobileConversationView || conversationOpen ? 'open' : ''}`}
        aria-hidden={isMobileConversationView ? !conversationOpen : false}
      >
        <section className="console-chat-premium">
          <div className="console-chat-head">
            <div className="header-brand chat-brand">
              <MessageCircle className="chat-icon" size={20} strokeWidth={2.2} aria-hidden="true" />
              <div>
                <h3>Live Conversation</h3>
                <p>Real-time transcript</p>
              </div>
            </div>
          </div>

          <div className="console-chat-stream scroll-hide" ref={transcriptRef}>
            {transcript.length === 0 ? (
              <div className="console-message adam">
                <div className="console-message-meta">
                  <span className="console-message-speaker adam">ADAM</span>
                  <span>Live</span>
                </div>
                <div className="console-message-bubble adam">
                  {sessionState === 'active'
                    ? 'I am listening. Say hello to begin.'
                    : 'Session is preparing. Start the live session to begin.'}
                </div>
              </div>
            ) : null}
            {transcript.map((message) => (
              <div
                key={`${message.speaker}-${message.time}-${message.text.slice(0, 12)}`}
                className={`console-message ${message.tone}`}
              >
                <div className="console-message-meta">
                  <span className={`console-message-speaker ${message.tone}`}>{message.speaker}</span>
                  <span>{message.time}</span>
                </div>
                <div className={`console-message-bubble ${message.tone} ${message.typing ? 'typing' : ''}`}>
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="demo-session-meta">
            <span>
              Turns: {turnCount}/{turnsAllowed}
            </span>
            <span>
              Mic: {micPermission === 'granted' ? (isRecording ? 'Listening' : adamSpeaking ? 'Paused while ADAM speaks' : 'Ready') : micPermission === 'denied' ? 'Blocked' : 'Requesting'}
            </span>
          </div>

          <p className="demo-disclaimer">ADAM is AI and can make mistakes.</p>

          {errorMsg ? <p className="error-text dark">{errorMsg}</p> : null}
        </section>
      </aside>

      {welcomeOpen ? (
        <div className="demo-welcome-overlay show">
          <div className="glass-panel demo-welcome-card">
            <span className="demo-welcome-kicker">ADAM EXCLUSIVE PREVIEW</span>
            <h1>Welcome to the ADAM Experience</h1>
            <p>Your private 5-minute session is ready. ADAM is online and standing by for your first command.</p>
            <p className="demo-welcome-note">Priority early-access invitations are sent first to users who complete this guided preview.</p>
            <button className="demo-welcome-button" type="button" onClick={beginSession}>
              Start Live Session
            </button>
          </div>
        </div>
      ) : null}

      {sessionState === 'connecting' ? (
        <div className="demo-connecting-overlay">
          <div className="demo-connecting-card">
            <div className="demo-connecting-spinner" aria-hidden="true" />
            <p className="demo-connecting-status">{connectingStatus}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function WaitlistPage({ push }) {
  const { onboardingData, email, accountStatus } = useAppContext();
  const [name, setName] = useState(onboardingData.name || '');
  const [emailValue, setEmailValue] = useState(email || '');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(4);
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(Boolean(accountStatus.waitlistFilled));
  const [error, setError] = useState('');

  const WAITLIST_URL = 'https://dgentechnologies.com/products/adam';
  const blockedNotice = accountStatus.demoUsed && !accountStatus.tester
    ? 'You already used this ADAM preview. The waitlist is the next step.'
    : accountStatus.waitlistFilled
      ? 'You already filled the waitlist. We have your details on file.'
      : '';
  const showExistingStatus = joined || accountStatus.waitlistFilled;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await apiWaitlist({
      name,
      email: emailValue,
      company: '',
      use_case: message,
      rating,
      referral: onboardingData.referral,
    });
    setLoading(false);

    if (result.data?.alreadyRegistered || result.data?.alreadyFilled) {
      setJoined(true);
      setError('');
      return;
    }

    if (!result.ok && !result.data?.success) {
      setError('Unable to join right now.');
      return;
    }

    window.location.href = WAITLIST_URL;
  };

  return (
    <main className="waitlist-page">
      <header className="waitlist-topbar" aria-label="Session review header">
        <img src="/images/logo.png" alt="Dgen Technologies" className="waitlist-logo" />
        <button className="waitlist-close" type="button" aria-label="Close session review" onClick={() => push('/demo')}>
          <X size={18} />
        </button>
      </header>

      <section className="waitlist-shell">
        <div className="waitlist-progress">
          <div className="waitlist-progress-row">
            <span>Session Review</span>
            <span>Waitlist Status: {showExistingStatus ? 'Joined' : 'Pending'}</span>
          </div>
          <div className="waitlist-progress-track">
            <div className="waitlist-progress-fill" />
          </div>
        </div>

        <article className="waitlist-card">
          {blockedNotice ? <p className="waitlist-blocked-banner">{blockedNotice}</p> : null}

          {showExistingStatus ? (
            <div className="waitlist-success" role="status" aria-live="polite">
              <h2 className="waitlist-title">You already filled the waitlist.</h2>
              <p className="waitlist-subtitle">We have your waitlist details on file and ADAM will keep you updated.</p>
              <a className="waitlist-submit waitlist-link" href={WAITLIST_URL} target="_blank" rel="noreferrer">
                Explore ADAM
                <ArrowRight size={16} />
              </a>
            </div>
          ) : (
            <>
              <h2 className="waitlist-title">How was your session?</h2>
              <p className="waitlist-subtitle">
                Your feedback helps us refine the neural architecture. Join the priority waitlist for early access.
              </p>

              <form className="waitlist-form" onSubmit={handleSubmit}>
                <div className="waitlist-section">
                  <label htmlFor="session-rating" className="waitlist-label">Session Rating</label>
                  <div id="session-rating" className="waitlist-stars" role="radiogroup" aria-label="Session rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`waitlist-star ${value <= rating ? 'active' : ''}`}
                        aria-label={`Rate ${value} out of 5`}
                        aria-checked={value === rating}
                        role="radio"
                        onClick={() => setRating(value)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="waitlist-section">
                  <label htmlFor="wl-message" className="waitlist-label">Comments &amp; Observations</label>
                  <textarea
                    id="wl-message"
                    className="waitlist-textarea"
                    rows={4}
                    value={message}
                    placeholder="Share any specific feedback on ADAM's performance..."
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <div className="waitlist-grid">
                  <div className="waitlist-section">
                    <label htmlFor="wl-name" className="waitlist-label">Full Name</label>
                    <div className="waitlist-input-wrap">
                      <User size={16} aria-hidden="true" />
                      <input
                        id="wl-name"
                        className="waitlist-input"
                        type="text"
                        value={name}
                        placeholder="John Doe"
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="waitlist-section">
                    <label htmlFor="wl-email" className="waitlist-label">Email Address</label>
                    <div className="waitlist-input-wrap">
                      <Mail size={16} aria-hidden="true" />
                      <input
                        id="wl-email"
                        className="waitlist-input"
                        type="email"
                        value={emailValue}
                        placeholder="john@example.com"
                        onChange={(e) => setEmailValue(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {error ? <p className="error-text">{error}</p> : null}

                <div className="waitlist-actions">
                  <button className="waitlist-later" type="button" onClick={() => push('/demo')}>
                    Maybe later
                  </button>
                  <button className="waitlist-submit" type="submit" disabled={loading}>
                    {loading ? 'Joining...' : 'Join the Waitlist'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </>
          )}
        </article>
      </section>
    </main>
  );
}

function RouterView() {
  const { route, push } = useHashRouter();
  const { authToken, userId, authReady, onboardingComplete, accountStatus } = useAppContext();

  useEffect(() => {
    if (!authReady || !authToken || route !== '/') {
      return;
    }

    if (accountStatus.loaded && accountStatus.demoUsed && !accountStatus.tester) {
      push('/waitlist');
      return;
    }

    if (accountStatus.loaded && !accountStatus.emailVerified) {
      push('/verify-email');
      return;
    }

    push(onboardingComplete ? '/demo' : '/onboarding');
  }, [accountStatus, authReady, authToken, onboardingComplete, push, route]);

  if (!authReady) {
    return null;
  }

  if (route === '/verify-email') {
    return <VerifyEmailPage push={push} />;
  }

  if (route === '/waitlist') {
    return <WaitlistPage push={push} />;
  }

  if (route === '/onboarding') {
    if (!authToken) {
      return <LoginPage push={push} />;
    }
    if (!accountStatus.loaded) {
      return null;
    }
    if (!accountStatus.emailVerified) {
      return <VerifyEmailPage push={push} />;
    }
    if (accountStatus.loaded && accountStatus.demoUsed && !accountStatus.tester) {
      return <WaitlistPage push={push} />;
    }
    return <OnboardingPage push={push} />;
  }

  if (route === '/demo') {
    if (!userId) {
      return <LoginPage push={push} />;
    }
    if (!accountStatus.loaded) {
      return null;
    }
    if (!accountStatus.emailVerified) {
      return <VerifyEmailPage push={push} />;
    }
    if (accountStatus.loaded && accountStatus.demoUsed && !accountStatus.tester) {
      return <WaitlistPage push={push} />;
    }
    return <DemoPage push={push} />;
  }

  if (authToken && route === '/') {
    return <LoginPage push={push} />;
  }

  return <LoginPage push={push} />;
}

export default function App() {
  useEffect(() => {
    if (!FIREBASE_ENABLED) {
      installMockFetch();
    }
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500&display=swap');

        :root {
          --green-main: #56e083;
          --green-strong: #19b35c;
          --primary: #19b35c;
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
          min-height: 100vh;
          min-height: 100dvh;
          height: 100vh;
          height: 100dvh;
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

        .demo-brand-logo {
          height: 34px;
          width: auto;
          display: block;
          object-fit: contain;
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
          justify-content: flex-end;
          align-items: center;
          padding: 80px 72px 24px;
          min-height: 100vh;
          min-height: 100dvh;
          position: relative;
          z-index: 1;
          overflow: hidden;
          background-image: url('/images/login-image2.png');
          background-size: cover;
          background-position: center center;
          background-repeat: no-repeat;
        }

        .login-hero-shell {
          min-height: 100vh;
          min-height: 100dvh;
        }

        .login-hero-overlay {
          position: absolute;
          inset: 0;
          background: transparent;
          backdrop-filter: none;
          pointer-events: none;
        }

        .form-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 460px;
          max-height: calc(100vh - 140px);
          background: rgba(255, 255, 255, 0.62);
          border: 1px solid rgba(255, 255, 255, 0.44);
          border-radius: 28px;
          padding: 28px 28px 0;
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          box-shadow:
            0 32px 80px rgba(0, 0, 0, 0.22),
            0 8px 24px rgba(0, 0, 0, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .form-scroll-body {
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1;
          padding: 0 0 28px;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(25, 179, 92, 0.35) transparent;
        }

        .form-scroll-body::-webkit-scrollbar {
          width: 4px;
        }

        .form-scroll-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .form-scroll-body::-webkit-scrollbar-thumb {
          background: rgba(25, 179, 92, 0.35);
          border-radius: 999px;
        }

        .form-scroll-body::-webkit-scrollbar-thumb:hover {
          background: rgba(25, 179, 92, 0.6);
        }

        .input-password-wrap {
          position: relative;
        }

        .input-password-wrap .input-light {
          padding-right: 42px;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: rgba(19, 19, 19, 0.42);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 160ms ease;
          line-height: 0;
        }

        .password-toggle:hover {
          color: var(--green-strong);
        }

        .password-toggle svg {
          width: 16px;
          height: 16px;
        }

        .form-heading {
          margin-bottom: 18px;
        }

        .form-heading h2 {
          margin: 0 0 6px;
          font-size: 26px;
          line-height: 32px;
          letter-spacing: -0.02em;
        }

        .form-heading p {
          margin: 0;
          color: rgba(19, 19, 19, 0.62);
          font-size: 14px;
        }

        .stack-lg {
          display: grid;
          gap: 12px;
        }

        .stack-sm {
          display: grid;
          gap: 5px;
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
          border: 1px solid rgba(255, 255, 255, 0.44);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.66);
          color: var(--text-charcoal);
          padding: 12px 14px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
        }

        .input-light::placeholder {
          color: rgba(19, 19, 19, 0.34);
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
          color: rgba(19, 19, 19, 0.66);
        }

        .terms-row a {
          color: var(--green-strong);
        }

        .btn-primary {
          width: 100%;
          border: 0;
          border-radius: 14px;
          padding: 12px 14px;
          background: linear-gradient(135deg, #56e083 0%, #19b35c 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 30px rgba(25, 179, 92, 0.24);
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
          background: transparent;
          text-transform: uppercase;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: rgba(19, 19, 19, 0.55);
        }

        .btn-google {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.46);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.58);
          color: var(--text-charcoal);
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.36);
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.01em;
        }

        .email-verify-row {
          display: flex;
          gap: 10px;
          align-items: stretch;
        }

        .email-verify-input {
          flex: 1;
          min-width: 0;
        }

        .email-verify-button,
        .link-button {
          border: 0;
          border-radius: 14px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease;
          white-space: nowrap;
        }

        .email-verify-button {
          background: linear-gradient(135deg, #56e083 0%, #19b35c 100%);
          color: #ffffff;
          box-shadow: 0 12px 30px rgba(25, 179, 92, 0.24);
        }

        .verify-ghost-button,
        .link-button {
          background: rgba(255, 255, 255, 0.62);
          color: var(--text-charcoal);
          border: 1px solid rgba(19, 19, 19, 0.12);
          border-radius: 14px;
          padding: 12px 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }

        .email-verify-button:hover:not(:disabled),
        .verify-ghost-button:hover:not(:disabled),
        .link-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .email-verify-button:disabled,
        .verify-ghost-button:disabled,
        .link-button:disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }

        .form-note {
          margin: 0;
          font-size: 12px;
          line-height: 18px;
          color: rgba(19, 19, 19, 0.64);
        }

        .auth-footer-note {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          color: rgba(19, 19, 19, 0.58);
        }

        /* ── verify page ── */
        .verify-page-root {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 64px);
          min-height: calc(100dvh - 64px);
          padding: 24px 20px 40px;
        }

        .verify-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          padding: 40px 36px 36px;
          border-radius: 28px;
          background: rgba(14, 14, 14, 0.80);
          color: #f4f4f4;
          border: 1px solid rgba(255, 255, 255, 0.10);
          box-shadow: 0 32px 96px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(86, 224, 131, 0.07);
          backdrop-filter: blur(24px) saturate(160%);
          text-align: center;
        }

        /* animated envelope */
        .verify-icon-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        .verify-envelope {
          width: 64px;
          height: 64px;
          color: rgba(244, 244, 244, 0.72);
          transition: color 400ms ease;
        }

        .verify-envelope.verified {
          color: #56e083;
        }

        .verify-checkmark {
          stroke-dasharray: 30;
          stroke-dashoffset: 30;
          animation: verify-draw 0.5s ease forwards;
        }

        @keyframes verify-draw {
          to { stroke-dashoffset: 0; }
        }

        .verify-pulse-ring {
          position: absolute;
          inset: -14px;
          border-radius: 999px;
          border: 2px solid rgba(86, 224, 131, 0.28);
          animation: verify-pulse 2.2s ease-in-out infinite;
        }

        @keyframes verify-pulse {
          0%   { transform: scale(0.88); opacity: 0.9; }
          50%  { transform: scale(1.06); opacity: 0.3; }
          100% { transform: scale(0.88); opacity: 0.9; }
        }

        .verify-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 5px 12px;
          background: rgba(86, 224, 131, 0.12);
          color: #9af0b5;
          border: 1px solid rgba(86, 224, 131, 0.22);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .verify-card h2 {
          margin: 0 0 12px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 26px;
          line-height: 1.18;
          letter-spacing: -0.03em;
        }

        .verify-sub {
          margin: 0 0 4px;
          color: rgba(244, 244, 244, 0.70);
          font-size: 14px;
          line-height: 22px;
        }

        .verify-email-highlight {
          color: #9af0b5;
          word-break: break-all;
        }

        .verify-status-card {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 22px 0 0;
          padding: 16px 18px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          text-align: left;
          transition: background 400ms ease, border-color 400ms ease;
        }

        .verify-status-card.verified {
          background: rgba(86, 224, 131, 0.08);
          border-color: rgba(86, 224, 131, 0.22);
        }

        .verify-status-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          flex-shrink: 0;
          transition: background 400ms ease, box-shadow 400ms ease;
        }

        .verify-status-dot.verifying {
          background: #f9c74f;
          box-shadow: 0 0 0 5px rgba(249, 199, 79, 0.18);
          animation: verify-dot-blink 1.4s ease-in-out infinite;
        }

        @keyframes verify-dot-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }

        .verify-status-dot.verified {
          background: #56e083;
          box-shadow: 0 0 0 5px rgba(86, 224, 131, 0.18);
          animation: none;
        }

        .verify-status-card span {
          font-size: 13px;
          color: rgba(244, 244, 244, 0.72);
          line-height: 1.5;
        }

        .verify-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
          justify-content: center;
        }

        .verify-back-button {
          color: rgba(244, 244, 244, 0.52) !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
          background: transparent !important;
          font-size: 12px !important;
        }

        .verify-resent-notice {
          margin: 14px 0 0;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(86, 224, 131, 0.08);
          border: 1px solid rgba(86, 224, 131, 0.18);
          color: #9af0b5;
          font-size: 12px;
          line-height: 18px;
        }

        .waitlist-blocked-banner {
          margin: 0 0 18px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(25, 179, 92, 0.08);
          border: 1px solid rgba(25, 179, 92, 0.18);
          color: #d6ffe2;
          font-size: 13px;
          line-height: 20px;
        }

        @media (max-width: 640px) {
          .grid-two {
            grid-template-columns: 1fr;
          }

          .form-heading h2 {
            font-size: 24px;
            line-height: 30px;
          }

          .btn-primary,
          .btn-google {
            border-radius: 12px;
          }

          .email-verify-row {
            flex-direction: column;
          }

          .email-verify-button {
            width: 100%;
          }

          .verify-card {
            padding: 22px;
            border-radius: 24px;
          }

          .verify-card h2 {
            font-size: 24px;
          }

          .verify-actions {
            flex-direction: column;
          }

          .verify-actions > * {
            width: 100%;
          }
        }

        .btn-google:hover {
          background: rgba(255, 255, 255, 0.72);
          box-shadow: 0 2px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.46);
          transform: translateY(-1px);
        }

        .google-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        @media (max-width: 900px) {
          .header-shell {
            padding-left: 16px;
            padding-right: 16px;
          }

          .landing-main {
            padding: 72px 16px 16px;
          }

          .form-card {
            padding: 20px;
            border-radius: 24px;
          }
        }

        @media (max-width: 640px) {
          .grid-two {
            grid-template-columns: 1fr;
          }

          .form-heading h2 {
            font-size: 24px;
            line-height: 30px;
          }

          .btn-primary,
          .btn-google {
            border-radius: 12px;
          }
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

        /* === ONBOARDING CSS === */

        .onboarding-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 32px 16px;
          background: #f5f6f8;
          color: #131313;
          position: relative;
          overflow: hidden;
        }

        .onboarding-bg-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
        }

        .onboarding-shell {
          width: 100%;
          max-width: 560px;
          position: relative;
          z-index: 1;
        }

        .onboarding-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 36px 40px 40px;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.06),
            0 8px 32px rgba(0,0,0,0.08),
            0 2px 8px rgba(0,0,0,0.04);
        }

        .onboarding-progress {
          margin-bottom: 28px;
        }

        .onboarding-progress-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(19, 19, 19, 0.45);
        }

        .onboarding-progress-row strong {
          color: var(--green-strong);
          font-weight: 700;
        }

        .onboarding-progress-bar {
          width: 100%;
          height: 3px;
          border-radius: 999px;
          background: #ebebeb;
          overflow: hidden;
        }

        .onboarding-progress-fill {
          width: 66%;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--green-main), #38d88a);
          box-shadow: 0 0 10px rgba(86, 224, 131, 0.5);
        }

        .onboarding-header {
          margin-bottom: 28px;
        }

        .onboarding-header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--green-strong);
          background: rgba(86, 224, 131, 0.1);
          border: 1px solid rgba(86, 224, 131, 0.25);
          border-radius: 999px;
          padding: 4px 10px;
          margin-bottom: 14px;
        }

        .onboarding-header h2 {
          margin: 0 0 8px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 24px;
          line-height: 32px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #0d0d0d;
        }

        .onboarding-header p {
          margin: 0;
          font-size: 14px;
          line-height: 22px;
          color: rgba(19, 19, 19, 0.52);
        }

        .onboarding-form {
          display: grid;
          gap: 20px;
        }

        .onb-field-group {
          display: grid;
          gap: 7px;
        }

        .onb-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(19, 19, 19, 0.6);
        }

        .onb-label-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green-main);
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(86, 224, 131, 0.7);
        }

        .onb-required {
          color: var(--green-strong);
          margin-left: 1px;
          font-size: 13px;
        }

        .onb-optional {
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: none;
          font-size: 10px;
          color: rgba(19,19,19,0.35);
          margin-left: 2px;
        }

        .onboarding-input {
          width: 100%;
          height: 52px;
          border-radius: 10px;
          background: #f9f9f9;
          border: 1px solid #e2e2e2;
          padding: 0 16px;
          font-size: 14px;
          font-family: 'Space Grotesk', sans-serif;
          color: #131313;
          outline: none;
          box-sizing: border-box;
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
          appearance: none;
          -webkit-appearance: none;
        }

        .onboarding-input:hover {
          border-color: rgba(86, 224, 131, 0.45);
        }

        .onboarding-input:focus {
          border-color: var(--green-main);
          box-shadow: 0 0 0 3px rgba(86, 224, 131, 0.16);
          background: #ffffff;
        }

        .onboarding-input::placeholder {
          color: rgba(19,19,19,0.3);
        }

        .onboarding-select {
          cursor: pointer;
          padding-right: 44px;
          background:
            linear-gradient(180deg, #ffffff 0%, #f6f8f6 100%);
          border-color: #d8ded8;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 1px 2px rgba(10, 26, 14, 0.06);
          text-shadow: 0 1px 0 rgba(255,255,255,0.55);
        }

        .onboarding-select:required:invalid {
          color: rgba(19, 19, 19, 0.44);
          font-weight: 500;
        }

        .onboarding-select:hover {
          border-color: rgba(58, 165, 97, 0.58);
          background: linear-gradient(180deg, #ffffff 0%, #f4f8f4 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.92),
            0 4px 10px rgba(20, 54, 30, 0.08);
        }

        .onboarding-select:focus,
        .onboarding-select:focus-visible {
          border-color: var(--green-main);
          background: #ffffff;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.95),
            0 0 0 3px rgba(86, 224, 131, 0.18),
            0 8px 16px rgba(22, 58, 33, 0.12);
        }

        .onboarding-select option {
          color: #121212;
          background: #ffffff;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.35;
          letter-spacing: 0.01em;
          padding: 10px 12px;
        }

        .onboarding-select option[value=""] {
          color: rgba(19, 19, 19, 0.45);
          font-weight: 500;
        }

        .onboarding-select option:checked {
          background: linear-gradient(180deg, rgba(86, 224, 131, 0.22) 0%, rgba(86, 224, 131, 0.1) 100%);
          color: #0f2516;
          font-weight: 700;
        }

        .onb-select-wrap {
          position: relative;
          display: flex;
          align-items: center;
          border-radius: 10px;
          isolation: isolate;
        }

        .onb-select-wrap::after {
          content: '';
          position: absolute;
          right: 34px;
          top: 11px;
          bottom: 11px;
          width: 1px;
          background: linear-gradient(180deg, rgba(19,19,19,0.08), rgba(19,19,19,0.16), rgba(19,19,19,0.08));
          pointer-events: none;
          transition: opacity 160ms ease;
        }

        .onb-select-wrap:hover::after {
          opacity: 0.95;
        }

        .onb-select-wrap:focus-within::after {
          background: linear-gradient(180deg, rgba(56, 184, 101, 0.2), rgba(56, 184, 101, 0.52), rgba(56, 184, 101, 0.2));
        }

        .onb-chevron {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(19,19,19,0.58);
          background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(241,245,241,0.95) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.95),
            0 1px 2px rgba(0,0,0,0.08);
          pointer-events: none;
          transition: transform 160ms ease, color 160ms ease, box-shadow 160ms ease;
        }

        .onb-select-wrap:hover .onb-chevron {
          color: rgba(19,19,19,0.72);
        }

        .onb-select-wrap:focus-within .onb-chevron {
          transform: translateY(-50%) rotate(180deg);
          color: var(--green-strong);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,1),
            0 0 0 2px rgba(86, 224, 131, 0.18),
            0 4px 10px rgba(20, 54, 30, 0.14);
        }

        .onb-select-wrap .onboarding-input {
          width: 100%;
        }

        /* Phone row */
        .onb-phone-row {
          display: flex;
          gap: 10px;
          align-items: stretch;
        }

        .onb-country-wrap {
          flex-shrink: 0;
          width: 90px;
        }

        .onb-country-select {
          padding-left: 12px;
          font-size: 13px;
          font-variant-numeric: tabular-nums;
        }

        .onb-phone-input {
          flex: 1;
        }

        /* Section separator */
        .onb-separator {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 4px 0;
        }

        .onb-separator::before,
        .onb-separator::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(86, 224, 131, 0.35), transparent);
        }

        .onb-separator span {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(86, 224, 131, 0.75);
          white-space: nowrap;
        }

        /* Actions */
        .onboarding-actions {
          padding-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .onboarding-back {
          display: flex;
          align-items: center;
          gap: 5px;
          border: 0;
          background: transparent;
          color: rgba(19, 19, 19, 0.38);
          font-family: 'Space Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.03em;
          cursor: pointer;
          padding: 8px 0;
          transition: color 160ms ease;
        }

        .onboarding-back:hover {
          color: rgba(19,19,19,0.65);
        }

        .onboarding-next {
          display: flex;
          align-items: center;
          gap: 7px;
          width: auto;
          min-width: 172px;
          padding: 13px 24px;
          font-size: 13px;
          letter-spacing: 0.06em;
          box-shadow: 0 8px 24px rgba(86, 224, 131, 0.28), 0 2px 8px rgba(86, 224, 131, 0.12);
          justify-content: center;
        }

        .onb-spinner {
          display: inline-block;
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: onb-spin 0.7s linear infinite;
        }

        @keyframes onb-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 600px) {
          .onboarding-card {
            padding: 24px 20px 28px;
            border-radius: 16px;
          }
          .onboarding-header h2 {
            font-size: 20px;
          }
          .onb-country-wrap {
            width: 96px;
          }
          .onboarding-select {
            padding-right: 40px;
          }
          .onb-select-wrap::after {
            right: 31px;
          }
          .onb-chevron {
            right: 8px;
            width: 22px;
            height: 22px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .onboarding-progress-fill,
          .onb-spinner {
            animation: none;
          }
        }

        .waitlist-page {
          min-height: 100vh;
          color: #333333;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 88px 16px 22px;
          background-color: #f8f9fa;
          background-image:
            radial-gradient(circle at 50% 50%, rgba(25, 179, 92, 0.05) 0%, transparent 70%),
            linear-gradient(rgba(0, 0, 0, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.02) 1px, transparent 1px);
          background-size: 100% 100%, 60px 60px, 60px 60px;
        }

        .waitlist-topbar {
          position: fixed;
          left: 0;
          right: 0;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 28px;
          background: rgba(248, 249, 250, 0.82);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .waitlist-logo {
          height: 28px;
          width: auto;
          object-fit: contain;
        }

        .waitlist-close {
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.78);
          color: rgba(51, 51, 51, 0.72);
          width: 30px;
          height: 30px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: color 160ms ease, background-color 160ms ease;
        }

        .waitlist-close:hover {
          color: #19b35c;
          background: #ffffff;
        }

        .waitlist-shell {
          width: 100%;
          max-width: 820px;
          margin: 0 auto;
        }

        .waitlist-progress {
          margin-bottom: 24px;
        }

        .waitlist-progress-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          text-transform: uppercase;
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: 0.14em;
          font-size: 11px;
          color: #6f7166;
        }

        .waitlist-progress-row span:first-child {
          color: #19b35c;
          font-weight: 700;
        }

        .waitlist-progress-track {
          height: 4px;
          border-radius: 999px;
          background: #edf1e6;
          overflow: hidden;
        }

        .waitlist-progress-fill {
          height: 100%;
          width: 100%;
          border-radius: inherit;
          background: #19b35c;
          box-shadow: 0 0 10px rgba(25, 179, 92, 0.4);
        }

        .waitlist-card {
          position: relative;
          border-radius: 16px;
          padding: 30px;
          background-color: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        }

        .waitlist-title {
          margin: 0 0 10px;
          font-family: 'Manrope', 'Space Grotesk', sans-serif;
          font-size: 32px;
          line-height: 1.2;
          letter-spacing: -0.03em;
          color: #333333;
        }

        .waitlist-subtitle {
          margin: 0;
          max-width: 640px;
          font-family: 'Hanken Grotesk', 'Inter', sans-serif;
          font-size: 15px;
          line-height: 1.6;
          color: #5c604e;
        }

        .waitlist-form {
          margin-top: 24px;
          display: grid;
          gap: 18px;
        }

        .waitlist-section {
          display: grid;
          gap: 8px;
        }

        .waitlist-label {
          text-transform: uppercase;
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: 0.14em;
          font-size: 11px;
          font-weight: 700;
          color: #4a4f3f;
        }

        .waitlist-stars {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .waitlist-star {
          border: none;
          background: transparent;
          color: rgba(25, 179, 92, 0.25);
          font-size: 24px;
          line-height: 1;
          padding: 0;
          cursor: pointer;
          transition: transform 120ms ease, color 120ms ease;
        }

        .waitlist-star.active {
          color: #19b35c;
        }

        .waitlist-star:hover {
          transform: translateY(-1px);
          color: #19b35c;
        }

        .waitlist-textarea,
        .waitlist-input {
          width: 100%;
          border: 1px solid #e1e4d5;
          background: #ffffff;
          border-radius: 10px;
          color: #333333;
          font-family: 'Hanken Grotesk', 'Inter', sans-serif;
          font-size: 15px;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .waitlist-textarea {
          min-height: 130px;
          padding: 12px 14px;
          resize: none;
        }

        .waitlist-input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #e1e4d5;
          border-radius: 10px;
          background: #ffffff;
          padding: 0 10px;
          color: #5c604e;
        }

        .waitlist-input-wrap:focus-within,
        .waitlist-textarea:focus {
          border-color: #19b35c;
          box-shadow: 0 0 0 2px rgba(25, 179, 92, 0.18);
        }

        .waitlist-input {
          border: none;
          padding: 10px 0;
          background: transparent;
        }

        .waitlist-input::placeholder,
        .waitlist-textarea::placeholder {
          color: rgba(92, 96, 78, 0.5);
        }

        .waitlist-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .waitlist-actions {
          margin-top: 8px;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .waitlist-later {
          border: none;
          background: transparent;
          color: #5c604e;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          padding: 10px 8px;
        }

        .waitlist-later:hover {
          color: #333333;
        }

        .waitlist-submit {
          border: 1px solid #19b35c;
          background: #19b35c;
          color: #ffffff;
          border-radius: 8px;
          padding: 11px 20px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 14px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: filter 140ms ease, box-shadow 140ms ease;
          box-shadow: 0 0 25px rgba(25, 179, 92, 0.3);
        }

        .waitlist-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .waitlist-submit:hover {
          filter: brightness(1.05);
        }

        .waitlist-success {
          display: grid;
          gap: 16px;
        }

        .waitlist-link {
          text-decoration: none;
          width: fit-content;
        }

        @media (max-width: 820px) {
          .waitlist-topbar {
            padding: 14px 16px;
          }

          .waitlist-card {
            padding: 22px 16px;
          }

          .waitlist-title {
            font-size: 28px;
          }
        }

        @media (max-width: 700px) {
          .waitlist-grid {
            grid-template-columns: 1fr;
          }

          .waitlist-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .waitlist-submit {
            width: 100%;
          }
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
          background-image: url('/images/bg2.png');
          background-size: cover;
          background-position: center center;
          background-attachment: fixed;
        }

        .demo-console-overlay {
          position: fixed;
          inset: 0;
          background: transparent;
          pointer-events: none;
          z-index: 0;
        }

        .demo-console-bg {
          position: fixed;
          inset: 0;
          background: transparent;
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

        .demo-topbar-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .demo-end-inline {
          border: 1px solid rgba(18, 20, 16, 0.14);
          background: rgba(255, 255, 255, 0.7);
          color: #181c1e;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 160ms ease;
        }

        .demo-end-inline:hover:not(:disabled) {
          border-color: rgba(220, 38, 38, 0.5);
          color: #991b1b;
        }

        .demo-end-inline:disabled {
          opacity: 0.55;
          cursor: not-allowed;
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

        .demo-conversation-toggle {
          position: fixed;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          z-index: 24;
          border: 1px solid rgba(18, 20, 16, 0.14);
          background: rgba(255, 255, 255, 0.7);
          color: #181c1e;
          border-radius: 999px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 160ms ease;
        }

        .demo-conversation-toggle:hover {
          border-color: rgba(25, 179, 92, 0.4);
          color: #125f32;
        }

        .demo-conversation-drawer {
          position: fixed;
          top: 80px;
          right: 24px;
          bottom: 24px;
          left: auto;
          z-index: 23;
          width: min(400px, calc(100vw - 48px));
          transform: none;
          opacity: 1;
          pointer-events: auto;
          transition: transform 200ms ease, opacity 200ms ease;
          height: auto;
          max-height: none;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .demo-conversation-drawer.open {
          transform: none;
          opacity: 1;
          pointer-events: auto;
        }

        .demo-conversation-drawer .console-chat-premium {
          height: 100%;
          flex: 1;
          min-height: 0;
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

        .console-card-premium {
          border-radius: 18px;
          padding: 16px;
          min-height: 220px;
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(18, 20, 16, 0.08);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.16);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
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

        .console-status-icon svg {
          width: 20px;
          height: 20px;
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
          grid-column: 1 / span 2;
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
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(18, 20, 16, 0.08);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.16);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .demo-face-area {
          flex: 1;
          min-height: 0;
          position: relative;
          overflow: hidden;
        }

        .demo-face-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          z-index: 1;
        }

        .demo-face-emotion-layer {
          position: absolute;
          background: #000;
          border-radius: 50%;
          overflow: hidden;
          z-index: 2;
          clip-path: ellipse(50% 50% at 50% 50%);
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.8), inset 0 0 10px rgba(0, 0, 0, 0.5);
          pointer-events: none;
        }

        .demo-face-emotion-iframe {
          width: 100%;
          height: 100%;
          border: 0;
          background: transparent;
          display: block;
          overflow: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .demo-face-emotion-iframe::-webkit-scrollbar {
          display: none;
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
          padding: 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(18, 20, 16, 0.08);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.16);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
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
          width: 48px;
          border: 0;
          border-radius: 12px;
          background: var(--primary);
          color: #ffffff;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(25, 179, 92, 0.22);
          transition: transform 160ms ease, box-shadow 160ms ease;
          flex-shrink: 0;
        }

        .console-send-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(25, 179, 92, 0.32);
        }

        .console-send-btn svg {
          width: 20px;
          height: 20px;
          stroke-width: 2.5;
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
          grid-column: 3;
          justify-self: end;
          width: 100%;
          max-width: 400px;
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

        .console-chat-premium {
          height: 100%;
          min-height: 0;
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(18, 20, 16, 0.08);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.16);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
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

        .demo-session-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 16px 14px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(24, 28, 30, 0.68);
          border-top: 1px solid rgba(18, 20, 16, 0.08);
        }

        .demo-disclaimer {
          margin: 0;
          padding: 0 16px 12px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(24, 28, 30, 0.62);
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

        .console-message-bubble.adam.typing {
          position: relative;
        }

        .demo-connecting-overlay {
          position: fixed;
          inset: 0;
          z-index: 110;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(18px);
        }

        .demo-connecting-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 40px 48px;
          border-radius: 20px;
          background: rgba(18, 20, 26, 0.82);
          border: 1px solid rgba(86, 224, 131, 0.18);
          box-shadow: 0 24px 60px rgba(0,0,0,0.4);
        }

        .demo-connecting-spinner {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid rgba(86, 224, 131, 0.18);
          border-top-color: #56e083;
          animation: spin 0.75s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .demo-connecting-status {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.75);
          letter-spacing: 0.01em;
          text-align: center;
        }

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
          max-width: 420px;
          border-radius: 18px;
          padding: 28px;
          text-align: center;
          display: grid;
          gap: 12px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
        }

        .demo-welcome-kicker {
          display: inline-flex;
          justify-self: center;
          align-items: center;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(20, 25, 22, 0.78);
          background: rgba(25, 179, 92, 0.12);
          border: 1px solid rgba(25, 179, 92, 0.24);
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
          font-size: 13px;
          line-height: 1.5;
          color: rgba(68, 73, 51, 0.72);
        }

        .demo-welcome-note {
          font-size: 12px;
          color: rgba(46, 52, 35, 0.78);
          line-height: 1.45;
        }

        .demo-welcome-button {
          width: 100%;
          border: 0;
          border-radius: 14px;
          padding: 16px 20px;
          background: var(--green-strong);
          color: #ffffff;
          font-family: 'Manrope', sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          cursor: pointer;
          min-height: 56px;
          box-shadow: 0 14px 32px rgba(25, 179, 92, 0.32);
          transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
        }

        .demo-welcome-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.02);
          box-shadow: 0 18px 36px rgba(25, 179, 92, 0.38);
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

          .demo-console-chat {
            grid-column: auto;
            justify-self: stretch;
            max-width: none;
          }

          .demo-console-sidebar,
          .demo-console-chat {
            order: 1;
          }

          .demo-console-center {
            grid-column: auto;
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

          .demo-conversation-drawer {
            left: 16px;
            right: 16px;
            top: auto;
            max-width: none;
            min-height: 240px;
            width: auto;
          }
        }

        @media (max-width: 760px) {
          .demo-console-page {
            background-position: 35% 50%;
            background-attachment: scroll;
          }

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

          .demo-conversation-toggle {
            bottom: 12px;
            width: calc(100% - 32px);
            text-align: center;
          }

          .demo-conversation-drawer {
            left: 12px;
            right: 12px;
            top: auto;
            bottom: 58px;
            height: min(58vh, 500px);
            max-height: min(58vh, 500px);
            width: auto;
          }

          .demo-conversation-drawer .console-chat-premium {
            border-radius: 16px;
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

        /* === CUSTOM SELECT (csel) === */
        .csel-wrap {
          position: relative;
          isolation: isolate;
          border-radius: 10px;
        }

        .csel-trigger {
          width: 100%;
          height: 52px;
          border-radius: 10px;
          background: linear-gradient(180deg, #ffffff 0%, #f6f8f6 100%);
          border: 1px solid #d8ded8;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(10,26,14,0.06);
          padding: 0 44px 0 16px;
          font-size: 14px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 500;
          color: #131313;
          letter-spacing: 0.015em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
          box-sizing: border-box;
          position: relative;
        }

        .csel-trigger.placeholder .csel-value {
          color: rgba(19,19,19,0.44);
          font-weight: 500;
        }

        .csel-trigger:hover {
          border-color: rgba(58,165,97,0.58);
          background: linear-gradient(180deg, #ffffff 0%, #f4f8f4 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.92), 0 4px 10px rgba(20,54,30,0.08);
        }

        .csel-trigger:focus,
        .csel-trigger[aria-expanded="true"] {
          border-color: var(--green-main);
          background: #ffffff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), 0 0 0 3px rgba(86,224,131,0.18), 0 8px 16px rgba(22,58,33,0.1);
        }

        .csel-value {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          pointer-events: none;
        }

        .csel-arrow {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(19,19,19,0.58);
          background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(241,245,241,0.95) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 2px rgba(0,0,0,0.08);
          pointer-events: none;
          transition: transform 160ms ease, color 160ms ease, box-shadow 160ms ease;
          flex-shrink: 0;
        }

        .csel-trigger[aria-expanded="true"] .csel-arrow {
          transform: translateY(-50%) rotate(180deg);
          color: var(--green-strong);
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 0 0 2px rgba(86,224,131,0.18), 0 4px 10px rgba(20,54,30,0.14);
        }

        .csel-list {
          position: fixed;
          z-index: 999;
          background: #111111;
          border: 1px solid rgba(86,224,131,0.2);
          border-radius: 12px;
          padding: 6px;
          margin: 0;
          list-style: none;
          max-height: 260px;
          overflow-y: auto;
          box-shadow:
            0 4px 6px rgba(0,0,0,0.06),
            0 10px 40px rgba(0,0,0,0.55),
            0 0 0 1px rgba(255,255,255,0.04),
            inset 0 1px 0 rgba(255,255,255,0.05);
          animation: cselOpen 140ms cubic-bezier(0.2,0,0,1) both;
          scrollbar-width: thin;
          scrollbar-color: rgba(86,224,131,0.2) transparent;
        }

        .csel-list.open-upward {
          animation-name: cselOpenUp;
        }

        .csel-list::-webkit-scrollbar { width: 4px; }
        .csel-list::-webkit-scrollbar-track { background: transparent; }
        .csel-list::-webkit-scrollbar-thumb {
          background: rgba(86,224,131,0.22);
          border-radius: 999px;
        }

        @keyframes cselOpen {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes cselOpenUp {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .csel-item {
          position: relative;
          display: flex;
          align-items: center;
          padding: 9px 12px 9px 32px;
          border-radius: 8px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: rgba(240,240,240,0.82);
          cursor: pointer;
          transition: background 90ms ease, color 90ms ease;
          user-select: none;
          list-style: none;
        }

        .csel-item:hover,
        .csel-item.focused {
          background: rgba(86,224,131,0.12);
          color: #56e083;
        }

        .csel-item.selected {
          color: #56e083;
          font-weight: 600;
        }

        .csel-item.selected:hover,
        .csel-item.selected.focused {
          background: rgba(86,224,131,0.15);
        }

        .csel-check {
          position: absolute;
          left: 12px;
          color: #56e083;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .csel-list { animation: none; }
        }
      `}</style>
      <AppProvider>
        <RouterView />
      </AppProvider>
    </>
  );
}
