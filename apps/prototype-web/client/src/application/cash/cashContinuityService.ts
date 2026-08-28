import {
  createCashContinuityEntry,
  createCashWallet,
  summarizeCashContinuity,
  type CashContinuityEntry,
  type CashWallet,
  type CashWalletKind,
} from "@micro-domain/cash-continuity/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type CashContinuityResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };
export type CashWalletBalance = CashWallet & { balanceMinor: number; entryCount: number };
export type CashContinuityOverview = {
  wallets: readonly CashWalletBalance[];
  totalWalletCashMinor: number;
  entryCount: number;
  truth: string;
};
export type OpenWalletInput = {
  name: string;
  kind: CashWalletKind;
  openingMinor: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type AdjustCashInput = {
  walletId: string;
  deltaMinor: number;
  occurredOn: string;
  note: string;
  reason: string;
  operationKey: string;
};
export type TransferCashInput = {
  fromWalletId: string;
  toWalletId: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type ReverseCashInput = { entryId: string; occurredOn: string; reason: string; operationKey: string };

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storageFailure = <T>(): CashContinuityResult<T> => ({
  ok: false,
  code: "storage_error",
  message: "تعذر حفظ استمرارية الكاش محليًا. لم يتم تأكيد نجاح العملية.",
});

export class CashContinuityService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async overview(): Promise<CashContinuityResult<CashContinuityOverview>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة محافظ الكاش المحلية." };
    const balances = wallets.value.map(wallet => {
      const walletEntries = entries.value.filter(entry => entry.walletId === wallet.id);
      return {
        ...wallet,
        balanceMinor: summarizeCashContinuity(walletEntries),
        entryCount: walletEntries.length,
      };
    });
    return {
      ok: true,
      value: {
        wallets: balances,
        totalWalletCashMinor: balances.reduce((sum, wallet) => sum + wallet.balanceMinor, 0),
        entryCount: entries.value.length,
        truth:
          "هذه المحافظ تسجل فقط الافتتاح والتحويلات والضبط الذي ربطته بها. تحصيلات الطلبات والمصاريف والمشتريات السابقة تبقى كاشًا غير موزع إلى أن يسجل لها عقد توزيع صريح.",
      },
    };
  }

  async entries(): Promise<CashContinuityResult<readonly CashContinuityEntry[]>> {
    const result = await this.store.listCashContinuityEntries();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة سجل استمرارية الكاش." };
  }

  async openWallet(
    input: OpenWalletInput,
  ): Promise<CashContinuityResult<{ wallet: CashWallet; opening: CashContinuityEntry | null }>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok) return storageFailure();
    const repeatedWallet = wallets.value.find(wallet => wallet.createdOperationKey === input.operationKey);
    const repeatedOpening = entries.value.find(entry => entry.operationKey === input.operationKey);
    if (repeatedWallet)
      return { ok: true, value: { wallet: repeatedWallet, opening: repeatedOpening ?? null }, reused: true };
    try {
      if (!Number.isInteger(input.openingMinor) || input.openingMinor < 0)
        throw new Error("رصيد البداية يجب أن يكون مبلغًا صحيحًا موجبًا أو صفرًا.");
      const wallet = createCashWallet({
        id: id("wallet"),
        name: input.name,
        kind: input.kind,
        createdAt: this.now(),
        createdOperationKey: input.operationKey,
      });
      const opening =
        input.openingMinor === 0
          ? null
          : createCashContinuityEntry({
              id: id("opening"),
              walletId: wallet.id,
              type: "opening_balance",
              occurredOn: input.occurredOn,
              recordedAt: this.now(),
              cashDeltaMinor: input.openingMinor,
              note: input.note,
              operationKey: input.operationKey,
            });
      const saved = await this.store.commitCashContinuity(wallet, opening ? [opening] : []);
      return saved.ok ? { ok: true, value: { wallet, opening } } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات محفظة الكاش غير صالحة.",
      };
    }
  }

  async adjust(input: AdjustCashInput): Promise<CashContinuityResult<CashContinuityEntry>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok) return storageFailure();
    const repeated = entries.value.find(entry => entry.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (!wallets.value.some(wallet => wallet.id === input.walletId))
      return { ok: false, code: "validation_error", message: "اختر محفظة كاش موجودة قبل ضبط رصيدها." };
    try {
      const entry = createCashContinuityEntry({
        id: id("adjustment"),
        walletId: input.walletId,
        type: "cash_adjustment",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: input.deltaMinor,
        note: input.note,
        reason: input.reason,
        operationKey: input.operationKey,
      });
      const saved = await this.store.commitCashContinuity(null, [entry]);
      return saved.ok ? { ok: true, value: entry } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات ضبط الكاش غير صالحة.",
      };
    }
  }

  async transfer(input: TransferCashInput): Promise<CashContinuityResult<readonly CashContinuityEntry[]>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok) return storageFailure();
    const repeated = entries.value.filter(entry => entry.operationKey === input.operationKey);
    if (repeated.length) return { ok: true, value: repeated, reused: true };
    if (
      !wallets.value.some(wallet => wallet.id === input.fromWalletId) ||
      !wallets.value.some(wallet => wallet.id === input.toWalletId)
    )
      return { ok: false, code: "validation_error", message: "اختر محافظتين موجودتين للتحويل." };
    if (input.fromWalletId === input.toWalletId)
      return { ok: false, code: "validation_error", message: "لا يمكن التحويل إلى المحفظة نفسها." };
    try {
      const transferId = id("transfer");
      const out = createCashContinuityEntry({
        id: id("transfer-out"),
        walletId: input.fromWalletId,
        type: "transfer_out",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: -input.amountMinor,
        note: input.note,
        operationKey: input.operationKey,
        transferId,
      });
      const into = createCashContinuityEntry({
        id: id("transfer-in"),
        walletId: input.toWalletId,
        type: "transfer_in",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: input.amountMinor,
        note: input.note,
        operationKey: input.operationKey,
        transferId,
      });
      const saved = await this.store.commitCashContinuity(null, [out, into]);
      return saved.ok ? { ok: true, value: [out, into] } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التحويل غير صالحة.",
      };
    }
  }

  async reverse(input: ReverseCashInput): Promise<CashContinuityResult<readonly CashContinuityEntry[]>> {
    const entriesResult = await this.store.listCashContinuityEntries();
    if (!entriesResult.ok) return storageFailure();
    const entries = entriesResult.value;
    const repeated = entries.filter(entry => entry.operationKey === input.operationKey);
    if (repeated.length) return { ok: true, value: repeated, reused: true };
    const target = entries.find(entry => entry.id === input.entryId);
    if (!target) return { ok: false, code: "validation_error", message: "لم نجد أثر الكاش الذي تريد عكسه." };
    if (target.type === "reversal")
      return {
        ok: false,
        code: "validation_error",
        message: "لا يعكس هذا الإصدار أثر عكس سابق؛ سجّل ضبط كاش بسبب بدلًا من ذلك.",
      };
    const targets = target.transferId
      ? entries.filter(entry => entry.transferId === target.transferId)
      : [target];
    if (targets.length === 0 || (target.transferId && targets.length !== 2))
      return { ok: false, code: "validation_error", message: "أثر التحويل غير متوازن ولا يمكن عكسه بأمان." };
    if (targets.some(entry => entries.some(candidate => candidate.reversesEntryId === entry.id)))
      return {
        ok: false,
        code: "validation_error",
        message: "تم عكس هذا الأثر سابقًا. لا يمكن عكسه مرة ثانية.",
      };
    try {
      const reversalTransferId = target.transferId ? id("reversal-transfer") : null;
      const reversals = targets.map(entry =>
        createCashContinuityEntry({
          id: id("reversal"),
          walletId: entry.walletId,
          type: "reversal",
          occurredOn: input.occurredOn,
          recordedAt: this.now(),
          cashDeltaMinor: -entry.cashDeltaMinor,
          note: `عكس: ${entry.note}`,
          reason: input.reason,
          operationKey: input.operationKey,
          transferId: reversalTransferId,
          reversesEntryId: entry.id,
        }),
      );
      const saved = await this.store.commitCashContinuity(null, reversals);
      return saved.ok ? { ok: true, value: reversals } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات عكس الكاش غير صالحة.",
      };
    }
  }
}
