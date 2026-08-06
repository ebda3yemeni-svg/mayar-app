import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, getDocFromCache, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { User } from '../types';

export interface AuthResult {
  user: User;
  firebaseUser: FirebaseUser;
}

/**
 * Utility to enforce a strict timeout on async promises so Firestore calls
 * never hang indefinitely during auth flows.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue?: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (fallbackValue !== undefined) {
        resolve(fallbackValue);
      } else {
        reject(new Error(`FIRESTORE_TIMEOUT_${ms}MS`));
      }
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'support', 'system', 'mayar', 'official', 'help',
  'api', 'null', 'undefined', 'root', 'bot', 'security', 'info', 'service'
]);

class AuthService {
  /**
   * Normalizes raw username input (strips leading @ and whitespace)
   */
  public normalizeUsername(input: string): string {
    return input.trim().replace(/^@/, '');
  }

  /**
   * Validates username rules (3-20 chars, alphanumeric + underscores, not reserved)
   */
  public validateUsername(rawUsername: string): { valid: boolean; cleanUsername: string; cleanLower: string; error?: string } {
    const cleanUsername = this.normalizeUsername(rawUsername);
    const cleanLower = cleanUsername.toLowerCase();

    if (!cleanUsername) {
      return { valid: false, cleanUsername, cleanLower, error: 'يُرجى إدخال اسم المستخدم.' };
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return { valid: false, cleanUsername, cleanLower, error: 'اسم المستخدم يجب أن يتكون من 3 إلى 20 حرفًا أو رقمًا.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return { valid: false, cleanUsername, cleanLower, error: 'اسم المستخدم يمكن أن يحتوي فقط على أحرف إنجليزية وأرقام وشرطة سفلي (_).' };
    }
    if (RESERVED_USERNAMES.has(cleanLower)) {
      return { valid: false, cleanUsername, cleanLower, error: 'هذا الاسم محجوز للنظام، يُرجى اختيار اسم آخر.' };
    }
    return { valid: true, cleanUsername, cleanLower };
  }

  /**
   * Checks if username is available in /usernames/{cleanLower}
   */
  public async checkUsernameAvailable(rawUsername: string, currentUid?: string): Promise<boolean> {
    const { valid, cleanLower, error } = this.validateUsername(rawUsername);
    if (!valid) {
      throw new Error(error);
    }

    const usernameRef = doc(db, 'usernames', cleanLower);
    let snap = null;
    try {
      snap = await withTimeout(getDoc(usernameRef), 3000);
    } catch (e) {
      try {
        snap = await getDocFromCache(usernameRef);
      } catch (ce) {
        snap = null;
      }
    }

    if (snap && snap.exists()) {
      const data = snap.data();
      if (currentUid && data.uid === currentUid) {
        return true; // Belongs to current user
      }
      return false; // Taken by another user
    }
    return true; // Available
  }

  /**
   * Atomically/safely reserves username in /usernames/{cleanLower}
   */
  public async reserveUsername(rawUsername: string, uid: string): Promise<string> {
    const { valid, cleanUsername, cleanLower, error } = this.validateUsername(rawUsername);
    if (!valid) throw new Error(error);

    const usernameRef = doc(db, 'usernames', cleanLower);
    await setDoc(usernameRef, {
      uid,
      username: cleanUsername,
      createdAt: new Date().toISOString()
    }, { merge: true });

    return cleanUsername;
  }

  /**
   * Register a new user with Email and Password
   */
  public async signUpWithEmail(
    email: string,
    pass: string,
    name: string,
    username?: string
  ): Promise<AuthResult> {
    const cleanEmail = email.trim();
    const cleanEmailLower = cleanEmail.toLowerCase();
    const cleanName = name.trim();
    const rawUsername = username?.trim() || cleanEmail.split('@')[0] || `user_${Date.now().toString(36)}`;

    // 1. Check username availability before creating account
    const isAvailable = await this.checkUsernameAvailable(rawUsername);
    if (!isAvailable) {
      throw new Error('اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر.');
    }

    const { cleanUsername } = this.validateUsername(rawUsername);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmailLower, pass);
      const firebaseUser = userCredential.user;

      // Send verification email
      try {
        await sendEmailVerification(firebaseUser);
      } catch (e) {
        console.warn('[AuthService] Failed to send initial verification email:', e);
      }

      // Reserve username and create user profile in Firestore
      await this.reserveUsername(cleanUsername, firebaseUser.uid).catch((e) => {
        console.warn('[AuthService] Username reservation non-fatal warning:', e);
      });

      const userProfile = await this.syncOrCreateUserProfile(firebaseUser, {
        name: cleanName,
        username: cleanUsername,
      });

      return { user: userProfile, firebaseUser };
    } catch (error: any) {
      console.error('[AuthService] Sign up error:', error);
      throw this.translateAuthError(error);
    }
  }

  /**
   * Sign in an existing user with Email and Password
   */
  public async signInWithEmail(email: string, pass: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const firebaseUser = userCredential.user;

      // Sync or retrieve user profile from Firestore
      const userProfile = await this.syncOrCreateUserProfile(firebaseUser);

      return { user: userProfile, firebaseUser };
    } catch (error: any) {
      console.error('[AuthService] Sign in error:', error);
      throw this.translateAuthError(error);
    }
  }

  /**
   * Send Password Reset Email
   */
  public async sendPasswordReset(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('يُرجى إدخال البريد الإلكتروني أولاً.');
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (error: any) {
      console.error('[AuthService] Password reset error:', error);
      throw this.translateAuthError(error);
    }
  }

  /**
   * Resend Email Verification link to currently signed-in user
   */
  public async resendVerificationEmail(): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('لم يتم العثور على حساب نشط لإرسال البريد.');
    }

    try {
      await sendEmailVerification(currentUser);
    } catch (error: any) {
      console.error('[AuthService] Resend verification email error:', error);
      throw this.translateAuthError(error);
    }
  }

  /**
   * Reload current Firebase user and return if email is verified
   */
  public async checkEmailVerified(): Promise<boolean> {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    try {
      await currentUser.reload();
      return auth.currentUser?.emailVerified || false;
    } catch (e) {
      console.warn('[AuthService] Error reloading user:', e);
      return currentUser.emailVerified;
    }
  }

  /**
   * Syncs existing user doc or creates a new user profile in Firestore.
   * Performs Safe Orphaned Account Repair if profile was missing.
   */
  public async syncOrCreateUserProfile(
    firebaseUser: FirebaseUser,
    initialDetails?: { name?: string; username?: string }
  ): Promise<User> {
    const userRef = doc(db, 'users', firebaseUser.uid);

    // Default user profile constructed from available details
    const cleanAuthEmail = firebaseUser.email ? firebaseUser.email.trim().toLowerCase() : '';
    const rawUsername = initialDetails?.username || (cleanAuthEmail ? cleanAuthEmail.split('@')[0] : `user_${firebaseUser.uid.slice(0, 8)}`);
    const { cleanUsername, cleanLower } = this.validateUsername(rawUsername);

    const fallbackUser: User = {
      id: firebaseUser.uid,
      email: cleanAuthEmail,
      emailLowercase: cleanAuthEmail,
      name: initialDetails?.name || firebaseUser.displayName || `مستخدم ${firebaseUser.uid.slice(0, 4)}`,
      username: cleanUsername,
      usernameLowercase: cleanLower,
      avatar: firebaseUser.photoURL || '',
      bio: 'مرحباً، أنا أستخدم ميار!',
      status: 'online',
      onlineStatus: 'online',
      lastSeen: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      privacySettings: {
        lastSeenVisibility: 'everyone',
        onlineStatusVisibility: 'everyone',
        profilePhotoVisibility: 'everyone',
        readReceipts: true,
        typingIndicator: true,
      },
      createdAt: new Date().toISOString()
    };

    let docSnap = null;

    // Try server read with 3s timeout
    try {
      docSnap = await withTimeout(getDoc(userRef), 3000);
    } catch (readErr: any) {
      console.warn('[AuthService] getDoc server read timed out or failed, checking cache:', readErr);
      try {
        docSnap = await getDocFromCache(userRef);
      } catch (cacheErr) {
        docSnap = null;
      }
    }

    if (docSnap && docSnap.exists()) {
      const data = docSnap.data() as User;
      const userUsername = data.username || cleanUsername;
      const userUsernameLower = (data.usernameLowercase || userUsername).toLowerCase();

      const updatedFields: Partial<User> = {
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
        email: cleanAuthEmail || data.email?.trim().toLowerCase() || '',
        emailLowercase: cleanAuthEmail || (data.email?.trim().toLowerCase() || ''),
        usernameLowercase: userUsernameLower,
      };

      try {
        await updateDoc(userRef, updatedFields);
      } catch (upErr) {
        console.warn('[AuthService] updateDoc non-fatal warning:', upErr);
      }

      // Reserve username document if missing
      this.reserveUsername(userUsername, firebaseUser.uid).catch(() => {});

      return { id: firebaseUser.uid, ...data, ...updatedFields };
    } else {
      // Document does not exist (Orphaned Account Repair). Create user profile & reserve username.
      const newUser: User = {
        ...fallbackUser,
        name: initialDetails?.name || fallbackUser.name,
        username: cleanUsername,
        usernameLowercase: cleanLower,
      };

      try {
        await setDoc(userRef, newUser);
      } catch (setErr) {
        console.error('[AuthService] Primary setDoc failed, attempting merge setDoc:', setErr);
        await setDoc(userRef, newUser, { merge: true }).catch((e) => {
          console.error('[AuthService] Merge setDoc also failed:', e);
        });
      }

      // Reserve username
      this.reserveUsername(cleanUsername, firebaseUser.uid).catch(() => {});

      return newUser;
    }
  }

  /**
   * Updates user profile in Firestore
   */
  public async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const userRef = doc(db, 'users', userId);
    const path = `users/${userId}`;

    try {
      await updateDoc(userRef, updates);
      let updatedSnap = null;
      try {
        updatedSnap = await withTimeout(getDoc(userRef), 3000);
      } catch (e) {
        updatedSnap = await getDocFromCache(userRef);
      }
      return (updatedSnap?.data() as User) || { id: userId, ...updates } as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  }

  /**
   * Listen to Firebase auth state changes
   */
  public subscribeAuthState(
    callback: (user: User | null, firebaseUser: FirebaseUser | null) => void
  ): () => void {
    return firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userProfile = await this.syncOrCreateUserProfile(firebaseUser);
          callback(userProfile, firebaseUser);
        } catch (e) {
          console.error('[AuthService] Error syncing profile on auth change:', e);
          const fallbackUser: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || `مستخدم ${firebaseUser.uid.slice(0, 4)}`,
            username: firebaseUser.email ? firebaseUser.email.split('@')[0] : `user_${firebaseUser.uid.slice(0, 8)}`,
            avatar: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            bio: 'مرحباً، أنا أستخدم ميار!',
            status: 'online',
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          callback(fallbackUser, firebaseUser);
        }
      } else {
        callback(null, null);
      }
    });
  }

  /**
   * Logout user from Firebase
   */
  public async logout(userId?: string): Promise<void> {
    if (userId) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          status: 'offline',
          lastSeen: new Date().toISOString()
        }).catch(() => {});
      } catch (e) {
        console.warn('Failed to update offline status on logout:', e);
      }
    }
    await signOut(auth);
  }

  /**
   * Translates Firebase Auth error codes into helpful user messages in Arabic
   */
  private translateAuthError(error: any): Error {
    const code = error?.code || '';
    let message = error?.message || 'حدث خطأ غير متوقع أثناء عملية الدخول.';

    // Parse JSON if handleFirestoreError wrapped it
    if (message.startsWith('{') && message.endsWith('}')) {
      try {
        const parsed = JSON.parse(message);
        message = parsed.error || message;
      } catch (e) {
        // keep as is
      }
    }

    if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
      return new Error('تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في لوحة Firebase Console. يُرجى الانتقال إلى Authentication -> Sign-in method وتفعيل Email/Password.');
    }
    if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
      return new Error('هذا البريد الإلكتروني مستخدم بالفعل لحساب آخر.');
    }
    if (code === 'auth/invalid-email' || message.includes('invalid-email')) {
      return new Error('عنوان البريد الإلكتروني غير صحيح. يُرجى كتابته بشكل صحيح (مثال: user@example.com)');
    }
    if (code === 'auth/weak-password' || message.includes('weak-password')) {
      return new Error('كلمة المرور ضعيفة جداً. يُرجى إدخال 6 أحرف أو أرقام على الأقل.');
    }
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || message.includes('invalid-credential')) {
      return new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة. يُرجى التأكد وإعادة المحاولة.');
    }
    if (code === 'auth/too-many-requests' || message.includes('too-many-requests')) {
      return new Error('تم حظر المحاولات مؤقتاً بسبب تكرار الأخطاء. يُرجى الانتظار بضع دقائق والمحاولة مجدداً.');
    }
    if (code === 'auth/network-request-failed' || message.includes('network-request-failed')) {
      return new Error('تعذر الاتصال بالشبكة. يُرجى التأكد من الاتصال بالإنترنت.');
    }

    return new Error(message);
  }
}

export const authService = new AuthService();
