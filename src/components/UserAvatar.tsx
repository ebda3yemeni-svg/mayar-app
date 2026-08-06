import React, { useState } from 'react';

interface UserAvatarProps {
  user?: { name?: string; username?: string; avatar?: string };
  name?: string;
  avatar?: string;
  size?: string;
  textSize?: string;
  className?: string;
  showStatus?: boolean;
  status?: 'online' | 'offline';
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  name,
  avatar,
  size = 'w-11 h-11',
  textSize = 'text-sm',
  className = '',
  showStatus = false,
  status,
}) => {
  const [imgError, setImgError] = useState(false);

  const displayName = user?.name || name || user?.username || 'م';
  const displayAvatar = user?.avatar !== undefined ? user.avatar : avatar;

  const initial = displayName.trim().charAt(0).toUpperCase();
  const hasAvatar = displayAvatar && displayAvatar.trim() !== '' && !imgError;

  return (
    <div className={`relative flex-shrink-0 ${size} ${className}`}>
      {hasAvatar ? (
        <img
          src={displayAvatar}
          alt={displayName}
          onError={() => setImgError(true)}
          className={`${size} rounded-full object-cover border border-slate-700 shadow-sm`}
        />
      ) : (
        <div
          className={`${size} rounded-full bg-gradient-to-tr from-emerald-800 to-teal-600 flex items-center justify-center text-white font-extrabold ${textSize} border border-emerald-500/30 shadow-inner select-none`}
        >
          {initial}
        </div>
      )}
      {showStatus && status === 'online' && (
        <span className="absolute bottom-0 left-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 shadow"></span>
      )}
    </div>
  );
};
