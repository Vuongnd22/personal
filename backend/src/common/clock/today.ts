import { Clock } from './clock';

/** Returns "today" as YYYY-MM-DD in the given IANA timezone, from the given clock's instant. */
export function today(clock: Clock, timezone: string): string {
  return formatDateInTimezone(clock.now(), timezone);
}

export function formatDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // en-CA gives YYYY-MM-DD
}

/** Parses a "YYYY-MM-DD" date-only string into a UTC midnight Date, matching Prisma's @db.Date behavior. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}
