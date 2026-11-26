/**
 * M2.3 (§9 — مانج-في₂، الموجة E): برميل وحدة الثوابت INV-1…INV-10 — الفحوص
 * العشرة الصرفة فوق حالة الدفتر (`src/domain/manage/invariants/`) والتأكيد
 * المفرد للثابتين الأساسيين. لا يضيف البرميل ولا يعيد تسمية.
 */
export type {
  CachedFigures,
  CoreInvariantResults,
  InvariantBalanceLine,
  InvariantBox,
  InvariantCheckResult,
  InvariantEntry,
  InvariantId,
  InvariantOperation,
  InvariantPosting,
  InvariantSale,
  InvariantSaleLine,
  LedgerCheckState,
} from "./types.js";
export { checkInv1, checkInv2, checkInv3, checkInv10 } from "./stateChecks.js";
export { checkInv4, checkInv5, checkInv6 } from "./structureChecks.js";
export { checkInv7, checkInv8, checkInv9 } from "./transitionChecks.js";
export { assertLedgerCoreInvariants } from "./assertCore.js";
