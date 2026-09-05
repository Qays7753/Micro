/** Style: Micro decision path — the material journey asks the tracking question first and never turns an unknown balance into zero. */
/* مبدأ Micro: رصيد المادة أثر مخزون معلن، ويظهر تاريخه دون تحويله إلى كاش أو مصروف. */
import { ArrowRight, Boxes, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import type { MaterialUnit } from "@micro-domain/inventory-material/index.js";
import type { InventoryMaterialOverview } from "@/application/inventory/inventoryMaterialService";
import { localDateInAmman } from "@/presentation/formatters";
import { MoneyValue, QuantityValue } from "@/components/presentation/DisplayValue";
const ammanDate = () => localDateInAmman();
const unitLabel = (unit: MaterialUnit): string =>
  unit === "piece"
    ? "قطعة"
    : unit === "meter"
      ? "متر"
      : unit === "kilogram"
        ? "كيلوغرام"
        : unit === "liter"
          ? "لتر"
          : "وحدة أخرى";
type TrackingChoice = "tracked" | "untracked";
type OpeningChoice = "quantity" | "unconfirmed" | "zero";

export default function MaterialEditor() {
  const { id } = useParams<{ id?: string }>();
  const confirmMode = Boolean(id);
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { inventory, notifyDataChanged } = usePrototypeServices();
  const [material, setMaterial] = useState<InventoryMaterialOverview | null>(null);
  const [loadingMaterial, setLoadingMaterial] = useState(confirmMode);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<MaterialUnit>("piece");
  /* المجموعة ٢ (عقد ٢٨): سؤال المتابعة ثم سؤال الرصيد — رحلة موجهة لا نموذج مسطح. */
  const [tracking, setTracking] = useState<TrackingChoice>("tracked");
  const [openingChoice, setOpeningChoice] = useState<OpeningChoice>("quantity");
  const [quantityMilli, setQuantityMilli] = useState(0);
  const [costKnown, setCostKnown] = useState(true);
  const [valueMinor, setValueMinor] = useState(0);
  const [actualQuantityMilli, setActualQuantityMilli] = useState(0);
  const [date, setDate] = useState(ammanDate);
  const [sourceNote, setSourceNote] = useState("");
  const [note, setNote] = useState("رصيد مادة معلن");
  const [quantityValid, setQuantityValid] = useState(true);
  const [valueValid, setValueValid] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`material-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  /* وضع التأكيد: مادة قائمة يُؤكَّد رصيدها بعد «غير محدد بعد» أو إعادة تفعيل. */
  useEffect(() => {
    if (!confirmMode) return;
    inventory.overview().then(result => {
      if (!result.ok) {
        setLoadingMaterial(false);
        setMessage(result.message);
        return;
      }
      const found = result.value.materials.find(candidate => candidate.id === id) ?? null;
      setMaterial(found);
      setActualQuantityMilli(found?.quantityMilli ?? 0);
      setNote(`تأكيد رصيد ${found?.name ?? ""}`);
      setLoadingMaterial(false);
    });
  }, [confirmMode, id, inventory]);
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty([
    name,
    unit,
    tracking,
    openingChoice,
    quantityMilli,
    costKnown,
    valueMinor,
    actualQuantityMilli,
    date,
    sourceNote,
    note,
  ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  const confirmed = tracking === "tracked" && (openingChoice === "quantity" || openingChoice === "zero");
  const movementWillBeWritten = confirmMode
    ? (material ? actualQuantityMilli - material.quantityMilli : 0) !== 0
    : tracking === "tracked" && openingChoice === "quantity" && quantityMilli > 0;
  const confirmDelta = material ? actualQuantityMilli - material.quantityMilli : 0;

  async function save(): Promise<boolean> {
    if (confirmMode) {
      if (!material) {
        setMessage("لم نجد المادة المطلوبة لتأكيد رصيدها.");
        return false;
      }
      if (!quantityValid || actualQuantityMilli < 0 || !note.trim()) {
        setMessage("أدخل الكمية الفعلية والبيان بالأرقام 0–9 قبل الحفظ.");
        return false;
      }
      if (confirmDelta > 0 && costKnown && (!valueValid || valueMinor <= 0)) {
        setMessage("أدخل قيمة أكبر من صفر، أو اختر «غير معروفة بعد».");
        return false;
      }
      setSaving(true);
      const result = await inventory.confirmMaterialOpening({
        materialId: material.id,
        actualQuantityMilli,
        costKnown: confirmDelta > 0 ? costKnown : false,
        valueMinor: confirmDelta > 0 && costKnown ? valueMinor : null,
        occurredOn: date,
        note,
        sourceNote: sourceNote.trim() || null,
        operationKey: operationKey.current,
      });
      setSaving(false);
      if (!result.ok) {
        setMessage(result.message);
        return false;
      }
      notifyDataChanged();
      /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
      navigate(returnPath);
      return true;
    }
    if (!name.trim() || !note.trim() || !quantityValid || !valueValid) {
      setMessage("أدخل اسم المادة والبيان بالأرقام 0–9 قبل الحفظ.");
      return false;
    }
    if (openingChoice === "quantity" && quantityMilli <= 0) {
      setMessage("أدخل الكمية المعلومة، أو اختر «غير محدد بعد».");
      return false;
    }
    if (openingChoice === "quantity" && costKnown && valueMinor <= 0) {
      setMessage("أدخل قيمة أكبر من صفر، أو اختر «غير معروفة بعد».");
      return false;
    }
    setSaving(true);
    const result = await inventory.openMaterial({
      name,
      unit,
      tracking,
      opening: {
        quantityState: confirmed ? "confirmed" : "unconfirmed",
        quantityMilli: openingChoice === "quantity" ? quantityMilli : openingChoice === "zero" ? 0 : null,
        costState: costKnown ? "known" : "unknown",
        valueMinor: openingChoice === "quantity" && costKnown ? valueMinor : null,
        confirmedOn: confirmed ? date : null,
        sourceNote: sourceNote.trim() || null,
      },
      note,
      operationKey: operationKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    navigate(returnPath);
    return true;
  }

  if (loadingMaterial)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح بيانات المادة…
      </div>
    );
  if (confirmMode && !material)
    return (
      <section className="micro-page micro-not-found" data-testid="material-confirm-missing">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
          <ArrowRight aria-hidden="true" /> المواد والمخزون
        </button>
        <h1>المادة غير موجودة</h1>
        <p>قد تكون حُذفت من هذا الجهاز أو لم يعد سجلها متاحًا. لم يتغير أي رصيد.</p>
      </section>
    );

  const unitText = unitLabel(unit);
  const previewLines =
    confirmMode && material
      ? confirmDelta === 0
        ? ["لا فرق — يُؤكَّد الرصيد بلا حركة.", "لا يتغير الكاش ولا نتيجة الفترة."]
        : [
            `سيُسجَّل فرق ${confirmDelta > 0 ? "+" : "−"}${Math.abs(confirmDelta) / 1000} ${unitLabel(material.unit)} بحركة موثقة.`,
            "لا يتغير الكاش ولا نتيجة الفترة.",
          ]
      : tracking === "untracked"
        ? ["مادة للتكلفة فقط — بلا رصيد ولا حركة مخزون.", "لا يتغير الكاش ولا نتيجة الفترة."]
        : openingChoice === "unconfirmed"
          ? ["مادة متتبَّعة، رصيدها «غير محدد بعد» حتى تؤكده.", "لا يتغير الكاش ولا نتيجة الفترة."]
          : openingChoice === "zero"
            ? ["رصيد صفر مؤكد — لا حركة تُسجَّل للصفر.", "لا يتغير الكاش ولا نتيجة الفترة."]
            : costKnown
              ? [
                  `سيُسجَّل رصيد بداية ${quantityMilli / 1000} ${unitText} بقيمة معروفة.`,
                  "لا يتغير الكاش ولا نتيجة الفترة.",
                ]
              : [
                  `سيُسجَّل رصيد بداية ${quantityMilli / 1000} ${unitText} — تكلفته غير معروفة بعد، لا صفرًا.`,
                  "لا يتغير الكاش ولا نتيجة الفترة.",
                ];

  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> المواد والمخزون
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">{confirmMode ? "تأكيد رصيد" : "مادة جديدة"}</span>
        <h1>{confirmMode ? `أكّد رصيد ${material?.name ?? ""}` : "أي مادة تسجّل؟"}</h1>
        <p>
          {confirmMode
            ? `الكمية المسجلة الآن ${((material?.quantityMilli ?? 0) / 1000).toFixed(3)} ${unitLabel(material?.unit ?? "piece")} — أدخل الكمية الفعلية، وسيُسجَّل الفرق بحركة موثقة.`
            : "سجّل اسم المادة ووحدتها، ثم أخبرنا إن كنت ستتابع كميتها في المخزون."}
        </p>
      </div>
      <section className="micro-decision-card">
        <Boxes aria-hidden="true" />
        <div>
          <span>حد الحقيقة</span>
          <strong>رصيد المادة لا يغير الكاش أو نتيجة الفترة.</strong>
          <div className="micro-effect-preview" data-testid="material-effect-preview" aria-live="polite">
            <span className="micro-effect-preview-label">بعد الحفظ:</span>
            {previewLines.map(line => (
              <p className="micro-effect-preview-line" key={line}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>
      {confirmMode ? (
        <section className="micro-form-card" aria-label="تأكيد الرصيد">
          <label className="micro-field">
            <span>الكمية الفعلية الآن</span>
            <EnglishQuantityInput
              valueMilli={actualQuantityMilli}
              onMilliChange={setActualQuantityMilli}
              onTextValidityChange={setQuantityValid}
              aria-label="الكمية الفعلية الآن"
            />
            <small>مثال بالأرقام 0–9: 1.250 — بوحدة المادة ({unitLabel(material?.unit ?? "piece")}).</small>
          </label>
          {confirmDelta > 0 ? (
            <fieldset className="micro-field">
              <legend>هل تعرف قيمة الكمية المضافة بالدينار؟</legend>
              <label className="micro-radio-choice">
                <input
                  type="radio"
                  name="confirm-cost"
                  checked={costKnown}
                  onChange={() => setCostKnown(true)}
                />
                <span>نعم، معلومة</span>
              </label>
              <label className="micro-radio-choice">
                <input
                  type="radio"
                  name="confirm-cost"
                  checked={!costKnown}
                  onChange={() => setCostKnown(false)}
                />
                <span>لا، غير معروفة بعد</span>
              </label>
              {costKnown ? (
                <label className="micro-field">
                  <span>قيمة الكمية المضافة بالدينار الأردني</span>
                  <EnglishNumberInput
                    value={valueMinor}
                    kind="money"
                    onNumericChange={setValueMinor}
                    onTextValidityChange={setValueValid}
                    aria-label="قيمة الكمية المضافة"
                  />
                </label>
              ) : null}
            </fieldset>
          ) : null}
          <LocalDateField
            label="تاريخ التأكيد"
            value={date}
            onChange={event => setDate(event.target.value)}
          />
          <label className="micro-field">
            <span>
              كيف عرفته؟ <small>اختياري</small>
            </span>
            <input
              value={sourceNote}
              onChange={event => setSourceNote(event.target.value)}
              placeholder="مثال: جرد، فاتورة من المورد، تقدير"
            />
          </label>
          <label className="micro-field">
            <span>بيان مختصر</span>
            <textarea value={note} onChange={event => setNote(event.target.value)} />
          </label>
          {message ? (
            <p className="micro-field-error" role="status">
              {message}
            </p>
          ) : null}
          <div className="micro-form-actions micro-sticky-save">
            <button
              className="micro-button micro-button-primary micro-save-cost"
              type="button"
              disabled={saving}
              onClick={save}
            >
              <Save aria-hidden="true" />
              {saving ? "جارٍ الحفظ…" : "أكّد الرصيد"}
            </button>
          </div>
        </section>
      ) : (
        <section className="micro-form-card" aria-label="رحلة المادة">
          <label className="micro-field">
            <span>اسم المادة</span>
            <input value={name} onChange={event => setName(event.target.value)} placeholder="مثال: خشب زان" />
          </label>
          <label className="micro-field">
            <span>الوحدة الثابتة للمادة</span>
            <select value={unit} onChange={event => setUnit(event.target.value as MaterialUnit)}>
              <option value="piece">قطعة</option>
              <option value="meter">متر</option>
              <option value="kilogram">كيلوغرام</option>
              <option value="liter">لتر</option>
              <option value="other">وحدة أخرى</option>
            </select>
          </label>
          <fieldset className="micro-field" data-testid="material-tracking-question">
            <legend>بدك تتابع كميات هذه المادة؟</legend>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="material-tracking"
                checked={tracking === "tracked"}
                onChange={() => setTracking("tracked")}
              />
              <span>أيوه، تابع الكمية — يُسجَّل الرصيد، ويُخصم منه عند الاستهلاك والهدر.</span>
            </label>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="material-tracking"
                checked={tracking === "untracked"}
                onChange={() => setTracking("untracked")}
              />
              <span>لا، للتكلفة فقط — بلا رصيد ولا عدّ.</span>
            </label>
          </fieldset>
          {tracking === "untracked" ? (
            <section className="micro-inventory-inactive" aria-labelledby="untracked-explain-title">
              <div>
                <span className="micro-overline">مادة للتكلفة فقط</span>
                <h2 id="untracked-explain-title">بلا رصيد ولا حركة مخزون</h2>
                <p>لن يُسجَّل لها رصيد ولا حركة مخزون، وتبقى متاحة في التقديرات والمشتريات.</p>
              </div>
            </section>
          ) : (
            <>
              <fieldset className="micro-field" data-testid="material-opening-question">
                <legend>هل عندك رصيد حالي؟</legend>
                <label className="micro-radio-choice">
                  <input
                    type="radio"
                    name="material-opening"
                    checked={openingChoice === "quantity"}
                    onChange={() => setOpeningChoice("quantity")}
                  />
                  <span>نعم، معلوم — أدخل الكمية الآن.</span>
                </label>
                <label className="micro-radio-choice">
                  <input
                    type="radio"
                    name="material-opening"
                    checked={openingChoice === "unconfirmed"}
                    onChange={() => setOpeningChoice("unconfirmed")}
                  />
                  <span>غير محدد بعد — تُسجَّل المادة ويُطلب الرصيد لاحقًا.</span>
                </label>
                <label className="micro-radio-choice">
                  <input
                    type="radio"
                    name="material-opening"
                    checked={openingChoice === "zero"}
                    onChange={() => setOpeningChoice("zero")}
                  />
                  <span>صفر مؤكد — لا يوجد منها شيء اليوم.</span>
                </label>
              </fieldset>
              {openingChoice === "quantity" ? (
                <>
                  <label className="micro-field">
                    <span>الكمية الافتتاحية</span>
                    <EnglishQuantityInput
                      valueMilli={quantityMilli}
                      onMilliChange={setQuantityMilli}
                      onTextValidityChange={setQuantityValid}
                      aria-label="الكمية الافتتاحية"
                    />
                    <small>مثال بالأرقام 0–9: 1.250. تحفظ كأجزاء ألفية.</small>
                  </label>
                  <fieldset className="micro-field">
                    <legend>هل تعرف قيمة الرصيد بالدينار؟</legend>
                    <label className="micro-radio-choice">
                      <input
                        type="radio"
                        name="opening-cost"
                        checked={costKnown}
                        onChange={() => setCostKnown(true)}
                      />
                      <span>نعم، معلومة</span>
                    </label>
                    <label className="micro-radio-choice">
                      <input
                        type="radio"
                        name="opening-cost"
                        checked={!costKnown}
                        onChange={() => setCostKnown(false)}
                      />
                      <span>لا، غير معروفة بعد</span>
                    </label>
                    {costKnown ? (
                      <label className="micro-field">
                        <span>قيمة الرصيد الافتتاحي بالدينار الأردني</span>
                        <EnglishNumberInput
                          value={valueMinor}
                          kind="money"
                          onNumericChange={setValueMinor}
                          onTextValidityChange={setValueValid}
                          aria-label="قيمة الرصيد الافتتاحي"
                        />
                      </label>
                    ) : null}
                  </fieldset>
                </>
              ) : null}
              {confirmed ? (
                <>
                  <LocalDateField
                    label="تاريخ تأكيد الرصيد"
                    value={date}
                    onChange={event => setDate(event.target.value)}
                  />
                  <label className="micro-field">
                    <span>
                      كيف عرفته؟ <small>اختياري</small>
                    </span>
                    <input
                      value={sourceNote}
                      onChange={event => setSourceNote(event.target.value)}
                      placeholder="مثال: جرد، فاتورة من المورد، تقدير"
                    />
                  </label>
                </>
              ) : null}
            </>
          )}
          <label className="micro-field">
            <span>بيان مختصر</span>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="مثال: عدّ مخزون بداية التسجيل"
            />
          </label>
          {message ? (
            <p className="micro-field-error" role="status">
              {message}
            </p>
          ) : null}
          <div className="micro-form-actions micro-sticky-save">
            <button
              className="micro-button micro-button-primary micro-save-cost"
              type="button"
              disabled={saving}
              onClick={save}
            >
              <Save aria-hidden="true" />
              {saving ? "جارٍ الحفظ…" : movementWillBeWritten ? "حفظ المادة ورصيد البداية" : "حفظ المادة"}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
