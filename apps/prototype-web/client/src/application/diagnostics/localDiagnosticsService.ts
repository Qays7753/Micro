/**
 * المجموعة ٥ (التحصين الكامل — التشخيص المحلي الخصوصي): سجل حوادث محلي
 * محدود الحجم، بهوية حادثة آمنة للعرض والنسخ، ولا يغادر الجهاز أبدًا.
 *
 * عقد الحقول — هذه فقط، ولا شيء غيرها:
 *   errorId, appVersion, schemaVersion, routeTemplate, operation,
 *   errorCode, timestamp, safeMessage
 *
 * المحظورات المطلقة داخل السجل (ومن ثم داخل أي تقرير يُنسخ):
 * أسماء، مبالغ، ملاحظات، حمولات خام، رمز القفل/بصماته/ملحه، رموز دخول،
 * مسارات كاملة بمعرفات، استعلامات، كائنات الاستثناء الأصلية، وأثر المكدس.
 *
 * عقد السلوك:
 * - الحلقة محدودة بعدد الإدخالات وبمجموع البايتات معًا؛ الأحدث يبقى أولًا
 *   حتميًا، والأقدم يُسقط عند تجاوز أي حد.
 * - التخزين المعطوب يُستعاد بسجل فارغ بلا انفجار.
 * - الكتابة لا ترمي أبدًا (try/catch شامل) ولا تعطل فعل المستخدم ولا تسبب
 *   خطأً ثانيًا — فشلها يُعاد null فقط فيُعرض الركن بلا معرف حادثة.
 * - لا طلب شبكة ولا رفع تلقائي ولا أي مسار إرسال في هذه الوحدة إطلاقًا.
 */
import { localSchemaVersion } from "@/storage/local/types";
import { appIdentity } from "@/application/identity/buildIdentity";

export type DiagnosticErrorCode =
  "render_crash" | "pwa_register_failed" | "pwa_update_failed" | "unknown_error";

export type LocalDiagnosticEntry = {
  errorId: string;
  appVersion: string;
  schemaVersion: number;
  routeTemplate: string;
  operation: string;
  errorCode: DiagnosticErrorCode;
  timestamp: string;
  safeMessage: string;
};

/** واجهة تخزين ضيقة قابلة للحقن — الإنتاج localStorage والاختبار كعب. */
export type DiagnosticStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const DIAGNOSTICS_STORAGE_KEY = "micro.diagnostics.v1";
/** حد عدد الإدخالات — حلقة صغيرة تكفي لأحدث الحوادث فقط. */
export const MAX_DIAGNOSTIC_ENTRIES = 25;
/** حد مجموع البايتات (UTF-8) للتخزين كله — لا نمو بلا سقف أبدًا. */
export const MAX_DIAGNOSTIC_TOTAL_BYTES = 48_000;

/* رسائل آمنة ثابتة لكل رمز — لا نص مستمد من الاستثناء أبدًا (قد يحمل
 * أسماء أو مبالغ أو معرفات). */
/* قيم الرسائل على أسطر message: — نصوص لحظة الفعل لا نصوص سكون. */
const SAFE_MESSAGES: ReadonlyArray<{ code: DiagnosticErrorCode; message: string }> = [
  { code: "render_crash", message: "تعذر عرض الشاشة ولم تتغير أي بيانات." },
  { code: "pwa_register_failed", message: "تعذر تفعيل وضع العمل دون اتصال." },
  { code: "pwa_update_failed", message: "تعذر تحديث ملفات وضع العمل دون اتصال." },
  { code: "unknown_error", message: "حدث خطأ غير مصنف ولم تتغير أي بيانات." },
];

export function safeMessageFor(code: DiagnosticErrorCode): string {
  return SAFE_MESSAGES.find(entry => entry.code === code)?.message ?? SAFE_MESSAGES[3].message;
}

const ERROR_ID_PATTERN = /^MIC-[0-9a-f]{10}$/;

/** معرف الحادثة: حتمي الشكل، عشوائي القيمة، آمن للعرض والنسخ اليدوي. */
function generateErrorId(): string {
  const bytes = new Uint8Array(5);
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `MIC-${hex}`;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function isDiagnosticEntry(value: unknown): value is LocalDiagnosticEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LocalDiagnosticEntry>;
  return (
    typeof candidate.errorId === "string" &&
    ERROR_ID_PATTERN.test(candidate.errorId) &&
    typeof candidate.appVersion === "string" &&
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.routeTemplate === "string" &&
    typeof candidate.operation === "string" &&
    typeof candidate.errorCode === "string" &&
    SAFE_MESSAGES.some(entry => entry.code === candidate.errorCode) &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.safeMessage === "string"
  );
}

export class LocalDiagnosticsService {
  constructor(
    private readonly storage: DiagnosticStorage,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly identity: string = appIdentity,
  ) {}

  /** قراءة آمنة — التخزين المعطوب يعود سجلًا فارغًا لا انفجار. */
  list(): readonly LocalDiagnosticEntry[] {
    try {
      const raw = this.storage.getItem(DIAGNOSTICS_STORAGE_KEY);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isDiagnosticEntry).slice(0, MAX_DIAGNOSTIC_ENTRIES);
    } catch {
      return [];
    }
  }

  /**
   * تسجيل حادثة واحدة — لا يرمي أبدًا؛ يعيد معرف الحادثة عند النجاح وnull
   * عند أي فشل تخزين (فيرى المستخدم الركن بلا معرف، لا خطأ ثانٍ).
   */
  recordIncident(input: {
    operation: string;
    errorCode: DiagnosticErrorCode;
    routeTemplate: string;
  }): string | null {
    try {
      const entry: LocalDiagnosticEntry = {
        errorId: generateErrorId(),
        appVersion: this.identity,
        schemaVersion: localSchemaVersion,
        routeTemplate: input.routeTemplate,
        operation: input.operation,
        errorCode: input.errorCode,
        timestamp: this.now(),
        safeMessage: safeMessageFor(input.errorCode),
      };
      const entries = [entry, ...this.list()].slice(0, MAX_DIAGNOSTIC_ENTRIES);
      let serialized = JSON.stringify(entries);
      /* سقف البايتات: يُسقط الأقدم أولًا حتى يستقر الحجم تحت الحد (يبقى واحد
       * على الأقل — آخر حادثة لا تُفنى بحدّ البايتات). */
      while (byteLength(serialized) > MAX_DIAGNOSTIC_TOTAL_BYTES && entries.length > 1) {
        entries.pop();
        serialized = JSON.stringify(entries);
      }
      this.storage.setItem(DIAGNOSTICS_STORAGE_KEY, serialized);
      return entry.errorId;
    } catch {
      return null;
    }
  }

  /** نص التقرير للنسخ اليدوي — الحقول المسموحة فقط، بلا أي إرسال. */
  reportText(): string {
    const entries = this.list();
    return JSON.stringify(
      {
        appVersion: this.identity,
        schemaVersion: localSchemaVersion,
        generatedAt: this.now(),
        entries,
      },
      null,
      2,
    );
  }
}

function browserDiagnosticStorage(): DiagnosticStorage {
  const storage = globalThis.localStorage;
  if (storage === undefined || storage === null) {
    /* بلا تخزين: سجل يُرمى كتابته بلا انفجار — recordIncident يعيد null. */
    return {
      getItem: () => {
        throw new Error("diagnostics storage unavailable");
      },
      setItem: () => {
        throw new Error("diagnostics storage unavailable");
      },
    };
  }
  return storage;
}

/** المفردة للإنتاج — يستعملها ErrorBoundary وregister والنسخ اليدوي فقط. */
export const localDiagnostics = new LocalDiagnosticsService(browserDiagnosticStorage());
