/**
 * Local persistence contracts. Domain aggregates, persistence records, and view models stay separate.
 * Schedule records are local operational follow-up only; they do not create financial effects.
 */
import type { CraftOrder } from "@micro-domain/craft-order/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type {
  CashContinuityEntry,
  CashObservation,
  CashWallet,
} from "@micro-domain/cash-continuity/index.js";
import type {
  InventoryMovement,
  InventoryShortage,
  Material,
} from "@micro-domain/inventory-material/index.js";
import type {
  CatalogItem,
  CatalogTemplate,
  DirectConversion,
  MeasurementUnit,
} from "@micro-domain/catalog/index.js";
import type { ActualTimeRecord } from "@micro-domain/actual-time/index.js";
import type { ShortCashDeclaration } from "@micro-domain/financial-analysis/index.js";
import type {
  OwnerEntitlementOpeningBalance,
  OwnerEntitlementPolicy,
  OwnerEntitlementRecord,
  OwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import type { AllocationPolicy } from "@micro-domain/recurring-margin/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { AssetRecord } from "@micro-domain/asset/index.js";
import type { LoanRecord } from "@micro-domain/loan/index.js";
import type { ReceivedLoanRecord } from "@micro-domain/received-loan/index.js";
/* S07-MR-001 (أمر S08 — القسم ١): عقد الحالة المتوقعة لكتابة المخزون —
 * يُعرَّف عند حارس الالتزام النقي ويُستورَد نوعًا فقط هنا (المهايئان
 * والخدمات تستهلكانه؛ المنفذ لا يعيد تعريفه). */
import type { InventoryCommitExpectation } from "./inventoryCommitGuard.js";
import type {
  RecurringExpenseOccurrence,
  RecurringExpenseRuleRevision,
  RecurringExpenseSeries,
} from "@micro-domain/recurring-expense/index.js";
import type { ExpenseBudgetRecord } from "@micro-domain/budget/index.js";
import type { SavedParty } from "@micro-domain/party/index.js";
import type { SupplierPurchaseCommit } from "./supplierScheduleCommitGuard";
import type { CounterpartyWriteCommit } from "./counterpartyCommitGuard";

/* المجموعة ٥ (الاستمرارية): المخطط ٣٥ أضاف مخزني `form-drafts` و`local-security`
 * بمُنشئ محروس — لا حقول جديدة على أي سجل قائم ولا ترحيل بيانات؛ القديم يفتح
 * ويجد المخزنين الفارغين. كلا المخزنين مستثنى من لقطة التصدير عمدًا: المسودات
 * النصية دخول عابر لا حقيقة مالية، ورمز القفل سرٌّ محلي لا يغادر الجهاز أبدًا.
 * OPS-003 (عقد ٤١ / قرار D-037): المخطط ٣٦ يضيف مخازن المصروف المتكرر الثلاثة
 * (`recurring-expense-series/revisions/occurrences`) بالمُنشئ المحروس نفسه —
 * لا حقول جديدة على سجلات قائمة ولا ترحيل بيانات؛ القديم يفتح ويجدها فارغة.
 * FIN-002 (عقد ٤٢ / نمط D-037): المخطط ٣٧ يضيف مخزن `expense-budgets` واحدًا
 * لسجلات الميزانية المختارة (خطة لا حدثًا ماليًا) بالمُنشئ المحروس نفسه —
 * لا حقول جديدة على سجل قائم ولا ترحيل بيانات؛ القديم يفتح ويجده فارغًا.
 * FIN-001 (WS-178 — Wave 6 / نمط D-037): المخطط ٣٨ يضيف مخزن `received-loans`
 * واحدًا لسجلات القروض المستلمة (الحقيقة المالية في أحداثها داخل
 * financial-events) بالمُنشئ المحروس نفسه — لا حقول جديدة على سجل قائم
 * ولا ترحيل بيانات؛ القديم يفتح ويجده فارغًا.
 * S04 (DOC-013 / UNIT-025 + العقد المشترك §8 — نمط D-037): المخطط ٣٩ يضيف
 * مخزن `balance-observations` واحدًا لرصد أرصدة النقد (قياس الموجود بنطاقه
 * وقطعه ومعرفته — ليس حركة نقدية ولا افتتاحًا ولا تمويلًا) بالمُنشئ
 * المحروس نفسه — لا حقول جديدة على سجل قائم ولا ترحيل بيانات؛ القديم
 * يفتح ويجده فارغًا.
 * S05 (DOC-014 / UNIT-037 P3.2 + العقد المشترك §5.1/§8 — نمط D-037): المخطط ٤٠
 * يضيف مخزن `counterparties` واحدًا لهويات الأطراف المحفوظة اختياريًا (عميل/
 * مورد — تعريف بلا رصيد ولا حدث مالي؛ الأرصدة تقرأ من المصادر المرتبطة
 * بمعرف الطرف) بالمُنشئ المحروس نفسه — لا حقول جديدة على سجل قائم ولا
 * ترحيل بيانات؛ القديم يفتح ويجده فارغًا. */
export const localSchemaVersion = 40;
export const localProfileId = "local-profile";
export const localPreferencesId = "local-preferences";
export const localExportFormat = "micro-prototype-local-export";
/* المجموعة ٥ (عقد النسخ الاحتياطي): النسخة ٢٧ أضافت حقول تكامل اختيارية
 * (بصمة sha256 + عدادات مضمّنة + إصدار التطبيق)؛ ملفات ٢٦ وأقدم تُقبل كما هي
 * بلا بصمة، والزوجان القديمان كلها تبقى في قائمة الاستيراد المسموحة.
 * OPS-003 (عقد ٤١ / قرار D-037): النسخة ٢٨ تضيف عائلات المصروف المتكرر الثلاث
 * إلى لقطة التصدير وعداداتها؛ ملف ٢٧/٣٥ يبقى زوجًا موروثًا مقبولًا في الاستيراد
 * بلا اختراع سجلات — الغياب يعني قوائم فارغة.
 * FIN-002 (عقد ٤٢): النسخة ٢٩ تضيف عائلة الميزانيات إلى لقطة التصدير وعداداتها؛
 * ملف ٢٨/٣٦ يبقى زوجًا موروثًا مقبولًا في الاستيراد بلا اختراع ميزانيات —
 * الغياب يعني قائمة فارغة.
 * FIN-001 (WS-178 — Wave 6): النسخة ٣٠ تضيف عائلة القروض المستلمة إلى لقطة
 * التصدير وعداداتها؛ ملف ٢٩/٣٧ يبقى زوجًا موروثًا مقبولًا في الاستيراد بلا
 * اختراع قروض مستلمة — الغياب يعني قائمة فارغة بلا اختراع تاريخ.
 * S04 (DOC-013 / UNIT-025): النسخة ٣١ تضيف عائلة رصد أرصدة النقد إلى لقطة
 * التصدير وعداداتها — القياس بيانات حقيقية تُنقل مع اللقطة (نطاقها وقطعها
 * ومعرفتها محفوظة) ولا تُعاد تسويته عند الاستعادة؛ ملف ٣٠/٣٨ يبقى زوجًا
 * موروثًا مقبولًا في الاستيراد — الغياب يعني قائمة فارغة بلا اختراع قياس.
 * S05 (DOC-014 / UNIT-037): النسخة ٣٢ تضيف عائلة الأطراف المحفوظة إلى لقطة
 * التصدير وعداداتها — هوية الطرف (معرّفه الثابت وتسميته الحالية وهاتفه
 * وملاحظته وحالة أرشيفته) بيانات حقيقية تُنقل مع اللقطة بلا دمج ولا
 * اختراع أطراف؛ ملف ٣١/٣٩ يبقى زوجًا موروثًا مقبولًا في الاستيراد —
 * الغياب يعني قائمة فارغة بلا اختراع هوية. */
export const localExportVersion = 32;
export const localSecurityId = "local-security";
/* المجموعة ٥ (التحصين الكامل — حدود المسودة): نوعان جديدان يدخلان الحد نفسه —
 * مسودة محرر الحدث المالي (مهاجرة من مفتاح localStorage القديم لكل نوع) ومسودة
 * الإعداد (مهاجرة من مفتاحها القديم). كلاهما عابر بلا أثر مالي كما إخوتهما.
 * S09 (UNIT-007/008 — أمر ad133bae القسم ٢): نوعان جديدان لسطحي المرحلة —
 * مسودة نموذج محرر المسودة (raw النص والكمية غير الصالحة قبل أي التزام) ومسودة
 * نموذج محرر التكلفة (مدخلات التكلفة قبل حفظ النسخة). كلاهما عابر بلا أثر مالي،
 * خارج التصدير كما كل العائلة، وقراءته لا تنشئ مسودة طلب ولا نسخة تكلفة. */
export type FormDraftKind =
  | "asset"
  | "loan"
  | "supplier_purchase"
  | "direct_sale"
  | "inventory_movement"
  | "finance_event"
  | "setup"
  | "order_draft"
  | "order_cost";
export type FormDraftEnvelope = {
  /** `${formKind}:${scopeId ?? "new"}` — مسودة واحدة لكل شاشة لكل نطاق. */
  id: string;
  formKind: FormDraftKind;
  scopeId: string | null;
  /** إصدار شكل القيم لكل نوع — تغيّره يعني تجاهل المسودة القديمة بلا انفجار. */
  valuesVersion: number;
  /* S02-A (SH-03 — عقد ٠٤٤/§16): جيل البيانات المحلي الذي حُفظت ضده المسودة —
   * الغياب (سجلات ما قبل S02) يعامل كالجيل ٠ فتبقى مسودات المالك الحالية
   * قابلة للاستئناف حتى أول استبدال حقيقي. أي استبدال يصك جيلًا أعلى فتصير
   * المسودة من جيل قديم: لا تُعرض للاستئناف فوق بيانات لم تُنشأ لها (سياج
   * النافذة الثانية — SDF-050). */
  generation?: number;
  values: unknown;
  createdAt: string;
  updatedAt: string;
};
export type LocalSecurityRecord = {
  id: typeof localSecurityId;
  /** بصمة الرمز بترميز سداسي عشري — الرمز نفسه لا يُخزن أبدًا. */
  pinHash: string;
  /** ملح عشوائي مُولَّد مرة عند التفعيل (سلسلة سداسية عشرية). */
  salt: string;
  /** المجموعة ٦ (تدقيق A1 — SP-02): خوارزمية البصمة — غيابها = السجل القديم
   * (sha256 مفردة) ويُرقّى تلقائيًا إلى المشتق البطيء بعد أول فتح ناجح. */
  hashAlgo?: "pbkdf2";
  /** دقائق الخمول قبل القفل التلقائي؛ null = القفل اليدوي فقط. */
  autoLockMinutes: number | null;
  /** آخر لحظة نشاط معلنة — أساس اكتشاف الخمول عبر إخفاء/ظهور التطبيق. */
  lastActiveAt: string | null;
  /** محاولات فتح فاشلة متتالية — تصفّر عند النجاح؛ عدّاد فقط بلا قفل دائم. */
  failedAttempts: number;
  /** المجموعة ٦ (تدقيق A1 — SP-04): لحظة آخر محاولة فاشلة — أساس وقفة
   * المحاولات المُنفَّذة؛ null = لا محاولات فاشلة حديثة. */
  lastFailedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

/* S02-A (SH-02/SH-03 — عقد ٠٤٤ §16 والسجل المشترك §14): سجلات حماية الاستبدال
 * الدائمة — تعيش في قاعدة بيانات IndexedDB **منفصلة** (micro-prototype-restore)
 * خارج قاعدة البيانات التي يستبدلها الاسترداد حرفيًا كما يفرض العقد («نسخة
 * رجوع دائمة قابلة للوصول خارج قاعدة البيانات التي ستستبدل»)، فلا يمسها
 * مخزن لقطة ولا يمكن للاستبدال إتلافها؛ ولا تُصدَّر أبدًا فلا يعيدها ملف
 * قديم (الجيل محلي لا يصدر). المفتاح المحروس ٣٨/٣٠ لا يتغير: هذه قاعدة
 * مستقلة بإصدارها الخاص ١ لا علاقة له بمخطط التصدير. */
export type RestoreRollbackRecord = {
  id: "rollback-active" | "rollback-pending";
  /** ملف نسخة مُتحقق منه دورة كاملة للبيانات قبل الاستبدال — ليس قيمة في
   * الذاكرة ولا رابط تنزيل؛ يصمد للإغلاق وإعادة التحميل والانهيار. */
  file: LocalExportFile;
  /** مسودات النماذج العابرة الموجودة قبل الاستبدال — تُعزل مع اللقطة
   * القديمة وتُسترد معها (عقد ٠٤٤ B6)؛ تبقى مميزة عن مسودات الأعمال
   * المحفوظة داخل الملف نفسه. */
  drafts: readonly FormDraftEnvelope[];
  /** بصمة الحالة المحمية وقت إنشاء السجل (كنونية — snapshotCanonicalization). */
  snapshotDigest: string;
  /** الجيل الذي كانت عليه البيانات عند إنشاء النسخة. */
  generation: number;
  createdAt: string;
};
export type ReplacementCommandType = "restore" | "reset" | "guided-opening" | "rollback-restore";
/** نية استبدال قائمة لم يُحسم مآلها — تُكتب قبل أي كتابة مدمرة، ويُحسم
 * مآلها عند أول قراءة تالية بمقارنة بصمة الحالة الحية بالبصمتين (SDF-051)؛
 * وجودها يمنع بدء نية استبدال أخرى حتى الحسم (سياج النية الواحدة). */
export type ReplacementIntentRecord = {
  id: "replacement-marker";
  commandId: string;
  commandType: ReplacementCommandType;
  fromGeneration: number;
  toGeneration: number;
  /** بصمة الحالة قبل الاستبدال وبعده — تطابق القراءة الحية مع الأولى =
   * القديم كامل، مع الثانية = الجديد كامل، ولا هذا ولا ذاك = مآل غير
   * محسوم يمنع نية جديدة حتى الحسم. */
  beforeDigest: string;
  afterDigest: string;
  /** بصمة حمولة الأمر المُقدَّمة — ربط التأكيد بالملف المُراجَع نفسه. */
  payloadDigest: string;
  /** ملخص نتيجة الأمر مسلسلًا — يُحفظ مع النية كي يكمل الحسمُ إيصالَ الأمر
   * المنهار بعد التزامه دون فقد نتيجته الأصلية (SDF-037/051). */
  summaryJson: string;
  startedAt: string;
};
/** إيصال آخر استبدال ملتزم — نتيجة الأمر الأصلية تُعاد حرفيًا عند إعادة
 * نفس المفتاح والحمولة بلا أثر ثانٍ (SDF-037)؛ لا يُحذف بمحاولة فاشلة
 * ولا بنية لاحقة — يستبدله فقط التزام ناجح أحدث. */
export type ReplacementReceiptRecord = {
  id: "replacement-receipt";
  commandId: string;
  commandType: ReplacementCommandType;
  payloadDigest: string;
  /** ملخص نتيجة الأمر الأصلي مسلسلًا (يملؤه صاحب العقد في طبقة التطبيق) —
   * التخزين يحفظه كسلسلة معتمة بلا تفسير؛ ليس حدثًا ماليًا أبدًا. */
  summaryJson: string;
  /** الجيل الذي صُكّ مع الالتزام (toGeneration). */
  generation: number;
  committedAt: string;
};
export type DataGenerationRecord = {
  id: "data-generation";
  /** جيل البيانات المحلي — يبدأ صفرًا ويرتفع واحدًا مع كل استبدال ملتزم
   * داخل حد الكتابة نفسه؛ محلي لا يُصدَّر ولا يستعيده ملف قديم. */
  generation: number;
  updatedAt: string;
};
export type RestoreProtectionState = {
  generation: number;
  intent: ReplacementIntentRecord | null;
  receipt: ReplacementReceiptRecord | null;
  activeRollback: RestoreRollbackRecord | null;
  pendingRollback: RestoreRollbackRecord | null;
};
/** سياج الاستبدال داخل حد الكتابة — البصمة المرجوة تُقارن داخل معاملة
 * الاستبدال نفسها بعد قراءة كل المخازن وقبل أي مسح (ضمان مخزني لا طبقة
 * واجهة)، والقائمة الاختيارية تعيد مسودات النماذج المعزولة مع اللقطة
 * القديمة في الحد نفسه (مسار استرجاع النسخة السابقة وحده يمررها).
 * digestOf تُمرَّر من صاحب البروتوكول (شظية النقل الكسولة) كي لا يدخل
 * جهاز البصمة الكنونية كومة إقلاع المحوّل — السياج يعمل داخل المعاملة
 * فلا يصلح استيراد كسول هناك. */
export type ReplacementGuard = {
  expectedSnapshotDigest: string;
  digestOf: (snapshot: LocalStoreSnapshot) => string;
  restoreFormDrafts?: readonly FormDraftEnvelope[];
};
export type LocalExportIntegrity = {
  algorithm: "sha256";
  /** بصمة sha256 للنص القانوني لـ data (JSON.stringify بلا فراغات). */
  digest: string;
};
export type LocalExportCounts = {
  orders: number;
  directSales: number;
  financialEvents: number;
  supplierPurchases: number;
  cashWallets: number;
  cashContinuityEntries: number;
  materials: number;
  inventoryMovements: number;
  inventoryShortages: number;
  assets: number;
  loans: number;
  schedules: number;
  drafts: number;
  /* OPS-003 (عقد ٤١): عائلات المصروف المتكرر داخل العدادات الصارمة. */
  recurringExpenseSeries: number;
  recurringExpenseRevisions: number;
  recurringExpenseOccurrences: number;
  /* FIN-002 (عقد ٤٢): عائلة الميزانيات داخل العدادات الصارمة. */
  expenseBudgets: number;
  /* FIN-001 (WS-178 — Wave 6): عائلة القروض المستلمة داخل العدادات الصارمة. */
  receivedLoans: number;
  /* S04 (DOC-013 / UNIT-025): عائلة رصد أرصدة النقد داخل العدادات الصارمة. */
  balanceObservations: number;
  /* S05 (DOC-014 / UNIT-037): عائلة الأطراف المحفوظة داخل العدادات الصارمة. */
  counterparties: number;
  /* R10-B2/RC-1 (R10A-F-009): عائلات مال المالك الأربع داخل العدادات
   * الصارمة — مفاتيح إضافية داخل المفتاح counts نفسه والإصدار يبقى ٣٠
   * (الأزواج الموروثة بلا كتل عدادات لا يمسها التغيير؛ السجل الكنوني:
   * application/transfers/transferArrayFamilyRoles.ts). */
  ownerEntitlementPolicies: number;
  ownerEntitlementRecords: number;
  ownerEntitlementOpeningBalances: number;
  ownerMovements: number;
};
/* المجموعة ٢ (عقد ٢٨ — مخزون انتقائي): مخزن ٣٢/نسخة ٢٤ أضافتا قرار المتابعة
 * ومعرفة رصيد البداية لكل مادة، ووسم معرفة التكلفة على الحركات، وربط الشراء
 * بمادة وكمية متوقعة، وسجلات نقص المخزون (متجر جديد `inventory-shortages`).
 * الحقول اختيارية بلا تعبئة (غياب = سلوك إرث متوافق)؛ الملفات ٢٣/٣١ تُقبل
 * وتُهاجر بقيم null/[] آمنة. */
export const localOwnerProfileId = "local-owner-profile";
export type OwnerProfile = {
  id: typeof localOwnerProfileId;
  /** معرّف مالك محلي ثابت — يولَّد مرة عند أول إنشاء ولا يتغير بالتعديل. */
  ownerId: string;
  displayName: string | null;
  /** اختياري تمامًا؛ يبقى فارغًا حتى يكتبه المالك. */
  email: string | null;
  /** حقل مستقبلي محجوز — null دائمًا في هذه المرحلة (لا مزود خارجي). */
  provider: null;
  /** حقل مستقبلي محجوز — null دائمًا في هذه المرحلة (لا حساب خارجي). */
  externalAccountId: null;
  createdAt: string;
  updatedAt: string;
};
/* القرار ٩: تفعيل المخزون صريح مؤرّخ — لحظة معلنة يُعرض تاريخها، والرصيد يوم
 * التفعيل يكفي. الترقية معلنة في الكومِت: سجل واحد بلا علاقات جديدة. */
export const localInventoryActivationId = "local-inventory-activation";
export type InventoryActivation = {
  id: typeof localInventoryActivationId;
  activatedOn: string;
  recordedAt: string;
  operationKey: string;
};

export type ActivityProfile = {
  id: typeof localProfileId;
  activityName: string;
  currency: "JOD";
  activityType: "custom_craft";
  createdAt: string;
  updatedAt: string;
};
/* S03 (UNIT-039 B2/عقد §17): نتيجة حد تعديل الاسم — اتحاد مميّز صادق:
 * renamed ⟹ الملف المُعاد هو المسمّى الجديد (موجود دائمًا)، وconflict ⟹
 * الملف الحالي كما هو (أو null إن غاب الملف) بلا أي كتابة. */
export type ProfileRenameCommitOutcome =
  { profile: ActivityProfile; outcome: "renamed" } | { profile: ActivityProfile | null; outcome: "conflict" };
export type OperatingWorkMode = "material_focused" | "time_focused" | "mixed";
export type LocalPreferences = {
  id: typeof localPreferencesId;
  theme: "light" | "dark" | "system";
  dailyScheduleCapacityMinutes: number | null;
  workMode: OperatingWorkMode | null;
  actualTimeTrackingEnabled: boolean;
  /** آخر إخفاء لبطاقة التثبيت؛ تُظهر البطاقة مجددًا بعد نافذة الثلاثين يومًا. ليست بيانات مالية. */
  installBannerDismissedAt: string | null;
  /** آخر تصدير مُتحقق منه — أساس تذكير النسخ الاحتياطي (P-01 طبقة ١). ليست بيانات مالية. */
  lastVerifiedExportAt?: string | null;
  /* O-001: تذكير النسخة الدوري اختياري — غيابه يعني «مفعّل» (السلوك القائم).
   * إطفاؤه يخفي سطر التذكير من الشاشة الرئيسية فقط؛ لا يمس التصدير ولا بياناته. */
  backupReminderEnabled?: boolean;
  /* SET-003 (قرار المالك ٢٠٢٦-٠٩-١٦): القدرات المتوقفة عن الإدخال — الإيقاف
   * يخفي مداخل الإنشاء اليومية فقط؛ السجلات والديون والالتزامات القائمة تبقى
   * ظاهرة قابلة للتدقيق في دفاترها، والمحذوف أبدًا. غياب الحقل = الكل مفعّل. */
  disabledCapabilities?: string[];
  /* Stage 2 — OPS-002: حدود تنبيه انخفاض المخزون لكل مادة (بالملي بوحدة المادة
   * نفسها) — سياسة تنبيه للقراءة فقط لا معنى ماليًا ولا تدخل التكلفة. الغياب أو
   * الفراغ = لا سياسة معلنة = لا تنبيه أبدًا؛ لا يُخترع حد افتراضيًا ولا يُفترض
   * طلب مستقبلي. حقل اختياري ينتقل مع السجل كما disabledCapabilities. */
  lowStockThresholdsMilli?: Record<string, number> | null;
  /* S03 (UNIT-038 P3.2/UNIT-001 P3.2 — عقد §5.1/§15.1): تفضيل ما يقدمه المشروع
   * — منتجات/خدمات/كلاهما، اختيار صريح من المصدر الواحد (038) يستخدمه سؤال
   * البداية في 001 ومحرر الإعدادات. الغياب أو null = محايد: لا يُفترض منتجات
   * ولا يخفي خدمات. مستقل تمامًا عن workMode (طريقة مواد/وقت) ولا يُعاد تفسيره
   * أبدًا، ولا يعيد تصنيف أي سجل تاريخي. حقل اختياري داخل السجل القائم ينتقل
   * معه في اللقطة (بخلاف جيل البيانات المحلي المستثنى صراحة). */
  offeringPreference?: "products" | "services" | "both" | null;
  updatedAt: string;
};
/* S03 revalidation (00-S03-REVALIDATION-S04-EXECUTION-PROMPT-2026-10-28 §A2):
 * الحقول القابلة للتحقيق فقط — الهوية وطابع التحديث يملكهما حد الكتابة
 * (commitPreferencesUpdate). */
export type LocalPreferencesPatch = Partial<Omit<LocalPreferences, "id" | "updatedAt">>;
/* S03 revalidation: نتيجة حد كتابة التفضيلات — اتحاد مميّز صادق (نمط
 * ProfileRenameCommitOutcome): updated/created ⟹ السجل المكتوب حاضرًا
 * دائمًا، وconflict ⟹ السجل الحي كما هو (أو null إن غاب) بلا أي كتابة —
 * الغياب عند توقع نسخة قائمة تعارض لا إنشاء. */
export type PreferencesCommitOutcome =
  | { outcome: "updated"; preferences: LocalPreferences }
  | { outcome: "created"; preferences: LocalPreferences }
  | { outcome: "conflict"; live: LocalPreferences | null };
export type DraftIntent = "customer_order" | "planned_design";
export type DraftCostMaterial = {
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  confidence: "known" | "estimated";
  /* المجموعة ٣ (عقد D2/D3): هوية المادة المرتبطة إن اختيرت من المخزون — هوية
   * فقط؛ الأرقام تُدخل وتُجمَّد كما هي. غياب الحقل = بند حر. */
  materialId?: string | null;
};
export type DraftCostTime = {
  minutes: number | null;
  hourlyRateMinor: number | null;
  confidence: "known" | "estimated";
};
export type DraftCostSnapshot = {
  id: string;
  revision: number;
  currency: "JOD";
  materialItems: readonly DraftCostMaterial[];
  time: DraftCostTime | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
  quantity: number;
  createdAt: string;
  /* S09 (UNIT-008/SH-13 — أمر ad133bae القسم ٢): أساس المجموعات الموثق مع
   * اللقطة — أساس الوحدة الواحدة لكل مجموعة كما دخلته المستخدمة؛ التوسيع
   * (expandGroupedCostBasis ثم النواة الواحدة) ضربه في التكرار مرة واحدة
   * في المدخل المسطح أعلاه. حقل اختياري — الغياب = لقطة غير مجمعة (متوافق
   * رجعيًا بنمط S06/S07/S08). */
  groupBasis?: readonly DraftCostGroupBasis[] | null;
};
export type DraftCostGroupBasis = {
  groupId: string;
  label: string;
  repeatQuantity: number;
  /* مكونات الوحدة الواحدة من هذه المجموعة — كما دخلت قبل التوسيع. */
  unitMaterialItems: readonly DraftCostMaterial[];
};
/* S09 (UNIT-029 — أمر ad133bae القسم ٢): مرجع العرض المحفوظ كلقطة موسومة
 * مستقلة — المعرف + مراجعة القالب (إن اختير قالب) + لقطة الاسم + لحظة الأخذ؛
 * تعديل/أرشفة المصدر لاحقًا لا يغير لقطة تاريخية، ولا «الأحدث وقت القراءة»
 * أبدًا (B1-D03/U029-R25). */
export type DraftOfferingRef = {
  catalogItemId: string;
  templateId: string | null;
  revision: number | null;
  nameSnapshot: string;
  takenAt: string;
};
/* S09 (UNIT-007 — أمر ad133bae القسم ٢): مجموعات المسودة — هوية ثابتة
 * لكل مجموعة بتسميتها وتكرارها ونوع عرضها ومرجعها الموسوم؛ لا تُبنى من
 * الكتالوج إجبارًا ولا تُنشئ عرضًا تلقائيًا. حقول اختيارية متوافقة رجعيًا. */
export type DraftGroup = {
  id: string;
  label: string;
  repeatQuantity: number;
  offeringType: "product" | "service";
  offeringRef: DraftOfferingRef | null;
  note: string | null;
};
export type OrderDraft = {
  id: string;
  intent: DraftIntent;
  /* Conflict B: الجهة والاسم الودّي اختياريان في المسودة والاتفاق. */
  customerName: string;
  orderName?: string | null;
  itemName: string;
  catalogItemId: string | null;
  specifications: string;
  quantity: number;
  costSnapshots: readonly DraftCostSnapshot[];
  activeCostSnapshotId: string | null;
  linkedOrderId: string | null;
  /* U-004: مرجع التقدير الذي بدأت منه المسودة — أثر سجل فقط: التقدير لا يتغير،
   * ومحرر التكلفة يعرض بنوده كاقتراحات قابلة للتعديل. حقل اختياري؛ القديم بلاه يُقرأ فارغًا. */
  sourceEstimateId?: string | null;
  /* S09 (UNIT-029): مرجع العرض المحفوظ كلقطة موسومة مستقلة — اختياري؛ الغياب/null = مسودة بلا مرجع (كما كان). */
  offeringRef?: DraftOfferingRef | null;
  /* S09 (UNIT-007): مجموعات المسودة — اختيارية؛ الغياب/null = مسودة غير مجمعة (كما كان). */
  groups?: readonly DraftGroup[] | null;
  /* S09 (CONS-DEC07): سعر مقترح اختياري يدخله المستخدم — ليس اتفاقًا ولا سعر بيع
   * فعليًا ولا حدًا أدنى؛ حرية السعر كما اعتمدها المالك. الغياب/null = بلا اقتراح. */
  suggestedPriceMinor?: number | null;
  createdAt: string;
  updatedAt: string;
};
export type AgreementSource = "instagram" | "whatsapp" | "referral" | "walk_in" | "other";
export type FollowUpEvent = {
  id: string;
  type: "created" | "changed";
  idempotencyKey: string;
  createdAt: string;
  previousDate: string | null;
  followUpDate: string | null;
  reason: string;
};
export type StoredCraftOrder = {
  id: string;
  order: CraftOrder;
  catalogItemId: string | null;
  deliveryDate: string;
  agreementSource: AgreementSource | string | null;
  followUpSummary?: string | null;
  followUpDate?: string | null;
  followUpReason?: string | null;
  followUpEvents?: readonly FollowUpEvent[];
  createdAt: string;
  updatedAt: string;
};

export type ScheduleStatus = "scheduled" | "postponed" | "completed" | "cancelled";
type ScheduleEventType = "created" | "postponed" | "timing_changed" | "completed" | "cancelled";
export type ScheduleEvent = {
  id: string;
  type: ScheduleEventType;
  idempotencyKey: string;
  createdAt: string;
  previousScheduledFor: string | null;
  scheduledFor: string;
  previousScheduledTime: string | null;
  scheduledTime: string | null;
  previousDurationMinutes: number | null;
  durationMinutes: number | null;
  reason: string | null;
};
export type ScheduleEntry = {
  id: string;
  orderId: string;
  kind: "delivery";
  scheduledFor: string;
  scheduledTime: string | null;
  durationMinutes: number | null;
  status: ScheduleStatus;
  postponeReason: string | null;
  events: readonly ScheduleEvent[];
  recurrenceId?: string | null;
  recurrenceIndex?: number | null;
  createdAt: string;
  updatedAt: string;
};
export type ScheduleRecurrenceFrequency = "weekly" | "monthly";
type ScheduleRecurrenceStatus = "active" | "cancelled";
export type ScheduleRecurrence = {
  id: string;
  sourceScheduleId: string;
  orderId: string;
  frequency: ScheduleRecurrenceFrequency;
  occurrenceCount: number;
  status: ScheduleRecurrenceStatus;
  idempotencyKey: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/* تقدير تكلفة مستقل (PA-006 ومبدأ «أدواتي»): حساب تفكير قبل الالتزام — لا يُنشئ
 * أي حدث مالي ولا حركة مخزون ولا طلبًا. يُحفظ للمراجعة اللاحقة فقط ويوسم دائمًا «تقديري». */
type CostEstimateKnowledge = "known" | "estimated" | "partial" | "incomplete" | "stale" | "variable";
export type CostEstimate = {
  id: string;
  title: string;
  currency: "JOD";
  /* مدخلات الحاسبة نفسها: مواد ووقت وبنود اختيارية وكمية وهامش حماية. */
  materialItems: readonly DraftCostMaterial[];
  time: DraftCostTime | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
  quantity: number;
  /* ملخص نتيجة الحساب لحظة الحفظ — يُعاد حسابه عند الفتح للتأكد من الثبات. */
  plannedCostMinor: number;
  unitCostMinor: number;
  priceFloorMinor: number;
  knowledgeState: CostEstimateKnowledge;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalStoreSnapshot = {
  profile: ActivityProfile | null;
  ownerProfile?: OwnerProfile | null;
  preferences: LocalPreferences | null;
  drafts: readonly OrderDraft[];
  orders: readonly StoredCraftOrder[];
  directSales?: readonly DirectSale[];
  schedules: readonly ScheduleEntry[];
  recurrences?: readonly ScheduleRecurrence[];
  financialEvents: readonly FinancialEvent[];
  supplierPurchases?: readonly SupplierPurchase[];
  cashWallets?: readonly CashWallet[];
  cashContinuityEntries?: readonly CashContinuityEntry[];
  materials?: readonly Material[];
  inventoryMovements?: readonly InventoryMovement[];
  inventoryShortages?: readonly InventoryShortage[];
  inventoryActivation?: InventoryActivation | null;
  catalogItems?: readonly CatalogItem[];
  measurementUnits?: readonly MeasurementUnit[];
  directConversions?: readonly DirectConversion[];
  catalogTemplates?: readonly CatalogTemplate[];
  actualTimeRecords?: readonly ActualTimeRecord[];
  shortCashDeclarations?: readonly ShortCashDeclaration[];
  ownerEntitlementPolicies?: readonly OwnerEntitlementPolicy[];
  ownerEntitlementRecords?: readonly OwnerEntitlementRecord[];
  ownerEntitlementOpeningBalances?: readonly OwnerEntitlementOpeningBalance[];
  ownerMovements?: readonly OwnerMovement[];
  allocationPolicies?: readonly AllocationPolicy[];
  costEstimates?: readonly CostEstimate[];
  /* المجموعة ٤ (عقد ٢٩): سجلات الأصول والقروض — مجموعتان جديدتان متجران
   * مستقلان؛ الحقيقة المالية في أحداثها داخل financialEvents. الغياب في
   * التصدير القديم = قائمة فارغة بلا اختراع تاريخ. */
  assets?: readonly AssetRecord[];
  loans?: readonly LoanRecord[];
  /* FIN-001 (WS-178 — Wave 6): سجلات القروض المستلمة — مجموعة جديدة فوق
   * أحداثها داخل financialEvents؛ الاقتراض التزام مستقل لا إيراد ولا رأس
   * مال. الغياب في التصدير القديم = قائمة فارغة بلا اختراع تاريخ. */
  receivedLoans?: readonly ReceivedLoanRecord[];
  /* S04 (DOC-013 / UNIT-025 + العقد المشترك §6.1): رصد أرصدة النقد — قياس
   * الموجود بنطاقه وقطعه ومعرفته؛ ليس حركة نقدية ولا افتتاحًا ولا تمويلًا
   * ولا يُعاد تفسيره تسويةً عند النقل. الغياب في التصدير القديم = قائمة
   * فارغة بلا اختراع قياس. */
  balanceObservations?: readonly CashObservation[];
  /* S05 (DOC-014 / UNIT-037 + العقد المشترك §5.1): الأطراف المحفوظة — هوية
   * تعريفية اختيارية بلا أي أثر مالي (الرصيد يُشتق من المصادر المرتبطة
   * بمعرف الطرف وقت القراءة). الغياب في التصدير القديم = قائمة فارغة بلا
   * اختراع هوية ولا ربط تاريخي بالتخمين. */
  counterparties?: readonly SavedParty[];
  /* OPS-003 (عقد ٤١): سلاسل المصروف المتكرر ومراجعاتها وفتراتها — ثلاث مجموعات
   * جديدة فوق أحداثها داخل financialEvents؛ الفترة تحمل رابط الحدث
   * (recordedFinancialEventId) باتجاه واحد. الغياب في التصدير القديم = قائمة
   * فارغة بلا اختراع تاريخ. */
  recurringExpenseSeries?: readonly RecurringExpenseSeries[];
  recurringExpenseRevisions?: readonly RecurringExpenseRuleRevision[];
  recurringExpenseOccurrences?: readonly RecurringExpenseOccurrence[];
  /* FIN-002 (عقد ٤٢): سجلات الميزانية المختارة وأهداف المصروف — مخزن تشغيلي
   * واحد بلا أي أثر مالي (الخطة ليست حدثًا ماليًا أبدًا)؛ النسخة الخلف
   * والتوثيق بالإغلاق داخل السجل نفسه بروابط للأمام فقط. الغياب في التصدير
   * القديم = قائمة فارغة بلا اختراع تاريخ. */
  expenseBudgets?: readonly ExpenseBudgetRecord[];
};
export type LocalExportFile = {
  format: typeof localExportFormat;
  version: typeof localExportVersion;
  schemaVersion: typeof localSchemaVersion;
  exportedAt: string;
  data: LocalStoreSnapshot;
  /* المجموعة ٥: تكامل الملف — اختيارية كلها فتبقى ملفات ٢٦ وأقدم صالحة؛
   * البصمة تُتحقق عند وجودها وغيابها يعني ملفًا قديمًا يُعامل كالسابق. */
  integrity?: LocalExportIntegrity;
  counts?: LocalExportCounts;
  appVersion?: string;
};
export type StorageFailureCode =
  | "storage_unavailable"
  | "storage_error"
  | "storage_upgrade_failed"
  | "storage_blocked"
  | "storage_stale"
  /* S02-A (SH-03): سياج الاستبدال داخل حد الكتابة — الحالة الحية داخل معاملة
   * الاستبدال خالفت البصمة المرجوة (كاتب آخر سبق المعاملة) فأُحبطت المعاملة
   * بلا أي كتابة؛ ليس قدم إصدار (storage_stale) بل تعارض سياق الاستبدال. */
  | "replacement_context_stale"
  /* S02-A (SH-02): نية استبدال قائمة لم تُحسم بعد — لا تبدأ نية ثانية فوقها
   * (سياج النية الواحدة داخل معاملة البدء نفسها؛ سباق نوافذ لا يعبر أبدًا). */
  | "replacement_intent_busy";
export type StorageFailure = { ok: false; code: StorageFailureCode; message: string };
type StorageSuccess<T> = { ok: true; value: T };
export type StorageResult<T> = StorageSuccess<T> | StorageFailure;

/* رقعة إغلاق المجموعة ٢ (مراجعة مستقلة): تصنيف فشل التخزين لزوج خدمات
 * التطبيق — تعارض القراءة-التعديل-الكتابة يصل المستدعي كودًا مطبوعًا
 * storage_stale (أعد الفتح ثم أعد المحاولة) والفشل التخزيني الحقيقي يظل
 * storage_error؛ الرسالة تبقى نص المتجر الصادق. يُعرَّف هنا بجوار مفردة
 * الأكواد نفسها فلا تُكرر حرفية الكود في خدمات الشاشات. */
export const storageFailureCode = (code: StorageFailureCode): "storage_error" | "storage_stale" =>
  code === "storage_stale" ? "storage_stale" : "storage_error";

/* OPS-003 (عقد ٤١): زوج تحديث فترة محروس — الأساس الذي قرأته الخدمة
 * والنتيجة المرادة؛ الانحراف بين الأساس والحالة الحية داخل حد الكتابة
 * يُرفض بـstorage_stale بلا كتابة. */
export type RecurringExpenseOccurrenceChange = {
  base: RecurringExpenseOccurrence;
  next: RecurringExpenseOccurrence;
};

export interface PrototypeLocalStore {
  getProfile(): Promise<StorageResult<ActivityProfile | null>>;
  saveProfile(profile: ActivityProfile): Promise<StorageResult<ActivityProfile>>;
  /* U001-IR-002 (مراجعة مستقلة 2026-10-18): إنشاء ملف الهوية كتابةً أولى فقط
   * ذرّيًا عند حد الكتابة — القراءة والكتابة في معاملة واحدة (IndexedDB) أو
   * خطوة متزامنة واحدة (الذاكرة)؛ وجوده سلفًا إعادة استخدام بلا كتابة فوقه
   * (نفس عقد commitScheduleCreate) فلا يطمس استدعاءان متزامنان أول هوية
   * منشأة (الخدمة تُحوِّل reused إلى created:false الصادق). */
  commitProfileCreate(
    profile: ActivityProfile,
  ): Promise<StorageResult<{ profile: ActivityProfile; reused: boolean }>>;
  /* S03 (UNIT-039 B2/عقد §17 «نافذتان تعدلان المصدر»): تعديل اسم الهوية
   * القائمة كتابة محروسة عند حد الكتابة — فحص حي للنسخة داخل المعاملة نفسها
   * (CAS على updatedAt المخزن مقابل المتوقع): تطابقت النسخة تُكتب التسمية
   * الجديدة بنفس المعرف وcreatedAt، واختلفت (أو غاب الملف) تُعاد الحالة
   * الحالية كتعارض صادق بلا كتابة — لا lost update ولا سحق للاسم الأحدث،
   * ولا إنشاء ملف من مسار التعديل أبدًا. النتيجة مميّزة النوع: renamed
   * ⟹ الملف المُعاد موجود دائمًا، وconflict ⟹ قد يغيب (null). */
  commitProfileRename(
    profile: ActivityProfile,
    expectedUpdatedAt: string,
  ): Promise<StorageResult<ProfileRenameCommitOutcome>>;
  /** ملف المالك (المجموعة ١): هوية محلية مستقلة — سجل واحد بمعرّف ثابت. */
  getOwnerProfile(): Promise<StorageResult<OwnerProfile | null>>;
  saveOwnerProfile(profile: OwnerProfile): Promise<StorageResult<OwnerProfile>>;
  getPreferences(): Promise<StorageResult<LocalPreferences | null>>;
  savePreferences(preferences: LocalPreferences): Promise<StorageResult<LocalPreferences>>;
  /* S03 revalidation (00-S03-REVALIDATION-S04-EXECUTION-PROMPT-2026-10-28 §A2):
   * كتابة التفضيلات المحروسة عند حد الكتابة — القراءة والدمج والكتابة
   * معًا (معاملة IndexedDB واحدة / خطوة متزامنة واحدة في الذاكرة)، فالرقعة
   * تُطبَّق فوق السجل الحي داخل الحد لا فوق لقطة المتصل: كاتبان متزامنان
   * على حقول مختلفة لا يفقد أحدهما تحديثه أبدًا (العيب المُثبت في بوابة
   * read-merge-full-write المتقاعدة كمصدر حقيقة). expectedUpdatedAt=null
   * لا توقع نسخة (مساركتّاب الحقول)؛ وقيمة نصية فحص CAS حي: الغياب أو
   * اختلاف الطابع تعارض صادق بلا كتابة (نمط commitProfileRename). */
  commitPreferencesUpdate(
    patch: LocalPreferencesPatch,
    expectedUpdatedAt: string | null,
    timestamp: string,
  ): Promise<StorageResult<PreferencesCommitOutcome>>;
  listDrafts(): Promise<StorageResult<readonly OrderDraft[]>>;
  getDraft(id: string): Promise<StorageResult<OrderDraft | null>>;
  saveDraft(draft: OrderDraft): Promise<StorageResult<OrderDraft>>;
  /** القرار ٢١: حذف مسودة غير مرتبطة — سجل بلا أثر مالي؛ الحارس في خدمة التطبيق. */
  deleteDraft(id: string): Promise<StorageResult<null>>;
  listOrders(): Promise<StorageResult<readonly StoredCraftOrder[]>>;
  getOrder(id: string): Promise<StorageResult<StoredCraftOrder | null>>;
  saveOrder(order: StoredCraftOrder): Promise<StorageResult<StoredCraftOrder>>;
  /* G-003 (تدقيق الإدارة المالية المتدرجة 2026-09-19): كتابة الطلب العائلية
   * عبر saveOrder كانت كتابة عمياء (آخر كاتب يفوز) تسمح لمسارين متزامنين
   * بإسقاط أثر أحدهما بصمت. هذا الالتزام المحروس يتحقق الحالة الحية داخل
   * حد الكتابة نفسه: إعادة تشغيل العملية نفسها (بمفتاحها) إعادة استخدام
   * صادقة بلا كتابة، والسجل الحي إن تغيّر منذ قراءة الخدمة (القاعدة)
   * يُرفض بـstorage_stale ولا يُكتب شيء — فيبقى أثر الفائز محفوظًا ولا
   * يُدمج حقول مالية/مخزنية بصمت. saveOrder يبقى للإنشاء والبذور فقط. */
  commitOrderUpdate(
    base: StoredCraftOrder,
    next: StoredCraftOrder,
    idempotencyKeys: readonly string[],
  ): Promise<StorageResult<{ order: StoredCraftOrder; reused: boolean }>>;
  /** المجموعة ٦ (البند ١ — S2-04أ): تراجع القبضة مع تخصيصها المطابق في معاملة
   * واحدة ذرّية — الطلب وأثر الكاش يُكتبان معًا أو لا يُكتب شيء، مع فحص هوية داخل
   * المعاملة يمنع التكرار المزدوج ويكشف الحالة النصفية بصدق لا بإكمال صامت. */
  commitOrderCollectionReversal(
    order: StoredCraftOrder,
    allocationReversal: CashContinuityEntry | null,
    reversalEventKey: string,
  ): Promise<
    StorageResult<{ order: StoredCraftOrder; cashEntry: CashContinuityEntry | null; reused: boolean }>
  >;
  /* Conflict E (FC-06): رد العربون من محفظة المصدر — الطلب المرتد وأثر فك
   * التخصيصات يُكتبان معًا أو لا يُكتب شيء؛ فحص هوية داخل المعاملة يمنع
   * الرد المزدوج ويرفض فك تخصيص مُفكوك سابقًا.
   * EXE-010: النوع الافتراضي deposit_refunded (رد الملغى)؛ reverse-deposit
   * يعيد استخدام البروتوكول نفسه لعكس العربون النشط قبل التسليم. */
  commitDepositRefundSettlement(
    order: StoredCraftOrder,
    allocationReversals: readonly CashContinuityEntry[],
    refundEventKey: string,
    eventType?: "deposit_refunded" | "deposit_reversed",
  ): Promise<
    StorageResult<{ order: StoredCraftOrder; cashEntries: readonly CashContinuityEntry[]; reused: boolean }>
  >;
  listDirectSales(): Promise<StorageResult<readonly DirectSale[]>>;
  saveDirectSale(sale: DirectSale): Promise<StorageResult<DirectSale>>;
  /* EXE-010 (AUD-NEW-04): عكس تحصيل بيع مباشر — البيع المعدل (بمراجعة العكس
   * الموثقة) وقيد عكس تخصيص المحفظة معًا أو لا شيء؛ فحص هوية داخل المعاملة
   * يمنع تكرار العكس ويرفض الحالة النصفية بلا كتابة. */
  commitDirectSaleCollectionReversal(
    sale: DirectSale,
    allocationReversal: CashContinuityEntry | null,
    revisionKey: string,
  ): Promise<StorageResult<{ sale: DirectSale; cashEntry: CashContinuityEntry | null; reused: boolean }>>;
  listSchedules(): Promise<StorageResult<readonly ScheduleEntry[]>>;
  getSchedule(id: string): Promise<StorageResult<ScheduleEntry | null>>;
  saveSchedule(schedule: ScheduleEntry): Promise<StorageResult<ScheduleEntry>>;
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): إنشاء موعد كتابةً أولى فقط — وجوده
   * سلفًا إعادة استخدام لا كتابة فوق مسار آخر (محتوى الإنشاء حتمي بمعرّفه ومفتاحه). */
  commitScheduleCreate(
    schedule: ScheduleEntry,
  ): Promise<StorageResult<{ schedule: ScheduleEntry; reused: boolean }>>;
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): تحديث موعد بحدث واحد جديد بالضبط —
   * الأحداث السابقة كما هي حرفيًا وحقول «قبل» في الحدث الجديد تطابق المخزّن الحي؛
   * التعارض يُرفض بـ storage_stale ولا يُكتب شيء، وإعادة التشغيل بالمفتاح نفسه
   * تعيد المخزّن كما هو. */
  commitScheduleUpdate(
    schedule: ScheduleEntry,
  ): Promise<StorageResult<{ schedule: ScheduleEntry; reused: boolean }>>;
  listRecurrences(): Promise<StorageResult<readonly ScheduleRecurrence[]>>;
  getRecurrence(id: string): Promise<StorageResult<ScheduleRecurrence | null>>;
  saveRecurrence(recurrence: ScheduleRecurrence): Promise<StorageResult<ScheduleRecurrence>>;
  commitRecurrence(
    recurrence: ScheduleRecurrence,
    schedules: readonly ScheduleEntry[],
  ): Promise<StorageResult<{ recurrence: ScheduleRecurrence; schedules: readonly ScheduleEntry[] }>>;
  listFinancialEvents(): Promise<StorageResult<readonly FinancialEvent[]>>;
  getFinancialEvent(id: string): Promise<StorageResult<FinancialEvent | null>>;
  saveFinancialEvent(event: FinancialEvent): Promise<StorageResult<FinancialEvent>>;
  commitFinancialEventCorrection(
    sourceEventId: string,
    reversal: FinancialEvent,
  ): Promise<StorageResult<FinancialEvent>>;
  /** تعديل موثق واحد-ذرّي: يكتب التراجع والبديل في معاملة واحدة فلا يبقى أثر معلّق بينهما. */
  commitFinancialEventReplacement(
    sourceEventId: string,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<StorageResult<{ reversal: FinancialEvent; replacement: FinancialEvent }>>;
  listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>>;
  getSupplierPurchase(id: string): Promise<StorageResult<SupplierPurchase | null>>;
  saveSupplierPurchase(purchase: SupplierPurchase): Promise<StorageResult<SupplierPurchase>>;
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): كتابة ذرّية مُحروسة لسجل الشراء —
   * فحص مفتاح الحتمية داخل المعاملة ثم علاقة «عملية مجال واحدة بالضبط» بين
   * المخزّن والوارد؛ التعارض يُرفض بـ storage_stale ولا يُكتب شيء، وإعادة
   * التشغيل بنفس المفتاح تعيد السجل الحالي كما هو. */
  commitSupplierPurchase(
    commit: SupplierPurchaseCommit,
  ): Promise<StorageResult<{ purchase: SupplierPurchase; reused: boolean }>>;
  /* G-002 (تدقيق الإدارة المالية المتدرجة 2026-09-19): دفعة المورد وتخصيص
   * محفظتها في معاملة واحدة ذرّية — الشراء والدفعة (فحص علاقة المورد نفسه)
   * وقيد التخصيص السالب يُكتبان معًا أو لا يُكتب شيء. إعادة التشغيل بالمفتاح
   * نفسه: الدفعة إعادة استخدام صادقة، والتخصيص الناقص يُشفي داخل المعاملة
   * نفسها (مفتاح العملية الحتمي + تحقق المصدر والمبلغ من الدفعة المخزّنة)
   * فلا يبقى أثر غير موزع بعد فشل أو انقطاع. */
  commitSupplierPurchaseWithAttribution(
    commit: SupplierPurchaseCommit,
    attribution: CashContinuityEntry | null,
  ): Promise<
    StorageResult<{
      purchase: SupplierPurchase;
      attributionEntry: CashContinuityEntry | null;
      reused: boolean;
    }>
  >;
  listCashWallets(): Promise<StorageResult<readonly CashWallet[]>>;
  listCashContinuityEntries(): Promise<StorageResult<readonly CashContinuityEntry[]>>;
  commitCashContinuity(
    wallet: CashWallet | null,
    entries: readonly CashContinuityEntry[],
  ): Promise<StorageResult<{ wallet: CashWallet | null; entries: readonly CashContinuityEntry[] }>>;
  /* S04 (DOC-013 / UNIT-025 + العقد المشترك §6.1/§14): رصد أرصدة النقد —
   * القياس وتسويته المرتبطة (إن وُجدت) يُكتبان معًا أو لا يُكتب شيء: الرصد
   * بحد ذاته لا يُنشئ نقدًا ولا يمحو حركة؛ والتسوية (cash_adjustment) تحمل
   * الفرق عن مرجع معروف فقط. الحتمية داخل الحد: مفتاح الرصد المكرر يُعاد
   * استخدامه، وقيد التسوية يخضع لفلترة مفاتيح القيود نفسها؛ وعند وجود
   * تسوية يجب أن يطابق رصيد المحفظة الحي داخل المعاملة المرجع المتوقع
   * (expectedReferenceMinor) وإلا حُبطت المعاملة كاملة بلا أي كتابة — لا
   * تسوية مزدوجة من نافذتين ولا قياس يُبتلع (نمط base/next المحروس). */
  listBalanceObservations(): Promise<StorageResult<readonly CashObservation[]>>;
  commitCashObservation(
    observation: CashObservation,
    settlement: CashContinuityEntry | null,
    expectedReferenceMinor: number | null,
  ): Promise<
    StorageResult<{
      observation: CashObservation;
      settlement: CashContinuityEntry | null;
      reused: boolean;
    }>
  >;
  /* S05 (DOC-014 / UNIT-037 + العقد المشترك §14): كتابة الطرف المحفوظ المحروسة
   * عند حد الكتابة — القراءة والفحص والكتابة في معاملة واحدة (IndexedDB) أو
   * خطوة متزامنة واحدة (الذاكرة): إعادة الأمر نفسه (operationKey) إعادة
   * استخدام صادقة بلا كتابة ثانية؛ والإنشاء فوق سجل قائم بمفتاح مختلف
   * تعارض صادق؛ والتعديل (تسمية/أرشفة) CAS حي على updatedAt — الأساس الذي
   * قرأته الخدمة يطابق الحي داخل الحد وإلا حُبط بلا كتابة. */
  listCounterparties(): Promise<StorageResult<readonly SavedParty[]>>;
  getCounterparty(id: string): Promise<StorageResult<SavedParty | null>>;
  commitCounterpartyWrite(
    commit: CounterpartyWriteCommit,
  ): Promise<StorageResult<{ party: SavedParty; reused: boolean }>>;
  listMaterials(): Promise<StorageResult<readonly Material[]>>;
  listInventoryMovements(): Promise<StorageResult<readonly InventoryMovement[]>>;
  getInventoryActivation(): Promise<StorageResult<InventoryActivation | null>>;
  saveInventoryActivation(activation: InventoryActivation): Promise<StorageResult<InventoryActivation>>;
  /* S07-MR-001 (أمر S08 — القسم ١): كل كتابة مخزون حساسة تتحقق الحالة الحية
   * داخل حد الكتابة نفسه — الخدمة تُمرر بصمات الحالة التي قرأتها وبنت عليها
   * حراسها (InventoryCommitExpectation)، والمهايئان يقارنانها بالحقيقة الحية
   * داخل المعاملة (IndexedDB) أو الخطوة المتزامنة (الذاكرة) ويرفضان
   * بـstorage_stale بلا أي كتابة جزئية عند أي انحراف، مع حتمية داخل الحد
   * (المفتاح المتطابق ماليًا يُعاد كما هو، والمختلف تعارض بلا استبدال).
   * غياب التوقع = مسار البذر/المطابقة منخفض المستوى بسلوكه القائم نفسه. */
  commitInventory(
    material: Material | null,
    movements: readonly InventoryMovement[],
    expectation?: InventoryCommitExpectation | null,
  ): Promise<
    StorageResult<{
      material: Material | null;
      movements: readonly InventoryMovement[];
      reused: boolean;
    }>
  >;
  /* المجموعة ٢ (عقد ٢٨): قراءة سجلات نقص المخزون — مرتبطة زمنيًا كالحركات. */
  listInventoryShortages(): Promise<StorageResult<readonly InventoryShortage[]>>;
  /* المجموعة ٢ (عقد ٢٨ / D-027): كتابة ذرّية واحدة للمادة وحركاتها وسجل النقص —
   * كل شيء أو لا شيء؛ لا حالة بينية (استهلاك جزئي + نقص معًا مثلًا). الحارس
   * S07-MR-001 يعمل هنا بالعقد نفسه (بصمات + حتمية داخل الحد). */
  commitInventoryWithShortage(
    material: Material | null,
    movements: readonly InventoryMovement[],
    shortage: InventoryShortage | null,
    expectation?: InventoryCommitExpectation | null,
  ): Promise<
    StorageResult<{
      material: Material | null;
      movements: readonly InventoryMovement[];
      shortage: InventoryShortage | null;
      reused: boolean;
    }>
  >;
  /** عقد الإغلاق العميق (العقد ١ — الهدر): حركة مخزون مع حدث مالي واحد في
   * معاملة ذرّية — هدرٌ يؤثر على النتيجة يسجّل حركته وحدث خسارته غير النقدية
   * معًا أو لا شيء؛ والتراجع عنه يعكس الاثنين معًا. الحتمية داخل المعاملة:
   * الحركة بمفتاحها والحدث بمفتاحه. حارس S07-MR-001 يعمل هنا بالعقد نفسه. */
  commitInventoryWithEvents(
    material: Material | null,
    movements: readonly InventoryMovement[],
    events: readonly FinancialEvent[],
    expectation?: InventoryCommitExpectation | null,
  ): Promise<
    StorageResult<{
      material: Material | null;
      movements: readonly InventoryMovement[];
      events: readonly FinancialEvent[];
      reused: boolean;
    }>
  >;
  listCatalogItems(): Promise<StorageResult<readonly CatalogItem[]>>;
  getCatalogItem(id: string): Promise<StorageResult<CatalogItem | null>>;
  saveCatalogItem(item: CatalogItem): Promise<StorageResult<CatalogItem>>;
  listMeasurementUnits(): Promise<StorageResult<readonly MeasurementUnit[]>>;
  getMeasurementUnit(id: string): Promise<StorageResult<MeasurementUnit | null>>;
  saveMeasurementUnit(unit: MeasurementUnit): Promise<StorageResult<MeasurementUnit>>;
  listDirectConversions(): Promise<StorageResult<readonly DirectConversion[]>>;
  getDirectConversion(id: string): Promise<StorageResult<DirectConversion | null>>;
  saveDirectConversion(conversion: DirectConversion): Promise<StorageResult<DirectConversion>>;
  listCatalogTemplates(catalogItemId?: string): Promise<StorageResult<readonly CatalogTemplate[]>>;
  getCatalogTemplate(id: string): Promise<StorageResult<CatalogTemplate | null>>;
  commitCatalogTemplateRevision(
    previous: CatalogTemplate,
    next: CatalogTemplate,
  ): Promise<StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }>>;
  saveCatalogTemplate(template: CatalogTemplate): Promise<StorageResult<CatalogTemplate>>;
  listActualTimeRecords(): Promise<StorageResult<readonly ActualTimeRecord[]>>;
  listShortCashDeclarations(): Promise<StorageResult<readonly ShortCashDeclaration[]>>;
  getShortCashDeclaration(id: string): Promise<StorageResult<ShortCashDeclaration | null>>;
  saveShortCashDeclaration(declaration: ShortCashDeclaration): Promise<StorageResult<ShortCashDeclaration>>;
  commitShortCashDeclarationReversal(
    sourceId: string,
    reversal: ShortCashDeclaration,
  ): Promise<StorageResult<ShortCashDeclaration>>;
  listOwnerEntitlementPolicies(): Promise<StorageResult<readonly OwnerEntitlementPolicy[]>>;
  getOwnerEntitlementPolicy(id: string): Promise<StorageResult<OwnerEntitlementPolicy | null>>;
  saveOwnerEntitlementPolicy(policy: OwnerEntitlementPolicy): Promise<StorageResult<OwnerEntitlementPolicy>>;
  commitOwnerEntitlementPolicySuccessor(
    previous: OwnerEntitlementPolicy,
    successor: OwnerEntitlementPolicy,
  ): Promise<StorageResult<{ previous: OwnerEntitlementPolicy; successor: OwnerEntitlementPolicy }>>;
  listOwnerEntitlementRecords(): Promise<StorageResult<readonly OwnerEntitlementRecord[]>>;
  getOwnerEntitlementRecord(id: string): Promise<StorageResult<OwnerEntitlementRecord | null>>;
  saveOwnerEntitlementRecord(record: OwnerEntitlementRecord): Promise<StorageResult<OwnerEntitlementRecord>>;
  commitOwnerEntitlementRecordReversal(
    sourceId: string,
    reversal: OwnerEntitlementRecord,
  ): Promise<StorageResult<OwnerEntitlementRecord>>;
  listOwnerEntitlementOpeningBalances(): Promise<StorageResult<readonly OwnerEntitlementOpeningBalance[]>>;
  saveOwnerEntitlementOpeningBalance(
    balance: OwnerEntitlementOpeningBalance,
  ): Promise<StorageResult<OwnerEntitlementOpeningBalance>>;
  commitOwnerEntitlementOpeningBalanceReversal(
    sourceId: string,
    reversal: OwnerEntitlementOpeningBalance,
  ): Promise<StorageResult<OwnerEntitlementOpeningBalance>>;
  listOwnerMovements(): Promise<StorageResult<readonly OwnerMovement[]>>;
  getOwnerMovement(id: string): Promise<StorageResult<OwnerMovement | null>>;
  commitOwnerMovement(
    movement: OwnerMovement,
    cashEntry: CashContinuityEntry,
  ): Promise<StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>>;
  saveActualTimeRecord(record: ActualTimeRecord): Promise<StorageResult<ActualTimeRecord>>;
  listAllocationPolicies(catalogItemId?: string): Promise<StorageResult<readonly AllocationPolicy[]>>;
  getAllocationPolicy(id: string): Promise<StorageResult<AllocationPolicy | null>>;
  saveAllocationPolicy(policy: AllocationPolicy): Promise<StorageResult<AllocationPolicy>>;
  commitAllocationPolicySuccessor(
    previous: AllocationPolicy,
    successor: AllocationPolicy,
  ): Promise<StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }>>;
  listCostEstimates(): Promise<StorageResult<readonly CostEstimate[]>>;
  getCostEstimate(id: string): Promise<StorageResult<CostEstimate | null>>;
  saveCostEstimate(estimate: CostEstimate): Promise<StorageResult<CostEstimate>>;
  /** حذف تقدير حر: أداة تفكير لا سجل مالي — يحذف بلا أثر على أي رصيد. */
  deleteCostEstimate(id: string): Promise<StorageResult<null>>;
  commitOrderFromDraft(
    order: StoredCraftOrder,
    draft: OrderDraft,
    schedule?: ScheduleEntry,
  ): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft; schedule: ScheduleEntry | null }>>;
  /* المجموعة ٣ (عقد D4): معاملة تسليم ذرّية واحدة — الطلب المسلّم وحركات
   * استهلاك المواد وسجلات النقص وتخصيص الكاش المقبوض عند التسليم تُكتب معًا
   * أو لا يُكتب شيء؛ فحص الهوية داخل المعاملة يمنع تكرار التسليم والحركات
   * عند إعادة المحاولة أو الإعادة بعد انقطاع.
   * G-003: القاعدة (base) هي السجل الذي قرأته الخدمة قبل بناء الحمولة —
   * كتابة الطلب داخل المعاملة تتحقق مطابقته للسجل الحي قبل أي put، فلا
   * يُطمر أثر مسار متزامن كُتب بين قراءة الخدمة والالتزام. */
  commitOrderDelivery(
    base: StoredCraftOrder,
    order: StoredCraftOrder,
    movements: readonly InventoryMovement[],
    shortages: readonly InventoryShortage[],
    wallet: CashWallet | null,
    cashEntry: CashContinuityEntry | null,
  ): Promise<
    StorageResult<{
      order: StoredCraftOrder;
      movements: readonly InventoryMovement[];
      shortages: readonly InventoryShortage[];
      cashEntry: CashContinuityEntry | null;
      reused: boolean;
    }>
  >;
  /* المجموعة ٣ (عقد D4): عكس التسليم ذرّيًا — الطلب المعكوس وحركات المرآة
   * تُكتبان معًا؛ لا حالة بينية (عكس بلا حركات أو حركات بلا عكس). */
  commitOrderDeliveryReversal(
    order: StoredCraftOrder,
    reversalMovements: readonly InventoryMovement[],
  ): Promise<
    StorageResult<{
      order: StoredCraftOrder;
      reversalMovements: readonly InventoryMovement[];
      reused: boolean;
    }>
  >;
  readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>>;
  /* S02-A (SH-03 — عقد ٠٤٤ §16.5): الاستبدال حد واحد يشمل مخازن اللقطة كلها
   * **ومسح مسودات النماذج العابرة في المعاملة نفسها** (كانت تُمسك خارج الحد
   * فتبقى فوق بيانات استُبدلت)؛ والسياج الاختياري يقارن بصمة الحالة الحية
   * داخل المعاملة قبل أي مسح فلا يستبدل كاتب آخر سبقه أبدًا (ضمان مخزني).
   * قائمة الاسترداد الاختيارية تعيد مسودات معزولة مع اللقطة في الحد نفسه
   * (مسار استرجاع النسخة السابقة وحده). */
  replaceSnapshot(
    snapshot: LocalStoreSnapshot,
    guard?: ReplacementGuard,
  ): Promise<StorageResult<LocalStoreSnapshot>>;
  /* المجموعة ٥ (عقد المسودة النصية): مسودات النماذج الطويلة — مخزن مستقل خارج
   * اللقطة؛ لا حدث مالي ولا مخزون ولا تغيير رصيد يحدث عبر هذه المسارات أبدًا.
   * الاستعادة عرضٌ صريح يقبله المستخدم؛ التعارض مع سجل نهائي يرفض التطبيق الصامت. */
  getFormDraft(id: string): Promise<StorageResult<FormDraftEnvelope | null>>;
  saveFormDraft(draft: FormDraftEnvelope): Promise<StorageResult<FormDraftEnvelope>>;
  deleteFormDraft(id: string): Promise<StorageResult<null>>;
  /* المجموعة ٥ (التحصين الكامل): تعداد المسودات العابرة ومسحها الذرّي —
   * للسياسة المعلنة في إعادة التعيين ولملاحظة الاستيراد الصادقة؛ المخزن
   * نفسه يبقى خارج اللقطة والتصدير كما كان. */
  listFormDrafts(): Promise<StorageResult<readonly FormDraftEnvelope[]>>;
  clearFormDrafts(): Promise<StorageResult<null>>;
  /* المجموعة ٥ (القفل المحلي): سجل أمان واحد بمعرّف ثابت — خارج اللقطة والتصدير
   * والأسرار؛ تخزين الرمز نفسه ممنوع، البصمة فقط. */
  getLocalSecurity(): Promise<StorageResult<LocalSecurityRecord | null>>;
  saveLocalSecurity(security: LocalSecurityRecord): Promise<StorageResult<LocalSecurityRecord>>;
  /** تعطيل القفل يحذف سجل الأمان نهائيًا — لا أثر يبقى في الجهاز. */
  deleteLocalSecurity(): Promise<StorageResult<null>>;
  /* S02-A (SH-02/SH-03): حماية الاستبدال الدائمة — قاعدة منفصلة خارج نطاق
   * الاستبدال؛ القراءات الأربعة في حد قراءة واحد، والعمليات الثلاث ذرّية
   * داخل قاعدة الحماية نفسها (لا نية بلا نسخة رجوع معلقة، ولا ترقية نسخة
   * نشطة إلا مع التزام الاستبدال وصك الجيل معًا). */
  getDataGeneration(): Promise<StorageResult<number>>;
  readRestoreProtection(): Promise<StorageResult<RestoreProtectionState>>;
  /** بدء نية استبدال: النسخة الرجوع المعلقة + النية في معاملة واحدة، ويرفض
   * (replacement_intent_busy) إن وُجدت نية قائمة لم تُحسم — لا نيتان متزامنتان
   * أبدًا مهما تعددت النوافذ. */
  beginReplacementIntent(
    pending: RestoreRollbackRecord,
    intent: ReplacementIntentRecord,
  ): Promise<StorageResult<null>>;
  /** التزام الاستبدال: ترقية النسخة المعلقة إلى نشطة + صك الجيل + كتابة
   * الإيصال + حذف النية — معاملة واحدة، لا نصف ترقية أبدًا. */
  commitReplacementIntent(
    generation: number,
    receipt: ReplacementReceiptRecord,
    resolvedAt: string,
  ): Promise<StorageResult<null>>;
  /** إحباط نية: حذف المعلقة + حذف النية معًا — الإيصال والنسخة النشطة
   * والجيل لا يُمسّان أبدًا بمحاولة فاشلة (عقد ٠٤٤ B4.3). */
  abortReplacementIntent(): Promise<StorageResult<null>>;
  /* المجموعة ٤ (عقد ٢٩ — الأصول): قراءة سجل الأصول. */
  listAssets(): Promise<StorageResult<readonly AssetRecord[]>>;
  getAsset(id: string): Promise<StorageResult<AssetRecord | null>>;
  /* كتابة ذرّية واحدة: سجل الأصل مع حدثه المالي (إنشاء/إهلاك دورة حياة/تخلص/
   * شطب) أو بلا حدث (مراجعة عقد) — كل شيء أو لا شيء؛ إعادة المحاولة آمنة
   * بفحص هوية داخل المعاملة يعيد الاستخدام الصادق لا التكرار. */
  commitAssetRecord(
    record: AssetRecord,
    event: FinancialEvent | null,
  ): Promise<StorageResult<{ record: AssetRecord; event: FinancialEvent | null; reused: boolean }>>;
  /* S08 (UNIT-034): الاقتناء الذري متعدد الأحداث — السجل وأحداث اقتنائه
   * (نقدي كامل، أو ذمم كاملة، أو جزئيًا: حدث نقدي بالمدفوع + حدث ذمم
   * بالمتبقي) في معاملة واحدة؛ إعادة الإرسال إعادة استخدام بالمفاتيح
   * لا تكرارًا، وحارس العلاقة داخل الحد كما هو موثق عند الحارس النقي. */
  commitAssetAcquisition(
    record: AssetRecord,
    events: readonly FinancialEvent[],
  ): Promise<
    StorageResult<{
      record: AssetRecord;
      events: readonly FinancialEvent[];
      reused: boolean;
    }>
  >;
  /* تصحيح اقتناء أصل: التراجعات والبدائل والسجل المحدّث في معاملة واحدة.
   * S08: صيغة المصفوفات — تصحيح الاقتناء الجزئي يعكس حدثيه ويستبدلهما
   * (حتى حدثين من كل نوع) في المعاملة نفسها. */
  commitAssetAcquisitionCorrection(
    record: AssetRecord,
    reversals: readonly FinancialEvent[],
    replacements: readonly FinancialEvent[],
  ): Promise<
    StorageResult<{
      record: AssetRecord;
      reversals: readonly FinancialEvent[];
      replacements: readonly FinancialEvent[];
      reused: boolean;
    }>
  >;
  /* S08 (UNIT-034 / SDF-066): تسديد ذممة اقتناء أصل داخل حد الكتابة —
   * المصدر الحي (حدث asset_purchase_payable فعال) والمبلغ داخل المتبقي
   * الحي المحسوب من الأحداث داخل المعاملة نفسها؛ إعادة المفتاح المتطابق
   * إعادة استخدام صادقة والمختلف تعارض بلا استبدال؛ حدث واحد أو لا شيء. */
  commitAssetPayableSettlement(
    settlement: FinancialEvent,
  ): Promise<StorageResult<{ settlement: FinancialEvent; reused: boolean }>>;
  /* المجموعة ٤ (عقد ٢٩ — القروض): قراءة سجل القروض. */
  listLoans(): Promise<StorageResult<readonly LoanRecord[]>>;
  getLoan(id: string): Promise<StorageResult<LoanRecord | null>>;
  /* كتابة ذرّية واحدة: سجل القرض مع حدثه (إنشاء/سداد) أو تراجع سداد (الحدث
   * المعكوس) — لا حالة بينية أبدًا. */
  commitLoanRecord(
    record: LoanRecord,
    event: FinancialEvent,
  ): Promise<StorageResult<{ record: LoanRecord; event: FinancialEvent; reused: boolean }>>;
  /* تصحيح قرض: التراجع والبديل والسجل المحدّث في معاملة واحدة. */
  commitLoanCorrection(
    record: LoanRecord,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<
    StorageResult<{
      record: LoanRecord;
      reversal: FinancialEvent;
      replacement: FinancialEvent;
      reused: boolean;
    }>
  >;
  /* FIN-001 (WS-178 — Wave 6 — القروض المستلمة): قراءة سجل القروض المستلمة. */
  listReceivedLoans(): Promise<StorageResult<readonly ReceivedLoanRecord[]>>;
  getReceivedLoan(id: string): Promise<StorageResult<ReceivedLoanRecord | null>>;
  /* كتابة ذرّية واحدة: سجل القرض المستلم مع حدثه (قبض أصل/سداد أصل/تراجع
   * سداد) — لا حالة بينية أبدًا؛ نفس عهدة الحتمية وحارس علاقة AV-02. */
  commitReceivedLoanRecord(
    record: ReceivedLoanRecord,
    event: FinancialEvent,
  ): Promise<StorageResult<{ record: ReceivedLoanRecord; event: FinancialEvent; reused: boolean }>>;
  /* تصحيح قرض مستلم: التراجع والبديل والسجل المحدّث في معاملة واحدة. */
  commitReceivedLoanCorrection(
    record: ReceivedLoanRecord,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<
    StorageResult<{
      record: ReceivedLoanRecord;
      reversal: FinancialEvent;
      replacement: FinancialEvent;
      reused: boolean;
    }>
  >;
  /* المجموعة ٤ (عقد ٢٩ — العربون المحتفظ): تصنيف معنى العربون والحدث المالي
   * المرتبط في معاملة واحدة؛ التراجع عن تصنيف: تراجع + بديل + الطلب معًا. */
  commitDepositClassification(
    order: StoredCraftOrder,
    event: FinancialEvent,
  ): Promise<StorageResult<{ order: StoredCraftOrder; event: FinancialEvent; reused: boolean }>>;
  commitDepositClassificationCorrection(
    order: StoredCraftOrder,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<
    StorageResult<{
      order: StoredCraftOrder;
      reversal: FinancialEvent;
      replacement: FinancialEvent;
      reused: boolean;
    }>
  >;
  /* OPS-003 (عقد ٤١ — المصروف المتكرر): قراءة العائلات الثلاث. */
  listRecurringExpenseSeries(): Promise<StorageResult<readonly RecurringExpenseSeries[]>>;
  getRecurringExpenseSeries(id: string): Promise<StorageResult<RecurringExpenseSeries | null>>;
  listRecurringExpenseRevisions(): Promise<StorageResult<readonly RecurringExpenseRuleRevision[]>>;
  listRecurringExpenseOccurrences(): Promise<StorageResult<readonly RecurringExpenseOccurrence[]>>;
  getRecurringExpenseOccurrence(id: string): Promise<StorageResult<RecurringExpenseOccurrence | null>>;
  /* إنشاء المسودة: سلسلة + مراجعتها الأولى في معاملة واحدة (إنشاء فقط؛
   * الوجود = إعادة استخدام صادقة). */
  commitRecurringExpenseDraft(
    series: RecurringExpenseSeries,
    revision: RecurringExpenseRuleRevision,
  ): Promise<
    StorageResult<{ series: RecurringExpenseSeries; revision: RecurringExpenseRuleRevision; reused: boolean }>
  >;
  /* تغيير محروس على السلسلة (تفعيل/إيقاف/استئناف/أرشفة/استعادة/إلغاء/تعاقب):
   * الحالة الحية تُقارن بالأساس داخل حد الكتابة — انحراف = storage_stale بلا
   * كتابة؛ مع مراجعة خلف اختيارية وتحديثات فترات ذرّية في المعاملة نفسها. */
  commitRecurringExpenseSeriesChange(
    seriesBase: RecurringExpenseSeries,
    seriesNext: RecurringExpenseSeries,
    revision: RecurringExpenseRuleRevision | null,
    occurrenceUpdates: readonly RecurringExpenseOccurrenceChange[],
  ): Promise<
    StorageResult<{
      series: RecurringExpenseSeries;
      revision: RecurringExpenseRuleRevision | null;
      occurrences: readonly RecurringExpenseOccurrence[];
      reused: boolean;
    }>
  >;
  /* توليد الفترات أماميًا (إضافة فقط): الغائب يُنشأ، والمطابق يُتخطى بلا
   * كتابة، والمختلف رفض صادر — لا تُمس قرارات الفترات القائمة أبدًا. */
  commitRecurringExpenseOccurrences(
    occurrences: readonly RecurringExpenseOccurrence[],
  ): Promise<StorageResult<{ created: number; skipped: number }>>;
  /* قرار فترة واحد (تأجيل/تخطٍ/علامة محاولة/فشل معروف): محروس بنفس القاعدة. */
  /* S06 (UNIT-019 B4/D06 — R2-F01): قرار الربط بمصروف قائم — نفس عهدة قرار
   * الفترة المفرد زائد حصرية الحدث/الفترة داخل حد الكتابة نفسه. */
  commitRecurringExpenseOccurrenceLink(
    base: RecurringExpenseOccurrence,
    next: RecurringExpenseOccurrence,
  ): Promise<StorageResult<{ occurrence: RecurringExpenseOccurrence; reused: boolean }>>;
  commitRecurringExpenseOccurrenceDecision(
    base: RecurringExpenseOccurrence,
    next: RecurringExpenseOccurrence,
  ): Promise<StorageResult<{ occurrence: RecurringExpenseOccurrence; reused: boolean }>>;
  /* التسجيل الذرّي: تحديث الفترة (recording→recorded) وإنشاء الحدث المالي في
   * معاملة واحدة — كل شيء أو لا شيء؛ إعادة مفتاح الحتمية = إعادة استخدام،
   * واصطدام المفتاح بحدث مختلف النوع/المبلغ = رفض صادر بلا كتابة (عقد ٤١ §٨). */
  commitRecurringExpenseOccurrenceRecord(
    base: RecurringExpenseOccurrence,
    next: RecurringExpenseOccurrence,
    event: FinancialEvent,
  ): Promise<
    StorageResult<{
      occurrence: RecurringExpenseOccurrence;
      event: FinancialEvent;
      reused: boolean;
    }>
  >;
  /* FIN-002 (عقد ٤٢ — الميزانيات): قراءة سجلات الميزانية المخزنة كما كُتبت
   * (المخزن يحفظ سجلات الدومين حرفيًا — لا منطق دومين هنا أبدًا). */
  listExpenseBudgets(): Promise<StorageResult<readonly ExpenseBudgetRecord[]>>;
  /* حفظ محروس لسجل واحد: نفس المعرّف بنفس المضمون = إعادة استخدام صادقة بلا
   * كتابة ثانية؛ والمضمون المختلف على المعرّف نفسه = رفض صادر (storage_stale)
   * بلا كتابة — لا آخر-كاتب-يفوز على خطة مالية موثقة. */
  saveExpenseBudget(
    record: ExpenseBudgetRecord,
    /* الانتقالات الموثقة في المكان (إغلاق/إخفاء/استعادة) تمرر الحالة المقروءة
     * المتوقعة — CAS داخل حد الكتابة (قاعدة §10.7): لا كتابة عمياء. */
    expected?: ExpenseBudgetRecord,
  ): Promise<StorageResult<{ record: ExpenseBudgetRecord; reused: boolean }>>;
  /* زوج المراجعة الذرّي (عقد ٤٢ §٥): الخلف النافذ والسابقة المستبدلة في معاملة
   * تخزين واحدة — كلاهما أو لا شيء؛ إعادة تشغيل الزوج كاملًا = إعادة استخدام،
   * وأي انحراف = رفض صادر بلا كتابة. */
  saveExpenseBudgetRevisionPair(
    successor: ExpenseBudgetRecord,
    supersededPrevious: ExpenseBudgetRecord,
  ): Promise<
    StorageResult<{
      successor: ExpenseBudgetRecord;
      supersededPrevious: ExpenseBudgetRecord;
      reused: boolean;
    }>
  >;
}
