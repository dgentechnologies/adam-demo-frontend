import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function getAdminDatabaseId(): string {
  const databaseId = process.env.FIREBASE_WEBSITE_DATABASE_ID;
  if (!databaseId) {
    throw new Error('Missing FIREBASE_WEBSITE_DATABASE_ID');
  }
  return databaseId;
}

function getAdminApp(): App {
  if (getApps().length) {
    return getApps()[0];
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop: string) {
    const db = getFirestore(getAdminApp(), getAdminDatabaseId());
    const value = (db as unknown as Record<string, unknown>)[prop];

    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(db)
      : value;
  },
});