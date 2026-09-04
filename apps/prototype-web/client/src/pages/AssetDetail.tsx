/**
 * المجموعة ٤ (عقد ٢٩): تفصيل الأصل العميق — الدفتري والإهلاك المقترح
 * والمسجّل وتاريخ الأحداث. تسجيل الإهلاك معاينة قبل تأكيده («لا يخصم من
 * الصندوق؛ يخفض ربح الفترة فقط»)؛ التخلص والشطب تصحيحات موثقة بمقابل
 * معلن. تعديل العقد (العمر/البداية) لا يمس الإهلاك المسجّل سابقًا.
 */
import { CircleDollarSign, HandCoins, Save, TrendingDown, Trash2, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate, formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type { AssetRecord } from "@micro-domain/asset/index.js";
import type { AssetDepreciationProposal, AssetEventSummary } from "@micro-domain/asset/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

type Reading = {
  asset: AssetRecord;
  summary: AssetEventSummary;
  proposal: AssetDepreciationProposal;
  events: readonly FinancialEvent[];
};

const READINESS_NOTES: Record<AssetDepreciationProposal["readiness"], string> = {
  ready: "جاهز للتسجيل — المقترح لا يدخل ربحك إلا بتأكيدك.",
  unknown_life: "العمر النافع مجهول — لا إهلاك حتى تُحدده بمراجعة موثقة.",
  unknown_start: "بداية الاستخدام غير محددة — لا إهلاك حتى تُحددها بمراجعة موثقة.",
  fully_depreciated: "الإهلاك المسجّل يغطي الجدول حتى تاريخه — لا مستحق جديد.",
  retired: "أصل مؤرشف (تخلص/شطب) — لا إهلاك بعده.",
};

export default function AssetDetail() {
  const [assetId, setAssetId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { assets, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<{ phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; reading: Reading }>(
    { phase: "loading" },
  );
  /* المجموعة ٥ (تسديد دَين المجموعة ٤ — بند ٣): ثلاثة حقول سبب مستقلة —
   * حقل واحد مشترك كان يعبّئ نماذج التصحيح الثلاثة بالسبب نفسه فيُوثَّق خطأً. */
  const [acquisitionReason, setAcquisitionReason] = useState("");
  const [contractReason, setContractReason] = useState("");
  const [disposalReason, setDisposalReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disposalOpen, setDisposalOpen] = useState(false);
  const [proceedsMinor, setProceedsMinor] = useState(0);
  const [validProceeds, setValidProceeds] = useState(true);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [newLife, setNewLife] = useState("");
  const [newStart, setNewStart] = useState("");
  /* المجموعة ٤ (تصحيح مراجعة 4-c): تاريخ الإهلاك اختيار المالك — العقد وعد بتاريخ
   * يختاره هو لا بتاريخ فتح الصفحة؛ الافتراضي اليوم. */
  const [depreciationAsOf, setDepreciationAsOf] = useState(localDateInAmman());
  const [acquisitionOpen, setAcquisitionOpen] = useState(false);
  const [correctedAmount, setCorrectedAmount] = useState(0);
  const [validCorrectedAmount, setValidCorrectedAmount] = useState(true);
  const [correctedKind, setCorrectedKind] = useState<"cash" | "payable">("cash");
  const [reversalTargetId, setReversalTargetId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  useEffect(() => {
    const match = window.location.pathname.match(/^\/assets\/([^/]+)$/);
    setAssetId(match?.[1] ?? null);
  }, []);

  const load = useCallback(() => {
    if (!assetId) return;
    assets.read(assetId).then(result => {
      if (!result.ok) {
        setState({ phase: "error", message: result.message });
        return;
      }
      setState({ phase: "ready", reading: result.value });
      setCorrectedAmount(result.value.asset.acquisitionAmountMinor);
      setCorrectedKind(result.value.asset.acquisitionKind);
    });
  }, [assets, assetId]);

  useEffect(load, [load, dataVersion]);

  if (state.phase === "loading") return <p className="micro-route-loading" role="status">جارٍ قراءة الأصل…</p>;
  if (state.phase === "error")
    return (
      <section className="micro-page">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>الأصول</button>
        <p className="micro-field-error" role="alert">{state.message}</p>
      </section>
    );
  const { asset, summary, proposal, events } = state.reading;

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message ?? "تعذر إتمام العملية.");
      return;
    }
    setMessage(null);
    setAcquisitionReason("");
    setContractReason("");
    setDisposalReason("");
    notifyDataChanged();
  }

  return (
    <section className="micro-page micro-asset-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>الأصول</button>
      <div className="micro-page-heading">
        <span className="micro-overline">{asset.categoryLabel ?? "أصل رأسمالي"}</span>
        <h1>{asset.name}</h1>
        <p>
          اقتناء <MoneyValue minor={asset.acquisitionAmountMinor} /> د.أ{" "}
          {asset.acquisitionKind === "cash" ? "نقدًا" : "بالذمم"} · {formatLocalDate(asset.purchaseDate)}
        </p>
      </div>

      <section className="micro-decision-card" aria-label="القيمة الدفترية">
        <div>
          <span>القيمة الدفترية اليوم</span>
          <strong><MoneyValue minor={summary.bookValueMinor} /> د.أ</strong>
          <p>
            الأصل <MoneyValue minor={summary.acquisitionMinor} /> د.أ · إهلاك مسجّل{" "}
            <MoneyValue minor={summary.depreciationMinor} /> د.أ — الإهلاك غير نقدي، لا يمس الصندوق.
          </p>
        </div>
      </section>

      {asset.status === "active" ? (
        <section className="micro-decision-card" aria-label="إهلاك هذا الأصل">
          <TrendingDown aria-hidden="true" />
          <div>
            <span>الإهلاك</span>
            {proposal.readiness === "ready" ? (
              <>
                <strong>مستحق حتى اليوم: <MoneyValue minor={proposal.proposedMinor} /> د.أ</strong>
                <p>
                  الإهلاك الشهري <MoneyValue minor={proposal.monthlyMinor ?? 0} /> د.أ · أول شهر حمل{" "}
                  <bdi dir="ltr">{proposal.firstChargeMonth}</bdi> · متبقٍ{" "}
                  {proposal.remainingMonths} شهرًا.
                </p>
                <p className="micro-field-hint">تسجيله يخفض ربح فترته فقط — لا يخصم من الصندوق شيئًا.</p>
                <LocalDateField
                  label="سجّل حتى تاريخ"
                  value={depreciationAsOf}
                  onChange={event => setDepreciationAsOf(event.target.value)}
                />
                <div className="micro-form-actions">
                  <button
                    className="micro-button micro-button-primary"
                    type="button"
                    disabled={busy || proposal.proposedMinor <= 0}
                    onClick={() =>
                      void run(() => assets.recordDepreciation(asset.id, { asOf: depreciationAsOf }))
                    }
                  >
                    سجّل الإهلاك المستحق
                  </button>
                </div>
              </>
            ) : (
              <>
                <strong>{READINESS_NOTES[proposal.readiness]}</strong>
                <p>الإهلاك المسجّل حتى الآن: <MoneyValue minor={proposal.recordedMinor} /> د.أ</p>
              </>
            )}
          </div>
        </section>
      ) : null}

      {asset.status === "active" ? (
        <section className="micro-decision-card" aria-label="تصحيح الاقتناء">
          <button
            className="micro-text-action"
            type="button"
            aria-expanded={acquisitionOpen}
            onClick={() => setAcquisitionOpen(current => !current)}
          >
            صحّح قيمة أو طريقة الاقتناء
          </button>
          {acquisitionOpen ? (
            <div className="micro-revision-form">
              <p className="micro-field-hint">
                تصحيح موثّق: حدث الاقتناء الأصلي يُعكَس ويُسجّل بديل بتاريخه نفسه — الإهلاك المسجّل سابقًا لا يُمسّ.
              </p>
              <label className="micro-field">
                <span>قيمة الشراء الصحيحة (د.أ)</span>
                <EnglishNumberInput
                  value={correctedAmount}
                  kind="money"
                  onNumericChange={setCorrectedAmount}
                  onTextValidityChange={setValidCorrectedAmount}
                  aria-label="قيمة الشراء الصحيحة"
                />
              </label>
              <label className="micro-field">
                <span>طريقة الدفع الصحيحة</span>
                <select
                  value={correctedKind}
                  onChange={event => setCorrectedKind(event.target.value === "payable" ? "payable" : "cash")}
                >
                  <option value="cash">نقدًا</option>
                  <option value="payable">بالذمم</option>
                </select>
              </label>
              <label className="micro-field">
                <span>سبب التصحيح (مطلوب)</span>
                <input value={acquisitionReason} onChange={event => setAcquisitionReason(event.target.value)} placeholder="مثال: الفاتورة الحقيقية كانت أعلى" />
              </label>
              <p className="micro-field-hint">
                {correctedAmount > 0 && (correctedAmount !== asset.acquisitionAmountMinor || correctedKind !== asset.acquisitionKind)
                  ? `سيظهر التراجع والبديل في التاريخ، والدفتري القادم يتبع القيمة الجديدة (${formatMoneyMinor(correctedAmount)} د.أ).`
                  : "أدخل قيمة أو طريقة مختلفة عن المسجّلة لتفعل التصحيح."}
              </p>
              <div className="micro-form-actions">
                <button
                  className="micro-button micro-button-primary"
                  type="button"
                  disabled={
                    busy ||
                    !acquisitionReason.trim() ||
                    !validCorrectedAmount ||
                    correctedAmount <= 0 ||
                    (correctedAmount === asset.acquisitionAmountMinor && correctedKind === asset.acquisitionKind)
                  }
                  onClick={() =>
                    void run(() =>
                      assets.correctAcquisition(asset.id, {
                        acquisitionAmountMinor: correctedAmount,
                        acquisitionKind: correctedKind,
                        reason: acquisitionReason,
                      }),
                    )
                  }
                >
                  <Pencil aria-hidden="true" /> صحّح الاقتناء
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {asset.status === "active" ? (
        <section className="micro-decision-card" aria-label="تعديل عقد الإهلاك">
          <button
            className="micro-text-action"
            type="button"
            aria-expanded={revisionOpen}
            onClick={() => {
              setRevisionOpen(current => !current);
              setNewLife(asset.lifeMonths === null ? "" : String(asset.lifeMonths));
              setNewStart(asset.depreciationStartOn ?? "");
            }}
          >
            عدّل العمر النافع أو بداية الاستخدام
          </button>
          {revisionOpen ? (
            <div className="micro-revision-form">
              <p className="micro-field-hint">
                التعديل مراجعة موثقة: الإهلاك المسجّل سابقًا لا يُمسّ؛ الاقتراحات القادمة تتبع العقد الجديد.
              </p>
              <label className="micro-field">
                <span>العمر النافع (أشهر)</span>
                <input
                  value={newLife}
                  onChange={event => setNewLife(event.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="اتركه فارغًا = مجهول"
                />
              </label>
              <LocalDateField label="بداية الاستخدام" value={newStart} onChange={event => setNewStart(event.target.value)} />
              <label className="micro-field">
                <span>سبب التعديل (مطلوب)</span>
                <input value={contractReason} onChange={event => setContractReason(event.target.value)} placeholder="مثال: الصيانة أطالت عمره" />
              </label>
              <div className="micro-form-actions">
                <button
                  className="micro-button micro-button-primary"
                  type="button"
                  disabled={busy || !contractReason.trim()}
                  onClick={() =>
                    void run(() =>
                      assets.reviseContract(asset.id, {
                        lifeMonths: newLife.trim() === "" ? null : Number(newLife),
                        depreciationStartOn: newStart || null,
                        reason: contractReason,
                      }),
                    )
                  }
                >
                  <Save aria-hidden="true" /> احفظ المراجعة
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {asset.status === "active" ? (
        <section className="micro-decision-card" aria-label="إنهاء الأصل">
          <button
            className="micro-text-action"
            type="button"
            aria-expanded={disposalOpen}
            onClick={() => setDisposalOpen(current => !current)}
          >
            تخلّص من الأصل أو اشطبه
          </button>
          {disposalOpen ? (
            <div className="micro-revision-form">
              <label className="micro-field">
                <span>مقابل البيع (د.أ) — اتركه صفرًا للشطب</span>
                <EnglishNumberInput
                  value={proceedsMinor}
                  kind="money"
                  onNumericChange={setProceedsMinor}
                  onTextValidityChange={setValidProceeds}
                  aria-label="مقابل البيع"
                />
              </label>
              <label className="micro-field">
                <span>السبب (مطلوب)</span>
                <input value={disposalReason} onChange={event => setDisposalReason(event.target.value)} placeholder="مثال: بعتُه، أو تلف كليًا" />
              </label>
              <p className="micro-field-hint">
                {proceedsMinor > 0
                  ? `البيع يدخل ${formatMoneyMinor(proceedsMinor)} د.أ للكاش، والفرق عن الدفتري (${formatMoneyMinor(summary.bookValueMinor)} د.أ) يظهر ربحًا أو خسارة معلنة.`
                  : `الشطب خسارة غير نقدية بالدفتري (${formatMoneyMinor(summary.bookValueMinor)} د.أ) — لا كاش يدخل أو يخرج.`}
              </p>
              <div className="micro-form-actions micro-contextual-actions">
                <button
                  className="micro-button micro-button-secondary"
                  type="button"
                  disabled={busy || !disposalReason.trim() || !validProceeds || proceedsMinor <= 0}
                  onClick={() =>
                    void run(() =>
                      assets.dispose(asset.id, {
                        on: localDateInAmman(),
                        proceedsMinor,
                        reason: disposalReason,
                      }),
                    )
                  }
                >
                  <HandCoins aria-hidden="true" /> تخلّص بمقابل
                </button>
                <button
                  className="micro-button micro-button-secondary"
                  type="button"
                  disabled={busy || !disposalReason.trim() || proceedsMinor > 0 || summary.bookValueMinor <= 0}
                  onClick={() =>
                    void run(() =>
                      assets.writeOff(asset.id, { on: localDateInAmman(), reason: disposalReason }),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" /> اشطب الأصل
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="micro-note-card" aria-label="أرشيف الأصل">
          <CircleDollarSign aria-hidden="true" />
          <p>
            {asset.status === "disposed" && asset.disposal
              ? `تخلص منه ${formatLocalDate(asset.disposal.on)} بمقابل ${formatMoneyMinor(asset.disposal.proceedsMinor)} د.أ — دفتري مغادر ${formatMoneyMinor(asset.disposal.bookValueMinor)} د.أ.`
              : asset.writeOff
                ? `شطب ${formatLocalDate(asset.writeOff.on)} — خسارة غير نقدية ${formatMoneyMinor(asset.writeOff.bookValueMinor)} د.أ.`
                : "أصل مؤرشف."}
          </p>
        </section>
      )}

      {message ? <p className="micro-field-error" role="alert">{message}</p> : null}

      <details className="micro-finance-layer" open>
        <summary className="micro-finance-layer-summary">تاريخ أحداث الأصل ({events.length})</summary>
        <ul className="micro-events-list">
          {/* المجموعة ٤ (تصحيح مراجعة 4-c): الأصل المعكوس يُعلَّم مشطوبًا — التاريخ
             صادق بصريًا لا يعرض المُلغى كأنه قائم. */}
          {(() => {
            const reversedIds = new Set(
              events
                .filter(event => event.correctionType === "reverse" && event.correctionOfEventId)
                .map(event => event.correctionOfEventId as string),
            );
            return events.map(event => (
              <li
                key={event.id}
                className="micro-event-row"
                data-type={event.type}
                data-reversed={reversedIds.has(event.id)}
              >
                <strong>{EVENT_LABELS[event.type] ?? event.type}</strong>
                <span><MoneyValue minor={event.amountMinor} /> د.أ · {formatLocalDate(event.occurredOn)}</span>
                {event.correctionType === "reverse" ? <small>تراجع موثق</small> : null}
                {event.correctionType !== "reverse" && reversedIds.has(event.id) ? (
                  <small>عُكِس لاحقًا</small>
                ) : null}
                {event.type === "asset_depreciation" && event.correctionType !== "reverse" ? (
                reversalTargetId === event.id ? (
                  <span className="micro-inline-reversal">
                    <input
                      value={reversalReason}
                      onChange={change => setReversalReason(change.target.value)}
                      placeholder="سبب تراجع الإهلاك (مطلوب)"
                      aria-label="سبب تراجع الإهلاك"
                    />
                    <button
                      className="micro-text-action"
                      type="button"
                      disabled={busy || !reversalReason.trim()}
                      onClick={() => {
                        void run(() => assets.reverseDepreciation(event.id, reversalReason.trim()));
                        setReversalTargetId(null);
                        setReversalReason("");
                      }}
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
                    onClick={() => setReversalTargetId(event.id)}
                  >
                    تراجع
                  </button>
                )
              ) : null}
              </li>
            ));
          })()}
        </ul>
      </details>
      <p className="micro-offline-truth">يعمل بلا إنترنت — كل التاريخ محفوظ محليًا على جهازك.</p>
    </section>
  );
}

const EVENT_LABELS: Record<string, string> = {
  asset_purchase_cash: "شراء نقدًا",
  asset_purchase_payable: "شراء بالذمم",
  asset_depreciation: "إهلاك",
  asset_disposal_cash: "تخلص",
  asset_writeoff: "شطب",
};
