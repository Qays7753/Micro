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