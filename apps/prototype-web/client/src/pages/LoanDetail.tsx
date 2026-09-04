/**
 * المجموعة ٤ (عقد ٢٩): تفصيل القرض العميق — الأصل والدفعات والتاريخ.
 * سداد دفعة من ورقة سفلية، وتراجع دفعة خطأ بقرار موثق يبقي الأصل في
 * التاريخ. تصحيح القرض (اسم/مبلغ) عكس + بديل عبر الخدمة نفسها.
 */
import { HandCoins, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate, formatMoneyMinor } from "@/presentation/formatters";
import RepaymentSheet from "@/components/loans/RepaymentSheet";
import type { LoanRecord, LoanReading } from "@micro-domain/loan/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

type Reading = { loan: LoanRecord; reading: LoanReading; events: readonly FinancialEvent[] };

export default function LoanDetail() {
  const [loanId, setLoanId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { loans, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<{ phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; reading: Reading }>(
    { phase: "loading" },
  );
  const [repayOpen, setRepayOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [newBorrower, setNewBorrower] = useState("");
  const [newPrincipalMinor, setNewPrincipalMinor] = useState(0);
  const [validPrincipal, setValidPrincipal] = useState(true);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reversalTargetId, setReversalTargetId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  useEffect(() => {
    const match = window.location.pathname.match(/^\/loans\/([^/]+)$/);
    setLoanId(match?.[1] ?? null);
  }, []);

  const load = useCallback(() => {
    if (!loanId) return;
    loans.read(loanId).then(result => {
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      setState({ phase: "ready", reading: result.value });
    });
  }, [loans, loanId]);

  useEffect(load, [load, dataVersion]);

  if (state.phase === "loading") return <p className="micro-route-loading" role="status">جارٍ قراءة القرض…</p>;
  if (state.phase === "error")
    return (
      <section className="micro-page">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>القروض</button>
        <p className="micro-field-error" role="alert">{state.message}</p>
      </section>
    );
  const { loan, reading, events } = state.reading;

  /* تصحيح مراجعة 4-d: سبب التراجع داخل الصف بلا نافذة متصفح عائمة — نفس
   * نمط micro-inline-reversal في تفاصيل الأصل. */
  function confirmInlineReversal(repaymentId: string) {
    const trimmed = reversalReason.trim();
    if (!trimmed) return;
    setBusy(true);
    void loans.reverseRepayment(loan.id, repaymentId, trimmed).then(result => {
      setBusy(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(null);
      setReversalTargetId(null);
      setReversalReason("");
      notifyDataChanged();
      load();
    });
  }

  async function correctLoan() {
    if (!newBorrower.trim() && (!validPrincipal || !Number.isInteger(newPrincipalMinor) || newPrincipalMinor <= 0)) {
      setMessage("عدّل الاسم أو المبلغ قبل الحفظ.");
      return;
    }
    if (!reason.trim()) {
      setMessage("أكمل سبب التصحيح — التوثيق إلزامي.");
      return;
    }
    setBusy(true);
    const result = await loans.correctLoan(loan.id, {
      borrowerName: newBorrower.trim() || undefined,
      principalMinor: validPrincipal && Number.isInteger(newPrincipalMinor) && newPrincipalMinor > 0 ? newPrincipalMinor : undefined,
      reason,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(null);
    setReason("");
    setCorrectionOpen(false);
    notifyDataChanged();
    load();
  }

  return (
    <section className="micro-page micro-loan-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>القروض</button>
      <div className="micro-page-heading">
        <span className="micro-overline">{reading.status === "open" ? "قرض قائم" : "قرض مسدَّد"}</span>
        <h1>{loan.borrowerName}</h1>
        <p>
          أصل <MoneyValue minor={reading.principalMinor} /> د.أ · {formatLocalDate(loan.loanDate)}
          {loan.sourceWalletId ? " · دُفع من محفظة معلنة" : ""}
        </p>
      </div>

      <section className="micro-decision-card" aria-label="خلاصة القرض">
        <div>
          <span>المتبقي</span>
          <strong><MoneyValue minor={reading.outstandingMinor} /> د.أ</strong>
          <p>
            رجع منه <MoneyValue minor={reading.repaidActiveMinor} /> د.أ في {reading.repaymentCount} دفعة قائمة —
            المتبقي مشتق لا مخزن.
          </p>
        </div>
      </section>

      {reading.status === "open" ? (
        <div className="micro-form-actions">
          <button className="micro-button micro-button-primary" type="button" onClick={() => setRepayOpen(true)}>
            <HandCoins aria-hidden="true" /> سجّل دفعة سداد
          </button>
        </div>
      ) : (
        <section className="micro-note-card" aria-label="قرض مسدَّد">
          <p>مسدَّد بالكامل — يبقى في التاريخ للمراجعة، ولا يُحذف أبدًا.</p>
        </section>
      )}

      <button
        className="micro-text-action"
        type="button"
        aria-expanded={correctionOpen}
        onClick={() => {
          setCorrectionOpen(current => !current);
          setNewBorrower(loan.borrowerName);
          setNewPrincipalMinor(loan.principalMinor);
        }}
      >
        صحِّح بيانات القرض (اسم أو مبلغ)
      </button>
      {correctionOpen ? (
        <div className="micro-revision-form">
          <p className="micro-field-hint">
            التصحيح موثق: يُعكس الحدث الأصلي ويُسجَّل بديل، والتاريخ يبقى كاملًا. المبلغ الجديد لا ينزل دون المسدَّد القائم.
          </p>
          <label className="micro-field">
            <span>اسم المستدين</span>
            <input value={newBorrower} onChange={event => setNewBorrower(event.target.value)} />
          </label>
          <label className="micro-field">
            <span>مبلغ الأصل (د.أ)</span>
            <EnglishNumberInput
              value={newPrincipalMinor}
              kind="money"
              onNumericChange={setNewPrincipalMinor}
              onTextValidityChange={setValidPrincipal}
              aria-label="مبلغ الأصل الجديد"
            />
          </label>
          <label className="micro-field">
            <span>سبب التصحيح (مطلوب)</span>
            <input value={reason} onChange={event => setReason(event.target.value)} placeholder="مثال: المبلغ الصحيح 500 لا 450" />
          </label>
          <div className="micro-form-actions">
            <button className="micro-button micro-button-primary" type="button" disabled={busy} onClick={() => void correctLoan()}>
              <Save aria-hidden="true" /> احفظ التصحيح
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="micro-field-error" role="alert">{message}</p> : null}

      <details className="micro-finance-layer" open>
        <summary className="micro-finance-layer-summary">دفعات السداد ({loan.repayments.length})</summary>
        {loan.repayments.length === 0 ? (
          <p className="micro-field-hint">لا دفعات بعد — أول دفعة تُسجَّل من ورقة السداد.</p>
        ) : (
          <ul className="micro-events-list">
            {loan.repayments.map(repayment => (
              <li key={repayment.id} className="micro-event-row" data-reversed={repayment.reversal !== null}>
                <strong>
                  <MoneyValue minor={repayment.amountMinor} /> د.أ · {formatLocalDate(repayment.date)}
                </strong>
                <span>{repayment.note ?? "دفعة سداد"}</span>
                {repayment.reversal ? (
                  <small>معكوسة موثقة: {repayment.reversal.reason}</small>
                ) : reversalTargetId === repayment.id ? (
                  <span className="micro-inline-reversal">
                    <input
                      value={reversalReason}
                      onChange={event => setReversalReason(event.target.value)}
                      placeholder="سبب تراجع الدفعة (مطلوب)"
                      aria-label="سبب تراجع الدفعة"
                    />
                    <button
                      className="micro-text-action"
                      type="button"
                      disabled={busy || !reversalReason.trim()}
                      onClick={() => confirmInlineReversal(repayment.id)}
                    >
                      أكّد التراجع
                    </button>
                    <button
                      className="micro-text-action"
                      type="button"
                      onClick={() => {
                        setReversalTargetId(null);
                        setReversalReason("");
                      }}
                    >
                      إلغاء
                    </button>
                  </span>
                ) : (
                  <button
                    className="micro-text-action"
                    type="button"
                    disabled={busy}
                    onClick={() => setReversalTargetId(repayment.id)}
                  >
                    تراجع
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="micro-finance-layer">
        <summary className="micro-finance-layer-summary">أحداث القرض المالية ({events.length})</summary>
        <ul className="micro-events-list">
          {events.map(event => (
            <li key={event.id} className="micro-event-row" data-type={event.type}>
              <strong>{event.type === "loan_outgoing_cash" ? "إقراض" : "سداد"}</strong>
              <span><MoneyValue minor={event.amountMinor} /> د.أ · {formatLocalDate(event.occurredOn)}</span>
              {event.correctionType === "reverse" ? <small>تراجع موثق</small> : null}
            </li>
          ))}
        </ul>
      </details>
      <p className="micro-offline-truth">يعمل بلا إنترنت — كل التاريخ محفوظ محليًا على جهازك.</p>

      {repayOpen ? (
        <RepaymentSheet
          row={{ loan, reading }}
          onClose={() => setRepayOpen(false)}
          onDone={() => {
            setRepayOpen(false);
            notifyDataChanged();
            load();
          }}
        />
      ) : null}
    </section>
  );
}
