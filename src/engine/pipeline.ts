import cancelUrls from "../../data/cancel_urls.json";
import medians from "../../data/category_medians.json";
import groups from "../../data/service_groups.json";
import type { MailboxHit } from "../fixtures/mailbox";
import type { BillingCycle, BillingSource, CancelMethod, WasteReason } from "../types";
import type { CancelPlace } from "./cancelLink";
import { routeCancel } from "./cancelRouter";
import { duplicateSlugs } from "./duplicates";
import { annualCost, computeWasteScore, cyclePeriodLabel, isRedPill, unexpectedSilenceDays } from "./wasteScore";

export type ScoredSub = MailboxHit & {
  wasteScore: number;
  wasteReason: WasteReason;
  yearly: number;
  isDuplicate: boolean;
  isRed: boolean;
  cancelMethod: CancelMethod;
  cancelPlace: CancelPlace;
  cancelUrl: string | null;
  instructionKey: string | null;
};

type KbRow = {
  slug: string;
  cancel_url: string | null;
  billing_source: BillingSource;
  method: CancelMethod;
};

const KB = cancelUrls as KbRow[];
const MEDIANS = medians as Record<string, number>;
const GROUPS = groups as Record<string, string[]>;

function senderHost(hit: MailboxHit): string {
  if (hit.senderDomain) return hit.senderDomain;
  const fromEmail = hit.supportEmail?.split("@")[1];
  return fromEmail ?? "";
}

export function scoreMailbox(hits: MailboxHit[]): ScoredSub[] {
  const flagged = duplicateSlugs(
    hits.map((h) => h.slug),
    GROUPS,
  );

  return hits
    .map((hit) => {
      const kb = KB.find((row) => row.slug === hit.slug);
      const billingSource = hit.billingSource ?? kb?.billing_source ?? "unknown";
      const route = routeCancel({
        billingSource,
        links: hit.links ?? [],
        kbUrl: kb?.cancel_url ?? null,
        senderDomain: senderHost(hit),
      });
      const wasteDays =
        hit.lastPaidAt === null ? 0 : unexpectedSilenceDays(hit.daysInactive, hit.billingCycle);
      const waste = computeWasteScore({
        daysInactive: wasteDays,
        price: hit.price,
        categoryMedianPrice: MEDIANS[hit.categoryKey] ?? MEDIANS.other,
        isDuplicate: flagged.has(hit.slug),
        isTrialTrap: Boolean(hit.isTrialTrap),
      });
      const yearly = annualCost(hit.price, hit.billingCycle);
      return {
        ...hit,
        wasteScore: waste.score,
        wasteReason: waste.reason,
        yearly,
        isDuplicate: flagged.has(hit.slug),
        isRed: isRedPill(waste.score),
        cancelMethod: route.method,
        cancelPlace: route.place,
        cancelUrl: route.url,
        instructionKey: route.instructionKey,
      };
    })
    .sort((a, b) => b.wasteScore - a.wasteScore);
}

export function categoryMix(subs: ScoredSub[]): Array<{ name: string; value: number; pct: number }> {
  const map = new Map<string, number>();
  for (const sub of subs) {
    map.set(sub.categoryKey, (map.get(sub.categoryKey) ?? 0) + sub.price);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  return [...map.entries()]
    .map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

export { cyclePeriodLabel };

export function silenceLabel(days: number, billingCycle: BillingCycle = "monthly", hasPaid = true): string {
  if (!hasPaid) return "Нет успешного списания";
  if (billingCycle === "yearly" && days < 335) {
    return `Годовая · последнее списание ${days} дн. назад`;
  }
  if (days <= 0) return "Письмо сегодня";
  if (days === 1) return "Тишина в почте 1 день";
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return `Тишина в почте ${days} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `Тишина в почте ${days} дня`;
  return `Тишина в почте ${days} дней`;
}
