/** RTL-safe presentation control: keeps editable ASCII numeric text stable and delegates parsing to Application. */
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { allowsEnglishNumericText, blurEnglishNumericText, focusEnglishNumericText, formatEnglishNumericValue, parseEnglishNumericText, type EnglishNumericKind } from "@/application/input/englishNumeric";
import { cn } from "@/lib/utils";

type EnglishNumberInputProps = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "inputMode" | "dir" | "lang"> & {
  value: number | null;
  kind: EnglishNumericKind;
  onNumericChange: (value: number) => void;
  onTextValidityChange?: (isValid: boolean) => void;
  allowEmpty?: boolean;
  onEmptyChange?: () => void;
  clearDefaultZeroOnFocus?: boolean;
};

export function EnglishNumberInput({ value, kind, onNumericChange, onTextValidityChange, allowEmpty = false, onEmptyChange, clearDefaultZeroOnFocus = true, className, onFocus, onBlur, ...props }: EnglishNumberInputProps) {
  const latestCommitted = useRef<number | null>(value);
  const hasUserEdited = useRef(false);
  const [text, setText] = useState(() => formatEnglishNumericValue(value, kind));

  useEffect(() => {
    if (value !== latestCommitted.current) {
      latestCommitted.current = value;
      hasUserEdited.current = false;
      setText(formatEnglishNumericValue(value, kind));
    }
  }, [kind, value]);

  return <input {...props} className={cn("micro-english-number-input", className)} type="text" inputMode={kind === "integer" ? "numeric" : "decimal"} pattern={kind === "integer" ? "[0-9]*" : "[0-9]*[.]?[0-9]*"} lang="en" dir="ltr" value={text} onFocus={event => {
    const next = focusEnglishNumericText(value, text, kind, hasUserEdited.current, clearDefaultZeroOnFocus);
    if (next !== text) setText(next);
    onFocus?.(event);
  }} onChange={event => {
    const next = event.target.value;
    if (allowEmpty && next === "") {
      hasUserEdited.current = true;
      setText("");
      latestCommitted.current = null;
      onTextValidityChange?.(true);
      onEmptyChange?.();
      return;
    }
    if (!allowsEnglishNumericText(next, kind)) {
      hasUserEdited.current = true;
      setText(next);
      onTextValidityChange?.(false);
      return;
    }
    hasUserEdited.current = true;
    setText(next);
    const parsed = parseEnglishNumericText(next, kind);
    onTextValidityChange?.(parsed !== null);
    if (parsed !== null) {
      latestCommitted.current = parsed;
      onNumericChange(parsed);
    }
  }} onBlur={event => {
    const result = blurEnglishNumericText(text, latestCommitted.current, kind, allowEmpty);
    latestCommitted.current = result.committed;
    setText(result.text);
    onTextValidityChange?.(result.valid);
    onBlur?.(event);
  }} />;
}
