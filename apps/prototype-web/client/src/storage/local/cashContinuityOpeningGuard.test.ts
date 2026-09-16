/** EXE-008 (CASH-001): حوكمة الافتتاح والتحويل والتصحيح — حرس عمق دفاعي داخل المخزنين.
 *
 * الخدمة ترفض ثاني افتتاح من كل مسار إنتاجي؛ هذا الملف يثبت أن الحماية تعيش
 * أيضًا داخل حد الكتابة نفسه: commitCashContinuity مباشرة (بلا خدمة) بقيد
 * opening_balance جديد بمفتاح مختلف لمحفظة لها افتتاح → رفض كامل بلا كتابة،
 * في المحوّلين معًا (الذاكرة وfake-indexeddb) — لا انفصام سلوكي.
 * كما يثبت أن القيود الأخرى (ضبط/تخصيص/افتتاح محفظة أخرى) تمر كالمعتاد،
 * وأن إعادة إرسال الافتتاح نفسه بالمفتاح نفسه تبقى إعادة استخدام لا رفضًا.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import { SECOND_WALLET_OPENING_MESSAGE } from "./cashContinuityCommitGuard";
import type { PrototypeLocalStore } from "./types";

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const walletOne = createCashWallet({
  id: "wallet-one",
  name: "درج المحل",
  kind: "cash_drawer",
  createdAt: "2026-09-01T08:00:00Z",
  createdOperationKey: "open-one",
});

const openingOne = createCashContinuityEntry({
  id: "opening-one",
  walletId: walletOne.id,
  type: "opening_balance",
  occurredOn: "2026-09-01",
  recordedAt: "2026-09-01T08:05:00Z",
  cashDeltaMinor: 5000,
  note: "رصيد بداية",
  operationKey: "open-one",
});

const secondOpeningDifferentKey = createCashContinuityEntry({
  id: "opening-two",
  walletId: walletOne.id,
  type: "opening_balance",
  occurredOn: "2026-09-05",
  recordedAt: "2026-09-05T08:05:00Z",
  cashDeltaMinor: 3000,
  note: "افتتاح ثانٍ بمفتاح مختلف",
  operationKey: "open-two",
});

async function runGuardScenarios(store: PrototypeLocalStore): Promise<void> {
  /* ١) الافتتاح الأول يمر */
  const first = await store.commitCashContinuity(walletOne, [openingOne]);
  expect(first.ok).toBe(true);

  /* ٢) ثاني افتتاح بمفتاح مختلف يُرفض بالكامل — ولا يُكتب قيد ولا تحديث محفظة */
  const renamedWallet = { ...walletOne, name: "اسم جديد بعد الرفض" };
  const second = await store.commitCashContinuity(renamedWallet, [secondOpeningDifferentKey]);
  expect(second.ok).toBe(false);
  if (!second.ok) {
    expect(second.code).toBe("storage_stale");
    expect(second.message).toBe(SECOND_WALLET_OPENING_MESSAGE);
  }
  const entriesAfterRejection = await store.listCashContinuityEntries();
  expect(entriesAfterRejection.ok && entriesAfterRejection.value).toHaveLength(1);
  const walletsAfterRejection = await store.listCashWallets();
  expect(walletsAfterRejection.ok && walletsAfterRejection.value[0]!.name).toBe("درج المحل");

  /* ٣) إعادة إرسال الافتتاح نفسه بالمفتاح نفسه: إعادة استخدام صادقة لا رفض */
  const replay = await store.commitCashContinuity(walletOne, [openingOne]);
  expect(replay.ok).toBe(true);
  const entriesAfterReplay = await store.listCashContinuityEntries();
  expect(entriesAfterReplay.ok && entriesAfterReplay.value).toHaveLength(1);

  /* ٤) افتتاح لمحفظة أخرى جديدة يمر — المنع لكل محفظة لا للعالم */
  const walletTwo = createCashWallet({
    id: "wallet-two",
    name: "حساب بنكي",
    kind: "bank_account",
    createdAt: "2026-09-06T08:00:00Z",
    createdOperationKey: "open-wallet-two",
  });
  const openingTwo = createCashContinuityEntry({
    id: "opening-wallet-two",
    walletId: walletTwo.id,
    type: "opening_balance",
    occurredOn: "2026-09-06",
    recordedAt: "2026-09-06T08:05:00Z",
    cashDeltaMinor: 20000,
    note: "رصيد بداية الحساب",
    operationKey: "open-wallet-two",
  });
  const otherWalletOpening = await store.commitCashContinuity(walletTwo, [openingTwo]);
  expect(otherWalletOpening.ok).toBe(true);

  /* ٥) الضبط الموثق بسبب يمر بعد الافتتاح — الحرس لا يعمّ */
  const adjustment = createCashContinuityEntry({
    id: "adjust-one",
    walletId: walletOne.id,
    type: "cash_adjustment",
    occurredOn: "2026-09-07",
    recordedAt: "2026-09-07T09:00:00Z",
    cashDeltaMinor: -250,
    note: "فرق جرد الدرج",
    reason: "فرق جرد موثق",
    operationKey: "adjust-one",
  });
  const adjusted = await store.commitCashContinuity(null, [adjustment]);
  expect(adjusted.ok).toBe(true);

  /* ٦) افتتاحان جديدان لنفس المحفظة في دفعة واحدة → رفض الدفعة كلها */
  const batchOpeningA = createCashContinuityEntry({
    id: "batch-opening-a",
    walletId: walletTwo.id,
    type: "opening_balance",
    occurredOn: "2026-09-08",
    recordedAt: "2026-09-08T08:05:00Z",
    cashDeltaMinor: 1000,
    note: "افتتاح مكرر داخل الدفعة أ",
    operationKey: "batch-opening-a",
  });
  const batchOpeningB = createCashContinuityEntry({
    id: "batch-opening-b",
    walletId: walletTwo.id,
    type: "opening_balance",
    occurredOn: "2026-09-08",
    recordedAt: "2026-09-08T08:06:00Z",
    cashDeltaMinor: 2000,
    note: "افتتاح مكرر داخل الدفعة ب",
    operationKey: "batch-opening-b",
  });
  const walletThree = createCashWallet({
    id: "wallet-three",
    name: "محفظة تجريبية",
    kind: "digital_wallet",
    createdAt: "2026-09-08T08:00:00Z",
    createdOperationKey: "open-wallet-three",
  });
  const batch = await store.commitCashContinuity(walletThree, [batchOpeningA, batchOpeningB]);
  expect(batch.ok).toBe(false);
  if (!batch.ok) {
    expect(batch.code).toBe("storage_stale");
    expect(batch.message).toBe(SECOND_WALLET_OPENING_MESSAGE);
  }
  const finalEntries = await store.listCashContinuityEntries();
  /* افتتاحان (المحفظتان الأولى والثانية) + ضبط واحد = 3؛ دفعة الرفض لم تكتب شيئًا */
  expect(finalEntries.ok && finalEntries.value).toHaveLength(3);
}

describe("EXE-008 — second wallet opening rejected at the storage boundary", () => {
  it("MemoryLocalStore rejects a second opening for the same wallet", async () => {
    await runGuardScenarios(new MemoryLocalStore());
  });

  it("IndexedDbLocalStore (fake-indexeddb) rejects the same second opening", async () => {
    await clearDatabase();
    try {
      await runGuardScenarios(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});

afterEach(async () => {
  await clearDatabase();
});
