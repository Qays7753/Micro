/**
 * S10 (UNIT-030 T05 — أمر b56967d8): «راجع فكرتك قبل البدء» — فحص أولي منظم
 * من خمسة أسئلة. الناتج ثلاثة أقسام (ما حددته / ما يحتاج توضيحًا / خطوتك
 * التالية) بلا درجة نجاح ولا حكم جدوى ولا توصية اقتراض ولا أي ذكاء
 * اصطناعي خارجي — قواعد معلنة ومراجعة لغوية فقط (U030-AC14/AC15).
 */
import { ArrowRight, Lightbulb } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { computeIdeaReview, IDEA_REVIEW_QUESTIONS } from "@/application/planning";
import { Button } from "@/components/primitives";
import type { IdeaReviewResult } from "@micro-domain/planning/index.js";

type IdeaQuestionKey = "whatToSell" | "whoBuys" | "costAndPrice" | "firstCustomerReach" | "whatToVerify";
const QUESTIONS: { key: IdeaQuestionKey; label: string; placeholder: string }[] = [
  { key: "whatToSell", label: IDEA_REVIEW_QUESTIONS.whatToSell, placeholder: "مثال: صناديق هدايا مخصصة" },
  { key: "whoBuys", label: IDEA_REVIEW_QUESTIONS.whoBuys, placeholder: "مثال: أهالي طلاب المدرسة القريبة" },
  {
    key: "costAndPrice",
    label: IDEA_REVIEW_QUESTIONS.costAndPrice,
    placeholder: "مثال: التكلفة نحو 7 والسعر 10",
  },
  {
    key: "firstCustomerReach",
    label: IDEA_REVIEW_QUESTIONS.firstCustomerReach,
    placeholder: "مثال: عبر إنستغرام وأصحابي",
  },
  {
    key: "whatToVerify",
    label: IDEA_REVIEW_QUESTIONS.whatToVerify,
    placeholder: "مثال: تكلفة التغليف الفعلية",
  },
];

export default function IdeaReview() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<IdeaReviewResult | null>(null);

  function review() {
    const outcome = computeIdeaReview({
      whatToSell: answers.whatToSell?.trim() || null,
      whoBuys: answers.whoBuys?.trim() || null,
      costAndPrice: answers.costAndPrice?.trim() || null,
      firstCustomerReach: answers.firstCustomerReach?.trim() || null,
      whatToVerify: answers.whatToVerify?.trim() || null,
    });
    if (outcome.ok) setResult(outcome.value);
  }

  return (
    <section className="micro-page micro-tools-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> أدوات المشروع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">أداة تخطيط مستقلة</span>
        <h1>راجع فكرتك قبل البدء</h1>
        <p>خمسة أسئلة قصيرة تنظّم ما تعرفه وما ينقصك — بلا درجة ولا حكم جدوى.</p>
      </div>

      <section className="micro-decision-card" aria-label="قاعدة الأداة">
        <span>قاعدة هذه الأداة</span>
        <strong>مراجعة أولية من إجاباتك فقط — لا تقييم نجاح ولا توصية اقتراض.</strong>
        <p>كل إجابة غير محددة تظهر في «ما يحتاج توضيحًا» كما هي؛ لا نخترع لك إجابات.</p>
      </section>

      <section className="micro-form-card" aria-label="أسئلة فحص الفكرة">
        <div className="micro-section-title">
          <Lightbulb aria-hidden="true" />
          <div>
            <span className="micro-overline">خمسة أسئلة</span>
            <h2>اكتب ما تعرفه الآن</h2>
          </div>
        </div>
        {QUESTIONS.map(question => (
          <label className="micro-field" key={question.key}>
            <span>{question.label}</span>
            <input
              value={answers[question.key] ?? ""}
              onChange={event => {
                setAnswers(current => ({ ...current, [question.key]: event.target.value }));
                setResult(null);
              }}
              placeholder={question.placeholder}
            />
            <small>اتركه فارغًا إن لم تحدد بعد.</small>
          </label>
        ))}
        <Button action="save" onClick={review}>
          راجع الإجابات
        </Button>
        {result ? (
          <section className="micro-cost-result" aria-live="polite">
            {result.defined.length > 0 ? (
              <>
                <span className="micro-overline">ما حددته</span>
                <ul className="micro-idea-review-list">
                  {result.defined.map(entry => (
                    <li key={entry.question}>
                      <strong>{entry.question}</strong>
                      <span>{entry.answer}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {result.needsClarification.length > 0 ? (
              <>
                <span className="micro-overline">ما يحتاج توضيحًا</span>
                <ul className="micro-idea-review-list">
                  {result.needsClarification.map(question => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <span className="micro-overline">خطوتك التالية</span>
            <strong>{result.nextStep}</strong>
            <p className="micro-cost-disclaimer">
              هذه مراجعة أولية من إجاباتك — ليست دراسة جدوى ولا تقييمًا لطلب السوق ولا توصية اقتراض.
            </p>
          </section>
        ) : null}
      </section>
      <p className="micro-local-truth">أدوات التخطيط لا تكتب أي سجل — إجاباتك لا تُحفظ.</p>
    </section>
  );
}
