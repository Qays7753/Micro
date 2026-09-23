/**
 * المجموعة ٤ (عقد ٢٩): محرر الأصل العميق — «هذا الشيء للاستخدام لفترة طويلة؟».
 * السؤال العملي يقود التصنيف: أصل رأسمالي يخرج كاش (أو يفتح ذمم) ولا يمس
 * الربح؛ والعمر المجهول يبقى مجهولًا — لا افتراض ولا إهلاك مخفي. معاينة
 * الأثر قبل الحفظ، وحارس المدخلات غير المحفوظة كإخوته المحررات.
 */
import { ArrowRight, Save, Warehouse } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { FormDraftRestoreBanner } from "@/components/forms/FormDraftRestoreBanner";
import { useFormDraft } from "@/components/forms/useFormDraft";
import { formatLocalDate, formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";

import { Button, ChoiceButton, ChoiceRow } from "@/components/primitives";
export default function AssetEditor() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { assets, notifyDataChanged, formDrafts } = usePrototypeServices();
  const [name, setName] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [acquisitionKind, setAcquisitionKind] = useState<"cash" | "payable">("cash");
  const [purchaseDate, setPurchaseDate] = useState(() => localDateInAmman());
  const [longUse, setLongUse] = useState<"yes" | "no" | "unknown">("unknown");
  const [lifeMonths, setLifeMonths] = useState("");
  const [startOn, setStartOn] = useState("");
  /* عقد ٤٣ (WS-179 — Wave 7): القيمة المتبقية نهاية العمر — اختيارية (فارغ = ٠). */
  const [residualMinor, setResidualMinor] = useState(0);
  const [validResidual, setValidResidual] = useState(true);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* المجموعة ٦ (تدقيق A2 — AI-02): عهدة تزامنية ضد الإرسال المزدوج —
   * حالة `saving` لا تمنع نداءً ثانيًا قبل إعادة الرسم (نبضتان في دورة واحدة)
   * ولا نداءً برمجيًا من حارس التغييرات غير المحفوظة أثناء الحفظ. العهدة
   * المرجعية تُفحص فورًا وترد النداء المتزامن الثاني؛ والخدمة تولد معرفات
   * جديدة لكل نداء فلا يحمينا إلا المنع هنا. */
  const saveInFlightRef = useRef(false);

  const isDirty = useFormDirty([
    name,
    categoryLabel,
    amountMinor,
    acquisitionKind,
    purchaseDate,
    longUse,
    lifeMonths,
    startOn,
    residualMinor,
    note,
  ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });
  /* المجموعة ٥ (عقد ٣٦): مسودة نصية لمحرر الأصل — تُكتب عند التعديل الفعلي
   * وتُستعاد صريحة بعد الإغلاق/التحديث؛ لا حدث مالي قبل الحفظ النهائي. */
  const draft = useFormDraft(formDrafts, "asset", "new", {
    name: "",
    categoryLabel: "",
    amountMinor: 0,
    acquisitionKind: "cash" as "cash" | "payable",
    purchaseDate: localDateInAmman(),
    longUse: "unknown" as "yes" | "no" | "unknown",
    lifeMonths: "",
    startOn: "",
    residualMinor: 0,
    note: "",
  });
  const restoredFromOffer = useRef(false);
  /* الكتابة عند التغيير الفعلي فقط (قذر) وفي طور الصياغة — لا مسودة من مجرد فتح. */
  useEffect(() => {
    if (!isDirty || draft.state.phase === "restore-offer") return;
    draft.onValuesChanged({
      name,
      categoryLabel,
      amountMinor,
      acquisitionKind,
      purchaseDate,
      longUse,
      lifeMonths,
      startOn,
      residualMinor,
      note,
    });
  }, [
    name,
    categoryLabel,
    amountMinor,
    acquisitionKind,
    purchaseDate,
    longUse,
    lifeMonths,
    startOn,
    residualMinor,
    note,
    isDirty,
    draft.state.phase,
  ]);
  /* تطبيق القيم المستعادة بعد «استرجع» فقط — الانتقال من العرض إلى الصياغة. */
  useEffect(() => {
    if (draft.state.phase === "drafting" && restoredFromOffer.current) {
      restoredFromOffer.current = false;
      const saved = draft.state.values;
      setName(String(saved.name ?? ""));
      setCategoryLabel(String(saved.categoryLabel ?? ""));
      setAmountMinor(Number(saved.amountMinor ?? 0));
      setAcquisitionKind(saved.acquisitionKind === "payable" ? "payable" : "cash");
      setPurchaseDate(String(saved.purchaseDate ?? localDateInAmman()));
      setLongUse(saved.longUse === "yes" || saved.longUse === "no" ? saved.longUse : "unknown");
      setLifeMonths(String(saved.lifeMonths ?? ""));
      setStartOn(String(saved.startOn ?? ""));
      setResidualMinor(Number(saved.residualMinor ?? 0) || 0);
      setNote(String(saved.note ?? ""));
    }
    if (draft.state.phase === "restore-offer") restoredFromOffer.current = true;
  }, [draft.state.phase]);

  function validate(): string | null {
    if (!name.trim()) return "أكمل اسم الأصل — مثال: ثلاجة عرض، ماكينة خياطة.";
    if (!validAmount || !Number.isInteger(amountMinor) || amountMinor <= 0)
      return "أدخل قيمة الشراء بالأرقام 0–9.";
    if (longUse === "yes") {
      const life = Number(lifeMonths);
      if (!Number.isInteger(life) || life < 1 || life > 600)
        /* تصحيح مراجعة 4-d: الأرقام الظاهرة إنجليزية دومًا، والإرشاد يصف
         * المسار الحقيقي (ترك الحقل فارغًا) لا خيارًا غير موجود. */
        return "أدخل العمر النافع عددًا صحيحًا بين 1 و600 شهرًا، أو اتركه فارغًا ليبقى مجهولًا.";
      if (startOn && startOn < purchaseDate) return "بداية الاستخدام لا تسبق تاريخ الشراء.";
      /* عقد ٤٣: المتبقية داخل الحدود — رفض صادر قبل أي كتابة. */
      if (
        !validResidual ||
        !Number.isInteger(residualMinor) ||
        residualMinor < 0 ||
        residualMinor >= amountMinor
      )
        return "أدخل القيمة المتبقية عددًا صحيحًا ≥ 0 وأصغر من قيمة الأصل، أو اتركها فارغة لتكون صفرًا.";
    }
    return null;
  }

  async function save(): Promise<boolean> {
    if (saveInFlightRef.current) return false;
    const problem = validate();
    if (problem) {
      setMessage(problem);
      return false;
    }
    setMessage(null);
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const result = await assets.create({
        name,
        categoryLabel: categoryLabel.trim() || null,
        acquisitionAmountMinor: amountMinor,
        acquisitionKind,
        purchaseDate,
        lifeMonths: longUse === "yes" && Number(lifeMonths) >= 1 ? Number(lifeMonths) : null,
        depreciationStartOn: longUse === "yes" && startOn ? startOn : null,
        residualValueMinor: longUse === "yes" && residualMinor > 0 ? residualMinor : null,
        note: note.trim() || null,
      });
      if (!result.ok) {
        setMessage(result.message);
        return false;
      }
      notifyDataChanged();
      await draft.clearFormDraft();
      navigate(withReturnTarget(returnPath, result.value.asset.id));
      return true;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
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
      {draft.state.phase === "restore-offer" ? (
        <FormDraftRestoreBanner
          savedAt={draft.state.savedAt}
          onRestore={draft.restoreDraft}
          onDiscard={draft.discardDraft}
        />
      ) : null}
      {draft.state.phase === "drafting" && draft.state.saveFailed ? (
        <p className="micro-field-error" role="alert">
          تعذر حفظ المسودة محليًا — قيمك أمامك كما هي ولم يُسجّل أي حركة مالية؛ أكمل الكتابة أو الحفظ النهائي.
        </p>
      ) : draft.state.phase === "drafting" && draft.state.lastSavedAt ? (
        <p className="micro-offline-truth" role="status">
          مسودتك محفوظة محليًا — آخر حفظ{" "}
          <bdi dir="ltr">{formatLocalDate(localDateInAmman(draft.state.lastSavedAt))}</bdi>؛ لم تُسجّل أي حركة
          مالية بعد.
        </p>
      ) : null}
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
        {/* W2 (completion): عقد الاختيار — حافة clay-interactive للمختار + وزن أثقل. */}
        <ChoiceRow>
          <ChoiceButton selected={acquisitionKind === "cash"} onClick={() => setAcquisitionKind("cash")}>
            دفعت نقدًا
          </ChoiceButton>
          <ChoiceButton
            selected={acquisitionKind === "payable"}
            onClick={() => setAcquisitionKind("payable")}
          >
            على الذمم (أدفع لاحقًا)
          </ChoiceButton>
        </ChoiceRow>
      </fieldset>
      <LocalDateField
        label="تاريخ الشراء"
        value={purchaseDate}
        onChange={event => setPurchaseDate(event.target.value)}
      />
      <fieldset className="micro-field">
        <legend>هذا الشيء للاستخدام لفترة طويلة؟</legend>
        <ChoiceRow>
          <ChoiceButton selected={longUse === "yes"} onClick={() => setLongUse("yes")}>
            نعم، عمره طويل
          </ChoiceButton>
          <ChoiceButton selected={longUse === "no"} onClick={() => setLongUse("no")}>
            لا، يُستهلك فورًا
          </ChoiceButton>
        </ChoiceRow>
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
          <label className="micro-field">
            <span>القيمة المتبقية نهاية العمر (د.أ — اختياري)</span>
            <EnglishNumberInput
              value={residualMinor}
              kind="money"
              onNumericChange={setResidualMinor}
              onTextValidityChange={setValidResidual}
              aria-label="القيمة المتبقية نهاية العمر"
            />
            <small>
              ما تتوقع بقاءه من قيمته نهاية عمره — الإهلاك يجري على الفرق فلا ينزل الدفتري دونه؛ اتركها صفرًا
              إن لم تتوقع متبقيًا.
            </small>
          </label>
        </>
      ) : null}
      <label className="micro-field">
        <span>ملاحظة (اختياري)</span>
        <input
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder="مثال: اشتريته من محل الجملة"
        />
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
            لا يُسجَّل مصروفًا هذا الشهر
            {longUse === "yes" && lifeMonths
              ? "؛ والإهلاك الشهري يقترح تلقائيًا بعد البداية لكن لا يدخل ربحك إلا بتسجيله بنفسك"
              : " للأصل الرأسمالي"}
            .
          </p>
        </div>
      </section>
      {message ? (
        <p className="micro-field-error" role="alert">
          {message}
        </p>
      ) : null}
      <div className="micro-form-actions">
        {/* المجموعة ٤ (تصحيح مراجعة 4-c): «يُستهلك فورًا» = مصروف عادي — الحفظ
         * كأصل محجوب والإرشاد يوجّه لمسار المصروف؛ لا تناقض بين القول والفعل. */}
        <Button
          action="save"

          disabled={saving || longUse === "no"}
          onClick={() => void save()}
        >
          <Save aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ الأصل"}
        </Button>
      </div>
      <p className="micro-offline-truth">يعمل بلا إنترنت — يُحفظ محليًا على جهازك.</p>
      <ArrowRight aria-hidden="true" className="micro-visual-hidden" />
    </section>
  );
}

function withReturnTarget(returnPath: string, assetId: string): string {
  /* المجموعة ٤ (تصحيح مراجعة 4-c): الذهاب للتفاصيل يحمل مصدره — زر الرجوع
   * في التفاصيل يعود لقائمة الأصول لا لقفزة مجهولة. */
  return returnPath && returnPath !== "/assets" ? returnPath : withLocalAssetTarget(assetId);
}

function withLocalAssetTarget(assetId: string): string {
  return withReturnTo(`/assets/${assetId}`, "/assets");
}
