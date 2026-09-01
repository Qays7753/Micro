/**
 * توزيع الكاش غير الموزع (owner principle 5.2 / PA-002): the explicit resolution path
 * for cash that entered the business without a wallet attribution.
 */
import { ArrowRight, ArrowLeft, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import type { CashContinuityOverview } from "@/application/cash/cashContinuityService";
import type { ProjectFinancialPosition } from "@/application/finance/projectFinancialService";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      overview: CashContinuityOverview;
      position: ProjectFinancialPosition;
    };

export default function CashDistribution() {
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع للمصدر (?from) أو المحافظ كبديل قانوني. */
  const returnPath = useReturnPath();
  const { cashContinuity, projectFinance, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [walletId, setWalletId] = useState("");
  const [amountMinor, setAmountMinor] = useState(0);
  const [direction, setDirection] = useState<"into_wallet" | "cover_payment">("into_wallet");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([cashContinuity.overview(), projectFinance.readPosition()]).then(
      ([overview, position]) => {
        if (!active) return;
        if (!overview.ok || !position.ok) {
          setState({ phase: "error", message: "تعذر قراءة المحافظ والكاش." });
          return;
        }
        setState({ phase: "ready", overview: overview.value, position: position.value });
        setWalletId(current => current || overview.value.wallets[0]?.id || "");
      },
    );
    return () => {
      active = false;
    };
  }, [cashContinuity, projectFinance, dataVersion]);

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة الكاش غير الموزع…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة الكاش</h1>
        <p>{state.message}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate(returnPath)}>
          محافظ الكاش
        </button>
      </section>
    );

  const { overview, position } = state;
  const selectedWallet = overview.wallets.find(wallet => wallet.id === walletId) ?? null;
  const deltaMinor = direction === "into_wallet" ? amountMinor : -amountMinor;

  async function distribute() {
    if (!walletId) {
      setMessage("اختر محفظة قبل التوزيع.");
      return;
    }
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setMessage("أدخل مبلغًا صحيحًا موجبًا بالأرقام 0–9.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await projectFinance.distributeUnallocated({
      walletId,
      deltaMinor,
      note: note.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setMessage(
      direction === "into_wallet"
        ? `انخصص الكاش ✓ — انتقلت القيمة إلى «${selectedWallet?.name ?? "المحفظة"}». الإجمالي المسجل لم يتغير.`
        : `انغطى الصرف ✓ — خرجت القيمة من «${selectedWallet?.name ?? "المحفظة"}» إلى غير الموزع. الإجمالي لم يتغير.`,
    );
    setAmountMinor(0);
    setNote("");
  }

  return (
    <section className="micro-page micro-distribution-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/cash")}>
        <ArrowRight aria-hidden="true" /> محافظ الكاش
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">قرار توزيع صريح</span>
        <h1>وزّع الكاش غير الموزع</h1>
        <p>الكاش الذي دخل بلا نسبة لمحفظة يجد هنا طريقه — لا تخصيص صامت ولا رصيد عالق بلا حل.</p>
      </div>
      <section className="micro-decision-card" aria-label="المتاح الآن">
        <span>الكاش غير الموزع المتاح</span>
        <strong>
          <MoneyValue minor={position.unallocatedCashMinor} />
        </strong>
        <p>
          كاش المحافظ: <MoneyValue minor={position.walletCashMinor} /> · الإجمالي المسجل:{" "}
          <MoneyValue minor={position.recordedCashMinor} /> — التوزيع ينقل بينهما ولا يغيّر الإجمالي.
        </p>
      </section>
      <section className="micro-form-card" aria-label="نموذج التوزيع">
        {overview.wallets.length === 0 ? (
          <p className="micro-field-error" role="status">
            لا توجد محافظ بعد؛ أنشئ محفظة أولًا من «محافظ الكاش».
          </p>
        ) : (
          <>
            <label className="micro-field">
              <span>الاتجاه</span>
              <select
                value={direction}
                onChange={event =>
                  setDirection(event.target.value === "cover_payment" ? "cover_payment" : "into_wallet")
                }
              >
                <option value="into_wallet">من غير الموزع إلى محفظة</option>
                <option value="cover_payment">تغطية صرف من محفظة إلى غير الموزع</option>
              </select>
            </label>
            <label className="micro-field">
              <span>المحفظة</span>
              <select value={walletId} onChange={event => setWalletId(event.target.value)}>
                {overview.wallets.map(wallet => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} — الرصيد <MoneyValue minor={wallet.balanceMinor} />
                  </option>
                ))}
              </select>
            </label>
            <label className="micro-field">
              <span>المبلغ (د.أ)</span>
              <EnglishNumberInput
                value={amountMinor}
                kind="money"
                onNumericChange={setAmountMinor}
                aria-label="مبلغ التوزيع"
              />
            </label>
            <label className="micro-field">
              <span>
                ملاحظة <small>اختيارية</small>
              </span>
              <input
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="مثال: قبضات يوم الأحد"
              />
            </label>
            {message ? (
              <p
                className={message.startsWith("ان") ? "micro-save-note" : "micro-field-error"}
                role="status"
              >
                {message}
              </p>
            ) : null}
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={saving}
              onClick={() => void distribute()}
            >
              <WalletCards aria-hidden="true" />
              {saving ? "جارٍ التوزيع…" : "سجّل التوزيع"}
            </button>
          </>
        )}
      </section>
      <p className="micro-home-truth-line">
        <ArrowLeft aria-hidden="true" /> التخصيص حركة موثقة في سجل المحفظة — يمكن التراجع عنها كأي أثر كاش.
      </p>
    </section>
  );
}
