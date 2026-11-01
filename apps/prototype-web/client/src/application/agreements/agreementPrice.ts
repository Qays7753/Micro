export function startAgreementPrice(): number | null {
  return null;
}

export function applyProtectionPriceAsStart(protectionPriceMinor: number | null): number | null {
  return protectionPriceMinor;
}

export function agreementPriceIsReady(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value > 0;
}

export function protectionPriceIsReadyForAgreement(
  protectionPriceMinor: number | null,
  knowledgeState: string | null | undefined,
): protectionPriceMinor is number {
  return (
    agreementPriceIsReady(protectionPriceMinor) &&
    knowledgeState !== "incomplete" &&
    knowledgeState !== "partial"
  );
}

/* S12 (UNIT-009 A2/س8 + B4 — أمر 2e645802): أجزاء ملخص الاتفاق الملاصق
 * للفعل — القيمة المسجلة والمستلم مقدمًا والمتبقي؛ اشتقاق المتبقي مالٌ
 * فيحسب هنا عند صاحبه التطبيقي لا في الواجهة (عائلة F-049 المجمدة). */
export type AgreementSummaryParts = {
  recordedValueMinor: number;
  receivedAdvanceMinor: number;
  remainingMinor: number;
};

export function agreementSummaryParts(input: {
  priceMinor: number;
  depositMinor: number | null;
}): AgreementSummaryParts {
  const receivedAdvanceMinor = input.depositMinor ?? 0;
  return {
    recordedValueMinor: input.priceMinor,
    receivedAdvanceMinor,
    remainingMinor: input.priceMinor - receivedAdvanceMinor,
  };
}
