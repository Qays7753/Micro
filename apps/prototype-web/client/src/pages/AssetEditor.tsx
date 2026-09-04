/**
 * المجموعة ٤ (عقد ٢٩): محرر الأصل العميق — «هذا الشيء للاستخدام لفترة طويلة؟».
 * السؤال العملي يقود التصنيف: أصل رأسمالي يخرج كاش (أو يفتح ذمم) ولا يمس
 * الربح؛ والعمر المجهول يبقى مجهولًا — لا افتراض ولا إهلاك مخفي. معاينة
 * الأثر قبل الحفظ، وحارس المدخلات غير المحفوظة كإخوته المحررات.
 */
import { ArrowRight, Save, Warehouse } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { localDateInAmman, formatMoneyMinor } from "@/presentation/formatters";

export default function AssetEditor() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { assets, notifyDataChanged } = usePrototypeServices();
  const [name, setName] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [acquisitionKind, setAcquisitionKind] = useState<"cash" | "payable">("cash");
  const [purchaseDate, setPurchaseDate] = useState(() => localDateInAmman());
  const [longUse, setLongUse] = useState<"yes" | "no" | "unknown">("unknown");
  const [lifeMonths, setLifeMonths] = useState("");
  const [startOn, setStartOn] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(`asset-create-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  const isDirty = useFormDirty([name, categoryLabel, amountMinor, acquisitionKind, purchaseDate, longUse, lifeMonths, startOn, note]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  function validate(): string | null {
    if (!name.trim()) return "أكمل اسم الأصل — مثال: ثلاجة عرض، ماكينة خياطة.";
    if (!validAmount || !Number.isInteger(amountMinor) || amountMinor <= 0)
      return "أدخل قيمة الشراء بالأرقام 0–9.";
    if (longUse === "yes") {
      const life = Number(lifeMonths);
      if (!Number.isInteger(life) || life < 1 || life > 600)
        return "أدخل العمر النافع عددًا صحيحًا بين ١ و٦٠٠ شهرًا، أو اختر «مجهول».";
      if (startOn && startOn < purchaseDate) return "بداية الاستخدام لا تسبق تاريخ الشراء.";
    }
    return null;
  }

  async function save(): Promise<boolean> {
    const problem = validate();
    if (problem) {
      setMessage(problem);
      return false;
    }
    setMessage(null);
    setSaving(true);
    const result = await assets.create({
      name,
      categoryLabel: categoryLabel.trim() || null,
      acquisitionAmountMinor: amountMinor,
      acquisitionKind,
      purchaseDate,
      lifeMonths: longUse === "yes" && Number(lifeMonths) >= 1 ? Number(lifeMonths) : null,
      depreciationStartOn: longUse === "yes" && startOn ? startOn : null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    navigate(withFromReturn(returnPath, result.value.asset.id));
    return true;
  }

  return (
    <section className="micro-page micro-asset-editor">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        الأصول
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">سجل أصلًا رأسماليًا</span>
        <h1>شراء للاستخدام الطويل</h1>
        <p>الفرق بين الأصل والمصروف: المصروف ينتهي فورده، والأصل يخدمك أشهرًا أو سنوات.</p>
      </div>
      <label className="micro-field">
        <span>اسم الأصل</span>
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="مثال: ثلاجة عرض للمحل"
        />
      </label>
      <label className="micro-field">
        <span>تصنيف حر (اختياري)</span>
        <input
          value={categoryLabel}
          onChange={event => setCategoryLabel(event.target.value)}
          placeholder="مثال: معدات، أثاث، كهربائيات"
        />
      </label>
      <label className="micro-field">
        <span>قيمة الشراء (د.أ)</span>
        <EnglishNumberInput
          value={amountMinor}
          kind="money"
          onNumericChange={setAmountMinor}
          onTextValidityChange={setValidAmount}
          aria-label="قيمة الشراء"
        />
      </label>
      <fieldset className="micro-field">
        <legend>الدفع</legend>
        <div className="micro-choice-row">
          <button
            type="button"
            className={`micro-button ${acquisitionKind === "cash" ? "micro-button-primary" : "micro-button-secondary"}`}
            onClick={() => setAcquisitionKind("cash")}
          >
            دفعت نقدًا
          </button>
          <button
            type="button"
            className={`micro-button ${acquisitionKind === "payable" ? "micro-button-primary" : "micro-button-secondary"}`}
            onClick={() => setAcquisitionKind("payable")}
          >
            على الذمم (أدفع لاحقًا)
          </button>
        </div>
      </fieldset>
      <LocalDateField label="تاريخ الشراء" value={purchaseDate} onChange={event => setPurchaseDate(event.target.value)} />
      <fieldset className="micro-field">
        <legend>هذا الشيء للاستخدام لفترة طويلة؟</legend>
        <div className="micro-choice-row">
          <button
            type="button"
            className={`micro-button ${longUse === "yes" ? "micro-button-primary" : "micro-button-secondary"}`}
            onClick={() => setLongUse("yes")}
          >
            نعم، عمره طويل
          </button>
          <button
            type="button"
            className={`micro-button ${longUse === "no" ? "micro-button-primary" : "micro-button-secondary"}`}
            onClick={() => setLongUse("no")}
          >
            لا، يُستهلك فورًا
          </button>
        </div>
        <p className="micro-field-hint">
          {longUse === "no"
            ? "إذًا هو مصروف عادي — سجّله من «سجّل ← تسجيل مصروف» ليدخل نتيجة فترته."
            : "الأصل لا يخصم من ربح شهر الشراء؛ يُهلك شهريًا بعد بدء استخدامه إن اخترت ذلك."}
        </p>
      </fieldset>
      {longUse === "yes" ? (
        <>
          <label className="micro-field">
            <span>العمر النافع (بالأشهر)</span>
            <input
              value={lifeMonths}
              onChange={event => setLifeMonths(event.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="مثال: 24"
            />
            <small>اتركه فارغًا إن لم تعرف — يبقى «مجهولًا» حتى تُحدده لاحقًا بمراجعة موثقة.</small>
          </label>
          <LocalDateField
            label="بداية الاستخدام (اختياري)"
            description="إن بدأ لاحقًا من الشراء يبدأ الإهلاك بعده؛ غيابها = غير محددة ولا إهلاك."
            value={startOn}
            onChange={event => setStartOn(event.target.value)}
          />
        </>
      ) : null}
      <label className="micro-field">
        <span>ملاحظة (اختياري)</span>
        <input value={note} onChange={event => setNote(event.target.value)} placeholder="مثال: اشتريته من محل الجملة" />
      </label>
      <section className="micro-decision-card" aria-label="أثر الحفظ">
        <Warehouse aria-hidden="true" />
        <div>
          <span>ماذا سيحدث؟</span>
          <strong>
            {acquisitionKind === "cash"
              ? `يخرج ${formatMoneyMinor(amountMinor)} د.أ من الكاش`
              : `يُفتح التزام ${formatMoneyMinor(amountMinor)} د.أ`}
          </strong>
          <p>
            لا يُسجَّل مصروفًا هذا الشهر{longUse === "yes" && lifeMonths ? "؛ والإهلاك الشهري يقترح تلقائيًا بعد البداية لكن لا يدخل ربحك إلا بتسجيله بنفسك" : " للأصل الرأسمالي"}.
          </p>
        </div>
      </section>
      {message ? (
        <p className="micro-field-error" role="alert">{message}</p>
      ) : null}
      <div className="micro-form-actions">
        {/* المجموعة ٤ (تصحيح مراجعة 4-c): «يُستهلك فورًا» = مصروف عادي — الحفظ
         * كأصل محجوب والإرشاد يوجّه لمسار المصروف؛ لا تناقض بين القول والفعل. */}
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={saving || longUse === "no"}
          onClick={() => void save()}
        >
          <Save aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ الأصل"}
        </button>
      </div>
      <p className="micro-offline-truth">يعمل بلا إنترنت — يُحفظ محليًا على جهازك.</p>
      <ArrowRight aria-hidden="true" className="micro-visual-hidden" />
    </section>
  );
}

function withFromReturn(returnPath: string, assetId: string): string {
  /* المجموعة ٤ (تصحيح مراجعة 4-c): الذهاب للتفاصيل يحمل مصدره — زر الرجوع
   * في التفاصيل يعود لقائمة الأصول لا لقفزة مجهولة. */
  return returnPath && returnPath !== "/assets" ? returnPath : withFromLocal(assetId);
}

function withFromLocal(assetId: string): string {
  return withFrom(`/assets/${assetId}`, "/assets");
}
