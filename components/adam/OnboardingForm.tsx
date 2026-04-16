'use client';

import { useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const WHERE_OPTIONS = [
  'Select an option…',
  'Social media (Instagram / Twitter)',
  'Friend or colleague',
  'News article or blog',
  'Google / Search engine',
  'DGEN Technologies website',
  'LinkedIn',
  'YouTube',
  'Other',
];

const JOB_OPTIONS = [
  'Select an option…',
  'Student',
  'Software Engineer / Developer',
  'Product Manager / Designer',
  'Researcher / Academic',
  'Entrepreneur / Founder',
  'Business / Management',
  'Educator / Teacher',
  'Healthcare Professional',
  'Content Creator',
  'Other',
];

interface OnboardingFormProps {
  user:       User;
  onComplete: () => void;
}

const INPUT_STYLE: React.CSSProperties = {
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
  appearance: 'none',
  WebkitAppearance: 'none',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontFamily: '"Share Tech Mono", monospace',
  fontSize: 11,
  color: '#9a9a9a',
  letterSpacing: '0.06em',
  marginBottom: 6,
};

export function OnboardingForm({ user, onComplete }: OnboardingFormProps) {
  const [whereHeard, setWhereHeard] = useState('');
  const [jobTitle,   setJobTitle]   = useState('');
  const [dob,        setDob]        = useState('');
  const [useCase,    setUseCase]    = useState('');
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState('');

  // Max date = today (no future DOB)
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whereHeard || whereHeard === WHERE_OPTIONS[0]) { setError('Let us know where you heard about ADAM.'); return; }
    if (!jobTitle   || jobTitle   === JOB_OPTIONS[0])   { setError('Please select your job title.'); return; }
    if (!dob) { setError('Date of birth is required.'); return; }

    setBusy(true);
    setError('');
    try {
      await setDoc(doc(db, 'onboarding', user.uid), {
        uid:          user.uid,
        email:        user.email,
        display_name: user.displayName ?? '',
        where_heard:  whereHeard,
        job_title:    jobTitle,
        dob,
        use_case:     useCase.trim(),
        completed:    true,
        completed_at: new Date().toISOString(),
      });
      onComplete();
    } catch (err) {
      console.error('[onboarding] Firestore write failed:', err);
      // Firestore might not be configured — skip onboarding gracefully
      onComplete();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      {/* Progress — step 2 of 3 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              width: n === 2 ? 32 : 10,
              height: 4,
              borderRadius: 2,
              background: n === 1 ? '#4AF0FF'
                        : n === 2 ? '#4AF0FF'
                        : 'rgba(255,255,255,0.1)',
              transition: 'width 0.3s ease',
            }}
          />
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: '"Rajdhani", sans-serif',
              fontWeight: 600,
              fontSize: 28,
              letterSpacing: '0.06em',
              color: '#f0f0f0',
              margin: 0,
            }}
          >
            Quick <span style={{ color: '#4AF0FF' }}>Intro</span>
          </h1>
          <p
            style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: 13,
              color: '#9a9a9a',
              marginTop: 6,
            }}
          >
            Help us understand who&apos;s using ADAM.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Where heard */}
          <div>
            <label style={LABEL_STYLE}>WHERE DID YOU HEAR ABOUT ADAM? *</label>
            <div style={{ position: 'relative' }}>
              <select
                value={whereHeard}
                onChange={(e) => setWhereHeard(e.target.value)}
                style={{ ...INPUT_STYLE, cursor: 'pointer', paddingRight: 36 }}
              >
                {WHERE_OPTIONS.map((o) => (
                  <option key={o} value={o === WHERE_OPTIONS[0] ? '' : o} disabled={o === WHERE_OPTIONS[0]}>
                    {o}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9a9a9a', pointerEvents: 'none', fontSize: 12 }}>▼</span>
            </div>
          </div>

          {/* Job title */}
          <div>
            <label style={LABEL_STYLE}>YOUR ROLE / JOB TITLE *</label>
            <div style={{ position: 'relative' }}>
              <select
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                style={{ ...INPUT_STYLE, cursor: 'pointer', paddingRight: 36 }}
              >
                {JOB_OPTIONS.map((o) => (
                  <option key={o} value={o === JOB_OPTIONS[0] ? '' : o} disabled={o === JOB_OPTIONS[0]}>
                    {o}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9a9a9a', pointerEvents: 'none', fontSize: 12 }}>▼</span>
            </div>
          </div>

          {/* Date of birth */}
          <div>
            <label style={LABEL_STYLE}>DATE OF BIRTH *</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={today}
              style={{
                ...INPUT_STYLE,
                colorScheme: 'dark',
              }}
            />
          </div>

          {/* Use case — optional */}
          <div>
            <label style={{ ...LABEL_STYLE }}>
              WHAT WOULD YOU USE ADAM FOR?
              <span style={{ color: 'rgba(255,255,255,0.22)', marginLeft: 6 }}>(optional)</span>
            </label>
            <textarea
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              placeholder="e.g. home assistant, productivity, learning…"
              rows={3}
              style={{
                ...INPUT_STYLE,
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <p
              style={{
                padding: '9px 12px',
                background: 'rgba(220,80,80,0.12)',
                border: '1px solid rgba(220,80,80,0.3)',
                borderRadius: 8,
                color: '#ff8080',
                fontFamily: '"Share Tech Mono", monospace',
                fontSize: 12,
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              padding: '13px 0',
              background: busy ? 'rgba(74,240,255,0.4)' : '#4AF0FF',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: 10,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: '"Rajdhani", sans-serif',
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: '0.07em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.2s',
            }}
          >
            {busy && (
              <div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'obSpin 0.8s linear infinite' }} />
            )}
            {busy ? 'Saving…' : 'Continue to ADAM →'}
          </button>
        </form>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600&family=Share+Tech+Mono&family=DM+Sans:wght@300;400&display=swap');
        @keyframes obSpin { to { transform: rotate(360deg); } }
        input:focus, select:focus, textarea:focus {
          border-color: rgba(74,240,255,0.4) !important;
          box-shadow: 0 0 0 2px rgba(74,240,255,0.1);
        }
        option { background: #1a1a1a; color: #f0f0f0; }
        textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
