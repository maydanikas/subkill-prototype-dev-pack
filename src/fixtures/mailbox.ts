import type { BillingCycle, BillingSource } from "../types";

/** Inbox stand-in until Gmail OAuth is connected. Scanner API should return this shape. */
export type MailboxHit = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDays: number;
  category: string;
  categoryKey: string;
  daysInactive: number;
  lastPaidAt?: string | null;
  color: string;
  letter: string;
  supportEmail: string;
  isTrialTrap?: boolean;
  billingSource?: BillingSource;
  senderDomain?: string;
  links?: string[];
};

export const DEMO_MAILBOX: MailboxHit[] = [
  { id: "1", name: "Netflix", slug: "netflix", price: 15.99, currency: "$", billingCycle: "monthly", nextBillingDays: 3, category: "Развлечения", categoryKey: "entertainment", daysInactive: 34, color: "#E50914", letter: "N", supportEmail: "support@netflix.com" },
  { id: "2", name: "Spotify Premium", slug: "spotify", price: 10.99, currency: "$", billingCycle: "monthly", nextBillingDays: 12, category: "Музыка", categoryKey: "music", daysInactive: 0, color: "#1DB954", letter: "S", supportEmail: "support@spotify.com" },
  { id: "3", name: "Adobe Creative Cloud", slug: "adobe", price: 22.99, currency: "$", billingCycle: "monthly", nextBillingDays: 1, category: "Работа", categoryKey: "work", daysInactive: 5, color: "#FF0000", letter: "A", supportEmail: "billing@adobe.com" },
  { id: "4", name: "YouTube Premium", slug: "youtube-premium", price: 13.99, currency: "$", billingCycle: "monthly", nextBillingDays: 5, category: "Развлечения", categoryKey: "entertainment", daysInactive: 1, color: "#FF0000", letter: "Y", supportEmail: "no-reply@youtube.com", billingSource: "google_play" },
  { id: "5", name: "Notion AI", slug: "notion", price: 10, currency: "$", billingCycle: "monthly", nextBillingDays: 20, category: "Продуктивность", categoryKey: "productivity", daysInactive: 2, color: "#FFFFFF", letter: "N", supportEmail: "team@makenotion.com" },
  { id: "6", name: "Tinder Plus", slug: "tinder", price: 19.99, currency: "$", billingCycle: "monthly", nextBillingDays: 7, category: "Дейтинг", categoryKey: "dating", daysInactive: 52, color: "#FD2D55", letter: "T", supportEmail: "help@gotinder.com" },
  { id: "7", name: "iCloud+ 200GB", slug: "icloud", price: 2.99, currency: "$", billingCycle: "monthly", nextBillingDays: 15, category: "Хранилище", categoryKey: "storage", daysInactive: 0, color: "#007AFF", letter: "i", supportEmail: "support@apple.com", billingSource: "apple" },
  { id: "8", name: "Strava Premium", slug: "strava", price: 11.99, currency: "$", billingCycle: "monthly", nextBillingDays: 9, category: "Фитнес", categoryKey: "fitness", daysInactive: 45, color: "#FC4C02", letter: "S", supportEmail: "support@strava.com" },
  { id: "9", name: "Disney+", slug: "disney-plus", price: 9.99, currency: "$", billingCycle: "monthly", nextBillingDays: 9, category: "Развлечения", categoryKey: "entertainment", daysInactive: 28, color: "#113CCF", letter: "D", supportEmail: "help@disneyplus.com" },
  { id: "10", name: "ChatGPT Plus", slug: "chatgpt", price: 20, currency: "$", billingCycle: "monthly", nextBillingDays: 2, category: "Работа", categoryKey: "work", daysInactive: 0, color: "#74AA9C", letter: "C", supportEmail: "support@openai.com" },
  { id: "11", name: "Apple Arcade", slug: "apple-arcade", price: 4.99, currency: "$", billingCycle: "monthly", nextBillingDays: 18, category: "Развлечения", categoryKey: "entertainment", daysInactive: 61, color: "#FA1744", letter: "A", supportEmail: "support@apple.com", billingSource: "apple" },
  { id: "12", name: "Medium", slug: "medium", price: 5, currency: "$", billingCycle: "monthly", nextBillingDays: 22, category: "Продуктивность", categoryKey: "productivity", daysInactive: 40, color: "#000000", letter: "M", supportEmail: "support@medium.com" },
  { id: "13", name: "Calm", slug: "calm", price: 14.99, currency: "$", billingCycle: "monthly", nextBillingDays: 6, category: "Здоровье", categoryKey: "health", daysInactive: 60, color: "#6A5AF9", letter: "C", supportEmail: "support@calm.com", isTrialTrap: true },
  { id: "14", name: "Figma Pro", slug: "figma", price: 15, currency: "$", billingCycle: "monthly", nextBillingDays: 11, category: "Работа", categoryKey: "work", daysInactive: 3, color: "#1ABCFE", letter: "F", supportEmail: "support@figma.com" },
];

export const SCAN_PASSES = [
  { pass: 1, label: "Чеки Stripe • PayPal • Apple • Play", hint: "ищем списания, не справочник брендов" },
  { pass: 2, label: "Welcome и триалы", hint: "subscription active • trial started" },
  { pass: 3, label: "Известные сервисы", hint: "last-used по домену, не поиск по странам" },
] as const;

export const USER_EMAIL = "you@mail.com";
export const DEMO_USER_NAME = "User";
