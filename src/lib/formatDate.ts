/**
 * Global date/time formatting utilities
 * All dates in the app should use these formatters
 */

/**
 * Format a service date with day of week and time
 * Output: "Sunday, March 23 · 9:00 AM"
 */
export function formatServiceDate(date: Date | string, time?: string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  
  if (time) {
    // Parse time string (e.g., "09:00") and format it
    const [hours, minutes] = time.split(':').map(Number);
    const timeDate = new Date();
    timeDate.setHours(hours, minutes || 0);
    const timeStr = timeDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} · ${timeStr}`;
  }
  
  return dateStr;
}

/**
 * Format a relative date
 * Output: "2 weeks ago", "3 days ago", "Today", "Yesterday"
 */
export function formatRelativeDate(date: Date | string): string {
  // Handle ISO timestamps (contains T) vs date-only strings
  const d = typeof date === 'string' 
    ? new Date(date.includes('T') ? date : date + 'T00:00:00')
    : date;
  const now = new Date();
  
  // Reset to start of day for accurate comparison
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = nowStart.getTime() - dateStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  if (diffDays < 60) return '1 month ago';
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  
  const years = Math.floor(diffDays / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Format a short date
 * Output: "Mar 23"
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time only (no seconds)
 * Output: "9:00 AM"
 */
export function formatTime(time: string): string {
  if (!time) return '';
  
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes || 0);
  
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get time-based greeting
 * Output: "Good morning", "Good afternoon", "Good evening"
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Format full date with day of week
 * Output: "Monday, March 16"
 */
export function formatFullDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date for display in compact cards
 * Output: "Sun, Mar 23"
 */
export function formatCompactDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}