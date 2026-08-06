import { SignalingMessage } from '../types';

export type EventListener = (msg: SignalingMessage) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private currentUserId: string | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private isConnecting = false;
  private reconnectTimer: number | null = null;

  public connect(userId: string) {
    this.currentUserId = userId;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?userId=${encodeURIComponent(userId)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        console.log('Connected to Mayar WebSocket Signaling Server');
        this.send({
          type: 'auth',
          senderId: userId,
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const message: SignalingMessage = JSON.parse(event.data);
          this.emit(message.type, message);
          // Also emit to wildcards
          this.emit('*', message);
        } catch (err) {
          console.warn('Failed to parse WS message:', err);
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        console.warn('WebSocket connection closed. Retrying in 3s...');
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    } catch (e) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      if (this.currentUserId) {
        this.connect(this.currentUserId);
      }
    }, 3000);
  }

  public send(msg: SignalingMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      console.warn('Socket not open, buffering or ignoring message', msg.type);
    }
  }

  public on(type: string, listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.off(type, listener);
    };
  }

  public off(type: string, listener: EventListener) {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(listener);
    }
  }

  private emit(type: string, msg: SignalingMessage) {
    const set = this.listeners.get(type);
    if (set) {
      set.forEach((listener) => listener(msg));
    }
  }

  public disconnect() {
    this.currentUserId = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const wsService = new WebSocketService();
