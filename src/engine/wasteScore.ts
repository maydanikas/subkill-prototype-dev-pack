import type { WasteReason } from "../types";

/**
 * Locked Waste Score formula (do not invent a second one).
 *
 * score = min(100,
 *   daysInactive * 1.5
 * + (price / categoryMedian) * 20
 * + (duplicate ? 30 : 0)
 * + (trialTrap ? 40 : 0)
 * )
 *
 * "Last used" is an EMAIL PROXY (latest message from the merchant domain),
 * never actual app opens. UI copy must say "тишина в почте", not "не заходил".
 */
export const WASTE_WEIGHTS = {
  daysInactive: 1.5,
  priceVsMedian: 20,
  duplicatePenalty: 30,
  trialTrapPenalty: 40,
  forgottenDays: 30,
  expensiveRatio: 1.4,
  redPillMin: 70,
} as const;

export type WasteScoreInput = {
  daysInactive: number;
  price: number;
  categoryMedianPrice: number;
  isDuplicate: boolean;
  isTrialTrap: boolean;
};

export type WasteScoreResult = {
  score: number;
  reason: WasteReason;
  parts: {
    inactivity: number;
    pricePressure: number;
    duplicate: number;
    trialTrap: number;
  };
};

export function computeWasteScore(input: WasteScoreInput): WasteScoreResult {
  const inactivity = Math.max(0, input.daysInactive) * WASTE_WEIGHTS.daysInactive;
  const pricePressure =
    input.categoryMedianPrice > 0
      ? (input.price / input.categoryMedianPrice) * WASTE_WEIGHTS.priceVsMedian
      : 0;
  const duplicate = input.isDuplicate ? WASTE_WEIGHTS.duplicatePenalty : 0;
  const trialTrap = input.isTrialTrap ? WASTE_WEIGHTS.trialTrapPenalty : 0;
  const score = Math.min(100, Math.round(inactivity + pricePressure + duplicate + trialTrap));

  return {
    score,
    reason: pickReason(input, score),
    parts: {
      inactivity: round1(inactivity),
      pricePressure: round1(pricePressure),
      duplicate,
      trialTrap,
    },
  };
}

function pickReason(input: WasteScoreInput, score: number): WasteReason {
  if (input.isTrialTrap) return "trial_trap";
  if (input.daysInactive >= WASTE_WEIGHTS.forgottenDays) return "forgotten";
  if (input.isDuplicate) return "duplicate";
  if (
    input.categoryMedianPrice > 0 &&
    input.price / input.categoryMedianPrice >= WASTE_WEIGHTS.expensiveRatio
  ) {
    return "expensive";
  }
  if (score < 40) return "healthy";
  return "expensive";
}

export function annualCost(price: number, billingCycle: "monthly" | "yearly" | "weekly"): number {
  if (billingCycle === "yearly") return price;
  if (billingCycle === "weekly") return price * 52;
  return price * 12;
}

export function cycleLengthDays(billingCycle: "monthly" | "yearly" | "weekly"): number {
  if (billingCycle === "yearly") return 365;
  if (billingCycle === "weekly") return 7;
  return 30;
}

/**
 * Days of unexpected silence to feed the locked formula.
 * Monthly/weekly: calendar days since last successful charge (unchanged).
 * Yearly: silence inside the paid year is expected, so it does not count.
 */
export function unexpectedSilenceDays(
  daysSinceLastPaid: number,
  billingCycle: "monthly" | "yearly" | "weekly",
): number {
  if (billingCycle === "yearly") {
    return Math.max(0, daysSinceLastPaid - (365 - WASTE_WEIGHTS.forgottenDays));
  }
  return Math.max(0, daysSinceLastPaid);
}

export function cyclePeriodLabel(billingCycle: "monthly" | "yearly" | "weekly"): string {
  if (billingCycle === "yearly") return "/год";
  if (billingCycle === "weekly") return "/нед";
  return "/мес";
}

export function isRedPill(score: number): boolean {
  return score >= WASTE_WEIGHTS.redPillMin;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
