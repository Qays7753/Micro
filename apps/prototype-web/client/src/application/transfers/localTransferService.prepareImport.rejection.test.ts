import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import {
  localExportFormat,
  localExportVersion,
  localSchemaVersion,
  type PrototypeLocalStore,
} from "@/storage/local/types";
import { exportCountsOf } from "./transferCounters";
import { syncSha256Hex } from "@/lib/syncSha256";

/*
 * R2 (WS-216/ARCH-007 — M-03، 2026-10-08): انحدار الرفض المهيكل للاستيراد.
 * كان أي رمي غير متوقع من خط التحقق (RangeError مدقق التاريخ القديم على ملف
 * مصنوع؛ فائض الضرب في calculateSharedProjectShareMinor عبر مدقق الحصة
 * المشتركة) يهرب من prepareImport (كان يحرس JSON.parse فقط) إلى الالتقاط
 * العام في الواجهة فتظهر «تعذر قراءة الملف» الكاذبة. الآن الخط كله محروس:
 * كل رمي يعود { ok: false, code: "validation_error" } برسالة صادقة تضمّن
 * الأصل للتشخيص — ولا تكتب أي بيانات.
 */

const store = {} as PrototypeLocalStore; /* prepareImport لا يلمس التخزين أصلًا — نقي. */
const emptySnapshot = LocalTransferService.emptySnapshot(); /* اللقطة الفارغة الكنسية للخدمة نفسها */

function envelope(data: unknown): string {
  /* مظروف الزوج الحالي الصادق: بصمة وعدادات من البيانات نفسها كما يصدرها
   * createExport — نفس آلية minimalFileForPair في اختبارات الأزواج. */
  return JSON.stringify({
    format: localExportFormat,
    version: localExportVersion,
    schemaVersion: localSchemaVersion,
    exportedAt: "2026-10-07T10:00:00.000Z",
    data,
    integrity: { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) },
    counts: exportCountsOf(data as Parameters<typeof exportCountsOf>[0]),
  });
}

describe("R2 regression — prepareImport structured rejection (M-03, 2026-10-08)", () => {
  it("accepts an honest current-pair empty snapshot (control)", () => {
    const service = new LocalTransferService(store);
    const prepared = service.prepareImport(envelope(emptySnapshot));
    expect(prepared.ok).toBe(true);
  });

  it("returns a structured validation_error for a crafted out-of-grammar date (was an escaping RangeError)", () => {
    const service = new LocalTransferService(store);
    const poisoned = {
      ...emptySnapshot,
      directSales: [
        {
          id: "sale-x",
          itemName: "ملف مصنوع",
          quantity: 1,
          revenueMinor: 1000,
          collectedMinor: 1000,
          costMinor: null,
          occurredOn: "2026-13-01" /* خارج النحو — كان يرمي RangeError */,
          recordedAt: "2026-10-07T10:00:00.000Z",
          idempotencyKey: "sale-x-key",
          note: "x",
        },
      ],
    };
    const prepared = service.prepareImport(envelope(poisoned));
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.code).toBe("validation_error");
      expect(prepared.message).toContain("بقيت بيانات هذا الجهاز دون تغيير");
    }
  });

  it("returns a structured validation_error for a crafted shared-share overflow (XFER-E2 path)", () => {
    const service = new LocalTransferService(store);
    const maxSafe = Number.MAX_SAFE_INTEGER;
    const poisoned = {
      ...emptySnapshot,
      financialEvents: [
        {
          id: "event-x",
          type: "operating_expense_cash",
          amountMinor: maxSafe,
          occurredOn: "2026-10-07",
          recordedAt: "2026-10-07T10:00:00.000Z",
          idempotencyKey: "event-x-key",
          note: null,
          counterparty: null,
          expenseContext: {
            relationship: "shared",
            behavior: "fixed",
            purpose: "period",
            knowledge: "known",
            sharedProjectShare: {
              basis: "agreed_percentage",
              allocation: "allocated",
              totalAmountMinor: maxSafe,
              percentageBps: 10000,
            },
          },
        },
      ],
    };
    const prepared = service.prepareImport(envelope(poisoned));
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("validation_error");
  });

  it("rejects rollover dates in import families (M-04 tightening — was accepted)", () => {
    const service = new LocalTransferService(store);
    const poisoned = {
      ...emptySnapshot,
      cashContinuityEntries: [
        {
          id: "cash-x",
          walletId: "wallet-1",
          type: "opening_balance",
          occurredOn: "2023-02-29" /* دوران — كان يمر عبر مرساة Date.parse */,
          recordedAt: "2026-10-07T10:00:00.000Z",
          cashDeltaMinor: 500,
          note: "x",
          operationKey: "cash-x-op",
        },
      ],
      cashWallets: [
        { id: "wallet-1", name: "الرئيسية", kind: "cash_drawer", createdAt: "2026-10-07T10:00:00.000Z" },
      ],
    };
    const prepared = service.prepareImport(envelope(poisoned));
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("validation_error");
  });

  it("rejects a non-date scheduledFor (D5 tightening — was text-only)", () => {
    const service = new LocalTransferService(store);
    const poisoned = {
      ...emptySnapshot,
      schedules: [
        {
          id: "schedule-x",
          orderId: "order-x",
          kind: "delivery",
          scheduledFor: "not-a-date",
          scheduledTime: null,
          durationMinutes: null,
          recurrenceId: null,
          recurrenceIndex: null,
          status: "scheduled",
          createdAt: "2026-10-07T10:00:00.000Z",
          updatedAt: "2026-10-07T10:00:00.000Z",
          events: [],
        },
      ],
    };
    const prepared = service.prepareImport(envelope(poisoned));
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("validation_error");
  });
});

/*
 * S04 (DOC-013 / UNIT-025، 2026-10-28): رفض ملفات رصد الأرصدة المكسورة.
 * القياس يسافر في ملف النقل كما هو — لا فرق مقابل صفر ولا إعادة تسوية عند
 * الاستعادة؛ لكن الشكل الكسور يُرفض قبل أي معاينة: هوية مكررة، شكل سليم،
 * ونطاق صادق (رصد محفظة يشير لمحفظة موجودة فعلًا في اللقطة نفسها).
 */
describe("S04 — balance observations import validation (DOC-013)", () => {
  const walletObs = {
    id: "wallet-obs-1",
    name: "درج الرصد",
    kind: "cash_drawer",
    createdAt: "2026-10-03T10:00:00.000Z",
    createdOperationKey: "wallet-obs-1-open",
  };
  const honestObservation = {
    id: "obs-1",
    scopeKind: "wallet",
    walletId: "wallet-obs-1",
    countedMinor: 8800,
    knowledge: "known",
    cutoff: "2026-10-03T10:00:00.000Z",
    observedOn: "2026-10-03",
    recordedAt: "2026-10-03T10:00:00.000Z",
    operationKey: "obs-1-key",
    note: "رصد صادق",
  };

  it("accepts an honest wallet-scope observation (control) and a project-total observation with no wallet", () => {
    const service = new LocalTransferService(store);
    const honest = {
      ...emptySnapshot,
      cashWallets: [walletObs],
      balanceObservations: [
        honestObservation,
        {
          ...honestObservation,
          id: "obs-2",
          scopeKind: "project_total",
          walletId: null,
          operationKey: "obs-2-key",
        },
      ],
    };
    const prepared = service.prepareImport(envelope(honest));
    expect(prepared.ok).toBe(true);
  });

  it("rejects a corrupted observation shape (empty operationKey — a measurement without custody)", () => {
    const service = new LocalTransferService(store);
    const poisoned = {
      ...emptySnapshot,
      cashWallets: [walletObs],
      balanceObservations: [{ ...honestObservation, operationKey: "  " }],
    };
    const prepared = service.prepareImport(envelope(poisoned));
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.code).toBe("validation_error");
      expect(prepared.message).toContain("بقيت بيانات هذا الجهاز دون تغيير");
    }
  });

  it("rejects a wallet-scope observation whose wallet does not exist in the snapshot", () => {
    const service = new LocalTransferService(store);
    const poisoned = {
      ...emptySnapshot,
      cashWallets: [walletObs],
      balanceObservations: [{ ...honestObservation, walletId: "wallet-that-is-not-there" }],
    };
    const prepared = service.prepareImport(envelope(poisoned));
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("validation_error");
  });

  it("rejects a duplicate observation id (hand-merged file)", () => {
    const service = new LocalTransferService(store);
    const poisoned = {
      ...emptySnapshot,
      cashWallets: [walletObs],
      balanceObservations: [honestObservation, { ...honestObservation, operationKey: "obs-1-key-b" }],
    };
    const prepared = service.prepareImport(envelope(poisoned));
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("validation_error");
  });
});
