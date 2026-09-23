/**
 * FIN-001 (WS-178 — Wave 6): تفصيل القرض المستلم — الأصل والتزام الاقتراض
 * ودفعات السداد والتاريخ. سداد أصل من ورقة سفلية، وتراجع دفعة خطأ بقرار
 * موثق يبقي القيد في التاريخ. تاريخ الاستحقاق وسم عرض فقط — بلا مصروف
 * ولا تنبيه. تصحيح القرض (مُقرض/مبلغ) عكس + بديل عبر الخدمة نفسها،
 * والخدمة تُحمَّل ديناميكيًا (سابقة EXE-014) فلا تدخل كومة الإقلاع.
 */
import { loanInstallmentCountLabel } from "@/presentation/g5Plurals";
import { HandCoins, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { getPrototypeLocalStore, usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import ReceivedLoanRepaymentSheet from "@/components/loans/ReceivedLoanRepaymentSheet";
import type { ReceivedLoanRecord, ReceivedLoanReading } from "@micro-domain/received-loan/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { ReceivedLoanService } from "@/application/loans/receivedLoanService";

import { Button } from "@/components/primitives";
type Reading = { loan: ReceivedLoanRecord; reading: ReceivedLoanReading; events: readonly FinancialEvent[] };
type ServiceLoad =
  { phase: "loading" } | { phase: "error" } | { phase: "ready"; service: ReceivedLoanService };

export default function ReceivedLoanDetail() {
  const [loanId, setLoanId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<
    { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; reading: Reading }
  >({ phase: "loading" });
  const [repayOpen, setRepayOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [newLender, setNewLender] = useState("");
  const [newPrincipalMinor, setNewPrincipalMinor] = useState(0);
  const [validPrincipal, setValidPrincipal] = useState(true);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reversalTargetId, setReversalTargetId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  useEffect(() => {
    const match = window.location.pathname.match(/^\/loans\/received\/([^/]+)$/);
    setLoanId(match?.[1] ?? null);
  }, []);

  /* FIN-001 (WS-178 — Wave 6، سابقة EXE-014/D-034): تحميل ديناميكي فوق المخزن الوحيد. */
  const [serviceLoad, setServiceLoad] = useState<ServiceLoad>({ phase: "loading" });
  const [serviceAttempt, setServiceAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setServiceLoad({ phase: "loading" });
    import("@/application/loans/receivedLoanService")
      .then(module => {
        if (active)
          setServiceLoad({
            phase: "ready",
            service: new module.ReceivedLoanService(getPrototypeLocalStore()),
          });
      })
      .catch(() => {
        if (active) setServiceLoad({ phase: "error" });
      });
    return () => {
      active = false;
    };
  }, [serviceAttempt]);

  const load = useCallback(() => {
    if (!loanId || serviceLoad.phase !== "ready") return;
    serviceLoad.service.read(loanId).then(result => {
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      setState({ phase: "ready", reading: result.value });
    });
  }, [serviceLoad, loanId]);

  useEffect(() => {
    if (serviceLoad.phase === "loading") setState({ phase: "loading" });
    if (serviceLoad.phase === "ready") load();
  }, [load, serviceLoad, dataVersion]);

  if (serviceLoad.phase === "loading")
    return (
      <p className="micro-route-loading" role="status">
        جارٍ قراءة القرض المستلم…
      </p>
    );
  if (serviceLoad.phase === "error")
    return (
      <section className="micro-page">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
          القروض
        </button>
        <p className="micro-field-error" role="alert">
          تعذر تجهيز خدمة القروض المستلمة — لم يتغير أي سجل.
        </p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setServiceAttempt(attempt => attempt + 1)}>
            إعادة المحاولة
          </Button>
        </div>
      </section>
    );
  if (state.phase === "loading")
    return (
      <p className="micro-route-loading" role="status">
        جارٍ قراءة القرض المستلم…
      </p>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
          القروض
        </button>
        <p className="micro-field-error" role="alert">
          {state.message}
        </p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => load()}>
            إعادة المحاولة
          </Button>
        </div>
      </section>
    );
  const { loan, reading, events } = state.reading;

  /* سبب التراجع داخل الصف بلا نافذة متصفح عائمة — نفس نمط تفاصيل القرض الصادر. */
  function confirmInlineReversal(repaymentId: string) {
    const trimmed = reversalReason.trim();
    if (!trimmed || serviceLoad.phase !== "ready") return;
    setBusy(true);
    void serviceLoad.service.reverseRepayment(loan.id, repaymentId, trimmed).then(result => {
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
    if (
      !newLender.trim() &&
      (!validPrincipal || !Number.isInteger(newPrincipalMinor) || newPrincipalMinor <= 0)
    ) {
      setMessage("عدّل اسم المُقرض أو المبلغ قبل الحفظ.");
      return;
    }
    if (!reason.trim()) {
      setMessage("أكمل سبب التصحيح — التوثيق إلزامي.");
      return;
    }
    if (serviceLoad.phase !== "ready") return;
    setBusy(true);
    const result = await serviceLoad.service.correctLoan(loan.id, {
      lenderName: newLender.trim() || undefined,
      principalMinor:
        validPrincipal && Number.isInteger(newPrincipalMinor) && newPrincipalMinor > 0
          ? newPrincipalMinor
          : undefined,
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
    <section className="micro-page micro-loan-detail micro-received-loan-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        القروض
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">
          {reading.status === "open" ? "قرض مستلم قائم" : "قرض مستلم مسدَّد"}
        </span>
        <h1>{loan.lenderName}</h1>
        <p>
          أصل <MoneyValue minor={reading.principalMinor} /> د.أ · {formatLocalDate(loan.receivedOn)}
          {loan.walletId ? " · دخل إلى محفظة معلنة" : ""}
        </p>
      </div>

      <section className="micro-decision-card" aria-label="خلاصة القرض المستلم">
        <div>
          <span>الالتزام القائم</span>
          <strong>
            <MoneyValue minor={reading.outstandingMinor} /> د.أ
          </strong>
          <p>
            سُدِّد من أصله <MoneyValue minor={reading.repaidActiveMinor} /> د.أ{" "}
            {loanInstallmentCountLabel(reading.repaymentCount)} — المتبقي مشتق لا مخزن، ولا يمس الربح.
          </p>
        </div>
      </section>

      {loan.dueOn ? (
        <section className="micro-note-card" aria-label="تاريخ الاستحقاق (عرض فقط)">
          <p>
            تاريخ استحقاق (عرض فقط): {formatLocalDate(loan.dueOn)} — للمعلومة فقط، لا يُنشئ مصروفًا ولا
            تنبيهًا.
          </p>
        </section>
      ) : null}

      {reading.status === "open" ? (
        <div className="micro-form-actions">
          <Button
            action="create"

            onClick={() => setRepayOpen(true)}
          >
            <HandCoins aria-hidden="true" /> سجّل دفعة سداد أصل
          </Button>
        </div>
      ) : (
        <section className="micro-note-card" aria-label="قرض مستلم مسدَّد">
          <p>مسدَّد بالكامل — يبقى في التاريخ للمراجعة، ولا يُحذف أبدًا.</p>
        </section>
      )}

      <button
        className="micro-text-action"
        type="button"
        aria-expanded={correctionOpen}
        onClick={() => {
          setCorrectionOpen(current => !current);
          setNewLender(loan.lenderName);
          setNewPrincipalMinor(loan.principalMinor);
        }}
      >
        صحِّح بيانات القرض المستلم (مُقرض أو مبلغ)
      </button>
      {correctionOpen ? (
        <div className="micro-revision-form">
          <p className="micro-field-hint">
            التصحيح موثق: يُعكس الحدث الأصلي ويُسجَّل بديل، والتاريخ يبقى كاملًا. المبلغ الجديد لا ينزل دون
            المسدَّد القائم.
          </p>
          <label className="micro-field">
            <span>اسم المُقرض</span>
            <input value={newLender} onChange={event => setNewLender(event.target.value)} />
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
            <input
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="مثال: المبلغ الصحيح 500 لا 450"
            />
          </label>
          <div className="micro-form-actions">
            <Button
              action="save"

              disabled={busy}
              onClick={() => void correctLoan()}
            >
              <Save aria-hidden="true" /> احفظ التصحيح
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="micro-field-error" role="alert">
          {message}
        </p>
      ) : null}

      <details className="micro-finance-layer" open>
        <summary className="micro-finance-layer-summary">دفعات سداد الأصل ({loan.repayments.length})</summary>
        {loan.repayments.length === 0 ? (
          <p className="micro-field-hint">لا دفعات بعد — أول دفعة تُسجَّل من ورقة السداد.</p>
        ) : (
          <ul className="micro-events-list">
            {loan.repayments.map(repayment => (
              <li key={repayment.id} className="micro-event-row" data-reversed={repayment.reversal !== null}>
                <strong>
                  <MoneyValue minor={repayment.amountMinor} /> د.أ · {formatLocalDate(repayment.date)}
                </strong>
                <span>{repayment.note ?? "دفعة سداد أصل"}</span>
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
        <summary className="micro-finance-layer-summary">
          أحداث القرض المستلم المالية ({events.length})
        </summary>
        <ul className="micro-events-list">
          {events.map(event => (
            <li key={event.id} className="micro-event-row" data-type={event.type}>
              <strong>{event.type === "loan_received_cash" ? "قبض الاقتراض" : "سداد أصل"}</strong>
              <span>
                <MoneyValue minor={event.amountMinor} /> د.أ · {formatLocalDate(event.occurredOn)}
              </span>
              {event.correctionType === "reverse" ? <small>تراجع موثق</small> : null}
            </li>
          ))}
        </ul>
      </details>
      <p className="micro-offline-truth">يعمل بلا إنترنت — كل التاريخ محفوظ محليًا على جهازك.</p>

      {repayOpen && serviceLoad.phase === "ready" ? (
        <ReceivedLoanRepaymentSheet
          service={serviceLoad.service}
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
