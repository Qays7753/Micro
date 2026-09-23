/**
 * FIN-001 (WS-178 — Wave 6): ورقة سداد أصل قرض مستلم — واجهة سفلية سريعة
 * (vaul) لسداد جزئي أو كامل من التزام الاقتراض. تُظهر الأصل والمسدَّد
 * والالتزام القائم قبل التأكيد، وتحرس التجاوز. السداد ينزل الكاش وينزل
 * الالتزام بالمبلغ نفسه — ليس مصروفًا ولا ربحًا ولا يمس نتيجة الفترة أبدًا.
 * الخدمة تمر خصائصًا من صفحتها (تُحمّل ديناميكيًا بسابقة EXE-014).
 */
import { HandCoins, Save } from "lucide-react";
import { useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { localDateInAmman, formatMoneyMinor } from "@/presentation/formatters";
import type { ReceivedLoanSummaryRow, ReceivedLoanService } from "@/application/loans/receivedLoanService";

import { Button } from "@/components/primitives";
export default function ReceivedLoanRepaymentSheet({
  service,
  row,
  onClose,
  onDone,
}: {
  service: ReceivedLoanService;
  row: ReceivedLoanSummaryRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [date, setDate] = useState(() => localDateInAmman());
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* عهدة تزامنية ضد الإرسال المزدوج (A2/AI-02 نفسها في ورقة القرض الصادر) —
   * سجل الدفعة يولد معرفات جديدة لكل نداء؛ الحالة وحدها لا ترد نداءً
   * متزامنًا ثانيًا. */
  const saveInFlightRef = useRef(false);

  async function save() {
    if (saveInFlightRef.current) return;
    if (!validAmount || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      setMessage("أدخل مبلغ الدفعة بالأرقام 0–9.");
      return;
    }
    if (amountMinor > row.reading.outstandingMinor) {
      setMessage(`الالتزام القائم ${formatMoneyMinor(row.reading.outstandingMinor)} د.أ — الدفعة لا تتخطاه.`);
      return;
    }
    setMessage(null);
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const result = await service.recordRepayment(row.loan.id, {
        amountMinor,
        date,
        note: note.trim() || null,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      onDone();
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Drawer open={true} onOpenChange={open => (open ? undefined : onClose())}>
      <DrawerContent dir="rtl">
        <DrawerHeader>
          <DrawerTitle>سداد أصل من قرض {row.loan.lenderName}</DrawerTitle>
          <DrawerDescription>
            السداد ينزل الكاش وينزل الالتزام — ليس مصروفًا ولا يمس نتيجة الفترة.
          </DrawerDescription>
        </DrawerHeader>
        <div className="micro-repayment-strip">
          <span>
            الأصل: <MoneyValue minor={row.reading.principalMinor} /> د.أ
          </span>
          <span>
            المسدَّد: <MoneyValue minor={row.reading.repaidActiveMinor} /> د.أ
          </span>
          <span>
            الالتزام القائم: <MoneyValue minor={row.reading.outstandingMinor} /> د.أ
          </span>
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
          <span>المبلغ المسدَّد (د.أ)</span>
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
          <input
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="مثال: دفعة أولى نقدًا"
          />
        </label>
        {message ? (
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions micro-contextual-actions">
          <Button
            action="save"

            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "جارٍ الحفظ…" : "أكّد السداد"}
            {saving ? null : <Save aria-hidden="true" />}
          </Button>
          <Button action="secondary" onClick={onClose}>
            ألغِ
          </Button>
        </div>
        <p className="micro-offline-truth">
          <HandCoins aria-hidden="true" /> يعمل بلا إنترنت — يُحفظ محليًا على جهازك.
        </p>
      </DrawerContent>
    </Drawer>
  );
}
