import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// ============================================================================
// MOCK API FUNCTIONS
// ============================================================================

const mockDelay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

async function apiAuthLogin(email, password) {
  await mockDelay();
  if (email === 'wrong@test.com') {
    return { error: 'Invalid credentials' };
  }
  return { token: 'mock-token-abc', userId: 'usr_001' };
}

async function apiOnboarding(userId, name, role, interest, referral) {
  await mockDelay();
  return { status: 'ok', profileId: 'prf_001' };
}

async function apiDemoStart(userId, startTime) {
  await mockDelay();
  return { sessionId: 'sess_001', durationSeconds: 300 };
}

async function apiDemoEnd(userId, endTime) {
  await mockDelay();
  return { status: 'ended', sessionId: 'sess_001' };
}

async function apiWaitlist(name, email, message) {
  await mockDelay();
  return { status: 'joined', position: 47 };
}

// ============================================================================
// CONTEXT FOR STATE MANAGEMENT
// ============================================================================

const AppContext = createContext();

function AppProvider({ children }) {
  const [authToken, setAuthToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    role: '',
    interest: '',
    referral: ''
  });

  const value = {
    authToken,
    setAuthToken,
    userId,
    setUserId,
    onboardingData,
    setOnboardingData
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return ctx;
}

// ============================================================================
// HASH ROUTER
// ============================================================================

function useRouter() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.slice(1) || '/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const push = (path) => {
    window.location.hash = path;
  };

  return { route, push };
}

// ============================================================================
// PAGE COMPONENTS
// ============================================================================

// --- LOGIN PAGE ---
function LoginPage({ router }) {
  const { setAuthToken, setUserId } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await apiAuthLogin(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setAuthToken(result.token);
      setUserId(result.userId);
      setLoading(false);
      router.push('/onboarding');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.centerBox}>
        <div style={styles.logo}>ADAM</div>
        <div style={styles.tagline}>
          Autonomous Desktop AI Module · DGEN Technologies
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          {error && <div style={styles.errorText}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging in...' : 'Enter'}
          </button>
        </form>

        <div style={styles.helperText}>
          Demo user: any email (use wrong@test.com for failure test)
        </div>
      </div>
    </div>
  );
}

// --- ONBOARDING PAGE ---
function OnboardingPage({ router }) {
  const { userId, onboardingData, setOnboardingData } = useAppContext();
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setOnboardingData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!onboardingData.name || !onboardingData.role || !onboardingData.interest || !onboardingData.referral) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);
    await apiOnboarding(
      userId,
      onboardingData.name,
      onboardingData.role,
      onboardingData.interest,
      onboardingData.referral
    );
    setLoading(false);
    router.push('/demo');
  };

  return (
    <div style={styles.container}>
      <div style={styles.centerBox}>
        <div style={styles.stepIndicator}>
          <div style={styles.activeDot}></div>
          <div style={styles.inactiveDot}></div>
          <div style={styles.inactiveDot}></div>
        </div>

        <div style={styles.pageTitle}>Tell us about yourself</div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Full name</label>
          <input
            type="text"
            placeholder="John Doe"
            value={onboardingData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            style={styles.input}
            required
          />

          <label style={styles.label}>Role</label>
          <select
            value={onboardingData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            style={styles.input}
            required
          >
            <option value="">— Select your role —</option>
            <option value="Developer">Developer</option>
            <option value="Researcher">Researcher</option>
            <option value="Creator">Creator</option>
            <option value="Business">Business</option>
            <option value="Other">Other</option>
          </select>

          <label style={styles.label}>Primary interest</label>
          <div style={styles.radioGroup}>
            {['Voice control', 'Smart home', 'Productivity', 'Just exploring'].map((opt) => (
              <label key={opt} style={styles.radioLabel}>
                <input
                  type="radio"
                  name="interest"
                  value={opt}
                  checked={onboardingData.interest === opt}
                  onChange={(e) => handleChange('interest', e.target.value)}
                  style={styles.radioInput}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          <label style={styles.label}>How did you hear about ADAM?</label>
          <select
            value={onboardingData.referral}
            onChange={(e) => handleChange('referral', e.target.value)}
            style={styles.input}
            required
          >
            <option value="">— Select —</option>
            <option value="YouTube">YouTube</option>
            <option value="Twitter/X">Twitter/X</option>
            <option value="Friend">Friend</option>
            <option value="Other">Other</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              marginTop: '2rem',
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Continuing...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- DEMO PAGE ---
function DemoPage({ router }) {
  const { userId, onboardingData } = useAppContext();
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [sessionActive, setSessionActive] = useState(false);
  const timerRef = useRef(null);
  const [query, setQuery] = useState('');

  // Handle start demo button
  const handleStartDemo = async () => {
    setShowWelcomeOverlay(false);
    setSessionActive(true);
    await apiDemoStart(userId, Date.now());
  };

  // Countdown timer
  useEffect(() => {
    if (!sessionActive) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSessionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [sessionActive]);

  const handleSessionEnd = async () => {
    setSessionActive(false);
    await apiDemoEnd(userId, Date.now());
    // Show end overlay
    setTimeout(() => {
      setShowEndOverlay(true);
    }, 500);
  };

  const [showEndOverlay, setShowEndOverlay] = useState(false);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeRemaining <= 30) return '#FF4444';
    if (timeRemaining <= 60) return '#FFB347';
    return '#FFFFFF';
  };

  if (showEndOverlay) {
    return (
      <div style={styles.container}>
        <div
          style={{
            ...styles.overlay,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '2rem' }}>✓</div>
          <h2 style={styles.overlayTitle}>Your demo session has ended.</h2>
          <button
            onClick={() => router.push('/waitlist')}
            style={styles.button}
          >
            Join the waitlist →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {showWelcomeOverlay && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <h2 style={styles.overlayTitle}>Welcome, {onboardingData.name}</h2>
            <p style={styles.overlayBody}>
              You have 5 minutes with ADAM. Ask anything, explore freely. Your session begins when you click Start.
            </p>
            <button onClick={handleStartDemo} style={styles.button}>
              Start demo
            </button>
          </div>
        </div>
      )}

      {!showWelcomeOverlay && sessionActive && (
        <>
          <div style={styles.demoTopBar}>
            <div style={styles.logo}>ADAM</div>
            <div style={{ color: getTimerColor(), fontWeight: 'bold', fontSize: '1.25rem' }}>
              {formatTime(timeRemaining)}
            </div>
          </div>

          <div style={styles.demoContent}>
            <div style={styles.faceBox}>[ ADAM face output ]</div>

            <div style={styles.suggestedChips}>
              {['What can you do?', 'Tell me a joke', 'Control my lights'].map((chip) => (
                <button
                  key={chip}
                  style={styles.chip}
                  onClick={() => setQuery(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div style={styles.inputBar}>
              <input
                type="text"
                placeholder="Type your query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setQuery('');
                }}
                style={styles.queryInput}
              />
              <button
                onClick={() => setQuery('')}
                style={styles.sendButton}
              >
                Send
              </button>
            </div>

            <div style={styles.sessionInfo}>
              Session: {formatTime(timeRemaining)} remaining
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- WAITLIST PAGE ---
function WaitlistPage() {
  const { onboardingData } = useAppContext();
  const [name, setName] = useState(onboardingData.name || '');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email) {
      alert('Please fill required fields');
      return;
    }

    setLoading(true);
    await apiWaitlist(name, email, message);
    setLoading(false);
    setConfirmed(true);
  };

  if (confirmed) {
    return (
      <div style={styles.container}>
        <div style={styles.centerBox}>
          <div style={{ fontSize: '3rem', marginBottom: '2rem', textAlign: 'center' }}>✓</div>
          <h2 style={styles.pageTitle}>You're on the list.</h2>
          <p style={styles.mutedText} style={{ textAlign: 'center', marginTop: '1rem' }}>
            We'll be in touch soon. Follow @DGENTech for updates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.centerBox}>
        <h1 style={styles.pageTitle}>Be the first to get ADAM.</h1>
        <p style={styles.subtext}>
          Early access opens soon. Drop your email and we'll reach out.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <textarea
            placeholder="Anything you'd like us to know?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ ...styles.input, minHeight: '100px', resize: 'none' }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Joining...' : 'Join waitlist'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#000000',
    color: '#FFFFFF',
    fontFamily: "'Courier New', Courier, monospace",
    padding: '2rem'
  },
  centerBox: {
    width: '100%',
    maxWidth: '440px'
  },
  logo: {
    fontSize: '2rem',
    fontWeight: 'bold',
    letterSpacing: '0.3em',
    textAlign: 'center',
    marginBottom: '0.5rem'
  },
  tagline: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: '2rem'
  },
  pageTitle: {
    fontSize: '1.5rem',
    marginBottom: '1rem',
    fontWeight: 'bold'
  },
  subtext: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '2rem'
  },
  mutedText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.9rem'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  label: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '0.25rem',
    display: 'block'
  },
  input: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#FFFFFF',
    padding: '0.75rem',
    borderRadius: '4px',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 200ms ease',
    boxSizing: 'border-box'
  },
  inputFocus: {
    borderColor: 'rgba(255,255,255,0.6)'
  },
  button: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#FFFFFF',
    padding: '0.75rem 1rem',
    borderRadius: '4px',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'background-color 200ms ease',
    fontWeight: 'bold'
  },
  buttonHover: {
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  errorText: {
    color: '#FF4444',
    fontSize: '0.85rem',
    marginTop: '-0.5rem'
  },
  helperText: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: '2rem'
  },
  stepIndicator: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'center',
    marginBottom: '2rem'
  },
  activeDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF'
  },
  inactiveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  radioInput: {
    cursor: 'pointer',
    width: '16px',
    height: '16px'
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  overlayCard: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '3rem 2rem',
    maxWidth: '440px',
    textAlign: 'center'
  },
  overlayTitle: {
    fontSize: '1.5rem',
    marginBottom: '1.5rem',
    fontWeight: 'bold'
  },
  overlayBody: {
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '2rem',
    lineHeight: '1.6',
    fontSize: '0.95rem'
  },
  demoTopBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 2rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.95)',
    zIndex: 100,
    fontSize: '1rem'
  },
  demoContent: {
    marginTop: '6rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem'
  },
  faceBox: {
    width: '100%',
    maxWidth: '640px',
    aspectRatio: '16 / 9',
    backgroundColor: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '2rem',
    fontSize: '1rem'
  },
  suggestedChips: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: '2rem'
  },
  chip: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#FFFFFF',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 200ms ease'
  },
  inputBar: {
    width: '100%',
    maxWidth: '640px',
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '2rem'
  },
  queryInput: {
    flex: 1,
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#FFFFFF',
    padding: '0.75rem',
    borderRadius: '4px',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.9rem',
    outline: 'none'
  },
  sendButton: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#FFFFFF',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  sessionInfo: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.85rem'
  }
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const { route, push } = useRouter();

  return (
    <AppProvider>
      {route === '/' && <LoginPage router={{ push }} />}
      {route === '/onboarding' && <OnboardingPage router={{ push }} />}
      {route === '/demo' && <DemoPage router={{ push }} />}
      {route === '/waitlist' && <WaitlistPage />}
    </AppProvider>
  );
}
