/**
 * باب السوق (EX-D18 — 2026-11-12): خدمات السوق للعميل — التصفح العام
 * ومساحة المورد والتقدير الصافي. توسيع سطحه تعديل مقصود بنفس الـPR
 * (PC-3). لا كتابة تخزين محلي ولا أي أثر مالي من هذا البيت (OD-13/OD-14).
 */

/*
 * توسيع مقصود مؤرخ (Post-Group 6 Wave 2 — 2026-11-21، أمر المالك
 * POST-GROUP6-REMEDIATION @ ab08ec74): كشف رقم المورد المدقق
 * (revealSupplierPhone — قرار د-1/§8-3)، الأعداد التشغيلية للمشرف
 * (fetchMarketOpsCounts — Q154)، إدارة التصنيفات الهرمية
 * (putMarketCategories — Q49/Q146)، ونوع المورد/التوصيل والمصطلحات في ملف
 * المورد مع إلغاء مسار «إرسال الملف للمراجعة» (submitVendorProfile حُذف —
 * قرار المالك النهائي Q4/Q28: التفعيل بإكمال الملف وقَبول الشروط بلا
 * مراجعة ملف) — نفس باب API نفس الأصل بلا أي كتابة محلية.
 */

export {
  attachListingMedia,
  browseMarketListings,
  confirmListingAvailability,
  createListingDraft,
  directUpdateListing,
  fetchListingDetail,
  fetchMarketMeta,
  fetchMarketOpsCounts,
  fetchVendorListingDraft,
  fetchVendorOverview,
  listingLifecycleAction,
  putMarketCategories,
  reportListing,
  revealSupplierPhone,
  updateListingDraft,
  upsertVendorProfile,
  submitListing,
  toggleSavedListing,
  uploadListingImage,
} from "./marketService";
export type {
  ListingDraftInput,
  ListingVariant,
  MarketCategoryNode,
  MarketMeta,
  PublicListingDetail,
  PublicListingSummary,
  VendorListingDraft,
  VendorOverview,
} from "./marketService";
export { estimateMaterialValue, formatMicroJodAsJod } from "./marketEstimate";
export type { EstimateInput, EstimateResult } from "./marketEstimate";
