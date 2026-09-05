import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

const now = () => "2026-09-03T09:00:00.000Z";

/* المجموعة ١ (تصنيفي للمصاريف) — عقد التصدير ٢٣/مخطط ٣١:
 * الوسم يعبر دورة التصدير-التحقق-الاستيراد كاملة، وملفات الموجة السابقة
 * (٢٢/٣٠) تُقبل وتُهاجر بغياب الوسم (null) بلا تعبئة افتراضية ولا اختراع.
 * ويشمل الإصلاح: عكس التحويل يعبر الدورة بعد إصلاح مجموعات التحويل. */

async function recordLabeledExpense(
  finance: ProjectFinancialService,
  overrides: { idempotencyKey: string; categoryLabel?: string | null },
) {
  const result = await finance.record({
    type: "operating_expense_cash",
    amountMinor: 2500,
    occurredOn: "2026-09-03",
    note: "بنزين السيارة",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: overrides.categoryLabel ?? null,
    },
    idempotencyKey: overrides.idempotencyKey,
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe("schema 31 export round-trip with expense category labels", () => {
  it("round-trips a labeled expense through a verified export (label preserved verbatim)", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await recordLabeledExpense(finance, { idempotencyKey: "label-round-trip", categoryLabel: "بنزين" });
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    expect(verified.value.file.version).toBe(localExportVersion);
    expect(verified.value.file.schemaVersion).toBe(localSchemaVersion);
    /* المجموعة ٢: الرقم الحي صار ٢٤/٣٢ — ملف المجموعة ١ يُهاجر ضمن أحدث زوج. */
    /* المجموعة ٣ (عقد D3): زوج الإصدار انتقل إلى ٢٥/٣٣ مع حقول ربط المنتج
     * بالبيع — السلوك المدقق نفسه يبقى على الزوج الحي. */
    expect(verified.value.file.version).toBe(27);
    expect(verified.value.file.schemaVersion).toBe(35);

    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(verified.value.file));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const events = await new ProjectFinancialService(target, now).listEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value[0]?.expenseContext?.categoryLabel).toBe("بنزين");
  });

  it("accepts and migrates a legacy 22/30 export: absent labels become null, never invented", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const labeled = await recordLabeledExpense(finance, { idempotencyKey: "legacy-labeled" });
    const transfers = new LocalTransferService(store, now);
    const current = await transfers.createExport();
    if (!current.ok) throw new Error(current.message);
    /* محاكاة ملف الموجة السابقة: ٢٢/٣٠ وبلا وسم أصلًا. */
    const legacyFile = JSON.parse(JSON.stringify(current.value)) as {
      version: number;
      schemaVersion: number;
      data: { financialEvents: (FinancialEvent & Record<string, unknown>)[] };
    };
    legacyFile.version = 22;
    delete (legacyFile as Record<string, unknown>).integrity;
    delete (legacyFile as Record<string, unknown>).counts;
    delete (legacyFile as Record<string, unknown>).appVersion;

    legacyFile.schemaVersion = 30;
    /* المجموعة ٥: ملفات الموجات القديمة بلا مظروف التكامل — يُحذف عند المحاكاة. */
    delete (legacyFile as Record<string, unknown>).integrity;
    delete (legacyFile as Record<string, unknown>).counts;
    delete (legacyFile as Record<string, unknown>).appVersion;
    for (const event of legacyFile.data.financialEvents)
      if (event.expenseContext) delete event.expenseContext.categoryLabel;
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(legacyFile),
    );
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.version).toBe(localExportVersion);
    expect(prepared.value.file.schemaVersion).toBe(localSchemaVersion);
    expect(prepared.value.file.data.financialEvents[0]?.expenseContext?.categoryLabel).toBeNull();
  });

  it("normalizes imported labels: trim, collapse, blank→null — same rule as the domain", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await recordLabeledExpense(finance, { idempotencyKey: "import-normalize" });
    const transfers = new LocalTransferService(store, now);
    const current = await transfers.createExport();
    if (!current.ok) throw new Error(current.message);
    const file = JSON.parse(JSON.stringify(current.value)) as {
      data: { financialEvents: { expenseContext?: Record<string, unknown> }[] };
    };
    file.data.financialEvents[0]!.expenseContext!.categoryLabel = "  بنزين     وقود   ";
    /* المجموعة ٥: بلا مظروف تكامل — التعديل المُحاكى على ملف بلا بصمة. */
    delete (file as Record<string, unknown>).integrity;
    delete (file as Record<string, unknown>).counts;
    delete (file as Record<string, unknown>).appVersion;
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(file),
    );
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.data.financialEvents[0]?.expenseContext?.categoryLabel).toBe("بنزين وقود");
    file.data.financialEvents[0]!.expenseContext!.categoryLabel = "   ";
    const blankPrepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(file),
    );
    if (!blankPrepared.ok) throw new Error(blankPrepared.message);
    expect(blankPrepared.value.file.data.financialEvents[0]?.expenseContext?.categoryLabel).toBeNull();
  });

  it("rejects a hand-edited file whose label exceeds 80 normalized characters — store untouched", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await recordLabeledExpense(finance, { idempotencyKey: "reject-long" });
    const transfers = new LocalTransferService(store, now);
    const current = await transfers.createExport();
    if (!current.ok) throw new Error(current.message);
    const file = JSON.parse(JSON.stringify(current.value)) as {
      data: { financialEvents: { expenseContext?: Record<string, unknown> }[] };
    };
    file.data.financialEvents[0]!.expenseContext!.categoryLabel = "بنزين".repeat(25);
    const target = new MemoryLocalStore();
    await new ProjectFinancialService(target, now).record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-03",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "untouched",
    });
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    /* فشل التحضير لا يلمس البيانات: الاستثمار باقٍ كما هو. */
    const position = await new ProjectFinancialService(target, now).readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.projectEventCount).toBe(1);
    expect(position.value.recordedCashMinor).toBe(5000);
  });

  it("transfer + documented reversal now round-trips through a verified export (defect fix)", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const drawer = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 50000,
      occurredOn: "2026-09-01",
      note: "بداية",
      operationKey: "open-drawer",
    });
    const bank = await cash.openWallet({
      name: "المصرف",
      kind: "bank_account",
      openingMinor: 0,
      occurredOn: "2026-09-01",
      note: "بداية",
      operationKey: "open-bank",
    });
    if (!drawer.ok || !bank.ok) throw new Error("wallets should save");
    const transferred = await cash.transfer({
      fromWalletId: drawer.value.wallet.id,
      toWalletId: bank.value.wallet.id,
      amountMinor: 20000,
      occurredOn: "2026-09-02",
      note: "تغذية الحساب",
      operationKey: "transfer-1",
    });
    if (!transferred.ok) throw new Error(transferred.message);
    const outEntry = transferred.value.find(entry => entry.type === "transfer_out");
    if (!outEntry) throw new Error("transfer pair missing");
    const reversed = await cash.reverse({
      entryId: outEntry.id,
      occurredOn: "2026-09-03",
      reason: "خطأ في المبلغ",
      operationKey: "transfer-1-reverse",
    });
    if (!reversed.ok) throw new Error(reversed.message);
    /* قبل الإصلاح: مجموعة عكس التحويل تفشل فحص الأزواج فترفض الملف كله. */
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(verified.value.file),
    );
    expect(prepared.ok).toBe(true);
  });
});
