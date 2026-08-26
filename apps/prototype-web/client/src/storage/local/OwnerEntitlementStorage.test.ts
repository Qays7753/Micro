import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createOwnerEntitlementOpeningBalance, createOwnerEntitlementOpeningBalanceReversal, createOwnerEntitlementPolicy, createOwnerEntitlementPolicySuccessor, createOwnerEntitlementRecord, createOwnerEntitlementRecordReversal, createOwnerMovement } from "@micro-domain/owner-entitlement/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";

const databaseName = "micro-prototype-local";
afterEach(() => new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(databaseName); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }));
const policy = createOwnerEntitlementPolicy({ id: "policy-1", version: 1, family: "time_period", kind: "monthly", amountMinor: 1500, percentageBps: null, unitLabel: null, startsOn: "2026-08-01", endsOn: null, source: "اتفاق", note: "شهري", status: "active", idempotencyKey: "policy-1", createdAt: "2026-08-01T08:00:00.000Z" });
const record = createOwnerEntitlementRecord({ id: "entitlement-1", policyId: policy.id, policyVersion: policy.version, periodFrom: "2026-08-01", periodTo: "2026-08-31", occurredOn: "2026-08-31", recordedAt: "2026-08-31T08:00:00.000Z", amountMinor: 1500, knowledge: "known", calculationBasis: "time_period", baseMinor: null, quantity: null, note: "آب", idempotencyKey: "entitlement-1" });
const wallet = createCashWallet({ id: "wallet-1", name: "الصندوق", kind: "cash_drawer", createdAt: "2026-08-01T08:00:00.000Z", createdOperationKey: "wallet-1" });

describe("O1 IndexedDB adapter", () => {
  it("creates O1 stores and commits the owner movement with its cash entry atomically", async () => {
    const store = new IndexedDbLocalStore();
    await store.saveOwnerEntitlementPolicy(policy); await store.saveOwnerEntitlementRecord(record); await store.commitCashContinuity(wallet, []);
    const movement = createOwnerMovement({ id: "movement-1", kind: "draw", amountMinor: 500, walletId: wallet.id, occurredOn: "2026-08-31", recordedAt: "2026-08-31T09:00:00.000Z", reason: "entitlement_settlement", note: "تسوية جزئية", idempotencyKey: "movement-1", relatedEntitlementId: record.id });
    const cashEntry = createCashContinuityEntry({ id: "cash-1", walletId: wallet.id, type: "cash_adjustment", occurredOn: movement.occurredOn, recordedAt: movement.recordedAt, cashDeltaMinor: -500, note: movement.note, reason: "حركة مالك", operationKey: "owner-movement:movement-1" });
    await expect(store.commitOwnerMovement(movement, cashEntry)).resolves.toMatchObject({ ok: true, value: { movement: { id: movement.id }, cashEntry: { id: cashEntry.id } } });
    const resumed = new IndexedDbLocalStore(); await expect(resumed.listOwnerEntitlementPolicies()).resolves.toMatchObject({ ok: true, value: [{ id: policy.id }] }); await expect(resumed.listOwnerEntitlementRecords()).resolves.toMatchObject({ ok: true, value: [{ id: record.id }] }); await expect(resumed.listOwnerMovements()).resolves.toMatchObject({ ok: true, value: [{ id: movement.id }] }); await expect(resumed.listCashContinuityEntries()).resolves.toMatchObject({ ok: true, value: [{ id: cashEntry.id, cashDeltaMinor: -500 }] });
  });

  it("atomically stores a policy successor and append-only record reversals", async () => {
    const store = new IndexedDbLocalStore(); await store.saveOwnerEntitlementPolicy(policy); await store.saveOwnerEntitlementRecord(record);
    const ended = createOwnerEntitlementPolicy({ ...policy, status: "ended", endsOn: "2026-08-31" });
    const successor = createOwnerEntitlementPolicySuccessor({ id: "policy-2", version: 2, kind: "sale_percentage", amountMinor: null, percentageBps: 1250, unitLabel: null, startsOn: "2026-09-01", endsOn: null, source: "تعديل", note: "نسبة بيع جديدة", status: "active", idempotencyKey: "policy-2", createdAt: "2026-09-01T08:00:00.000Z", seriesId: policy.seriesId, successorOfPolicyId: policy.id });
    await expect(store.commitOwnerEntitlementPolicySuccessor(ended, successor)).resolves.toMatchObject({ ok: true, value: { successor: { id: "policy-2" } } });
    const recordReversal = createOwnerEntitlementRecordReversal({ id: "entitlement-reversal", source: record, occurredOn: "2026-09-01", recordedAt: "2026-09-01T08:00:00.000Z", reason: "خطأ", idempotencyKey: "entitlement-reversal" });
    await expect(store.commitOwnerEntitlementRecordReversal(record.id, recordReversal)).resolves.toMatchObject({ ok: true, value: { reversalOfId: record.id } });
    const opening = createOwnerEntitlementOpeningBalance({ id: "opening-1", amountMinor: 500, occurredOn: "2026-08-01", recordedAt: "2026-08-01T08:00:00.000Z", reason: "افتتاح", note: "مصدر", idempotencyKey: "opening-1", reversalOfId: null, reversalReason: null });
    await store.saveOwnerEntitlementOpeningBalance(opening);
    const openingReversal = createOwnerEntitlementOpeningBalanceReversal({ id: "opening-reversal", source: opening, occurredOn: "2026-09-01", recordedAt: "2026-09-01T08:00:00.000Z", reason: "خطأ", idempotencyKey: "opening-reversal" });
    await expect(store.commitOwnerEntitlementOpeningBalanceReversal(opening.id, openingReversal)).resolves.toMatchObject({ ok: true, value: { reversalOfId: opening.id } });
    const snapshot = await store.readSnapshot(); if (!snapshot.ok) throw new Error("snapshot should read"); expect(snapshot.value.ownerEntitlementPolicies).toEqual(expect.arrayContaining([expect.objectContaining({ id: policy.id, status: "ended", amountMinor: 1500 }), expect.objectContaining({ id: successor.id, successorOfPolicyId: policy.id, kind: "sale_percentage", family: "completed_sale_percentage", amountMinor: null, percentageBps: 1250 })])); expect(snapshot.value.ownerEntitlementRecords).toEqual(expect.arrayContaining([expect.objectContaining({ id: record.id }), expect.objectContaining({ reversalOfId: record.id })])); expect(snapshot.value.ownerEntitlementOpeningBalances).toEqual(expect.arrayContaining([expect.objectContaining({ id: opening.id }), expect.objectContaining({ reversalOfId: opening.id })]));
  });

  it("keeps O1 collections through an atomic snapshot replacement and tolerates a legacy snapshot without them", async () => {
    const store = new IndexedDbLocalStore(); await store.saveOwnerEntitlementPolicy(policy); await store.saveOwnerEntitlementRecord(record);
    const snapshot = await store.readSnapshot(); if (!snapshot.ok) throw new Error("snapshot should read"); expect(snapshot.value).toMatchObject({ ownerEntitlementPolicies: [{ id: policy.id }], ownerEntitlementRecords: [{ id: record.id }], ownerEntitlementOpeningBalances: [], ownerMovements: [] });
    await expect(store.replaceSnapshot({ profile: null, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [], ownerEntitlementPolicies: [policy], ownerEntitlementRecords: [record], ownerEntitlementOpeningBalances: [], ownerMovements: [] })).resolves.toMatchObject({ ok: true, value: { ownerEntitlementPolicies: [{ id: policy.id }], ownerEntitlementRecords: [{ id: record.id }] } });
    const replacement = new IndexedDbLocalStore(); await expect(replacement.listOwnerEntitlementRecords()).resolves.toMatchObject({ ok: true, value: [{ id: record.id }] });
  });
});
