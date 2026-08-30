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
