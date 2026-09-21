/**
 * OPS-003 (عقد ٤١ §٣/§٤): محرر تذكير المصروف المتكرر — مسودة أولًا ثم تفعيل
 * صريح، أو تعديل مستقبلي بمراجعة خلف جديدة من فترة معلنة. المسودة لا تولّد
 * فترات ولا تظهر في القادم؛ التعديل المستقبلي لا يمس فترة مقَرَّرة سابقًا.
 * الشهري وحده مدعوم بهذه الموجة، والمنطقة عمّان حصرًا — لا يُدَّعى غيرهما.
 */
import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import {
  type RecurringExpenseAmountMode,
  type RecurringExpenseMonthEndPolicy,
  type RecurringExpenseRuleDraft,
} from "@micro-domain/recurring-expense/index.js";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { Button } from "@/components/primitives";

const MONTH_END_OPTIONS: readonly { value: RecurringExpenseMonthEndPolicy; label: string }[] = [
  { value: "last_valid_day", label: "آخر يوم صالح من الشهر" },
  { value: "skip", label: "تخطَّ الشهر بلا فترة" },
  { value: "ask", label: "اسألني حين يأتي شهر قصير" },
];
const AMOUNT_MODE_OPTIONS: readonly { value: RecurringExpenseAmountMode; label: string }[] = [
  { value: "manual", label: "أدخل المبلغ عند كل تأكيد" },
  { value: "suggested", label: "مقترح اختياري قابل للتعديل" },
  { value: "fixed_suggested", label: "مقترح متكرر أراجعه كل مرة" },
];

const todayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function RecurringExpenseEditor() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { recurringExpenses } = usePrototypeServices();
  const editMode = params.id !== undefined && params.id !== "new";

  const [title, setTitle] = useState("");
  const [anchorDate, setAnchorDate] = useState(todayDate());
  const [dueDay, setDueDay] = useState("5");
  const [monthEndPolicy, setMonthEndPolicy] = useState<RecurringExpenseMonthEndPolicy>("last_valid_day");
  const [interval, setIntervalMonths] = useState("1");
  const [amountMode, setAmountMode] = useState<RecurringExpenseAmountMode>("manual");
  const [suggestedAmountMinor, setSuggestedAmountMinor] = useState<number | null>(null);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [effectiveFromPeriod, setEffectiveFromPeriod] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editMode);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    if (!recurringExpenses || !editMode || !params.id) return;
    let active = true;
    recurringExpenses.readDetail(params.id).then(result => {
      if (!active) return;
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const latest = result.value.revisions.at(-1);
      if (!latest) {
        setMessage("السلسلة بلا قاعدة — لا تعديل مستقبلي.");
        return;
      }
      setTitle(result.value.series.title);
      setDueDay(String(latest.dueDay));
      setMonthEndPolicy(latest.monthEndPolicy);
      setIntervalMonths(String(latest.interval));
      setAmountMode(latest.amountMode);
      setSuggestedAmountMinor(latest.suggestedAmountMinor);
      setCategoryLabel(latest.categoryLabel ?? "");
      setEffectiveFromPeriod(latest.effectiveFromPeriod);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [editMode, params.id, recurringExpenses]);

  const isDirty = useFormDirty([
    title,
    anchorDate,
    dueDay,
    monthEndPolicy,
    interval,
    amountMode,
    suggestedAmountMinor === null ? "" : String(suggestedAmountMinor),
    categoryLabel,
    effectiveFromPeriod,
    changeReason,
  ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save(false) });

  function draftFromFields(): RecurringExpenseRuleDraft | null {
    const day = Number(dueDay);
    const months = Number(interval);
    if (!Number.isSafeInteger(day) || day < 1 || day > 31) {
      setMessage("يوم الاستحقاق بين ١ و٣١.");
      return null;
    }
    if (!Number.isSafeInteger(months) || months < 1 || months > 12) {
      setMessage("الفاصل الزمني بين ١ و١٢ شهرًا.");
      return null;
    }
    if (editMode && !/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFromPeriod)) {
      setMessage("فترة بداية سريان القاعدة الجديدة بصيغة YYYY-MM.");
      return null;
    }
    if (amountMode === "fixed_suggested" && (suggestedAmountMinor === null || suggestedAmountMinor <= 0)) {
      setMessage("المقترح المتكرر يحتاج مبلغًا — أدخله أو اختر نمطًا آخر.");
      return null;
    }
    if (amountMode === "manual" && suggestedAmountMinor !== null) {
      setMessage("نمط «أدخل المبلغ عند كل تأكيد» لا يحمل مقترحًا — احذف المبلغ أو غيّر النمط.");
      return null;
    }
    setMessage(null);
    return {
      effectiveFromPeriod: editMode ? effectiveFromPeriod : anchorDate.slice(0, 7),
      frequency: "monthly",
      interval: months,
      anchorDate,
      dueDay: day,
      monthEndPolicy,
      timezone: "Asia/Amman",
      amountMode,
      suggestedAmountMinor: amountMode === "manual" ? null : suggestedAmountMinor,
      suggestedWalletId: null,
      categoryLabel: categoryLabel.trim() || null,
      changeReason: editMode ? changeReason.trim() || null : null,
    };
  }

  async function save(alsoActivate: boolean): Promise<boolean> {
    if (saveInFlightRef.current) return false;
    if (!recurringExpenses) {
      setMessage("جارٍ تهيئة خدمة التذكيرات — أعد المحاولة بعد لحظة.");
      return false;
    }
    if (!editMode && !title.trim()) {
      setMessage("اكتب عنوان التذكير أولًا — هو اسمه لا معناه المالي.");
      return false;
    }
    const rule = draftFromFields();
    if (rule === null) return false;
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      if (editMode && params.id) {
        const result = await recurringExpenses.succeedRule(params.id, rule);
        setSaving(false);
        if (!result.ok) {
          setMessage(result.message);
          return false;
        }
        navigate(withReturnTo(`/finance/recurring/${params.id}`, "/finance/recurring"));
        return true;
      }
      const created = await recurringExpenses.createDraft({ title: title.trim(), rule });
      if (!created.ok) {
        setSaving(false);
        setMessage(created.message);
        return false;
      }
      if (alsoActivate) {
        const activated = await recurringExpenses.activate(created.value.series.id);
        setSaving(false);
        if (!activated.ok) {
          setMessage(activated.message);
          return false;
        }
        navigate(withReturnTo(`/finance/recurring/${created.value.series.id}`, "/finance/recurring"));
        return true;
      }
      setSaving(false);
      navigate(withReturnTo(`/finance/recurring/${created.value.series.id}`, "/finance/recurring"));
      return true;
    } finally {
      saveInFlightRef.current = false;
    }
  }

  if (!recurringExpenses || (!loaded && editMode)) {
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة قاعدة التذكير…
      </div>
    );
  }

  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">{editMode ? "تعديل مستقبلي موثق" : "تذكير مصروف متكرر"}</span>
        <h1>{editMode ? "غيّر قاعدة المستقبل فقط" : "ما المصروف الذي يتكرر عليك؟"}</h1>
        <p>
          التذكير يذكّرك فقط — لا يُسجَّل مبلغ ولا يُنشئ حدثًا بغير تأكيدك الصريح عند كل فترة، والتاريخ
          المقَرَّر محمي من أي تعديل لاحق.
        </p>
      </div>
      <section className="micro-decision-card" aria-label="وعد التذكير">
        <div>
          <span>لا كتابة مالية من هذا المحرر</span>
          <strong>تذكير تحت سيطرتك الكاملة</strong>
          <p>إيقاف واستئناف وتخطٍ وتأجيل وإلغاء مستقبلي — كلها قرارات موثقة، والمتأخر انتباه لا دين.</p>
        </div>
      </section>
      <section className="micro-form-card">
        {!editMode ? (
          <>
            <label className="micro-field">
              <span>عنوان التذكير</span>
              <input
                value={title}
                maxLength={80}
                onChange={event => setTitle(event.target.value)}
                placeholder="إيجار المحل مثلًا"
              />
            </label>
            <LocalDateField
              label="تاريخ التقويم الأول"
              description="أول شهر يبدأ منه حساب التذكير بتوقيت عمّان"
              value={anchorDate}
              onChange={event => setAnchorDate(event.target.value)}
            />
          </>
        ) : (
          <>
            <label className="micro-field">
              <span>القاعدة تسري من فترة (YYYY-MM)</span>
              <input
                type="month"
                lang="en"
                dir="ltr"
                value={effectiveFromPeriod}
                onChange={event => setEffectiveFromPeriod(event.target.value)}
              />
              <small>الفترات قبلها تبقى بمراجعتها الأصلية — التاريخ المحفوظ لا يُمس.</small>
            </label>
            <label className="micro-field">
              <span>سبب التغيير (موثق)</span>
              <input
                value={changeReason}
                maxLength={80}
                onChange={event => setChangeReason(event.target.value)}
              />
            </label>
          </>
        )}
        <label className="micro-field">
          <span>يوم الاستحقاق من الشهر (١–٣١)</span>
          <input
            type="number"
            min={1}
            max={31}
            lang="en"
            dir="ltr"
            value={dueDay}
            onChange={event => setDueDay(event.target.value)}
          />
        </label>
        <label className="micro-field">
          <span>سلوك الأشهر القصيرة</span>
          <select
            value={monthEndPolicy}
            onChange={event => setMonthEndPolicy(event.target.value as RecurringExpenseMonthEndPolicy)}
          >
            {MONTH_END_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="micro-field">
          <span>كل كم شهر (١–١٢)</span>
          <input
            type="number"
            min={1}
            max={12}
            lang="en"
            dir="ltr"
            value={interval}
            onChange={event => setIntervalMonths(event.target.value)}
          />
        </label>
        <label className="micro-field">
          <span>نمط المبلغ</span>
          <select
            value={amountMode}
            onChange={event => setAmountMode(event.target.value as RecurringExpenseAmountMode)}
          >
            {AMOUNT_MODE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {amountMode !== "manual" ? (
          <label className="micro-field">
            <span>المبلغ المقترح (د.أ) — عرض قابل للتعديل، ليس تسجيلًا</span>
            <EnglishNumberInput
              kind="money"
              value={suggestedAmountMinor}
              allowEmpty={amountMode === "suggested"}
              onNumericChange={minor => setSuggestedAmountMinor(minor)}
              onEmptyChange={() => setSuggestedAmountMinor(null)}
              aria-label="المبلغ المقترح بالدينار"
            />
          </label>
        ) : null}
        <label className="micro-field">
          <span>تصنيف نصي (اختياري، ٨٠ حرفًا)</span>
          <input
            maxLength={80}
            value={categoryLabel}
            onChange={event => setCategoryLabel(event.target.value)}
          />
        </label>
        {message ? (
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          {editMode ? (
            <Button action="save" block disabled={saving} onClick={() => save(false)}>
              <Save aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ المراجعة الجديدة"}
            </Button>
          ) : (
            <>
              <Button action="save" block disabled={saving} onClick={() => save(true)}>
                <Save aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ وفعّل التذكير"}
              </Button>
              <Button action="secondary" block disabled={saving} onClick={() => save(false)}>
                احفظ كمسودة بلا تفعيل
              </Button>
            </>
          )}
        </div>
      </section>
    </section>
  );
}
