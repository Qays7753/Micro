/**
 * P-01 الطبقة 0: طلب تخزين دائم من المتصفح.
 *
 * بلا هذا الطلب، يعامل المتصفح بيانات Micro كذاكرة مؤقتة قابلة للإخلاء عند
 * ضغط المساحة — أي أن السجل المالي كله قد يُمسح دون إشعار. الطلب لا يخزن
 * شيئًا ولا يغير schema ولا export؛ يقرأ حالة المتصفح ويعلنها كما هي.
 *
 * لا يعد هذا نسخة احتياطية. الجهاز المفقود أو المسح اليدوي يبقيان خارج الحماية،
 * ويظل التصدير المحلي هو المسار الوحيد لنقل البيانات.
 */

export type PersistentStorageState = "persisted" | "not_persisted" | "unsupported";

type StorageManagerLike = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
};

function storageManager(): StorageManagerLike | null {
  if (typeof navigator === "undefined") return null;
  const manager = (navigator as Navigator & { storage?: StorageManagerLike }).storage;
  return manager ?? null;
}

/** يقرأ الحالة الحالية دون طلب جديد. */
export async function readPersistentStorageState(): Promise<PersistentStorageState> {
  const manager = storageManager();
  if (!manager || typeof manager.persisted !== "function") return "unsupported";
  try {
    return (await manager.persisted()) ? "persisted" : "not_persisted";
  } catch {
    return "unsupported";
  }
}

/**
 * يطلب الدوام مرة واحدة. المتصفح قد يمنحه صامتًا، أو يرفضه، أو يسأل المستخدم.
 * الرفض ليس خطأ تشغيليًا: التطبيق يعمل كما هو، والحالة تُعرض بصدق.
 */
export async function requestPersistentStorage(): Promise<PersistentStorageState> {
  const manager = storageManager();
  if (!manager || typeof manager.persist !== "function") return "unsupported";
  const current = await readPersistentStorageState();
  if (current === "persisted" || current === "unsupported") return current;
  try {
    return (await manager.persist()) ? "persisted" : "not_persisted";
  } catch {
    return "not_persisted";
  }
}

export function persistentStorageCopy(state: PersistentStorageState): {
  title: string;
  text: string;
} {
  switch (state) {
    case "persisted":
      return {
        title: "التخزين الدائم مفعّل",
        text: "لن يمسح المتصفح بيانات Micro تلقائيًا عند امتلاء مساحة الجهاز. المسح اليدوي وفقدان الجهاز يبقيان خارج الحماية، فالتصدير ما زال مطلوبًا.",
      };
    case "not_persisted":
      return {
        title: "التخزين الدائم غير مفعّل",
        text: "قد يمسح المتصفح بيانات Micro عند امتلاء مساحة الجهاز. صدّر بياناتك الآن، وثبّت Micro على الشاشة الرئيسية لرفع فرصة منح الدوام.",
      };
    default:
      return {
        title: "التخزين الدائم غير مدعوم في هذا المتصفح",
        text: "لا يعلن هذا المتصفح حالة الدوام. اعتمد على التصدير المحلي قبل تغيير الجهاز أو مسح بيانات المتصفح.",
      };
  }
}
