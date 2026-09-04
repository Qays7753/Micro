import { describe, expect, it } from "vitest";
import { createCashWallet } from "@micro-domain/cash-continuity/index.js";
import {
  createOwnerEntitlementPolicy,
  createOwnerEntitlementPolicySuccessor,
  createOwnerEntitlementRecord,
} from "@micro-domain/owner-entitlement/index.js";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { LocalTransferService } from "./localTransferService";

const wallet = createCashWallet({
  id: "wallet-transfer",
  name: "الصندوق",
  kind: "cash_drawer",
  createdAt: "2026-08-01T08:00:00.000Z",
  createdOperationKey: "wallet-transfer",
});
const policy = createOwnerEntitlementPolicy({
  id: "policy-transfer",
  version: 1,
  family: "time_period",
  kind: "monthly",
  amountMinor: 1500,
  percentageBps: null,
  unitLabel: null,
  startsOn: "2026-08-01",
  endsOn: null,
  source: "اتفاق",
  note: "شهري",
  status: "active",
  idempotencyKey: "policy-transfer",
  createdAt: "2026-08-01T08:00:00.000Z",
});
const record = createOwnerEntitlementRecord({
  id: "entitlement-transfer",
  policyId: policy.id,
  policyVersion: policy.version,
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  occurredOn: "2026-08-31",
  recordedAt: "2026-08-31T08:00:00.000Z",
  amountMinor: 1500,
  knowledge: "known",
  calculationBasis: "time_period",
  baseMinor: null,
  quantity: null,
  note: "آب",
  idempotencyKey: "entitlement-transfer",
});

describe("O1 local transfer boundary", () => {
  it("round-trips O1 collections and the wallet cash evidence", async () => {
    const source = new MemoryLocalStore();
    await source.saveOwnerEntitlementPolicy(policy);
    await source.saveOwnerEntitlementRecord(record);
    await source.commitCashContinuity(wallet, []);
    const owner = new OwnerEntitlementService(source, undefined, () => "2026-08-31T09:00:00.000Z");
    await owner.recordMovement({
      kind: "draw",
      amountMinor: 500,
      walletId: wallet.id,
      occurredOn: "2026-08-31",
      reason: "entitlement_settlement",
      note: "تسوية",
      idempotencyKey: "movement-transfer",
      relatedEntitlementId: record.id,
    });
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.value.summary).toMatchObject({
      ownerEntitlementPolicies: 1,
      ownerEntitlementRecords: 1,
      ownerMovements: 1,
      cashContinuityEntries: 1,
    });
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { ownerEntitlementPolicies: 1, ownerEntitlementRecords: 1, ownerMovements: 1 },
    });
    await expect(target.listOwnerMovements()).resolves.toMatchObject({
      ok: true,
      value: [{ cashDeltaMinor: -500, reason: "entitlement_settlement" }],
    });
  });

  it("round-trips changed successor terms and rejects a broken policy chain without writing", async () => {
    const source = new MemoryLocalStore();
    await source.saveOwnerEntitlementPolicy(policy);
    await source.saveOwnerEntitlementRecord(record);
    const ended = createOwnerEntitlementPolicy({ ...policy, status: "ended", endsOn: "2026-08-31" });
    const successor = createOwnerEntitlementPolicySuccessor({
      id: "policy-transfer-successor",
      version: 2,
      kind: "sale_percentage",
      amountMinor: null,
      percentageBps: 1250,
      unitLabel: null,
      startsOn: "2026-09-01",
      endsOn: null,
      source: "تعديل نسبة",
      note: "نسخة جديدة متغيرة",
      status: "active",
      idempotencyKey: "policy-transfer-successor",
      createdAt: "2026-09-01T08:00:00.000Z",
      seriesId: policy.seriesId,
      successorOfPolicyId: policy.id,
    });
    await expect(source.commitOwnerEntitlementPolicySuccessor(ended, successor)).resolves.toMatchObject({
      ok: true,
    });
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.value.file.data.ownerEntitlementPolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: successor.id,
          kind: "sale_percentage",
          family: "completed_sale_percentage",
          percentageBps: 1250,
        }),
      ]),
    );
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({ ok: true });
    const broken = structuredClone(exported.value);
    const brokenSuccessor = broken.data.ownerEntitlementPolicies?.find(
      candidate => candidate.id === successor.id,
    );
    if (!brokenSuccessor) throw new Error("successor should be exported");
    brokenSuccessor.successorOfPolicyId = "missing-policy";
    const seededTarget = new MemoryLocalStore();
    await seededTarget.saveOwnerEntitlementPolicy(policy);
    expect(new LocalTransferService(seededTarget).prepareImport(JSON.stringify(broken))).toMatchObject({
      ok: false,
      code: "validation_error",
    });
    await expect(seededTarget.listOwnerEntitlementPolicies()).resolves.toMatchObject({
      ok: true,
      value: [{ id: policy.id }],
    });
  });

  it("rejects an O1 movement that has no matching cash continuity evidence", async () => {
    const source = new MemoryLocalStore();
    await source.saveOwnerEntitlementPolicy(policy);
    await source.saveOwnerEntitlementRecord(record);
    await source.commitCashContinuity(wallet, []);
    const owner = new OwnerEntitlementService(source, undefined, () => "2026-08-31T09:00:00.000Z");
    await owner.recordMovement({
      kind: "draw",
      amountMinor: 500,
      walletId: wallet.id,
      occurredOn: "2026-08-31",
      reason: "entitlement_settlement",
      note: "تسوية",
      idempotencyKey: "movement-transfer",
      relatedEntitlementId: record.id,
    });
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const broken = structuredClone(exported.value) as {
      data: { cashContinuityEntries: Array<{ operationKey: string }> };
    };
    broken.data.cashContinuityEntries = [];
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("rejects tampered cash deltas and overlapping entitlement periods before writing", async () => {
    const source = new MemoryLocalStore();
    await source.saveOwnerEntitlementPolicy(policy);
    await source.saveOwnerEntitlementRecord(record);
    await source.commitCashContinuity(wallet, []);
    const owner = new OwnerEntitlementService(source, undefined, () => "2026-08-31T09:00:00.000Z");
    await owner.recordMovement({
      kind: "draw",
      amountMinor: 500,
      walletId: wallet.id,
      occurredOn: "2026-08-31",
      reason: "entitlement_settlement",
      note: "تسوية",
      idempotencyKey: "movement-tamper",
      relatedEntitlementId: record.id,
    });
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const tampered = structuredClone(exported.value);
    tampered.data.ownerMovements = tampered.data.ownerMovements?.map(movement => ({
      ...movement,
      cashDeltaMinor: movement.cashDeltaMinor + 1,
    }));
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(tampered)),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const overlapping = structuredClone(exported.value);
    overlapping.data.ownerEntitlementRecords = [
      ...(overlapping.data.ownerEntitlementRecords ?? []),
      {
        ...record,
        id: "entitlement-overlap",
        idempotencyKey: "entitlement-overlap",
        sourceKeys: ["period:policy-transfer:2026-08-01:2026-08-31"],
      },
    ];
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(overlapping)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("accepts the previous O1 schema pair and initializes absent O1 arrays empty", async () => {
    const source = new MemoryLocalStore();
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const previous = structuredClone(exported.value) as {
      version: number;
      schemaVersion: number;
      data: Record<string, unknown>;
    };
    previous.version = 12;    delete (previous as Record<string, unknown>).integrity;
    delete (previous as Record<string, unknown>).counts;
    delete (previous as Record<string, unknown>).appVersion;

    previous.schemaVersion = 21;
    delete previous.data.ownerEntitlementPolicies;
    delete previous.data.ownerEntitlementRecords;
    delete previous.data.ownerEntitlementOpeningBalances;
    delete previous.data.ownerMovements;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(previous)),
    ).toMatchObject({
      ok: true,
      value: {
        file: {
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          data: {
            ownerEntitlementPolicies: [],
            ownerEntitlementRecords: [],
            ownerEntitlementOpeningBalances: [],
            ownerMovements: [],
            allocationPolicies: [],
          },
        },
      },
    });
  });
});
