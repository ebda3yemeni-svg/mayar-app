import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { App, URLOpenListenerEvent } from '@capacitor/app';

export interface NativeCallData {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
}

class NativeService {
  private isNative: boolean;
  private fcmToken: string | null = null;
  private currentAppState: 'foreground' | 'background' | 'terminated' = 'foreground';

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    if (this.isNative) {
      this.initAppStateListeners();
    }
  }

  public isNativeDevice(): boolean {
    return this.isNative;
  }

  public getAppState(): 'foreground' | 'background' | 'terminated' {
    return this.currentAppState;
  }

  private initAppStateListeners() {
    App.addListener('appStateChange', ({ isActive }) => {
      this.currentAppState = isActive ? 'foreground' : 'background';
      console.log(`[Capacitor Native] App state changed to: ${this.currentAppState}`);
    });

    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      console.log('[Capacitor Native] App opened via URL/DeepLink:', event.url);
    });
  }

  public async initPushNotifications(
    onTokenReceived?: (token: string) => void,
    onIncomingCallReceived?: (callData: NativeCallData) => void,
    onNotificationTap?: (notification: ActionPerformed) => void
  ): Promise<void> {
    if (!this.isNative) {
      console.log('[Capacitor Native] Web environment detected - push notifications disabled.');
      return;
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[Capacitor Native] Push notification permission not granted.');
        return;
      }

      await PushNotifications.register();

      // Listeners for Push Registration
      await PushNotifications.addListener('registration', (token) => {
        console.log('[Capacitor FCM Token]:', token.value);
        this.fcmToken = token.value;
        if (onTokenReceived) {
          onTokenReceived(token.value);
        }
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[Capacitor FCM Registration Error]:', err.error);
      });

      // Listening for foreground/background push notifications
      await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[Capacitor Push Received]:', notification);
        const data = notification.data;
        if (data && (data.type === 'incoming_call' || data.callId)) {
          if (onIncomingCallReceived) {
            onIncomingCallReceived({
              callId: data.callId || `call-${Date.now()}`,
              callerId: data.callerId || 'unknown',
              callerName: data.callerName || notification.title || 'مكالمة واردة',
              callerAvatar: data.callerAvatar,
              callType: (data.callType as 'audio' | 'video') || 'audio',
            });
          }
        }
      });

      // Listening for notification actions (tapping notification when app in background/terminated)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('[Capacitor Push Action Performed]:', action);
        if (onNotificationTap) {
          onNotificationTap(action);
        }
      });
    } catch (err) {
      console.error('[Capacitor Native Init Error]:', err);
    }
  }

  public getFcmToken(): string | null {
    return this.fcmToken;
  }
}

export const nativeService = new NativeService();
