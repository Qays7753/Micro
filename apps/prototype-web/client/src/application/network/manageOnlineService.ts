/**
 * EX-D23 (M3 — 2026-11-14): خدمة Manage المتصلة — أصغر حد تطبيقي متوافق
 * يصل الأسطح القائمة بحالة Manage المتصلة وقراءاتها الخادمية. كل القراءات
 * تمر بالعامل (حد التصريح) — المتصفح لا يتصل بPostgreSQL أبدًا؛ ولا تكتب
 * هذه الخدمة أي تخزين محلي إطلاقًا (Manage محلي أولًا محفوظ).
 *
 * حالات الصدق: غير موثق (الجلسة)، غير مهيأ (503 manage_not_configured)،
 * القدرة معطلة، غير مربوط — كل واحدة تُعرض كما هي ولا تتحول إلى «نجاح».
 */

import { apiFetch, newIdempotencyKey } from "./apiClient";

/** حالة ربط Manage لمساحة واحدة كما يحسبها الخادم (M2). */
export interface ManageWorkspaceOnlineState {
  id: string;
  displayName: string;
  role: string;
  manageEnabled: boolean;
  linkStatus: "none" | "pending" | "linked" | "taken";
}

export interface ManageOnlineState {
  configured: boolean;
  workspaces: ManageWorkspaceOnlineState[];
}

export async function fetchManageOnlineState(signal?: AbortSignal): Promise<ManageOnlineState> {
  return apiFetch<ManageOnlineState>("/api/manage/state", { signal });
}

/** ملخص ما يحمله الخادم لمالك Workspace المربوط. */
export interface ManageFamilySummary {
  family: string;
  count: number;
}

export interface ManageFamilies {
  workspaceId: string;
  families: ManageFamilySummary[];
  totalRecords: number;
}

export async function fetchManageFamilies(signal?: AbortSignal): Promise<ManageFamilies> {
  return apiFetch<ManageFamilies>("/api/manage/families", { signal });
}

export interface ManageRecordView {
  id: string;
  data: unknown;
  updatedAt: number;
}

export interface ManageFamilyRecords {
  family: string;
  records: ManageRecordView[];
  nextCursor: string | null;
}

export async function fetchManageFamilyRecords(
  family: string,
  options: { limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
): Promise<ManageFamilyRecords> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.cursor !== undefined) params.set("cursor", options.cursor);
  const query = params.toString();
  return apiFetch<ManageFamilyRecords>(
    `/api/manage/records/${encodeURIComponent(family)}${query ? `?${query}` : ""}`,
    {
      signal,
    },
  );
}

/** نتيجة بدء الربط: بانتظار التأكيد الثاني داخل هذه الجلسة نفسها. */
export interface ManageLinkStartResult {
  pending: true;
  workspaceId: string;
  nonce: string;
  expiresAt: number;
}

export async function startManageLink(proofSecret: string): Promise<ManageLinkStartResult> {
  return apiFetch<ManageLinkStartResult>(
    "/api/manage/link/start",
    { method: "POST", body: JSON.stringify({ proofSecret }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function confirmManageLink(nonce: string): Promise<{ linked: boolean; workspaceId: string }> {
  return apiFetch<{ linked: boolean; workspaceId: string }>(
    "/api/manage/link/confirm",
    { method: "POST", body: JSON.stringify({ nonce }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function unlinkManage(): Promise<{ unlinked: boolean; workspaceId: string }> {
  return apiFetch<{ unlinked: boolean; workspaceId: string }>(
    "/api/manage/link",
    { method: "DELETE" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/**
 * توليد سر إثبات الملكية داخل Manage (محليًا في الذاكرة فقط — لا يُخزن في
 * أي مخزن محلي ولا يدخل ملف التصدير أبدًا). البروتوكول §2-ب: السر يُولَّد
 * هنا ويعرض للمالك لنسخه، ثم يقدَّم في الجلسة السحابية، ولا يخزن الخادم
 * إلا بصمته (SHA-256) — مطابقة البريد وحدها لا تُقرأ أصلًا في أي خطوة.
 */
export function generateManageProofSecret(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.every(byte => byte === 0) && !globalThis.crypto) {
    // بيئة بلا crypto (لا تحدث في المتصفحات الحديثة) — رفض صادق لا سر ضعيف.
    throw new Error("crypto-unavailable");
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
