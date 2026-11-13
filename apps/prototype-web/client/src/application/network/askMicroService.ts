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

export interface AskAnswer {
  ok: boolean;
  answer?: string;
}

export async function fetchAskStatus(signal?: AbortSignal): Promise<AskStatus> {
  return apiFetch<AskStatus>("/api/ask/status", { signal });
}

export async function askQuestion(question: string): Promise<AskAnswer> {
  return apiFetch<AskAnswer>("/api/ask", { method: "POST", body: JSON.stringify({ question }) });
}
