/**
 * المجموعة ٤ (عقد ٢٩): سطح القروض الصادرة — «الدَّين ليس مصروفًا». قائمة
 * قراءة من «مالي» بالمتبقي المشتق من الدفعات القائمة؛ سداد دفعة ورقة
 * سفلية سريعة بمعاينة أثرها (كاش يرتفع والقرض ينزل — لا ربح ولا مصروف).
 * FIN-001 (WS-178 — Wave 6): قسم مستقل أسفله «قروض أخذتها (التزام)» —
 * الاقتراض التزام يسدَّد لا دخل؛ خدمة القروض المستلمة تُحمّل ديناميكيًا
 * (سابقة EXE-014/D-034) فلا تدخل كومة الإقلاع ولا تُسجَّل في السياق،
 * وخدمة القروض الصادرة تُوفَّر من السياق عند اكتمال تحميلها الخامل.
 */
import {
  loanCountLabel,
  loanInstallmentCountLabel,
  loanOutstandingCountLabel,
} from "@/presentation/g5Plurals";
import { ArrowRight, HandCoins, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { getPrototypeLocalStore, usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import type { LoanOverviewRead, LoanSummaryRow } from "@/application/loans/loanService";
import type {
  ReceivedLoanOverviewRead,
  ReceivedLoanSummaryRow,
  ReceivedLoanService,
} from "@/application/loans/receivedLoanService";
import RepaymentSheet from "@/components/loans/RepaymentSheet";

import { Button, EmptyState } from "@/components/primitives";
type State =
  { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; overview: LoanOverviewRead };
type ServiceLoad<T> = { phase: "loading" } | { phase: "error" } | { phase: "ready"; service: T };
type ReceivedState =
  { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; overview: ReceivedLoanOverviewRead };

export default function Loans() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { loans, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [repayTarget, setRepayTarget] = useState<LoanSummaryRow | null>(null);
  /* FIN-001 (WS-178 — Wave 6): خدمة القروض المستلمة — النمط الديناميكي نفسه
   * (سابقة EXE-014/D-034)؛ لا تُسجَّل في السياق أبدًا. */
  const [receivedLoad, setReceivedLoad] = useState<ServiceLoad<ReceivedLoanService>>({ phase: "loading" });
  const [receivedAttempt, setReceivedAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setReceivedLoad({ phase: "loading" });
    import("@/application/loans/receivedLoanService")
      .then(module => {
        if (active)
          setReceivedLoad({
            phase: "ready",
            service: new module.ReceivedLoanService(getPrototypeLocalStore()),
          });
      })
      .catch(() => {
        if (active) setReceivedLoad({ phase: "error" });
      });
    return () => {
      active = false;
    };
  }, [receivedAttempt]);

  const load = useCallback(() => {
    if (!loans) return;
    loans.overview().then(result => {
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      /* Wave 4.4 — P-4.4-1: الصفوف والتجميع من القراءة الرسمية الواحدة. */
      setState({ phase: "ready", overview: result.value });
    });
  }, [loans]);

  useEffect(() => {
    if (loans) load();
  }, [load, dataVersion]);

  return (
    <section className="micro-page micro-loans-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> المالية
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">قروض أعطيتها</span>
        <h1>القروض</h1>
        <p>مالك ما زال لك، لكن عند غيرك — ليس مصروفًا ولا يخصم من ربحك لحظة الإقراض.</p>
      </div>
      {!loans ? (
        <p className="micro-route-loading" role="status">
          جارٍ تجهيز القروض…
        </p>
      ) : state.phase === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ قراءة القروض…
        </p>
      ) : state.phase === "error" ? (
        <section className="micro-empty-state" aria-label="تعذر قراءة القروض">
          <p className="micro-field-error" role="alert">
            {state.message}
          </p>
          <p>لم يتغير أي سجل — بياناتك كما هي؛ أعد المحاولة.</p>
          <Button action="save" onClick={() => load()}>
            إعادة المحاولة
          </Button>
        </section>
      ) : state.overview.rows.length === 0 ? (
        <EmptyState
          aria-label="لا قروض بعد"
          symbol={<Users />}
          title={<>لا قروض صادرة بعد.</>}
          description={<>سجّل قرضًا حين تعطي أحدًا مالًا واعدًا بإرجاعه.</>}
        />
      ) : (
        <>
          <LoansSummary overview={state.overview} />
          <ul className="micro-cards-list" aria-label="قائمة القروض">
            {state.overview.rows.map(row => (
              <LoanCard
                key={row.loan.id}
                row={row}
                onOpen={() => navigate(withReturnTo(`/loans/${row.loan.id}`, "/loans"))}
                onRepay={() => setRepayTarget(row)}
              />
            ))}
          </ul>
        </>
      )}
      <div className="micro-form-actions">
        <Button
          action="create"

          onClick={() => navigate(withReturnTo("/loans/new", "/loans"))}
        >
          <Plus aria-hidden="true" /> سجّل قرضًا
        </Button>
      </div>
      {loans && repayTarget ? (
        <RepaymentSheet
          service={loans}
          row={repayTarget}
          onClose={() => setRepayTarget(null)}
          onDone={() => {
            setRepayTarget(null);
            notifyDataChanged();
            load();
          }}
        />
      ) : null}
      {/* FIN-001 (WS-178 — Wave 6): القسم المستقل للقروض المستلمة — التزام
       * يسدَّد لا دخل؛ تاريخ الاستحقاق عرض فقط بلا مصروف ولا تنبيه. */}
      <ReceivedLoansSection load={receivedLoad} dataVersion={dataVersion} />
    </section>
  );
}

/* P-4.4-1: الخلاصة تقرأ التجميع الرسمي من خدمة القراءة — لا reduce داخل العرض. */
function LoansSummary({ overview }: { overview: LoanOverviewRead }) {
  const outstanding = overview.totals.outstandingMinor;
  const openCount = overview.rows.filter(row => row.reading.status === "open").length;
  return (
    <section className="micro-decision-card" aria-label="خلاصة القروض">
      <div>
        <span>قائم عند الناس</span>
        <strong>
          <MoneyValue minor={outstanding} /> د.أ
        </strong>
        <p>
          {loanOutstandingCountLabel(openCount)} من أصل {loanCountLabel(overview.rows.length)} — المسدَّد يبقى
          في التاريخ للمراجعة.
        </p>
      </div>
    </section>
  );
}

function LoanCard({
  row,
  onOpen,
  onRepay,
}: {
  row: LoanSummaryRow;
  onOpen: () => void;
  onRepay: () => void;
}) {
  const loan = row.loan;
  return (
    <li>
      <article className="micro-loan-card" data-status={row.reading.status}>
        <button className="micro-text-action" type="button" onClick={onOpen}>
          <strong dir="auto">{loan.borrowerName}</strong>
        </button>
        <p>
          أصل <MoneyValue minor={row.reading.principalMinor} /> د.أ · {formatLocalDate(loan.loanDate)} ·{" "}
          {row.reading.status === "open" ? (
            <>
              متبقٍ <MoneyValue minor={row.reading.outstandingMinor} /> د.أ
            </>
          ) : (
            "مسدَّد بالكامل"
          )}
        </p>
        {row.reading.repaidActiveMinor > 0 ? (
          <p>
            رجع منه: <MoneyValue minor={row.reading.repaidActiveMinor} /> د.أ{" "}
            {loanInstallmentCountLabel(row.reading.repaymentCount)}
          </p>
        ) : null}
        {row.reading.status === "open" ? (
          <div className="micro-form-actions micro-contextual-actions">
            <Button action="secondary" onClick={onRepay}>
              <HandCoins aria-hidden="true" /> سجّل دفعة
            </Button>
          </div>
        ) : null}
      </article>
    </li>
  );
}

/* ─── FIN-001 (WS-178 — Wave 6): قسم القروض المستلمة (التزام) ───
 * كل رقم من خدمة القراءة المحمّلة ديناميكيًا؛ لا معادلة داخل العرض، ولا
 * لغة تنبيه للاستحقاق — وسم عرض فقط. */
function ReceivedLoansSection({
  load,
  dataVersion,
}: {
  load: ServiceLoad<ReceivedLoanService>;
  dataVersion: number;
}) {
  const [, navigate] = useLocation();
  const [state, setState] = useState<ReceivedState>({ phase: "loading" });
  useEffect(() => {
    if (load.phase !== "ready") return;
    let active = true;
    load.service.overview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      setState({ phase: "ready", overview: result.value });
    });
    return () => {
      active = false;
    };
  }, [load, dataVersion]);
  return (
    <section className="micro-received-loans-section" aria-label="قروض أخذتها (التزام)">
      <div className="micro-page-heading">
        <span className="micro-overline">قروض أخذتها (التزام)</span>
        <h2>القروض المستلمة</h2>
        <p>القرض المستلم يرفع الكاش ويرفع التزامًا — ليس دخلًا ولا ربحًا.</p>
      </div>
      {load.phase === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ قراءة القروض المستلمة…
        </p>
      ) : load.phase === "error" ? (
        <section className="micro-empty-state" aria-label="تعذر تجهيز خدمة القروض المستلمة">
          <p className="micro-field-error" role="alert">
            تعذر تجهيز خدمة القروض المستلمة — لم يتغير أي سجل.
          </p>
        </section>
      ) : state.phase === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ قراءة القروض المستلمة…
        </p>
      ) : state.phase === "error" ? (
        <section className="micro-empty-state" aria-label="تعذر قراءة القروض المستلمة">
          <p className="micro-field-error" role="alert">
            {state.message}
          </p>
          <p>لم يتغير أي سجل — بياناتك كما هي؛ أعد المحاولة.</p>
        </section>
      ) : state.overview.rows.length === 0 ? (
        <EmptyState
          aria-label="لا قروض مستلمة بعد"
          symbol={<Users />}
          title={<>لا قروض مستلمة بعد.</>}
          description={<>سجّل قرضًا أخذته حين يدخل مال غيرك جيبك واعدًا بإرجاعه.</>}
        />
      ) : (
        <>
          <section className="micro-decision-card" aria-label="التزام القروض المستلمة">
            <div>
              <span>التزام القروض المستلمة القائم</span>
              <strong>
                <MoneyValue minor={state.overview.totals.borrowedLoansOutstandingMinor} /> د.أ
              </strong>
              <p>
                {loanOutstandingCountLabel(state.overview.totals.openCount)} من أصل{" "}
                {loanCountLabel(state.overview.rows.length)} — سداد الأصل ينزل الالتزام والكاش معًا.
              </p>
            </div>
          </section>
          <ul className="micro-cards-list" aria-label="قائمة القروض المستلمة">
            {state.overview.rows.map(row => (
              <ReceivedLoanRow
                key={row.loan.id}
                row={row}
                onOpen={() => navigate(withReturnTo(`/loans/received/${row.loan.id}`, "/loans"))}
              />
            ))}
          </ul>
        </>
      )}
      <div className="micro-form-actions">
        <Button
          action="create"
          onClick={() => navigate(withReturnTo("/loans/received/new", "/loans"))}
        >
          <Plus aria-hidden="true" /> سجّل قرضًا أخذته
        </Button>
      </div>
    </section>
  );
}

function ReceivedLoanRow({ row, onOpen }: { row: ReceivedLoanSummaryRow; onOpen: () => void }) {
  const loan = row.loan;
  return (
    <li>
      <article className="micro-loan-card" data-status={row.reading.status}>
        <button className="micro-text-action" type="button" onClick={onOpen}>
          <strong dir="auto">{loan.lenderName}</strong>
        </button>
        <p>
          أصل <MoneyValue minor={row.reading.principalMinor} /> د.أ · {formatLocalDate(loan.receivedOn)} ·{" "}
          {row.reading.status === "open" ? (
            <>
              التزام قائم <MoneyValue minor={row.reading.outstandingMinor} /> د.أ
            </>
          ) : (
            "مسدَّد بالكامل"
          )}
        </p>
        {loan.dueOn ? <p>تاريخ استحقاق (عرض فقط): {formatLocalDate(loan.dueOn)}</p> : null}
        {row.reading.repaidActiveMinor > 0 ? (
          <p>
            سُدِّد من أصله: <MoneyValue minor={row.reading.repaidActiveMinor} /> د.أ{" "}
            {loanInstallmentCountLabel(row.reading.repaymentCount)}
          </p>
        ) : null}
      </article>
    </li>
  );
}
