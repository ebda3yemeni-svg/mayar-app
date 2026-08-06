import React, { useState, useEffect, useRef } from 'react';
import { User, Chat, Message, Call, CallType } from './types';
import { Header } from './components/Header';
import { NavigationTabs, TabType } from './components/NavigationTabs';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { CallHistoryList } from './components/CallHistoryList';
import { ContactsList } from './components/ContactsList';
import { SettingsScreen } from './components/SettingsScreen';
import { AuthScreen } from './components/AuthScreen';
import { IncomingCallModal } from './components/IncomingCallModal';
import { OutgoingCallModal } from './components/OutgoingCallModal';
import { CallScreen } from './components/CallScreen';
import { CreateGroupModal } from './components/CreateGroupModal';

import { apiService } from './services/api';
import { wsService } from './services/websocket';
import { WebRTCManager } from './services/webrtc';
import { soundSynth } from './services/audioSynthesizer';
import { nativeService } from './services/nativeService';
import { authService } from './services/authService';
import { chatService } from './services/chatService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Subscribe to real Firebase Email/Password Authentication state
    const unsubscribe = authService.subscribeAuthState((user, firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(user);
        setIsEmailVerified(!!firebaseUser.emailVerified);
      } else {
        setCurrentUser(null);
        setIsEmailVerified(true);
      }
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [contacts, setContacts] = useState<User[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [callNotification, setCallNotification] = useState<string | null>(null);

  // WebRTC Call States
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    caller: { id: string; name: string; avatar: string; username?: string };
    callType: CallType;
    offerSdp?: any;
  } | null>(null);

  const [outgoingCall, setOutgoingCall] = useState<{
    callId: string;
    targetUser: User;
    callType: CallType;
  } | null>(null);

  const [activeCall, setActiveCall] = useState<{
    callId: string;
    targetUser: User;
    callType: CallType;
    isIncoming: boolean;
    startedAt: string;
  } | null>(null);

  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const outgoingTimeoutRef = useRef<number | null>(null);
  const activeCallRef = useRef(activeCall);
  const incomingCallRef = useRef(incomingCall);
  const outgoingCallRef = useRef(outgoingCall);

  useEffect(() => {
    activeCallRef.current = activeCall;
    incomingCallRef.current = incomingCall;
    outgoingCallRef.current = outgoingCall;
  });

  const saveCallRecord = async (callData: Call) => {
    setCalls((prev) => [callData, ...prev.filter((c) => c.id !== callData.id)]);
    try {
      await apiService.saveCallLog(callData);
    } catch (e) {
      console.warn('Failed to save call log:', e);
    }
  };

  const showCallToast = (msg: string) => {
    setCallNotification(msg);
    setTimeout(() => setCallNotification(null), 3500);
  };

  useEffect(() => {
    if (currentUser) {
      loadInitialData();
      wsService.connect(currentUser.id);

      // Subscribe to real-time chats in Firestore
      const unsubChats = chatService.subscribeUserChats(currentUser.id, (userChats) => {
        setChats(userChats);
      });

      // Initialize Capacitor Native & FCM listeners if on native Android device
      nativeService.initPushNotifications(
        (fcmToken) => {
          console.log('[App] Registered FCM Token for User:', currentUser.id, fcmToken);
        },
        (nativeCall) => {
          if (!activeCallRef.current && !incomingCallRef.current && !outgoingCallRef.current) {
            setIncomingCall({
              callId: nativeCall.callId,
              caller: {
                id: nativeCall.callerId,
                name: nativeCall.callerName,
                avatar: nativeCall.callerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
              },
              callType: nativeCall.callType,
            });
          }
        }
      );

      // WebRTC Manager initialization with signaling callback
      webrtcManagerRef.current = new WebRTCManager((type, payload) => {
        const targetId =
          activeCallRef.current?.targetUser.id ||
          outgoingCallRef.current?.targetUser.id ||
          incomingCallRef.current?.caller.id;

        if (targetId) {
          wsService.send({
            type: type as any,
            senderId: currentUser.id,
            targetId,
            payload,
          });
        }
      });

      // WebSocket Event Subscriptions
      const unsubMessage = wsService.on('message:new', (msg) => {
        handleIncomingMessage(msg.payload);
      });

      const unsubCallInvite = wsService.on('call:invite', (msg) => {
        const { caller, callType, offerSdp } = msg.payload;
        const callId = msg.callId || `call-${Date.now()}`;

        // Check if user is already in a call or dialing
        if (activeCallRef.current || incomingCallRef.current || outgoingCallRef.current) {
          wsService.send({
            type: 'call:busy',
            senderId: currentUser.id,
            targetId: caller.id,
            callId,
            payload: {
              call: {
                id: callId,
                callerId: caller.id,
                callerName: caller.name,
                callerAvatar: caller.avatar,
                receiverId: currentUser.id,
                receiverName: currentUser.name,
                receiverAvatar: currentUser.avatar,
                callType,
                status: 'busy',
                startedAt: new Date().toISOString(),
              },
            },
          });
          return;
        }

        setIncomingCall({
          callId,
          caller,
          callType,
          offerSdp,
        });
      });

      const unsubCallAccept = wsService.on('call:accept', async (msg) => {
        soundSynth.stopRingtone();
        if (outgoingTimeoutRef.current) {
          clearTimeout(outgoingTimeoutRef.current);
          outgoingTimeoutRef.current = null;
        }

        const { answerSdp } = msg.payload;
        if (outgoingCallRef.current) {
          const currentTarget = outgoingCallRef.current.targetUser;
          const currentCallType = outgoingCallRef.current.callType;
          const currentCallId = outgoingCallRef.current.callId;

          setOutgoingCall(null);
          setActiveCall({
            callId: currentCallId,
            targetUser: currentTarget,
            callType: currentCallType,
            isIncoming: false,
            startedAt: new Date().toISOString(),
          });

          if (webrtcManagerRef.current && answerSdp) {
            await webrtcManagerRef.current.handleAnswer(answerSdp);
          }
        }
      });

      const unsubCallReject = wsService.on('call:reject', (msg) => {
        soundSynth.stopRingtone();
        soundSynth.playBusyTone();
        if (outgoingTimeoutRef.current) {
          clearTimeout(outgoingTimeoutRef.current);
          outgoingTimeoutRef.current = null;
        }

        if (outgoingCallRef.current) {
          const callObj: Call = {
            id: outgoingCallRef.current.callId,
            callerId: currentUser.id,
            callerName: currentUser.name,
            callerAvatar: currentUser.avatar,
            receiverId: outgoingCallRef.current.targetUser.id,
            receiverName: outgoingCallRef.current.targetUser.name,
            receiverAvatar: outgoingCallRef.current.targetUser.avatar,
            callType: outgoingCallRef.current.callType,
            status: 'rejected',
            startedAt: new Date().toISOString(),
          };
          saveCallRecord(callObj);
          showCallToast('تم رفض المكالمة من قبل المستلم');
        }

        setOutgoingCall(null);
        if (webrtcManagerRef.current) webrtcManagerRef.current.endCall();
      });

      const unsubCallBusy = wsService.on('call:busy', () => {
        soundSynth.stopRingtone();
        soundSynth.playBusyTone();
        if (outgoingTimeoutRef.current) {
          clearTimeout(outgoingTimeoutRef.current);
          outgoingTimeoutRef.current = null;
        }

        if (outgoingCallRef.current) {
          const callObj: Call = {
            id: outgoingCallRef.current.callId,
            callerId: currentUser.id,
            callerName: currentUser.name,
            callerAvatar: currentUser.avatar,
            receiverId: outgoingCallRef.current.targetUser.id,
            receiverName: outgoingCallRef.current.targetUser.name,
            receiverAvatar: outgoingCallRef.current.targetUser.avatar,
            callType: outgoingCallRef.current.callType,
            status: 'busy',
            startedAt: new Date().toISOString(),
          };
          saveCallRecord(callObj);
          showCallToast('المستخدم مشغول في مكالمة أخرى حالياً');
        }

        setOutgoingCall(null);
        if (webrtcManagerRef.current) webrtcManagerRef.current.endCall();
      });

      const unsubCallCancel = wsService.on('call:cancel', () => {
        soundSynth.stopRingtone();
        if (incomingCallRef.current) {
          showCallToast('تم إلغاء المكالمة من قبل المتصل');
        }
        setIncomingCall(null);
      });

      const unsubCallTimeout = wsService.on('call:timeout', () => {
        soundSynth.stopRingtone();
        soundSynth.playBusyTone();
        if (incomingCallRef.current) {
          showCallToast('مكالمة فائتة لم يتم الرد عليها');
        }
        setIncomingCall(null);
        setOutgoingCall(null);
        if (webrtcManagerRef.current) webrtcManagerRef.current.endCall();
      });

      const unsubCallEnd = wsService.on('call:end', () => {
        soundSynth.stopRingtone();
        if (activeCallRef.current) {
          const durationSec = Math.floor(
            (Date.now() - new Date(activeCallRef.current.startedAt).getTime()) / 1000
          );
          const callObj: Call = {
            id: activeCallRef.current.callId,
            callerId: activeCallRef.current.isIncoming
              ? activeCallRef.current.targetUser.id
              : currentUser.id,
            callerName: activeCallRef.current.isIncoming
              ? activeCallRef.current.targetUser.name
              : currentUser.name,
            callerAvatar: activeCallRef.current.isIncoming
              ? activeCallRef.current.targetUser.avatar
              : currentUser.avatar,
            receiverId: activeCallRef.current.isIncoming
              ? currentUser.id
              : activeCallRef.current.targetUser.id,
            receiverName: activeCallRef.current.isIncoming
              ? currentUser.name
              : activeCallRef.current.targetUser.name,
            receiverAvatar: activeCallRef.current.isIncoming
              ? currentUser.avatar
              : activeCallRef.current.targetUser.avatar,
            callType: activeCallRef.current.callType,
            status: 'ended',
            startedAt: activeCallRef.current.startedAt,
            endedAt: new Date().toISOString(),
            durationSeconds: durationSec,
          };
          saveCallRecord(callObj);
        }

        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.endCall();
        }
        setActiveCall(null);
      });

      const unsubWebRtcOffer = wsService.on('webrtc:offer', async (msg) => {
        if (webrtcManagerRef.current && msg.payload.offerSdp) {
          const answer = await webrtcManagerRef.current.createAnswer(msg.payload.offerSdp);
          wsService.send({
            type: 'call:accept',
            senderId: currentUser.id,
            targetId: msg.senderId,
            payload: { answerSdp: answer },
          });
        }
      });

      const unsubIceCandidate = wsService.on('webrtc:ice-candidate', (msg) => {
        if (webrtcManagerRef.current && msg.payload.candidate) {
          webrtcManagerRef.current.addIceCandidate(msg.payload.candidate);
        }
      });

      return () => {
        unsubChats();
        unsubMessage();
        unsubCallInvite();
        unsubCallAccept();
        unsubCallReject();
        unsubCallBusy();
        unsubCallCancel();
        unsubCallTimeout();
        unsubCallEnd();
        unsubWebRtcOffer();
        unsubIceCandidate();
      };
    }
  }, [currentUser?.id]);

  const loadInitialData = async () => {
    if (!currentUser) return;
    try {
      // Sync current user profile in Firestore
      await chatService.syncUserProfile(currentUser);

      // Load all registered contacts from Firestore
      const allUsers = await chatService.getAllUsers(currentUser.id);
      setContacts(allUsers);

      // Load call history from API
      const fetchedCalls = await apiService.getCalls(currentUser.id);
      setCalls(fetchedCalls);
    } catch (err) {
      console.warn('Error loading initial data:', err);
    }
  };

  const handleIncomingMessage = (newMsg: Message) => {
    setChats((prevChats) => {
      return prevChats.map((c) => {
        if (c.id === newMsg.chatId) {
          const isCurrentSelected = selectedChat?.id === c.id;
          const currentUnread = c.unreadCount[currentUser!.id] || 0;
          return {
            ...c,
            lastMessage: newMsg,
            unreadCount: {
              ...c.unreadCount,
              [currentUser!.id]: isCurrentSelected ? 0 : currentUnread + 1,
            },
            updatedAt: newMsg.timestamp,
          };
        }
        return c;
      });
    });
  };

  const startCall = async (targetUser: User, callType: CallType) => {
    if (!currentUser || !webrtcManagerRef.current) return;

    soundSynth.startOutgoingRing();
    const callId = `call-${Date.now()}`;

    setOutgoingCall({
      callId,
      targetUser,
      callType,
    });

    const stream = await webrtcManagerRef.current.initializeCall(callType);
    const offer = await webrtcManagerRef.current.createOffer();

    wsService.send({
      type: 'call:invite',
      senderId: currentUser.id,
      targetId: targetUser.id,
      callId,
      payload: {
        caller: {
          id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
        },
        callType,
        offerSdp: offer,
      },
    });

    // 35-second call timeout if target user does not answer
    if (outgoingTimeoutRef.current) clearTimeout(outgoingTimeoutRef.current);
    outgoingTimeoutRef.current = window.setTimeout(() => {
      soundSynth.stopRingtone();
      soundSynth.playBusyTone();

      wsService.send({
        type: 'call:timeout',
        senderId: currentUser.id,
        targetId: targetUser.id,
        callId,
      });

      const missedCallRecord: Call = {
        id: callId,
        callerId: currentUser.id,
        callerName: currentUser.name,
        callerAvatar: currentUser.avatar,
        receiverId: targetUser.id,
        receiverName: targetUser.name,
        receiverAvatar: targetUser.avatar,
        callType,
        status: 'missed',
        startedAt: new Date().toISOString(),
      };
      saveCallRecord(missedCallRecord);

      showCallToast('لا يوجد رد على المكالمة');
      setOutgoingCall(null);
      if (webrtcManagerRef.current) webrtcManagerRef.current.endCall();
    }, 35000);
  };

  const cancelOutgoingCall = () => {
    soundSynth.stopRingtone();
    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }

    if (outgoingCall && currentUser) {
      wsService.send({
        type: 'call:cancel',
        senderId: currentUser.id,
        targetId: outgoingCall.targetUser.id,
        callId: outgoingCall.callId,
      });

      const cancelRecord: Call = {
        id: outgoingCall.callId,
        callerId: currentUser.id,
        callerName: currentUser.name,
        callerAvatar: currentUser.avatar,
        receiverId: outgoingCall.targetUser.id,
        receiverName: outgoingCall.targetUser.name,
        receiverAvatar: outgoingCall.targetUser.avatar,
        callType: outgoingCall.callType,
        status: 'cancelled',
        startedAt: new Date().toISOString(),
      };
      saveCallRecord(cancelRecord);
    }

    setOutgoingCall(null);
    if (webrtcManagerRef.current) webrtcManagerRef.current.endCall();
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || !currentUser || !webrtcManagerRef.current) return;

    soundSynth.stopRingtone();

    const targetUser = contacts.find((u) => u.id === incomingCall.caller.id) || {
      id: incomingCall.caller.id,
      name: incomingCall.caller.name,
      avatar: incomingCall.caller.avatar,
      username: incomingCall.caller.username || 'user',
      phone: '',
      bio: '',
      status: 'online',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setActiveCall({
      callId: incomingCall.callId,
      targetUser,
      callType: incomingCall.callType,
      isIncoming: true,
      startedAt: new Date().toISOString(),
    });

    const offerSdp = incomingCall.offerSdp;
    const callId = incomingCall.callId;
    const callType = incomingCall.callType;

    setIncomingCall(null);

    await webrtcManagerRef.current.initializeCall(callType);

    if (offerSdp) {
      const answer = await webrtcManagerRef.current.createAnswer(offerSdp);
      wsService.send({
        type: 'call:accept',
        senderId: currentUser.id,
        targetId: targetUser.id,
        callId,
        payload: { answerSdp: answer },
      });
    }
  };

  const rejectIncomingCall = () => {
    soundSynth.stopRingtone();
    if (incomingCall && currentUser) {
      wsService.send({
        type: 'call:reject',
        senderId: currentUser.id,
        targetId: incomingCall.caller.id,
        callId: incomingCall.callId,
      });

      const rejectRecord: Call = {
        id: incomingCall.callId,
        callerId: incomingCall.caller.id,
        callerName: incomingCall.caller.name,
        callerAvatar: incomingCall.caller.avatar,
        receiverId: currentUser.id,
        receiverName: currentUser.name,
        receiverAvatar: currentUser.avatar,
        callType: incomingCall.callType,
        status: 'rejected',
        startedAt: new Date().toISOString(),
      };
      saveCallRecord(rejectRecord);
    }
    setIncomingCall(null);
  };

  const endCallClean = () => {
    soundSynth.stopRingtone();

    if (activeCall && currentUser) {
      const durationSec = Math.floor(
        (Date.now() - new Date(activeCall.startedAt).getTime()) / 1000
      );
      const callObj: Call = {
        id: activeCall.callId,
        callerId: activeCall.isIncoming ? activeCall.targetUser.id : currentUser.id,
        callerName: activeCall.isIncoming ? activeCall.targetUser.name : currentUser.name,
        callerAvatar: activeCall.isIncoming ? activeCall.targetUser.avatar : currentUser.avatar,
        receiverId: activeCall.isIncoming ? currentUser.id : activeCall.targetUser.id,
        receiverName: activeCall.isIncoming ? currentUser.name : activeCall.targetUser.name,
        receiverAvatar: activeCall.isIncoming ? currentUser.avatar : activeCall.targetUser.avatar,
        callType: activeCall.callType,
        status: 'ended',
        startedAt: activeCall.startedAt,
        endedAt: new Date().toISOString(),
        durationSeconds: durationSec,
      };
      saveCallRecord(callObj);

      wsService.send({
        type: 'call:end',
        senderId: currentUser.id,
        targetId: activeCall.targetUser.id,
        callId: activeCall.callId,
      });
    }

    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.endCall();
    }
    setActiveCall(null);
  };

  const startDirectChat = async (targetUser: User) => {
    if (!currentUser) return;
    try {
      const directChat = await chatService.getOrCreateDirectChat(currentUser, targetUser);
      setSelectedChat(directChat);
      setActiveTab('chats');
    } catch (err) {
      console.error('Failed to start direct chat:', err);
    }
  };

  const handleCreateGroup = async (name: string, members: string[], description?: string) => {
    if (!currentUser) return;
    try {
      const newGroup = await chatService.createGroupChat(currentUser, name, members, description);
      setSelectedChat(newGroup);
      setActiveTab('chats');
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const unreadCountTotal = chats.reduce((acc, c) => acc + (c.unreadCount[currentUser?.id || ''] || 0), 0);
  const missedCallsCount = calls.filter((c) => c.status === 'missed').length;

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4 select-none">
        <div className="w-16 h-16 rounded-3xl bg-emerald-800/80 border border-emerald-400/30 flex items-center justify-center text-3xl font-bold text-emerald-200 shadow-xl mb-4 animate-pulse">
          مـ
        </div>
        <p className="text-sm text-slate-400 animate-pulse">جاري التحقق من الحساب...</p>
      </div>
    );
  }

  if (!currentUser || !isEmailVerified) {
    return (
      <AuthScreen
        initialMode={currentUser && !isEmailVerified ? 'verify_notice' : 'login'}
        pendingUser={currentUser}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setIsEmailVerified(true);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans flex flex-col h-screen overflow-hidden`}>
      {/* Toast Notification Banner for Call Events */}
      {callNotification && (
        <div className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 z-50 bg-slate-900 border-2 border-emerald-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
          <span className="text-xs font-bold">{callNotification}</span>
        </div>
      )}

      {/* Top Main Navigation Header */}
      <Header
        currentUser={currentUser}
        onOpenProfile={() => setActiveTab('settings')}
        onOpenSettings={() => setActiveTab('settings')}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Main Container Layout */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden max-w-7xl mx-auto w-full">
        {/* Navigation Tabs Bar */}
        <div className="sm:hidden">
          <NavigationTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            unreadChatsCount={unreadCountTotal}
            missedCallsCount={missedCallsCount}
          />
        </div>

        {/* Sidebar Panel (Chats / Calls / Contacts / Settings) */}
        <div className={`w-full sm:w-80 md:w-96 flex-shrink-0 flex flex-col border-l border-slate-800 bg-slate-900 ${selectedChat && activeTab === 'chats' ? 'hidden sm:flex' : 'flex'}`}>
          <div className="hidden sm:block">
            <NavigationTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              unreadChatsCount={unreadCountTotal}
              missedCallsCount={missedCallsCount}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'chats' && (
              <ChatList
                chats={chats}
                activeChatId={selectedChat?.id || null}
                onSelectChat={(chat) => setSelectedChat(chat)}
                currentUser={currentUser}
                onOpenCreateGroup={() => setShowCreateGroup(true)}
                searchTerm={searchTerm}
              />
            )}

            {activeTab === 'calls' && (
              <CallHistoryList
                calls={calls}
                currentUser={currentUser}
                onRedial={(call) => {
                  const otherId = call.callerId === currentUser.id ? call.receiverId : call.callerId;
                  const otherName = call.callerId === currentUser.id ? call.receiverName : call.callerName;
                  const otherAvatar = call.callerId === currentUser.id ? call.receiverAvatar : call.callerAvatar;

                  const contact = contacts.find((u) => u.id === otherId) || {
                    id: otherId,
                    name: otherName,
                    avatar: otherAvatar,
                    username: 'user',
                    phone: '',
                    bio: '',
                    status: 'online',
                    lastSeen: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                  };
                  startCall(contact, call.callType);
                }}
              />
            )}

            {activeTab === 'contacts' && (
              <ContactsList
                contacts={contacts}
                currentUser={currentUser}
                onStartChat={startDirectChat}
                onStartCall={startCall}
                searchTerm={searchTerm}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsScreen
                currentUser={currentUser}
                onUpdateUser={(updated) => setCurrentUser(updated)}
                onLogout={() => setCurrentUser(null)}
              />
            )}
          </div>
        </div>

        {/* Main Workspace Area (Active Chat Room) */}
        <div className={`flex-1 flex flex-col bg-slate-900 overflow-hidden ${!selectedChat && activeTab === 'chats' ? 'hidden sm:flex' : 'flex'}`}>
          {selectedChat ? (
            <ChatRoom
              chat={selectedChat}
              currentUser={currentUser}
              onStartCall={startCall}
              onBack={() => setSelectedChat(null)}
              typingUsers={typingUsers}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-emerald-900/60 border border-emerald-700/50 flex items-center justify-center text-emerald-400 font-bold text-4xl shadow-xl">
                مـ
              </div>
              <h2 className="text-xl font-bold text-slate-200">تطبيق ميار للتواصل العربي</h2>
              <p className="text-sm max-w-sm text-slate-400 leading-relaxed">
                اختر محادثة أو ابدأ اتصالاً صوتياً وفيديو فورياً باللغة العربية بأسلوب نقي وسريع.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Outgoing Call Ringing Dialog Modal */}
      {outgoingCall && (
        <OutgoingCallModal
          targetUser={outgoingCall.targetUser}
          callType={outgoingCall.callType}
          onCancel={cancelOutgoingCall}
        />
      )}

      {/* Incoming Call Dialog Modal */}
      {incomingCall && (
        <IncomingCallModal
          caller={incomingCall.caller}
          callType={incomingCall.callType}
          onAccept={acceptIncomingCall}
          onReject={rejectIncomingCall}
        />
      )}

      {/* Full-Screen WebRTC Audio/Video Call Screen */}
      {activeCall && webrtcManagerRef.current && (
        <CallScreen
          callType={activeCall.callType}
          targetUser={activeCall.targetUser}
          isIncoming={activeCall.isIncoming}
          webrtcManager={webrtcManagerRef.current}
          onEndCall={endCallClean}
        />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          contacts={contacts}
          currentUser={currentUser}
          onClose={() => setShowCreateGroup(false)}
          onCreateGroup={handleCreateGroup}
        />
      )}
    </div>
  );
}

