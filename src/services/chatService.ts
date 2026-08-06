import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { User, Chat, Message, MessageType } from '../types';

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
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cleanData<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

export const chatService = {
  // Sync or update user profile in Firestore /users/{uid}
  async syncUserProfile(user: User): Promise<void> {
    if (!user || !user.id) return;
    const path = `users/${user.id}`;
    const cleanEmail = user.email?.trim().toLowerCase() || '';
    const now = new Date().toISOString();
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(
        userRef,
        {
          id: user.id,
          email: cleanEmail,
          name: user.name || 'مستخدم ميار',
          username: user.username || cleanEmail.split('@')[0] || 'user',
          avatar: user.avatar || '',
          bio: user.bio || 'متاح للتواصل على ميار 🚀',
          status: 'online',
          onlineStatus: 'online',
          lastSeen: now,
          lastActiveAt: now,
          createdAt: user.createdAt || now,
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  // Search a real user by Email OR Username with direct /usernames/{usernameLower} index & fallback queries
  async searchUserByEmailOrUsername(queryInput: string, currentUserId: string): Promise<User | null> {
    const rawInput = queryInput.trim();
    if (!rawInput) return null;

    const isEmail = rawInput.includes('@') && rawInput.includes('.');
    const cleanLower = rawInput.replace(/^@/, '').toLowerCase();

    console.log('[USER SEARCH] Searching query:', rawInput, '| isEmail:', isEmail);

    try {
      let foundUser: User | null = null;

      if (!isEmail) {
        // Stage 1: Check /usernames/{cleanLower} reservation document
        try {
          const usernameSnap = await getDoc(doc(db, 'usernames', cleanLower));
          if (usernameSnap.exists()) {
            const usernameData = usernameSnap.data();
            if (usernameData.uid) {
              const userSnap = await getDoc(doc(db, 'users', usernameData.uid));
              if (userSnap.exists()) {
                foundUser = { id: userSnap.id, ...userSnap.data() } as User;
              }
            }
          }
        } catch (uErr) {
          console.warn('[USER SEARCH] Username doc check failed, trying user collection queries:', uErr);
        }

        // Stage 2: Query /users where usernameLowercase == cleanLower
        if (!foundUser) {
          const qUser = query(collection(db, 'users'), where('usernameLowercase', '==', cleanLower));
          const snapUser = await getDocs(qUser);
          if (!snapUser.empty) {
            foundUser = { id: snapUser.docs[0].id, ...snapUser.docs[0].data() } as User;
          }
        }

        // Stage 3: Query /users where username == rawInput without @
        if (!foundUser) {
          const cleanRaw = rawInput.replace(/^@/, '');
          const qRaw = query(collection(db, 'users'), where('username', '==', cleanRaw));
          const snapRaw = await getDocs(qRaw);
          if (!snapRaw.empty) {
            foundUser = { id: snapRaw.docs[0].id, ...snapRaw.docs[0].data() } as User;
          }
        }
      }

      // If still not found or query is email, search by email
      if (!foundUser) {
        const cleanEmail = rawInput.toLowerCase();

        // Query by email
        let qEmail = query(collection(db, 'users'), where('email', '==', cleanEmail));
        let snapEmail = await getDocs(qEmail);

        if (snapEmail.empty) {
          qEmail = query(collection(db, 'users'), where('emailLowercase', '==', cleanEmail));
          snapEmail = await getDocs(qEmail);
        }

        if (!snapEmail.empty) {
          foundUser = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() } as User;
        } else {
          // Fallback scan
          const allUsersSnap = await getDocs(collection(db, 'users'));
          allUsersSnap.forEach((d) => {
            if (foundUser) return;
            const u = d.data() as User;
            const uEmail = (u.email || '').trim().toLowerCase();
            const uUser = (u.username || '').trim().toLowerCase();
            if (uEmail === cleanEmail || uUser === cleanLower) {
              foundUser = { id: d.id, ...u } as User;
            }
          });
        }
      }

      if (!foundUser) {
        console.log('[USER SEARCH] No user found for input:', rawInput);
        return null;
      }

      console.log('[USER SEARCH] Found user UID:', (foundUser as User).id);

      // Self-search check
      if ((foundUser as User).id === currentUserId) {
        throw new Error('IS_SELF_USER');
      }

      return foundUser;
    } catch (err: any) {
      if (err instanceof Error && err.message === 'IS_SELF_USER') {
        throw err;
      }
      console.error('[USER SEARCH] Search error:', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('permission') || rawMsg.includes('Missing or insufficient permissions')) {
        throw new Error('PERM_DENIED');
      } else if (rawMsg.includes('offline') || rawMsg.includes('network') || rawMsg.includes('Failed to get document')) {
        throw new Error('NETWORK_ERROR');
      }
      handleFirestoreError(err, OperationType.LIST, 'users');
      return null;
    }
  },

  // Alias for backward compatibility
  async searchUserByEmail(emailSearch: string, currentUserId: string): Promise<User | null> {
    return this.searchUserByEmailOrUsername(emailSearch, currentUserId);
  },

  // Search all registered users excluding current user
  async getAllUsers(currentUserId: string): Promise<User[]> {
    const path = 'users';
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const users: User[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as User;
        const uid = docSnap.id || data.id;
        if (uid && uid !== currentUserId) {
          users.push({ ...data, id: uid });
        }
      });
      return users;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
      return [];
    }
  },

  // Get or Create direct chat document with deterministic document ID
  async getOrCreateDirectChat(currentUser: User, targetUser: User): Promise<Chat> {
    const currentUid = currentUser.id || auth.currentUser?.uid;
    const targetUid = targetUser.id || (targetUser as any).uid;

    if (!currentUid || !targetUid) {
      console.error('[CHAT SERVICE] Cannot start chat due to missing user ID:', { currentUid, targetUid, currentUser, targetUser });
      throw new Error('تعذر إيجاد معرّف الحساب لبدء المحادثة.');
    }

    const sortedIds = [currentUid, targetUid].sort();
    const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
    const path = `chats/${chatId}`;

    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);

      if (chatSnap.exists()) {
        const data = chatSnap.data() as Chat;
        // Dynamically format name & avatar for target user
        return {
          ...data,
          id: chatId,
          name: targetUser.name || data.name,
          avatar: targetUser.avatar || data.avatar,
        };
      }

      const newChat: Chat = {
        id: chatId,
        isGroup: false,
        name: targetUser.name || 'مستخدم',
        avatar: targetUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        members: [currentUid, targetUid],
        unreadCount: { [currentUid]: 0, [targetUid]: 0 },
        createdBy: currentUid,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(chatRef, newChat);
      return newChat;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  },

  // Create a new group chat
  async createGroupChat(
    currentUser: User,
    name: string,
    memberIds: string[],
    description?: string
  ): Promise<Chat> {
    const chatId = `group_${Date.now()}`;
    const path = `chats/${chatId}`;
    const allMembers = Array.from(new Set([currentUser.id, ...memberIds]));

    const initialUnread: Record<string, number> = {};
    allMembers.forEach((id) => (initialUnread[id] = 0));

    const newGroup: Chat = {
      id: chatId,
      isGroup: true,
      name: name.trim(),
      avatar:
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
      description: description || '',
      members: allMembers,
      admins: [currentUser.id],
      unreadCount: initialUnread,
      createdBy: currentUser.id,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'chats', chatId), newGroup);
      return newGroup;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  },

  // Subscribe to real-time chats for the authenticated user
  subscribeUserChats(
    currentUserId: string,
    callback: (chats: Chat[]) => void
  ): () => void {
    const path = 'chats';
    const q = query(
      collection(db, 'chats'),
      where('members', 'array-contains', currentUserId)
    );

    return onSnapshot(
      q,
      async (snapshot) => {
        const chatsList: Chat[] = [];
        const otherUserIdsToFetch = new Set<string>();

        snapshot.forEach((docSnap) => {
          const chat = docSnap.data() as Chat;
          chatsList.push(chat);
          if (!chat.isGroup) {
            const other = chat.members.find((id) => id !== currentUserId);
            if (other) otherUserIdsToFetch.add(other);
          }
        });

        // Fetch user details for 1-on-1 chats to ensure up-to-date names/avatars
        const userProfiles: Record<string, User> = {};
        for (const uid of Array.from(otherUserIdsToFetch)) {
          try {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              userProfiles[uid] = uSnap.data() as User;
            }
          } catch (e) {
            console.warn('Could not fetch user profile for', uid);
          }
        }

        const formattedChats = chatsList.map((chat) => {
          if (!chat.isGroup) {
            const otherId = chat.members.find((id) => id !== currentUserId);
            if (otherId && userProfiles[otherId]) {
              return {
                ...chat,
                name: userProfiles[otherId].name || chat.name,
                avatar: userProfiles[otherId].avatar || chat.avatar,
              };
            }
          }
          return chat;
        });

        // Sort by updatedAt descending
        formattedChats.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        callback(formattedChats);
      },
      (err) => {
        console.error('Error in subscribeUserChats:', err);
      }
    );
  },

  // Subscribe to real-time messages in a specific chat
  subscribeChatMessages(
    chatId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    const path = `chats/${chatId}/messages`;
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const messages: Message[] = [];
        snapshot.forEach((docSnap) => {
          messages.push(docSnap.data() as Message);
        });
        callback(messages);
      },
      (err) => {
        console.error('Error in subscribeChatMessages:', err);
      }
    );
  },

  // Send a message and update conversation's lastMessage and unread counts
  async sendMessage(
    chatId: string,
    sender: User,
    data: {
      text?: string;
      type?: MessageType;
      mediaUrl?: string;
      fileName?: string;
      fileSize?: string;
      duration?: number;
      replyToMessageId?: string;
      replyToSnippet?: string;
      receiverId?: string;
    }
  ): Promise<Message> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const path = `chats/${chatId}/messages/${messageId}`;
    const timestamp = new Date().toISOString();

    let receiverId = data.receiverId;
    if (!receiverId) {
      // Find recipient from chatId or chat document if direct chat
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as Chat;
        if (!chatData.isGroup && chatData.members) {
          receiverId = chatData.members.find((m) => m !== sender.id);
        }
      }
    }

    const newMessageRaw: Message = {
      id: messageId,
      chatId,
      senderId: sender.id,
      receiverId: receiverId || '',
      senderName: sender.name || '',
      senderAvatar: sender.avatar || '',
      text: data.text || '',
      type: data.type || 'text',
      mediaUrl: data.mediaUrl || '',
      fileName: data.fileName || '',
      fileSize: data.fileSize || '',
      duration: data.duration,
      replyToMessageId: data.replyToMessageId,
      replyToSnippet: data.replyToSnippet,
      status: 'sent',
      timestamp,
    };

    const newMessage = cleanData(newMessageRaw);

    try {
      // 1. Write message to sub-collection
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      await setDoc(messageRef, newMessage);

      // 2. Fetch current chat to update unread counts
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);

      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as Chat;
        const currentUnread = chatData.unreadCount || {};
        const updatedUnread: Record<string, number> = { ...currentUnread };

        chatData.members.forEach((memberId) => {
          if (memberId !== sender.id) {
            updatedUnread[memberId] = (updatedUnread[memberId] || 0) + 1;
          } else {
            updatedUnread[memberId] = 0;
          }
        });

        await updateDoc(chatRef, {
          lastMessage: newMessage,
          updatedAt: timestamp,
          unreadCount: updatedUnread,
        });
      }

      return newMessage;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  },

  // Mark chat as read for current user and update message statuses to read
  async markChatAsRead(chatId: string, userId: string): Promise<void> {
    const path = `chats/${chatId}`;
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as Chat;
        const currentUnread = chatData.unreadCount || {};
        if (currentUnread[userId] !== 0) {
          await updateDoc(chatRef, {
            [`unreadCount.${userId}`]: 0,
          });
        }
      }

      // Update recent unread messages to 'read'
      const msgsQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('status', '!=', 'read')
      );
      const msgsSnap = await getDocs(msgsQuery);
      msgsSnap.forEach((msgDoc) => {
        const m = msgDoc.data() as Message;
        if (m.senderId !== userId) {
          updateDoc(doc(db, 'chats', chatId, 'messages', msgDoc.id), { status: 'read' }).catch(() => {});
        }
      });
    } catch (err) {
      console.warn('Could not mark chat as read:', err);
    }
  },

  // Edit message
  async editMessage(chatId: string, messageId: string, newText: string): Promise<void> {
    const path = `chats/${chatId}/messages/${messageId}`;
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await updateDoc(msgRef, {
        text: newText,
        isEdited: true,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // Delete message for everyone
  async deleteMessageForEveryone(chatId: string, messageId: string): Promise<void> {
    const path = `chats/${chatId}/messages/${messageId}`;
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await updateDoc(msgRef, {
        text: 'تم حذف هذه الرسالة',
        isDeleted: true,
        type: 'text',
        mediaUrl: '',
      });
    } catch (err) {
      // Fallback to hard delete if update fails
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId)).catch(() => {});
    }
  },

  // Delete message for me
  async deleteMessageForMe(chatId: string, messageId: string, userId: string): Promise<void> {
    const path = `chats/${chatId}/messages/${messageId}`;
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      const msgSnap = await getDoc(msgRef);
      if (msgSnap.exists()) {
        const m = msgSnap.data() as Message;
        const currentDeleted = m.deletedFor || [];
        if (!currentDeleted.includes(userId)) {
          await updateDoc(msgRef, {
            deletedFor: [...currentDeleted, userId],
          });
        }
      }
    } catch (err) {
      console.warn('Error deleting message for me:', err);
    }
  },

  // Forward message to another chat
  async forwardMessage(sender: User, targetChatId: string, originalMsg: Message): Promise<Message> {
    return this.sendMessage(targetChatId, sender, {
      text: originalMsg.text,
      type: originalMsg.type,
      mediaUrl: originalMsg.mediaUrl,
      fileName: originalMsg.fileName,
      fileSize: originalMsg.fileSize,
      duration: originalMsg.duration,
    });
  },

  // Delete message (legacy signature wrapper)
  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    return this.deleteMessageForEveryone(chatId, messageId);
  },

  // Set user online status in Firestore
  async setUserOnline(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const userRef = doc(db, 'users', userId);
      const now = new Date().toISOString();
      await updateDoc(userRef, {
        status: 'online',
        onlineStatus: 'online',
        lastActiveAt: now,
      });
    } catch (err) {
      console.warn('setUserOnline warning:', err);
    }
  },

  // Set user offline status and update lastSeen in Firestore
  async setUserOffline(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const userRef = doc(db, 'users', userId);
      const now = new Date().toISOString();
      await updateDoc(userRef, {
        status: 'offline',
        onlineStatus: 'offline',
        lastSeen: now,
        lastActiveAt: now,
      });
    } catch (err) {
      console.warn('setUserOffline warning:', err);
    }
  },

  // Real-time listener for a specific user's status and profile
  subscribeUserPresence(userId: string, callback: (user: User | null) => void): () => void {
    if (!userId) return () => {};
    const userRef = doc(db, 'users', userId);
    return onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as User);
        } else {
          callback(null);
        }
      },
      (err) => {
        console.warn('Error in subscribeUserPresence:', err);
      }
    );
  },

  // Set or clear typing status in Firestore for a chat
  async setTypingStatus(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    if (!chatId || !userId) return;
    try {
      const typingRef = doc(db, 'chats', chatId, 'typing', userId);
      if (isTyping) {
        await setDoc(typingRef, {
          userId,
          isTyping: true,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await deleteDoc(typingRef).catch(() => {});
      }
    } catch (err) {
      console.warn('setTypingStatus warning:', err);
    }
  },

  // Subscribe to real-time typing status in a chat
  subscribeChatTyping(chatId: string, callback: (typingUserIds: string[]) => void): () => void {
    if (!chatId) return () => {};
    const q = query(collection(db, 'chats', chatId, 'typing'));
    return onSnapshot(
      q,
      (snapshot) => {
        const typingIds: string[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          if (data && data.isTyping) {
            typingIds.push(d.id);
          }
        });
        callback(typingIds);
      },
      (err) => {
        console.warn('Error in subscribeChatTyping:', err);
      }
    );
  },
};
