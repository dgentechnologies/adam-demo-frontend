import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth as firebaseGetAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore as firebaseGetFirestore, type Firestore } from 'firebase/firestore';

function getClientDatabaseId(): string {
  const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;
  if (!databaseId) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_DATABASE_ID');
  }
  return databaseId;
}

export function isFirebaseConfigured(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;

  return !!(
    apiKey &&
    apiKey.length > 0 &&
    apiKey !== 'your_firebase_api_key' &&
    databaseId &&
    databaseId.length > 0
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  return app;
}

export function getClientAuth(): Auth {
  if (!auth) {
    auth = firebaseGetAuth(getFirebaseApp());
  }

  return auth;
}

export function getClientDb(): Firestore {
  if (!db) {
    db = firebaseGetFirestore(getFirebaseApp(), getClientDatabaseId());
  }

  return db;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');