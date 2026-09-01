/**
 * عدّ الصندوق (owner flow #20): count the drawer, compare with the recorded wallet
 * balance, and record the difference as a documented adjustment — future effect only.
 */
import { ArrowRight, Calculator } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import {
  cashCountDifferenceReason,
  cashCountSettledMessage,
  cashCountSettlementNote,
} from "@/presentation/cashCountMessages";
import { localDateInAmman } from "@/presentation/formatters";
import type { CashContinuityOverview } from "@/application/cash/cashContinuityService";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; overview: CashContinuityOverview };

export default function CashCount() {
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع للمصدر (?from) أو المحافظ كبديل قانوني. */
  const returnPath = useReturnPath();
  const { cashContinuity, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [walletId, setWalletId] = useState("");
  const [countedMinor, setCountedMinor] = useState(0);
  const [valid, setValid] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ differenceMinor: number; newBalanceMinor: number } | null>(null);

  useEffect(() => {
    let active = true;
    cashContinuity.overview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "error", message: "تعذر قراءة المحافظ." });
        return;
      }
      setState({ phase: "ready", overview: result.value });
      setWalletId(current => current || result.value.wallets[0]?.id || "");
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, dataVersion]);

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تجهيز العدّ…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة المحافظ</h1>
        <p>{state.message}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate(returnPath)}>
          محافظ الكاش
        </button>
      </section>
    );

  const { overview } = state;
  const wallet = overview.wallets.find(candidate => candidate.id === walletId) ?? null;
  const differenceMinor = wallet ? countedMinor - wallet.balanceMinor : 0;

  async function settle() {
    if (!wallet) {
      setMessage("اختر محفظة قبل العدّ.");
      return;
    }
    if (!valid || !Number.isInteger(countedMinor) || countedMinor < 0) {
      setMessage("أدخل المعدود رقمًا صحيحًا غير سالب.");
      return;
    }
    if (differenceMinor === 0) {
      setMessage("العدّ يطابق الرصيد المسجل — لا حاجة لأي تسوية.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await cashContinuity.adjust({
      walletId: wallet.id,
      deltaMinor: differenceMinor,
      occurredOn: localDateInAmman(),
      /* F-001: النصوص عبر البنّاء المُختبر — مقياس المال 1/100 في كل رسالة. */
      note: cashCountSettlementNote(countedMinor),
      reason: cashCountDifferenceReason(differenceMinor),
      operationKey: `cash-count-${wallet.id}-${Date.now()}`,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setDone({ differenceMinor, newBalanceMinor: countedMinor });
    setMessage(cashCountSettledMessage(countedMinor));
  }

  if (done) {
    return (
      <section className="micro-page micro-count-page">
        <div className="micro-page-heading">
          <span className="micro-overline">عدّة صندوق</span>
          <h1>انسجّلت التسوية</h1>
          <p>{message}</p>
        </div>
        <section className="micro-decision-card" aria-label="نتيجة العدّ">
          <span>الرصيد الجديد للمحفظة</span>
          <strong>
            <MoneyValue minor={done.newBalanceMinor} />
          </strong>
          <p>
            الفرق المسجل: <MoneyValue minor={done.differenceMinor} showPlus /> — تسوية موثقة بتاريخ اليوم،
            بأثر مستقبلي فقط.
          </p>
        </section>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/cash")}>
          محافظ الكاش <ArrowRight aria-hidden="true" />
        </button>
      </section>
    );
  }

  return (
    <section className="micro-page micro-count-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/cash")}>
        <ArrowRight aria-hidden="true" /> محافظ الكاش
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">عدّة صندوق</span>
        <h1>عدّ اللي في الدرج فعلًا</h1>
        <p>قارن المعدود بالرصيد المسجل، وسجّل الفرق تسوية موثقة — الانحراف التراكمي يُعالج هنا لا يتراكم.</p>
      </div>
      {overview.wallets.length === 0 ? (
        <p className="micro-field-error" role="status">
          لا توجد محافظ بعد؛ أنشئ محفظة أولًا.
        </p>
      ) : (
        <section className="micro-form-card" aria-label="نموذج العدّ">
          <label className="micro-field">
            <span>المحفظة التي تعدّها</span>
            <select value={walletId} onChange={event => setWalletId(event.target.value)}>
              {overview.wallets.map(candidate => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} — المسجل <MoneyValue minor={candidate.balanceMinor} />
                </option>
              ))}
            </select>
          </label>
          <label className="micro-field">
            <span>كم وجدت فعلًا؟ (د.أ)</span>
            <EnglishNumberInput
              value={countedMinor}
              kind="money"
              onNumericChange={setCountedMinor}
              onTextValidityChange={setValid}
              aria-label="المبلغ المعدود"
            />
          </label>
          {wallet ? (
            <section className="micro-decision-card" data-knowledge={differenceMinor === 0 ? "known" : "stale"}>
              <span>الفرق عن المسجل</span>
              <strong>
                <MoneyValue minor={differenceMinor} showPlus />
              </strong>
              <p>
                {differenceMinor === 0
                  ? "العدّ يطابق السجل — لا تسوية مطلوبة."
                  : differenceMinor > 0
                    ? "غالبًا قبضات ما انسجّلت — رح تُسجَّل الفرق زيادة بتاريخ اليوم، وما رح يتغير أي رقم قديم."
                    : "غالبًا صرف أو نقص ما انسجّل — رح تُسجَّل الفرق نقصًا بتاريخ اليوم، وما رح يتغير أي رقم قديم."}
              </p>
            </section>
          ) : null}
          {message ? (
            <p className={message.startsWith("انسجّلت") ? "micro-save-note" : "micro-field-error"} role="status">
              {message}
            </p>
          ) : null}
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={saving}
            onClick={() => void settle()}
          >
            <Calculator aria-hidden="true" />
            {saving ? "جارٍ التسجيل…" : "سجّل التسوية"}
          </button>
        </section>
      )}
    </section>
  );
}
