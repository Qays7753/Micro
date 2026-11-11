/**
 * طابور مراجعة السوق (OD-10، عقد 22): للمراجع المخول فقط — قيس بالبداية.
 * قرارات إدارية موثقة بفاعل وسبب؛ لا اعتماد دفع أو نيابة عن طرف، والنشر
 * يمر ببوابة اكتمال القبول (الملف + المحتوى + كل صورة).
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useNetworkSession } from "@/app/useNetworkSession";
import { ApiError, apiFetch } from "@/application/network";
import { Button, EmptyState, Field, Notice } from "@/components/primitives";

interface ReviewQueue {
  profiles: { id: string; work_copy_json: string; submitted_at: number }[];
  listings: { id: string; title: string; status: string; revision_status: string; work_copy_json: string }[];
  media: { id: string; listing_id: string | null }[];
  reports: { id: number; object_id: string; reason: string; details: string | null }[];
}

export default function MarketReview() {
  const [, navigate] = useLocation();
  const { session, signIn, loading: sessionLoading } = useNetworkSession();
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

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

  const decide = async (kind: "profile" | "listing" | "media", id: string, action: string) => {
    const reason = reasons[`${kind}:${id}`] ?? "";
    try {
      await apiFetch(
        `/api/market/review/${kind}/${encodeURIComponent(id)}`,
        { method: "POST", body: JSON.stringify({ action, reason: reason || undefined }) },
        { idempotencyKey: `review:${kind}:${id}:${action}` },
      );
      setMessage("سُجل القرار بفاعله وسببه.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تسجيل القرار.");
    }
  };

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
        <p>قرارات إدارية موثقة — النشر يمر ببوابة اكتمال قبول كل الأجزاء.</p>
      </div>
      {message ? <Notice tone="neutral">{message}</Notice> : null}
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
            <h2>ملفات الموردين</h2>
            {queue.profiles.length === 0 ? <p className="micro-review-empty">لا طلبات ملفات معلقة.</p> : null}
            {queue.profiles.map(profile => (
              <article key={profile.id} className="micro-review-item">
                <strong>ملف مورد</strong>
                <p className="micro-review-item__meta">{profile.work_copy_json}</p>
                <Field label="سبب القرار (للرفض أو طلب التعديل)">
                  <input
                    value={reasons[`profile:${profile.id}`] ?? ""}
                    onChange={event =>
                      setReasons(current => ({ ...current, [`profile:${profile.id}`]: event.target.value }))
                    }
                  />
                </Field>
                <div className="micro-review-item__actions">
                  <Button action="save" onClick={() => void decide("profile", profile.id, "approve")}>
                    قبول
                  </Button>
                  <Button
                    action="outline"
                    onClick={() => void decide("profile", profile.id, "changes_requested")}
                  >
                    طلب تعديل
                  </Button>
                  <Button action="destructive" onClick={() => void decide("profile", profile.id, "reject")}>
                    رفض
                  </Button>
                </div>
              </article>
            ))}
          </section>

          <section>
            <h2>الإعلانات</h2>
            {queue.listings.length === 0 ? <p className="micro-review-empty">لا إعلانات معلقة.</p> : null}
            {queue.listings.map(listing => (
              <article key={listing.id} className="micro-review-item">
                <strong>{listing.title}</strong>
                <p className="micro-review-item__meta">
                  {listing.status}
                  {listing.revision_status !== "none" ? ` · ${listing.revision_status}` : ""}
                </p>
                <Field label="سبب القرار">
                  <input
                    value={reasons[`listing:${listing.id}`] ?? ""}
                    onChange={event =>
                      setReasons(current => ({ ...current, [`listing:${listing.id}`]: event.target.value }))
                    }
                  />
                </Field>
                <div className="micro-review-item__actions">
                  <Button action="save" onClick={() => void decide("listing", listing.id, "approve")}>
                    قبول المحتوى
                  </Button>
                  <Button
                    action="outline"
                    onClick={() => void decide("listing", listing.id, "changes_requested")}
                  >
                    طلب تعديل
                  </Button>
                  <Button action="destructive" onClick={() => void decide("listing", listing.id, "reject")}>
                    رفض
                  </Button>
                </div>
              </article>
            ))}
          </section>

          <section>
            <h2>الصور</h2>
            {queue.media.length === 0 ? <p className="micro-review-empty">لا صور معلقة.</p> : null}
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
            {queue.reports.length === 0 ? <p className="micro-review-empty">لا بلاغات مفتوحة.</p> : null}
            {queue.reports.map(report => (
              <article key={report.id} className="micro-review-item">
                <strong>بلاغ</strong>
                <p className="micro-review-item__meta">
                  {report.reason}
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
