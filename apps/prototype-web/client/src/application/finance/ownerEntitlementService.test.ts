import { describe, expect, it } from "vitest";
import { createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { OwnerEntitlementService } from "./ownerEntitlementService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const wallet = createCashWallet({ id: "wallet-1", name: "الصندوق", kind: "cash_drawer", createdAt: "2026-08-01T08:00:00.000Z", createdOperationKey: "wallet-1" });
const monthlyPolicy = { id: "policy-1", version: 1, family: "time_period" as const, kind: "monthly" as const, amountMinor: 1500, percentageBps: null, unitLabel: null, startsOn: "2026-08-01", endsOn: null, source: "اتفاق المالك", note: "استحقاق شهري", status: "active" as const, idempotencyKey: "policy-1", createdAt: "2026-08-01T08:00:00.000Z" };

async function setup() { const store = new MemoryLocalStore(); await store.commitCashContinuity(wallet, []); const service = new OwnerEntitlementService(store, async () => ({ ok: true as const, value: { resultMinor: 1000, status: "recorded_only" as const } }), () => "2026-08-31T08:00:00.000Z"); await service.createPolicy({ ...monthlyPolicy, idempotencyKey: "policy-op" }); return { store, service }; }

describe("OwnerEntitlementService", () => {
  it("records entitlement without changing cash, then settles it with a wallet cash movement", async () => {
    const { store, service } = await setup();
    const entitlement = await service.recordEntitlement({ policyId: "policy-1", periodFrom: "2026-08-01", periodTo: "2026-08-31", occurredOn: "2026-08-31", note: "حق شهر آب", idempotencyKey: "entitlement-op" });
    expect(entitlement.ok).toBe(true);
    expect((await store.listCashContinuityEntries()).value).toHaveLength(0);
    const draw = await service.recordMovement({ kind: "draw", amountMinor: 500, walletId: "wallet-1", occurredOn: "2026-08-31", reason: "entitlement_settlement", note: "سحب جزئي لتسوية الاستحقاق", idempotencyKey: "draw-op", relatedEntitlementId: entitlement.ok ? entitlement.value.id : null });
    expect(draw.ok).toBe(true);
    const overview = await service.readOverview(); if (!overview.ok) throw new Error("overview should succeed");
    expect(overview.value.remainingEntitlementBalanceMinor).toBe(1000);
    expect(overview.value.drawnForEntitlementMinor).toBe(500);
    expect((await store.listCashContinuityEntries()).value).toMatchObject([{ cashDeltaMinor: -500, walletId: "wallet-1" }]);
  });

  it("is idempotent and rejects a settlement above the remaining entitlement", async () => {
    const { service } = await setup();
    const entitlement = await service.recordEntitlement({ policyId: "policy-1", periodFrom: "2026-08-01", periodTo: "2026-08-31", occurredOn: "2026-08-31", note: "حق", idempotencyKey: "entitlement-op" }); if (!entitlement.ok) throw new Error("entitlement should succeed");
    const first = await service.recordMovement({ kind: "draw", amountMinor: 500, walletId: "wallet-1", occurredOn: "2026-08-31", reason: "entitlement_settlement", note: "سحب", idempotencyKey: "draw-op", relatedEntitlementId: entitlement.value.id });
    const repeated = await service.recordMovement({ kind: "draw", amountMinor: 500, walletId: "wallet-1", occurredOn: "2026-08-31", reason: "entitlement_settlement", note: "سحب", idempotencyKey: "draw-op", relatedEntitlementId: entitlement.value.id });
    expect(first.ok).toBe(true); expect(repeated).toMatchObject({ ok: true, reused: true });
    const tooMuch = await service.recordMovement({ kind: "draw", amountMinor: 1001, walletId: "wallet-1", occurredOn: "2026-08-31", reason: "entitlement_settlement", note: "سحب", idempotencyKey: "draw-too-much", relatedEntitlementId: entitlement.value.id });
    expect(tooMuch).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("keeps an owner draw independent and supports prior-draw return and new-capital return", async () => {
    const { service } = await setup();
    const before = await service.recordMovement({ kind: "draw", amountMinor: 400, walletId: "wallet-1", occurredOn: "2026-08-20", reason: "pre_entitlement_draw", note: "سحب قبل التسجيل", idempotencyKey: "before-op" }); if (!before.ok) throw new Error("pre draw should succeed");
    const ownerDraw = await service.recordMovement({ kind: "draw", amountMinor: 200, walletId: "wallet-1", occurredOn: "2026-08-21", reason: "owner_draw", note: "سحب شخصي مستقل", idempotencyKey: "owner-op" }); expect(ownerDraw.ok).toBe(true);
    const capital = await service.recordMovement({ kind: "return", amountMinor: 300, walletId: "wallet-1", occurredOn: "2026-08-22", reason: "new_capital_investment", note: "إرجاع كرأس مال جديد", idempotencyKey: "capital-op" }); expect(capital.ok).toBe(true);
    const returned = await service.recordMovement({ kind: "return", amountMinor: 400, walletId: "wallet-1", occurredOn: "2026-08-23", reason: "settlement_of_prior_draw", note: "إرجاع السحب السابق", idempotencyKey: "return-op", relatedMovementId: before.value.movement.id }); expect(returned.ok).toBe(true);
    const overview = await service.readOverview(); if (!overview.ok) throw new Error("overview should succeed");
    expect(overview.value.remainingEntitlementBalanceMinor).toBe(0);
    expect(overview.value.ownerDrawMinor).toBe(200);
    expect(overview.value.returnedAsCapitalMinor).toBe(300);
  });

  it("does not settle a prior draw after that draw has already been reversed", async () => {
    const { service } = await setup();
    const draw = await service.recordMovement({ kind: "draw", amountMinor: 250, walletId: "wallet-1", occurredOn: "2026-08-20", reason: "pre_entitlement_draw", note: "سحب قبل الاستحقاق", idempotencyKey: "pre-reversed" }); if (!draw.ok) throw new Error("draw should succeed");
    const reversal = await service.reverseMovement({ movementId: draw.value.movement.id, occurredOn: "2026-08-21", reason: "عكس السحب", idempotencyKey: "pre-reversed-reversal" }); expect(reversal.ok).toBe(true);
    expect(await service.recordMovement({ kind: "return", amountMinor: 250, walletId: "wallet-1", occurredOn: "2026-08-22", reason: "settlement_of_prior_draw", note: "إرجاع", idempotencyKey: "pre-reversed-return", relatedMovementId: draw.value.movement.id })).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("reverses a movement fully without rewriting the original", async () => {
    const { service } = await setup();
    const movement = await service.recordMovement({ kind: "draw", amountMinor: 250, walletId: "wallet-1", occurredOn: "2026-08-20", reason: "owner_draw", note: "سحب بالخطأ", idempotencyKey: "owner-op" }); if (!movement.ok) throw new Error("movement should succeed");
    const reversal = await service.reverseMovement({ movementId: movement.value.movement.id, occurredOn: "2026-08-21", reason: "سجلت بالخطأ", idempotencyKey: "reverse-op" }); expect(reversal.ok).toBe(true);
    const overview = await service.readOverview(); if (!overview.ok) throw new Error("overview should succeed");
    expect(overview.value.movements).toHaveLength(2); expect(overview.value.cashMovementMinor).toBe(0); expect(overview.value.movements.find(item => item.id === movement.value.movement.id)?.reversalOfId).toBeNull(); expect(overview.value.movements.find(item => item.reversalOfId === movement.value.movement.id)?.cashDeltaMinor).toBe(250);
  });

  it("rejects invalid wallet and blank note before writing", async () => {
    const { service } = await setup();
    expect(await service.recordMovement({ kind: "draw", amountMinor: 100, walletId: "missing", occurredOn: "2026-08-20", reason: "owner_draw", note: "سحب", idempotencyKey: "bad-wallet" })).toMatchObject({ ok: false, code: "validation_error" });
    expect(await service.recordMovement({ kind: "draw", amountMinor: 100, walletId: "wallet-1", occurredOn: "2026-08-20", reason: "owner_draw", note: "", idempotencyKey: "blank-note" })).toMatchObject({ ok: false, code: "validation_error" });
  });
});
