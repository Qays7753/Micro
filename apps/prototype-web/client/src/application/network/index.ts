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
export {
  fetchSession,
  signOut,
  startGoogleSignIn,
  fetchDeviceSessions,
  signOutAllDevices,
  createWorkspace,
  registerPushSubscription,
  removePushSubscription,
} from "./sessionService";
export type { NetworkSession, NetworkWorkspace, DeviceSession } from "./sessionService";
export { fetchAskStatus, askQuestion, grantAskConsent, revokeAskConsent } from "./askMicroService";
export type {
  AskStatus,
  AskStatusContext,
  AskGovernance,
  AskAnswer,
  AskDraftField,
  AskDraftProposal,
} from "./askMicroService";
/* توسيع مقصود مؤرخ (الاستكمال المستمر — DOC-041/WS-251، أمر المالك 7593b9c4
 * §5.3، نفس-الـPR 2026-11-22): نوعا مسودة Ask القابلة للتحرير
 * (AskDraftField وAskDraftProposal) يُصدَّران عبر الباب — المسودة بطاقة
 * عرض/تحرير فقط لا معاملة محفوظة؛ لا كتابة قبل تأكيد المستخدم الصريح عبر
 * المسار الكنسي. تصحيح ما فات توصيل النوعين إلى مستهلكيهما (AskDraftCard
 * وAskMicro) في الالتزام الأصلي — PC-3. */

/*
 * توسيع مقصود مؤرخ (Post-Group 6 continuous completion — 2026-11-22 /
 * EX-D24 §4 G01): دورة الأدوار من «حسابي» (إلغاء المسودة الفوري وإزالة
 * الدور المفعّل بطلبه — قرارات المالك النهائية ب/Q5) — أوامر خادمية
 * موثقة فقط، بلا أي كتابة محلية.
 */
export {
  cancelSupplierDraft,
  cancelDriverDraft,
  removeSupplierRole,
  removeDriverRole,
} from "./accountRolesService";
export type { RoleDraftCancelled, RoleRemoved } from "./accountRolesService";

/*
 * توسيع مقصود مؤرخ (Post-Group 6 W1 — 2026-11-21 / EX-D24): جلسات
 * الأجهزة وإبطالها الخادمي (قرار أ-7) وإنشاء المشروع الواحد الصريح
 * (قرار أ-3/أ-4) — نفس باب API نفس الأصل بلا أي كتابة محلية، والسياق
 * النشط (workspaceId) يرسل صريحًا مع كل طلب عمل والخادم يتحقق منه.
 */

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
