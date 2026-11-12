/**
 * HTTP helpers: JSON envelopes, error mapping, and cookie handling.
 * Private/authenticated API responses are never cacheable (no-store).
 */

export const JSON_HEADERS_BASE: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS_BASE, ...extraHeaders },
  });
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Stable machine-readable error codes + honest Arabic messages. */
const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "هذا الفعل يحتاج تسجيل دخول عبر هوية Micro.",
  forbidden: "لا تملك صلاحية هذا الفعل.",
  not_found: "العنصر غير موجود أو غير متاح لحسابك.",
  bad_request: "الطلب غير مكتمل أو غير صالح.",
  conflict: "الواقع تغير — أعد المحاولة من الحالة الحالية.",
  gone: "انتهت مهلة هذا الإجراء.",
  too_many_requests: "تجاوزت الحد المسموح مؤقتًا — أعد المحاولة لاحقًا.",
  network_not_configured: "طبقة الشبكة غير مهيأة بعد (رابط D1/R2 مفقود) — راجع خطوات التهيئة.",
  internal_error: "حدث خطأ غير متوقع — سُجل بلا أي بيانات خاصة.",
  method_not_allowed: "طريقة الطلب غير مدعومة لهذا المسار.",
};

export function errorResponse(
  code: keyof typeof ERROR_MESSAGES | string,
  status: number,
  details?: unknown,
): Response {
  const message = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.internal_error;
  const body: ApiErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS_BASE });
}

/** Uniform handler result so the router never leaks stack traces. */
export type ApiResult = Response;

export function requireJsonBody(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "bad_request");
  }
  return value as Record<string, unknown>;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asString(value: unknown, field: string, opts: { max?: number; min?: number } = {}): string {
  if (typeof value !== "string" || (value.trim().length === (opts.min ?? 0) - 1 && value.trim() === "")) {
    throw new HttpError(400, "bad_request", { field });
  }
  if (typeof value !== "string" || value.length < (opts.min ?? 1)) {
    throw new HttpError(400, "bad_request", { field });
  }
  if (opts.max !== undefined && value.length > opts.max) {
    throw new HttpError(400, "bad_request", { field, reason: "too_long" });
  }
  return value;
}

export function asOptionalString(
  value: unknown,
  field: string,
  opts: { max?: number } = {},
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return asString(value, field, opts);
}

/** Non-negative decimal integer string (network money is carried as strings). */
export function asDecimalString(value: unknown, field: string, maxDigits = 18): string {
  if (typeof value !== "string" || !/^\d{1,18}$/.test(value) || value.length > maxDigits) {
    throw new HttpError(400, "bad_request", { field });
  }
  return value;
}

export function asOptionalDecimalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return asDecimalString(value, field);
}

/** ---- Cookies (minimal parsing/serialization for the session cookie) ---- */

export function parseCookies(header: string | null): Map<string, string> {
  const jar = new Map<string, string>();
  if (!header) return jar;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    try {
      jar.set(name, decodeURIComponent(value));
    } catch {
      /* malformed pair — skipped, never a 500 */
    }
  }
  return jar;
}

export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return `micro_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax;${secure ? " Secure;" : ""} Max-Age=${maxAgeSeconds}`;
}

export function clearedSessionCookie(): string {
  return "micro_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}
