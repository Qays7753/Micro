/**
 * طابور مراجعة التوصيل (OD17/OD22/OD28–OD31، عقد 21): للمراجع المخول فقط
 * (قيس بالبداية) — قرارات إدارية موثقة بفاعل وسبب. اعتماد السائق يستلزم
 * مركبة معتمدة وإثباتَي الهوية والرخصة أولًا (الخادم يرفض 409 الصادق)؛
 * تاريخ انتهاء الإثبات يُسجل فقط حين يكون واضحًا (OD29)؛ تعليق النجوم
 * يُدار بقرار النشر/الإخفاء (OD17). لا تأكيد مال نيابة عن طرف أبدًا.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useNetworkSession } from "@/app/useNetworkSession";
import { ApiError, apiFetch } from "@/application/network";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";

const EVIDENCE_CATEGORY_LABELS: Record<string, string> = {
  identity: "إثبات هوية",
  license: "رخصة قيادة",
  vehicle_ownership: "إثبات ملكية/إذن المركبة",
};

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
};

interface ReviewQueue {
  drivers: { id: string; work_copy_json: string; submitted_at: number }[];
  evidence: {
    id: string;
    driver_profile_id: string;
    category: string;
    status: string;
    expires_at: number | null;
    media_id: string;
  }[];
  vehicles: { id: string; driver_profile_id: string; info_json: string; status: string }[];
  ratingComments: { id: string; request_id: string; stars: number; comment: string; status: string }[];
}

function shortRef(id: string): string {
  return id.slice(0, 12);
}

export default function DeliveryReviewQueue() {
  const [, navigate] = useLocation();
  const { session, signIn, loading: sessionLoading } = useNetworkSession();
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [message, setMessage] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(
    null,
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [expiries, setExpiries] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setState("loading");
    try {
      setQueue(await apiFetch<ReviewQueue>("/api/delivery/review/queue"));
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

  const decide = async (
    kind: "driver" | "evidence" | "vehicle" | "rating",
    id: string,
    action: string,
    body?: Record<string, unknown>,
  ) => {
    const reason = reasons[`${kind}:${id}`] ?? "";
    try {
      await apiFetch(
        `/api/delivery/review/${kind}/${encodeURIComponent(id)}`,
        { method: "POST", body: JSON.stringify({ action, reason: reason || undefined, ...body }) },
        { idempotencyKey: `delivery-review:${kind}:${id}:${action}` },
      );
      setMessage({ tone: "success", text: "سُجل القرار الإداري بفاعله وسببه." });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "تعذر تسجيل القرار." });
    }
  };

  if (!sessionLoading && !session.authenticated) {
    return (
      <section className="micro-page">
        <div className="micro-page-heading">
          <h1>مراجعة التوصيل</h1>
        </div>
        <EmptyState
          title="تسجيل الدخول مطلوب"
          description="أدوات المراجعة للجهة المخولة فقط."
          action={
            <Button action="secondary" onClick={() => signIn("/delivery/review")}>
              الدخول عبر Google
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className="micro-page micro-review-page" data-testid="delivery-review-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/delivery")}>
        <ArrowRight aria-hidden="true" /> التوصيل
      </button>
      <div className="micro-page-heading">
        <h1>مراجعة التوصيل</h1>
        <p>
          طابور إداري واحد: طلبات السائقين وإثباتاتهم ومركباتهم وتعليقات النجوم — لا تأكيد مال نيابةً عن طرف.
        </p>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {state === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ تحميل طابور المراجعة…
        </p>
      ) : null}
      {state === "forbidden" ? (
        <EmptyState
          title="لا تملك صلاحية المراجعة"
          description="هذه الأدوات للمراجع المخول فقط (قيس بالبداية)."
        />
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
          <section>
            <h2>طلبات السائقين</h2>
            {queue.drivers.length === 0 ? (
              <p className="micro-review-queue-empty">لا طلبات سائقين معلقة.</p>
            ) : null}
            {queue.drivers.map(driver => {
              const work = JSON.parse(driver.work_copy_json) as {
                displayName?: string;
                phone?: string;
                serviceAreas?: string[];
              };
              return (
                <article key={driver.id} className="micro-review-item">
                  <strong>سائق: {work.displayName ?? "بلا اسم"}</strong>
                  <p className="micro-review-item__meta">
                    مرجع {shortRef(driver.id)} · هاتف: {work.phone ?? "—"} · مناطق:{" "}
                    {(work.serviceAreas ?? []).join("، ") || "—"}
                  </p>
                  <p className="micro-review-item__meta">
                    الاعتماد يستلزم مركبة معتمدة وإثباتَي الهوية والرخصة أولًا — الخادم يرفض بدونهما.
                  </p>
                  <Field label="سبب القرار (للرفض أو طلب التعديل)">
                    <input
                      value={reasons[`driver:${driver.id}`] ?? ""}
                      onChange={event =>
                        setReasons(current => ({ ...current, [`driver:${driver.id}`]: event.target.value }))
                      }
                    />
                  </Field>
                  <div className="micro-review-item__actions">
                    <Button action="save" onClick={() => void decide("driver", driver.id, "approve")}>
                      اعتماد
                    </Button>
                    <Button
                      action="outline"
                      onClick={() => void decide("driver", driver.id, "changes_requested")}
                    >
                      طلب تعديل
                    </Button>
                    <Button action="destructive" onClick={() => void decide("driver", driver.id, "reject")}>
                      رفض
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>

          <section>
            <h2>الإثباتات</h2>
            {queue.evidence.length === 0 ? (
              <p className="micro-review-queue-empty">لا إثباتات معلقة.</p>
            ) : null}
            {queue.evidence.map(item => (
              <article key={item.id} className="micro-review-item">
                <strong>{EVIDENCE_CATEGORY_LABELS[item.category] ?? item.category}</strong>
                <p className="micro-review-item__meta">
                  مرجع سائق {shortRef(item.driver_profile_id)} ·{" "}
                  {EVIDENCE_STATUS_LABELS[item.status] ?? item.status}
                </p>
                <div className="micro-review-item__meta">
                  <img
                    src={`/api/media/${item.media_id}`}
                    alt={`إثبات ${EVIDENCE_CATEGORY_LABELS[item.category] ?? item.category}`}
                    className="micro-review-image"
                  />
                </div>
                <Field label="تاريخ انتهاء واضح من المستند (اختياري — لا يُخترع)">
                  <input
                    type="date"
                    value={expiries[`evidence:${item.id}`] ?? ""}
                    onChange={event =>
                      setExpiries(current => ({
                        ...current,
                        [`evidence:${item.id}`]: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="سبب القرار">
                  <input
                    value={reasons[`evidence:${item.id}`] ?? ""}
                    onChange={event =>
                      setReasons(current => ({
                        ...current,
                        [`evidence:${item.id}`]: event.target.value,
                      }))
                    }
                  />
                </Field>
                <div className="micro-review-item__actions">
                  <Button
                    action="save"
                    onClick={() => {
                      const text = expiries[`evidence:${item.id}`] ?? "";
                      const at = text === "" ? undefined : Date.parse(`${text}T23:59:59Z`);
                      void decide(
                        "evidence",
                        item.id,
                        "approve",
                        at === undefined || Number.isNaN(at) ? undefined : { expiresAt: at },
                      );
                    }}
                  >
                    قبول
                  </Button>
                  <Button
                    action="outline"
                    onClick={() => void decide("evidence", item.id, "request_updated_image")}
                  >
                    طلب صورة محدثة
                  </Button>
                  <Button action="destructive" onClick={() => void decide("evidence", item.id, "reject")}>
                    رفض
                  </Button>
                </div>
              </article>
            ))}
          </section>

          <section>
            <h2>المركبات</h2>
            {queue.vehicles.length === 0 ? (
              <p className="micro-review-queue-empty">لا مركبات معلقة.</p>
            ) : null}
            {queue.vehicles.map(vehicle => {
              const info = JSON.parse(vehicle.info_json) as { plate?: string; vehicleType?: string };
              return (
                <article key={vehicle.id} className="micro-review-item">
                  <strong>مركبة: {info.plate ?? "بلا لوحة"}</strong>
                  <p className="micro-review-item__meta">
                    مرجع سائق {shortRef(vehicle.driver_profile_id)} · النوع: {info.vehicleType ?? "—"}
                  </p>
                  <div className="micro-review-item__actions">
                    <Button action="save" onClick={() => void decide("vehicle", vehicle.id, "approve")}>
                      اعتماد
                    </Button>
                    <Button
                      action="outline"
                      onClick={() => void decide("vehicle", vehicle.id, "request_updated_image")}
                    >
                      طلب صورة محدثة
                    </Button>
                    <Button action="destructive" onClick={() => void decide("vehicle", vehicle.id, "reject")}>
                      رفض
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>

          <section>
            <h2>تعليقات النجوم</h2>
            {queue.ratingComments.length === 0 ? (
              <p className="micro-review-queue-empty">لا تعليقات تنتظر الإدارة.</p>
            ) : null}
            {queue.ratingComments.map(rating => (
              <article key={rating.id} className="micro-review-item">
                <strong>{"★".repeat(rating.stars)}</strong>
                <p className="micro-review-item__meta">«{rating.comment}»</p>
                <div className="micro-review-item__actions">
                  <Button action="save" onClick={() => void decide("rating", rating.id, "publish")}>
                    نشر التعليق
                  </Button>
                  <Button action="destructive" onClick={() => void decide("rating", rating.id, "reject")}>
                    إخفاء التعليق
                  </Button>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}
