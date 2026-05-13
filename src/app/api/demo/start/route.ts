export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const DEFAULT_DURATION_SECONDS = 300;
const MAX_ID_TOKEN_LENGTH = 8192;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const body = (await req.json().catch(() => ({}))) as {
      idToken?: string;
      startTime?: number;
      userId?: string;
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
    const userRef = adminDb.collection('adamUsers').doc(uid);
    const sessionRef = adminDb.collection('demoSessions').doc();

    await sessionRef.set({
      uid,
      userEmail: decoded.email ?? '',
      startedAt: FieldValue.serverTimestamp(),
      startedAtClient: typeof body.startTime === 'number' ? body.startTime : null,
      status: 'active',
      durationSeconds: DEFAULT_DURATION_SECONDS,
    });

    await userRef.set(
      {
        uid,
        lastSeenAt: FieldValue.serverTimestamp(),
        activeSessionId: sessionRef.id,
      },
      { merge: true },
    );

    return Response.json({ sessionId: sessionRef.id, durationSeconds: DEFAULT_DURATION_SECONDS });
  } catch (error) {
    console.error('[demo/start] Unexpected error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
