import { describe, expect, it } from "vitest";
import { cashCountDifferenceReason, cashCountSettlementNote } from "./cashCountMessages";
import { persistedMoneyTextMinor } from "@micro-domain/shared/index.js";
import { createCashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

/*
 * R2 (M-10/D11، 2026-10-08): عقد بانيا نص سجل تسوية عدّ الصندوق بعد نقلهما
 * من طبقة العرض إلى هنا. ثلاثة عقود تُثبَّت:
 *  1) الملاحظة والسبب المحفوظان يُبنان بالمنسّق الكنوني **للمحفوظ**
 *     (`persistedMoneyTextMinor`: منزلتان دائمًا، بلا تجميع، بالوحدة) —
 *     F-001 محفوظ: مقياس المال 1/100 لا الكميات ولا وحدات صغرى خام.
 *  2) القراءة القديمة: ملاحظات ما قبل العقد الكنوني (بما فيها الصيغتان
 *     التاريخيتان: القسمة الخام «25 د.أ» والمنسّق المجمِّع «1,234.50 د.أ»)
 *     تُقرأ من التخزين كما خُزّنت حرفيًا — لا إعادة تسلسل ولا ترحيل.
 *  3) دورة الكتابة/القراءة عبر مسار التخزين الفعلي (MemoryLocalStore)
 *     لملاحظة قيد تسوية حقيقية.
 */

describe("R2 (M-10/D11) — persisted cash-count record text uses the canonical persisted formatter", () => {
  it("renders the counted-amount note on the money scale through the canonical persisted formatter (F-001 regression)", () => {
    expect(cashCountSettlementNote(25_000)).toBe(
      `تسوية عدّ الصندوق — المعدود ${persistedMoneyTextMinor(25_000)}`,
    );
    expect(cashCountSettlementNote(25_000)).toContain("250.00");
    expect(cashCountSettlementNote(25_000)).not.toContain("25 د.أ");
  });

  it("renders the difference reason with an explicit sign, never raw minor units", () => {
    expect(cashCountDifferenceReason(3_000)).toBe(`فرق زيادة عند العدّ (+${persistedMoneyTextMinor(3_000)})`);
    expect(cashCountDifferenceReason(-3_000)).toBe(`فرق نقص عند العدّ (${persistedMoneyTextMinor(-3_000)})`);
    expect(cashCountDifferenceReason(3_000)).toContain("+30.00");
    expect(cashCountDifferenceReason(-3_000)).toContain("-30.00");
    expect(cashCountDifferenceReason(3_000)).not.toContain("+3000");
    expect(cashCountDifferenceReason(-3_000)).not.toContain("-3000");
  });

  it("never groups thousands — the persisted contract is not the display contract", () => {
    /* 1,250,000 minor = 12,500.00 JOD: العرض يجمّع، المحفوظ لا يجمّع أبدًا. */
    expect(cashCountSettlementNote(1_250_000)).toContain("12500.00");
    expect(cashCountSettlementNote(1_250_000)).not.toContain("12,500.00");
    expect(cashCountDifferenceReason(1_250_000)).not.toContain(",");
  });
});

describe("R2 (M-10/D11) — legacy persisted notes are read back exactly as stored (no reserialization)", () => {
  it("returns pre-contract notes byte-identical through the real storage path — raw-division and grouped display formats alike", async () => {
    const store = new MemoryLocalStore();
    const legacyEntries = [
      createCashContinuityEntry({
        id: "legacy-cash-count-raw",
        walletId: "wallet-legacy",
        type: "cash_adjustment",
        occurredOn: "2026-05-01",
        recordedAt: "2026-05-01T18:30:00.000Z",
        cashDeltaMinor: -500,
        /* صيغة ما قبل F-001 التاريخية: قسمة خام بلا منزلتين. */
        note: "تسوية عدّ الصندوق — المعدود 25 د.أ",
        reason: "فرق نقص عند العدّ (-5 د.أ)",
        operationKey: "cash-count-legacy-raw",
      }),
      createCashContinuityEntry({
        id: "legacy-cash-count-grouped",
        walletId: "wallet-legacy",
        type: "cash_adjustment",
        occurredOn: "2026-06-01",
        recordedAt: "2026-06-01T18:30:00.000Z",
        cashDeltaMinor: 1_250_000,
        /* صيغة F-001 التاريخية بمنسّق العرض المجمِّع. */
        note: "تسوية عدّ الصندوق — المعدود 12,500.00 د.أ",
        reason: "فرق زيادة عند العدّ (+12,500.00 د.أ)",
        operationKey: "cash-count-legacy-grouped",
      }),
    ];
    const seeded = await store.readSnapshot();
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    await store.replaceSnapshot({ ...seeded.value, cashContinuityEntries: legacyEntries });

    const read = await store.listCashContinuityEntries();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    /* العقد: النص التاريخي يعود حرفيًا — لا إعادة تنسيق ولا تطبيع. */
    const raw = read.value.find(entry => entry.id === "legacy-cash-count-raw");
    const grouped = read.value.find(entry => entry.id === "legacy-cash-count-grouped");
    expect(raw?.note).toBe("تسوية عدّ الصندوق — المعدود 25 د.أ");
    expect(raw?.reason).toBe("فرق نقص عند العدّ (-5 د.أ)");
    expect(grouped?.note).toBe("تسوية عدّ الصندوق — المعدود 12,500.00 د.أ");
    expect(grouped?.reason).toBe("فرق زيادة عند العدّ (+12,500.00 د.أ)");
    /* والقيم الرقمية الدائمة هي الحقيقة دائمًا. */
    expect(raw?.cashDeltaMinor).toBe(-500);
    expect(grouped?.cashDeltaMinor).toBe(1_250_000);
  });
});

/* R3 (بطاقة R3-SC-00/R3-N2 — 2026-10-08): تقوية جناح القراءة القديمة عبر
 * المحوّل الثاني — IndexedDB/fake-indexeddb. كان البرهان (أعلاه) عبر
 * MemoryLocalStore فقط مع استدلال المطابقة؛ الآن يُثبت مباشرة أن محوّل
 * الإنتاج (المتصفح) يمرر النصوص التاريخية حرفيًا كذاكرة الاختبار —
 * العقد نفسه: لا إعادة تسلسل ولا تطبيع ولا ترحيل. */
import "fake-indexeddb/auto";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";

const idbDatabaseName = "micro-prototype-local";
function clearIdbDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(idbDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe("R3 (R3-N2) — legacy persisted notes are byte-identical through the IndexedDB adapter too (no reserialization)", () => {
  it("returns pre-contract notes byte-identical through the production browser adapter path", async () => {
    await clearIdbDatabase();
    try {
      const store = new IndexedDbLocalStore();
      const legacyEntries = [
        createCashContinuityEntry({
          id: "legacy-idb-raw",
          walletId: "wallet-legacy-idb",
          type: "cash_adjustment",
          occurredOn: "2026-05-01",
          recordedAt: "2026-05-01T18:30:00.000Z",
          cashDeltaMinor: -500,
          note: "تسوية عدّ الصندوق — المعدود 25 د.أ",
          reason: "فرق نقص عند العدّ (-5 د.أ)",
          operationKey: "cash-count-legacy-idb-raw",
        }),
        createCashContinuityEntry({
          id: "legacy-idb-grouped",
          walletId: "wallet-legacy-idb",
          type: "cash_adjustment",
          occurredOn: "2026-06-01",
          recordedAt: "2026-06-01T18:30:00.000Z",
          cashDeltaMinor: 1_250_000,
          note: "تسوية عدّ الصندوق — المعدود 12,500.00 د.أ",
          reason: "فرق زيادة عند العدّ (+12,500.00 د.أ)",
          operationKey: "cash-count-legacy-idb-grouped",
        }),
      ];
      const seeded = await store.readSnapshot();
      expect(seeded.ok).toBe(true);
      if (!seeded.ok) return;
      await store.replaceSnapshot({ ...seeded.value, cashContinuityEntries: legacyEntries });

      const read = await store.listCashContinuityEntries();
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const raw = read.value.find(entry => entry.id === "legacy-idb-raw");
      const grouped = read.value.find(entry => entry.id === "legacy-idb-grouped");
      expect(raw?.note).toBe("تسوية عدّ الصندوق — المعدود 25 د.أ");
      expect(raw?.reason).toBe("فرق نقص عند العدّ (-5 د.أ)");
      expect(grouped?.note).toBe("تسوية عدّ الصندوق — المعدود 12,500.00 د.أ");
      expect(grouped?.reason).toBe("فرق زيادة عند العدّ (+12,500.00 د.أ)");
      expect(raw?.cashDeltaMinor).toBe(-500);
      expect(grouped?.cashDeltaMinor).toBe(1_250_000);
    } finally {
      await clearIdbDatabase();
    }
  });
});
