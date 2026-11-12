/**
 * التوصيل — تجربة صاحب المشروع (OD01/OD02): ما ينتظر تأكيده أولًا ثم الجاري
 * ثم الحجز ثم سائقوني، مع الكشوف اليومية — كله عرض لبيانات الخادم بلا أي
 * أثر مالي (OD12). بوابة السائق منفصلة تمامًا عند /driver.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Truck } from "lucide-react";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  fetchOwnerOverview,
  fetchOwnerStatements,
  confirmStatement,
  type OwnerRequestSummary,
} from "@/application/delivery";
import { Button, EmptyState, Notice } from "@/components/primitives";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  awaiting_driver_response: "بانتظار قبول السائق",
  awaiting_requester_decision: "بانتظار موافقتك على العرض",
  confirmed: "الحجز مؤكد",
  driver_declined: "رفضه السائق",
  quote_rejected: "رفضتَ العرض",
  withdrawn: "مسحوب",
  response_expired: "انتهت مهلة الرد",
  cancelled: "ملغى",
};

const PENDING_FIRST = ["awaiting_requester_decision", "confirmed"];

function minorToJod(minor: string | null): string | null {
  if (minor === null) return null;
  const value = BigInt(minor);
  return `${(value / 100n).toString()}.${(value % 100n).toString().padStart(2, "0")}`;
}

export default function Delivery() {
  const [, navigate] = useLocation();
  const { session, signIn, loading: sessionLoading } = useNetworkSession();
  const [requests, setRequests] = useState<OwnerRequestSummary[]>([]);
  const [statements, setStatements] = useState<
    { id: string; driverName: string; date: string; totalMinor: string; status: string }[]
  >([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const overview = await fetchOwnerOverview();
      setRequests(overview.requests);
      const statementData = await fetchOwnerStatements();
      setStatements(statementData.statements);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (session.authenticated) void load();
    else if (!sessionLoading) setState("ready");
  }, [session.authenticated, sessionLoading, load]);

  const sorted = [...requests].sort((left, right) => {
    const leftPending = PENDING_FIRST.includes(left.status) ? 0 : 1;
    const rightPending = PENDING_FIRST.includes(right.status) ? 0 : 1;
    if (leftPending !== rightPending) return leftPending - rightPending;
    return right.updatedAt - left.updatedAt;
  });
  const awaitingStatements = statements.filter(statement => statement.status === "awaiting_confirmation");

  return (
    <section className="micro-page micro-delivery-page" data-testid="delivery-owner-page">
      <div className="micro-page-heading">
        <span className="micro-overline">توسعة E-00</span>
        <h1>التوصيل</h1>
        <p>حجز موجه لسائق معروف تختاره — بلا بث ولا تعيين عشوائي (OD03).</p>
      </div>
      {message ? <Notice tone="neutral">{message}</Notice> : null}

      {!session.authenticated ? (
        <Notice tone="neutral">
          حجز التوصيل يحتاج تسجيل الدخول بهوية Micro — التصفح والعرض للجميع.
          <Button action="quiet" onClick={() => signIn("/delivery")}>
            الدخول عبر Google
          </Button>
        </Notice>
      ) : (
        <div className="micro-delivery-actions">
          <Button action="create" onClick={() => navigate("/delivery/booking/new")}>
            احجز توصيلًا
          </Button>
          <Button action="outline" onClick={() => navigate("/delivery/drivers")}>
            سائقوني والبحث عن سائق
          </Button>
        </div>
      )}

      {awaitingStatements.length > 0 ? (
        <section className="micro-delivery-statements" data-testid="delivery-statements">
          <h2>كشوف تنتظر تأكيدك (كاملًا فقط — لا تسوية جزئية)</h2>
          {awaitingStatements.map(statement => (
            <article key={statement.id} className="micro-statement-card">
              <p>
                {statement.driverName} — {statement.date} — {minorToJod(statement.totalMinor)} د.أ
              </p>
              <div>
                <Button
                  action="save"
                  onClick={async () => {
                    try {
                      await confirmStatement(statement.id, "full");
                      setMessage("أُكد استلام الكشف كاملًا.");
                      await load();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "تعذر التأكيد.");
                    }
                  }}
                >
                  استلام كامل
                </Button>
                <Button
                  action="outline"
                  onClick={async () => {
                    const note = window.prompt("سجّل الفرق الملاحظ (يظل الكشف غير مؤكد كاملًا):");
                    if (note === null) return;
                    try {
                      await confirmStatement(statement.id, "difference", note);
                      setMessage("سُجل الفرق — الكشف يظل بانتظار معالجة كاملة.");
                      await load();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "تعذر تسجيل الفرق.");
                    }
                  }}
                >
                  تسجيل فرق
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {state === "loading" ? <p className="micro-delivery-status">جارٍ التحميل…</p> : null}
      {state === "error" ? (
        <EmptyState
          title="تعذر تحميل حجوزاتك"
          description="أعد المحاولة — بياناتك المحلية سليمة."
          action={
            <Button action="secondary" onClick={() => void load()}>
              إعادة المحاولة
            </Button>
          }
        />
      ) : null}
      {state === "ready" && sorted.length === 0 ? (
        <EmptyState
          symbol={<Truck aria-hidden="true" />}
          title="لا حجوزات بعد"
          description="ابدأ بحجز موجه لسائق تعرفه — تختار السائق وتحدد المهمة والموعد."
          action={
            session.authenticated ? (
              <Button action="create" onClick={() => navigate("/delivery/booking/new")}>
                احجز توصيلًا
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <ul className="micro-delivery-results" data-testid="delivery-requests">
        {sorted.map(request => (
          <li key={request.id}>
            <button
              type="button"
              className="micro-delivery-card"
              onClick={() => navigate(`/delivery/booking/${request.id}`)}
            >
              <strong>{STATUS_LABELS[request.status] ?? request.status}</strong>
              <span>
                {request.pricingMode === "prepriced"
                  ? `أجرة معروضة ${minorToJod(request.offeredFareMinor) ?? "—"} د.أ`
                  : "طلب تسعير موجه"}
                {request.collectionMinor !== null
                  ? ` · تحصيل ${minorToJod(request.collectionMinor)} د.أ`
                  : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
