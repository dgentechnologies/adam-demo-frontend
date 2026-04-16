'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/components/FirebaseAuthProvider';
import { DemoSession } from '@/components/adam/DemoSession';
import { AdamFace } from '@/components/adam/AdamFace';
import { OnboardingForm } from '@/components/adam/OnboardingForm';
import { db } from '@/lib/firebase';

// Waitlist URL — update when company URL is provided
const WAITLIST_URL = 'https://dgentechnologies.com/adam#waitlist';

type Step        = 'auth' | 'checking' | 'onboarding' | 'demo';
type AuthTab     = 'google' | 'email';
type EmailMode   = 'signin' | 'signup';
type DemoOverlay = 'welcome' | 'active' | 'ended';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600&family=Share+Tech+Mono&family=DM+Sans:wght@300;400;600&display=swap');`;

// ── Shared input/label styles ─────────────────────────────────────────────────
const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#f0f0f0',
  fontFamily: '"DM Sans", sans-serif', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
};

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', gap: 20 }}>
      <AdamFace emotion="idle" faceState="idle" size={160} />
      <div style={{ width: 28, height: 28, border: '2px solid #4AF0FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pgSpin 0.8s linear infinite' }} />
      {label && <p style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 12, color: '#9a9a9a', letterSpacing: '0.1em' }}>{label}</p>}
      <style>{`@keyframes pgSpin { to { transform: rotate(360deg); } } ${FONTS}`}</style>
    </div>
  );
}

// ── Welcome overlay ───────────────────────────────────────────────────────────
function WelcomeOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>

        {/* Animated face */}
        <div style={{ filter: 'drop-shadow(0 0 24px rgba(74,240,255,0.35))' }}>
          <AdamFace emotion="happy" faceState="idle" size={180} />
        </div>

        {/* Greeting */}
        <div>
          <h1
            style={{
              fontFamily: '"Rajdhani", sans-serif', fontWeight: 600,
              fontSize: 36, letterSpacing: '0.06em', color: '#f0f0f0', margin: 0,
            }}
          >
            Hello. I&apos;m <span style={{ color: '#4AF0FF' }}>ADAM</span>.
          </h1>
          <p
            style={{
              fontFamily: '"Share Tech Mono", monospace', fontSize: 11,
              color: '#9a9a9a', marginTop: 6, letterSpacing: '0.08em',
            }}
          >
            AUTONOMOUS DESKTOP AI MODULE · DGEN TECHNOLOGIES
          </p>
        </div>

        {/* Message from ADAM's perspective */}
        <div
          style={{
            background: 'rgba(74,240,255,0.04)',
            border: '1px solid rgba(74,240,255,0.12)',
            borderRadius: 14, padding: '18px 20px',
            textAlign: 'left',
          }}
        >
          <p
            style={{
              fontFamily: '"DM Sans", sans-serif', fontSize: 14, lineHeight: 1.75,
              color: '#c0c0c0', margin: 0,
            }}
          >
            I can hear your voice, process what you say in real time, and respond like a person —
            because I&apos;m powered by Gemini Live. You have{' '}
            <span style={{ color: '#4AF0FF', fontWeight: 600 }}>5 minutes</span>{' '}
            with me right now.
          </p>
          <p
            style={{
              fontFamily: '"DM Sans", sans-serif', fontSize: 14, lineHeight: 1.75,
              color: '#c0c0c0', margin: '10px 0 0',
            }}
          >
            Hold the <span style={{ color: '#4AF0FF' }}>mic button</span> and speak clearly.
            Release when you&apos;re done. I&apos;ll take it from there.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onDismiss}
          style={{
            width: '100%', padding: '14px 0',
            background: '#4AF0FF', color: '#0a0a0a',
            border: 'none', borderRadius: 12,
            fontFamily: '"Rajdhani", sans-serif', fontWeight: 600,
            fontSize: 16, letterSpacing: '0.08em',
            cursor: 'pointer',
            boxShadow: '0 0 28px rgba(74,240,255,0.35)',
            transition: 'transform 0.1s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 40px rgba(74,240,255,0.5)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 28px rgba(74,240,255,0.35)'; }}
        >
          UNDERSTOOD →
        </button>

        <p style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.06em' }}>
          MICROPHONE ACCESS REQUIRED
        </p>
      </div>
      <style>{FONTS}</style>
    </div>
  );
}

// ── End overlay ───────────────────────────────────────────────────────────────
function EndOverlay({ reason }: { reason: string }) {
  const isTimeout  = reason === 'timeout' || reason === 'cap_reached';
  const isUserExit = reason === 'user_disconnect';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(10,10,10,0.96)',
        backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

        <AdamFace emotion="sad" faceState="idle" size={150} />

        <div>
          <p
            style={{
              fontFamily: '"Share Tech Mono", monospace', fontSize: 11,
              color: '#9a9a9a', letterSpacing: '0.1em', margin: '0 0 8px',
            }}
          >
            {isTimeout ? 'PREVIEW ENDED' : isUserExit ? 'SESSION CLOSED' : 'SESSION ENDED'}
          </p>
          <h2
            style={{
              fontFamily: '"Rajdhani", sans-serif', fontWeight: 600,
              fontSize: 28, letterSpacing: '0.05em', color: '#f0f0f0', margin: 0,
            }}
          >
            {isTimeout
              ? "That's your 5-minute preview."
              : isUserExit
              ? 'You ended the session.'
              : 'Session complete.'}
          </h2>
          <p
            style={{
              fontFamily: '"DM Sans", sans-serif', fontSize: 14,
              color: '#9a9a9a', marginTop: 10, lineHeight: 1.6,
            }}
          >
            {isTimeout
              ? 'Want ADAM on your desk, available all day? Be first when it ships.'
              : 'Ready to own one? Join the waitlist now.'}
          </p>
        </div>

        {/* Waitlist CTA */}
        <a
          href={WAITLIST_URL}
          target="_top"
          style={{
            display: 'block', width: '100%', padding: '14px 0',
            background: '#4AF0FF', color: '#0a0a0a',
            borderRadius: 12, textDecoration: 'none',
            fontFamily: '"Rajdhani", sans-serif', fontWeight: 600,
            fontSize: 16, letterSpacing: '0.08em', textAlign: 'center',
            boxShadow: '0 0 28px rgba(74,240,255,0.3)',
          }}
        >
          → JOIN THE ADAM WAITLIST
        </a>

        {/* Try again */}
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#9a9a9a', borderRadius: 10,
            padding: '10px 28px', cursor: 'pointer',
            fontFamily: '"Share Tech Mono", monospace', fontSize: 12,
            letterSpacing: '0.06em',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#f0f0f0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#9a9a9a'; }}
        >
          TRY AGAIN ↺
        </button>
      </div>
      <style>{FONTS}</style>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdamDemoPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [step,        setStep]        = useState<Step>('auth');
  const [demoOverlay, setDemoOverlay] = useState<DemoOverlay>('welcome');
  const [endReason,   setEndReason]   = useState('');

  // Auth form
  const [tab,       setTab]       = useState<AuthTab>('google');
  const [emailMode, setEmailMode] = useState<EmailMode>('signup');
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => { document.title = 'ADAM Live — DGEN Technologies'; }, []);

  // After auth, check onboarding
  useEffect(() => {
    if (!user || loading) return;
    setStep('checking');
    getDoc(doc(db, 'onboarding', user.uid))
      .then((snap) => setStep(snap.exists() && snap.data()?.completed ? 'demo' : 'onboarding'))
      .catch(() => setStep('demo')); // Firestore unavailable → skip
  }, [user, loading]);

  const clearError = () => setError('');

  const handleGoogle = async () => {
    setBusy(true); clearError();
    try { await signInWithGoogle(); }
    catch { setError('Google sign-in failed. Please try again.'); }
    finally { setBusy(false); }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailMode === 'signup' && !name.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim() || !password) { setError('Enter email and password.'); return; }
    setBusy(true); clearError();
    try {
      if (emailMode === 'signin') await signInWithEmail(email, password);
      else                        await signUpWithEmail(email, password, name.trim());
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        setError('Invalid email or password.');
      else if (code === 'auth/email-already-in-use')
        setError('Account already exists — sign in instead.');
      else if (code === 'auth/weak-password')
        setError('Password must be at least 6 characters.');
      else if (code === 'auth/invalid-email')
        setError('Enter a valid email address.');
      else
        setError('Authentication failed. Please try again.');
    } finally { setBusy(false); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading)              return <Spinner />;
  if (step === 'checking')  return <Spinner label="PREPARING ADAM…" />;

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: '32px 20px' }}>

        {/* Progress — step 1 of 3 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ width: n === 1 ? 32 : 10, height: 4, borderRadius: 2, background: n === 1 ? '#4AF0FF' : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Face + title */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <AdamFace emotion="happy" faceState="idle" size={120} />
            </div>
            <h1 style={{ fontFamily: '"Rajdhani", sans-serif', fontWeight: 600, fontSize: 32, letterSpacing: '0.06em', color: '#f0f0f0', margin: 0 }}>
              Talk to <span style={{ color: '#4AF0FF' }}>ADAM</span>
            </h1>
            <p style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 11, color: '#9a9a9a', marginTop: 5, letterSpacing: '0.06em' }}>
              5 MIN · 20 TURNS · FREE PREVIEW
            </p>
          </div>

          {/* Card */}
          <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.055)', borderRadius: 16, padding: '26px 22px', boxShadow: '0 10px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: '#1a1a1a', borderRadius: 10, padding: 3, marginBottom: 22 }}>
              {(['google', 'email'] as AuthTab[]).map((t) => (
                <button key={t} onClick={() => { setTab(t); clearError(); }}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: '"Share Tech Mono", monospace', fontSize: 12, letterSpacing: '0.05em', transition: 'all 0.2s', background: tab === t ? '#4AF0FF' : 'transparent', color: tab === t ? '#0a0a0a' : '#9a9a9a', fontWeight: tab === t ? 700 : 400 }}
                >
                  {t === 'google' ? 'GOOGLE' : 'EMAIL'}
                </button>
              ))}
            </div>

            {/* Google tab */}
            {tab === 'google' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleGoogle} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '12px 0', background: busy ? '#e0e0e0' : '#ffffff', color: '#1a1a1a', border: 'none', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: '"DM Sans", sans-serif', fontWeight: 600, fontSize: 14, transition: 'background 0.2s' }}
                >
                  {busy
                    ? <div style={{ width: 18, height: 18, border: '2px solid #aaa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pgSpin 0.8s linear infinite' }} />
                    : <Image src="/images/google-logo.svg" alt="Google" width={18} height={18} />
                  }
                  {busy ? 'Signing in…' : 'Continue with Google'}
                </button>
                <p style={{ fontFamily: '"DM Sans", sans-serif', fontSize: 11, color: '#555', textAlign: 'center', margin: 0 }}>
                  A popup will open. Allow popups if blocked.
                </p>
              </div>
            )}

            {/* Email tab */}
            {tab === 'email' && (
              <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {/* Mode toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                  {(['signup', 'signin'] as EmailMode[]).map((m) => (
                    <button key={m} type="button" onClick={() => { setEmailMode(m); clearError(); }}
                      style={{ padding: '5px 14px', border: `1px solid ${emailMode === m ? '#4AF0FF' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, background: emailMode === m ? 'rgba(74,240,255,0.08)' : 'transparent', color: emailMode === m ? '#4AF0FF' : '#9a9a9a', fontFamily: '"Share Tech Mono", monospace', fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      {m === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}
                    </button>
                  ))}
                </div>

                {emailMode === 'signup' && (
                  <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={INPUT} />
                )}
                <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required style={INPUT} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={emailMode === 'signin' ? 'current-password' : 'new-password'} required style={INPUT} />

                <button type="submit" disabled={busy}
                  style={{ padding: '12px 0', background: busy ? 'rgba(74,240,255,0.4)' : '#4AF0FF', color: '#0a0a0a', border: 'none', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: '"Rajdhani", sans-serif', fontWeight: 600, fontSize: 15, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s', marginTop: 2 }}
                >
                  {busy && <div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pgSpin 0.8s linear infinite' }} />}
                  {busy ? 'Please wait…' : emailMode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            )}

            {/* Error */}
            {error && (
              <p style={{ marginTop: 12, padding: '9px 12px', background: 'rgba(220,80,80,0.12)', border: '1px solid rgba(220,80,80,0.3)', borderRadius: 8, color: '#ff8080', fontFamily: '"Share Tech Mono", monospace', fontSize: 12 }}>
                {error}
              </p>
            )}
          </div>

          {/* Privacy */}
          <p style={{ marginTop: 14, textAlign: 'center', fontFamily: '"DM Sans", sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.22)', lineHeight: 1.6 }}>
            By continuing you agree to the{' '}
            <a href="https://dgentechnologies.com/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#4AF0FF', textDecoration: 'none' }}>Privacy Policy</a>.
          </p>
        </div>

        <style>{`
          ${FONTS}
          @keyframes pgSpin { to { transform: rotate(360deg); } }
          input:focus { border-color: rgba(74,240,255,0.4) !important; box-shadow: 0 0 0 2px rgba(74,240,255,0.1); }
        `}</style>
      </div>
    );
  }

  // ── Onboarding ────────────────────────────────────────────────────────────
  if (step === 'onboarding') {
    return <OnboardingForm user={user} onComplete={() => setStep('demo')} />;
  }

  // ── Demo — welcome overlay ────────────────────────────────────────────────
  if (demoOverlay === 'welcome') {
    return <WelcomeOverlay onDismiss={() => setDemoOverlay('active')} />;
  }

  // ── Demo — active session ─────────────────────────────────────────────────
  if (demoOverlay === 'active') {
    return (
      <DemoSession
        user={user}
        fullscreen
        onSessionEnded={(reason) => { setEndReason(reason); setDemoOverlay('ended'); }}
      />
    );
  }

  // ── Demo — ended overlay ──────────────────────────────────────────────────
  return <EndOverlay reason={endReason} />;
}
