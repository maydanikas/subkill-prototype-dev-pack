export const LOCALES = [
  "en",
  "ru",
  "uk",
  "nl",
  "de",
  "fr",
  "it",
  "es",
  "pt",
  "pl",
  "tr",
  "ja",
  "ko",
  "zh",
  "zh-TW",
  "ar",
] as const;
export type Locale = (typeof LOCALES)[number];

const BCP47: Record<Locale, string> = {
  en: "en-US",
  ru: "ru-RU",
  uk: "uk-UA",
  nl: "nl-NL",
  de: "de-DE",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
  pt: "pt-BR",
  pl: "pl-PL",
  tr: "tr-TR",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  "zh-TW": "zh-TW",
  ar: "ar-SA",
};

export function bcp47(locale: Locale): string {
  return BCP47[locale];
}

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

export function detectLocale(langs: readonly string[] = []): Locale {
  const list = langs.length
    ? langs
    : typeof navigator === "undefined"
      ? ["en"]
      : [...(navigator.languages ?? []), navigator.language];

  for (const raw of list) {
    const tag = (raw || "").toLowerCase().replace(/_/g, "-");
    if (tag.startsWith("zh-tw") || tag.startsWith("zh-hk") || tag.startsWith("zh-hant") || tag.includes("hant")) {
      return "zh-TW";
    }
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("uk")) return "uk";
    if (tag.startsWith("ru")) return "ru";
    if (tag.startsWith("nl")) return "nl";
    if (tag.startsWith("de")) return "de";
    if (tag.startsWith("fr")) return "fr";
    if (tag.startsWith("it")) return "it";
    if (tag.startsWith("es")) return "es";
    if (tag.startsWith("pt")) return "pt";
    if (tag.startsWith("pl")) return "pl";
    if (tag.startsWith("tr")) return "tr";
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("ko")) return "ko";
    if (tag.startsWith("ar")) return "ar";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}
