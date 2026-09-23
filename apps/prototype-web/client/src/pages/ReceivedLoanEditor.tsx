/**
 * FIN-001 (WS-178 — Wave 6): محرر القرض المستلم — «أخذت هذا المبلغ قرضًا؟».
 * رحلة عملية: من، من أي نوع اقتصادي (اختيار صريح لا افتراضي — مالك/فرد/
 * مؤسسة)، كم، متى دخل، متى يُستحق (للمعلومة فقط — لا ينشئ مصروفًا ولا
 * تنبيهًا)، من أي محفظة (وسم عرض). معاينة صريحة: «القرض المستلم يرفع
 * الكاش ويرفع التزامًا — ليس دخلًا ولا ربحًا». الخدمة تُحمَّل ديناميكيًا
 * (سابقة EXE-014) فلا تدخل كومة الإقلاع ولا تسجَّل في سياق الخدمات.
 */
import { Save, Landmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { getPrototypeLocalStore, usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type { ReceivedLoanLenderType } from "@micro-domain/received-loan/index.js";
import type { ReceivedLoanService } from "@/application/loans/receivedLoanService";

import { Button } from "@/components/primitives";
type ServiceLoad =
  { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; service: ReceivedLoanService };

/* خيارات النوع الاقتصادي — اختيار المستخدم الصريح لا تخمين التطبيق. */
const LENDER_TYPE_OPTIONS: readonly { value: ReceivedLoanLenderType; label: string }[] = [
  { value: "owner", label: "قرض من المالك" },
  { value: "person", label: "قرض من فرد" },
  { value: "institution", label: "قرض من مؤسسة" },
];

export default function ReceivedLoanEditor() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { cashContinuity, notifyDataChanged, dataVersion } = usePrototypeServices();
  const [lenderName, setLenderName] = useState("");
  /* النوع الاقتصادي يبدأ بلا اختيار — لا افتراضي ولا تخمين بين قرض
   * وتحويل ورأس مال؛ المستخدم يختار صراحةً قبل الحفظ. */
  const [lenderType, setLenderType] = useState<ReceivedLoanLenderType | "">("");
  const [principalMinor, setPrincipalMinor] = useState(0);
  const [validPrincipal, setValidPrincipal] = useState(true);
  const [receivedOn, setReceivedOn] = useState(() => localDateInAmman());
  const [dueOn, setDueOn] = useState("");
  const [wallets, setWallets] = useState<readonly { id: string; name: string }[]>([]);
  const [walletId, setWalletId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);
  const [saving, setSaving] = useState(false);
  /* عهدة تزامنية ضد الإرسال المزدوج (A2/AI-02 نفسها في محرر القرض الصادر). */
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    cashContinuity.overview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setFieldError(false);
        setMessage(result.message);
        return;
      }
      setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, dataVersion]);

  const isDirty = useFormDirty([lenderName, lenderType, principalMinor, receivedOn, dueOn, walletId, note]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  /* FIN-001 (WS-178 — Wave 6، سابقة EXE-014/D-034): خدمة القروض المستلمة
   * تُحمَّل ديناميكيًا فوق المخزن الوحيد — لا تُسجَّل في السياق أبدًا. */
  const [serviceLoad, setServiceLoad] = useState<ServiceLoad>({ phase: "loading" });
  const [serviceAttempt, setServiceAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setServiceLoad({ phase: "loading" });
    import("@/application/loans/receivedLoanService")
      .then(module => {
        if (active)
          setServiceLoad({ phase: "ready", service: new module.ReceivedLoanService(getPrototypeLocalStore()) });
      })
      .catch(() => {
        if (active) setServiceLoad({ phase: "error" });
      });
    return () => {
      active = false;
    };
  }, [serviceAttempt]);

  async function save(): Promise<boolean> {
    if (saveInFlightRef.current) return false;
    if (!lenderName.trim()) {
      setFieldError(true);
      setMessage("أكمل اسم المُقرض — مثال: أحمد، أم خالد، مؤسسة التمويل الأهلية.");
      return false;
    }
    if (!lenderType) {
      setFieldError(true);
      setMessage("اختر نوع المُقرض صراحةً: مالك / فرد / مؤسسة — لا يُخمَّن.");
      return false;
    }
    if (!validPrincipal || !Number.isInteger(principalMinor) || principalMinor <= 0) {
      setFieldError(true);
      setMessage("أدخل مبلغ القرض بالأرقام 0–9.");
      return false;
    }
    if (dueOn && dueOn < receivedOn) {
      setFieldError(true);
      setMessage("تاريخ الاستحقاق لا يمكن أن يسبق تاريخ قبض القرض.");
      return false;
    }
    if (serviceLoad.phase !== "ready") {
      setMessage("جارٍ تجهيز خدمة القروض المستلمة — أعد المحاولة بعد لحظة.");
      return false;
    }
    setMessage(null);
    setFieldError(false);
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const result = await serviceLoad.service.create({
        lenderName,
        lenderType,
        principalMinor,
        receivedOn,
        dueOn: dueOn || null,
        note: note.trim() || null,
        walletId: walletId || null,
      });
      if (!result.ok) {
        setFieldError(false);
        setMessage(result.message);
        return false;
      }
      notifyDataChanged();
      navigate(
        returnPath && returnPath !== "/loans"
          ? returnPath
          : withReturnTo(`/loans/received/${result.value.loan.id}`, "/loans"),
      );
      return true;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="micro-page micro-loan-editor micro-received-loan-editor">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        القروض
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">قرض أخذته (التزام)</span>
        <h1>استلمت مالًا يُعاد</h1>
        <p>القرض المستلم يرفع الكاش ويرفع التزامًا — ليس دخلًا ولا ربحًا.</p>
      </div>
      {serviceLoad.phase === "error" ? (
        <section className="micro-empty-state" aria-label="تعذر تجهيز خدمة القروض المستلمة">
          <p className="micro-field-error" role="alert">
            تعذر تجهيز خدمة القروض المستلمة — لم يتغير أي سجل.
          </p>
          <Button action="save" onClick={() => setServiceAttempt(attempt => attempt + 1)}>
            إعادة المحاولة
          </Button>
        </section>
      ) : null}
      <label className="micro-field">
        <span>اسم المُقرض</span>
        <input
          value={lenderName}
          onChange={event => setLenderName(event.target.value)}
          placeholder="مثال: أحمد، أم خالد، مؤسسة التمويل الأهلية"
          aria-invalid={fieldError}
          aria-describedby={message ? "received-loan-form-error" : undefined}
        />
      </label>
      <label className="micro-field">
        <span>نوع المُقرض (اختيارك الصريح)</span>
        <select
          value={lenderType}
          onChange={event =>
            setLenderType(
              event.target.value === "owner" || event.target.value === "person" || event.target.value === "institution"
                ? event.target.value
                : "",
            )
          }
          aria-invalid={fieldError}
          aria-describedby={message ? "received-loan-form-error" : undefined}
        >
          <option value="">اختر نوع المُقرض صراحةً</option>
          {LENDER_TYPE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small>لا يُخمَّن نيابةً عنك بين قرض وتحويل ورأس مال.</small>
      </label>
      <label className="micro-field">
        <span>مبلغ القرض (د.أ)</span>
        <EnglishNumberInput
          value={principalMinor}
          kind="money"
          onNumericChange={setPrincipalMinor}
          onTextValidityChange={setValidPrincipal}
          aria-label="مبلغ القرض"
          aria-invalid={fieldError}
          aria-describedby={message ? "received-loan-form-error" : undefined}
        />
      </label>
      <LocalDateField
        label="تاريخ قبض القرض"
        value={receivedOn}
        onChange={event => setReceivedOn(event.target.value)}
      />
      <LocalDateField
        label="تاريخ الاستحقاق (للمعلومة فقط — لا ينشئ مصروفًا ولا تنبيهًا)"
        value={dueOn}
        onChange={event => setDueOn(event.target.value)}
      />
      {wallets.length > 0 ? (
        <label className="micro-field">
          <span>دخل إلى (اختياري — للعرض)</span>
          <select value={walletId} onChange={event => setWalletId(event.target.value)}>
            <option value="">غير محدد</option>
            {wallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>
          <small>وسم يُعرض مع القرض؛ حركة الكاش من حدثه المالي وحده.</small>
        </label>
      ) : null}
      <label className="micro-field">
        <span>ملاحظة أو سبب (اختياري)</span>
        <input
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder="مثال: سيولة لشراء خامة، دفعة من المالك لتغطية موسم"
        />
      </label>
      <section className="micro-decision-card" aria-label="أثر الحفظ">
        <Landmark aria-hidden="true" />
        <div>
          <span>ماذا سيحدث؟</span>
          <strong>يدخل {formatMoneyMinor(principalMinor)} د.أ إلى الكاش ويرتفع التزام بمثلها</strong>
          <p>التزام يسدَّد لاحقًا أصلًا أصلًا — سداده ينزل الكاش والالتزام معًا ولا يمس ربحك.</p>
        </div>
      </section>
      {message ? (
        <p className="micro-field-error" role="alert" id="received-loan-form-error">
          {message}
        </p>
      ) : null}
      <div className="micro-form-actions">
        <Button
          action="save"

          disabled={saving}
          onClick={() => void save()}
        >
          <Save aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ القرض المستلم"}
        </Button>
      </div>
      <p className="micro-offline-truth">يعمل بلا إنترنت — يُحفظ محليًا على جهازك.</p>
    </section>
  );
}
