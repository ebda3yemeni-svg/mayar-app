import React, { useEffect } from 'react';
import { User, CallType } from '../types';
import { Phone, Video, PhoneOff, PhoneCall } from 'lucide-react';
import { t } from '../i18n';
import { soundSynth } from '../services/audioSynthesizer';

interface IncomingCallModalProps {
  caller: {
    id: string;
    name: string;
    avatar: string;
  };
  callType: CallType;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  caller,
  callType,
  onAccept,
  onReject,
}) => {
  useEffect(() => {
    soundSynth.startIncomingRingtone();
    return () => {
      soundSynth.stopRingtone();
    };
  }, []);

  const handleAcceptClick = () => {
    soundSynth.stopRingtone();
    onAccept();
  };

  const handleRejectClick = () => {
    soundSynth.stopRingtone();
    onReject();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse"></div>

        {/* Pulse Avatar Container */}
        <div className="relative mx-auto w-28 h-28 my-4">
          <div className="absolute -inset-3 rounded-full bg-emerald-500/30 animate-ping"></div>
          <div className="absolute -inset-6 rounded-full bg-emerald-500/15 animate-pulse"></div>
          <img
            src={caller.avatar}
            alt={caller.name}
            className="w-28 h-28 rounded-full object-cover border-4 border-emerald-400 shadow-xl relative z-10"
          />
        </div>

        {/* Caller Info & Label */}
        <h3 className="text-xl font-bold text-white mb-1">{caller.name}</h3>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold mb-6">
          {callType === 'video' ? (
            <>
              <Video className="w-4 h-4 text-emerald-400" />
              <span>{t('incomingVideoCall')}</span>
            </>
          ) : (
            <>
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>{t('incomingVoiceCall')}</span>
            </>
          )}
        </div>

        {/* Accept & Reject Action Buttons */}
        <div className="flex items-center justify-center gap-6 mt-2">
          {/* Reject */}
          <button
            onClick={handleRejectClick}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-14 h-14 rounded-full bg-red-600 group-hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition transform group-hover:scale-110">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-red-400">{t('reject')}</span>
          </button>

          {/* Accept */}
          <button
            onClick={handleAcceptClick}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-500 group-hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg transition transform group-hover:scale-110 animate-bounce">
              <Phone className="w-6 h-6 fill-slate-950" />
            </div>
            <span className="text-xs font-bold text-emerald-400">{t('accept')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
