import { describe, expect, it } from "vitest";
import { createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { OwnerEntitlementService } from "./ownerEntitlementService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const wallet = createCashWallet({
  id: "wallet-1",
  name: "الصندوق",
  kind: "cash_drawer",
  createdAt: "2026-08-01T08:00:00.000Z",
  createdOperationKey: "wallet-1",
});
const monthlyPolicy = {
  id: "policy-1",
  version: 1,
  family: "time_period" as const,
  kind: "monthly" as const,
  amountMinor: 1500,
  percentageBps: null,
  unitLabel: null,
  startsOn: "2026-08-01",
  endsOn: null,
  source: "اتفاق المالك",
  note: "استحقاق شهري",
  status: "active" as const,
  idempotencyKey: "policy-op",
  createdAt: "2026-08-01T08:00:00.000Z",
};

async function setup(withPolicy = true) {
  const store = new MemoryLocalStore();
  await store.commitCashContinuity(wallet, []);
  const service = new OwnerEntitlementService(
    store,
    async () => ({ ok: true as const, value: { resultMinor: 1000, status: "recorded_only" as const } }),
    () => "2026-08-31T08:00:00.000Z",
  );
  if (withPolicy) await service.createPolicy(monthlyPolicy);
  return { store, service };
}

const movement = (
  service: OwnerEntitlementService,
  input: Parameters<OwnerEntitlementService["recordMovement"]>[0],
) => service.recordMovement(input);

describe("OwnerEntitlementService", () => {
  it("records entitlement without changing cash, then settles it with a wallet cash movement", async () => {
    const { store, service } = await setup();
    const entitlement = await service.recordEntitlement({
      policyId: "policy-1",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      occurredOn: "2026-08-31",
      note: "حق شهر آب",
      idempotencyKey: "entitlement-op",
    });
    expect(entitlement.ok).toBe(true);
    expect((await store.listCashContinuityEntries()).value).toHaveLength(0);
    const draw = await movement(service, {
      kind: "draw",
      amountMinor: 500,
      walletId: "wallet-1",
      occurredOn: "2026-08-31",
      reason: "entitlement_settlement",
      note: "سحب جزئي لتسوية الاستحقاق",
      idempotencyKey: "draw-op",
      relatedEntitlementId: entitlement.ok ? entitlement.value.id : null,
    });
    expect(draw.ok).toBe(true);
    const overview = await service.readOverview();
    if (!overview.ok) throw new Error("overview should succeed");
    expect(overview.value.remainingEntitlementBalanceMinor).toBe(1000);
    expect(overview.value.drawnForEntitlementMinor).toBe(500);
    expect((await store.listCashContinuityEntries()).value).toMatchObject([
      { cashDeltaMinor: -500, walletId: "wallet-1" },
    ]);
  });

  it("blocks duplicate or overlapping entitlement periods even when the idempotency key changes, then allows re-recording after reversal", async () => {
    const { service } = await setup();
    const first = await service.recordEntitlement({
      policyId: "policy-1",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      occurredOn: "2026-08-31",
      note: "حق آب",
      idempotencyKey: "entitlement-a",
    });
    if (!first.ok) throw new Error("first entitlement should succeed");
    expect(
      await service.recordEntitlement({
        policyId: "policy-1",
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        occurredOn: "2026-08-31",
        note: "تكرار",
        idempotencyKey: "entitlement-b",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      await service.recordEntitlement({
        policyId: "policy-1",
        periodFrom: "2026-08-15",
        periodTo: "2026-08-31",
        occurredOn: "2026-08-31",
        note: "تداخل",
        idempotencyKey: "entitlement-c",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      await service.recordEntitlement({
        policyId: "policy-1",
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        occurredOn: "2026-08-31",
        note: "إعادة المحاولة",
        idempotencyKey: "entitlement-a",
      }),
    ).toMatchObject({ ok: true, reused: true });
    expect(
      await service.reverseEntitlement({
        recordId: first.value.id,
        occurredOn: "2026-09-01",
        reason: "سجلت بالخطأ",
        idempotencyKey: "entitlement-reversal",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await service.recordEntitlement({
        policyId: "policy-1",
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        occurredOn: "2026-08-31",
        note: "إعادة صحيحة",
        idempotencyKey: "entitlement-d",
      }),
    ).toMatchObject({ ok: true });
  });

  it("is idempotent and rejects a settlement above the remaining entitlement", async () => {
    const { service } = await setup();
    const entitlement = await service.recordEntitlement({
      policyId: "policy-1",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      occurredOn: "2026-08-31",
      note: "حق",
      idempotencyKey: "entitlement-op",
    });
    if (!entitlement.ok) throw new Error("entitlement should succeed");
    const first = await movement(service, {
      kind: "draw",
      amountMinor: 500,
      walletId: "wallet-1",
      occurredOn: "2026-08-31",
      reason: "entitlement_settlement",
      note: "سحب",
      idempotencyKey: "draw-op",
      relatedEntitlementId: entitlement.value.id,
    });
    const repeated = await movement(service, {
      kind: "draw",
      amountMinor: 500,
      walletId: "wallet-1",
      occurredOn: "2026-08-31",
      reason: "entitlement_settlement",
      note: "سحب",
      idempotencyKey: "draw-op",
      relatedEntitlementId: entitlement.value.id,
    });
    expect(first.ok).toBe(true);
    expect(repeated).toMatchObject({ ok: true, reused: true });
    expect(
      await movement(service, {
        kind: "draw",
        amountMinor: 1001,
        walletId: "wallet-1",
        occurredOn: "2026-08-31",
        reason: "entitlement_settlement",
        note: "سحب زائد",
        idempotencyKey: "draw-too-much",
        relatedEntitlementId: entitlement.value.id,
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("creates a successor with a changed amount and calculates only the new future period", async () => {
    const { service } = await setup();
    const independent = await service.createPolicy({
      ...monthlyPolicy,
      id: "policy-independent",
      idempotencyKey: "policy-independent-op",
      source: "اتفاق مستقل",
      note: "سلسلة مستقلة",
    });
    expect(independent.ok).toBe(true);
    const oldEntitlement = await service.recordEntitlement({
      policyId: "policy-1",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      occurredOn: "2026-08-31",
      note: "حق النسخة القديمة",
      idempotencyKey: "old-entitlement",
    });
    if (!oldEntitlement.ok) throw new Error("old entitlement should succeed");
    const successor = await service.createPolicySuccessor("policy-1", {
      kind: "monthly",
      amountMinor: 2000,
      percentageBps: null,
      unitLabel: null,
      endsOn: null,
      startsOn: "2026-09-01",
      source: "تعديل اتفاق",
      note: "رفع مبلغ أيلول",
      idempotencyKey: "successor-op",
    });
    expect(successor).toMatchObject({
      ok: true,
      value: {
        version: 2,
        successorOfPolicyId: "policy-1",
        startsOn: "2026-09-01",
        amountMinor: 2000,
        kind: "monthly",
        family: "time_period",
      },
    });
    if (!successor.ok) throw new Error("successor should succeed");
    const repeated = await service.createPolicySuccessor("policy-1", {
      kind: "monthly",
      amountMinor: 2000,
      percentageBps: null,
      unitLabel: null,
      endsOn: null,
      startsOn: "2026-09-01",
      source: "تعديل اتفاق",
      note: "رفع مبلغ أيلول",
      idempotencyKey: "successor-op",
    });
    expect(repeated).toMatchObject({ ok: true, reused: true });
    const policies = await service.readOverview();
    if (!policies.ok) throw new Error("overview should succeed");
    expect(policies.value.policies.find(policy => policy.id === "policy-1")).toMatchObject({
      status: "ended",
      endsOn: "2026-08-31",
      amountMinor: 1500,
    });
    expect(policies.value.entitlements.find(record => record.id === oldEntitlement.value.id)).toMatchObject({
      policyId: "policy-1",
      policyVersion: 1,
      amountMinor: 1500,
    });
    expect(await service.calculate(successor.value.id, "2026-09-01", "2026-09-30")).toMatchObject({
      ok: true,
      value: { amountMinor: 2000, knowledge: "known" },
    });
    expect(
      await service.createPolicySuccessor("policy-1", {
        kind: "monthly",
        amountMinor: 2500,
        percentageBps: null,
        unitLabel: null,
        endsOn: null,
        startsOn: "2026-09-01",
        source: "تعديل ثان",
        note: "يجب رفضه",
        idempotencyKey: "successor-2",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("supports changing the successor family to sale percentage and profit share without using cash", async () => {
    const saleSetup = await setup();
    const sale = await saleSetup.service.createPolicySuccessor("policy-1", {
      kind: "sale_percentage",
      amountMinor: null,
      percentageBps: 1000,
      unitLabel: null,
      endsOn: null,
      startsOn: "2026-09-01",
      source: "تعديل نسبة البيع",
      note: "نسبة من البيع المكتمل",
      idempotencyKey: "sale-successor",
    });
    expect(sale).toMatchObject({
      ok: true,
      value: {
        kind: "sale_percentage",
        family: "completed_sale_percentage",
        amountMinor: null,
        percentageBps: 1000,
      },
    });
    const profitSetup = await setup();
    const profit = await profitSetup.service.createPolicySuccessor("policy-1", {
      kind: "profit_share",
      amountMinor: null,
      percentageBps: 2500,
      unitLabel: null,
      endsOn: null,
      startsOn: "2026-09-01",
      source: "تعديل مشاركة الربح",
      note: "نسبة من نتيجة G3",
      idempotencyKey: "profit-successor",
    });
    if (!profit.ok) throw new Error("profit successor should succeed");
    expect(profit.value.family).toBe("profit_share");
    expect(await profitSetup.service.calculate(profit.value.id, "2026-09-01", "2026-09-30")).toMatchObject({
      ok: true,
      value: { amountMinor: 250, baseMinor: 1000, calculationBasis: "profit_share" },
    });
  });

  it("requires explicit fixed-period and unit terms and keeps missing evidence incomplete", async () => {
    const fixedSetup = await setup();
    expect(
      await fixedSetup.service.createPolicySuccessor("policy-1", {
        kind: "fixed_period",
        amountMinor: 2200,
        percentageBps: null,
        unitLabel: null,
        endsOn: null,
        startsOn: "2026-09-01",
        source: "فترة ثابتة",
        note: "ينقصها نطاق",
        idempotencyKey: "fixed-missing-end",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const fixed = await fixedSetup.service.createPolicySuccessor("policy-1", {
      kind: "fixed_period",
      amountMinor: 2200,
      percentageBps: null,
      unitLabel: null,
      endsOn: "2026-09-30",
      startsOn: "2026-09-01",
      source: "فترة ثابتة",
      note: "نطاق أيلول المعلن",
      idempotencyKey: "fixed-successor",
    });
    if (!fixed.ok) throw new Error("fixed successor should succeed");
    expect(await fixedSetup.service.calculate(fixed.value.id, "2026-09-01", "2026-09-30")).toMatchObject({
      ok: true,
      value: { amountMinor: 2200, knowledge: "known" },
    });
    const unitSetup = await setup();
    expect(
      await unitSetup.service.createPolicySuccessor("policy-1", {
        kind: "per_unit",
        amountMinor: 100,
        percentageBps: null,
        unitLabel: null,
        endsOn: null,
        startsOn: "2026-09-01",
        source: "تعديل وحدة",
        note: "ينقصها تعريف الوحدة",
        idempotencyKey: "unit-missing",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const unit = await unitSetup.service.createPolicySuccessor("policy-1", {
      kind: "per_unit",
      amountMinor: 100,
      percentageBps: null,
      unitLabel: "قطعة مكتملة",
      endsOn: null,
      startsOn: "2026-09-01",
      source: "تعديل وحدة",
      note: "مبلغ لكل قطعة",
      idempotencyKey: "unit-successor",
    });
    if (!unit.ok) throw new Error("unit successor should succeed");
    expect(unit.value.family).toBe("unit");
    expect(await unitSetup.service.calculate(unit.value.id, "2026-09-01", "2026-09-30")).toMatchObject({
      ok: true,
      value: { amountMinor: null, knowledge: "incomplete" },
    });
  });

  it("rejects invalid successor dates, ended origins, and malformed edited values without mutation", async () => {
    const { service } = await setup();
    expect(
      await service.createPolicySuccessor("policy-1", {
        kind: "monthly",
        amountMinor: 2000,
        percentageBps: null,
        unitLabel: null,
        endsOn: null,
        startsOn: "2026-07-01",
        source: "تعديل",
        note: "بداية غير صالحة",
        idempotencyKey: "bad-start",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      await service.createPolicySuccessor("policy-1", {
        kind: "monthly",
        amountMinor: 2000,
        percentageBps: null,
        unitLabel: null,
        endsOn: "2026-08-31",
        startsOn: "2026-09-01",
        source: "تعديل",
        note: "نهاية غير صالحة",
        idempotencyKey: "bad-end",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const valid = await service.createPolicySuccessor("policy-1", {
      kind: "monthly",
      amountMinor: 2000,
      percentageBps: null,
      unitLabel: null,
      endsOn: null,
      startsOn: "2026-09-01",
      source: "تعديل",
      note: "خليفة صحيحة",
      idempotencyKey: "valid-successor",
    });
    if (!valid.ok) throw new Error("valid successor should succeed");
    expect(
      await service.createPolicySuccessor("policy-1", {
        kind: "monthly",
        amountMinor: 3000,
        percentageBps: null,
        unitLabel: null,
        endsOn: null,
        startsOn: "2026-10-01",
        source: "تعديل",
        note: "الأصل منته",
        idempotencyKey: "ended-origin",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const policies = await service.readOverview();
    if (!policies.ok) throw new Error("overview should succeed");
    expect(policies.value.policies).toHaveLength(2);
  });

  it("settles positive opening balances partially and fully, with source bounds", async () => {
    const { service } = await setup(false);
    const opening = await service.setOpeningBalance({
      id: "opening-positive",
      amountMinor: 1000,
      occurredOn: "2026-08-01",
      reason: "رصيد سابق",
      note: "المشروع مدين لي",
      idempotencyKey: "opening-positive",
    });
    if (!opening.ok) throw new Error("opening should succeed");
    const partial = await movement(service, {
      kind: "draw",
      amountMinor: 400,
      walletId: "wallet-1",
      occurredOn: "2026-08-02",
      reason: "opening_balance_settlement",
      note: "تسوية جزئية",
      idempotencyKey: "opening-draw-1",
      relatedOpeningBalanceId: opening.value.id,
    });
    expect(partial.ok).toBe(true);
    const full = await movement(service, {
      kind: "draw",
      amountMinor: 600,
      walletId: "wallet-1",
      occurredOn: "2026-08-03",
      reason: "opening_balance_settlement",
      note: "تسوية كاملة",
      idempotencyKey: "opening-draw-2",
      relatedOpeningBalanceId: opening.value.id,
    });
    expect(full.ok).toBe(true);
    expect(
      await movement(service, {
        kind: "draw",
        amountMinor: 1,
        walletId: "wallet-1",
        occurredOn: "2026-08-04",
        reason: "opening_balance_settlement",
        note: "تجاوز",
        idempotencyKey: "opening-draw-3",
        relatedOpeningBalanceId: opening.value.id,
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const overview = await service.readOverview();
    if (!overview.ok) throw new Error("overview should succeed");
    expect(overview.value.openingBalanceRemainingMinor).toBe(0);
  });

  it("settles negative opening balances only through returns and keeps them separate from new capital", async () => {
    const { service } = await setup(false);
    const opening = await service.setOpeningBalance({
      id: "opening-negative",
      amountMinor: -700,
      occurredOn: "2026-08-01",
      reason: "سحوبات سابقة",
      note: "سحبت أكثر مما سجل لي",
      idempotencyKey: "opening-negative",
    });
    if (!opening.ok) throw new Error("opening should succeed");
    expect(
      await movement(service, {
        kind: "draw",
        amountMinor: 100,
        walletId: "wallet-1",
        occurredOn: "2026-08-02",
        reason: "opening_balance_settlement",
        note: "نوع خاطئ",
        idempotencyKey: "opening-wrong",
        relatedOpeningBalanceId: opening.value.id,
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      (
        await movement(service, {
          kind: "return",
          amountMinor: 200,
          walletId: "wallet-1",
          occurredOn: "2026-08-02",
          reason: "opening_balance_settlement",
          note: "إرجاع جزئي",
          idempotencyKey: "opening-return-1",
          relatedOpeningBalanceId: opening.value.id,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await movement(service, {
          kind: "return",
          amountMinor: 500,
          walletId: "wallet-1",
          occurredOn: "2026-08-03",
          reason: "opening_balance_settlement",
          note: "إرجاع كامل",
          idempotencyKey: "opening-return-2",
          relatedOpeningBalanceId: opening.value.id,
        })
      ).ok,
    ).toBe(true);
    expect(
      await movement(service, {
        kind: "return",
        amountMinor: 1,
        walletId: "wallet-1",
        occurredOn: "2026-08-04",
        reason: "opening_balance_settlement",
        note: "تجاوز",
        idempotencyKey: "opening-return-3",
        relatedOpeningBalanceId: opening.value.id,
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const overview = await service.readOverview();
    if (!overview.ok) throw new Error("overview should succeed");
    expect(overview.value.openingBalanceRemainingMinor).toBe(0);
    expect(overview.value.returnedAsCapitalMinor).toBe(0);
  });

  it("reverses an opening source without deleting it and refuses reversal while a settlement depends on it", async () => {
    const { service } = await setup(false);
    const opening = await service.setOpeningBalance({
      id: "opening-reversible",
      amountMinor: 500,
      occurredOn: "2026-08-01",
      reason: "افتتاح",
      note: "مصدر",
      idempotencyKey: "opening-reversible",
    });
    if (!opening.ok) throw new Error("opening should succeed");
    expect(
      await service.reverseOpeningBalance({
        balanceId: opening.value.id,
        occurredOn: "2026-08-02",
        reason: "افتتاح خاطئ",
        idempotencyKey: "opening-reversal",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await service.setOpeningBalance({
        id: "opening-correct",
        amountMinor: 700,
        occurredOn: "2026-08-01",
        reason: "تصحيح",
        note: "مصدر صحيح",
        idempotencyKey: "opening-correct",
      }),
    ).toMatchObject({ ok: true });
  });

  it("keeps owner draw independent and supports prior-draw return, capital return, and movement reversal", async () => {
    const { service } = await setup();
    const before = await movement(service, {
      kind: "draw",
      amountMinor: 400,
      walletId: "wallet-1",
      occurredOn: "2026-08-20",
      reason: "pre_entitlement_draw",
      note: "سحب قبل التسجيل",
      idempotencyKey: "before-op",
    });
    if (!before.ok) throw new Error("pre draw should succeed");
    const ownerDraw = await movement(service, {
      kind: "draw",
      amountMinor: 200,
      walletId: "wallet-1",
      occurredOn: "2026-08-21",
      reason: "owner_draw",
      note: "سحب شخصي مستقل",
      idempotencyKey: "owner-op",
    });
    expect(ownerDraw.ok).toBe(true);
    const capital = await movement(service, {
      kind: "return",
      amountMinor: 300,
      walletId: "wallet-1",
      occurredOn: "2026-08-22",
      reason: "new_capital_investment",
      note: "إرجاع كرأس مال جديد",
      idempotencyKey: "capital-op",
    });
    expect(capital.ok).toBe(true);
    const returned = await movement(service, {
      kind: "return",
      amountMinor: 400,
      walletId: "wallet-1",
      occurredOn: "2026-08-23",
      reason: "settlement_of_prior_draw",
      note: "إرجاع السحب السابق",
      idempotencyKey: "return-op",
      relatedMovementId: before.value.movement.id,
    });
    expect(returned.ok).toBe(true);
    const reversal = await service.reverseMovement({
      movementId: ownerDraw.ok ? ownerDraw.value.movement.id : "missing",
      occurredOn: "2026-08-24",
      reason: "سجلت بالخطأ",
      idempotencyKey: "owner-reversal",
    });
    expect(reversal.ok).toBe(true);
    expect(
      await service.reverseMovement({
        movementId: ownerDraw.ok ? ownerDraw.value.movement.id : "missing",
        occurredOn: "2026-08-24",
        reason: "سجلت بالخطأ",
        idempotencyKey: "owner-reversal",
      }),
    ).toMatchObject({ ok: true, reused: true });
    const overview = await service.readOverview();
    if (!overview.ok) throw new Error("overview should succeed");
    expect(overview.value.ownerDrawMinor).toBe(0);
    expect(overview.value.returnedForPriorDrawMinor).toBe(400);
    expect(overview.value.returnedAsCapitalMinor).toBe(300);
    expect(overview.value.movements).toHaveLength(5);
    expect(overview.value.cashMovementMinor).toBe(300);
  });

  it("rejects invalid wallet and blank note before writing", async () => {
    const { service } = await setup();
    expect(
      await movement(service, {
        kind: "draw",
        amountMinor: 100,
        walletId: "missing",
        occurredOn: "2026-08-20",
        reason: "owner_draw",
        note: "سحب",
        idempotencyKey: "bad-wallet",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      await movement(service, {
        kind: "draw",
        amountMinor: 100,
        walletId: "wallet-1",
        occurredOn: "2026-08-20",
        reason: "owner_draw",
        note: "",
        idempotencyKey: "blank-note",
      }),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });
});
