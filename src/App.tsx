import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Flame,
  Mail,
  Sparkles,
  Zap,
} from "lucide-react";
import { KillSheet } from "./KillSheet";
import { Paywall } from "./Paywall";
import { DemoGate, type DemoGateKind } from "./DemoGate";
import {
  beginGmailRedirect,
  clearPendingToken,
  hasGoogleClient,
  oauthReturnError,
  scanGmail,
  takePendingToken,
} from "./api/gmail";
import { classifyMailbox } from "./engine/mailsToMailbox";
import { categoryMix, scoreMailbox, type ScoredSub } from "./engine/pipeline";
import { unexpectedSilenceDays } from "./engine/wasteScore";
import { useI18n } from "./i18n";
import { DEMO_MAILBOX, DEMO_USER_NAME, SCAN_PASSES, USER_EMAIL } from "./fixtures/mailbox";
import type { MailboxHit } from "./fixtures/mailbox";
import type { Plan, WasteReason } from "./types";

type Screen = "onboarding" | "scan" | "home";
type Filter = "all" | "forgotten" | "expensive" | "duplicate";

const FREE_LIMIT = 3;
const PIE_COLORS = ["#FF453A", "#0A84FF", "#30D158", "#FF9F0A", "#BF5AF2", "#64D2FF", "#FF375F"];

const GOOGLE_LETTER_COLORS = [
  "#F44336",
  "#E91E63",
  "#9C27B0",
  "#673AB7",
  "#3F51B5",
  "#2196F3",
  "#009688",
  "#4CAF50",
  "#FF9800",
  "#FF5722",
  "#795548",
  "#607D8B",
];

function avatarLetter(name: string, email: string): string {
  const src = name.trim() || email.trim();
  const ch = [...src].find((c) => /\p{L}|\p{N}/u.test(c));
  return (ch ?? "?").toUpperCase();
}

function avatarColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return GOOGLE_LETTER_COLORS[hash % GOOGLE_LETTER_COLORS.length];
}

function EnvelopeMark({ className }: { className?: string }) {
  return (
    <div className={`rounded-full bg-[#00FF88] flex items-center justify-center shrink-0 ${className ?? ""}`}>
      <svg viewBox="0 0 24 24" className="w-[52%] h-[52%]" fill="#111" aria-hidden>
        <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
        <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
      </svg>
    </div>
  );
}

function AccountAvatar({
  name,
  email,
  picture,
  placeholder,
}: {
  name: string;
  email: string;
  picture: string | null;
  placeholder?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const letter = avatarLetter(name, email);
  const color = avatarColor(name || email);
  const showPhoto = Boolean(picture) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [picture]);

  if (placeholder && !showPhoto) {
    return (
      <span className="flex w-full h-full relative bg-[#3A3A3C] overflow-hidden" aria-hidden>
        <svg viewBox="0 0 36 36" className="w-full h-full">
          <circle cx="18" cy="13" r="6.4" fill="white" />
          <ellipse cx="18" cy="33.5" rx="13.2" ry="10.8" fill="white" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="flex w-full h-full items-center justify-center text-white font-semibold text-[15px] leading-none"
      style={{ background: showPhoto ? "#1E1E1E" : color }}
    >
      {showPhoto ? (
        <img
          src={picture ?? ""}
          alt=""
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        letter
      )}
    </span>
  );
}

const REASON_UI: Record<WasteReason, { color: string; bg: string; icon: typeof Flame }> = {
  forgotten: { color: "#FF3B30", bg: "rgba(255,59,48,0.15)", icon: Flame },
  trial_trap: { color: "#FF3B30", bg: "rgba(255,59,48,0.15)", icon: AlertTriangle },
  expensive: { color: "#FF9500", bg: "rgba(255,149,0,0.15)", icon: AlertTriangle },
  duplicate: { color: "#AF52DE", bg: "rgba(175,82,222,0.15)", icon: Copy },
  healthy: { color: "#00FF88", bg: "rgba(0,255,136,0.15)", icon: Zap },
};

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

export default function App() {
  const { t, category, cycle, silence } = useI18n();
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [scanPass, setScanPass] = useState(0);
  const [scanMode, setScanMode] = useState<"demo" | "gmail">("demo");
  const [mailbox, setMailbox] = useState<MailboxHit[]>(DEMO_MAILBOX);
  const [accountEmail, setAccountEmail] = useState(USER_EMAIL);
  const [accountName, setAccountName] = useState(DEMO_USER_NAME);
  const [accountPicture, setAccountPicture] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [liveScan, setLiveScan] = useState(false);
  const [scanStats, setScanStats] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [killsUsed, setKillsUsed] = useState(0);
  const [savedYearly, setSavedYearly] = useState(0);
  const [killedIds, setKilledIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [queue, setQueue] = useState<string[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState<string[]>([]);
  const [paywall, setPaywall] = useState(false);
  const [demoGate, setDemoGate] = useState<DemoGateKind | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const scored = useMemo(() => scoreMailbox(mailbox), [mailbox]);
  const live = useMemo(() => scored.filter((s) => !killedIds.includes(s.id)), [scored, killedIds]);

  const finishGmailScan = async (token: string) => {
    setScanMode("gmail");
    setScanPass(0);
    setScreen("scan");
    try {
      const result = await scanGmail(token, setScanPass);
      const { hits, dropped } = classifyMailbox(result.mails);
      const scoredHits = scoreMailbox(hits);
      const report = {
        email: result.email,
        at: new Date().toISOString(),
        passCounts: result.passCounts,
        mailCount: result.mails.length,
        dropped,
        mails: result.mails.map((m) => ({
          pass: m.pass,
          from: m.from,
          subject: m.subject,
          snippet: m.snippet.slice(0, 280),
          date: m.date,
        })),
        hits: scoredHits.map((s) => ({
          name: s.name,
          slug: s.slug,
          price: s.price,
          cycle: s.billingCycle,
          days: s.daysInactive,
          paid: s.lastPaidAt != null,
          score: s.wasteScore,
          reason: s.wasteReason,
          red: s.isRed,
          kill: s.cancelPlace,
          url: s.cancelUrl,
          yearly: s.yearly,
        })),
      };
      window.localStorage.setItem("subkill.lastScan", JSON.stringify(report));
      (window as unknown as { __subkill?: typeof report }).__subkill = report;
      await fetch("/__subkill_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      }).catch(() => undefined);
      setLiveScan(true);
      setScanStats(
        t("home.scanStats", {
          email: result.email,
          n: hits.length,
          mails: result.mails.length,
          dropped,
        }),
      );
      resetSession(hits, result.email || USER_EMAIL, {
        name: result.name,
        picture: result.picture,
      });
      clearPendingToken();
      setScanPass(3);
      setScreen("home");
    } catch (err) {
      clearPendingToken();
      setAuthError(err instanceof Error ? err.message : t("errors.googleDenied"));
      setScreen("onboarding");
    }
  };

  useEffect(() => {
    const err = oauthReturnError();
    if (err) {
      clearPendingToken();
      setAuthError(
        err.includes("redirect_uri") ? t("errors.redirectUri") : err,
      );
      return;
    }
    const token = takePendingToken();
    if (!token) return;
    void finishGmailScan(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen !== "scan" || scanMode !== "demo") return;
    setScanPass(0);
    const t1 = window.setTimeout(() => setScanPass(1), 700);
    const t2 = window.setTimeout(() => setScanPass(2), 1500);
    const t3 = window.setTimeout(() => setScanPass(3), 2300);
    const done = window.setTimeout(() => setScreen("home"), 2800);
    return () => [t1, t2, t3, done].forEach(clearTimeout);
  }, [screen, scanMode]);

  useEffect(() => {
    if (screen !== "home" || seeded) return;
    setSelectedIds(live.filter((s) => s.isRed).map((s) => s.id));
    setSeeded(true);
  }, [screen, live, seeded]);

  const filtered = useMemo(() => {
    if (filter === "forgotten") return live.filter((s) => s.wasteReason === "forgotten" || s.wasteReason === "trial_trap");
    if (filter === "expensive") return live.filter((s) => s.wasteReason === "expensive" || s.price > 13);
    if (filter === "duplicate") return live.filter((s) => s.isDuplicate);
    return live;
  }, [live, filter]);

  const totals = useMemo(() => {
    const yearly = live.reduce((a, b) => a + b.yearly, 0);
    const red = live.filter((s) => s.isRed);
    const selected = live.filter((s) => selectedIds.includes(s.id));
    return {
      monthly: yearly / 12,
      yearly,
      count: live.length,
      redCount: red.length,
      redYearly: red.reduce((a, b) => a + b.yearly, 0),
      selectedYearly: selected.reduce((a, b) => a + b.yearly, 0),
      selectedCount: selected.length,
    };
  }, [live, selectedIds]);

  const mix = useMemo(() => categoryMix(live), [live]);
  const pie = useMemo(() => {
    let acc = 0;
    return mix.map((row, i) => {
      const start = acc;
      const sweep = (row.pct / 100) * 360;
      acc += sweep;
      return { ...row, start, sweep, color: PIE_COLORS[i % PIE_COLORS.length] };
    });
  }, [mix]);

  const current = live.find((s) => s.id === queue[0]) ?? null;
  const completedInBatch = useMemo(
    () =>
      batchCompleted
        .map((id) => scored.find((s) => s.id === id))
        .filter((s): s is ScoredSub => s != null),
    [batchCompleted, scored],
  );
  const upcomingInBatch = useMemo(
    () =>
      queue
        .slice(1)
        .map((id) => live.find((s) => s.id === id))
        .filter((s): s is ScoredSub => s != null),
    [queue, live],
  );
  const killsLeft = plan === "pro" ? 99 : Math.max(0, FREE_LIMIT - killsUsed);

  const closeQueue = () => {
    setQueue([]);
    setBatchTotal(0);
    setBatchCompleted([]);
  };

  const showDemoLimit = () => {
    closeQueue();
    setPaywall(false);
    setDemoGate("limit");
  };

  const goOnboarding = () => {
    setDemoGate(null);
    setPaywall(false);
    closeQueue();
    setPlan("free");
    setAuthError(null);
    setScreen("onboarding");
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startKill = (ids: string[]) => {
    const unique = ids.filter((id) => live.some((s) => s.id === id));
    if (!unique.length) return;
    if (killsLeft <= 0) {
      if (scanMode === "demo") showDemoLimit();
      else setPaywall(true);
      return;
    }
    setBatchTotal(unique.length);
    setBatchCompleted([]);
    setQueue(unique);
  };

  const onKilled = (sub: ScoredSub) => {
    if (killsLeft <= 0) {
      if (scanMode === "demo") showDemoLimit();
      else setPaywall(true);
      return;
    }
    const nextUsed = killsUsed + 1;
    setKilledIds((prev) => [...prev, sub.id]);
    setSelectedIds((prev) => prev.filter((id) => id !== sub.id));
    setKillsUsed(nextUsed);
    setSavedYearly((n) => n + sub.yearly);
    setToast(t("toast.killed", { name: sub.name, amount: sub.yearly.toFixed(0) }));
    window.setTimeout(() => setToast(null), 2200);
    setBatchCompleted((prev) => [...prev, sub.id]);
    setQueue((q) => {
      const next = q.slice(1);
      if (scanMode === "demo" && nextUsed >= FREE_LIMIT) {
        setBatchTotal(0);
        setBatchCompleted([]);
        setDemoGate("limit");
        return [];
      }
      if (!next.length) {
        setBatchTotal(0);
        setBatchCompleted([]);
      }
      return next;
    });
  };

  const resetSession = (
    hits: MailboxHit[],
    email: string,
    identity?: { name?: string; picture?: string | null },
  ) => {
    setMailbox(hits);
    setAccountEmail(email);
    setAccountName(identity?.name ?? "");
    setAccountPicture(identity?.picture ?? null);
    setKilledIds([]);
    setSelectedIds([]);
    setSeeded(false);
    setSavedYearly(0);
    setKillsUsed(0);
  };

  const startDemo = () => {
    setAuthError(null);
    setScanMode("demo");
    setLiveScan(false);
    setPlan("free");
    setDemoGate(null);
    setPaywall(false);
    closeQueue();
    resetSession(DEMO_MAILBOX, USER_EMAIL, { name: DEMO_USER_NAME });
    setScreen("scan");
  };

  const startGoogle = () => {
    setAuthError(null);
    if (!hasGoogleClient()) {
      setAuthError(t("errors.needClientId"));
      return;
    }
    beginGmailRedirect();
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] flex justify-center selection:bg-[#00FF88]/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
        * { font-family: 'Geist', -apple-system, sans-serif; }
        .font-mono { font-family: 'Geist Mono', monospace; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="w-full max-w-[390px] min-h-screen bg-[#121212] relative flex flex-col overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_80px_rgba(0,0,0,0.6)]">
        {screen === "onboarding" && (
          <Onboarding
            hasGoogle={hasGoogleClient()}
            error={authError}
            onGoogle={startGoogle}
            onDemo={startDemo}
          />
        )}

        {screen === "scan" && (
          <ScanView
            pass={scanPass}
            waitingGoogle={scanMode === "gmail" && scanPass === 0}
            onCancel={() => setScreen("onboarding")}
          />
        )}

        {screen === "home" && (
          <>
            <div className="px-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <EnvelopeMark className="w-9 h-9" />
                <div>
                  <div className="text-white font-bold text-[18px] leading-none tracking-tight">SubKill</div>
                  <div className="text-white/40 text-[11px] font-mono -mt-[1px]">
                    {plan === "pro" ? t("header.pro") : t("header.freeLeft", { n: killsLeft })}
                    {savedYearly > 0 ? ` · −$${savedYearly.toFixed(0)}` : ""}
                  </div>
                </div>
              </div>
              {scanMode === "demo" ? (
                <button
                  type="button"
                  onClick={() => setDemoGate("account")}
                  className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-[#3A3A3C] ring-1 ring-white/10"
                  title={accountEmail}
                >
                  <AccountAvatar
                    name={accountName}
                    email={accountEmail}
                    picture={accountPicture}
                    placeholder
                  />
                </button>
              ) : (
                <a
                  href={`mailto:${accountEmail}`}
                  className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-[#3A3A3C] ring-1 ring-white/10"
                  title={accountEmail}
                >
                  <AccountAvatar
                    name={accountName}
                    email={accountEmail}
                    picture={accountPicture}
                  />
                </a>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide pb-[140px]">
              <div className="mx-5 mt-2 rounded-[24px] bg-[#1E1E1E] border border-white/[0.06] p-5 relative overflow-hidden">
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="px-2.5 py-1 rounded-full bg-[#FF3B30]/15 text-[#FF3B30] text-[10px] font-bold tracking-widest uppercase flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" /> {t("home.leaking")}
                      </div>
                      <span className="text-white/30 text-[11px] font-mono">{t("home.subscriptions", { n: totals.count })}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-white font-bold text-[34px] tracking-tighter leading-none">
                        ${totals.yearly.toFixed(0)}
                      </span>
                      <span className="text-white/40 text-[14px] font-medium">{t("home.perYear")}</span>
                    </div>
                    <div className="text-white/50 text-[13px] mt-1.5 font-mono">
                      ${totals.monthly.toFixed(2)}{t("home.perMonth")}
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-[14px] bg-[#00FF88] flex items-center justify-center">
                    <Flame className="text-black" size={22} />
                  </div>
                </div>

                <div className="mt-5 h-[56px] rounded-[14px] bg-[#121212] border border-white/[0.06] p-3 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {live.slice(0, 5).map((s) => (
                      <div
                        key={s.id}
                        className="w-7 h-7 rounded-full border-2 border-[#121212] flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: s.color }}
                      >
                        {s.letter}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[12px] font-medium leading-none">
                      {t("home.redCount", { n: totals.redCount })}
                    </div>
                    <div className="text-white/40 text-[11px] mt-1 leading-none">
                      {t("home.burning", { amount: totals.redYearly.toFixed(0) })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-5 mt-4 rounded-[20px] bg-[#1A1A1A] border border-white/[0.06] p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#00FF88] flex items-center justify-center">
                    <Check size={18} className="text-black" />
                  </div>
                  <div>
                    <div className="text-white text-[13px] font-semibold">
                      {liveScan ? t("home.foundLive", { n: scored.length }) : t("home.foundDemo", { n: scored.length })}
                    </div>
                    <div className="text-white/40 text-[11px]">
                      {liveScan
                        ? scanStats ?? `${accountEmail} · ${t("home.liveScan")}`
                        : (
                          <button
                            type="button"
                            onClick={() => setDemoGate("account")}
                            className="text-left hover:text-white/70"
                          >
                            {t("home.demoBox")}
                          </button>
                        )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={hasGoogleClient() ? startGoogle : startDemo}
                  className="px-3 py-1.5 rounded-full bg-white text-black text-[11px] font-bold"
                >
                  {scanMode === "demo" && hasGoogleClient() ? t("home.myMail") : t("home.scan")}
                </button>
              </div>

              <div className="mx-5 mt-5 rounded-[24px] bg-[#1E1E1E] border border-white/[0.06] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold text-[14px]">{t("home.moneyWhere")}</h3>
                  <span className="text-white/30 text-[11px] font-mono">{t("home.fromLive")}</span>
                </div>
                <div className="flex gap-5">
                  <div className="relative w-[120px] h-[120px] shrink-0">
                    <svg width="120" height="120" viewBox="0 0 100 100">
                      {pie.map((seg) => (
                        <path key={seg.name} d={arc(50, 50, 48, seg.start, seg.start + seg.sweep)} fill={seg.color} />
                      ))}
                      <circle cx="50" cy="50" r="28" fill="#1E1E1E" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-white font-bold text-[18px] leading-none">${totals.monthly.toFixed(0)}</span>
                      <span className="text-white/40 text-[9px] tracking-widest uppercase mt-0.5">{t("home.perMonthShort")}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {mix.slice(0, 5).map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                          <span className="text-white/80 text-[12px]">{category(c.name)}</span>
                        </div>
                        <span className="text-white text-[12px] font-medium font-mono">${c.value.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 px-5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {(
                  [
                    ["all", t("home.filterAll", { n: totals.count })],
                    ["forgotten", t("home.filterForgotten")],
                    ["expensive", t("home.filterExpensive")],
                    ["duplicate", t("home.filterDuplicates")],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`shrink-0 px-4 h-8 rounded-full text-[12px] font-medium border ${
                      filter === id
                        ? "bg-[#00FF88] text-black border-[#00FF88] font-bold"
                        : "bg-[#1E1E1E] text-white/60 border-white/[0.06]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1 text-white/20">
                  <Sparkles size={12} />
                  <span className="text-[10px] font-mono tracking-widest">SCORE</span>
                </div>
              </div>

              <div className="mt-4 px-5 space-y-3">
                {filtered.map((sub) => {
                  const selected = selectedIds.includes(sub.id);
                  const ui = REASON_UI[sub.wasteReason];
                  const Icon = ui.icon;
                  const usageDays =
                    sub.lastPaidAt === null
                      ? 0
                      : unexpectedSilenceDays(sub.daysInactive, sub.billingCycle);
                  const usagePct = Math.max(8, 100 - usageDays * 2.5);
                  return (
                    <div
                      key={sub.id}
                      className={`relative rounded-[20px] bg-[#1E1E1E] border ${
                        selected ? "border-[#00FF88]/50" : "border-white/[0.06]"
                      } ${sub.isRed ? "ring-1 ring-[#FF3B30]/10" : ""}`}
                    >
                      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full ${selected ? "bg-[#00FF88]" : "bg-transparent"}`} />
                      <div className="p-4 pl-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3 flex-1 min-w-0">
                            <div
                              className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white font-bold text-[16px] shrink-0"
                              style={{ background: sub.color }}
                            >
                              {sub.letter}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-white font-semibold text-[14px] truncate">{sub.name}</div>
                                {sub.isRed && <div className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-white font-mono text-[13px] font-semibold">
                                  {sub.currency}{sub.price.toFixed(2)}
                                </span>
                                <span className="text-white/40 text-[11px]">{cycle(sub.billingCycle)}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-white/50 text-[11px] flex items-center gap-1">
                                  <Clock size={10} /> {sub.lastPaidAt === null ? "—" : `${sub.nextBillingDays}${t("home.daysShort")}`}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: ui.bg, color: ui.color }}>
                                  <span className="flex items-center gap-1">
                                    <Icon size={10} />
                                    {t(`reason.${sub.wasteReason}`).toUpperCase()} · {sub.wasteScore}
                                  </span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 text-[10px]">{category(sub.categoryKey)}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => toggle(sub.id)}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selected ? "bg-[#00FF88] border-[#00FF88] text-black" : "border-white/15"
                            }`}
                          >
                            {selected && <Check size={14} strokeWidth={3} />}
                          </button>
                        </div>

                        <div className="mt-3.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-white/40 text-[11px]">
                              {silence(sub.daysInactive, sub.billingCycle, sub.lastPaidAt !== null)}
                            </span>
                            <span className={`text-[10px] font-mono ${sub.isRed ? "text-[#FF3B30]" : "text-white/30"}`}>
                              {sub.isRed ? t("home.wasted") : t("home.ok")}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-[#121212] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${usagePct}%`, background: sub.isRed ? "#FF3B30" : "#00FF88" }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => startKill([sub.id])}
                          className="mt-3.5 w-full h-9 rounded-full bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-[12px] font-semibold"
                        >
                          {t("home.killOne", { amount: sub.yearly.toFixed(0) })}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 px-5 pb-4">
                <div className="rounded-[20px] bg-[#1A1A1A] border border-dashed border-white/10 p-4 text-center text-white/30 text-[12px]">
                  {t("home.footerNote")}
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 inset-x-0 bg-[#121212] pt-4">
              <div className="px-5 pb-6">
                <div className="rounded-[20px] bg-[#1E1E1E] border border-white/[0.06] p-3">
                  <div className="flex items-center justify-between px-2 mb-3">
                    <div className="text-white/60 text-[11px] font-mono tracking-widest">
                      {t("home.selected", { n: totals.selectedCount })}
                    </div>
                    <div className="text-white font-bold font-mono text-[13px]">
                      <span className="text-[#00FF88]">${totals.selectedYearly.toFixed(0)}{t("home.perYearShort")}</span>
                    </div>
                  </div>
                  <button
                    disabled={totals.selectedCount === 0}
                    onClick={() => startKill(selectedIds)}
                    className="w-full h-[56px] rounded-[16px] bg-[#00FF88] disabled:bg-white/10 disabled:text-white/20 text-black font-bold text-[14px] flex items-center justify-center gap-2"
                  >
                    <Zap size={18} />
                    {t("home.killMany", { n: totals.selectedCount, amount: totals.selectedYearly.toFixed(0) })}
                  </button>
                </div>
                <div className="mt-3 flex justify-center">
                  <div className="w-32 h-1 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </>
        )}

        {current && (
          <KillSheet
            sub={current}
            batchTotal={batchTotal}
            batchIndex={batchCompleted.length + 1}
            completedSubs={completedInBatch}
            upcomingSubs={upcomingInBatch}
            onClose={closeQueue}
            onKilled={onKilled}
          />
        )}

        {paywall && scanMode !== "demo" && (
          <Paywall
            onClose={() => setPaywall(false)}
            onBuy={() => {
              setPlan("pro");
              setPaywall(false);
            }}
          />
        )}

        {demoGate && scanMode === "demo" && (
          <DemoGate
            kind={demoGate}
            hasGoogle={hasGoogleClient()}
            onConnect={startGoogle}
            onStart={goOnboarding}
            onStay={() => setDemoGate(null)}
          />
        )}

        {toast && (
          <div className="absolute top-[56px] left-1/2 -translate-x-1/2 z-40">
            <div className="px-4 py-2 rounded-full bg-[#00FF88] text-black text-[12px] font-bold flex items-center gap-2 whitespace-nowrap">
              <Check size={14} /> {toast}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Onboarding({
  hasGoogle,
  error,
  onGoogle,
  onDemo,
}: {
  hasGoogle: boolean;
  error: string | null;
  onGoogle: () => void;
  onDemo: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex-1 px-6 pb-10 flex flex-col">
      <div className="flex-1 flex flex-col justify-center">
        <EnvelopeMark className="w-14 h-14 mb-6" />
        <h1 className="text-white font-bold text-[32px] leading-[1.1] tracking-tight">SubKill</h1>
        <p className="text-white/70 text-[15px] mt-3 leading-relaxed">
          SubKill finds forgotten subscriptions in Gmail and helps you cancel them. Gmail access is
          read-only: SubKill does not send, delete, or change your mail.
        </p>
        <p className="text-white text-[18px] mt-4 leading-snug font-medium">{t("onboarding.headline")}</p>
        <p className="text-white/50 text-[15px] mt-2 leading-relaxed">{t("onboarding.body")}</p>
        <div className="mt-8 space-y-3">
          {[t("onboarding.bullet1"), t("onboarding.bullet2"), t("onboarding.bullet3")].map((line) => (
            <div key={line} className="flex items-center gap-3 text-white/80 text-[13px]">
              <div className="w-5 h-5 rounded-full bg-[#00FF88]/20 text-[#00FF88] flex items-center justify-center">
                <Check size={12} />
              </div>
              {line}
            </div>
          ))}
        </div>
        {error && <div className="mt-6 text-[#FF3B30] text-[12px] leading-relaxed">{error}</div>}
      </div>
      <button
        onClick={hasGoogle ? onGoogle : onDemo}
        className="w-full h-[56px] rounded-[16px] bg-white text-black font-bold text-[15px]"
      >
        {hasGoogle ? t("onboarding.connectGmail") : t("onboarding.openDemo")}
      </button>
      {hasGoogle ? (
        <button onClick={onDemo} className="mt-2 w-full h-10 text-white/40 text-[13px]">
          {t("onboarding.demoFirst")}
        </button>
      ) : (
        <div className="mt-3 text-center text-white/30 text-[11px]">{t("onboarding.needClientId")}</div>
      )}
      <div className="mt-3 flex items-center justify-center gap-3 text-white/30 text-[11px]">
        <a href="/privacy.html" className="hover:text-white/60">
          {t("onboarding.privacy")}
        </a>
        <span aria-hidden>·</span>
        <a href="/terms.html" className="hover:text-white/60">
          {t("onboarding.terms")}
        </a>
      </div>
    </div>
  );
}

function ScanView({
  pass,
  waitingGoogle,
  onCancel,
}: {
  pass: number;
  waitingGoogle?: boolean;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const pct = Math.min(100, Math.round((pass / SCAN_PASSES.length) * 100));
  const rows = [
    { pass: 1, label: t("scan.pass1"), hint: t("scan.pass1Hint") },
    { pass: 2, label: t("scan.pass2"), hint: t("scan.pass2Hint") },
    { pass: 3, label: t("scan.pass3"), hint: t("scan.pass3Hint") },
  ];
  return (
    <div className="flex-1 px-6 pb-16 flex flex-col justify-center">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-[#00FF88]/20" />
        <div className="absolute inset-0 rounded-full border-2 border-t-[#00FF88] border-transparent animate-spin" />
        <div className="absolute inset-[12px] rounded-full bg-[#00FF88]/20 flex items-center justify-center">
          <Mail size={18} className="text-[#00FF88]" />
        </div>
      </div>
      <div className="text-white text-[20px] font-semibold">
        {waitingGoogle ? t("scan.waitingGoogle") : t("scan.scanning")}
      </div>
      {waitingGoogle && (
        <p className="text-white/50 text-[13px] mt-3 leading-relaxed">{t("scan.whiteWindow")}</p>
      )}
      <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-[#00FF88] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-6 space-y-3">
        {rows.map((row) => {
          const state = pass > row.pass ? "done" : pass === row.pass ? "now" : "wait";
          return (
            <div key={row.pass} className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  state === "done" ? "bg-[#00FF88] text-black" : state === "now" ? "bg-[#00FF88]/20 text-[#00FF88]" : "bg-white/10 text-white/30"
                }`}
              >
                {state === "done" ? <Check size={12} /> : row.pass}
              </div>
              <div>
                <div className={`text-[13px] ${state === "wait" ? "text-white/30" : "text-white"}`}>{row.label}</div>
                <div className="text-[11px] font-mono text-white/30">{row.hint}</div>
              </div>
            </div>
          );
        })}
      </div>
      {onCancel && (
        <button onClick={onCancel} className="mt-8 text-white/40 text-[13px]">
          {t("scan.back")}
        </button>
      )}
    </div>
  );
}

