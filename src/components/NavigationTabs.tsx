import React from 'react';
import { MessageSquare, PhoneCall, Users, Settings } from 'lucide-react';
import { t } from '../i18n';

export type TabType = 'chats' | 'calls' | 'contacts' | 'settings';

interface NavigationTabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unreadChatsCount: number;
  missedCallsCount: number;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  setActiveTab,
  unreadChatsCount,
  missedCallsCount,
}) => {
  const tabs = [
    {
      id: 'chats' as TabType,
      label: t('chats'),
      icon: MessageSquare,
      badge: unreadChatsCount > 0 ? unreadChatsCount : null,
    },
    {
      id: 'calls' as TabType,
      label: t('calls'),
      icon: PhoneCall,
      badge: missedCallsCount > 0 ? missedCallsCount : null,
    },
    {
      id: 'contacts' as TabType,
      label: t('contacts'),
      icon: Users,
      badge: null,
    },
    {
      id: 'settings' as TabType,
      label: t('settings'),
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <div className="bg-emerald-900 border-t sm:border-t-0 sm:border-b border-emerald-800 text-white select-none">
      <div className="max-w-6xl mx-auto flex items-center justify-around sm:justify-start sm:gap-6 px-2 sm:px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold transition border-b-2 relative ${
                isActive
                  ? 'border-emerald-300 text-emerald-300 bg-white/5'
                  : 'border-transparent text-emerald-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span className="bg-red-500 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
