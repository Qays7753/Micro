/* §10: ورقة إضافة/تعديل المادة وحدة مستقلة — تُفتح بالفعل فتُقرأ. */
import { X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import type { DraftCostMaterial } from "@/storage/local/types";
import { MoneyValue } from "@/components/presentation/DisplayValue";

/* المجموعة ٢ (عقد ٢٨ — السيناريو G): مقترحات مواد من المخزون — تعبئة أرقام
 * فقط؛ لا حركة مخزون ولا حدث نقدي يُنشأ أبدًا من التقدير. */
export type MaterialSuggestion = {
  materialId: string;
  name: string;
  unit: string;
  unitPriceMinor: number | null;
  fromReceipt: boolean;
};

export type MaterialSheetProps = {
  value: { index: number | null; draft: DraftCostMaterial } | null;
  message: string | null;
  validity: Record<string, boolean>;
  suggestions?: readonly MaterialSuggestion[];
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<DraftCostMaterial>) => void;
  onValidityChange: (key: string, isValid: boolean) => void;
  onSave: () => void;
};

export function MaterialSheet({
  value,
  message,
  validity,
  suggestions = [],
  onOpenChange,
  onChange,
  onValidityChange,
  onSave,
}: MaterialSheetProps) {
  return (
    <Drawer open={Boolean(value)} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="micro-bottom-sheet" dir="rtl">
        {value ? (
          <>
            <DrawerHeader className="micro-sheet-header">
              <div className="micro-sheet-title-row">
                <div>
                  <DrawerTitle className="micro-sheet-title">
                    {value.index === null ? "أضف بند مادة" : "عدّل بند المادة"}
                  </DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    أدخل الحد الأدنى للمادة ثم عد إلى ملخص التكلفة.
                  </DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <button className="micro-icon-button" type="button" aria-label="إغلاق إضافة المادة">
                    <X aria-hidden="true" />
                  </button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <div className="micro-sheet-form">
              {/* المجموعة ٢ (عقد ٢٨): المقترحات أول الجسم — مسار اليد الواحدة:
               * بلمسة قبل تركيز أي حقل لا يفتح لوحة المفاتيح أصلًا. */}
              {suggestions.length > 0 && value?.index === null ? (
                <div className="micro-suggest-group" data-testid="material-suggestions">
                  <small className="micro-suggest-group-label">مقترحات من موادك — السعر من آخر استلام</small>
                  <div className="micro-suggest-chip-row">
                    {suggestions.slice(0, 6).map(suggestion => (
                      <button
                        key={suggestion.materialId}
                        className="micro-suggest-chip"
                        type="button"
                        onClick={() => {
                          onChange({
                            name: suggestion.name,
                            unit: suggestion.unit,
                            /* المجموعة ٣ (عقد D2): هوية المادة تُحفظ مع البند — هوية
                             * ربط فقط؛ الرقم يبقى كما دخل ويُجمَّد مع النسخة. */
                            materialId: suggestion.materialId,
                            ...(suggestion.unitPriceMinor !== null
                              ? {
                                  unitPriceMinor: suggestion.unitPriceMinor,
                                  confidence: suggestion.fromReceipt ? "known" : "estimated",
                                }
                              : { confidence: "estimated" }),
                          });
                        }}
                      >
                        {suggestion.name}
                        {suggestion.unitPriceMinor !== null ? (
                          <>
                            {" · "}
                            <MoneyValue minor={suggestion.unitPriceMinor} className="micro-inline-number" /> د.أ
                          </>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="micro-field">
                <span>المادة</span>
                <input
                  autoFocus={suggestions.length === 0}
                  value={value.draft.name}
                  onChange={event => onChange({ name: event.target.value })}
                />
              </label>
              <label className="micro-field">
                <span>
                  الكمية <small>أرقام 0–9 وحتى 3 منازل</small>
                </span>
                <EnglishQuantityInput
                  valueMilli={Math.round(value.draft.quantity * 1000)}
                  min="0"
                  aria-invalid={validity.quantity === false}
                  onMilliChange={quantityMilli => onChange({ quantity: quantityMilli / 1000 })}
                  onTextValidityChange={isValid => onValidityChange("quantity", isValid)}
                />
              </label>
              <label className="micro-field">
                <span>الوحدة</span>
                <input value={value.draft.unit} onChange={event => onChange({ unit: event.target.value })} />
              </label>
              <label className="micro-field">
                <span>
                  تكلفة الوحدة (د.أ) <small>أرقام 0–9</small>
                </span>
                <EnglishNumberInput
                  value={value.draft.unitPriceMinor}
                  kind="money"
                  min="0"
                  aria-invalid={validity.price === false}
                  onNumericChange={unitPriceMinor => onChange({ unitPriceMinor })}
                  onTextValidityChange={isValid => onValidityChange("price", isValid)}
                />
              </label>
              <label className="micro-field">
                <span>حالة الرقم</span>
                <select
                  value={value.draft.confidence}
                  onChange={event =>
                    onChange({ confidence: event.target.value as DraftCostMaterial["confidence"] })
                  }
                >
                  <option value="known">مؤكد</option>
                  <option value="estimated">تقديري</option>
                </select>
              </label>
              {message ? (
                <p className="micro-field-error" role="alert">
                  {message}
                </p>
              ) : null}
            </div>
            <DrawerFooter className="micro-sheet-footer">
              <DrawerClose asChild>
                <button className="micro-button micro-button-secondary" type="button">
                  إلغاء
                </button>
              </DrawerClose>
              <button className="micro-button micro-button-primary" type="button" onClick={onSave}>
                حفظ بند المادة
              </button>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
