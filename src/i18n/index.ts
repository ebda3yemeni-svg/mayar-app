import { arTranslations, TranslationKeys } from './ar';

export function t(key: TranslationKeys, params?: Record<string, string | number>): string {
  let str = arTranslations[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return str;
}

export function formatArabicTime(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffHours < 24) {
      return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  } catch {
    return isoDateString;
  }
}

export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatLastSeenArabic(isoDateString: string): string {
  if (!isoDateString) return 'آخر ظهور قريبًا';
  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return 'آخر ظهور قريبًا';

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `آخر ظهور اليوم عند ${timeStr}`;
    }
    if (isYesterday) {
      return `آخر ظهور الأمس عند ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    return `آخر ظهور ${dateStr} عند ${timeStr}`;
  } catch {
    return 'آخر ظهور قريبًا';
  }
}
