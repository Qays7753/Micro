/**
 * المجموعة ٥ (عقد ٣٣ — تسليم يدوي): معيّن واحد لتنزيل نص كملف وللمشاركة
 * اليدوية عبر نظام المشاركة — فعل صريح من المستخدم في كل مرة.
 *
 * العقد:
 * - التنزيل دائمًا متاح (نمط S5-11: إبطال مؤجل ٣٠ ثانية لتفادي إجهاد WebKit).
 * - المشاركة تحسين اختياري: تُستخدم فقط عند دعم المتصفح لـ navigator.share
 *   بالنص وحده — لا ملفات ولا روابط ولا إرسال خلفي أبدًا.
 * - النسخ الاحتياطي (القص) بديل يدوي صريح عند غياب المشاركة.
 * - لا شبكة هنا إطلاقًا: كل شيء محلي؛ ما يغادر الجهاز هو النص الذي رآه
 *   المستخدم بنفسه، وبقراره.
 */

export type TextDeliveryOutcome = "downloaded" | "shared" | "copied" | "unsupported";

export function downloadTextFile(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([`\uFEFF${text}`], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  /* S5-11: الإبطال مؤجل — الإبطال الفوري المتزامن قد يجهض التنزيل في WebKit. */
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function shareTextManually(text: string): Promise<TextDeliveryOutcome> {
  const navigatorWithShare = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      /* إلغاء المستخدم لوحة المشاركة ليس فشلًا — يعود للمستخدم لاختيار فعل آخر. */
      if (error instanceof Error && error.name === "AbortError") return "unsupported";
    }
  }
  const navigatorWithClipboard = navigator as Navigator & {
    clipboard?: { writeText?: (text: string) => Promise<void> };
  };
  if (typeof navigatorWithClipboard.clipboard?.writeText === "function") {
    try {
      await navigatorWithClipboard.clipboard.writeText(text);
      return "copied";
    } catch {
      return "unsupported";
    }
  }
  return "unsupported";
}

export function canShareText(): boolean {
  const navigatorWithShare = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  return typeof navigator.share === "function" && (navigatorWithShare.canShare?.({ text: "" }) ?? true);
}

/** مراجعة 5-RV-D: نسخ صريح إلى الحافظة مباشرة — لا يفتح لوحة المشاركة أبدًا؛
 * زر «انسخ النص» ينسخ، ولوحة المشاركة تبقى لزر «أرسل النص» وحده. */
export async function copyTextManually(text: string): Promise<TextDeliveryOutcome> {
  const navigatorWithClipboard = navigator as Navigator & {
    clipboard?: { writeText?: (text: string) => Promise<void> };
  };
  if (typeof navigatorWithClipboard.clipboard?.writeText === "function") {
    try {
      await navigatorWithClipboard.clipboard.writeText(text);
      return "copied";
    } catch {
      return "unsupported";
    }
  }
  return "unsupported";
}
