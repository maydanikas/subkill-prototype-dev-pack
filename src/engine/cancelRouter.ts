import type { BillingSource, CancelMethod } from "../types";
import { pickCancelUrl, type CancelPlace } from "./cancelLink";

export type CancelRoute = {
  method: CancelMethod;
  place: CancelPlace;
  url: string | null;
  instructionKey: string | null;
};

/**
 * Open the place that actually bills this subscription.
 * Play / Apple / PayPal → their one subscriptions page (covers unknown apps too).
 * Stripe / web → link from the receipt, else the known account URL, else the sender's website.
 * Never a fake "send email" kill.
 */
export function routeCancel(input: {
  billingSource: BillingSource;
  links: string[];
  kbUrl: string | null;
  senderDomain: string;
}): CancelRoute {
  const picked = pickCancelUrl(input);
  if (picked.place === "google_play") {
    return {
      method: "instruction",
      place: "google_play",
      url: picked.url,
      instructionKey: "google_play_subscriptions",
    };
  }
  if (picked.place === "apple") {
    return {
      method: "instruction",
      place: "apple",
      url: picked.url,
      instructionKey: "apple_subscriptions",
    };
  }
  if (picked.place === "paypal") {
    return {
      method: "instruction",
      place: "paypal",
      url: picked.url,
      instructionKey: "paypal_autopay",
    };
  }
  return {
    method: "direct_link",
    place: "web",
    url: picked.url,
    instructionKey: null,
  };
}
