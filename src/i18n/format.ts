import type { BillingCycle } from "../types";
import { ar } from "./ar";
import { de } from "./de";
import { en, type Messages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { nl } from "./nl";
import { pl } from "./pl";
import { pt } from "./pt";
import { ru } from "./ru";
import { tr } from "./tr";
import { uk } from "./uk";
import { zh } from "./zh";
import { zhTW } from "./zh-TW";
import type { Locale } from "./detect";

export const DICTS: Record<Locale, Messages> = {
  en,
  ru,
  uk,
  nl,
  de,
  fr,
  it,
  es,
  pt,
  pl,
  tr,
  ja,
  ko,
  zh,
  "zh-TW": zhTW,
  ar,
};

type Vars = Record<string, string | number>;

function lookup(obj: unknown, path: string): string | undefined {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function interpolate(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function translate(locale: Locale, key: string, vars: Vars = {}): string {
  const raw = lookup(DICTS[locale], key) ?? lookup(DICTS.en, key) ?? key;
  return interpolate(raw, vars);
}

function slavicDayWord(locale: "ru" | "uk", days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (locale === "ru") {
    if (mod10 === 1 && mod100 !== 11) return "день";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
    return "дней";
  }
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дні";
  return "днів";
}

export function silenceLabel(
  locale: Locale,
  days: number,
  billingCycle: BillingCycle = "monthly",
  hasPaid = true,
): string {
  const t = (key: string, vars?: Vars) => translate(locale, key, vars);
  if (!hasPaid) return t("silence.unpaid");
  if (billingCycle === "yearly" && days < 335) return t("silence.yearly", { days });
  if (days <= 0) return t("silence.today");
  if (days === 1) return t("silence.one");
  if (locale === "ru") return `Тишина в почте ${days} ${slavicDayWord("ru", days)}`;
  if (locale === "uk") return `Тиша в пошті ${days} ${slavicDayWord("uk", days)}`;
  return t("silence.many", { days });
}

export function cyclePeriodLabel(locale: Locale, cycle: BillingCycle): string {
  return translate(locale, `cycle.${cycle}`);
}

export function categoryLabel(locale: Locale, key: string): string {
  return translate(locale, `category.${key}`) || key;
}
