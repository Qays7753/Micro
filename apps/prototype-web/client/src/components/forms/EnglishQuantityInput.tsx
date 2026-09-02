/** RTL-safe quantity input: accepts ASCII decimals and emits integer thousandths, never a persisted float. */
import { type ComponentProps, useEffect, useRef, useState } from "react";
import {
  normalizeAsciiDigits, parseEnglishQuantityText } from "@/application/input/englishNumeric";
import { cn } from "@/lib/utils";

const quantityPartial = /^\d*(?:\.\d{0,3})?$/;
const formatMilli = (value: number | null) =>
  value === null ? "" : (value / 1000).toFixed(3).replace(/\.0+$/, "");
export function focusQuantityText(
  valueMilli: number | null,
  text: string,
  hasUserEdited: boolean,
  clearDefaultZeroOnFocus: boolean,
) {
  const defaultText = formatMilli(0);
  return clearDefaultZeroOnFocus && valueMilli === 0 && !hasUserEdited && text === defaultText ? "" : text;
}
export function blurQuantityText(text: string, committed: number | null, allowEmpty = false) {
  const parsed = parseEnglishQuantityText(text);
  if (parsed !== null) return { text: formatMilli(parsed), committed: parsed, valid: true };
  if (allowEmpty && text === "") return { text: "", committed: null, valid: true };
  if (text !== "") return { text, committed, valid: false };
  return { text: formatMilli(committed), committed, valid: true };
}
type Props = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode" | "dir" | "lang"
> & {
  valueMilli: number | null;
  onMilliChange: (value: number) => void;
  onTextValidityChange?: (valid: boolean) => void;
  allowEmpty?: boolean;
  onEmptyChange?: () => void;
  clearDefaultZeroOnFocus?: boolean;
};

export function EnglishQuantityInput({
  valueMilli,
  onMilliChange,
  onTextValidityChange,
  allowEmpty = false,
  onEmptyChange,
  clearDefaultZeroOnFocus = true,
  className,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const committed = useRef<number | null>(valueMilli);
  const hasUserEdited = useRef(false);
  const [text, setText] = useState(() => formatMilli(valueMilli));
  useEffect(() => {
    if (committed.current !== valueMilli) {
      committed.current = valueMilli;
      hasUserEdited.current = false;
      setText(formatMilli(valueMilli));
    }
  }, [valueMilli]);
  return (
    <input
      {...props}
      className={cn("micro-english-number-input", className)}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]{0,3}"
      lang="en"
      dir="ltr"
      value={text}
      onFocus={event => {
        const next = focusQuantityText(valueMilli, text, hasUserEdited.current, clearDefaultZeroOnFocus);
        if (next !== text) setText(next);
        onFocus?.(event);
      }}
      onChange={event => {
        /* المجموعة ٦ (البند ٥): تطبيع حدود الإدخال قبل فحص النمط. */
        const next = normalizeAsciiDigits(event.target.value);
        if (allowEmpty && next === "") {
          hasUserEdited.current = true;
          setText("");
          committed.current = null;
          onTextValidityChange?.(true);
          onEmptyChange?.();
          return;
        }
        if (!quantityPartial.test(next)) {
          hasUserEdited.current = true;
          setText(next);
          onTextValidityChange?.(false);
          return;
        }
        hasUserEdited.current = true;
        setText(next);
        const parsed = parseEnglishQuantityText(next);
        onTextValidityChange?.(parsed !== null);
        if (parsed !== null) {
          committed.current = parsed;
          onMilliChange(parsed);
        }
      }}
      onBlur={event => {
        const result = blurQuantityText(text, committed.current, allowEmpty);
        committed.current = result.committed;
        setText(result.text);
        onTextValidityChange?.(result.valid);
        onBlur?.(event);
      }}
    />
  );
}
