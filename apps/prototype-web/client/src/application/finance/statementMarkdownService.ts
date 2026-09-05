/**
 * المجموعة ٥ (عقد ٣٢ — تقرير الفترة المحلي): يولّد نص Markdown عربيًا قابلًا
 * للقراءة من قراءة الكشف القائمة وحدها — لا يعيد حسابًا ولا يعيد تفسيرًا.
 *
 * عقد التقرير:
 * - نسخة قراءة لحظية: «ليست حدثًا ماليًا ولا تغيّر أي رقم» — التاريخ والعنوان
 *   يعلنان ذلك.
 * - أرقام إنجليزية بد.أ بمنزلتين، وتواريخ DD/MM/YYYY — نفس معيّنات العرض.
 * - المجهول يُكتب «غير متاح/غير معروف» لا صفر؛ والعربونات والأمانات ومال
 *   المالك والقروض والأصول مفصولة عن النتيجة بنص صريح.
 * - لا أسرار ولا مفاتيح ولا محتوى قاعدة بيانات خام — سطور قراءة مصدرها
 *   الكشف نفسه.
 * - يعمل دون اتصال: توليد نص محلي خالص؛ التنزيل/المشاركة فعل صريح في الصفحة.
 */
import type { StatementReading } from "./statementService";
import { formatLocalDate, formatMoneyWithUnit, localDateInAmman } from "@/presentation/formatters";

export type StatementMarkdownResult =
  | { ok: true; value: { markdown: string; filename: string } }
  | { ok: false; code: "validation_error"; message: string };

const money = (minor: number | null | undefined): string =>
  minor === null || minor === undefined ? "غير متاح" : formatMoneyWithUnit(minor);

const date = (value: string): string => formatLocalDate(value) ?? value;

function line(label: string, value: string, note?: string): string {
  return `- ${label}: ${value}${note ? ` — ${note}` : ""}`;
}

export class StatementMarkdownService {
  /** التوليد من قراءة كاملة جاهزة — لا قراءة إضافية ولا حساب. */
  render(reading: StatementReading): StatementMarkdownResult {
    if (!reading || !reading.blocks) {
      return { ok: false, code: "validation_error", message: "قراءة الكشف غير متوفرة للتقرير." };
    }
    const generatedOn = localDateInAmman();
    const blocks = reading.blocks;
    const rows: string[] = [];

    rows.push("# كشف فترة — Micro");
    rows.push("");
    rows.push(
      `الفترة: من ${date(reading.from)} إلى ${date(reading.to)} · وُلّد التقرير في ${date(generatedOn)}`,
    );
    rows.push("");
    rows.push("نسخة قراءة لحظية من سجلك المحلي — ليست حدثًا ماليًا ولا تغيّر أي رقم.");
    rows.push("");

    rows.push("## صافي حركة الكاش");
    rows.push("");
    rows.push(
      line("صافي الكاش في الفترة", money(reading.cashNetMinor), "حركة قبض ودفع — ليس ربحًا ولا نتيجة"),
    );
    rows.push("");

    rows.push("## ما دخل من كاش");
    rows.push("");
    if (blocks.cashIn.length === 0) rows.push("- لا حركات كاش داخلة في هذه الفترة.");
    for (const item of blocks.cashIn) {
      rows.push(line(item.label, money(item.amountMinor), item.qualifier ?? undefined));
    }
    rows.push("");

    rows.push("## ما خرج من كاش");
    rows.push("");
    if (blocks.cashOut.length === 0) rows.push("- لا حركات كاش خارجة في هذه الفترة.");
    for (const item of blocks.cashOut) {
      rows.push(line(item.label, money(item.amountMinor), item.qualifier ?? undefined));
    }
    rows.push("");

    rows.push("## التصحيحات الموثقة في الفترة");
    rows.push("");
    if (blocks.corrections.lines.length === 0) {
      rows.push("- لا تصحيحات موثقة في هذه الفترة.");
    } else {
      for (const correction of blocks.corrections.lines) {
        rows.push(
          line(
            `${correction.familyLabel} (${date(correction.occurredOn)})`,
            money(correction.netEffectMinor),
            `السبب: ${correction.reason}`,
          ),
        );
      }
      rows.push(line("صافي أثر التصحيحات", money(blocks.corrections.netMinor)));
    }
    rows.push("");

    rows.push("## نتيجة الفترة");
    rows.push("");
    const result = reading.result;
    if (result.resultMinor === null) {
      rows.push("- النتيجة: غير متاحة حتى الآن — أسبابها معلنة أدناه، والمجهول لا يُعرض صفرًا.");
    } else {
      rows.push(line("النتيجة المسجّلة", money(result.resultMinor)));
      rows.push(
        line(
          "مكوناتها",
          `إيراد معترف به ${money(reading.recognizedRevenueTotalMinor)} · تكلفة مباشرة ${money(result.effectiveDirectCostMinor)} · مصاريف تشغيلية ${money(result.recordedOperatingExpenseMinor)}`,
        ),
      );
    }
    /* المجموعة ٥ (عقد ٣١): بنود عقد ٢٩ غير النقدية داخل النتيجة — تظهر
     * صراحةً في التقرير كما في الكشف. */
    const deep = blocks.deepFinance;
    rows.push(line("إهلاك الأصول في الفترة", money(deep.depreciationMinor), "غير نقدي — يخفض النتيجة"));
    rows.push(line("خسارة شطب أصول", money(deep.writeOffLossMinor), "غير نقدي"));
    rows.push(line("نتيجة التخلص من أصول", money(deep.disposalResultMinor)));
    rows.push(
      line(
        "عربون محتفظ به مصنّف إيرادًا",
        money(deep.retainedDepositRevenueMinor),
        "مصنّف بقرار موثق — الكاش قُبض سابقًا",
      ),
    );
    rows.push("");

    rows.push("## طبقات مستقلة — الآن");
    rows.push("");
    rows.push(line("الأمانات بحوزتك", money(blocks.amanah.heldNowMinor), "كاش موجود ليس ملكك ولا ربحك"));
    rows.push(line("الدفتري للأصول النشطة", money(deep.assetBookValueNowMinor), "ليس مصروفًا ولا كاشًا"));
    rows.push(line("القروض القائمة", money(deep.loansOutstandingNowMinor), "ذمم لصالح مشروعك — ليست نتيجة"));
    rows.push(
      line(
        "عربونات محتفظة بانتظار القرار",
        money(deep.pendingRetainedDepositsNowMinor),
        "ليست مالكًا ولا إيرادًا بعد",
      ),
    );
    rows.push(line("لي عند العملاء (ذمم)", money(blocks.receivablesPayables.receivablesNowMinor)));
    rows.push(line("للموردين (التزامات)", money(blocks.receivablesPayables.payablesNowMinor)));
    rows.push(line("مال المالك المستثمر", money(blocks.owner.investedMinor), "ليس نتيجة"));
    rows.push("");

    if (deep.unresolved.length > 0) {
      rows.push("## قيم غير محلولة");
      rows.push("");
      for (const unresolved of deep.unresolved) {
        const count =
          unresolved.count !== null && unresolved.count !== undefined ? ` (${unresolved.count})` : "";
        rows.push(line(`${unresolved.label}${count}`, money(unresolved.amountMinor)));
      }
      rows.push("");
    }

    rows.push("## مصاريفي حسب تصنيفي");
    rows.push("");
    if (reading.expenseCategories.length === 0) {
      rows.push("- لا مصاريف مصنّفة في هذه الفترة.");
    } else {
      for (const group of reading.expenseCategories) {
        rows.push(line(group.label, money(group.totalMinor), group.classified ? "تصنيفك" : "بلا وسم"));
      }
    }
    rows.push("");

    rows.push("## الحقائق");
    rows.push("");
    for (const truth of reading.truthLines) rows.push(`- ${truth}`);
    rows.push("");

    rows.push("---");
    rows.push(
      "ولّد محليًا على جهازك · Micro · التقرير لا يُرسل شيئًا ولا يفتح شيئًا — مشاركته قرارك اليدوي وحدها.",
    );

    const markdown = rows.join("\n");
    return {
      ok: true,
      value: { markdown, filename: `micro-statement-${reading.from}-${reading.to}.md` },
    };
  }
}
