/** المجموعة ٥ (التحصين الكامل — ترحيل المسودات القديمة): عقد الترحيل
 * الواحد — اكتب ← تحقق ← احذف؛ حتمي التكرار؛ الفشل يُبقي القديمة؛
 * المعطوب يُرفض لا يُحذف؛ ولا أي أثر مالي في أي مسار أبدًا. */
import { describe, expect, it } from "vitest";
import { FormDraftService } from "./formDraftService";
import {
  clearLegacyFormDraftStorage,
  LEGACY_SETUP_DRAFT_KEY,
  legacyFinanceDraftKey,
  migrateLegacyFormDraft,
  type LegacyFormDraftStorage,
} from "./legacyFormDraftMigration";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const NOW = "2026-09-11T09:00:00.000Z";

/** كعب تخزين قديم قابل للفشل المُوجَّه — سجل كل حذف لبرهان عدم الفقد. */
type TestStorage = LegacyFormDraftStorage & {
  removed: string[];
  failGet: boolean;
  failRemove: boolean;
};

function memoryStorage(seed: Record<string, string> = {}): TestStorage {
  const map = new Map<string, string>(Object.entries(seed));
  const removed: string[] = [];
  const harness: TestStorage = {
    removed,
    failGet: false,
    failRemove: false,
    getItem: (key: string) => {
      if (harness.failGet) throw new Error("storage unavailable");
      return map.get(key) ?? null;
    },
    removeItem: (key: string) => {
      if (harness.failRemove) throw new Error("remove failed");
      map.delete(key);
      removed.push(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    get length() {
      return map.size;
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  };
  return harness;
}

const parse = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as { note?: unknown };
  if (typeof candidate.note !== "string") return null;
  return { note: candidate.note };
};

function setup(seed: Record<string, string> = {}) {
  const store = new MemoryLocalStore();
  const drafts = new FormDraftService(store, () => NOW);
  const storage = memoryStorage(seed);
  return { store, drafts, storage };
}

const LEGACY = legacyFinanceDraftKey("operating_expense_cash");
const VALID_DRAFT = JSON.stringify({ note: "مسودة قديمة" });

async function migrate(params: ReturnType<typeof setup>) {
  return migrateLegacyFormDraft({
    service: params.drafts,
    storage: params.storage,
    legacyKey: LEGACY,
    formKind: "finance_event",
    scopeId: "operating_expense_cash",
    parse,
  });
}

describe("legacy form draft migration (group 5 — write, verify, then delete)", () => {
  it("migrates a valid legacy draft once, verifies, and removes the legacy key", async () => {
    const params = setup({ [LEGACY]: VALID_DRAFT });
    const result = await migrate(params);
    expect(result.status).toBe("migrated");
    if (result.status !== "migrated") return;
    expect(result.value.values).toEqual({ note: "مسودة قديمة" });
    const stored = await params.store.getFormDraft("finance_event:operating_expense_cash");
    expect(stored.ok && stored.value).not.toBeNull();
    expect(params.storage.getItem(LEGACY)).toBeNull();
    /* إعادة التشغيل فورًا: المفتاح زال فلا شيء يُهاجر مرتين. */
    const again = await migrate(params);
    expect(again.status).toBe("none");
  });

  it("a second run after reload/re-entry is a no-op — the envelope is the record", async () => {
    const params = setup({ [LEGACY]: VALID_DRAFT });
    await migrate(params);
    /* إعادة تشغيل بمخزن آخر يحمل السجل نفسه (إعادة فتح حقيقية): المفتاح
     * الغائب يعني none — لا ازدواج ولا كتابة ثانية. */
    const reopened = setup();
    await reopened.store.saveFormDraft(
      (await params.store.getFormDraft("finance_event:operating_expense_cash")).value!,
    );
    const result = await migrate(reopened);
    expect(result.status).toBe("none");
  });

  it("malformed JSON is rejected without a crash and stays in place", async () => {
    const params = setup({ [LEGACY]: "{not-json" });
    const result = await migrate(params);
    expect(result.status).toBe("invalid");
    expect(params.storage.getItem(LEGACY)).toBe("{not-json");
    const stored = await params.store.getFormDraft("finance_event:operating_expense_cash");
    expect(stored.ok && stored.value).toBeNull();
  });

  it("wrong field types are rejected by the family coercer and stay in place", async () => {
    const params = setup({ [LEGACY]: JSON.stringify({ note: 42 }) });
    const result = await migrate(params);
    expect(result.status).toBe("invalid");
    expect(params.storage.getItem(LEGACY)).not.toBeNull();
  });

  it("an oversized legacy value is rejected honestly and stays in place", async () => {
    const oversized = JSON.stringify({ note: "ن".repeat(40_000) });
    const params = setup({ [LEGACY]: oversized });
    const result = await migrate(params);
    expect(result.status).toBe("kept");
    if (result.status === "kept") expect(result.code).toBe("too_large");
    expect(params.storage.getItem(LEGACY)).toBe(oversized);
    const stored = await params.store.getFormDraft("finance_event:operating_expense_cash");
    expect(stored.ok && stored.value).toBeNull();
  });

  it("storage failure during the read keeps the legacy value untouched", async () => {
    const params = setup({ [LEGACY]: VALID_DRAFT });
    params.storage.failGet = true;
    const result = await migrate(params);
    expect(result.status).toBe("kept");
    if (result.status === "kept") expect(result.code).toBe("storage_error");
    /* الكتابة الفعلية لم تحدث — إعادة المحاولة بعد الشفاء تجدها كما هي. */
    params.storage.failGet = false;
    const retry = await migrate(params);
    expect(retry.status).toBe("migrated");
  });

  it("a leftover legacy key with an existing verified envelope is cleaned, never overwritten", async () => {
    /* بقايا ترحيل قطع الكتابة وفشل الحذف: السجل قائم فتُنظف البقايا فقط. */
    const params = setup({ [LEGACY]: VALID_DRAFT });
    await params.store.saveFormDraft({
      id: "finance_event:operating_expense_cash",
      formKind: "finance_event",
      scopeId: "operating_expense_cash",
      valuesVersion: 1,
      values: { note: "أحدث من المفتاح" },
      createdAt: NOW,
      updatedAt: NOW,
    });
    const result = await migrate(params);
    expect(result.status).toBe("migrated");
    if (result.status !== "migrated") return;
    expect(result.value.values).toEqual({ note: "أحدث من المفتاح" });
    expect(params.storage.getItem(LEGACY)).toBeNull();
  });

  it("a failed legacy-key removal after a verified write retries safely on the next open", async () => {
    const params = setup({ [LEGACY]: VALID_DRAFT });
    params.storage.failRemove = true;
    const result = await migrate(params);
    expect(result.status).toBe("kept");
    if (result.status === "kept") expect(result.code).toBe("remove_failed");
    /* السجل متحقق والبقايا خاملة — الشفاء ينظفها في المحاولة التالية. */
    params.storage.failRemove = false;
    const retry = await migrate(params);
    expect(retry.status).toBe("migrated");
    expect(params.storage.getItem(LEGACY)).toBeNull();
  });

  it("the setup draft migrates on its own key without creating any financial record", async () => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, () => NOW);
    const storage = memoryStorage({
      [LEGACY_SETUP_DRAFT_KEY]: JSON.stringify({
        step: 3,
        activityName: "مشغل ليان",
        walletName: "الدرج",
        openingChoice: "unknown",
        openingMinor: 0,
        savedAt: "2026-09-01T10:00:00.000Z",
      }),
    });
    const result = await migrateLegacyFormDraft({
      service: drafts,
      storage,
      legacyKey: LEGACY_SETUP_DRAFT_KEY,
      formKind: "setup",
      scopeId: null,
      parse: raw => {
        if (typeof raw !== "object" || raw === null) return null;
        const candidate = raw as Record<string, unknown>;
        return typeof candidate.activityName === "string" ? { ...candidate } : null;
      },
    });
    expect(result.status).toBe("migrated");
    const snapshot = await store.readSnapshot();
    /* لا حدث مالي ولا رصيد — المسودة لا تدخل اللقطة أبدًا. */
    expect(snapshot.ok && (snapshot.value.financialEvents?.length ?? 0)).toBe(0);
    expect(JSON.stringify(snapshot.ok ? snapshot.value : {})).not.toContain("مشغل ليان");
    expect(storage.getItem(LEGACY_SETUP_DRAFT_KEY)).toBeNull();
  });

  it("clearLegacyFormDraftStorage removes only the draft keys of the old system", () => {
    const storage = memoryStorage({
      [LEGACY_SETUP_DRAFT_KEY]: "{}",
      [legacyFinanceDraftKey("owner_investment_cash")]: "{}",
      [legacyFinanceDraftKey("loss_non_cash")]: "{}",
      "micro.diagnostics.v1": "[]",
      "other-unrelated": "keep",
    });
    const removed = clearLegacyFormDraftStorage(storage);
    expect(removed).toBe(3);
    expect(storage.getItem(LEGACY_SETUP_DRAFT_KEY)).toBeNull();
    expect(storage.getItem(legacyFinanceDraftKey("owner_investment_cash"))).toBeNull();
    expect(storage.getItem(legacyFinanceDraftKey("loss_non_cash"))).toBeNull();
    expect(storage.getItem("micro.diagnostics.v1")).toBe("[]");
    expect(storage.getItem("other-unrelated")).toBe("keep");
  });
});
