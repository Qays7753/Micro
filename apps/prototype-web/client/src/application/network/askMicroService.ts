/**
 * EX-D21 — خدمة Ask Micro: قراءة حد السياق/الحالة الخادمي (متاح لكل حساب
 * موقع بما فيه السائق) وإرسال سؤال. لا تخزين محليًا ولا كتابات؛ الحالة
 * «غير مهيأة» صادقة من الخادم — لا موفر مدفوع ولا ردود مفبركة.
 */
import { apiFetch } from "./apiClient";
import type { NetworkWorkspace } from "./sessionService";

export interface AskStatusContext {
  principal: { displayName: string; email: string };
  roles: { owner: boolean; vendor: boolean; driver: boolean; admin: boolean };
  workspaces: NetworkWorkspace[];
  permittedRecordSummary: {
    ownerPendingDecisions: number;
    vendorListings: number;
    driverOpenTasks: number;
  };
}

export interface AskStatus {
  available: boolean;
  configured: boolean;
  reason?: string;
  context?: AskStatusContext;
}

export interface AskStatus {
  available: boolean;
  configured: boolean;
  reason?: string;
  context?: AskStatusContext;
}

/** Post-Group 6 continuous completion (§5): مصدر موثق — قيمة محسوبة خادميًا. */
export interface AskAnswerSource {
  id: string;
  label: string;
  value: string | number | boolean;
  source: string;
}

/** Post-Group 6 continuous completion (§5.3): مسودة قابلة للتحرير — ليست
 * معاملة محفوظة أبدًا؛ القيم المجهولة تبقى فارغة والمستخدم يقررها. */
export interface AskDraftField {
  name: string;
  label: string;
  type: "text" | "decimal" | "date" | "enum" | "governorate" | "count";
  required: boolean;
  value: string | number | null;
  options?: string[];
}

export interface AskDraftProposal {
  kind: "delivery-booking";
  title: string;
  fields: AskDraftField[];
}

export interface AskAnswer {
  ok?: boolean;
  answer?: string;
  answerText?: string;
  sources?: AskAnswerSource[];
  draft?: AskDraftProposal;
}

export async function fetchAskStatus(signal?: AbortSignal): Promise<AskStatus> {
  return apiFetch<AskStatus>("/api/ask/status", { signal });
}

export async function askQuestion(question: string): Promise<AskAnswer> {
  return apiFetch<AskAnswer>("/api/ask", { method: "POST", body: JSON.stringify({ question }) });
}
