/**
 * Error Logger - Centralized error tracking for The Counting House
 *
 * Logs errors to both Supabase (persistent) and console (Railway logs).
 * Falls back to in-memory storage if Supabase write fails.
 */

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

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

// In-memory fallback store
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

  // Keep in-memory copy
  errorLogs.unshift(entry);
  if (errorLogs.length > MAX_LOGS) {
    errorLogs.length = MAX_LOGS;
  }

  // Always log to console for Railway logs
  console.error(`[${entry.level.toUpperCase()}] ${entry.source}: ${message}`, options.context || '');

  // Write to Supabase asynchronously (fire-and-forget)
  persistToSupabase(entry).catch((err) => {
    console.error('Failed to persist error log to Supabase:', err);
  });

  return entry;
}

async function persistToSupabase(entry: ErrorLogEntry): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('error_logs').insert({
    level: entry.level,
    message: entry.message,
    stack: entry.stack || null,
    context: (entry.context ?? null) as Json,
    source: entry.source,
    user_id: entry.userId || null,
    url: entry.url || null,
  });
  if (error) {
    throw error;
  }
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
