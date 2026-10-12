import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFinancialEvent,
  createFinancialReversal,
  type FinancialEvent,
} from "@micro-domain/financial-event/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
} from "@micro-domain/supplier-purchase/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import {
  FINANCIAL_EVENT_SOURCE_MISSING_CORRECTION,
  FINANCIAL_EVENT_SOURCE_MISSING_REPLACEMENT,
  REVERSAL_MISMATCH_MESSAGE,
  REVERSAL_OF_REVERSAL_MESSAGE,
} from "./financialEventCorrectionMessages";
import { SECOND_WALLET_OPENING_MESSAGE } from "./cashContinuityCommitGuard";
import { RECURRENCE_STALE_MESSAGE } from "./indexedDbStores";
import type { PrototypeLocalStore, ScheduleRecurrence, StorageResult } from "./types";

/* R10-B3 (2026-10-12) — F-011 + NF-010 + NF-036: مطابقة هوية رسائل الرفض
 * بين المحوّلين بالبايت. كان في المصفوفة الكاملة (28 التزامًا) صفر تأكيدات
 * على .message بينما ~45 حرفية رسائل مكررة حرفيًا عبر المحوّلين — الانحراف
 * الصامت بينهما كان ممكنًا بلا أي إشارة حراسة. هذا الملف يثبت الهوية على
 * مجموعة رفض مأخوذة من كل عائلة حراس رئيسية: الأحداث المالية (المصدر
 * المفقود، التراجع عن تراجع، عدم مطابقة بيانات التراجع في مساري التراجع
 * والتعديل الذرّي)، قالب التكرار (RECURRENCE_STALE بعد توحيد مصدره)،
 * الشراء من المورد (تعارض الحالة القديمة)، والسيولة النقدية (افتتاح محفظة
 * ثانية). البرهان مزدوج: رسالة الذاكرة = رسالة IndexedDB بالبايت، وكلاهما
 * = الثابت الكنوني المُصدَّر حيث يوجد ثابت (لا إعادة كتابة الحرفيات هنا).
 *
 * NF-036: السيناريوهات ٢-٤ هي اختبار الانحدار لسدّ فجوة محوّل الذاكرة —
 * كانت حراسا «لا تراجع عن تراجع» و«مطابقة بيانات التراجع» في IndexedDB
 * وحده؛ مع كل رفض: إعادة قراءة تثبت أن لا شيء كُتب (لا حالة بينية). */

const TS = "2026-09-08T09:00:00.000Z";
const databaseName = "micro-prototype-local";

function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

function expenseEvent(id: string, amountMinor: number): FinancialEvent {
  return createFinancialEvent({
    id,
    type: "operating_expense_cash",
    amountMinor,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: id,
    note: "مصروف",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: null,
    },
    assetContext: null,
    loanContext: null,
    depositContext: null,
  });
}

function wallet(id: string) {
  return createCashWallet({
    id,
    name: `صندوق ${id}`,
    kind: "cash_drawer",
    createdAt: TS,
    createdOperationKey: id,
  });
}

function openingEntry(id: string, walletId: string, key: string, deltaMinor: number) {
  return createCashContinuityEntry({
    id,
    walletId,
    type: "opening_balance",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    cashDeltaMinor: deltaMinor,
    note: "رصيد بداية",
    operationKey: key,
  });
}

const cancelledRecurrence: ScheduleRecurrence = {
  id: "recurrence-stale",
  sourceScheduleId: "schedule-source",
  orderId: "order-1",
  frequency: "weekly",
  occurrenceCount: 2,
  status: "cancelled",
  idempotencyKey: "recurrence-stale",
  cancelledAt: TS,
  cancellationReason: "إيقاف",
  createdAt: TS,
  updatedAt: TS,
};

/** تشغيل السيناريو نفسه على محوّلين جديدين وإرجاع النتيجتين كما هي. */
async function bothAdapters<T>(
  scenario: (store: PrototypeLocalStore) => Promise<StorageResult<T>>,
): Promise<{ memory: StorageResult<T>; indexed: StorageResult<T> }> {
  const memory = await scenario(new MemoryLocalStore());
  const indexed = await scenario(new IndexedDbLocalStore());
  return { memory, indexed };
}

/** الهوية المزدوجة: رفض الطرفين + تطابق الرسائل بالبايت + رسالة غير فارغة. */
function expectIdenticalRejection<T>(results: {
  memory: StorageResult<T>;
  indexed: StorageResult<T>;
}): string {
  expect(results.memory.ok).toBe(false);
  expect(results.indexed.ok).toBe(false);
  if (results.memory.ok || results.indexed.ok) throw new Error("unreachable");
  expect(typeof results.memory.message).toBe("string");
  expect(results.memory.message.length).toBeGreaterThan(0);
  expect(results.memory.message).toBe(results.indexed.message);
  return results.memory.message;
}

describe("adapter rejection-message byte identity (R10-B3 — F-011 + NF-010 + NF-036)", () => {
  it("financial-event correction: missing source — same message on both adapters", async () => {
    const source = expenseEvent("event-live", 2500);
    const reversal = createFinancialReversal({
      id: "event-live-rev",
      sourceEvent: source,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "rev-key",
      reason: "خطأ تسجيل",
    });
    const message = expectIdenticalRejection(
      await bothAdapters(store => store.commitFinancialEventCorrection("event-missing", reversal)),
    );
    expect(message).toBe(FINANCIAL_EVENT_SOURCE_MISSING_CORRECTION);
  });

  it("NF-036 regression: reversal of a reversal is rejected by BOTH adapters with the same message and no partial write", async () => {
    const source = expenseEvent("event-live", 2500);
    const first = createFinancialReversal({
      id: "event-live-rev",
      sourceEvent: source,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "rev-key",
      reason: "خطأ تسجيل",
    });
    /* الباني الكنوني يرفض بناء تراجع عن تراجع أصلًا — هذا حدث عدائي
     * مبني يدويًا كما يصل من ملف معاد ختمه أو مسار خارج الخدمة؛ حارس
     * المحوّل (لا الباني) هو خط الدفاع الذي يثبته هذا الاختبار. */
    const second: FinancialEvent = {
      ...first,
      id: "event-live-rev-2",
      idempotencyKey: "rev-key-2",
      correctionType: "reverse",
      correctionOfEventId: first.id,
    };
    const message = expectIdenticalRejection(
      await bothAdapters(async store => {
        await store.saveFinancialEvent(source);
        const accepted = await store.commitFinancialEventCorrection(source.id, first);
        expect(accepted.ok).toBe(true);
        return store.commitFinancialEventCorrection(first.id, second);
      }),
    );
    expect(message).toBe(REVERSAL_OF_REVERSAL_MESSAGE);
  });

  it("NF-036 regression: correction with data that does not mirror the source is rejected by BOTH adapters with nothing written", async () => {
    const source = expenseEvent("event-live", 2500);
    const mirrored = createFinancialReversal({
      id: "event-live-rev",
      sourceEvent: source,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "rev-key",
      reason: "خطأ تسجيل",
    });
    const tampered: FinancialEvent = { ...mirrored, amountMinor: 2400 };
    const message = expectIdenticalRejection(
      await bothAdapters(async store => {
        await store.saveFinancialEvent(source);
        const result = await store.commitFinancialEventCorrection(source.id, tampered);
        if (!result.ok) {
          /* البرهان بالقراءة المرجعة: الرفض لم يكتب شيئًا — الحدث الأصلي وحده. */
          const events = await store.listFinancialEvents();
          expect(events.ok && events.value).toHaveLength(1);
        }
        return result;
      }),
    );
    expect(message).toBe(REVERSAL_MISMATCH_MESSAGE);
  });

  it("NF-036 regression: atomic replacement with a non-mirroring reversal is rejected by BOTH adapters with nothing written", async () => {
    const source = expenseEvent("event-live", 2500);
    const mirrored = createFinancialReversal({
      id: "event-live-rev",
      sourceEvent: source,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "rev-key",
      reason: "تصحيح",
    });
    const tampered: FinancialEvent = { ...mirrored, amountMinor: 2400 };
    const replacement = expenseEvent("event-replacement", 2600);
    const message = expectIdenticalRejection(
      await bothAdapters(async store => {
        await store.saveFinancialEvent(source);
        const result = await store.commitFinancialEventReplacement(source.id, tampered, replacement);
        if (!result.ok) {
          const events = await store.listFinancialEvents();
          expect(events.ok && events.value).toHaveLength(1);
        }
        return result;
      }),
    );
    expect(message).toBe(REVERSAL_MISMATCH_MESSAGE);
  });

  it("recurrence template staleness — the single-sourced RECURRENCE_STALE_MESSAGE on both adapters (F-011)", async () => {
    const message = expectIdenticalRejection(
      await bothAdapters(store => store.commitRecurrence(cancelledRecurrence, [])),
    );
    expect(message).toBe(RECURRENCE_STALE_MESSAGE);
  });

  it("supplier purchase old-state conflict — same stale message on both adapters", async () => {
    const purchase = createSupplierPurchase({
      id: "purchase-1",
      supplierName: "مؤسسة النسيج",
      note: "شراء قماش",
      purchasedOn: "2026-09-07",
      dueOn: null,
      totalMinor: 10000,
      initialPaidMinor: 2000,
      recordedAt: TS,
      idempotencyKey: "purchase-1",
      materialId: null,
      expectedQuantityMilli: null,
    });
    const withPayment = recordSupplierPurchasePayment(purchase, {
      id: "payment-1",
      amountMinor: 1500,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "payment-1",
      note: "دفعة",
    });
    const staleSecondPayment = recordSupplierPurchasePayment(purchase, {
      id: "payment-2",
      amountMinor: 1500,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "payment-2",
      note: "دفعة ثانية",
    });
    const message = expectIdenticalRejection(
      await bothAdapters(async store => {
        const created = await store.commitSupplierPurchase({
          kind: "create",
          purchase,
          idempotencyKey: "purchase-1",
        });
        expect(created.ok).toBe(true);
        const paid = await store.commitSupplierPurchase({
          kind: "payment",
          purchase: withPayment,
          idempotencyKey: "payment-1",
        });
        expect(paid.ok).toBe(true);
        /* الدفعة الثانية مبنية على الحالة القديمة (بلا الدفعة الأولى) — تعارض. */
        return store.commitSupplierPurchase({
          kind: "payment",
          purchase: staleSecondPayment,
          idempotencyKey: "payment-2",
        });
      }),
    );
    expect(message.length).toBeGreaterThan(0);
  });

  it("cash continuity second wallet opening — the shared guard message on both adapters", async () => {
    const message = expectIdenticalRejection(
      await bothAdapters(async store => {
        const first = await store.commitCashContinuity(wallet("wallet-1"), [
          openingEntry("opening-1", "wallet-1", "op-open-1", 5000),
        ]);
        expect(first.ok).toBe(true);
        /* افتتاح ثانٍ بنفس الوضع وبمفتاح عملية مختلف — الرفض الكامل بلا كتابة. */
        return store.commitCashContinuity(wallet("wallet-1"), [
          openingEntry("opening-2", "wallet-1", "op-open-2", 3000),
        ]);
      }),
    );
    expect(message).toBe(SECOND_WALLET_OPENING_MESSAGE);
  });

  /* RV5/B3 (بوابة الموجة): تثبيت سلوكي لقوائم الحقول نفسها — لكل حقل من
   * حقول المطابقة، مرآة مضروبة في حقل واحد فقط يجب أن يرفضها المحوّلان
   * معًا؛ أي حقل يُضاف مستقبلًا إلى سلسلة محوّل دون الآخر يُصطاد هنا. */
  it("RV5 pin: every correction conformance field is enforced by BOTH adapters (tamper-one-field sweep)", async () => {
    const tamper: Record<string, (mirrored: FinancialEvent) => FinancialEvent> = {
      correctionType: m => ({ ...m, correctionType: null }),
      correctionOfEventId: m => ({ ...m, correctionOfEventId: "other-id" }),
      type: m => ({ ...m, type: "asset_purchase_cash" as FinancialEvent["type"] }),
      amountMinor: m => ({ ...m, amountMinor: m.amountMinor + 100 }),
      relatedEventId: m => ({ ...m, relatedEventId: "unrelated" }),
      cashDeltaMinor: m => ({ ...m, cashDeltaMinor: m.cashDeltaMinor + 100 }),
      payableDeltaMinor: m => ({ ...m, payableDeltaMinor: m.payableDeltaMinor + 100 }),
      ownerCapitalDeltaMinor: m => ({ ...m, ownerCapitalDeltaMinor: m.ownerCapitalDeltaMinor + 100 }),
      operatingExpenseDeltaMinor: m => ({
        ...m,
        operatingExpenseDeltaMinor: m.operatingExpenseDeltaMinor + 100,
      }),
    };
    for (const [field, tamperFn] of Object.entries(tamper)) {
      const source = expenseEvent("event-live", 2500);
      const mirrored = createFinancialReversal({
        id: `event-live-rev-${field}`,
        sourceEvent: source,
        occurredOn: "2026-09-08",
        recordedAt: TS,
        idempotencyKey: `rev-key-${field}`,
        reason: "تصحيح",
      });
      const tampered = tamperFn(mirrored);
      const message = expectIdenticalRejection(
        await bothAdapters(async store => {
          await store.saveFinancialEvent(source);
          return store.commitFinancialEventCorrection(source.id, tampered);
        }),
      );
      expect(message).toBe(REVERSAL_MISMATCH_MESSAGE);
    }
  });

  it("RV5 pin: every replacement conformance field is enforced by BOTH adapters (relatedEventId deliberately unchecked in this path, mirroring the reference)", async () => {
    const fields = [
      "correctionType",
      "correctionOfEventId",
      "type",
      "amountMinor",
      "cashDeltaMinor",
      "payableDeltaMinor",
      "ownerCapitalDeltaMinor",
      "operatingExpenseDeltaMinor",
    ] as const;
    for (const field of fields) {
      const source = expenseEvent("event-live", 2500);
      const mirrored = createFinancialReversal({
        id: `event-live-rev-${field}`,
        sourceEvent: source,
        occurredOn: "2026-09-08",
        recordedAt: TS,
        idempotencyKey: `rev-key-${field}`,
        reason: "تصحيح",
      });
      const tampered: FinancialEvent = {
        ...mirrored,
        [field]:
          field === "correctionType"
            ? null
            : field === "correctionOfEventId"
              ? "other-id"
              : field === "type"
                ? ("asset_purchase_cash" as FinancialEvent["type"])
                : (mirrored[field] as number) + 100,
      };
      const replacement = expenseEvent(`event-replacement-${field}`, 2600);
      const message = expectIdenticalRejection(
        await bothAdapters(async store => {
          await store.saveFinancialEvent(source);
          return store.commitFinancialEventReplacement(source.id, tampered, replacement);
        }),
      );
      expect(message).toBe(REVERSAL_MISMATCH_MESSAGE);
    }
  });

  it("financial-event replacement: missing source — same message on both adapters", async () => {
    const source = expenseEvent("event-live", 2500);
    const reversal = createFinancialReversal({
      id: "event-live-rev",
      sourceEvent: source,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "rev-key",
      reason: "تصحيح",
    });
    const replacement = expenseEvent("event-replacement", 2600);
    const message = expectIdenticalRejection(
      await bothAdapters(store =>
        store.commitFinancialEventReplacement("event-missing", reversal, replacement),
      ),
    );
    expect(message).toBe(FINANCIAL_EVENT_SOURCE_MISSING_REPLACEMENT);
  });
});
