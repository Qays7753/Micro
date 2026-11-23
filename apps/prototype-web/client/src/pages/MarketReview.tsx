/**
 * طابور مراجعة السوق (OD-10، عقد 22 + الموجة 2 للقرارات النهائية
 * 2026-11-21): للمراجع المخول فقط — قيس بالبداية. لا مراجعة ملفات موردين
 * بعد اليوم (Q4/Q28 — التفعيل بإكمال الملف والشروط)؛ يبقى الإيقاف/الرفع
 * الإداري للموردين، ومراجعة كل إعلان قبل النشر مع تسجيل اتصال التحقق
 * لأول إعلان (ب-قواعد)، وإدارة التصنيفات الهرمية (Q146)، والأعداد
 * التشغيلية (Q154) — قرارات موثقة بفاعل وسبب دائمًا.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useNetworkSession } from "@/app/useNetworkSession";
import { ApiError, apiFetch } from "@/application/network";
import {
  fetchMarketMeta,
  fetchMarketOpsCounts,
  putMarketCategories,
  type MarketCategoryNode,
} from "@/application/market";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";

const LISTING_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  submitted: "قيد المراجعة",
  changes_requested: "يحتاج تعديلًا",
  rejected: "مرفوض",
  approved_for_publish: "منشور",
  paused: "موقوف من المورد",
  archived: "مؤرشف",
  admin_suspended: "موقوف من الإدارة",
};

const REVISION_STATUS_LABELS: Record<string, string> = {
  none: "",
  submitted: "نسخة معدلة قيد المراجعة",
  changes_requested: "التعديل يحتاج استكمالًا",
  content_approved: "المحتوى مقبول — بانتظار بقية البوابة",
  renewal_requested: "طلب تجديد قيد المراجعة",
};

const REPORT_REASON_LABELS: Record<string, string> = {
  misleading: "مضلل",
  out_of_scope: "خارج نطاق السوق",
  spam: "إزعاج",
  contact_issue: "مشكلة تواصل",
  other: "أخرى",
};

interface ReviewQueue {
  profiles: { id: string; status: string; work_copy_json: string; activated_at: number | null }[];
  listings: { id: string; title: string; status: string; revision_status: string; work_copy_json: string }[];
  media: { id: string; listing_id: string | null }[];
  reports: { id: number; object_id: string; reason: string; details: string | null }[];
}

interface OpsCounts {
  activeSuppliers: number;
  activeDrivers: number;
  weeklyBookings: number;
  launchThreshold: { suppliers: number; drivers: number; governorates: number };
}

export default function MarketReview() {
  const [, navigate] = useLocation();
  const { session, signIn, loading: sessionLoading, failed: sessionFailed, refresh } = useNetworkSession();
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [message, setMessage] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(
    null,
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  /* الموجة 2 (ب-قواعد): تسجيل اتصال التحقق مع قبول أول إعلان للمورد —
   * مربع صريح لكل إعلان؛ الخادم يرفض قبول أول إعلان بدونه برسالة صادقة. */
  const [verificationCalls, setVerificationCalls] = useState<Record<string, boolean>>({});
  const [opsCounts, setOpsCounts] = useState<OpsCounts | null>(null);
  const [categories, setCategories] = useState<MarketCategoryNode[] | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const result = await apiFetch<ReviewQueue>("/api/market/review/queue");
      setQueue(result);
      setState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setState("forbidden");
        return;
      }
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (session.authenticated) void load();
    else if (!sessionLoading) setState("forbidden");
  }, [session.authenticated, sessionLoading, load]);

  /* Q154: الأعداد التشغيلية — تُعرض كما هي بلا أي ادعاء استيفاء عتبة
   * الإطلاق (قرار المالك التشغيلي على حسابات حقيقية فقط). */
  useEffect(() => {
    if (!session.authenticated) return;
    void fetchMarketOpsCounts()
      .then(setOpsCounts)
      .catch(() => setOpsCounts(null));
    void fetchMarketMeta()
      .then(meta => setCategories(meta.categories))
      .catch(() => setCategories(null));
  }, [session.authenticated, queue]);

  /* Stage C (S13/R4-15): قرار واحد قيد التنفيذ في كل لحظة — يمنع سباق
   * قرارين متتاليين على العنصر نفسه أثناء تحديث الطابور. */
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const decide = async (
    kind: "profile" | "listing" | "media" | "report",
    id: string,
    action: string,
    extra?: Record<string, unknown>,
  ) => {
    const key = `${kind}:${id}:${action}`;
    if (pendingDecision !== null) return;
    setPendingDecision(key);
    const reason = reasons[`${kind}:${id}`] ?? "";
    try {
      await apiFetch(
        `/api/market/review/${kind}/${encodeURIComponent(id)}`,
        {
          method: "POST",
          body: JSON.stringify({ action, reason: reason || undefined, ...extra }),
        },
        { idempotencyKey: `review:${kind}:${id}:${action}` },
      );
      setMessage({ tone: "success", text: "سُجل القرار بفاعله وسببه." });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "تعذر تسجيل القرار." });
    } finally {
      setPendingDecision(null);
    }
  };

  /* Q146: حفظ شجرة التصنيفات بعد تعديل محلي — تحقق الخادم من الشكل
   * (مستويان، معرفات وتسميات فريدة) ويرفض غير الصالح برسالة صادقة. */
  const saveCategories = async () => {
    if (categories === null) return;
    try {
      await putMarketCategories(categories);
      setMessage({ tone: "success", text: "حُفظت شجرة التصنيفات." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "تعذر حفظ التصنيفات." });
    }
  };

  /* S12/F-15 (Stage C — أمر المالك 2026-11-14): تعذّر التحقق حالة مستقلة
   * — انقطاع الشبكة لا يُعرض كأنه «لا تملك الصلاحية» أبدًا. */
  if (!sessionLoading && sessionFailed) {
    return (
      <section className="micro-page">
        <div className="micro-page-heading">
          <h1>مراجعة السوق</h1>
        </div>
        <EmptyState
          title="تعذر التحقق من جلستك الآن"
          description="انقطاع الشبكة لا يعني أنك فقدت الصلاحية. تحقق من اتصالك ثم أعد المحاولة."
          action={
            <Button action="secondary" onClick={() => void refresh()}>
              إعادة المحاولة
            </Button>
          }
        />
      </section>
    );
  }
  if (!sessionLoading && !session.authenticated) {
    return (
      <section className="micro-page">
        <div className="micro-page-heading">
          <h1>مراجعة السوق</h1>
        </div>
        <EmptyState
          title="تسجيل الدخول مطلوب"
          description="أدوات المراجعة للجهة المخولة فقط."
          action={
            <Button action="secondary" onClick={() => signIn("/market/review")}>
              الدخول عبر Google
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className="micro-page micro-review-page" data-testid="market-review-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/market")}>
        <ArrowRight aria-hidden="true" /> السوق
      </button>
      <div className="micro-page-heading">
        <h1>مراجعة السوق</h1>
        <p>قرارات إدارية موثقة — النشر يمر ببوابة اكتمال قبول كل الأجزاء، وأول إعلان معه اتصال التحقق.</p>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {state === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ تحميل طابور المراجعة…
        </p>
      ) : null}
      {state === "forbidden" ? (
        <EmptyState title="لا تملك صلاحية المراجعة" description="هذه الأدوات للجهة المخولة فقط." />
      ) : null}
      {state === "error" ? (
        <EmptyState
          title="تعذر تحميل الطابور"
          description="أعد المحاولة."
          action={
            <Button action="secondary" onClick={() => void load()}>
              إعادة المحاولة
            </Button>
          }
        />
      ) : null}

      {state === "ready" && queue ? (
        <>
          {/* Q154: أعداد تشغيلية بسيطة — مصادرها صريحة ولا تدّعي جاهزية
           * إطلاق أبدًا؛ عتبة الإطلاق قرار مالك على حسابات حقيقية. */}
          {opsCounts !== null ? (
            <section data-testid="market-ops-counts">
              <h2>أرقام تشغيلية</h2>
              <p className="micro-review-item__meta">
                موردون محسوبون بالقاعدة الكاملة: {opsCounts.activeSuppliers} · سائقون معتمدون:{" "}
                {opsCounts.activeDrivers} · حجوزات الأسبوع: {opsCounts.weeklyBookings} — عتبة الإطلاق (
                {opsCounts.launchThreshold.suppliers} موردين و{opsCounts.launchThreshold.drivers} سائقين على{" "}
                {opsCounts.launchThreshold.governorates} محافظة) قرار مالك على حسابات حقيقية، لا تُستوفى من
                بيانات اصطناعية.
              </p>
            </section>
          ) : null}

          {/* الموجة 2 (Q4/Q28): لا مراجعة ملفات — هؤلاء الموردون الفعّالون/
           الموقوفون للإيقاف/الرفع الإداري فقط، بقرار مسبب دوما. */}
          <section>
            <h2>الموردون</h2>
            <p className="micro-review-queue-empty">لا مراجعة للملفات — التفعيل بإكمال الملف والشروط.</p>
            {queue.profiles.map(profile => {
              const work = JSON.parse(profile.work_copy_json) as {
                displayName?: string;
                governorate?: string;
              };
              return (
                <article
                  key={profile.id}
                  className="micro-review-item"
                  data-testid={`supplier-${profile.id}`}
                >
                  <strong>{work.displayName ?? "مورد بلا اسم"}</strong>
                  <p className="micro-review-item__meta">
                    {work.governorate ?? "—"} · {profile.status === "suspended" ? "موقوف" : "فعّال"}
                  </p>
                  <Field label="سبب القرار (إلزامي للإيقاف)">
                    <input
                      value={reasons[`profile:${profile.id}`] ?? ""}
                      onChange={event =>
                        setReasons(current => ({ ...current, [`profile:${profile.id}`]: event.target.value }))
                      }
                    />
                  </Field>
                  <div className="micro-review-item__actions">
                    {profile.status !== "suspended" ? (
                      <Button
                        action="destructive"
                        disabled={pendingDecision !== null}
                        onClick={() => void decide("profile", profile.id, "suspend")}
                      >
                        إيقاف المورد
                      </Button>
                    ) : (
                      <Button
                        action="save"
                        disabled={pendingDecision !== null}
                        onClick={() => void decide("profile", profile.id, "unsuspend")}
                      >
                        رفع الإيقاف
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <section>
            <h2>الإعلانات</h2>
            {queue.listings.length === 0 ? (
              <p className="micro-review-queue-empty">لا إعلانات معلقة.</p>
            ) : null}
            {queue.listings.map(listing => {
              /* Stage C (S13/R1-9): المحتوى الكامل قبل قرار البوابة — كان
               * المراجع يقبل/يرفض من العنوان وحده؛ النسخة العاملة تُعرض
               * كاملة. */
              const work = JSON.parse(listing.work_copy_json) as {
                title?: string;
                category?: string;
                governorate?: string;
                description?: string;
                pricing?: { mode?: string; priceMicroJod?: string | null };
                quantity?: { unit?: string; minQuantityMilli?: string };
                contactType?: string;
                contactValue?: string;
              };
              return (
                <article key={listing.id} className="micro-review-item">
                  <strong>{listing.title}</strong>
                  <dl className="micro-review-item__meta" data-testid={`listing-work-${listing.id}`}>
                    <div>
                      <dt>التصنيف</dt>
                      <dd>{work.category ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>المحافظة</dt>
                      <dd>{work.governorate ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>السعر</dt>
                      <dd>
                        {work.pricing?.mode === "quote_required" ? (
                          "يحتاج تسعيرًا"
                        ) : work.pricing?.mode === "tiered" ? (
                          "حسب الكمية"
                        ) : work.pricing?.priceMicroJod != null ? (
                          <>
                            <bdi dir="ltr">
                              {`${(BigInt(work.pricing.priceMicroJod) / 1_000_000n).toString()}.${(
                                BigInt(work.pricing.priceMicroJod) % 1_000_000n
                              )
                                .toString()
                                .padStart(6, "0")
                                .slice(0, 3)}`}
                            </bdi>{" "}
                            د.أ
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>الحد الأدنى</dt>
                      <dd>
                        {work.quantity?.minQuantityMilli != null ? (
                          <>
                            <bdi dir="ltr">
                              {(() => {
                                const value = BigInt(work.quantity.minQuantityMilli);
                                const whole = value / 1000n;
                                const fraction = value % 1000n;
                                return fraction === 0n
                                  ? whole.toString()
                                  : `${whole.toString()}.${fraction.toString().padStart(3, "0")}`;
                              })()}
                            </bdi>{" "}
                            {work.quantity?.unit ?? ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>التواصل</dt>
                      <dd>
                        {work.contactValue != null ? (
                          <>
                            {work.contactType === "whatsapp" ? "واتساب: " : "هاتف: "}
                            <bdi dir="ltr">{work.contactValue}</bdi>
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                  <p className="micro-review-item__meta">{work.description ?? ""}</p>
                  <p className="micro-review-item__meta">
                    {LISTING_STATUS_LABELS[listing.status] ?? listing.status}
                    {listing.revision_status !== "none"
                      ? ` · ${REVISION_STATUS_LABELS[listing.revision_status] ?? listing.revision_status}`
                      : ""}
                  </p>
                  <Field label="سبب القرار">
                    <input
                      value={reasons[`listing:${listing.id}`] ?? ""}
                      onChange={event =>
                        setReasons(current => ({ ...current, [`listing:${listing.id}`]: event.target.value }))
                      }
                    />
                  </Field>
                  {/* ب-قواعد: اتصال التحقق يسجل مع قبول أول إعلان للمورد —
                   * لو كان أول إعلان ولم يُسجل، يرفض الخادم برسالة صادقة. */}
                  <label>
                    <input
                      type="checkbox"
                      checked={verificationCalls[`listing:${listing.id}`] === true}
                      onChange={event =>
                        setVerificationCalls(current => ({
                          ...current,
                          [`listing:${listing.id}`]: event.target.checked,
                        }))
                      }
                    />
                    أجريت اتصال التحقق مع المورد (إلزامي لقبول أول إعلان)
                  </label>
                  <div className="micro-review-item__actions">
                    <Button
                      action="save"
                      disabled={pendingDecision !== null}
                      onClick={() =>
                        void decide("listing", listing.id, "approve", {
                          verificationCall:
                            verificationCalls[`listing:${listing.id}`] === true ? { done: true } : undefined,
                        })
                      }
                    >
                      قبول المحتوى
                    </Button>
                    <Button
                      action="outline"
                      disabled={pendingDecision !== null}
                      onClick={() => void decide("listing", listing.id, "changes_requested")}
                    >
                      طلب تعديل
                    </Button>
                    <Button
                      action="destructive"
                      disabled={pendingDecision !== null}
                      onClick={() => void decide("listing", listing.id, "reject")}
                    >
                      رفض
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Q146: شاشة إدارة التصنيفات — إضافة/إزالة رئيسي وفرعي وتعديل
           * التسمية؛ الحفظ يمر بتحقق الخادم للشكل الكامل. */}
          {categories !== null ? (
            <section data-testid="market-categories-admin">
              <h2>إدارة التصنيفات</h2>
              {categories.map((main, mainIndex) => (
                <article key={main.id} className="micro-review-item">
                  <label>
                    تصنيف رئيسي
                    <input
                      value={main.label}
                      onChange={event =>
                        setCategories(current =>
                          current!.map((entry, position) =>
                            position === mainIndex ? { ...entry, label: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </label>
                  <ul>
                    {main.sub.map((sub, subIndex) => (
                      <li key={sub.id}>
                        <label>
                          فرعي
                          <input
                            value={sub.label}
                            onChange={event =>
                              setCategories(current =>
                                current!.map((entry, position) =>
                                  position === mainIndex
                                    ? {
                                        ...entry,
                                        sub: entry.sub.map((subEntry, subPosition) =>
                                          subPosition === subIndex
                                            ? { ...subEntry, label: event.target.value }
                                            : subEntry,
                                        ),
                                      }
                                    : entry,
                                ),
                              )
                            }
                          />
                        </label>
                        <Button
                          action="quiet"
                          onClick={() =>
                            setCategories(current =>
                              current!.map((entry, position) =>
                                position === mainIndex
                                  ? {
                                      ...entry,
                                      sub: entry.sub.filter((_, subPosition) => subPosition !== subIndex),
                                    }
                                  : entry,
                              ),
                            )
                          }
                        >
                          حذف الفرعي
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="micro-review-item__actions">
                    <Button
                      action="outline"
                      onClick={() =>
                        setCategories(current =>
                          current!.map((entry, position) =>
                            position === mainIndex
                              ? {
                                  ...entry,
                                  sub: [
                                    ...entry.sub,
                                    {
                                      id: `${main.id}-sub${entry.sub.length + 1}-${Date.now().toString(36)}`,
                                      label: "",
                                    },
                                  ],
                                }
                              : entry,
                          ),
                        )
                      }
                    >
                      إضافة فرعي
                    </Button>
                    <Button
                      action="quiet"
                      onClick={() =>
                        setCategories(current => current!.filter((_, position) => position !== mainIndex))
                      }
                    >
                      حذف الرئيسي
                    </Button>
                  </div>
                </article>
              ))}
              <div className="micro-review-item__actions">
                <Button
                  action="outline"
                  onClick={() =>
                    setCategories(current => [
                      ...(current ?? []),
                      { id: `main-${Date.now().toString(36)}`, label: "", sub: [] },
                    ])
                  }
                >
                  إضافة تصنيف رئيسي
                </Button>
                <Button action="save" onClick={() => void saveCategories()}>
                  حفظ شجرة التصنيفات
                </Button>
              </div>
            </section>
          ) : null}

          <section>
            <h2>الصور</h2>
            {queue.media.length === 0 ? <p className="micro-review-queue-empty">لا صور معلقة.</p> : null}
            {queue.media.map(media => (
              <article key={media.id} className="micro-review-item">
                <div className="micro-review-item__meta">
                  <img src={`/api/media/${media.id}`} alt="صورة مراجعة" className="micro-review-image" />
                </div>
                <div className="micro-review-item__actions">
                  <Button action="save" onClick={() => void decide("media", media.id, "approve")}>
                    قبول الصورة
                  </Button>
                  <Button action="destructive" onClick={() => void decide("media", media.id, "reject")}>
                    رفض الصورة
                  </Button>
                </div>
              </article>
            ))}
          </section>

          <section>
            <h2>البلاغات</h2>
            {queue.reports.length === 0 ? (
              <p className="micro-review-queue-empty">لا بلاغات مفتوحة.</p>
            ) : null}
            {queue.reports.map(report => (
              <article key={report.id} className="micro-review-item">
                <strong>بلاغ</strong>
                <p className="micro-review-item__meta">
                  {REPORT_REASON_LABELS[report.reason] ?? report.reason}
                  {report.details ? ` — ${report.details}` : ""}
                </p>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}
