/** D-004: طريق إكمال رصيد الافتتاح المجهول — حدث لاحق موثق يرفع الختم ولا ي rewriting للسجل. */
/* PA-007: occurredOn هو تاريخ الرصيد الحقيقي (ماضٍ)، وrecordedAt هو الآن؛ القيد إضافي ذرّي. */
import { ArrowRight, Save, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import type { CashWalletBalance } from "@/application/cash/cashContinuityService";
import { localDateInAmman } from "@/presentation/formatters";

type PageState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; wallet: CashWalletBalance }
  | { phase: "already-known"; wallet: CashWalletBalance };

export default function CashOpeningLaterEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { cashContinuity, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [date, setDate] = useState(() => localDateInAmman());
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(
    `cash-opening-later-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );

  useEffect(() => {
    if (!id) return;
    let active = true;
    cashContinuity.overview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      const wallet = result.value.wallets.find(candidate => candidate.id === id);
      if (!wallet) {
        setState({ phase: "error", message: "لم أجد هذه المحفظة؛ لم يتغير أي سجل." });
        return;
      }
      setState(
        wallet.openingUnknown
          ? { phase: "ready", wallet }
          : { phase: "already-known", wallet },
      );
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, id]);

  async function save() {
    if (state.phase !== "ready" || !id) return;
    if (!validAmount || amountMinor < 0 || !Number.isInteger(amountMinor)) {
      setMessage("أدخل الرصيد الموثق بالأرقام 0–9 قبل الحفظ — أو ارجع وبقِ الحالة غير معروفة.");
      return;
    }
    if (!reason.trim()) {
      setMessage("اكتب سبب هذا الرصيد ومصدره (عدّ، كشف حساب…) — السبب جزء من السجل الموثق.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await cashContinuity.recordOpeningBalanceLater({
      walletId: id,
      amountMinor,
      occurredOn: date,
      note: reason,
      operationKey: operationKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    navigate("/cash");
  }

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة بيانات المحفظة…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح سجل الرصيد</h1>
        <p>{state.message}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/cash")}>
          محافظ الكاش
        </button>
      </section>
    );
  if (state.phase === "already-known")
    return (
      <section className="micro-page micro-finance-page">
        <button className="micro-back-button" type="button" onClick={() => navigate("/cash")}>
          <ArrowRight aria-hidden="true" /> محافظ الكاش
        </button>
        <div className="micro-page-heading">
          <span className="micro-overline">حالة المحفظة</span>
          <h1>رصيد افتتاحي هذه المحفظة معروف أصلًا</h1>
          <p>
            «{state.wallet.name}» لديها رصيد افتتاحي مسجل؛ التصحيح اللاحق لحقيقة الكاش يُسجل ضبط كاش بسبب،
            لا افتتاحًا ثانيًا.
          </p>
        </div>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(`/cash/wallet/${state.wallet.id}/adjust`)}
        >
          ضبط الكاش بسبب
        </button>
      </section>
    );

  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/cash")}>
        <ArrowRight aria-hidden="true" /> محافظ الكاش
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">إكمال معرفة ناقصة</span>
        <h1>سجّل رصيد «{state.wallet.name}» الموثق لاحقًا</h1>
        <p>
          اخترت عند الإنشاء «لا أعرف الرصيد». سجّله الآن كما وثّقته فعلًا: حدث إضافي بتاريخه وسببه، يرفع ختم
          «غير معروف» ولا يعيد كتابة أي قيد سابق.
        </p>
      </div>
      <section className="micro-decision-card">
        <WalletCards aria-hidden="true" />
        <div>
          <span>حد الحقيقة</span>
          <strong>الرصيد الموثق ليس ربحًا ولا استثمارًا.</strong>
          <p>إنه نقطة بداية معلنة لهذه المحفظة فقط؛ القيود السابقة تبقى كما سُجّلت.</p>
        </div>
      </section>
      <section className="micro-form-card">
        <label className="micro-field">
          <span>الرصيد الموثق بالدينار الأردني</span>
          <EnglishNumberInput
            value={amountMinor}
            kind="money"
            onNumericChange={setAmountMinor}
            onTextValidityChange={setValidAmount}
            aria-label="الرصيد الموثق"
          />
          <small>أدخل ما وثّقته فعلًا — عدّ الدرج أو كشف الحساب. الصفر صادق إن كان الموثق صفرًا.</small>
        </label>
        <LocalDateField
          label="تاريخ الرصيد الحقيقي"
          value={date}
          onChange={event => setDate(event.target.value)}
        />
        <label className="micro-field">
          <span>سبب ومصدر التوثيق</span>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="مثال: عدّت الدرج صباح ٢٠ أب ووجدت ٤٥ دينارًا"
          />
        </label>
        {message ? (
          <p className="micro-field-error" role="status">
            {message}
          </p>
        ) : null}
        <button
          className="micro-button micro-button-primary micro-save-cost"
          type="button"
          disabled={saving}
          onClick={save}
        >
          <Save aria-hidden="true" />
          {saving ? "جارٍ الحفظ…" : "سجّل الرصيد الموثق"}
        </button>
      </section>
    </section>
  );
}
