import { formatArabicPlural } from "./formatters";

/*
 * المجموعة ٥ (تسديد دَين المجموعة ٤ + عقد ٣٠): جمع عربي صحيح بعدّادات السطوح
 * المعنية — ١ و٢ لا يُجمعان جمع الكثرة. وحدة مستقلة عن plurals.ts القائم حتى
 * لا تتضخم أسطح تستورد مساعدات أخرى.
 */
export function loanCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا قروض",
    one: "قرض واحد",
    two: "قرضان",
    few: "قروض",
    many: "قرضًا",
    other: "قرض",
  });
}
export function loanOutstandingCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا قروض قائمة",
    one: "قرض قائم واحد",
    two: "قرضان قائمان",
    few: "قروض قائمة",
    many: "قرضًا قائمًا",
    other: "قرضًا قائمًا",
  });
}
export function loanInstallmentCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "بلا دفعات",
    one: "في دفعة واحدة",
    two: "في دفعتين",
    few: "دفعات",
    many: "دفعة",
    other: "دفعة",
  });
}
export function assetCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا أصول",
    one: "أصل واحد",
    two: "أصلان",
    few: "أصول",
    many: "أصلًا",
    other: "أصل",
  });
}
export function assetUnknownLifeCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا أصول مجهولة العمر",
    one: "أصل واحد بعمر أو بداية مجهولة",
    two: "أصلان بعمر أو بداية مجهولة",
    few: "أصول بعمر أو بداية مجهولة",
    many: "أصلًا بعمر أو بداية مجهولة",
    other: "أصلًا بعمر أو بداية مجهولة",
  });
}
export function pendingDepositCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا عربونات بانتظار قرار",
    one: "عربون واحد بانتظار قرارك",
    two: "عربونان بانتظار قرارك",
    few: "عربونات بانتظار قرارك",
    many: "عربونًا بانتظار قرارك",
    other: "عربونًا بانتظار قرارك",
  });
}
export function eventCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا أحداث",
    one: "حدث واحد",
    two: "حدثان",
    few: "أحداث",
    many: "حدثًا",
    other: "حدث",
  });
}
export function categoryCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا تصنيفات",
    one: "تصنيف واحد في هذه الفترة",
    two: "تصنيفان في هذه الفترة",
    few: "تصنيفات في هذه الفترة",
    many: "تصنيفًا في هذه الفترة",
    other: "تصنيفًا في هذه الفترة",
  });
}
