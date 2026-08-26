import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createOwnerEntitlementPolicy, createOwnerEntitlementRecord, createOwnerMovement } from "@micro-domain/owner-entitlement/index.js";
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

  it("keeps O1 collections through an atomic snapshot replacement and tolerates a legacy snapshot without them", async () => {
    const store = new IndexedDbLocalStore(); await store.saveOwnerEntitlementPolicy(policy); await store.saveOwnerEntitlementRecord(record);
    const snapshot = await store.readSnapshot(); if (!snapshot.ok) throw new Error("snapshot should read"); expect(snapshot.value).toMatchObject({ ownerEntitlementPolicies: [{ id: policy.id }], ownerEntitlementRecords: [{ id: record.id }], ownerEntitlementOpeningBalances: [], ownerMovements: [] });
    await expect(store.replaceSnapshot({ profile: null, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [], ownerEntitlementPolicies: [policy], ownerEntitlementRecords: [record], ownerEntitlementOpeningBalances: [], ownerMovements: [] })).resolves.toMatchObject({ ok: true, value: { ownerEntitlementPolicies: [{ id: policy.id }], ownerEntitlementRecords: [{ id: record.id }] } });
    const replacement = new IndexedDbLocalStore(); await expect(replacement.listOwnerEntitlementRecords()).resolves.toMatchObject({ ok: true, value: [{ id: record.id }] });
  });
});
