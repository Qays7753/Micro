import {
  type CashObservation,
  type CashObservationKnowledge,
  type CreateCashObservationInput,
  cashObservationScopeKinds,
  cashWalletKinds,
} from "./types.js";
import { assertDate, assertIso, assertNonBlank } from "./policies.js";

/** S04 (DOC-013 / UNIT-025 B2/B3 + العقد المشترك §6.1): سياسة رصد الأرصدة —
 * وحدة مجال مستقلة داخل المنطقة نفسها تُحمَّل مع مسار العدّ (خدمة العدّ
 * الديناميكية) لا مع كومة الإقلاع؛ سلوك الإنشاء محفوظ حرفيًا ووجه الانفصال
 * وحده تغيّر (ميزانية حزمة الدخول محروسة بسقف مالك — سابقة D-034 نفسها). */

/* S04 (UNIT-025 B2/B3 + العقد المشترك §6.1): إنشاء الرصد النقدي — قياس
 * محروس الشكل: النطاق محفظة أو إجمالي المشروع (لا يجتمعان)، والمبلغ مستوى
 * صحيح آمن (الصفر المقصود صادق)، والصندوق النقدي (cash_drawer) ونطاق
 * إجمالي المشروع لا يقبلان سالبًا (لا يمكن عدّ نقود سالبة في درج؛ رصيد
 * الحساب البنكي الظاهر قد يكون سالبًا فيبقى صادقًا)، والتواريخ محلية/ISO
 * صحيحة، والمعرفة معروفة أو تقديرية — لا يُخترع رصد ولا يُخزن مجهول
 * كصفر. الرصد لا يُنشئ نقدًا ولا يمحو حركة: لا مسار كتابة مالية هنا. */
function assertObservationScope(input: CreateCashObservationInput): string | null {
  if (!cashObservationScopeKinds.includes(input.scopeKind)) throw new Error("نطاق الرصد غير صالح.");
  const walletId = input.walletId?.trim() || null;
  if (input.scopeKind === "wallet" && !walletId) throw new Error("رصد المحفظة يتطلب تحديد المحفظة.");
  if (input.scopeKind === "project_total" && walletId)
    throw new Error("رصد إجمالي المشروع لا يحدد محفظة بعينها.");
  return walletId;
}

function assertObservationAmount(input: CreateCashObservationInput): void {
  if (
    input.walletKind !== null &&
    input.walletKind !== undefined &&
    !cashWalletKinds.includes(input.walletKind)
  )
    throw new Error("نوع المحفظة غير صالح.");
  if (!Number.isInteger(input.countedMinor) || !Number.isSafeInteger(input.countedMinor))
    throw new Error("أدخل المبلغ الموجود رقمًا صحيحًا آمنًا.");
  const boxScope =
    input.scopeKind === "project_total" ||
    (input.scopeKind === "wallet" && input.walletKind === "cash_drawer");
  if (boxScope && input.countedMinor < 0)
    throw new Error("المبلغ الموجود في الصندوق لا يكون سالبًا؛ الرصيد الظاهر السالب يخص الحسابات لا الدرج.");
  if (input.knowledge !== "known" && input.knowledge !== "estimated")
    throw new Error("حالة معرفة الرصد غير صالحة.");
}

export function createCashObservation(input: CreateCashObservationInput): CashObservation {
  assertNonBlank(input.id, "id");
  assertNonBlank(input.note, "note");
  assertNonBlank(input.operationKey, "operationKey");
  assertDate(input.observedOn, "observedOn");
  assertIso(input.cutoff, "cutoff");
  assertIso(input.recordedAt, "recordedAt");
  const walletId = assertObservationScope(input);
  assertObservationAmount(input);
  return Object.freeze({
    id: input.id,
    scopeKind: input.scopeKind,
    walletId,
    countedMinor: input.countedMinor,
    knowledge: input.knowledge satisfies CashObservationKnowledge,
    cutoff: input.cutoff,
    observedOn: input.observedOn,
    recordedAt: input.recordedAt,
    operationKey: input.operationKey,
    note: input.note.trim(),
  });
}
