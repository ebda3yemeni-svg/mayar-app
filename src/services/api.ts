import { User, Chat, Message, Call } from '../types';

const API_BASE = '/api';

export const apiService = {
  // Auth OTP
  async requestOtp(phone: string): Promise<{ success: boolean; message: string; demoCode: string }> {
    const res = await fetch(`${API_BASE}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return res.json();
  },

  async verifyOtp(phone: string, code: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    return res.json();
  },

  // Users
  async getUsers(currentUserId: string): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users?currentUserId=${encodeURIComponent(currentUserId)}`);
    return res.json();
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const res = await fetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...updates }),
    });
    return res.json();
  },

  // Chats
  async getChats(userId: string): Promise<Chat[]> {
    const res = await fetch(`${API_BASE}/chats?userId=${encodeURIComponent(userId)}`);
    return res.json();
  },

  async createDirectChat(currentUserId: string, targetUserId: string): Promise<Chat> {
    const res = await fetch(`${API_BASE}/chats/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentUserId, targetUserId }),
    });
    return res.json();
  },

  async createGroup(createdBy: string, name: string, members: string[], description?: string): Promise<Chat> {
    const res = await fetch(`${API_BASE}/chats/group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createdBy, name, members, description }),
    });
    return res.json();
  },

  // Messages
  async getMessages(chatId: string): Promise<Message[]> {
    const res = await fetch(`${API_BASE}/messages?chatId=${encodeURIComponent(chatId)}`);
    return res.json();
  },

  async postMessage(message: Partial<Message>): Promise<Message> {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return res.json();
  },

  async deleteMessage(messageId: string, deleteForEveryone: boolean): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteForEveryone }),
    });
    return res.json();
  },

  // Media & File Upload
  async uploadFile(file: File): Promise<{ url: string; fileName: string; fileSize: string; type: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  // Calls
  async getCalls(userId: string): Promise<Call[]> {
    const res = await fetch(`${API_BASE}/calls?userId=${encodeURIComponent(userId)}`);
    return res.json();
  },

  async saveCallLog(call: Call): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(call),
    });
    return res.json();
  },
};
