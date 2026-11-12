/**
 * مساحة المورد (OD-03/OD-12/OD-15/OD-16): ملف المورد وإعلاناته بحساب Micro
 * نفسه — مسودات خاصة وطلبات مراجعة وحالات صادقة، وتأكيد التوفر المباشر
 * (OD-09) مع التمييز عن الإيقاف، ولا يظهر شيء للعامة قبل اكتمال القبول.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useNetworkSession } from "@/app/useNetworkSession";
import { useReturnPath } from "@/app/useReturnNavigation";
import { normalizeAsciiDigits } from "@/application/input";
import {
  confirmListingAvailability,
  directUpdateListing,
  fetchVendorOverview,
  listingLifecycleAction,
  submitListing,
  submitVendorProfile,
  upsertVendorProfile,
  type VendorOverview,
} from "@/application/market";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  submitted: "قيد المراجعة",
  changes_requested: "يحتاج تعديلًا",
  rejected: "مرفوض",
  approved_for_publish: "منشور",
  paused: "موقوف من المورد",
  archived: "مؤرشف",
  admin_suspended: "موقوف من الإدارة",
  expired: "قديم — يحتاج تجديدًا",
};

const REVISION_LABELS: Record<string, string> = {
  none: "",
  submitted: "نسخة معدلة قيد المراجعة",
  changes_requested: "التعديل يحتاج استكمالًا",
  content_approved: "المحتوى مقبول — بانتظار اكتمال الملف",
  renewal_requested: "طلب تجديد قيد المراجعة",
};

/** OD-09: تحويلات سعر مطابقة للمحرر — نص عشري إلى micro-Jod نصيًا بلا float. */
function microToJodText(micro: string | null): string {
  if (micro === null || micro === "") return "";
  const value = BigInt(micro);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

function jodToPriceMicro(jodText: string): string | null {
  const text = normalizeAsciiDigits(jodText.trim());
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return `${whole}${fraction.padEnd(6, "0")}`;
}

export default function MarketVendorWorkspace() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { session, signIn, loading: sessionLoading } = useNetworkSession();
  const [overview, setOverview] = useState<VendorOverview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(
    null,
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [governorate, setGovernorate] = useState("");
  /* OD-09: التحديث الرقمي المباشر للسعر على المنشور ذي التسعير الثابت. */
  const [priceEditFor, setPriceEditFor] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setOverview(await fetchVendorOverview());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (session.authenticated) void load();
    else if (!sessionLoading) setState("ready");
  }, [session.authenticated, sessionLoading, load]);

  useEffect(() => {
    // Prefill the edit form from the vendor's own work copy (not a blank form).
    const fields = overview?.profileFields;
    if (fields) {
      setDisplayName(current => (current === "" ? (fields.displayName ?? current) : current));
      setPhone(current => (current === "" ? (fields.contactPhone ?? current) : current));
      setGovernorate(current => (current === "" ? (fields.governorate ?? current) : current));
    }
  }, [overview?.profileFields]);

  if (!sessionLoading && !session.authenticated) {
    return (
      <section className="micro-page" data-testid="market-vendor-gate">
        <div className="micro-page-heading">
          <h1>مساحة المورد</h1>
        </div>
        <EmptyState
          title="هذه المساحة تحتاج تسجيل الدخول"
          description="أي مستخدم Micro موثق يستطيع تجهيز ملف مورد وإعلاناته — الدخول بهوية Micro نفسها."
          action={
            <Button action="create" onClick={() => signIn("/market/vendor")}>
              الدخول عبر Google
            </Button>
          }
        />
      </section>
    );
  }

  const vendorStatus = overview?.vendor?.status ?? null;

  const run = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      setMessage({ tone: "success", text: successMessage });
      await load();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "تعذر تنفيذ الفعل — أعد المحاولة.",
      });
    }
  };

  return (
    <section className="micro-page micro-vendor-page" data-testid="market-vendor-workspace">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> السوق
      </button>
      <div className="micro-page-heading">
        <h1>مساحة المورد</h1>
        <p>ملفك وإعلاناتك خاصة حتى اكتمال القبول — لا يظهر شيء للعامة تلقائيًا.</p>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <section className="micro-vendor-profile">
        <h2>ملف المورد</h2>
        <p className="micro-vendor-profile__status">
          الحالة: {vendorStatus === null ? "لم يُنشأ بعد" : (STATUS_LABELS[vendorStatus] ?? vendorStatus)}
        </p>
        {overview?.vendorReviewReason ? (
          <p className="micro-review-reason" role="status">
            ملاحظة المراجع: {overview.vendorReviewReason}
          </p>
        ) : null}
        {vendorStatus === null || vendorStatus === "draft" || vendorStatus === "changes_requested" ? (
          <>
            <Button action="outline" onClick={() => setProfileOpen(open => !open)}>
              {vendorStatus === null ? "إنشاء ملف المورد" : "تعديل بيانات الملف"}
            </Button>
            {profileOpen ? (
              <div className="micro-vendor-profile__form">
                <Field label="اسم النشاط المعروض">
                  <input value={displayName} onChange={event => setDisplayName(event.target.value)} />
                </Field>
                <Field label="هاتف التواصل">
                  <input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" />
                </Field>
                <Field label="المحافظة">
                  <select value={governorate} onChange={event => setGovernorate(event.target.value)}>
                    <option value="">اختر المحافظة</option>
                    {[
                      "عمان",
                      "إربد",
                      "الزرقاء",
                      "البلقاء",
                      "المفرق",
                      "العقبة",
                      "جرش",
                      "عجلون",
                      "مادبا",
                      "الكرك",
                      "الطفيلة",
                      "معان",
                    ].map(entry => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button
                  action="save"
                  onClick={() =>
                    void run(async () => {
                      await upsertVendorProfile({ displayName, contactPhone: phone, governorate });
                    }, "حُفظ ملف المورد كمسودة.")
                  }
                >
                  حفظ الملف
                </Button>
                <Button
                  action="commit"
                  onClick={() => void run(submitVendorProfile, "أُرسل الملف للمراجعة — ليس اعتمادًا.")}
                >
                  إرسال الملف للمراجعة
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="micro-vendor-listings">
        <h2>إعلاناتي</h2>
        <Button action="create" onClick={() => navigate("/market/vendor/new")}>
          أضف إعلانًا
        </Button>
        {state === "loading" ? (
          <p className="micro-route-loading" role="status">
            جارٍ التحميل…
          </p>
        ) : null}
        {state === "error" ? (
          <EmptyState
            title="تعذر تحميل إعلاناتك"
            description="أعد المحاولة — مسوداتك محفوظة لدى الخادم."
            action={
              <Button action="secondary" onClick={() => void load()}>
                إعادة المحاولة
              </Button>
            }
          />
        ) : null}
        {state === "ready" && (overview?.listings.length ?? 0) === 0 ? (
          <EmptyState
            title="لا إعلانات بعد"
            description="ابدأ بمسودة إعلان — اكتمال البيانات شرط الإرسال للمراجعة."
          />
        ) : null}
        <ul data-testid="vendor-listing-list">
          {(overview?.listings ?? []).map(listing => (
            <li key={listing.id} className="micro-vendor-listing">
              <div>
                <strong>{listing.title}</strong>
                <p>
                  {STATUS_LABELS[listing.status] ?? listing.status}
                  {REVISION_LABELS[listing.revisionStatus]
                    ? ` · ${REVISION_LABELS[listing.revisionStatus]}`
                    : ""}
                </p>
              </div>
              <div className="micro-vendor-listing__actions">
                <Button action="quiet" onClick={() => navigate(`/market/vendor/${listing.id}`)}>
                  تحرير
                </Button>
                {listing.status === "draft" || listing.status === "changes_requested" ? (
                  <Button
                    action="save"
                    onClick={() => void run(() => submitListing(listing.id), "أُرسل الإعلان للمراجعة.")}
                  >
                    إرسال للمراجعة
                  </Button>
                ) : null}
                {listing.status === "approved_for_publish" ? (
                  <>
                    <Button
                      action="outline"
                      onClick={() =>
                        void run(() => confirmListingAvailability(listing.id), "أُكد التوفر وسُجل التحديث.")
                      }
                    >
                      تأكيد التوفر
                    </Button>
                    {listing.priceMode === "fixed" ? (
                      <Button
                        action="quiet"
                        onClick={() => {
                          setPriceEditFor(priceEditFor === listing.id ? null : listing.id);
                          setPriceValue(microToJodText(listing.priceMicroJod));
                        }}
                      >
                        تحديث السعر
                      </Button>
                    ) : null}
                    <Button
                      action="quiet"
                      onClick={() =>
                        void run(
                          () => listingLifecycleAction(listing.id, "pause"),
                          "أُوقف الإعلان عن الظهور.",
                        )
                      }
                    >
                      إيقاف
                    </Button>
                  </>
                ) : null}
                {priceEditFor === listing.id && listing.status === "approved_for_publish" ? (
                  <div className="micro-vendor-price-edit" data-testid="price-direct-update">
                    <Field label="السعر الجديد (دينار — أرقام إنجليزية)">
                      <input
                        value={priceValue}
                        onChange={event => setPriceValue(event.target.value)}
                        inputMode="decimal"
                      />
                    </Field>
                    <p className="micro-review-item__meta">
                      تحديث مباشر للسعر على المنشور فقط — يُوثق بحدث إشرافي ولا يمس بقية المحتوى.
                    </p>
                    <div className="micro-form-actions">
                      <Button
                        action="save"
                        onClick={() => {
                          const micro = jodToPriceMicro(priceValue);
                          if (micro === null) {
                            setMessage({
                              tone: "error",
                              text: "أدخل سعرًا صحيحًا — أرقام إنجليزية بلا نص.",
                            });
                            return;
                          }
                          void run(async () => {
                            await directUpdateListing(listing.id, { priceMicroJod: micro });
                            setPriceEditFor(null);
                          }, "حُدّث السعر المباشر ووُثق بحدث إشرافي.");
                        }}
                      >
                        حفظ السعر
                      </Button>
                      <Button
                        action="quiet"
                        onClick={() => {
                          setPriceEditFor(null);
                          setPriceValue("");
                        }}
                      >
                        رجوع
                      </Button>
                    </div>
                  </div>
                ) : null}
                {listing.status === "paused" ? (
                  <Button
                    action="outline"
                    onClick={() =>
                      void run(() => listingLifecycleAction(listing.id, "resume"), "أُعيد ظهور الإعلان.")
                    }
                  >
                    إعادة الإظهار
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
