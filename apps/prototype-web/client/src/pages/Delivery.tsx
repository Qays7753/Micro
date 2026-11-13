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
import { Button, EmptyState, Field, Notice } from "@/components/primitives";
import { formatLocalDate } from "@/presentation/formatters";

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
  const { session, signIn, loading: sessionLoading, failed: sessionFailed, refresh } = useNetworkSession();
  const [requests, setRequests] = useState<OwnerRequestSummary[]>([]);
  const [statements, setStatements] = useState<
    {
      id: string;
      driverName: string;
      date: string;
      totalMinor: string;
      status: string;
      items: { description: string; amountMinor: string }[];
    }[]
  >([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState<{ tone: "neutral" | "error" | "success"; text: string } | null>(null);
  const [differenceFor, setDifferenceFor] = useState<string | null>(null);
  const [differenceNote, setDifferenceNote] = useState("");

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
        <span className="micro-overline">تبويب صاحب المشروع</span>
        <h1>التوصيل</h1>
        <p>حجز موجه لسائق معروف تختاره — بلا بث ولا تعيين عشوائي.</p>
      </div>
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      {!session.authenticated && sessionFailed ? (
        /* F-15/S12 (Phase E): انقطاع التحقق حالة مستقلة — لا تُعرض كبوابة دخول. */
        <Notice tone="error">
          تعذر التحقق من جلستك الآن — انقطاع الشبكة لا يعني أنك غير مسجل. تحقق من اتصالك ثم أعد المحاولة.
          <Button action="quiet" onClick={() => void refresh()}>
            إعادة المحاولة
          </Button>
        </Notice>
      ) : !session.authenticated ? (
        <Notice tone="neutral">
          حجز التوصيل وكشوفه يحتاجان تسجيل الدخول بهوية Micro. دليل السائقين العام متاح من زر «سائقوني».
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
          {session.isAdmin ? (
            <Button action="quiet" onClick={() => navigate("/delivery/review")}>
              طابور مراجعة التوصيل
            </Button>
          ) : null}
        </div>
      )}

      {awaitingStatements.length > 0 ? (
        <section className="micro-delivery-statements" data-testid="delivery-statements">
          <h2>كشوف تنتظر تأكيدك (كاملًا فقط — لا تسوية جزئية)</h2>
          {awaitingStatements.map(statement => (
            <article key={statement.id} className="micro-statement-card">
              <p>
                {statement.driverName} — {formatLocalDate(statement.date)} —{" "}
                {/* F-11 (S12/Phase E): عزل bidi كنوني للمبالغ عند المساس. */}
                <bdi dir="ltr">{minorToJod(statement.totalMinor)}</bdi> د.أ
              </p>
              <ul className="micro-statement-card__items">
                {(statement.items ?? []).map((item, index) => (
                  <li key={index}>
                    {item.description} — <bdi dir="ltr">{minorToJod(item.amountMinor)}</bdi> د.أ
                  </li>
                ))}
              </ul>
              {differenceFor === statement.id ? (
                <div className="micro-statement-card__difference">
                  <Field label="الفرق الملاحظ" controlId="difference-note">
                    <input
                      id="difference-note"
                      value={differenceNote}
                      onChange={event => setDifferenceNote(event.target.value)}
                      placeholder="ما الذي اختلف عن الكشف؟"
                    />
                  </Field>
                  <div className="micro-form-actions">
                    <Button
                      action="save"
                      disabled={differenceNote.trim().length === 0}
                      onClick={async () => {
                        try {
                          await confirmStatement(statement.id, "difference", differenceNote.trim());
                          setNotice({
                            tone: "success",
                            text: "سُجل الفرق — الكشف يظل بانتظار معالجة كاملة.",
                          });
                          setDifferenceFor(null);
                          setDifferenceNote("");
                          await load();
                        } catch (error) {
                          setNotice({
                            tone: "error",
                            text: error instanceof Error ? error.message : "تعذر تسجيل الفرق.",
                          });
                        }
                      }}
                    >
                      حفظ الفرق
                    </Button>
                    <Button
                      action="quiet"
                      onClick={() => {
                        setDifferenceFor(null);
                        setDifferenceNote("");
                      }}
                    >
                      رجوع
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="micro-form-actions">
                  <Button
                    action="save"
                    onClick={async () => {
                      try {
                        await confirmStatement(statement.id, "full");
                        setNotice({ tone: "success", text: "أُكد استلام الكشف كاملًا." });
                        await load();
                      } catch (error) {
                        setNotice({
                          tone: "error",
                          text: error instanceof Error ? error.message : "تعذر التأكيد.",
                        });
                      }
                    }}
                  >
                    استلام كامل
                  </Button>
                  <Button action="outline" onClick={() => setDifferenceFor(statement.id)}>
                    تسجيل فرق
                  </Button>
                </div>
              )}
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
      {state === "ready" && sorted.length === 0 && session.authenticated ? (
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
                {request.pricingMode === "prepriced" ? (
                  <>
                    أجرة معروضة <bdi dir="ltr">{minorToJod(request.offeredFareMinor) ?? "—"}</bdi> د.أ
                  </>
                ) : (
                  "طلب تسعير موجه"
                )}
                {request.collectionMinor !== null ? (
                  <>
                    {" · تحصيل "}
                    <bdi dir="ltr">{minorToJod(request.collectionMinor)}</bdi> د.أ
                  </>
                ) : (
                  ""
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
