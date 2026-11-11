/**
 * EX-D18 — عميل طبقة الشبكة للعميل (BFF نفس الأصل `/api/*`).
 *
 * عقد الاستخدام:
 * - لا يكتب هذا العميل في أي تخزين محلي (Manage محلي أولًا ولا يمس)؛ كل
 *   القراءات والكتابات تمر بالخادم حصرًا.
 * - كل نداء تحويلي يرسل ترويسة `x-micro-api` (حارس CSRF الخادمي) ومفتاح
 *   تكرار قابلًا للتمرير عند الحاجة — إعادة المحاولة نفس المفتاح لا تكرر
 *   الحالة أبدًا.
 * - الأخطاء تعاد بهيكل موحد `ApiError` (code/message عربي من الخادم) — لا
 *   استثناءات خام ولا ادعاء نجاح قبل رد الخادم.
 */

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  constructor(status: number, shape: ApiErrorShape) {
    super(shape.message);
    this.status = status;
    this.code = shape.code;
    this.details = shape.details;
  }
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `idem-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function parseError(response: Response): Promise<ApiError> {
  let shape: ApiErrorShape = { code: "network_error", message: "تعذر الوصول إلى الخدمة الآن." };
  try {
    const body = (await response.json()) as { error?: ApiErrorShape };
    if (body.error && typeof body.error.code === "string") {
      shape = body.error as ApiErrorShape;
    }
  } catch {
    /* keep the honest fallback */
  }
  return new ApiError(response.status, shape);
}

export interface ApiCallOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiCallOptions = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (MUTATING_METHODS.has(method)) {
    headers.set("x-micro-api", "1");
    headers.set("content-type", "application/json");
    if (options.idempotencyKey !== undefined) {
      headers.set("idempotency-key", options.idempotencyKey);
    }
  }
  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: "same-origin",
    signal: options.signal,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** رفع ملف خام إلى مسار الوسائط الخاصة (البايتات في R2 عبر الخادم فقط). */
export async function apiUpload<T>(path: string, file: Blob, options: ApiCallOptions = {}): Promise<T> {
  const headers = new Headers({
    "content-type": file.type || "application/octet-stream",
    "x-micro-api": "1",
  });
  if (options.idempotencyKey !== undefined) {
    headers.set("idempotency-key", options.idempotencyKey);
  }
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: file,
    credentials: "same-origin",
    signal: options.signal,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

/** قراءة ملف من مسار الوسائط كـ Blob (للعرض المصرح به فقط). */
export async function apiDownload(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(path, { credentials: "same-origin", signal });
  if (!response.ok) {
    throw await parseError(response);
  }
  return response.blob();
}
