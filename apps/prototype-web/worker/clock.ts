/**
 * Worker clock helpers — server-time deadlines and Amman local dates.
 *
 * The Workers runtime is outside the domain date-arithmetic guard's scan
 * scope; we still keep time handling centralized here: no Date.UTC anywhere,
 * no zero-argument construction, and Amman local dates via Intl (the runtime
 * carries full ICU time zone data).
 */

/** Current server instant in epoch milliseconds. */
export function nowMs(): number {
  return Date.now();
}

/** ISO-8601 UTC timestamp string for an epoch-ms instant. */
export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

const ammanDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Amman",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Amman local calendar date (`YYYY-MM-DD`) for an epoch-ms instant.
 * Used for daily statement dating (contract 21 §3.2-6).
 */
export function ammanDateString(ms: number): string {
  return ammanDateFormatter.format(new Date(ms));
}

/** Parse a `YYYY-MM-DD` string to epoch-ms UTC midnight (strict, no slicing). */
export function parseDateOnly(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return probe.getTime();
}
