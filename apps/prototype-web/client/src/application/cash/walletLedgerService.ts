/**
 * المجموعة ٢ (§9.1 — WalletLedger): دفتر محفظة واحدة — قراءة صادقة لحركات الكاش
 * في المحفظة بالتسلسل الزمني مع تمييز الأنواع ووصل كل صف بمصدره حيث يوجد.
 * قراءة فقط: التصحيح يُنفَّذ من سطحه الأصلي (تراجع القيد) بلا مسار كتابة ثانٍ.
 */
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type WalletLedgerRowKind =
  | "opening"
  | "adjustment"
  | "transfer_out"
  | "transfer_in"
  | "allocation_in"
  | "allocation_cover"
  | "reversal";

export type WalletLedgerRow = {
  id: string;
  kind: WalletLedgerRowKind;
  label: string;
  occurredOn: string;
  amountMinor: number;
  balanceAfterMinor: number | null;
  note: string;
  reason: string | null;
  /** وصل المصدر حيث يوجد: بيع/مصروف/تحصيل/طلب — بلا وصل يبقى null. */
  sourceHref: string | null;
  sourceLabel: string | null;
  /** رابط التراجع عن القيد (غير التراجعات نفسها). */
  reversible: boolean;
};

export type WalletLedgerOverview = {
  wallet: CashWallet;
  balanceMinor: number;
  openingUnknown: boolean;
  entryCount: number;
  rows: readonly WalletLedgerRow[];
};

export type WalletLedgerResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "storage_error" | "not_found"; message: string };

const sourceLabelFor = (entry: CashContinuityEntry): { href: string | null; label: string | null } => {
  if (entry.sourceRefId && entry.sourceRefKind) {
    switch (entry.sourceRefKind) {
      case "sale":
        return { href: `/direct-sales/${entry.sourceRefId}`, label: "بيع مباشر — السجل المصدر" };
      case "expense":
        return { href: `/finance?event=${encodeURIComponent(entry.sourceRefId)}`, label: "مصروف — الحدث المصدر" };
      case "collection":
        return { href: `/finance?event=${encodeURIComponent(entry.sourceRefId)}`, label: "تحصيل — الحدث المصدر" };
      case "order":
        return { href: `/orders/${entry.sourceRefId}`, label: "طلب — السجل المصدر" };
    }
  }
  return { href: null, label: null };
};

export class WalletLedgerService {
  constructor(private readonly store: PrototypeLocalStore) {}

  async read(walletId: string): Promise<WalletLedgerResult<WalletLedgerOverview>> {
    const [wallets, entries] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!wallets.ok || !entries.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل المحفظة المحلي." };
    const wallet = wallets.value.find(candidate => candidate.id === walletId);
    if (!wallet)
      return { ok: false, code: "not_found", message: "لم تُعثر على هذه المحفظة." };
    const walletEntries = entries.value
      .filter(entry => entry.walletId === walletId)
      .slice()
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id));
    const reversedEntryIds = new Set(
      walletEntries
        .filter(entry => entry.type === "reversal" && entry.reversesEntryId)
        .map(entry => entry.reversesEntryId),
    );
    let running = 0;
    const rows: WalletLedgerRow[] = walletEntries.map(entry => {
      running += entry.cashDeltaMinor;
      const source = sourceLabelFor(entry);
      const kind: WalletLedgerRowKind =
        entry.type === "opening_balance"
          ? "opening"
          : entry.type === "cash_adjustment"
            ? "adjustment"
            : entry.type === "transfer_out"
              ? "transfer_out"
              : entry.type === "transfer_in"
                ? "transfer_in"
                : entry.type === "allocation"
                  ? entry.cashDeltaMinor > 0
                    ? "allocation_in"
                    : "allocation_cover"
                : "reversal";
      const label =
        kind === "opening"
          ? "رصيد بداية"
          : kind === "adjustment"
            ? "ضبط كاش"
            : kind === "transfer_out"
              ? "تحويل صادر"
              : kind === "transfer_in"
                ? "تحويل وارد"
                : kind === "allocation_in"
                  ? "تخصيص من غير الموزع"
                  : kind === "allocation_cover"
                    ? "تغطية صرف إلى غير الموزع"
                    : "تراجع موثق عن أثر";
      return {
        id: entry.id,
        kind,
        label,
        occurredOn: entry.occurredOn,
        amountMinor: entry.cashDeltaMinor,
        /* الرصيد الجاري يظهر حيث يحمل معنى؛ التراجعات تُعرض بأثرها لا برصيد زمني. */
        balanceAfterMinor: kind === "reversal" ? null : running,
        note: entry.note,
        reason: entry.reason,
        sourceHref: source.href,
        sourceLabel: source.label,
        reversible:
          entry.type !== "reversal" && !reversedEntryIds.has(entry.id) && entry.type !== "opening_balance",
      };
    });
    rows.reverse();
    return {
      ok: true,
      value: {
        wallet,
        balanceMinor: running,
        openingUnknown: wallet.openingStatus === "unknown",
        entryCount: walletEntries.length,
        rows,
      },
    };
  }
}
