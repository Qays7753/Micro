import {
  createCashContinuityEntry,
  summarizeCashContinuity,
  type CashContinuityEntry,
  type CashObservation,
  type CashObservationKnowledge,
} from "@micro-domain/cash-continuity/index.js";
/* R1 (حافة موثقة بنفس الـPR — سابقة D-034): سياسة الرصد تُستورد من ملفها
 * مباشرة فتبقى مع مسار العدّ الديناميكي خارج حزمة الدخول (ميزانية محروسة). */
import { createCashObservation } from "@micro-domain/cash-continuity/observationPolicy.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { STORAGE_ERROR, errorMessageOf, validationFailure } from "@/application/resultCodes";
import { systemClock, todayInAmman, type Clock } from "@/application/time/clock";
import { cashCountSettlementNote } from "./cashCountMessages";
import type { CashContinuityResult } from "./cashContinuityService";

/** S04 (DOC-013 / UNIT-025 + العقد المشترك §6): عدسة خدمة العدّ — قراءة
 * المحافظ والقيود والرصد والتزام الرصد/تسويته المرتبطة فحسب؛ لا كتابة
 * مالية هنا ولا افتتاح ولا تحويل (تلك لخدمة الاستمرارية الكاشية). */
export type CashCountServiceStore = Pick<
  PrototypeLocalStore,
  "listCashWallets" | "listCashContinuityEntries" | "listBalanceObservations" | "commitCashObservation"
>;

/* S04 (DOC-013 / UNIT-025 + SDF-015/016): أمر العدّ والمطابقة — القياس أولًا
 * دائمًا، والفرق لا يُحسب إلا من مرجع معروف لنطاق المحفظة نفسها، والمطابقة
 * فعل صريح لا نتيجة تلقائية. */
export type RecordCashCountInput = {
  walletId: string;
  countedMinor: number;
  knowledge: CashObservationKnowledge;
  /** قرار المطابقة الصريح: true فقط عند اختيار المالك تسجيل الفرق بتسوية موثقة بسبب. */
  settle: boolean;
  /** سبب التسوية — مطلوب عند settle=true بفرق غير صفري؛ «لم أعرف سبب الفرق» خيار صريح لا افتراضي. */
  reason?: string | null;
  operationKey: string;
};
export type CashCountOutcome =
  /** المرجع مجهول (رصيد افتتاح غير معروف): الرصد يُحفظ قياسًا بلا فرق مقابل صفر وبلا تسوية (SDF-015). */
  | { outcome: "observed"; observation: CashObservation; referenceUnknown: true }
  /** مرجع معروف وفرق صفري: تطابق كامل — لا يُكتب شيء البتة (لا قيد صفري ولا رصد؛ AC08/R09). */
  | { outcome: "match"; referenceMinor: number; countedMinor: number }
  /** مرجع معروف وفرق غير صفري ومطابقة صريحة: الرصد والتسوية يُكتبان معًا بمعنىين مرتبطين (SDF-016: −10 لا −20). */
  | { outcome: "settled"; observation: CashObservation; settlement: CashContinuityEntry }
  /** مرجع معروف وفرق غير صفري بلا قرار تسوية: معاينة فقط — لا كتابة؛ القرار بيد المالك. */
  | { outcome: "difference-preview"; referenceMinor: number; differenceMinor: number };

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storageFailure = <T>(): CashContinuityResult<T> => ({
  ok: false,
  code: STORAGE_ERROR,
  message: "تعذر حفظ استمرارية الكاش محليًا — بياناتك كما هي؛ أعد المحاولة.",
});

/** S04 (DOC-013 / UNIT-025 + SDF-015/016/020): خدمة العدّ والمطابقة — قياس
 * الموجود لا حركة نقدية. خدمة مستقلة عن الاستمرارية الكاشية تُحمَّل
 * ديناميكيًا بعد الإقلاع (سابقة EXE-014/D-034 نفسها: مسار العدّ لا يحتاجه
 * الإقلاع وميزانية الحزمة محروسة بسقف مالك) وتُبنى فوق المخزن الوحيد؛
 * عقد السلوك نفسه حرفيًا: المصفوفة الصادقة الكاملة (مجهول/تطابق/معاينة/
 * تسوية موثقة بسبب)، وعهدة الأمر بالمفتاح، ورفض النصف حالة، ومطابقة
 * المرجع الحي داخل حد الكتابة. */
export class CashCountService {
  constructor(
    private readonly store: CashCountServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  async recordCashCount(input: RecordCashCountInput): Promise<CashContinuityResult<CashCountOutcome>> {
    const [wallets, entries, observations] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
      this.store.listBalanceObservations(),
    ]);
    if (!wallets.ok || !entries.ok || !observations.ok) return storageFailure();
    const wallet = wallets.value.find(candidate => candidate.id === input.walletId);
    if (!wallet) return validationFailure("اختر مكان نقد موجودًا قبل العدّ.");
    /* عهدة الأمر: الإرسال نفسه يعيد الرصد نفسه لا ثانيًا — المفتاح من المتصل */
    const repeated = observations.value.find(observation => observation.operationKey === input.operationKey);
    if (repeated) {
      /* إعادة النية نفسها: إن كانت تسويتها مسجلة فهي النتيجة الصادقة. */
      const settlement = entries.value.find(entry => entry.operationKey === input.operationKey) ?? null;
      if (settlement)
        return { ok: true, value: { outcome: "settled", observation: repeated, settlement }, reused: true };
      return {
        ok: true,
        value: { outcome: "observed", observation: repeated, referenceUnknown: true },
        reused: true,
      };
    }
    const referenceUnknown = wallet.openingStatus === "unknown";
    const referenceMinor = summarizeCashContinuity(
      entries.value.filter(entry => entry.walletId === wallet.id),
    );
    const differenceMinor = input.countedMinor - referenceMinor;
    if (referenceUnknown && input.settle)
      return validationFailure("الرصيد المسجل غير مكتمل؛ لا يمكن حساب الفرق — سجّل القياس فقط.");
    if (!referenceUnknown && differenceMinor === 0)
      return { ok: true, value: { outcome: "match", referenceMinor, countedMinor: input.countedMinor } };
    /* المعاينة (لا كتابة) لم المرجع المعروف وفرق غير صفري بلا قرار تسوية —
     * أما المرجع المجهول فيتجاوز المعاينة إلى حفظ القياس وحده (SDF-015). */
    if (!referenceUnknown && !input.settle)
      return { ok: true, value: { outcome: "difference-preview", referenceMinor, differenceMinor } };
    /* السبب الموثق مطلوب للتسوية وحدها — القياس بلا تسوية لا يطلب سببًا. */
    const settledReason = referenceUnknown ? null : (input.reason?.trim() ?? "");
    if (!referenceUnknown && !settledReason)
      return validationFailure("تسجيل فرق العدّ يتطلب سببًا موثقًا — «لم أعرف سبب الفرق» خيار صريح.");
    try {
      const cutoff = this.now();
      const observation = createCashObservation({
        id: id("observation"),
        scopeKind: "wallet",
        walletId: wallet.id,
        countedMinor: input.countedMinor,
        knowledge: input.knowledge,
        cutoff,
        observedOn: todayInAmman(this.now),
        recordedAt: cutoff,
        operationKey: input.operationKey,
        note: `رصد عدّ في ${wallet.name}`,
        walletKind: wallet.kind,
      });
      const settlement = referenceUnknown
        ? null
        : createCashContinuityEntry({
            id: id("count-settlement"),
            walletId: wallet.id,
            type: "cash_adjustment",
            occurredOn: todayInAmman(this.now),
            recordedAt: cutoff,
            cashDeltaMinor: differenceMinor,
            note: cashCountSettlementNote(input.countedMinor),
            reason: settledReason,
            operationKey: input.operationKey,
          });
      const saved = await this.store.commitCashObservation(
        observation,
        settlement,
        referenceUnknown ? null : referenceMinor,
      );
      if (!saved.ok)
        return saved.code === "storage_stale"
          ? { ok: false, code: "storage_error", message: saved.message }
          : storageFailure<CashCountOutcome>();
      /* الحد يضمن الافراد: التسوية المطلوبة مكتوبة مع رصدها أو رُفضت المعاملة
       * كلها — لا نصف حالة يعاد تركيبه هنا. */
      if (settlement && saved.value.settlement)
        return {
          ok: true,
          value: {
            outcome: "settled",
            observation: saved.value.observation,
            settlement: saved.value.settlement,
          },
          reused: saved.value.reused,
        };
      return {
        ok: true,
        value: { outcome: "observed", observation: saved.value.observation, referenceUnknown: true },
        reused: saved.value.reused,
      };
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات العدّ غير صالحة."));
    }
  }
}
