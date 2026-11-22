/**
 * Ask Micro (EX-D21 — Phase B 2026-11-14): المدخل الشامل للمساعدة داخل
 * المنتج، متاح لكل حساب Micro موقع في كل سياق مصرح بما فيه السائق.
 *
 * حدود صادقة:
 *  - الحالة الخادمية هي مصدر الحقيقة: configured=false تعني «غير مهيأة» —
 *    لا يوجد مزود ذكاء اصطناعي معتمد مرتبط، ولا تُرسل أي بيانات لخدمة
 *    خارجية، ولا ردود مفبركة (قرار المالك: لا موفر مدفوع ولا أسرار).
 *  - السياق المعروض (الأدوار/المساحات/ملخص السجلات المصرحة) محسوب خادميًا
 *    ومقصور على المتصل — السائق يرى سياقه فقط.
 *  - غير المسجل يرى بوابة دخول صادقة (المدخل موجود؛ الاستعمال يحتاج حسابًا).
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useNetworkSession } from "@/app/useNetworkSession";
import {
  fetchAskStatus,
  askQuestion,
  grantAskConsent,
  revokeAskConsent,
  type AskAnswer,
  type AskDraftProposal,
  type AskStatus,
} from "@/application/network";
import { ApiError } from "@/application/network";
import { Button, EmptyState, Notice } from "@/components/primitives";
import { AskDraftCard } from "@/components/ask/AskDraftCard";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { AskHistoryEntry } from "@/application/ask";

type AskMessage = { tone: "neutral" | "error" | "success"; text: string } | null;

/* The history preview cap (the named-constant slice idiom — R4: a literal
 * array slice reads as a business-date slice to the AST rule; the named
 * constant states the intent: a UI preview limit, not a date cut). */
const ASK_HISTORY_PREVIEW = 10;

type AskResult = {
  answer: string;
  sources: { id: string; label: string; value: string | number | boolean; source: string }[];
  draft: AskDraftProposal | null;
} | null;

export default function AskMicro() {
  const { loading: sessionLoading, session, signIn, failed: sessionFailed, refresh } = useNetworkSession();
  /* §10.2-7-2: the history service rides the storage port (both adapters) —
   * mounted from the services interpreter like every store-backed service. */
  const { askHistory } = usePrototypeServices();
  const returnTo = useReturnPath();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<AskStatus | null>(null);
  const [statusState, setStatusState] = useState<"loading" | "ready" | "error">("loading");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<AskMessage>(null);
  const [result, setResult] = useState<AskResult>(null);
  /* §10.2-7-1: the consent busy state (grant/revoke) — separate from asking. */
  const [consentBusy, setConsentBusy] = useState(false);
  /* §10.2-7-2: the local TEXT-only history (≤21 days, no raw audio anywhere).
   * Purged on load — nothing older than the window is ever rendered. */
  const [history, setHistory] = useState<AskHistoryEntry[]>([]);

  useEffect(() => {
    if (sessionLoading || !session.authenticated) return;
    let active = true;
    setStatusState("loading");
    fetchAskStatus()
      .then(result => {
        if (!active) return;
        setStatus(result);
        setStatusState("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatusState("error");
      });
    /* §10.2-7-2: the local text history loads with its 21-day purge. */
    askHistory
      .loadHistory()
      .then(loaded => {
        if (active) setHistory(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [sessionLoading, session.authenticated, askHistory]);

  /* F-15/S12 (صادق مع الحقيقة — Phase E): تعذّر التحقق حالة مستقلة قبل بوابة
   * الدخول — انقطاع الشبكة لا يُعرض أبدًا كأنه «غير مسجل» (كانت البوابة
   * تسبق هذا الفحص فتحجب الحالة الصادقة). */
  if (!sessionLoading && sessionFailed) {
    return (
      <div className="micro-page-pad" data-testid="ask-session-failed">
        <h1>اسأل Micro</h1>
        <Notice tone="error">
          تعذر التحقق من جلستك الآن — انقطاع الشبكة لا يعني أنك غير مسجل. تحقق من اتصالك ثم أعد المحاولة.
        </Notice>
        <Button action="secondary" onClick={() => void refresh()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!sessionLoading && !session.authenticated) {
    return (
      <div className="micro-page-pad" data-testid="ask-gate">
        <EmptyState
          title="اسأل Micro — يحتاج حسابك"
          description="المدخل متاح لكل حساب Micro في كل سياق — سجّل الدخول بحسابك نفسه لطرح سؤالك داخل سياقك المصرح."
          action={
            <Button action="commit" onClick={() => signIn(returnTo)}>
              الدخول عبر Google
            </Button>
          }
        />
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="micro-route-loading" role="status">
        جارٍ التحقق من جلستك…
      </div>
    );
  }

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      /* §10.2-7-5: the owner-mode question carries the EXPLICIT workspace
       * context (his active project) — never a merged cross-project scope. */
      const workspaceId = status?.context?.workspaces?.[0]?.id;
      const answer = await askQuestion(question.trim(), workspaceId);
      /* §5: الإجابة تأتي مع مصادرها الموثقة فقط، والمسودة — إن وجدت — بطاقة
       * قابلة للتحرير لا معاملة محفوظة. */
      setResult({
        answer: answer.answer ?? answer.answerText ?? "تم إرسال السؤال.",
        sources: answer.sources ?? [],
        draft: answer.draft ?? null,
      });
      setMessage({ tone: "success", text: "" });
      /* §10.2-7-2: the served Q&A pair lands in the local text history
       * (the purge rides the append — nothing beyond 21 days is kept). */
      const stored = await askHistory.recordExchange(
        question.trim(),
        answer.answer ?? answer.answerText ?? "",
      );
      if (stored !== null) setHistory(current => [stored, ...current].slice(0, 200));
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage({ tone: "error", text: error.message });
      } else {
        setMessage({ tone: "error", text: "تعذر الوصول إلى الخدمة الآن — بياناتك المحلية سليمة." });
      }
    } finally {
      setBusy(false);
    }
  };

  const configured = status?.configured === true;
  const context = status?.context ?? null;
  const governance = status?.governance ?? null;
  const consentGranted = governance?.consent === "granted";
  const refreshStatus = () => {
    fetchAskStatus()
      .then(result => {
        setStatus(result);
        setStatusState("ready");
      })
      .catch(() => setStatusState("error"));
  };
  const changeConsent = async (grant: boolean) => {
    if (consentBusy) return;
    setConsentBusy(true);
    setMessage(null);
    try {
      if (grant) {
        await grantAskConsent();
      } else {
        await revokeAskConsent();
      }
      refreshStatus();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof ApiError ? error.message : "تعذر تحديث موافقتك الآن — أعد المحاولة.",
      });
    } finally {
      setConsentBusy(false);
    }
  };

  return (
    <div className="micro-page-pad" data-testid="ask-surface">
      {/* Stage C (S13/R1-21 + R5-3): مسار عميق بلا شريط سفلي — زر الرجوع
       * الكنوني نفسه المستخدم في كل المسارات العميقة (عقد U-005). */}
      <button className="micro-back-button" type="button" onClick={() => navigate(returnTo)}>
        <ArrowRight aria-hidden="true" /> رجوع
      </button>
      <h1>اسأل Micro</h1>
      {statusState === "loading" ? (
        <div className="micro-route-loading" role="status">
          جارٍ تحضير سياقك المصرح…
        </div>
      ) : null}
      {statusState === "error" ? (
        /* Stage C (S13/R4-16): نص «أعد المحاولة» بلا زر كان طريقًا مسدودًا —
         * زر إعادة المحاولة فعلًا يعيد جلب السياق. */
        <>
          <Notice tone="error">تعذر تحميل سياق Ask Micro الآن — بياناتك المحلية سليمة.</Notice>
          <Button
            action="secondary"
            onClick={() => {
              setStatusState("loading");
              fetchAskStatus()
                .then(result => {
                  setStatus(result);
                  setStatusState("ready");
                })
                .catch(() => setStatusState("error"));
            }}
          >
            إعادة المحاولة
          </Button>
        </>
      ) : null}
      {statusState === "ready" ? (
        <>
          {!configured ? (
            <div className="micro-ask-unconfigured" data-testid="ask-unconfigured">
              <strong>Ask Micro غير مهيأة بعد.</strong>
              <p>
                لا يوجد مزود ذكاء اصطناعي معتمد مرتبط بهذه النسخة، ولا تُرسل أي بيانات إلى أي خدمة خارجية قبل
                إعداد المالك لمزود معتمد. عند التهيئة سيكون سؤالك محصورًا بسياقك المصرح فقط.
              </p>
            </div>
          ) : null}
          {context ? (
            <div className="micro-ask-context" data-testid="ask-context">
              <p className="micro-overline">سياقك المصرح (محسوب خادميًا)</p>
              <ul>
                <li>الأدوار: {roleLabels(context.roles).join("، ") || "بدون أدوار نشطة بعد"}</li>
                {context.workspaces.length > 0 ? (
                  <li>
                    مساحات العمل:{" "}
                    {context.workspaces.map(w => `${w.displayName} (${workspaceCapabilities(w)})`).join("، ")}
                  </li>
                ) : (
                  <li>لا مساحة عمل بعد — تُنشأ تلقائيًا عند أول فعل عمل.</li>
                )}
                <li>سجلاتك المتاحة للمساعد: {summaryText(context.permittedRecordSummary)}</li>
              </ul>
            </div>
          ) : null}
          {/* §10.2-7-1: الموافقة القابلة للسحب — السؤال يتطلب موافقة ممنوحة،
           * والسحب فوري المفعول من هذه البطاقة نفسها. */}
          <div className="micro-ask-consent" data-testid="ask-consent">
            <p className="micro-overline">موافقة المساعد</p>
            {consentGranted ? (
              <>
                <p>
                  موافقتك ممنوحة — يسافر سؤالك الحالي وملخص سياقك المصرح فقط إلى مزود الإجابات عند تجهيزه، بلا
                  تاريخ محادثات كامل ولا اقتراحات من تلقاء نفسه.
                </p>
                <Button action="quiet" loading={consentBusy} onClick={() => void changeConsent(false)}>
                  سحب الموافقة (فوري)
                </Button>
              </>
            ) : (
              <>
                <p>
                  السؤال يحتاج موافقتك أولًا: يسافر سؤالك الحالي وملخص سياقك المصرح فقط إلى مزود الإجابات عند
                  تجهيزه — لا تاريخ محادثات كاملًا ولا اقتراحات من تلقاء نفسه، ويمكنك سحب الموافقة في أي وقت.
                </p>
                <Button action="commit" loading={consentBusy} onClick={() => void changeConsent(true)}>
                  أوافق على سياسة المساعد
                </Button>
              </>
            )}
          </div>
          {/* §10.2-7-3/4: الحدود اليومية الصادقة — حد الأسئلة وحصة الاستخدام
           * المجانية المنفصلة (بلا مسار مدفوع إطلاقًا). */}
          {governance ? (
            <p className="micro-ask-caps" data-testid="ask-caps">
              أسئلتك اليوم: {governance.daily.questionsUsed} من {governance.daily.questionCap} — حصة الاستخدام
              المجانية: {governance.daily.neuronsUsed} من {governance.daily.neuronsCap} نيورون (بلا مسار
              مدفوع).
            </p>
          ) : null}
          <form
            className="micro-ask-form"
            onSubmit={event => {
              event.preventDefault();
              if (question.trim().length >= 2) void submit();
            }}
          >
            <label className="micro-field">
              <span>سؤالك</span>
              <textarea
                value={question}
                onChange={event => setQuestion(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="اكتب سؤالك عن أعمالك داخل سياقك…"
              />
            </label>
            <Button action="commit" type="submit" loading={busy} disabled={question.trim().length < 2}>
              اسأل
            </Button>
          </form>
          {result ? (
            <div className="micro-ask-result" data-testid="ask-result">
              <p className="micro-ask-answer" data-testid="ask-answer">
                {result.answer}
              </p>
              {result.sources.length > 0 ? (
                <div className="micro-ask-sources" data-testid="ask-sources">
                  <p className="micro-overline">المصادر (من سجلاتك المحسوبة خادميًا)</p>
                  <ul>
                    {result.sources.map(source => (
                      <li key={source.id}>
                        {source.label}: <strong>{String(source.value)}</strong> — {source.source}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.draft ? (
                <AskDraftCard draft={result.draft} session={session} onDismissed={() => setResult(null)} />
              ) : null}
            </div>
          ) : null}
          {message && message.text ? (
            <Notice tone={message.tone === "error" ? "error" : "success"}>{message.text}</Notice>
          ) : null}
          {/* §10.2-7-2: السجل المحلي النصي — ٢١ يومًا كحد أقصى، بلا أي صوت
           * خام في أي مكان؛ يبقى على هذا الجهاز ولا يسافر إلى الخادم. */}
          {history.length > 0 ? (
            <div className="micro-ask-history" data-testid="ask-history">
              <p className="micro-overline">سجلك المحلي (نص فقط — آخر ٢١ يومًا)</p>
              <ul>
                {history.slice(0, ASK_HISTORY_PREVIEW).map(entry => (
                  <li key={entry.id}>
                    <strong>{entry.question}</strong>
                    <span> — {entry.answer}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function roleLabels(roles: { owner: boolean; vendor: boolean; driver: boolean; admin: boolean }): string[] {
  const labels: string[] = [];
  if (roles.owner) labels.push("صاحب مشروع");
  if (roles.vendor) labels.push("مورد");
  if (roles.driver) labels.push("سائق");
  if (roles.admin) labels.push("مراجع");
  return labels;
}

function workspaceCapabilities(w: { capabilities: { market: boolean; delivery: boolean } }): string {
  const parts: string[] = [];
  if (w.capabilities.market) parts.push("سوق");
  if (w.capabilities.delivery) parts.push("توصيل");
  return parts.length > 0 ? parts.join(" + ") : "بلا وحدات مفعلة";
}

function summaryText(summary: {
  ownerPendingDecisions: number;
  vendorListings: number;
  driverOpenTasks: number;
}): string {
  const parts: string[] = [];
  if (summary.ownerPendingDecisions > 0) parts.push(`${summary.ownerPendingDecisions} قرار توصيل بانتظارك`);
  if (summary.vendorListings > 0) parts.push(`${summary.vendorListings} إعلانًا في مساحتك`);
  if (summary.driverOpenTasks > 0) parts.push(`${summary.driverOpenTasks} مهمة سائق جارية`);
  return parts.length > 0 ? parts.join("، ") : "لا سجلات نشطة بعد";
}
