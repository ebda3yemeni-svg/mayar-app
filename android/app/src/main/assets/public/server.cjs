var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_ws = require("ws");
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
var server = import_http.default.createServer(app);
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
var UPLOADS_DIR = import_path.default.join(process.cwd(), "uploads");
var DATA_DIR = import_path.default.join(process.cwd(), "data");
if (!import_fs.default.existsSync(UPLOADS_DIR)) import_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!import_fs.default.existsSync(DATA_DIR)) import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
app.use("/uploads", import_express.default.static(UPLOADS_DIR));
var DB_FILE = import_path.default.join(DATA_DIR, "db.json");
var defaultDB = {
  users: {},
  chats: {},
  messages: {},
  calls: []
};
import_fs.default.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
function loadDB() {
  try {
    if (import_fs.default.existsSync(DB_FILE)) {
      const raw = import_fs.default.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading DB file, fallback to default:", e);
  }
  return defaultDB;
}
function saveDB(data) {
  try {
    import_fs.default.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving DB:", e);
  }
}
var db = loadDB();
app.post("/api/auth/request-otp", (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0637\u0644\u0648\u0628" });
  }
  return res.json({
    success: true,
    message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0628\u0646\u062C\u0627\u062D",
    demoCode: "123456"
  });
});
app.post("/api/auth/verify-otp", (req, res) => {
  const { phone, code } = req.body;
  if (code !== "123456" && code !== "000000") {
    return res.status(400).json({ success: false, error: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D (\u0631\u0645\u0632 \u0627\u0644\u062A\u062C\u0631\u0628\u0629: 123456)" });
  }
  let existing = Object.values(db.users).find((u) => u.phone === phone);
  if (!existing) {
    const newId = `user-${Date.now()}`;
    existing = {
      id: newId,
      phone,
      name: `\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u064A\u0627\u0631 (${phone.slice(-4)})`,
      username: `user_${phone.slice(-4)}`,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${newId}`,
      bio: "\u0639\u0636\u0648 \u062C\u062F\u064A\u062F \u0641\u064A \u062A\u0637\u0628\u064A\u0642 \u0645\u064A\u0627\u0631 \u{1F31F}",
      status: "online",
      lastSeen: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.users[newId] = existing;
    saveDB(db);
  }
  return res.json({
    success: true,
    user: existing,
    token: `token_${existing.id}_${Date.now()}`
  });
});
app.get("/api/users", (req, res) => {
  const currentUserId = req.query.currentUserId;
  const usersList = Object.values(db.users).filter((u) => u.id !== currentUserId);
  res.json(usersList);
});
app.put("/api/users/profile", (req, res) => {
  const { userId, name, username, bio, avatar, status } = req.body;
  if (!userId || !db.users[userId]) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  db.users[userId] = {
    ...db.users[userId],
    ...name && { name },
    ...username && { username },
    ...bio !== void 0 && { bio },
    ...avatar && { avatar },
    ...status && { status }
  };
  saveDB(db);
  res.json(db.users[userId]);
});
app.get("/api/chats", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json([]);
  const userChats = Object.values(db.chats).filter((c) => c.members.includes(userId));
  res.json(userChats);
});
app.post("/api/chats/direct", (req, res) => {
  const { currentUserId, targetUserId } = req.body;
  if (!currentUserId || !targetUserId) return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0627\u0642\u0635\u0629" });
  let existing = Object.values(db.chats).find(
    (c) => !c.isGroup && c.members.includes(currentUserId) && c.members.includes(targetUserId)
  );
  if (!existing) {
    const targetUser = db.users[targetUserId];
    const chatId = `chat-direct-${Date.now()}`;
    existing = {
      id: chatId,
      isGroup: false,
      name: targetUser ? targetUser.name : "\u0645\u062D\u0627\u062F\u062B\u0629",
      avatar: targetUser ? targetUser.avatar : "",
      members: [currentUserId, targetUserId],
      unreadCount: { [currentUserId]: 0, [targetUserId]: 0 },
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.chats[chatId] = existing;
    db.messages[chatId] = [];
    saveDB(db);
  }
  res.json(existing);
});
app.post("/api/chats/group", (req, res) => {
  const { createdBy, name, members, description } = req.body;
  if (!name || !members || !Array.isArray(members)) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0648\u0627\u0644\u0623\u0639\u0636\u0627\u0621 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const allMembers = Array.from(/* @__PURE__ */ new Set([createdBy, ...members]));
  const chatId = `chat-group-${Date.now()}`;
  const unreadCount = {};
  allMembers.forEach((m) => unreadCount[m] = 0);
  const newGroup = {
    id: chatId,
    isGroup: true,
    name,
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${chatId}`,
    description: description || "\u0645\u062C\u0645\u0648\u0639\u0629 \u062C\u062F\u064A\u062F\u0629 \u0641\u064A \u0645\u064A\u0627\u0631",
    members: allMembers,
    admins: [createdBy],
    unreadCount,
    createdBy,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.chats[chatId] = newGroup;
  db.messages[chatId] = [];
  saveDB(db);
  res.json(newGroup);
});
app.get("/api/messages", (req, res) => {
  const chatId = req.query.chatId;
  if (!chatId) return res.json([]);
  res.json(db.messages[chatId] || []);
});
app.post("/api/messages", (req, res) => {
  const { chatId, senderId, text, type = "text", mediaUrl, duration, fileName, fileSize, replyToMessageId } = req.body;
  if (!chatId || !senderId) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0627\u0642\u0635\u0629" });
  }
  const sender = db.users[senderId];
  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    chatId,
    senderId,
    senderName: sender ? sender.name : "\u0645\u0633\u062A\u062E\u062F\u0645",
    senderAvatar: sender ? sender.avatar : "",
    text: text || "",
    type,
    mediaUrl,
    duration,
    fileName,
    fileSize,
    replyToMessageId,
    status: "sent",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!db.messages[chatId]) db.messages[chatId] = [];
  db.messages[chatId].push(newMsg);
  if (db.chats[chatId]) {
    db.chats[chatId].lastMessage = newMsg;
    db.chats[chatId].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  saveDB(db);
  broadcastToChat(chatId, {
    type: "message:new",
    senderId,
    chatId,
    payload: newMsg
  });
  res.json(newMsg);
});
app.delete("/api/messages/:id", (req, res) => {
  const messageId = req.params.id;
  const { deleteForEveryone } = req.body;
  let foundChatId = "";
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
      const msgs = db.messages[foundChatId];
      if (db.chats[foundChatId]) {
        db.chats[foundChatId].lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : void 0;
      }
    }
    saveDB(db);
  }
  res.json({ success: true });
});
app.post("/api/upload", (req, res) => {
  const { fileName, fileData, fileType } = req.body;
  if (fileData) {
    const safeName = `${Date.now()}_${fileName || "attachment"}`;
    const filePath = import_path.default.join(UPLOADS_DIR, safeName);
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
    import_fs.default.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    const fileUrl = `/uploads/${safeName}`;
    return res.json({
      url: fileUrl,
      fileName: fileName || safeName,
      fileSize: `${(import_fs.default.statSync(filePath).size / 1024).toFixed(1)} KB`,
      type: fileType || "file"
    });
  }
  return res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0645\u0644\u0641" });
});
app.get("/api/calls", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json(db.calls);
  const userCalls = db.calls.filter((c) => c.callerId === userId || c.receiverId === userId);
  res.json(userCalls);
});
app.get("/api/webrtc/config", (req, res) => {
  res.json({
    stunServer: process.env.STUN_SERVER_URL || "stun:stun.l.google.com:19302",
    turnServer: process.env.TURN_SERVER_URL || "turn:turn.mayar.app:3478",
    turnUsername: process.env.TURN_USERNAME || "mayar_user",
    turnCredential: process.env.TURN_CREDENTIAL || "mayar_secret_key"
  });
});
var wss = new import_ws.WebSocketServer({ noServer: true });
var activeSockets = /* @__PURE__ */ new Map();
wss.on("connection", (ws, req) => {
  let authenticatedUserId = null;
  const urlParams = new URLSearchParams(req.url?.split("?")[1] || "");
  const userIdParam = urlParams.get("userId");
  if (userIdParam) {
    authenticatedUserId = userIdParam;
    activeSockets.set(userIdParam, ws);
    if (db.users[userIdParam]) {
      db.users[userIdParam].status = "online";
      db.users[userIdParam].lastSeen = (/* @__PURE__ */ new Date()).toISOString();
      saveDB(db);
      broadcastPresence(userIdParam, "online");
    }
  }
  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, senderId, targetId, chatId, callId, payload } = data;
      if (type === "auth" && senderId) {
        authenticatedUserId = senderId;
        activeSockets.set(senderId, ws);
        if (db.users[senderId]) {
          db.users[senderId].status = "online";
          saveDB(db);
          broadcastPresence(senderId, "online");
        }
      }
      if (targetId) {
        const targetSocket = activeSockets.get(targetId);
        if (targetSocket && targetSocket.readyState === import_ws.WebSocket.OPEN) {
          targetSocket.send(JSON.stringify(data));
        }
      } else if (chatId) {
        broadcastToChat(chatId, data, senderId);
      }
      if (type === "call:end" || type === "call:reject") {
        if (payload && payload.call) {
          db.calls.unshift(payload.call);
          saveDB(db);
        }
      }
    } catch (err) {
      console.warn("WS Message error:", err);
    }
  });
  ws.on("close", () => {
    if (authenticatedUserId) {
      activeSockets.delete(authenticatedUserId);
      if (db.users[authenticatedUserId]) {
        db.users[authenticatedUserId].status = "offline";
        db.users[authenticatedUserId].lastSeen = (/* @__PURE__ */ new Date()).toISOString();
        saveDB(db);
        broadcastPresence(authenticatedUserId, "offline");
      }
    }
  });
});
function broadcastPresence(userId, status) {
  const payload = JSON.stringify({
    type: "presence",
    senderId: userId,
    payload: { status, lastSeen: (/* @__PURE__ */ new Date()).toISOString() }
  });
  activeSockets.forEach((client) => {
    if (client.readyState === import_ws.WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
function broadcastToChat(chatId, msg, excludeUserId) {
  const chat = db.chats[chatId];
  if (!chat) return;
  const jsonMsg = JSON.stringify(msg);
  chat.members.forEach((memberId) => {
    if (memberId !== excludeUserId) {
      const socket = activeSockets.get(memberId);
      if (socket && socket.readyState === import_ws.WebSocket.OPEN) {
        socket.send(jsonMsg);
      }
    }
  });
}
server.on("upgrade", (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Mayar Full-Stack Arabic Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
