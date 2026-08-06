import React, { useEffect, useRef, useState } from 'react';
import { User, CallType } from '../types';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  Volume2,
  VolumeX,
  Wifi,
  ShieldCheck,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from 'lucide-react';
import { t, formatCallDuration } from '../i18n';
import { WebRTCManager } from '../services/webrtc';

interface CallScreenProps {
  callType: CallType;
  targetUser: User;
  isIncoming: boolean;
  webrtcManager: WebRTCManager;
  onEndCall: () => void;
}

export const CallScreen: React.FC<CallScreenProps> = ({
  callType,
  targetUser,
  isIncoming,
  webrtcManager,
  onEndCall,
}) => {
  const [duration, setDuration] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('connected');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    // 1. Request Screen Wake Lock so screen doesn't turn off during calls
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock
        .request('screen')
        .then((lock: any) => {
          wakeLockRef.current = lock;
        })
        .catch((err: any) => console.warn('Wake Lock error:', err));
    }

    // 2. Setup video/audio elements when streams are ready
    const localStream = webrtcManager.getLocalStream();
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }

    const remoteStream = webrtcManager.getRemoteStream();
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }

    // 3. Call duration timer
    timerRef.current = window.setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  const handleToggleAudio = () => {
    const muted = webrtcManager.toggleAudio();
    setIsAudioMuted(muted);
  };

  const handleToggleVideo = () => {
    const muted = webrtcManager.toggleVideo();
    setIsVideoMuted(muted);
  };

  const handleSwitchCamera = async () => {
    const stream = await webrtcManager.switchCamera(callType);
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  };

  const handleToggleSpeaker = () => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = next ? 1.0 : 0.3;
      }
      return next;
    });
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 select-none animate-fade-in"
    >
      {/* Remote Audio Element for voice call sound output */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Connection Recovery Banner */}
      {(connectionState === 'reconnecting' || connectionState === 'disconnected') && (
        <div className="absolute top-2 inset-x-4 z-30 bg-amber-600/90 text-white py-2 px-4 rounded-xl backdrop-blur-md flex items-center justify-center gap-2 text-xs font-bold animate-pulse shadow-xl">
          <AlertTriangle className="w-4 h-4" />
          <span>جاري إعادة الاتصال بالشبكة... يرجى الانتظار</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <img
            src={targetUser.avatar}
            alt={targetUser.name}
            className="w-10 h-10 rounded-full object-cover border border-emerald-500/50"
          />
          <div>
            <h3 className="font-bold text-base">{targetUser.name}</h3>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {callType === 'video' ? t('videoCall') : t('voiceCall')} - {t('callConnected')}
            </p>
          </div>
        </div>

        {/* Controls: Fullscreen, Timer, Security */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1 text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-800">
            <Wifi className="w-3.5 h-3.5" />
            <span>{formatCallDuration(duration)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-slate-400 bg-slate-800 px-2.5 py-1 rounded-xl">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>مشفر WebRTC</span>
          </div>

          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="ملء الشاشة"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Display Canvas / Stream Area */}
      <div className="relative flex-1 my-4 bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
        {callType === 'video' ? (
          <>
            {/* Remote Main Video Stream */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Local Preview PIP (Picture-in-Picture) */}
            <div className="absolute top-4 left-4 w-28 h-40 sm:w-36 sm:h-52 bg-slate-950 rounded-2xl overflow-hidden border-2 border-emerald-500/60 shadow-2xl z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
              <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 px-1.5 py-0.5 rounded text-white">
                أنت
              </span>
            </div>
          </>
        ) : (
          /* Voice Call Avatar Animation */
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              {/* Pulsing Ripple Rings */}
              <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping"></div>
              <div className="absolute -inset-8 rounded-full bg-emerald-500/10 animate-pulse"></div>

              <img
                src={targetUser.avatar}
                alt={targetUser.name}
                className="w-32 h-32 sm:w-44 sm:h-44 rounded-full object-cover border-4 border-emerald-500 shadow-2xl relative z-10"
              />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{targetUser.name}</h2>
              <p className="text-emerald-400 font-mono text-lg font-bold">
                {formatCallDuration(duration)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl border border-slate-800 max-w-xl mx-auto w-full flex items-center justify-around z-20 shadow-2xl">
        {/* Mute Mic */}
        <button
          onClick={handleToggleAudio}
          className={`p-4 rounded-2xl transition shadow-lg ${
            isAudioMuted ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title={isAudioMuted ? t('unmuteMic') : t('muteMic')}
        >
          {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Video Toggle (if video call) */}
        {callType === 'video' && (
          <>
            <button
              onClick={handleToggleVideo}
              className={`p-4 rounded-2xl transition shadow-lg ${
                isVideoMuted ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title={t('toggleCamera')}
            >
              {isVideoMuted ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>

            <button
              onClick={handleSwitchCamera}
              className="p-4 rounded-2xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition shadow-lg"
              title={t('switchCamera')}
            >
              <SwitchCamera className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Speaker Toggle */}
        <button
          onClick={handleToggleSpeaker}
          className={`p-4 rounded-2xl transition shadow-lg ${
            isSpeakerOn ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title={t('speaker')}
        >
          {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
        </button>

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          className="p-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-xl hover:scale-105"
          title={t('endCall')}
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
