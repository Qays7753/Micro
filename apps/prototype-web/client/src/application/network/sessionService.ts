/**
 * EX-D18 — خدمة جلسة الشبكة: دخول Google عبر هوية Micro، قراءة الجلسة
 * والقدرات (كلها محسوبة خادميًا — لا دور من العميل أبدًا)، والخروج.
 *
 * عقد الخصوصية: لا يُخزن أي رمز في العميل — الكوكي HttpOnly يحمله المتصفح
 * فقط؛ هذه الخدمة تقرأ الحالة وتوجه المتصفح لمسار الدخول الخادمي.
 */

import { apiFetch } from "./apiClient";

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
  const body = await apiFetch<{ sessions: DeviceSession[] }>("/api/auth/sessions", { signal });
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
