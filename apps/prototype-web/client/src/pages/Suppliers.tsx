/** Style: Micro «مسار القرار» — supplier purchases are operational facts, never disguised as expense or inventory. */
import { ArrowLeft, Plus, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { SupplierPurchaseSummary } from "@/application/suppliers/supplierPurchaseService";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { formatArabicPlural } from "@/presentation/formatters";

type PageState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; purchases: readonly SupplierPurchase[]; summary: SupplierPurchaseSummary };

export default function Suppliers() {
  const [, navigate] = useLocation();
  /* S1-10: الرجوع للمصدر (?from) مع بديل قانوني ثابت (عقد ٢٦ §٢.٢). */
  const returnPath = useReturnPath();
  const { supplierPurchases, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    Promise.all([supplierPurchases.list(), supplierPurchases.readSummary()]).then(([purchases, summary]) => {
      if (!active) return;
      if (!purchases.ok || !summary.ok) {
        setState({ phase: "error" });
        return;
      }
      setState({ phase: "ready", purchases: purchases.value, summary: summary.value });
    });
    return () => {
      active = false;
    };
  }, [dataVersion, supplierPurchases]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة شراء المواد المحلي…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة الموردين والمشتريات</h1>
        <p>لم يتم تغيير أي سجل. أعد فتح التطبيق للمحاولة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(withFrom("/finance", "/suppliers"))}
        >
          الوضع المالي
        </button>
      </section>
    );
  const open = state.purchases.filter(purchase => purchase.payableMinor > 0);
  const openPurchaseLabel = formatArabicPlural(open.length, {
    zero: "لا توجد مشتريات مفتوحة",
    one: "شراء واحد يحتاج متابعة",
    two: "شراءان يحتاجان متابعة",
    few: "مشتريات تحتاج متابعة",
    many: "شراءً يحتاج متابعة",
    other: "شراء يحتاج متابعة",
  });
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowLeft aria-hidden="true" /> {returnPath === "/finance" ? "الوضع المالي" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مواد وموردون</span>
        <h1>الموردون والمشتريات</h1>
        <p>سجّل ما اشتريته للمشروع وما دُفع وما بقي.</p>
      </div>
      <section className="micro-decision-card">
        <WalletCards aria-hidden="true" />
        <div>
          <span>ما عليك للموردين من شراء مواد (د.أ)</span>
          <strong>
            <MoneyValue minor={state.summary.supplierPayablesMinor} />
          </strong>
          <p>{state.summary.truth}</p>
        </div>
      </section>
      <button
        className="micro-button micro-button-primary micro-full-action"
        type="button"
        onClick={() => navigate(withFrom("/suppliers/purchase/new", "/suppliers"))}
      >
        <Plus aria-hidden="true" /> سجل شراء مواد
      </button>
      <section className="micro-supplier-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">المشتريات المفتوحة</span>
          <h2>{openPurchaseLabel}</h2>
        </div>
        {open.length ? (
          open.map(purchase => (
            <article key={purchase.id}>
              {/* مبدأ Micro: نعرض قصة شراء المورد كاملة دون تحويلها إلى مصروف أو تكلفة بيع. */}
              <div>
                <strong>{purchase.supplierName}</strong>
                <small>الحالة: مفتوح</small>
                {/* S3-05: العربية خارج صنف الأرقام الأحادي — الخط والمقاس والاتجاه للنص العربي. */}
                <b className="micro-supplier-payable">
                  المتبقي (د.أ): <MoneyValue minor={purchase.payableMinor} className="micro-inline-number" />
                </b>
              </div>
              <div className="micro-supplier-balance">
                <small className="micro-supplier-totals">
                  الإجمالي: <MoneyValue minor={purchase.totalMinor} className="micro-inline-number" /> ·
                  المدفوع: <MoneyValue minor={purchase.paidMinor} className="micro-inline-number" />
                </small>
                <small>
                  تاريخ الشراء: <LocalDateValue value={purchase.purchasedOn} /> · {purchase.note}
                </small>
                {purchase.dueOn ? (
                  <small>
                    الاستحقاق: <LocalDateValue value={purchase.dueOn} />
                  </small>
                ) : (
                  <small>لا يوجد تاريخ استحقاق مسجل</small>
                )}
                <button
                  className="micro-button micro-button-secondary"
                  type="button"
                  onClick={() => navigate(withFrom(`/suppliers/purchase/${purchase.id}/payment`, "/suppliers"))}
                >
                  سجل دفعة
                </button>
                {/* المجموعة ٢ (§10.1): تصحيح الشراء من صفّه — لا إيماءة مخفية ولا لون فقط. */}
                <button
                  className="micro-button micro-button-quiet"
                  type="button"
                  onClick={() => navigate(withFrom(`/suppliers/purchase/${purchase.id}`, "/suppliers"))}
                >
                  عدّل/تراجع
                </button>
              </div>
            </article>
          ))
        ) : (
          <p>لا تسجل شراء مواد كمصروف تشغيل. ابدأ من هذا السجل ليظهر الكاش والمتبقي بصدق.</p>
        )}
      </section>
      {state.purchases.length > open.length ? (
        <section className="micro-supplier-list micro-supplier-settled">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">مكتملة الدفع</span>
            <h2>آخر المشتريات المسددة</h2>
          </div>
          {state.purchases
            .filter(purchase => purchase.payableMinor === 0)
            .slice(0, 4)
            .map(purchase => (
              <article key={purchase.id}>
                <div>
                  <strong>{purchase.supplierName}</strong>
                  <small>
                    <LocalDateValue value={purchase.purchasedOn} /> · {purchase.note}
                  </small>
                </div>
                <div className="micro-supplier-balance">
                  <b>
                    <MoneyValue minor={purchase.totalMinor} />
                  </b>
                  <button
                    className="micro-button micro-button-quiet"
                    type="button"
                    onClick={() => navigate(withFrom(`/suppliers/purchase/${purchase.id}`, "/suppliers"))}
                  >
                    السجل والتصحيح
                  </button>
                </div>
              </article>
            ))}
        </section>
      ) : null}
    </section>
  );
}
