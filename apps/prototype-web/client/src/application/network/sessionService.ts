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
