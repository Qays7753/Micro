/**
 * المجموعة ٢ (§9.1 — WalletLedger): دفتر محفظة واحدة — رصيدها وحركات كاشها
 * بالتسلسل مع تمييز الأنواع وتواريخها ومبالغها، ووصل كل تخصيص بمصدره.
 * كل صف قابل للوصول لتراجعه الموثق من سطحه الأصلي دون فقد سياق المحفظة.
 */
import { ArrowLeft, Landmark, NotebookPen, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { RestatementNote } from "@/components/finance/RestatementNote";
import type { WalletLedgerOverview } from "@/application/cash/walletLedgerService";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; overview: WalletLedgerOverview };

const kindQualifier = (row: WalletLedgerOverview["rows"][number]): string | null => {
  if (row.kind === "allocation_in" || row.kind === "allocation_cover")
    return "نقل بين «غير الموزع» والمحفظة — الإجمالي المسجل لا يتغير";
  if (row.kind === "reversal") return "تراجع موثق — الأصل باقٍ في السجل";
  if (row.kind === "adjustment") return "تسوية بسبب — أثر مستقبلي فقط";
  return null;
};

export default function WalletLedger() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const search = useSearch();
  const returnPath = useReturnPath();
  const { walletLedger, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  /* S1-08: تركيز الحركة المقصودة (?entry=) — إبراز وتمرير مثل طبقة الأحداث. */
  const focusedEntryId = new URLSearchParams(search).get("entry");
  useEffect(() => {
    if (state.phase !== "ready" || !focusedEntryId) return;
    const row = document.getElementById(`wallet-entry-${focusedEntryId}`);
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
    (row as HTMLElement | null)?.focus?.();
  }, [state, focusedEntryId]);

  useEffect(() => {
    let active = true;
    walletLedger.read(params.id).then(result => {
      if (!active) return;
      setState(
        result.ok
          ? { phase: "ready", overview: result.value }
          : { phase: "error", message: result.message },
      );
    });
    return () => {
      active = false;
    };
  }, [walletLedger, params.id, dataVersion]);

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة دفتر المحفظة…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>دفتر محفظة غير متاح</h1>
        <p>{state.message}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/cash")}>
          محافظ الكاش
        </button>
      </section>
    );

  const { overview } = state;
  const walletHref = (path: string) => `${path}${path.includes("?") ? "&" : "?"}from=${encodeURIComponent(`/cash/wallet/${overview.wallet.id}`)}`;

  return (
    <section className="micro-page micro-wallet-ledger-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => navigate(returnPath)}
      >
        <ArrowLeft aria-hidden="true" /> محافظ الكاش
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">دفتر محفظة · المبالغ (د.أ)</span>
        <h1>{overview.wallet.name}</h1>
        <p>
          {overview.wallet.kind === "cash_drawer"
            ? "درج"
            : overview.wallet.kind === "bank_account"
              ? "حساب بنكي"
              : overview.wallet.kind === "digital_wallet"
                ? "محفظة رقمية"
                : "مكان كاش آخر"}{" "}
          · حركات المحفظة فقط: الافتتاح والتحويل والضبط والتخصيص — ما لم يُخصص لها يبقى «غير موزع».
        </p>
      </div>
      <section className="micro-decision-card" aria-label="رصيد المحفظة">
        <Landmark aria-hidden="true" />
        <div>
          <span>رصيد هذه المحفظة الآن</span>
          <strong>
            <MoneyValue minor={overview.balanceMinor} /> د.أ
          </strong>
          <p>
            {overview.openingUnknown
              ? "رصيد الافتتاح غير معروف — الرصيد أعلاه يخص الحركات المسجلة فقط، ولا يُعرض صفر مكان المجهول."
              : "هذا رصيد المحفظة لا ربحها — الكاش ليس نتيجة الفترة."}
          </p>
        </div>
      </section>
      {(() => {
        /* المجموعة ٦ (البند ٣ — S2-09): رصيد المحفظة صافي أثر الحركات
         * وتراجعاتها الموثقة — السطر يقولها حين يوجد تراجع واحد على الأقل. */
        const reversalRows = overview.rows.filter(row => row.kind === "reversal");
        if (reversalRows.length === 0) return null;
        const netAmountMinor = reversalRows.reduce((sum, row) => sum + row.amountMinor, 0);
        return (
          <RestatementNote
            count={reversalRows.length}
            netAmountMinor={netAmountMinor}
            scopeLabel="هذا الرصيد"
            onOpen={() => navigate(`/cash/wallet/${overview.wallet.id}`)}
          />
        );
      })()}
      {overview.rows.length === 0 ? (
        <section className="micro-home-quiet" aria-label="دفتر فارغ">
          <strong>لسه ما في حركات على هذه المحفظة.</strong>
          <p>التخصيص من «غير الموزع» أو الضبط بسبب أو التحويل — كلها تظهر هنا فور تسجيلها.</p>
        </section>
      ) : (
        <section className="micro-supplier-list" aria-label="حركات المحفظة">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">
              <NotebookPen aria-hidden="true" /> أحدث الحركات ({overview.entryCount})
            </span>
            <h2>حركات المحفظة بالتسلسل</h2>
          </div>
          {overview.rows.map(row => (
            <article
              key={row.id}
              id={`wallet-entry-${row.id}`}
              tabIndex={focusedEntryId === row.id ? -1 : undefined}
              data-focused={focusedEntryId === row.id ? "true" : undefined}
            >
              <div>
                <strong>{row.label}</strong>
                <small>
                  <LocalDateValue value={row.occurredOn} /> · {row.note}
                  {row.reason ? ` · السبب: ${row.reason}` : ""}
                </small>
                {kindQualifier(row) ? <small>{kindQualifier(row)}</small> : null}
              </div>
              <div className="micro-supplier-balance">
                <b>
                  <MoneyValue minor={row.amountMinor} showPlus /> د.أ
                </b>
                {row.sourceHref ? (
                  <button
                    className="micro-button micro-button-quiet"
                    type="button"
                    onClick={() => navigate(walletHref(row.sourceHref!))}
                  >
                    {row.sourceLabel}
                  </button>
                ) : null}
                {row.reversible ? (
                  <button
                    className="micro-button micro-button-quiet"
                    type="button"
                    onClick={() => navigate(walletHref(`/cash/entry/${row.id}/reverse`))}
                  >
                    <RotateCcw aria-hidden="true" /> تراجع
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
      <p className="micro-home-truth-line">
        هذه القراءة من سجلك المحلي — التصحيح من صف الحركة نفسه بتراجع موثق، ولا يُحذف شيء بصمت.
      </p>
    </section>
  );
}
