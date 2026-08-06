export type UserStatus = 'online' | 'offline';
export type OnlineStatus = 'online' | 'offline' | 'away';

export interface UserPrivacySettings {
  lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
  onlineStatusVisibility: 'everyone' | 'same_as_last_seen';
  profilePhotoVisibility: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  typingIndicator: boolean;
}

export interface User {
  id: string;
  email?: string;
  emailLowercase?: string;
  phone?: string;
  name: string;
  username: string;
  usernameLowercase?: string;
  avatar: string;
  bio: string;
  status: UserStatus;
  onlineStatus?: OnlineStatus;
  lastSeen: string; // ISO date string
  lastActiveAt?: string; // ISO date string
  privacySettings?: UserPrivacySettings;
  pushToken?: string;
  createdAt: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId?: string;
  senderName?: string;
  senderAvatar?: string;
  text?: string;
  type: MessageType;
  mediaUrl?: string;
  duration?: number; // for voice messages (in seconds)
  fileName?: string;
  fileSize?: string;
  replyToMessageId?: string;
  replyToSnippet?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedFor?: string[];
  status: MessageStatus;
  timestamp: string; // ISO string
}

export interface Chat {
  id: string;
  isGroup: boolean;
  name: string;
  avatar: string;
  description?: string;
  members: string[]; // user IDs
  admins?: string[]; // user IDs
  unreadCount: Record<string, number>; // userId -> count
  lastMessage?: Message;
  updatedAt: string;
  createdBy?: string;
}

export type CallType = 'voice' | 'video';
export type CallStatus = 'dialing' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy' | 'cancelled' | 'timeout';

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  callType: CallType;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
}

export interface UserSettings {
  lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
  onlineStatusVisibility: 'everyone' | 'same_as_last_seen';
  profilePhotoVisibility: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  typingIndicator: boolean;
  soundNotifications: boolean;
  stunServer: string;
  turnServer: string;
  theme: 'light' | 'dark' | 'system';
}

// WebSockets Signaling payloads
export type SignalingType =
  | 'auth'
  | 'presence'
  | 'typing'
  | 'message:send'
  | 'message:new'
  | 'message:read'
  | 'message:status'
  | 'call:invite'
  | 'call:ringing'
  | 'call:accept'
  | 'call:reject'
  | 'call:busy'
  | 'call:cancel'
  | 'call:timeout'
  | 'call:end'
  | 'webrtc:offer'
  | 'webrtc:answer'
  | 'webrtc:ice-candidate'
  | 'webrtc:restart-ice';

export interface SignalingMessage {
  type: SignalingType;
  senderId: string;
  targetId?: string;
  chatId?: string;
  callId?: string;
  payload?: any;
}
