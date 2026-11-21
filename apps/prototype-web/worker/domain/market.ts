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

/**
 * Hierarchical market categories (final decision Q49/Q146 — two levels, main +
 * sub, built on small-project types). The tree lives in network_settings
 * ('market.categories', admin-managed); this is the reviewed default. Sub ids
 * are globally unique so `supplier_listing.category` can hold either a main id
 * (listing declared at the main level) or a sub id without ambiguity.
 */
export interface CategoryNode {
  id: string;
  label: string;
  sub: { id: string; label: string }[];
}

export const DEFAULT_CATEGORY_TREE: CategoryNode[] = [
  {
    id: "packaging",
    label: "التغليف",
    sub: [
      { id: "packaging-cups", label: "أكواب وأوعية" },
      { id: "packaging-bags", label: "أكياس وشرنك" },
      { id: "packaging-labels", label: "ملصقات وطباعة تغليف" },
    ],
  },
  {
    id: "paper",
    label: "الورق والمطبوعات",
    sub: [
      { id: "paper-wrap", label: "ورق تغليف" },
      { id: "paper-print", label: "مطبوعات وتصاميم" },
    ],
  },
  {
    id: "fabric",
    label: "الأقمشة والخياطة",
    sub: [
      { id: "fabric-textiles", label: "أقمشة" },
      { id: "fabric-sewing", label: "إكسسوارات خياطة" },
    ],
  },
  {
    id: "panels",
    label: "الألواح والنجارة",
    sub: [
      { id: "panels-wood", label: "ألواح خشبية" },
      { id: "panels-tools", label: "أدوات نجارة" },
    ],
  },
  {
    id: "food-ingredients",
    label: "المكونات الغذائية",
    sub: [
      { id: "food-base", label: "مواد أساسية" },
      { id: "food-spices", label: "توابل وإضافات" },
    ],
  },
  {
    id: "construction",
    label: "البناء والتشطيبات",
    sub: [
      { id: "construction-materials", label: "مواد بناء" },
      { id: "construction-finish", label: "دهانات وأدوات تشطيب" },
    ],
  },
];

/** Bounded admin-editable tree (Q146): ≤ 20 mains, ≤ 8 subs per main. */
export const CATEGORY_TREE_MAX_MAINS = 20;
export const CATEGORY_TREE_MAX_SUBS = 8;
const CATEGORY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/;

/** Validate an admin-proposed category tree (two levels, unique ids/labels). */
export function validateCategoryTree(tree: unknown): CategoryNode[] {
  if (!Array.isArray(tree) || tree.length === 0 || tree.length > CATEGORY_TREE_MAX_MAINS) {
    throw new HttpError(400, "bad_request", { field: "categories", reason: "main_count_out_of_bounds" });
  }
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  for (const main of tree) {
    if (main === null || typeof main !== "object") {
      throw new HttpError(400, "bad_request", { field: "categories", reason: "main_must_be_object" });
    }
    const node = main as Partial<CategoryNode>;
    if (typeof node.id !== "string" || !CATEGORY_ID_PATTERN.test(node.id)) {
      throw new HttpError(400, "bad_request", { field: "categories", reason: "invalid_main_id" });
    }
    if (typeof node.label !== "string" || node.label.trim().length < 2 || node.label.trim().length > 60) {
      throw new HttpError(400, "bad_request", { field: "categories", reason: "invalid_main_label" });
    }
    if (seenIds.has(node.id)) {
      throw new HttpError(400, "bad_request", { field: "categories", reason: "duplicate_id" });
    }
    seenIds.add(node.id);
    const mainLabel = node.label.trim();
    if (seenLabels.has(mainLabel)) {
      throw new HttpError(400, "bad_request", { field: "categories", reason: "duplicate_label" });
    }
    seenLabels.add(mainLabel);
    if (!Array.isArray(node.sub) || node.sub.length > CATEGORY_TREE_MAX_SUBS) {
      throw new HttpError(400, "bad_request", { field: "categories", reason: "sub_count_out_of_bounds" });
    }
    for (const sub of node.sub) {
      if (sub === null || typeof sub !== "object") {
        throw new HttpError(400, "bad_request", { field: "categories", reason: "sub_must_be_object" });
      }
      const subNode = sub as Partial<{ id: string; label: string }>;
      if (typeof subNode.id !== "string" || !CATEGORY_ID_PATTERN.test(subNode.id)) {
        throw new HttpError(400, "bad_request", { field: "categories", reason: "invalid_sub_id" });
      }
      if (
        typeof subNode.label !== "string" ||
        subNode.label.trim().length < 2 ||
        subNode.label.trim().length > 60
      ) {
        throw new HttpError(400, "bad_request", { field: "categories", reason: "invalid_sub_label" });
      }
      if (seenIds.has(subNode.id)) {
        throw new HttpError(400, "bad_request", { field: "categories", reason: "duplicate_id" });
      }
      seenIds.add(subNode.id);
      const subLabel = subNode.label.trim();
      if (seenLabels.has(subLabel)) {
        throw new HttpError(400, "bad_request", { field: "categories", reason: "duplicate_label" });
      }
      seenLabels.add(subLabel);
    }
  }
  // Normalize to the canonical stored shape (trimmed labels, sub always []).
  const canonical = tree as CategoryNode[];
  return canonical.map(main => ({
    id: main.id,
    label: main.label.trim(),
    sub: (main.sub ?? []).map((sub: { id: string; label: string }) => ({
      id: sub.id,
      label: sub.label.trim(),
    })),
  }));
}

/** All category ids in the tree (mains + subs) — validation set for listings. */
export function flattenCategoryIds(tree: CategoryNode[]): Set<string> {
  const ids = new Set<string>();
  for (const main of tree) {
    ids.add(main.id);
    for (const sub of main.sub) ids.add(sub.id);
  }
  return ids;
}

/**
 * The ids a browse filter on a main category must match (the main itself — for
 * listings declared at main level — plus every sub under it).
 */
export function categoryIdsUnderMain(tree: CategoryNode[], mainId: string): string[] {
  const main = tree.find(entry => entry.id === mainId);
  if (!main) return [mainId];
  return [main.id, ...main.sub.map(sub => sub.id)];
}

/** Supplier types (final decision Q49/Q146 filter set) — browse filter values. */
export const SUPPLIER_TYPES = ["manufacturer", "wholesale", "importer", "shop"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

/** Supplier delivery declaration (final decision Q49/Q146: يوصّل أو استلام فقط). */
export const DELIVERY_OPTIONS = ["delivery", "pickup_only"] as const;
export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];

/** Versioned supplier terms (final decision د-10: a recorded, versioned consent). */
export const SUPPLIER_TERMS_VERSION = "2026-11-21";

/**
 * Product variants (final decision Q38: حجم/لون/نوع — each option carries its
 * own price, minimum order quantity, and availability; hard cap 20 options).
 * Variants are REVIEW-SCOPE content: they live in the listing work/public copy
 * and change through the listing review flow, never through OD-09 direct
 * updates (per-variant prices are pricing content, not a numeric nudge).
 */
export const MAX_LISTING_VARIANTS = 20;

export type VariantAvailability = "available" | "made_to_order" | "temporarily_unavailable";

export interface ListingVariant {
  id: string;
  label: string;
  priceMicroJod: string;
  minQuantityMilli: string;
  availability: VariantAvailability;
}

export function validateVariants(variants: ListingVariant[]): void {
  if (variants.length === 0 || variants.length > MAX_LISTING_VARIANTS) {
    throw new HttpError(400, "bad_request", {
      field: "variants",
      reason: "count_out_of_bounds",
      max: MAX_LISTING_VARIANTS,
    });
  }
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  for (const variant of variants) {
    if (
      typeof variant.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(variant.id) ||
      seenIds.has(variant.id)
    ) {
      throw new HttpError(400, "bad_request", { field: "variants", reason: "invalid_or_duplicate_id" });
    }
    seenIds.add(variant.id);
    if (
      typeof variant.label !== "string" ||
      variant.label.trim().length < 1 ||
      variant.label.trim().length > 80 ||
      seenLabels.has(variant.label.trim())
    ) {
      throw new HttpError(400, "bad_request", { field: "variants", reason: "invalid_or_duplicate_label" });
    }
    seenLabels.add(variant.label.trim());
    parsePositiveIntegerString(variant.priceMicroJod, "variants.priceMicroJod", MAX_PRICE_MICRO);
    parsePositiveIntegerString(variant.minQuantityMilli, "variants.minQuantityMilli", 1_000_000_000n * 1000n);
    if (!["available", "made_to_order", "temporarily_unavailable"].includes(variant.availability)) {
      throw new HttpError(400, "bad_request", { field: "variants.availability" });
    }
  }
}

/**
 * The effective minimum order quantity of a listing (Q38): when variants
 * exist, a buyer can order any single option, so the denormalized
 * min_quantity_milli is the smallest of the base minimum and the variant
 * minimums — the browse "أقل كمية" filter stays honest for variant listings.
 */
export function effectiveMinQuantityMilli(
  baseMinMilli: string,
  variants: ListingVariant[] | undefined,
): string {
  if (variants === undefined || variants.length === 0) return baseMinMilli;
  let minimum = BigInt(baseMinMilli);
  for (const variant of variants) {
    const variantMin = BigInt(variant.minQuantityMilli);
    if (variantMin < minimum) minimum = variantMin;
  }
  return minimum.toString();
}

export const MAX_PRICE_MICRO = 1_000_000n * 1_000_000n; // 1,000,000 JOD
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

/** Vendor-editable vs reviewer-only fields (OD-09 content/numeric split,
 * contract 20 §3.3): the numeric price within the SAME pricing mode (fixed
 * scalar / tiered list), the declared quantity figures, availability, and
 * pause are direct; unit, category, media, contact channel, and the pricing
 * mode itself stay in review. */
export const DIRECT_UPDATE_FIELDS = [
  "priceMicroJod",
  "tiers",
  "minQuantityMilli",
  "stepMilli",
  "availabilityStatus",
] as const;

export function isDirectUpdateField(field: string): boolean {
  return (DIRECT_UPDATE_FIELDS as readonly string[]).includes(field);
}
