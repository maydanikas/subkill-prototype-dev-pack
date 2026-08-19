/**
 * Discovery is processor-first, not a world catalog of brands.
 * Stripe / PayPal / Apple / Google Play / Paddle catch Cursor in the US
 * and a random Dutch SaaS the same way. Brand lists are for naming + cancel
 * URLs after a charge is found — do not add countries here to "find more subs".
 */
import { pass3Domains } from "./brands";

export const GMAIL_BATCH_SIZE = 100;

const PROCESSORS = [
  "stripe.com",
  "paypal.com",
  "apple.com",
  "google.com",
  "paddle.net",
  "paddle.com",
  "recurly.com",
  "vercel.com",
];

export function receiptQuery(after: string): string {
  const from = PROCESSORS.join(" OR ");
  return [
    `(from:(${from}))`,
    "(",
    'receipt OR invoice OR квитанция OR подписка OR abonnement OR "subscription renewed" OR "subscription continues" OR продлена OR "trial ending" OR "payment received" OR "you have been charged" OR "you\'ve been charged" OR "payment was unsuccessful" OR "couldn\'t process"',
    ")",
    `after:${after}`,
    "in:anywhere",
  ].join(" ");
}

export function welcomeQuery(after: string): string {
  return [
    "(",
    '"your subscription is now active" OR "trial has started" OR "trial ending" OR "subscription confirmed"',
    ")",
    `after:${after}`,
  ].join(" ");
}

/** Dunning / failed charges — still processors, not a brand encyclopedia. */
export function knownPaidQuery(after: string): string {
  return [
    "(from:(stripe.com OR paddle.com OR cursor.com))",
    '("payment was unsuccessful" OR "couldn\'t process payment" OR "could not process payment" OR "failed payment" OR "issue processing your subscription")',
    `after:${after}`,
    "in:anywhere",
  ].join(" ");
}

export function cardChargeQuery(after: string): string {
  return [
    "(from:(stripe.com OR paypal.com OR paddle.com OR bunq.com OR revolut.com OR wise.com))",
    '(receipt OR invoice OR subscription OR "payment to" OR "payment was unsuccessful")',
    `after:${after}`,
    "in:anywhere",
  ].join(" ");
}

/**
 * Yearly domain auto-renew — any registrar. Not a brand list:
 * GoDaddy, Namecheap, Vercel, Cloudflare, a Dutch host, same query.
 */
export function domainQuery(after: string): string {
  return [
    "(",
    "subject:domain OR \"domain renewal\" OR \"domain registration\" OR \"domain invoice\" OR \"domain name\" OR \"your domain\" OR домен OR domein",
    ")",
    "(",
    "invoice OR receipt OR renew OR renewal OR charged OR payment OR registration OR квитанция OR продлен OR factuur OR verlenging",
    ")",
    `after:${after}`,
    "in:anywhere",
  ].join(" ");
}

export function behaviorQuery(after: string): string {
  const from = pass3Domains().join(" OR ");
  if (!from) return `after:${after} in:anywhere`;
  return `from:(${from}) after:${after}`;
}

const AMOUNT_PATTERNS: Array<{ currency: "EUR" | "USD"; re: RegExp }> = [
  { currency: "EUR", re: /€\s?(\d{1,4}(?:[.,]\d{2})?)/g },
  { currency: "EUR", re: /(\d{1,4}(?:[.,]\d{2})?)\s?€/g },
  { currency: "EUR", re: /EUR\s?(\d{1,4}(?:[.,]\d{2})?)/gi },
  { currency: "EUR", re: /(\d{1,4}(?:[.,]\d{2})?)\s?EUR/gi },
  { currency: "USD", re: /\$\s?(\d{1,4}(?:[.,]\d{2})?)/g },
  { currency: "USD", re: /USD\s?(\d{1,4}(?:[.,]\d{2})?)/gi },
  { currency: "USD", re: /(\d{1,4}(?:[.,]\d{2})?)\s?USD/gi },
];

const AMOUNT_HINT = /item price|total|charged|списан|продлен|payment to|factuur|invoice/i;

export function parseAmount(text: string): { amount: number; currency: string } | null {
  const found: Array<{ amount: number; currency: "EUR" | "USD"; hint: boolean }> = [];
  for (const { currency, re } of AMOUNT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const amount = Number(m[1].replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const ctx = text.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 80);
      found.push({ amount, currency, hint: AMOUNT_HINT.test(ctx) });
    }
  }
  if (!found.length) return null;
  const hinted = found.filter((f) => f.hint);
  const pool = hinted.length ? hinted : found;
  const preferEur = /€|EUR|iDEAL/i.test(text) && pool.some((f) => f.currency === "EUR");
  const ranked = preferEur ? pool.filter((f) => f.currency === "EUR") : pool;
  const pick = ranked[0] ?? pool[0];
  return { amount: pick.amount, currency: pick.currency };
}

export const BEHAVIOR_MIN_MESSAGES = 8;
export const BEHAVIOR_LOOKBACK_DAYS = 90;
