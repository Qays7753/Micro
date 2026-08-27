/** Application input boundary: validates ASCII numeric text before it becomes a quantity or JOD minor unit. */
export type EnglishNumericKind = "integer" | "signedInteger" | "decimal" | "money" | "percentage";

const integerPartial = /^[0-9]*$/;
const signedIntegerPartial = /^-?[0-9]*$/;
const decimalPartial = /^[0-9]*(?:\.[0-9]*)?$/;
const moneyPartial = /^[0-9]*(?:\.[0-9]{0,2})?$/;

export function allowsEnglishNumericText(value: string, kind: EnglishNumericKind) {
  if (kind === "integer") return integerPartial.test(value);
  if (kind === "signedInteger") return signedIntegerPartial.test(value);
  if (kind === "money" || kind === "percentage") return moneyPartial.test(value);
  return decimalPartial.test(value);
}

export function parseEnglishNumericText(value: string, kind: EnglishNumericKind): number | null {
  if (!value || !allowsEnglishNumericText(value, kind)) return null;
  if (kind === "integer" || kind === "signedInteger") {
    const pattern = kind === "signedInteger" ? /^-?\d+$/ : /^\d+$/;
    if (!pattern.test(value)) return null;
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

export function parseEnglishQuantityText(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{0,3})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const major = Number(whole);
  const thousandths = Number(`${fraction}000`.slice(0, 3));
  if (!Number.isSafeInteger(major) || major > Math.floor((Number.MAX_SAFE_INTEGER - thousandths) / 1000))
    return null;
  const result = major * 1000 + thousandths;
  return Number.isSafeInteger(result) ? result : null;
}

export function formatEnglishNumericValue(value: number | null, kind: EnglishNumericKind) {
  if (value === null) return "";
  if (kind === "money" || kind === "percentage") return (value / 100).toFixed(2);
  return String(value);
}

export function focusEnglishNumericText(
  value: number | null,
  text: string,
  kind: EnglishNumericKind,
  hasUserEdited: boolean,
  clearDefaultZeroOnFocus: boolean,
) {
  return clearDefaultZeroOnFocus &&
    value === 0 &&
    !hasUserEdited &&
    text === formatEnglishNumericValue(0, kind)
    ? ""
    : text;
}

export function blurEnglishNumericText(
  text: string,
  committed: number | null,
  kind: EnglishNumericKind,
  allowEmpty: boolean,
) {
  const parsed = parseEnglishNumericText(text, kind);
  if (parsed !== null)
    return { text: formatEnglishNumericValue(parsed, kind), committed: parsed, empty: false, valid: true };
  if (allowEmpty && text === "") return { text: "", committed: null, empty: true, valid: true };
  if (text !== "") return { text, committed, empty: false, valid: false };
  return { text: formatEnglishNumericValue(committed, kind), committed, empty: false, valid: true };
}
