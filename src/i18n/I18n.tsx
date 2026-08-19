import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { bcp47, detectLocale, isRtl, type Locale } from "./detect";
import { categoryLabel, cyclePeriodLabel, silenceLabel, translate } from "./format";
import type { BillingCycle } from "../types";

type Vars = Record<string, string | number>;

type I18nValue = {
  locale: Locale;
  t: (key: string, vars?: Vars) => string;
  category: (key: string) => string;
  cycle: (cycle: BillingCycle) => string;
  silence: (days: number, cycle?: BillingCycle, hasPaid?: boolean) => string;
  date: (d: Date) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    const apply = () => setLocale(detectLocale());
    window.addEventListener("languagechange", apply);
    return () => window.removeEventListener("languagechange", apply);
  }, []);

  useEffect(() => {
    document.documentElement.lang = bcp47(locale);
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
    document.title = translate(locale, "title");
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
      category: (key) => categoryLabel(locale, key),
      cycle: (cycle) => cyclePeriodLabel(locale, cycle),
      silence: (days, cycle, hasPaid) => silenceLabel(locale, days, cycle, hasPaid),
      date: (d) => d.toLocaleDateString(bcp47(locale)),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
