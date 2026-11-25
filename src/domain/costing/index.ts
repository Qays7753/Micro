/**
 * M1.1 (§14.3 / IMPACT S1): برميل عائلة «نواة التكلفة» المحايدة — السطح
 * العام الذي تستورده أدواتي (`src/domain/planning`) مباشرة، ويعيد
 * `craft-order` تصديره للتوافق الرجعي. الجسد الواحد في `costSnapshot.ts`.
 */
export type {
  CostSnapshot,
  CostSnapshotInput,
  KnowledgeState,
  KnowledgeGapId,
  KnowledgeGap,
  MaterialCostItem,
  TimeCost,
} from "./types.js";
export {
  calculateCostSnapshot,
  freezeCostSnapshot,
  assertValidQuantity,
  deriveKnowledgeGaps,
} from "./costSnapshot.js";
