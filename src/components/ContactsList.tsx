import React, { useState } from 'react';
import { User } from '../types';
import { UserPlus, MessageSquare, Phone, Video, Search, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { t } from '../i18n';
import { chatService } from '../services/chatService';
import { UserAvatar } from './UserAvatar';

interface ContactsListProps {
  contacts: User[];
  currentUser: User;
  onStartChat: (contact: User) => void;
  onStartCall: (contact: User, type: 'voice' | 'video') => void;
  searchTerm: string;
}

export const ContactsList: React.FC<ContactsListProps> = ({
  contacts,
  currentUser,
  onStartChat,
  onStartCall,
  searchTerm,
}) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const filteredContacts = contacts.filter((c) => {
    if (!searchTerm) return true;
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setFoundUser(null);

    try {
      const user = await chatService.searchUserByEmailOrUsername(searchQuery, currentUser.id);
      if (user) {
        setFoundUser(user);
      } else {
        setSearchError('لم يتم العثور على حساب بهذا البريد الإلكتروني أو اسم المستخدم');
      }
    } catch (err: any) {
      if (err instanceof Error && err.message === 'IS_SELF_USER') {
        setSearchError('هذا هو حسابك الحالي، يُرجى إدخال البريد أو اسم المستخدم لمستخدم آخر لبدء المحادثة معه.');
      } else if (err instanceof Error && err.message === 'PERM_DENIED') {
        setSearchError('عفواً، تعذر الوصول لقاعدة البيانات بسبب قيود الصلاحيات.');
      } else if (err instanceof Error && err.message === 'NETWORK_ERROR') {
        setSearchError('تعذر الاتصال بالشبكة، يُرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.');
      } else {
        setSearchError('حدث خطأ أثناء البحث، يرجى المحاولة لاحقاً');
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      {/* Header & Search User Button */}
      <div className="p-3 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-200">
          <span>{t('contacts')}</span>
          <span className="mr-2 text-xs text-emerald-400">({filteredContacts.length})</span>
        </h3>

        <button
          onClick={() => {
            setShowSearchModal(true);
            setFoundUser(null);
            setSearchError(null);
            setSearchQuery('');
          }}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white transition shadow"
        >
          <UserPlus className="w-4 h-4" />
          <span>بحث عن مستخدم</span>
        </button>
      </div>

      {/* Search User Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <h3 className="font-bold text-base text-white text-center flex items-center justify-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <span>بحث عن مستخدم جديد</span>
            </h3>

            <form onSubmit={handleSearchUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  البريد الإلكتروني أو اسم المستخدم
                </label>
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="user@example.com أو @username"
                    dir="ltr"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSearchModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow disabled:opacity-50"
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>بحث</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Error Result */}
            {searchError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {/* Found User Profile Card */}
            {foundUser && (
              <div className="p-4 bg-slate-900 border border-emerald-500/40 rounded-2xl space-y-3 text-center animate-fade-in">
                <div className="relative w-14 h-14 mx-auto">
                  <UserAvatar user={foundUser} size="w-14 h-14" textSize="text-lg" />
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 absolute -bottom-1 -right-1 bg-slate-900 rounded-full" />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-white">{foundUser.name}</h4>
                  <p className="text-xs text-emerald-400 font-mono" dir="ltr">
                    {foundUser.email || `@${foundUser.username}`}
                  </p>
                  {foundUser.bio && (
                    <p className="text-xs text-slate-400 mt-1">{foundUser.bio}</p>
                  )}
                </div>

                <button
                  onClick={async () => {
                    if (startingChat) return;
                    setStartingChat(true);
                    try {
                      await onStartChat(foundUser);
                      setShowSearchModal(false);
                    } catch (err) {
                      console.error('Error starting chat:', err);
                    } finally {
                      setStartingChat(false);
                    }
                  }}
                  disabled={startingChat}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
                >
                  {startingChat ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      <span>مراسلة الآن</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <Mail className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-slate-300">لا توجد جهات اتصال مضافة</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              اضغط على "بحث عن مستخدم" في الأعلى للبحث بالبريد الإلكتروني أو اسم المستخدم لبدء المحادثة!
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-3.5 hover:bg-slate-800/60 transition"
            >
              <div className="flex items-center gap-3">
                <UserAvatar user={contact} showStatus status={contact.status} />
                <div>
                  <h4 className="font-bold text-sm text-white">{contact.name}</h4>
                  <p className="text-xs text-slate-400 truncate max-w-[150px]">
                    {contact.bio || `@${contact.username}`}
                  </p>
                  {contact.email && (
                    <p className="text-[10px] text-emerald-400/80 font-mono" dir="ltr">
                      {contact.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onStartChat(contact)}
                  className="p-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-white transition"
                  title={t('startChat')}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStartCall(contact, 'voice')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-700 text-emerald-400 hover:text-white transition"
                  title={t('voiceCall')}
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStartCall(contact, 'video')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white transition"
                  title={t('videoCall')}
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

