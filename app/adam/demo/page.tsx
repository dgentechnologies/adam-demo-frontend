'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/FirebaseAuthProvider';
import { DemoSession } from '@/components/adam/DemoSession';
import { AdamFace } from '@/components/adam/AdamFace';

type AuthTab = 'google' | 'email';
type EmailMode = 'signin' | 'signup';

export default function AdamDemoPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth();

  // Auth gate state
  const [tab,       setTab]       = useState<AuthTab>('google');
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    document.title = 'ADAM Live — DGEN Technologies';
  }, []);

  const clearError = () => setError('');

  const handleGoogle = async () => {
    setBusy(true); clearError();
    try { await signInWithGoogle(); }
    catch { setError('Google sign-in failed. Please try again.'); }
    finally { setBusy(false); }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Enter email and password.'); return; }
    setBusy(true); clearError();
    try {
      if (emailMode === 'signin') await signInWithEmail(email, password);
      else                        await signUpWithEmail(email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        setError('Invalid email or password.');
      else if (code === 'auth/email-already-in-use')
        setError('Account already exists. Sign in instead.');
      else if (code === 'auth/weak-password')
        setError('Password must be at least 6 characters.');
      else if (code === 'auth/invalid-email')
        setError('Enter a valid email address.');
      else
        setError('Authentication failed. Please try again.');
    } finally { setBusy(false); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0a0a0a' }}>
        <div
          style={{
            width: 32, height: 32,
            border: '2px solid #4AF0FF',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#9a9a9a', fontSize: 13, fontFamily: '"Share Tech Mono", monospace' }}>
          INITIALISING…
        </p>
      </div>
    );
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-5 py-8"
        style={{ background: '#0a0a0a' }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Face + title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <AdamFace emotion="idle" faceState="idle" size={130} />
            </div>
            <h1
              style={{
                fontFamily: '"Rajdhani", sans-serif',
                fontWeight: 600,
                fontSize: 34,
                letterSpacing: '0.06em',
                color: '#f0f0f0',
                margin: 0,
              }}
            >
              Talk to <span style={{ color: '#4AF0FF' }}>ADAM</span>
            </h1>
            <p
              style={{
                fontFamily: '"Share Tech Mono", monospace',
                fontSize: 12,
                color: '#9a9a9a',
                marginTop: 6,
                letterSpacing: '0.05em',
              }}
            >
              5 MIN · 20 TURNS · FREE PREVIEW
            </p>
          </div>

          {/* Card */}
          <div
            style={{
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.055)',
              borderRadius: 16,
              padding: '28px 24px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                gap: 2,
                background: '#1a1a1a',
                borderRadius: 10,
                padding: 3,
                marginBottom: 24,
              }}
            >
              {(['google', 'email'] as AuthTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); clearError(); }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 12,
                    letterSpacing: '0.05em',
                    transition: 'all 0.2s',
                    background: tab === t ? '#4AF0FF' : 'transparent',
                    color:      tab === t ? '#0a0a0a' : '#9a9a9a',
                    fontWeight: tab === t ? 700 : 400,
                  }}
                >
                  {t === 'google' ? 'GOOGLE' : 'EMAIL'}
                </button>
              ))}
            </div>

            {/* Google tab */}
            {tab === 'google' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={handleGoogle}
                  disabled={busy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '12px 0',
                    background: busy ? '#e0e0e0' : '#ffffff',
                    color: '#1a1a1a',
                    border: 'none',
                    borderRadius: 10,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontFamily: '"DM Sans", sans-serif',
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'background 0.2s',
                  }}
                >
                  {busy ? (
                    <div
                      style={{
                        width: 18, height: 18,
                        border: '2px solid #aaa',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  ) : (
                    <Image src="/images/google-logo.svg" alt="Google" width={18} height={18} />
                  )}
                  {busy ? 'Signing in…' : 'Continue with Google'}
                </button>
                <p
                  style={{
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: 11,
                    color: '#555',
                    textAlign: 'center',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  A popup will open. Allow popups if blocked.
                </p>
              </div>
            )}

            {/* Email tab */}
            {tab === 'email' && (
              <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Mode toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  {(['signin', 'signup'] as EmailMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setEmailMode(m); clearError(); }}
                      style={{
                        padding: '5px 14px',
                        border: `1px solid ${emailMode === m ? '#4AF0FF' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 6,
                        background: emailMode === m ? 'rgba(74,240,255,0.08)' : 'transparent',
                        color: emailMode === m ? '#4AF0FF' : '#9a9a9a',
                        fontFamily: '"Share Tech Mono", monospace',
                        fontSize: 11,
                        letterSpacing: '0.04em',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {m === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                    </button>
                  ))}
                </div>

                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#f0f0f0',
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={emailMode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#f0f0f0',
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: '12px 0',
                    background: busy ? 'rgba(74,240,255,0.4)' : '#4AF0FF',
                    color: '#0a0a0a',
                    border: 'none',
                    borderRadius: 10,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontFamily: '"Rajdhani", sans-serif',
                    fontWeight: 600,
                    fontSize: 15,
                    letterSpacing: '0.06em',
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {busy && (
                    <div
                      style={{
                        width: 16, height: 16,
                        border: '2px solid rgba(0,0,0,0.3)',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  )}
                  {busy ? 'Please wait…' : emailMode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            )}

            {/* Error */}
            {error && (
              <p
                style={{
                  marginTop: 12,
                  padding: '9px 12px',
                  background: 'rgba(220,80,80,0.12)',
                  border: '1px solid rgba(220,80,80,0.3)',
                  borderRadius: 8,
                  color: '#ff8080',
                  fontFamily: '"Share Tech Mono", monospace',
                  fontSize: 12,
                  margin: '12px 0 0',
                }}
              >
                {error}
              </p>
            )}
          </div>

          {/* Privacy note */}
          <p
            style={{
              marginTop: 16,
              textAlign: 'center',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: 11,
              color: 'rgba(255,255,255,0.22)',
              lineHeight: 1.6,
            }}
          >
            By signing in you agree to the{' '}
            <a
              href="https://dgentechnologies.com/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#4AF0FF', textDecoration: 'none' }}
            >
              Privacy Policy
            </a>
            . Session data is used only for demo analytics.
          </p>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600&family=Share+Tech+Mono&family=DM+Sans:wght@300;400;600&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
          input:focus {
            border-color: rgba(74,240,255,0.4) !important;
            box-shadow: 0 0 0 2px rgba(74,240,255,0.12);
          }
        `}</style>
      </div>
    );
  }

  // ── Signed in — demo ──────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: '#0a0a0a' }}
    >
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1
              style={{
                fontFamily: '"Rajdhani", sans-serif',
                fontWeight: 600,
                fontSize: 26,
                letterSpacing: '0.08em',
                color: '#f0f0f0',
                margin: 0,
              }}
            >
              ADAM <span style={{ color: '#4AF0FF' }}>LIVE</span>
            </h1>
            <p
              style={{
                fontFamily: '"Share Tech Mono", monospace',
                fontSize: 11,
                color: '#9a9a9a',
                margin: '3px 0 0',
                letterSpacing: '0.04em',
              }}
            >
              POWERED BY GEMINI LIVE
            </p>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#9a9a9a',
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: 11,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#f0f0f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#9a9a9a'; }}
          >
            SIGN OUT
          </button>
        </div>

        <DemoSession user={user} />

        {/* Footer strip */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <p
            style={{
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: 10,
              color: 'rgba(255,255,255,0.22)',
              margin: 0,
              letterSpacing: '0.04em',
            }}
          >
            {user.email}
          </p>
          <a
            href="https://dgentechnologies.com/adam/waitlist"
            target="_top"
            style={{
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: 11,
              color: '#4AF0FF',
              textDecoration: 'none',
              letterSpacing: '0.04em',
              borderBottom: '1px solid rgba(74,240,255,0.3)',
              paddingBottom: 1,
              transition: 'border-color 0.2s',
            }}
          >
            JOIN WAITLIST →
          </a>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600&family=Share+Tech+Mono&family=DM+Sans:wght@300;400&display=swap');
      `}</style>
    </div>
  );
}
