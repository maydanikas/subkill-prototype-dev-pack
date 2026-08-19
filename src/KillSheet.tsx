import { AlertTriangle, Check, ExternalLink, List, X } from "lucide-react";
import type { MouseEvent } from "react";
import { unexpectedSilenceDays } from "./engine/wasteScore";
import { useI18n } from "./i18n";
import type { ScoredSub } from "./engine/pipeline";
import type { CancelPlace } from "./engine/cancelLink";

type Props = {
  sub: ScoredSub;
  queueLeft: number;
  onClose: () => void;
  onKilled: (sub: ScoredSub) => void;
};

function placeLabel(place: CancelPlace, url: string | null): string {
  if (place === "google_play") return "Google Play";
  if (place === "apple") return "Apple";
  if (place === "paypal") return "PayPal";
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function openLabel(place: CancelPlace, t: (key: string) => string): string {
  if (place === "google_play") return t("kill.openPlay");
  if (place === "apple") return t("kill.openApple");
  if (place === "paypal") return t("kill.openPaypal");
  return t("kill.open");
}

function openCancelPage(url: string, event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  let opened = false;
  try {
    const popup = window.open(url, "_blank");
    opened = Boolean(popup && !popup.closed);
  } catch {
    opened = false;
  }
  if (!opened) window.location.assign(url);
}

export function KillSheet({ sub, queueLeft, onClose, onKilled }: Props) {
  const { t, cycle, silence } = useI18n();
  const steps =
    sub.cancelPlace === "apple"
      ? [t("kill.apple1"), t("kill.apple2"), t("kill.apple3")]
      : sub.cancelPlace === "google_play"
        ? [t("kill.play1"), t("kill.play2"), t("kill.play3")]
        : sub.cancelPlace === "paypal"
          ? [t("kill.paypal1"), t("kill.paypal2"), t("kill.paypal3")]
          : [t("kill.fallback1"), t("kill.fallback2"), t("kill.fallback3")];

  const wasteDays =
    sub.lastPaidAt === null ? 0 : unexpectedSilenceDays(sub.daysInactive, sub.billingCycle);
  const wasted = sub.price * (wasteDays / 30);
  const where = placeLabel(sub.cancelPlace, sub.cancelUrl);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1E1E1E] rounded-t-[28px] border-t border-white/[0.08] max-h-[85vh] flex flex-col">
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-[12px] flex items-center justify-center text-white font-bold"
              style={{ background: sub.color }}
            >
              {sub.letter}
            </div>
            <div>
              <div className="text-white font-semibold text-[15px]">{sub.name}</div>
              <div className="text-white/40 text-[12px] font-mono">
                {where}
                {queueLeft > 1 ? t("kill.more", { n: queueLeft - 1 }) : ""}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-3">
          <div className="rounded-[16px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 p-3 flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[#FF3B30]/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={12} className="text-[#FF3B30]" />
            </div>
            <div className="text-[12px] leading-[1.4] text-[#FF3B30]/90">
              <span className="font-bold">Waste Score {sub.wasteScore}.</span>{" "}
              {silence(sub.daysInactive, sub.billingCycle, sub.lastPaidAt !== null)}.
              {wasteDays > 0
                ? t("kill.wasted", { currency: sub.currency, amount: wasted.toFixed(2) })
                : ""}
              {sub.wasteReason === "trial_trap" ? t("kill.trialTrap") : ""}
              {sub.isDuplicate ? t("kill.duplicate") : ""}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-hide">
          <div className="rounded-[20px] bg-[#121212] border border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center gap-2 text-white text-[13px] font-semibold">
              <List size={14} /> {t("kill.twoSteps")}
            </div>
            {sub.cancelUrl
              ? steps.map((step, i) => (
                  <div key={i} className="flex gap-3 text-[12px] text-white/70 leading-relaxed">
                    <div className="w-5 h-5 rounded-full bg-[#00FF88] text-black text-[11px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    {step}
                  </div>
                ))
              : (
                <div className="text-[12px] text-white/70 leading-relaxed">{t("kill.noPage")}</div>
              )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-[#121212] border border-white/[0.06] p-3">
              <div className="text-white/40 text-[10px] tracking-widest">{t("kill.nextBill")}</div>
              <div className="text-white font-semibold font-mono mt-1">
                {sub.lastPaidAt === null
                  ? t("silence.unpaid")
                  : t("kill.nextBillValue", {
                      days: sub.nextBillingDays,
                      currency: sub.currency,
                      price: String(sub.price),
                      cycle: cycle(sub.billingCycle),
                    })}
              </div>
            </div>
            <div className="rounded-[14px] bg-[#121212] border border-white/[0.06] p-3">
              <div className="text-white/40 text-[10px] tracking-widest">{t("kill.saveYear")}</div>
              <div className="text-[#00FF88] font-bold font-mono mt-1">${sub.yearly.toFixed(0)}</div>
            </div>
          </div>
        </div>

        <div className="p-5 pt-3 border-t border-white/[0.06]">
          <div className="flex gap-2">
            {sub.cancelUrl && (
              <a
                href={sub.cancelUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => openCancelPage(sub.cancelUrl!, event)}
                className="flex-1 h-12 rounded-full bg-white/[0.08] border border-white/[0.08] text-white text-[13px] font-medium flex items-center justify-center gap-2 no-underline"
              >
                <ExternalLink size={16} /> {openLabel(sub.cancelPlace, t)}
              </a>
            )}
            <button
              onClick={() => onKilled(sub)}
              className="flex-[1.6] h-12 rounded-full bg-[#00FF88] text-black text-[13px] font-bold flex items-center justify-center gap-2"
            >
              <Check size={16} /> {t("kill.iCanceled")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
