/**
 * السوق — التصفح العام Listing-first (OD-03/OD-04، عقد 20 + الموجة 2
 * للقرارات النهائية 2026-11-21): بحث وفلاتر القرار النهائي (نوع المورد،
 * المحافظة، يوصّل أو استلام فقط، أقل كمية، التصنيف الهرمي الرئيسي/الفرعي)
 * وإعلانات موردين فعّالين على مستوى الأردن — لا رقم هاتف في أي عرض عام
 * (د-1) ولا سلة ولا شراء ولا أي أثر مالي (OD-13).
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, SlidersHorizontal, Store } from "lucide-react";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  browseMarketListings,
  fetchMarketMeta,
  type MarketMeta,
  type PublicListingSummary,
} from "@/application/market";
import { Button, EmptyState, Notice } from "@/components/primitives";
import { normalizeAsciiDigits } from "@/application/input";

const SUPPLIER_TYPE_OPTIONS = [
  { value: "manufacturer", label: "مصنّع" },
  { value: "wholesale", label: "جملة" },
  { value: "importer", label: "مستورد" },
  { value: "shop", label: "محل" },
];

const DELIVERY_FILTER_OPTIONS = [
  { value: "delivery", label: "يوصّل" },
  { value: "pickup_only", label: "استلام فقط" },
];

const FRESHNESS_LABELS: Record<string, string> = {
  fresh: "",
  needs_confirmation: "التوفر يحتاج تأكيدًا من المورد",
  hidden_stale: "مخفي لعدم تأكيد التوفر",
};

function milliToDisplay(milli: string): string {
  const value = BigInt(milli);
  const whole = value / 1000n;
  const fraction = value % 1000n;
  return fraction === 0n ? whole.toString() : `${whole.toString()}.${fraction.toString().padStart(3, "0")}`;
}

function microToJod(micro: string | null): string | null {
  if (micro === null) return null;
  const value = BigInt(micro);
  return `${(value / 1_000_000n).toString()}.${(value % 1_000_000n).toString().padStart(6, "0").slice(0, 3)}`;
}

export default function Market() {
  const [, navigate] = useLocation();
  /* الموجة 4 (G08 — Q175): الرابط السياقي من نقص المخزون يفتح السوق بمادة
   * البحث جاهزة (?search=) — قيمة عرض أولى فقط، والفلاتر بعدها بيد المستخدم. */
  const searchString = useSearch();
  const { session, signIn, failed: sessionFailed, refresh } = useNetworkSession();
  const [meta, setMeta] = useState<MarketMeta | null>(null);
  const [listings, setListings] = useState<PublicListingSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [moreState, setMoreState] = useState<"idle" | "loading" | "error">("idle");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch] = useState(() => {
    const matchSearch = /[?&]search=([^&]+)/.exec(searchString);
    return matchSearch === null ? "" : decodeURIComponent(matchSearch[1]!.replace(/\+/g, " "));
  });
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [supplierType, setSupplierType] = useState("");
  const [deliveryOption, setDeliveryOption] = useState("");
  const [maxMinQuantity, setMaxMinQuantity] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const normalizedMaxMin = normalizeAsciiDigits(maxMinQuantity.trim());
      const maxMinMilli = /^\d{1,6}(\.\d{1,3})?$/.test(normalizedMaxMin)
        ? `${normalizedMaxMin.split(".")[0]}${(normalizedMaxMin.split(".")[1] ?? "").padEnd(3, "0")}`
        : "";
      const result = await browseMarketListings({
        search,
        category: subCategory !== "" ? subCategory : category,
        governorate,
        supplierType,
        deliveryOption,
        maxMinQuantityMilli: maxMinMilli === "" ? undefined : maxMinMilli,
        availableOnly,
      });
      setListings(result.listings);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
      setMoreState("idle");
      setState("ready");
    } catch {
      setState("error");
    }
  }, [
    search,
    category,
    subCategory,
    governorate,
    supplierType,
    deliveryOption,
    maxMinQuantity,
    availableOnly,
  ]);

  const loadMore = useCallback(async () => {
    if (nextCursor === null || moreState === "loading") return;
    setMoreState("loading");
    try {
      const result = await browseMarketListings({
        search,
        category: subCategory !== "" ? subCategory : category,
        governorate,
        supplierType,
        deliveryOption,
        availableOnly,
        cursor: nextCursor,
      });
      setListings(current => [...current, ...result.listings]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
      setMoreState("idle");
    } catch {
      setMoreState("error");
    }
  }, [
    search,
    category,
    subCategory,
    governorate,
    supplierType,
    deliveryOption,
    availableOnly,
    nextCursor,
    moreState,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Stage C (S13/R4-14): فشل جلب الميتا حالة معلنة داخل لوحة الفلاتر —
   * لا قائمة تصنيفات فارغة صامتة. */
  const [metaFailed, setMetaFailed] = useState(false);
  const loadMeta = () => {
    setMetaFailed(false);
    void fetchMarketMeta()
      .then(setMeta)
      .catch(() => {
        setMeta(null);
        setMetaFailed(true);
      });
  };
  /* قصد أول تحميل فقط — إعادة المحاولة بيد المستخدم من لوحة الفلاتر. */
  useEffect(() => {
    loadMeta();
  }, []);

  return (
    <section className="micro-page micro-market-page" data-testid="market-browse-page">
      <div className="micro-page-heading">
        <span className="micro-overline">تصفح حر بلا تسجيل</span>
        <h1>السوق</h1>
        <p>مواد ومستلزمات بمعلنين معتمدين في كل الأردن.</p>
      </div>

      <div className="micro-market-actions">
        <label className="micro-market-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ابحث بالعنوان أو التصنيف…"
            aria-label="بحث في السوق"
          />
        </label>
        <Button action="outline" onClick={() => setFiltersOpen(open => !open)}>
          <SlidersHorizontal aria-hidden="true" /> فلترة
        </Button>
      </div>

      {filtersOpen ? (
        <div className="micro-market-filters" data-testid="market-filters">
          {metaFailed ? (
            <p role="alert" className="micro-market-status">
              تعذر تحميل التصنيفات — أعد المحاولة.
              <Button action="quiet" onClick={loadMeta}>
                إعادة المحاولة
              </Button>
            </p>
          ) : null}
          <label>
            التصنيف الرئيسي
            <select
              value={category}
              onChange={event => {
                setCategory(event.target.value);
                setSubCategory("");
              }}
            >
              <option value="">كل التصنيفات</option>
              {(meta?.categories ?? []).map(entry => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          {/* Q146: التصنيفات الفرعية تُعرض تحت الرئيسي المختار فقط — فلتر
           * فرعي بلا رئيسي لا معنى له في شجرة المستويين. */}
          {category !== "" && (meta?.categories ?? []).find(entry => entry.id === category)?.sub.length ? (
            <label>
              التصنيف الفرعي
              <select value={subCategory} onChange={event => setSubCategory(event.target.value)}>
                <option value="">كل الفرعيات</option>
                {(meta?.categories ?? [])
                  .find(entry => entry.id === category)!
                  .sub.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.label}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label>
            المحافظة
            <select value={governorate} onChange={event => setGovernorate(event.target.value)}>
              <option value="">كل المحافظات</option>
              {(meta?.governorates ?? []).map(entry => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label>
            نوع المورد
            <select value={supplierType} onChange={event => setSupplierType(event.target.value)}>
              <option value="">كل الأنواع</option>
              {SUPPLIER_TYPE_OPTIONS.map(entry => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            طريقة التسليم
            <select value={deliveryOption} onChange={event => setDeliveryOption(event.target.value)}>
              <option value="">الكل</option>
              {DELIVERY_FILTER_OPTIONS.map(entry => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            أقصى حد أدنى للطلب
            <input
              type="text"
              inputMode="numeric"
              value={maxMinQuantity}
              onChange={event => setMaxMinQuantity(event.target.value)}
              placeholder="مثال: 5"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={event => setAvailableOnly(event.target.checked)}
            />
            متوفر الآن فقط
          </label>
        </div>
      ) : null}

      {session.authenticated ? (
        <div className="micro-market-workspace-entry">
          <Button action="secondary" onClick={() => navigate("/market/vendor")}>
            مساحة المورد — إعلاناتي
          </Button>
        </div>
      ) : sessionFailed ? (
        /* F-15/S12 (Phase E): انقطاع التحقق حالة مستقلة — لا تُعرض كبوابة دخول؛
         * التصفح العام يستمر (لا يحتاج جلسة). */
        <Notice tone="error">
          تعذر التحقق من جلستك الآن — التصفح العام متاح، ومساحة المورد تحتاج تحققًا ناجحًا. أعد المحاولة.
          <Button action="quiet" onClick={() => void refresh()}>
            إعادة المحاولة
          </Button>
        </Notice>
      ) : (
        <Notice tone="neutral">
          تسجيل الدخول بهوية Micro مطلوب لإضافة إعلانك كمورد — التصفح متاح للجميع.
          <Button action="quiet" onClick={() => signIn("/market/vendor")}>
            الدخول عبر Google
          </Button>
        </Notice>
      )}

      {state === "loading" ? (
        <p className="micro-market-status" role="status">
          جارٍ التحميل…
        </p>
      ) : null}
      {state === "error" ? (
        <EmptyState
          title="تعذر تحميل السوق"
          description="تحقق من الاتصال ثم أعد المحاولة — بياناتك المحلية سليمة."
          action={
            <Button action="secondary" onClick={() => void load()}>
              إعادة المحاولة
            </Button>
          }
        />
      ) : null}
      {state === "ready" && listings.length === 0 ? (
        <EmptyState
          symbol={<Store aria-hidden="true" />}
          title="لا توجد نتائج مطابقة"
          description="جرّب تعديل الفلاتر أو البحث بكلمة أوسع."
          action={
            <Button
              action="quiet"
              onClick={() => {
                setSearch("");
                setCategory("");
                setSubCategory("");
                setGovernorate("");
                setSupplierType("");
                setDeliveryOption("");
                setMaxMinQuantity("");
                setAvailableOnly(false);
              }}
            >
              مسح الفلاتر
            </Button>
          }
        />
      ) : null}

      <ul className="micro-market-results" data-testid="market-results">
        {listings.map(listing => (
          <li key={listing.id}>
            <button
              type="button"
              className="micro-market-card"
              onClick={() => navigate(`/market/listing/${listing.id}`)}
            >
              <strong>{listing.title}</strong>
              <span className="micro-market-card__meta">
                {listing.governorate} · الحد الأدنى {milliToDisplay(listing.minQuantityMilli)}{" "}
                {listing.quantityUnit}
              </span>
              <span className="micro-market-card__price">
                {listing.priceMode === "fixed" ? (
                  <>
                    <bdi dir="ltr">{microToJod(listing.priceMicroJod) ?? "0"}</bdi> د.أ · سعر ثابت
                  </>
                ) : listing.priceMode === "tiered" ? (
                  "السعر حسب الكمية"
                ) : (
                  "يحتاج تسعيرًا"
                )}
              </span>
              {FRESHNESS_LABELS[listing.freshness] ? (
                <span className="micro-market-card__freshness">{FRESHNESS_LABELS[listing.freshness]}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {state === "ready" && hasMore ? (
        <div className="micro-market-more" data-testid="market-load-more">
          {moreState === "error" ? (
            /* R10-B4/F-017 (Phase F — review 2): خطأ مؤكد يعلن بـ alert لا status. */
            <p role="alert" className="micro-market-status">
              تعذر تحميل المزيد — أعد المحاولة.
            </p>
          ) : null}
          <Button action="outline" disabled={moreState === "loading"} onClick={() => void loadMore()}>
            {moreState === "loading" ? "جارٍ التحميل…" : "تحميل المزيد"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
