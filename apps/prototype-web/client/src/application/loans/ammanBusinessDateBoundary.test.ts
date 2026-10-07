import { describe, expect, it } from "vitest";
import { LoanService } from "./loanService";
import { ReceivedLoanService } from "./receivedLoanService";
import { AssetService } from "../assets/assetService";
import { RetainedDepositService } from "../financial-records/retainedDepositService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  calculateCostSnapshot,
  collectDeposit,
  cancelOrder,
  settleDepositRetain,
  createCraftOrder,
} from "@micro-domain/craft-order/index.js";
import type { CraftOrder } from "@micro-domain/craft-order/index.js";

/*
 * R2 (WS-216/ARCH-007 — M-05/D4، 2026-10-08): انحدار حدود تاريخ الأعمال
 * عند حافة عمّان (UTC+3 طول العام — حد اليوم المحلي 21:00Z ثابتًا).
 * كانت المواضع التسعة تشق الساعة المحقونة بـ`now.slice(0, 10)` فتسجل تاريخ
 * UTC: أي تصحيح/عكس مسائي (21:00Z–24:00Z) كان يحمل تاريخ اليوم السابق
 * بتوقيت المالك. الآن الاشتقاق الكنوني `localDateInAmman(now)` من الساعة
 * المحقونة نفسها — حتمية الاختبار محفوظة (لا ساعة محيطية).
 */

function clockAt(instant: string) {
  return () => instant;
}

const EVENING = "2026-10-07T21:30:00.000Z"; /* عمّان: 2026-10-08 00:30 */
const BEFORE_BOUNDARY = "2026-10-07T20:59:59.000Z"; /* عمّان: 2026-10-07 23:59:59 */

describe("R2 regression — Amman business date at the evening boundary (M-05, 2026-10-08)", () => {
  it("loan principal correction after 21:00Z carries the NEXT Amman day (was the UTC day)", async () => {
    const store = new MemoryLocalStore();
    const service = new LoanService(store, clockAt(EVENING));
    const created = await service.create({
      borrowerName: "سامر",
      principalMinor: 5000,
      loanDate: "2026-10-01",
      purposeNote: "اختبار الحدود",
      sourceWalletId: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const corrected = await service.correctLoan(created.value.loan.id, {
      principalMinor: 6000,
      reason: "تصحيح مسائي",
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.value.reversal.occurredOn).toBe("2026-10-08");
    /* البديل يعيد بيان الحدث الأصلي في تاريخه الأصلي (عقد التصحيح) —
     * فقط العكس يحمل تاريخ يوم التصحيح. */
    expect(corrected.value.replacement.occurredOn).toBe("2026-10-01");
  });

  it("loan principal correction before 21:00Z keeps the same Amman day", async () => {
    const store = new MemoryLocalStore();
    const service = new LoanService(store, clockAt(BEFORE_BOUNDARY));
    const created = await service.create({
      borrowerName: "سامر",
      principalMinor: 5000,
      loanDate: "2026-10-01",
      purposeNote: "اختبار الحدود",
      sourceWalletId: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const corrected = await service.correctLoan(created.value.loan.id, {
      principalMinor: 6000,
      reason: "تصحيح قبل الحد",
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.value.reversal.occurredOn).toBe("2026-10-07");
  });

  it("received-loan correction after 21:00Z carries the NEXT Amman day", async () => {
    const store = new MemoryLocalStore();
    const service = new ReceivedLoanService(store, clockAt(EVENING));
    const created = await service.create({
      lenderName: "ليلى",
      lenderType: "person",
      principalMinor: 7000,
      receivedOn: "2026-10-01",
      dueOn: null,
      note: null,
      walletId: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const corrected = await service.correctLoan(created.value.loan.id, {
      principalMinor: 7500,
      reason: "تصحيح مسائي",
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.value.reversal.occurredOn).toBe("2026-10-08");
  });

  it("asset acquisition correction after 21:00Z carries the NEXT Amman day", async () => {
    const store = new MemoryLocalStore();
    const service = new AssetService(store, clockAt(EVENING));
    const created = await service.create({
      name: "معدنة الحدود",
      categoryLabel: "أدوات",
      acquisitionAmountMinor: 24000,
      acquisitionKind: "cash",
      purchaseDate: "2026-10-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-10-01",
      note: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const corrected = await service.correctAcquisition(created.value.asset.id, {
      acquisitionAmountMinor: 25000,
      acquisitionKind: "cash",
      reason: "تصحيح مسائي",
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.value.reversal.occurredOn).toBe("2026-10-08");
  });

  it("received-loan correction before 21:00Z keeps the same Amman day (FH-6b)", async () => {
    const store = new MemoryLocalStore();
    const service = new ReceivedLoanService(store, clockAt(BEFORE_BOUNDARY));
    const created = await service.create({
      lenderName: "ليلى",
      lenderType: "person",
      principalMinor: 7000,
      receivedOn: "2026-10-01",
      dueOn: null,
      note: null,
      walletId: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const corrected = await service.correctLoan(created.value.loan.id, {
      principalMinor: 7500,
      reason: "تصحيح قبل الحد",
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.value.reversal.occurredOn).toBe("2026-10-07");
  });

  it("asset acquisition correction before 21:00Z keeps the same Amman day (FH-6b)", async () => {
    const store = new MemoryLocalStore();
    const service = new AssetService(store, clockAt(BEFORE_BOUNDARY));
    const created = await service.create({
      name: "معدنة الحدود",
      categoryLabel: "أدوات",
      acquisitionAmountMinor: 24000,
      acquisitionKind: "cash",
      purchaseDate: "2026-10-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-10-01",
      note: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const corrected = await service.correctAcquisition(created.value.asset.id, {
      acquisitionAmountMinor: 25000,
      acquisitionKind: "cash",
      reason: "تصحيح قبل الحد",
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.value.reversal.occurredOn).toBe("2026-10-07");
  });

  it("retained-deposit classification after 21:00Z carries the NEXT Amman day", async () => {
    const store = new MemoryLocalStore();
    const service = new RetainedDepositService(store, clockAt(EVENING));
    const snapshot = calculateCostSnapshot("cost-boundary", {
      currency: "JOD",
      materialItems: [],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-10-01T10:00:00.000Z",
      source: "price_approval",
    });
    let order: CraftOrder = createCraftOrder({
      id: "order-boundary",
      customerName: "ليلى",
      itemName: "طلب الحدود",
      specifications: "قياس مخصص",
      quantity: 1,
      agreedPriceMinor: 10000,
      costSnapshot: snapshot,
      createdAt: "2026-10-01T10:00:00.000Z",
    });
    order = collectDeposit(order, 1000, "order-boundary:deposit", "2026-10-01T10:00:00.000Z");
    order = cancelOrder(order, "العميلة ألغت", "order-boundary:cancel", "2026-10-02T10:00:00.000Z");
    order = settleDepositRetain(order, 1000, "تنازل", "order-boundary:retain", "2026-10-02T10:00:00.000Z");
    await store.saveOrder({
      id: "order-boundary",
      order,
      catalogItemId: null,
      deliveryDate: "2026-10-05",
      agreementSource: "walk_in",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-02T10:00:00.000Z",
    });
    const classified = await service.classify("order-boundary", "revenue", "تصنيف مسائي");
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;
    expect(classified.value.event.occurredOn).toBe("2026-10-08");
  });
});
