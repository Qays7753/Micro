/**
 * S02-A (SH-02/SH-03 — عقد ٠٤٤ §16 والسجل المشترك §14): بروتوكول الاستبدال
 * المحروس — المسار الواحد الذي يمر به كل استبدال مدمّر للقطة (استعادة كاملة،
 * استرجاع النسخة السابقة، تصفير «ابدأ من جديد»، وإدخال البداية الافتتاحي).
 *
 * عقد البروتوكول خطوة خطوة (كل خطوة تفشل بصمتاح صادق لا بنجاح كاذب):
 *  1. قراءة حالة الحماية؛ إن وُجدت نية قائمة لم تُحسم يُحسم مآلها أولًا
 *     بالبصمات: تطابق الحالة الحية مع afterDigest = الالتزام تم (يكمل
 *     الترقية والإيصال)، مع beforeDigest = لم يتم (يُحبَت النية وتبقى
 *     الحالة القديمة كاملة)، ولا هذا ولا ذاك = مآل غير محسوم يمنع كل نية
 *     استبدال جديدة حتى الحسم (SDF-051 — لا «لم يتغير شيء» كاذبًا أبدًا).
 *  2. إعادة نفس الأمر (نفس المفتاح والحمولة) بعد إيصال ملتزم تعيد نتيجة
 *     الأصل بلا أثر ثانٍ (SDF-037)؛ نفس المفتاح بحمولة مختلفة تعارض
 *     idempotency_conflict بلا كتابة (SDF-038).
 *  3. فحص الربط: الجيل والبصمة المرجونان من لحظة المراجعة مقابل الحالة
 *     الحية — اختلافهما stale_context بلا كتابة ويعاد فتح المراجعة
 *     (SDF-050: الأمر القديم يُرفض ولو بقي projectId نفسه).
 *  4. نسخة رجوع دائمة مُتحقق منها للدولة الحالية (بيانات + مسودات النماذج
 *     العابرة معزولة) **قبل** أي كتابة مدمرة؛ تعذرها يمنع البدء (SDF-049).
 *  5. تسجيل النية (مع بصمات ما قبل/بعد) ثم الاستبدال الذرّي المحروس بسياج
 *     داخل حد الكتابة نفسه (الكتابات كلها أو لا شيء، والمسودات تُمسح في
 *     الحد ذاته) ثم الالتزام (ترقية النسخة النشطة + صك جيل + إيصال).
 *
 * هذا البروتوكول لا يعرف PIN ولا يتأثر بإلغائه (SH-04) — الحماية تقنية
 * محلية من خطأ الاستبدال، لا مصادقة مستخدم أبدًا.
 */
import type { Clock } from "@/application/time/clock";
import type {
  LocalExportFile,
  LocalStoreSnapshot,
  PrototypeLocalStore,
  ReplacementCommandType,
  ReplacementIntentRecord,
  ReplacementReceiptRecord,
  RestoreProtectionState,
  RestoreRollbackRecord,
} from "@/storage/local/types";
import { canonicalSnapshotDigest } from "@/storage/local/snapshotCanonicalization";

/** عدسة المخزن التي يحتاجها البروتوكول — النقل والتصفير والإدخال الافتتاحي
 * كلهم يركبون الحد نفسه؛ لا كاتب استبدال خارج هذا البروتوكول إطلاقًا. */
export type ReplacementProtectionStore = Pick<
  PrototypeLocalStore,
  | "readSnapshot"
  | "replaceSnapshot"
  | "listFormDrafts"
  | "readRestoreProtection"
  | "beginReplacementIntent"
  | "commitReplacementIntent"
  | "abortReplacementIntent"
>;

export type ReplacementFailureCode =
  "validation_error" | "storage_error" | "stale_context" | "idempotency_conflict" | "outcome_unknown";

export type ProtectedReplacementRequest = {
  commandType: ReplacementCommandType;
  payload: LocalStoreSnapshot;
  /** بصمة كنونية للحمولة — هوية الأمر مع القاعدة؛ تُحسب من canonicalSnapshotDigest. */
  payloadDigest: string;
  /** ملخص نتيجة الأمر مسلسلًا (يملؤه صاحب العقد) — يعاد حرفيًا عند التكرار. */
  summaryJson: string;
  /* ربط التأكيد بالمراجعة: الأمر المُراجَع مسبقًا (استعادة/استرجاع نسخة
   * سابقة) يحمل جيل وبصمة لحظة المراجعة؛ التصفير لا معاينة مسبقة له فيربط
   * لحظة النداء — وسياج المعاملة يحرس الحالتين على السواء. */
  binding:
    { kind: "prepared"; expectedGeneration: number; expectedSnapshotDigest: string } | { kind: "at-call" };
  /* مسار استرجاع النسخة السابقة وحده يمررها: المسودات المعزولة تُعاد مع
   * اللقطة القديمة داخل الحد نفسه (عقد ٠٤٤ B4/B6). */
  restoreFormDrafts?: RestoreRollbackRecord["drafts"];
};

export type ProtectedReplacementOutcome =
  | { status: "committed"; backup: LocalExportFile; generation: number }
  | { status: "replayed"; summaryJson: string; backup: LocalExportFile }
  | { status: "blocked"; code: ReplacementFailureCode; message: string };

/** معرف الأمر — حتمي من (النوع، الحمولة، القاعدة المربوطة) فلا مصادفة ولا
 * زمن محيط: نفس الملف فوق نفس القاعدة = نفس الأمر (إعادة النتيجة الأصلية)،
 * وحمولة أخرى أو قاعدة أخرى = أمر آخر. */
function deriveCommandId(
  commandType: ReplacementCommandType,
  payloadDigest: string,
  baseDigest: string,
  baseGeneration: number,
): string {
  return `${commandType}:${payloadDigest}:${baseDigest}:${baseGeneration}`;
}

/** حسم نية قائمة بمآل البصمات — القراءة الحية تقارن ببصمتي النية:
 * afterDigest = الالتزام تم (تكمل الترقية والإيصال)، beforeDigest = لم يتم
 * (تُحبَط)، ولا هذا ولا ذاك = غير محسوم (يمنع النيات الجديدة حتى الحسم). */
export type IntentResolution =
  | { status: "committed"; intent: ReplacementIntentRecord; promotedRollback: RestoreRollbackRecord | null }
  | { status: "aborted" }
  | { status: "unresolved"; message: string }
  | { status: "error"; code: ReplacementFailureCode; message: string };

export async function resolvePendingReplacementIntent(
  store: ReplacementProtectionStore,
  now: Clock,
  state: RestoreProtectionState,
): Promise<IntentResolution> {
  const intent = state.intent;
  if (intent === null) return { status: "aborted" };
  const live = await store.readSnapshot();
  if (!live.ok) return { status: "error", code: "storage_error", message: live.message };
  const liveDigest = canonicalSnapshotDigest(live.value);
  if (liveDigest === intent.afterDigest) {
    /* الالتزام تم والانهيار كان بين معاملة الاستبدال ومعاملة الترقية —
     * تُكمل الترقية الآن مرة واحدة: النسخة المعلقة تُرقّى نشطة، والجيل
     * يُصكّ، والإيصال يُكتب من نية الأمر نفسها (لا يُفقد أبدًا). */
    const receipt: ReplacementReceiptRecord = {
      id: "replacement-receipt",
      commandId: intent.commandId,
      commandType: intent.commandType,
      payloadDigest: intent.payloadDigest,
      summaryJson: intent.summaryJson,
      generation: intent.toGeneration,
      committedAt: now(),
    };
    const committed = await store.commitReplacementIntent(intent.toGeneration, receipt, now());
    if (!committed.ok)
      return {
        status: "error",
        code: "outcome_unknown",
        message: "تعذر تسجيل حسم مآل استبدال سابق — لن تبدأ عملية جديدة حتى الحسم؛ أعد فتح الصفحة للتحقق.",
      };
    return { status: "committed", intent, promotedRollback: state.pendingRollback };
  }
  if (liveDigest === intent.beforeDigest) {
    /* الاستبدال لم يلتزم أبدًا — الحالة القديمة كاملة؛ تُحبَط النية وتبقى
     * النسخة النشطة والإيصال والجيل كما هي (لا تمسها محاولة فاشلة). */
    const aborted = await store.abortReplacementIntent();
    if (!aborted.ok)
      return {
        status: "error",
        code: "outcome_unknown",
        message: "تعذر تسجيل حسم مآل استبدال سابق — لن تبدأ عملية جديدة حتى الحسم؛ أعد فتح الصفحة للتحقق.",
      };
    return { status: "aborted" };
  }
  /* لا القديم ولا الجديد — كاتب آخر كتب فوق قاعدة مجهولة بين الانهيار
   * والقراءة؛ البيانات حالة كاملة لكن لا يمكن إثبات أيها بلا مزج، فتبقى
   * كل نية استبدال محجوبة حتى الحسم (عقد ٠٤٤ B4.5 بلا تجاوز). */
  return {
    status: "unresolved",
    message:
      "نتحقق من حالة استبدال سابق ولم نستطع حسم مآله بأمان — لن يبدأ أي استبدال جديد حتى الحسم. بياناتك معروضة كاملة كما هي؛ نزّل نسخة يدويًا من «حفظ نسخة احتياطية» لضمانها، وتبقى نسخة ما قبل الاستبدال متاحة للتنزيل أدناه.",
  };
}

/** بنّاء النسخة الرجوع المُتحقق منها — يُمرَّر من صاحب العقد (خدمة النقل)
 * لأن التحقق الدائري الكامل من أدواتها؛ تعذّره يمنع البدء لا أن يُتجاوز. */
export type VerifiedBackupBuilder = () => Promise<
  { ok: true; file: LocalExportFile } | { ok: false; code: ReplacementFailureCode; message: string }
>;

export async function runProtectedReplacement(
  store: ReplacementProtectionStore,
  now: Clock,
  request: ProtectedReplacementRequest,
  buildVerifiedBackup: VerifiedBackupBuilder,
): Promise<ProtectedReplacementOutcome> {
  /* ١) قراءة حالة الحماية وحسم أي نية قائمة أولًا — لا نيتان فوق بعضهما أبدًا. */
  let protection = await store.readRestoreProtection();
  if (!protection.ok) return { status: "blocked", code: "storage_error", message: protection.message };
  if (protection.value.intent !== null) {
    const resolution = await resolvePendingReplacementIntent(store, now, protection.value);
    if (resolution.status === "error")
      return { status: "blocked", code: resolution.code, message: resolution.message };
    if (resolution.status === "unresolved")
      return { status: "blocked", code: "outcome_unknown", message: resolution.message };
    if (resolution.status === "committed") {
      /* حُسم التزامًا: إن كان الطلب نفس أمر النية المحسومة فنتيجته الأصلية
       * تُعاد الآن بلا أثر ثانٍ (SDF-037/042 — نفس القصد بعد مآل مجهول). */
      const commandId = deriveCommandId(
        request.commandType,
        request.payloadDigest,
        request.binding.kind === "prepared"
          ? request.binding.expectedSnapshotDigest
          : resolution.intent.beforeDigest,
        request.binding.kind === "prepared"
          ? request.binding.expectedGeneration
          : resolution.intent.fromGeneration,
      );
      if (commandId === resolution.intent.commandId) {
        if (request.payloadDigest !== resolution.intent.payloadDigest)
          return {
            status: "blocked",
            code: "idempotency_conflict",
            message:
              "هذا الأمر يحمل حمولة مختلفة عن نتيجة مسجلة قبله بنفس المفتاح — لم يُكتب شيء؛ راجع النسخة مجددًا.",
          };
        const backup = resolution.promotedRollback?.file ?? null;
        if (backup === null)
          return {
            status: "blocked",
            code: "validation_error",
            message: "تعذر إيجاد نسخة ما قبل الاستبدال المرتبطة بنتيجة الأمر — لم يُكتب شيء.",
          };
        return { status: "replayed", summaryJson: resolution.intent.summaryJson, backup };
      }
      /* أمر آخر: الالتزام السابق رقّى الجيل — القراءة التالية للدولة الحديثة
       * تحسم رفضه بـstale_context أو تمرره إن كان مربوطًا للقاعدة الجديدة. */
    }
    protection = await store.readRestoreProtection();
    if (!protection.ok) return { status: "blocked", code: "storage_error", message: protection.message };
    if (protection.value.intent !== null)
      return {
        status: "blocked",
        code: "stale_context",
        message: "عملية استبدال أخرى قيد الحسم — لن تبدأ عملية ثانية فوقها.",
      };
  }

  /* ٢) إعادة الأمر الملتزم: نفس المفتاح والحمولة تعيد نتيجة الأصل بلا أثر
   * ثانٍ؛ نفس المفتاح بحمولة مختلفة تعارض بلا كتابة (SDF-037/038). */
  const live = await store.readSnapshot();
  if (!live.ok) return { status: "blocked", code: "storage_error", message: live.message };
  const liveDigest = canonicalSnapshotDigest(live.value);
  const liveGeneration = protection.value.generation;
  const commandId =
    request.binding.kind === "prepared"
      ? deriveCommandId(
          request.commandType,
          request.payloadDigest,
          request.binding.expectedSnapshotDigest,
          request.binding.expectedGeneration,
        )
      : deriveCommandId(request.commandType, request.payloadDigest, liveDigest, liveGeneration);
  const receipt = protection.value.receipt;
  if (receipt !== null && receipt.commandId === commandId) {
    if (receipt.payloadDigest !== request.payloadDigest)
      return {
        status: "blocked",
        code: "idempotency_conflict",
        message:
          "هذا الأمر يحمل حمولة مختلفة عن نتيجة مسجلة قبله بنفس المفتاح — لم يُكتب شيء؛ راجع النسخة مجددًا.",
      };
    const backup = protection.value.activeRollback?.file ?? null;
    if (backup === null)
      return {
        status: "blocked",
        code: "validation_error",
        message: "تعذر إيجاد نسخة ما قبل الاستبدال المرتبطة بنتيجة الأمر — لم يُكتب شيء.",
      };
    return { status: "replayed", summaryJson: receipt.summaryJson, backup };
  }

  /* ٣) فحص الربط: الأمر المُراجَع مربوط بجيل وبصمة لحظة المراجعة؛ اختلاف
   * الحالة الحية يعيد المراجعة ولا يستبدل عملًا أحدث (SDF-050/B6). */
  if (request.binding.kind === "prepared") {
    if (
      request.binding.expectedGeneration !== liveGeneration ||
      request.binding.expectedSnapshotDigest !== liveDigest
    )
      return {
        status: "blocked",
        code: "stale_context",
        message: "تغيّرت بياناتك منذ المراجعة — لم يُكتب شيء؛ راجع النسخة مجددًا ثم أكّد.",
      };
  }

  /* ٤) النسخة الرجوع الدائمة المُتحقق منها للدولة الحالية بيانات ومسودات —
   * قبل أي كتابة مدمرة وبلا استثناء؛ تعذرها يمنع البدء (SDF-049/U044-AC12). */
  const verifiedBackup = await buildVerifiedBackup();
  if (!verifiedBackup.ok)
    return {
      status: "blocked",
      code: verifiedBackup.code,
      message:
        "تعذر إنشاء نسخة احتياطية قابلة للاسترجاع قبل الاستبدال — لم يُمس أي شيء. أعد المحاولة، فإن تكرر فافتح فحص السلامة من الأدوات.",
    };
  const drafts = await store.listFormDrafts();
  if (!drafts.ok) return { status: "blocked", code: "storage_error", message: drafts.message };
  const pendingRollback: RestoreRollbackRecord = {
    id: "rollback-pending",
    file: verifiedBackup.file,
    drafts: drafts.value,
    snapshotDigest: liveDigest,
    generation: liveGeneration,
    createdAt: now(),
  };

  /* ٥) النية المسجلة (بصمات ما قبل/بعد) ثم الاستبدال المحروس ثم الالتزام. */
  const intent: ReplacementIntentRecord = {
    id: "replacement-marker",
    commandId,
    commandType: request.commandType,
    fromGeneration: liveGeneration,
    toGeneration: liveGeneration + 1,
    beforeDigest: liveDigest,
    afterDigest: canonicalSnapshotDigest(request.payload),
    payloadDigest: request.payloadDigest,
    summaryJson: request.summaryJson,
    startedAt: now(),
  };
  const began = await store.beginReplacementIntent(pendingRollback, intent);
  if (!began.ok) {
    if (began.code === "replacement_intent_busy")
      return {
        status: "blocked",
        code: "stale_context",
        message:
          "عملية استبدال أخرى قيد الحسم من نافذة أخرى — لم يُكتب شيء؛ أغلق النوافذ الأخرى وأعد المحاولة.",
      };
    return { status: "blocked", code: "storage_error", message: began.message };
  }
  const replacement = await store.replaceSnapshot(request.payload, {
    expectedSnapshotDigest: liveDigest,
    ...(request.restoreFormDrafts !== undefined ? { restoreFormDrafts: request.restoreFormDrafts } : {}),
  });
  if (!replacement.ok) {
    if (replacement.code === "replacement_context_stale") {
      /* سياج المعاملة صاد كاتبًا آخر سبقنا — الحالة القديمة كاملة لم تُمس؛
       * تُحبَط النية ويعاد فتح المراجعة (لا استبدال عملًا أحدث أبدًا). */
      const aborted = await store.abortReplacementIntent();
      if (!aborted.ok)
        return {
          status: "blocked",
          code: "outcome_unknown",
          message:
            "تعذّر الاستبدال وتعذر تسجيل مآله — لم يُعلن أي نجاح؛ أعد فتح الصفحة للتحقق قبل أي محاولة جديدة.",
        };
      return {
        status: "blocked",
        code: "stale_context",
        message: "تغيّرت بيانات هذا الجهاز من مسار آخر بعد مراجعتك — لم يُكتب شيء؛ راجع النسخة مجددًا.",
      };
    }
    const aborted = await store.abortReplacementIntent();
    if (!aborted.ok)
      return {
        status: "blocked",
        code: "outcome_unknown",
        message:
          "تعذّر الاستبدال وتعذر تسجيل مآله — لم يُعلن أي نجاح؛ أعد فتح الصفحة للتحقق قبل أي محاولة جديدة.",
      };
    return {
      status: "blocked",
      code: "storage_error",
      message: "تعذّر استبدال البيانات المحلية؛ بقيت بياناتك السابقة كاملة دون تغيير.",
    };
  }
  const committedReceipt: ReplacementReceiptRecord = {
    id: "replacement-receipt",
    commandId,
    commandType: request.commandType,
    payloadDigest: request.payloadDigest,
    summaryJson: request.summaryJson,
    generation: intent.toGeneration,
    committedAt: now(),
  };
  const committed = await store.commitReplacementIntent(intent.toGeneration, committedReceipt, now());
  if (!committed.ok)
    return {
      status: "blocked",
      code: "outcome_unknown",
      message:
        "تم الاستبدال لكن تعذر تسجيل نتيجته نهائيًا — أعد فتح الصفحة؛ سيتحقق التطبيق من حالتها تلقائيًا عند أول محاولة تالية ولن يتكرر أي أثر.",
    };
  return { status: "committed", backup: pendingRollback.file, generation: intent.toGeneration };
}
