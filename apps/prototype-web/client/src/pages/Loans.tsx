/**
 * المجموعة ٤ (عقد ٢٩): سطح القروض الصادرة — «الدَّين ليس مصروفًا». قائمة
 * قراءة من «مالي» بالمتبقي المشتق من الدفعات القائمة؛ سداد دفعة ورقة
 * سفلية سريعة بمعاينة أثرها (كاش يرتفع والقرض ينزل — لا ربح ولا مصروف).
 */
import { HandCoins, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import type { LoanSummaryRow } from "@/application/loans/loanService";
import RepaymentSheet from "@/components/loans/RepaymentSheet";

type State = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; rows: readonly LoanSummaryRow[] };

export default function Loans() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { loans, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [repayTarget, setRepayTarget] = useState<LoanSummaryRow | null>(null);

  const load = useCallback(() => {
    loans.overview().then(result => {
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      setState({ phase: "ready", rows: result.value });
    });
  }, [loans]);

  useEffect(load, [load, dataVersion]);

  return (
    <section className="micro-page micro-loans-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        مالي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">قروض أعطيتها</span>
        <h1>القروض</h1>
        <p>مالك ما زال لك، لكن عند غيرك — ليس مصروفًا ولا يخصم من ربحك لحظة الإقراض.</p>
      </div>
      {state.phase === "loading" ? (
        <p className="micro-route-loading" role="status">جارٍ قراءة القروض…</p>
      ) : state.phase === "error" ? (
        <p className="micro-field-error" role="alert">{state.message}</p>
      ) : state.rows.length === 0 ? (
        <section className="micro-empty-state" aria-label="لا قروض بعد">
          <Users aria-hidden="true" />
          <p>لا قروض صادرة بعد. سجّل قرضًا حين تعطي أحدًا مالًا واعدًا بإرجاعه.</p>
        </section>
      ) : (
        <>
          <LoansSummary rows={state.rows} />
          <ul className="micro-cards-list" aria-label="قائمة القروض">
            {state.rows.map(row => (
              <LoanCard
                key={row.loan.id}
                row={row}
                onOpen={() => navigate(withFrom(`/loans/${row.loan.id}`, "/loans"))}
                onRepay={() => setRepayTarget(row)}
              />
            ))}
          </ul>
        </>
      )}
      <div className="micro-form-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(withFrom("/loans/new", "/loans"))}
        >
          <Plus aria-hidden="true" /> سجّل قرضًا
        </button>
      </div>
      {repayTarget ? (
        <RepaymentSheet
          row={repayTarget}
          onClose={() => setRepayTarget(null)}
          onDone={() => {
            setRepayTarget(null);
            notifyDataChanged();
            load();
          }}
        />
      ) : null}
    </section>
  );
}

function LoansSummary({ rows }: { rows: readonly LoanSummaryRow[] }) {
  const outstanding = rows.reduce((sum, row) => sum + row.reading.outstandingMinor, 0);
  const openCount = rows.filter(row => row.reading.status === "open").length;
  return (
    <section className="micro-decision-card" aria-label="خلاصة القروض">
      <div>
        <span>قائم عند الناس</span>
        <strong><MoneyValue minor={outstanding} /> د.أ</strong>
        <p>
          {openCount} قرضًا قائمًا من أصل {rows.length} — المسدَّد يبقى في التاريخ للمراجعة.
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
          <strong>{loan.borrowerName}</strong>
        </button>
        <p>
          أصل <MoneyValue minor={row.reading.principalMinor} /> د.أ · {formatLocalDate(loan.loanDate)} ·{" "}
          {row.reading.status === "open" ? (
            <>متبقٍ <MoneyValue minor={row.reading.outstandingMinor} /> د.أ</>
          ) : (
            "مسدَّد بالكامل"
          )}
        </p>
        {row.reading.repaidActiveMinor > 0 ? (
          <p>رجع منه: <MoneyValue minor={row.reading.repaidActiveMinor} /> د.أ في {row.reading.repaymentCount} دفعة</p>
        ) : null}
        {row.reading.status === "open" ? (
          <div className="micro-form-actions micro-contextual-actions">
            <button className="micro-button micro-button-secondary" type="button" onClick={onRepay}>
              <HandCoins aria-hidden="true" /> سجّل دفعة
            </button>
          </div>
        ) : null}
      </article>
    </li>
  );
}
