/**
 * EX-D18 — خدمة جلسة الشبكة: دخول Google عبر هوية Micro، قراءة الجلسة
 * والقدرات (كلها محسوبة خادميًا — لا دور من العميل أبدًا)، والخروج.
 *
 * عقد الخصوصية: لا يُخزن أي رمز في العميل — الكوكي HttpOnly يحمله المتصفح
 * فقط؛ هذه الخدمة تقرأ الحالة وتوجه المتصفح لمسار الدخول الخادمي.
 */

import { ApiError, apiFetch } from "./apiClient";

/** عضوية Workspace كما يحسبها الخادم (EX-D19) — عرض فقط، لا فرض صلاحيات من العميل. */
export interface NetworkWorkspace {
  id: string;
  displayName: string;
  role: string;
  capabilities: { market: boolean; delivery: boolean };
}

export interface NetworkSession {
  authenticated: boolean;
  identity?: { email: string; displayName: string };
  isAdmin?: boolean;
  workspaces?: NetworkWorkspace[];
  vendor?: { status: string; supplierProfileId: string } | null;
  driver?: {
    status: string;
    eligibleForNewWork: boolean;
    acceptingNew: boolean;
    evidenceValid: boolean;
    vehicleApproved: boolean;
  } | null;
}

export async function fetchSession(signal?: AbortSignal): Promise<NetworkSession> {
  return apiFetch<NetworkSession>("/api/auth/session", { signal });
}

/** جلسة جهاز واحدة كما يحسبها الخادم — بيانات وصفية فقط، لا رمز أبدًا. */
export interface DeviceSession {
  id: string;
  createdAt: number;
  expiresAt: number;
  current: boolean;
}

/**
 * W1 (قرار المالك النهائي أ-7 / EX-D24 — G06): جلسات الأجهزة النشطة
 * للحساب — الدخول من أكثر من جهاز مسموح والصفحة تعرضها كلها.
 */
export async function fetchDeviceSessions(signal?: AbortSignal): Promise<DeviceSession[]> {
  const body = await apiFetch<{ sessions?: DeviceSession[] }>("/api/auth/sessions", { signal });
  /* W1 تحصين (Post-Group 6، 2026-11-21): استجابة غير متوقعة/مشوهة (وكيل عكسي،
   * صفحة خطأ تُفسَّر JSON…) لا يجوز أن تصل إلى العرض فتنهار صفحة الحساب كلها
   * (TypeError على undefined.sessions كان يفكك شجرة React بأكملها). الفشل
   * الصادق: حقل sessions غير المصفوفة يُرمى ApiError فيُظهر القسم حالته
   * الصادقة «تعذر القراءة + إعادة المحاولة» بدل الانهيار — لا نجاح كاذب. */
  if (!Array.isArray(body?.sessions)) {
    throw new ApiError(502, {
      code: "malformed_sessions_response",
      message: "تعذر قراءة جلسات الأجهزة الآن — أعد المحاولة.",
    });
  }
  return body.sessions;
}

/**
 * «تسجيل الخروج من كل الأجهزة» — إبطال خادمي لكل جلسات الحساب بما فيها
 * الحالية؛ بعد النجاح يعاد تحميل حالة الجلسة (غير مسجل).
 */
export async function signOutAllDevices(): Promise<number> {
  const body = await apiFetch<{ ok: boolean; revoked: number }>("/api/auth/signout-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return body.revoked;
}

/**
 * Wave 3 (G09 د-6 — القرار النهائي): تسجيل اشتراك هذا الجهاز في تنبيهات
 * Web Push أفضل الجهد — إرسال محاولة لا ضمان وصول؛ يسجَّل الاشتراك بعد
 * منح إذن المتصفح، ولا يُدّعى وصول أبدًا.
 */
export async function registerPushSubscription(subscription: {
  endpoint: string;
  keys: Record<string, unknown>;
}): Promise<void> {
  await apiFetch("/api/auth/push-subscriptions", {
    method: "POST",
    body: JSON.stringify(subscription),
  });
}

/** إلغاء اشتراك هذا الجهاز في تنبيهات Push (G09 — مسار صادق). */
export async function removePushSubscription(endpoint: string): Promise<void> {
  await apiFetch(`/api/auth/push-subscriptions?endpoint=${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
  });
}

/**
 * W1 (قرار المالك النهائي أ-3/أ-4 / EX-D24 — G01): إنشاء المشروع الواحد
 * بضغطة صريحة — مشروع واحد لكل حساب وصاحب واحد لكل مشروع؛ إنشاء ثانٍ
 * يرفضه الخادم (409) ولا يُنشأ شيء تلقائيًا عند أي فعل عمل.
 */
export async function createWorkspace(displayName: string): Promise<NetworkWorkspace> {
  const body = await apiFetch<{ workspace: NetworkWorkspace }>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
  return body.workspace;
}

/**
 * بدء الدخول: توجيه المتصفح (لا fetch — الكوكي والمعالجة عند الخادم) إلى
 * مسار الدخول مع وجهة رجوع داخلية آمنة يتحقق منها الخادم.
 */
export function startGoogleSignIn(returnTo: string): void {
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  window.location.assign(`/api/auth/google/start?returnTo=${encodeURIComponent(safeReturn)}`);
}

export async function signOut(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/api/auth/signout", { method: "POST" });
}
