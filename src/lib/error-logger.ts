/**
 * Error Logger - Centralized error tracking for The Counting House
 */

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  source: string; // e.g., 'api', 'client', 'import'
  userId?: string;
  url?: string;
}

// In-memory store (in production, would use database)
const errorLogs: ErrorLogEntry[] = [];
const MAX_LOGS = 500;

export function logError(
  message: string,
  options: {
    level?: 'error' | 'warn' | 'info';
    error?: Error;
    context?: Record<string, unknown>;
    source?: string;
    userId?: string;
    url?: string;
  } = {}
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    level: options.level || 'error',
    message,
    stack: options.error?.stack,
    context: options.context,
    source: options.source || 'unknown',
    userId: options.userId,
    url: options.url,
  };

  errorLogs.unshift(entry);

  // Keep only last MAX_LOGS entries
  if (errorLogs.length > MAX_LOGS) {
    errorLogs.length = MAX_LOGS;
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${entry.level.toUpperCase()}] ${entry.source}: ${message}`, options.context || '');
  }

  return entry;
}

export function getErrorLogs(options?: {
  level?: 'error' | 'warn' | 'info';
  source?: string;
  limit?: number;
}): ErrorLogEntry[] {
  let logs = [...errorLogs];

  if (options?.level) {
    logs = logs.filter(l => l.level === options.level);
  }
  if (options?.source) {
    logs = logs.filter(l => l.source === options.source);
  }
  if (options?.limit) {
    logs = logs.slice(0, options.limit);
  }

  return logs;
}

export function clearErrorLogs(): void {
  errorLogs.length = 0;
}
