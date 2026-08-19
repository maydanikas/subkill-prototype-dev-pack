import cancelUrls from "../../data/cancel_urls.json";
import type { BillingCycle, BillingSource } from "../types";

export type BrandRow = {
  slug: string;
  display_name: string;
  billing_source: BillingSource;
  cancel_url: string | null;
  method?: string;
  billing_cycle?: BillingCycle;
};

export const BRANDS = cancelUrls as BrandRow[];

/** Distinctive product hosts for naming a charge and last-used. Not a discovery catalog. */
const EXTRA_DOMAINS: Record<string, string[]> = {
  netflix: ["netflix.com"],
  spotify: ["spotify.com"],
  "disney-plus": ["disneyplus.com"],
  "hbo-max": ["max.com", "hbomax.com"],
  adobe: ["adobe.com"],
  figma: ["figma.com"],
  canva: ["canva.com"],
  notion: ["notion.so", "makenotion.com"],
  chatgpt: ["openai.com", "chatgpt.com"],
  claude: ["anthropic.com", "claude.ai"],
  cursor: ["cursor.com", "cursor.sh", "anysphere.com"],
  medium: ["medium.com"],
  dropbox: ["dropbox.com"],
  strava: ["strava.com"],
  calm: ["calm.com"],
  headspace: ["headspace.com"],
  tinder: ["gotinder.com", "tinder.com"],
  bumble: ["bumble.com"],
  duolingo: ["duolingo.com"],
  slack: ["slack.com"],
  zoom: ["zoom.us"],
  grammarly: ["grammarly.com"],
  evernote: ["evernote.com"],
  "obsidian-sync": ["obsidian.md"],
  nordvpn: ["nordvpn.com"],
  "1password": ["1password.com"],
  todoist: ["todoist.com"],
  artlist: ["artlist.io"],
  "wispr-flow": ["wisprflow.ai"],
  "tuya-smart-life": ["tuya.com", "smartlife.tech", "smartlife.com"],
  funda: ["funda.nl"],
  pararius: ["pararius.com", "pararius.nl"],
  kamernet: ["kamernet.nl"],
  housinganywhere: ["housinganywhere.com"],
  huurwoningen: ["huurwoningen.nl"],
  stekkies: ["stekkies.com"],
  idealista: ["idealista.com"],
  immowelt: ["immowelt.de"],
  immoscout24: ["immobilienscout24.de", "immoscout24.ch"],
  rightmove: ["rightmove.co.uk"],
  zoopla: ["zoopla.co.uk"],
  spotahome: ["spotahome.com"],
  "dim-ria": ["dom.ria.com"],
  vesteda: ["vesteda.com", "vesteda.nl"],
  holland2stay: ["holland2stay.com"],
  heimstaden: ["heimstaden.nl", "heimstaden.com"],
  amvest: ["amvest.nl"],
  greystar: ["greystar.com"],
  ourdomain: ["ourdomain.nl"],
  "change-equals": ["change-equals.com"],
  duwo: ["duwo.nl"],
  ssh: ["sshxl.nl"],
  camelot: ["cameloteurope.com"],
  thesocialhub: ["thesocialhub.co"],
  interhouse: ["interhouse.nl"],
  rotsvast: ["rotsvast.nl"],
  directwonen: ["directwonen.nl"],
  woningnet: ["woningnet.nl"],
  househunting: ["househunting.nl"],
};

export function domainsFor(slug: string): string[] {
  return EXTRA_DOMAINS[slug] ?? [];
}

const LANDLORD_HOSTS = new Set([
  "vesteda.com",
  "vesteda.nl",
  "holland2stay.com",
  "heimstaden.nl",
  "heimstaden.com",
  "amvest.nl",
  "greystar.com",
  "ourdomain.nl",
  "change-equals.com",
  "duwo.nl",
  "sshxl.nl",
  "cameloteurope.com",
  "thesocialhub.co",
  "interhouse.nl",
  "rotsvast.nl",
  "directwonen.nl",
  "woningnet.nl",
  "househunting.nl",
]);

const PASS3_SKIP = new Set(["medium.com", "dropbox.com", "tinder.com", "gotinder.com", "bumble.com", "max.com"]);

/** Local housing portals — keep for naming a Stripe/Play charge, never crawl them. */
const NOT_DISCOVERY_SLUGS = new Set([
  "funda",
  "pararius",
  "kamernet",
  "housinganywhere",
  "huurwoningen",
  "stekkies",
  "idealista",
  "immowelt",
  "immoscout24",
  "rightmove",
  "zoopla",
  "spotahome",
  "dim-ria",
  "vesteda",
  "holland2stay",
  "heimstaden",
  "amvest",
  "greystar",
  "ourdomain",
  "change-equals",
  "duwo",
  "ssh",
  "camelot",
  "thesocialhub",
  "interhouse",
  "rotsvast",
  "directwonen",
  "woningnet",
  "househunting",
]);

export function pass3Domains(): string[] {
  return [
    ...new Set(
      Object.entries(EXTRA_DOMAINS)
        .filter(([slug]) => !NOT_DISCOVERY_SLUGS.has(slug))
        .flatMap(([, hosts]) => hosts)
        .filter((d) => !PASS3_SKIP.has(d) && !LANDLORD_HOSTS.has(d)),
    ),
  ].sort();
}

export function hostMatches(domain: string, hosts: string[]): boolean {
  const host = domain.toLowerCase();
  return hosts.some((d) => host === d || host.endsWith(`.${d}`));
}

const ALIASES: Array<{ re: RegExp; slug: string }> = [
  { re: /\banysphere\b/i, slug: "cursor" },
  { re: /google one|gemini advanced|google ai pro|ai premium/i, slug: "google-one" },
  { re: /smart\s?life|\btuya\b/i, slug: "tuya-smart-life" },
  { re: /housing\s?anywhere/i, slug: "housinganywhere" },
  { re: /immo\s?scout|immobilienscout/i, slug: "immoscout24" },
  { re: /dim\.?ria|dom\.ria/i, slug: "dim-ria" },
  { re: /\bvesteda\b/i, slug: "vesteda" },
  { re: /holland\s?2\s?stay/i, slug: "holland2stay" },
  { re: /change\s?=/i, slug: "change-equals" },
  { re: /the social hub|student hotel/i, slug: "thesocialhub" },
];

export function matchBrand(name: string, domain: string, text = ""): BrandRow | undefined {
  const host = domain.toLowerCase();
  for (const row of BRANDS) {
    if (hostMatches(host, domainsFor(row.slug))) return row;
  }

  const hay = `${name} ${text}`;
  for (const alias of ALIASES) {
    if (alias.re.test(hay)) return BRANDS.find((row) => row.slug === alias.slug);
  }

  const lower = hay.toLowerCase();
  for (const row of BRANDS) {
    const needle = row.display_name.toLowerCase();
    if (needle.length < 5) continue;
    if (lower.includes(needle)) return row;
    const slugWords = row.slug.replace(/-/g, " ");
    if (slugWords.length >= 5 && lower.includes(slugWords)) return row;
  }
  return undefined;
}
