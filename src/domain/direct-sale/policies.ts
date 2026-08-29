import { JOD, fieldLabelAr } from "../shared/index.js";
import type { CreateDirectSaleInput, DirectSale } from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertText(value: string, field: string) {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا.`);
}

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا غير سالب.`);
}

function assertLocalDate(value: string) {
  if (!DATE_PATTERN.test(value)) throw new Error("أدخل تاريخ البيع تاريخًا محليًا صحيحًا.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day)
    throw new Error("أدخل تاريخ البيع تاريخًا محليًا صحيحًا.");
}

export function createDirectSale(input: CreateDirectSaleInput): DirectSale {
  assertText(input.id, "id");
  assertText(input.itemName, "itemName");
  assertText(input.note, "note");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertPositiveInteger(input.quantity, "quantity");
  assertPositiveInteger(input.revenueMinor, "amountMinor");
  if (input.costMinor !== null) assertNonNegativeInteger(input.costMinor, "costMinor");
  assertLocalDate(input.occurredOn);
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");

  return Object.freeze({
    id: input.id.trim(),
    itemName: input.itemName.trim(),
    quantity: input.quantity,
    currency: JOD,
    revenueMinor: input.revenueMinor,
    collectedMinor: input.revenueMinor,
    costMinor: input.costMinor,
    profitMinor: input.costMinor === null ? null : input.revenueMinor - input.costMinor,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    note: input.note.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
  });
}