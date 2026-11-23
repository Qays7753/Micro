/**
 * Post-Group 6 continuous completion (WS-251/DOC-041 — owner order 7593b9c4
 * §4 G02): خدمة لوحة المشرف — Q129 وحده: الطوابير مع الأعمار، البحث عن
 * مستخدم بالاسم/البريد/الهاتف، سجل القرارات، إيقاف هوية كاملة بسبب، إلغاء
 * حجز جارٍ بقرار إداري مع سبب، والأرقام التشغيلية البسيطة.
 *
 * وحدة منفصلة في الكود (بيت application/admin) كي يسهل فصلها لاحقًا كما
 * يفرض القرار؛ كل مسار محمي خادميًا (admin فقط) ولا يقرأ أو يكتب أي سجل
 * مالي في Manage إطلاقًا — أقل امتياز.
 */

import { apiFetch } from "@/application/network";

export interface AdminQueueItem {
  id: string | number;
  ageMs: number | null;
  title?: string;
  reason?: string;
  requestId?: string;
  objectId?: string;
  driverProfileId?: string;
  category?: string;
}

export interface AdminQueues {
  queues: {
    marketListings: AdminQueueItem[];
    marketMedia: AdminQueueItem[];
    marketReports: AdminQueueItem[];
    driverApplications: AdminQueueItem[];
    driverEvidence: AdminQueueItem[];
    driverVehicles: AdminQueueItem[];
    openCases: AdminQueueItem[];
  };
  opsCounts: {
    activeSuppliers: number;
    activeDrivers: number;
    weeklyBookings: number;
    suspendedIdentities: number;
    launchThreshold: { suppliers: number; drivers: number; governorates: number };
  };
  computedAt: number;
}

export interface AdminUserResult {
  identityId: string;
  displayName: string;
  email: string;
  createdAt: number;
  isAdmin: boolean;
  vendorStatus: string | null;
  driverStatus: string | null;
  suspended: boolean;
  suspensionReason: string | null;
  matchedBy: string;
}

export interface AdminDecision {
  id: number;
  actorName: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  result: string;
  ageMs: number;
  reason: string | null;
}

export async function fetchAdminQueues(signal?: AbortSignal): Promise<AdminQueues> {
  return apiFetch<AdminQueues>("/api/admin/panel/queues", { signal });
}

export async function searchAdminUsers(query: string, signal?: AbortSignal): Promise<AdminUserResult[]> {
  const body = await apiFetch<{ users: AdminUserResult[] }>(
    `/api/admin/panel/user-search?q=${encodeURIComponent(query)}`,
    { signal },
  );
  return body.users;
}

export async function fetchAdminDecisions(signal?: AbortSignal): Promise<AdminDecision[]> {
  const body = await apiFetch<{ decisions: AdminDecision[] }>("/api/admin/panel/decisions", { signal });
  return body.decisions;
}

export async function suspendAdminIdentity(identityId: string, reason: string): Promise<void> {
  await apiFetch(`/api/admin/panel/identities/${encodeURIComponent(identityId)}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function adminCancelBooking(requestId: string, reason: string): Promise<void> {
  await apiFetch(`/api/admin/panel/delivery/requests/${encodeURIComponent(requestId)}/admin-cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
