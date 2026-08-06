import React, { useEffect } from 'react';
import { User, CallType } from '../types';
import { PhoneOff, Video, PhoneCall } from 'lucide-react';
import { t } from '../i18n';
import { soundSynth } from '../services/audioSynthesizer';

interface OutgoingCallModalProps {
  targetUser: User;
  callType: CallType;
  onCancel: () => void;
}

export const OutgoingCallModal: React.FC<OutgoingCallModalProps> = ({
  targetUser,
  callType,
  onCancel,
}) => {
  useEffect(() => {
    soundSynth.startOutgoingRing();
    return () => {
      soundSynth.stopRingtone();
    };
  }, []);

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
            src={targetUser.avatar}
            alt={targetUser.name}
            className="w-28 h-28 rounded-full object-cover border-4 border-emerald-400 shadow-xl relative z-10"
          />
        </div>

        {/* Target Info & Status Label */}
        <h3 className="text-xl font-bold text-white mb-1">{targetUser.name}</h3>
        <p className="text-xs text-slate-400 mb-2">@{targetUser.username}</p>

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold mb-8">
          {callType === 'video' ? (
            <Video className="w-4 h-4 text-emerald-400 animate-pulse" />
          ) : (
            <PhoneCall className="w-4 h-4 text-emerald-400 animate-pulse" />
          )}
          <span>جاري الرنين...</span>
        </div>

        {/* Cancel Action Button */}
        <div className="flex flex-col items-center justify-center">
          <button
            onClick={onCancel}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-700 text-white flex items-center justify-center shadow-2xl transition transform group-hover:scale-110">
              <PhoneOff className="w-7 h-7" />
            </div>
            <span className="text-xs font-bold text-red-400 mt-1">إلغاء المكالمة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
