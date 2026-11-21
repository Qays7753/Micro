/**
 * باب لوحة المشرف (Post-Group 6 continuous completion — G02/Q129،
 * 2026-11-22): وحدة منفصلة في الكود يسهل فصلها لاحقًا كما يفرض القرار —
 * الطوابير مع الأعمار، البحث عن مستخدم، سجل القرارات، إيقاف هوية كاملة
 * بسبب، والإلغاء الإداري لحجز جارٍ. توسيع سطحه تعديل مقصود بنفس الـPR
 * (PC-3). لا قراءة ولا كتابة لسجل مالي في Manage من هذا البيت أبدًا.
 */

export {
  fetchAdminQueues,
  fetchAdminDecisions,
  searchAdminUsers,
  suspendAdminIdentity,
  adminCancelBooking,
} from "./adminPanelService";
export type { AdminQueueItem, AdminQueues, AdminUserResult, AdminDecision } from "./adminPanelService";
