import type { WasteReason } from "../types";
import { bcp47, type Locale } from "../i18n/detect";
import { translate } from "../i18n/format";

export type CancelEmailInput = {
  serviceName: string;
  accountEmail: string;
  price: number;
  currency: string;
  period: string;
  daysInactive: number;
  reason: WasteReason;
  locale: Locale;
};

/**
 * Letter language follows the system locale. gmail.send only on explicit send.
 */
export function draftCancelEmail(input: CancelEmailInput): { subject: string; body: string } {
  const t = (key: string, vars?: Record<string, string | number>) => translate(input.locale, key, vars);
  const today = new Date().toLocaleDateString(bcp47(input.locale));
  const keepUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString(bcp47(input.locale));
  const vars = {
    name: input.serviceName,
    email: input.accountEmail,
    currency: input.currency,
    price: input.price.toFixed(2),
    period: input.period,
    date: today,
    keepUntil,
    days: input.daysInactive,
    reason: t(`letter.${input.reason}`),
  };
  const subject = t("letter.subject", vars);
  const body = [
    t("letter.hello", vars),
    ``,
    t("letter.ask", vars),
    ``,
    t("letter.email", vars),
    t("letter.plan", vars),
    t("letter.date", vars),
    t("letter.reason", vars),
    input.daysInactive > 0 ? t("letter.silence", vars) : null,
    ``,
    t("letter.please"),
    t("letter.step1"),
    t("letter.step2"),
    t("letter.step3", vars),
    ``,
    t("letter.thanks"),
    input.accountEmail,
    ``,
    `—`,
    t("letter.sentVia"),
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, body };
}
