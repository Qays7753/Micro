/**
 * تفاصيل الإعلان العام (OD-04 + Wave 2 — القرارات النهائية 2026-11-21):
 * النسخة المعتمدة وحدها، ولا قناة تواصل مباشرة في أي استجابة عامة —
 * رقم المورد يُكشف بزر صريح لحساب مسجّل فقط عبر المسار الخادمي المدقَّق
 * (د-1: زر «إظهار الرقم» بحد ١٠ أرقام مورد مختلفة يوميًّا)، مع خيارات
 * المنتج (Q38) وزر بلاغ موصول (د-8) — لا دردشة داخلية ولا تقييم شراء
 * ولا أي طلب داخل التطبيق ولا أي أثر مالي.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Flag, Phone } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  estimateMaterialValue,
  fetchListingDetail,
  fetchMarketMeta,
  revealSupplierPhone,
  reportListing,
  type PublicListingDetail,
} from "@/application/market";
import { Button, EmptyState, Notice } from "@/components/primitives";
import { normalizeAsciiDigits } from "@/application/input";

/** Quantity ×1,000 as exact string scaling (contract 25 §3-ب — no floats). */
function quantityToMilliExact(text: string): string {
  const [whole, fraction = ""] = text.split(".");
  return `${whole}${fraction.padEnd(3, "0")}`;
}

function microToJodText(micro: string): string {
  const value = BigInt(micro);
  return `${(value / 1_000_000n).toString()}.${(value % 1_000_000n).toString().padStart(6, "0").slice(0, 3)}`;
}

const VARIANT_AVAILABILITY_LABELS: Record<string, string> = {
  available: "متوفر",
  made_to_order: "بالطلب",
  temporarily_unavailable: "غير متوفر مؤقتًا",
};

const REPORT_REASONS = [
  { value: "misleading", label: "معلومات مضللة" },
  { value: "out_of_scope", label: "خارج النطاق المسموح" },
  { value: "spam", label: "إعلان مزعج" },
  { value: "contact_issue", label: "مشكلة في التواصل" },
  { value: "other", label: "سبب آخر" },
];

interface DetailPayload {
  listing: PublicListingDetail;
  mediaIds: string[];
  vendor: {
    displayName: string;
    governorate: string;
    supplierType: string | null;
    deliveryOption: string | null;
  };
}

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  manufacturer: "مصنّع",
  wholesale: "جملة",
  importer: "مستورد",
  shop: "محل",
};

const DELIVERY_LABELS: Record<string, string> = {
  delivery: "يوصّل",
  pickup_only: "استلام فقط",
};

export default function MarketListingDetail() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const [match] = useLocation();
  const listingId = match.replace("/market/listing/", "").split("/")[0] ?? "";
  const { session, signIn } = useNetworkSession();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [quantityText, setQuantityText] = useState("");
  /* Stage C (S13/R2-6): خريطة تسميات التصنيف من الميتا الكنونية — لا معرّف
   * خام («packaging») في صفحة عامة. */
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({});
  /* د-1 (القرار النهائي): الرقم لا يظهر إلا بزر صريح لحساب مسجّل عبر
   * المسار الخادمي المدقَّق — الحالة المحلية صادقة عن كل انتقال. */
  const [revealState, setRevealState] = useState<
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "revealed"; phone: string; channelType: string; remainingToday: number }
    | { phase: "error"; message: string }
  >({ phase: "idle" });
  /* د-8: زر بلاغ موصول — لا يغيّر الإعلان أبدًا (عقد 22 §2). */
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setData(await fetchListingDetail(listingId));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Stage C (S13/R2-6): جلب الميتا مرة واحدة — تسمية التصنيف الكنونية
   * نفسها التي تظهر في الفلاتر والمحرر. */
  useEffect(() => {
    let active = true;
    void fetchMarketMeta()
      .then(meta => {
        if (!active) return;
        const labels: Record<string, string> = {};
        for (const main of meta.categories) {
          labels[main.id] = main.label;
          for (const sub of main.sub) labels[sub.id] = `${main.label} · ${sub.label}`;
        }
        setCategoryLabels(labels);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const listing = data?.listing;
  const quantityDigits = normalizeAsciiDigits(quantityText.trim());
  const quantityMilli = /^\d{1,6}(\.\d{1,3})?$/.test(quantityDigits)
    ? quantityToMilliExact(quantityDigits)
    : "";
  const estimate =
    listing && quantityMilli !== "" && listing.priceMode === "fixed"
      ? estimateMaterialValue({
          mode: listing.priceMode,
          requestedMilli: quantityMilli,
          priceMicroJod: listing.priceMicroJod ?? undefined,
          // The approved basis from the listing itself (not a hardcoded 1) —
          // «السعر يشمل كم وحدة» is part of the reviewed pricing.
          basisUnits: listing.priceBasis?.units ?? "1",
        })
      : null;

  const revealPhone = useCallback(async () => {
    if (!session.authenticated) {
      signIn(`/market/listing/${listingId}`);
      return;
    }
    setRevealState({ phase: "loading" });
    try {
      const result = await revealSupplierPhone(listingId);
      setRevealState({ phase: "revealed", ...result });
    } catch (error) {
      setRevealState({
        phase: "error",
        message: error instanceof Error ? error.message : "تعذر إظهار الرقم — أعد المحاولة.",
      });
    }
  }, [session.authenticated, signIn, listingId]);

  const sendReport = useCallback(async () => {
    if (reportReason === "") return;
    setReportState("sending");
    try {
      await reportListing(listingId, reportReason, reportDetails || undefined);
      setReportState("sent");
    } catch {
      setReportState("error");
    }
  }, [listingId, reportReason, reportDetails]);

  return (
    <section className="micro-page micro-market-detail" data-testid="market-listing-detail">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> السوق
      </button>
      {state === "loading" ? <p className="micro-market-status">جارٍ التحميل…</p> : null}
      {state === "error" ? (
        <EmptyState
          title="الإعلان غير متاح"
          description="ربما أوقفه المورد أو الإدارة — عد للسوق وتابع البحث."
          action={
            <Button action="secondary" onClick={() => navigate("/market")}>
              عودة للسوق
            </Button>
          }
        />
      ) : null}
      {state === "ready" && listing && data ? (
        <article>
          <div className="micro-page-heading">
            <span className="micro-overline">
              {data.vendor.displayName}
              {data.vendor.supplierType !== null && SUPPLIER_TYPE_LABELS[data.vendor.supplierType]
                ? ` · ${SUPPLIER_TYPE_LABELS[data.vendor.supplierType]}`
                : ""}
              {data.vendor.deliveryOption !== null && DELIVERY_LABELS[data.vendor.deliveryOption]
                ? ` · ${DELIVERY_LABELS[data.vendor.deliveryOption]}`
                : ""}{" "}
              · {listing.governorate}
            </span>
            <h1>{listing.title}</h1>
          </div>
          {listing.freshness === "needs_confirmation" ? (
            <Notice tone="neutral">التوفر يحتاج تأكيدًا من المورد — اسأله عن الجاهزية قبل الالتزام.</Notice>
          ) : null}
          {listing.availabilityStatus === "temporarily_unavailable" ? (
            <Notice tone="info">غير متوفر مؤقتًا — يمكن السؤال عن الموعد البديل.</Notice>
          ) : null}
          <dl className="micro-market-facts">
            <div>
              <dt>السعر</dt>
              <dd>
                {listing.priceMode === "quote_required"
                  ? "يحتاج تسعيرًا — اسأل المورد"
                  : listing.priceMode === "tiered"
                    ? "السعر حسب الكمية — اسأل المورد عن الشرائح"
                    : /* F-11 (S12/Phase E): عزل bidi كنوني للمبلغ. */
                      ((priceJod: string) => (
                        <>
                          <bdi dir="ltr">{priceJod}</bdi> د.أ
                        </>
                      ))(microToJodText(listing.priceMicroJod ?? "0"))}
              </dd>
            </div>
            <div>
              <dt>الحد الأدنى للطلب</dt>
              <dd>{`${(BigInt(listing.minQuantityMilli) / 1000n).toString()} ${listing.quantityUnit}`}</dd>
            </div>
            {/* Stage C (S13/R2-6): التسمية الكنونية من الميتا؛ يُحذف الصف
             * كاملًا إن جهل التصنيف — لا معرّف خام ولا صف فارغ للمستخدم العام. */}
            {categoryLabels[listing.category] != null ? (
              <div>
                <dt>التصنيف</dt>
                <dd>{categoryLabels[listing.category]}</dd>
              </div>
            ) : null}
          </dl>
          <p className="micro-market-description">{listing.description}</p>

          {/* Q38 (القرار النهائي): خيارات المنتج — لكل خيار سعره وأقل كمية
           * طلبه وحالة توفره؛ تُعرض كما راجعتها الإدارة. */}
          {(listing.variants ?? []).length > 0 ? (
            <div className="micro-market-variants" data-testid="market-variants">
              <h2>الخيارات المتاحة</h2>
              <ul>
                {(listing.variants ?? []).map(variant => (
                  <li key={variant.id}>
                    <span>{variant.label}</span>
                    <span>
                      <bdi dir="ltr">{microToJodText(variant.priceMicroJod)}</bdi> د.أ · أقل كمية{" "}
                      {(BigInt(variant.minQuantityMilli) / 1000n).toString()} {listing.quantityUnit} ·{" "}
                      {VARIANT_AVAILABILITY_LABELS[variant.availability] ?? variant.availability}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="micro-market-contact" data-testid="market-contact-box">
            <h2>استفسار عن المادة</h2>
            <label>
              الكمية المطلوبة
              <input
                type="text"
                inputMode="numeric"
                value={quantityText}
                onChange={event => setQuantityText(event.target.value)}
                placeholder={`${(BigInt(listing.minQuantityMilli) / 1000n).toString()} أو أكثر`}
              />
            </label>
            {estimate?.kind === "estimated" ? (
              <p className="micro-market-estimate" data-testid="market-estimate">
                قيمة تقديرية غير ملزمة: <bdi dir="ltr">{estimate.displayJod}</bdi> د.أ
              </p>
            ) : null}
            {/* د-1 (القرار النهائي): الرقم مخفي عن كل زائر؛ الزر الصريح
             * يكشفه لحساب مسجّل فقط عبر مسار خادمي مدقَّق ومحدود يوميًّا. */}
            {revealState.phase === "idle" ? (
              <p className="micro-market-contact__hint">
                رقم التواصل مخفي — اضغط «إظهار الرقم» بعد تسجيل الدخول لعرضه.
              </p>
            ) : null}
            {revealState.phase === "loading" ? (
              <p className="micro-market-contact__hint" role="status">
                جارٍ إظهار الرقم…
              </p>
            ) : null}
            {revealState.phase === "error" ? (
              <p className="micro-market-contact__hint" role="alert">
                {revealState.message}
              </p>
            ) : null}
            {revealState.phase === "revealed" ? (
              <div data-testid="market-revealed-phone">
                <a
                  className="micro-market-contact__action"
                  href={
                    revealState.channelType === "whatsapp"
                      ? `https://wa.me/${revealState.phone.replace(/[^\d]/g, "")}`
                      : `tel:${revealState.phone}`
                  }
                  rel="noreferrer"
                  target="_blank"
                >
                  <Phone aria-hidden="true" />
                  <bdi dir="ltr">{revealState.phone}</bdi>
                </a>
                <p className="micro-market-contact__hint">
                  {revealState.channelType === "whatsapp" ? "تواصل واتساب" : "اتصال مباشر"} — متبقٍ لك اليوم{" "}
                  {revealState.remainingToday} من ١٠ أرقام.
                </p>
              </div>
            ) : null}
            {revealState.phase !== "revealed" ? (
              <Button
                action="commit"
                disabled={revealState.phase === "loading"}
                onClick={() => void revealPhone()}
              >
                <Phone aria-hidden="true" />
                {session.authenticated ? "إظهار الرقم" : "سجّل الدخول لإظهار الرقم"}
              </Button>
            ) : null}
            <p className="micro-market-contact__hint">
              يفتح الاتصال قناة التواصل الخارجية — لا يرسل التطبيق شيئًا تلقائيًا ولا يسجل «أُرسلت».
            </p>
          </div>

          {/* د-8 (القرار النهائي): زر بلاغ موصول في السوق — قرار إداري فقط
           * ولا يغيّر الإعلان أبدًا (عقد 22 §2). */}
          <div className="micro-market-report" data-testid="market-report-box">
            {reportState === "sent" ? (
              <p role="status">شكرًا — وصل البلاغ للإدارة وسيُراجع.</p>
            ) : reportOpen ? (
              <div className="micro-market-report__form">
                <label>
                  سبب البلاغ
                  <select value={reportReason} onChange={event => setReportReason(event.target.value)}>
                    <option value="">اختر السبب</option>
                    {REPORT_REASONS.map(reason => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  تفاصيل (اختياري)
                  <input value={reportDetails} onChange={event => setReportDetails(event.target.value)} />
                </label>
                <Button
                  action="save"
                  disabled={reportReason === "" || reportState === "sending"}
                  onClick={() => void sendReport()}
                >
                  {reportState === "sending" ? "جارٍ الإرسال…" : "إرسال البلاغ"}
                </Button>
                {reportState === "error" ? (
                  <p role="alert">
                    تعذر إرسال البلاغ — أعد المحاولة.
                    <Button action="quiet" onClick={() => void sendReport()}>
                      إعادة المحاولة
                    </Button>
                  </p>
                ) : null}
              </div>
            ) : (
              <Button action="outline" onClick={() => setReportOpen(true)}>
                <Flag aria-hidden="true" /> بلاغ عن الإعلان
              </Button>
            )}
          </div>
        </article>
      ) : null}
    </section>
  );
}
