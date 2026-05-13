export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { SignJWT } from 'jose';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const MAX_SESSIONS_LIFETIME = 1;
const MAX_ID_TOKEN_LENGTH = 8192;

function parseTesterUids(raw: string | undefined): Set<string> {
  return new Set(
    String(raw ?? '')
      .split(',')
      .map((uid) => uid.trim())
      .filter(Boolean),
  );
}

const TESTER_UIDS = parseTesterUids(process.env.TESTER_UIDS);

function getRelaySecret(): Uint8Array {
  const value = process.env.RELAY_JWT_SECRET;
  if (!value) {
    throw new Error('RELAY_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(value);
}

function normalizeDisplayName(name: unknown): string {
  if (typeof name !== 'string') {
    return 'User';
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return 'User';
  }

  return trimmed.slice(0, 120);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return Response.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const body = (await req.json()) as { idToken?: string };
    const idToken = body.idToken;

    if (!idToken || typeof idToken !== 'string' || idToken.length > MAX_ID_TOKEN_LENGTH) {
      return Response.json({ error: 'idToken is required' }, { status: 400 });
    }

    let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return Response.json({ error: 'Invalid or expired Firebase token' }, { status: 401 });
    }

    const uid = decoded.uid;
    const email = decoded.email ?? '';
    const safeName = normalizeDisplayName(decoded.name);
    const signInProvider = decoded.firebase?.sign_in_provider ?? 'unknown';

    const userRef = adminDb.collection('adamUsers').doc(uid);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      const data = userSnap.data() ?? {};

      await userRef.set(
        {
          uid,
          email: email || data.email || '',
          name: safeName || data.name || 'User',
          displayName: safeName || data.displayName || 'User',
          photoURL: decoded.picture ?? data.photoURL ?? '',
          emailVerified:
            typeof decoded.email_verified === 'boolean'
              ? decoded.email_verified
              : Boolean(data.emailVerified),
          primaryProvider: signInProvider,
          lastSeenAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const totalSessions = Number(data.totalDemoSessions ?? 0);
      if (!TESTER_UIDS.has(uid) && totalSessions >= MAX_SESSIONS_LIFETIME) {
        return Response.json(
          {
            error:
              'You have already used your ADAM demo session. Join the waitlist to get the full experience: dgentechnologies.com/products/adam#waitlist',
          },
          { status: 429 },
        );
      }
    } else {
      await userRef.set({
        uid,
        email,
        name: safeName,
        displayName: safeName,
        photoURL: decoded.picture ?? '',
        emailVerified: Boolean(decoded.email_verified),
        primaryProvider: signInProvider,
        createdAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
        demoSessionsToday: 0,
        totalDemoSessions: 0,
        lastSessionDate: null,
        waitlisted: false,
      });
    }

    const relaySecret = getRelaySecret();

    const relayToken = await new SignJWT({ uid, email, name: safeName })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('dgentechnologies.com/adam')
      .setAudience('adam-relay')
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(relaySecret);

    return Response.json({ token: relayToken });
  } catch (error) {
    console.error('[relay-token] Unexpected error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
