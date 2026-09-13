/**
 * المجموعة ١١ (المرحلة 11-C — تفكيك حق المالك): نماذج الدفاتر: تسجيل الحق والرصيد الافتتاحي والإرجاع/التسوية — مقطع عرض مستخرج
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
import { ArrowRight, Check, HandCoins, Save, WalletCards } from "lucide-react";
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

export type OwnerLedgerFormsSectionProps = {
  overview: OwnerEntitlementOverview;
  calculation: { amountMinor: number | null; knowledge: string; nextAction: string } | null;
  saving: boolean;
  selectedPolicyId: string;
  setSelectedPolicyId: Dispatch<SetStateAction<string>>;
  periodFrom: string;
  setPeriodFrom: Dispatch<SetStateAction<string>>;
  periodTo: string;
  setPeriodTo: Dispatch<SetStateAction<string>>;
  entitlementDate: string;
  setEntitlementDate: Dispatch<SetStateAction<string>>;
  entitlementNote: string;
  setEntitlementNote: Dispatch<SetStateAction<string>>;
  openingAmount: number | null;
  setOpeningAmount: Dispatch<SetStateAction<number | null>>;
  openingAmountValid: boolean;
  setOpeningAmountValid: Dispatch<SetStateAction<boolean>>;
  openingDate: string;
  setOpeningDate: Dispatch<SetStateAction<string>>;
  openingReason: string;
  setOpeningReason: Dispatch<SetStateAction<string>>;
  openingNote: string;
  setOpeningNote: Dispatch<SetStateAction<string>>;
  movementKind: "draw" | "return";
  setMovementKind: Dispatch<SetStateAction<"draw" | "return">>;
  movementReason: OwnerMovementReason;
  setMovementReason: Dispatch<SetStateAction<OwnerMovementReason>>;
  movementAmount: number;
  setMovementAmount: Dispatch<SetStateAction<number>>;
  movementAmountValid: boolean;
  setMovementAmountValid: Dispatch<SetStateAction<boolean>>;
  movementWalletId: string;
  setMovementWalletId: Dispatch<SetStateAction<string>>;
  movementDate: string;
  setMovementDate: Dispatch<SetStateAction<string>>;
  movementNote: string;
  setMovementNote: Dispatch<SetStateAction<string>>;
  activeEntitlements: readonly OwnerEntitlementRecord[];
  relatedEntitlementId: string;
  setRelatedEntitlementId: Dispatch<SetStateAction<string>>;
  relatedMovementId: string;
  setRelatedMovementId: Dispatch<SetStateAction<string>>;
  relatedOpeningBalanceId: string;
  setRelatedOpeningBalanceId: Dispatch<SetStateAction<string>>;
  activeOpeningBalances: readonly OwnerEntitlementOpeningBalance[];
  priorDraws: readonly OwnerMovement[];
  reasonOptions: readonly OwnerMovementReason[];
  saveEntitlement: () => Promise<void>;
  saveOpeningBalance: () => Promise<void>;
  saveMovement: () => Promise<void>;
};

export function OwnerLedgerFormsSection({
  overview,
  calculation,
  saving,
  selectedPolicyId,
  setSelectedPolicyId,
  periodFrom,
  setPeriodFrom,
  periodTo,
  setPeriodTo,
  entitlementDate,
  setEntitlementDate,
  entitlementNote,
  setEntitlementNote,
  openingAmount,
  setOpeningAmount,
  openingAmountValid,
  setOpeningAmountValid,
  openingDate,
  setOpeningDate,
  openingReason,
  setOpeningReason,
  openingNote,
  setOpeningNote,
  movementKind,
  setMovementKind,
  movementReason,
  setMovementReason,
  movementAmount,
  setMovementAmount,
  movementAmountValid,
  setMovementAmountValid,
  movementWalletId,
  setMovementWalletId,
  movementDate,
  setMovementDate,
  movementNote,
  setMovementNote,
  activeEntitlements,
  relatedEntitlementId,
  setRelatedEntitlementId,
  relatedMovementId,
  setRelatedMovementId,
  relatedOpeningBalanceId,
  setRelatedOpeningBalanceId,
  activeOpeningBalances,
  priorDraws,
  reasonOptions,
  saveEntitlement,
  saveOpeningBalance,
  saveMovement,
}: OwnerLedgerFormsSectionProps) {
  return (
    <>
      <details className="micro-owner-layer">
        <summary className="micro-owner-layer-summary">
          <span>
            <b>تسجيل حق</b>
            <small>حق المالك لا يقبض المال ولا يغيّر الكاش</small>
          </span>
          <strong>افتح الإجراء</strong>
        </summary>
        <section className="micro-form-card">
          <div className="micro-section-heading">
            <div>
              <span className="micro-overline">حق مستقل</span>
              <h2>تسجيل حق المالك</h2>
            </div>
          </div>
          <p>
            تسجيل الحق لا يقبض مالًا ولا يغير محفظة الكاش. لا يُسجل الحق نفسه للفترة نفسها مرتين؛ تراجع عن
            السجل فقط إذا كان خطأ.
          </p>
          <label className="micro-field">
            <span>السياسة المصدر</span>
            <select value={selectedPolicyId} onChange={event => setSelectedPolicyId(event.target.value)}>
              <option value="">اختر سياسة</option>
              {overview.policies.map(policy => (
                <option key={policy.id} value={policy.id}>
                  {policyLabels[policy.kind]} · إصدار {policy.version} · تبدأ{" "}
                  {formatLocalDate(policy.startsOn)}
                </option>
              ))}
            </select>
          </label>
          <div className="micro-field-grid">
            <LocalDateField
              label="من الفترة"
              value={periodFrom}
              onChange={event => setPeriodFrom(event.target.value)}
            />
            <LocalDateField
              label="إلى الفترة"
              value={periodTo}
              onChange={event => setPeriodTo(event.target.value)}
            />
          </div>
          <div
            className="micro-owner-calculation"
            data-known={calculation?.amountMinor !== null && calculation?.amountMinor !== undefined}
          >
            {calculation?.amountMinor === null || !calculation ? (
              <>
                <strong>الحق غير متاح بعد</strong>
                <p>{calculation?.nextAction ?? "اختر سياسة وفترة صحيحتين."}</p>
              </>
            ) : (
              <>
                <strong>
                  الحق المقترح: <bdi dir="ltr">{formatMoneyMinor(calculation.amountMinor)}</bdi> د.أ
                </strong>
                <p>
                  الحالة: {calculation.knowledge === "known" ? "معروف" : "جزئي/يحتاج مراجعة"}. راجع المصدر قبل
                  التسجيل.
                </p>
                <p>{calculation.nextAction}</p>
              </>
            )}
          </div>
          <LocalDateField
            label="تاريخ تسجيل الحق"
            value={entitlementDate}
            onChange={event => setEntitlementDate(event.target.value)}
          />
          <label className="micro-field">
            <span>
              ملاحظة الحق <small>مطلوبة</small>
            </span>
            <textarea
              value={entitlementNote}
              onChange={event => setEntitlementNote(event.target.value)}
              placeholder="مثال: حق شهر 08/2026 حسب السياسة 1"
            />
          </label>
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={saving || !calculation || calculation.amountMinor === null}
            onClick={() => void saveEntitlement()}
          >
            <HandCoins aria-hidden="true" /> تسجيل الحق دون قبض
          </button>
        </section>
      </details>
      <details className="micro-owner-layer">
        <summary className="micro-owner-layer-summary">
          <span>
            <b>رصيد افتتاحي</b>
            <small>سجل مصدرًا قديمًا قابلًا للتسوية أو التراجع</small>
          </span>
          <strong>افتح الإجراء</strong>
        </summary>
        <section className="micro-form-card">
          <div className="micro-section-heading">
            <div>
              <span className="micro-overline">مصدر قابل للتسوية</span>
              <h2>إضافة رصيد افتتاحي</h2>
            </div>
          </div>
          <p>
            هذه طبقة افتتاحية اختيارية بإشارة موجبة أو سالبة، مع سبب وملاحظة. لا تنشئ حركة ماضية، ويمكن
            تسويتها أو التراجع عنها صراحة.
          </p>
          <div className="micro-field-grid">
            <label className="micro-field">
              <span>الرصيد بوحدة الدينار الأردني</span>
              <EnglishNumberInput
                value={openingAmount}
                kind="signedInteger"
                onNumericChange={setOpeningAmount}
                onTextValidityChange={setOpeningAmountValid}
                onEmptyChange={() => setOpeningAmount(null)}
                allowEmpty
                placeholder="مثال: 1500 أو -500"
                aria-label="الرصيد الافتتاحي الموقّع"
              />
              <small>
                الموجب: المشروع مدين لك ويمكن تسويته بسحب. السالب: سحوبات سابقة أكثر ويمكن تسويته بإرجاع.
              </small>
            </label>
            <LocalDateField
              label="التاريخ المحلي"
              value={openingDate}
              onChange={event => setOpeningDate(event.target.value)}
            />
          </div>
          <label className="micro-field">
            <span>
              السبب <small>مطلوب</small>
            </span>
            <input
              value={openingReason}
              onChange={event => setOpeningReason(event.target.value)}
              placeholder="مثال: رصيد دفتر سابق موثق"
            />
          </label>
          <label className="micro-field">
            <span>
              ملاحظة <small>مطلوبة</small>
            </span>
            <textarea
              value={openingNote}
              onChange={event => setOpeningNote(event.target.value)}
              placeholder="اشرح مصدر الرصيد الافتتاحي"
            />
          </label>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            disabled={saving}
            onClick={() => void saveOpeningBalance()}
          >
            حفظ الرصيد الافتتاحي
          </button>
        </section>
      </details>
      <details className="micro-owner-layer">
        <summary className="micro-owner-layer-summary">
          <span>
            <b>إرجاع أو تسوية دفتر</b>
            <small>عمليات مرتبطة بسجلات الدفتر: تسوية محددة أو إرجاع، بمحفظة معينة</small>
          </span>
          <strong>افتح الإجراء</strong>
        </summary>
        <section className="micro-form-card">
          <div className="micro-section-heading">
            <div>
              <span className="micro-overline">يغير الكاش فعليًا</span>
              <h2>تسجيل إرجاع أو تسوية</h2>
            </div>
          </div>
          <p>
            السحب الشخصي العادي له مدخل واحد من «مالي» — «سجل سحبًا شخصيًا». ما هنا مرتبط بسجلات الدفتر: تسوية
            حق أو رصيد محدد، إرجاع سحب سابق، أو حقن رأس مال جديد. كل حركة تحتاج محفظة وسببًا وملاحظة، والسحب
            ليس مصروف تشغيل، والإرجاع كرأس مال جديد لا يسوي الحق.
          </p>
          <div className="micro-field-grid">
            <label className="micro-field">
              <span>نوع الحركة</span>
              <select
                value={movementKind}
                onChange={event => setMovementKind(event.target.value as "draw" | "return")}
              >
                <option value="draw">سحب فعلي</option>
                <option value="return">إرجاع فعلي</option>
              </select>
            </label>
            <label className="micro-field">
              <span>المبلغ بوحدة الدينار الأردني</span>
              <EnglishNumberInput
                value={movementAmount}
                kind="money"
                onNumericChange={setMovementAmount}
                onTextValidityChange={setMovementAmountValid}
                aria-label="مبلغ حركة المالك"
              />
            </label>
          </div>
          <label className="micro-field">
            <span>السبب</span>
            <select
              value={movementReason}
              onChange={event => setMovementReason(event.target.value as OwnerMovementReason)}
            >
              {reasonOptions.map(reason => (
                <option key={reason} value={reason}>
                  {movementReasonLabels[reason]}
                </option>
              ))}
            </select>
          </label>
          {movementReason === "entitlement_settlement" ? (
            <label className="micro-field">
              <span>الحق الذي تتم تسويته</span>
              <select
                value={relatedEntitlementId}
                onChange={event => setRelatedEntitlementId(event.target.value)}
              >
                <option value="">اختر حقًا مسجلًا</option>
                {activeEntitlements.map(record => (
                  <option key={record.id} value={record.id}>
                    <bdi dir="ltr">{formatLocalDate(record.occurredOn)}</bdi> ·{" "}
                    {formatMoneyMinor(record.amountMinor)} د.أ · {record.note}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {movementReason === "opening_balance_settlement" ? (
            <label className="micro-field">
              <span>الرصيد الافتتاحي المصدر</span>
              <select
                value={relatedOpeningBalanceId}
                onChange={event => setRelatedOpeningBalanceId(event.target.value)}
              >
                <option value="">اختر رصيدًا افتتاحيًا</option>
                {activeOpeningBalances
                  .filter(balance =>
                    movementKind === "draw" ? balance.amountMinor > 0 : balance.amountMinor < 0,
                  )
                  .map(balance => (
                    <option key={balance.id} value={balance.id}>
                      <bdi dir="ltr">{formatLocalDate(balance.occurredOn)}</bdi> ·{" "}
                      {formatMoneyMinor(balance.amountMinor)} د.أ · {balance.note}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {movementReason === "settlement_of_prior_draw" ? (
            <label className="micro-field">
              <span>السحب السابق الذي تعيده</span>
              <select value={relatedMovementId} onChange={event => setRelatedMovementId(event.target.value)}>
                <option value="">اختر سحبًا سابقًا</option>
                {priorDraws.map(movement => (
                  <option key={movement.id} value={movement.id}>
                    <bdi dir="ltr">{formatLocalDate(movement.occurredOn)}</bdi> ·{" "}
                    {formatMoneyMinor(movement.amountMinor)} د.أ · {movement.note}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="micro-field">
            <span>محفظة الكاش</span>
            <select value={movementWalletId} onChange={event => setMovementWalletId(event.target.value)}>
              <option value="">اختر محفظة</option>
              {overview.walletBalances.map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} · الرصيد {formatMoneyMinor(wallet.balanceMinor)} د.أ
                </option>
              ))}
            </select>
          </label>
          <LocalDateField
            label="تاريخ الحركة"
            value={movementDate}
            onChange={event => setMovementDate(event.target.value)}
          />
          <label className="micro-field">
            <span>
              ملاحظة الحركة <small>مطلوبة</small>
            </span>
            <textarea
              value={movementNote}
              onChange={event => setMovementNote(event.target.value)}
              placeholder="مثال: سحبت مبلغًا لتسوية حق آب"
            />
          </label>
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={saving}
            onClick={() => void saveMovement()}
          >
            <WalletCards aria-hidden="true" /> حفظ الحركة وأثر الكاش
          </button>
        </section>
      </details>
    </>
  );
}
