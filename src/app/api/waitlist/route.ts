export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 300;

function normalizeField(value: unknown, maxLen = MAX_FIELD_LENGTH): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return Response.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const body = (await req.json()) as {
      email?: string;
      name?: string;
      company?: string;
      use_case?: string;
      referral?: string;
    };

    const normalizedEmail = normalizeField(body.email, 320).toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const collectionRef = adminDb.collection('waitlist');
    const existing = await collectionRef.where('email', '==', normalizedEmail).limit(1).get();
    if (!existing.empty) {
      return Response.json({ success: true, alreadyRegistered: true });
    }

    await collectionRef.add({
      email: normalizedEmail,
      name: normalizeField(body.name),
      company: normalizeField(body.company),
      useCase: normalizeField(body.use_case, 800),
      referral: normalizeField(body.referral),
      signedUpAt: FieldValue.serverTimestamp(),
      confirmed: false,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[waitlist] Unexpected error:', error);
    return Response.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}