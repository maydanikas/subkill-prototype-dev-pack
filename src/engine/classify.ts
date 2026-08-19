import type { FetchedMail } from "../api/gmail";
import { parseFrom } from "../api/gmail";
import type { BillingCycle } from "../types";
import { matchBrand } from "./brands";
import { slugify } from "./dedupe";

const GENERIC_FROM =
  /^(no-?reply|mailer|notifications?|support|hello|hi|team|info|billing|payments?|receipts?|invoice|google payments|google play|google commerce limited|paypal|stripe|apple)$/i;

const ONE_TIME =
  /you(?:['’]ve| have) made a purchase|thanks for your (?:order|purchase)|your order (?:is|has|#)|order confirmed|order receipt|item(?:s)? (?:have )?shipped|out for delivery|package (?:is )?on the way|purchase on google play/i;

const WALLET_TOPUP =
  /google play credit|play credit|itunes credit|apple (?:gift|account) credit|gift card|top[\s-]?up|пополнен(?:ие|ия)|tegoed|saldo (?:opgewaardeerd|aangevuld|added)/i;

const PROMO_NOISE =
  /gemini voor home|gemini for home|google home <googlehome@|from google home\b|weekly energy saving report|free domain|domain for sale|buy this domain|parked domain|aftermarket|expired domain auction/i;

const REAL_CHARGE =
  /you(?:['’]ve| have) been charged|item price|платеж.{0,24}списан|подписка.{0,80}продлена|subscription (?:continues|renewed)|квитанция об оплате|order receipt|receipt from|factuur|invoice|payment to\b/i;

const SUB_SIGNAL =
  /subscription (?:continues|renewed|is now active|receipt|from|payment)|trial (?:ending|has started|ends)|membership (?:renewed|active)|recurring|(?:you(?:['’]ve| have) been charged)|billed (?:for|successfully)|auto-?renew|couldn['’]?t process payment|could not process payment|issue processing your subscription/i;

const PAID_CUE =
  /subscription|membership|trial|receipt|invoice|billed|renew|premium|(?:plus|pro) plan|your plan|you've been charged|you have been charged|couldn['’]?t process payment|billing & invoices|processing your subscription|abonnement|abonneer|zoekalert|huuralert|inschrijving|inschrijfgeld/i;

const ACCOUNT_NOISE =
  /meeting assets|thank you for registering|privacy policy|reset (?:your )?password|verify your (?:email|account)|toegang krijgen|we(?:['’]re) rolling out ads|zoom-vergadering|for this meeting|подтверждение|\bconfirmation\b|зарегистрировал/i;

/** Charge did not go through — never treat as last paid / amount paid. */
const FAILED_PAYMENT =
  /payment was unsuccessful|payment.{0,60}unsuccessful|couldn['’]?t process payment|could not process payment|failed (?:to process )?payment|payment (?:was )?(?:declined|rejected|failed)|card (?:was )?declined|issue processing your subscription|платеж.{0,48}отклон[её]н|оплата не прошла|не удалось (?:списать|обработать)|betaling (?:is )?mislukt|betaling geweigerd|update (?:your )?payment (?:method|details|info)|обновите платежные|требуется действие/i;

const YEARLY_CYCLE =
  /annual(?:ly)?|yearly|\/\s?year\b|per year|12[\s-]?months?|one year|1[\s-]?year|годов(?:ая|ой|ую)|на год\b|\/\s?год\b|1\s?год\b|12\s?месяц|ежегодн|jaarlijks|per jaar|1\s?jaar\b|12\s?maanden/i;

const WEEKLY_CYCLE =
  /billed weekly|weekly (?:plan|subscription|membership)|\/\s?week\b|per week|еженедельн(?:ая|ой|ую) подписк|раз в неделю/i;

const MONTHLY_CYCLE =
  /monthly|\/\s?mo(?:nth)?\b|per month|1[\s-]?month|ежемесяч|\/\s?мес\b|1\s?мес(?:яц)?\b|в месяц|maandelijks|per maand|1\s?maand\b/i;

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function brandFromDomain(domain: string): string {
  const host = domain.replace(/^mail\./, "").replace(/^email\./, "").replace(/^noreply\./, "");
  const parts = host.split(".").filter(Boolean);
  const brand = parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? host;
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function isOneTimePurchase(text: string): boolean {
  if (WALLET_TOPUP.test(text)) return true;
  if (isGenericAppleInvoice(text)) return true;
  if (isDomainCharge(text)) return false;
  if (SUB_SIGNAL.test(text) && /subscription/i.test(text) && !WALLET_TOPUP.test(text)) return false;
  return ONE_TIME.test(text);
}

/** Registrar-agnostic: domain bills auto-renew, they are not a one-off shop order. */
export function isDomainCharge(text: string): boolean {
  if (!/\bdomain\b|домен|\bdomein\b|vercel/i.test(text)) return false;
  return /invoice|receipt|renew|registration|charged|billed|factuur|verlenging|квитанция|продлен/i.test(text);
}

export function isPromoNoise(text: string): boolean {
  return PROMO_NOISE.test(text);
}

/** Apple Account invoice with no named recurring product — gift/balance, not a sub. */
export function isGenericAppleInvoice(text: string): boolean {
  if (!/apple/i.test(text)) return false;
  if (/icloud|apple\s?(?:one|music|tv\+?|arcade|fitness|news)|abonnement|auto-?renew|subscription (?:continues|renewed)/i.test(text)) {
    return false;
  }
  return /factuur van apple|apple account|invoice from apple/i.test(text);
}

export function isRealCharge(text: string): boolean {
  return REAL_CHARGE.test(text);
}

export function hasSubSignal(text: string): boolean {
  return SUB_SIGNAL.test(text);
}

export function hasPaidCue(text: string): boolean {
  return PAID_CUE.test(text);
}

export function isAccountNoise(text: string): boolean {
  return ACCOUNT_NOISE.test(text);
}

export function isEndedSubscription(text: string): boolean {
  return /abonnement is be[eë]indigd|subscription (?:has been )?(?:cancelled|canceled|ended)|je abonnement is (?:gestopt|opgezegd)|we(?:['’]ve| have) cancelled your/i.test(
    text,
  );
}

export function isFailedPayment(text: string): boolean {
  return FAILED_PAYMENT.test(text);
}

/** Period this charge covers. Failed mails are ignored by the caller. */
export function parseBillingCycle(text: string): BillingCycle | null {
  if (YEARLY_CYCLE.test(text)) return "yearly";
  if (isDomainCharge(text) && !MONTHLY_CYCLE.test(text)) return "yearly";
  if (WEEKLY_CYCLE.test(text) && !MONTHLY_CYCLE.test(text)) return "weekly";
  if (MONTHLY_CYCLE.test(text)) return "monthly";
  return null;
}

export function merchantName(mail: FetchedMail): string {
  const subject = decodeEntities(mail.subject);
  const snippet = decodeEntities(mail.snippet);
  const text = `${subject} ${snippet}`;
  const parsed = parseFrom(mail.from);

  const playSub = text.match(/subscription from\s+(.+?)\s+on google play/i);
  if (/google one|gemini advanced|google ai pro|ai premium/i.test(text)) return "Google One";
  if (/\bsmart\s?life\b|\btuya\b/i.test(text)) return "Smart Life";
  if (playSub) {
    const who = playSub[1].trim();
    if (/google commerce/i.test(who)) return "Google Play";
    return who;
  }
  if (/google play/i.test(text) && /subscription/i.test(text) && !/google one|smart\s?life|\btuya\b/i.test(text)) {
    return "Google Play";
  }

  const fromReceipt = text.match(/receipt from\s+([^.\n]+)/i);
  if (fromReceipt) {
    const who = fromReceipt[1].trim().slice(0, 48);
    if (/anysphere/i.test(who)) return "Cursor";
    return who;
  }

  const welcome = subject.match(/welcome to\s+([^!.,]+)/i);
  if (welcome) return welcome[1].trim().slice(0, 48);

  const fromName = parsed.name.trim();
  if (fromName && !GENERIC_FROM.test(fromName) && fromName.length <= 48) return fromName;

  return brandFromDomain(parsed.domain);
}

export function shouldKeepMail(mail: FetchedMail): boolean {
  const text = decodeEntities(`${mail.subject} ${mail.snippet}`);
  if (isPromoNoise(`${mail.from} ${text}`)) return false;
  if (isOneTimePurchase(text)) return false;
  if (isAccountNoise(text) && !hasSubSignal(text) && !hasPaidCue(text) && !isDomainCharge(text)) return false;

  const parsed = parseFrom(mail.from);
  const name = merchantName(mail);
  const brand = matchBrand(name, parsed.domain, text);
  if (brand) {
    if (mail.pass === 1) {
      return (
        isRealCharge(text) ||
        hasSubSignal(text) ||
        isFailedPayment(text) ||
        isDomainCharge(text)
      );
    }
    return hasSubSignal(text) || hasPaidCue(text);
  }

  if (mail.pass === 1 && isProcessorReceipt(parsed.domain, text)) return true;
  if (mail.pass === 1 && isDomainCharge(text)) return true;
  return false;
}

function isProcessorReceipt(domain: string, text: string): boolean {
  if (!/stripe\.com|paddle\.|recurly\.com|paypal\.com|google\.com|apple\.com|vercel\.com/.test(domain)) {
    return false;
  }
  return isRealCharge(text) || isFailedPayment(text) || isDomainCharge(text);
}

export function slugForMail(mail: FetchedMail, name: string): string {
  const parsed = parseFrom(mail.from);
  const text = decodeEntities(`${mail.subject} ${mail.snippet}`);
  return matchBrand(name, parsed.domain, text)?.slug || slugify(name) || "unknown";
}
