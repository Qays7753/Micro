/* §10: سجل الطلب وحدة مستقلة داخل طبقة «تفاصيل إضافية» — يُفتح فتُقرأ. */
import { DateTimeValue, MoneyValue } from "@/components/presentation/DisplayValue";
import type { OrderEvent } from "@micro-domain/craft-order/index.js";

const eventLabel: Record<string, string> = {
  created: "إنشاء الطلب",
  status_changed: "تحديث الحالة",
  deposit_collected: "تسجيل العربون",
  collection_recorded: "تسجيل قبض",
  debt_registered: "تسجيل دين",
  specification_revised: "تعديل المواصفات",
  cancelled: "إلغاء",
  deposit_refunded: "رد العربون",
  deposit_retained: "تسوية العربون",
  price_approved: "تسجيل السعر",
  /* المجموعة ٣ (Scope E — §11.3): تسميات أحداث تصحيح المجموعة ٢ التي كانت
   * تسقط إلى «تحديث الطلب» — السجل يسمي فعله الحقيقي لا تسمية عامة. */
  price_revised: "تعديل السعر بعد الاتفاق",
  collection_reversed: "التراجع عن قبضة",
  /* المجموعة ٥ (عقد ٣٤): أحداث عقد ٢٩/عقد D2 التي كانت تسقط إلى تسمية عامة —
   * السجل يسمّي فعله الحقيقي. */
  delivery_consumed: "استهلاك مواد عند التسليم",
  delivery_reversed: "عكس تسليم موثق",
  deposit_classified: "تصنيف العربون المحتفظ به",
};

export function OrderEventLog({ events }: { events: readonly OrderEvent[] }) {
  return (
    <section className="micro-form-card">
      <h2 className="micro-section-title">سجل الطلب</h2>
      <div className="micro-event-list">
        {events.map(event => (
          <div key={event.id}>
            <span className="micro-event-dot" />
            <p>
              <b>{eventLabel[event.type] ?? "تحديث الطلب"}</b>
              <small>
                <DateTimeValue value={event.createdAt} />
                {event.amountMinor ? (
                  <>
                    {" "}
                    · <MoneyValue minor={event.amountMinor} className="micro-inline-number" />
                  </>
                ) : null}
              </small>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
