export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const MAX_ID_TOKEN_LENGTH = 8192;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const body = (await req.json().catch(() => ({}))) as {
      idToken?: string;
      endTime?: number;
      sessionId?: string;
      userId?: string;
      reason?: string;
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
    const userSnap = await userRef.get();
    const activeSessionId = (userSnap.data()?.activeSessionId as string | undefined) ?? body.sessionId;

    if (activeSessionId) {
      await adminDb.collection('demoSessions').doc(activeSessionId).set(
        {
          endedAt: FieldValue.serverTimestamp(),
          endedAtClient: typeof body.endTime === 'number' ? body.endTime : null,
          status: 'ended',
          endReason: typeof body.reason === 'string' ? body.reason : 'completed',
        },
        { merge: true },
      );
    }

    await userRef.set(
      {
        uid,
        lastSeenAt: FieldValue.serverTimestamp(),
        activeSessionId: FieldValue.delete(),
        totalDemoSessions: FieldValue.increment(1),
      },
      { merge: true },
    );

    return Response.json({ status: 'ended', sessionId: activeSessionId ?? null });
  } catch (error) {
    console.error('[demo/end] Unexpected error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
