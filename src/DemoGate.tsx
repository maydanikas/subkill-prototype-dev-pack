import { useI18n } from "./i18n";

export type DemoGateKind = "limit" | "account";

type Props = {
  kind: DemoGateKind;
  hasGoogle: boolean;
  onConnect: () => void;
  onStart: () => void;
  onStay: () => void;
};

export function DemoGate({ kind, hasGoogle, onConnect, onStart, onStay }: Props) {
  const { t } = useI18n();
  const isLimit = kind === "limit";

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onStay} />
      <div className="relative bg-[#1E1E1E] rounded-t-[28px] border-t border-white/[0.08] p-6 pt-3">
        <div className="flex justify-center pb-4">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="text-[11px] font-mono tracking-widest uppercase text-[#00FF88]">
          {t("home.demoBox")}
        </div>
        <div className="text-white font-bold text-[22px] leading-tight mt-2">
          {t(isLimit ? "demoGate.limitTitle" : "demoGate.accountTitle")}
        </div>
        <p className="text-white/50 text-[14px] mt-2 leading-relaxed">
          {t(isLimit ? "demoGate.limitBody" : "demoGate.accountBody")}
        </p>

        {hasGoogle ? (
          <button
            onClick={onConnect}
            className="mt-5 w-full h-12 rounded-[14px] bg-[#00FF88] text-black font-bold text-[15px]"
          >
            {t("demoGate.connect")}
          </button>
        ) : null}
        <button
          onClick={onStart}
          className={`w-full h-12 rounded-[14px] font-bold text-[15px] ${
            hasGoogle
              ? "mt-2 bg-white/[0.08] text-white"
              : "mt-5 bg-[#00FF88] text-black"
          }`}
        >
          {t("demoGate.start")}
        </button>
        <button onClick={onStay} className="mt-2 w-full h-10 text-white/40 text-[13px]">
          {t("demoGate.stay")}
        </button>
      </div>
    </div>
  );
}
