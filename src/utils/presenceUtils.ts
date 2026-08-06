import { User } from '../types';
import { formatLastSeenArabic } from '../i18n';

/**
 * Checks if the viewer can see the user's Last Seen timestamp based on privacy settings.
 */
export function canSeeLastSeen(
  user?: User | null,
  viewerUserId?: string,
  isContact = true
): boolean {
  if (!user) return false;
  if (viewerUserId && user.id === viewerUserId) return true;

  const vis = user.privacySettings?.lastSeenVisibility || 'everyone';
  if (vis === 'nobody') return false;
  if (vis === 'contacts') return Boolean(isContact);
  return true;
}

/**
 * Checks if the viewer can see the user's Online status ("متصل الآن") based on privacy settings.
 */
export function canSeeOnlineStatus(
  user?: User | null,
  viewerUserId?: string,
  isContact = true
): boolean {
  if (!user) return false;
  if (viewerUserId && user.id === viewerUserId) return true;

  const vis = user.privacySettings?.onlineStatusVisibility || 'everyone';
  if (vis === 'same_as_last_seen') {
    return canSeeLastSeen(user, viewerUserId, isContact);
  }
  return true;
}

/**
 * Gets the profile picture URL to display for a user based on privacy settings.
 * Returns empty string if profile photo is hidden or not set.
 */
export function getDisplayAvatar(
  user?: User | null,
  viewerUserId?: string,
  isContact = true
): string {
  if (!user) return '';
  if (viewerUserId && user.id === viewerUserId) return user.avatar || '';

  const vis = user.privacySettings?.profilePhotoVisibility || 'everyone';
  if (vis === 'nobody') return '';
  if (vis === 'contacts' && !isContact) return '';
  return user.avatar || '';
}

/**
 * Formats user presence (online status / last seen string) respecting privacy settings.
 */
export function getFormattedPresenceText(
  user?: User | null,
  viewerUserId?: string,
  isContact = true
): string {
  if (!user) return '';

  const isOnline = user.status === 'online' || user.onlineStatus === 'online';

  if (isOnline) {
    if (canSeeOnlineStatus(user, viewerUserId, isContact)) {
      return 'متصل الآن';
    }
    // Online status is hidden; fallback to last seen if allowed
    if (canSeeLastSeen(user, viewerUserId, isContact)) {
      return formatLastSeenArabic(user.lastSeen);
    }
    return '';
  }

  // User is offline
  if (canSeeLastSeen(user, viewerUserId, isContact)) {
    return formatLastSeenArabic(user.lastSeen);
  }

  return '';
}
