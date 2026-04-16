"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

/* ─────────────────────────────────────────────
   ADAM EyeBall — tracks mouse, blinks, and
   accepts a forced look direction when typing
   ───────────────────────────────────────────── */
interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

function EyeBall({
  size = 40,
  pupilSize = 14,
  maxDistance = 8,
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
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
        height: isBlinking ? "2px" : `${size}px`,
        borderRadius: "9999px",
        backgroundColor: "rgba(255,255,255,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        boxShadow: "0 0 8px rgba(74,240,255,0.4)",
        transition: "height 0.1s ease-out",
      }}
    >
      {!isBlinking && (
        <div
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            borderRadius: "9999px",
            backgroundColor: "#0a0a0a",
            transform: `translate(${p.x}px, ${p.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ADAM Robot Face — the animated mascot on the
   left panel. Follows mouse, reacts to typing
   ───────────────────────────────────────────── */
interface ADAMRobotFaceProps {
  isTypingEmail: boolean;
  isTypingPassword: boolean;
  passwordVisible: boolean;
  hasPassword: boolean;
}

function ADAMRobotFace({
  isTypingEmail,
  isTypingPassword,
  passwordVisible,
  hasPassword,
}: ADAMRobotFaceProps) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const [lookAtEachOther, setLookAtEachOther] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Random blink
  useEffect(() => {
    const schedule = () =>
      setTimeout(
        () => {
          setBlinking(true);
          setTimeout(() => {
            setBlinking(false);
            schedule();
          }, 150);
        },
        Math.random() * 4000 + 3000,
      );
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // Look inward when email focused
  useEffect(() => {
    if (isTypingEmail) {
      setLookAtEachOther(true);
      const t = setTimeout(() => setLookAtEachOther(false), 900);
      return () => clearTimeout(t);
    }
    setLookAtEachOther(false);
  }, [isTypingEmail]);

  // Head lean calculation
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

  // When password is visible — ADAM peeks down
  const isPeeking = hasPassword && passwordVisible;

  // Eye force direction
  const eyeForceLR = isPeeking ? 3 : lookAtEachOther ? 2 : undefined;
  const eyeForceUD = isPeeking ? 5 : lookAtEachOther ? 3 : undefined;

  return (
    <div
      ref={headRef}
      style={{
        position: "relative",
        width: "192px",
        height: "220px",
        transformOrigin: "bottom center",
        transform: `skewX(${lean}deg)`,
        transition: "transform 0.6s ease-out",
      }}
    >
      {/* Neck */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "34px",
          height: "24px",
          backgroundColor: "#1a1a1a",
          border: "1px solid rgba(74,240,255,0.15)",
          borderRadius: "2px 2px 6px 6px",
        }}
      />

      {/* Head shell */}
      <div
        style={{
          position: "absolute",
          bottom: "22px",
          left: "50%",
          transform: `translateX(-50%)`,
          width: "192px",
          height: "150px",
          backgroundColor: "#141414",
          borderRadius: "96px 96px 40px 40px",
          border: "1px solid rgba(74,240,255,0.18)",
          boxShadow:
            "0 0 30px rgba(74,240,255,0.08), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        {/* Scanline overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />

        {/* OLED face oval */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: `translate(calc(-50% + ${faceX}px), ${faceY}px)`,
            transition: "transform 0.15s ease-out",
            width: "152px",
            height: "110px",
            backgroundColor: "#050505",
            borderRadius: "76px 76px 50px 50px",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
          }}
        >
          {/* Eyes row */}
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <EyeBall
              size={40}
              pupilSize={14}
              maxDistance={8}
              isBlinking={blinking}
              forceLookX={eyeForceLR !== undefined ? -eyeForceLR : undefined}
              forceLookY={eyeForceUD}
            />
            <EyeBall
              size={40}
              pupilSize={14}
              maxDistance={8}
              isBlinking={blinking}
              forceLookX={eyeForceLR}
              forceLookY={eyeForceUD}
            />
          </div>

          {/* Mouth */}
          <div
            style={{
              width: isTypingPassword
                ? "48px"
                : isPeeking
                  ? "36px"
                  : "28px",
              height: isTypingPassword ? "8px" : "4px",
              backgroundColor: "rgba(255,255,255,0.85)",
              borderRadius: isTypingPassword ? "4px" : "2px",
              transition: "all 0.25s ease-out",
              boxShadow: isTypingPassword
                ? "0 0 8px rgba(74,240,255,0.5)"
                : "none",
            }}
          />
        </div>
      </div>

      {/* Camera dots (decorative) */}
      <div
        style={{
          position: "absolute",
          top: "4px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "6px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "9999px",
              backgroundColor: i === 1 ? "rgba(74,240,255,0.6)" : "rgba(255,255,255,0.15)",
              boxShadow: i === 1 ? "0 0 4px rgba(74,240,255,0.5)" : "none",
            }}
          />
        ))}
      </div>

      {/* Status glow ring */}
      <div
        style={{
          position: "absolute",
          bottom: "18px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "200px",
          height: "156px",
          borderRadius: "100px 100px 44px 44px",
          border: isTypingPassword || isTypingEmail
            ? "1px solid rgba(74,240,255,0.35)"
            : "1px solid transparent",
          boxShadow: isTypingPassword || isTypingEmail
            ? "0 0 20px rgba(74,240,255,0.15)"
            : "none",
          transition: "all 0.4s ease-out",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   ADAM Login Page — full branded page
   Split layout: dark left panel + form right
   ───────────────────────────────────────────── */
export function ADAMLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTypingEmail, setIsTypingEmail] = useState(false);
  const [isTypingPassword, setIsTypingPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    // Replace with real auth logic
    setError("Authentication service coming soon.");
    setIsLoading(false);
  };

  return (
    <div
      className="min-h-screen grid lg:grid-cols-2"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Left panel ── */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        {/* Grid texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(74,240,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(74,240,255,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            pointerEvents: "none",
          }}
        />
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "480px",
            height: "480px",
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, rgba(74,240,255,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="DGEN Technologies"
            width={120}
            height={40}
            priority
          />
        </div>

        {/* ADAM mascot area */}
        <div className="relative z-10 flex flex-col items-center gap-8">
          <ADAMRobotFace
            isTypingEmail={isTypingEmail}
            isTypingPassword={isTypingPassword}
            passwordVisible={showPassword}
            hasPassword={password.length > 0}
          />

          {/* Status label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "11px",
              color: "rgba(74,240,255,0.75)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "9999px",
                backgroundColor: isTypingEmail || isTypingPassword
                  ? "rgba(74,240,255,0.9)"
                  : "rgba(74,240,255,0.4)",
                boxShadow: isTypingEmail || isTypingPassword
                  ? "0 0 6px rgba(74,240,255,0.8)"
                  : "none",
                transition: "all 0.3s",
              }}
            />
            {isTypingPassword
              ? "ADAM IS WATCHING..."
              : isTypingEmail
                ? "ADAM IS LISTENING"
                : "ADAM · STANDBY"}
          </div>

          {/* Headline */}
          <div className="text-center">
            <h2
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600,
                fontSize: "28px",
                letterSpacing: "0.06em",
                color: "#f0f0f0",
                marginBottom: "8px",
              }}
            >
              Innovate. Integrate. Inspire.
            </h2>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 300,
                fontSize: "14px",
                color: "rgba(255,255,255,0.45)",
                maxWidth: "320px",
                lineHeight: 1.6,
              }}
            >
              Welcome back to the ADAM console — your interface to the
              Autonomous Desktop AI Module.
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div
          className="relative z-10 flex items-center gap-6"
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "11px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.08em",
          }}
        >
          <Link href="/privacy-policy" className="hover:text-white/60 transition-colors">
            PRIVACY
          </Link>
          <Link href="/terms-of-service" className="hover:text-white/60 transition-colors">
            TERMS
          </Link>
          <Link href="/contact" className="hover:text-white/60 transition-colors">
            CONTACT
          </Link>
        </div>

        {/* Vertical scan line decoration */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "1px",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(74,240,255,0.2) 30%, rgba(74,240,255,0.4) 50%, rgba(74,240,255,0.2) 70%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Right panel (form) ── */}
      <div
        className="flex items-center justify-center p-8"
        style={{ backgroundColor: "#0d0d0d" }}
      >
        <div className="w-full max-w-105">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Image src="/images/logo.png" alt="DGEN Technologies" width={100} height={34} priority />
          </div>

          {/* Header */}
          <div className="mb-8">
            <p
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "11px",
                color: "rgba(74,240,255,0.7)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              DGEN Technologies · ADAM Console
            </p>
            <h1
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600,
                fontSize: "36px",
                letterSpacing: "0.04em",
                color: "#f0f0f0",
                marginBottom: "6px",
                lineHeight: 1.1,
              }}
            >
              Sign In
            </h1>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 300,
                fontSize: "14px",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Already a member?{" "}
              <Link
                href="/adam/waitlist"
                style={{ color: "#4AF0FF", textDecoration: "none" }}
                className="hover:underline"
              >
                Join the waitlist
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.55)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="off"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTypingEmail(true)}
                onBlur={() => setIsTypingEmail(false)}
                required
                style={{
                  height: "48px",
                  backgroundColor: "#111111",
                  border: isTypingEmail
                    ? "1px solid rgba(74,240,255,0.45)"
                    : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#f0f0f0",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "14px",
                  transition: "border-color 0.2s",
                  boxShadow: isTypingEmail
                    ? "0 0 0 3px rgba(74,240,255,0.08)"
                    : "none",
                  outline: "none",
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.55)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Password
                </Label>
                <Link
                  href="#"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "10px",
                    color: "rgba(74,240,255,0.7)",
                    letterSpacing: "0.08em",
                    textDecoration: "none",
                  }}
                  className="hover:text-[#4AF0FF] transition-colors"
                >
                  FORGOT?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsTypingPassword(true)}
                  onBlur={() => setIsTypingPassword(false)}
                  required
                  style={{
                    height: "48px",
                    paddingRight: "44px",
                    backgroundColor: "#111111",
                    border: isTypingPassword
                      ? "1px solid rgba(74,240,255,0.45)"
                      : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#f0f0f0",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "14px",
                    transition: "border-color 0.2s",
                    boxShadow: isTypingPassword
                      ? "0 0 0 3px rgba(74,240,255,0.08)"
                      : "none",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(v) => setRemember(!!v)}
                style={{
                  backgroundColor: remember ? "#4AF0FF" : "transparent",
                  borderColor: remember ? "#4AF0FF" : "rgba(255,255,255,0.2)",
                }}
              />
              <Label
                htmlFor="remember"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300,
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                }}
              >
                Remember me for 30 days
              </Label>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: "12px 16px",
                  backgroundColor: "rgba(220,80,80,0.08)",
                  border: "1px solid rgba(220,80,80,0.3)",
                  borderRadius: "8px",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "11px",
                  color: "rgba(220,80,80,0.9)",
                  letterSpacing: "0.06em",
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                height: "48px",
                backgroundColor: isLoading ? "rgba(74,240,255,0.15)" : "#4AF0FF",
                color: isLoading ? "rgba(74,240,255,0.6)" : "#0a0a0a",
                border: "none",
                borderRadius: "8px",
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600,
                fontSize: "15px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                boxShadow: isLoading
                  ? "none"
                  : "0 0 20px rgba(74,240,255,0.25)",
              }}
              onMouseEnter={(e) => {
                if (!isLoading)
                  (e.target as HTMLButtonElement).style.boxShadow =
                    "0 0 32px rgba(74,240,255,0.45)";
              }}
              onMouseLeave={(e) => {
                if (!isLoading)
                  (e.target as HTMLButtonElement).style.boxShadow =
                    "0 0 20px rgba(74,240,255,0.25)";
              }}
            >
              {isLoading ? "AUTHENTICATING..." : "ACCESS ADAM"}
            </button>
          </form>

          {/* Divider */}
          <div
            className="flex items-center gap-4 my-6"
            style={{ color: "rgba(255,255,255,0.15)" }}
          >
            <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255,255,255,0.08)" }} />
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.2)",
              }}
            >
              OR
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            style={{
              width: "100%",
              height: "48px",
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              cursor: "pointer",
              transition: "all 0.2s",
              color: "rgba(255,255,255,0.7)",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 400,
              fontSize: "14px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(255,255,255,0.25)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "rgba(255,255,255,0.9)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "rgba(255,255,255,0.7)";
            }}
          >
            {/* Google G */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          {/* Sign up link */}
          <p
            className="text-center mt-8"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 300,
              fontSize: "13px",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            Don&apos;t have access yet?{" "}
            <Link
              href="/adam/waitlist"
              style={{
                color: "#4AF0FF",
                textDecoration: "none",
                fontWeight: 400,
              }}
              className="hover:underline"
            >
              Join the waitlist
            </Link>
          </p>

          {/* Bottom brand note */}
          <p
            className="text-center mt-4"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              color: "rgba(255,255,255,0.18)",
              letterSpacing: "0.08em",
            }}
          >
            © 2026 DGEN TECHNOLOGIES PVT. LTD. · KOLKATA, INDIA
          </p>
        </div>
      </div>
    </div>
  );
}

export default ADAMLoginPage;
