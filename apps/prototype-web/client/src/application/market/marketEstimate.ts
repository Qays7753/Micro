/**
 * EX-D18 — تقدير قيمة المادة (عقد 25 §3-ب): حساب صافٍ بأعداد BigInt فقط،
 * بلا Float وبلا أي كتابة مالية. التقدير غير ملزم وعرضي حصرًا، وقيمته
 * النهائية تقرّب نصفيًا للأعلى إلى 0.001 د.أ.
 */

export interface EstimateInput {
  mode: "fixed" | "tiered" | "quote_required";
  /** الكمية المطلوبة بالملي وحدة (×1000). */
  requestedMilli: string;
  /** السعر الثابت بالمايكرو دينار (×1,000,000). */
  priceMicroJod?: string;
  /** عدد الوحدات التي يغطيها السعر المعلن. */
  basisUnits?: string;
  tiers?: { minQuantityMilli: string; priceMicroJod: string }[];
}

export interface EstimateResult {
  kind: "estimated" | "needs_quote";
  /** التقدير بالمايكرو دينار مقربًا إلى 0.001 د.أ (مضاعف 1000). */
  totalMicroJod?: string;
  /** نص العرض بالدينار بثلاث منازل. */
  displayJod?: string;
}

const MICRO_PER_MILLI_JOD = 1000n; // 0.001 JOD = 1000 micro

export function formatMicroJodAsJod(micro: string): string {
  const value = BigInt(micro);
  const jod = value / 1_000_000n;
  const fraction = value % 1_000_000n;
  const fractionText = fraction.toString().padStart(6, "0").slice(0, 3);
  return `${jod.toString()}.${fractionText}`;
}

/** تقدير المادة: الكمية ÷ أساس السعر × سعر الشريحة المؤهلة، بكسر نصفي واحد. */
export function estimateMaterialValue(input: EstimateInput): EstimateResult {
  if (input.mode === "quote_required") return { kind: "needs_quote" };
  if (input.mode === "fixed") {
    if (input.priceMicroJod === undefined || input.basisUnits === undefined) return { kind: "needs_quote" };
    return estimateFixed(BigInt(input.requestedMilli), BigInt(input.priceMicroJod), BigInt(input.basisUnits));
  }
  const tiers = input.tiers ?? [];
  if (tiers.length === 0) return { kind: "needs_quote" };
  const quantity = BigInt(input.requestedMilli);
  let selected: { minQuantityMilli: string; priceMicroJod: string } | null = null;
  for (const tier of tiers) {
    if (quantity >= BigInt(tier.minQuantityMilli)) selected = tier;
  }
  if (selected === null) return { kind: "needs_quote" };
  // The qualified tier's price applies to the WHOLE quantity (spec §5.3) on
  // the listing's single pricing basis.
  return estimateFixed(quantity, BigInt(selected.priceMicroJod), BigInt(input.basisUnits ?? "1"));
}

function estimateFixed(quantityMilli: bigint, priceMicro: bigint, basisUnits: bigint): EstimateResult {
  if (quantityMilli <= 0n || priceMicro <= 0n || basisUnits <= 0n) return { kind: "needs_quote" };
  // exact micro = quantityMilli × priceMicro ÷ (1000 × basisUnits)
  const numerator = quantityMilli * priceMicro;
  const denominator = MICRO_PER_MILLI_JOD * basisUnits;
  // One half-up rounding to the nearest 0.001 JOD (contract 25 §3-ب):
  // floor((exact + 500) / 1000) × 1000, computed on the common fraction.
  const quotient = (numerator + 500n * denominator) / (MICRO_PER_MILLI_JOD * denominator);
  const rounded = quotient * MICRO_PER_MILLI_JOD;
  return {
    kind: "estimated",
    totalMicroJod: rounded.toString(),
    displayJod: formatMicroJodAsJod(rounded.toString()),
  };
}
