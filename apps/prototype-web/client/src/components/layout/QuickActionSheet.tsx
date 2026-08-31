/*
 * Micro design reminder: every quick action must end in a real path or be
 * clearly marked as unavailable; the sheet never creates a financial effect.
 */
/* §٥-١٤ (المرحلة أ — م٣): البيع والمصروف فعلان عابران — يتمان داخل الورقة فوق
 * شاشة الوقوف بحدودهما الدنيا، والنموذج الكامل يبقى باب التصحيح والعمق. */
import {
  ArrowRight,
  BadgeDollarSign,
  CircleDollarSign,
  ClipboardPlus,
  HandCoins,
  PackagePlus,
  X,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";

export type QuickAction = "sale" | "expense" | "order" | "estimate" | "collection";
export type QuickActionItem = {
  action: QuickAction;
  label: string;
  description: string;
  icon: typeof ClipboardPlus;
  disabled?: boolean;
};
type QuickActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: QuickAction) => void;
};
type SheetMode = "menu" | "sale-form" | "expense-form" | "receipt";
type Receipt = { title: string; amountMinor: number; cashMinor: number | null };

/* القرار ٢٣-ب: الأفعال المتكررة يوميًا — تسجيل بيع · تسجيل مصروف · إضافة طلب.
 * البيع المباشر أولًا (R-1 أعلى الورقة)، والمصروف لحظته (م1 — F-036 في موضعه الجديد). */
export const actionItems: readonly QuickActionItem[] = [
  {
    action: "sale",
    label: "تسجيل بيع",
    description: "احفظ بيعًا مباشرًا من دون إنشاء طلب.",
    icon: BadgeDollarSign,
  },
  {
    action: "expense",
    label: "تسجيل مصروف",
    description: "سجّل مصروفًا مدفوعًا في لحظته، من أي مكان.",
    icon: CircleDollarSign,
  },
  { action: "order", label: "طلب من عميل", description: "ابدأ مسودة طلب واتفاق أولي.", icon: ClipboardPlus },
  {
    action: "estimate",
    label: "مسودة تصميم",
    description: "ابدأ مسودة تصميم قبل أن تتحول إلى اتفاق.",
    icon: PackagePlus,
  },
  {
    action: "collection",
    label: "عربون أو تحصيل",
    description: "افتح طلبًا موجودًا؛ التحصيل مرتبط بطلب محدد.",
    icon: HandCoins,
  },
];

export function QuickActionSheet({ open, onOpenChange, onAction }: QuickActionSheetProps) {
  const { directSales, projectFinance, cashContinuity, notifyDataChanged, dataVersion } =
    usePrototypeServices();
  const [mode, setMode] = useState<SheetMode>("menu");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  /* نموذج البيع */
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
  const [wallets, setWallets] = useState<readonly { id: string; name: string }[]>([]);
  const [saleWalletId, setSaleWalletId] = useState("");
  const [expenseWalletId, setExpenseWalletId] = useState("");
  /* نموذج المصروف */
  const [expenseAmountMinor, setExpenseAmountMinor] = useState(0);
  const [expenseAmountValid, setExpenseAmountValid] = useState(true);
  const [expenseNote, setExpenseNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saleKeyRef = useRef(`sheet-sale-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const expenseKeyRef = useRef(`sheet-expense-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  useEffect(() => {
    if (!open) return;
    cashContinuity.overview().then(result => {
      if (result.ok) setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
    });
  }, [open, cashContinuity, dataVersion]);

  function reset() {
    setMode("menu");
    setReceipt(null);
    setSaleName("");
    setSaleAmountMinor(0);
    setSaleCostKnown(false);
    setSaleCostMinor(0);
    setSaleOnCredit(false);
    setSaleCollectedMinor(0);
    setSaleCustomer("");
    setSaleWalletId("");
    setExpenseAmountMinor(0);
    setExpenseWalletId("");
    setExpenseNote("");
    setFormError(null);
    saleKeyRef.current = `sheet-sale-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    expenseKeyRef.current = `sheet-expense-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function cashNow(): Promise<number | null> {
    const position = await projectFinance.readPosition();
    return position.ok ? position.value.recordedCashMinor : null;
  }

  /* ٥.٢: تخصيص صريح بعد التسجيل — الحركة تُنسب للمحفظة المختارة بلا انتظار. */
  async function attributeToWallet(walletId: string, deltaMinor: number, note: string) {
    if (!walletId || deltaMinor === 0) return;
    await projectFinance.distributeUnallocated({ walletId, deltaMinor, note });
  }

  async function submitSale() {
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
    setSaving(true);
    const result = await directSales.record({
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
    if (!result.ok) {
      setSaving(false);
      setFormError(result.message);
      return;
    }
    notifyDataChanged();
    /* ٥.٢: نسبة المقبوض للمحفظة المختارة إن حُددت — تحصيلًا لا دينًا. */
    const attributedMinor = saleOnCredit ? saleCollectedMinor : saleAmountMinor;
    if (saleWalletId && attributedMinor > 0)
      await attributeToWallet(saleWalletId, attributedMinor, "تخصيص قبض بيع من ورقة الإضافة");
    const cashMinor = await cashNow();
    setSaving(false);
    setReceipt({ title: saleOnCredit ? "سُجّل بيع آجل" : "سُجّل بيع", amountMinor: saleAmountMinor, cashMinor });
    setMode("receipt");
  }

  async function submitExpense() {
    if (!expenseAmountValid || !Number.isInteger(expenseAmountMinor) || expenseAmountMinor <= 0) {
      setFormError("أدخل مبلغ المصروف بالأرقام 0–9.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const result = await projectFinance.record({
      type: "operating_expense_cash",
      amountMinor: expenseAmountMinor,
      occurredOn: localDateInAmman(),
      note: expenseNote.trim() || "مصروف مدفوع في لحظته",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
      },
      idempotencyKey: expenseKeyRef.current,
    });
    if (!result.ok) {
      setSaving(false);
      setFormError(result.message);
      return;
    }
    notifyDataChanged();
    /* ٥.٢: إن حُددت محفظة، يُغطى الصرف منها بتخصيص سالب — بلا تخصيص صامت. */
    if (expenseWalletId && expenseAmountMinor > 0)
      await attributeToWallet(expenseWalletId, -expenseAmountMinor, "تغطية مصروف من رصيد المحفظة");
    const cashMinor = await cashNow();
    setSaving(false);
    setReceipt({ title: "سُجّل مصروف", amountMinor: expenseAmountMinor, cashMinor });
    setMode("receipt");
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} direction="bottom">
      <DrawerContent className="micro-bottom-sheet" dir="rtl">
        <DrawerHeader className="micro-sheet-header">
          <div className="micro-sheet-title-row">
            <div>
              {mode === "menu" ? (
                <>
                  <DrawerTitle className="micro-sheet-title">ماذا تريد أن تسجّل؟</DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    اختر حدثًا واحدًا لنكمل الخطوة المناسبة.
                  </DrawerDescription>
                </>
              ) : mode === "sale-form" ? (
                <>
                  <DrawerTitle className="micro-sheet-title">سجّل بيعًا الآن</DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    المبلغ هو الحقل الإلزامي الوحيد — يتم التسجيل هنا فوق شاشتك من دون انتقال.
                  </DrawerDescription>
                </>
              ) : mode === "expense-form" ? (
                <>
                  <DrawerTitle className="micro-sheet-title">سجّل مصروفًا الآن</DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    مبلغ وبند اختياري — يتم التسجيل هنا فوق شاشتك من دون انتقال.
                  </DrawerDescription>
                </>
              ) : (
                <>
                  <DrawerTitle className="micro-sheet-title">وصل التسجيل</DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    فعل مالي مسجل محليًا؛ لم تغادر مكانك.
                  </DrawerDescription>
                </>
              )}
            </div>
            <DrawerClose asChild>
              <button className="micro-icon-button" type="button" aria-label="إغلاق" onClick={reset}>
                <X aria-hidden="true" />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        {mode === "menu" ? (
          <div className="micro-sheet-actions">
            {actionItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.action}
                  className="micro-sheet-action"
                  type="button"
                  disabled={item.disabled}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => {
                    if (item.disabled) return;
                    /* م٣: البيع والمصروف يحدثان داخل الورقة — فعل عابر فوق شاشة الوقوف.
                     * بقية الأفعال بداية مسارات أعمق فتُسلَّم للموجه. */
                    if (item.action === "sale") {
                      setMode("sale-form");
                      return;
                    }
                    if (item.action === "expense") {
                      setMode("expense-form");
                      return;
                    }
                    onAction(item.action);
                  }}
                >
                  <span className="micro-sheet-action-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : mode === "sale-form" ? (
          <div className="micro-sheet-form">
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
                  محفظة القبض <small>اختياري — الإهمال يبقيه في غير الموزع</small>
                </span>
                <select value={saleWalletId} onChange={event => setSaleWalletId(event.target.value)}>
                  <option value="">بلا نسبة الآن — كاش غير موزع</option>
                  {wallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {formError ? (
              <p className="micro-field-error" role="status">
                {formError}
              </p>
            ) : null}
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={saving}
              onClick={() => {
                void submitSale();
              }}
            >
              {saving ? "جارٍ التسجيل…" : "سجّل البيع"}
            </button>
            <button className="micro-text-action" type="button" onClick={() => setMode("menu")}>
              رجوع إلى القائمة <ArrowRight aria-hidden="true" />
            </button>
          </div>
        ) : mode === "expense-form" ? (
          <div className="micro-sheet-form">
            <label className="micro-field">
              <span>المبلغ المدفوع بالدينار الأردني</span>
              <EnglishNumberInput
                value={expenseAmountMinor}
                kind="money"
                onNumericChange={setExpenseAmountMinor}
                onTextValidityChange={setExpenseAmountValid}
                aria-label="مبلغ المصروف"
              />
            </label>
            <label className="micro-field">
              <span>
                البند <small>اختياري</small>
              </span>
              <input
                value={expenseNote}
                onChange={event => setExpenseNote(event.target.value)}
                placeholder="مثال: أكياس تغليف"
              />
            </label>
            {wallets.length > 0 ? (
              <label className="micro-field">
                <span>
                  محفظة الصرف <small>اختياري — الإهمال يخرج من غير الموزع</small>
                </span>
                <select value={expenseWalletId} onChange={event => setExpenseWalletId(event.target.value)}>
                  <option value="">بلا نسبة الآن — من الكاش غير الموزع</option>
                  {wallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {formError ? (
              <p className="micro-field-error" role="status">
                {formError}
              </p>
            ) : null}
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={saving}
              onClick={() => {
                void submitExpense();
              }}
            >
              {saving ? "جارٍ التسجيل…" : "سجّل المصروف"}
            </button>
            <button className="micro-text-action" type="button" onClick={() => setMode("menu")}>
              رجوع إلى القائمة <ArrowRight aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="micro-sheet-receipt" role="status">
            {receipt ? (
              <>
                <strong>
                  {receipt.title} {formatMoneyMinor(receipt.amountMinor)} د.أ
                  {receipt.cashMinor !== null ? (
                    <> — الكاش المسجل الآن {formatMoneyMinor(receipt.cashMinor)} د.أ</>
                  ) : null}
                  .
                </strong>
                <p>أُغلق التسجيل فوق شاشتك؛ صحّح من «العمل» أو «مالي» عند الحاجة.</p>
              </>
            ) : null}
            <button
              className="micro-button micro-button-primary"
              type="button"
              onClick={() => handleOpenChange(false)}
            >
              تم
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
