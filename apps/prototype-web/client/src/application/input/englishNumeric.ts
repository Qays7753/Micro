/** Application input boundary: validates ASCII numeric text before it becomes a quantity or JOD minor unit. */
export type EnglishNumericKind = "integer" | "decimal" | "money";

const integerPartial = /^[0-9]*$/;
const decimalPartial = /^[0-9]*(?:\.[0-9]*)?$/;
const moneyPartial = /^[0-9]*(?:\.[0-9]{0,2})?$/;

export function allowsEnglishNumericText(value: string, kind: EnglishNumericKind) {
  if (kind === "integer") return integerPartial.test(value);
  if (kind === "money") return moneyPartial.test(value);
  return decimalPartial.test(value);
}

export function parseEnglishNumericText(value: string, kind: EnglishNumericKind): number | null {
  if (!value || !allowsEnglishNumericText(value, kind)) return null;
  if (kind === "integer") {
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (kind === "decimal") {
    if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const major = Number(whole);
  if (!Number.isSafeInteger(major)) return null;
  const cents = Number(`${fraction}00`.slice(0, 2));
  const minor = major * 100 + cents;
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatEnglishNumericValue(value: number | null, kind: EnglishNumericKind) {
  if (value === null) return "";
  if (kind === "money") return (value / 100).toFixed(2);
  return String(value);
}
