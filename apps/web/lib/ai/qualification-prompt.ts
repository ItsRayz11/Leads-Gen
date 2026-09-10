export const SIGNAL_STRENGTHS = ["weak", "moderate", "strong"] as const;
export type SignalStrengthValue = (typeof SIGNAL_STRENGTHS)[number];

export interface QualificationContext {
  vertical: string;
  leadTitle: string;
  status: string;
  score: number;
  tier: string | null;
  serviceType: string | null;
  opportunityType: string | null;
  freshness: string | null;
  currentSignalStrength: string | null;
  existingQualificationSummary: string | null;
  existingRecommendedOffer: string | null;
  buyingSignalSummary: string | null;
  companyName: string;
  companyWebsite: string | null;
  companyIndustry: string | null;
  companyCountry: string | null;
  companyDescription: string | null;
  companySize: string | null;
  contactName: string | null;
  contactTitle: string | null;
  signals: { type: string; description: string; strength: string | null; date: string | null }[];
  evidence: { description: string; url: string | null; source: string; freshness: string | null }[];
  scoreBreakdown: { label: string; points: number }[];
  verticalData: Record<string, unknown>;
}

export interface QualificationDraft {
  qualificationSummary: string;
  recommendedOffer: string | null;
  signalStrength: SignalStrengthValue | null;
  fitReasons: string[];
  risks: string[];
  missingInformation: string[];
}

/** The services this workspace actually sells, so the offer isn't invented. */
const OFFER_MENU: Record<string, string[]> = {
  hiring: [
    "community management (Discord/Telegram moderation and growth)",
    "social media management and content",
    "KOL / influencer marketing coordination",
    "crypto marketing campaign management",
  ],
  general: [
    "social media management and content",
    "community building and management",
    "growth/marketing retainer",
  ],
  card_affiliate: [
    "Bitget Wallet Card affiliate partnership (agency refers clients, earns per activation)",
    "co-marketing of the card to the agency's existing client base",
  ],
};

function formatVerticalData(data: Record<string, unknown>): string[] {
  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 15)
    .map(([key, value]) => `- ${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
}

/**
 * Builds a grounded lead-qualification prompt. Same rule as outreach
 * drafting: only the facts on file, plus an explicit instruction to name what
 * is missing rather than filling the gap with a plausible guess — a
 * qualification summary that invents a funding round is worse than none.
 */
export function buildQualificationPrompt(ctx: QualificationContext): string {
  const lines: string[] = [];

  lines.push(
    "You are qualifying a B2B/B2C business-development lead for a freelance marketing operator. " +
      "Judge how good an opportunity this is using ONLY the facts below. " +
      "Do not invent funding, headcount, budget, dates, or client names that aren't stated here. " +
      "If something important is missing, list it under missingInformation instead of guessing it."
  );

  lines.push("");
  lines.push("Respond with ONLY a JSON object, no markdown fences and no prose:");
  lines.push("{");
  lines.push('  "qualificationSummary": string,   // 2-4 sentences: why this lead is or is not worth pursuing now');
  lines.push('  "recommendedOffer": string|null,  // which service to lead with, from the menu below');
  lines.push(`  "signalStrength": ${SIGNAL_STRENGTHS.map((s) => `"${s}"`).join("|")}|null,`);
  lines.push('  "fitReasons": string[],           // short concrete reasons this fits, each tied to a fact above');
  lines.push('  "risks": string[],                // short concrete reasons this may not convert');
  lines.push('  "missingInformation": string[]    // what you would need to check before reaching out');
  lines.push("}");

  const offers = OFFER_MENU[ctx.vertical] ?? OFFER_MENU.general;
  lines.push("");
  lines.push("--- Services available to offer (pick from these only) ---");
  for (const offer of offers) lines.push(`- ${offer}`);

  lines.push("");
  lines.push("--- Lead ---");
  lines.push(`Title: ${ctx.leadTitle}`);
  lines.push(`Vertical: ${ctx.vertical}`);
  lines.push(`Current pipeline status: ${ctx.status.replace(/_/g, " ")}`);
  lines.push(`Rule-based score: ${ctx.score}/100${ctx.tier ? ` (tier ${ctx.tier})` : ""}`);
  if (ctx.serviceType) lines.push(`Service type on file: ${ctx.serviceType}`);
  if (ctx.opportunityType) lines.push(`Opportunity type: ${ctx.opportunityType}`);
  if (ctx.freshness) lines.push(`Signal freshness: ${ctx.freshness}`);
  if (ctx.currentSignalStrength) lines.push(`Signal strength on file: ${ctx.currentSignalStrength}`);
  if (ctx.buyingSignalSummary) lines.push(`Buying signal: ${ctx.buyingSignalSummary}`);

  lines.push("");
  lines.push("--- Company ---");
  lines.push(`Name: ${ctx.companyName}`);
  if (ctx.companyWebsite) lines.push(`Website: ${ctx.companyWebsite}`);
  if (ctx.companyIndustry) lines.push(`Industry: ${ctx.companyIndustry}`);
  if (ctx.companyCountry) lines.push(`Country: ${ctx.companyCountry}`);
  if (ctx.companySize) lines.push(`Size: ${ctx.companySize}`);
  if (ctx.companyDescription) lines.push(`Description: ${ctx.companyDescription}`);

  lines.push("");
  lines.push("--- Contact ---");
  lines.push(
    ctx.contactName
      ? `${ctx.contactName}${ctx.contactTitle ? ` — ${ctx.contactTitle}` : ""}`
      : "No named contact found yet (this matters: no contact means no reachable decision-maker)."
  );

  if (ctx.signals.length > 0) {
    lines.push("");
    lines.push("--- Recorded buying signals ---");
    for (const s of ctx.signals.slice(0, 6)) {
      lines.push(
        `- [${s.type}${s.strength ? `, ${s.strength}` : ""}${s.date ? `, ${s.date}` : ""}] ${s.description}`
      );
    }
  }

  if (ctx.evidence.length > 0) {
    lines.push("");
    lines.push("--- Evidence on file ---");
    for (const e of ctx.evidence.slice(0, 6)) {
      lines.push(
        `- (${e.source}${e.freshness ? `, ${e.freshness}` : ""}) ${e.description}${e.url ? ` — ${e.url}` : ""}`
      );
    }
  }

  if (ctx.scoreBreakdown.length > 0) {
    lines.push("");
    lines.push("--- How the rule-based score was reached ---");
    for (const b of ctx.scoreBreakdown) lines.push(`- ${b.label}: ${b.points >= 0 ? "+" : ""}${b.points}`);
  }

  const verticalDataLines = formatVerticalData(ctx.verticalData);
  if (verticalDataLines.length > 0) {
    lines.push("");
    lines.push("--- Vertical-specific data collected by the discovery connector ---");
    lines.push(...verticalDataLines);
  }

  if (ctx.existingQualificationSummary) {
    lines.push("");
    lines.push("--- Existing qualification summary (you may revise it) ---");
    lines.push(ctx.existingQualificationSummary);
  }
  if (ctx.existingRecommendedOffer) {
    lines.push(`Existing recommended offer: ${ctx.existingRecommendedOffer}`);
  }

  return lines.join("\n");
}

function toShortStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function parseQualificationJson(text: string): QualificationDraft | null {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(withoutFences.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const summary = typeof raw.qualificationSummary === "string" ? raw.qualificationSummary.trim() : "";
  if (!summary) return null;

  const strengthRaw = typeof raw.signalStrength === "string" ? raw.signalStrength.trim().toLowerCase() : "";
  const offer = typeof raw.recommendedOffer === "string" ? raw.recommendedOffer.trim() : "";

  return {
    qualificationSummary: summary,
    recommendedOffer: offer || null,
    signalStrength: (SIGNAL_STRENGTHS as readonly string[]).includes(strengthRaw)
      ? (strengthRaw as SignalStrengthValue)
      : null,
    fitReasons: toShortStringArray(raw.fitReasons),
    risks: toShortStringArray(raw.risks),
    missingInformation: toShortStringArray(raw.missingInformation),
  };
}
