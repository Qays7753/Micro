/**
 * S05 (DOC-014 / UNIT-037 P3.2 + العقد المشترك §5.1 — PartyRef): هوية طرف
 * محفوظ اختيارية — طرف واحد بمعرّف ثابت وتسمية حالية وهاتف/ملاحظة اختيارية
 * وحالة أرشفة صريحة. لا رصيد مخزن ولا دور مقفول ولا قائمة هوية لكل مجهول:
 * «لك عنده»/«عليك له» مشتقان من المصادر المرتبطة بمعرفه المؤكد، والدور
 * (عميل/مورد) يُفهم من سياق العملية لا من ملف الطرف.
 *
 * حدود الكتابة (UNIT-037 B1/B-DUP): حفظ الطرف صريح باختيار المستخدم — لا
 * حفظ آلي من مجرد كتابة اسم في عملية، ولا دمج بالاسم/الهاتف أبدًا (طرفان
 * بالتسمية نفسها هويتان مستقلتان)، وتغيير التسمية يغيّر العرض الحالي فقط
 * ولا يعيد كتابة لقطة اسم في أي مصدر سابق (المصادر تحفظ نسختها وقت
 * التسجيل)، والأرشفة تخفي الاقتراح للاستعمال الجديد ولا تحجب قراءة المصدر
 * القديم ولا تحذف حقًا ولا دفعة ولا مرجعًا.
 */
export type SavedParty = {
  /** معرّف ثابت يولد مرة عند الحفظ — لا يتغير بالتعديل ولا بالأرشفة. */
  id: string;
  /** التسمية الحالية للعرض والاقتراح — لقطة المصدر تبقى كما سُجلت وقتها. */
  label: string;
  /** هاتف اختياري للعرض فقط — لا يُطلب للحفظ ولا يُستخدم مطابقةً أو دمجًا أبدًا. */
  phone?: string | null;
  /** ملاحظة حرة اختيارية للعرض فقط. */
  note?: string | null;
  /** null = طرف نشط يُقترح للاستعمال؛ طابع ISO = لحظة الأرشفة الصريحة. */
  archivedAt?: string | null;
  /** مفتاح حتمية آخر كتابة — إعادة الأمر نفسه إعادة استخدام داخل حد الكتابة. */
  operationKey: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSavedPartyInput = {
  id: string;
  label: string;
  phone?: string | null;
  note?: string | null;
  operationKey: string;
  recordedAt: string;
};

export type RenameSavedPartyInput = {
  label: string;
  operationKey: string;
  recordedAt: string;
};

export type SetSavedPartyArchiveInput = {
  /** true = أرشفة صريحة (إخفاء الاقتراح)؛ false = إعادة إظهار صريحة. */
  archived: boolean;
  operationKey: string;
  recordedAt: string;
};

/** قراءة جاهزة للعرض: الطرف نشط إذا لم تُسجَّل أرشفته. */
export const isPartyActive = (party: SavedParty): boolean => party.archivedAt == null;
