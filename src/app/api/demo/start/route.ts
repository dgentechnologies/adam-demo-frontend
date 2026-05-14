export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const DEFAULT_DURATION_SECONDS = 300;
const MAX_ID_TOKEN_LENGTH = 8192;

function normalizeText(value: unknown, max = 120): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.slice(0, max);
}

function normalizeNumber(value: unknown, min: number, max: number, decimals = 4): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function sanitizeClientLocation(raw: unknown) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const input = raw as Record<string, unknown>;
  const permission = normalizeText(input.permission, 24) || 'unknown';
  const timezone = normalizeText(input.timezone, 80);
  const locale = normalizeText(input.locale, 32);
  const latitude = normalizeNumber(input.latitude, -90, 90);
  const longitude = normalizeNumber(input.longitude, -180, 180);
  const accuracyMeters = normalizeNumber(input.accuracyMeters, 0, 100000, 0);
  const capturedAtClient = typeof input.capturedAt === 'number' && Number.isFinite(input.capturedAt)
    ? Math.round(input.capturedAt)
    : null;

  const location = {
    permission,
    ...(timezone ? { timezone } : {}),
    ...(locale ? { locale } : {}),
    ...(latitude !== null ? { latitude } : {}),
    ...(longitude !== null ? { longitude } : {}),
    ...(accuracyMeters !== null ? { accuracyMeters } : {}),
    ...(capturedAtClient !== null ? { capturedAtClient } : {}),
  };

  return Object.keys(location).length > 0 ? location : null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const body = (await req.json().catch(() => ({}))) as {
      idToken?: string;
      startTime?: number;
      userId?: string;
      location?: unknown;
    };

    const idToken = body.idToken ?? tokenFromHeader;
    if (!idToken || typeof idToken !== 'string' || idToken.length > MAX_ID_TOKEN_LENGTH) {
      return Response.json({ error: 'idToken is required' }, { status: 401 });
    }

    let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return Response.json({ error: 'Invalid or expired Firebase token' }, { status: 401 });
    }

    const uid = decoded.uid;
    const clientLocation = sanitizeClientLocation(body.location);
    const userRef = adminDb.collection('adamUsers').doc(uid);
    const sessionRef = adminDb.collection('demoSessions').doc();

    await sessionRef.set({
      uid,
      userEmail: decoded.email ?? '',
      startedAt: FieldValue.serverTimestamp(),
      startedAtClient: typeof body.startTime === 'number' ? body.startTime : null,
      status: 'active',
      durationSeconds: DEFAULT_DURATION_SECONDS,
      ...(clientLocation ? { clientLocation } : {}),
    });

    await userRef.set(
      {
        uid,
        lastSeenAt: FieldValue.serverTimestamp(),
        activeSessionId: sessionRef.id,
        ...(clientLocation
          ? {
              lastKnownLocation: clientLocation,
              lastKnownLocationCapturedAt: FieldValue.serverTimestamp(),
            }
          : {}),
      },
      { merge: true },
    );

    return Response.json({ sessionId: sessionRef.id, durationSeconds: DEFAULT_DURATION_SECONDS });
  } catch (error) {
    console.error('[demo/start] Unexpected error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
