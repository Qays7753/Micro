/**
 * Wave 3A (ARCH-002 / WS-212 — STR-405): اختبارات وصف مباشرة لمدققات العائلات.
 *
 * transferFamilyValidators.ts (1,715 سطرًا، 75 مُصدَّرًا) كانت بلا اختبارات
 * مباشرة إطلاقًا — كل تغطيتها كانت غير مباشرة عبر localTransferService. هذا
 * الملف يثبّت سلوكها الحالي مباشرة: مجموعات القيم المقبولة، والرفض الصارم
 * للقيم الغريبة، وقواعد التقاطع الميدانية، وvalidateSnapshot على بيانات
 * الذهبي الحقيقية.
 *
 * هذا وصف لا مواصفة: يثبت ما هو عليه السلوك اليوم. توحيد مصدر القيم مع
 * اتحادات المجال هو عمل الموجة 3B (غارد الدريفت) و4D (إكمال مصدر الحقيقة).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRecord,
  isString,
  isDate,
  isMoney,
  isKnownState,
  isResultStatus,
  isOrderStatus,
  isSettlement,
  isScheduleStatus,
  isAgreementSource,
  isLocalDate,
  isRecurrenceFrequency,
  isRecurrenceStatus,
  isDirectSale,
  isCorrectionType,
  isUnitDimension,
  isCashWalletKind,
  isCashEntryType,
  isMaterialUnit,
  isInventoryMovementType,
  isExpenseCategoryLabel,
  isExpenseContext,
} from "./transferFamilyValidators";
import { validateSnapshot } from "./transferSnapshotValidation";
import { file817 } from "./historical817.fixture";
import { migrateTransferSnapshot } from "./transferSnapshotMigrations";

const GOLDEN_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../docs/fixtures/export-goldens",
);

/** وصف مجموعة قبول قيم: كل مقبول يقبل، وكل قيمة غريبة تُرفض. */
function characterizesSet(
  name: string,
  guard: (v: unknown) => boolean,
  accepted: unknown[],
  rejected: unknown[],
) {
  describe(`${name} — accepted value set`, () => {
    for (const value of accepted) {
      it(`accepts ${JSON.stringify(value)}`, () => {
        expect(guard(value)).toBe(true);
      });
    }
    for (const value of rejected) {
      it(`rejects ${JSON.stringify(value)}`, () => {
        expect(guard(value)).toBe(false);
      });
    }
  });
}

characterizesSet(
  "isOrderStatus",
  isOrderStatus,
  [
    "draft",
    "provisional_agreement",
    "confirmed",
    "in_progress",
    "ready",
    "delivered",
    "settled",
    "postponed",
    "cancelled",
    "needs_review",
  ],
  ["Delivered", "settled ", "", "unknown", null, 7],
);

characterizesSet(
  "isSettlement",
  isSettlement,
  [
    "unpaid",
    "partially_paid",
    "paid",
    "debt",
    "cancelled",
    "cancelled_pending",
    "cancelled_refunded",
    "cancelled_retained",
  ],
  ["paid ", "PAID", "unknown", undefined],
);

characterizesSet(
  "isKnownState",
  isKnownState,
  ["known", "estimated", "incomplete", "variable", "stale", "partial"],
  ["known?", "KNOWN", "unknown", 1],
);

characterizesSet(
  "isResultStatus",
  isResultStatus,
  ["final", "estimated", "incomplete", "review_required"],
  ["finalized", "review", ""],
);

characterizesSet(
  "isScheduleStatus",
  isScheduleStatus,
  ["scheduled", "postponed", "completed", "cancelled"],
  [" Scheduled", "archived"],
);

characterizesSet(
  "isAgreementSource",
  isAgreementSource,
  [null, "instagram", "whatsapp", "referral", "walk_in", "other", "conversation", "call", "in_person"],
  ["tiktok", undefined, 3],
);

characterizesSet(
  "isRecurrenceFrequency",
  isRecurrenceFrequency,
  ["weekly", "monthly"],
  ["daily", "yearly", null],
);

characterizesSet("isRecurrenceStatus", isRecurrenceStatus, ["active", "cancelled"], ["paused", "expired"]);

describe("primitive guards", () => {
  it("isRecord accepts objects and rejects arrays/null/primitives", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });

  it("isMoney accepts safe integers and rejects floats/strings/NaN", () => {
    expect(isMoney(0)).toBe(true);
    expect(isMoney(12_345)).toBe(true);
    expect(isMoney(1.5)).toBe(false);
    expect(isMoney("5" as never)).toBe(false);
    expect(isMoney(Number.NaN)).toBe(false);
    expect(isMoney(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it("isDate accepts any Date.parse-able string (ISO and local dates) and rejects garbage", () => {
    expect(isDate("2026-10-03T10:00:00.000Z")).toBe(true);
    /* السلوك الحالي: التاريخ المحلي القصير يقبل أيضًا (Date.parse) — وصف لا رأي. */
    expect(isDate("2026-10-03")).toBe(true);
    expect(isDate("not-a-date")).toBe(false);
    expect(isDate(20261003)).toBe(false);
  });

  it("isLocalDate accepts YYYY-MM-DD and rejects other shapes", () => {
    expect(isLocalDate("2026-10-03")).toBe(true);
    expect(isLocalDate("2026-10-3")).toBe(false);
    expect(isLocalDate("2026-10-03T00:00:00Z")).toBe(false);
  });

  it("isLocalDate rejects well-formed but semantically invalid dates (2026-13-01) — R2 M-03 flip, 2026-10-08", () => {
    /* قلب موثق (M-03/D2): كان يرمي RangeError من toISOString بلا حارس NaN
     * (سلوك موصوف في 3A) — الآن المدقق يفوّض لنواة المجال فيرجع false
     * بلا رمي أبدًا، وprepareImport محروس برمي مهيكل عند أي حد غير متوقع. */
    expect(() => isLocalDate("2026-13-01")).not.toThrow();
    expect(isLocalDate("2026-13-01")).toBe(false);
  });
});

describe("compound guards", () => {
  it("isExpenseCategoryLabel: optional string within normalized length; non-strings rejected", () => {
    for (const value of ["إيجار", "توصيل", "رواتب", null, undefined, "   "]) {
      /* الفراغ الأبيض يقبل في هذه الطبقة — التطبيع يجري في خريطة الترحيل قبلها. */
      expect(isExpenseCategoryLabel(value), JSON.stringify(value)).toBe(true);
    }
    expect(isExpenseCategoryLabel(5)).toBe(false);
    expect(isExpenseCategoryLabel("x".repeat(81))).toBe(false);
    expect(isExpenseCategoryLabel("x".repeat(80))).toBe(true);
  });

  it("isExpenseContext accepts the full relationship/behavior/purpose/knowledge shape", () => {
    expect(
      isExpenseContext({
        relationship: "project",
        behavior: "variable",
        purpose: "order",
        knowledge: "known",
      }),
    ).toBe(true);
    expect(
      isExpenseContext({
        relationship: "shared",
        behavior: "fixed",
        purpose: "period",
        knowledge: "estimated",
        /* الحصة الإلزامية للعلاقة المشتركة تُفحص عند هذه الطبقة. */
        sharedProjectShare: null,
      }),
    ).toBe(true);
    for (const bad of [
      { relationship: "personal", behavior: "variable", purpose: "order", knowledge: "known" },
      { relationship: "project", behavior: "sometimes", purpose: "order", knowledge: "known" },
      { relationship: "project", behavior: "variable", purpose: "general", knowledge: "known" },
      { relationship: "project", behavior: "variable", purpose: "order", knowledge: "maybe" },
    ]) {
      expect(isExpenseContext(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(isExpenseContext(null)).toBe(false);
  });

  it("isUnitDimension accepts the canonical dimension set", () => {
    for (const value of ["count", "mass", "volume", "time", "distance", "area"]) {
      expect(isUnitDimension(value), value).toBe(true);
    }
    expect(isUnitDimension("length")).toBe(false);
    expect(isUnitDimension("weight")).toBe(false);
  });

  it("isCorrectionType accepts only the reverse kind (and absence) — everything else rejected", () => {
    /* السلوك الحالي: التصحيح في ملفات النقل نوع واحد فقط «reverse» أو غياب. */
    expect(isCorrectionType("reverse")).toBe(true);
    expect(isCorrectionType(undefined)).toBe(true);
    expect(isCorrectionType(null)).toBe(true);
    for (const bad of ["delivery_reversal", "correction", "magic_fix", 1]) {
      expect(isCorrectionType(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("isDirectSale validates the current direct-sale record shape", () => {
    const sale = {
      id: "ds-1",
      itemName: "شمع",
      quantity: 2,
      currency: "JOD",
      revenueMinor: 1000,
      collectedMinor: 1000,
      /* الحالة الاسمية للقبض — القيم الموثقة لا «paid». */
      collectionStatus: "collected_in_full",
      catalogItemId: null,
      customerName: null,
      costMinor: null,
      profitMinor: null,
      note: "بيع نقدي",
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T09:00:00.000Z",
      idempotencyKey: "ds-key-1",
      status: "active",
      corrections: [],
      revisions: [
        {
          kind: "edit",
          /* مفتاح المراجعة يجب أن يختلف عن مفتاح السجل نفسه — من قواعد التقاطع. */
          idempotencyKey: "ds-key-1-rev1",
          createdAt: "2026-09-01T10:00:00.000Z",
          reason: null,
        },
      ],
    };
    expect(isDirectSale(sale)).toBe(true);
    expect(isDirectSale({ ...sale, collectionStatus: "paid" })).toBe(false);
    expect(isDirectSale({ ...sale, collectionStatus: "partial_debt" })).toBe(true);
    expect(isDirectSale({ ...sale, quantity: 0 })).toBe(false);
    expect(isDirectSale({ ...sale, collectedMinor: 1500, revenueMinor: 1000 })).toBe(false);
    expect(isDirectSale({ ...sale, currency: "USD" })).toBe(false);
    expect(isDirectSale(null)).toBe(false);
  });
});

describe("validateSnapshot — direct structural validation", () => {
  it("accepts the faithful 8/17 snapshot after migration (real historical data)", () => {
    /* عهدة 8/17 الخام شكل تاريخي — الفحص البنيوي يستهدف البيانات بعد الترحيل. */
    const migrated = migrateTransferSnapshot(file817.data as never, false);
    expect(validateSnapshot(migrated)).toBe(true);
  });

  it("accepts the frozen supplement golden data", () => {
    const golden = JSON.parse(
      readFileSync(path.join(GOLDEN_DIR, "current-pair-supplement.golden.json"), "utf8"),
    );
    expect(validateSnapshot(golden.data)).toBe(true);
  });

  it("rejects non-object and empty payloads", () => {
    expect(validateSnapshot(null)).toBe(false);
    expect(validateSnapshot([])).toBe(false);
    expect(validateSnapshot({})).toBe(false);
  });

  it("rejects an unknown order status inside the snapshot (predicate is wired, not decorative)", () => {
    const golden = JSON.parse(
      readFileSync(path.join(GOLDEN_DIR, "current-pair-supplement.golden.json"), "utf8"),
    );
    const tampered = structuredClone(golden.data);
    if (tampered.orders?.length) {
      tampered.orders[0].order.status = "teleported";
      expect(validateSnapshot(tampered)).toBe(false);
    } else {
      /* لا أوامر في الملف — نحقن واحدًا تالفًا مباشرة. */
      tampered.orders = [
        {
          order: { id: "x", status: "teleported" },
          agreement: null,
          events: [],
        },
      ];
      expect(validateSnapshot(tampered)).toBe(false);
    }
  });
});

/* السلاسل الفارغة أدناه تُستكمل بمجموعات القيم الحقيقية من المصدر في الموجة 3B
 * (غارد الدريفت يقارن اتحادات المجال بمجموعات القبول هنا آليًا) — لا نكرر
 * القيم يدويًا هنا ثانية لئلا نصنع النسخة الثالثة من نفس الخطر. */
void isCashWalletKind;
void isCashEntryType;
void isMaterialUnit;
void isInventoryMovementType;
void isString;
