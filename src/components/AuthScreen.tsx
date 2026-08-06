import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Mail, Lock, User as UserIcon, AtSign, ArrowLeft, Loader2, CheckCircle2, AlertCircle, RefreshCw, KeyRound, Send, LogOut } from 'lucide-react';
import { t } from '../i18n';
import { authService } from '../services/authService';
import { auth } from '../services/firebase';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
  initialMode?: AuthMode;
  pendingUser?: User | null;
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'verify_notice';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  initialMode = 'login',
  pendingUser: initialPendingUser = null
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  // UI States
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(initialPendingUser);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (initialPendingUser) {
      setPendingUser(initialPendingUser);
    }
  }, [initialPendingUser]);

  // Clear errors/success on mode switch
  const switchMode = (newMode: AuthMode) => {
    setError(null);
    setSuccessMsg(null);
    setMode(newMode);
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('يُرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { user, firebaseUser } = await authService.signInWithEmail(email, password);
      
      // If email verification is required and email is not verified, show notice
      if (firebaseUser && !firebaseUser.emailVerified) {
        setPendingUser(user);
        setMode('verify_notice');
      } else {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('يُرجى إدخال الاسم الشخصي.');
      return;
    }
    if (!email.trim()) {
      setError('يُرجى إدخال البريد الإلكتروني.');
      return;
    }
    if (!password || password.length < 6) {
      setError('كلمة المرور يجب أن تتكون من 6 أحرف/أرقام على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { user } = await authService.signUpWithEmail(
        email,
        password,
        name,
        username
      );

      setPendingUser(user);
      setSuccessMsg('تم إنشاء الحساب بنجاح! تم إرسال رابط تأكيد البريد الإلكتروني.');
      setMode('verify_notice');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الحساب.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('يُرجى إدخال البريد الإلكتروني لإرسال رابط الاستعادة.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await authService.sendPasswordReset(email);
      setSuccessMsg('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
    } catch (err: any) {
      setError(err.message || 'فشل إرسال رابط استعادة كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  // Check email verification status
  const handleCheckVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const isVerified = await authService.checkEmailVerified();
      if (isVerified) {
        if (pendingUser) {
          onLoginSuccess(pendingUser);
        } else if (auth.currentUser) {
          const user = await authService.syncOrCreateUserProfile(auth.currentUser);
          onLoginSuccess(user);
        } else {
          switchMode('login');
        }
      } else {
        setError('لم يتم تأكيد البريد الإلكتروني بعد. يُرجى التوجه لبريدك الإلكتروني والضغط على رابط التفعيل.');
      }
    } catch (err: any) {
      setError('فشل التحقق من حالة البريد.');
    } finally {
      setLoading(false);
    }
  };

  // Resend verification email
  const handleResendVerification = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await authService.resendVerificationEmail();
      setSuccessMsg('تمت إعادة إرسال بريد التفعيل بنجاح.');
    } catch (err: any) {
      setError(err.message || 'فشل إعادة إرسال بريد التفعيل.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Top Glow bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"></div>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-emerald-800/80 border border-emerald-400/30 mx-auto flex items-center justify-center text-3xl font-bold text-emerald-200 shadow-xl">
            مـ
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t('appName')}</h1>
          <p className="text-xs text-emerald-400 font-medium">{t('appTagline')}</p>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE 1: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white text-left font-sans focus:outline-none focus:border-emerald-500 pr-10"
                />
                <Mail className="w-5 h-5 absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-400">كلمة المرور</label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white text-left font-sans focus:outline-none focus:border-emerald-500 pr-10"
                />
                <Lock className="w-5 h-5 absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowLeft className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-center pt-2 text-xs text-slate-400">
              ليس لديك حساب؟{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-emerald-400 font-bold hover:underline"
              >
                إنشاء حساب جديد
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: SIGNUP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5 animate-fade-in">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">الاسم الكامل</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 pr-10"
                />
                <UserIcon className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">اسم المستخدم (@username)</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ahmed_99"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 pr-10"
                />
                <AtSign className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white text-left font-sans focus:outline-none focus:border-emerald-500 pr-10"
                />
                <Mail className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">كلمة المرور</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white text-left font-sans focus:outline-none focus:border-emerald-500 pr-10"
                />
                <Lock className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">تأكيد كلمة المرور</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white text-left font-sans focus:outline-none focus:border-emerald-500 pr-10"
                />
                <KeyRound className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span>إنشاء الحساب</span>
              )}
            </button>

            <div className="text-center pt-1 text-xs text-slate-400">
              لديك حساب بالفعل؟{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-emerald-400 font-bold hover:underline"
              >
                تسجيل الدخول
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4 animate-fade-in">
            <p className="text-xs text-slate-300 text-center">أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.</p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white text-left font-sans focus:outline-none focus:border-emerald-500 pr-10"
                />
                <Mail className="w-5 h-5 absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>إرسال رابط الاستعادة</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full py-2 text-xs text-slate-400 hover:text-white transition text-center block"
            >
              العودة لتسجيل الدخول
            </button>
          </form>
        )}

        {/* MODE 4: EMAIL VERIFICATION NOTICE */}
        {mode === 'verify_notice' && (
          <div className="space-y-4 text-center animate-fade-in">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <Mail className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold text-white">تأكيد البريد الإلكتروني</h3>
              <p className="text-xs text-slate-300">
                تم إرسال رابط التفعيل إلى بريدك الإلكتروني:
              </p>
              <p className="text-xs font-mono text-emerald-400 font-bold">{email || pendingUser?.email}</p>
              <p className="text-[11px] text-slate-400">
                يُرجى الذهاب إلى صندوق الوارد في بريدك الإلكتروني والضغط على الرابط لإكمال تفعيل الحساب.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCheckVerification}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>تم التفعيل، متابعة للدخول</span>
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة إرسال البريد</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await authService.logout();
                  switchMode('login');
                }}
                className="text-slate-400 hover:text-white transition flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل خروج / حساب آخر</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
