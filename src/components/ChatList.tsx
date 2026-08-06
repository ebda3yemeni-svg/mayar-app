import React from 'react';
import { Chat, User } from '../types';
import { MessageSquarePlus, Users, CheckCheck, Check, Camera, Mic, FileText } from 'lucide-react';
import { t, formatArabicTime } from '../i18n';
import { UserAvatar } from './UserAvatar';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chat: Chat) => void;
  currentUser: User;
  onOpenCreateGroup: () => void;
  searchTerm: string;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  currentUser,
  onOpenCreateGroup,
  searchTerm,
}) => {
  const filteredChats = chats.filter((c) => {
    if (!searchTerm) return true;
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.lastMessage?.text?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100 select-none">
      {/* List Header Actions */}
      <div className="p-3 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
          <span>المحادثات المباشرة</span>
          <span className="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800 font-mono">
            {filteredChats.length}
          </span>
        </h3>

        <button
          onClick={onOpenCreateGroup}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white transition shadow"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>{t('createGroup')}</span>
        </button>
      </div>

      {/* Chats Scroll List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Users className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-slate-300">لا توجد محادثات متطابقة</p>
            <p className="text-xs text-slate-400">ابحث عن مستخدم بالبريد أو اسم المستخدم لبدء محادثة!</p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const unread = chat.unreadCount?.[currentUser.id] || 0;
            const lastMsg = chat.lastMessage;

            const renderLastMsgSnippet = () => {
              if (!lastMsg) return 'محادثة جديدة';
              if (lastMsg.isDeleted) return 'تم حذف هذه الرسالة';
              if (lastMsg.type === 'voice') return '🎤 رسالة صوتية';
              if (lastMsg.type === 'image') return '📷 صورة';
              if (lastMsg.type === 'video') return '🎥 فيديو';
              if (lastMsg.type === 'file') return `📄 ${lastMsg.fileName || 'ملف مرفق'}`;
              return lastMsg.text;
            };

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={`flex items-center gap-3 p-3 cursor-pointer transition relative ${
                  isActive
                    ? 'bg-emerald-900/40 border-r-4 border-emerald-500'
                    : 'hover:bg-slate-800/70'
                }`}
              >
                {/* Chat Avatar */}
                <div className="relative flex-shrink-0">
                  <UserAvatar
                    name={chat.name}
                    avatar={chat.avatar}
                    size="w-12 h-12"
                    textSize="text-base"
                  />
                  {chat.isGroup && (
                    <span className="absolute -bottom-1 -right-1 bg-emerald-700 text-white p-1 rounded-full text-[10px] shadow">
                      <Users className="w-3 h-3" />
                    </span>
                  )}
                </div>

                {/* Info & Snippet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white truncate">{chat.name}</h4>
                    {lastMsg && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatArabicTime(lastMsg.timestamp)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1 min-w-0">
                      {lastMsg && lastMsg.senderId === currentUser.id && (
                        <span>
                          {lastMsg.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                          ) : lastMsg.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </span>
                      )}
                      <p className="text-xs text-slate-400 truncate max-w-[170px]">
                        {renderLastMsgSnippet()}
                      </p>
                    </div>

                    {unread > 0 && (
                      <span className="bg-emerald-500 text-slate-950 font-extrabold text-[11px] px-2 py-0.5 rounded-full min-w-[20px] text-center shadow">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

