/* FIN-004 (WS-176 — Wave 4): سياسة قراءة السحب الآمن الاستشارية —
 * دالة نقية واحدة فوق نتيجة أفق الكاش القصير الكنسية. لا كتابة، لا
 * أمر سحب، لا حجب، ولا ضمان سيولة: الرقم استشاري والقرار للمالك. */
import type { SafeWithdrawalInput, SafeWithdrawalReading } from "./types.js";

/* الفصل الصريح عن الربح — افتراض معلن دائم لا سطر مشروط يختفي. */
const PROFIT_NOT_CASH_NOTE =
  "الربح المتوقع ليس كاشًا؛ القراءة من الكاش المسجل والتحصيلات/الالتزامات المعلنة فقط.";

/* سياق القروض الصادرة — إفصاح لا حساب: خارج الكاش المسجل أصلًا ولا
 * يُضاف للفائض ولا يُخصم مرتين. */
function loansDisclosure(loansOutstandingMinor: number | null): string | null {
  if (loansOutstandingMinor === null || loansOutstandingMinor === 0) return null;
  return `قروض صادرة قائمة بقيمة ${loansOutstandingMinor} وحدة صغرى — غير محصلة وليست كاشًا ولا تدخل الفائض.`;
}

/* الحالة الناقصة الموحدة: لا رقم أبدًا — الأسباب والفعل التالي ظاهران. */
function incomplete(
  base: Omit<SafeWithdrawalReading, "status" | "reasons" | "nextAction">,
  reasons: readonly string[],
  nextAction: string,
): SafeWithdrawalReading {
  return { ...base, status: "incomplete", reasons, nextAction };
}

export function calculateSafeWithdrawal(input: SafeWithdrawalInput): SafeWithdrawalReading {
  const { horizon, shortCash, cashRecorded, reserve, loansOutstandingMinor } = input;
  const base = {
    horizon,
    recordedCashMinor: shortCash.recordedCashMinor,
    projectedCashMinor: shortCash.projectedCashMinor,
    reserveMinor: reserve.mode === "enabled" ? reserve.amountMinor : null,
    headroomMinor: null,
    loansOutstandingMinor,
    reasons: [] as string[],
    assumptions: [PROFIT_NOT_CASH_NOTE],
    sources: [...shortCash.sources],
  };
  /* الاحتياطي معطّل بطلب المالك: لا رقم إطلاقًا — قرار المالك قاعدة. */
  if (reserve.mode === "disabled")
    return incomplete(
      base,
      ["عطّلتَ قراءة السحب الآمن بطلبك؛ لا يعرض النظام رقمًا ولا يفترض احتياطيًا."],
      "فعّل القراءة وأدخل احتياطيًا ثابتًا عندما تريد الرقم الاستشاري.",
    );
  /* الكاش غير مسجل: لا أساس للقراءة — المجهول لا يصبح صفرًا. */
  if (!cashRecorded)
    return incomplete(
      base,
      ["الكاش المسجل نفسه غير مسجل بعد؛ سجّله قبل أي قراءة سحب."],
      "سجّل الكاش في محفظة أولًا ثم عد لقراءة السحب الآمن.",
    );
  /* توقع الكاش ناقص أو غير صالح: القراءة تستعير نقصه بأسبابه الظاهرة. */
  if (
    shortCash.status === "incomplete" ||
    shortCash.status === "invalid" ||
    shortCash.projectedCashMinor === null
  )
    return incomplete(
      base,
      ["توقع الكاش للأفق المختار ناقص أو غير صالح؛ لا قراءة سحب فوق توقع غير مكتمل.", ...shortCash.reasons],
      "أكمل توقع الكاش أولًا (تواريخ التحصيل أو الالتزام الناقصة) ثم عد لهذه القراءة.",
    );
  /* الاحتياطي غير مُدخل: لا سياسة = لا رقم مخترع (لا نسبة ولا «شهور»). */
  if (reserve.mode === "unset")
    return incomplete(
      base,
      ["لا حد احتياطي مُدخلًا؛ النظام لا يخترع نسبة ولا قاعدة أشهر مصاريف."],
      "أدخل احتياطيًا ثابتًا بالوحدة الصغرى أو عطّل القراءة.",
    );
  /* الأساس مكتمل: الفائض = التوقع − الاحتياطي، سالبًا كان أم موجبًا. */
  return complete(base, shortCash, reserve.amountMinor, loansOutstandingMinor);
}

/* المخرج المكتمل: رقم استشاري بحالته، والسالب سبب ظاهر لا قصّ إلى صفر. */
function complete(
  base: Omit<SafeWithdrawalReading, "status" | "reasons" | "nextAction">,
  shortCash: SafeWithdrawalInput["shortCash"],
  reserveMinor: number,
  loansOutstandingMinor: number | null,
): SafeWithdrawalReading {
  const headroomMinor = shortCash.projectedCashMinor! - reserveMinor;
  const loans = loansDisclosure(loansOutstandingMinor);
  const status = shortCash.status === "needs_review" ? "needs_review" : "available";
  return {
    ...base,
    status,
    headroomMinor,
    reasons: headroomMinor < 0 ? ["الفائض سالب: الالتزامات المعلنة مع الاحتياطي تتجاوز الكاش المتوقع."] : [],
    assumptions: [PROFIT_NOT_CASH_NOTE, ...shortCash.assumptions, ...(loans ? [loans] : [])],
    nextAction:
      status === "needs_review"
        ? "راجع الافتراضات المعلنة أعلاه قبل الاعتماد على الرقم؛ القراءة استشارية ولا تنفّذ سحبًا."
        : "قراءة استشارية فقط: لا تنفّذ سحبًا ولا تضمن سيولة؛ راجع المتوقعات إذا تغيرت الوقائع.",
  };
}
