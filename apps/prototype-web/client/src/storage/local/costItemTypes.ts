/**
 * S10 (UNIT-032/SH-14 — أمر b56967d8): الأنواع المشتركة لبنود التكلفة —
 * ملف ورقي (leaf) يكسر دورة الأنواع بين types.ts وplanningCalculationTypes.ts
 * (حارس type-cycles): كلا البيتين يستورد منه وحده ولا يستورد منه أحد.
 * الأنواع نفسها كما كانت حرفيًا — بيتها القانوني يعاد تصديره من types.ts.
 */

/** بند مادة التكلفة كما في الحاسبة والمسودة — الهوية ربط فقط لا قيمة حية. */
export type DraftCostMaterial = {
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  confidence: "known" | "estimated";
  materialId?: string | null;
};

/** وقت العمل في حسابات التكلفة — القيم null = وقت غير مكتمل (معرفة ناقصة). */
export type DraftCostTime = {
  minutes: number | null;
  hourlyRateMinor: number | null;
  confidence: "known" | "estimated";
};

/** حالات معرفة حساب التكلفة/التقدير (القرار ٢٢ — أشد نقص). */
export type CostEstimateKnowledge = "known" | "estimated" | "partial" | "incomplete" | "stale" | "variable";
