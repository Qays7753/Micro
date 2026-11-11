/**
 * باب شبكة التوسعة (EX-D18 — 2026-11-12): عميل API نفس الأصل وجلسة هوية
 * Micro. هذا الباب هو الواجهة القانونية لكل استهلاك الشبكة من الواجهة
 * (صفحات السوق/التوصيل/بوابة السائق)؛ توسيع سطحه تعديل مقصود بنفس الـPR
 * (PC-3). لا يكتب هذا البيت في أي تخزين محلي — Manage محلي أولًا محفوظ.
 */

export { ApiError, apiFetch, apiUpload, apiDownload, newIdempotencyKey } from "./apiClient";
export type { ApiCallOptions, ApiErrorShape } from "./apiClient";
export { fetchSession, signOut, startGoogleSignIn } from "./sessionService";
export type { NetworkSession } from "./sessionService";
