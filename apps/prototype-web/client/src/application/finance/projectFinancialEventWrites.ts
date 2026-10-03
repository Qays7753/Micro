/* Wave F (ADR-013 عنقود ٣ — تقسيم مسؤولية داخلي، 2026-10-04): مسار كتابة
 * القارئ الكنوني المحروس — التسجيل والتراجع والتعديل الذرّي والحذف
 * والاسترجاع وتوزيع الكاش غير الموزع (PA-002 — دخل هذا البيت مع عائلته
 * بترتيبه الأصلي نفسه) — انتقل حرفيًا من projectFinancialService.ts؛ كل
 * الحراس كما هي بلا أي تغيير دلالة (حد الأمانة F-006، حرس العائلة
 * AV-03/EXE-013، حتمية المفاتيح، حرس المحفظة G-006، توسيع نية المصروف
 * المجموعة ١). القارئ الكنوني يبقى الواجهة والهوية في الخدمة. */
import {
  activeSettlementsMinor,
  createFinancialEvent,
  createFinancialReversal,
  reversedEventIds,
  summarizeFinancialEvents,
  type FinancialEvent,
} from "@micro-domain/financial-event/index.js";
import { createCashContinuityEntry, summarizeCashContinuity } from "@micro-domain/cash-continuity/index.js";
import {
  ammanDateOrNull,
  isValidLocalDate,
  localDateInAmman as ammanDate,
} from "@micro-domain/shared/index.js";
import { formatMoneyWithUnit } from "@/application/formatting/formatters";
import { evaluateWithdrawalWalletCoverage } from "@/application/owner-money/withdrawalWalletGuard";
import { expandExpenseRecordIntent } from "@/application/financial-records/expenseRecordIntent";
import {
  FINANCIAL_EVENTS_READ_FAILED_MESSAGE,
  STORAGE_ERROR,
  VALIDATION_ERROR,
  errorMessageOf,
} from "@/application/resultCodes";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { Clock } from "@/application/time/clock";
import type {
  FinanceResult,
  FinancialEditInput,
  FinancialRecordInput,
  FinancialReversalInput,
  ProjectFinancialReader,
  UnallocatedDistributionInput,
} from "./projectFinancialTypes";

/* مولّد المعرف المشترك لمساري الكتابة (الأحداث والتوزيع) — حرفي كما كان في
 * الخدمة قبل Wave F؛ النسخة الواحدة تُصدّر للأخ التوزيعي فلا مسار ثانٍ. */
export function newFinancialId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `financial-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
/* F-006 (دورة التدقيق النهائي ٢٠٢٦‑٠٩‑٠١): رسالة حد الأمانة تعرض الرصيد المتاح
 * والمبلغ المطلوب بالأرقام — قرار المالك المعتمد §٥.٢: «رسالة عربية واضحة تُظهر
 * الرصيد المتاح والمبلغ المطلوب». التنسيق بالقرش (منزلتان) هو نفسه سياسة P‑001. */
function amanahLimitMessage(availableMinor: number, requestedMinor: number, action: string): string {
  return `${action} يتجاوز الأمانات بحوزتك — المتاح لديك ${formatMoneyWithUnit(availableMinor)} والمطلوب ${formatMoneyWithUnit(requestedMinor)}. راجع رصيد الأمانات أولًا ثم سجّل ما يطابقه.`;
}
/* AV-03 (تدقيق المنتج التنافسي): عكس تصنيف عربون محتفظ به من المحرر العام
 * يترك سجل الطلب معلّقًا على حدث معكوس — classify يرفض («مصنَّف سابقًا»)
 * وreclassify يرفض («لا تصنيف قائم») فتستحيل الإصلاح. حرس الواجهة وحده
 * كان يمنع ذلك؛ الآن الخدمة نفسها ترفض وتوجه لصفحة الطلب (سطح التصنيف
 * المعتمد).
 * EXE-013 (AUD-NEW-15): توسيع الحرس لأحداث القرض والأصل — المسار العام
 * (إلغاء/تعديل/حذف) لم يكن آمنًا لها لأنه يترك سجل العائلة مخالفًا لمجموع
 * أحداثها؛ التصحيح والتراجع القانونيان يعيشان في خدمتي القرض والأصل
 * (تصحيح القرض/السداد، تصحيح الاقتناء/تراجع الإهلاك/التصرف) ولا يمران
 * من هنا. الاسترجاع (restoreEvent) يبقى متاحًا للبيانات التاريخية لأنه
 * يعيد تسجيل القيم الأصلية حرفيًا ولا يعدلها. */
function familyCorrectionGuard(event: FinancialEvent): string | null {
  if (
    (event.type === "deposit_retained_revenue" || event.type === "deposit_retained_owner") &&
    event.depositContext?.orderId
  )
    return "هذا الحدث مرتبط بعربون طلب — صحّحه من صفحة الطلب (إعادة التصنيف الموثقة) ليبقى ربط السجل سليمًا؛ لم يتغير السجل.";
  if (event.assetContext)
    return "هذا الحدث مرتبط بسجل أصل — صحّحه أو اعكسه من صفحة الأصل (تصحيح الاقتناء وتراجع الإهلاك والتصرف الموثقة) ليبقى سجل الأصل مطابقًا لمجموع أحداثه؛ لم يتغير السجل.";
  if (event.loanContext)
    return "هذا الحدث مرتبط بسجل قرض — صحّحه أو اعكسه من صفحة القرض (تصحيح القرض والسداد والتراجع الموثقة) ليبقى سجل القرض مطابقًا لمجموع أحداثه؛ لم يتغير السجل.";
  return null;
}

export async function reverseFinancialEvent(
  store: PrototypeLocalStore,
  now: Clock,
  input: FinancialReversalInput,
): Promise<FinanceResult<FinancialEvent>> {
  const existing = await store.listFinancialEvents();
  if (!existing.ok) return { ok: false, code: STORAGE_ERROR, message: "تعذر التحقق من سجل الأحداث المالية." };
  const sourceEventId = input.sourceEventId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  const reason = input.reason.trim();
  if (!sourceEventId) return { ok: false, code: VALIDATION_ERROR, message: "اختر الحدث الأصلي قبل تصحيحه." };
  if (!reason) return { ok: false, code: VALIDATION_ERROR, message: "اكتب سبب التصحيح قبل تنفيذ التراجع." };
  if (!idempotencyKey)
    return { ok: false, code: VALIDATION_ERROR, message: "مفتاح التصحيح مطلوب لمنع تكرار الأثر." };
  if (!isValidLocalDate(input.occurredOn))
    return { ok: false, code: VALIDATION_ERROR, message: "تاريخ التصحيح المحلي غير صالح." };
  const repeated = existing.value.find(
    event =>
      event.correctionType === "reverse" &&
      event.correctionOfEventId === sourceEventId &&
      event.idempotencyKey === idempotencyKey,
  );
  if (repeated) return { ok: true, value: repeated, reused: true };
  const keyCollision = existing.value.find(event => event.idempotencyKey === idempotencyKey);
  if (keyCollision)
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: "مفتاح التصحيح مستخدم في حدث آخر؛ اختر مفتاحًا جديدًا.",
    };
  const source = existing.value.find(event => event.id === sourceEventId);
  if (!source)
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: "لم يُعثر على الحدث الأصلي؛ لم يتغير السجل.",
    };
  if (source.correctionType === "reverse" || source.correctionOfEventId)
    return { ok: false, code: VALIDATION_ERROR, message: "لا يمكن التراجع عن حدث تراجع سابق." };
  /* AV-03: حرس العائلة في الخدمة نفسها — لا يُعكس حدث مرتبط بسجل مالك
   * من المحرر العام (كان الحرس في الواجهة فقط). */
  const familyGuard = familyCorrectionGuard(source);
  if (familyGuard) return { ok: false, code: VALIDATION_ERROR, message: familyGuard };
  const alreadyReversed = existing.value.find(
    event => event.correctionType === "reverse" && event.correctionOfEventId === source.id,
  );
  if (alreadyReversed)
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: "تم التراجع عن هذا الحدث سابقًا؛ لا يُنشأ تراجع ثانٍ.",
    };
  /* F-006 (دورة التدقيق النهائي): التراجع/الحذف يخضع لنفس حد الأمانة — التراجع عن
   * استلام أمانة جرى تسليم جزء منها يجعل الرصيد الأمين سالبًا (خصم زائد). المسار
   * الصحيح: تراجع عن التسليم أولًا ثم عن الاستلام. لا يُكتب شيء عند الرفض. */
  if ((source.amanahDeltaMinor ?? 0) > 0) {
    const heldMinor = summarizeFinancialEvents(existing.value).amanahMinor;
    if ((source.amanahDeltaMinor ?? 0) > heldMinor)
      return {
        ok: false,
        code: VALIDATION_ERROR,
        message: amanahLimitMessage(heldMinor, source.amanahDeltaMinor ?? 0, "التراجع عن استلام الأمانة"),
      };
  }
  try {
    const reversal = createFinancialReversal({
      id: newFinancialId(),
      sourceEvent: source,
      occurredOn: input.occurredOn,
      recordedAt: now(),
      idempotencyKey,
      reason,
    });
    const saved = await store.commitFinancialEventCorrection(source.id, reversal);
    if (!saved.ok)
      return {
        ok: false,
        code: STORAGE_ERROR,
        message: "تعذر حفظ التراجع ذريًا. بقي الحدث الأصلي دون تغيير.",
      };
    return saved.value.id === reversal.id
      ? { ok: true, value: saved.value }
      : { ok: true, value: saved.value, reused: true };
  } catch (error) {
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: errorMessageOf(error, "بيانات التصحيح غير صالحة."),
    };
  }
}

/** توزيع صريح من الكاش غير الموزع (PA-002): لا تخصيص صامت ولا كاش بلا طريق حل. */
export async function distributeUnallocatedCash(
  store: PrototypeLocalStore,
  reader: ProjectFinancialReader,
  now: Clock,
  input: UnallocatedDistributionInput,
): Promise<FinanceResult<{ unallocatedAfterMinor: number; walletBalanceAfterMinor: number }>> {
  if (!Number.isInteger(input.deltaMinor) || input.deltaMinor === 0)
    return { ok: false, code: VALIDATION_ERROR, message: "أدخل مبلغ توزيع صحيحًا غير صفري." };
  const [walletsResult, entriesResult] = await Promise.all([
    store.listCashWallets(),
    store.listCashContinuityEntries(),
  ]);
  if (!walletsResult.ok || !entriesResult.ok)
    return { ok: false, code: STORAGE_ERROR, message: "تعذر قراءة المحافظ قبل التخصيص." };
  const wallet = walletsResult.value.find(candidate => candidate.id === input.walletId);
  if (!wallet) return { ok: false, code: VALIDATION_ERROR, message: "اختر محفظة موجودة قبل التوزيع." };
  const existingKey = entriesResult.value.find(entry => entry.operationKey === (input.operationKey ?? ""));
  if (input.operationKey && existingKey)
    return {
      ok: true,
      value: { unallocatedAfterMinor: 0, walletBalanceAfterMinor: 0 },
      reused: true,
    };
  const position = await reader.readPosition();
  if (!position.ok)
    return { ok: false, code: STORAGE_ERROR, message: "تعذر قراءة الكاش غير الموزع قبل التخصيص." };
  const walletEntries = entriesResult.value.filter(entry => entry.walletId === wallet.id);
  const walletBalanceMinor = summarizeCashContinuity(walletEntries);
  if (input.deltaMinor > 0 && input.deltaMinor > position.value.unallocatedCashMinor)
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: "المبلغ المطلوب أكبر من الكاش غير الموزع المتاح؛ لا يُخصم من رصيد المحافظ ولا يُخترع فرق.",
    };
  if (input.deltaMinor < 0 && walletBalanceMinor + input.deltaMinor < 0)
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: "رصيد المحفظة لا يغطي هذا الصرف؛ اختر محفظة أخرى أو صرّف المبلغ من غير الموزع.",
    };
  try {
    const entry = createCashContinuityEntry({
      id: newFinancialId(),
      walletId: wallet.id,
      type: "allocation",
      occurredOn: input.occurredOn ?? ammanDate(now()),
      recordedAt: now(),
      cashDeltaMinor: input.deltaMinor,
      note:
        (input.note?.trim() || null) ??
        (input.deltaMinor > 0 ? "توزيع كاش غير موزع إلى محفظة" : "تغطية صرف من رصيد محفظة"),
      operationKey: input.operationKey ?? `allocation-${newFinancialId()}`,
      sourceRefId: input.sourceRefId ?? null,
      sourceRefKind: input.sourceRefKind ?? null,
      sourceRefLineId: input.sourceRefLineId ?? null,
    });
    const saved = await store.commitCashContinuity(wallet, [entry]);
    if (!saved.ok) return { ok: false, code: STORAGE_ERROR, message: "تعذر حفظ التوزيع؛ لم يتغير أي رصيد." };
    return {
      ok: true,
      value: {
        unallocatedAfterMinor: position.value.unallocatedCashMinor - input.deltaMinor,
        walletBalanceAfterMinor: walletBalanceMinor + input.deltaMinor,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: errorMessageOf(error, "بيانات التخصيص غير صالحة."),
    };
  }
}

/** تعديل بسيط موثق (مبدأ ٥.٦): تراجع + بديل في معاملة ذرّية واحدة — الأثر يتجدد والسجل يبقى. */
export async function editFinancialEvent(
  store: PrototypeLocalStore,
  now: Clock,
  input: FinancialEditInput,
): Promise<FinanceResult<FinancialEvent>> {
  const existing = await store.listFinancialEvents();
  if (!existing.ok) return { ok: false, code: STORAGE_ERROR, message: FINANCIAL_EVENTS_READ_FAILED_MESSAGE };
  const source = existing.value.find(event => event.id === input.sourceEventId.trim());
  if (!source)
    return { ok: false, code: VALIDATION_ERROR, message: "لم يُعثر على الحدث الأصلي؛ لم يتغير السجل." };
  if (source.correctionType === "reverse" || source.correctionOfEventId)
    return { ok: false, code: VALIDATION_ERROR, message: "لا يمكن تعديل سجل تراجع سابق." };
  /* AV-03: حرس العائلة في الخدمة نفسها — التعديل العام لا يمس أحداث
   * الأصل/القرض/العربون؛ سطح المالك يحمل سياقها الكامل. */
  const familyGuard = familyCorrectionGuard(source);
  if (familyGuard) return { ok: false, code: VALIDATION_ERROR, message: familyGuard };
  const alreadyReversed = existing.value.find(
    event => event.correctionType === "reverse" && event.correctionOfEventId === source.id,
  );
  if (alreadyReversed)
    return { ok: false, code: VALIDATION_ERROR, message: "عُدّل هذا الحدث سابقًا؛ عدّل النسخة الحالية." };
  if (input.amountMinor <= 0 || !Number.isInteger(input.amountMinor))
    return { ok: false, code: VALIDATION_ERROR, message: "أدخل مبلغًا صحيحًا موجبًا بالأرقام 0–9." };
  if (!input.note.trim())
    return { ok: false, code: VALIDATION_ERROR, message: "اكتب ما حدث؛ الوصف جزء من السجل المالي." };
  if (!isValidLocalDate(input.occurredOn))
    return { ok: false, code: VALIDATION_ERROR, message: "تاريخ الحدث المحلي غير صالح." };
  /* تسديد التزام: تعديل المبلغ لا يتجاوز المتبقي بعد استبعاد الأصل من الحساب. */
  if (source.type === "payable_settlement_cash" && source.relatedEventId) {
    const payable = existing.value.find(event => event.id === source.relatedEventId);
    if (payable) {
      const remainingWithoutSource =
        payable.amountMinor - activeSettlementsMinor(existing.value, payable.id) + source.amountMinor;
      if (input.amountMinor > remainingWithoutSource)
        return {
          ok: false,
          code: VALIDATION_ERROR,
          message: "المبلغ الجديد يتجاوز المتبقي من الالتزام؛ عدّله أو سجّل تسديدًا إضافيًا.",
        };
    }
  }
  if (existing.value.some(event => event.idempotencyKey === input.idempotencyKey))
    return { ok: false, code: VALIDATION_ERROR, message: "مفتاح التعديل مستخدم؛ اختر مفتاحًا جديدًا." };
  /* Conflict H (WF-04): تصحيح التصنيف بعد الحفظ — يُقبل لأحداث المصروف فقط،
   * ويطبّقه البديل بعد تحقق النطاق نفسه (normalizeExpenseContext) في createFinancialEvent. */
  const isExpenseSource =
    source.type === "operating_expense_cash" || source.type === "operating_expense_payable";
  if (input.expenseContext != null && !isExpenseSource)
    return { ok: false, code: VALIDATION_ERROR, message: "التصنيف يُصحَّح لأحداث المصروف فقط." };
  const replacementExpenseContext = input.expenseContext ?? source.expenseContext ?? null;
  try {
    const reversal = createFinancialReversal({
      id: newFinancialId(),
      sourceEvent: source,
      occurredOn: ammanDate(now()),
      recordedAt: now(),
      idempotencyKey: `${input.idempotencyKey}:reversal`,
      reason: input.reason?.trim() || "تعديل موثق",
    });
    const replacement = createFinancialEvent({
      id: newFinancialId(),
      type: source.type,
      amountMinor: input.amountMinor,
      occurredOn: input.occurredOn,
      recordedAt: now(),
      idempotencyKey: input.idempotencyKey,
      note: input.note.trim(),
      counterparty: input.counterparty,
      relatedEventId: source.relatedEventId,
      expenseContext: replacementExpenseContext,
      assetContext: source.assetContext ?? null,
      loanContext: source.loanContext ?? null,
      depositContext: source.depositContext ?? null,
    });
    /* F-006 (دورة التدقيق النهائي): التعديل الذرّي يخضع لنفس حد الأمانة الذي يخضع
     * له التسجيل — رفع تسليم أو إنقاص استلام بما يتجاوز المحتجز فعليًا يجعل الرصيد
     * الأمين سالبًا. يُفحص قبل الكتابة؛ لا يُلمس السجل عند الرفض. */
    const sourceAmanahDelta = source.amanahDeltaMinor ?? 0;
    const replacementAmanahDelta = replacement.amanahDeltaMinor ?? 0;
    const postEditAmanahMinor =
      summarizeFinancialEvents(existing.value).amanahMinor - sourceAmanahDelta + replacementAmanahDelta;
    if (postEditAmanahMinor < 0) {
      const heldBeforeMinor = summarizeFinancialEvents(existing.value).amanahMinor;
      if (sourceAmanahDelta < 0) {
        /* تسليم يُرفع مبلغُه: المتاح بعد استبعاد الأصل = الرصيد + قيمة الأصل. */
        return {
          ok: false,
          code: VALIDATION_ERROR,
          message: amanahLimitMessage(
            heldBeforeMinor - sourceAmanahDelta,
            input.amountMinor,
            "المبلغ الجديد المُسلَّم بعد التعديل",
          ),
        };
      }
      /* استلام يُنقص مبلغُه: الإنقاص المتاح = الرصيد الحالي؛ والمطلوب = قيمة الإنقاص. */
      return {
        ok: false,
        code: VALIDATION_ERROR,
        message: amanahLimitMessage(
          heldBeforeMinor,
          sourceAmanahDelta - input.amountMinor,
          "الإنقاص من استلام الأمانة",
        ),
      };
    }
    const saved = await store.commitFinancialEventReplacement(source.id, reversal, replacement);
    if (!saved.ok) return { ok: false, code: STORAGE_ERROR, message: saved.message };
    return saved.value.replacement.id === replacement.id
      ? { ok: true, value: saved.value.replacement }
      : { ok: true, value: saved.value.replacement, reused: true };
  } catch (error) {
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: errorMessageOf(error, "بيانات التعديل غير صالحة."),
    };
  }
}

/** حذف بسيط (مبدأ ٥.٦): التراجع الموثق هو الآلية — الأثر يتلاشى والسجل يبقى. */
export async function deleteFinancialEvent(
  store: PrototypeLocalStore,
  now: Clock,
  input: {
    sourceEventId: string;
    reason?: string | null;
    idempotencyKey: string;
  },
): Promise<FinanceResult<FinancialEvent>> {
  return reverseFinancialEvent(store, now, {
    sourceEventId: input.sourceEventId,
    occurredOn: ammanDate(now()),
    reason: input.reason?.trim() || "حذف",
    idempotencyKey: input.idempotencyKey,
  });
}

/** تراجع عن الحذف (Undo): يعاد تسجيل القيم الأصلية كحدث جديد — لا يُلمس الماضي. */
export async function restoreFinancialEvent(
  store: PrototypeLocalStore,
  now: Clock,
  input: {
    sourceEventId: string;
    idempotencyKey: string;
  },
): Promise<FinanceResult<FinancialEvent>> {
  const existing = await store.listFinancialEvents();
  if (!existing.ok) return { ok: false, code: STORAGE_ERROR, message: FINANCIAL_EVENTS_READ_FAILED_MESSAGE };
  const source = existing.value.find(event => event.id === input.sourceEventId.trim());
  if (!source) return { ok: false, code: VALIDATION_ERROR, message: "لم يُعثر على الحدث الأصلي." };
  return recordFinancialEvent(store, now, {
    type: source.type,
    amountMinor: source.amountMinor,
    occurredOn: source.occurredOn,
    note: source.note.replace(/^تراجع: /u, ""),
    counterparty: source.counterparty,
    relatedEventId: source.relatedEventId,
    expenseContext: source.expenseContext ?? null,
    assetContext: source.assetContext ?? null,
    loanContext: source.loanContext ?? null,
    depositContext: source.depositContext ?? null,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function recordFinancialEvent(
  store: PrototypeLocalStore,
  now: Clock,
  input: FinancialRecordInput,
): Promise<FinanceResult<FinancialEvent>> {
  const existing = await store.listFinancialEvents();
  if (!existing.ok) return { ok: false, code: STORAGE_ERROR, message: "تعذر التحقق من سجل الأحداث المالية." };
  const repeated = existing.value.find(
    event => event.type === input.type && event.idempotencyKey === input.idempotencyKey,
  );
  if (repeated) return { ok: true, value: repeated, reused: true };
  let amountMinor = input.amountMinor;
  let expenseContext = input.expenseContext ?? null;
  /* المجموعة ١ (معاينة الأثر): التوسيع نفسه الذي تعرضه المعاينة قبل الحفظ —
   * وحدة نقية واحدة (`expenseRecordIntent`) لا مسار حساب ثانٍ. */
  const intentType: "operating_expense_cash" | "operating_expense_payable" =
    input.type === "operating_expense_cash" || input.type === "operating_expense_payable"
      ? input.type
      : "operating_expense_cash";
  if (intentType === input.type || input.sharedExpense || input.expenseContext) {
    const expanded = expandExpenseRecordIntent({
      type: intentType,
      amountMinor: input.amountMinor,
      expenseContext: input.expenseContext ?? null,
      sharedExpense: input.sharedExpense,
    });
    if (!expanded.ok) return { ok: false, code: VALIDATION_ERROR, message: expanded.message };
    amountMinor = expanded.amountMinor;
    expenseContext = expanded.expenseContext;
  }
  if (amountMinor === undefined)
    return { ok: false, code: VALIDATION_ERROR, message: "أدخل مبلغًا صالحًا قبل الحفظ." };
  if (input.type === "payable_settlement_cash") {
    const source = existing.value.find(event => event.id === input.relatedEventId);
    if (!source || source.type !== "operating_expense_payable")
      return { ok: false, code: VALIDATION_ERROR, message: "اختر التزام مصروف مسجلًا قبل تسجيل تسديده." };
    if (source.correctionType === "reverse" || reversedEventIds(existing.value).has(source.id))
      return { ok: false, code: VALIDATION_ERROR, message: "اختر التزامًا فعالًا لم يتم التراجع عنه." };
    const paid = activeSettlementsMinor(existing.value, source.id);
    if (amountMinor > source.amountMinor - paid)
      return {
        ok: false,
        code: VALIDATION_ERROR,
        message: "لا يمكن أن يتجاوز التسديد المتبقي المسجل على هذا الالتزام.",
      };
  }
  /* F-006: تسليم الأمانة لا يتجاوز الرصيد الأمين المحتجز فعليًا — رصيد سالب
   * يعني ملكًا زائفًا ونقص كاشٍ كاذبًا. المجهول لا يُقرّب: إن لم تُسجّل الأمانة
   * بعد فسجلها أولًا، ثم سلّم منها. الرسالة تعرض المتاح والمطلوب بالأرقام (§٥.٢). */
  if (input.type === "amanah_released_cash") {
    const heldMinor = summarizeFinancialEvents(existing.value).amanahMinor;
    if (amountMinor > heldMinor)
      return {
        ok: false,
        code: VALIDATION_ERROR,
        message: amanahLimitMessage(heldMinor, amountMinor, "المبلغ المُسلَّم"),
      };
  }
  /* G-006: حرس المحفظة الكنوني المشترك لمسار الحدث — قبل أي كتابة: رصيد
   * لا يغطي السحب يُرفض برسالة تعرض المتاح والمطلوب، ولا يُكتب حدث ولا
   * تخصيص (لا كتابة جزئية). غير الموزع مصدر صريح مسموح كما هو معلن. */
  if (input.type === "owner_withdrawal_cash" && (input.sourceWalletId ?? null)) {
    const [walletsResult, entriesResult] = await Promise.all([
      store.listCashWallets(),
      store.listCashContinuityEntries(),
    ]);
    if (!walletsResult.ok || !entriesResult.ok)
      return { ok: false, code: STORAGE_ERROR, message: "تعذر قراءة المحافظ قبل تسجيل السحب." };
    const walletGuard = evaluateWithdrawalWalletCoverage({
      walletId: input.sourceWalletId ?? null,
      wallets: walletsResult.value,
      cashEntries: entriesResult.value,
      amountMinor: amountMinor ?? 0,
    });
    if (!walletGuard.ok) return { ok: false, code: VALIDATION_ERROR, message: walletGuard.message };
  }
  try {
    const event = createFinancialEvent({
      id: newFinancialId(),
      type: input.type,
      amountMinor,
      occurredOn: input.occurredOn,
      recordedAt: now(),
      idempotencyKey: input.idempotencyKey,
      note: input.note,
      counterparty: input.counterparty,
      relatedEventId: input.relatedEventId,
      expenseContext,
      assetContext: input.assetContext ?? null,
      loanContext: input.loanContext ?? null,
      depositContext: input.depositContext ?? null,
    });
    const saved = await store.saveFinancialEvent(event);
    return saved.ok
      ? { ok: true, value: saved.value }
      : {
          ok: false,
          code: STORAGE_ERROR,
          message: "تعذر حفظ الحدث المالي محليًا — بياناتك كما هي؛ أعد المحاولة.",
        };
  } catch (error) {
    return {
      ok: false,
      code: VALIDATION_ERROR,
      message: errorMessageOf(error, "بيانات الحدث المالي غير صالحة."),
    };
  }
}
