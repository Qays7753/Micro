/* U-001: «السجل» — طبقة قراءة واحدة تجمع التصحيحات الموثقة عبر السجلات المدعومة.
 * سطح قراءة لا نظام كتابة ثانيًا: لا يعدّل حدثًا ولا يعيد تفسير الماضي. */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import type {
  CorrectionHistoryEntry,
  CorrectionHistoryGroup,
  CorrectionHistoryKind,
  CorrectionHistoryService,
} from "@/application/finance/correctionHistoryService";
import { formatLocalDate, formatMoneyMinor } from "@/presentation/formatters";
import { RestatementNote } from "@/components/finance/RestatementNote";

const kindLabel: Record<CorrectionHistoryKind, string> = {
  event_reversal: "تراجع موثق عن حدث مالي",
  event_edit: "تعديل موثق (تراجع + بديل)",
  event_restore: "استرجاع قيم أصلية",
  sale_edit: "تعديل بيع مباشر",
  sale_cancel: "إلغاء بيع مباشر",
  sale_price_cut: "تخفيض سعر موثّق",
  cash_reversal: "تراجع عن قيد كاش",
  purchase_edit: "تعديل شراء موثق",
  payment_reversal: "تراجع عن دفعة مورد",
  order_price_revision: "تعديل سعر طلب بعد الاتفاق",
  order_collection_reversal: "تراجع عن قبضة طلب",
  /* المجموعة ٥ (عقد ٣٤): عائلات عقد ٢٩ والأصحاب الجديدة — لغة هادئة بصيغة
   * الماضي: ما حدث + ما بقي محفوظًا. */
  asset_correction: "تصحيح قيمة أو طريقة اقتناء أصل",
  loan_correction: "تصحيح أصل قرض موثق",
  deposit_reclassification: "تغيير معنى عربون محتفظ به",
  delivery_reversal: "عكس تسليم موثق",
  deposit_classification: "تصنيف عربون محتفظ به",
  inventory_reversal: "عكس حركة مخزون موثق",
  owner_reversal: "تراجع عن حركة مال المالك",
  asset_contract_revision: "تعديل مدة الإهلاك أو بدايته",
};
const groupOf = (kind: CorrectionHistoryKind): Exclude<CorrectionHistoryGroup, "all"> =>
  kind === "sale_edit" || kind === "sale_cancel" || kind === "sale_price_cut"
    ? "sales"
    : kind === "cash_reversal"
      ? "cash"
      : kind === "purchase_edit" || kind === "payment_reversal"
        ? "purchases"
        : kind === "order_price_revision" ||
            kind === "order_collection_reversal" ||
            kind === "delivery_reversal" ||
            kind === "deposit_classification" ||
            kind === "deposit_reclassification"
          ? "orders"
          : "events";
const groupLabel: Record<CorrectionHistoryGroup, string> = {
  all: "الكل",
  events: "أحداث مالية",
  sales: "مبيعات مباشرة",
  cash: "كاش ومحافظ",
  purchases: "مشتريات وموردين",
  orders: "طلبات",
};

type LayerState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; entries: readonly CorrectionHistoryEntry[] };

function CorrectionRow({
  entry,
  onOpenSource,
}: {
  entry: CorrectionHistoryEntry;
  onOpenSource: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="micro-finance-event" data-correction-kind={entry.kind}>
      <div className="micro-finance-event-main">
        <div>
          <strong>{kindLabel[entry.kind]}</strong>
          <small>
            <bdi dir="ltr">{formatLocalDate(entry.recordedAt.slice(0, 10)) ?? entry.recordedAt.slice(0, 10)}</bdi>
            {entry.occurredOn && entry.occurredOn !== entry.recordedAt.slice(0, 10)
              ? ` · تاريخ الأثر ${formatLocalDate(entry.occurredOn) ?? entry.occurredOn}`
              : ""}
          </small>
        </div>
        <b>
          {entry.amountEffectMinor === null ? (
            "—"
          ) : (
            <>
              {formatMoneyMinor(entry.amountEffectMinor)} د.أ
            </>
          )}
        </b>
      </div>
      {entry.reason ? (
        <p className="micro-finance-event-note">
          <span>السبب: </span>
          {entry.reason}
        </p>
      ) : null}
      {entry.originalLabel ? (
        <p className="micro-finance-event-note">
          <span>الأصل: </span>
          {entry.originalLabel}
        </p>
      ) : null}
      {entry.replacementLabel ? (
        <p className="micro-finance-event-note">
          <span>البديل/النتيجة: </span>
          {entry.replacementLabel}
        </p>
      ) : null}
      {entry.deepLink ? (
        <button
          className="micro-text-action"
          type="button"
          onClick={() => onOpenSource(entry.deepLink ?? "")}
        >
          افتح السجل المصدر
        </button>
      ) : (
        <button
          className="micro-text-action micro-finance-event-toggle"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(current => !current)}
        >
          {open ? "إخفاء التفاصيل" : "عرض التفاصيل"}
        </button>
      )}
      {open ? (
        <small className="micro-finance-event-audit">
          تصحيح قراءة فقط من سجلك المحلي؛ لا يضيف هذا السجل حدثًا ولا يعدّل قيمة مسجّلة. أنواع التصحيح
          الموثقة تُنفَّذ من صفوفها الأصلية في «السجل والأثر» و«مبيعاتي».
        </small>
      ) : null}
    </article>
  );
}

export function CorrectionsLayer({
  correctionHistory,
  reloadToken,
  initiallyOpen = false,
}: {
  correctionHistory: CorrectionHistoryService;
  reloadToken: number;
  initiallyOpen?: boolean;
}) {
  const [, navigate] = useLocation();
  const [state, setState] = useState<LayerState>({ phase: "idle" });
  const [filter, setFilter] = useState<CorrectionHistoryGroup>("all");

  const load = (service: CorrectionHistoryService) => {
    setState({ phase: "loading" });
    void service
      .list()
      .then(result => {
        setState(
          result.ok
            ? { phase: "ready", entries: result.value }
            : { phase: "error", message: result.message },
        );
      })
      .catch(() => setState({ phase: "error", message: "تعذر قراءة سجل التصحيحات المحلي." }));
  };

  /* تحميل كسول عند أول فتح، وتحديث عند تغير البيانات إن كان مفتوحًا. */
  const [openedOnce, setOpenedOnce] = useState(initiallyOpen);
  /* S1-09: ?layer=corrections يفتح طبقة «السجل» من الوصلة العميقة (عقد ٢٦ §3.1). */
  const [layerOpen, setLayerOpen] = useState(initiallyOpen);
  useEffect(() => {
    if (initiallyOpen && state.phase === "idle") load(correctionHistory);
  }, [initiallyOpen]);
  const onToggle = (event: React.ToggleEvent<HTMLDetailsElement>) => {
    setLayerOpen(event.currentTarget.open);
    if (event.currentTarget.open && state.phase === "idle") {
      setOpenedOnce(true);
      load(correctionHistory);
    }
  };
  useEffect(() => {
    if (openedOnce) load(correctionHistory);
    /* reloadToken intentionally refreshes an opened layer on data changes. */
  }, [reloadToken, correctionHistory]);

  const entries = state.phase === "ready" ? state.entries : [];
  const filtered =
    filter === "all" ? entries : entries.filter(entry => groupOf(entry.kind) === filter);
  const counts: Record<CorrectionHistoryGroup, number> = {
    all: entries.length,
    events: entries.filter(entry => groupOf(entry.kind) === "events").length,
    sales: entries.filter(entry => groupOf(entry.kind) === "sales").length,
    cash: entries.filter(entry => groupOf(entry.kind) === "cash").length,
    purchases: entries.filter(entry => groupOf(entry.kind) === "purchases").length,
    orders: entries.filter(entry => groupOf(entry.kind) === "orders").length,
  };

  return (
    <details className="micro-finance-layer micro-corrections-layer" open={layerOpen} onToggle={onToggle}>
      <summary className="micro-finance-layer-summary">
        <span>
          <b>السجل</b>
          <small>كل تصحيح وتراجع وتعديل وحذف واسترجاع — بأسبابه وأثره</small>
        </span>
        <strong>افتح سجل التصحيحات</strong>
      </summary>
      <section className="micro-finance-event-list" aria-label="سجل التصحيحات">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">سجل قراءة · لا يكتب حدثًا</span>
          <h2>تصحيحاتي الموثقة</h2>
          <p>يجمع هذا السجل ما سُجّل فعلًا: الأسباب، والأثر، وعلاقة الأصل بالبديل، وصولًا لكل سجل.</p>
        </div>
        {state.phase === "loading" || state.phase === "idle" ? (
          <p role="status">جارٍ قراءة التصحيحات الموثقة…</p>
        ) : null}
        {state.phase === "error" ? (
          <p className="micro-field-error" role="status">
            {state.message} لم يتغير أي سجل؛ أعد الفتح للمحاولة.
          </p>
        ) : null}
        {state.phase === "ready" && entries.length > 0 ? (
          /* المجموعة ٦ (البند ٣ — S2-09): سطر واحد عند رأس السجل يقول الدلالة
           * نفسها — الأصل باقٍ والتصحيح سِجِل جديد والظاهر صافيهما. */
          <RestatementNote
            count={entries.length}
            netAmountMinor={
              entries.some(entry => entry.amountEffectMinor === null)
                ? null
                : entries.reduce((sum, entry) => sum + (entry.amountEffectMinor ?? 0), 0)
            }
            onOpen={() => {
              const first = entries.find(entry => entry.deepLink) ?? null;
              if (first?.deepLink) navigate(first.deepLink);
            }}
          />
        ) : null}
        {state.phase === "ready" ? (
          entries.length === 0 ? (
            <p className="micro-empty-copy">
              لا تصحيحات موثقة بعد. هذا طبيعي: كل تراجع أو تعديل أو حذف من صفوفه الأصلية يظهر هنا تلقائيًا.
            </p>
          ) : (
            <>
              <div className="micro-form-actions" role="group" aria-label="تصفية سجل التصحيحات">
                {(Object.keys(groupLabel) as CorrectionHistoryGroup[]).map(group => (
                  <button
                    key={group}
                    className="micro-text-action"
                    type="button"
                    aria-pressed={filter === group}
                    onClick={() => setFilter(group)}
                  >
                    {groupLabel[group]} ({counts[group]})
                  </button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <p className="micro-empty-copy">لا تصحيحات في هذا التصنيف ضمن سجلك الحالي.</p>
              ) : (
                <div className="micro-list micro-list-compact">
                  {filtered.slice(0, 30).map(entry => (
                    <CorrectionRow
                      key={entry.id}
                      entry={entry}
                      onOpenSource={path => navigate(withFrom(path, "/finance"))}
                    />
                  ))}
                </div>
              )}
              {entries.length > 30 ? (
                <p className="micro-finance-event-closed">
                  تُعرض أحدث 30 تصحيحًا من {entries.length}؛ السجل الكامل محفوظ محليًا ولا يُحذف.
                </p>
              ) : null}
            </>
          )
        ) : null}
      </section>
    </details>
  );
}
