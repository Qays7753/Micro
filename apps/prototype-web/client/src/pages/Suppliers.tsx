/** Style: Micro «مسار القرار» — supplier purchases are operational facts, never disguised as expense or inventory. */
import { ArrowRight, Plus, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withReturnTo } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { SupplierPurchaseSummary } from "@/application/suppliers/supplierPurchaseService";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { formatArabicPlural } from "@/presentation/formatters";

import { Button } from "@/components/primitives";
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
  const [retryCount, setRetryCount] = useState(0);
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
  }, [dataVersion, supplierPurchases, retryCount]);
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
        <p>لم يتغير أي سجل.</p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
        <Button
          action="secondary"

          onClick={() => navigate(withReturnTo("/finance", "/suppliers"))}
        >
          المالية
        </Button>
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
        <ArrowRight aria-hidden="true" /> {returnPath === "/finance" ? "المالية" : "رجوع"}
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
      <Button
        action="create"
        block

        onClick={() => navigate(withReturnTo("/suppliers/purchase/new", "/suppliers"))}
      >
        <Plus aria-hidden="true" /> سجّل شراء مواد
      </Button>
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
                <strong dir="auto">{purchase.supplierName}</strong>
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
                <Button
                  action="secondary"

                  onClick={() =>
                    navigate(withReturnTo(`/suppliers/purchase/${purchase.id}/payment`, "/suppliers"))
                  }
                >
                  سجّل دفعة
                </Button>
                {/* المجموعة ٢ (§10.1): تصحيح الشراء من صفّه — لا إيماءة مخفية ولا لون فقط. */}
                <Button
                  action="quiet"

                  onClick={() => navigate(withReturnTo(`/suppliers/purchase/${purchase.id}`, "/suppliers"))}
                >
                  عدّل/تراجع
                </Button>
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
                  <strong dir="auto">{purchase.supplierName}</strong>
                  <small>
                    <LocalDateValue value={purchase.purchasedOn} /> · {purchase.note}
                  </small>
                </div>
                <div className="micro-supplier-balance">
                  <b>
                    <MoneyValue minor={purchase.totalMinor} />
                  </b>
                  <Button
                    action="quiet"

                    onClick={() => navigate(withReturnTo(`/suppliers/purchase/${purchase.id}`, "/suppliers"))}
                  >
                    السجل والتصحيح
                  </Button>
                </div>
              </article>
            ))}
        </section>
      ) : null}
    </section>
  );
}
