import type { ReactNode } from "react";
import { formatInteger, formatLocalDate, formatLocalDateTime, formatMoneyMinor, formatMonthLabel, formatQuantityMilli, formatTime } from "@/presentation/formatters";

type ValueProps = { className?: string; children?: ReactNode };

type MoneyValueProps = ValueProps & { minor: number | null | undefined; showPlus?: boolean };
export function MoneyValue({ minor, className = "micro-number", showPlus = false }: MoneyValueProps) {
  return <bdi dir="ltr" className={className} data-negative={minor !== null && minor !== undefined && minor < 0}>{showPlus && minor !== null && minor !== undefined && minor > 0 ? "+" : ""}{formatMoneyMinor(minor)}</bdi>;
}

export function IntegerValue({ value, className = "micro-number" }: ValueProps & { value: number | null | undefined }) {
  return <bdi dir="ltr" className={className}>{formatInteger(value)}</bdi>;
}

export function QuantityValue({ valueMilli, className = "micro-number" }: ValueProps & { valueMilli: number | null | undefined }) {
  return <bdi dir="ltr" className={className}>{formatQuantityMilli(valueMilli)}</bdi>;
}

export function LocalDateValue({ value, className = "micro-local-date" }: ValueProps & { value: string | null | undefined }) {
  return <bdi dir="ltr" className={className}>{formatLocalDate(value) ?? "غير متاح"}</bdi>;
}

export function DateTimeValue({ value, className = "micro-local-date" }: ValueProps & { value: string | null | undefined }) {
  return <bdi dir="ltr" className={className}>{formatLocalDateTime(value) ?? "غير متاح"}</bdi>;
}

export function MonthValue({ value, className = "micro-local-date" }: ValueProps & { value: string }) {
  return <bdi dir="ltr" className={className}>{formatMonthLabel(value)}</bdi>;
}

export function TimeValue({ value, className = "micro-local-date" }: ValueProps & { value: string | null | undefined }) {
  return <bdi dir="ltr" className={className}>{formatTime(value) ?? "وقت غير محدد"}</bdi>;
}
