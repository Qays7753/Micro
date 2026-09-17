import type { FinancialEventType } from "@micro-domain/financial-event/index.js";

/*
 * Wave 4.3 — P-4.3-3 (D9): خريطة تسميات الأحداث المالية — بيتها الوحيد في
 * طبقة العرض المشتركة. كانت تسكن EventsLayer (مكوّن شاشة) فاضطر أي مستهلك
 * خارجي (سلامة الحسابات) لسحب شجرة المكون كاملة ضمن قياس الكثافة؛ النقل
 * يحفظ المصدر الواحد ويكسر السحب العرضي — نفس القيم حرفيًا، لا تكرار.
 */
export const financialEventLabel: Record<FinancialEventType, string> = {
  owner_investment_cash: "استثمار المالك",
  owner_withdrawal_cash: "سحب شخصي",
  operating_expense_cash: "مصروف مدفوع",
  operating_expense_payable: "مصروف مستحق",
  payable_settlement_cash: "تسديد التزام",
  amanah_held_cash: "أمانة قُبضت",
  amanah_released_cash: "أمانة سُلّمت",
  loss_non_cash: "هالك بلا خروج نقد",
  /* المجموعة ٤ (عقد ٢٩): تسميات قراءة للأنواع الجديدة — تعرض في السجلات والتصحيحات. */
  asset_purchase_cash: "شراء أصل نقدًا",
  asset_purchase_payable: "شراء أصل بالذمم",
  asset_depreciation: "إهلاك أصل",
  asset_disposal_cash: "استبعاد أصل (تخلص)",
  asset_writeoff: "شطب أصل",
  loan_outgoing_cash: "قرض لشخص",
  loan_repayment_cash: "سداد قرض",
  deposit_retained_revenue: "عربون محتفظ به كإيراد",
  deposit_retained_owner: "عربون محتفظ به كمال مالك",
};
