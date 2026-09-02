import { t as translateT } from "@/i18n";

/**
 * Format a timestamp as a localized relative time string
 * ("just now", "5 minutes ago", ...). Shared by the workflow browser
 * and the welcome screen's recent-files list.
 */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return translateT("time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return translateT("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translateT("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return translateT("time.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  return translateT("time.monthsAgo", { count: months });
}
