import listPrices from "../../data/list_prices.json";
import type { FetchedMail } from "../api/gmail";
import { parseFrom } from "../api/gmail";
import type { MailboxHit } from "../fixtures/mailbox";
import type { BillingCycle, BillingSource, RawScanHit } from "../types";
import { BRANDS, matchBrand } from "./brands";
import { detectBillingSource } from "./cancelLink";
import { merchantName, shouldKeepMail, slugForMail, isEndedSubscription, isFailedPayment, parseBillingCycle, decodeEntities } from "./classify";
import { dedupeHits } from "./dedupe";
import { parseAmount } from "./scannerQueries";

const CATEGORY: Record<string, { key: string; label: string }> = {
  netflix: { key: "entertainment", label: "Развлечения" },
  spotify: { key: "music", label: "Музыка" },
  "youtube-premium": { key: "entertainment", label: "Развлечения" },
  "disney-plus": { key: "entertainment", label: "Развлечения" },
  "prime-video": { key: "entertainment", label: "Развлечения" },
  "hbo-max": { key: "entertainment", label: "Развлечения" },
  "apple-tv": { key: "entertainment", label: "Развлечения" },
  "apple-arcade": { key: "entertainment", label: "Развлечения" },
  icloud: { key: "storage", label: "Хранилище" },
  "apple-music": { key: "music", label: "Музыка" },
  "google-one": { key: "storage", label: "Хранилище" },
  "google-play": { key: "entertainment", label: "Развлечения" },
  adobe: { key: "work", label: "Работа" },
  figma: { key: "work", label: "Работа" },
  canva: { key: "work", label: "Работа" },
  notion: { key: "productivity", label: "Продуктивность" },
  chatgpt: { key: "work", label: "Работа" },
  claude: { key: "work", label: "Работа" },
  "github-copilot": { key: "work", label: "Работа" },
  cursor: { key: "work", label: "Работа" },
  vercel: { key: "work", label: "Работа" },
  medium: { key: "productivity", label: "Продуктивность" },
  dropbox: { key: "storage", label: "Хранилище" },
  strava: { key: "fitness", label: "Фитнес" },
  calm: { key: "health", label: "Здоровье" },
  tinder: { key: "dating", label: "Дейтинг" },
  artlist: { key: "work", label: "Работа" },
  "wispr-flow": { key: "work", label: "Работа" },
  "tuya-smart-life": { key: "home", label: "Дом" },
  funda: { key: "other", label: "Жильё" },
  pararius: { key: "other", label: "Жильё" },
  kamernet: { key: "other", label: "Жильё" },
  housinganywhere: { key: "other", label: "Жильё" },
  huurwoningen: { key: "other", label: "Жильё" },
  stekkies: { key: "other", label: "Жильё" },
  idealista: { key: "other", label: "Жильё" },
  immowelt: { key: "other", label: "Жильё" },
  immoscout24: { key: "other", label: "Жильё" },
  rightmove: { key: "other", label: "Жильё" },
  zoopla: { key: "other", label: "Жильё" },
  spotahome: { key: "other", label: "Жильё" },
  "dim-ria": { key: "other", label: "Жильё" },
  vesteda: { key: "other", label: "Жильё" },
  holland2stay: { key: "other", label: "Жильё" },
  heimstaden: { key: "other", label: "Жильё" },
  amvest: { key: "other", label: "Жильё" },
  greystar: { key: "other", label: "Жильё" },
  ourdomain: { key: "other", label: "Жильё" },
  "change-equals": { key: "other", label: "Жильё" },
  duwo: { key: "other", label: "Жильё" },
  ssh: { key: "other", label: "Жильё" },
  camelot: { key: "other", label: "Жильё" },
  thesocialhub: { key: "other", label: "Жильё" },
  interhouse: { key: "other", label: "Жильё" },
  rotsvast: { key: "other", label: "Жильё" },
  directwonen: { key: "other", label: "Жильё" },
  woningnet: { key: "other", label: "Жильё" },
  househunting: { key: "other", label: "Жильё" },
};

const LIST_PRICES = listPrices as Record<string, number>;
const NOISE_SLUGS = new Set(["google-play", "google-home", "google", "apple"]);
const PALETTE = ["#E50914", "#1DB954", "#0A84FF", "#FF9F0A", "#BF5AF2", "#FF375F", "#64D2FF", "#30D158"];

function colorFor(slug: string): string {
  let n = 0;
  for (const ch of slug) n = (n + ch.charCodeAt(0) * 17) % PALETTE.length;
  return PALETTE[n];
}

function addBillingCycle(from: Date, cycle: BillingCycle): Date {
  const next = new Date(from);
  if (cycle === "yearly") next.setFullYear(next.getFullYear() + 1);
  else if (cycle === "weekly") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function daysUntilNext(lastPaid: Date, cycle: BillingCycle, now: Date): number {
  let next = addBillingCycle(lastPaid, cycle);
  let hops = 0;
  while (next.getTime() <= now.getTime() && hops < 6) {
    next = addBillingCycle(next, cycle);
    hops += 1;
  }
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));
}

function billingFromHay(hay: string, kbSource?: BillingSource): BillingSource {
  return detectBillingSource(hay) ?? (kbSource && kbSource !== "unknown" ? kbSource : "unknown");
}

export function mailsToMailbox(mails: FetchedMail[]): MailboxHit[] {
  return classifyMailbox(mails).hits;
}

export function classifyMailbox(mails: FetchedMail[]): { hits: MailboxHit[]; dropped: number } {
  const keptMails = mails.filter(shouldKeepMail);
  const raw: RawScanHit[] = keptMails.map((mail) => {
    const parsed = parseFrom(mail.from);
    const name = merchantName(mail);
    const text = decodeEntities(`${mail.subject} ${mail.snippet}`);
    const money = parseAmount(text);
    const failed = isFailedPayment(text);
    return {
      name,
      slug: slugForMail(mail, name),
      senderEmail: parsed.email,
      senderDomain: parsed.domain,
      amount: money?.amount ?? null,
      currency: money?.currency === "EUR" ? "€" : "$",
      date: mail.date,
      billingCycle: failed ? null : parseBillingCycle(text),
      failed,
      sourceEmailId: mail.id,
      pass: mail.pass,
      snippet: mail.snippet,
      links: mail.links ?? [],
    };
  });

  const trapSlugs = new Set(
    raw
      .filter((h) => !h.failed && (/trial/i.test(h.snippet) || /trial/i.test(h.name)))
      .map((h) => h.slug),
  );

  const endedSlugs = new Set(
    keptMails
      .filter((mail) => isEndedSubscription(decodeEntities(`${mail.subject} ${mail.snippet}`)))
      .map((mail) => slugForMail(mail, merchantName(mail))),
  );

  const hits = dedupeHits(raw, (slug) => BRANDS.find((k) => k.slug === slug)?.billing_cycle ?? null)
    .filter((row) => !endedSlugs.has(row.slug))
    .filter((row) => !NOISE_SLUGS.has(row.slug))
    .map((row, i) => {
    const kb = BRANDS.find((k) => k.slug === row.slug) ?? matchBrand(row.name, row.senderDomain);
    const slug = kb?.slug ?? row.slug;
    const cat = CATEGORY[slug] ?? { key: "other", label: "Другое" };
    const cycle = row.billingCycle;
    const paidAt = row.lastPaidAt ? new Date(row.lastPaidAt) : null;
    const last = paidAt ?? new Date(row.lastSeen);
    const now = new Date();
    const daysInactive = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 86400000));
    return {
      id: `${slug}-${i}`,
      name: kb?.display_name ?? row.name,
      slug,
      price: row.price ?? LIST_PRICES[slug] ?? 0,
      currency: row.currency || "$",
      billingCycle: cycle,
      nextBillingDays: paidAt ? daysUntilNext(paidAt, cycle, now) : 0,
      category: cat.label,
      categoryKey: cat.key,
      daysInactive,
      lastPaidAt: row.lastPaidAt,
      color: colorFor(slug),
      letter: (kb?.display_name ?? row.name).charAt(0).toUpperCase(),
      supportEmail: row.senderDomain ? `support@${row.senderDomain}` : "support@unknown",
      isTrialTrap: trapSlugs.has(slug) && (row.price ?? 0) > 0,
      billingSource: billingFromHay(`${row.senderDomain} ${row.name} ${row.snippet}`, kb?.billing_source),
      senderDomain: row.senderDomain,
      links: row.links,
    };
  })
    .filter((hit) => hit.price > 0 || hit.slug === "vercel");

  return { hits, dropped: mails.length - keptMails.length };
}
