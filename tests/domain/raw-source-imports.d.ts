/**
 * M1.1 (§14.3 / IMPACT S1): تعريبات محلية لاستيراد المصدر الخام داخل
 * اختبارات الجذر — الجذر بلا أنواع vite/client أو @types/node (وإضافة
 * اعتماد جديد محظورة)، فتُصرَّح هنا وحدها لأغراض فحص المصدر فقط.
 */
declare module "*?raw" {
  const source: string;
  export default source;
}

interface ImportMeta {
  glob(
    pattern: string,
    options?: { query?: string; import?: string; eager?: boolean },
  ): Record<string, string>;
}
