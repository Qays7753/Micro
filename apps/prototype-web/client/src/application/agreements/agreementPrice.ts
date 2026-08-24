export function startAgreementPrice(): number | null {
  return null;
}

export function applyProtectionPriceAsStart(protectionPriceMinor: number | null): number | null {
  return protectionPriceMinor;
}

export function agreementPriceIsReady(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value > 0;
}
