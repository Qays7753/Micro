/**
 * S17 (DOC-026 / UNIT-044 — الأمر المتصل 2026-11-04): حدود موارد فحص ملف
 * الاستعادة — البوابة التي تسبق قراءة المحتوى وتحليله. عقد ٠٤٤ B3/F
 * (ملف كبير يُرفض برسالة محددة قبل مسح أي شيء) وحالة SDF-048، مقيدة ببوابة
 * D03: «قياس وعقد قائم، لا حد اعتباطي أو رفض مشروع كبير بلا سبب».
 *
 * الاشتقاق الموثق للسقف (٢^٢٤ وحدة UTF-16):
 *  - أكبر ملف نسخة صادق مقيس في المستودع (الذهبي الحالي بتغطية كل العائلات
 *    ≈ ١٣ ألف حرف) — ألف ضعفه ما زال دون السقف بمراحل، فلا يُرفض مشروع
 *    صادق واقعي (آلاف السجلات) أبدًا.
 *  - خط الأنابيب كله (قراءة النص ← JSON.parse ← الترحيل ← التحقق ← بصمة
 *    كنونية) يحمل نحو ٣–٥ أضعاف حجم النص في الذاكرة عابرًا؛ سقف ٢^٢٤ وحدة
 *    يبقي الذروة داخل غلاف متصفح هاتف عملي ويصدّ الملفات التي لا يستطيع
 *    الجهاز فحصها بأمان قبل أن يقرأها أصلًا.
 *  - القيد المعلن: لم يُقس على جهاز هاتف فعلي بعد (بوابات DEVICE الخارجية
 *    باقية)؛ السقف وقائي قابل للمراجعة بقياس لاحق، ورفضه صادق «تعذّر فحص
 *    هذا الملف على هذا الجهاز» لا حكمًا على المشروع نفسه.
 *
 * البوابتان: بوابة الواجهة تقارن حجم الملف بالبايتات قبل file.text() كي
 * لا يُحمّل ملف ضخم إلى الذاكرة أصلًا؛ وبوابة الخدمة تقارن طول النص بوحدات
 * UTF-16 قبل JSON.parse داخل prepareImport وحدها (باب واحد لكل مستورد).
 * لا استثناء ولا تجاوز: الرفض قبل أي كتابة وقبل أي تحليل.
 */

/** سقف ملف الاستعادة بوحدات UTF-16 (ومنه بوابة البايتات للواجهة). */
export const MAX_IMPORT_FILE_UNITS = 2 ** 24;

/** رسالة رفض بوابة الخدمة — محددة ومفهومة، وتصرّح أن شيئًا لم يُمسّ. */
export const IMPORT_SIZE_LIMIT_MESSAGE =
  "حجم الملف أكبر من حد التحقق الآمن في هذا التطبيق؛ لم يُتحقق منه ولم تُمس بيانات هذا الجهاز — تأكد من اختيار ملف نسخة Micro الصحيح.";

/** رسالة بوابة الواجهة — أصرح عن اللحظة: الرفض قبل قراءة الملف نفسه. */
export const IMPORT_FILE_BYTES_LIMIT_MESSAGE =
  "حجم الملف أكبر من أي ملف نسخة يستطيع التطبيق فحصه بأمان على هذا الجهاز — لم يُقرأ ولم تُمس بياناتك. اختر ملف النسخة الصحيح.";

/** بوابة الواجهة: هل حجم الملف بالبايتات داخل حد القراءة الآمنة؟ */
export function isWithinImportFileBytes(sizeInBytes: number): boolean {
  return Number.isFinite(sizeInBytes) && sizeInBytes >= 0 && sizeInBytes <= MAX_IMPORT_FILE_UNITS;
}

/** بوابة الخدمة: هل نص الملف بوحدات UTF-16 داخل حد التحليل الآمن؟ */
export function isWithinImportSizeLimit(text: string): boolean {
  return text.length <= MAX_IMPORT_FILE_UNITS;
}

/* MNG-LOCAL-03 (أمر المالك 12AA — 2026-11-24): بوابة خدمة بايتات الملف
 * الثنائي — نفس السقف الرقمي القائم نفسه (٢^٢٤) مطبّقًا على بايتات المظروف
 * المشفّر قبل أي فكّ؛ المظروف الثنائي يزيد الملف نحو ٥١ بايتًا فقط فوق
 * النظير النصي فلا يُرفع سقف ولا يُلَيّن أي حد قائم — نفس قرار الرفض
 * لأي ملف تجاوز الحد، قبل تحميل أي محتوى إلى الذاكرة. */
export function isWithinImportBytesLimit(bytes: Uint8Array): boolean {
  return bytes.length <= MAX_IMPORT_FILE_UNITS;
}

/* MNG-LOCAL-06 (Post-Group 6 Wave 5 / DOC-041، 2026-11-21): حدود العمق
 * والعدد فوق حد الحجم — ملف بحجم مسموح يمكنه تغليف تعشيش شديد العمق
 * يُنهك مكدس التحقق/الترحيل العودي، أو عائلة بعدد سجلات ضخم يُنهك الذاكرة
 * قبل أي كتابة. القياس المرجعي الموثق: أعمق تعشيش صادق في ملفات التصدير
 * الذهبية ≈ ٨ مستويات، وأكبر عائلة ≈ بضع مئات سجلات — السقفان وقائيان
 * بأضعاف ذلك، والرفض صادق قبل أي كتابة. القيد المعلن (استمرار بوابة D03):
 * القياس على جهاز هاتف فعلي ما يزال بوابة DEVICE خارجية؛ السقفان مشتقان
 * من القياس الكنوني للذهبي مع هامش أضعاف، لا رقمًا اعتباطيًّا. */

/** أقصى عمق تعشيش مسموح في ملف الاستعادة (المستويات المتداخلة). */
export const MAX_IMPORT_JSON_DEPTH = 64;

/** أقصى عدد سجلات مسموح لعائلة مصفوفة واحدة في ملف الاستعادة. */
export const MAX_IMPORT_FAMILY_RECORDS = 20_000;

/** أقصى إجمالي سجلات مسموح في ملف الاستعادة (كل العائلات). */
export const MAX_IMPORT_TOTAL_RECORDS = 50_000;

export const IMPORT_DEPTH_LIMIT_MESSAGE =
  "تعشيش الملف أعمق من أي ملف نسخة Micro صادق — رُفض قبل أي كتابة ولم تُمس بيانات هذا الجهاز؛ تأكد من اختيار ملف النسخة الصحيح.";

export const IMPORT_COUNT_LIMIT_MESSAGE =
  "عدد سجلات الملف أكبر من حد التحقق الآمن في هذا التطبيق — رُفض قبل أي كتابة ولم تُمس بيانات هذا الجهاز؛ تأكد من اختيار ملف النسخة الصحيح.";

/** عمق أعمق تعشيش في قيمة JSON محللة (تكراري بمكدس صريح لا recursion). */
export function measureJsonDepth(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  let maxDepth = 1;
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth > maxDepth) maxDepth = depth;
    if (node === null || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const child of node) {
        if (child !== null && typeof child === "object") stack.push({ node: child, depth: depth + 1 });
      }
    } else {
      for (const child of Object.values(node as Record<string, unknown>)) {
        if (child !== null && typeof child === "object") stack.push({ node: child, depth: depth + 1 });
      }
    }
  }
  return maxDepth;
}

/** هل تعشيش القيمة داخل حد التحقق الآمن؟ */
export function isWithinImportDepth(value: unknown): boolean {
  return measureJsonDepth(value) <= MAX_IMPORT_JSON_DEPTH;
}

/** حدود العد لملف مظروف كامل: تُعاد خرائط العائلة→العدد والإجمالي، أو سبب الرفض. */
export function importFamilyCountVerdict(
  data: Record<string, unknown>,
): { ok: true } | { ok: false; reason: "family" | "total"; family?: string } {
  let total = 0;
  for (const [family, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length > MAX_IMPORT_FAMILY_RECORDS) {
        return { ok: false, reason: "family", family };
      }
      total += value.length;
    } else {
      total += 1;
    }
  }
  if (total > MAX_IMPORT_TOTAL_RECORDS) {
    return { ok: false, reason: "total" };
  }
  return { ok: true };
}
