/**
 * المجموعة ١١ (المرحلة 11-C — تفكيك حق المالك): نماذج سياسات حق المالك: إضافة سياسة مستقلة وتعديلها بنسخة جديدة — مقطع عرض مستخرج
 * من صفحة OwnerEntitlement.tsx حرفيًا؛ الصفحة تبقى الموزّع وتمرّر كل شيء
 * خصائصِ أدناه. لا منطق ماليًا هنا — عرض فقط بنفس السلوك.
 */
import { type Dispatch, type SetStateAction } from "react";
import type {
  OwnerEntitlementOpeningBalance,
  OwnerEntitlementPolicy,
  OwnerEntitlementRecord,
  OwnerMovement,
  OwnerMovementReason,
} from "@micro-domain/owner-entitlement/index.js";
import type { OwnerEntitlementOverview } from "@/application/finance/ownerEntitlementService";
import { ArrowRight, Check, HandCoins, Save } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { formatLocalDate, formatMoneyMinor } from "@/presentation/formatters";
import {
  amountPolicyKinds,
  movementReasonLabels,
  ownerMovementReasonsForKind,
  percentagePolicyKinds,
  policyFamilyLabels,
  policyLabels,
  successorPolicyFormRequirements,
  supportedOwnerEntitlementPolicyKinds,
} from "@/presentation/ownerEntitlementPresentation";

export type OwnerPolicyFormsSectionProps = {
  overview: OwnerEntitlementOverview;
  calculation: { amountMinor: number | null; knowledge: string; nextAction: string } | null;
  saving: boolean;
  policyKind: OwnerEntitlementPolicy["kind"];
  setPolicyKind: Dispatch<SetStateAction<OwnerEntitlementPolicy["kind"]>>;
  policyAmount: number;
  setPolicyAmount: Dispatch<SetStateAction<number>>;
  policyAmountValid: boolean;
  setPolicyAmountValid: Dispatch<SetStateAction<boolean>>;
  policyPercentage: number;
  setPolicyPercentage: Dispatch<SetStateAction<number>>;
  policyPercentageValid: boolean;
  setPolicyPercentageValid: Dispatch<SetStateAction<boolean>>;
  policyStartsOn: string;
  setPolicyStartsOn: Dispatch<SetStateAction<string>>;
  policyEndsOn: string;
  setPolicyEndsOn: Dispatch<SetStateAction<string>>;
  policySource: string;
  setPolicySource: Dispatch<SetStateAction<string>>;
  policyNote: string;
  setPolicyNote: Dispatch<SetStateAction<string>>;
  successorPolicyId: string;
  setSuccessorPolicyId: Dispatch<SetStateAction<string>>;
  successorKind: OwnerEntitlementPolicy["kind"];
  setSuccessorKind: Dispatch<SetStateAction<OwnerEntitlementPolicy["kind"]>>;
  successorAmount: number;
  setSuccessorAmount: Dispatch<SetStateAction<number>>;
  successorAmountValid: boolean;
  setSuccessorAmountValid: Dispatch<SetStateAction<boolean>>;
  successorPercentage: number;
  setSuccessorPercentage: Dispatch<SetStateAction<number>>;
  successorPercentageValid: boolean;
  setSuccessorPercentageValid: Dispatch<SetStateAction<boolean>>;
  successorUnitLabel: string;
  setSuccessorUnitLabel: Dispatch<SetStateAction<string>>;
  successorStartsOn: string;
  setSuccessorStartsOn: Dispatch<SetStateAction<string>>;
  successorEndsOn: string;
  setSuccessorEndsOn: Dispatch<SetStateAction<string>>;
  successorSource: string;
  setSuccessorSource: Dispatch<SetStateAction<string>>;
  successorNote: string;
  setSuccessorNote: Dispatch<SetStateAction<string>>;
  successorRequirements: ReturnType<typeof successorPolicyFormRequirements>;
  successorPolicy: OwnerEntitlementPolicy | null;
  savePolicy: () => Promise<void>;
  saveSuccessor: () => Promise<void>;
};

export function OwnerPolicyFormsSection({
  overview,
  calculation,
  saving,
  policyKind,
  setPolicyKind,
  policyAmount,
  setPolicyAmount,
  policyAmountValid,
  setPolicyAmountValid,
  policyPercentage,
  setPolicyPercentage,
  policyPercentageValid,
  setPolicyPercentageValid,
  policyStartsOn,
  setPolicyStartsOn,
  policyEndsOn,
  setPolicyEndsOn,
  policySource,
  setPolicySource,
  policyNote,
  setPolicyNote,
  successorPolicyId,
  setSuccessorPolicyId,
  successorKind,
  setSuccessorKind,
  successorAmount,
  setSuccessorAmount,
  successorAmountValid,
  setSuccessorAmountValid,
  successorPercentage,
  setSuccessorPercentage,
  successorPercentageValid,
  setSuccessorPercentageValid,
  successorUnitLabel,
  setSuccessorUnitLabel,
  successorStartsOn,
  setSuccessorStartsOn,
  successorEndsOn,
  setSuccessorEndsOn,
  successorSource,
  setSuccessorSource,
  successorNote,
  setSuccessorNote,
  successorRequirements,
  successorPolicy,
  savePolicy,
  saveSuccessor,
}: OwnerPolicyFormsSectionProps) {
  return (
    <>
      <details className="micro-owner-layer">
        <summary className="micro-owner-layer-summary">
          <span>
            <b>إضافة سياسة</b>
            <small>أنشئ إصدارًا أولًا مع مصدر وملاحظة</small>
          </span>
          <strong>افتح الإجراء</strong>
        </summary>
        <section className="micro-form-card">
          <div className="micro-section-heading">
            <div>
              <span className="micro-overline">إجراء واضح</span>
              <h2>إضافة سياسة مستقلة</h2>
            </div>
          </div>
          <div className="micro-field-grid">
            <label className="micro-field">
              <span>نوع السياسة</span>
              <select
                value={policyKind}
                onChange={event => {
                  const kind = event.target.value as OwnerEntitlementPolicy["kind"];
                  setPolicyKind(kind);
                }}
              >
                {supportedOwnerEntitlementPolicyKinds.map(kind => (
                  <option key={kind} value={kind}>
                    {policyLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {amountPolicyKinds.has(policyKind) ? (
            <label className="micro-field">
              <span>المبلغ بوحدة الدينار الأردني</span>
              <EnglishNumberInput
                value={policyAmount}
                kind="money"
                onNumericChange={setPolicyAmount}
                onTextValidityChange={setPolicyAmountValid}
                aria-label="مبلغ سياسة حق المالك"
              />
            </label>
          ) : (
            <label className="micro-field">
              <span>النسبة (%)</span>
              <EnglishNumberInput
                value={policyPercentage}
                kind="decimal"
                onNumericChange={setPolicyPercentage}
                onTextValidityChange={setPolicyPercentageValid}
                aria-label="نسبة سياسة حق المالك"
              />
              <small>
                تُحفظ النسبة كما أدخلتها بدقة كاملة، وتحسب من نتيجة الفترة المسجلة أو البيع المكتمل حسب النوع.
              </small>
            </label>
          )}
          <div className="micro-field-grid">
            <LocalDateField
              label="تاريخ البداية المحلي"
              value={policyStartsOn}
              onChange={event => setPolicyStartsOn(event.target.value)}
            />
            <LocalDateField
              label="تاريخ النهاية المعلن"
              description="اتركه فارغًا للسياسات المستمرة، أما المبلغ الثابت للفترة فيحتاج نهاية صريحة."
              value={policyEndsOn}
              onChange={event => setPolicyEndsOn(event.target.value)}
            />
          </div>
          {policyKind === "per_unit" || policyKind === "per_completed_work" ? (
            <label className="micro-field">
              <span>الوحدة</span>
              <input value="وحدة/عمل" readOnly />
            </label>
          ) : null}
          <label className="micro-field">
            <span>
              مصدر السياسة <small>مطلوب</small>
            </span>
            <input
              value={policySource}
              onChange={event => setPolicySource(event.target.value)}
              placeholder="مثال: اتفاق مالك المشروع"
            />
          </label>
          <label className="micro-field">
            <span>
              ملاحظة السياسة <small>مطلوب</small>
            </span>
            <textarea
              value={policyNote}
              onChange={event => setPolicyNote(event.target.value)}
              placeholder="ما الذي يغطيه هذا الحق؟"
            />
          </label>
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={saving}
            onClick={() => void savePolicy()}
          >
            <Save aria-hidden="true" /> حفظ سياسة مستقلة
          </button>
        </section>
      </details>
      <details className="micro-owner-layer">
        <summary className="micro-owner-layer-summary">
          <span>
            <b>تعديل سياسة</b>
            <small>نسخة جديدة تبدأ من تاريخ؛ الحقوق السابقة تبقى كما هي</small>
          </span>
          <strong>افتح الإجراء</strong>
        </summary>
        <section className="micro-form-card">
          <div className="micro-section-heading">
            <div>
              <span className="micro-overline">تعديل غير رجعي</span>
              <h2>تعديل سياسة من تاريخ جديد</h2>
            </div>
          </div>
          <p>
            تنتهي النسخة السابقة في اليوم السابق لتاريخ النفاذ، وتنشأ نسخة جديدة بإعداداتك الجديدة.{" "}
            <strong>لا تتغير الحقوق المسجلة سابقًا.</strong>
          </p>
          <label className="micro-field">
            <span>السياسة الفعالة المصدر</span>
            <select value={successorPolicyId} onChange={event => setSuccessorPolicyId(event.target.value)}>
              <option value="">اختر سياسة فعالة</option>
              {overview.activePolicies.map(policy => (
                <option key={policy.id} value={policy.id}>
                  {policyLabels[policy.kind]} · إصدار {policy.version} · تبدأ{" "}
                  {formatLocalDate(policy.startsOn)}
                </option>
              ))}
            </select>
          </label>
          {successorPolicy ? (
            <div className="micro-owner-calculation">
              <strong>ملخص النسخة السابقة</strong>
              <p>
                {policyLabels[successorPolicy.kind]} ·{" "}
                {successorPolicy.amountMinor === null
                  ? `${(successorPolicy.percentageBps ?? 0) / 100}%`
                  : `${formatMoneyMinor(successorPolicy.amountMinor)} د.أ`}{" "}
                · {policyFamilyLabels[successorPolicy.family]}
              </p>
              <small>
                سيبقى الإصدار {successorPolicy.version} وحقوقه الماضية ومعرّفاتها ومبالغها كما هي.
              </small>
            </div>
          ) : null}
          <div className="micro-field-grid">
            <LocalDateField
              label="تاريخ بدء النسخة الجديدة"
              description="يبدأ أثر الإعداد الجديد من هذا التاريخ فقط."
              value={successorStartsOn}
              onChange={event => setSuccessorStartsOn(event.target.value)}
            />
            <label className="micro-field">
              <span>نوع النسخة الجديدة</span>
              <select
                value={successorKind}
                onChange={event => {
                  const kind = event.target.value as OwnerEntitlementPolicy["kind"];
                  setSuccessorKind(kind);
                  if (kind !== "fixed_period") setSuccessorEndsOn("");
                  if (kind !== "per_unit" && kind !== "per_completed_work") setSuccessorUnitLabel("");
                }}
              >
                {supportedOwnerEntitlementPolicyKinds.map(kind => (
                  <option key={kind} value={kind}>
                    {policyLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {successorRequirements.valueKind === "amount" ? (
            <label className="micro-field">
              <span>مبلغ النسخة الجديدة بوحدة الدينار الأردني</span>
              <EnglishNumberInput
                value={successorAmount}
                kind="money"
                onNumericChange={setSuccessorAmount}
                onTextValidityChange={setSuccessorAmountValid}
                aria-label="مبلغ النسخة الجديدة لسياسة حق المالك"
              />
            </label>
          ) : (
            <label className="micro-field">
              <span>نسبة النسخة الجديدة (%)</span>
              <EnglishNumberInput
                value={successorPercentage}
                kind="decimal"
                onNumericChange={setSuccessorPercentage}
                onTextValidityChange={setSuccessorPercentageValid}
                aria-label="نسبة النسخة الجديدة لسياسة حق المالك"
              />
              <small>تحسب من نتيجة الفترة المسجلة أو من بيع مكتمل حسب النوع، لا من العربون أو الكاش.</small>
            </label>
          )}
          {successorRequirements.requiresUnit ? (
            <label className="micro-field">
              <span>
                الوحدة أو تعريف العمل <small>مطلوب</small>
              </span>
              <input
                value={successorUnitLabel}
                onChange={event => setSuccessorUnitLabel(event.target.value)}
                placeholder="مثال: قطعة مكتملة أو طلب خدمة"
              />
              <small>يجب أن يصف هذا الحقل دليل المصدر؛ لا يسجل النظام صفرًا عند غيابه.</small>
            </label>
          ) : null}
          {successorRequirements.requiresEndDate ? (
            <LocalDateField
              label="نهاية نطاق النسخة الجديدة"
              description="مطلوبة. المبلغ الثابت للفترة يحتاج نطاقًا معلنًا كاملًا."
              value={successorEndsOn}
              onChange={event => setSuccessorEndsOn(event.target.value)}
            />
          ) : null}
          <label className="micro-field">
            <span>
              سبب التعديل <small>مطلوب</small>
            </span>
            <input
              value={successorSource}
              onChange={event => setSuccessorSource(event.target.value)}
              placeholder="مثال: تعديل الاتفاق من بداية 09/2026"
            />
          </label>
          <label className="micro-field">
            <span>
              ملاحظة النسخة الجديدة <small>مطلوبة</small>
            </span>
            <textarea
              value={successorNote}
              onChange={event => setSuccessorNote(event.target.value)}
              placeholder="ما الذي تغير في المبلغ أو النوع أو النطاق؟"
            />
          </label>
          <p className="micro-decision-next">
            النتيجة: النسخة الجديدة تحفظ إعدادات مختلفة عند الحاجة، والحقوق التاريخية لا يعاد احتسابها. إذا
            احتاج النوع دليل وقت أو وحدة أو وردية غير موجود، سيبقى غير متاح بدل التخمين.
          </p>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            disabled={saving || !successorPolicy}
            onClick={() => void saveSuccessor()}
          >
            حفظ التعديل وإنهاء السابقة
          </button>
        </section>
      </details>
    </>
  );
}
