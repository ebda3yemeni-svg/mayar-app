import React from 'react';
import { User } from '../types';
import { Phone, Video, Search, ShieldCheck, Moon, Sun, User as UserIcon } from 'lucide-react';
import { t } from '../i18n';

interface HeaderProps {
  currentUser: User | null;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenProfile,
  onOpenSettings,
  searchTerm,
  setSearchTerm,
  theme,
  setTheme,
}) => {
  const [showSearch, setShowSearch] = React.useState(false);

  return (
    <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-30 select-none">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* App Title & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center font-bold text-xl text-emerald-300 shadow-inner">
            مـ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-wide">{t('appName')}</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/80 border border-emerald-500/40 text-emerald-200 font-medium">
                مباشر
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 hidden sm:block">
              تطبيق التواصل والاتصال العربي الاحترافي
            </p>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          {showSearch ? (
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="بحث في ميار..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-44 sm:w-64 bg-emerald-900/90 text-white placeholder-emerald-300/70 text-sm rounded-xl px-3 py-1.5 pr-8 border border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchTerm('');
                }}
                className="absolute left-2 text-xs text-emerald-200 hover:text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 transition"
              title="بحث"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 transition"
            title="المظهر"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* Current User Profile Pill */}
          {currentUser && (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 pr-1 pl-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 transition cursor-pointer"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-emerald-300/50"
              />
              <span className="text-xs font-semibold max-w-[90px] truncate hidden md:inline-block">
                {currentUser.name}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
