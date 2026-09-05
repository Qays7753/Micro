/**
 * المجموعة ٤ (عقد ٢٩): محرر القرض العميق — «هل أعطيت هذا المبلغ كقرض؟».
 * رحلة عملية: لمن، كم، متى، من أي مصدر — ومعاينة صريحة: «لا يُخصم من
 * ربحك — مالك ما زال لك، لكن عند غيره». المصدر (محفظة) وسم معلوماتي
 * للعرض؛ أثر الكاش الكلي من الحدث المالي المرتبط.
 */
import { Save, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { FormDraftRestoreBanner } from "@/components/forms/FormDraftRestoreBanner";
import { useFormDraft } from "@/components/forms/useFormDraft";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { formatLocalDate, formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";

export default function LoanEditor() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { loans, cashContinuity, notifyDataChanged, dataVersion, formDrafts } = usePrototypeServices();
  const [borrowerName, setBorrowerName] = useState("");
  const [principalMinor, setPrincipalMinor] = useState(0);
  const [validPrincipal, setValidPrincipal] = useState(true);
  const [loanDate, setLoanDate] = useState(() => localDateInAmman());
  const [sourceWalletId, setSourceWalletId] = useState("");
  const [wallets, setWallets] = useState<readonly { id: string; name: string }[]>([]);
  const [purposeNote, setPurposeNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(`loan-create-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  useEffect(() => {
    let active = true;
    cashContinuity.overview().then(result => {
      if (!active || !result.ok) return;
      setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, dataVersion]);

  const isDirty = useFormDirty([borrowerName, principalMinor, loanDate, sourceWalletId, purposeNote]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });
  /* المجموعة ٥ (عقد ٣٦): مسودة نصية لمحرر القرض — استعادة صريحة بعد الإغلاق؛
   * لا حدث مالي ولا حركة محفظة قبل الحفظ النهائي. */
  const draft = useFormDraft(formDrafts, "loan", "new", {
    borrowerName: "",
    principalMinor: 0,
    loanDate: localDateInAmman(),
    sourceWalletId: "",
    purposeNote: "",
  });
  const restoredFromOffer = useRef(false);
  useEffect(() => {
    if (!isDirty || draft.state.phase === "restore-offer") return;
    draft.onValuesChanged({ borrowerName, principalMinor, loanDate, sourceWalletId, purposeNote });
  }, [borrowerName, principalMinor, loanDate, sourceWalletId, purposeNote, isDirty, draft.state.phase]);
  useEffect(() => {
    if (draft.state.phase === "drafting" && restoredFromOffer.current) {
      restoredFromOffer.current = false;
      const saved = draft.state.values;
      setBorrowerName(String(saved.borrowerName ?? ""));
      setPrincipalMinor(Number(saved.principalMinor ?? 0));
      setLoanDate(String(saved.loanDate ?? localDateInAmman()));
      setSourceWalletId(String(saved.sourceWalletId ?? ""));
      setPurposeNote(String(saved.purposeNote ?? ""));
    }
    if (draft.state.phase === "restore-offer") restoredFromOffer.current = true;
  }, [draft.state.phase]);

  async function save(): Promise<boolean> {
    if (!borrowerName.trim()) {
      setMessage("أكمل اسم المستدين — مثال: أحمد، أم خالد، ورشة الجيران.");
      return false;
    }
    if (!validPrincipal || !Number.isInteger(principalMinor) || principalMinor <= 0) {
      setMessage("أدخل مبلغ القرض بالأرقام 0–9.");
      return false;
    }
    setMessage(null);
    setSaving(true);
    const result = await loans.create({
      borrowerName,
      principalMinor,
      loanDate,
      purposeNote: purposeNote.trim() || null,
      sourceWalletId: sourceWalletId || null,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    await draft.clearFormDraft();
    /* المجموعة ٤ (تصحيح مراجعة 4-c): الذهاب للتفاصيل يحمل مصدره — زر الرجوع
     * في التفاصيل يعود لقائمة القروض لا لقفزة مجهولة. */
    navigate(
      returnPath && returnPath !== "/loans"
        ? returnPath
        : withFrom(`/loans/${result.value.loan.id}`, "/loans"),
    );
    return true;
  }

  return (
    <section className="micro-page micro-loan-editor">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        القروض
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">قرض لشخص</span>
        <h1>أعطيت مالًا يُعاد</h1>
        <p>القرض مالك ينتقل من الصندوق إلى يد أمينة — يظهر «قائمًا» حتى يعود.</p>
      </div>
      {draft.state.phase === "restore-offer" ? (
        <FormDraftRestoreBanner
          savedAt={draft.state.savedAt}
          onRestore={draft.restoreDraft}
          onDiscard={draft.discardDraft}
        />
      ) : null}
      {draft.state.phase === "drafting" && draft.state.lastSavedAt ? (
        <p className="micro-offline-truth" role="status">
          مسودتك محفوظة محليًا — آخر حفظ{" "}
          <bdi dir="ltr">{formatLocalDate(localDateInAmman(draft.state.lastSavedAt))}</bdi>؛ لم تُسجّل أي حركة
          مالية بعد.
        </p>
      ) : null}
      <label className="micro-field">
        <span>اسم المستدين</span>
        <input
          value={borrowerName}
          onChange={event => setBorrowerName(event.target.value)}
          placeholder="مثال: أحمد، محمد، ورشة الجيران"
        />
      </label>
      <label className="micro-field">
        <span>مبلغ القرض (د.أ)</span>
        <EnglishNumberInput
          value={principalMinor}
          kind="money"
          onNumericChange={setPrincipalMinor}
          onTextValidityChange={setValidPrincipal}
          aria-label="مبلغ القرض"
        />
      </label>
      <LocalDateField
        label="تاريخ القرض"
        value={loanDate}
        onChange={event => setLoanDate(event.target.value)}
      />
      {wallets.length > 0 ? (
        <label className="micro-field">
          <span>دُفع من (اختياري — للعرض)</span>
          <select value={sourceWalletId} onChange={event => setSourceWalletId(event.target.value)}>
            <option value="">غير محدد</option>
            {wallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>
          <small>وسم يُعرض مع القرض؛ حركة المحفظة تُوزَّع لاحقًا من توزيع الكاش إن أردت.</small>
        </label>
      ) : null}
      <label className="micro-field">
        <span>ملاحظة أو سبب (اختياري)</span>
        <input
          value={purposeNote}
          onChange={event => setPurposeNote(event.target.value)}
          placeholder="مثال: مساعدة لحاجة، دفعة مقدمة لأحمد"
        />
      </label>
      <section className="micro-decision-card" aria-label="أثر الحفظ">
        <Users aria-hidden="true" />
        <div>
          <span>ماذا سيحدث؟</span>
          <strong>يخرج {formatMoneyMinor(principalMinor)} د.أ من الكاش</strong>
          <p>لا يُخصم من ربحك — مالك ما زال لك، لكن عند غيره. السداد يعيده لاحقًا دفعةً دفعة.</p>
        </div>
      </section>
      {message ? (
        <p className="micro-field-error" role="alert">
          {message}
        </p>
      ) : null}
      <div className="micro-form-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          <Save aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ القرض"}
        </button>
      </div>
      <p className="micro-offline-truth">يعمل بلا إنترنت — يُحفظ محليًا على جهازك.</p>
    </section>
  );
}
