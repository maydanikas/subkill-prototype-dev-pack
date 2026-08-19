import { extractHrefs, uniqueUrls } from "../engine/cancelLink";
import { behaviorQuery, cardChargeQuery, knownPaidQuery, receiptQuery, welcomeQuery } from "../engine/scannerQueries";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_SCOPES = `${GMAIL_SCOPE} openid email profile`;

export type GoogleIdentity = {
  email: string;
  name: string;
  picture: string | null;
};

export function googleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
}

export function hasGoogleClient(): boolean {
  return googleClientId().length > 0;
}

export function oauthRedirectUri(): string {
  return window.location.origin;
}

export function beginGmailRedirect(): void {
  sessionStorage.setItem("subkill.oauthPending", "1");
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: oauthRedirectUri(),
    response_type: "token",
    scope: GOOGLE_SCOPES,
    include_granted_scopes: "true",
    prompt: "select_account",
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export function oauthReturnError(): string | null {
  const q = new URLSearchParams(window.location.search);
  const err = q.get("error_description") || q.get("error");
  if (err) history.replaceState(null, "", window.location.pathname);
  return err;
}

export function takePendingToken(): string | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (raw.includes("access_token")) {
    const token = new URLSearchParams(raw).get("access_token");
    if (token) {
      sessionStorage.setItem("subkill.accessToken", token);
      history.replaceState(null, "", window.location.pathname + window.location.search);
      return token;
    }
  }
  return sessionStorage.getItem("subkill.accessToken");
}

export function clearPendingToken(): void {
  sessionStorage.removeItem("subkill.accessToken");
  sessionStorage.removeItem("subkill.oauthPending");
}

type GmailMessageList = { messages?: Array<{ id: string }> };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
};

async function gmailGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail ${res.status}: ${body.slice(0, 180)}`);
  }
  return res.json() as Promise<T>;
}

function header(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFrom(raw: string): { email: string; domain: string; name: string } {
  const emailMatch = raw.match(/<([^>]+)>/) ?? raw.match(/([^\s]+@[^\s]+)/);
  const email = (emailMatch?.[1] ?? raw).trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const nameMatch = raw.match(/^"?([^"<]+)"?\s*</);
  return { email, domain, name: nameMatch?.[1]?.trim() ?? domain.split(".")[0] ?? email };
}

export type FetchedMail = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  pass: 1 | 2 | 3;
  links: string[];
};

function decodeB64Url(data: string): string {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function collectText(part: GmailPart | undefined, out: string[]): void {
  if (!part) return;
  if (part.mimeType === "text/plain" && part.body?.data) {
    out.push(decodeB64Url(part.body.data));
  }
  if (part.mimeType === "text/html" && part.body?.data && out.length === 0) {
    out.push(
      decodeB64Url(part.body.data)
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    );
  }
  part.parts?.forEach((child) => collectText(child, out));
}

function collectLinks(part: GmailPart | undefined, out: string[]): void {
  if (!part) return;
  if (part.body?.data && (part.mimeType === "text/html" || part.mimeType === "text/plain")) {
    out.push(...extractHrefs(decodeB64Url(part.body.data)));
  }
  part.parts?.forEach((child) => collectLinks(child, out));
}

function bodyText(msg: GmailMessage): string {
  const chunks: string[] = [];
  collectText(msg.payload, chunks);
  const fromParts = chunks.join(" ").replace(/\s+/g, " ").trim();
  const snippet = msg.snippet ?? "";
  const merged = `${snippet} ${fromParts}`.replace(/\s+/g, " ").trim();
  return merged.slice(0, 4000);
}

async function fetchPass(token: string, query: string, pass: 1 | 2 | 3, limit = 40): Promise<FetchedMail[]> {
  const list = await gmailGet<GmailMessageList>(
    token,
    `messages?q=${encodeURIComponent(query)}&maxResults=${limit}`,
  );
  const ids = (list.messages ?? []).map((m) => m.id).slice(0, limit);
  const mails: FetchedMail[] = [];
  for (const id of ids) {
    const path = pass === 1 ? `messages/${id}?format=full` : `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
    const msg = await gmailGet<GmailMessage>(token, path);
    const from = header(msg, "From");
    const links: string[] = [];
    if (pass === 1) collectLinks(msg.payload, links);
    mails.push({
      id,
      from,
      subject: header(msg, "Subject"),
      snippet: pass === 1 ? bodyText(msg) : (msg.snippet ?? ""),
      date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString(),
      pass,
      links: uniqueUrls(links),
    });
  }
  return mails;
}

function afterStamp(monthsBack: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function uniqueById(mails: FetchedMail[]): FetchedMail[] {
  const seen = new Set<string>();
  return mails.filter((mail) => {
    if (seen.has(mail.id)) return false;
    seen.add(mail.id);
    return true;
  });
}

function isPlaceholderPhoto(url: string): boolean {
  return /default-user|\/a\/default[=/]|photodefault/i.test(url);
}

export async function fetchGoogleIdentity(token: string): Promise<GoogleIdentity> {
  const profile = await gmailGet<{ emailAddress?: string }>(token, "profile");
  const email = profile.emailAddress ?? "";
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { email, name: "", picture: null };
    const data = (await res.json()) as {
      email?: string;
      name?: string;
      given_name?: string;
      picture?: string;
    };
    const picture = data.picture?.trim() ?? "";
    return {
      email: data.email || email,
      name: (data.given_name || data.name || "").trim(),
      picture: picture && !isPlaceholderPhoto(picture) ? picture : null,
    };
  } catch {
    return { email, name: "", picture: null };
  }
}

export async function scanGmail(
  token: string,
  onPass: (pass: number) => void,
): Promise<{
  email: string;
  name: string;
  picture: string | null;
  mails: FetchedMail[];
  passCounts: { receipts: number; welcome: number; behavior: number };
}> {
  const identity = await fetchGoogleIdentity(token);
  const after = afterStamp(18);
  onPass(1);
  const receiptHits = [
    ...(await fetchPass(token, receiptQuery(after), 1, 50)),
    ...(await fetchPass(token, knownPaidQuery(after), 1, 30)),
    ...(await fetchPass(token, cardChargeQuery(after), 1, 30)),
  ];
  const receipts = uniqueById(receiptHits);
  onPass(2);
  const welcome = await fetchPass(token, welcomeQuery(after), 2, 50);
  onPass(3);
  const behavior = await fetchPass(token, behaviorQuery(after), 3, 50);
  const seen = new Set<string>();
  const mails: FetchedMail[] = [];
  for (const mail of [...receipts, ...welcome, ...behavior]) {
    if (seen.has(mail.id)) continue;
    seen.add(mail.id);
    mails.push(mail);
  }
  return {
    email: identity.email,
    name: identity.name,
    picture: identity.picture,
    mails,
    passCounts: { receipts: receipts.length, welcome: welcome.length, behavior: behavior.length },
  };
}

export { parseFrom };
