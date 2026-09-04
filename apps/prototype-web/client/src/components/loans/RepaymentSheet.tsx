/**
 * المجموعة ٤ (عقد ٢٩): ورقة سداد الدفعة — واجهة سفلية سريعة (vaul) لسداد
 * جزئي أو كامل. تُظهر الأصل والمسدَّد والمتبقي قبل التأكيد، وتحرس التجاوز.
 * السداد يرفع الكاش ويخفض القرض — لا إيراد جديد أبدًا.
 */
import { HandCoins, Save } from "lucide-react";
import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { localDateInAmman, formatMoneyMinor } from "@/presentation/formatters";
import type { LoanSummaryRow } from "@/application/loans/loanService";

export default function RepaymentSheet({
  row,
  onClose,
  onDone,
}: {
  row: LoanSummaryRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { loans } = usePrototypeServices();
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [date, setDate] = useState(() => localDateInAmman());
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!validAmount || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      setMessage("أدخل مبلغ الدفعة بالأرقام 0–9.");
      return;
    }
    if (amountMinor > row.reading.outstandingMinor) {
      setMessage(`المتبقي من القرض ${formatMoneyMinor(row.reading.outstandingMinor)} د.أ — الدفعة لا تتخطاه.`);
      return;
    }
    setMessage(null);
    setSaving(true);
    const result = await loans.recordRepayment(row.loan.id, { amountMinor, date, note: note.trim() || null });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    onDone();
  }

  return (
    <Drawer open={true} onOpenChange={open => (open ? undefined : onClose())}>
      <DrawerContent dir="rtl">
        <DrawerHeader>
          <DrawerTitle>سداد دفعة من قرض {row.loan.borrowerName}</DrawerTitle>
          <DrawerDescription>
            السداد يرفع الكاش ويخفض المتبقي — ليس إيرادًا جديدًا ولا ربحًا.
          </DrawerDescription>
        </DrawerHeader>
        <div className="micro-repayment-strip">
          <span>الأصل: <MoneyValue minor={row.reading.principalMinor} /> د.أ</span>
          <span>المسدَّد: <MoneyValue minor={row.reading.repaidActiveMinor} /> د.أ</span>
          <span>المتبقي: <MoneyValue minor={row.reading.outstandingMinor} /> د.أ</span>
        </div>
        {row.reading.outstandingMinor > 0 ? (
          <button
            className="micro-text-action"
            type="button"
            onClick={() => setAmountMinor(row.reading.outstandingMinor)}
          >
            املأ السداد الكامل المتبقي (<MoneyValue minor={row.reading.outstandingMinor} /> د.أ)
          </button>
        ) : null}
        <label className="micro-field">
          <span>المبلغ المستلم (د.أ)</span>
          <EnglishNumberInput
            value={amountMinor}
            kind="money"
            onNumericChange={setAmountMinor}
            onTextValidityChange={setValidAmount}
            aria-label="مبلغ الدفعة"
          />
        </label>
        <LocalDateField label="تاريخ الدفعة" value={date} onChange={event => setDate(event.target.value)} />
        <label className="micro-field">
          <span>ملاحظة (اختياري)</span>
          <input value={note} onChange={event => setNote(event.target.value)} placeholder="مثال: دفعة أولى نقدًا" />
        </label>
        {message ? <p className="micro-field-error" role="alert">{message}</p> : null}
        <div className="micro-form-actions micro-contextual-actions">
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "جارٍ الحفظ…" : "أكّد السداد"}
            {saving ? null : <Save aria-hidden="true" />}
          </button>
          <button className="micro-button micro-button-secondary" type="button" onClick={onClose}>
            ألغِ
          </button>
        </div>
        <p className="micro-offline-truth">
          <HandCoins aria-hidden="true" /> يعمل بلا إنترنت — يُحفظ محليًا على جهازك.
        </p>
      </DrawerContent>
    </Drawer>
  );
}
