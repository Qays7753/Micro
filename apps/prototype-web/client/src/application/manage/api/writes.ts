/**
 * M5.1 (Manage v2 phase 5 — IMPACT §12 «Client API»): عميل كتابات مانج-في₂
 * — نداءات POST لعمليات §5 عبر منفذ الشبكة الواحد.
 *
 * العقد (ملزم لكل دالة هنا):
 *  - العميل **رفيع**: يرسل المدخلات (فلس صحيح من presentation) ومفتاح
 *    تكرار لكل كتابة (R-25/T55: إعادة المحاولة بالمفتاح نفسه لا تكرر
 *    العملية أبدًا) ويُرجع نتيجة الخادم كما هي — لا رياضيات ولا قرارات.
 *  - أنواع الاستجابة تعكس شكل الخادن حرفيًا (ManageOperationOutcome من
 *    معالج M2.4) لكنها معرّفة هنا محليًا: R10 يمنع استيراد العميل من مجال
 *    مانج ومن عامل الخادم معًا — هذا عقد العميل المستقل لقناة HTTP.
 *  - كل الأفعال متصلة (R-23): الفشل بالشبكة يظهر E-OFFLINE على السطح
 *    ولا يُحفظ شيء (T56) — قرار العرض عند الصفحة، لا هنا.
 */
import { apiFetch, newIdempotencyKey } from "@/application/network";

/** نتيجة العملية المحفوظة كما يرجعها معالج M2.4 (replay يرجعها حرفيًا). */
export interface ManageOperationResult {
  operationId: string;
  kind: string;
  effectiveOn: string;
  amountFils: number | null;
  entryIds: string[];
  data?: Record<string, unknown>;
}

/** مخرج العملية: applied أول حفظ، replay إعادة نداء بالمفتاح نفسه. */
export interface ManageWriteOutcome {
  outcome: "applied" | "replay";
  result: ManageOperationResult;
}

function manageWrite<T>(path: string, body: Record<string, unknown>, requestId: string): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }, { idempotencyKey: requestId });
}

/** فتحة افتتاح صندوق OP-SETUP: {unknown:true} أو {openingFils} صحيح. */
export type SetupBoxOpening = { unknown: true } | { openingFils: number };

export interface SetupBoxSlot {
  kind: "cash" | "account";
  opening: SetupBoxOpening;
}

/** M5.1 — OP-SETUP (§5): إنشاء المشروع وفتح الصناديك بقيود Q1. */
export function setupProject(input: {
  requestId: string;
  projectName: string;
  boxes: SetupBoxSlot[];
}): Promise<ManageWriteOutcome> {
  return manageWrite(
    "/api/manage-v2/setup",
    { requestId: input.requestId, projectName: input.projectName, boxes: input.boxes },
    input.requestId,
  );
}
