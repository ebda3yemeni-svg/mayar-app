import React, { useState, useEffect, useRef } from 'react';
import { User, Chat, Message } from '../types';
import {
  Phone,
  Video,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Mic,
  Check,
  CheckCheck,
  MoreVertical,
  Reply,
  Copy,
  Trash2,
  X,
  Play,
  Pause,
  Download,
  Users,
  Search,
  Edit2,
  Forward,
  Camera,
  Loader2,
  UploadCloud,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { t, formatArabicTime } from '../i18n';
import { VoiceRecorder } from './VoiceRecorder';
import { apiService } from '../services/api';
import { chatService } from '../services/chatService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserAvatar } from './UserAvatar';
import { uploadMediaFile, compressImage, formatFileSize } from '../services/storageService';
import { getDisplayAvatar, getFormattedPresenceText } from '../utils/presenceUtils';

interface ChatRoomProps {
  chat: Chat;
  currentUser: User;
  onStartCall: (targetUser: User, callType: 'voice' | 'video') => void;
  onBack?: () => void;
  typingUsers: string[];
}

interface PendingMedia {
  file: File;
  type: 'image' | 'video' | 'file';
  previewUrl: string;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chat,
  currentUser,
  onStartCall,
  onBack,
  typingUsers,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [targetContact, setTargetContact] = useState<User | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Media preview state
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  const [realtimeTypingUsers, setRealtimeTypingUsers] = useState<string[]>([]);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Subscribe to real-time messages in Firestore for active chat
    const unsubscribeMsgs = chatService.subscribeChatMessages(chat.id, (newMsgs) => {
      setMessages(newMsgs);
    });

    // 2. Mark chat as read
    chatService.markChatAsRead(chat.id, currentUser.id);

    // 3. Subscribe to target user real-time presence & profile if direct chat
    let unsubPresence: (() => void) | null = null;
    if (!chat.isGroup) {
      const otherId = chat.members.find((id) => id !== currentUser.id);
      if (otherId) {
        unsubPresence = chatService.subscribeUserPresence(otherId, (updatedUser) => {
          if (updatedUser) {
            setTargetContact(updatedUser);
          }
        });
      }
    } else {
      fetchTargetContact();
    }

    // 4. Subscribe to typing indicator status
    const unsubTyping = chatService.subscribeChatTyping(chat.id, (typingIds) => {
      setRealtimeTypingUsers(typingIds.filter((id) => id !== currentUser.id));
    });

    return () => {
      unsubscribeMsgs();
      if (unsubPresence) unsubPresence();
      unsubTyping();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      chatService.setTypingStatus(chat.id, currentUser.id, false);
    };
  }, [chat.id, chat.isGroup, chat.members, currentUser.id]);

  const handleInputTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);

    if (currentUser.privacySettings?.typingIndicator !== false) {
      if (text.trim()) {
        chatService.setTypingStatus(chat.id, currentUser.id, true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          chatService.setTypingStatus(chat.id, currentUser.id, false);
        }, 2500);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        chatService.setTypingStatus(chat.id, currentUser.id, false);
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteModalMsg, setDeleteModalMsg] = useState<Message | null>(null);
  const [forwardModalMsg, setForwardModalMsg] = useState<Message | null>(null);
  const [userChats, setUserChats] = useState<Chat[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to user chats for forward modal target selection
    const unsubChats = chatService.subscribeUserChats(currentUser.id, (chatsList) => {
      setUserChats(chatsList);
    });
    return () => unsubChats();
  }, [currentUser.id]);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCopyText = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('تم نسخ النص إلى الحافظة');
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMsg(msg);
    setEditText(msg.text || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !editText.trim()) return;
    try {
      await chatService.editMessage(chat.id, editingMsg.id, editText.trim());
      setEditingMsg(null);
      setEditText('');
      showToast('تم تعديل الرسالة');
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleDeleteForMe = async (msgId: string) => {
    try {
      await chatService.deleteMessageForMe(chat.id, msgId, currentUser.id);
      setDeleteModalMsg(null);
      showToast('تم حذف الرسالة لديك');
    } catch (err) {
      console.error('Failed to delete for me:', err);
    }
  };

  const handleDeleteForEveryone = async (msgId: string) => {
    try {
      await chatService.deleteMessageForEveryone(chat.id, msgId);
      setDeleteModalMsg(null);
      showToast('تم حذف الرسالة لدى الجميع');
    } catch (err) {
      console.error('Failed to delete for everyone:', err);
    }
  };

  const fetchTargetContact = async () => {
    if (!chat.isGroup) {
      const otherId = chat.members.find((id) => id !== currentUser.id);
      if (otherId) {
        try {
          const uSnap = await getDoc(doc(db, 'users', otherId));
          if (uSnap.exists()) {
            setTargetContact(uSnap.data() as User);
          }
        } catch (err) {
          console.warn('Could not fetch target user profile:', err);
        }
      }
    }
  };

  const handleForwardToChat = async (targetChatId: string) => {
    if (!forwardModalMsg) return;
    try {
      await chatService.forwardMessage(currentUser, targetChatId, forwardModalMsg);
      setForwardModalMsg(null);
      showToast('تم توجيه الرسالة بنجاح');
    } catch (err) {
      console.error('Failed to forward message:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText('');
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    chatService.setTypingStatus(chat.id, currentUser.id, false);

    try {
      await chatService.sendMessage(chat.id, currentUser, {
        text: textToSend,
        type: 'text',
        replyToMessageId: replyToMessage?.id,
        replyToSnippet: replyToMessage?.text?.slice(0, 30),
      });
      setReplyToMessage(null);
    } catch (err) {
      console.error('Failed to send text message:', err);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);

    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');
    const mediaType: 'image' | 'video' | 'file' = isImg ? 'image' : isVid ? 'video' : 'file';

    const previewUrl = URL.createObjectURL(file);
    setPendingMedia({
      file,
      type: mediaType,
      previewUrl,
    });
    setMediaCaption('');
    setUploadProgress(0);
    setUploadError(null);

    // Reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  const handleSendPendingMedia = async () => {
    if (!pendingMedia) return;

    setIsUploadingMedia(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      let fileToUpload: File | Blob = pendingMedia.file;
      if (pendingMedia.type === 'image') {
        fileToUpload = await compressImage(pendingMedia.file);
      }

      const folderPath = `chat-media/${chat.id}/${pendingMedia.type}s`;
      const result = await uploadMediaFile({
        file: fileToUpload,
        folderPath,
        fileName: pendingMedia.file.name,
        onProgress: (prog) => setUploadProgress(prog),
      });

      await chatService.sendMessage(chat.id, currentUser, {
        type: pendingMedia.type,
        mediaUrl: result.downloadUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
        text: mediaCaption.trim(),
        replyToMessageId: replyToMessage?.id,
        replyToSnippet: replyToMessage?.text?.slice(0, 30),
      });

      URL.revokeObjectURL(pendingMedia.previewUrl);
      setPendingMedia(null);
      setMediaCaption('');
      setReplyToMessage(null);
      showToast('تم إرسال الملف بنجاح');
    } catch (err: any) {
      console.error('Failed to upload media:', err);
      setUploadError(err?.message || 'حدث خطأ أثناء رفع الملف. يُرجى إعادة المحاولة.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleVoiceNoteRecorded = async (audioBlob: Blob, duration: number) => {
    setIsRecording(false);
    showToast('جاري رفع الرسالة الصوتية...');

    try {
      const folderPath = `chat-media/${chat.id}/audio`;
      const fileName = `voice_${Date.now()}.webm`;
      const uploadRes = await uploadMediaFile({
        file: audioBlob,
        folderPath,
        fileName,
      });

      await chatService.sendMessage(chat.id, currentUser, {
        type: 'voice',
        mediaUrl: uploadRes.downloadUrl,
        duration,
        replyToMessageId: replyToMessage?.id,
        replyToSnippet: replyToMessage?.text?.slice(0, 30),
      });
      setReplyToMessage(null);
      showToast('تم إرسال الرسالة الصوتية');
    } catch (err) {
      console.error('Failed to send voice note:', err);
      showToast('تعذر إرسال الرسالة الصوتية، يُرجى الإعادة.');
    }
  };

  const toggleVoicePlayback = (msgId: string, mediaUrl: string) => {
    if (playingVoiceId === msgId) {
      audioElementsRef.current[msgId]?.pause();
      setPlayingVoiceId(null);
    } else {
      if (playingVoiceId && audioElementsRef.current[playingVoiceId]) {
        audioElementsRef.current[playingVoiceId].pause();
      }

      let audio = audioElementsRef.current[msgId];
      if (!audio) {
        audio = new Audio(mediaUrl);
        audioElementsRef.current[msgId] = audio;
        audio.onended = () => setPlayingVoiceId(null);
      }
      audio.play();
      setPlayingVoiceId(msgId);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await chatService.deleteMessage(chat.id, msgId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative select-none">
      {/* Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10 shadow">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="sm:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              ←
            </button>
          )}

          <UserAvatar
            name={chat.isGroup ? chat.name : targetContact?.name || chat.name}
            avatar={chat.isGroup ? chat.avatar : targetContact?.avatar || chat.avatar}
            size="w-10 h-10"
            textSize="text-sm"
            showStatus={!chat.isGroup}
            status={targetContact?.status}
          />

          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>{chat.isGroup ? chat.name : targetContact?.name || chat.name}</span>
              {chat.isGroup && (
                <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800">
                  مجموعة ({chat.members.length})
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400">
              {typingUsers.length > 0 ? (
                <span className="text-emerald-400 animate-pulse">{t('typing')}</span>
              ) : chat.isGroup ? (
                `${chat.members.length} أعضاء`
              ) : targetContact?.status === 'online' ? (
                <span className="text-emerald-400">{t('online')}</span>
              ) : (
                targetContact?.email || `@${targetContact?.username || 'user'}`
              )}
            </p>
          </div>
        </div>

        {/* Header Action Buttons for Search & Direct Call */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-xl transition ${
              showSearch ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="بحث في المحادثة"
          >
            <Search className="w-4 h-4" />
          </button>

          {!chat.isGroup && targetContact && (
            <>
              <button
                onClick={() => onStartCall(targetContact, 'voice')}
                className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-700 text-emerald-400 hover:text-white transition"
                title={t('voiceCall')}
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => onStartCall(targetContact, 'video')}
                className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white transition"
                title={t('videoCall')}
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* In-chat Search Input Bar */}
      {showSearch && (
        <div className="p-2 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 px-4 z-10 animate-fade-in">
          <Search className="w-4 h-4 text-emerald-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في رسائل هذه المحادثة..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white text-xs">
              مسح
            </button>
          )}
        </div>
      )}

      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-xl animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.filter(m => !m.deletedFor?.includes(currentUser.id) && (!searchQuery || m.text?.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold mb-2">
              ✨
            </div>
            <p className="font-bold text-slate-200">
              {searchQuery ? 'لم يتم العثور على نتائج للبحث' : 'بداية المحادثة في ميار'}
            </p>
            <p className="text-xs text-slate-400">
              {searchQuery ? 'جرب البحث عن كلمة أخرى' : 'أرسل أول رسالة للبدء بالاشتراك مع أسلوب التواصل العربي الأنيق'}
            </p>
          </div>
        ) : (
          messages
            .filter(m => !m.deletedFor?.includes(currentUser.id) && (!searchQuery || m.text?.toLowerCase().includes(searchQuery.toLowerCase())))
            .map((msg) => {
              const isMe = msg.senderId === currentUser.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-start' : 'items-end'} group`}
                >
                  <div
                    className={`max-w-[80%] sm:max-w-[70%] rounded-2xl p-3 shadow-md relative ${
                      isMe
                        ? 'bg-emerald-800 text-white rounded-br-none border border-emerald-700/50'
                        : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                    }`}
                  >
                    {/* Sender Name in Group */}
                    {chat.isGroup && !isMe && (
                      <p className="text-[10px] font-bold text-emerald-400 mb-1">
                        {msg.senderName}
                      </p>
                    )}

                    {/* Reply Snippet */}
                    {msg.replyToSnippet && (
                      <div className="mb-2 p-1.5 bg-black/20 rounded-lg text-[11px] border-r-2 border-emerald-400">
                        <p className="text-slate-300 font-semibold truncate">{msg.replyToSnippet}</p>
                      </div>
                    )}

                    {/* Text Message */}
                    {msg.type === 'text' && (
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${msg.isDeleted ? 'italic text-slate-400' : ''}`}>
                        {msg.text}
                        {msg.isEdited && <span className="text-[10px] text-emerald-300 mr-1.5">(معدلة)</span>}
                      </p>
                    )}

                    {/* Image Message */}
                    {msg.type === 'image' && msg.mediaUrl && (
                      <div className="space-y-1">
                        <img
                          src={msg.mediaUrl}
                          alt="Shared image"
                          onClick={() => setActiveImage(msg.mediaUrl!)}
                          className="rounded-xl max-h-60 w-full object-cover cursor-pointer hover:opacity-90 transition border border-black/20"
                        />
                        {msg.text && <p className="text-xs mt-1">{msg.text}</p>}
                      </div>
                    )}

                    {/* Video Message */}
                    {msg.type === 'video' && msg.mediaUrl && (
                      <video
                        src={msg.mediaUrl}
                        controls
                        className="rounded-xl max-h-60 w-full object-cover border border-black/20"
                      />
                    )}

                    {/* Voice Note */}
                    {msg.type === 'voice' && msg.mediaUrl && (
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <button
                          onClick={() => toggleVoicePlayback(msg.id, msg.mediaUrl!)}
                          className="p-2.5 rounded-full bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition"
                        >
                          {playingVoiceId === msg.id ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-emerald-400 ${
                                playingVoiceId === msg.id ? 'animate-pulse w-3/4' : 'w-full'
                              }`}
                            ></div>
                          </div>
                          <span className="text-[10px] text-slate-300 mt-1 block">
                            🎤 {t('voiceNote')} {msg.duration ? `(${msg.duration}ث)` : ''}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* File Attachment */}
                    {msg.type === 'file' && (
                      <a
                        href={msg.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2 bg-black/20 rounded-xl hover:bg-black/30 transition"
                      >
                        <FileText className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{msg.fileName || 'ملف مرفق'}</p>
                          <p className="text-[10px] text-slate-300">{msg.fileSize || ''}</p>
                        </div>
                        <Download className="w-4 h-4 text-slate-300" />
                      </a>
                    )}

                    {/* Footer Timestamp & Status */}
                    <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-slate-300">
                      <span>{formatArabicTime(msg.timestamp)}</span>
                      {isMe && (
                        <span>
                          {msg.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-300" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover Actions */}
                  <div className="hidden group-hover:flex items-center gap-1 mt-1 text-slate-400 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded-full border border-slate-800">
                    <button
                      onClick={() => setReplyToMessage(msg)}
                      className="p-1 hover:text-emerald-400 transition"
                      title={t('reply')}
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    {msg.text && (
                      <button
                        onClick={() => handleCopyText(msg.text)}
                        className="p-1 hover:text-emerald-400 transition"
                        title="نسخ"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setForwardModalMsg(msg)}
                      className="p-1 hover:text-emerald-400 transition"
                      title="توجيه"
                    >
                      <Forward className="w-3.5 h-3.5" />
                    </button>
                    {isMe && msg.type === 'text' && !msg.isDeleted && (
                      <button
                        onClick={() => handleStartEdit(msg)}
                        className="p-1 hover:text-emerald-400 transition"
                        title="تعديل"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteModalMsg(msg)}
                      className="p-1 hover:text-red-400 transition"
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview Header */}
      {replyToMessage && (
        <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 border-r-2 border-emerald-500 pr-2">
            <Reply className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="font-bold text-emerald-400">الرد على {replyToMessage.senderName}:</span>
              <p className="text-slate-300 truncate max-w-xs">{replyToMessage.text}</p>
            </div>
          </div>
          <button onClick={() => setReplyToMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Message Header */}
      {editingMsg && (
        <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 border-r-2 border-emerald-500 pr-2">
            <Edit2 className="w-4 h-4 text-emerald-400" />
            <div className="flex-1">
              <span className="font-bold text-emerald-400">تعديل الرسالة:</span>
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white mt-1 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={handleSaveEdit}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
            >
              حفظ
            </button>
            <button onClick={() => setEditingMsg(null)} className="text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Attach Menu Modal */}
      {showAttachMenu && (
        <div className="absolute bottom-16 right-4 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl flex flex-col gap-1 z-20 animate-fade-in">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 text-xs font-semibold text-slate-200 transition"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>التقاط صورة بالكاميرا</span>
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 text-xs font-semibold text-slate-200 transition"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span>معرض الصور أو الفيديو</span>
          </button>
          <button
            onClick={() => documentInputRef.current?.click()}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 text-xs font-semibold text-slate-200 transition"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>مستند أو ملف</span>
          </button>
        </div>
      )}

      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileSelected}
        className="hidden"
        accept="image/*"
        capture="environment"
      />

      <input
        type="file"
        ref={galleryInputRef}
        onChange={handleFileSelected}
        className="hidden"
        accept="image/*,video/*"
      />

      <input
        type="file"
        ref={documentInputRef}
        onChange={handleFileSelected}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,application/*"
      />

      {/* Pending Media Preview Modal */}
      {pendingMedia && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-lg w-full shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-400" />
                <span>
                  معاينة {pendingMedia.type === 'image' ? 'الصورة' : pendingMedia.type === 'video' ? 'الفيديو' : 'الملف'} قبل الإرسال
                </span>
              </h3>
              {!isUploadingMedia && (
                <button
                  onClick={() => {
                    URL.revokeObjectURL(pendingMedia.previewUrl);
                    setPendingMedia(null);
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Media Display */}
            <div className="flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 p-2 overflow-hidden max-h-80 relative">
              {pendingMedia.type === 'image' && (
                <img
                  src={pendingMedia.previewUrl}
                  alt="Preview"
                  className="max-h-72 object-contain rounded-xl"
                />
              )}
              {pendingMedia.type === 'video' && (
                <video
                  src={pendingMedia.previewUrl}
                  controls
                  className="max-h-72 w-full rounded-xl object-contain"
                />
              )}
              {pendingMedia.type === 'file' && (
                <div className="p-8 flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white max-w-xs truncate">{pendingMedia.file.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{formatFileSize(pendingMedia.file.size)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Caption Input */}
            <div>
              <input
                type="text"
                disabled={isUploadingMedia}
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="إضافة شرح أو تعليق (اختياري)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition disabled:opacity-50"
              />
            </div>

            {/* Progress Bar & Error Display */}
            {isUploadingMedia && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الرفع إلى Firebase Storage...</span>
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              {!isUploadingMedia && (
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(pendingMedia.previewUrl);
                    setPendingMedia(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  إلغاء
                </button>
              )}
              <button
                type="button"
                disabled={isUploadingMedia}
                onClick={handleSendPendingMedia}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isUploadingMedia ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 rotate-180" />
                    <span>إرسال الملف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Options Modal */}
      {deleteModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white">خيارات حذف الرسالة</h3>
            <p className="text-xs text-slate-400">اختر طريقة حذف هذه الرسالة:</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleDeleteForMe(deleteModalMsg.id)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                حذف لدي فقط
              </button>
              {deleteModalMsg.senderId === currentUser.id && (
                <button
                  onClick={() => handleDeleteForEveryone(deleteModalMsg.id)}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition"
                >
                  حذف لدى الجميع
                </button>
              )}
              <button
                onClick={() => setDeleteModalMsg(null)}
                className="w-full py-2 rounded-xl bg-slate-950 text-slate-400 text-xs font-medium hover:text-white transition mt-1"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {forwardModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">توجيه الرسالة إلى...</h3>
              <button onClick={() => setForwardModalMsg(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {userChats.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">لا توجد محادثات متوفرة للتوجيه</p>
              ) : (
                userChats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleForwardToChat(c.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950 hover:bg-emerald-950 border border-slate-800 transition text-right"
                  >
                    <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-white truncate">{c.name}</h4>
                      <p className="text-[10px] text-slate-400">إرسال الرسالة إلى هنا</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        {isRecording ? (
          <VoiceRecorder
            onVoiceRecorded={handleVoiceNoteRecorded}
            onCancel={() => setIsRecording(false)}
          />
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('writeMessage')}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />

            {inputText.trim() ? (
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg flex items-center justify-center"
              >
                <Send className="w-5 h-5 rotate-180" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecording(true)}
                className="p-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white transition shadow-lg"
                title={t('holdToRecord')}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Fullscreen Image Lightbox */}
      {activeImage && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-fade-in select-none">
          <div className="w-full flex items-center justify-between z-10 px-2 py-1 max-w-4xl mx-auto">
            <span className="text-xs text-slate-300 font-semibold">عرض الصورة بحجم كامل</span>
            <div className="flex items-center gap-3">
              <a
                href={activeImage}
                target="_blank"
                rel="noopener noreferrer"
                download="mayar_media.jpg"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 transition flex items-center gap-1.5 text-xs font-bold shadow"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4" />
                <span>تحميل</span>
              </a>
              <button
                onClick={() => setActiveImage(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 flex items-center justify-center w-full max-h-[85vh] p-2"
            onClick={() => setActiveImage(null)}
          >
            <img
              src={activeImage}
              alt="Full view"
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain border border-slate-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};
