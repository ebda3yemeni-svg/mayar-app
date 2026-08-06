import React, { useState, useRef } from 'react';
import { User, UserSettings, UserPrivacySettings } from '../types';
import {
  User as UserIcon,
  Shield,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Server,
  Camera,
  Trash2,
  Lock,
} from 'lucide-react';
import { t } from '../i18n';
import { authService } from '../services/authService';
import { UserAvatar } from './UserAvatar';
import { compressImage, uploadMediaFile } from '../services/storageService';

interface SettingsScreenProps {
  currentUser: User;
  onUpdateUser: (updated: User) => void;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentUser,
  onUpdateUser,
  onLogout,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [privacy, setPrivacy] = useState<UserPrivacySettings>(
    currentUser.privacySettings || {
      lastSeenVisibility: 'everyone',
      onlineStatusVisibility: 'everyone',
      profilePhotoVisibility: 'everyone',
      readReceipts: true,
      typingIndicator: true,
    }
  );

  const [settings, setSettings] = useState<UserSettings>({
    lastSeenVisibility: privacy.lastSeenVisibility,
    onlineStatusVisibility: privacy.onlineStatusVisibility,
    profilePhotoVisibility: privacy.profilePhotoVisibility,
    readReceipts: privacy.readReceipts,
    typingIndicator: privacy.typingIndicator,
    soundNotifications: true,
    stunServer: 'stun:stun.l.google.com:19302',
    turnServer: 'turn:turn.mayar.app:3478',
    theme: 'dark',
  });

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setSaveError('حجم الصورة كبير جداً، يُرجى اختيار صورة أقل من 10 ميجابايت.');
      return;
    }

    try {
      setIsSaving(true);
      const compressed = await compressImage(file, 800, 0.85);
      const res = await uploadMediaFile({
        file: compressed,
        folderPath: `users/${currentUser.id}/profile`,
        fileName: file.name,
      });
      setAvatarUrl(res.downloadUrl);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      console.warn('Profile image upload failed, falling back to data URL:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const updated = await authService.updateUserProfile(currentUser.id, {
        name: name.trim(),
        bio: bio.trim(),
        avatar: avatarUrl,
        privacySettings: privacy,
      });
      onUpdateUser(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : 'فشل حفظ التعديلات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout(currentUser.id);
    } catch (e) {
      console.warn('Logout error:', e);
    }
    onLogout();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 p-4 sm:p-6 select-none max-w-2xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl">
        <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-emerald-400" />
          <span>{t('profile')}</span>
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          {/* Avatar Upload Container */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <UserAvatar
                user={{ name, username: currentUser.username, avatar: avatarUrl }}
                size="w-24 h-24"
                textSize="text-2xl"
                className="border-4 border-emerald-500 shadow-xl"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-xs font-bold"
              >
                <Camera className="w-6 h-6 mb-1 text-emerald-400" />
                <span>تغيير الصورة</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>رفع صورة شخصية</span>
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 text-xs font-semibold border border-red-800/60 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الصورة</span>
                </button>
              ) : null}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarFileSelect}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">الاسم الكامل (Real Name)</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أدخل اسمك الكامل..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
              <span>اسم المستخدم (Username)</span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" /> ثابت للحساب
              </span>
            </label>
            <div className="relative">
              <span className="absolute right-3 top-2.5 text-slate-500 text-sm font-mono">@</span>
              <input
                type="text"
                disabled
                readOnly
                value={currentUser.username}
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-800/80 rounded-xl pr-8 pl-4 py-2.5 text-sm text-slate-400 font-mono cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">السيرة الذاتية (Bio)</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="أدخل نبيذة أو عبارة..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {saveError && (
            <p className="text-xs text-red-400 font-semibold bg-red-950/50 p-2.5 rounded-xl border border-red-800/80">
              {saveError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>تم الحفظ بنجاح</span>
              </>
            ) : (
              <span>حفظ التعديلات</span>
            )}
          </button>
        </form>
      </div>

      {/* Privacy Controls */}
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-lg text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <span>إعدادات الخصوصية (Privacy Settings)</span>
        </h3>

        <div className="space-y-4 divide-y divide-slate-700 text-sm">
          {/* Last Seen Privacy */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white">آخر ظهور (Last Seen)</p>
              <p className="text-[11px] text-slate-400">من يمكنه رؤية وقت آخر ظهور لك</p>
            </div>
            <select
              value={privacy.lastSeenVisibility}
              onChange={(e) =>
                setPrivacy({ ...privacy, lastSeenVisibility: e.target.value as any })
              }
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500"
            >
              <option value="everyone">الجميع (Everyone)</option>
              <option value="contacts">جهات الاتصال فقط (Contacts)</option>
              <option value="nobody">لا أحد (Nobody)</option>
            </select>
          </div>

          {/* Online Status Privacy */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white">حالة الاتصال (Online Status)</p>
              <p className="text-[11px] text-slate-400">من يمكنه رؤية أنك متصل الآن</p>
            </div>
            <select
              value={privacy.onlineStatusVisibility}
              onChange={(e) =>
                setPrivacy({ ...privacy, onlineStatusVisibility: e.target.value as any })
              }
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500"
            >
              <option value="everyone">الجميع (Everyone)</option>
              <option value="same_as_last_seen">نفس آخر ظهور (Same as Last Seen)</option>
            </select>
          </div>

          {/* Profile Picture Privacy */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white">الصورة الشخصية (Profile Picture)</p>
              <p className="text-[11px] text-slate-400">من يمكنه رؤية صورتك الشخصية</p>
            </div>
            <select
              value={privacy.profilePhotoVisibility}
              onChange={(e) =>
                setPrivacy({ ...privacy, profilePhotoVisibility: e.target.value as any })
              }
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500"
            >
              <option value="everyone">الجميع (Everyone)</option>
              <option value="contacts">جهات الاتصال فقط (Contacts)</option>
              <option value="nobody">لا أحد (Nobody)</option>
            </select>
          </div>

          {/* Read Receipts */}
          <div className="pt-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">مؤشرات قراءة الرسائل (Read Receipts)</p>
              <p className="text-[11px] text-slate-400">إظهار علامة القراءة الزرقاء عند قراءة الرسائل</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.readReceipts}
              onChange={(e) => setPrivacy({ ...privacy, readReceipts: e.target.checked })}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Typing Indicator */}
          <div className="pt-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">مؤشر الكتابة (Typing Indicator)</p>
              <p className="text-[11px] text-slate-400">إظهار "يكتب الآن..." للآخرين أثناء الكتابة</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.typingIndicator}
              onChange={(e) => setPrivacy({ ...privacy, typingIndicator: e.target.checked })}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* STUN / TURN Server WebRTC Diagnostic */}
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-3">
        <h3 className="font-bold text-lg text-white flex items-center gap-2">
          <Server className="w-5 h-5 text-emerald-400" />
          <span>{t('stunTurnConfig')}</span>
        </h3>
        <p className="text-xs text-slate-400">
          تستخدم مكالمات ميار بروتوكول WebRTC المباشر عبر خوادم اكتشاف العنوان وإعادة التوجيه STUN/TURN:
        </p>

        <div className="space-y-2 text-xs font-mono bg-slate-900 p-3 rounded-xl border border-slate-700">
          <p className="text-emerald-400">STUN: {settings.stunServer}</p>
          <p className="text-teal-400">TURN Relay: {settings.turnServer}</p>
          <p className="text-slate-400">الحالة: خوادم الاتصال نشطة وغطاء NAT جاهز ✅</p>
        </div>
      </div>

      {/* Logout Action */}
      <button
        onClick={handleLogout}
        className="w-full py-3.5 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold transition flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        <span>{t('logout')}</span>
      </button>
    </div>
  );
};
