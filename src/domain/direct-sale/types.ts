/** A direct sale is its own financial record. It is never inferred from an order collection. */
import type { Currency, MoneyMinor } from "../shared/index.js";

export type DirectSale = {
  id: string;
  itemName: string;
  quantity: number;
  currency: Currency;
  revenueMinor: MoneyMinor;
  collectedMinor: MoneyMinor;
  costMinor: MoneyMinor | null;
  profitMinor: MoneyMinor | null;
  occurredOn: string;
  recordedAt: string;
  note: string;
  idempotencyKey: string;
  /** Optional on legacy local records; missing means active with no corrections. */
  status?: DirectSaleStatus;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  revisions?: readonly DirectSaleRevision[];
};

export type DirectSaleStatus = "active" | "cancelled";
export type DirectSaleRevisionKind = "edit" | "cancel";
export type DirectSaleRevision = {
  kind: DirectSaleRevisionKind;
  idempotencyKey: string;
  createdAt: string;
  reason: string | null;
};

export type CreateDirectSaleInput = {
  id: string;
  itemName: string;
  quantity: number;
  revenueMinor: MoneyMinor;
  costMinor: MoneyMinor | null;
  occurredOn: string;
  recordedAt: string;
  note: string;
  idempotencyKey: string;
};

export type UpdateDirectSaleInput = Pick<
  CreateDirectSaleInput,
  "itemName" | "quantity" | "revenueMinor" | "costMinor" | "occurredOn" | "note"
>;