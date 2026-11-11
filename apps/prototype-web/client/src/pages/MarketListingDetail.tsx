/**
 * تفاصيل الإعلان العام (OD-04): نسخة معتمدة وقناة التواصل المعتمدة وحدها —
 * لا دردشة داخلية ولا تقييم شراء ولا أي طلب داخل التطبيق؛ تجهيز نص
 * الاستفسار مع الكمية يفتح قناة الاتصال الخارجية دون إرسال تلقائي.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Phone } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { estimateMaterialValue, fetchListingDetail, type PublicListingDetail } from "@/application/market";
import { Button, EmptyState, Notice } from "@/components/primitives";

interface DetailPayload {
  listing: PublicListingDetail;
  mediaIds: string[];
  vendor: { displayName: string; governorate: string };
}

export default function MarketListingDetail() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const [match] = useLocation();
  const listingId = match.replace("/market/listing/", "").split("/")[0] ?? "";
  const [data, setData] = useState<DetailPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [quantityText, setQuantityText] = useState("");

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

  const listing = data?.listing;
  const quantityMilli = /^\d+$/.test(quantityText.trim()) ? `${Number(quantityText.trim()) * 1000}` : "";
  const estimate =
    listing && quantityMilli !== ""
      ? estimateMaterialValue({
          mode: listing.priceMode,
          requestedMilli: quantityMilli,
          priceMicroJod: listing.priceMicroJod ?? undefined,
          basisUnits: "1",
        })
      : null;

  const contactHref =
    listing === undefined
      ? null
      : listing.contactChannel.type === "whatsapp"
        ? `https://wa.me/${listing.contactChannel.value.replace(/[^\d]/g, "")}`
        : `tel:${listing.contactChannel.value}`;

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
              {data.vendor.displayName} · {listing.governorate}
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
                  : `${(BigInt(listing.priceMicroJod ?? "0") / 1_000_000n).toString()}.${(BigInt(listing.priceMicroJod ?? "0") % 1_000_000n).toString().padStart(6, "0").slice(0, 3)} د.أ`}
              </dd>
            </div>
            <div>
              <dt>الحد الأدنى للطلب</dt>
              <dd>{`${(BigInt(listing.minQuantityMilli) / 1000n).toString()} ${listing.quantityUnit}`}</dd>
            </div>
            <div>
              <dt>التصنيف</dt>
              <dd>{listing.category}</dd>
            </div>
          </dl>
          <p className="micro-market-description">{listing.description}</p>

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
                قيمة تقديرية غير ملزمة: {estimate.displayJod} د.أ
              </p>
            ) : null}
            <p className="micro-market-contact__hint">
              يفتح الاتصال قناة التواصل الخارجية المعتمدة — لا يرسل التطبيق شيئًا تلقائيًا ولا يسجل «أُرسلت».
            </p>
            {contactHref ? (
              <a className="micro-market-contact__action" href={contactHref} rel="noreferrer">
                <Phone aria-hidden="true" />
                {listing.contactChannel.type === "whatsapp" ? "تواصل واتساب" : "اتصال مباشر"}
              </a>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}
