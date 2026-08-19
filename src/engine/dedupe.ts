import type { BillingCycle, RawScanHit } from "../types";

export type DedupedSubscription = {
  name: string;
  slug: string;
  price: number | null;
  currency: string;
  senderDomain: string;
  sourceEmailIds: string[];
  lastSeen: string;
  lastPaidAt: string | null;
  billingCycle: BillingCycle;
  hitCount: number;
  links: string[];
};

type Acc = DedupedSubscription & {
  paidDates: string[];
  latestPaidCycle: BillingCycle | null;
};

function cycleFromGaps(dates: string[]): BillingCycle | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = (sorted[i] - sorted[i - 1]) / 86400000;
    if (days < 14) continue;
    gaps.push(days);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median >= 250) return "yearly";
  if (median >= 20 && median <= 50) return "monthly";
  return null;
}

function pickCycle(row: Acc, fallback: BillingCycle | null): BillingCycle {
  return row.latestPaidCycle ?? cycleFromGaps(row.paidDates) ?? fallback ?? "monthly";
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(premium|plus|pro|subscription|membership|plan)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(name: string): string {
  return normalizeName(name).replace(/\s+/g, "-");
}

/** One row per slug. Last paid / price come only from successful charges. */
export function dedupeHits(hits: RawScanHit[], cycleFallback?: (slug: string) => BillingCycle | null): DedupedSubscription[] {
  const map = new Map<string, Acc>();

  for (const hit of hits) {
    const slug = hit.slug || slugify(hit.name);
    const existing = map.get(slug);
    if (!existing) {
      map.set(slug, {
        name: hit.name,
        slug,
        price: hit.amount,
        currency: hit.currency,
        senderDomain: hit.senderDomain,
        sourceEmailIds: [hit.sourceEmailId],
        lastSeen: hit.date,
        lastPaidAt: hit.failed ? null : hit.date,
        billingCycle: "monthly",
        hitCount: 1,
        links: [...hit.links],
        paidDates: hit.failed ? [] : [hit.date],
        latestPaidCycle: hit.failed ? null : hit.billingCycle,
      });
      continue;
    }
    existing.sourceEmailIds.push(hit.sourceEmailId);
    existing.hitCount += 1;
    existing.links = uniqueKeepOrder([...hit.links, ...existing.links]);

    if (hit.failed) {
      if (existing.lastPaidAt == null && hit.date > existing.lastSeen) {
        existing.lastSeen = hit.date;
        existing.name = hit.name;
        existing.senderDomain = hit.senderDomain;
      }
      if (existing.lastPaidAt == null && existing.price == null && hit.amount != null) {
        existing.price = hit.amount;
        existing.currency = hit.currency;
      }
      continue;
    }

    existing.paidDates.push(hit.date);
    if (existing.lastPaidAt == null || hit.date >= existing.lastPaidAt) {
      existing.lastPaidAt = hit.date;
      existing.lastSeen = hit.date;
      existing.name = hit.name;
      existing.senderDomain = hit.senderDomain;
      existing.latestPaidCycle = hit.billingCycle;
      if (hit.amount != null) {
        existing.price = hit.amount;
        existing.currency = hit.currency;
      }
    }
  }

  return [...map.values()].map((row) => ({
    name: row.name,
    slug: row.slug,
    price: row.price,
    currency: row.currency,
    senderDomain: row.senderDomain,
    sourceEmailIds: row.sourceEmailIds,
    lastSeen: row.lastPaidAt ?? row.lastSeen,
    lastPaidAt: row.lastPaidAt,
    billingCycle: pickCycle(row, cycleFallback?.(row.slug) ?? null),
    hitCount: row.hitCount,
    links: row.links,
  }));
}

function uniqueKeepOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
