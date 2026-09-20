/**
 * Stage 2 — OPS-005/OPS-006 (tracker): سطح «القادم والاستحقاقات» — قراءة
 * موحّدة لما يقترب موعده وما تأخر: طلبات مجدولة ومدفوعات موردين وتحصيلات
 * والتزامات، بمعنى ومصدر معلنين لكل نوع تاريخ، وتقادم مبسط (متأخر/حالي/بلا
 * تاريخ) بلا شرائح 30/60/90. قراءة فقط: الفتح لا يكتب سجلًا واحدًا، وفشل أي
 * كتلة يعزل نفسه ببطاقة صادقة وإعادة محاولة (نمط G-005) والأسطح السليمة
 * تبقى حية؛ المجهول يبقى «بلا تاريخ مخزّن» صراحةً — غياب التاريخ ليس غياب
 * الدين، ولا يتحول إلى تاريخ اليوم أو صفر أبدًا.
 */
import { ArrowRight, CalendarClock } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type {
  UpcomingBlockResult,
  UpcomingEntry,
  UpcomingOverview,
} from "@/application/finance/upcomingService";
import { financialEventLabel } from "@/presentation/financialEventLabels";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";

import { Button } from "@/components/primitives";

type PageState = { phase: "loading" } | { phase: "ready"; overview: UpcomingOverview };

/* Stage 2 — OPS-005: تسمية حالة الموعد الصادقة — الحالي والمستحق اليوم
 * والمتأخر من المصدر المعلن لكل نوع تاريخ؛ لا اختراع تاريخ ولا صفر. */
const DUE_STATE_LABELS: Record<"overdue" | "today" | "upcoming", string> = {
  overdue: "متأخر",
  today: "مستحق اليوم",
  upcoming: "قادم",
};
const dueStateLabel = (state: string): string | null =>
  state in DUE_STATE_LABELS ? DUE_STATE_LABELS[state as "overdue" | "today" | "upcoming"] : null;

/* Stage 2 — OPS-005: رسائل فشل الكتل — نصوص لحظة الفشل بنمط message: الكنوني
 * (معيار G-005/CorrectionsLayer) لا تُعرض إلا عند تعذر قراءة كتلتها. */
const BLOCK_FAILURE_MESSAGES: Record<
  "orders" | "payables" | "receivables" | "obligations",
  { message: string }
> = {
  orders: { message: "تعذّرت قراءة الطلبات المجدولة — هذا الجزء وحده." },
  payables: { message: "تعذّرت قراءة مدفوعات الموردين — هذا الجزء وحده." },
  receivables: { message: "تعذّرت قراءة ذمم التحصيل — هذا الجزء وحده." },
  obligations: { message: "تعذّرت قراءة الالتزامات المستحقة — هذا الجزء وحده." },
};

type UpcomingBlockKey = keyof typeof BLOCK_FAILURE_MESSAGES;

export default function FinanceUpcoming() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { upcoming, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    upcoming.readOverview().then(overview => {
      if (!active) return;
      setState({ phase: "ready", overview });
    });
    return () => {
      active = false;
    };
  }, [dataVersion, upcoming, retryCount]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة القادم والاستحقاقات…
      </div>
    );
  const { overview } = state;
  const openSource = (href: string) => navigate(withReturnTo(href, "/finance/upcoming"));
  const retry = () => setRetryCount(count => count + 1);
  return (
    <section className="micro-page micro-finance-more-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/finance" ? "المالية" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">ما يقترب وما تأخر</span>
        <h1>القادم والاستحقاقات</h1>
        <p>كل موعد بمعناه ومصدره — طلبات ومدفوعات وتحصيلات والتزامات، بلا كتابة أي سجل.</p>
      </div>

      {/* OPS-006: التقادم المبسط — متأخر/حالي/بلا تاريخ، بلا شرائح 30/60/90. */}
      <section className="micro-decision-card" aria-label="تقادم مبسط">
        <CalendarClock aria-hidden="true" />
        <div>
          <span>تقادم مبسط</span>
          <strong>ما يستحق وما تأخر</strong>
          <div className="micro-supplier-totals">
            <p>
              ما عليك للموردين:{" "}
              {overview.aging.payables ? (
                <>
                  متأخر{" "}
                  <MoneyValue minor={overview.aging.payables.overdueMinor} className="micro-inline-number" />{" "}
                  · لم يحن{" "}
                  <MoneyValue minor={overview.aging.payables.currentMinor} className="micro-inline-number" />{" "}
                  · بلا تاريخ{" "}
                  <MoneyValue minor={overview.aging.payables.unknownMinor} className="micro-inline-number" />
                </>
              ) : (
                "غير متاح"
              )}
            </p>
            <p>
              ما لك عند الناس:{" "}
              {overview.aging.receivables ? (
                <>
                  <MoneyValue minor={overview.aging.receivables.totalMinor} className="micro-inline-number" />{" "}
                  — بلا تاريخ استحقاق مخزّن
                </>
              ) : (
                "غير متاح"
              )}
            </p>
            <p>
              التزامات مصاريف مستحقة:{" "}
              {overview.aging.obligations ? (
                <>
                  <MoneyValue minor={overview.aging.obligations.totalMinor} className="micro-inline-number" />{" "}
                  — بلا تاريخ استحقاق مخزّن
                </>
              ) : (
                "غير متاح"
              )}
            </p>
          </div>
          <p>تصنيف مبسط بلا شرائح 30/60/90 — التقادم المتقدم مؤجل بدليله.</p>
        </div>
      </section>

      <UpcomingBlock
        blockKey="orders"
        title="طلبات قادمة ومتأخرة"
        result={overview.orders}
        empty="لا توجد طلبات مجدولة قادمة."
        retry={retry}
        renderEntry={entry => <OrderRow entry={entry} openSource={openSource} />}
      />
      <UpcomingBlock
        blockKey="payables"
        title="مدفوعات قادمة للموردين"
        result={overview.payables}
        empty="لا توجد مدفوعات مفتوحة."
        retry={retry}
        renderEntry={entry => <DatedMoneyRow entry={entry} openSource={openSource} />}
      />
      <UpcomingBlock
        blockKey="receivables"
        title="تحصيلات عند الناس"
        result={overview.receivables}
        empty="لا توجد ذمم تحصيل."
        retry={retry}
        renderEntry={entry => <DatedMoneyRow entry={entry} openSource={openSource} />}
      />
      <UpcomingBlock
        blockKey="obligations"
        title="التزامات مصاريف مستحقة"
        result={overview.obligations}
        empty="لا توجد التزامات مستحقة."
        retry={retry}
        renderEntry={entry => <DatedMoneyRow entry={entry} openSource={openSource} />}
      />

      <div className="micro-offline-truth" role="note">
        هذه الصفحة قراءة فقط — فتحها لا يكتب أي سجل مالي، وكل رقم يفتح مصدره الأصلي.
      </div>
    </section>
  );
}

function UpcomingBlock({
  blockKey,
  title,
  result,
  empty,
  retry,
  renderEntry,
}: {
  blockKey: UpcomingBlockKey;
  title: string;
  result: UpcomingBlockResult;
  empty: string;
  retry: () => void;
  renderEntry: (entry: UpcomingEntry) => ReactNode;
}) {
  return (
    <section className="micro-supplier-list" aria-label={title}>
      <div className="micro-finance-event-heading">
        <span className="micro-overline">{title}</span>
      </div>
      {result.ok ? (
        result.entries.length ? (
          result.entries.map(entry => (
            <article key={`${entry.kind}-${entry.id}`}>{renderEntry(entry)}</article>
          ))
        ) : (
          <p>{empty}</p>
        )
      ) : (
        /* G-005: فشل الكتلة يعزل نفسه — بطاقة صادقة وإعادة محاولة، والبقية حية. */
        <div className="micro-cancel-panel" role="alert">
          <p>{BLOCK_FAILURE_MESSAGES[blockKey].message}</p>
          <Button action="save" onClick={retry}>
            إعادة المحاولة
          </Button>
        </div>
      )}
    </section>
  );
}

function OrderRow({ entry, openSource }: { entry: UpcomingEntry; openSource: (href: string) => void }) {
  const label = dueStateLabel(entry.dateState);
  return (
    <div className="micro-supplier-balance">
      <div>
        <strong dir="auto">{entry.title}</strong>
        {entry.note ? <small dir="auto">{entry.note}</small> : null}
      </div>
      <div>
        <small>
          الموعد المجدول: <LocalDateValue value={entry.dueOn} />
          {label ? ` · ${label}` : null}
        </small>
        <Button action="secondary" onClick={() => openSource(entry.sourceHref)}>
          افتح الطلب
        </Button>
      </div>
    </div>
  );
}

function DatedMoneyRow({ entry, openSource }: { entry: UpcomingEntry; openSource: (href: string) => void }) {
  const label = dueStateLabel(entry.dateState);
  const kindLabel = entry.kind === "expense_payable" ? financialEventLabel.operating_expense_payable : null;
  /* التسمية الكنونية لنوع الالتزام تظهر دائمًا (بيتها الوحيد في
   * financialEventLabels) — والملاحظة المصدر عنوان الصف حين وجدت. */
  const showKindLabel = entry.kind === "expense_payable" && entry.title.trim() !== "";
  return (
    <div className="micro-supplier-balance">
      <div>
        <strong dir="auto">{entry.title || kindLabel}</strong>
        {showKindLabel && kindLabel ? <small>{kindLabel}</small> : null}
        {entry.note ? <small dir="auto">{entry.note}</small> : null}
        {entry.qualifier ? <small dir="auto">{entry.qualifier}</small> : null}
      </div>
      <div>
        <b className="micro-supplier-payable">
          المتبقي (د.أ): <MoneyValue minor={entry.amountMinor} className="micro-inline-number" />
        </b>
        <small>
          {entry.dateKind === "supplier_due" ? (
            <>
              الاستحقاق: <LocalDateValue value={entry.dueOn} />
              {label ? ` · ${label}` : null}
            </>
          ) : (
            "بلا تاريخ استحقاق مخزّن"
          )}
        </small>
        <Button action="secondary" onClick={() => openSource(entry.sourceHref)}>
          افتح السجل
        </Button>
      </div>
    </div>
  );
}
