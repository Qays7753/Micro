/**
 * المجموعة ٢ (§9.1 — WalletLedger): دفتر محفظة واحدة — رصيدها وحركات كاشها
 * بالتسلسل مع تمييز الأنواع وتواريخها ومبالغها، ووصل كل تخصيص بمصدره.
 * كل صف قابل للوصول لتراجعه الموثق من سطحه الأصلي دون فقد سياق المحفظة.
 *
 * Wave 4.2 — P-4.2-5 (T7): الفعل السياقي «وزّع على هذه المحفظة» — المنتج
 * المرئي القانوني الأول لمعامل destinationWalletId (عقد ٢٦ §3): يظهر فقط
 * عند وجود كاش غير موزع قابل للتوزيع، ويفتح التوزيع والمحفظة مختارة مسبقًا
 * بلا مطالبة المستخدم باختيارها مرة ثانية، والرجوع يعيد إلى هذا الدفتر.
 */
import { ArrowRight, Coins, Landmark, NotebookPen, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { RestatementNote } from "@/components/finance/RestatementNote";
import type { WalletLedgerOverview } from "@/application/cash/walletLedgerService";

import { Button } from "@/components/primitives";
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
  const { walletLedger, projectFinance, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  /* T7 (Wave 4.2): الكاش غير الموزع القابل للتوزيع — نفس مصدر شريط المالية
   * (قراءة موقف المالية)؛ مجهول = لا فعل سياقي (لا زر ميت ولا صفر مفترض). */
  const [unallocatedCashMinor, setUnallocatedCashMinor] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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
        result.ok ? { phase: "ready", overview: result.value } : { phase: "error", message: result.message },
      );
    });
    projectFinance.readPosition().then(position => {
      if (!active || !position.ok) return;
      setUnallocatedCashMinor(position.value.unallocatedCashMinor);
    });
    return () => {
      active = false;
    };
  }, [walletLedger, projectFinance, params.id, dataVersion, retryCount]);

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
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
        <Button action="secondary" onClick={() => navigate("/cash")}>
          محافظ الكاش
        </Button>
      </section>
    );

  const { overview } = state;
  const walletHref = (path: string) => withReturnTo(path, `/cash/wallet/${overview.wallet.id}`);

  return (
    <section className="micro-page micro-wallet-ledger-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> محافظ الكاش
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
        {/* T7 (قرار المالك — Wave 4.2): فعل سياقي شرطي — لا زر ميت عند غياب
            الكاش غير الموزع؛ الفتح يختار هذه المحفظة مسبقًا ويعود إلى الدفتر. */}
        {(unallocatedCashMinor ?? 0) > 0 ? (
          <Button
            action="secondary"

            onClick={() =>
              navigate(
                withReturnTo(
                  `/cash/distribute?destinationWalletId=${encodeURIComponent(overview.wallet.id)}`,
                  `/cash/wallet/${overview.wallet.id}`,
                ),
              )
            }
          >
            <Coins aria-hidden="true" /> وزّع على هذه المحفظة
          </Button>
        ) : null}
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
          <strong>لا توجد حركات على هذه المحفظة بعد.</strong>
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
                  <Button
                    action="quiet"

                    onClick={() => navigate(walletHref(row.sourceHref!))}
                  >
                    {row.sourceLabel}
                  </Button>
                ) : null}
                {row.reversible ? (
                  <Button
                    action="quiet"

                    onClick={() => navigate(walletHref(`/cash/entry/${row.id}/reverse`))}
                  >
                    <RotateCcw aria-hidden="true" /> تراجع
                  </Button>
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
