/**
 * S05 (DOC-014 / UNIT-037 B1/B3/B4): سياسات دورة حياة الطرف المحفوظ — إنشاء
 * وتعديل تسمية وأرشفة/إعادة إظهار. كلها نقية بلا تخزين: الحتمية والتعارض
 * يعيشان عند حد الكتابة المحروس في طبقة التخزين (نمط commitProfileRename/
 * commitCounterpartyWrite)، وهنا شكل السجل الصادق فقط.
 */
import { isValidTimestamp } from "../shared/index.js";
import type {
  CreateSavedPartyInput,
  RenameSavedPartyInput,
  SavedParty,
  SetSavedPartyArchiveInput,
} from "./types.js";

const assertNonBlank = (value: string, message: string) => {
  if (!value.trim()) throw new Error(message);
};

const assertIso = (value: string, message: string) => {
  if (!isValidTimestamp(value)) throw new Error(message);
};

/* UNIT-037 A1: الاسم قد يكون وصفًا يميز الشخص («محمد — محل الزهور») ولا
 * نقبل فراغًا أو نصًا صوريًا؛ لكن لا هاتف مفروض ولا نقرر صلاحية التعريف
 * بطوله. التشذيب يوحّد الفراغات فتسميتان تختلفان بالفراغ فقط تظلان طرفين
 * مستقلين (لا دمج بالاسم أصلًا — الهوية بالمعرف لا بالنص). */
export const normalizePartyLabel = (label: string): string => label.trim().replace(/\s+/g, " ");

export function createSavedParty(input: CreateSavedPartyInput): SavedParty {
  assertNonBlank(input.id, "معرّف الطرف مطلوب عند الحفظ.");
  assertNonBlank(input.operationKey, "مفتاح عملية حفظ الطرف مطلوب.");
  assertIso(input.recordedAt, "أدخل وقت تسجيل الطرف وقتًا صحيحًا.");
  const label = normalizePartyLabel(input.label);
  if (!label) throw new Error("اكتب اسمًا أو وصفًا يعرّف الطرف قبل حفظه.");
  return Object.freeze({
    id: input.id.trim(),
    label,
    phone: input.phone?.trim() || null,
    note: input.note?.trim() || null,
    archivedAt: null,
    operationKey: input.operationKey.trim(),
    createdAt: input.recordedAt,
    updatedAt: input.recordedAt,
  });
}

/* UNIT-037 A6/B1 (U037-F05): إعادة التسمية تغيّر التسمية الحالية وحدها —
 * المعرف ووقت الإنشاء ولقطات المصادر التاريخية كما هي؛ لا حركة مالية ولا
 * إعادة كتابة تاريخ. */
export function renameSavedParty(party: SavedParty, input: RenameSavedPartyInput): SavedParty {
  assertNonBlank(input.operationKey, "مفتاح عملية تعديل الطرف مطلوب.");
  assertIso(input.recordedAt, "أدخل وقت تعديل الطرف وقتًا صحيحًا.");
  const label = normalizePartyLabel(input.label);
  if (!label) throw new Error("اكتب اسمًا أو وصفًا يعرّف الطرف قبل الحفظ.");
  return Object.freeze({
    ...party,
    label,
    operationKey: input.operationKey.trim(),
    updatedAt: input.recordedAt,
  });
}

/* UNIT-037 A6/B1 (U037-F12): الأرشفة فعل صريح في القائمة — تخفي اقتراح
 * الاستعمال الجديد ولا تحجب قراءة المصدر القديم ولا تحذف شيئًا؛ وإعادة
 * الإظهار فعل صريح معاكس. لا تتغير الهوية ولا التسمية ولا أي علاقة. */
export function setSavedPartyArchive(party: SavedParty, input: SetSavedPartyArchiveInput): SavedParty {
  assertNonBlank(input.operationKey, "مفتاح عملية أرشفة الطرف مطلوب.");
  assertIso(input.recordedAt, "أدخل وقت أرشفة الطرف وقتًا صحيحًا.");
  return Object.freeze({
    ...party,
    archivedAt: input.archived ? input.recordedAt : null,
    operationKey: input.operationKey.trim(),
    updatedAt: input.recordedAt,
  });
}
