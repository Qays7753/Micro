/**
 * S14 (DOC-023 / العقد المشترك §14.1 — أمر ba2ce7b4 §5): إيصال الأمر —
 * استرداد النتيجة والحتمية عبر معاملة متعددة المصادر، لا دفتر مال ولا
 * قائمة أحداث مالية ثانية ولا صف انتظار سحابي.
 *
 *  • الإيصال يحمل نتيجة ومراجع لا رصيدًا جديدًا: resultRefs عناوين سجلات
 *    (family+id) أنتجها القصد — لا أرصدة ولا أحداثًا مالية.
 *  • لا يُكتب إيصال نجاح قبل بياناته: outcome=confirmed يكتب مع مراجعه
 *    الناتجة داخل حد الكتابة نفسه.
 *  • الحتمية (حد الكتابة يحرسها): نفس commandId بنفس الحمولة والجيل يعيد
 *    نتيجة الأصل بلا أثر ثانٍ؛ نفس commandId بحمولة مختلفة = تعارض حتمية
 *    صريح بلا كتابة؛ لا حذف دوري قد يعيد قبول قصد قديم.
 *  • الإيصال المستعاد يحفظ جيل أصله دليلًا تاريخيًا — ليس تفويضًا لنموذج
 *    قديم؛ فحص الجيل الحي يسبق استرداد النتيجة.
 */
export type CommandOutcomeKind = "confirmed" | "failed";

/** مظروف القصد كما يُحسب له رمز التحقق — الحمولة المعيارية لا الاسم الظاهر. */
export type CommandEnvelopeDigestInput = {
  commandId: string;
  commandType: string;
  generation: string;
  payloadVersion: number;
  /** البصمة المعيارية للحمولة (sha256 من الشكل المعياري) — لا الحمولة نفسها. */
  payloadDigest: string;
};

export type CommandReceipt = {
  /** مفتاح السجل = commandId (وحيد داخل المشروع/الجيل). */
  id: string;
  commandId: string;
  commandType: string;
  /** جيل البيانات المحلي وقت الالتزام — دليل تاريخي لا تفويض. */
  generation: string;
  payloadVersion: number;
  /** بصمة الحمولة المعيارية — أساس مطابقة الحتمية. */
  payloadDigest: string;
  outcome: CommandOutcomeKind;
  /** مراجع السجلات الناتجة (family+id) — لا أرصدة ولا أحداث مالية. */
  resultRefs: readonly string[];
  /** كود الفشل عند outcome=failed — إيصال الفشل بلا أثر (التدحرج حد الكتابة). */
  failureCode: string | null;
  failureMessage: string | null;
  recordedAt: string;
};

/** مدخلات الإنشاء الكاملة — النتيجة والمراجع والفشل فوق المظروف. */
export type CommandReceiptInput = CommandEnvelopeDigestInput & {
  outcome: CommandOutcomeKind;
  resultRefs?: readonly string[];
  failureCode?: string | null;
  failureMessage?: string | null;
  recordedAt: string;
};

/** فحص المظروف — المعرفات غير الفارغة والإصدار الصحيح. */
function assertEnvelope(input: CommandEnvelopeDigestInput): void {
  if (!input.commandId.trim()) throw new Error("معرف الأمر إلزامي.");
  if (!input.commandType.trim()) throw new Error("نوع الأمر إلزامي.");
  if (!input.generation.trim()) throw new Error("جيل الأمر إلزامي.");
  if (!input.payloadDigest.trim()) throw new Error("بصمة حمولة الأمر إلزامية.");
  if (!Number.isSafeInteger(input.payloadVersion) || input.payloadVersion < 1)
    throw new Error("إصدار حمولة الأمر يجب عددًا صحيحًا موجبًا.");
}

/** فحص المراجع — بصيغة family:id بلا استثناء. */
function assertResultRefs(refs: readonly string[]): void {
  for (const ref of refs)
    if (!/^[a-z_]+:[^:\s]+$/.test(ref)) throw new Error(`مرجع النتيجة «${ref}» يجب بصيغة family:id.`);
}

/** فحص اتساق النتيجة — confirmed بلا فشل، وfailed بكود وبلا مراجع ناتجة. */
function assertOutcomeConsistency(input: CommandReceiptInput): void {
  const hasFailure = Boolean(input.failureCode || input.failureMessage);
  if (input.outcome === "confirmed" && hasFailure) throw new Error("إيصال النجاح لا يحمل فشلًا.");
  if (input.outcome === "failed" && (input.resultRefs ?? []).length > 0)
    throw new Error("إيصال الفشل لا يحمل مراجع ناتجة — الفشل بلا أثر.");
  if (input.outcome === "failed" && !input.failureCode?.trim()) throw new Error("إيصال الفشل يحتاج كودًا.");
}

/** إنشاء الإيصال النقي — التحقق البنيوي: المعرفات غير الفارغة، والمراجع
 * بصيغة family+id، وconfirmed لا يحمل فشلًا وfailed لا يحمل مراجع ناتجة. */
export function createCommandReceipt(input: CommandReceiptInput): CommandReceipt {
  assertEnvelope(input);
  assertResultRefs(input.resultRefs ?? []);
  assertOutcomeConsistency(input);
  const confirmed = input.outcome === "confirmed";
  return {
    id: input.commandId,
    commandId: input.commandId,
    commandType: input.commandType,
    generation: input.generation,
    payloadVersion: input.payloadVersion,
    payloadDigest: input.payloadDigest,
    outcome: input.outcome,
    resultRefs: confirmed ? (input.resultRefs ?? []) : [],
    failureCode: confirmed ? null : (input.failureCode ?? null),
    failureMessage: confirmed ? null : (input.failureMessage ?? null),
    recordedAt: input.recordedAt,
  };
}

export type CommandReceiptDecision =
  | { kind: "fresh" }
  | { kind: "reuse"; receipt: CommandReceipt }
  | { kind: "idempotency_conflict"; existing: CommandReceipt };

/** قرار الحتمية عند حد الكتابة — نفس المفتاح بنفس الحمولة والجيل إعادة
 * صادقة؛ بحمولة مختلفة تعارض صريح؛ وإلا قصد جديد. (العقد §14.1) */
export function decideCommandReceipt(
  incoming: CommandEnvelopeDigestInput,
  existing: CommandReceipt | undefined,
): CommandReceiptDecision {
  if (existing === undefined) return { kind: "fresh" };
  if (existing.payloadDigest === incoming.payloadDigest && existing.generation === incoming.generation)
    return { kind: "reuse", receipt: existing };
  return { kind: "idempotency_conflict", existing };
}
