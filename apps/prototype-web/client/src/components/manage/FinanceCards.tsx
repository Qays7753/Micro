/**
 * M5.4/M5.5 (UX P-30 «المالية» — قرار «الرسومات جوا البطاقات»): أجزاء
 * بطاقات المالية القابلة للتطوير — صف الشريط الأفقي (P-34/P-35/P-36
 * وأعمدة الربح داخل بطاقة صافي الربح) وجملتا الأعلى مبيعاً والنسبة.
 *
 * قسمة السطح من FinancePage (كل ملف أسطح مانج تحت شريط المراجعة 400).
 * كل قيمة نص جاهز من الخادم؛ طول الشريط هندسة CSS خالصة (flexGrow نسبي)
 * — لا قسمة ولا تقريب في الواجهة.
 */
import type { JSX } from "react";
import { t } from "@/application/manage/strings";
import { fill, jodDashboardAmount } from "@/application/manage/presentation";
import type { ManageFiguresResponse } from "@/application/manage/api";

/** جملة الأعلى مبيعاً: «{product}: {amount} ({qty} {unit})» — الوحدة من
 *  الخادم (وحدة العرض الحالية)؛ بلا وحدة: الكمية وحدها بين القوسين. */
export function topSalesSentence(product: ManageFiguresResponse["topSellers"][number]): string {
  return fill("c.top_sales", {
    product: product.name,
    amount: jodDashboardAmount(product.valueFils),
    qty: product.quantityText,
    unit: product.unitLabel ?? "",
  }).replace(" )", ")");
}

/** جمل بطاقة الربح والسحوبات (P-30 بند 7): الخسارة تستبدل جملة النسبة،
 *  وصافي مبيعات سالب/صفر يخفيها — والسحوبات وحدها تظهر في الحالتين. */
export function ratioLines(figures: ManageFiguresResponse): JSX.Element {
  const ratio = figures.perTenRatio;
  if (ratio.kind === "loss") {
    return (
      <>
        <p className="micro-manage-card__line">{t("S-LOSS")}</p>
        <p className="micro-manage-card__line micro-manage-card__line--secondary">
          {fill("c.withdrawals_only", { w: figures.personalWithdrawals.textDashboard })}
        </p>
      </>
    );
  }
  if (ratio.kind === "hidden") {
    return (
      <p className="micro-manage-card__line micro-manage-card__line--secondary">
        {fill("c.withdrawals_only", { w: figures.personalWithdrawals.textDashboard })}
      </p>
    );
  }
  return (
    <p className="micro-manage-card__line">
      {fill("c.ratio", {
        x: ratio.text,
        w: figures.personalWithdrawals.textDashboard,
      })}
    </p>
  );
}

/** صف شريط واحد: التسمية + مسار الشريط + القيمة نصًا. طول الملء عبر
 *  flexGrow النسبي (القيمة مقابل أكبر قيمة في مجموعتها) — هندسة تخطيط
 *  CSS خالصة: لا قسمة ولا تقريب في الواجهة (القيمة المعروضة نص جاهز)،
 *  والسالب ينمو بمقداره بوسم سالب. */
export function BarRow(props: {
  label: string;
  value: number;
  peers: readonly number[];
  valueText?: string;
  incomplete?: boolean;
}): JSX.Element {
  const magnitude = props.value < 0 ? -props.value : props.value;
  let max = 0;
  for (const peer of props.peers) {
    const peerMagnitude = peer < 0 ? -peer : peer;
    if (peerMagnitude > max) max = peerMagnitude;
  }
  const rest = max > magnitude ? max - magnitude : 0;
  return (
    <div
      className={
        "micro-manage-bars__bar" +
        (props.incomplete ? " micro-manage-bars__bar--incomplete" : "") +
        (props.value < 0 ? " micro-manage-bars__bar--negative" : "")
      }
    >
      <span className="micro-manage-bars__label">{props.label}</span>
      <span className="micro-manage-bars__track">
        <span className="micro-manage-bars__fill" style={{ flexGrow: magnitude, flexBasis: 0 }} />
        <span className="micro-manage-bars__rest" style={{ flexGrow: rest, flexBasis: 0 }} />
      </span>
      <span className="micro-manage-bars__value">{props.valueText ?? jodDashboardAmount(props.value)}</span>
    </div>
  );
}
