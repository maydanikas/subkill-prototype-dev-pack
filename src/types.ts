/** Canonical domain types. Flutter / Cloud Functions should mirror this file. */

export type Plan = "free" | "pro";
export type Provider = "gmail" | "outlook";
export type BillingCycle = "monthly" | "yearly" | "weekly";
export type SubscriptionStatus = "active" | "canceled" | "trial";
export type WasteReason = "forgotten" | "duplicate" | "expensive" | "trial_trap" | "healthy";
export type CancelMethod = "direct_link" | "ai_email" | "instruction";
export type CancelStatus = "initiated" | "confirmed" | "failed";
export type BillingSource = "web" | "stripe" | "paypal" | "apple" | "google_play" | "paddle" | "recurly" | "unknown";
export type ScanPass = 1 | 2 | 3;

export type User = {
  id: string;
  email: string;
  totalSavedCents: number;
  plan: Plan;
  cancellationsUsed: number;
  freeCancelLimit: number;
};

export type ConnectedAccount = {
  id: string;
  userId: string;
  provider: Provider;
  lastScanAt: string | null;
};

export type Subscription = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string | null;
  sourceEmailId: string | null;
  billingSource: BillingSource;
  category: string;
  status: SubscriptionStatus;
  lastActivityAt: string | null;
  daysInactive: number;
  wasteScore: number;
  wasteReason: WasteReason;
  cancelUrl: string | null;
  cancelMethod: CancelMethod;
};

export type Transaction = {
  id: string;
  subscriptionId: string;
  amount: number;
  date: string;
  isTrial: boolean;
};

export type CancellationLog = {
  id: string;
  subscriptionId: string;
  method: CancelMethod;
  status: CancelStatus;
  emailTemplate: string | null;
};

export type RawScanHit = {
  name: string;
  slug: string;
  senderEmail: string;
  senderDomain: string;
  amount: number | null;
  currency: string;
  date: string;
  billingCycle: BillingCycle | null;
  failed: boolean;
  sourceEmailId: string;
  pass: ScanPass;
  snippet: string;
  links: string[];
};
