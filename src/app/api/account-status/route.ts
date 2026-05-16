export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const MAX_ID_TOKEN_LENGTH = 8192;

function parseTesterValues(raw: string | undefined): Set<string> {
  return new Set(
    String(raw ?? '')
      .split(/[\n,;]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

const TESTER_UIDS = parseTesterValues(process.env.TESTER_UIDS);
const TESTER_EMAILS = parseTesterValues(process.env.TESTER_EMAILS);

function isTesterByClaim(decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>): boolean {
  const claimTester = decoded.tester;
  const claimRole = decoded.role;
  return claimTester === true || claimRole === 'tester';
}

function isTesterByProfileFlag(userData: Record<string, unknown>): boolean {
  return userData.tester === true || userData.isTester === true;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      idToken?: string;
    };

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
    const email = String(decoded.email ?? '').trim().toLowerCase();

    const userSnap = await adminDb.collection('adamUsers').doc(uid).get();
    const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
    const tester =
      TESTER_UIDS.has(uid.toLowerCase()) ||
      (email ? TESTER_EMAILS.has(email) : false) ||
      isTesterByClaim(decoded) ||
      isTesterByProfileFlag(userData);
    const totalDemoSessions = typeof userData.totalDemoSessions === 'number' ? userData.totalDemoSessions : 0;
    const onboardingComplete = Boolean(userData.onboardingCompleted);

    let waitlistFilled = false;
    if (email) {
      const waitlistSnap = await adminDb.collection('waitlist').where('email', '==', email).limit(1).get();
      waitlistFilled = !waitlistSnap.empty;
    }

    return Response.json({
      emailVerified: Boolean(decoded.email_verified),
      onboardingComplete,
      demoUsed: !tester && totalDemoSessions > 0,
      waitlistFilled,
      tester,
    });
  } catch (error) {
    console.error('[account-status] Unexpected error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
