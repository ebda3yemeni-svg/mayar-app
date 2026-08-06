import React, { useState } from 'react';
import { Call, User } from '../types';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Phone } from 'lucide-react';
import { t, formatArabicTime, formatCallDuration } from '../i18n';

interface CallHistoryListProps {
  calls: Call[];
  currentUser: User;
  onRedial: (call: Call) => void;
}

export const CallHistoryList: React.FC<CallHistoryListProps> = ({
  calls,
  currentUser,
  onRedial,
}) => {
  const [filter, setFilter] = useState<'all' | 'missed'>('all');

  const filteredCalls = calls.filter((c) => {
    if (filter === 'missed') {
      return c.status === 'missed';
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      {/* Header & Filter Tabs */}
      <div className="p-3 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-200">{t('callHistory')}</h3>

        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              filter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('allCalls')}
          </button>
          <button
            onClick={() => setFilter('missed')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              filter === 'missed'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('missedCallsOnly')}
          </button>
        </div>
      </div>

      {/* Calls List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
        {filteredCalls.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Phone className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-slate-300">{t('noCallsYet')}</p>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isOutgoing = call.callerId === currentUser.id;
            const otherName = isOutgoing ? call.receiverName : call.callerName;
            const otherAvatar = isOutgoing ? call.receiverAvatar : call.callerAvatar;

            return (
              <div
                key={call.id}
                className="flex items-center justify-between p-3 hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={otherAvatar}
                    alt={otherName}
                    className="w-11 h-11 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-white">{otherName}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      {call.status === 'missed' ? (
                        <span className="flex items-center gap-1 text-red-400 font-semibold">
                          <PhoneMissed className="w-3.5 h-3.5" />
                          {t('missedCall')}
                        </span>
                      ) : isOutgoing ? (
                        <span className="flex items-center gap-1 text-sky-400">
                          <PhoneOutgoing className="w-3.5 h-3.5" />
                          {t('outgoingCall')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <PhoneIncoming className="w-3.5 h-3.5" />
                          {t('incomingCall')}
                        </span>
                      )}
                      <span>•</span>
                      <span>{formatArabicTime(call.startedAt)}</span>
                      {call.durationSeconds ? (
                        <span>({formatCallDuration(call.durationSeconds)})</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Redial Action */}
                <button
                  onClick={() => onRedial(call)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-700 text-emerald-400 hover:text-white transition"
                  title={t('redial')}
                >
                  {call.callType === 'video' ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
