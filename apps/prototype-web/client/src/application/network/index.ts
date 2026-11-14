/**
 * باب شبكة التوسعة (EX-D18 — 2026-11-12): عميل API نفس الأصل وجلسة هوية
 * Micro. هذا الباب هو الواجهة القانونية لكل استهلاك الشبكة من الواجهة
 * (صفحات السوق/التوصيل/بوابة السائق)؛ توسيع سطحه تعديل مقصود بنفس الـPR
 * (PC-3). لا يكتب هذا البيت في أي تخزين محلي — Manage محلي أولًا محفوظ.
 *
 * توسيع مقصود مؤرخ (EX-D21 — Phase B 2026-11-14): خدمة Ask Micro
 * (قراءة حد الحالة/السياق وإرسال سؤال) — نفس باب API نفس الأصل، بلا
 * أي كتابة محلية، وبالحدود الخادمية نفسها لكل الأدوار بما فيه السائق.
 */

export { ApiError, apiFetch, apiUpload, apiDownload, newIdempotencyKey } from "./apiClient";
export type { ApiCallOptions, ApiErrorShape } from "./apiClient";
export { fetchSession, signOut, startGoogleSignIn } from "./sessionService";
export type { NetworkSession, NetworkWorkspace } from "./sessionService";
export { fetchAskStatus, askQuestion } from "./askMicroService";
export type { AskStatus, AskStatusContext, AskAnswer } from "./askMicroService";

/*
 * توسيع مقصود مؤرخ (EX-D23 — M3 2026-11-14): خدمة Manage المتصلة (حالة
 * الربط والقدرة والقراءات الخادمية المصرحة + مسار الربط المزدوج) — قراءة
 * خادمية صرفة عبر العامل نفسه، بلا أي كتابة محلية، والربط بإثبات ملكية
 * موثق لا بمطابقة البريد أبدًا.
 */

export {
  fetchManageOnlineState,
  fetchManageFamilies,
  fetchManageFamilyRecords,
  startManageLink,
  confirmManageLink,
  unlinkManage,
  generateManageProofSecret,
  saveManageRecord,
  applyManageMigration,
  fetchManageMigrationStatus,
  rollbackManageMigration,
  fetchManageMode,
} from "./manageOnlineService";
export type {
  ManageOnlineState,
  ManageWorkspaceOnlineState,
  ManageFamilySummary,
  ManageFamilies,
  ManageRecordView,
  ManageFamilyRecords,
  ManageLinkStartResult,
  ManageRecordSaveResult,
  ManageMigrationReceipt,
  ManageMigrationEntry,
} from "./manageOnlineService";
