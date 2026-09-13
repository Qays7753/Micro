import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import { attributeToWallet, cashNow } from "./quickFormHelpers";
import type {
  QuickActionFormHandle,
  QuickActionReceipt,
  QuickActionWalletOption,
} from "./quickActionFormTypes";

/*
 * W3 — نموذج البيع السريع (نمط مالية، لا قشرة): يملك حقوله وتحققه وتسجيله.
 * القشرة توزّع فقط. الملكية المالية (المعنى) تبقى في domain/application —
 * هذا المكوّن عرض وتجميع. معاينة الأثر قبل الحفظ (Scope A) باقية كما هي.
 */

type QuickSaleFormProps = {
  wallets: readonly QuickActionWalletOption[];
  /** وجهة القبض الافتراضية (الدرج) حين يوجد — خيار صريح داخل النموذج. */
  defaultWalletId?: string;
  onSubmitted: (receipt: QuickActionReceipt) => void;
  onBackToMenu: () => void;
  onSavingChange?: (saving: boolean) => void;
  hidden?: boolean;
};

export const QuickSaleForm = forwardRef<QuickActionFormHandle, QuickSaleFormProps>(function QuickSaleForm(
  { wallets, defaultWalletId = "", onSubmitted, onBackToMenu, onSavingChange, hidden = false },
  ref,
) {
  const { directSales, projectFinance, notifyDataChanged } = usePrototypeServices();
  const [saleName, setSaleName] = useState("");
  const [saleAmountMinor, setSaleAmountMinor] = useState(0);
  const [saleAmountValid, setSaleAmountValid] = useState(true);
  const [saleCostKnown, setSaleCostKnown] = useState(false);
  const [saleCostMinor, setSaleCostMinor] = useState(0);
  const [saleCostValid, setSaleCostValid] = useState(true);
  /* ٥.٥: بيع آجل سريع من الورقة نفسها — اسم والباقي دين موثق. */
  const [saleOnCredit, setSaleOnCredit] = useState(false);
  const [saleCollectedMinor, setSaleCollectedMinor] = useState(0);
  const [saleCollectedValid, setSaleCollectedValid] = useState(true);
  const [saleCustomer, setSaleCustomer] = useState("");
  /* ٥.٢: نسبة الحركة لمحفظة عند الإدخال حينما يختار المالك ذلك — بلا تخصيص صامت. */
  const [saleWalletId, setSaleWalletId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* P0 (إعادة الدخول): نبضة مزدوجة قبل إعادة الرسم أو نداء برمجي متزامن لا
   * يسجل البيع مرتين — مع حتمية المخزن كخط دفاع ثانٍ (نمط AI-02). */
  const saveInFlightRef = useRef(false);
  const saleKeyRef = useRef(`sheet-sale-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  /* المجموعة ٢ (Scope A): الدرج وجهة القبض الافتراضية حين يوجد — غير الموزع
   * خيار صريح لا اختيارًا صامتًا؛ لا نختار نيابةً عن المالك بعد اختيار صريح. */
  useEffect(() => {
    setSaleWalletId(current => current || defaultWalletId || "");
  }, [defaultWalletId]);

  function isDirty(): boolean {
    return Boolean(
      saleName.trim() ||
      saleAmountMinor > 0 ||
      saleCostKnown ||
      saleOnCredit ||
      saleCollectedMinor > 0 ||
      saleCustomer.trim() ||
      saleWalletId,
    );
  }

  async function submit() {
    if (saveInFlightRef.current) return;
    if (!saleAmountValid || !Number.isInteger(saleAmountMinor) || saleAmountMinor <= 0) {
      setFormError("أدخل مبلغ البيع بالأرقام 0–9.");
      return;
    }
    if (saleCostKnown && (!saleCostValid || saleCostMinor < 0)) {
      setFormError("أدخل التكلفة بالأرقام 0–9 أو اختر «لا أعرف الآن».");
      return;
    }
    if (saleOnCredit) {
      if (!saleCollectedValid || !Number.isInteger(saleCollectedMinor) || saleCollectedMinor < 0) {
        setFormError("أدخل المبلغ المحصل الآن بالأرقام 0–9.");
        return;
      }
      if (saleCollectedMinor >= saleAmountMinor) {
        setFormError("البيع الآجل يقتضي تحصيلًا أقل من المبلغ الكامل.");
        return;
      }
      if (!saleCustomer.trim()) {
        setFormError("اكتب اسم الزبون ليتجمع دينه في دفتر الناس.");
        return;
      }
    }
    setFormError(null);
    saveInFlightRef.current = true;
    setSaving(true);
    onSavingChange?.(true);
    let result: Awaited<ReturnType<typeof directSales.record>>;
    try {
      result = await directSales.record({
        itemName: saleName.trim() || "بيع نقدي",
        quantity: 1,
        revenueMinor: saleAmountMinor,
        collectedMinor: saleOnCredit ? saleCollectedMinor : undefined,
        collectionStatus: saleOnCredit ? "partial_debt" : undefined,
        /* D-001: الزبون بيانات مستقلة — لا يُدفن اسمه في نص الملاحظة. */
        customerName: saleOnCredit ? saleCustomer.trim() : null,
        costMinor: saleCostKnown ? saleCostMinor : null,
        occurredOn: localDateInAmman(),
        note: saleOnCredit ? "بيع آجل من ورقة الإضافة" : "بيع مباشر من ورقة الإضافة",
        idempotencyKey: saleKeyRef.current,
      });
    } finally {
      saveInFlightRef.current = false;
    }
    if (!result.ok) {
      setSaving(false);
      onSavingChange?.(false);
      setFormError(result.message);
      return;
    }
    notifyDataChanged();
    /* ٥.٢: نسبة المقبوض للمحفظة المختارة إن حُددت — تحصيلًا لا دينًا. */
    const attributedMinor = saleOnCredit ? saleCollectedMinor : saleAmountMinor;
    let attributionNote: string | null = null;
    if (saleWalletId && attributedMinor > 0)
      attributionNote = (
        await attributeToWallet(
          projectFinance,
          saleWalletId,
          attributedMinor,
          "تخصيص قبض بيع من ورقة الإضافة",
          result.value.id,
          "sale",
          `${saleKeyRef.current}:attribute`,
        )
      ).message;
    const cashMinor = await cashNow(projectFinance);
    setSaving(false);
    onSavingChange?.(false);
    onSubmitted({
      title: saleOnCredit ? "سُجّل بيع آجل" : "سُجّل بيع",
      amountMinor: saleAmountMinor,
      cashMinor,
      recordHref: `/direct-sales/${encodeURIComponent(result.value.id)}`,
      detail: saleOnCredit
        ? `دين مسجل على «${saleCustomer.trim()}»: ${formatMoneyMinor(
            saleAmountMinor - saleCollectedMinor,
          )} د.أ — يظهر في دفتر الناس ولي عند العملاء.`
        : null,
      attributionNote,
    });
  }

  useImperativeHandle(ref, () => ({ isDirty, submit }));

  return (
    <div className="micro-sheet-form" hidden={hidden || undefined}>
      <label className="micro-field">
        <span>
          ما الذي بعته؟ <small>اختياري</small>
        </span>
        <input
          value={saleName}
          onChange={event => setSaleName(event.target.value)}
          placeholder="مثال: كوب قهوة"
        />
      </label>
      <label className="micro-field">
        <span>المبلغ المحصل بالدينار الأردني</span>
        <EnglishNumberInput
          value={saleAmountMinor}
          kind="money"
          onNumericChange={setSaleAmountMinor}
          onTextValidityChange={setSaleAmountValid}
          aria-label="مبلغ البيع"
        />
      </label>
      <label className="micro-field">
        <span>هل تعرف تكلفته؟</span>
        <select
          value={saleCostKnown ? "known" : "unknown"}
          onChange={event => setSaleCostKnown(event.target.value === "known")}
        >
          <option value="unknown">لا أعرف الآن — الربح «غير متاح» لا صفر</option>
          <option value="known">نعم، أعرفها</option>
        </select>
      </label>
      {saleCostKnown ? (
        <label className="micro-field">
          <span>التكلفة بالدينار الأردني</span>
          <EnglishNumberInput
            value={saleCostMinor}
            kind="money"
            onNumericChange={setSaleCostMinor}
            onTextValidityChange={setSaleCostValid}
            aria-label="تكلفة البيع"
          />
        </label>
      ) : null}
      {/* ٥.٥: مفتاح الآجل — بيع سريع بلا مسار طلبية ثقيل. */}
      <label className="micro-field">
        <span>هل بقي شيء عليه؟</span>
        <select
          value={saleOnCredit ? "credit" : "full"}
          onChange={event => setSaleOnCredit(event.target.value === "credit")}
        >
          <option value="full">قُبض المبلغ كاملًا</option>
          <option value="credit">آجل — الباقي دين باسم الزبون</option>
        </select>
      </label>
      {saleOnCredit ? (
        <>
          <label className="micro-field">
            <span>اسم الزبون</span>
            <input
              value={saleCustomer}
              onChange={event => setSaleCustomer(event.target.value)}
              placeholder="مثال: خالد"
            />
            <small>يتجمع دينه في «دفتر الناس» باسمه هذا.</small>
          </label>
          <label className="micro-field">
            <span>المبلغ المحصل الآن (د.أ)</span>
            <EnglishNumberInput
              value={saleCollectedMinor}
              kind="money"
              onNumericChange={setSaleCollectedMinor}
              onTextValidityChange={setSaleCollectedValid}
              aria-label="المبلغ المحصل الآن"
            />
            <small>ما لم يُقبض يُسجّل دينًا — لا يدخل الكاش ولا يُعرض ربحًا.</small>
          </label>
        </>
      ) : null}
      {wallets.length > 0 ? (
        <label className="micro-field">
          <span>
            وجهة القبض <small>الدرج افتراضيًا حين يوجد — غير الموزع خيار صريح</small>
          </span>
          <select value={saleWalletId} onChange={event => setSaleWalletId(event.target.value)}>
            <option value="">غير موزع — يبقى هنا حتى توزّعه بقرار</option>
            {wallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {/* المجموعة ٢ (Scope A): معاينة الأثر قبل الحفظ — القبض كاش والباقي دين. */}
      {saleAmountMinor > 0 && saleAmountValid ? (
        <p className="micro-local-truth" role="status">
          {saleOnCredit ? (
            <>
              سيدخل الكاش {formatMoneyMinor(saleCollectedValid ? saleCollectedMinor : 0)} د.أ
              {saleWalletId
                ? ` إلى «${wallets.find(wallet => wallet.id === saleWalletId)?.name ?? ""}»`
                : " غير موزع"}{" "}
              · ويسجل دين{" "}
              {formatMoneyMinor(Math.max(saleAmountMinor - (saleCollectedValid ? saleCollectedMinor : 0), 0))}{" "}
              د.أ على «{saleCustomer.trim() || "الزبون"}» — لا إيراد ولا ربح يُعرض قبل التسليم/البيع المسجل.
            </>
          ) : (
            <>
              سيدخل المبلغ {formatMoneyMinor(saleAmountMinor)} د.أ
              {saleWalletId
                ? ` إلى «${wallets.find(wallet => wallet.id === saleWalletId)?.name ?? ""}»`
                : " كاشًا غير موزع"}{" "}
              — إيراد هذا البيع يُعرف بتاريخه لا بتاريخ القبض.
            </>
          )}
        </p>
      ) : null}
      {formError ? (
        <p className="micro-field-error" role="alert">
          {formError}
        </p>
      ) : null}
      <button
        className="micro-button micro-button-primary"
        type="button"
        disabled={saving}
        onClick={() => {
          void submit();
        }}
      >
        {saving ? "جارٍ التسجيل…" : "سجّل البيع"}
      </button>
      <button className="micro-text-action" type="button" onClick={onBackToMenu}>
        رجوع إلى القائمة <ArrowRight aria-hidden="true" />
      </button>
    </div>
  );
});
