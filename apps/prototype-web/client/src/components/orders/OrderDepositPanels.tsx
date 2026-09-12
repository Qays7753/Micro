/**
 * المجموعة ١١ (المرحلة 11-C — تفكيك تفاصيل الطلب): لوحات العربون — الحقيقة
 * وتسوية عربون الملغى ومعنى المحتفظ به — مقطع عرض مستخرج من صفحة
 * OrderDetail.tsx حرفيًا؛ الصفحة تبقى الموزّع وتمرّر كل شيء خصائصِ أدناة.
 * لا منطق ماليًا هنا — عرض واستدعاء إجراءات الصفحة فقط، بنفس السلوك.
 */
import { CircleDollarSign, HandCoins, XCircle } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ActualMaterialPanel, type MaterialState } from "@/components/order/ActualMaterialPanel";
import { ActualTimePanel } from "@/components/presentation/ActualTimePanel";
import type { ActualTimeService } from "@/application/time/actualTimeService";
import type { FulfillmentResult, FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import type { AgreementResult } from "@/application/agreements/agreementService";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import type { CraftOrder } from "@micro-domain/craft-order/index.js";

export type OrderDepositPanelsProps = {
  order: CraftOrder;
  stored: { id: string; order: CraftOrder };
  isActing: boolean;
  message: string | null;
  settleAmount: number | null;
  setSettleAmount: Dispatch<SetStateAction<number | null>>;
  classifyMeaning: "owner" | "revenue" | null;
  setClassifyMeaning: Dispatch<SetStateAction<"owner" | "revenue" | null>>;
  classifyReason: string;
  setClassifyReason: Dispatch<SetStateAction<string>>;
  classifyAmount: number | null;
  setClassifyAmount: Dispatch<SetStateAction<number | null>>;
  depositReason: string;
  setDepositReason: Dispatch<SetStateAction<string>>;
  classifyDeposit: (meaning: "owner" | "revenue", reason: string) => Promise<void>;
  reclassifyDeposit: (meaning: "owner" | "revenue", reason: string) => Promise<void>;
  contextualAction: ReactNode;
  executionStatuses: readonly string[];
  materialState: MaterialState;
  actualTime: ActualTimeService;
  dataVersion: number;
  notifyDataChanged: () => void;
  run: (action: () => Promise<FulfillmentResult | AgreementResult>) => Promise<void>;
  navigate: (target: string) => void;
  fulfillment: FulfillmentService;
};

export function OrderDepositPanels({
  order,
  stored,
  isActing,
  message,
  settleAmount,
  setSettleAmount,
  classifyMeaning,
  setClassifyMeaning,
  classifyReason,
  setClassifyReason,
  classifyAmount,
  setClassifyAmount,
  depositReason,
  setDepositReason,
  classifyDeposit,
  reclassifyDeposit,
  contextualAction,
  executionStatuses,
  materialState,
  actualTime,
  dataVersion,
  notifyDataChanged,
  run,
  navigate,
  fulfillment,
}: OrderDepositPanelsProps) {
  return (
    <>
      {order.depositCollectedMinor > 0 ? (
        <section className="micro-deposit-truth">
          <CircleDollarSign aria-hidden="true" />
          <span>
            <b>
              عربون محصل (د.أ):{" "}
              <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" />
            </b>
            <small>كاش مرتبط بالطلب</small>
          </span>
        </section>
      ) : (
        <section className="micro-note-card">
          <span>العربون</span>
          <p>لم يُسجَّل عربون لهذا الطلب.</p>
        </section>
      )}
      {contextualAction}
      {/* المجموعة ١ (Scope E): أثناء التنفيذ — قراءة الوقت والمادة الفعلية ظاهرة
          بلا طي، ووصلة استهلاك المادة تحفظ سياق الطلب الأصلي للتعبئة والرجوع. */}
      {executionStatuses.includes(order.status) ? (
        <section className="micro-execution-layer" aria-label="قراءة التنفيذ">
          <ActualMaterialPanel
            state={materialState}
            onRecord={() =>
              navigate(`/inventory/movement/consume?order=${stored.id}&from=/orders/${stored.id}`)
            }
          />
          <ActualTimePanel
            orderId={stored.id}
            actualTime={actualTime}
            dataVersion={dataVersion}
            notifyDataChanged={notifyDataChanged}
          />
        </section>
      ) : null}
      {/* القرار ١٩ + Conflict E: عربون طلب ملغى ينتظر قرارًا — رد كامل أو جزئي،
          أو احتفاظ جزئي لتغطية التكلفة الموثقة، أو إبقاء معلق — مع معاينة أثر
          رقمية إلزامية قبل القرار، والرد من محفظة المصدر حيث وُجد التخصيص. */}
      {order.status === "cancelled" && order.depositSettlement === "needs_review" ? (
        <section className="micro-cancel-panel" aria-label="تسوية عربون طلب ملغى">
          <strong>
            عربون محصل ينتظر قرارك (
            <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ)
          </strong>
          {/* معاينة الأثر الإلزامية (Conflict E): لا قرار بلا أرقام — التكلفة
              الموثقة، ما استُهلك فعلًا، والاقتراح القائم عليها. */}
          {(() => {
            const pendingMinor = order.depositCollectedMinor - (order.depositRetainedMinor ?? 0);
            const documentedCostMinor = order.costSnapshot.plannedCostMinor;
            const coverProposalMinor = Math.min(pendingMinor, documentedCostMinor);
            const refundProposalMinor = pendingMinor - coverProposalMinor;
            return (
              <div className="micro-finance-reversal-review" data-testid="deposit-settlement-preview">
                <strong>معاينة أثر قرار العربون</strong>
                <dl>
                  <div>
                    <dt>العربون المعلق</dt>
                    <dd>
                      <MoneyValue minor={pendingMinor} className="micro-inline-number" /> د.أ
                      {(order.depositRetainedMinor ?? 0) > 0 ? (
                        <small>
                          {" "}
                          (محتفظ به سابقًا:{" "}
                          <MoneyValue
                            minor={order.depositRetainedMinor ?? 0}
                            className="micro-inline-number"
                          />{" "}
                          د.أ)
                        </small>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>التكلفة الموثقة للطلب</dt>
                    <dd>
                      <MoneyValue minor={documentedCostMinor} className="micro-inline-number" /> د.أ
                    </dd>
                  </div>
                  <div>
                    <dt>ما استُهلك فعلًا</dt>
                    <dd>
                      0 د.أ — الطلب لم يُسلَّم؛ موادّه لم تُستهلك من المخزون، والإلغاء نفسه لا يكتب مصروفًا.
                    </dd>
                  </div>
                  <div>
                    <dt>الاقتراح بعد التكلفة الموثقة</dt>
                    <dd>
                      احتفظ بما يغطي التكلفة (حتى{" "}
                      <MoneyValue minor={coverProposalMinor} className="micro-inline-number" /> د.أ) وردّ
                      الباقي (
                      <MoneyValue minor={refundProposalMinor} className="micro-inline-number" /> د.أ) — عدّل
                      المبلغ كما تقرر؛ القرار سببه موثق دائمًا.
                    </dd>
                  </div>
                  <div>
                    <dt>أثر الرد على الكاش</dt>
                    <dd>يخرج المردود من رصيدك المقبوض — ومن محفظة المصدر المسجلة حيث وُجد تخصيص العربون.</dd>
                  </div>
                  <div>
                    <dt>أثر الاحتفاظ</dt>
                    <dd>
                      الكاش يبقى محصلًا بلا معنى حتى تصنّفه صراحة: مال مالك (ليس ربحًا) أو إيراد مشروع — لا
                      تصنيف خفي.
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })()}
          <label className="micro-field">
            <span>
              مبلغ التسوية <small>اختياري — الافتراضي كامل المعلق</small>
            </span>
            <EnglishNumberInput
              value={settleAmount ?? order.depositCollectedMinor - (order.depositRetainedMinor ?? 0)}
              kind="money"
              onNumericChange={value => setSettleAmount(value)}
            />
            <small>
              اتركه كما هو للتسوية الكاملة، أو اكتب جزئيًا — الباقي يبقى «يحتاج مراجعة» بلا قرار خفي.
            </small>
          </label>
          <label className="micro-field">
            <span>
              سبب التسوية <small>مطلوب عند الرد أو الاحتفاظ</small>
            </span>
            <input
              value={depositReason}
              onChange={event => setDepositReason(event.target.value)}
              placeholder="مثال: رد العربون نقدًا في المحل"
            />
          </label>
          <div className="micro-form-actions micro-contextual-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={isActing || !depositReason.trim()}
              onClick={() => {
                void run(() =>
                  fulfillment.refundDeposit(stored.id, depositReason, settleAmount ?? undefined),
                );
                setDepositReason("");
                setSettleAmount(null);
              }}
            >
              <HandCoins aria-hidden="true" /> رُدَّ العربون
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={isActing || !depositReason.trim()}
              onClick={() => {
                void run(() =>
                  fulfillment.retainDeposit(stored.id, depositReason, settleAmount ?? undefined),
                );
                setDepositReason("");
                setSettleAmount(null);
              }}
            >
              احتفظ به رصيدًا
            </button>
          </div>
          <p>أو اتركه «يحتاج مراجعة» وتابع لاحقًا — خيار صالح لا خطأ؛ يبقى ظاهرًا في فحص السلامة حتى تقرر.</p>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositSettlement === "refund_deposit" ? (
        <section className="micro-note-card">
          <HandCoins aria-hidden="true" />
          <p>عربون مُرَدّ بتسوية موثقة.</p>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositSettlement === "retain_deposit" ? (
        <section className="micro-cancel-panel" aria-label="معنى العربون المحتفظ به">
          <strong>
            عربون محتفظ به (
            <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ) — شو بدك
            تعمل فيه؟
          </strong>
          {(() => {
            const retainedMinor = order.depositRetainedMinor ?? order.depositCollectedMinor;
            const classifiedMinor =
              (order.depositClassifiedOwnerMinor ?? 0) + (order.depositClassifiedRevenueMinor ?? 0);
            const unclassifiedMinor = retainedMinor - classifiedMinor;
            return unclassifiedMinor > 0;
          })() ? (
            <>
              <p>
                الكاش محتفظ به بلا معنى بعد. صنّفه: مال مالك (تسحبه وقتما تشاء)، أو إيراد مشروع (يدخل ربح فترة
                القرار) — بمبلغ صريح إن شئت جزئيًا، والباقي يبقى بانتظار قراره. أو اتركه معلقًا — خيار صالح
                ظاهر حتى تقرر.
              </p>
              {/* المجموعة ٥ (تسديد دَين المجموعة ٤ — بند ٢) + Conflict E: سطر الأثر
               * الرقمي قبل التأكيد — بمبلغ التصنيف الفعلي لا الرقم الكامل فقط. */}
              {(() => {
                const retainedMinor = order.depositRetainedMinor ?? order.depositCollectedMinor;
                const classifiedMinor =
                  (order.depositClassifiedOwnerMinor ?? 0) + (order.depositClassifiedRevenueMinor ?? 0);
                const unclassifiedMinor = retainedMinor - classifiedMinor;
                return (
                  <p className="micro-deposit-effect-line" role="note">
                    هذا التغيير سيؤثر على الرصيد كالتالي: «مال مالك» يرفع مال المالك{" "}
                    <MoneyValue minor={classifyAmount ?? unclassifiedMinor} className="micro-inline-number" />{" "}
                    د.أ بلا أي أثر على نتيجة الفترة؛ و«إيراد مشروع» يضيف{" "}
                    <MoneyValue minor={classifyAmount ?? unclassifiedMinor} className="micro-inline-number" />{" "}
                    د.أ إلى نتيجة فترة القرار بلا كاش جديد (الكاش قُبض سابقًا). كلاهما قابل للتصحيح الموثق
                    لاحقًا.
                    {(order.depositClassifiedOwnerMinor ?? 0) > 0 ||
                    (order.depositClassifiedRevenueMinor ?? 0) > 0 ? (
                      <small>
                        {" "}
                        المصنَّف سابقًا:{" "}
                        <MoneyValue
                          minor={order.depositClassifiedOwnerMinor ?? 0}
                          className="micro-inline-number"
                        />{" "}
                        مال مالك و{" "}
                        <MoneyValue
                          minor={order.depositClassifiedRevenueMinor ?? 0}
                          className="micro-inline-number"
                        />{" "}
                        إيراد — والمعلق{" "}
                        <MoneyValue minor={unclassifiedMinor} className="micro-inline-number" /> د.أ بانتظار
                        هذا القرار.
                      </small>
                    ) : null}
                  </p>
                );
              })()}
              {(() => {
                const retainedMinor = order.depositRetainedMinor ?? order.depositCollectedMinor;
                const classifiedMinor =
                  (order.depositClassifiedOwnerMinor ?? 0) + (order.depositClassifiedRevenueMinor ?? 0);
                const unclassifiedMinor = retainedMinor - classifiedMinor;
                return (
                  <label className="micro-field">
                    <span>
                      مبلغ التصنيف <small>اختياري — الافتراضي كامل غير المصنَّف</small>
                    </span>
                    <EnglishNumberInput
                      value={classifyAmount ?? unclassifiedMinor}
                      kind="money"
                      onNumericChange={value => setClassifyAmount(value)}
                    />
                  </label>
                );
              })()}
              <label className="micro-field">
                <span>سبب التصنيف (مطلوب عند الاختيار)</span>
                <input
                  value={classifyReason}
                  onChange={event => setClassifyReason(event.target.value)}
                  placeholder="مثال: العميل تنازل عن العربون مقابل الإلغاء"
                />
              </label>
              <div className="micro-form-actions micro-contextual-actions">
                <button
                  className="micro-button micro-button-primary"
                  type="button"
                  disabled={isActing || !classifyReason.trim()}
                  onClick={() => void classifyDeposit("owner", classifyReason)}
                >
                  مال مالك
                </button>
                <button
                  className="micro-button micro-button-secondary"
                  type="button"
                  disabled={isActing || !classifyReason.trim()}
                  onClick={() => void classifyDeposit("revenue", classifyReason)}
                >
                  إيراد مشروع
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                {order.retainedMeaning === "owner" ? (
                  "صُنّف مال مالك — يظهر في مال المالك، وتسحبه وقتما تشاء بلا إيراد جديد."
                ) : order.retainedMeaning === "mixed" ? (
                  <>صُنّف مختلطًا — جزء مال مالك وجزء إيراد مشروع بمبلغين موثقين؛ راجع سجل الأحداث.</>
                ) : (
                  "صُنّف إيراد مشروع — يُعترف به مرة واحدة في نتيجة فترة القرار، لا كاش جديد."
                )}
              </p>
              <button
                className="micro-text-action"
                type="button"
                aria-expanded={classifyMeaning !== null}
                onClick={() => setClassifyMeaning(current => (current === null ? "revenue" : null))}
              >
                صحِّح التصنيف بقرار موثق
              </button>
              {classifyMeaning !== null ? (
                <div className="micro-revision-form">
                  {/* أزرار الاختيار داخل fieldset لا label — الاسم المتاح لكل زر
                   * يبقى نصه، والتسمية الشاملة عبر legend (و٩: إمكانية الوصول). */}
                  <fieldset className="micro-field">
                    <legend>التصنيف الجديد</legend>
                    <div className="micro-choice-row">
                      <button
                        className={`micro-button ${classifyMeaning === "owner" ? "micro-button-primary" : "micro-button-secondary"}`}
                        type="button"
                        onClick={() => setClassifyMeaning("owner")}
                      >
                        مال مالك
                      </button>
                      <button
                        className={`micro-button ${classifyMeaning === "revenue" ? "micro-button-primary" : "micro-button-secondary"}`}
                        type="button"
                        onClick={() => setClassifyMeaning("revenue")}
                      >
                        إيراد مشروع
                      </button>
                    </div>
                  </fieldset>
                  <label className="micro-field">
                    <span>سبب التصحيح (مطلوب)</span>
                    <input
                      value={classifyReason}
                      onChange={event => setClassifyReason(event.target.value)}
                      placeholder="مثال: القرار الأول كان متسرعًا"
                    />
                  </label>
                  <div className="micro-form-actions">
                    <button
                      className="micro-button micro-button-primary"
                      type="button"
                      disabled={isActing || !classifyReason.trim()}
                      onClick={() => void reclassifyDeposit(classifyMeaning, classifyReason)}
                    >
                      احفظ التصحيح الموثق
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
