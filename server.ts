import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;
const server = http.createServer(app);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload & data directories exist
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use('/uploads', express.static(UPLOADS_DIR));

// Seed default Arabic contacts & demo users
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDB {
  users: Record<string, any>;
  chats: Record<string, any>;
  messages: Record<string, any[]>;
  calls: any[];
}

const defaultDB: LocalDB = {
  users: {},
  chats: {},
  messages: {},
  calls: [],
};

// Always write clean empty DB state on startup
fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));

function loadDB(): LocalDB {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading DB file, fallback to default:', e);
  }
  return defaultDB;
}

function saveDB(data: LocalDB) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving DB:', e);
  }
}

const db = loadDB();

// API ROUTES

// 1. Auth OTP Request
app.post('/api/auth/request-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'رقم الهاتف مطلوب' });
  }
  // Standard demo OTP
  return res.json({
    success: true,
    message: 'تم إرسال رمز التحقق بنجاح',
    demoCode: '123456',
  });
});

// 2. Auth OTP Verify
app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, code } = req.body;
  if (code !== '123456' && code !== '000000') {
    return res.status(400).json({ success: false, error: 'رمز التحقق غير صحيح (رمز التجربة: 123456)' });
  }

  // Find existing user or create new user
  let existing = Object.values(db.users).find((u) => u.phone === phone);
  if (!existing) {
    const newId = `user-${Date.now()}`;
    existing = {
      id: newId,
      phone,
      name: `مستخدم ميار (${phone.slice(-4)})`,
      username: `user_${phone.slice(-4)}`,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${newId}`,
      bio: 'عضو جديد في تطبيق ميار 🌟',
      status: 'online',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.users[newId] = existing;
    saveDB(db);
  }

  return res.json({
    success: true,
    user: existing,
    token: `token_${existing.id}_${Date.now()}`,
  });
});

// 3. Get All Contacts/Users
app.get('/api/users', (req, res) => {
  const currentUserId = req.query.currentUserId as string;
  const usersList = Object.values(db.users).filter((u) => u.id !== currentUserId);
  res.json(usersList);
});

// 4. Update Profile
app.put('/api/users/profile', (req, res) => {
  const { userId, name, username, bio, avatar, status } = req.body;
  if (!userId || !db.users[userId]) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  db.users[userId] = {
    ...db.users[userId],
    ...(name && { name }),
    ...(username && { username }),
    ...(bio !== undefined && { bio }),
    ...(avatar && { avatar }),
    ...(status && { status }),
  };

  saveDB(db);
  res.json(db.users[userId]);
});

// 5. Get User Chats
app.get('/api/chats', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.json([]);

  const userChats = Object.values(db.chats).filter((c) => c.members.includes(userId));
  res.json(userChats);
});

// 6. Create or Get Direct Chat
app.post('/api/chats/direct', (req, res) => {
  const { currentUserId, targetUserId } = req.body;
  if (!currentUserId || !targetUserId) return res.status(400).json({ error: 'بيانات ناقصة' });

  // Check existing direct chat
  let existing = Object.values(db.chats).find(
    (c) => !c.isGroup && c.members.includes(currentUserId) && c.members.includes(targetUserId)
  );

  if (!existing) {
    const targetUser = db.users[targetUserId];
    const chatId = `chat-direct-${Date.now()}`;
    existing = {
      id: chatId,
      isGroup: false,
      name: targetUser ? targetUser.name : 'محادثة',
      avatar: targetUser ? targetUser.avatar : '',
      members: [currentUserId, targetUserId],
      unreadCount: { [currentUserId]: 0, [targetUserId]: 0 },
      updatedAt: new Date().toISOString(),
    };
    db.chats[chatId] = existing;
    db.messages[chatId] = [];
    saveDB(db);
  }

  res.json(existing);
});

// 7. Create Group Chat
app.post('/api/chats/group', (req, res) => {
  const { createdBy, name, members, description } = req.body;
  if (!name || !members || !Array.isArray(members)) {
    return res.status(400).json({ error: 'اسم المجموعة والأعضاء مطلوبان' });
  }

  const allMembers = Array.from(new Set([createdBy, ...members]));
  const chatId = `chat-group-${Date.now()}`;
  const unreadCount: Record<string, number> = {};
  allMembers.forEach((m) => (unreadCount[m] = 0));

  const newGroup = {
    id: chatId,
    isGroup: true,
    name,
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${chatId}`,
    description: description || 'مجموعة جديدة في ميار',
    members: allMembers,
    admins: [createdBy],
    unreadCount,
    createdBy,
    updatedAt: new Date().toISOString(),
  };

  db.chats[chatId] = newGroup;
  db.messages[chatId] = [];
  saveDB(db);

  res.json(newGroup);
});

// 8. Get Messages for Chat
app.get('/api/messages', (req, res) => {
  const chatId = req.query.chatId as string;
  if (!chatId) return res.json([]);
  res.json(db.messages[chatId] || []);
});

// 9. Post Message
app.post('/api/messages', (req, res) => {
  const { chatId, senderId, text, type = 'text', mediaUrl, duration, fileName, fileSize, replyToMessageId } = req.body;

  if (!chatId || !senderId) {
    return res.status(400).json({ error: 'بيانات ناقصة' });
  }

  const sender = db.users[senderId];
  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    chatId,
    senderId,
    senderName: sender ? sender.name : 'مستخدم',
    senderAvatar: sender ? sender.avatar : '',
    text: text || '',
    type,
    mediaUrl,
    duration,
    fileName,
    fileSize,
    replyToMessageId,
    status: 'sent',
    timestamp: new Date().toISOString(),
  };

  if (!db.messages[chatId]) db.messages[chatId] = [];
  db.messages[chatId].push(newMsg);

  // Update chat lastMessage
  if (db.chats[chatId]) {
    db.chats[chatId].lastMessage = newMsg;
    db.chats[chatId].updatedAt = new Date().toISOString();
  }

  saveDB(db);

  // Broadcast over WS
  broadcastToChat(chatId, {
    type: 'message:new',
    senderId,
    chatId,
    payload: newMsg,
  });

  res.json(newMsg);
});

// 10. Delete Message
app.delete('/api/messages/:id', (req, res) => {
  const messageId = req.params.id;
  const { deleteForEveryone } = req.body;

  let foundChatId = '';
  let foundIndex = -1;

  for (const chatId in db.messages) {
    const idx = db.messages[chatId].findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      foundChatId = chatId;
      foundIndex = idx;
      break;
    }
  }

  if (foundChatId && foundIndex !== -1) {
    if (deleteForEveryone) {
      db.messages[foundChatId].splice(foundIndex, 1);
      // update last message if needed
      const msgs = db.messages[foundChatId];
      if (db.chats[foundChatId]) {
        db.chats[foundChatId].lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
      }
    }
    saveDB(db);
  }

  res.json({ success: true });
});

// 11. File / Voice / Media Upload
app.post('/api/upload', (req, res) => {
  // Simple Base64 or standard file upload payload support
  const { fileName, fileData, fileType } = req.body;

  if (fileData) {
    const safeName = `${Date.now()}_${fileName || 'attachment'}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    const fileUrl = `/uploads/${safeName}`;
    return res.json({
      url: fileUrl,
      fileName: fileName || safeName,
      fileSize: `${(fs.statSync(filePath).size / 1024).toFixed(1)} KB`,
      type: fileType || 'file',
    });
  }

  return res.status(400).json({ error: 'لم يتم إرسال ملف' });
});

// 12. Call History
app.get('/api/calls', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.json(db.calls);
  const userCalls = db.calls.filter((c) => c.callerId === userId || c.receiverId === userId);
  res.json(userCalls);
});

app.post('/api/calls', (req, res) => {
  const newCall = req.body;
  if (newCall && newCall.id) {
    // Replace existing call record or unshift
    const idx = db.calls.findIndex((c) => c.id === newCall.id);
    if (idx !== -1) {
      db.calls[idx] = newCall;
    } else {
      db.calls.unshift(newCall);
    }
    saveDB(db);
  }
  res.json({ success: true, call: newCall });
});

// 13. WebRTC Configuration
app.get('/api/webrtc/config', (req, res) => {
  res.json({
    stunServer: process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302',
    turnServer: process.env.TURN_SERVER_URL || 'turn:turn.mayar.app:3478',
    turnUsername: process.env.TURN_USERNAME || 'mayar_user',
    turnCredential: process.env.TURN_CREDENTIAL || 'mayar_secret_key',
  });
});

// WEBSOCKET SIGNALING SERVER
const wss = new WebSocketServer({ noServer: true });
const activeSockets: Map<string, WebSocket> = new Map();

wss.on('connection', (ws: WebSocket, req) => {
  let authenticatedUserId: string | null = null;

  // Extract userId from query string if present
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const userIdParam = urlParams.get('userId');
  if (userIdParam) {
    authenticatedUserId = userIdParam;
    activeSockets.set(userIdParam, ws);
    // Update presence status
    if (db.users[userIdParam]) {
      db.users[userIdParam].status = 'online';
      db.users[userIdParam].lastSeen = new Date().toISOString();
      saveDB(db);
      broadcastPresence(userIdParam, 'online');
    }
  }

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, senderId, targetId, chatId, callId, payload } = data;

      if (type === 'auth' && senderId) {
        authenticatedUserId = senderId;
        activeSockets.set(senderId, ws);
        if (db.users[senderId]) {
          db.users[senderId].status = 'online';
          saveDB(db);
          broadcastPresence(senderId, 'online');
        }
      }

      // Route signaling messages
      if (targetId) {
        const targetSocket = activeSockets.get(targetId);
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(JSON.stringify(data));
        }
      } else if (chatId) {
        broadcastToChat(chatId, data, senderId);
      }

      // If call state event, record to call history DB
      if (['call:end', 'call:reject', 'call:busy', 'call:cancel', 'call:timeout'].includes(type)) {
        if (payload && payload.call) {
          const callObj = payload.call;
          const idx = db.calls.findIndex((c) => c.id === callObj.id);
          if (idx !== -1) {
            db.calls[idx] = callObj;
          } else {
            db.calls.unshift(callObj);
          }
          saveDB(db);
        }
      }
    } catch (err) {
      console.warn('WS Message error:', err);
    }
  });

  ws.on('close', () => {
    if (authenticatedUserId) {
      activeSockets.delete(authenticatedUserId);
      if (db.users[authenticatedUserId]) {
        db.users[authenticatedUserId].status = 'offline';
        db.users[authenticatedUserId].lastSeen = new Date().toISOString();
        saveDB(db);
        broadcastPresence(authenticatedUserId, 'offline');
      }
    }
  });
});

function broadcastPresence(userId: string, status: 'online' | 'offline') {
  const payload = JSON.stringify({
    type: 'presence',
    senderId: userId,
    payload: { status, lastSeen: new Date().toISOString() },
  });
  activeSockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastToChat(chatId: string, msg: any, excludeUserId?: string) {
  const chat = db.chats[chatId];
  if (!chat) return;

  const jsonMsg = JSON.stringify(msg);
  chat.members.forEach((memberId: string) => {
    if (memberId !== excludeUserId) {
      const socket = activeSockets.get(memberId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(jsonMsg);
      }
    }
  });
}

// Upgrade HTTP connection for WebSockets
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// VITE MIDDLEWARE SETUP
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Mayar Full-Stack Arabic Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
