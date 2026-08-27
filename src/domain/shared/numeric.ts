const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export function isValidTimestamp(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function assertId(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required`);
}

export function assertPositiveMinor(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive safe integer`);
}

export function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer in minor currency units`);
  }
}

export function addSafe(left: number, right: number): number | null {
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    (right > 0 && left > Number.MAX_SAFE_INTEGER - right) ||
    (right < 0 && left < Number.MIN_SAFE_INTEGER - right)
  )
    return null;
  return left + right;
}

export function roundHalfUp(numerator: number, denominator: number): number | null {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) return null;
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return quotient + (remainder * 2 >= denominator ? 1 : 0);
}

export function ceilRatio(numerator: number, denominator: number): number | null {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0
  )
    return null;
  return Math.floor(numerator / denominator) + (numerator % denominator === 0 ? 0 : 1);
}
