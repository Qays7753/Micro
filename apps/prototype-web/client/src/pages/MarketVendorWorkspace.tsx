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
  fetchVendorListingDraft,
  fetchVendorOverview,
  listingLifecycleAction,
  submitListing,
  submitVendorProfile,
  upsertVendorProfile,
  type VendorListingDraft,
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

/** OD-09: قيم الكمية بالميلي ↔ نص بوحدات أساسية (حتى ٣ منازل) بلا float. */
function milliToText(milli: string | null | undefined): string {
  if (milli === null || milli === undefined || milli === "") return "";
  const value = BigInt(milli);
  const whole = value / 1000n;
  const fraction = (value % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

function textToQuantityMilli(text: string): string | null {
  const normalized = normalizeAsciiDigits(text.trim());
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return `${whole}${fraction.padEnd(3, "0")}`;
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
  /* OD-09 (contract 20 §3.3): direct updates on published listings — numeric
   * price within the SAME pricing mode (fixed scalar / tiered list), the
   * declared quantity figures, and availability. Prefilled from the vendor's
   * own work copy; verified and logged server-side. */
  const [directEditFor, setDirectEditFor] = useState<string | null>(null);
  const [directDraft, setDirectDraft] = useState<VendorListingDraft | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [tierRows, setTierRows] = useState<{ min: string; price: string }[]>([]);
  const [minValue, setMinValue] = useState("");
  const [stepValue, setStepValue] = useState("");
  const [availabilityValue, setAvailabilityValue] = useState<
    "available" | "made_to_order" | "temporarily_unavailable" | ""
  >("");

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

  const openDirectEdit = useCallback(
    async (listingId: string, priceMode: string, priceMicroJod: string | null) => {
      setDirectEditFor(listingId);
      setDirectDraft(null);
      setPriceValue("");
      setTierRows([]);
      setMinValue("");
      setStepValue("");
      setAvailabilityValue("");
      if (priceMode === "fixed") setPriceValue(microToJodText(priceMicroJod));
      try {
        const result = await fetchVendorListingDraft(listingId);
        const draft = result.listing;
        setDirectDraft(draft);
        if (priceMode === "tiered" && draft.pricing?.tiers) {
          setTierRows(
            draft.pricing.tiers.map(tier => ({
              min: milliToText(tier.minQuantityMilli),
              price: microToJodText(tier.priceMicroJod),
            })),
          );
        }
        if (draft.quantity) {
          setMinValue(milliToText(draft.quantity.minQuantityMilli));
          setStepValue(milliToText(draft.quantity.stepMilli));
        }
      } catch {
        // The panel still opens for the fixed price; the work-copy prefill is
        // best-effort and the server re-validates everything anyway.
      }
    },
    [],
  );

  const saveDirectUpdate = useCallback(
    async (listingId: string, priceMode: string) => {
      const input: Parameters<typeof directUpdateListing>[1] = {};
      if (priceMode === "fixed") {
        const micro = jodToPriceMicro(priceValue);
        if (micro === null) throw new Error("أدخل سعرًا صحيحًا — أرقام إنجليزية بلا نص.");
        input.priceMicroJod = micro;
      }
      if (priceMode === "tiered") {
        const rows: { minQuantityMilli: string; priceMicroJod: string }[] = [];
        for (const row of tierRows) {
          const minMilli = textToQuantityMilli(row.min);
          const micro = jodToPriceMicro(row.price);
          if (minMilli === null || micro === null) {
            throw new Error("كل شريحة تحتاج حدًا صحيحًا (حتى ٣ منازل) وسعرًا صحيحًا.");
          }
          rows.push({ minQuantityMilli: minMilli, priceMicroJod: micro });
        }
        if (rows.length === 0) throw new Error("أضف شريحة واحدة على الأقل.");
        input.tiers = rows;
      }
      const minMilli = textToQuantityMilli(minValue);
      const stepMilli = textToQuantityMilli(stepValue);
      if (minMilli === null) throw new Error("أدخل حدًا أدنى صحيحًا (حتى ٣ منازل).");
      if (stepMilli === null) throw new Error("أدخل مضاعفًا صحيحًا (حتى ٣ منازل).");
      input.minQuantityMilli = minMilli;
      input.stepMilli = stepMilli;
      if (availabilityValue !== "") input.availabilityStatus = availabilityValue;
      await directUpdateListing(listingId, input);
      setDirectEditFor(null);
      await load();
    },
    [priceValue, tierRows, minValue, stepValue, availabilityValue, load],
  );

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
                    <Button
                      action="quiet"
                      onClick={() =>
                        void openDirectEdit(listing.id, listing.priceMode, listing.priceMicroJod)
                      }
                    >
                      تحديث مباشر
                    </Button>
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
                {directEditFor === listing.id && listing.status === "approved_for_publish" ? (
                  <div className="micro-vendor-price-edit" data-testid="price-direct-update">
                    {listing.priceMode === "fixed" ? (
                      <Field label="السعر (دينار — أرقام إنجليزية)">
                        <input
                          value={priceValue}
                          onChange={event => setPriceValue(event.target.value)}
                          inputMode="decimal"
                        />
                      </Field>
                    ) : null}
                    {listing.priceMode === "tiered" ? (
                      <div className="micro-vendor-tiers" data-testid="tier-direct-update">
                        <p>الشرائح (الحد الأدنى بالوحدة الأساسية — السعر بالدينار لكل وحدة أساسية)</p>
                        {tierRows.map((row, index) => (
                          <div className="micro-vendor-tier-row" key={index}>
                            <Field label={`الحد الأدنى للشريحة ${index + 1}`}>
                              <input
                                value={row.min}
                                onChange={event =>
                                  setTierRows(rows =>
                                    rows.map((current, at) =>
                                      at === index ? { ...current, min: event.target.value } : current,
                                    ),
                                  )
                                }
                                inputMode="decimal"
                              />
                            </Field>
                            <Field label={`سعر الشريحة ${index + 1} (د.أ)`}>
                              <input
                                value={row.price}
                                onChange={event =>
                                  setTierRows(rows =>
                                    rows.map((current, at) =>
                                      at === index ? { ...current, price: event.target.value } : current,
                                    ),
                                  )
                                }
                                inputMode="decimal"
                              />
                            </Field>
                            {tierRows.length > 1 ? (
                              <Button
                                action="quiet"
                                onClick={() => setTierRows(rows => rows.filter((_, at) => at !== index))}
                              >
                                حذف الشريحة
                              </Button>
                            ) : null}
                          </div>
                        ))}
                        {tierRows.length < 6 ? (
                          <Button
                            action="quiet"
                            onClick={() => setTierRows(rows => [...rows, { min: "", price: "" }])}
                          >
                            إضافة شريحة
                          </Button>
                        ) : null}
                        <p className="micro-review-item__meta">
                          حدود الشرائح تتزايد بلا تداخل، وسعر الوحدة في الشريحة الأكبر لا يزيد — يُتحقق
                          خادميًا.
                        </p>
                      </div>
                    ) : null}
                    <div className="micro-vendor-quantity-edit" data-testid="quantity-direct-update">
                      <Field label="الحد الأدنى للكمية (بالوحدة الأساسية — حتى ٣ منازل)">
                        <input
                          value={minValue}
                          onChange={event => setMinValue(event.target.value)}
                          inputMode="decimal"
                        />
                      </Field>
                      <Field label="مضاعف الكمية (بالوحدة الأساسية — حتى ٣ منازل)">
                        <input
                          value={stepValue}
                          onChange={event => setStepValue(event.target.value)}
                          inputMode="decimal"
                        />
                      </Field>
                    </div>
                    <Field label="حالة التوفر">
                      <select
                        value={availabilityValue}
                        onChange={event =>
                          setAvailabilityValue(
                            event.target.value as
                              "available" | "made_to_order" | "temporarily_unavailable" | "",
                          )
                        }
                      >
                        <option value="">بلا تغيير</option>
                        <option value="available">متوفر</option>
                        <option value="made_to_order">بموجب الطلب</option>
                        <option value="temporarily_unavailable">غير متوفر مؤقتًا</option>
                      </select>
                    </Field>
                    <p className="micro-review-item__meta">
                      تحديث مباشر معتمد (OD-09): السعر العددي داخل نمط التسعير نفسه، وكمية الحد الأدنى
                      والمضاعف، والتوفر — يُوثق بحدث إشرافي ولا يمس المحتوى أو الصور أو الفئة أو الوحدة أو
                      قناة الاتصال (هذه تمر بالمراجعة).
                    </p>
                    {directDraft === null ? (
                      <p className="micro-review-item__meta">جارٍ تعبئة القيم الحالية…</p>
                    ) : null}
                    <div className="micro-form-actions">
                      <Button
                        action="save"
                        onClick={() =>
                          void run(
                            () => saveDirectUpdate(listing.id, listing.priceMode),
                            "حُدّثت القيم مباشرة ووُثقت بحدث إشرافي.",
                          )
                        }
                      >
                        حفظ التحديث
                      </Button>
                      <Button
                        action="quiet"
                        onClick={() => {
                          setDirectEditFor(null);
                          setDirectDraft(null);
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
