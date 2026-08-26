import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "./i18n";
import type { ProSku } from "./types";

type Props = {
  onClose: () => void;
  onBuy: (sku: ProSku) => void;
};

export function Paywall({ onClose, onBuy }: Props) {
  const { t } = useI18n();
  const [sku, setSku] = useState<ProSku>("yearly");

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1E1E1E] rounded-t-[28px] border-t border-white/[0.08] p-6 pt-3">
        <div className="flex justify-center pb-4">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="text-white font-bold text-[22px] leading-tight">{t("paywall.title")}</div>
        <p className="text-white/50 text-[14px] mt-2 leading-relaxed">{t("paywall.body")}</p>

        <div className="mt-5 space-y-2.5" role="radiogroup" aria-label={t("paywall.title")}>
          <PlanCard
            selected={sku === "yearly"}
            featured
            onSelect={() => setSku("yearly")}
            label={t("paywall.yearly")}
            price={t("paywall.yearlyPrice")}
            period={t("paywall.yearlyPeriod")}
            hint={t("paywall.yearlyHint")}
            badge={t("paywall.save")}
          />
          <PlanCard
            selected={sku === "monthly"}
            onSelect={() => setSku("monthly")}
            label={t("paywall.monthly")}
            price={t("paywall.monthlyPrice")}
            period={t("paywall.monthlyPeriod")}
          />
        </div>

        <button
          onClick={() => onBuy(sku)}
          className="mt-5 w-full h-12 rounded-[14px] bg-[#00FF88] text-black font-bold text-[15px]"
        >
          {sku === "yearly" ? t("paywall.continueYear") : t("paywall.continueMonth")}
        </button>
        <button onClick={onClose} className="mt-2 w-full h-10 text-white/40 text-[13px]">
          {t("paywall.later")}
        </button>
      </div>
    </div>
  );
}

function PlanCard({
  selected,
  featured,
  onSelect,
  label,
  price,
  period,
  hint,
  badge,
}: {
  selected: boolean;
  featured?: boolean;
  onSelect: () => void;
  label: string;
  price: string;
  period: string;
  hint?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full text-left rounded-[16px] px-4 py-3.5 border transition-colors ${
        selected
          ? "bg-[#00FF88]/10 border-[#00FF88]"
          : "bg-[#121212] border-white/[0.08]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center ${
            selected ? "bg-[#00FF88]" : "border border-white/25"
          }`}
        >
          {selected ? <Check size={12} className="text-black" strokeWidth={3} /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-[14px]">{label}</span>
            {featured && badge ? (
              <span className="px-1.5 py-0.5 rounded-full bg-[#00FF88] text-black text-[10px] font-bold tracking-wide uppercase">
                {badge}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-white font-bold text-[22px] leading-none tracking-tight">{price}</span>
            <span className="text-white/40 text-[13px] font-mono">{period}</span>
          </div>
          {hint ? <div className="text-white/40 text-[12px] mt-1">{hint}</div> : null}
        </div>
      </div>
    </button>
  );
}
