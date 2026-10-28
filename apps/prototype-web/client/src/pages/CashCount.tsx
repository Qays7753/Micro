/**
 * مطابقة رصيد الصندوق (UNIT-025 / owner flow #20 — S04): عدّ الموجود قياسًا
 * دائمًا، والفرق من مرجع معروف لنطاق المكان نفسه فقط، والمطابقة فعل صريح.
 *
 * S04 (DOC-013 / UNIT-025 P3.1 + العقد المشترك §6 + SDF-015/016):
 *  - المكان قرار صريح — لا اختيار أول مكان تلقائيًا (C1-03).
 *  - المبلغ يبدأ فارغًا — الصفر المقصود إدخال صادق لا قيمة افتراضية.
 *  - المرجع مجهول (رصيد افتتاح غير معروف): يُعرض صافي الحركات مع حد المعرفة،
 *    ولا يُحسب فرق مقابل صفر — يُحفظ القياس وحده بلا تسوية وبلا تمويل مالك.
 *  - المرجع معروف والتطابق: «تم» — لا يُكتب شيء البتة (لا قيد صفري ولا رصد).
 *  - المرجع معروف والفرق: سبب صريح ثم معاينة ثم تسجيل — القياس والتسوية
 *    يُكتبان معًا بمعنيين مرتبطين (90 و−10 لا −20) بأثر اليوم فقط.
 *  - لا تخمين سبب من إشارة الفرق — السبب قرار المالك («لم أعرف سبب الفرق»
 *    خيار صريح لا افتراضي، و«سبب آخر» يتطلب وصفًا قصيرًا).
 */
import { ArrowRight, Calculator, Scale } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
/* R2 (M-10/D11): بانيا نص السجل المحفوظ من باب التطبيق (لا من العرض)؛
 * رسالة التوست اللحظية تبقى عرضًا. */
import { type CashContinuityOverview } from "@/application/cash";
import { formatMoneyMinor } from "@/presentation/formatters";

import { Button } from "@/components/primitives";
type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; overview: CashContinuityOverview };

type ReasonChoice = "" | "unknown" | "other";

export default function CashCount() {
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع للمصدر (?from) أو أماكن النقد كبديل قانوني. */
  const returnPath = useReturnPath();
  const { cashContinuity, cashCount, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [walletId, setWalletId] = useState("");
  const [countedMinor, setCountedMinor] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [valid, setValid] = useState(true);
  const [reasonChoice, setReasonChoice] = useState<ReasonChoice>("");
  const [reasonText, setReasonText] = useState("");
  /* R9-GA-F3.6b: نبرة الرسالة في الحالة — خطأ ⇒ alert، نجاح/معلومة ⇒ status. */
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" | "info" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ kind: "observed" | "settled"; text: string } | null>(null);
  /* S04 (UNIT-025 B5-F13/R18): مفتاح نية ثابت لكل أمر عدّ — لا Date.now()
   * لكل محاولة؛ الإرسال المتكرر والتحديث يعيدان النية نفسها لا ثانية. */
  const operationKey = useRef(`cash-count-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const isDirty = useFormDirty([walletId, countedMinor, valid, reasonChoice, reasonText]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => submit() });

  useEffect(() => {
    let active = true;
    cashContinuity.overview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      setState({ phase: "ready", overview: result.value });
      /* S04 (UNIT-025 R02/C1-03): لا اختيار تلقائي لأول مكان — القرار صريح،
       * وإعادة القراءة تحفظ الاختيار القائم الصالح. */
      setWalletId(current =>
        current && result.value.wallets.some(wallet => wallet.id === current) ? current : "",
      );
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, dataVersion, retryCount]);

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تجهيز العدّ…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة أماكن النقد</h1>
        <p role="alert">{state.message}</p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
        <Button action="secondary" onClick={() => navigate(returnPath)}>
          أماكن النقد
        </Button>
      </section>
    );

  const { overview } = state;
  const wallet = overview.wallets.find(candidate => candidate.id === walletId) ?? null;
  const referenceUnknown = wallet?.openingUnknown ?? false;
  /* الفرق لا يُحسب إلا من مرجع معروف بعد إدخال صالح — المجهول ليس صفرًا
   * والإدخال الفارغ ليس معدودًا صفريًا (SDF-015 + C1-03). */
  const differenceMinor =
    wallet && !referenceUnknown && countedMinor !== null && valid ? countedMinor - wallet.balanceMinor : null;
  const hasDifference = differenceMinor !== null && differenceMinor !== 0;
  const canSettle =
    hasDifference && reasonChoice !== "" && (reasonChoice !== "other" || reasonText.trim().length > 0);

  /* حارس المدخلات يستدعي نفس المسار: النجاح يرجع true ليكتمل الخروج بعد الحفظ. */
  async function submit(): Promise<boolean> {
    /* الخدمة تُحمَّل ديناميكيًا بعد الإقلاع (نمط transfers/loans) — null يعني
     * «جارٍ التجهيز»: رسالة صادقة بلا كتابة ولا التهام الفعل. */
    if (!cashCount) {
      setMessage({ text: "جارٍ تجهيز العدّ — لحظة ثم أعد المحاولة.", tone: "error" });
      return false;
    }
    if (!wallet) {
      setMessage({ text: "اختر مكان النقد الذي تعدّه.", tone: "error" });
      return false;
    }
    if (countedMinor === null || !valid || !Number.isSafeInteger(countedMinor)) {
      setMessage({ text: "أدخل المبلغ الموجود بالأرقام 0–9 — الصفر المقصود إدخال صادق.", tone: "error" });
      return false;
    }
    /* المرجع مجهول: القياس وحده — لا فرق مقابل صفر ولا تسوية (SDF-015). */
    if (referenceUnknown) {
      setSaving(true);
      setMessage(null);
      const result = await cashCount.recordCashCount({
        walletId: wallet.id,
        countedMinor,
        knowledge: "known",
        settle: false,
        operationKey: operationKey.current,
      });
      setSaving(false);
      if (!result.ok) {
        setMessage({ text: result.message, tone: "error" });
        return false;
      }
      notifyDataChanged();
      setDone({
        kind: "observed",
        text: "سُجّل القياس. الرصيد المسجل غير مكتمل؛ لا يمكن حساب الفرق — لم يتغير أي رقم.",
      });
      return true;
    }
    /* المرجع معروف: التطابق لا يكتب شيئًا — «تم» تنهي الفحص (R09/AC08). */
    if (differenceMinor === 0) {
      setDone({ kind: "observed", text: "المبلغ يطابق الرصيد المسجل — لم يُسجَّل شيء ولا تسوية مطلوبة." });
      return true;
    }
    if (differenceMinor === null || differenceMinor === 0) {
      setMessage({ text: "أدخل المبلغ الموجود قبل تسجيل الفرق.", tone: "error" });
      return false;
    }
    if (!canSettle) {
      setMessage({ text: "اختر سبب الفرق قبل تسجيله — «لم أعرف سبب الفرق» خيار صريح.", tone: "error" });
      return false;
    }
    setSaving(true);
    setMessage(null);
    const result = await cashCount.recordCashCount({
      walletId: wallet.id,
      countedMinor,
      knowledge: "known",
      settle: true,
      reason: reasonChoice === "other" ? reasonText.trim() : "لم أعرف سبب الفرق",
      operationKey: operationKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage({ text: result.message, tone: "error" });
      return false;
    }
    notifyDataChanged();
    setDone({
      kind: "settled",
      text:
        differenceMinor < 0
          ? `سُجل فرق نقص ${formatMoneyMinor(Math.abs(differenceMinor))} د.أ — القياس والتسوية بمعنيين مرتبطين، ولن يتغير أي رقم قديم.`
          : `سُجل فرق زيادة ${formatMoneyMinor(differenceMinor)} د.أ — القياس والتسوية بمعنيين مرتبطين، ولن يتغير أي رقم قديم.`,
    });
    return true;
  }

  if (done) {
    return (
      <section className="micro-page micro-count-page">
        <div className="micro-page-heading">
          <span className="micro-overline">مطابقة رصيد الصندوق</span>
          <h1>{done.kind === "settled" ? "انسجّل فرق العدّ" : "انسجّل القياس"}</h1>
          {/* R9-GA-F3.6: قناة النتيجة status مهذبة بفئة الملاحظة — ليست خطأ. */}
          <p role="status" className="micro-save-note">
            {done.text}
          </p>
        </div>
        {countedMinor !== null && wallet ? (
          <section className="micro-decision-card" aria-label="نتيجة العدّ">
            <span>المبلغ الموجود الذي عُدّ</span>
            <strong>
              <MoneyValue minor={countedMinor} />
            </strong>
            <p>
              {done.kind === "settled"
                ? "رصيد المكان صار المبلغ المعدود — بأثر اليوم فقط، دون تعديل أي قيد سابق."
                : "قياس دائم للموجود — لا يُنشئ نقدًا ولا يمحو حركة."}
            </p>
          </section>
        ) : null}
        <Button action="secondary" onClick={() => navigate(returnPath)}>
          أماكن النقد <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    );
  }

  return (
    <section className="micro-page micro-count-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> أماكن النقد
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مطابقة رصيد الصندوق</span>
        <h1>عدّ اللي في الدرج فعلًا</h1>
        <p>
          القياس أولًا: يُحفظ ما وجدته كما هو. والفرق لا يُحسب إلا من رصيد مسجل مكتمل، وتسجيله قرارك الصريح.
        </p>
      </div>
      {overview.wallets.length === 0 ? (
        <p className="micro-field-error" role="status">
          لا توجد أماكن نقد بعد؛ أنشئ مكانًا أولًا.
        </p>
      ) : (
        <section className="micro-form-card" aria-label="نموذج العدّ">
          <label className="micro-field">
            <span>المكان الذي تعدّه</span>
            <select value={walletId} onChange={event => setWalletId(event.target.value)}>
              <option value="">اختر مكان النقد</option>
              {overview.wallets.map(candidate => (
                /* (إصلاح تكاملي — مجموعة ٤): نص خالص داخل option — bdi داخل option تعشيش مرفوض. */
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} —{" "}
                  {candidate.openingUnknown
                    ? `صافي الحركات المسجلة ${formatMoneyMinor(candidate.balanceMinor)} د.أ · رصيد البداية غير معروف`
                    : `المسجل ${formatMoneyMinor(candidate.balanceMinor)} د.أ`}
                </option>
              ))}
            </select>
          </label>
          <label className="micro-field">
            <span>كم وجدت فعلًا؟ (د.أ)</span>
            <EnglishNumberInput
              value={countedMinor}
              kind="money"
              onNumericChange={setCountedMinor}
              onTextValidityChange={setValid}
              aria-label="المبلغ الموجود"
            />
          </label>
          {wallet ? (
            referenceUnknown ? (
              <section className="micro-decision-card" data-knowledge="unknown" aria-label="حد المعرفة">
                <span>الرصيد المسجل غير مكتمل</span>
                <strong>صافي الحركات المسجلة: {formatMoneyMinor(wallet.balanceMinor)} د.أ</strong>
                <p>
                  رصيد بداية هذا المكان غير معروف؛ لا يمكن حساب الفرق — سجّل القياس فقط، ولن يُخترع فرق مقابل
                  صفر ولن يُموّل المالك الفرق.
                </p>
              </section>
            ) : countedMinor !== null && valid ? (
              <section
                className="micro-decision-card"
                data-knowledge={differenceMinor === 0 ? "known" : "stale"}
                aria-label="الفرق عن المسجل"
              >
                <span>الفرق عن المسجل</span>
                <strong>
                  <MoneyValue minor={differenceMinor ?? 0} showPlus />
                </strong>
                <p>
                  {differenceMinor === 0
                    ? "المبلغ يطابق الرصيد المسجل — لا تسوية مطلوبة."
                    : "فرق مسجل بتاريخ اليوم بأثر مستقبلي فقط؛ لا يُعاد تصنيف أي رقم قديم ولا يُخمَّن سبب من إشارة الفرق."}
                </p>
              </section>
            ) : null
          ) : null}
          {hasDifference ? (
            <fieldset className="micro-field">
              <legend>سبب الفرق — قرارك قبل التسجيل</legend>
              <label>
                <input
                  type="radio"
                  name="count-reason"
                  checked={reasonChoice === "unknown"}
                  onChange={() => setReasonChoice("unknown")}
                />{" "}
                لم أعرف سبب الفرق
              </label>
              <label>
                <input
                  type="radio"
                  name="count-reason"
                  checked={reasonChoice === "other"}
                  onChange={() => setReasonChoice("other")}
                />{" "}
                سبب آخر
              </label>
              {reasonChoice === "other" ? (
                <input
                  type="text"
                  value={reasonText}
                  onChange={event => setReasonText(event.target.value)}
                  placeholder="وصف قصير للسبب"
                  aria-label="وصف سبب الفرق"
                />
              ) : null}
            </fieldset>
          ) : null}
          {message ? (
            <p
              className={message.tone === "error" ? "micro-field-error" : "micro-save-note"}
              role={message.tone === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}
          <Button action="save" disabled={saving} onClick={() => void submit()}>
            {referenceUnknown ? (
              <>
                <Scale aria-hidden="true" />
                {saving ? "جارٍ تسجيل القياس…" : "سجّل القياس"}
              </>
            ) : hasDifference ? (
              <>
                <Calculator aria-hidden="true" />
                {saving
                  ? "جارٍ التسجيل…"
                  : `تسجيل فرق ${(differenceMinor ?? 0) < 0 ? "النقص" : "الزيادة"} ${formatMoneyMinor(Math.abs(differenceMinor ?? 0))}`}
              </>
            ) : (
              <>
                <Scale aria-hidden="true" />
                {saving ? "جارٍ الفحص…" : "تم"}
              </>
            )}
          </Button>
        </section>
      )}
    </section>
  );
}
