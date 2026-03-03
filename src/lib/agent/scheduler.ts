/**
 * Agent Scheduler Utilities
 *
 * Lightweight 5-field cron parser/matcher (minute hour day month weekday)
 * and next-run calculation used by the agent heartbeat/worker runtime.
 */

const CRON_PARTS = 5;

interface CronSpec {
  minute: Set<number> | null;
  hour: Set<number> | null;
  day: Set<number> | null;
  month: Set<number> | null;
  weekday: Set<number> | null;
}

function normalizeWeekday(value: number): number {
  // In cron, 0 and 7 both represent Sunday.
  if (value === 7) return 0;
  return value;
}

function parseValue(value: string, min: number, max: number, isWeekday = false): number {
  const num = Number(value);
  if (!Number.isInteger(num)) {
    throw new Error(`Invalid cron value: ${value}`);
  }

  const normalized = isWeekday ? normalizeWeekday(num) : num;
  if (normalized < min || normalized > max) {
    throw new Error(`Cron value out of range: ${value}`);
  }

  return normalized;
}

function parseCronPart(part: string, min: number, max: number, isWeekday = false): Set<number> | null {
  const trimmed = part.trim();
  if (trimmed === '*') return null;

  const values = new Set<number>();

  for (const segment of trimmed.split(',')) {
    if (!segment) continue;

    const stepParts = segment.split('/');
    const base = stepParts[0];
    const step = stepParts[1] ? Number(stepParts[1]) : 1;

    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`Invalid cron step: ${segment}`);
    }

    let rangeStart = min;
    let rangeEnd = max;

    if (base !== '*') {
      if (base.includes('-')) {
        const [rawStart, rawEnd] = base.split('-');
        rangeStart = parseValue(rawStart, min, max, isWeekday);
        rangeEnd = parseValue(rawEnd, min, max, isWeekday);
        if (rangeEnd < rangeStart) {
          throw new Error(`Invalid cron range: ${segment}`);
        }
      } else {
        const value = parseValue(base, min, max, isWeekday);
        rangeStart = value;
        rangeEnd = value;
      }
    }

    for (let current = rangeStart; current <= rangeEnd; current += step) {
      values.add(isWeekday ? normalizeWeekday(current) : current);
    }
  }

  return values;
}

export function parseCronExpression(expression: string): CronSpec {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== CRON_PARTS) {
    throw new Error('Cron expression must have exactly 5 fields');
  }

  return {
    minute: parseCronPart(parts[0], 0, 59),
    hour: parseCronPart(parts[1], 0, 23),
    day: parseCronPart(parts[2], 1, 31),
    month: parseCronPart(parts[3], 1, 12),
    weekday: parseCronPart(parts[4], 0, 7, true),
  };
}

function setHas(set: Set<number> | null, value: number): boolean {
  if (!set) return true;
  return set.has(value);
}

/**
 * Cron matching is evaluated in UTC for deterministic server behavior.
 */
export function cronMatchesAt(expression: string, date: Date): boolean {
  const spec = parseCronExpression(expression);

  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const weekday = date.getUTCDay();

  return (
    setHas(spec.minute, minute) &&
    setHas(spec.hour, hour) &&
    setHas(spec.day, day) &&
    setHas(spec.month, month) &&
    setHas(spec.weekday, weekday)
  );
}

/**
 * Compute the next UTC timestamp that matches this cron expression.
 * Searches up to 366 days ahead, minute by minute.
 */
export function computeNextRunAt(expression: string, from: Date): Date {
  const base = new Date(from);
  base.setUTCSeconds(0, 0);

  // Start with the next minute to avoid returning the current instant.
  base.setUTCMinutes(base.getUTCMinutes() + 1);

  const maxIterations = 60 * 24 * 366;
  const cursor = new Date(base);

  for (let i = 0; i < maxIterations; i++) {
    if (cronMatchesAt(expression, cursor)) {
      return new Date(cursor);
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  throw new Error(`Unable to compute next run time for cron expression: ${expression}`);
}

export function isDueByCron(expression: string, now: Date): boolean {
  const aligned = new Date(now);
  aligned.setUTCSeconds(0, 0);
  return cronMatchesAt(expression, aligned);
}

export function minutesSince(isoDate: string | null | undefined, now: Date): number {
  if (!isoDate) return Number.POSITIVE_INFINITY;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - parsed.getTime()) / (60 * 1000));
}
