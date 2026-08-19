import type { BillingSource } from "../types";

export type CancelPlace = "google_play" | "apple" | "paypal" | "web";

export const PLAY_SUBS_URL = "https://play.google.com/store/account/subscriptions";
export const APPLE_SUBS_URL = "https://apps.apple.com/account/subscriptions";
export const PAYPAL_AUTOPAY_URL = "https://www.paypal.com/myaccount/autopay";

const PROCESSOR_APEX = new Set([
  "stripe.com",
  "paypal.com",
  "paddle.com",
  "paddle.net",
  "recurly.com",
  "chargebee.com",
  "apple.com",
  "google.com",
  "googleapis.com",
]);

const JUNK =
  /unsubscribe|privacy|terms|facebook|twitter|instagram|linkedin|schemas\.google|doubleclick|mandrillapp|sendgrid\.net|list-manage|mailchimp|pixel|tracking|cdn\.|fonts\.|img\.|static\./i;

const NOT_CANCEL =
  /\/recovery\/|failed_payment|invoice\.stripe\.com/i;

export function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = unwrapRedirect(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function extractHrefs(html: string): string[] {
  const found: string[] = [];
  const attr = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attr.exec(html))) {
    found.push(decodeEntities(match[1]));
  }
  const bare = html.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  found.push(...bare.map((u) => u.replace(/[),.;]+$/, "")));
  return uniqueUrls(found.filter((u) => /^https?:\/\//i.test(u)));
}

export function detectBillingSource(hay: string): BillingSource | null {
  const t = hay.toLowerCase();
  if (/google play|play\.google/.test(t)) return "google_play";
  if (/itunes|apple\.com\/bill|apps\.apple|reportaproblem\.apple/.test(t)) return "apple";
  if (/paypal\.com/.test(t)) return "paypal";
  if (/stripe\.com/.test(t)) return "stripe";
  if (/paddle\./.test(t)) return "paddle";
  if (/recurly\.com/.test(t)) return "recurly";
  return null;
}

export function pickCancelUrl(input: {
  billingSource: BillingSource;
  links: string[];
  kbUrl: string | null;
  senderDomain: string;
}): { url: string | null; place: CancelPlace } {
  if (input.billingSource === "google_play") {
    return { url: PLAY_SUBS_URL, place: "google_play" };
  }
  if (input.billingSource === "apple") {
    return { url: APPLE_SUBS_URL, place: "apple" };
  }
  if (input.billingSource === "paypal") {
    return { url: bestPaypalLink(input.links) ?? PAYPAL_AUTOPAY_URL, place: "paypal" };
  }

  const fromMail = bestManageLink(input.links);
  if (fromMail && !isProcessorUrl(fromMail)) return { url: fromMail, place: "web" };
  if (input.kbUrl) return { url: input.kbUrl, place: "web" };
  if (fromMail) return { url: fromMail, place: "web" };

  const site = websiteFromDomain(input.senderDomain);
  return { url: site, place: "web" };
}

function bestPaypalLink(links: string[]): string | null {
  return (
    links.find((u) => /paypal\.com\/.*(autopay|automatic|subscription|preapproved)/i.test(u)) ?? null
  );
}

function bestManageLink(links: string[]): string | null {
  const ranked = links
    .filter((u) => !JUNK.test(u) && !NOT_CANCEL.test(u))
    .map((url) => ({ url, score: scoreLink(url) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.url ?? null;
}

function isProcessorUrl(url: string): boolean {
  try {
    return PROCESSOR_APEX.has(apexDomain(new URL(url).hostname));
  } catch {
    return false;
  }
}

function scoreLink(url: string): number {
  const u = url.toLowerCase();
  if (NOT_CANCEL.test(u)) return 0;
  let n = 0;
  if (/billing\.stripe\.com/.test(u)) n += 90;
  if (/customer[-/]?portal|billing[-/]?portal/.test(u)) n += 80;
  if (/manage[-_/]?subscription|update[-_/]?payment/.test(u)) n += 75;
  if (/paddle\.(com|net).*\/(subscription|billing|manage|overlay)/.test(u)) n += 70;
  if (/invoice\.stripe\.com/.test(u)) n += 45;
  if (/\/(billing|subscriptions?|account|settings|plans?|cancel)\b/.test(u)) n += 30;
  if (/\bcancel\b/.test(u)) n += 20;
  if (/\bmanage\b/.test(u)) n += 15;
  return n;
}

export function websiteFromDomain(domain: string): string | null {
  const host = domain.toLowerCase().replace(/^www\./, "").trim();
  if (!host || !host.includes(".")) return null;
  const apex = apexDomain(host);
  if (!apex || PROCESSOR_APEX.has(apex)) return null;
  return `https://${apex}`;
}

function apexDomain(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const tail2 = parts.slice(-2).join(".");
  const compound = new Set(["co.uk", "com.au", "co.jp", "com.br", "co.nl"]);
  if (compound.has(tail2) && parts.length >= 3) return parts.slice(-3).join(".");
  return tail2;
}

function unwrapRedirect(raw: string): string {
  try {
    const url = new URL(raw.trim());
    const nested = url.searchParams.get("q") || url.searchParams.get("u") || url.searchParams.get("url");
    if (nested && /^https?:\/\//i.test(nested) && /google\.com|safelinks\.protection/i.test(url.hostname)) {
      return nested;
    }
    return url.toString();
  } catch {
    return raw.trim();
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
