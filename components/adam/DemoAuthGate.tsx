'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;600&family=Share+Tech+Mono&family=DM+Sans:wght@300;400;500&display=swap');`;

/* ─────────────────────────────────────────────
   EyeBall — mouse-tracking, blinks
   ───────────────────────────────────────────── */
function EyeBall({
  size = 40,
  pupilSize = 14,
  maxDistance = 8,
  isBlinking = false,
  forceLookX,
  forceLookY,
}: {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const pupilPos = () => {
    if (!ref.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = mouse.x - cx;
    const dy = mouse.y - cy;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  };

  const p = pupilPos();

  return (
    <div
      ref={ref}
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        borderRadius: '9999px',
        backgroundColor: 'rgba(255,255,255,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 0 8px rgba(74,240,255,0.35)',
        transition: 'height 0.12s ease-out',
      }}
    >
      {!isBlinking && (
        <div
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            borderRadius: '9999px',
            backgroundColor: '#0a0a0a',
            transform: `translate(${p.x}px, ${p.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   AuthRobotFace — animated mascot for the left panel
   ───────────────────────────────────────────── */
function AuthRobotFace({
  isTypingEmail,
  isTypingPassword,
  passwordVisible,
  hasPassword,
}: {
  isTypingEmail: boolean;
  isTypingPassword: boolean;
  passwordVisible: boolean;
  hasPassword: boolean;
}) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const [lookInward, setLookInward] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const schedule = (): ReturnType<typeof setTimeout> =>
      setTimeout(() => {
        setBlinking(true);
        setTimeout(() => { setBlinking(false); schedule(); }, 150);
      }, Math.random() * 4000 + 3000);
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isTypingEmail) {
      setLookInward(true);
      const t = setTimeout(() => setLookInward(false), 900);
      return () => clearTimeout(t);
    }
    setLookInward(false);
  }, [isTypingEmail]);

  const headLean = () => {
    if (!headRef.current) return { faceX: 0, faceY: 0, lean: 0 };
    const r = headRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 3;
    const dx = mouse.x - cx;
    const dy = mouse.y - cy;
    return {
      faceX: Math.max(-12, Math.min(12, dx / 25)),
      faceY: Math.max(-8, Math.min(8, dy / 35)),
      lean: Math.max(-5, Math.min(5, -dx / 140)),
    };
  };

  const { faceX, faceY, lean } = headLean();
  const isPeeking = hasPassword && passwordVisible;
  const eyeForceX = isPeeking ? 3 : lookInward ? 2 : undefined;
  const eyeForceY = isPeeking ? 5 : lookInward ? 3 : undefined;

  return (
    <div
      ref={headRef}
      style={{
        position: 'relative',
        width: '192px',
        height: '220px',
        transformOrigin: 'bottom center',
        transform: `skewX(${lean}deg)`,
        transition: 'transform 0.6s ease-out',
      }}
    >
      {/* Neck */}
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 34, height: 24, backgroundColor: '#1a1a1a', border: '1px solid rgba(74,240,255,0.15)', borderRadius: '2px 2px 6px 6px' }} />

      {/* Head shell */}
      <div
        style={{
          position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
          width: 192, height: 150,
          backgroundColor: '#141414',
          borderRadius: '96px 96px 40px 40px',
          border: '1px solid rgba(74,240,255,0.18)',
          boxShadow: '0 0 30px rgba(74,240,255,0.08), inset 0 1px 0 rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }}
      >
        {/* Scanline overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)', pointerEvents: 'none', zIndex: 10 }} />

        {/* OLED face oval */}
        <div
          style={{
            position: 'absolute', top: 20, left: '50%',
            transform: `translate(calc(-50% + ${faceX}px), ${faceY}px)`,
            transition: 'transform 0.15s ease-out',
            width: 152, height: 110,
            backgroundColor: '#050505',
            borderRadius: '76px 76px 50px 50px',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
          }}
        >
          {/* Eyes */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <EyeBall size={40} pupilSize={14} maxDistance={8} isBlinking={blinking}
              forceLookX={eyeForceX !== undefined ? -eyeForceX : undefined} forceLookY={eyeForceY} />
            <EyeBall size={40} pupilSize={14} maxDistance={8} isBlinking={blinking}
              forceLookX={eyeForceX} forceLookY={eyeForceY} />
          </div>
          {/* Mouth */}
          <div style={{
            width: isTypingPassword ? 48 : isPeeking ? 36 : 28,
            height: isTypingPassword ? 8 : 4,
            backgroundColor: 'rgba(255,255,255,0.85)',
            borderRadius: isTypingPassword ? 4 : 2,
            boxShadow: isTypingPassword ? '0 0 8px rgba(74,240,255,0.5)' : 'none',
            transition: 'all 0.25s ease-out',
          }} />
        </div>
      </div>

      {/* Camera dots */}
      <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '9999px',
            backgroundColor: i === 1 ? 'rgba(74,240,255,0.6)' : 'rgba(255,255,255,0.15)',
            boxShadow: i === 1 ? '0 0 4px rgba(74,240,255,0.5)' : 'none',
          }} />
        ))}
      </div>

      {/* Glow ring when active */}
      <div style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        width: 200, height: 156, borderRadius: '100px 100px 44px 44px',
        border: isTypingPassword || isTypingEmail ? '1px solid rgba(74,240,255,0.3)' : '1px solid transparent',
        boxShadow: isTypingPassword || isTypingEmail ? '0 0 20px rgba(74,240,255,0.12)' : 'none',
        transition: 'all 0.4s ease-out', pointerEvents: 'none',
      }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   DemoAuthGate — full split-panel login, wired
   to Firebase auth from the parent demo page
   ───────────────────────────────────────────── */
interface DemoAuthGateProps {
  busy: boolean;
  error: string;
  emailMode: 'signin' | 'signup';
  name: string;
  email: string;
  password: string;
  onGoogleClick: () => void;
  onEmailSubmit: (e: React.FormEvent) => void;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onModeToggle: () => void;
}

export function DemoAuthGate({
  busy, error, emailMode,
  name, email, password,
  onGoogleClick, onEmailSubmit,
  onNameChange, onEmailChange, onPasswordChange,
  onModeToggle,
}: DemoAuthGateProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isTypingEmail, setIsTypingEmail] = useState(false);
  const [isTypingPassword, setIsTypingPassword] = useState(false);

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: '100%',
    height: 48,
    padding: '0 14px',
    backgroundColor: '#111111',
    border: `1px solid ${focused ? 'rgba(74,240,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 8,
    color: '#f0f0f0',
    fontFamily: '"DM Sans", sans-serif',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: focused ? '0 0 0 3px rgba(74,240,255,0.07)' : 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  });

  // Local focus states for each field
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const statusLabel = isTypingPassword
    ? 'ADAM IS WATCHING...'
    : isTypingEmail
    ? 'ADAM IS LISTENING'
    : 'ADAM · STANDBY';

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <style>{`
        ${FONTS}
        @keyframes pgSpin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.22); }
        @media (max-width: 1024px) {
          .auth-left-panel { display: none !important; }
          .auth-right-panel { grid-column: 1 / -1 !important; }
        }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div
        className="auth-left-panel"
        style={{
          position: 'relative',
          backgroundColor: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          overflow: 'hidden',
        }}
      >
        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(74,240,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(74,240,255,0.025) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
        {/* Radial glow */}
        <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, height: 500, borderRadius: '9999px', background: 'radial-gradient(circle, rgba(74,240,255,0.055) 0%, transparent 68%)', pointerEvents: 'none' }} />
        {/* Vertical right-edge scan line */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 1, background: 'linear-gradient(180deg, transparent 0%, rgba(74,240,255,0.22) 30%, rgba(74,240,255,0.4) 50%, rgba(74,240,255,0.22) 70%, transparent 100%)' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Image src="/images/logo.png" alt="DGEN Technologies" width={120} height={40} priority />
        </div>

        {/* ADAM mascot */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <AuthRobotFace
            isTypingEmail={isTypingEmail}
            isTypingPassword={isTypingPassword}
            passwordVisible={showPassword}
            hasPassword={password.length > 0}
          />

          {/* Status pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: '"Share Tech Mono", monospace', fontSize: 11, color: 'rgba(74,240,255,0.75)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            <span style={{
              width: 6, height: 6, borderRadius: '9999px',
              backgroundColor: isTypingEmail || isTypingPassword ? 'rgba(74,240,255,0.9)' : 'rgba(74,240,255,0.35)',
              boxShadow: isTypingEmail || isTypingPassword ? '0 0 6px rgba(74,240,255,0.7)' : 'none',
              transition: 'all 0.3s',
            }} />
            {statusLabel}
          </div>

          {/* Headline */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: '"Rajdhani", sans-serif', fontWeight: 600, fontSize: 26, letterSpacing: '0.06em', color: '#f0f0f0', margin: '0 0 8px' }}>
              Talk to <span style={{ color: '#4AF0FF' }}>ADAM</span>
            </h2>
            <p style={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 300, fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 300, lineHeight: 1.65, margin: 0 }}>
              {emailMode === 'signup'
                ? 'Create a free account to access your 5-minute voice session with the Autonomous Desktop AI Module.'
                : 'Welcome back. Sign in to continue your session with ADAM.'}
            </p>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
            {[
              { icon: '🎙', text: 'Real-time voice conversation' },
              { icon: '⚡', text: 'Powered by Gemini Live' },
              { icon: '🤖', text: 'Animated ADAM face responds' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span style={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 300, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 24, fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>
          <a href="/privacy-policy" style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">PRIVACY</a>
          <a href="/terms-of-service" style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">TERMS</a>
          <a href="/contact" style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">CONTACT</a>
        </div>
      </div>

      {/* ── RIGHT PANEL (form) ── */}
      <div
        className="auth-right-panel"
        style={{
          backgroundColor: '#0d0d0d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 32px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo */}
          <div style={{ display: 'none', justifyContent: 'center', marginBottom: 32 }} className="mobile-logo-only">
            <Image src="/images/logo.png" alt="DGEN Technologies" width={100} height={34} priority />
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
            {[0, 1, 2].map((n) => (
              <div key={n} style={{ height: 3, borderRadius: 2, backgroundColor: n === 0 ? '#4AF0FF' : 'rgba(255,255,255,0.08)', width: n === 0 ? 28 : 10, transition: 'all 0.3s' }} />
            ))}
          </div>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: 'rgba(74,240,255,0.65)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px' }}>
              DGEN Technologies · ADAM Demo
            </p>
            <h1 style={{ fontFamily: '"Rajdhani", sans-serif', fontWeight: 600, fontSize: 34, letterSpacing: '0.04em', color: '#f0f0f0', margin: '0 0 4px', lineHeight: 1.1 }}>
              {emailMode === 'signup' ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p style={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 300, fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              {emailMode === 'signup' ? 'Sign up for free — 5-minute ADAM session included.' : 'Sign in to access your ADAM session.'}
            </p>
          </div>

          {/* Google sign-in */}
          <button
            onClick={onGoogleClick}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', height: 48,
              backgroundColor: busy ? 'rgba(255,255,255,0.85)' : '#ffffff',
              color: '#1a1a1a',
              border: 'none', borderRadius: 8,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: '"DM Sans", sans-serif', fontWeight: 500, fontSize: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'box-shadow 0.2s, transform 0.1s',
            }}
            onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {busy
              ? <div style={{ width: 18, height: 18, border: '2px solid #bbb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pgSpin 0.7s linear infinite' }} />
              : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )
            }
            <span>{busy ? 'Signing in…' : 'Continue with Google'}</span>
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.08em' }}>OR</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={onEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {emailMode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Your Name</label>
                <input
                  type="text" placeholder="Full name" value={name} autoComplete="name"
                  onChange={(e) => onNameChange(e.target.value)}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  style={inputStyle(nameFocused)}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Email Address</label>
              <input
                type="email" placeholder="you@example.com" value={email}
                autoComplete="email" required
                onChange={(e) => onEmailChange(e.target.value)}
                onFocus={() => { setEmailFocused(true); setIsTypingEmail(true); }}
                onBlur={() => { setEmailFocused(false); setIsTypingEmail(false); }}
                style={inputStyle(emailFocused)}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Password</label>
                {emailMode === 'signin' && (
                  <button type="button" style={{ background: 'none', border: 'none', fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: 'rgba(74,240,255,0.6)', letterSpacing: '0.08em', cursor: 'pointer', padding: 0 }}>
                    FORGOT?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••" value={password}
                  autoComplete={emailMode === 'signin' ? 'current-password' : 'new-password'} required
                  onChange={(e) => onPasswordChange(e.target.value)}
                  onFocus={() => { setPassFocused(true); setIsTypingPassword(true); }}
                  onBlur={() => { setPassFocused(false); setIsTypingPassword(false); }}
                  style={{ ...inputStyle(passFocused), paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(220,80,80,0.07)', border: '1px solid rgba(220,80,80,0.25)', borderRadius: 8, fontFamily: '"Share Tech Mono", monospace', fontSize: 11, color: 'rgba(220,80,80,0.9)', letterSpacing: '0.05em' }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%', height: 48, marginTop: 4,
                backgroundColor: busy ? 'rgba(74,240,255,0.15)' : '#4AF0FF',
                color: busy ? 'rgba(74,240,255,0.6)' : '#0a0a0a',
                border: 'none', borderRadius: 8,
                fontFamily: '"Rajdhani", sans-serif', fontWeight: 600, fontSize: 15, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: busy ? 'none' : '0 0 22px rgba(74,240,255,0.28)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.boxShadow = '0 0 36px rgba(74,240,255,0.48)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 22px rgba(74,240,255,0.28)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {busy && <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.25)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pgSpin 0.7s linear infinite' }} />}
              {busy ? 'Please wait…' : emailMode === 'signin' ? 'ACCESS ADAM →' : 'CREATE ACCOUNT →'}
            </button>
          </form>

          {/* Mode toggle */}
          <p style={{ marginTop: 18, textAlign: 'center', fontFamily: '"DM Sans", sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {emailMode === 'signup' ? 'Already have an account? ' : 'New here? '}
            <button
              onClick={onModeToggle}
              style={{ background: 'none', border: 'none', color: '#4AF0FF', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif', fontSize: 13, padding: 0, fontWeight: 400 }}
            >
              {emailMode === 'signup' ? 'Sign in' : 'Create account'}
            </button>
          </p>

          {/* Privacy note */}
          <p style={{ marginTop: 12, textAlign: 'center', fontFamily: '"DM Sans", sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.18)', lineHeight: 1.6 }}>
            By continuing you agree to our{' '}
            <a href="https://dgentechnologies.com/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(74,240,255,0.4)', textDecoration: 'none' }}>Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
