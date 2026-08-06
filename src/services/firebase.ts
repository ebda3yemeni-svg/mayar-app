import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseAppletConfig from '../../firebase-applet-config.json';

export const FIRESTORE_DATABASE_ID = (firebaseAppletConfig as any).firestoreDatabaseId || "ai-studio-84811195-5d48-4c0b-9b87-e229c7facdbd";

export const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey || "AIzaSyArugWYCCF-elqrQgPWFSiTYjR8f8f3WOc",
  authDomain: firebaseAppletConfig.authDomain || "mayar-eaa7a.firebaseapp.com",
  projectId: firebaseAppletConfig.projectId || "mayar-eaa7a",
  storageBucket: firebaseAppletConfig.storageBucket || "mayar-eaa7a.firebasestorage.app",
  messagingSenderId: firebaseAppletConfig.messagingSenderId || "796036041840",
  appId: firebaseAppletConfig.appId || "1:796036041840:web:07d0df429942a95007b8b5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Firestore targeting the explicit database ID (ai-studio-84811195-5d48-4c0b-9b87-e229c7facdbd)
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
}, FIRESTORE_DATABASE_ID);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const rawMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: rawMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));

  if (rawMsg.includes('offline') || rawMsg.includes('Failed to get document') || rawMsg.includes('closing') || rawMsg.includes('hidden')) {
    throw new Error('تعذر الاتصال بقاعدة البيانات. يُرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.');
  } else if (rawMsg.includes('permission') || rawMsg.includes('Missing or insufficient permissions')) {
    throw new Error('عفواً، ليس لديك صلاحية للوصول إلى هذه البيانات.');
  }

  throw new Error(rawMsg);
}
