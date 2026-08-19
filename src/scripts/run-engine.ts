import medians from "../../data/category_medians.json";
import groups from "../../data/service_groups.json";
import { duplicateSlugs } from "../engine/duplicates";
import { categoryMix, scoreMailbox } from "../engine/pipeline";
import { computeWasteScore } from "../engine/wasteScore";
import { DEMO_MAILBOX } from "../fixtures/mailbox";

const MEDIANS = medians as Record<string, number>;
const flagged = duplicateSlugs(
  DEMO_MAILBOX.map((h) => h.slug),
  groups as Record<string, string[]>,
);

const scored = scoreMailbox(DEMO_MAILBOX);
const rows = scored.map((sub) => {
  const parts = computeWasteScore({
    daysInactive: sub.daysInactive,
    price: sub.price,
    categoryMedianPrice: MEDIANS[sub.categoryKey] ?? MEDIANS.other,
    isDuplicate: flagged.has(sub.slug),
    isTrialTrap: Boolean(sub.isTrialTrap),
  }).parts;
  return {
    name: sub.name,
    days: sub.daysInactive,
    price: sub.price,
    yearly: sub.yearly,
    score: sub.wasteScore,
    reason: sub.wasteReason,
    red: sub.isRed,
    dup: sub.isDuplicate,
    trap: Boolean(sub.isTrialTrap),
    kill: sub.cancelPlace,
    url: sub.cancelUrl,
    parts,
  };
});

const monthly = scored.reduce((a, b) => a + b.price, 0);
const red = scored.filter((s) => s.isRed);
const mix = categoryMix(scored);

const report = {
  totals: {
    count: scored.length,
    monthly: Number(monthly.toFixed(2)),
    yearly: Number((monthly * 12).toFixed(2)),
    redCount: red.length,
    redYearly: red.reduce((a, b) => a + b.yearly, 0),
    duplicateCount: scored.filter((s) => s.isDuplicate).length,
  },
  reasons: scored.reduce<Record<string, number>>((acc, s) => {
    acc[s.wasteReason] = (acc[s.wasteReason] ?? 0) + 1;
    return acc;
  }, {}),
  kills: scored.reduce<Record<string, number>>((acc, s) => {
    acc[s.cancelMethod] = (acc[s.cancelMethod] ?? 0) + 1;
    return acc;
  }, {}),
  mix,
  rows,
};

console.log(JSON.stringify(report, null, 2));
