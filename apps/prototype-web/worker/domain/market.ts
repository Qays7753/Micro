/**
 * Market domain (contract 20 + contract 25 §3-ب) — pure validation/state rules.
 * Network money is carried as decimal-digit STRINGS and compared as BigInt:
 * `priceMicroJod` ×1,000,000 (≤ 1,000,000 JOD), quantities ×1,000 (milli).
 * NEVER the Manage financial money type and never a float (OD-14).
 */

import { HttpError } from "../http.ts";

export const JORDAN_GOVERNORATES = [
  "عمان",
  "إربد",
  "الزرقاء",
  "البلقاء",
  "المفرق",
  "العقبة",
  "جرش",
  "عجلون",
  "مادبا",
  "الكرك",
  "الطفيلة",
  "معان",
] as const;

/** Owner-managed category defaults (spec §5.1 base categories). */
export const DEFAULT_CATEGORIES = [
  { id: "packaging", label: "التغليف" },
  { id: "paper", label: "الورق" },
  { id: "fabric", label: "القماش" },
  { id: "panels", label: "الألواح" },
  { id: "food-ingredients", label: "المكونات الغذائية" },
  { id: "construction", label: "البناء" },
] as const;

const MAX_PRICE_MICRO = 1_000_000n * 1_000_000n; // 1,000,000 JOD
const MAX_QUANTITY_MILLI = 1_000_000_000n * 1_000n; // 1,000,000,000 units

export type PriceMode = "fixed" | "tiered" | "quote_required";

export interface PriceBasis {
  /** How many base units the stated price covers (e.g. 12 pieces). */
  units: string;
  unit: string;
}

export interface PriceTier {
  minQuantityMilli: string;
  priceMicroJod: string;
}

export interface ListingPricing {
  mode: PriceMode;
  priceMicroJod?: string;
  basis?: PriceBasis;
  tiers?: PriceTier[];
  quoteReason?: string;
}

export interface ListingQuantity {
  unit: string;
  minQuantityMilli: string;
  stepMilli: string;
  /** Fixed package content in milli-units when the package is not split. */
  packageSizeMilli?: string;
  unpacked: boolean;
}

export function parsePositiveIntegerString(value: unknown, field: string, max: bigint): bigint {
  if (typeof value !== "string" || !/^\d{1,20}$/.test(value)) {
    throw new HttpError(400, "bad_request", { field, reason: "positive_integer_string_required" });
  }
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new HttpError(400, "bad_request", { field, reason: "must_be_positive" });
  if (parsed > max) throw new HttpError(400, "bad_request", { field, reason: "too_large" });
  return parsed;
}

/** Quantity conformance (spec §5.2): ≥ min, multiple of step, package-fit. */
export function conformsToQuantityRules(
  quantity: ListingQuantity,
  requestedMilli: bigint,
): { ok: boolean; nextValidMilli?: string } {
  const min = BigInt(quantity.minQuantityMilli);
  const step = BigInt(quantity.stepMilli);
  if (requestedMilli < min) return { ok: false, nextValidMilli: min.toString() };
  const remainder = (requestedMilli - min) % step;
  if (remainder !== 0n) {
    const next = requestedMilli + (step - remainder);
    return { ok: false, nextValidMilli: next.toString() };
  }
  if (!quantity.unpacked && quantity.packageSizeMilli !== undefined) {
    const packageSize = BigInt(quantity.packageSizeMilli);
    if (packageSize > 0n && requestedMilli % packageSize !== 0n) {
      const packages = (requestedMilli + packageSize - 1n) / packageSize;
      return { ok: false, nextValidMilli: (packages * packageSize).toString() };
    }
  }
  return { ok: true };
}

/** Validate pricing per contract 25 §3-ب (strict, no rounding at rest). */
export function validatePricing(pricing: ListingPricing): void {
  if (pricing.mode === "quote_required") {
    if (typeof pricing.quoteReason !== "string" || pricing.quoteReason.trim().length < 5) {
      throw new HttpError(400, "bad_request", { field: "quoteReason" });
    }
    return;
  }
  if (pricing.mode === "fixed") {
    if (pricing.priceMicroJod === undefined) {
      throw new HttpError(400, "bad_request", { field: "priceMicroJod" });
    }
    parsePositiveIntegerString(pricing.priceMicroJod, "priceMicroJod", MAX_PRICE_MICRO);
    validateBasis(pricing.basis);
    return;
  }
  validateTiers(pricing.tiers ?? []);
}

function validateBasis(basis: PriceBasis | undefined): void {
  if (!basis || basis.units === undefined || typeof basis.unit !== "string" || basis.unit.length === 0) {
    throw new HttpError(400, "bad_request", { field: "priceBasis" });
  }
  parsePositiveIntegerString(basis.units, "priceBasis.units", 1_000_000n);
}

function validateTiers(tiers: PriceTier[]): void {
  if (tiers.length === 0 || tiers.length > 6) {
    throw new HttpError(400, "bad_request", { field: "tiers" });
  }
  let previousBound: bigint | null = null;
  let previousPriceMicro: bigint | null = null;
  for (const tier of tiers) {
    const bound = parsePositiveIntegerString(
      tier.minQuantityMilli,
      "tiers.minQuantityMilli",
      MAX_QUANTITY_MILLI,
    );
    const price = parsePositiveIntegerString(tier.priceMicroJod, "tiers.priceMicroJod", MAX_PRICE_MICRO);
    if (previousBound !== null && bound <= previousBound) {
      throw new HttpError(400, "bad_request", {
        field: "tiers",
        reason: "bounds_must_increase_without_overlap",
      });
    }
    // The larger tier's price must not exceed the smaller tier's price
    // (unit price never increases — spec §5.3).
    if (previousPriceMicro !== null && price > previousPriceMicro) {
      throw new HttpError(400, "bad_request", { field: "tiers", reason: "unit_price_must_not_increase" });
    }
    previousBound = bound;
    previousPriceMicro = price;
  }
}

/** Select the applicable tier for a quantity (largest bound ≤ quantity). */
export function selectTier(tiers: PriceTier[], quantityMilli: bigint): PriceTier {
  let selected: PriceTier | null = null;
  for (const tier of tiers) {
    if (quantityMilli >= BigInt(tier.minQuantityMilli)) selected = tier;
  }
  if (selected === null)
    throw new HttpError(400, "bad_request", { field: "quantity", reason: "below_first_tier" });
  return selected;
}

export type FreshnessState = "fresh" | "needs_confirmation" | "hidden_stale";

/** OD-11: reminder after 30 days, hide after 60 — computed read-time. */
export function freshnessFrom(
  availabilityConfirmedAt: number,
  now: number,
  reminderMs: number,
  hideMs: number,
): FreshnessState {
  const age = now - availabilityConfirmedAt;
  if (age >= hideMs) return "hidden_stale";
  if (age >= reminderMs) return "needs_confirmation";
  return "fresh";
}

/** Vendor-editable vs reviewer-only fields (OD-09 content/numeric split). */
export const DIRECT_UPDATE_FIELDS = ["priceMicroJod", "availabilityStatus"] as const;

export function isDirectUpdateField(field: string): boolean {
  return (DIRECT_UPDATE_FIELDS as readonly string[]).includes(field);
}
