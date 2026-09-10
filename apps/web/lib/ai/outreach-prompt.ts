export type DraftType =
  | "initial"
  | "follow_up"
  | "second_follow_up"
  | "meeting_request"
  | "proposal_follow_up"
  | "re_engagement";

export const DRAFT_TYPES: { value: DraftType; label: string }[] = [
  { value: "initial", label: "Initial outreach" },
  { value: "follow_up", label: "Follow-up" },
  { value: "second_follow_up", label: "Second follow-up" },
  { value: "meeting_request", label: "Meeting request" },
  { value: "proposal_follow_up", label: "Proposal follow-up" },
  { value: "re_engagement", label: "Re-engagement" },
];

const DRAFT_TYPE_INSTRUCTIONS: Record<DraftType, string> = {
  initial: "This is the first message to this contact. Introduce why you're reaching out, tied directly to the buying signal below.",
  follow_up: "This is a follow-up after no response to a previous message. Be brief, add one new piece of value, and make it easy to reply.",
  second_follow_up: "This is a second follow-up after two prior messages went unanswered. Keep it short and give a graceful way to say 'not now'.",
  meeting_request: "Ask for a short call/meeting. Propose that you're flexible on timing and state the specific topic briefly.",
  proposal_follow_up: "Follow up on a proposal or offer already sent. Ask if they have questions or need anything else to decide.",
  re_engagement: "This lead went quiet a while ago. Re-open the conversation referencing what changed or why now might be a better time.",
};

export interface OutreachDraftContext {
  companyName: string;
  companyWebsite: string | null;
  companyIndustry: string | null;
  companyCountry: string | null;
  contactName: string | null;
  contactTitle: string | null;
  buyingSignalSummary: string | null;
  recommendedOffer: string | null;
  qualificationSummary: string | null;
  serviceType: string | null;
  evidence: { description: string; url: string | null }[];
  previousOutreach: { channel: string; message: string | null; sentAt: string | null }[];
}

/**
 * Builds a grounded outreach-drafting prompt from only what's actually on
 * file for this lead — never invents facts, and tells the model the same.
 */
export function buildOutreachPrompt(ctx: OutreachDraftContext, draftType: DraftType): string {
  const lines: string[] = [];

  lines.push(
    "You are drafting a short, professional outreach message for a B2B/B2C business development contact. " +
      "Use ONLY the facts provided below. Do not invent details, numbers, dates, or claims that aren't stated here. " +
      "If a detail (like the contact's name) is missing, write around it naturally rather than guessing one. " +
      "Keep it concise (under 150 words), no marketing fluff, no emojis, no subject line — just the message body."
  );
  lines.push(`\nMessage type: ${DRAFT_TYPE_INSTRUCTIONS[draftType]}`);

  lines.push("\n--- Company ---");
  lines.push(`Name: ${ctx.companyName}`);
  if (ctx.companyWebsite) lines.push(`Website: ${ctx.companyWebsite}`);
  if (ctx.companyIndustry) lines.push(`Industry: ${ctx.companyIndustry}`);
  if (ctx.companyCountry) lines.push(`Country: ${ctx.companyCountry}`);

  lines.push("\n--- Contact ---");
  lines.push(ctx.contactName ? `Name: ${ctx.contactName}` : "No named contact on file — address the company/team generally.");
  if (ctx.contactTitle) lines.push(`Title: ${ctx.contactTitle}`);

  lines.push("\n--- Why we're reaching out ---");
  lines.push(ctx.buyingSignalSummary ?? "No specific buying signal recorded.");
  if (ctx.qualificationSummary) lines.push(`Qualification notes: ${ctx.qualificationSummary}`);
  if (ctx.serviceType) lines.push(`Relevant service: ${ctx.serviceType}`);
  if (ctx.recommendedOffer) lines.push(`Offer to reference: ${ctx.recommendedOffer}`);

  if (ctx.evidence.length > 0) {
    lines.push("\n--- Supporting evidence ---");
    for (const e of ctx.evidence.slice(0, 3)) {
      lines.push(`- ${e.description}${e.url ? ` (${e.url})` : ""}`);
    }
  }

  if (ctx.previousOutreach.length > 0) {
    lines.push("\n--- Previous outreach to this lead (most recent first) ---");
    for (const o of ctx.previousOutreach.slice(0, 3)) {
      lines.push(`- [${o.channel}${o.sentAt ? `, ${o.sentAt.slice(0, 10)}` : ""}] ${o.message ?? "(no message text recorded)"}`);
    }
  }

  return lines.join("\n");
}
