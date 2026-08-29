import { formatArabicPlural } from "./formatters";

/*
 * مبدأ Micro: عدّ الصفحات يجمع وفق القواعد (واحد/اثنان/قلة/كثرة) — لا «1 محافظ» ولا «2 آثار».
 * كل دالة تخص مفهومًا واحدًا يظهر بعدّاد في صفحة واحدة على الأقل؛ الصيغ هنا هي النص المعروض نفسه.
 */
export function cashWalletCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا محافظ كاش",
    one: "محفظة كاش واحدة",
    two: "محفظتا كاش",
    few: "محافظ كاش",
    many: "محفظة كاش",
    other: "محفظة كاش",
  });
}

export function savedImpactCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا آثار محفوظة",
    one: "أثر محفوظ واحد",
    two: "أثران محفوظان",
    few: "آثار محفوظة",
    many: "أثرًا محفوظًا",
    other: "أثرًا محفوظًا",
  });
}

export function savedMovementCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا حركات محفوظة",
    one: "حركة محفوظة واحدة",
    two: "حركتان محفوظتان",
    few: "حركات محفوظة",
    many: "حركة محفوظة",
    other: "حركة محفوظة",
  });
}

export function templateComponentCountLabel(count: number): string {
  return formatArabicPlural(count, {
    zero: "لا مكوّنات",
    one: "مكوّن واحد",
    two: "مكوّنان",
    few: "مكونات",
    many: "مكوّنًا",
    other: "مكوّنًا",
  });
}
