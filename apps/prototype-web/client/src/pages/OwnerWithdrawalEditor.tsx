/**
 * X-05 (وحدة ٣): المدخل الواحد لسحب المالك — «سحب من المشروع لنفسك؟».
 * يكتب إلى المسار الصحيح بحسب وجود سياسة حق مالك: حركة دفتر بأثر كاش حين توجد
 * سياسة، أو حدث مالي عام حين لا توجد. التفريق تقني والمالك لا يتعلمه.
 */
import { ArrowRight, HandCoins, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { formatLocalDate, formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type { OwnerEntitlementOverview } from "@/application/finance/ownerEntitlementService";

/* مفتاح القرار (X-05): وجود سياسة حق مالك فعالة يوجه السحب إلى مسار الدفتر
 * (تسوية حق بمحفظة محددة)، وغيابها يوجهه إلى الحدث المالي العام.
 * G6-U2-1 (المجموعة ٦): وجود حق قابل للتسوية شرط تسوية الحق — بلا حق مسجل
 * يذهب السحب لمسار الدفتر نفسه بسبب «سحب قبل تسجيل الحق» (موجود بالنطاق
 * وغير مستدعى من أي سطح) بدل الطريق المسدود. */
export function unifiedWithdrawalPath(
  overview: Pick<OwnerEntitlementOverview, "activePolicies">,
): "ledger_movement" | "financial_event" {
  return overview.activePolicies.length > 0 ? "ledger_movement" : "financial_event";
}

export default function OwnerWithdrawalEditor() {
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const {
  dataVersion, ownerEntitlement, projectFinance, notifyDataChanged } = usePrototypeServices();
  const [overview, setOverview] = useState<OwnerEntitlementOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [walletId, setWalletId] = useState("");
  const [entitlementId, setEntitlementId] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => localDateInAmman());
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(`owner-withdrawal-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  useEffect(() => {
    let active = true;
    ownerEntitlement.readOverview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setOverview(result.value);
      setWalletId(result.value.walletBalances[0]?.id ?? "");
      setEntitlementId(result.value.entitlements.at(-1)?.id ?? "");
    });
    return () => {
      active = false;
    };
  }, [ownerEntitlement, dataVersion]);

  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty([
      amountMinor,
      walletId,
      entitlementId,
      occurredOn,
      note,
    ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  async function save(): Promise<boolean> {
    if (loadError || !overview) return false;
    const path = unifiedWithdrawalPath(overview);
    const settleableEntitlements = overview.entitlements.filter(record => record.amountMinor > 0);
    const settlingEntitlement = entitlementId.trim() && settleableEntitlements.length > 0;
    if (!validAmount || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      setMessage("أدخل مبلغ السحب بالأرقام 0–9 قبل الحفظ.");
      return false;
    }
    if (path === "ledger_movement") {
      if (!walletId.trim()) {
        setMessage("اختر المحفظة التي يخرج منها السحب.");
        return false;
      }
      if (!settlingEntitlement && entitlementId.trim()) {
        setMessage("الحق المختار غير قابل للتسوية؛ اختر حقًا مسجلًا فعّالًا أو اتركه فارغًا.");
        return false;
      }
    } else if (!note.trim()) {
      setMessage("اكتب بيانًا مختصرًا للسحب — ما الذي حدث؟");
      return false;
    }
    setMessage(null);
    setSaving(true);
    const result =
      path === "ledger_movement"
        ? await ownerEntitlement.recordMovement({
            kind: "draw",
            amountMinor,
            walletId,
            occurredOn,
            note: note.trim() || "سحب من المشروع لنفسك",
            reason: settlingEntitlement ? "entitlement_settlement" : "pre_entitlement_draw",
            relatedEntitlementId: settlingEntitlement ? entitlementId : null,
            idempotencyKey: idempotencyKey.current,
          })
        : await projectFinance.record({
            type: "owner_withdrawal_cash",
            amountMinor,
            occurredOn,
            note: note.trim(),
            counterparty: null,
            relatedEventId: null,
            idempotencyKey: idempotencyKey.current,
          });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    navigate(returnPath);
    return true;
  }

  if (loadError)
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة دفتر المالك</h1>
        <p>{loadError}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/finance")}>
          العودة إلى مالي
        </button>
      </section>
    );

  const path = overview ? unifiedWithdrawalPath(overview) : null;
  return (
    <section className="micro-page micro-finance-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => requestNavigation(returnPath)}
      >
        <ArrowRight aria-hidden="true" /> مالي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مدخل واحد · سحب المالك</span>
        <h1>سحب من المشروع لنفسك؟</h1>
        <p>
          مال تأخذه من مشروعك لاستعمالك الشخصي. ينقص الكاش المسجل ولا يسجل مصروفًا تشغيليًا أبدًا — أثره
          يظهر حيث ينتمي بحسب حال مشروعك، ولا حاجة لمعرفة الفرق التقني.
        </p>
      </div>
      <section className="micro-decision-card">
        <HandCoins aria-hidden="true" />
        <div>
          <span>حد الحقيقة</span>
          <strong>السحب الشخصي ليس مصروفًا.</strong>
          <p>
            {path === "ledger_movement"
              ? overview && overview.entitlements.filter(record => record.amountMinor > 0).length > 0
                ? "عندك سياسة حق مالك فعالة، فيُسجَّل السحب تسويةً لحقك من محفظة محددة، ويظهر في دفتر المالك."
                : "عندك سياسة حق مالك فعالة بس ما في حق مسجل بعد — يُسجَّل السحب «قبل تسجيل الحق» من المحفظة، ويظهر في دفتر المالك."
              : path === "financial_event"
                ? "يُسجَّل السحب حدثًا ماليًا عامًا ينقص الكاش ومال المالك معًا."
                : "جارٍ قراءة حال مشروعك المحلية…"}
          </p>
        </div>
      </section>
      {overview ? (
        <section className="micro-form-card">
          <label className="micro-field">
            <span>المبلغ بالدينار الأردني</span>
            <EnglishNumberInput
              value={amountMinor}
              kind="money"
              onNumericChange={setAmountMinor}
              onTextValidityChange={setValidAmount}
              aria-label="مبلغ السحب"
            />
          </label>
          {path === "ledger_movement" ? (
            <>
              <label className="micro-field">
                <span>المحفظة التي يخرج منها السحب</span>
                <select value={walletId} onChange={event => setWalletId(event.target.value)}>
                  {overview.walletBalances.length === 0 ? <option value="">لا محفظة معلنة بعد</option> : null}
                  {overview.walletBalances.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} · الرصيد {formatMoneyMinor(wallet.balanceMinor)} د.أ
                    </option>
                  ))}
                </select>
              </label>
              <label className="micro-field">
                <span>الحق المسجل الذي تتم تسويته</span>
                <select value={entitlementId} onChange={event => setEntitlementId(event.target.value)}>
                  {overview.entitlements.length === 0 ? <option value="">لا حق مسجل بعد</option> : null}
                  {overview.entitlements
                    .filter(record => record.amountMinor > 0)
                    .map(record => (
                      <option key={record.id} value={record.id}>
                        {/* المجموعة ٦ (البند ٥): تاريخ رقمي لا ISO خام أمام المستخدم. */}
                        {formatLocalDate(record.occurredOn) ?? record.occurredOn} ·{" "}
                        {formatMoneyMinor(record.amountMinor)} د.أ · {record.note}
                      </option>
                    ))}
                </select>
                <small>سياسة حق مالك فعالة عندك؛ السحب يسوّي حقك المسجل ويظهر في دفتر المالك.</small>
              </label>
            </>
          ) : null}
          <LocalDateField
            label="تاريخ السحب"
            value={occurredOn}
            onChange={event => setOccurredOn(event.target.value)}
          />
          <label className="micro-field">
            <span>بيان مختصر {path === "ledger_movement" ? "(اختياري)" : "(مطلوب)"}</span>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="مثال: سحب نقدي لبيت المالك"
            />
          </label>
          {message ? (
            <p className="micro-field-error" role="alert">
              {message}
            </p>
          ) : null}
          <div className="micro-form-actions micro-sticky-save">
            <button
            className="micro-button micro-button-primary micro-save-cost"
            type="button"
            disabled={saving}
            onClick={() => {
              void save();
            }}
          >
            <Save aria-hidden="true" />
            {saving ? "جارٍ الحفظ…" : "سجّل السحب"}
          </button>
          </div>
        </section>
      ) : (
        <div className="micro-route-loading" role="status">
          جارٍ قراءة حال مشروعك…
        </div>
      )}
    </section>
  );
}
